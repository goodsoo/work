import { useMemo, useState } from "react";
import { CalendarDays, FileText, BookOpen, Trash2, Plus, Check } from "lucide-react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { Text } from "../common/Text";
import { LooseDateInput } from "../common/LooseDateInput";
import { LooseTimeInput } from "../common/LooseTimeInput";
import { useMeetings } from "../../hooks/useMeetings";
import { useJournals } from "../../hooks/useJournals";
import {
  useSchedule,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
} from "../../hooks/useSchedule";
import type { ScheduleEvent } from "../../api/schedule";
import { formatDateLong } from "../../lib/dates";

type Props = {
  open: boolean;
  date: string; // ISO YYYY-MM-DD
  onClose: () => void;
  onOpenMeeting: (uid: string) => void;
  // 일기 오버레이 열기 (App 의 JournalOverlay 재사용 — 모달은 진입만).
  onOpenJournal: (date: string) => void;
};

function byTime(a: string | null, b: string | null): number {
  const ta = a ?? "";
  const tb = b ?? "";
  if (ta === tb) return 0;
  if (!ta) return -1;
  if (!tb) return 1;
  return ta < tb ? -1 : 1;
}

// 날짜 상세 모달 — 그 날에 걸린 것들을 한 곳에: 일정(보기·추가·편집·삭제) +
// 그 날 작성한 노트 + 일기 진입. 폐기된 캘린더 day 패널의 후신.
export function DayDetailModal({
  open,
  date,
  onClose,
  onOpenMeeting,
  onOpenJournal,
}: Props) {
  const scheduleQ = useSchedule();
  const meetingsQ = useMeetings();
  const journalsQ = useJournals();

  // 이 날짜를 포함하는 일정 (다일 포함), 시각순.
  const events = useMemo<ScheduleEvent[]>(() => {
    const list = (scheduleQ.data ?? []).filter((e) => {
      if (e.end && e.end > e.start) return e.start <= date && date <= e.end;
      return e.start === date;
    });
    return list.sort((a, b) => byTime(a.time, b.time) || a.text.localeCompare(b.text));
  }, [scheduleQ.data, date]);

  // 그 날 작성/수정한 노트 (note.date 매칭).
  const notes = useMemo(
    () => (meetingsQ.data ?? []).filter((m) => m.date === date),
    [meetingsQ.data, date],
  );

  const hasJournal = (journalsQ.data ?? []).some((j) => j.date === date);

  return (
    <Modal open={open} onClose={onClose} size="lg" ariaLabel={`${date} 상세`}>
      <div className="flex h-full flex-col">
        <div
          className="flex shrink-0 items-center gap-2 px-5 py-3"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <CalendarDays className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
          <Text variant="h4" as="h2">
            {formatDateLong(date)}
          </Text>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* 일정 */}
          <SectionTitle>일정</SectionTitle>
          <div className="mb-5">
            {events.length === 0 ? (
              <EmptyLine>이 날 일정이 없습니다.</EmptyLine>
            ) : (
              <div className="space-y-1">
                {events.map((e) => (
                  <EventRow key={e.id} event={e} date={date} />
                ))}
              </div>
            )}
            <AddEventForm date={date} />
          </div>

          {/* 그 날 노트 */}
          <SectionTitle>이 날 노트</SectionTitle>
          <div className="mb-5">
            {notes.length === 0 ? (
              <EmptyLine>이 날 작성한 노트가 없습니다.</EmptyLine>
            ) : (
              <div className="space-y-0.5">
                {notes.map((m) => (
                  <button
                    key={m.uid}
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenMeeting(m.uid);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[14px] transition hover:bg-[var(--bg-surface-hover)]"
                  >
                    <FileText
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: "var(--accent-blue)" }}
                    />
                    <span
                      className="min-w-0 flex-1 truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {m.title?.trim() || "(제목 없음)"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 일기 — 기존 오버레이 재사용 (진입만). */}
          <SectionTitle>일기</SectionTitle>
          <button
            type="button"
            onClick={() => onOpenJournal(date)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[14px] transition hover:bg-[var(--bg-surface-hover)]"
          >
            <BookOpen className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
            <span style={{ color: hasJournal ? "var(--text-primary)" : "var(--text-muted)" }}>
              {hasJournal ? "일기 보기" : "일기 쓰기"}
            </span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text
      variant="body"
      weight="semibold"
      as="h3"
      color="secondary"
      className="mb-1.5"
    >
      {children}
    </Text>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <Text variant="caption" color="muted" as="div" className="px-2 py-1.5">
      {children}
    </Text>
  );
}

// 일정 한 줄 — 보기/편집 토글. 편집 시 텍스트·종료일·시각 인라인 수정 + 삭제.
function EventRow({ event, date }: { event: ScheduleEvent; date: string }) {
  const [editing, setEditing] = useState(false);
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const [text, setText] = useState(event.text);
  const [end, setEnd] = useState(event.end ?? "");
  const [time, setTime] = useState(event.time ?? "");

  function save() {
    const patch = {
      text: text.trim(),
      end: end && end > event.start ? end : null,
      time: time || null,
    };
    updateEvent.mutate({ id: event.id, patch });
    setEditing(false);
  }

  if (!editing) {
    const range = event.end && event.end > event.start ? ` ~ ${event.end.slice(5)}` : "";
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setEditing(true);
          }
        }}
        className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[14px] transition hover:bg-[var(--bg-surface-hover)]"
      >
        <span
          className="w-12 shrink-0 text-[12px] tabular-nums"
          style={{ color: "var(--text-muted)" }}
        >
          {event.time ?? "종일"}
        </span>
        <span className="min-w-0 flex-1 truncate" style={{ color: "var(--text-primary)" }}>
          {event.text}
          {range ? (
            <span style={{ color: "var(--text-muted)" }}>{range}</span>
          ) : null}
        </span>
      </div>
    );
  }

  return (
    <div
      className="rounded-md px-2 py-2"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-default)" }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="일정 내용"
        className="mb-2 w-full bg-transparent text-sm outline-none"
        style={{ color: "var(--text-primary)" }}
      />
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
        style={{ color: "var(--text-secondary)" }}
      >
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="opacity-60">~</span>
          <LooseDateInput value={end} onCommit={setEnd} compact />
        </span>
        <LooseTimeInput value={time} onCommit={setTime} compact />
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deleteEvent.mutate(event.id)}
            title="일정 삭제"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={save}
            leftIcon={<Check className="h-3 w-3" />}
          >
            완료
          </Button>
        </div>
      </div>
      <input type="hidden" value={date} readOnly />
    </div>
  );
}

// 일정 추가 폼 — 그 날(date) 시작. 텍스트 + (선택) 종료일 + (선택) 시각.
function AddEventForm({ date }: { date: string }) {
  const createEvent = useCreateEvent();
  const [text, setText] = useState("");
  const [end, setEnd] = useState("");
  const [time, setTime] = useState("");

  function add() {
    const t = text.trim();
    if (!t) return;
    createEvent.mutate({
      text: t,
      start: date,
      end: end && end > date ? end : null,
      time: time || null,
    });
    setText("");
    setEnd("");
    setTime("");
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        placeholder="일정 추가"
        className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-sm outline-none"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          color: "var(--text-primary)",
        }}
      />
      <LooseTimeInput value={time} onCommit={setTime} compact />
      <Button
        variant="ghost"
        size="sm"
        onClick={add}
        title="일정 추가"
        style={{ color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
        leftIcon={<Plus className="h-3 w-3" />}
      >
        추가
      </Button>
    </div>
  );
}
