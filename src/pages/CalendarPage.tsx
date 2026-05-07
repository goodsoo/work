import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, List } from "lucide-react";
import { useMeetings } from "../hooks/useMeetings";
import { useJournals } from "../hooks/useJournals";
import { useTodos, useUpdateTodo } from "../hooks/useTodos";
import {
  useCreateSchedule,
  useDeleteSchedule,
  useSchedules,
} from "../hooks/useSchedules";
import type { Todo } from "../api/todos";
import {
  addDaysIso,
  formatDateLong,
  isoDateRange,
  isToday,
  todayIso,
} from "../lib/dates";
import { JournalBlock } from "../components/timeline/JournalBlock";
import { MeetingBlock } from "../components/timeline/MeetingBlock";
import { TodoBlock } from "../components/timeline/TodoBlock";
import { ScheduleBlock } from "../components/timeline/ScheduleBlock";
import { AddScheduleForm } from "../components/timeline/AddScheduleForm";
import { MonthGrid, type DayItems } from "../components/timeline/MonthGrid";
import { PageHeader } from "../components/nav/PageHeader";

const WINDOW_DAYS = 7;

type Props = {
  onOpenMeeting: (id: string) => void;
};

const EMPTY: DayItems = {
  schedules: [],
  meetings: [],
  todos: [],
  journal: null,
};

function timestampToLocalIsoDate(ts: string): string {
  return todayIso(new Date(ts));
}

