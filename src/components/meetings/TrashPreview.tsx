import { Trash2 } from "lucide-react";
import { useDeletedMeetings } from "../../hooks/useMeetings";
import { formatDateLong } from "../../lib/dates";
import { MarkdownView } from "./MarkdownView";

// 휴지통 파일명 stamp prefix — SidePanel.tsx 와 동일 정규식.
const STAMP_PREFIX = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-/;

function stripTrashStamp(title: string | null | undefined): string {
  return (title ?? "").replace(STAMP_PREFIX, "");
}

export function TrashPreview({ selectedId }: { selectedId: string | null }) {
  const { data, isLoading } = useDeletedMeetings();

  if (isLoading) {
    return <Empty>불러오는 중...</Empty>;
  }
  if (!data || data.length === 0) {
    return (
      <Empty>
        <Trash2 className="mx-auto mb-3 h-8 w-8 opacity-40" />
        <div>휴지통이 비어 있어요</div>
      </Empty>
    );
  }
  const meeting = selectedId ? data.find((m) => m.id === selectedId) : null;
  if (!meeting) {
    return <Empty>휴지통에서 메모를 선택하세요</Empty>;
  }

  const title = stripTrashStamp(meeting.title).trim() || "(제목 없음)";
  const attendees = Array.isArray(meeting.attendees)
    ? meeting.attendees.filter(Boolean).join(", ")
    : meeting.attendees ?? "";
  const hasSummary =
    meeting.discussion_items.length > 0 ||
    meeting.decisions.length > 0 ||
    meeting.action_items.length > 0;

  return (
    <article className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div
          className="mb-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
          style={{
            backgroundColor: "var(--bg-surface)",
            color: "var(--text-muted)",
          }}
        >
          <Trash2 className="h-3 w-3" />
          휴지통 미리보기 · 읽기 전용
        </div>
        <h1
          className="text-2xl font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h1>
        <div
          className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          {meeting.date ? <span>{formatDateLong(meeting.date)}</span> : null}
          {meeting.time ? <span>{meeting.time}</span> : null}
          {attendees ? <span>참석 {attendees}</span> : null}
        </div>

        <hr
          className="my-6"
          style={{ borderColor: "var(--border-subtle)" }}
        />

        {meeting.content?.trim() ? (
          <section className="mb-8">
            <MarkdownView content={meeting.content} />
          </section>
        ) : null}

        {meeting.transcript?.trim() ? (
          <section className="mb-8">
            <h2
              className="mb-2 text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              회의 내용
            </h2>
            <pre
              className="whitespace-pre-wrap rounded-lg px-4 py-3 text-sm"
              style={{
                backgroundColor: "var(--bg-surface)",
                color: "var(--text-primary)",
                fontFamily: "inherit",
              }}
            >
              {meeting.transcript}
            </pre>
          </section>
        ) : null}

        {hasSummary ? (
          <section className="space-y-3">
            <h2
              className="text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              요약
            </h2>
            {meeting.discussion_items.length > 0 ? (
              <SummaryCallout
                title="논의 사항"
                items={meeting.discussion_items}
              />
            ) : null}
            {meeting.decisions.length > 0 ? (
              <SummaryCallout title="결정 사항" items={meeting.decisions} />
            ) : null}
            {meeting.action_items.length > 0 ? (
              <SummaryCallout
                title="액션 아이템"
                items={meeting.action_items}
              />
            ) : null}
          </section>
        ) : null}

        {!meeting.content?.trim() &&
        !meeting.transcript?.trim() &&
        !hasSummary ? (
          <div
            className="text-sm italic"
            style={{ color: "var(--text-muted)" }}
          >
            (내용 없음)
          </div>
        ) : null}
      </div>
    </article>
  );
}

function SummaryCallout({ title, items }: { title: string; items: string[] }) {
  return (
    <div
      className="rounded-lg px-4 py-3"
      style={{ backgroundColor: "var(--bg-surface)" }}
    >
      <div
        className="mb-1.5 text-xs font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        {title}
      </div>
      <ul
        className="list-disc space-y-1 pl-5 text-sm"
        style={{ color: "var(--text-primary)" }}
      >
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div
        className="text-center text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        {children}
      </div>
    </div>
  );
}
