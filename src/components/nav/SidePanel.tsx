import {
  Plus,
  ClipboardList,
  BookOpen,
  Calendar,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useMeetings, useCreateMeeting } from "../../hooks/useMeetings";
import { useJournals } from "../../hooks/useJournals";
import { useTodos, useUpdateTodo } from "../../hooks/useTodos";
import { useSchedules, useDeleteSchedule } from "../../hooks/useSchedules";
import type { Meeting } from "../../api/meetings";
import type { Todo, TodoCategory } from "../../api/todos";
import { TODO_CATEGORIES } from "../../api/todos";
import { formatDateLong, isToday, todayIso } from "../../lib/dates";

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

export function MeetingsSidePanel({ selectedId, onSelect }: MeetingsPanelProps) {
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
      setCreateError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="font-serif text-sm font-medium text-zinc-900 dark:text-zinc-100">
          회의록
        </h2>
        <button
          type="button"
          onClick={handleCreate}
          disabled={createMutation.isPending}
          title="새 회의록"
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          style={{ minHeight: 0 }}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {createError ? (
        <div className="mx-3 mt-2 rounded border-l-2 border-red-500 bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {createError}
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900"
              />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-zinc-400">
            아직 회의록이 없어요
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
        className={`w-full rounded-md px-3 py-2 text-left transition ${
          active
            ? "bg-zinc-200/80 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
        }`}
        style={{ minHeight: 0 }}
      >
        <div className="truncate text-sm font-medium">
          {meeting.title?.trim() || "(제목 없음)"}
        </div>
        <div className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
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
      <div className="shrink-0 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          {today ? (
            <span className="h-2 w-2 rounded-full bg-red-600 dark:bg-red-500" />
          ) : null}
          <h2 className="font-serif text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {formatDateLong(selectedDate)}
            {today ? " · 오늘" : ""}
          </h2>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {!hasItems ? (
          <div className="px-4 py-8 text-center text-sm text-zinc-400">
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
                  className="group flex items-start gap-2 rounded-md px-3 py-2 transition hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-zinc-900 dark:text-zinc-100">
                      <span className="text-zinc-400 dark:text-zinc-500">
                        {time}
                      </span>{" "}
                      {s.title}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteSchedule.mutate(s.id)}
                    className="text-xs text-zinc-400 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                    style={{ minHeight: 0 }}
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
                className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                style={{ minHeight: 0 }}
              >
                <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-zinc-900 dark:text-zinc-100">
                    {m.time ? (
                      <span className="text-zinc-400 dark:text-zinc-500">
                        {m.time}
                      </span>
                    ) : null}{" "}
                    {m.title?.trim() || "(제목 없음)"}
                  </div>
                  {m.attendees ? (
                    <div className="mt-0.5 truncate text-xs text-zinc-500">
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
                className="flex items-start gap-2 rounded-md px-3 py-2 transition hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
              >
                <button
                  type="button"
                  onClick={() => handleToggle(t)}
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                    t.done
                      ? "border-zinc-300 bg-zinc-200 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800"
                      : "border-red-400 text-transparent hover:border-red-500 dark:border-red-600"
                  }`}
                  style={{ minHeight: 0 }}
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
                  className={`flex-1 text-sm ${
                    t.done
                      ? "text-zinc-400 line-through dark:text-zinc-500"
                      : "text-zinc-900 dark:text-zinc-100"
                  }`}
                >
                  {t.title}
                </span>
              </div>
            ))}

            {/* Journal */}
            {journal ? (
              <div className="flex items-start gap-2 rounded-md px-3 py-2">
                <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-zinc-500">일기</div>
                  <div className="mt-0.5 line-clamp-3 text-sm text-zinc-700 dark:text-zinc-300">
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
      <div className="flex shrink-0 items-center border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="font-serif text-sm font-medium text-zinc-900 dark:text-zinc-100">
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
                active
                  ? "bg-zinc-200/80 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
              }`}
              style={{ minHeight: 0 }}
            >
              <span>{item.label}</span>
              <span
                className={`font-mono text-xs ${
                  active
                    ? "text-zinc-600 dark:text-zinc-300"
                    : "text-zinc-400 dark:text-zinc-500"
                }`}
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
