import {
  Plus,
  ClipboardList,
  BookOpen,
  HelpCircle,
  X,
  Trash2,
  ArrowUpDown,
  Check,
  Pencil,
  Circle,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  useMeetings,
  useCreateMeeting,
} from "../../hooks/useMeetings";
import { useMeetingSort, type MeetingSortKey } from "../../hooks/useMeetingSort";
import { type TodoSortKey } from "../../hooks/useTodoSort";
import { useJournals } from "../../hooks/useJournals";
import { useTodos, useUpdateTodo } from "../../hooks/useTodos";
import type { Meeting } from "../../api/meetings";
import type { Todo, TodoCategory } from "../../api/todos";
import { TODO_CATEGORIES } from "../../api/todos";
import { formatDateLong, isToday, todayIso } from "../../lib/dates";
import { formatError } from "../../lib/errors";
import { categoryColor } from "../../lib/todoCategory";
import { TaskAddModal } from "../tasks/TaskAddModal";
import { JournalOverlay } from "../calendar/JournalOverlay";

/* ── Meetings Side Panel ── */

type MeetingsPanelProps = {
  selectedId: string | null;
  onSelect: (id: string) => void;
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
}: MeetingsPanelProps) {
  const { data, isLoading } = useMeetings();
  const createMutation = useCreateMeeting();
  const [createError, setCreateError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useMeetingSort();

  // 키 우선순위: date → time → mtime. date_desc / date_asc 가 방향 결정,
  // 그 안에서 time 도 같은 방향. date 없는 메모는 맨 아래, 같은 date 안에서
  // time 없는 메모도 맨 아래 — 정보 없는 쪽을 끝으로 몰아 정렬 어긋남 회피.
  const sortedData = useMemo(() => {
    if (!data) return data;
    const arr = data.slice();
    if (sortKey === "name") {
      arr.sort((a, b) => {
        const ta = (a.title ?? "").trim();
        const tb = (b.title ?? "").trim();
        if (!ta && !tb) return b.mtime - a.mtime;
        if (!ta) return 1;
        if (!tb) return -1;
        return ta.localeCompare(tb, "ko");
      });
    } else {
      const asc = sortKey === "date_asc";
      arr.sort((a, b) => {
        const da = a.date ?? "";
        const db = b.date ?? "";
        if (da !== db) {
          if (!da) return 1;
          if (!db) return -1;
          return asc ? da.localeCompare(db) : db.localeCompare(da);
        }
        const ta = a.time ?? "";
        const tb = b.time ?? "";
        if (ta !== tb) {
          if (!ta) return 1;
          if (!tb) return -1;
          return asc ? ta.localeCompare(tb) : tb.localeCompare(ta);
        }
        return asc ? a.mtime - b.mtime : b.mtime - a.mtime;
      });
    }
    return arr;
  }, [data, sortKey]);

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
      onSelect(created.uid);
    } catch (e) {
      setCreateError(formatError(e));
    }
  }

  return (
    <div className="relative flex h-full flex-col">
      <div
        className="flex shrink-0 items-center justify-between px-4"
        style={{
          height: "var(--page-header-h)",
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        <h2
          className="font-serif text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          메모장
        </h2>
        <div className="flex items-center gap-0.5">
          <SortMenu value={sortKey} onChange={setSortKey} />
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
        ) : !sortedData || sortedData.length === 0 ? (
          <div
            className="px-4 py-8 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            아직 메모장이 없어요
          </div>
        ) : (
          <ul className="p-2">
            {sortedData.map((m) => (
              <MeetingItem
                key={m.uid}
                meeting={m}
                active={m.uid === selectedId}
                onClick={() => onSelect(m.uid)}
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

// portfolio 탭에서만 보임. 메모장과 별개 도메인 휴지통 (portfolio/.trash/).
export function PortfolioSidePanelFooter({
  onTrashOpen,
}: {
  onTrashOpen: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onTrashOpen}
        title="포트폴리오 휴지통"
        aria-label="포트폴리오 휴지통"
        className="flex h-7 w-7 items-center justify-center rounded-md transition"
        style={{ color: "var(--text-muted)", minHeight: 0 }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
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
          <div className="flex items-center justify-between px-4" style={{ height: "var(--page-header-h)", borderBottom: "1px solid var(--border-default)" }}>
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

const SORT_OPTIONS: Array<{ id: MeetingSortKey; label: string }> = [
  { id: "date_desc", label: "최신순" },
  { id: "date_asc", label: "오래된순" },
  { id: "name", label: "이름순" },
];

function SortMenu({
  value,
  onChange,
}: {
  value: MeetingSortKey;
  onChange: (next: MeetingSortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 / ESC 로 닫기.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="정렬"
        aria-label="정렬"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-7 w-7 items-center justify-center rounded-md transition"
        style={{
          color: "var(--text-secondary)",
          backgroundColor: open ? "var(--bg-surface-active)" : undefined,
          minHeight: 0,
        }}
      >
        <ArrowUpDown className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[120px] overflow-hidden rounded-md shadow-md"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
          }}
        >
          {SORT_OPTIONS.map((opt) => {
            const active = opt.id === value;
            return (
              <button
                key={opt.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition"
                style={{
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  backgroundColor: active ? "var(--bg-surface-active)" : undefined,
                  minHeight: 0,
                }}
              >
                <span>{opt.label}</span>
                {active ? (
                  <Check className="h-3 w-3" style={{ color: "var(--text-secondary)" }} />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
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
  const updateTodo = useUpdateTodo();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showJournalOverlay, setShowJournalOverlay] = useState(false);

  const today = isToday(selectedDate);

  const { meetings, todos, journal } = useMemo(() => {
    const meetings = (meetingsQ.data ?? []).filter(
      (m) => m.date === selectedDate,
    );
    const journals = (journalsQ.data ?? []).filter(
      (j) => j.date === selectedDate,
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
    // 시간 있는 todo 가 앞 (시간순), 없는 거 뒤 (created_at 순)
    todos.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const ta = a.due_time ?? "";
      const tb = b.due_time ?? "";
      if (ta !== tb) {
        if (!ta) return 1;
        if (!tb) return -1;
        return ta < tb ? -1 : 1;
      }
      return a.created_at < b.created_at ? -1 : 1;
    });

    return {
      meetings,
      todos,
      journal: journals[0] ?? null,
    };
  }, [meetingsQ.data, journalsQ.data, todosQ.data, selectedDate]);

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

  // journal 은 header 바로 아래 별도 section. items list 에는 안 들어감.
  const hasItems = meetings.length > 0 || todos.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Date header */}
      <div
        className="flex shrink-0 items-center justify-between px-4"
        style={{
          height: "var(--page-header-h)",
          borderBottom: "1px solid var(--border-default)",
        }}
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
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          title="할 일 추가"
          aria-label="할 일 추가"
          className="flex h-7 w-7 items-center justify-center rounded-md transition"
          style={{ color: "var(--text-secondary)", minHeight: 0 }}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Journal CTA — 일기 빠른 진입. 없는 날은 dashed border + 펜 + 한 줄, 있는 날은
          미리보기 카드 (본문 첫 ~100자) + 펜 아이콘. 클릭 시 overlay 열림. */}
      <div
        className="shrink-0 px-3 pt-3 pb-2"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        {journal ? (
          <button
            type="button"
            onClick={() => setShowJournalOverlay(true)}
            className="group flex w-full items-start gap-2 rounded-md px-3 py-2 text-left transition hover:bg-[var(--bg-surface-hover)]"
            style={{ minHeight: 0 }}
          >
            <BookOpen
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              style={{ color: "var(--text-muted)" }}
            />
            <div className="min-w-0 flex-1">
              <div
                className="flex items-center justify-between gap-2 text-xs font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                <span>일기</span>
                <Pencil
                  className="h-3 w-3 opacity-0 transition group-hover:opacity-100"
                  style={{ color: "var(--text-muted)" }}
                />
              </div>
              <div
                className="mt-0.5 line-clamp-3 whitespace-pre-wrap font-serif text-sm leading-snug"
                style={{ color: "var(--text-secondary)" }}
              >
                {journal.content?.trim() || "(내용 없음)"}
              </div>
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowJournalOverlay(true)}
            className="flex w-full items-center gap-2 rounded-md border border-dashed px-3 py-2 text-left text-sm transition hover:bg-[var(--bg-surface-hover)]"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-muted)",
              minHeight: 0,
            }}
            aria-label="일기 쓰기"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span>일기 쓰기</span>
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {!hasItems ? (
          <div
            className="px-4 py-8 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            이날의 일정 / 할 일이 없어요
          </div>
        ) : (
          <div className="space-y-1 p-3">
            {/* Meetings */}
            {meetings.map((m) => (
              <button
                key={m.uid}
                type="button"
                onClick={() => onOpenMeeting(m.uid)}
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

            {/* Todos — due_time 있으면 시각 prefix */}
            {todos.map((t) => {
              const catColor = categoryColor(t.category);
              const pendingBorder = catColor || "var(--text-muted)";
              const pendingFill = catColor
                ? `color-mix(in srgb, ${catColor} 4%, transparent)`
                : "transparent";
              return (
              <div
                key={t.id}
                className="flex items-start gap-2 rounded-md px-3 py-2 transition"
              >
                <button
                  type="button"
                  onClick={() => handleToggle(t)}
                  className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition"
                  style={{
                    borderColor: t.done ? "var(--text-secondary)" : pendingBorder,
                    backgroundColor: t.done ? "var(--text-secondary)" : pendingFill,
                    color: t.done ? "var(--text-inverse)" : "transparent",
                    borderWidth: t.done ? 1 : 1.5,
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
                  {t.due_time ? (
                    <span style={{ color: "var(--text-muted)" }}>
                      {t.due_time}{" "}
                    </span>
                  ) : null}
                  {t.title}
                </span>
              </div>
              );
            })}

          </div>
        )}
      </div>

      <TaskAddModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        prefill={{ due_date: selectedDate, category: "schedule" }}
      />
      <JournalOverlay
        isOpen={showJournalOverlay}
        date={selectedDate}
        onClose={() => setShowJournalOverlay(false)}
      />
    </div>
  );
}

/* ── Todos Side Panel — 상태 필터 + 카테고리 필터 (독립 차원, AND 결합) ── */

export type TodosStatusFilter = "all" | "pending" | "done" | "cancelled";
export type TodosCategoryFilter =
  | "all"
  | "uncategorized"
  | TodoCategory;

type TodosPanelProps = {
  statusFilter: TodosStatusFilter;
  onStatusChange: (next: TodosStatusFilter) => void;
  categoryFilter: TodosCategoryFilter;
  onCategoryChange: (next: TodosCategoryFilter) => void;
  sortKey: TodoSortKey;
  onSortKeyChange: (next: TodoSortKey) => void;
};

export function TodosSidePanel({
  statusFilter,
  onStatusChange,
  categoryFilter,
  onCategoryChange,
  sortKey,
  onSortKeyChange,
}: TodosPanelProps) {
  const { data } = useTodos();
  const todos = data ?? [];

  // 두 차원 독립. 한 차원 count 는 다른 차원과 AND 후 — 사용자가 "현재 다른
  // 차원 적용 후 이 옵션 누르면 몇 개?" 미리 보기. (예: status=done 일 때
  // 카테고리별 count 는 done 만 센 값.)
  // status: 미완료 = !done && !cancelled (actionable), 완료 = done, 취소 = cancelled.
  // cancelled 는 별도 view 로 분리 (사이드바 하단 entry). deleted 는 footer 의
  // 휴지통 modal 에서 처리 — 다른 모든 필터 (전체/미완료/완료 + 카테고리) 에서
  // 격리.
  const counts = useMemo(() => {
    function inStatus(t: Todo): boolean {
      if (t.deleted) return false; // deleted 는 절대 안 셈
      if (statusFilter === "cancelled") return t.cancelled;
      if (t.cancelled) return false;
      if (statusFilter === "all") return true;
      if (statusFilter === "pending") return !t.done;
      return t.done;
    }
    function inCategory(t: Todo): boolean {
      if (categoryFilter === "all") return true;
      if (categoryFilter === "uncategorized") return !t.category;
      return t.category === categoryFilter;
    }
    const status: Record<TodosStatusFilter, number> = {
      all: 0,
      pending: 0,
      done: 0,
      cancelled: 0,
    };
    const category: Record<string, number> = { all: 0, uncategorized: 0 };
    for (const c of TODO_CATEGORIES) category[c.id] = 0;
    for (const t of todos) {
      if (t.deleted) continue; // 휴지통 modal 에서만 보임
      if (t.cancelled) {
        status.cancelled++;
        continue;
      }
      if (inCategory(t)) {
        status.all++;
        if (t.done) status.done++;
        else status.pending++;
      }
      if (inStatus(t)) {
        category.all++;
        if (t.category) {
          category[t.category] = (category[t.category] ?? 0) + 1;
        } else {
          category.uncategorized++;
        }
      }
    }
    return { status, category };
  }, [todos, statusFilter, categoryFilter]);

  // status leading 아이콘 — 카테고리 dot 과 동일한 12px 박스 안에서 정렬.
  // "전체" 는 카테고리 "전체"와 동일하게 leading 비움 (시각 비대칭이 의미 신호).
  const statusItems: Array<{
    id: TodosStatusFilter;
    label: string;
    count: number;
    leading: ReactNode;
  }> = [
    { id: "all", label: "전체", count: counts.status.all, leading: null },
    {
      id: "pending",
      label: "미완료",
      count: counts.status.pending,
      leading: (
        <Circle
          className="h-3 w-3"
          strokeWidth={1.75}
          style={{ color: "var(--text-secondary)" }}
        />
      ),
    },
    {
      id: "done",
      label: "완료",
      count: counts.status.done,
      // CheckCircle2 (lucide) 의 내부 체크가 12px 사이즈에서 너무 작아 보여 →
      // filled 원 + Check (체크만 아이콘, strokeWidth 굵게) wrapper 로 교체.
      // 체크 path 가 원 영역을 더 많이 차지 → 작은 사이즈에서도 또렷.
      leading: (
        <span
          className="inline-flex h-3 w-3 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--text-secondary)" }}
        >
          <Check
            className="h-2 w-2"
            strokeWidth={3.5}
            style={{ color: "var(--text-inverse)" }}
          />
        </span>
      ),
    },
  ];
  const categoryItems: Array<{ id: TodosCategoryFilter; label: string; count: number }> = [
    { id: "all", label: "전체", count: counts.category.all },
    { id: "uncategorized", label: "미분류", count: counts.category.uncategorized },
    ...TODO_CATEGORIES.map((c) => ({
      id: c.id as TodosCategoryFilter,
      label: c.label,
      count: counts.category[c.id] ?? 0,
    })),
  ];

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex shrink-0 items-center justify-between px-4"
        style={{
          height: "var(--page-header-h)",
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        <h2
          className="font-serif text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          할 일
        </h2>
        <div className="flex items-center gap-0.5">
          <SortMenu value={sortKey} onChange={onSortKeyChange} />
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("todos:add-request"))}
            title="새 할 일"
            className="flex h-7 w-7 items-center justify-center rounded-md transition"
            style={{ color: "var(--text-secondary)", minHeight: 0 }}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col p-2" aria-label="필터">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {statusItems.map((item) => (
            <TodosFilterItem
              key={item.id}
              item={item}
              leading={item.leading}
              active={item.id === statusFilter}
              onClick={() => onStatusChange(item.id)}
            />
          ))}
          <div
            className="my-2"
            style={{ borderTop: "1px solid var(--border-subtle)" }}
          />
          {categoryItems.map((item) => {
            // 카테고리 필터 entry 옆에 시맨틱 색 dot — 캘린더 / 체크박스 와
            // 동일 토큰. uncategorized 는 회색 (--text-muted) 로 명시. "전체"
            // 는 status "전체" 와 동일하게 leading 비움.
            const dotColor =
              item.id === "uncategorized"
                ? "var(--text-muted)"
                : item.id === "all"
                  ? ""
                  : categoryColor(item.id as TodoCategory);
            const leading = dotColor ? (
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: dotColor }}
              />
            ) : null;
            return (
              <TodosFilterItem
                key={item.id}
                item={item}
                leading={leading}
                active={item.id === categoryFilter}
                onClick={() => onCategoryChange(item.id)}
              />
            );
          })}
        </div>
        {/* 취소됨 — 사이드바 하단 별도 entry. 클릭 시 다른 필터 무시. */}
        <div
          className="mt-2 pt-2"
          style={{ borderTop: "1px solid var(--border-default)" }}
        >
          <TodosFilterItem
            item={{ label: "취소됨", count: counts.status.cancelled }}
            leading={
              <XCircle
                className="h-3 w-3"
                strokeWidth={1.75}
                style={{ color: "var(--text-secondary)" }}
              />
            }
            active={statusFilter === "cancelled"}
            onClick={() => onStatusChange("cancelled")}
          />
        </div>
      </nav>
    </div>
  );
}

function TodosFilterItem({
  item,
  active,
  onClick,
  leading,
}: {
  item: { label: string; count: number };
  active: boolean;
  onClick: () => void;
  leading?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition ${
        active ? "font-medium" : ""
      }`}
      style={{
        backgroundColor: active ? "var(--bg-surface-active)" : undefined,
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        minHeight: 0,
      }}
    >
      <span className="inline-flex items-center gap-2">
        {/* 12px fixed area — dot/icon 다 가운데 정렬 → 라벨 좌측 align 통일. */}
        <span
          aria-hidden
          className="inline-flex h-3 w-3 shrink-0 items-center justify-center"
        >
          {leading}
        </span>
        {item.label}
      </span>
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
}

// AppShell.sidePanelFooter slot 으로 주입. 할 일 탭의 휴지통 entry.
// 메모장 MeetingsSidePanelFooter 와 동일 패턴.
export function TodosSidePanelFooter({
  onTrashOpen,
}: {
  onTrashOpen: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
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
