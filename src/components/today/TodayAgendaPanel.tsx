import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FileText, BookOpen, CheckSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../common/Button";
import { useMeetings } from "../../hooks/useMeetings";
import { useTasks } from "../../hooks/useTasks";
import { useSchedule } from "../../hooks/useSchedule";
import { useJournals } from "../../hooks/useJournals";
import type { Task } from "../../api/tasks";
import type { ScheduleEvent } from "../../api/schedule";
import type { Meeting } from "../../api/meetings";
import {
  todayIso,
  isoDateRange,
  formatDisplayDate,
  isToday,
  weekdayShort,
} from "../../lib/dates";

// 날짜 거터 = 일정 시각 컬럼과 같은 고정 폭. 날짜("18 목")와 시각("09:00")이 한
// 좌측 축으로 정렬되도록 둘 다 이 폭 + 왼쪽 정렬 + tabular-nums 로 통일.
const GUTTER = "w-12";

// "YYYY-MM-DD" → "6월" (연도는 사이드바 헤더가 표시).
function monthLabel(iso: string): string {
  return `${parseInt(iso.slice(5, 7), 10)}월`;
}

// "오늘" 탭 사이드바 — 폐기된 캘린더 탭의 "날짜 훑기" + "일기 진입" 역할을 흡수한
// 세로 날짜 리스트. 한 번에 1년(1.1~12.31)을 빈 날 포함 전부 나열하고, 헤더의
// [<][오늘][>] 로 이전/다음 해 이동·올해 복귀. 올해 창에선 오늘로 자동 스크롤.
// 메인 대시보드(오늘)는 오늘 고정이라, 다른 날 훑기·과거 일기는 이 사이드바가 전담.
//
// 표시 정책 (사용자 결정): 사이드바는 "일정 훑기" 가 본분 — 일정(schedule)만 풀
// 행(시각+제목, 클릭=열기)으로 보이고, 할 일·노트·일기는 날짜 헤더 우측에
// 아이콘+숫자 배지로만 (그 날 뭐가 있는지 신호만, 클릭=그날 일기). 자세한 할 일·
// 노트는 "오늘" 메인 대시보드 / 할일·메모장 탭이 전담.
type Props = {
  // 날짜 헤더·일정 행 클릭 — 그 날 상세 모달 (일정·일기·노트). App 이 소유.
  onOpenDay: (date: string) => void;
};

type DayGroup = {
  date: string;
  events: ScheduleEvent[]; // schedule.md 이벤트
  tasks: Task[]; // 미완료 할 일 (배지 카운트용)
  notes: Meeting[];
  hasJournal: boolean;
};

function byTime(a: string | null, b: string | null): number {
  const ta = a ?? "";
  const tb = b ?? "";
  if (ta === tb) return 0;
  if (!ta) return -1;
  if (!tb) return 1;
  return ta < tb ? -1 : 1;
}