export function CalendarPage({ onOpenMeeting }: Props) {
  const meetingsQ = useMeetings();
  const journalsQ = useJournals();
  const todosQ = useTodos();
  const schedulesQ = useSchedules();

  const updateTodo = useUpdateTodo();
  const createSchedule = useCreateSchedule();
  const deleteSchedule = useDeleteSchedule();

  const today = todayIso();
  const [view, setView] = useState<"timeline" | "grid">("timeline");
  const [centerDate, setCenterDate] = useState<string>(today);
  const [gridYear, setGridYear] = useState(new Date().getFullYear());
  const [gridMonth, setGridMonth] = useState(new Date().getMonth() + 1);

  const byDate = useMemo<Map<string, DayItems>>(() => {
    const map = new Map<string, DayItems>();
    function ensure(d: string): DayItems {
      let items = map.get(d);
      if (!items) {
        items = { schedules: [], meetings: [], todos: [], journal: null };
        map.set(d, items);
      }
      return items;
    }
    for (const m of meetingsQ.data ?? []) {
      if (m.date) ensure(m.date).meetings.push(m);
    }
    for (const j of journalsQ.data ?? []) {
      ensure(j.date).journal = j;
    }
    for (const s of schedulesQ.data ?? []) {
      ensure(timestampToLocalIsoDate(s.start_time)).schedules.push(s);
    }
    for (const t of todosQ.data ?? []) {
      let d: string | null = null;
      if (t.done) {
        if (t.done_at) d = timestampToLocalIsoDate(t.done_at);
        else if (t.due_date) d = t.due_date;
      } else if (t.due_date) {
        d = t.due_date;
      }
      if (d) ensure(d).todos.push(t);
    }
    for (const items of map.values()) {
      items.schedules.sort((a, b) => (a.start_time < b.start_time ? -1 : 1));
      items.meetings.sort((a, b) => {
        const ta = a.time ?? "";
        const tb = b.time ?? "";
        if (ta !== tb) return ta < tb ? -1 : 1;
        return a.created_at < b.created_at ? -1 : 1;
      });
      items.todos.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return a.created_at < b.created_at ? -1 : 1;
      });
    }
    return map;
  }, [meetingsQ.data, journalsQ.data, todosQ.data, schedulesQ.data]);

  const isLoading =
    meetingsQ.isLoading ||
    journalsQ.isLoading ||
    todosQ.isLoading ||
    schedulesQ.isLoading;

  const firstError =
    meetingsQ.error || journalsQ.error || todosQ.error || schedulesQ.error;

  function handleToggleTodo(t: Todo) {
    const nextDone = !t.done;
    updateTodo.mutate({
      id: t.id,
      patch: {
        done: nextDone,
        done_at: nextDone ? new Date().toISOString() : null,
      },
    });
  }

  function jumpToToday() {
    setCenterDate(today);
    setView("timeline");
    const now = new Date();
    setGridYear(now.getFullYear());
    setGridMonth(now.getMonth() + 1);
  }

  function gridPrev() {
    if (gridMonth === 1) {
      setGridMonth(12);
      setGridYear((y) => y - 1);
    } else {
      setGridMonth((m) => m - 1);
    }
  }

  function gridNext() {
    if (gridMonth === 12) {
      setGridMonth(1);
      setGridYear((y) => y + 1);
    } else {
      setGridMonth((m) => m + 1);
    }
  }

  function handleDayClick(date: string) {
    setCenterDate(date);
    setView("timeline");
  }

  return (
    <>
      <PageHeader
        left={
          <h2 className="font-serif text-2xl text-zinc-900 dark:text-zinc-100">
            캘린더
          </h2>
        }
        right={
          <>
            <ViewToggle view={view} onChange={setView} />
            <AddScheduleForm
              defaultDate={view === "timeline" ? centerDate : today}
              pending={createSchedule.isPending}
              onCreate={(input) => createSchedule.mutate(input)}
            />
          </>
        }
      />
      <div className="mx-auto w-full max-w-2xl px-4 pb-12 pt-6 md:px-6">
          {firstError ? (
          <div className="mb-6 rounded-lg border-l-4 border-red-600 bg-red-50 p-4 text-sm text-red-900 dark:border-red-500 dark:bg-red-950/30 dark:text-red-200">
            <div className="font-medium">데이터를 불러오지 못했어요</div>
            <div className="mt-1 font-mono text-xs opacity-80">
              {(firstError as Error).message}
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <SkeletonTimeline />
        ) : view === "timeline" ? (
          <TimelineView
            centerDate={centerDate}
            today={today}
            byDate={byDate}
            onResetToToday={jumpToToday}
            onOpenMeeting={onOpenMeeting}
            onToggleTodo={handleToggleTodo}
            onDeleteSchedule={(id) => deleteSchedule.mutate(id)}
          />
        ) : (
          <MonthGrid
            year={gridYear}
            month={gridMonth}
            byDate={byDate}
            onPrev={gridPrev}
            onNext={gridNext}
            onToday={jumpToToday}
            onDayClick={handleDayClick}
          />
        )}
      </div>
    </>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: "timeline" | "grid";
  onChange: (v: "timeline" | "grid") => void;
}) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
      role="tablist"
    >
      <button
        type="button"
        role="tab"
        aria-selected={view === "timeline"}
        onClick={() => onChange("timeline")}
        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs transition ${
          view === "timeline"
            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
            : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        }`}
        style={{ minHeight: 32 }}
      >
        <List className="h-3.5 w-3.5" />
        타임라인
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === "grid"}
        onClick={() => onChange("grid")}
        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs transition ${
          view === "grid"
            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
            : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        }`}
        style={{ minHeight: 32 }}
      >
        <Calendar className="h-3.5 w-3.5" />
        달력
      </button>
    </div>
  );
}

