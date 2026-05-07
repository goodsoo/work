import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

const EMPTY: DayItems = {
  schedules: [],
  meetings: [],
  todos: [],
  journal: null,
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type Props = {
  year: number;
  month: number; // 1-12
  byDate: Map<string, DayItems>;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onDayClick: (date: string) => void;
};

export function MonthGrid({
  year,
  month,
  byDate,
  onPrev,
  onNext,
  onToday,
  onDayClick,
}: Props) {
  const days = useMemo(() => {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = endOfMonth(monthStart);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const list = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const ms = startOfMonth(monthStart).getTime();
    const me = endOfMonth(monthStart).getTime();
    return list.map((d) => ({
      date: todayIso(d),
      dayNum: d.getDate(),
      inMonth: d.getTime() >= ms && d.getTime() <= me,
      weekday: d.getDay(),
    }));
  }, [year, month]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="이전 달"
            onClick={onPrev}
            className="rounded p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            style={{ minHeight: 32, minWidth: 32 }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h3 className="font-serif text-lg text-zinc-900 dark:text-zinc-100">
            {year}년 {month}월
          </h3>
          <button
            type="button"
            aria-label="다음 달"
            onClick={onNext}
            className="rounded p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            style={{ minHeight: 32, minWidth: 32 }}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={onToday}
          className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          style={{ minHeight: 28 }}
        >
          오늘
        </button>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800" style={{ gap: 1 }}>
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`bg-white px-1 py-1.5 text-center text-[11px] dark:bg-zinc-950 ${
              i === 0
                ? "text-red-500 dark:text-red-400"
                : "text-zinc-500"
            }`}
          >
            {w}
          </div>
        ))}
        {days.map(({ date, dayNum, inMonth, weekday }) => {
          const items = byDate.get(date) ?? EMPTY;
          const today = isToday(date);
          return (
            <button
              key={date}
              type="button"
              onClick={() => onDayClick(date)}
              className={`flex aspect-square min-h-12 flex-col items-stretch bg-white p-1 text-left transition hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900 ${
                inMonth ? "" : "opacity-40"
              }`}
              style={{ minHeight: 0 }}
            >
              <div className="flex items-center gap-1">
                {today ? (
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-600 dark:bg-red-500"
                  />
                ) : null}
                <span
                  className={`text-xs ${
                    today
                      ? "font-bold text-zinc-900 dark:text-zinc-100"
                      : weekday === 0
                        ? "text-red-500 dark:text-red-400"
                        : "text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {dayNum}
                </span>
              </div>
              <div className="mt-auto flex flex-wrap gap-x-1 gap-y-0.5 font-mono text-[10px]">
                {items.meetings.length > 0 ? (
                  <DayBadge>M{items.meetings.length > 1 ? items.meetings.length : ""}</DayBadge>
                ) : null}
                {items.schedules.length > 0 ? (
                  <DayBadge>S{items.schedules.length > 1 ? items.schedules.length : ""}</DayBadge>
                ) : null}
                {items.todos.filter((t) => !t.done).length > 0 ? (
                  <DayBadge>T{pendingCount(items)}</DayBadge>
                ) : null}
                {items.journal ? <DayBadge italic>J</DayBadge> : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function pendingCount(items: DayItems): string {
  const n = items.todos.filter((t) => !t.done).length;
  return n > 1 ? String(n) : "";
}

function DayBadge({
  children,
  italic,
}: {
  children: React.ReactNode;
  italic?: boolean;
}) {
  return (
    <span
      className={`text-zinc-700 dark:text-zinc-300 ${italic ? "italic" : ""}`}
    >
      {children}
    </span>
  );
}
