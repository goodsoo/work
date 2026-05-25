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
import { Button } from "../components/common/Button";
import { Text } from "../components/common/Text";
import { useMeetings } from "../hooks/useMeetings";
import { useJournals } from "../hooks/useJournals";
import { useTodos } from "../hooks/useTodos";
import { todayIso } from "../lib/dates";
import { TODO_CATEGORIES } from "../api/todos";
import { categoryColor } from "../lib/todoCategory";
import {
  MonthGrid,
  WEEKDAYS,
  type DayItems,
} from "../components/timeline/MonthGrid";

type Props = {
  targetDate?: string | null;
  onSelectedDateChange?: (date: string) => void;
};

// 연속 스크롤 버퍼: 21주 (약 5개월). 가장자리 근접 시 rebalance.
// 49주에서 21주로 축소 — DOM 셀 343 → 147 (57% 감소). edge 근접 rebalance 가
// 더 자주 발생하지만 handleScroll 안 RAF 시점에 자연스럽게 처리되어 체감 동일.
const WEEK_BUFFER = 21;
const WEEK_CENTER = Math.floor(WEEK_BUFFER / 2); // 10
const REBALANCE_EDGE = 4;
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

// 모듈 레벨 cache: 페이지 전환으로 CalendarPage 가 unmount/remount 되어도 스크롤 위치
// 유지. 메모장 SCROLL_CACHE 패턴 차용. 새로고침 시 reset.
// `anchorIso` 는 캐시가 anchor (오늘 주의 일요일) 가 동일한 세션 안에서만 유효함을
// 보장. 자정을 넘기면 anchor 가 바뀌므로 cache 폐기 (그땐 오늘 기준으로 다시 위치 잡기가 자연스러움).
type CalendarStateCache = {
  anchorIso: string;
  centerWeekOffset: number;
  visibleWeekOffset: number;
  scrollTop: number;
  selectedDate: string;
  lastTarget: string | null;
};
let calendarStateCache: CalendarStateCache | null = null;

