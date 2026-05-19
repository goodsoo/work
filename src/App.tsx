import { useEffect, useRef, useState } from "react";
import { VaultGate } from "./components/vault/VaultGate";
import { AppShell } from "./components/nav/AppShell";
import { GlobalTooltip } from "./components/Tooltip";
import type { Tab } from "./components/nav/BottomTabs";
import { MeetingForm } from "./components/meetings/MeetingForm";
import {
  MeetingsSidePanel,
  MeetingsSidePanelFooter,
  CalendarDayPanel,
  TodosSidePanel,
  type MeetingsView,
} from "./components/nav/SidePanel";
import type { TodoCategory } from "./api/todos";
type TodosFilter = TodoCategory | "all" | "uncategorized";
import { CalendarPage } from "./pages/CalendarPage";
import { TodosPage } from "./pages/TodosPage";
import { PortfolioPage } from "./pages/PortfolioPage";
import { PortfolioSidePanel } from "./components/portfolio/PortfolioSidePanel";
import type { ProjectFilter } from "./components/portfolio/PortfolioProjectList";
import { useGhSync } from "./hooks/usePortfolio";
import { readSyncState } from "./api/portfolio";
import { useMeetings } from "./hooks/useMeetings";
import { useVault } from "./lib/vault/useVault";
import { DrawerProvider, useDrawer } from "./hooks/useDrawer";
import { todayIso } from "./lib/dates";
import { isTauri } from "./lib/isTauri";

function readTabFromHash(): Tab {
  const h = window.location.hash;
  if (h.startsWith("#meeting-")) return "meetings";
  if (h === "#calendar") return "calendar";
  if (h === "#todos") return "todos";
  if (h === "#portfolio") return "portfolio";
  return "meetings";
}

function readMeetingFromHash(): string | null {
  const h = window.location.hash;
  if (h.startsWith("#meeting-")) return h.slice("#meeting-".length) || null;
  return null;
}

// 세션 단위 한 번만 자동 선택. 사용자가 명시적으로 onBack/닫기 한 뒤 페이지
// 전환했다가 돌아와도 다시 자동 선택되지 않도록 모듈 변수로 보관. 새로고침하면
// 모듈이 다시 import 되며 false.
let didAutoSelectThisSession = false;

export default function App() {
  return (
    <VaultGate>
      <GlobalTooltip />
      <DrawerProvider>
        <AppContent />
      </DrawerProvider>
    </VaultGate>
  );
}

