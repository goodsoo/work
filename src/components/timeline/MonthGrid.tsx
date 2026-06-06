import { useMemo } from "react";
import { addDays } from "date-fns";
import { BookOpen, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { todayIso, isToday } from "../../lib/dates";
import { categoryColor } from "../../lib/taskCategory";
import {
  computeWeekSegments,
  type MultiDayEvent,
  type WeekSegment,
} from "../../lib/calendar/spans";
import { Button } from "../common/Button";
import { Text } from "../common/Text";
import type { Meeting } from "../../api/meetings";
import type { Journal } from "../../api/journals";
import type { Task, TaskCategory } from "../../api/tasks";

// 셀/오버레이 행 높이 — 두 그리드(day cell + span overlay)가 동일해야 정확히 겹친다.
const GRID_AUTO_ROWS = "clamp(100px, 18svh, 180px)";
// 셀 안 task chip 이 시작하는 y: paddingTop(2) + 날짜 row(h-5=20) + Button base gap-1.5(6)
// + chip 컨테이너 mt-0.5(2) = 30px. 셀 Button 이 flex-col 이라 base className 의 gap-1.5 가
// 날짜 row 와 chip 컨테이너 사이에 6px 간격으로 들어간다 — 이걸 빼먹으면 스팬 바가 단일
// chip 보다 6px 위로 떠 어긋난다. 스팬 바를 같은 줄에 맞춰 chip 과 연속돼 보이게.
// 레인당 높이 = chip 높이(16) + 간격(1).
const SPAN_TOP_OFFSET = 30;
const SPAN_LANE_HEIGHT = 17;
// 셀 좌우 padding(4px) — 바를 chip 과 같은 안쪽 들여쓰기에 맞춤.
const CELL_PAD = 4;

// 셀 chip 시간 표시 — 가능한 짧게.
// - 정각 (mm=00) → "h시" / "H시"
// - h < 10 + mm 있음 → "h:mm" (한 자리 시간)
// - 그 외 → "HH:mm" 그대로
function formatChipTime(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return time;
  if (m === 0) return `${h}시`;
  if (h < 10) return `${h}:${mStr.padStart(2, "0")}`;
  return time;
}

export type DayItems = {
  meetings: Meeting[];
  tasks: Task[];
  journal: Journal | null;
};

// CalendarPage / WeekRow 등에서 공유. 컴포넌트와 같은 파일에서 export.
// eslint-disable-next-line react-refresh/only-export-components
export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type CellEvent = {
  key: string;
  label: string;
  time?: string;
  done?: boolean;
  category?: TaskCategory | null;
};

const MAX_CELL_EVENTS = 3;

type Props = {
  weeks: Date[]; // 각 주의 일요일 (week start)
  byDate: Map<string, DayItems>;
  // 다일 일정(가로 스팬 바). 단일 일정은 byDate 의 chip 경로로 그려진다.
  multiDayEvents?: MultiDayEvent[];
  onDayClick: (date: string) => void;
  selectedDate?: string | null;
  currentYear: number;
  currentMonth: number;
};

export function MonthGrid({
  weeks,
  byDate,
  multiDayEvents,
  onDayClick,
  selectedDate,
  currentYear,
  currentMonth,
}: Props) {
  // 주별 스팬 세그먼트 — weeks 인덱스 = overlay 그리드의 row.
  const segmentsByWeek = useMemo(() => {
    const events = multiDayEvents ?? [];
    if (events.length === 0) return weeks.map(() => []);
    return weeks.map((ws) => computeWeekSegments(todayIso(ws), events));
  }, [weeks, multiDayEvents]);
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

  const hasSpans = segmentsByWeek.some((segs) => segs.length > 0);

  return (
    <div
      className="grid grid-cols-7"
      style={{ gridAutoRows: GRID_AUTO_ROWS, position: "relative" }}
    >
      {cells.map(({ date, dayNum, year, month, weekday, snapHere }) => {
        const items = byDate.get(date);
        const today = isToday(date);
        const selected = date === selectedDate;
        const events = buildCellEvents(items);
        const overflow = Math.max(0, events.length - MAX_CELL_EVENTS);
        const visible = events.slice(0, MAX_CELL_EVENTS);
        const meetingCount = items?.meetings.length ?? 0;
        const isWeekend = weekday === 0 || weekday === 6;
        const isFirstOfMonth = dayNum === 1;
        const inCurrentMonth = year === currentYear && month === currentMonth;

        return (
          <Button
            key={date}
            variant="ghost"
            onClick={() => onDayClick(date)}
            className="relative w-full min-w-0 flex-col items-start overflow-hidden rounded-none"
            style={{
              // Button common 의 sizeClass(px-3 py-1.5) 가 className override 보다 강하게
              // 적용되어 좌우 12px 패딩이 박힘. inline style 로만 이김.
              paddingLeft: 4,
              paddingRight: 4,
              paddingTop: 2,
              paddingBottom: 2,
              borderBottom: "1px solid var(--border-subtle)",
              borderRight: "1px solid var(--border-subtle)",
              // 주말(토·일) 은 살짝 다른 배경 — 업무 위주 사용에서 평일과 시각 구분.
              backgroundColor: isWeekend
                ? "color-mix(in srgb, var(--text-muted) 6%, transparent)"
                : undefined,
              boxShadow: selected
                ? "inset 0 0 0 2px var(--accent-blue)"
                : undefined,
              scrollSnapAlign: snapHere ? "start" : undefined,
            }}
          >
            {/* Date number (with month label on day 1).
                row 높이 h-5 + items-center 로 고정 — 오늘(20px 빨간 원) 과 다른 날(11px text)
                이 같은 row 높이 차지해서 아래 chip 들이 어긋나지 않게.
                현재 보이는 달 외 셀은 날짜 숫자만 흐리게 — chip / bg / 일기 아이콘 등은 그대로. */}
            <div
              className="flex h-5 shrink-0 items-center gap-1"
              style={{ opacity: inCurrentMonth ? 1 : 0.35 }}
            >
              {today ? (
                <Text
                  variant="caption"
                  as="span"
                  weight="bold"
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[11px]"
                  style={{
                    backgroundColor: "var(--accent-red)",
                    color: "var(--text-inverse)",
                  }}
                >
                  {dayNum}
                </Text>
              ) : (
                <>
                  {isFirstOfMonth ? (
                    <Text
                      variant="caption"
                      color="secondary"
                      as="span"
                      weight="semibold"
                      className="text-[10px]"
                    >
                      {month}월
                    </Text>
                  ) : null}
                  <Text
                    variant="caption"
                    as="span"
                    className={`px-0.5 ${weekday === 0 ? "text-red-500" : ""}`}
                    style={
                      weekday === 0
                        ? undefined
                        : { color: "var(--text-secondary)" }
                    }
                  >
                    {dayNum}
                  </Text>
                </>
              )}
            </div>

            {/* 우상단 corner — 일기 BookOpen + 메모 FileText N 한 줄.
                메모는 텍스트 chip 대신 카운트만 압축 (사이드바에서 상세 확인). */}
            {items?.journal || meetingCount > 0 ? (
              <div
                className="pointer-events-none absolute right-1 top-1 flex items-center gap-1"
                style={{ color: "var(--text-muted)" }}
              >
                {items?.journal ? (
                  <BookOpen className="h-3 w-3" aria-label="일기" />
                ) : null}
                {meetingCount > 0 ? (
                  <span className="flex items-center gap-0.5 text-[10px] font-medium leading-none">
                    <FileText className="h-3 w-3" aria-label="메모" />
                    {meetingCount}
                  </span>
                ) : null}
              </div>
            ) : null}

            {/* Task chips — 셀 가로 폭 100% 차지 (items-start 의 cross-axis stretch 비활성
                보정용 w-full). 텍스트가 짧아도 박스가 셀 안쪽 꽉 채워서 그려짐. */}
            <div className="mt-0.5 min-h-0 w-full flex-1 space-y-px overflow-hidden">
              {visible.map((ev) => {
                const catColor = !ev.done ? categoryColor(ev.category ?? null) : "";
                // dot 대신 카테고리 색의 alpha tint 를 chip 배경으로. 미분류는 회색
                // (--text-muted) 의 같은 18% tint. done 은 tint 없이 line-through + muted.
                const swatchColor = catColor || "var(--text-muted)";
                const bgColor = ev.done
                  ? undefined
                  : `color-mix(in srgb, ${swatchColor} 18%, transparent)`;
                return (
                  <div
                    key={ev.key}
                    className={`flex items-center gap-1 rounded-sm px-1 py-px text-[11px] leading-tight ${
                      ev.done ? "line-through" : ""
                    }`}
                    style={{
                      backgroundColor: bgColor,
                      color: ev.done
                        ? "var(--text-muted)"
                        : "var(--text-primary)",
                    }}
                  >
                    {/* 왼쪽 label — flex-1 truncate. min-w-0 로 flex item shrink 허용. */}
                    <span className="min-w-0 flex-1 truncate">{ev.label}</span>
                    {/* 오른쪽 time — shrink-0 로 절대 잘리지 않음. label 만 truncate. */}
                    {ev.time ? (
                      <span className="shrink-0 opacity-60">
                        {formatChipTime(ev.time)}
                      </span>
                    ) : null}
                  </div>
                );
              })}
              {overflow > 0 ? (
                <div
                  className="px-1 text-[10px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  +{overflow}
                </div>
              ) : null}
            </div>
          </Button>
        );
      })}

      {/* 다일 일정 스팬 바 오버레이. day-cell 그리드와 동일한 열/행 트랙으로 정확히
          포개진다(absolute inset-0). pointer-events-none 라 셀 클릭(날짜 선택)은 통과. */}
      {hasSpans ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 grid grid-cols-7"
          style={{ gridAutoRows: GRID_AUTO_ROWS }}
        >
          {segmentsByWeek.flatMap((segs, weekIdx) =>
            segs.map((seg) => (
              <SpanBar key={`${weekIdx}-${seg.id}`} seg={seg} weekIdx={weekIdx} />
            )),
          )}
        </div>
      ) : null}
    </div>
  );
}

