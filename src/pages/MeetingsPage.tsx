import { useEffect, useState } from "react";
import { useAuth, signOut } from "../hooks/useAuth";
import { useCreateMeeting } from "../hooks/useMeetings";
import { MeetingsList } from "../components/meetings/MeetingsList";
import { MeetingForm } from "../components/meetings/MeetingForm";

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function MeetingsPage() {
  const { user } = useAuth();
  const createMutation = useCreateMeeting();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // Browser back button: when a meeting is open and user hits back, return to list.
  useEffect(() => {
    function onPopState() {
      setSelectedId(null);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function openMeeting(id: string) {
    setSelectedId(id);
    window.history.pushState({ meetingId: id }, "", `#meeting-${id}`);
  }

  function closeMeeting() {
    if (window.history.state?.meetingId) window.history.back();
    else setSelectedId(null);
  }

  async function handleCreate() {
    setCreateError(null);
    try {
      const created = await createMutation.mutateAsync({
        title: null,
        date: todayIso(),
        time: null,
        attendees: null,
        content: "",
        discussion_items: null,
        decisions: null,
        action_items: null,
      });
      openMeeting(created.id);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main
      className="min-h-svh bg-white dark:bg-zinc-950"
      style={{
        paddingTop: "var(--safe-top)",
        paddingBottom: "var(--safe-bottom)",
      }}
    >
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3 md:px-6">
          <h1 className="font-serif text-base font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
            goodsoob-work
          </h1>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-xs text-zinc-400 sm:inline">
              {user?.email ?? user?.id}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {createError ? (
        <div className="mx-auto mt-4 w-full max-w-2xl px-4 md:px-6">
          <div className="rounded-lg border-l-4 border-red-600 bg-red-50 p-3 text-sm text-red-900 dark:border-red-500 dark:bg-red-950/30 dark:text-red-200">
            새 회의록 생성 실패: {createError}
          </div>
        </div>
      ) : null}

      {selectedId ? (
        <MeetingForm meetingId={selectedId} onBack={closeMeeting} />
      ) : (
        <MeetingsList
          onSelect={openMeeting}
          onCreate={handleCreate}
          creating={createMutation.isPending}
        />
      )}
    </main>
  );
}
