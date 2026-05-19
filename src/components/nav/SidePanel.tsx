import {
  Plus,
  ClipboardList,
  BookOpen,
  Calendar,
  HelpCircle,
  X,
  Trash2,
  ArrowLeft,
  RotateCcw,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  useMeetings,
  useCreateMeeting,
  useDeletedMeetings,
  useRestoreMeeting,
  usePurgeMeeting,
} from "../../hooks/useMeetings";
import { useJournals } from "../../hooks/useJournals";
import { useTodos, useUpdateTodo } from "../../hooks/useTodos";
import { useSchedules, useDeleteSchedule } from "../../hooks/useSchedules";
import type { Meeting } from "../../api/meetings";
import type { Todo, TodoCategory } from "../../api/todos";
import { TODO_CATEGORIES } from "../../api/todos";
import { formatDateLong, isToday, todayIso } from "../../lib/dates";
import { formatError } from "../../lib/errors";

/* ── Meetings Side Panel ── */

export type MeetingsView = "list" | "trash";

type MeetingsPanelProps = {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMeetingPurged?: (id: string) => void;
  view: MeetingsView;
  onViewChange: (view: MeetingsView) => void;
};

const dateFmt = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric",
  weekday: "short",
});

function formatShort(d: string | null): string {
  if (!d) return "";
  const parsed = new Date(d + "T00:00:00");
  if (Number.isNaN(parsed.getTime())) return d;
  return dateFmt.format(parsed);
}

