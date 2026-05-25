import { useEffect, useRef, useState, type ReactNode } from "react";
import { Sun, Moon, Menu, Settings, Search, ChevronDown } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import {
  useSidePanelWidth,
  SIDE_PANEL_MIN,
  SIDE_PANEL_MAX,
} from "../../hooks/useSidePanelWidth";
import { useDrawer } from "../../hooks/useDrawer";
import { isTauri } from "../../lib/isTauri";
import { useVault } from "../../lib/vault/useVault";
import { SettingsModal } from "../settings/SettingsModal";
import { Button } from "../common/Button";
import { Text } from "../common/Text";
import { Popover } from "../common/Popover";
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
  // 데스크탑 SidePanel collapse 상태. true = 사이드바 숨김 + main 이 윈도우 전체.
  // 옵시디안 패턴 — Cmd+\ 단축키로 토글, useSidebarCollapsed 가 관리.
  sidebarCollapsed?: boolean;
  // 타이틀바 우측 검색 버튼 클릭 시 호출 — App.tsx 의 QuickSwitcher 를 open.
  // 단축키 Cmd+P 와 같은 동작, 데스크탑/모바일 양쪽 헤더에 노출.
  onOpenSearch?: () => void;
  children: ReactNode;
};

export function AppShell({
  activeTab,
  onTabChange,
  sidePanel,
  sidePanelFooter,
  sidebarCollapsed = false,
  onOpenSearch,
  children,
}: Props) {
  const { theme, toggle } = useTheme();
  const { width, setWidth } = useSidePanelWidth();
  const drawer = useDrawer();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hasSidePanel = sidePanel != null;
  const desktopSidePanelVisible = hasSidePanel && !sidebarCollapsed;
  const ThemeIcon = theme === "light" ? Sun : Moon;

  const mainPaddingLeft = desktopSidePanelVisible ? `${width}px` : "0px";

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
      {/* 데스크탑 윈도우 헤더 — macOS Tauri Overlay titlebar 와 같은 줄.
          좌측 traffic lights padding + 탭 4개 + 우측 빈 drag region.
          inset 0 환경 (Windows/Linux/web) 에선 height 0 으로 자연 invisible. */}
      <header
        data-tauri-drag-region
        className="hidden lg:flex lg:items-stretch"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "var(--titlebar-inset)",
          // sidebar visible 일 때 vault column 이 traffic lights 영역 포함 (column 안 padding 처리).
          // collapse 시 vault column 사라지므로 header 가 직접 traffic lights padding.
          paddingLeft: desktopSidePanelVisible ? 0 : "var(--titlebar-traffic-inset)",
          backgroundColor: "var(--border-default)",
          borderBottom: "1px solid var(--border-default)",
          zIndex: 50,
          gap: "0.5rem",
        }}
      >
        {desktopSidePanelVisible ? (
          <div
            data-tauri-drag-region
            className="flex shrink-0 items-center"
            style={{
              width: `${width}px`,
              paddingLeft: "var(--titlebar-traffic-inset)",
              paddingRight: "0.5rem",
            }}
          >
            <VaultBadge onOpenSettings={() => setSettingsOpen(true)} />
          </div>
        ) : null}
        <div data-tauri-drag-region className="flex h-full items-stretch">
          <HeaderTabs activeTab={activeTab} onTabChange={onTabChange} />
        </div>
        {/* 가운데 flex-1 = drag region 빈 공간 */}
        <div data-tauri-drag-region className="flex-1" />
        {/* 우측: search + settings + theme. button 자체는 click, 사이 gap 은 drag region. */}
        <div data-tauri-drag-region className="flex items-center gap-0.5 pr-2">
          {onOpenSearch ? (
            <Button
              variant="icon"
              onClick={() => onOpenSearch()}
              title="검색 (⌘P)"
              aria-label="검색"
              style={{ color: "var(--text-secondary)" }}
            >
              <Search className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <Button
            variant="icon"
            onClick={() => setSettingsOpen(true)}
            title="설정"
            aria-label="설정"
            style={{ color: "var(--text-secondary)" }}
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="icon"
            onClick={(e) => toggle({ origin: { x: e.clientX, y: e.clientY } })}
            title={theme === "light" ? "다크 모드로" : "라이트 모드로"}
            style={{ color: "var(--text-secondary)" }}
          >
            <ThemeIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {/* Desktop: Side Panel (상단 탭 row + sidePanel + 하단 테마 토글) */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex">
        {desktopSidePanelVisible ? (
          <div
            className="relative"
            style={{
              width: `${width}px`,
              backgroundColor: "var(--bg-surface)",
              borderRight: "1px solid var(--border-default)",
            }}
          >
            <div
              className="flex h-full flex-col"
              style={{ paddingTop: "var(--titlebar-inset)" }}
            >
              <div className="relative min-h-0 flex-1">{sidePanel}</div>
              {sidePanelFooter ? (
                <div
                  className="flex shrink-0 items-center px-3 py-2"
                  style={{ borderTop: "1px solid var(--border-subtle)" }}
                >
                  <div className="flex min-w-0 items-center">{sidePanelFooter}</div>
                </div>
              ) : null}
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
              <Button
                variant="icon"
                onClick={drawer.toggle}
                aria-label="메뉴 열기"
                aria-expanded={drawer.isOpen}
                className="h-8 w-8"
                style={{ color: "var(--text-secondary)" }}
              >
                <Menu className="h-4 w-4" />
              </Button>
            ) : null}
            <Text
              variant="body"
              weight="semibold"
              as="h1"
              className="tracking-tight"
            >
              goodsoob
            </Text>
          </div>
          <div className="flex items-center gap-0.5">
            {onOpenSearch ? (
              <Button
                variant="icon"
                onClick={() => onOpenSearch()}
                aria-label="검색"
                className="h-8 w-8"
                style={{ color: "var(--text-muted)" }}
              >
                <Search className="h-4 w-4" />
              </Button>
            ) : null}
            <Button
              variant="icon"
              onClick={() => setSettingsOpen(true)}
              aria-label="설정"
              className="h-8 w-8"
              style={{ color: "var(--text-muted)" }}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="icon"
              onClick={(e) => toggle({ origin: { x: e.clientX, y: e.clientY } })}
              className="h-8 w-8"
              style={{ color: "var(--text-muted)" }}
            >
              <ThemeIcon className="h-4 w-4" />
            </Button>
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
            ["--gs-main-pt" as string]: "var(--titlebar-inset)",
          } as React.CSSProperties
        }
        className="lg:!pb-0 lg:h-screen lg:overflow-y-auto lg:overscroll-none lg:[padding-left:var(--gs-main-pl)] lg:[padding-top:var(--gs-main-pt)]"
      >
        {children}
      </main>

      {/* Mobile bottom tabs */}
      <BottomTabs activeTab={activeTab} onTabChange={handleTabChange} />

      <SettingsModal
        open={settingsOpen}
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

// 윈도우 헤더 안의 4개 탭 아이콘 (가로 row, traffic lights 옆).
// active 탭은 folder tab pattern — main 영역 색으로 빠져나와 헤더 borderBottom 을
// -1px 넘어가서 시각적으로 main 콘텐츠와 이어짐. Chrome tab strip / 옵시디안 패턴.
function HeaderTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  return (
    <nav className="flex h-full items-end gap-0.5" aria-label="primary">
      {TABS.map(({ id, label, icon: Icon }, i) => {
        const active = id === activeTab;
        const title = isTauri ? `${label}  ⌘${i + 1}` : label;
        return (
          <Button
            key={id}
            variant="ghost"
            onClick={() => onTabChange(id)}
            aria-current={active ? "page" : undefined}
            title={title}
            aria-label={label}
            className="h-7 gap-1.5 px-2 rounded-none"
            style={{
              backgroundColor: active ? "var(--bg-base)" : "transparent",
              color: active ? "var(--text-primary)" : "var(--text-secondary)",
              marginBottom: active ? "-1px" : 0,
              border: "1px solid transparent",
              borderTopLeftRadius: active ? 6 : 4,
              borderTopRightRadius: active ? 6 : 4,
              borderBottomLeftRadius: active ? 0 : 4,
              borderBottomRightRadius: active ? 0 : 4,
              boxSizing: "border-box",
              // tab active 전환은 즉시 — border/bg/radius 150ms 페이드가 "살짝 내려옴"
              // 처럼 보이던 거 제거.
              transition: "none",
            }}
          >
            <Icon className="h-4 w-4" strokeWidth={active ? 2 : 1.5} />
          </Button>
        );
      })}
    </nav>
  );
}

