import { describe, it, expect } from "vitest";
import { extractEvents, buildEventLine } from "./schedule";

describe("extractEvents — 날짜-우선 이벤트 파싱", () => {
  it("시각 있는 단일일 이벤트", () => {
    const [e] = extractEvents("schedule.md", "- 2026-06-15 14:30 팀 회의");
    expect(e).toMatchObject({ start: "2026-06-15", time: "14:30", text: "팀 회의" });
    expect(e.end).toBeUndefined();
  });

  it("종일(시각 없는) 단일일 이벤트", () => {
    const [e] = extractEvents("schedule.md", "- 2026-06-15 워크샵");
    expect(e).toMatchObject({ start: "2026-06-15", text: "워크샵" });
    expect(e.time).toBeUndefined();
    expect(e.end).toBeUndefined();
  });

  it("다일 범위 이벤트 (시각 없음)", () => {
    const [e] = extractEvents("schedule.md", "- 2026-06-15..2026-06-17 출장");
    expect(e).toMatchObject({
      start: "2026-06-15",
      end: "2026-06-17",
      text: "출장",
    });
    expect(e.time).toBeUndefined();
  });

  it("다일 범위 + 시각 이벤트", () => {
    const [e] = extractEvents(
      "schedule.md",
      "- 2026-06-15..2026-06-17 14:30 컨퍼런스",
    );
    expect(e).toMatchObject({
      start: "2026-06-15",
      end: "2026-06-17",
      time: "14:30",
      text: "컨퍼런스",
    });
  });

  it("source.line 은 0-based 줄 번호", () => {
    const raw = "# 일정\n\n- 2026-06-15 회의\n- 2026-06-16 점심";
    const events = extractEvents("schedule.md", raw);
    expect(events.map((e) => e.source.line)).toEqual([2, 3]);
  });

  it("날짜로 시작 안 하는 불릿·체크박스는 이벤트 아님", () => {
    const raw = "- 그냥 메모\n- [ ] 할 일 --- 2026-06-15\n- 2026-06-15 진짜 이벤트";
    const events = extractEvents("schedule.md", raw);
    expect(events).toHaveLength(1);
    expect(events[0].text).toBe("진짜 이벤트");
  });

  it("코드펜스 안 줄은 무시", () => {
    const raw = "```\n- 2026-06-15 코드 안\n```\n- 2026-06-16 진짜";
    const events = extractEvents("schedule.md", raw);
    expect(events).toHaveLength(1);
    expect(events[0].start).toBe("2026-06-16");
  });

  it("역전 범위(end < start)는 단일일로 강등", () => {
    const [e] = extractEvents("schedule.md", "- 2026-06-17..2026-06-15 오타");
    expect(e.start).toBe("2026-06-17");
    expect(e.end).toBeUndefined();
  });
});

describe("buildEventLine — round-trip", () => {
  const cases = [
    { start: "2026-06-15", time: "14:30", text: "팀 회의" },
    { start: "2026-06-15", text: "워크샵" },
    { start: "2026-06-15", end: "2026-06-17", text: "출장" },
    { start: "2026-06-15", end: "2026-06-17", time: "14:30", text: "컨퍼런스" },
  ];
  for (const c of cases) {
    it(`build→extract 가 동일 (${c.text})`, () => {
      const line = buildEventLine(c);
      const [e] = extractEvents("schedule.md", line);
      expect(e.start).toBe(c.start);
      expect(e.text).toBe(c.text);
      expect(e.time).toBe(c.time);
      expect(e.end).toBe(c.end);
    });
  }

  it("end === start 면 범위 토큰 안 박음", () => {
    expect(buildEventLine({ start: "2026-06-15", end: "2026-06-15", text: "x" })).toBe(
      "- 2026-06-15 x",
    );
  });
});
