import type { Task } from "../api/tasks";

// 할일 정렬 비교 — due_date + due_time 기준, **null first**(날짜·시각 미적용이 위로,
// "기한 정해야 함" 신호). 동률은 라인 위치(최근 추가가 위). 할일 탭 기본(date_asc)과
// "오늘" 탭 할일 블록이 같은 순서를 쓰도록 공유. asc=false 면 날짜·시각 내림차순.
export function compareTaskDate(a: Task, b: Task, asc: boolean): number {
  const ad = a.due_date;
  const bd = b.due_date;
  if (!ad && bd) return -1; // null first
  if (ad && !bd) return 1;
  if (ad && bd && ad !== bd) return asc ? ad.localeCompare(bd) : bd.localeCompare(ad);
  const at = a.due_time;
  const bt = b.due_time;
  if (!at && bt) return -1;
  if (at && !bt) return 1;
  if (at && bt && at !== bt) return asc ? at.localeCompare(bt) : bt.localeCompare(at);
  return b._source.line - a._source.line; // 같은 시각이면 최근 추가가 위로
}