// 윈도우 헤더 좌측의 vault 이름 chip — 클릭 시 dropdown 진입점.
// 항목: vault 설정 (SettingsModal vault section) / 스타일가이드 (#styleguide hash).
// vault > tabs 시각 계층 명시 — vault 가 root container 임을 좌→우 순서로 표현.
function VaultBadge({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { vaultRoot } = useVault();
  const [open, setOpen] = useState(false);
  if (!vaultRoot) return null;
  const name = vaultRoot.split("/").filter(Boolean).pop() ?? vaultRoot;
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <Button
          variant="ghost"
          onClick={() => setOpen((v) => !v)}
          title={vaultRoot}
          aria-label={`vault: ${name}`}
          className="h-7 max-w-full gap-1 px-2 text-[13px]"
          style={{ color: "var(--text-primary)" }}
        >
          <span className="truncate">{name}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </Button>
      }
      panelClassName="absolute left-0 top-full mt-1 w-44 rounded-md p-1"
      panelStyle={{
        background: "var(--bg-base)",
        border: "1px solid var(--border-default)",
        boxShadow: "var(--shadow-popover)",
        zIndex: 30,
      }}
    >
      <button
        type="button"
        className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--bg-surface-hover)]"
        style={{ color: "var(--text-primary)" }}
        onClick={() => {
          setOpen(false);
          onOpenSettings();
        }}
      >
        Vault 설정
      </button>
      <button
        type="button"
        className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--bg-surface-hover)]"
        style={{ color: "var(--text-primary)" }}
        onClick={() => {
          setOpen(false);
          window.location.hash = "#styleguide";
        }}
      >
        스타일가이드
      </button>
    </Popover>
  );
}