export function MeetingsSidePanel({
  selectedId,
  onSelect,
  onMeetingPurged,
  view,
  onViewChange,
}: MeetingsPanelProps) {
  const { data, isLoading } = useMeetings();
  const createMutation = useCreateMeeting();
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate() {
    setCreateError(null);
    try {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const created = await createMutation.mutateAsync({
        title: null,
        date: `${y}-${m}-${d}`,
        time: null,
        attendees: null,
        content: "",
        discussion_items: null,
        decisions: null,
        action_items: null,
      });
      onSelect(created.id);
    } catch (e) {
      setCreateError(formatError(e));
    }
  }

  if (view === "trash") {
    return <TrashView onBack={() => onViewChange("list")} onPurged={onMeetingPurged} />;
  }

  return (
    <div className="relative flex h-full flex-col">
      <div
        className="flex shrink-0 items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border-default)" }}
      >
        <h2
          className="font-serif text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          메모장
        </h2>
        <button
          type="button"
          onClick={handleCreate}
          disabled={createMutation.isPending}
          title="새 메모장"
          className="flex h-7 w-7 items-center justify-center rounded-md transition disabled:opacity-50"
          style={{ color: "var(--text-secondary)", minHeight: 0 }}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {createError ? (
        <div
          className="mx-3 mt-2 rounded px-2 py-1 text-xs"
          style={{
            borderLeft: "2px solid var(--accent-red)",
            backgroundColor: "var(--accent-red-bg)",
            color: "var(--accent-red-text)",
          }}
        >
          {createError}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-md"
                style={{ backgroundColor: "var(--bg-surface)" }}
              />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div
            className="px-4 py-8 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            아직 메모장이 없어요
          </div>
        ) : (
          <ul className="p-2">
            {data.map((m) => (
              <MeetingItem
                key={m.id}
                meeting={m}
                active={m.id === selectedId}
                onClick={() => onSelect(m.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// AppShell.sidePanelFooter slot 으로 주입. 메모장 탭의 list 모드일 때만 보임.
export function MeetingsSidePanelFooter({
  onTrashOpen,
}: {
  onTrashOpen: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <MarkdownHelp />
      <button
        type="button"
        onClick={onTrashOpen}
        title="휴지통"
        aria-label="휴지통"
        className="flex h-7 w-7 items-center justify-center rounded-md transition"
        style={{ color: "var(--text-muted)", minHeight: 0 }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function TrashView({
  onBack,
  onPurged,
}: {
  onBack: () => void;
  onPurged?: (id: string) => void;
}) {
  const { data, isLoading } = useDeletedMeetings();
  const restore = useRestoreMeeting();
  const purge = usePurgeMeeting();
  const [error, setError] = useState<string | null>(null);

  async function handleRestore(id: string) {
    setError(null);
    try {
      await restore.mutateAsync(id);
    } catch (e) {
      setError(formatError(e));
    }
  }

  async function handlePurge(meeting: Meeting) {
    setError(null);
    const label = meeting.title?.trim() || "(제목 없음)";
    if (!window.confirm(`"${label}" 을(를) 영구 삭제할까요? 되돌릴 수 없어요.`)) return;
    try {
      await purge.mutateAsync(meeting.id);
      onPurged?.(meeting.id);
    } catch (e) {
      setError(formatError(e));
    }
  }

  return (
    <div className="relative flex h-full flex-col">
      <div
        className="flex shrink-0 items-center gap-2 px-3 py-3"
        style={{ borderBottom: "1px solid var(--border-default)" }}
      >
        <button
          type="button"
          onClick={onBack}
          title="뒤로"
          aria-label="뒤로"
          className="flex h-7 w-7 items-center justify-center rounded-md transition"
          style={{ color: "var(--text-secondary)", minHeight: 0 }}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2
          className="font-serif text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          휴지통
        </h2>
      </div>

      {error ? (
        <div
          className="mx-3 mt-2 rounded px-2 py-1 text-xs"
          style={{
            borderLeft: "2px solid var(--accent-red)",
            backgroundColor: "var(--accent-red-bg)",
            color: "var(--accent-red-text)",
          }}
        >
          {error}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-md"
                style={{ backgroundColor: "var(--bg-surface)" }}
              />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div
            className="px-4 py-8 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            휴지통이 비어 있어요
          </div>
        ) : (
          <ul className="p-2">
            {data.map((m) => (
              <DeletedMeetingItem
                key={m.id}
                meeting={m}
                onRestore={() => handleRestore(m.id)}
                onPurge={() => handlePurge(m)}
                busy={
                  (restore.isPending && restore.variables === m.id) ||
                  (purge.isPending && purge.variables === m.id)
                }
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DeletedMeetingItem({
  meeting,
  onRestore,
  onPurge,
  busy,
}: {
  meeting: Meeting;
  onRestore: () => void;
  onPurge: () => void;
  busy: boolean;
}) {
  return (
    <li className="list-none">
      <div
        className="group rounded-md px-3 py-2 transition"
        style={{ color: "var(--text-secondary)" }}
      >
        <div
          className="truncate text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {meeting.title?.trim() || "(제목 없음)"}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <div
            className="truncate text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            {meeting.deleted_at
              ? `${formatShort(meeting.deleted_at.slice(0, 10))} 삭제`
              : ""}
          </div>
          <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
            <button
              type="button"
              onClick={onRestore}
              disabled={busy}
              title="복원"
              aria-label="복원"
              className="flex h-6 w-6 items-center justify-center rounded transition disabled:opacity-40"
              style={{ color: "var(--text-secondary)", minHeight: 0 }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onPurge}
              disabled={busy}
              title="영구 삭제"
              aria-label="영구 삭제"
              className="flex h-6 w-6 items-center justify-center rounded transition disabled:opacity-40"
              style={{ color: "var(--accent-red)", minHeight: 0 }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function MarkdownHelp() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="마크다운 도움말"
        aria-label="마크다운 도움말"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition"
        style={{ color: "var(--text-muted)", minHeight: 0 }}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div
          className="absolute inset-0 z-30 flex flex-col overflow-y-auto"
          style={{ backgroundColor: "var(--bg-surface)" }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-default)" }}>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>마크다운 문법</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ color: "var(--text-muted)", minHeight: 0 }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-1.5 px-4 py-4 text-sm" style={{ color: "var(--text-primary)" }}>
            {MARKDOWN_HINTS.map((h, i) => (
              <div key={i}>
                {h.section ? (
                  <div
                    className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wider first:mt-0"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {h.section}
                  </div>
                ) : null}
                <div className="flex items-baseline gap-2">
                  <code
                    className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px]"
                    style={{ backgroundColor: "var(--bg-surface-active)", color: "var(--text-secondary)" }}
                  >
                    {h.syntax}
                  </code>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{h.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

const MARKDOWN_HINTS: Array<{ syntax: string; desc: string; section?: string }> = [
  { section: "제목", syntax: "# 제목", desc: "H1 (대제목)" },
  { syntax: "## 소제목", desc: "H2" },
  { syntax: "### 소소제목", desc: "H3" },
  { syntax: "#### 제목 4", desc: "H4" },
  { syntax: "##### 제목 5", desc: "H5" },
  { syntax: "###### 제목 6", desc: "H6" },
  { syntax: "===", desc: "윗줄을 H1으로 (밑줄식)" },
  { syntax: "---", desc: "윗줄을 H2로 (밑줄식, 윗줄에 텍스트 있을 때)" },

  { section: "서식 (인라인)", syntax: "**굵게**", desc: "굵은 글씨" },
  { syntax: "*기울임*", desc: "기울인 글씨" },
  { syntax: "~~취소선~~", desc: "취소선" },
  { syntax: "`코드`", desc: "인라인 코드" },

  { section: "목록", syntax: "- 항목", desc: "글머리 목록" },
  { syntax: "1. 항목", desc: "번호 목록" },
  { syntax: "- [ ] 할 일", desc: "체크박스" },
  { syntax: "- [x] 완료", desc: "완료 체크박스" },
  { syntax: "␣␣- 항목", desc: "중첩 목록 (2칸 들여쓰기 = 1단계)" },
  { syntax: "␣␣␣␣- 항목", desc: "중첩 목록 (4칸 = 2단계)" },

  { section: "블록", syntax: "> 인용문", desc: "인용 블록 (여러 줄은 줄마다 >)" },
  { syntax: "```\n코드\n```", desc: "코드 블록 (펜스)" },
  { syntax: "␣␣␣␣코드", desc: "코드 블록 (4칸 들여쓰기, list 밖에서)" },
  { syntax: "---", desc: "구분선 (앞뒤로 빈 줄, 단독)" },

  { section: "줄바꿈", syntax: "줄 끝␣␣", desc: "강제 줄바꿈 (줄 끝 공백 2개)" },

  { section: "링크/이미지", syntax: "[텍스트](URL)", desc: "링크" },
  { syntax: "![설명](URL)", desc: "이미지" },
  { syntax: "<URL>", desc: "자동 링크" },
  { syntax: "[label]: URL", desc: "참조 링크 정의 (별도 줄)" },
  { syntax: "[텍스트][label]", desc: "참조 링크 사용" },

  { section: "표", syntax: "| A | B |", desc: "표 (GFM)" },
  { syntax: "|---|---|", desc: "표 헤더 구분선" },
  { syntax: "|:---|---:|", desc: "정렬 (왼쪽/오른쪽)" },
];

function MeetingItem({
  meeting,
  active,
  onClick,
}: {
  meeting: Meeting;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li className="list-none">
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-md px-3 py-2 text-left transition"
        style={{
          backgroundColor: active ? "var(--bg-surface-active)" : undefined,
          color: active ? "var(--text-primary)" : "var(--text-secondary)",
          minHeight: 0,
        }}
      >
        <div className="truncate text-sm font-medium">
          {meeting.title?.trim() || "(제목 없음)"}
        </div>
        <div
          className="mt-0.5 truncate text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          {formatShort(meeting.date)}
          {meeting.attendees ? ` · ${meeting.attendees}` : ""}
        </div>
      </button>
    </li>
  );
}

/* ── Calendar Day Detail Panel ── */

type CalendarDayPanelProps = {
  selectedDate: string;
  onOpenMeeting: (id: string) => void;
};

function timestampToLocalIso(ts: string): string {
  return todayIso(new Date(ts));
}

export function CalendarDayPanel({
  selectedDate,
  onOpenMeeting,
}: CalendarDayPanelProps) {
  const meetingsQ = useMeetings();
  const journalsQ = useJournals();
  const todosQ = useTodos();
  const schedulesQ = useSchedules();
  const updateTodo = useUpdateTodo();
  const deleteSchedule = useDeleteSchedule();

  const today = isToday(selectedDate);

  const { meetings, schedules, todos, journal } = useMemo(() => {
    const meetings = (meetingsQ.data ?? []).filter(
      (m) => m.date === selectedDate,
    );
    const journals = (journalsQ.data ?? []).filter(
      (j) => j.date === selectedDate,
    );
    const schedules = (schedulesQ.data ?? []).filter(
      (s) => timestampToLocalIso(s.start_time) === selectedDate,
    );
    const todos = (todosQ.data ?? []).filter((t) => {
      if (t.done) {
        const d = t.done_at
          ? timestampToLocalIso(t.done_at)
          : t.due_date;
        return d === selectedDate;
      }
      return t.due_date === selectedDate;
    });

    meetings.sort((a, b) => {
      const ta = a.time ?? "";
      const tb = b.time ?? "";
      if (ta !== tb) return ta < tb ? -1 : 1;
      return a.created_at < b.created_at ? -1 : 1;
    });
    schedules.sort((a, b) => (a.start_time < b.start_time ? -1 : 1));
    todos.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.created_at < b.created_at ? -1 : 1;
    });

    return {
      meetings,
      schedules,
      todos,
      journal: journals[0] ?? null,
    };
  }, [meetingsQ.data, journalsQ.data, todosQ.data, schedulesQ.data, selectedDate]);

  function handleToggle(t: Todo) {
    const nextDone = !t.done;
    updateTodo.mutate({
      id: t.id,
      patch: {
        done: nextDone,
        done_at: nextDone ? new Date().toISOString() : null,
      },
    });
  }

  const hasItems =
    meetings.length > 0 ||
    schedules.length > 0 ||
    todos.length > 0 ||
    journal !== null;

  return (
    <div className="flex h-full flex-col">
      {/* Date header */}
      <div
        className="shrink-0 px-4 py-3"
        style={{ borderBottom: "1px solid var(--border-default)" }}
      >
        <div className="flex items-center gap-2">
          {today ? (
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: "var(--accent-red)" }}
            />
          ) : null}
          <h2
            className="font-serif text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {formatDateLong(selectedDate)}
            {today ? " · 오늘" : ""}
          </h2>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {!hasItems ? (
          <div
            className="px-4 py-8 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            이날은 비어있어요
          </div>
        ) : (
          <div className="space-y-1 p-3">
            {/* Schedules (merged with todos visually) */}
            {schedules.map((s) => {
              const time = new Date(s.start_time).toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              });
              return (
                <div
                  key={s.id}
                  className="group flex items-start gap-2 rounded-md px-3 py-2 transition"
                >
                  <Calendar
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    style={{ color: "var(--text-secondary)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm" style={{ color: "var(--text-primary)" }}>
                      <span style={{ color: "var(--text-muted)" }}>
                        {time}
                      </span>{" "}
                      {s.title}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteSchedule.mutate(s.id)}
                    className="text-xs opacity-0 transition group-hover:opacity-100"
                    style={{ color: "var(--text-muted)", minHeight: 0 }}
                  >
                    삭제
                  </button>
                </div>
              );
            })}

            {/* Meetings */}
            {meetings.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onOpenMeeting(m.id)}
                className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left transition"
                style={{ minHeight: 0 }}
              >
                <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm" style={{ color: "var(--text-primary)" }}>
                    {m.time ? (
                      <span style={{ color: "var(--text-muted)" }}>
                        {m.time}
                      </span>
                    ) : null}{" "}
                    {m.title?.trim() || "(제목 없음)"}
                  </div>
                  {m.attendees ? (
                    <div
                      className="mt-0.5 truncate text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {m.attendees}
                    </div>
                  ) : null}
                </div>
              </button>
            ))}

            {/* Todos */}
            {todos.map((t) => (
              <div
                key={t.id}
                className="flex items-start gap-2 rounded-md px-3 py-2 transition"
              >
                <button
                  type="button"
                  onClick={() => handleToggle(t)}
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition"
                  style={{
                    borderColor: t.done ? "var(--border-default)" : "var(--text-muted)",
                    backgroundColor: t.done ? "var(--bg-surface-active)" : undefined,
                    color: t.done ? "var(--text-secondary)" : "transparent",
                    minHeight: 0,
                  }}
                >
                  {t.done ? (
                    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </button>
                <span
                  className={`flex-1 text-sm ${t.done ? "line-through" : ""}`}
                  style={{
                    color: t.done ? "var(--text-muted)" : "var(--text-primary)",
                  }}
                >
                  {t.title}
                </span>
              </div>
            ))}

            {/* Journal */}
            {journal ? (
              <div className="flex items-start gap-2 rounded-md px-3 py-2">
                <BookOpen
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  style={{ color: "var(--text-muted)" }}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className="text-xs font-medium"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    일기
                  </div>
                  <div
                    className="mt-0.5 line-clamp-3 text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {journal.content?.slice(0, 200) || "(내용 없음)"}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Todos Side Panel (category filter) ── */

type TodosFilter = TodoCategory | "all" | "uncategorized";

type TodosPanelProps = {
  activeCategory: TodosFilter;
  onCategoryChange: (cat: TodosFilter) => void;
};

export function TodosSidePanel({
  activeCategory,
  onCategoryChange,
}: TodosPanelProps) {
  const { data } = useTodos();
  const todos = data ?? [];

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: 0, work: 0, meeting: 0, uncategorized: 0 };
    for (const t of todos) {
      if (t.done) continue;
      map.all++;
      if (t.category) map[t.category]++;
      else map.uncategorized++;
    }
    return map;
  }, [todos]);

  const items: Array<{ id: TodoCategory | "all" | "uncategorized"; label: string; count: number }> = [
    { id: "all", label: "전체", count: counts.all },
    ...TODO_CATEGORIES.map((c) => ({
      id: c.id,
      label: c.label,
      count: counts[c.id] ?? 0,
    })),
    { id: "uncategorized", label: "미분류", count: counts.uncategorized },
  ];

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex shrink-0 items-center px-4 py-3"
        style={{ borderBottom: "1px solid var(--border-default)" }}
      >
        <h2
          className="font-serif text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          할 일
        </h2>
      </div>
      <nav className="flex-1 overflow-y-auto p-2" aria-label="카테고리">
        {items.map((item) => {
          const active = item.id === activeCategory;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onCategoryChange(item.id)}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition ${
                active ? "font-medium" : ""
              }`}
              style={{
                backgroundColor: active ? "var(--bg-surface-active)" : undefined,
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                minHeight: 0,
              }}
            >
              <span>{item.label}</span>
              <span
                className="font-mono text-xs"
                style={{
                  color: active ? "var(--text-secondary)" : "var(--text-muted)",
                }}
              >
                {item.count}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
