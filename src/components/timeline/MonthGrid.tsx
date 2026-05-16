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

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

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
    <div
      className="grid h-full grid-cols-7 px-3 lg:px-5"
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
              className="flex flex-col overflow-hidden px-1 py-0.5 text-left transition"
              style={{
                borderBottom: "1px solid var(--border-subtle)",
                borderRight: "1px solid var(--border-subtle)",
                backgroundColor: selected ? "var(--bg-surface)" : undefined,
                opacity: inMonth ? 1 : 0.3,
                minHeight: 0,
              }}
            >
              {/* Date number */}
              <div className="flex shrink-0 items-center gap-1">
                {today ? (
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{
                      backgroundColor: "var(--accent-red)",
                      color: "var(--text-inverse)",
                    }}
                  >
                    {dayNum}
                  </span>
                ) : (
                  <span
                    className={`px-0.5 text-xs ${weekday === 0 ? "text-red-500" : ""}`}
                    style={weekday === 0 ? undefined : { color: "var(--text-secondary)" }}
                  >
                    {dayNum}
                  </span>
                )}
                {items?.journal ? (
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                    title="일기"
                  >
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
                      ev.done ? "line-through" : ""
                    }`}
                    style={
                      ev.type === "meeting"
                        ? {
                            backgroundColor: "var(--accent-blue-bg)",
                            color: "var(--accent-blue-text)",
                          }
                        : ev.done
                          ? { color: "var(--text-muted)" }
                          : {
                              backgroundColor: "var(--bg-surface)",
                              color: "var(--text-secondary)",
                            }
                    }
                  >
                    {ev.time ? (
                      <span className="opacity-60">{ev.time} </span>
                    ) : null}
                    {ev.label}
                  </div>
                ))}
                {overflow > 0 ? (
                  <div
                    className="px-1 text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    +{overflow}
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
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
