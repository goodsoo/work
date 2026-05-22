import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// 디자인 토큰 기반 confirm 모달. ESC = 취소, Enter = 확인, 바깥 클릭 = 취소.
// 첫 focus 는 cancel 에 둠 — destructive 액션의 실수 방지.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "확인",
  cancelLabel = "취소",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (!busy) onConfirm();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onConfirm, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      // backdrop close: mousedown 시작점이 backdrop 자체일 때만. inner 안에서 시작한
      // 드래그가 바깥에서 mouseup 되어 click 이 backdrop 으로 발사되는 케이스 차단.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg p-5 shadow-xl"
        style={{
          backgroundColor: "var(--bg-base)",
          border: "1px solid var(--border-default)",
        }}
      >
        <h2
          id="confirm-dialog-title"
          className="text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h2>
        {message ? (
          <p
            className="mt-2 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            {message}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md px-3 py-1.5 text-sm transition disabled:opacity-40"
            style={{
              border: "1px solid var(--border-default)",
              color: "var(--text-secondary)",
              minHeight: 0,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-40"
            style={{
              backgroundColor: danger
                ? "var(--accent-red)"
                : "var(--accent-blue)",
              color: "white",
              minHeight: 0,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
