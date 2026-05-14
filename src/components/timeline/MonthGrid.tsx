import { useMemo } from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { todayIso, isToday } from "../../lib/dates";
import type { Meeting } from "../../api/meetings";
import type { Journal } from "../../api/journals";
import type { Todo } from "../../api/todos";
import type { Schedule } from "../../api/schedules";

export type DayItems = {
  schedules: Schedule[];
  meetings: Meeting[];
  todos: Todo[];
  journal: Journal | null;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type CellEvent = {
  key: string;
  label: string;
  type: "meeting" | "schedule" | "todo";
  time?: string;
  done?: boolean;
};

const MAX_CELL_EVENTS = 3;

type Props = {
  year: number;
  month: number;
  byDate: Map<string, DayItems>;
  onDayClick: (date: string) => void;
  selectedDate?: string | null;
};

export function MonthGrid({
  year,
  month,
  byDate,
  onDayClick,
  selectedDate,
}: Props) {
  const { days, weekCount } = useMemo(() => {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = endOfMonth(monthStart);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const list = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const ms = startOfMonth(monthStart).getTime();
    const me = endOfMonth(monthStart).getTime();
    return {
      days: list.map((d) => ({
        date: todayIso(d),
        dayNum: d.getDate(),
        inMonth: d.getTime() >= ms && d.getTime() <= me,
        weekday: d.getDay(),
      })),
      weekCount: Math.ceil(list.length / 7),
    };
  }, [year, month]);

  return (
    <div className="flex h-full flex-col px-3 lg:px-5">
      {/* Month label */}
      <div className="flex shrink-0 items-baseline gap-2 py-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {year}년 {month}월
        </h3>
      </div>

      {/* Weekday headers */}
      <div className="grid shrink-0 grid-cols-7 border-b border-zinc-100 dark:border-zinc-800/50">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`py-1 text-center text-[11px] font-medium ${
              i === 0
                ? "text-red-500 dark:text-red-400"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day cells — fill remaining height */}
      <div
        className="grid min-h-0 flex-1 grid-cols-7"
        style={{ gridTemplateRows: `repeat(${weekCount}, minmax(0, 1fr))` }}
      >
        {days.map(({ date, dayNum, inMonth, weekday }) => {
          const items = byDate.get(date);
          const today = isToday(date);
          const selected = date === selectedDate;
          const events = buildCellEvents(items);
          const overflow = Math.max(0, events.length - MAX_CELL_EVENTS);
          const visible = events.slice(0, MAX_CELL_EVENTS);

          return (
            <button
              key={date}
              type="button"
              onClick={() => onDayClick(date)}
              className={`flex flex-col overflow-hidden border-b border-r border-zinc-100 px-1 py-0.5 text-left transition dark:border-zinc-800/50 ${
                selected
                  ? "bg-zinc-100 dark:bg-zinc-900"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
              } ${inMonth ? "" : "opacity-30"}`}
              style={{ minHeight: 0 }}
            >
              {/* Date number */}
              <div className="flex shrink-0 items-center gap-1">
                {today ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white dark:bg-red-500">
                    {dayNum}
                  </span>
                ) : (
                  <span
                    className={`px-0.5 text-xs ${
                      weekday === 0
                        ? "text-red-500 dark:text-red-400"
                        : "text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {dayNum}
                  </span>
                )}
                {items?.journal ? (
                  <span className="text-[10px] text-zinc-400" title="일기">
                    ✎
                  </span>
                ) : null}
              </div>

              {/* Event chips */}
              <div className="mt-0.5 min-h-0 flex-1 space-y-px overflow-hidden">
                {visible.map((ev) => (
                  <div
                    key={ev.key}
                    className={`truncate rounded-sm px-1 py-px text-[11px] leading-tight ${
                      ev.type === "meeting"
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                        : ev.done
                          ? "text-zinc-400 line-through dark:text-zinc-500"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400"
                    }`}
                  >
                    {ev.time ? (
                      <span className="opacity-60">{ev.time} </span>
                    ) : null}
                    {ev.label}
                  </div>
                ))}
                {overflow > 0 ? (
                  <div className="px-1 text-[10px] text-zinc-400">
                    +{overflow}
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatCellTime(ts: string): string {
  const d = new Date(ts);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function buildCellEvents(items: DayItems | undefined): CellEvent[] {
  if (!items) return [];
  const events: CellEvent[] = [];

  for (const s of items.schedules) {
    events.push({
      key: `s-${s.id}`,
      label: s.title,
      type: "schedule",
      time: formatCellTime(s.start_time),
    });
  }
  for (const m of items.meetings) {
    events.push({
      key: `m-${m.id}`,
      label: m.title?.trim() || "(제목 없음)",
      type: "meeting",
      time: m.time ?? undefined,
    });
  }
  for (const t of items.todos) {
    events.push({
      key: `t-${t.id}`,
      label: t.title,
      type: "todo",
      done: t.done,
    });
  }

  events.sort((a, b) => {
    if (a.time && b.time) return a.time < b.time ? -1 : 1;
    if (a.time && !b.time) return -1;
    if (!a.time && b.time) return 1;
    return 0;
  });

  return events;
}
