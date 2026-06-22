import { describe, it, expect } from "vitest";
import { eventsOnDay, tasksDueOn, notesOnDay } from "./dayView";
import type { ScheduleEvent } from "../../api/schedule";
import type { Task } from "../../api/tasks";
import type { Meeting } from "../../lib/vault/scan";

// 필터가 읽는 필드만 채워 캐스팅 (순수 필터 테스트).
function ev(p: { start: string; end?: string | null; time?: string | null; text?: string }): ScheduleEvent {
  return {
    id: `schedule.md#${p.start}-${p.text ?? ""}`,
    text: p.text ?? "event",
    start: p.start,
    end: p.end ?? null,
    time: p.time ?? null,
    _source: { file: "schedule.md", line: 1 },
  };
}
let taskLine = 0;
function task(p: Partial<Task>): Task {
  return {
    deleted: false,
    cancelled: false,
    done: false,
    due_date: null,
    due_time: null,
    title: "t",
    _source: { file: "tasks/inbox.md", line: ++taskLine },
    ...p,
  } as unknown as Task;
}
function note(p: { date: string | null; uid?: string }): Meeting {
  return { uid: p.uid ?? "n", date: p.date } as unknown as Meeting;
}

describe("eventsOnDay", () => {
  it("단일일은 그 날만", () => {
    const events = [ev({ start: "2026-06-10" }), ev({ start: "2026-06-11" })];
    expect(eventsOnDay(events, "2026-06-10").map((e) => e.start)).toEqual(["2026-06-10"]);
  });

  it("다일은 범위 안 모든 날에 잡힘", () => {
    const e = ev({ start: "2026-06-10", end: "2026-06-13" });
    expect(eventsOnDay([e], "2026-06-12")).toHaveLength(1);
    expect(eventsOnDay([e], "2026-06-13")).toHaveLength(1);
    expect(eventsOnDay([e], "2026-06-14")).toHaveLength(0);
  });

  it("시각 순 정렬 — 종일(시각 null) 먼저", () => {
    const events = [
      ev({ start: "2026-06-10", time: "14:00", text: "오후" }),
      ev({ start: "2026-06-10", time: null, text: "종일" }),
      ev({ start: "2026-06-10", time: "09:00", text: "오전" }),
    ];
    expect(eventsOnDay(events, "2026-06-10").map((e) => e.text)).toEqual(["종일", "오전", "오후"]);
  });
});

describe("tasksDueOn", () => {
  it("그 날 마감만, 삭제·취소·완료 제외", () => {
    const tasks = [
      task({ title: "오늘", due_date: "2026-06-22" }),
      task({ title: "다른날", due_date: "2026-06-23" }),
      task({ title: "마감없음", due_date: null }),
      task({ title: "삭제됨", due_date: "2026-06-22", deleted: true }),
      task({ title: "취소됨", due_date: "2026-06-22", cancelled: true }),
      task({ title: "완료됨", due_date: "2026-06-22", done: true }),
    ];
    expect(tasksDueOn(tasks, "2026-06-22").map((t) => t.title)).toEqual(["오늘"]);
  });

  it("미완료를 시각 null 먼저 → 시각 오름차순으로 (완료는 숨김)", () => {
    const tasks = [
      task({ title: "오후", due_date: "2026-06-22", due_time: "15:00" }),
      task({ title: "시각없음", due_date: "2026-06-22", due_time: null }),
      task({ title: "완료", due_date: "2026-06-22", due_time: "09:00", done: true }),
    ];
    expect(tasksDueOn(tasks, "2026-06-22").map((t) => t.title)).toEqual([
      "시각없음",
      "오후",
    ]);
  });
});

describe("notesOnDay", () => {
  it("note.date 가 그 날인 것만", () => {
    const notes = [
      note({ date: "2026-06-22", uid: "a" }),
      note({ date: "2026-06-21", uid: "b" }),
      note({ date: null, uid: "c" }),
    ];
    expect(notesOnDay(notes, "2026-06-22").map((m) => m.uid)).toEqual(["a"]);
  });
});
