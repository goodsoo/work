import { useCreateMeeting, useMeetings } from "../hooks/useMeetings";
import { MeetingsList } from "../components/meetings/MeetingsList";
import { MeetingForm } from "../components/meetings/MeetingForm";
import { useEffect, useRef, useState } from "react";
import { formatError } from "../lib/errors";

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 세션 단위 한 번만 자동 선택. 사용자가 명시적으로 onBack/닫기 한 뒤 페이지
// 전환했다가 돌아와도 다시 자동 선택되지 않도록 모듈 변수로 보관 (페이지
// 컴포넌트 unmount/mount 무관). 새로고침하면 모듈이 다시 import 되며 false.
let didAutoSelectThisSession = false;

type Props = {
  selectedId: string | null;
  onOpenMeeting: (id: string) => void;
  onCloseMeeting: () => void;
};

export function MeetingsPage({ selectedId, onOpenMeeting, onCloseMeeting }: Props) {
  const createMutation = useCreateMeeting();
  const meetingsQ = useMeetings();
  const [createError, setCreateError] = useState<string | null>(null);

  // 세션당 한 번만 자동 선택. 사용자가 명시적으로 onBack/닫기 했으면
  // 다른 페이지 갔다 와도 다시 자동 선택 안 함 (모듈 flag 유지).
  const autoSelectedRef = useRef(didAutoSelectThisSession);
  useEffect(() => {
    if (autoSelectedRef.current) return;
    if (selectedId) {
      autoSelectedRef.current = true;
      didAutoSelectThisSession = true;
      return;
    }
    const list = meetingsQ.data;
    if (!list || list.length === 0) return;
    autoSelectedRef.current = true;
    didAutoSelectThisSession = true;
    onOpenMeeting(list[0].id);
  }, [selectedId, meetingsQ.data, onOpenMeeting]);

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
      setCreateError(formatError(e));
    }
  }

  return (
    <>
      {createError ? (
        <div className="mx-auto mt-4 w-full max-w-2xl px-5 lg:max-w-4xl">
          <div
            className="rounded-lg p-3 text-sm"
            style={{
              borderLeft: "4px solid var(--accent-red)",
              backgroundColor: "var(--accent-red-bg)",
              color: "var(--accent-red-text)",
            }}
          >
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
