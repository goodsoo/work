import { useEffect, useRef, type ReactNode } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import {
  useSidePanelWidth,
  SIDE_PANEL_MIN,
  SIDE_PANEL_MAX,
} from "../../hooks/useSidePanelWidth";
import { BottomTabs, type Tab } from "./BottomTabs";
import { ActivityBar } from "./ActivityBar";

const ACTIVITY_BAR_WIDTH = 48;

type Props = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  sidePanel?: ReactNode;
  children: ReactNode;
};

export function AppShell({ activeTab, onTabChange, sidePanel, children }: Props) {
  const { theme, toggle } = useTheme();
  const { width, setWidth } = useSidePanelWidth();
  const hasSidePanel = sidePanel != null;
  const ThemeIcon = theme === "light" ? Sun : Moon;

  const mainPaddingLeft = hasSidePanel
    ? `${ACTIVITY_BAR_WIDTH + width}px`
    : `${ACTIVITY_BAR_WIDTH}px`;

  return (
    <div
      className="min-h-svh"
      style={{ paddingTop: "var(--safe-top)", backgroundColor: "var(--bg-base)" }}
    >
      {/* Desktop: Activity Bar + Side Panel */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:flex">
        <ActivityBar activeTab={activeTab} onTabChange={onTabChange} />
        {hasSidePanel ? (
          <div
            className="relative"
            style={{
              width: `${width}px`,
              backgroundColor: "var(--bg-surface)",
              borderRight: "1px solid var(--border-default)",
            }}
          >
            {sidePanel}
            <SidePanelResizer width={width} onChange={setWidth} />
          </div>
        ) : null}
      </div>

      {/* Mobile header */}
      <header
        className="sticky top-0 z-10 backdrop-blur lg:hidden"
        style={{ backgroundColor: "var(--bg-overlay)", borderBottom: "1px solid var(--border-default)" }}
      >
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-2.5">
          <h1 className="text-sm font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            goodsoob
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              className="flex h-8 w-8 items-center justify-center rounded-md transition"
              style={{ color: "var(--text-muted)", minHeight: 0 }}
            >
              <ThemeIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main
        key={activeTab}
        style={
          {
            paddingBottom: "calc(var(--safe-bottom) + 72px)",
            ["--gs-main-pl" as string]: mainPaddingLeft,
          } as React.CSSProperties
        }
        className="animate-page-in lg:!pb-0 lg:[padding-left:var(--gs-main-pl)]"
      >
        {children}
      </main>

      {/* Mobile bottom tabs */}
      <BottomTabs activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}

function SidePanelResizer({
  width,
  onChange,
}: {
  width: number;
  onChange: (next: number) => void;
}) {
  const draggingRef = useRef(false);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      onChange(e.clientX - ACTIVITY_BAR_WIDTH);
    }
    function onMouseUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onChange]);

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function onDoubleClick() {
    onChange(288);
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={SIDE_PANEL_MIN}
      aria-valuemax={SIDE_PANEL_MAX}
      onMouseDown={startDrag}
      onDoubleClick={onDoubleClick}
      title="드래그하여 너비 조절 (더블클릭 = 기본값)"
      className="group absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize"
    >
      <div
        className="ml-auto h-full transition"
        style={{
          width: "1px",
          backgroundColor: "transparent",
        }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-1 opacity-0 transition group-hover:opacity-60 group-active:opacity-100"
        style={{ backgroundColor: "var(--btn-primary)" }}
      />
    </div>
  );
}
