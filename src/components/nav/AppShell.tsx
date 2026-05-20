import { useEffect, useRef, useState, type ReactNode } from "react";
import { Sun, Moon, Menu, Settings } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import {
  useSidePanelWidth,
  SIDE_PANEL_MIN,
  SIDE_PANEL_MAX,
} from "../../hooks/useSidePanelWidth";
import { useDrawer } from "../../hooks/useDrawer";
import { isTauri } from "../../lib/isTauri";
import { SettingsModal } from "../settings/SettingsModal";
import { BottomTabs, TABS, type Tab } from "./BottomTabs";

const MOBILE_DRAWER_WIDTH = 288;
const SWIPE_CLOSE_THRESHOLD = 60;

type Props = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  sidePanel?: ReactNode;
  // SidePanel column 의 footer 왼쪽에 들어가는 페이지별 액션 (예: 메모장의 도움말/휴지통).
  // 비워두면 footer 에 theme toggle 만 보임.
  sidePanelFooter?: ReactNode;
  children: ReactNode;
};

export function AppShell({
  activeTab,
  onTabChange,
  sidePanel,
  sidePanelFooter,
  children,
}: Props) {
  const { theme, toggle } = useTheme();
  const { width, setWidth } = useSidePanelWidth();
  const drawer = useDrawer();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hasSidePanel = sidePanel != null;
  const ThemeIcon = theme === "light" ? Sun : Moon;

  const mainPaddingLeft = hasSidePanel ? `${width}px` : "0px";

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
      {/* Desktop: Side Panel (상단 탭 row + sidePanel + 하단 테마 토글) */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex">
        {hasSidePanel ? (
          <div
            className="relative"
            style={{
              width: `${width}px`,
              backgroundColor: "var(--bg-surface)",
              borderRight: "1px solid var(--border-default)",
            }}
          >
            <div className="flex h-full flex-col">
              <TopTabsRow activeTab={activeTab} onTabChange={onTabChange} />
              <div className="relative min-h-0 flex-1">{sidePanel}</div>
              <div
                className="flex shrink-0 items-center justify-between gap-2 px-3 py-2"
                style={{ borderTop: "1px solid var(--border-subtle)" }}
              >
                <div className="flex min-w-0 items-center">{sidePanelFooter}</div>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    title="설정"
                    aria-label="설정"
                    className="flex h-7 w-7 items-center justify-center rounded-md transition"
                    style={{ color: "var(--text-muted)", minHeight: 0 }}
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={toggle}
                    title={theme === "light" ? "다크 모드로" : "라이트 모드로"}
                    className="flex h-7 w-7 items-center justify-center rounded-md transition"
                    style={{ color: "var(--text-muted)", minHeight: 0 }}
                  >
                    <ThemeIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
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
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="설정"
              className="flex h-8 w-8 items-center justify-center rounded-md transition"
              style={{ color: "var(--text-muted)", minHeight: 0 }}
            >
              <Settings className="h-4 w-4" />
            </button>
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
        className="animate-page-in lg:!pb-0 lg:h-screen lg:overflow-y-auto lg:overscroll-none lg:[padding-left:var(--gs-main-pl)]"
      >
        {children}
      </main>

      {/* Mobile bottom tabs */}
      <BottomTabs activeTab={activeTab} onTabChange={handleTabChange} />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
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
      onChange(e.clientX);
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
      className="group absolute inset-y-0 -right-1 z-30 w-2 cursor-col-resize"
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

// SidePanel 상단의 4개 아이콘 탭 row (라벨 없음, flex-1 균등 분할).
// 라벨/단축키는 title attribute 로 hover tooltip.
function TopTabsRow({
  activeTab,
  onTabChange,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  return (
    <nav
      className="flex shrink-0 items-stretch"
      style={{
        height: "3.5rem", // 본문 sticky 헤더와 통일
        borderBottom: "1px solid var(--border-default)",
      }}
      aria-label="primary"
    >
      {TABS.map(({ id, label, icon: Icon }, i) => {
        const active = id === activeTab;
        const title = isTauri ? `${label}  ⌘${i + 1}` : label;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            aria-current={active ? "page" : undefined}
            title={title}
            aria-label={label}
            className="flex flex-1 items-center justify-center transition"
            style={{
              borderBottom: active
                ? "2px solid var(--btn-primary)"
                : "2px solid transparent",
              color: active ? "var(--text-primary)" : "var(--text-muted)",
              minHeight: 0,
            }}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2 : 1.5} />
          </button>
        );
      })}
    </nav>
  );
}