export function CalendarPage({ targetDate, onSelectedDateChange }: Props) {
  const meetingsQ = useMeetings();
  const journalsQ = useJournals();
  const todosQ = useTodos();

  const today = todayIso();
  // anchor: 오늘 주의 일요일. 마운트 이후 변경 X.
  const [anchorWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 }),
  );
  const anchorIso = useMemo(() => todayIso(anchorWeekStart), [anchorWeekStart]);
  // 캐시 valid 여부 — anchor 가 동일할 때만 사용 (자정 넘기면 폐기).
  const cachedInitial = useMemo<CalendarStateCache | null>(() => {
    if (!calendarStateCache) return null;
    if (calendarStateCache.anchorIso !== anchorIso) return null;
    return calendarStateCache;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // minCenterOffset: centerWeekOffset 의 하한. 버퍼가 2026년 이전으로 안 빠지게.
  const minCenterOffset = useMemo(
    () => computeMinCenterOffset(anchorWeekStart),
    [anchorWeekStart],
  );
  // centerWeekOffset: 버퍼 중심이 anchor 로부터 몇 주 떨어져 있는지. cache 있으면 거기서 복원
  // (anchor 동일 보장), 없으면 minCenter 클램프. 자정 넘긴 케이스도 cachedInitial=null 이라 안전.
  const [centerWeekOffset, setCenterWeekOffset] = useState(() => {
    const min = computeMinCenterOffset(anchorWeekStart);
    if (cachedInitial) return Math.max(min, cachedInitial.centerWeekOffset);
    return Math.max(0, min);
  });
  // visibleWeekOffset: 현재 viewport 최상단의 주가 anchor 로부터 몇 주.
  const [visibleWeekOffset, setVisibleWeekOffset] = useState(
    () => cachedInitial?.visibleWeekOffset ?? 0,
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    () => cachedInitial?.selectedDate ?? today,
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const rowHeightRef = useRef<number>(140);
  // rebalance 진행 중일 때 scroll을 복원할 target px. null 이면 idle.
  const rebalanceTargetRef = useRef<number | null>(null);
  const initialScrollDone = useRef(false);
  // cache 가 있으면 그 scrollTop 으로 초기 복원. 첫 layout effect 에서 한 번만 소비.
  const initialScrollTopRef = useRef<number | null>(
    cachedInitial?.scrollTop ?? null,
  );
  // 최신 scrollTop — onScroll 마다 갱신. unmount 시 cache 저장에 사용 (cleanup 시점에
  // containerRef.current 가 null 일 수 있어 안전한 ref 복사).
  const scrollTopRef = useRef<number>(cachedInitial?.scrollTop ?? 0);

  const isLoading =
    meetingsQ.isLoading ||
    journalsQ.isLoading ||
    todosQ.isLoading;

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
        items = { meetings: [], todos: [], journal: null };
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
      items.meetings.sort((a, b) => {
        const ta = a.time ?? "";
        const tb = b.time ?? "";
        if (ta !== tb) return ta < tb ? -1 : 1;
        return a.created_at < b.created_at ? -1 : 1;
      });
      // 시간 없는 todo 가 앞 (할일 탭과 동일), 시간 있는 것은 시간순 뒤로.
      items.todos.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        const ta = a.due_time ?? "";
        const tb = b.due_time ?? "";
        if (ta !== tb) {
          if (!ta) return -1;
          if (!tb) return 1;
          return ta < tb ? -1 : 1;
        }
        return a.created_at < b.created_at ? -1 : 1;
      });
    }
    return map;
  }, [meetingsQ.data, journalsQ.data, todosQ.data]);

  // External target date (from side panel). cache 가 있으면 같은 값을 복원 — page
  // 전환 후 돌아왔을 때 같은 targetDate 가 들어와도 "외부 트리거" 로 오인해서 스크롤이
  // 재설정되지 않도록.
  const [lastTarget, setLastTarget] = useState<string | null>(
    () => cachedInitial?.lastTarget ?? null,
  );
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
      // 의도: external target 진입 시 즉시 scroll 위치 기록 후 layout 직후 effect 가 사용.
      // eslint-disable-next-line react-hooks/refs
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
  // Initial: cache 가 있으면 그 scrollTop, 없으면 오늘을 viewport top 으로
  // (오늘 offset=0, idx_today = WEEK_CENTER - centerOff).
  // useLayoutEffect 자체가 paint 직전 sync 단계라 RAF 한 frame 미루지 않고
  // 직접 set → "scrollTop=0 으로 한 번 paint 됐다 점프" jitter 0.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !el.clientHeight) return;
    if (!initialScrollDone.current || rebalanceTargetRef.current !== null) {
      rowHeightRef.current = measureRowHeight();
      const rh = rowHeightRef.current;
      const initialTarget =
        initialScrollTopRef.current ?? (WEEK_CENTER - centerWeekOffset) * rh;
      const target = rebalanceTargetRef.current ?? initialTarget;
      el.scrollTop = target;
      scrollTopRef.current = target;
      rebalanceTargetRef.current = null;
      initialScrollTopRef.current = null;
      initialScrollDone.current = true;
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

  // Latest state ref — unmount cleanup 시점에 동기 closure 의 stale 값 대신 사용.
  const latestStateRef = useRef({
    centerWeekOffset,
    visibleWeekOffset,
    selectedDate,
    lastTarget,
    anchorIso,
  });
  useEffect(() => {
    latestStateRef.current = {
      centerWeekOffset,
      visibleWeekOffset,
      selectedDate,
      lastTarget,
      anchorIso,
    };
  }, [centerWeekOffset, visibleWeekOffset, selectedDate, lastTarget, anchorIso]);

  // Unmount 시 cache 저장 — 페이지 전환 후 돌아왔을 때 복원용. 새로고침 시 모듈
  // 재import 되며 cache 비워짐.
  useEffect(() => {
    return () => {
      calendarStateCache = {
        ...latestStateRef.current,
        scrollTop: scrollTopRef.current,
      };
    };
  }, []);

  // Scroll handler — visible week 갱신 + edge 근접 시 rebalance.
  // round 사용해서 subpixel 으로 인한 off-by-one 방지 (snap 됐는데 헤더가 한 주 이전으로 잡히는 버그).
  // 클램프: newCenter 가 minCenter 보다 작아질 수 없음 (2026 이전 차단).
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    const rh = rowHeightRef.current;
    if (!el || !rh) return;
    scrollTopRef.current = el.scrollTop;
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
            height: "var(--page-header-h)",
            gridTemplateColumns:
              "minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr)",
            backgroundColor: "var(--bg-overlay)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          {/* 좌측 — 카테고리 색 범례. 셀 chip 의 bg tint 가 어떤 카테고리인지 명시.
              compact swatch + 한글 라벨 가로 정렬. 미분류는 회색(--text-muted) 으로
              chip 의 fallback tint 와 동일. */}
          <div className="justify-self-start flex items-center gap-2.5">
            {[
              ...TODO_CATEGORIES.map((c) => ({
                key: c.id,
                label: c.label,
                color: categoryColor(c.id),
              })),
              { key: "uncategorized", label: "미분류", color: "var(--text-muted)" },
            ].map((c) => (
              <span
                key={c.key}
                className="inline-flex items-center gap-1 text-[11px]"
                style={{ color: "var(--text-secondary)" }}
              >
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${c.color} 18%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${c.color} 40%, transparent)`,
                  }}
                />
                {c.label}
              </span>
            ))}
          </div>
          <Text
            variant="h4"
            as="h3"
            className="justify-self-center"
          >
            {currentMonthYM.year}년 {currentMonthYM.month}월
          </Text>
          <div className="justify-self-end flex items-center gap-2">
            <div
              className="inline-flex overflow-hidden rounded-md"
              style={{ border: "1px solid var(--border-subtle)" }}
            >
            <Button
              variant="ghost"
              onClick={() => jumpToMonth(-1)}
              title="이전 달"
              aria-label="이전 달"
              className="rounded-none px-1.5 py-1"
              style={{ color: "var(--text-secondary)" }}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={jumpToToday}
              title="오늘"
              className="rounded-none px-2 py-1"
              style={{
                color: "var(--text-secondary)",
                borderLeft: "1px solid var(--border-subtle)",
              }}
            >
              오늘
            </Button>
            <Button
              variant="ghost"
              onClick={() => jumpToMonth(1)}
              title="다음 달"
              aria-label="다음 달"
              className="rounded-none px-1.5 py-1"
              style={{
                color: "var(--text-secondary)",
                borderLeft: "1px solid var(--border-subtle)",
              }}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-7">
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
