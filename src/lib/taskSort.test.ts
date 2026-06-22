import { describe, it, expect } from "vitest";
import { compareTaskDate } from "./taskSort";
import type { Task } from "../api/tasks";

let line = 0;
function task(p: Partial<Task>): Task {
  return {
    deleted: false,
    cancelled: false,
    done: false,
    due_date: null,
    due_time: null,
    title: "t",
    _source: { file: "tasks/inbox.md", line: ++line },
    ...p,
  } as unknown as Task;
}

function sortAsc(tasks: Task[]): string[] {
  return [...tasks].sort((a, b) => compareTaskDate(a, b, true)).map((t) => t.title);
}

describe("compareTaskDate (asc = 할일 탭 기본)", () => {
  it("날짜 없는 할일이 맨 위(null first), 그다음 날짜 오름차순", () => {
    const tasks = [
      task({ title: "내일", due_date: "2026-06-23" }),
      task({ title: "날짜없음", due_date: null }),
      task({ title: "어제", due_date: "2026-06-21" }),
    ];
    expect(sortAsc(tasks)).toEqual(["날짜없음", "어제", "내일"]);
  });

  it("같은 날짜면 시각 null 먼저, 그다음 시각 오름차순", () => {
    const tasks = [
      task({ title: "오후", due_date: "2026-06-22", due_time: "15:00" }),
      task({ title: "종일", due_date: "2026-06-22", due_time: null }),
      task({ title: "오전", due_date: "2026-06-22", due_time: "09:00" }),
    ];
    expect(sortAsc(tasks)).toEqual(["종일", "오전", "오후"]);
  });

  it("날짜·시각 동률이면 최근 추가(라인 큰 것)가 위로", () => {
    const older = task({ title: "older", due_date: "2026-06-22", due_time: "09:00" });
    const newer = task({ title: "newer", due_date: "2026-06-22", due_time: "09:00" });
    // newer 가 더 큰 _source.line → 위로
    expect(sortAsc([older, newer])).toEqual(["newer", "older"]);
  });

  it("done 여부는 정렬에 영향 없음(할일 탭 기본 date_asc 와 동일)", () => {
    const tasks = [
      task({ title: "완료-오후", due_date: "2026-06-22", due_time: "15:00", done: true }),
      task({ title: "미완-오전", due_date: "2026-06-22", due_time: "09:00" }),
    ];
    expect(sortAsc(tasks)).toEqual(["미완-오전", "완료-오후"]);
  });
});
