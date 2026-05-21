import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { addDays, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMeetings } from "../hooks/useMeetings";
import { useJournals } from "../hooks/useJournals";
import { useTodos } from "../hooks/useTodos";
import { useSchedules } from "../hooks/useSchedules";
import { todayIso } from "../lib/dates";
import {
  MonthGrid,
  WEEKDAYS,
  type DayItems,
} from "../components/timeline/MonthGrid";

type Props = {
  targetDate?: string | null;
  onSelectedDateChange?: (date: string) => void;
};

// 연속 스크롤 버퍼: 49주 (약 11개월). 가장자리 근접 시 rebalance.
const WEEK_BUFFER = 49;
const WEEK_CENTER = Math.floor(WEEK_BUFFER / 2); // 24
const REBALANCE_EDGE = 8;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// 2026년 이전은 표시하지 않음. 버퍼 first week가 startOfWeek(2026-01-01) 보다 앞으로
// 못 나가도록 centerWeekOffset 의 하한 (minCenterOffset) 을 잡음.
const MIN_DATE = new Date(2026, 0, 1);

function computeMinCenterOffset(anchor: Date): number {
  const minWS = startOfWeek(MIN_DATE, { weekStartsOn: 0 });
  const minWeekOffset = Math.round(
    (minWS.getTime() - anchor.getTime()) / WEEK_MS,
  );
  return minWeekOffset + WEEK_CENTER;
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
  // anchor: 오늘 주의 일요일. 마운트 이후 변경 X.
  const [anchorWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 }),
  );
  // minCenterOffset: centerWeekOffset 의 하한. 버퍼가 2026년 이전으로 안 빠지게.
  const minCenterOffset = useMemo(
    () => computeMinCenterOffset(anchorWeekStart),
    [anchorWeekStart],
  );
  // centerWeekOffset: 버퍼 중심이 anchor 로부터 몇 주 떨어져 있는지. 초기 0 인데
  // minCenter > 0 (= 아직 2026년 초반 사용 중) 이면 클램프됨 → 오늘은 idx=WEEK_CENTER 가 아닌
  // (WEEK_CENTER - minCenter) 에 위치.
  const [centerWeekOffset, setCenterWeekOffset] = useState(() =>
    Math.max(0, computeMinCenterOffset(anchorWeekStart)),
  );
  // visibleWeekOffset: 현재 viewport 최상단의 주가 anchor 로부터 몇 주.
  const [visibleWeekOffset, setVisibleWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const containerRef = useRef<HTMLDivElement>(null);
  const rowHeightRef = useRef<number>(140);
  // rebalance 진행 중일 때 scroll을 복원할 target px. null 이면 idle.
  const rebalanceTargetRef = useRef<number | null>(null);
  const initialScrollDone = useRef(false);

  const isLoading =
    meetingsQ.isLoading ||
    journalsQ.isLoading ||
    todosQ.isLoading ||
    schedulesQ.isLoading;

  // 버퍼 주 목록 (각 주의 일요일)
  const weeks = useMemo(() => {
    const result: Date[] = [];
    for (let i = -WEEK_CENTER; i <= WEEK_CENTER; i++) {
      result.push(addDays(anchorWeekStart, (centerWeekOffset + i) * 7));
    }
    return result;
  }, [anchorWeekStart, centerWeekOffset]);

  // byDate map
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

  // External target date (from side panel)
  const [lastTarget, setLastTarget] = useState<string | null>(null);
  if (targetDate && targetDate !== lastTarget) {
    setLastTarget(targetDate);
    setSelectedDate(targetDate);
    const target = new Date(targetDate + "T00:00:00");
    const targetWeekStart = startOfWeek(target, { weekStartsOn: 0 });
    const diffWeeks = Math.round(
      (targetWeekStart.getTime() - anchorWeekStart.getTime()) / WEEK_MS,
    );
    const targetCenter = Math.max(minCenterOffset, diffWeeks);
    if (targetCenter !== centerWeekOffset) {
      // diffWeeks 가 minCenter 보다 작아 클램프되었으면 idx 도 조정 (그 주가 버퍼의 어느 인덱스에 있는지).
      const idxTarget = diffWeeks - targetCenter + WEEK_CENTER;
      rebalanceTargetRef.current = idxTarget * rowHeightRef.current;
      setCenterWeekOffset(targetCenter);
    }
  }

  // 행 높이 측정 (subpixel 정확도 위해 getBoundingClientRect 사용)
  function measureRowHeight(): number {
    const el = containerRef.current;
    const grid = el?.firstElementChild as HTMLElement | null;
    const firstCell = grid?.firstElementChild as HTMLElement | null;
    if (!firstCell) return rowHeightRef.current;
    const h = firstCell.getBoundingClientRect().height;
    return h > 0 ? h : rowHeightRef.current;
  }

  // Initial 또는 rebalance 시 scroll 위치 복원.
  // Initial: 오늘을 viewport top 으로. 오늘 offset=0, idx_today = WEEK_CENTER - centerOff.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!initialScrollDone.current || rebalanceTargetRef.current !== null) {
      requestAnimationFrame(() => {
        const e = containerRef.current;
        if (!e || !e.clientHeight) return;
        rowHeightRef.current = measureRowHeight();
        const rh = rowHeightRef.current;
        const initialTarget = (WEEK_CENTER - centerWeekOffset) * rh;
        const target = rebalanceTargetRef.current ?? initialTarget;
        e.scrollTop = target;
        rebalanceTargetRef.current = null;
        initialScrollDone.current = true;
      });
    }
  }, [centerWeekOffset, isLoading]);

  // 윈도우 리사이즈 시 행 높이 재측정
  useEffect(() => {
    function onResize() {
      rowHeightRef.current = measureRowHeight();
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Scroll handler — visible week 갱신 + edge 근접 시 rebalance.
  // round 사용해서 subpixel 으로 인한 off-by-one 방지 (snap 됐는데 헤더가 한 주 이전으로 잡히는 버그).
  // 클램프: newCenter 가 minCenter 보다 작아질 수 없음 (2026 이전 차단).
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    const rh = rowHeightRef.current;
    if (!el || !rh) return;
    const idx = Math.round(el.scrollTop / rh);
    setVisibleWeekOffset(centerWeekOffset + (idx - WEEK_CENTER));

    if (rebalanceTargetRef.current !== null) return;
    if (idx < REBALANCE_EDGE || idx > WEEK_BUFFER - 1 - REBALANCE_EDGE) {
      const delta = idx - WEEK_CENTER;
      const newCenter = Math.max(minCenterOffset, centerWeekOffset + delta);
      if (newCenter === centerWeekOffset) return; // 더 이상 못 미는 경우 (이미 minCenter)
      const appliedDelta = newCenter - centerWeekOffset;
      const newIdx = idx - appliedDelta;
      const remainder = el.scrollTop - idx * rh;
      rebalanceTargetRef.current = newIdx * rh + remainder;
      setCenterWeekOffset(newCenter);
    }
  }, [centerWeekOffset, minCenterOffset]);

  // 헤더 라벨용 — 보이는 top row의 토요일(마지막 날) month 기준.
  // "1일 진입" semantic: 새 달 1일이 행에 들어오면 토요일이 새 달이 되므로 헤더가 즉시 전환.
  const currentMonthYM = useMemo(() => {
    const w = addDays(anchorWeekStart, visibleWeekOffset * 7 + 6);
    return { year: w.getFullYear(), month: w.getMonth() + 1 };
  }, [anchorWeekStart, visibleWeekOffset]);

  const todayWeekOffset = useMemo(() => {
    const todayWS = startOfWeek(new Date(), { weekStartsOn: 0 });
    return Math.round(
      (todayWS.getTime() - anchorWeekStart.getTime()) / WEEK_MS,
    );
  }, [anchorWeekStart]);

  function handleDayClick(date: string) {
    setSelectedDate(date);
    // lastTarget 도 같이 갱신 → targetDate prop round-trip (App.calendarDate → 다시 targetDate)
    // 이 다음 render에서 rebalance/scroll 을 트리거 못 하게 pre-empt.
    setLastTarget(date);
    onSelectedDateChange?.(date);
  }

  // off = target 주가 anchor 로부터 몇 주. 화살표/오늘 버튼은 instant jump.
  // visibleWeekOffset 을 즉시 set 해서 month label 동기화 — onScroll 마지막 frame 누락
  // 또는 stale closure 로 라벨이 안 바뀌던 race 차단.
  function jumpToWeekOffset(off: number) {
    const el = containerRef.current;
    const rh = rowHeightRef.current;
    if (!el || !rh) return;
    const targetCenter = Math.max(minCenterOffset, off);
    const idx = off - targetCenter + WEEK_CENTER;
    const targetTop = idx * rh;
    setVisibleWeekOffset(off);
    if (targetCenter === centerWeekOffset) {
      el.scrollTop = targetTop;
    } else {
      rebalanceTargetRef.current = targetTop;
      setCenterWeekOffset(targetCenter);
    }
  }

  function jumpToToday() {
    setSelectedDate(today);
    setLastTarget(today);
    onSelectedDateChange?.(today);
    jumpToWeekOffset(todayWeekOffset);
  }

  function jumpToMonth(delta: number) {
    const target = new Date(
      currentMonthYM.year,
      currentMonthYM.month - 1 + delta,
      1,
    );
    const targetWS = startOfWeek(target, { weekStartsOn: 0 });
    const targetOffset = Math.round(
      (targetWS.getTime() - anchorWeekStart.getTime()) / WEEK_MS,
    );
    jumpToWeekOffset(targetOffset);
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2"
          style={{
            borderColor: "var(--border-default)",
            borderTopColor: "var(--text-secondary)",
          }}
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-[calc(100svh-var(--app-header-h)-72px)] flex-col lg:h-[calc(100svh-1.5rem)]">
      {/* Sticky 헤더: 월 라벨 + 요일 row */}
      <div
        className="shrink-0"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        {/* 년월 헤더 — 메모장 헤더와 동일 spec (3.5rem, text-base, bg-overlay, backdrop-blur).
            grid 3-col 로 nav 가 늘어나도 제목은 viewport-center 유지. */}
        <div
          className="grid items-center gap-2 px-3 backdrop-blur lg:px-5"
          style={{
            height: "3.5rem",
            gridTemplateColumns:
              "minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr)",
            backgroundColor: "var(--bg-overlay)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div />
          <h3
            className="justify-self-center text-base font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {currentMonthYM.year}년 {currentMonthYM.month}월
          </h3>
          <div className="justify-self-end flex items-center gap-2">
            <div
              className="inline-flex overflow-hidden rounded-md"
              style={{ border: "1px solid var(--border-subtle)" }}
            >
            <button
              type="button"
              onClick={() => jumpToMonth(-1)}
              title="이전 달"
              aria-label="이전 달"
              className="px-1.5 py-1 transition"
              style={{ color: "var(--text-secondary)", minHeight: 0 }}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={jumpToToday}
              title="오늘"
              className="px-2 py-1 text-xs font-medium transition"
              style={{
                color: "var(--text-secondary)",
                borderLeft: "1px solid var(--border-subtle)",
                minHeight: 0,
              }}
            >
              오늘
            </button>
            <button
              type="button"
              onClick={() => jumpToMonth(1)}
              title="다음 달"
              aria-label="다음 달"
              className="px-1.5 py-1 transition"
              style={{
                color: "var(--text-secondary)",
                borderLeft: "1px solid var(--border-subtle)",
                minHeight: 0,
              }}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-7 px-3 lg:px-5">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={`py-1 text-center text-[11px] font-medium ${
                i === 0 ? "text-red-500" : ""
              }`}
              style={i === 0 ? undefined : { color: "var(--text-secondary)" }}
            >
              {w}
            </div>
          ))}
        </div>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ scrollSnapType: "y proximity" }}
      >
        <MonthGrid
          weeks={weeks}
          byDate={byDate}
          onDayClick={handleDayClick}
          selectedDate={selectedDate}
          currentYear={currentMonthYM.year}
          currentMonth={currentMonthYM.month}
        />
      </div>
    </div>
  );
}
