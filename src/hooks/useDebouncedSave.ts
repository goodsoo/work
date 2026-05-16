import { useCallback, useEffect, useRef, useState } from "react";
import { formatError } from "../lib/errors";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export type UseDebouncedSaveOptions<T> = {
  save: (value: T) => Promise<unknown>;
  delay?: number;
  savedFlashMs?: number;
};

export type UseDebouncedSaveResult<T> = {
  status: SaveStatus;
  error: Error | null;
  schedule: (value: T) => void;
  flush: () => Promise<void>;
  cancel: () => void;
};

export function useDebouncedSave<T>(
  options: UseDebouncedSaveOptions<T>
): UseDebouncedSaveResult<T> {
  const { save, delay = 1000, savedFlashMs = 1500 } = options;

  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const timerRef = useRef<number | null>(null);
  const flashRef = useRef<number | null>(null);
  const pendingRef = useRef<{ value: T } | null>(null);
  const inFlightRef = useRef(false);
  const requeueRef = useRef(false);
  const mountedRef = useRef(true);

  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<Error | null>(null);

  const setStatusSafe = useCallback((next: SaveStatus) => {
    if (mountedRef.current) setStatus(next);
  }, []);

  const drain = useCallback(async () => {
    if (inFlightRef.current) {
      requeueRef.current = true;
      return;
    }
    while (pendingRef.current) {
      const { value } = pendingRef.current;
      pendingRef.current = null;
      inFlightRef.current = true;
      setStatusSafe("saving");
      setError(null);
      try {
        await saveRef.current(value);
        if (!mountedRef.current) return;
        if (!pendingRef.current && !requeueRef.current) {
          setStatusSafe("saved");
          if (flashRef.current != null) window.clearTimeout(flashRef.current);
          flashRef.current = window.setTimeout(() => {
            flashRef.current = null;
            setStatusSafe("idle");
          }, savedFlashMs);
        }
      } catch (e) {
        if (!mountedRef.current) return;
        setError(e instanceof Error ? e : new Error(formatError(e)));
        setStatusSafe("error");
        return;
      } finally {
        inFlightRef.current = false;
      }
      if (!requeueRef.current) break;
      requeueRef.current = false;
    }
  }, [savedFlashMs, setStatusSafe]);

  const schedule = useCallback(
    (value: T) => {
      pendingRef.current = { value };
      if (!inFlightRef.current) setStatusSafe("pending");
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void drain();
      }, delay);
    },
    [delay, drain, setStatusSafe]
  );

  const flush = useCallback(async () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await drain();
  }, [drain]);

  const cancel = useCallback(() => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    if (flashRef.current != null) window.clearTimeout(flashRef.current);
    timerRef.current = null;
    flashRef.current = null;
    pendingRef.current = null;
    requeueRef.current = false;
    setStatusSafe("idle");
    setError(null);
  }, [setStatusSafe]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      if (flashRef.current != null) window.clearTimeout(flashRef.current);
    };
  }, []);

  return { status, error, schedule, flush, cancel };
}
