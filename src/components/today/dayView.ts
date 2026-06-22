// "오늘" 탭 메인창 day-view 의 순수 필터. 선택한 날(day) 기준으로 일정·할일·노트를
// 추린다. 렌더와 분리해 단위 테스트(dayView.test.ts). day 는 ISO "YYYY-MM-DD".
import type { ScheduleEvent } from "../../api/schedule";
import type { Task } from "../../api/tasks";
import type { Meeting } from "../../api/meetings";
import { compareTaskDate } from "../../lib/taskSort";

// 시각 비교 — null/종일은 시각 있는 것보다 앞. 앱 전체와 동일 규칙.
function byTime(a: string | null, b: string | null): number {
  const ta = a ?? "";
  const tb = b ?? "";
  if (ta === tb) return 0;
  if (!ta) return -1;
  if (!tb) return 1;
  return ta < tb ? -1 : 1;
}

/** 그 날에 걸린 일정 — 다일(start..end)은 범위 안 모든 날 포함. 시각→제목 순. */
export function eventsOnDay(events: ScheduleEvent[], day: string): ScheduleEvent[] {
  return events
    .filter((e) =>
      e.end && e.end > e.start ? e.start <= day && day <= e.end : e.start === day,
    )
    .sort((a, b) => byTime(a.time, b.time) || a.text.localeCompare(b.text));
}

/**
 * 그 날 마감 할 일 — due_date===day 인 미삭제·미취소·미완료 항목만. 완료는 숨김.
 * 정렬은 할일 탭 기본과 동일(compareTaskDate date_asc).
 */
export function tasksDueOn(tasks: Task[], day: string): Task[] {
  return tasks
    .filter((t) => !t.deleted && !t.cancelled && !t.done && t.due_date === day)
    .sort((a, b) => compareTaskDate(a, b, true));
}

/** 그 날 작성/수정된 노트 — note.date===day. */
export function notesOnDay(notes: Meeting[], day: string): Meeting[] {
  return notes.filter((m) => m.date === day);
}
