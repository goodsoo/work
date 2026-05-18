import { useEffect, useState } from "react";
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
import { todayIso } from "./lib/dates";
import { isTauri } from "./lib/isTauri";

function readTabFromHash(): Tab {
  const h = window.location.hash;
  if (h.startsWith("#meeting-")) return "meetings";
  if (h === "#calendar") return "calendar";
  if (h === "#todos") return "todos";
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

  // Desktop (Tauri) 전용 페이지 단축키: Cmd+1/2/3
  useEffect(() => {
    if (!isTauri) return;
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      let next: Tab | null = null;
      if (e.key === "1") next = "meetings";
      else if (e.key === "2") next = "calendar";
      else if (e.key === "3") next = "todos";
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
