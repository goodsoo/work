import { describe, expect, it } from "vitest";
import { addIsoDays, computeWeekSegments, type MultiDayEvent } from "./spans";

// 기준 주: 2026-06-07(일) ~ 2026-06-13(토).
const WEEK_2026_06_07 = "2026-06-07";

function ev(
  id: string,
  start: string,
  end: string,
  extra: Partial<MultiDayEvent> = {},
): MultiDayEvent {
  return { id, title: id, start, end, category: null, done: false, ...extra };
}

describe("addIsoDays", () => {
  it("월/연 경계 넘어도 UTC 산술로 정확", () => {
    expect(addIsoDays("2026-06-13", 1)).toBe("2026-06-14");
    expect(addIsoDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addIsoDays("2026-06-07", -1)).toBe("2026-06-06");
  });
});

describe("computeWeekSegments", () => {
  it("#1 같은 주 안 3일 일정 → 시작열~종료열 하나의 연속 세그먼트 (clip 없음)", () => {
    const segs = computeWeekSegments(WEEK_2026_06_07, [
      ev("a", "2026-06-10", "2026-06-12"),
    ]);
    expect(segs).toHaveLength(1);
    expect(segs[0].startCol).toBe(3); // 수
    expect(segs[0].endCol).toBe(5); // 금
    expect(segs[0].leftClipped).toBe(false);
    expect(segs[0].rightClipped).toBe(false);
  });

  it("이 주와 안 겹치는 일정은 세그먼트 0", () => {
    const segs = computeWeekSegments(WEEK_2026_06_07, [
      ev("past", "2026-05-01", "2026-05-03"),
      ev("future", "2026-07-01", "2026-07-05"),
    ]);
    expect(segs).toHaveLength(0);
  });

  it("#4 주 경계를 넘는 일정 → 주마다 잘려 각 세그먼트 + 이어짐(clip) 표시", () => {
    // 토(2026-06-13)~다음 화(2026-06-16) 걸침.
    const event = [ev("x", "2026-06-13", "2026-06-16")];

    const firstWeek = computeWeekSegments(WEEK_2026_06_07, event);
    expect(firstWeek).toHaveLength(1);
    expect(firstWeek[0].startCol).toBe(6); // 토
    expect(firstWeek[0].endCol).toBe(6);
    expect(firstWeek[0].leftClipped).toBe(false);
    expect(firstWeek[0].rightClipped).toBe(true); // 다음 주로 이어짐 ▶

    const nextWeek = computeWeekSegments("2026-06-14", event);
    expect(nextWeek).toHaveLength(1);
    expect(nextWeek[0].startCol).toBe(0); // 일
    expect(nextWeek[0].endCol).toBe(2); // 화
    expect(nextWeek[0].leftClipped).toBe(true); // 이전 주에서 이어짐 ◀
    expect(nextWeek[0].rightClipped).toBe(false);
  });

  it("주를 통째로 관통하는 일정 → 일~토 전부, 양끝 clip", () => {
    const segs = computeWeekSegments(WEEK_2026_06_07, [
      ev("long", "2026-06-01", "2026-06-30"),
    ]);
    expect(segs[0].startCol).toBe(0);
    expect(segs[0].endCol).toBe(6);
    expect(segs[0].leftClipped).toBe(true);
    expect(segs[0].rightClipped).toBe(true);
  });

  it("겹치는 일정은 서로 다른 레인으로 쌓인다", () => {
    const segs = computeWeekSegments(WEEK_2026_06_07, [
      ev("a", "2026-06-08", "2026-06-11"),
      ev("b", "2026-06-10", "2026-06-12"),
    ]);
    const a = segs.find((s) => s.id === "a")!;
    const b = segs.find((s) => s.id === "b")!;
    expect(a.lane).not.toBe(b.lane);
  });

  it("안 겹치는 일정은 같은 레인 재사용", () => {
    const segs = computeWeekSegments(WEEK_2026_06_07, [
      ev("a", "2026-06-07", "2026-06-08"), // 일~월
      ev("b", "2026-06-11", "2026-06-12"), // 목~금
    ]);
    expect(segs.every((s) => s.lane === 0)).toBe(true);
  });
});
