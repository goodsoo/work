import { useEffect } from "react";
import { X } from "lucide-react";
import type { PortfolioScreenshot } from "../../api/portfolio";

type Props = {
  screenshots: PortfolioScreenshot[];
  // path → 실제 표시 가능한 src URL (Tauri asset). 기본은 path 그대로.
  resolveSrc?: (path: string) => string;
  // 0-indexed. -1 = 닫힘.
  activeIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
};

// design v2.3: max-w-90vw / max-h-90vh / object-contain + ESC + 바깥 클릭 닫기.
export function ScreenshotLightbox({
  screenshots,
  activeIndex,
  resolveSrc,
  onClose,
  onNavigate,
}: Props) {
  useEffect(() => {
    if (activeIndex < 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && activeIndex > 0)
        onNavigate(activeIndex - 1);
      else if (e.key === "ArrowRight" && activeIndex < screenshots.length - 1)
        onNavigate(activeIndex + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, onClose, onNavigate, screenshots.length]);

  if (activeIndex < 0 || activeIndex >= screenshots.length) return null;

  const active = screenshots[activeIndex];

  return (
    <div
      // backdrop close: mousedown 시작점이 backdrop 자체일 때만. 이미지/버튼 위에서
      // 시작한 드래그가 바깥에서 mouseup 되어 닫히는 케이스 차단.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
      style={{ backgroundColor: "rgba(0,0,0,0.9)" }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md transition"
        style={{ color: "rgba(255,255,255,0.8)" }}
        aria-label="닫기"
      >
        <X className="h-5 w-5" />
      </button>

      <img
        src={resolveSrc ? resolveSrc(active.path) : active.path}
        alt={active.caption || ""}
        className="max-h-[85vh] max-w-[90vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      {active.caption ? (
        <p
          className="mt-3 text-sm"
          style={{ color: "rgba(255,255,255,0.85)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {active.caption}
        </p>
      ) : null}
      <div
        className="mt-2 text-xs"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        {activeIndex + 1} / {screenshots.length}
      </div>
    </div>
  );
}