export function TodayAgendaPanel({ onOpenDay }: Props) {
  const meetingsQ = useMeetings();
  const tasksQ = useTasks();
  const scheduleQ = useSchedule();
  const journalsQ = useJournals();
  const today = todayIso();
  const currentYear = Number(today.slice(0, 4));
  // 현재 보고 있는 해. [<]/[>] 로 ±1, [오늘] 로 올해 복귀.
  const [viewYear, setViewYear] = useState(currentYear);

  const groups = useMemo<DayGroup[]>(() => {
    const from = `${viewYear}-01-01`;
    const to = `${viewYear}-12-31`;
    const map = new Map<string, DayGroup>();
    // 빈 날 포함 — 모든 날짜를 미리 만들어 둠 (날짜 헤더 클릭으로 어떤 날이든 일기 작성).
    for (const d of isoDateRange(from, to)) {
      map.set(d, { date: d, events: [], tasks: [], notes: [], hasJournal: false });
    }
    const inRange = (d: string | null): d is string =>
      d != null && d >= from && d <= to;

    for (const t of tasksQ.data ?? []) {
      if (t.deleted || t.cancelled || t.done) continue;
      if (!inRange(t.due_date)) continue;
      map.get(t.due_date)!.tasks.push(t);
    }
    for (const e of scheduleQ.data ?? []) {
      // 다일 일정은 시작일에 한 줄 (기존 동작 유지).
      if (inRange(e.start)) map.get(e.start)!.events.push(e);
    }
    for (const m of meetingsQ.data ?? []) {
      if (inRange(m.date)) map.get(m.date!)!.notes.push(m);
    }
    for (const j of journalsQ.data ?? []) {
      if (inRange(j.date)) map.get(j.date)!.hasJournal = true;
    }

    for (const g of map.values()) {
      g.events.sort(
        (a, b) => byTime(a.time, b.time) || (a.text < b.text ? -1 : 1),
      );
      g.tasks.sort((a, b) => byTime(a.due_time, b.due_time));
      g.notes.sort((a, b) => {
        const ta = a.time ?? "";
        const tb = b.time ?? "";
        if (ta !== tb) return ta < tb ? -1 : 1;
        return a.created_at < b.created_at ? -1 : 1;
      });
    }
    return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [meetingsQ.data, tasksQ.data, scheduleQ.data, journalsQ.data, viewYear]);

  // 월 단위 섹션으로 묶음 — sticky 월 헤더가 그 달 내내 상단에 붙어 있으려면 그 달의
  // 모든 날이 한 부모(섹션) 안에 있어야 함. (sticky 는 부모 박스 안에서만 유지.)
  const months = useMemo(() => {
    const out: Array<{ key: string; label: string; days: DayGroup[] }> = [];
    for (const g of groups) {
      const key = g.date.slice(0, 7);
      let cur = out[out.length - 1];
      if (!cur || cur.key !== key) {
        cur = {
          key,
          // 연도는 헤더가 보여주므로 월 라벨은 "6월" 만.
          label: monthLabel(g.date),
          days: [],
        };
        out.push(cur);
      }
      cur.days.push(g);
    }
    return out;
  }, [groups]);

  // 스크롤 위치 설정 — 올해 창이면 오늘 행으로, 다른 해면 맨 위(1월)로.
  // getBoundingClientRect 차이로 컨테이너 scrollTop 만 조정 (offsetParent 무관).
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const positionScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const el = todayRef.current;
    if (viewYear === currentYear && el) {
      // sticky 월 헤더(~28px) 만큼 덜 스크롤 → 오늘이 헤더 바로 아래 보이도록.
      const STICKY_OFFSET = 28;
      container.scrollTop +=
        el.getBoundingClientRect().top -
        container.getBoundingClientRect().top -
        STICKY_OFFSET;
    } else {
      container.scrollTop = 0;
    }
  }, [viewYear, currentYear]);

  // 연도가 바뀌면(또는 첫 마운트) 위치 재설정. 데이터(months)가 늦게 도착해 행 높이가
  // 바뀌면 그 해 1회만 보정 (positionedYearRef) — 이후 데이터 갱신엔 스크롤 안 건드림.
  const positionedYearRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    positionedYearRef.current = null;
    positionScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear]);
  useEffect(() => {
    if (positionedYearRef.current === viewYear) return;
    positionedYearRef.current = viewYear;
    positionScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months]);

  // [오늘] — 올해 창이면 오늘로 스크롤, 다른 해면 올해로 전환(효과가 오늘로 스크롤).
  const goToday = () => {
    if (viewYear === currentYear) positionScroll();
    else setViewYear(currentYear);
  };

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex shrink-0 items-center justify-between gap-1 px-4"
        style={{
          height: "var(--page-header-h)",
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        <h2
          className="font-serif text-sm font-medium tabular-nums"
          style={{ color: "var(--text-primary)" }}
        >
          {viewYear}년
        </h2>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="icon"
            onClick={() => setViewYear((y) => y - 1)}
            title="이전 해"
            aria-label="이전 해"
            style={{ color: "var(--text-secondary)" }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToday}
            title="오늘로"
            aria-label="오늘로"
            style={{ color: "var(--text-secondary)" }}
          >
            오늘
          </Button>
          <Button
            variant="icon"
            onClick={() => setViewYear((y) => y + 1)}
            title="다음 해"
            aria-label="다음 해"
            style={{ color: "var(--text-secondary)" }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* pt 제거: 위쪽 패딩이 있으면 WebKit 에서 sticky 월 헤더가 패딩 아래에 붙어
          그 틈으로 뒤 리스트가 비침. 헤더가 최상단에 딱 붙도록 top padding 0. */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto pb-1">
        {months.map((mo) => (
          <div key={mo.key}>
            {/* sticky 월 헤더 — 스크롤 시 상단 고정, 다음 달이 올라오면 밀려남.
                사이드바 bg 보다 한 단계 진한 밴드(--bg-surface-active)로 구분 강조. */}
            <div
              className="sticky top-0 z-10 px-3 pb-1 pt-1.5 text-[12px] font-semibold"
              style={{
                color: "var(--text-secondary)",
                backgroundColor: "var(--bg-surface-active)",
                borderBottom: "1px solid var(--border-default)",
              }}
            >
              {mo.label}
            </div>
            {mo.days.map((g) => {
              const isTodayRow = isToday(g.date);
              // 텅 빈 날(일정·할일·노트·일기 모두 0)이면 날짜만 흐리게.
              const anyContent =
                g.events.length + g.tasks.length + g.notes.length > 0 ||
                g.hasJournal;
              return (
                <div
                  key={g.date}
                  ref={isTodayRow ? todayRef : undefined}
                  className="mb-0.5"
                >
                  {/* 날짜 헤더 — 클릭 시 그날 일기. 날짜("일 요일")는 일정 시각과 같은
                      좌측 거터에 정렬. 오늘은 accent 색으로 강조. 우측에 할일·노트·일기
                      요약 배지 (개수만, 클릭은 헤더와 동일 = 일기). */}
                  <button
                    type="button"
                    onClick={() => onOpenDay(g.date)}
                    title="날짜 상세 (일정·일기·노트)"
                    aria-label={`${formatDisplayDate(g.date)} 상세`}
                    className="group flex w-full items-center gap-1.5 px-2 py-1 text-left text-[13px] transition hover:bg-[var(--bg-surface-hover)]"
                  >
                    <span
                      className={`${GUTTER} shrink-0 tabular-nums ${anyContent ? "" : "opacity-60"}`}
                    >
                      <span
                        className="font-semibold"
                        style={{
                          color: isTodayRow
                            ? "var(--accent-red)"
                            : "var(--text-primary)",
                        }}
                      >
                        {Number(g.date.slice(8, 10))}
                      </span>
                      <span
                        className="ml-0.5"
                        style={{
                          color: isTodayRow
                            ? "var(--accent-red)"
                            : "var(--text-muted)",
                        }}
                      >
                        {weekdayShort(g.date)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {g.tasks.length > 0 ? (
                        <CountBadge
                          icon={<CheckSquare className="h-3 w-3" />}
                          count={g.tasks.length}
                          label="할 일"
                        />
                      ) : null}
                      {g.notes.length > 0 ? (
                        <CountBadge
                          icon={<FileText className="h-3 w-3" />}
                          count={g.notes.length}
                          label="노트"
                        />
                      ) : null}
                      {g.hasJournal ? (
                        <BookOpen
                          className="h-3 w-3"
                          style={{ color: "var(--text-muted)" }}
                          aria-label="일기 있음"
                        />
                      ) : null}
                    </span>
                  </button>

                  {/* 본문 = 일정만 풀 행. 할일·노트·일기는 위 배지로 갈음. */}
                  {g.events.length > 0 ? (
                    <div>
                      {g.events.map((e) => (
                        <AgendaRow
                          key={`e:${e.id}`}
                          onClick={() => onOpenDay(g.date)}
                        >
                          <span
                            className={`${GUTTER} shrink-0 text-[11px] tabular-nums`}
                            style={{ color: "var(--text-muted)" }}
                          >
                            {e.time ?? "종일"}
                          </span>
                          <span
                            className="min-w-0 flex-1 truncate"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {e.text}
                          </span>
                        </AgendaRow>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function AgendaRow({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[13px] transition hover:bg-[var(--bg-surface-hover)]"
    >
      {children}
    </div>
  );
}

// 날짜 헤더 우측 요약 배지 — 아이콘 + 개수. 할 일/노트가 그 날 몇 건인지 신호만
// (개별 행은 안 그림). muted 톤으로 일정 행보다 약하게.
function CountBadge({
  icon,
  count,
  label,
}: {
  icon: React.ReactNode;
  count: number;
  label: string;
}) {
  return (
    <span
      className="flex items-center gap-0.5 text-[11px] tabular-nums"
      style={{ color: "var(--text-muted)" }}
      aria-label={`${label} ${count}건`}
    >
      {icon}
      {count}
    </span>
  );
}
