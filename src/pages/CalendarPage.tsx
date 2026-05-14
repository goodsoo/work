import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMeetings } from "../hooks/useMeetings";
import { useJournals } from "../hooks/useJournals";
import { useTodos } from "../hooks/useTodos";
import { useSchedules } from "../hooks/useSchedules";
import { todayIso } from "../lib/dates";
import { MonthGrid, type DayItems } from "../components/timeline/MonthGrid";

type Props = {
  targetDate?: string | null;
  onSelectedDateChange?: (date: string) => void;
};

/** Number of months rendered. Must be odd so there's a center. */
const BUFFER = 7;
const CENTER = Math.floor(BUFFER / 2); // 3

function addMonths(year: number, month: number, offset: number) {
  const d = new Date(year, month - 1 + offset, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function timestampToLocalIsoDate(ts: string): string {
  return todayIso(new Date(ts));
}

export function CalendarPage({ targetDate, onSelectedDateChange }: Props) {
  const meetingsQ = useMeetings();
  const journalsQ = useJournals();
  const todosQ = useTodos();
  const schedulesQ = useSchedules();

  const today = todayIso();
  const anchorYear = useRef(new Date().getFullYear());
  const anchorMonth = useRef(new Date().getMonth() + 1);

  const [centerOffset, setCenterOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const containerRef = useRef<HTMLDivElement>(null);
  const isRebalancing = useRef(false);
  const initialScrollDone = useRef(false);

  // Scroll to center section (initial + after rebalance)
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!initialScrollDone.current || isRebalancing.current) {
      // Use rAF to ensure layout is settled and clientHeight is non-zero
      requestAnimationFrame(() => {
        if (!el.clientHeight) return;
        el.scrollTop = CENTER * el.clientHeight;
        initialScrollDone.current = true;
        isRebalancing.current = false;
      });
    }
  }, [centerOffset]);

  // External target date (from side panel)
  const [lastTarget, setLastTarget] = useState<string | null>(null);
  if (targetDate && targetDate !== lastTarget) {
    setLastTarget(targetDate);
    setSelectedDate(targetDate);
    // Jump to target month
    const [y, m] = targetDate.split("-").map(Number);
    if (y && m) {
      const offset =
        (y - anchorYear.current) * 12 + (m - anchorMonth.current);
      if (offset !== centerOffset) {
        isRebalancing.current = true;
        setCenterOffset(offset);
      }
    }
  }

  // Generate month list
  const months = useMemo(() => {
    const result: Array<{ year: number; month: number; key: string }> = [];
    for (let i = -CENTER; i <= CENTER; i++) {
      const ym = addMonths(
        anchorYear.current,
        anchorMonth.current,
        centerOffset + i,
      );
      result.push({ ...ym, key: `${ym.year}-${ym.month}` });
    }
    return result;
  }, [centerOffset]);

  // Build byDate map
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

  // Detect scroll-snap settle → rebalance if not center
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleScroll = useCallback(() => {
    if (isRebalancing.current) return;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      const el = containerRef.current;
      if (!el || !el.clientHeight) return;
      const idx = Math.round(el.scrollTop / el.clientHeight);
      if (idx !== CENTER) {
        const delta = idx - CENTER;
        isRebalancing.current = true;
        setCenterOffset((prev) => prev + delta);
      }
    }, 150);
  }, []);

  function handleDayClick(date: string) {
    setSelectedDate(date);
    onSelectedDateChange?.(date);
  }

  function jumpToToday() {
    setSelectedDate(today);
    onSelectedDateChange?.(today);
    isRebalancing.current = true;
    setCenterOffset(0);
  }

  // Is current center the "today" month?
  const centerMonth = months[CENTER];
  const todayMonth =
    new Date().getFullYear() === centerMonth?.year &&
    new Date().getMonth() + 1 === centerMonth?.month;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100svh-var(--app-header-h)-72px)] lg:h-[calc(100svh-1.5rem)]">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {months.map((m) => (
          <div
            key={m.key}
            className="h-full"
            style={{ scrollSnapAlign: "start" }}
          >
            <MonthGrid
              year={m.year}
              month={m.month}
              byDate={byDate}
              onDayClick={handleDayClick}
              selectedDate={selectedDate}
            />
          </div>
        ))}
      </div>

      {/* Floating "오늘" button — visible when not on today's month */}
      {!todayMonth ? (
        <button
          type="button"
          onClick={jumpToToday}
          className="absolute bottom-4 right-4 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-lg transition hover:bg-zinc-800 lg:bottom-6 lg:right-6 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          오늘
        </button>
      ) : null}
    </div>
  );
}
