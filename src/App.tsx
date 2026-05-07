import { useEffect, useState } from "react";
import { AuthGate } from "./components/auth/AuthGate";
import { AppShell } from "./components/nav/AppShell";
import type { Tab } from "./components/nav/BottomTabs";
import { MeetingsPage } from "./pages/MeetingsPage";
import { CalendarPage } from "./pages/CalendarPage";
import { TodosPage } from "./pages/TodosPage";

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

  return (
    <AuthGate>
      <AppShell activeTab={tab} onTabChange={changeTab}>
        {tab === "meetings" ? (
          <MeetingsPage
            selectedId={selectedMeetingId}
            onOpenMeeting={openMeeting}
            onCloseMeeting={closeMeeting}
          />
        ) : tab === "calendar" ? (
          <CalendarPage onOpenMeeting={openMeeting} />
        ) : (
          <TodosPage />
        )}
      </AppShell>
    </AuthGate>
  );
}
