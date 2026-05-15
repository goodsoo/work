import { useCreateMeeting } from "../hooks/useMeetings";
import { MeetingsList } from "../components/meetings/MeetingsList";
import { MeetingForm } from "../components/meetings/MeetingForm";
import { useState } from "react";

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type Props = {
  selectedId: string | null;
  onOpenMeeting: (id: string) => void;
  onCloseMeeting: () => void;
};

export function MeetingsPage({ selectedId, onOpenMeeting, onCloseMeeting }: Props) {
  const createMutation = useCreateMeeting();
  const [createError, setCreateError] = useState<string | null>(null);

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
      onOpenMeeting(created.id);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      {createError ? (
        <div className="mx-auto mt-4 w-full max-w-2xl px-5 lg:max-w-4xl">
          <div className="rounded-lg border-l-4 border-red-600 bg-red-50 p-3 text-sm text-red-900 dark:border-red-500 dark:bg-red-950/30 dark:text-red-200">
            새 메모 생성 실패: {createError}
          </div>
        </div>
      ) : null}

      {selectedId ? (
        <MeetingForm meetingId={selectedId} onBack={onCloseMeeting} />
      ) : (
        <MeetingsList
          onSelect={onOpenMeeting}
          onCreate={handleCreate}
          creating={createMutation.isPending}
        />
      )}
    </>
  );
}
