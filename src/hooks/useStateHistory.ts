import { useCallback, useEffect, useRef, useState } from "react";

type CachedState<T> = { value: T; history: T[]; pointer: number };

// Module-level cache shared across all useStateHistory instances.
// Persists across component remounts so undo/redo survives navigation.
// cacheKey 는 영구 uid 기반 (`${uid}:body` 등) — 같은 file path 를 다른 entity 가
// 차지해도 uid 다름 → cache 침범 없음. cleanup 코드 burden 없음.
const HISTORY_CACHE = new Map<string, CachedState<unknown>>();

export type UseStateHistoryOptions<T> = {
  /** Initial value. Used on first mount and on cache miss. */
  initial: T;
  /**
   * Stable identity for this history stack. When it changes:
   *  - The outgoing key's state is saved to a module-level cache.
   *  - The incoming key's state is restored from cache (or `initial`).
   *  - Any pending debounced commit is flushed via `onCommit` using the
   *    callback that was active at transition time (so saves go to the
   *    correct outgoing entity).
   * Pass `undefined` to disable cache participation.
   */
  cacheKey?: string;
  onChange?: (next: T) => void;
  onCommit?: (next: T) => void;
  commitMs?: number;
  maxDepth?: number;
  isEqual?: (a: T, b: T) => boolean;
};

