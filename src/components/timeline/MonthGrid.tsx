import { useMemo } from "react";
import { addDays } from "date-fns";
import { BookOpen } from "lucide-react";
import { todayIso, isToday } from "../../lib/dates";
import type { Meeting } from "../../api/meetings";
import type { Journal } from "../../api/journals";
import type { Todo } from "../../api/todos";

export type DayItems = {
  meetings: Meeting[];
  todos: Todo[];
  journal: Journal | null;
};

// CalendarPage / WeekRow 등에서 공유. 컴포넌트와 같은 파일에서 export.
// eslint-disable-next-line react-refresh/only-export-components
export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type CellEvent = {
  key: string;
  label: string;
  type: "meeting" | "todo";
  time?: string;
  done?: boolean;
};

const MAX_CELL_EVENTS = 3;

type Props = {
  weeks: Date[]; // 각 주의 일요일 (week start)
  byDate: Map<string, DayItems>;
  onDayClick: (date: string) => void;
  selectedDate?: string | null;
  currentYear: number;
  currentMonth: number;
};

export function MonthGrid({
  weeks,
  byDate,
  onDayClick,
  selectedDate,
  currentYear,
  currentMonth,
}: Props) {
  const cells = useMemo(() => {
    const list: Array<{
      date: string;
      dayNum: number;
      year: number;
      month: number;
      weekday: number;
      snapHere: boolean; // 매 주 일요일 셀 → scroll snap 대상
    }> = [];
    for (const ws of weeks) {
      for (let i = 0; i < 7; i++) {
        const d = addDays(ws, i);
        list.push({
          date: todayIso(d),
          dayNum: d.getDate(),
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          weekday: d.getDay(),
          snapHere: i === 0,
        });
      }
    }
    return list;
  }, [weeks]);

  return (
    <div
      className="grid grid-cols-7 px-3 lg:px-5"
      style={{ gridAutoRows: "clamp(100px, 18svh, 180px)" }}
    >
      {cells.map(({ date, dayNum, year, month, weekday, snapHere }) => {
        const items = byDate.get(date);
        const today = isToday(date);
        const selected = date === selectedDate;
        const events = buildCellEvents(items);
        const overflow = Math.max(0, events.length - MAX_CELL_EVENTS);
        const visible = events.slice(0, MAX_CELL_EVENTS);
        const isFirstOfMonth = dayNum === 1;
        const inCurrentMonth = year === currentYear && month === currentMonth;

        return (
          <button
            key={date}
            type="button"
            onClick={() => onDayClick(date)}
            className="relative flex flex-col overflow-hidden px-1 py-0.5 text-left transition"
            style={{
              borderBottom: "1px solid var(--border-subtle)",
              borderRight: "1px solid var(--border-subtle)",
              backgroundColor: selected ? "var(--bg-surface)" : undefined,
              opacity: inCurrentMonth ? 1 : 0.35,
              minHeight: 0,
              scrollSnapAlign: snapHere ? "start" : undefined,
            }}
          >
            {/* Date number (with month label on day 1) */}
            <div className="flex shrink-0 items-baseline gap-1">
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
                <>
                  {isFirstOfMonth ? (
                    <span
                      className="text-[10px] font-semibold"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {month}월
                    </span>
                  ) : null}
                  <span
                    className={`px-0.5 text-xs ${weekday === 0 ? "text-red-500" : ""}`}
                    style={
                      weekday === 0
                        ? undefined
                        : { color: "var(--text-secondary)" }
                    }
                  >
                    {dayNum}
                  </span>
                </>
              )}
            </div>

            {/* 일기 표시 — 사이드바 카드와 동일 BookOpen 아이콘. 셀 우상단 corner. */}
            {items?.journal ? (
              <BookOpen
                className="pointer-events-none absolute right-1 top-1 h-3 w-3"
                style={{ color: "var(--text-muted)" }}
                aria-label="일기"
              />
            ) : null}

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

function buildCellEvents(items: DayItems | undefined): CellEvent[] {
  if (!items) return [];
  const events: CellEvent[] = [];

  for (const m of items.meetings) {
    events.push({
      key: `m-${m.id}`,
      label: m.title?.trim() || "(제목 없음)",
      type: "meeting",
      time: m.time ?? undefined,
    });
  }
  // due_time 있는 todo 는 같은 todo 줄에서 시각 prefix 만 추가.
  for (const t of items.todos) {
    events.push({
      key: `t-${t.id}`,
      label: t.title,
      type: "todo",
      time: t.due_time ?? undefined,
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
