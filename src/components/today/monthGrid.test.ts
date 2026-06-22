import { describe, it, expect } from "vitest";
import { monthGridCells, eventDaysInMonth, upcomingEvents } from "./monthGrid";
import type { ScheduleEvent } from "../../api/schedule";

function ev(p: Partial<ScheduleEvent> & { start: string }): ScheduleEvent {
  return {
    id: p.id ?? `schedule.md#L${p.start}`,
    text: p.text ?? "event",
    start: p.start,
    end: p.end ?? null,
    time: p.time ?? null,
    _source: { file: "schedule.md", line: 1 },
  };
}

describe("monthGridCells", () => {
  it("2026-06: 1일(월)이라 앞 1칸 공백, 30일, 7배수 길이", () => {
    const cells = monthGridCells(2026, 6);
    expect(cells.length % 7).toBe(0);
    expect(cells[0]).toBeNull(); // 일요일 칸 = 6/1 아님 (6/1은 월)
    expect(cells[1]).toBe("2026-06-01");
    expect(cells.filter((c) => c !== null)).toHaveLength(30);
    expect(cells.filter((c) => c !== null).at(-1)).toBe("2026-06-30");
  });

  it("2026-02: 윤년 아님 → 28일", () => {
    const days = monthGridCells(2026, 2).filter((c) => c !== null);
    expect(days).toHaveLength(28);
    expect(days.at(-1)).toBe("2026-02-28");
  });

  it("월 첫날이 일요일이면 앞 공백 없음 (2026-03-01 = 일)", () => {
    const cells = monthGridCells(2026, 3);
    expect(cells[0]).toBe("2026-03-01");
  });
});

describe("eventDaysInMonth", () => {
  it("단일일 일정만 해당 날 마킹", () => {
    const set = eventDaysInMonth([ev({ start: "2026-06-10" })], 2026, 6);
    expect(set.has("2026-06-10")).toBe(true);
    expect(set.has("2026-06-11")).toBe(false);
  });

  it("다일 일정은 걸친 모든 날 마킹", () => {
    const set = eventDaysInMonth([ev({ start: "2026-06-10", end: "2026-06-13" })], 2026, 6);
    expect([...set].sort()).toEqual([
      "2026-06-10",
      "2026-06-11",
      "2026-06-12",
      "2026-06-13",
    ]);
  });

  it("월 경계를 넘는 다일 일정은 그 달 부분만", () => {
    const set = eventDaysInMonth([ev({ start: "2026-05-30", end: "2026-06-02" })], 2026, 6);
    expect([...set].sort()).toEqual(["2026-06-01", "2026-06-02"]);
  });

  it("다른 달 일정은 무시", () => {
    const set = eventDaysInMonth([ev({ start: "2026-07-01" })], 2026, 6);
    expect(set.size).toBe(0);
  });
});

describe("upcomingEvents", () => {
  const today = "2026-06-22";
  const events = [
    ev({ start: "2026-06-20", text: "지난것" }),
    ev({ start: "2026-06-22", time: "14:00", text: "오늘오후" }),
    ev({ start: "2026-06-22", time: null, text: "오늘종일" }),
    ev({ start: "2026-06-25", text: "앞으로" }),
  ];

  it("오늘 이후만, 시작일→시각 순(종일 먼저)", () => {
    const up = upcomingEvents(events, today, 10);
    expect(up.map((e) => e.text)).toEqual(["오늘종일", "오늘오후", "앞으로"]);
  });

  it("limit 개로 자른다", () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      ev({ start: `2026-07-${String(i + 1).padStart(2, "0")}` }),
    );
    expect(upcomingEvents(many, today, 10)).toHaveLength(10);
  });
});
