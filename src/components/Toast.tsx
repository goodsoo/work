import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Ban, X } from "lucide-react";
import { Button } from "./common/Button";
import { Text } from "./common/Text";

// 글로벌 toast — 어느 컴포넌트에서나 `useToast().show("...")` 로 우측하단 frost
// 카드 띄움. MeetingForm 의 자체 actionError toast 와 같은 디자인 (var(--surface-frost)).
// 다른 토스트 라이브러리 의존성 없이 가볍게.

type Toast = {
  id: number;
  message: string;
  // null 이면 영구 (사용자가 X 눌러서 닫음). 숫자 ms 면 자동 dismiss.
  durationMs: number | null;
};

interface ToastContextValue {
  show(message: string, opts?: { durationMs?: number | null }): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextIdRef = useRef(1);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const show = useCallback<ToastContextValue["show"]>(
    (message, opts) => {
      const id = nextIdRef.current++;
      const durationMs = opts?.durationMs === undefined ? 5000 : opts.durationMs;
      setToasts((prev) => [...prev, { id, message, durationMs }]);
      if (durationMs !== null) {
        const t = setTimeout(() => dismiss(id), durationMs);
        timersRef.current.set(id, t);
      }
    },
    [dismiss],
  );

  useEffect(() => {
    return () => {
      for (const t of timersRef.current.values()) clearTimeout(t);
      timersRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toasts.length > 0 ? (
        <div
          className="pointer-events-none fixed z-50 flex max-w-sm flex-col gap-2"
          style={{
            bottom: "calc(var(--safe-bottom) + 1rem)",
            right: "1rem",
          }}
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className="animate-page-in pointer-events-auto flex flex-col gap-2 rounded-2xl p-3 text-sm backdrop-blur-xl backdrop-saturate-150"
              style={{
                backgroundColor: "var(--surface-frost)",
                border: "1px solid var(--surface-frost-border)",
                boxShadow: "var(--surface-frost-shadow)",
                color: "var(--text-primary)",
              }}
            >
              <div className="flex items-center gap-2">
                <Ban
                  className="h-4 w-4 shrink-0"
                  style={{ color: "var(--accent-red)" }}
                />
                <span className="min-w-0 flex-1 truncate font-semibold">
                  ERROR
                </span>
                <Button
                  variant="icon"
                  onClick={() => dismiss(t.id)}
                  title="닫기"
                  aria-label="닫기"
                  className="shrink-0 p-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Text
                variant="caption"
                color="secondary"
                as="div"
                className="break-all wrap-anywhere"
              >
                {t.message}
              </Text>
            </div>
          ))}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