function AppContent() {
  const drawer = useDrawer();
  const [tab, setTab] = useState<Tab>(() => readTabFromHash());
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(() =>
    readMeetingFromHash(),
  );
  const [calendarDate, setCalendarDate] = useState<string>(todayIso());
  const [todoCategory, setTodoCategory] = useState<TodosFilter>("all");
  const [portfolioFilter, setPortfolioFilter] = useState<ProjectFilter>({
    kind: "all",
  });
  const [meetingsView, setMeetingsView] = useState<MeetingsView>("list");
  const portfolioSync = useGhSync();
  const { adapter, isReady } = useVault();
  const meetings = useMeetings();
  const autoSyncDone = useRef(false);
  const autoSelectedRef = useRef(didAutoSelectThisSession);

  // V0.7 design step 3 (1B): vault ready 후 5초 background sync 1회 (since=last_sync).
  // 본인 매일 앱 켜면 silent fetch — 의식 0 으로 카드 누적. Tauri 만 (gh 호출 필요).
  useEffect(() => {
    if (!isTauri || !isReady || autoSyncDone.current) return;
    autoSyncDone.current = true;
    const t = setTimeout(async () => {
      try {
        const state = await readSyncState(adapter);
        await portfolioSync.run(
          state.last_sync ? { since: state.last_sync.slice(0, 10) } : {},
        );
      } catch {
        // useGhSync state.error 에 반영 — sidebar 가 표시
      }
    }, 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  // 메모장 진입 시 세션당 한 번 자동 선택 (V0.5.3). 모듈 flag 로 페이지 갔다와도
  // 다시 발동 안 함. 메모 0개면 skip.
  useEffect(() => {
    if (tab !== "meetings") return;
    if (autoSelectedRef.current) return;
    if (selectedMeetingId) {
      autoSelectedRef.current = true;
      didAutoSelectThisSession = true;
      return;
    }
    const list = meetings.data;
    if (!list || list.length === 0) return;
    autoSelectedRef.current = true;
    didAutoSelectThisSession = true;
    openMeeting(list[0].uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedMeetingId, meetings.data]);

  useEffect(() => {
    function syncFromHash() {
      setTab(readTabFromHash());
      // hash 에 meeting id 가 있을 때만 set. 다른 탭으로 갔을 땐 selectedMeetingId
      // 를 보존 — 메모장 돌아오면 그 메모가 다시 열림.
      const idFromHash = readMeetingFromHash();
      if (idFromHash !== null) {
        setSelectedMeetingId(idFromHash);
      }
    }
    window.addEventListener("popstate", syncFromHash);
    window.addEventListener("hashchange", syncFromHash);
    return () => {
      window.removeEventListener("popstate", syncFromHash);
      window.removeEventListener("hashchange", syncFromHash);
    };
  }, []);

  // macOS WKWebView 가 Backspace/Delete 를 history.back() 으로 처리 — SPA state 망가짐.
  // 텍스트 입력 컨텍스트가 아니면 막음.
  useEffect(() => {
    function blockNavKeys(e: KeyboardEvent) {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (t.isContentEditable) return;
      }
      e.preventDefault();
    }
    window.addEventListener("keydown", blockNavKeys);
    return () => window.removeEventListener("keydown", blockNavKeys);
  }, []);

  // Desktop (Tauri) 전용 페이지 단축키: Cmd+1/2/3
  useEffect(() => {
    if (!isTauri) return;
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      let next: Tab | null = null;
      if (e.key === "1") next = "meetings";
      else if (e.key === "2") next = "calendar";
      else if (e.key === "3") next = "todos";
      else if (e.key === "4") next = "portfolio";
      if (!next) return;
      e.preventDefault();
      switchTab(next);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedMeetingId]);

  function switchTab(next: Tab) {
    setTab(next);
    // selectedMeetingId 는 보존. 메모장으로 돌아오면 그 메모가 다시 열림.
    const target =
      next === "meetings"
        ? selectedMeetingId
          ? `#meeting-${selectedMeetingId}`
          : ""
        : `#${next}`;
    if (window.location.hash !== target) {
      window.history.pushState(
        { tab: next, meetingId: selectedMeetingId },
        "",
        target || window.location.pathname,
      );
    }
  }

  function changeTab(next: Tab) {
    if (next === tab) return;
    switchTab(next);
  }

  function openMeeting(id: string) {
    drawer.close();
    setTab("meetings");
    setSelectedMeetingId(id);
    window.history.pushState({ meetingId: id }, "", `#meeting-${id}`);
  }

  function closeMeeting() {
    if (window.history.state?.meetingId) {
      window.history.back();
    } else {
      setSelectedMeetingId(null);
    }
  }

  function handleMeetingPurged(id: string) {
    if (selectedMeetingId === id) closeMeeting();
  }

  // Side panel per tab (모바일에선 drawer, 데스크탑에선 3-pane 왼쪽 컬럼).
  const sidePanel =
    tab === "meetings" ? (
      <MeetingsSidePanel
        selectedId={selectedMeetingId}
        onSelect={openMeeting}
        onMeetingPurged={handleMeetingPurged}
        view={meetingsView}
        onViewChange={setMeetingsView}
      />
    ) : tab === "calendar" ? (
      <CalendarDayPanel
        selectedDate={calendarDate}
        onOpenMeeting={openMeeting}
      />
    ) : tab === "todos" ? (
      <TodosSidePanel
        activeCategory={todoCategory}
        onCategoryChange={setTodoCategory}
      />
    ) : tab === "portfolio" ? (
      <PortfolioSidePanel
        activeFilter={portfolioFilter}
        onFilterChange={setPortfolioFilter}
        syncState={portfolioSync.state}
        onSyncRun={() => {
          portfolioSync.run({}).catch(() => {
            // error 는 portfolioSync.state.error 에 반영, sidebar 가 표시
          });
        }}
      />
    ) : undefined;

  // 메모장 list 모드일 때만 도움말 + 휴지통 footer. trash 모드는 footer 비움 (TrashView 의 back 버튼 사용).
  const sidePanelFooter =
    tab === "meetings" && meetingsView === "list" ? (
      <MeetingsSidePanelFooter onTrashOpen={() => setMeetingsView("trash")} />
    ) : undefined;

  return (
    <AppShell
      activeTab={tab}
      onTabChange={changeTab}
      sidePanel={sidePanel}
      sidePanelFooter={sidePanelFooter}
    >
      {tab === "meetings" ? (
        selectedMeetingId ? (
          <MeetingForm meetingId={selectedMeetingId} onBack={closeMeeting} />
        ) : (
          <MeetingsEmpty count={meetings.data?.length ?? 0} loading={meetings.isLoading} />
        )
      ) : tab === "calendar" ? (
        <CalendarPage
          targetDate={calendarDate}
          onSelectedDateChange={setCalendarDate}
        />
      ) : tab === "portfolio" ? (
        <PortfolioPage
          activeFilter={portfolioFilter}
          onSync={() => {
            portfolioSync.run({}).catch(() => {});
          }}
          syncRunning={portfolioSync.state.running}
        />
      ) : (
        <TodosPage categoryFilter={todoCategory} />
      )}
    </AppShell>
  );
}

function MeetingsEmpty({ count, loading }: { count: number; loading: boolean }) {
  const message = loading
    ? ""
    : count === 0
      ? "아직 메모가 없어요. 메뉴에서 + 를 눌러 새 메모를 만드세요."
      : "메뉴에서 메모를 선택하세요.";
  return (
    <div className="flex h-[calc(100svh-3rem)] items-center justify-center px-6 text-center">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {message}
      </p>
    </div>
  );
}
