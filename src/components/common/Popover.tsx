import {
  useEffect,
  useRef,
  type ReactNode,
} from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  // trigger element 가 popover 의 anchor 가 됨. trigger 도 자식으로 받음.
  trigger: ReactNode;
  // popover panel content. open 일 때만 렌더.
  children: ReactNode;
  // panel className + style — 위치/너비/배경 caller 결정.
  panelClassName?: string;
  panelStyle?: React.CSSProperties;
  // wrapper className (relative inline-flex default).
  className?: string;
  // ESC / 외부 클릭 닫기 default on.
  dismissOnEscape?: boolean;
  dismissOnOutside?: boolean;
};

// 외부 클릭 / ESC 자동 닫기 boilerplate 흡수. 6 자리 (SidePanel SortMenu /
// MeetingContextMenu / FolderContextMenu / TaskRow 연결 메모 / MeetingPicker /
// CategoryPicker) 의 useEffect + mousedown + keydown listener 통합.
//
// trigger 는 wrapper 안 렌더, panel 은 open 일 때만 trigger 아래 절대 위치.
// caller 가 trigger 의 click handler 직접 — open state 토글 / mutation 다 caller.
export function Popover({
  open,
  onClose,
  trigger,
  children,
  panelClassName = "",
  panelStyle,
  className = "relative inline-flex",
  dismissOnEscape = true,
  dismissOnOutside = true,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!dismissOnOutside) return;
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (!dismissOnEscape) return;
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, dismissOnEscape, dismissOnOutside, onClose]);

  return (
    <div ref={wrapRef} className={className}>
      {trigger}
      {open ? (
        <div className={panelClassName} style={panelStyle}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