export type UseStateHistoryResult<T> = {
  value: T;
  set: (next: T) => void;
  undo: () => void;
  redo: () => void;
  /** Force commit any pending edit immediately. */
  flush: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

function defaultEq<T>(a: T, b: T): boolean {
  return a === b;
}

export function useStateHistory<T>(
  opts: UseStateHistoryOptions<T>,
): UseStateHistoryResult<T> {
  const {
    initial,
    cacheKey,
    onChange,
    onCommit,
    commitMs = 800,
    maxDepth = 100,
    isEqual = defaultEq,
  } = opts;

  // Initial state — restore from cache if available, else use `initial`.
  const initialState = (() => {
    if (cacheKey !== undefined) {
      const cached = HISTORY_CACHE.get(cacheKey) as
        | CachedState<T>
        | undefined;
      if (cached) return cached;
    }
    return { value: initial, history: [initial], pointer: 0 };
  });
  const [value, setValue] = useState<T>(() => initialState().value);
  const [history, setHistory] = useState<T[]>(() => initialState().history);
  const [pointer, setPointer] = useState(() => initialState().pointer);

  const onChangeRef = useRef(onChange);
  const onCommitRef = useRef(onCommit);
  const isEqualRef = useRef(isEqual);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);
  useEffect(() => {
    isEqualRef.current = isEqual;
  }, [isEqual]);

  // Latest snapshots for unmount cleanup (closure-safe).
  const valueRef = useRef(value);
  const historyRef = useRef(history);
  const pointerRef = useRef(pointer);
  const cacheKeyRef = useRef(cacheKey);
  valueRef.current = value;
  historyRef.current = history;
  pointerRef.current = pointer;
  cacheKeyRef.current = cacheKey;

  const commitTimerRef = useRef<number | null>(null);
  const pendingTransitionFlushRef = useRef<
    { value: T; onCommit: ((v: T) => void) | undefined } | null
  >(null);

  // cacheKey transition: save outgoing, restore incoming (state-based).
  const [trackedKey, setTrackedKey] = useState(cacheKey);
  if (trackedKey !== cacheKey) {
    // 1) Save outgoing state.
    if (trackedKey !== undefined) {
      HISTORY_CACHE.set(trackedKey, { value, history, pointer });
    }
    // 2) Defer pending commit to effect (so outgoing onCommit fires).
    if (commitTimerRef.current != null) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
      pendingTransitionFlushRef.current = {
        value,
        // onCommitRef still holds the previous render's callback —
        // the ref-update effect has not fired yet for this render.
        onCommit: onCommitRef.current,
      };
    }
    // 3) Restore incoming state.
    const cached =
      cacheKey !== undefined
        ? (HISTORY_CACHE.get(cacheKey) as CachedState<T> | undefined)
        : undefined;
    if (cached) {
      setValue(cached.value);
      setHistory(cached.history);
      setPointer(cached.pointer);
    } else {
      setValue(initial);
      setHistory([initial]);
      setPointer(0);
    }
    setTrackedKey(cacheKey);
  }

  // Fire deferred transition flush.
  useEffect(() => {
    if (pendingTransitionFlushRef.current) {
      const { value: v, onCommit: cb } = pendingTransitionFlushRef.current;
      pendingTransitionFlushRef.current = null;
      cb?.(v);
    }
  }, [trackedKey]);

  // Unmount: persist final state + fire pending commit.
  useEffect(() => {
    return () => {
      const ck = cacheKeyRef.current;
      if (ck !== undefined) {
        HISTORY_CACHE.set(ck, {
          value: valueRef.current,
          history: historyRef.current,
          pointer: pointerRef.current,
        });
      }
      if (commitTimerRef.current != null) {
        window.clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
        onCommitRef.current?.(valueRef.current);
      }
    };
  }, []);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      // valueRef 를 동기로 갱신 — 같은 turn 의 flush() 가 latest value 를 보도록.
      // setValue 는 비동기라 useCallback closure 의 value 만 봤다간 stale.
      valueRef.current = next;
      onChangeRef.current?.(next);
      if (commitTimerRef.current != null) {
        window.clearTimeout(commitTimerRef.current);
      }
      commitTimerRef.current = window.setTimeout(() => {
        commitTimerRef.current = null;
        setHistory((prev) => {
          const eq = isEqualRef.current;
          const truncated = prev.slice(0, pointer + 1);
          if (
            truncated.length > 0 &&
            eq(truncated[truncated.length - 1], next)
          ) {
            return prev;
          }
          const appended = [...truncated, next];
          const overflow = Math.max(0, appended.length - maxDepth);
          const trimmed = overflow > 0 ? appended.slice(overflow) : appended;
          setPointer(trimmed.length - 1);
          return trimmed;
        });
        onCommitRef.current?.(next);
      }, commitMs);
    },
    [commitMs, pointer, maxDepth],
  );

  const undo = useCallback(() => {
    let workingHistory = history;
    let workingPointer = pointer;
    const eq = isEqualRef.current;
    if (commitTimerRef.current != null && !eq(history[pointer], value)) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
      const truncated = history.slice(0, pointer + 1);
      const appended = [...truncated, value];
      const overflow = Math.max(0, appended.length - maxDepth);
      workingHistory = overflow > 0 ? appended.slice(overflow) : appended;
      workingPointer = workingHistory.length - 1;
    }
    if (workingPointer <= 0) {
      if (workingHistory !== history) {
        setHistory(workingHistory);
        setPointer(workingHistory.length - 1);
      }
      return;
    }
    const newPointer = workingPointer - 1;
    const newValue = workingHistory[newPointer];
    setHistory(workingHistory);
    setPointer(newPointer);
    setValue(newValue);
    onChangeRef.current?.(newValue);
    onCommitRef.current?.(newValue);
  }, [history, pointer, value, maxDepth]);

  const redo = useCallback(() => {
    if (pointer >= history.length - 1) return;
    const newPointer = pointer + 1;
    const newValue = history[newPointer];
    setPointer(newPointer);
    setValue(newValue);
    onChangeRef.current?.(newValue);
    onCommitRef.current?.(newValue);
  }, [history, pointer]);

  const flush = useCallback(() => {
    if (commitTimerRef.current == null) return;
    const eq = isEqualRef.current;
    // 같은 turn 에 set(next) → flush() 호출 시 useCallback closure 의 value 는
    // setValue 비동기라 stale. valueRef 가 set 안에서 동기로 갱신되니 그걸 사용.
    const v = valueRef.current;
    window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = null;
    setHistory((prev) => {
      const truncated = prev.slice(0, pointer + 1);
      if (
        truncated.length > 0 &&
        eq(truncated[truncated.length - 1], v)
      ) {
        return prev;
      }
      const appended = [...truncated, v];
      const overflow = Math.max(0, appended.length - maxDepth);
      const trimmed = overflow > 0 ? appended.slice(overflow) : appended;
      setPointer(trimmed.length - 1);
      return trimmed;
    });
    onCommitRef.current?.(v);
  }, [pointer, maxDepth]);

  const hasPendingEdit = !isEqual(history[pointer], value);

  return {
    value,
    set,
    undo,
    redo,
    flush,
    canUndo: pointer > 0 || hasPendingEdit,
    canRedo: pointer < history.length - 1,
  };
}