// 한 주 안의 다일 일정 가로 바. grid-column 으로 시작~종료 열을 가로지른다.
function SpanBar({
  seg,
  weekIdx,
}: {
  seg: WeekSegment;
  weekIdx: number;
}) {
  // 셀 안 task chip 과 동일한 시각 언어: 카테고리 색 18% tint 배경, 좌측 accent
  // border 없음, rounded-sm, text-[11px]. done 은 tint 없이 line-through + muted.
  const swatch = seg.done ? "var(--text-muted)" : categoryColor(seg.category);
  return (
    <div
      style={{
        gridColumn: `${seg.startCol + 1} / ${seg.endCol + 2}`,
        gridRow: weekIdx + 1,
        marginTop: SPAN_TOP_OFFSET + seg.lane * SPAN_LANE_HEIGHT,
        // chip 과 같은 안쪽 들여쓰기. clip 된(이어지는) 끝은 셀 경계까지 붙여
        // "다음/이전 주로 계속" 을 시각화 + 그 끝만 각지게.
        marginLeft: seg.leftClipped ? 0 : CELL_PAD,
        marginRight: seg.rightClipped ? 0 : CELL_PAD,
        borderTopLeftRadius: seg.leftClipped ? 0 : undefined,
        borderBottomLeftRadius: seg.leftClipped ? 0 : undefined,
        borderTopRightRadius: seg.rightClipped ? 0 : undefined,
        borderBottomRightRadius: seg.rightClipped ? 0 : undefined,
        backgroundColor: seg.done
          ? undefined
          : `color-mix(in srgb, ${swatch} 18%, transparent)`,
        color: seg.done ? "var(--text-muted)" : "var(--text-primary)",
      }}
      className={`flex h-4 items-center gap-0.5 self-start overflow-hidden rounded-sm px-1 text-[11px] leading-tight ${
        seg.done ? "line-through" : ""
      }`}
    >
      {seg.leftClipped ? (
        <ChevronLeft className="h-3 w-3 shrink-0 opacity-60" aria-label="이전 주에서 이어짐" />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{seg.title}</span>
      {seg.rightClipped ? (
        <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-label="다음 주로 이어짐" />
      ) : null}
    </div>
  );
}

// 메모(meeting) 는 우상단 FileText+N 아이콘으로 압축 표시 — 셀 안 chip 은 task 만.
function buildCellEvents(items: DayItems | undefined): CellEvent[] {
  if (!items) return [];
  const events: CellEvent[] = [];

  // due_time 있는 task 는 같은 task 줄에서 시각 prefix 만 추가.
  for (const t of items.tasks) {
    events.push({
      key: `t-${t.id}`,
      label: t.title,
      time: t.due_time ?? undefined,
      done: t.done,
      category: t.category,
    });
  }

  // 시간 없는 태스크가 앞 (할 일 탭 + 사이드바와 일관), 시간 있는 것은 시간순 뒤로.
  events.sort((a, b) => {
    if (a.time && b.time) return a.time < b.time ? -1 : 1;
    if (a.time && !b.time) return 1;
    if (!a.time && b.time) return -1;
    return 0;
  });

  return events;
}
