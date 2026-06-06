import type { TaskCategory } from "../../api/tasks";

// 캘린더 다일 일정(가로 스팬 바)의 순수 좌표 계산. 7열(일~토) 주 그리드 기준.
// 시각/렌더와 분리 — 주 경계 분할·clip·레인 쌓기를 OAuth·DOM 없이 단위 테스트한다.

// 다일 일정 1건. start/end 는 포함(inclusive) ISO 날짜, end >= start.
export interface MultiDayEvent {
  id: string;
  title: string;
  start: string; // YYYY-MM-DD (포함)
  end: string; // YYYY-MM-DD (포함, >= start)
  category: TaskCategory | null;
  done: boolean;
}

// 한 주 안에서 한 일정이 차지하는 가로 세그먼트.
export interface WeekSegment {
  id: string;
  title: string;
  startCol: number; // 0(일)~6(토)
  endCol: number; // 0~6, >= startCol
  leftClipped: boolean; // 시작이 이 주 이전 → 왼쪽 끝 이어짐(◀)
  rightClipped: boolean; // 종료가 이 주 이후 → 오른쪽 끝 이어짐(▶)
  category: TaskCategory | null;
  done: boolean;
  lane: number; // 세로 쌓기 레인(0-based). 같은 주 겹침 회피.
}

// UTC 기준 일수 차 (b - a). tz 영향 0 — 입력은 YYYY-MM-DD.
function diffDays(a: string, b: string): number {
  const pa = Date.parse(`${a}T00:00:00Z`);
  const pb = Date.parse(`${b}T00:00:00Z`);
  return Math.round((pb - pa) / 86_400_000);
}

// YYYY-MM-DD 에 일수 더하기 (UTC 산술).
export function addIsoDays(date: string, days: number): string {
  const base = Date.parse(`${date}T00:00:00Z`);
  const next = new Date(base + days * 86_400_000);
  const y = next.getUTCFullYear();
  const mo = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

// 한 주(weekStartIso = 그 주 일요일)와 겹치는 일정들의 세그먼트를 계산한다.
// 주 경계를 넘는 일정은 그 주 부분만 잘라서 반환(leftClipped/rightClipped 로 이어짐 표시).
// 레인 배정: startCol 오름차순(동률은 더 긴 것 먼저)으로 greedy — 한 레인에 겹치지 않게 채움.
export function computeWeekSegments(
  weekStartIso: string,
  events: MultiDayEvent[],
): WeekSegment[] {
  const weekEndIso = addIsoDays(weekStartIso, 6);

  const raw: Array<{
    ev: MultiDayEvent;
    startCol: number;
    endCol: number;
    leftClipped: boolean;
    rightClipped: boolean;
  }> = [];

  for (const ev of events) {
    // 이 주와 안 겹침.
    if (ev.end < weekStartIso || ev.start > weekEndIso) continue;
    const segStart = ev.start < weekStartIso ? weekStartIso : ev.start;
    const segEnd = ev.end > weekEndIso ? weekEndIso : ev.end;
    raw.push({
      ev,
      startCol: diffDays(weekStartIso, segStart),
      endCol: diffDays(weekStartIso, segEnd),
      leftClipped: ev.start < weekStartIso,
      rightClipped: ev.end > weekEndIso,
    });
  }

  raw.sort(
    (a, b) =>
      a.startCol - b.startCol ||
      b.endCol - b.startCol - (a.endCol - a.startCol) ||
      a.ev.id.localeCompare(b.ev.id),
  );

  const laneEnds: number[] = []; // 각 레인이 채운 마지막 endCol.
  const out: WeekSegment[] = [];
  for (const r of raw) {
    let lane = laneEnds.findIndex((end) => end < r.startCol);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(r.endCol);
    } else {
      laneEnds[lane] = r.endCol;
    }
    out.push({
      id: r.ev.id,
      title: r.ev.title,
      startCol: r.startCol,
      endCol: r.endCol,
      leftClipped: r.leftClipped,
      rightClipped: r.rightClipped,
      category: r.ev.category,
      done: r.ev.done,
      lane,
    });
  }
  return out;
}
