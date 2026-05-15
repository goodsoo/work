import { useEffect, useState } from "react";
import { AuthGate } from "./components/auth/AuthGate";
import { AppShell } from "./components/nav/AppShell";
import type { Tab } from "./components/nav/BottomTabs";
import { MeetingsPage } from "./pages/MeetingsPage";
import { MeetingForm } from "./components/meetings/MeetingForm";
import { MeetingsSidePanel, CalendarDayPanel, TodosSidePanel } from "./components/nav/SidePanel";
import type { TodoCategory } from "./api/todos";
type TodosFilter = TodoCategory | "all" | "uncategorized";
import { CalendarPage } from "./pages/CalendarPage";
import { TodosPage } from "./pages/TodosPage";
import { todayIso } from "./lib/dates";

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
      setSelectedMeetingId(readMeetingFromHash());
    }
    window.addEventListener("popstate", syncFromHash);
    window.addEventListener("hashchange", syncFromHash);
    return () => {
      window.removeEventListener("popstate", syncFromHash);
      window.removeEventListener("hashchange", syncFromHash);
    };
  }, []);

  function changeTab(next: Tab) {
    if (next === tab && !selectedMeetingId) return;
    setTab(next);
    setSelectedMeetingId(null);
    const target = next === "meetings" ? "" : `#${next}`;
    if (window.location.hash !== target) {
      window.history.pushState({ tab: next }, "", target || window.location.pathname);
    }
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

  // Desktop side panel per tab
  const sidePanel =
    tab === "meetings" ? (
      <MeetingsSidePanel selectedId={selectedMeetingId} onSelect={openMeeting} />
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
    <AuthGate>
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
    </AuthGate>
  );
}

function DesktopEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[calc(100svh-3rem)] items-center justify-center">
      <p className="text-sm text-zinc-400 dark:text-zinc-500">{message}</p>
    </div>
  );
}
