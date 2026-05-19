import { useEffect, useRef, type ReactNode } from "react";
import { Sun, Moon, Menu } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import {
  useSidePanelWidth,
  SIDE_PANEL_MIN,
  SIDE_PANEL_MAX,
} from "../../hooks/useSidePanelWidth";
import { useDrawer } from "../../hooks/useDrawer";
import { BottomTabs, type Tab } from "./BottomTabs";
import { ActivityBar } from "./ActivityBar";

const ACTIVITY_BAR_WIDTH = 48;
const MOBILE_DRAWER_WIDTH = 288;
const SWIPE_CLOSE_THRESHOLD = 60;

type Props = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  sidePanel?: ReactNode;
  children: ReactNode;
};

export function AppShell({ activeTab, onTabChange, sidePanel, children }: Props) {
  const { theme, toggle } = useTheme();
  const { width, setWidth } = useSidePanelWidth();
  const drawer = useDrawer();
  const hasSidePanel = sidePanel != null;
  const ThemeIcon = theme === "light" ? Sun : Moon;

  const mainPaddingLeft = hasSidePanel
    ? `${ACTIVITY_BAR_WIDTH + width}px`
    : `${ACTIVITY_BAR_WIDTH}px`;

  // BottomTab 변경 시 drawer 자동 닫기
  function handleTabChange(next: Tab) {
    drawer.close();
    onTabChange(next);
  }

  // Body scroll lock + ESC close + sidePanel 사라지면 자동 close
  useEffect(() => {
    if (!drawer.isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") drawer.close();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawer]);

  useEffect(() => {
    if (!hasSidePanel && drawer.isOpen) drawer.close();
  }, [hasSidePanel, drawer]);

  // Swipe-left to close
  const touchStartXRef = useRef<number | null>(null);
  const touchDeltaXRef = useRef(0);

  function onDrawerTouchStart(e: React.TouchEvent) {
    touchStartXRef.current = e.touches[0].clientX;
    touchDeltaXRef.current = 0;
  }
  function onDrawerTouchMove(e: React.TouchEvent) {
    if (touchStartXRef.current === null) return;
    touchDeltaXRef.current = e.touches[0].clientX - touchStartXRef.current;
  }
  function onDrawerTouchEnd() {
    if (touchDeltaXRef.current < -SWIPE_CLOSE_THRESHOLD) drawer.close();
    touchStartXRef.current = null;
    touchDeltaXRef.current = 0;
  }

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
          <div className="flex items-center gap-1">
            {hasSidePanel ? (
              <button
                type="button"
                onClick={drawer.toggle}
                aria-label="메뉴 열기"
                aria-expanded={drawer.isOpen}
                className="flex h-8 w-8 items-center justify-center rounded-md transition"
                style={{ color: "var(--text-secondary)", minHeight: 0 }}
              >
                <Menu className="h-4 w-4" />
              </button>
            ) : null}
            <h1 className="text-sm font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              goodsoob
            </h1>
          </div>
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

      {/* Mobile drawer: dim overlay + sliding aside */}
      {hasSidePanel ? (
        <>
          <div
            className={`fixed inset-0 z-30 transition-opacity lg:hidden ${
              drawer.isOpen ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
            onClick={drawer.close}
            aria-hidden
          />
          <aside
            onTouchStart={onDrawerTouchStart}
            onTouchMove={onDrawerTouchMove}
            onTouchEnd={onDrawerTouchEnd}
            className={`fixed inset-y-0 left-0 z-40 transition-transform lg:hidden ${
              drawer.isOpen ? "translate-x-0" : "-translate-x-full"
            }`}
            style={{
              width: `${MOBILE_DRAWER_WIDTH}px`,
              backgroundColor: "var(--bg-surface)",
              borderRight: "1px solid var(--border-default)",
              paddingTop: "var(--safe-top)",
            }}
            aria-hidden={!drawer.isOpen}
          >
            {sidePanel}
          </aside>
        </>
      ) : null}

      {/* Main content — desktop 에선 자체 scroll container (스크롤바가 viewport
          전체가 아니라 main 안에만 표시). sticky header/tab row 도 main scroll 기준. */}
      <main
        key={activeTab}
        style={
          {
            paddingBottom: "calc(var(--safe-bottom) + 72px)",
            ["--gs-main-pl" as string]: mainPaddingLeft,
          } as React.CSSProperties
        }
        className="animate-page-in lg:!pb-0 lg:h-screen lg:overflow-y-auto lg:[padding-left:var(--gs-main-pl)]"
      >
        {children}
      </main>

      {/* Mobile bottom tabs */}
      <BottomTabs activeTab={activeTab} onTabChange={handleTabChange} />
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