function TimelineView({
  centerDate,
  today,
  byDate,
  onResetToToday,
  onOpenMeeting,
  onToggleTodo,
  onDeleteSchedule,
}: {
  centerDate: string;
  today: string;
  byDate: Map<string, DayItems>;
  onResetToToday: () => void;
  onOpenMeeting: (id: string) => void;
  onToggleTodo: (t: Todo) => void;
  onDeleteSchedule: (id: string) => void;
}) {
  const startDate = addDaysIso(centerDate, -WINDOW_DAYS);
  const endDate = addDaysIso(centerDate, WINDOW_DAYS);
  const days = useMemo(
    () => isoDateRange(startDate, endDate),
    [startDate, endDate],
  );

  const centerRef = useRef<HTMLElement | null>(null);
  const lastScrolledRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastScrolledRef.current === centerDate) return;
    if (!centerRef.current) return;
    centerRef.current.scrollIntoView({ block: "start", behavior: "auto" });
    lastScrolledRef.current = centerDate;
  }, [centerDate]);

  return (
    <>
      {centerDate !== today ? (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <span>{formatDateLong(centerDate)} 기준 표시 중</span>
          <button
            type="button"
            onClick={onResetToToday}
            className="rounded text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-200 dark:hover:text-zinc-100"
            style={{ minHeight: 0 }}
          >
            오늘로
          </button>
        </div>
      ) : null}

      <div className="space-y-8">
        {days.map((d, idx) => {
          const items = byDate.get(d) ?? EMPTY;
          const todayMatch = isToday(d);
          const isCenter = d === centerDate;
          return (
            <DaySection
              key={d}
              date={d}
              items={items}
              todayMatch={todayMatch}
              isFirst={idx === 0}
              onOpenMeeting={onOpenMeeting}
              onToggleTodo={onToggleTodo}
              onDeleteSchedule={onDeleteSchedule}
              sectionRef={isCenter ? centerRef : undefined}
            />
          );
        })}
      </div>
    </>
  );
}

function DaySection({
  date,
  items,
  todayMatch,
  isFirst,
  onOpenMeeting,
  onToggleTodo,
  onDeleteSchedule,
  sectionRef,
}: {
  date: string;
  items: DayItems;
  todayMatch: boolean;
  isFirst: boolean;
  onOpenMeeting: (id: string) => void;
  onToggleTodo: (t: Todo) => void;
  onDeleteSchedule: (id: string) => void;
  sectionRef?: React.MutableRefObject<HTMLElement | null>;
}) {
  const journalVisible = todayMatch || items.journal !== null;
  const dayIsEmpty =
    !journalVisible &&
    items.schedules.length === 0 &&
    items.meetings.length === 0 &&
    items.todos.length === 0;

  return (
    <section
      ref={sectionRef as React.RefObject<HTMLElement>}
      className={isFirst ? "" : "border-t border-zinc-200 pt-6 dark:border-zinc-800"}
    >
      <DayHeader date={date} todayMatch={todayMatch} />

      <div className="mt-4 space-y-4">
        {items.schedules.map((s) => (
          <ScheduleBlock
            key={s.id}
            schedule={s}
            onDelete={() => onDeleteSchedule(s.id)}
          />
        ))}
        {items.meetings.map((m) => (
          <MeetingBlock
            key={m.id}
            meeting={m}
            onOpen={() => onOpenMeeting(m.id)}
          />
        ))}
        {items.todos.map((t) => (
          <TodoBlock key={t.id} todo={t} onToggle={() => onToggleTodo(t)} />
        ))}
        {journalVisible ? (
          <JournalBlock
            date={date}
            existing={items.journal}
            emphasized={todayMatch}
          />
        ) : null}
        {dayIsEmpty ? (
          <p className="pl-8 text-sm text-zinc-400">이날은 비어있어요.</p>
        ) : null}
      </div>
    </section>
  );
}

function DayHeader({
  date,
  todayMatch,
}: {
  date: string;
  todayMatch: boolean;
}) {
  return (
    <h3
      className={`flex items-baseline gap-2 font-serif text-2xl ${
        todayMatch
          ? "font-bold text-zinc-900 dark:text-zinc-100"
          : "text-zinc-700 dark:text-zinc-300"
      }`}
    >
      {todayMatch ? (
        <span
          aria-hidden
          className="-ml-3 inline-block h-2 w-2 self-center rounded-full bg-red-600 dark:bg-red-500"
        />
      ) : null}
      <span>{formatDateLong(date)}</span>
      {todayMatch ? (
        <span className="text-sm font-normal not-italic text-zinc-500">· 오늘</span>
      ) : null}
    </h3>
  );
}

function SkeletonTimeline() {
  return (
    <div className="space-y-8" aria-hidden>
      {[0, 1, 2].map((i) => (
        <section key={i} className="space-y-3">
          <div className="h-7 w-40 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
        </section>
      ))}
    </div>
  );
}
