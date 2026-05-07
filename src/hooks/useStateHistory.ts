import { useCallback, useEffect, useRef, useState } from "react";

export type UseStateHistoryOptions<T> = {
  /** Initial value. Reapplied when reKey changes. */
  initial: T;
  /** Stable identity (e.g., document id). When this changes, history resets. */
  reKey?: unknown;
  /** Synchronously called on every set/undo/redo with the new value (visible update). */
  onChange?: (next: T) => void;
  /** Called after debounce on set, and immediately on undo/redo/flush (server save). */
  onCommit?: (next: T) => void;
  /** Debounce window for committing a snapshot (ms). */
  commitMs?: number;
  /** Max number of snapshots in history. */
  maxDepth?: number;
  /** Custom equality (default: ===). */
  isEqual?: (a: T, b: T) => boolean;
};

export type UseStateHistoryResult<T> = {
  value: T;
  set: (next: T) => void;
  undo: () => void;
  redo: () => void;
  /** Force commit any pending edit immediately (e.g., before navigation away). */
  flush: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

function defaultEq<T>(a: T, b: T): boolean {
  return a === b;
}

/**
 * Generic undo/redo state container with debounced snapshotting.
 *
 * `set` updates the value visibly (via onChange) and schedules a snapshot
 * commit + save (via onCommit) after `commitMs`. `undo`/`redo` apply the
 * neighbor snapshot and trigger onCommit immediately.
 */
export function useStateHistory<T>(
  opts: UseStateHistoryOptions<T>,
): UseStateHistoryResult<T> {
  const {
    initial,
    reKey,
    onChange,
    onCommit,
    commitMs = 800,
    maxDepth = 100,
    isEqual = defaultEq,
  } = opts;

  const [value, setValue] = useState<T>(initial);
  const [history, setHistory] = useState<T[]>([initial]);
  const [pointer, setPointer] = useState(0);

  // Reset on reKey change (state-based, no refs during render).
  const [trackedReKey, setTrackedReKey] = useState<unknown>(reKey);
  if (trackedReKey !== reKey) {
    setTrackedReKey(reKey);
    setValue(initial);
    setHistory([initial]);
    setPointer(0);
  }

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

  const commitTimerRef = useRef<number | null>(null);

  const set = useCallback(
    (next: T) => {
      setValue(next);
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
    window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = null;
    setHistory((prev) => {
      const truncated = prev.slice(0, pointer + 1);
      if (
        truncated.length > 0 &&
        eq(truncated[truncated.length - 1], value)
      ) {
        return prev;
      }
      const appended = [...truncated, value];
      const overflow = Math.max(0, appended.length - maxDepth);
      const trimmed = overflow > 0 ? appended.slice(overflow) : appended;
      setPointer(trimmed.length - 1);
      return trimmed;
    });
    onCommitRef.current?.(value);
  }, [pointer, value, maxDepth]);

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
