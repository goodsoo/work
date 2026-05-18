import { useEffect, useRef, useState } from "react";
import { VaultGate } from "./components/vault/VaultGate";
import { AppShell } from "./components/nav/AppShell";
import { GlobalTooltip } from "./components/Tooltip";
import type { Tab } from "./components/nav/BottomTabs";
import { MeetingsPage } from "./pages/MeetingsPage";
import { MeetingForm } from "./components/meetings/MeetingForm";
import { MeetingsSidePanel, CalendarDayPanel, TodosSidePanel } from "./components/nav/SidePanel";
import type { TodoCategory } from "./api/todos";
type TodosFilter = TodoCategory | "all" | "uncategorized";
import { CalendarPage } from "./pages/CalendarPage";
import { TodosPage } from "./pages/TodosPage";
import { PortfolioPage } from "./pages/PortfolioPage";
import { PortfolioSidePanel } from "./components/portfolio/PortfolioSidePanel";
import type { ProjectFilter } from "./components/portfolio/PortfolioProjectList";
import { useGhSync } from "./hooks/usePortfolio";
import { readSyncState } from "./api/portfolio";
import { useVault } from "./lib/vault/useVault";
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

export default function App() {
  const [tab, setTab] = useState<Tab>(() => readTabFromHash());
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(() =>
    readMeetingFromHash(),
  );
  const [calendarDate, setCalendarDate] = useState<string>(todayIso());
  const [todoCategory, setTodoCategory] = useState<TodosFilter>("all");
  const [portfolioFilter, setPortfolioFilter] = useState<ProjectFilter>({
    kind: "all",
  });
  const portfolioSync = useGhSync();
  const { adapter, isReady } = useVault();
  const autoSyncDone = useRef(false);

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

  // Desktop side panel per tab
  const sidePanel =
    tab === "meetings" ? (
      <MeetingsSidePanel
        selectedId={selectedMeetingId}
        onSelect={openMeeting}
        onMeetingPurged={handleMeetingPurged}
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

  return (
    <VaultGate>
      <GlobalTooltip />
      <AppShell activeTab={tab} onTabChange={changeTab} sidePanel={sidePanel}>
        {tab === "meetings" ? (
          <>
            {/* Mobile: full MeetingsPage (list or form) */}
            <div className="lg:hidden">
              <MeetingsPage
                selectedId={selectedMeetingId}
                onOpenMeeting={openMeeting}
                onCloseMeeting={closeMeeting}
              />
            </div>
            {/* Desktop: only the form (list is in side panel) */}
            <div className="hidden lg:block">
              {selectedMeetingId ? (
                <MeetingForm
                  meetingId={selectedMeetingId}
                  onBack={closeMeeting}
                />
              ) : (
                <DesktopEmptyState message="왼쪽에서 메모를 선택하세요" />
              )}
            </div>
          </>
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
    </VaultGate>
  );
}

function DesktopEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[calc(100svh-3rem)] items-center justify-center">
      <p className="text-sm text-zinc-400 dark:text-zinc-500">{message}</p>
    </div>
  );
}
