// "오늘" 사이드바 미니 월 그리드 + 다가오는 일정의 순수 파생 로직.
// 렌더와 분리해 단위 테스트 (monthGrid.test.ts). 날짜는 전부 ISO "YYYY-MM-DD"
// 문자열 — 사전식 비교가 곧 시간순이라 비교/정렬에 그대로 쓴다.
import { addDaysIso, parseIsoDate } from "../../lib/dates";
import type { ScheduleEvent } from "../../api/schedule";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * 월(1-base) 그리드 셀. 일요일 시작 7열 — 1일 요일만큼 앞을 null 로 채우고,
 * 마지막 주가 7칸 되도록 뒤도 null 로 채운다. 날짜 칸은 ISO 문자열.
 */
export function monthGridCells(year: number, month: number): (string | null)[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstIso = `${year}-${pad(month)}-01`;
  const lead = parseIsoDate(firstIso).getDay(); // 0(일)~6(토)
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${year}-${pad(month)}-${pad(d)}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/**
 * 주어진 월에 일정이 있는 날짜 집합. 다일 일정(start..end)은 걸친 모든 날을 채우되
 * 그 달 범위로 클램프. 점 표시(있음/없음)용.
 */
export function eventDaysInMonth(
  events: ScheduleEvent[],
  year: number,
  month: number,
): Set<string> {
  const set = new Set<string>();
  const daysInMonth = new Date(year, month, 0).getDate();
  const mStart = `${year}-${pad(month)}-01`;
  const mEnd = `${year}-${pad(month)}-${pad(daysInMonth)}`;
  for (const e of events) {
    const last = e.end ?? e.start;
    let cur = e.start < mStart ? mStart : e.start; // max(start, mStart)
    const stop = last > mEnd ? mEnd : last; // min(last, mEnd)
    if (cur > stop) continue; // 이 달과 겹치지 않음
    while (cur <= stop) {
      set.add(cur);
      cur = addDaysIso(cur, 1);
    }
  }
  return set;
}

// 시각 비교 — null/종일("")은 시각 있는 것보다 앞.
function byTime(a: string | null, b: string | null): number {
  const ta = a ?? "";
  const tb = b ?? "";
  if (ta === tb) return 0;
  if (!ta) return -1;
  if (!tb) return 1;
  return ta < tb ? -1 : 1;
}

/**
 * 오늘(포함) 이후 시작하는 일정을 시작일→시각 순으로 정렬해 상위 limit 개.
 * 시작일 기준(다일은 한 줄). 할 일·노트·일기는 포함하지 않는다.
 */
export function upcomingEvents(
  events: ScheduleEvent[],
  today: string,
  limit: number,
): ScheduleEvent[] {
  return events
    .filter((e) => e.start >= today)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : byTime(a.time, b.time)))
    .slice(0, limit);
}
