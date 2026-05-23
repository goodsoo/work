import { useEffect, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  // scrim = 어두운 backdrop (rgba(0,0,0,0.4), 기본)
  // overlay = 토큰 기반 frost (var(--bg-overlay), PortfolioDetailModal 류)
  backdrop?: "scrim" | "overlay";
  // 기본 true. confirm 중첩 등 Escape 를 다른 핸들러가 먹어야 하는 케이스 false.
  dismissOnEscape?: boolean;
  // 기본 true.
  dismissOnBackdrop?: boolean;
  // wrapper 의 추가 class (기본 p-6 빼고 싶은 경우 등).
  className?: string;
};

// backdrop close: mousedown 시작점이 backdrop 자체일 때만 닫음 — inner 안에서 시작한
// 드래그가 바깥에서 mouseup 되어 click 이 backdrop 으로 발사되는 케이스 차단.
// 10개 modal 에 4번 복붙되어 있던 패턴을 한 곳으로 흡수.
export function Modal({
  open,
  onClose,
  children,
  ariaLabel,
  ariaLabelledBy,
  backdrop = "scrim",
  dismissOnEscape = true,
  dismissOnBackdrop = true,
  className = "fixed inset-0 z-50 flex items-center justify-center p-6",
}: ModalProps) {
  useEffect(() => {
    if (!open || !dismissOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismissOnEscape, onClose]);

  if (!open) return null;

  const backgroundColor =
    backdrop === "overlay" ? "var(--bg-overlay)" : "rgba(0,0,0,0.4)";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      onMouseDown={(e) => {
        if (!dismissOnBackdrop) return;
        if (e.target === e.currentTarget) onClose();
      }}
      className={className}
      style={{ backgroundColor }}
    >
      {children}
    </div>
  );
}
