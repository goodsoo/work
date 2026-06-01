import { describe, expect, it } from "vitest";
import {
  MIN_DATE_ISO,
  addDaysIso,
  isBeforeMinDate,
  isPast,
  isToday,
  isoDateRange,
  parseLooseDate,
  parseLooseTime,
  relativeDateLabel,
  stepDateSegment,
  stepTimeSegment,
  todayIso,
} from "./dates";

const ref = new Date("2026-05-06T12:00:00");

describe("dates", () => {
  it("todayIso returns yyyy-MM-dd in local time", () => {
    expect(todayIso(ref)).toBe("2026-05-06");
  });

  it("addDaysIso shifts forward and back", () => {
    expect(addDaysIso("2026-05-06", 1)).toBe("2026-05-07");
    expect(addDaysIso("2026-05-06", -1)).toBe("2026-05-05");
    expect(addDaysIso("2026-05-31", 1)).toBe("2026-06-01");
  });

  it("isoDateRange is inclusive on both ends", () => {
    expect(isoDateRange("2026-05-05", "2026-05-08")).toEqual([
      "2026-05-05",
      "2026-05-06",
      "2026-05-07",
      "2026-05-08",
    ]);
  });

  it("relativeDateLabel maps near-dates to Korean labels", () => {
    expect(relativeDateLabel("2026-05-06", ref)).toBe("오늘");
    expect(relativeDateLabel("2026-05-05", ref)).toBe("어제");
    expect(relativeDateLabel("2026-05-07", ref)).toBe("내일");
    expect(relativeDateLabel("2026-05-09", ref)).toBe("3일 후");
    expect(relativeDateLabel("2026-05-03", ref)).toBe("3일 전");
    expect(relativeDateLabel("2026-06-01", ref)).toBe("6/1");
  });

  it("isPast / isToday compare against reference", () => {
    expect(isToday("2026-05-06", ref)).toBe(true);
    expect(isToday("2026-05-05", ref)).toBe(false);
    expect(isPast("2026-05-05", ref)).toBe(true);
    expect(isPast("2026-05-06", ref)).toBe(false);
    expect(isPast("2026-05-07", ref)).toBe(false);
  });

  it("parseLooseDate accepts natural-language Korean", () => {
    expect(parseLooseDate("오늘", ref)).toBe("2026-05-06");
    expect(parseLooseDate("내일", ref)).toBe("2026-05-07");
    expect(parseLooseDate("어제", ref)).toBe("2026-05-05");
    expect(parseLooseDate("모레", ref)).toBe("2026-05-08");
    expect(parseLooseDate("그제", ref)).toBe("2026-05-04");
  });

  it("parseLooseDate accepts weekday shortcut → 최근 과거 방향", () => {
    // 2026-05-06 = 수요일 (Wed)
    expect(parseLooseDate("수", ref)).toBe("2026-05-06"); // 오늘
    expect(parseLooseDate("화", ref)).toBe("2026-05-05"); // 어제
    expect(parseLooseDate("월", ref)).toBe("2026-05-04");
    expect(parseLooseDate("일", ref)).toBe("2026-05-03");
    expect(parseLooseDate("토", ref)).toBe("2026-05-02");
    expect(parseLooseDate("금", ref)).toBe("2026-05-01");
    expect(parseLooseDate("목", ref)).toBe("2026-04-30"); // 저번주 목
    // 풀 한글
    expect(parseLooseDate("수요일", ref)).toBe("2026-05-06");
    expect(parseLooseDate("목요일", ref)).toBe("2026-04-30");
  });

  it("parseLooseDate accepts varied separators with year omitted", () => {
    expect(parseLooseDate("5/19", ref)).toBe("2026-05-19");
    expect(parseLooseDate("5.19", ref)).toBe("2026-05-19");
    expect(parseLooseDate("5-19", ref)).toBe("2026-05-19");
    expect(parseLooseDate("5 19", ref)).toBe("2026-05-19");
    expect(parseLooseDate("5월 19일", ref)).toBe("2026-05-19");
  });

  it("parseLooseDate accepts full year forms and compact digits", () => {
    expect(parseLooseDate("2027/3/4", ref)).toBe("2027-03-04");
    expect(parseLooseDate("2026.05.19", ref)).toBe("2026-05-19");
    expect(parseLooseDate("2026년 5월 19일", ref)).toBe("2026-05-19");
    expect(parseLooseDate("20260519", ref)).toBe("2026-05-19");
    expect(parseLooseDate("260519", ref)).toBe("2026-05-19");
  });

  it("parseLooseDate returns null for out-of-range or unparseable", () => {
    expect(parseLooseDate("13/40", ref)).toBe(null);
    expect(parseLooseDate("2/30", ref)).toBe(null);
    expect(parseLooseDate("", ref)).toBe(null);
    expect(parseLooseDate("아무말", ref)).toBe(null);
  });

  it("parseLooseTime accepts canonical and natural forms", () => {
    expect(parseLooseTime("14:30")).toBe("14:30");
    expect(parseLooseTime("2:30")).toBe("02:30");
    expect(parseLooseTime("14시 30분")).toBe("14:30");
    expect(parseLooseTime("14시")).toBe("14:00");
    expect(parseLooseTime("오후 2시")).toBe("14:00");
    expect(parseLooseTime("오후 2시 30분")).toBe("14:30");
    expect(parseLooseTime("오전 9시")).toBe("09:00");
    expect(parseLooseTime("오전 12시")).toBe("00:00");
    expect(parseLooseTime("오후 12시")).toBe("12:00");
    expect(parseLooseTime("2pm")).toBe("14:00");
    expect(parseLooseTime("2:30 PM")).toBe("14:30");
    expect(parseLooseTime("11am")).toBe("11:00");
    expect(parseLooseTime("1430")).toBe("14:30");
    expect(parseLooseTime("930")).toBe("09:30");
  });

  it("parseLooseTime returns null for invalid", () => {
    expect(parseLooseTime("25:00")).toBe(null);
    expect(parseLooseTime("14:99")).toBe(null);
    expect(parseLooseTime("")).toBe(null);
    expect(parseLooseTime("아침")).toBe(null);
  });

  it("MIN_DATE_ISO blocks anything before 2026-01-01", () => {
    expect(MIN_DATE_ISO).toBe("2026-01-01");
    expect(isBeforeMinDate("2025-12-31")).toBe(true);
    expect(isBeforeMinDate("2026-01-01")).toBe(false);
    expect(isBeforeMinDate("2027-05-19")).toBe(false);
    expect(isBeforeMinDate("")).toBe(false); // 빈 문자열 = 지우기, 통과
    // parseLooseDate 도 silent reject (composeIso 경로)
    expect(parseLooseDate("2025-12-31", ref)).toBe(null);
    expect(parseLooseDate("2025.12.31", ref)).toBe(null);
    expect(parseLooseDate("251231", ref)).toBe(null);
    expect(parseLooseDate("2026-01-01", ref)).toBe("2026-01-01");
  });

  it("parseLooseTime keywords now/지금/현재 → current HH:mm", () => {
    const r = parseLooseTime("지금");
    expect(r).toMatch(/^\d{2}:\d{2}$/);
    expect(parseLooseTime("now")).toMatch(/^\d{2}:\d{2}$/);
    expect(parseLooseTime("현재")).toMatch(/^\d{2}:\d{2}$/);
    expect(parseLooseTime("NOW")).toMatch(/^\d{2}:\d{2}$/);
  });

  it("stepDateSegment bumps year/month/day independently", () => {
    expect(stepDateSegment("2026-05-06", "year", 1)).toBe("2027-05-06");
    expect(stepDateSegment("2026-05-06", "month", 1)).toBe("2026-06-06");
    expect(stepDateSegment("2026-05-06", "day", 1)).toBe("2026-05-07");
    expect(stepDateSegment("2026-05-06", "day", -1)).toBe("2026-05-05");
  });

  it("stepDateSegment wraps within field without carry", () => {
    expect(stepDateSegment("2026-12-06", "month", 1)).toBe("2026-01-06");
    expect(stepDateSegment("2026-01-06", "month", -1)).toBe("2026-12-06");
    expect(stepDateSegment("2026-05-31", "day", 1)).toBe("2026-05-01");
  });

  it("stepDateSegment clamps day to month end and respects MIN_DATE", () => {
    // 3월 31일 → 월 -1 = 2월, 일은 28 로 clamp.
    expect(stepDateSegment("2026-03-31", "month", -1)).toBe("2026-02-28");
    // MIN_DATE 미만은 클램프.
    expect(stepDateSegment(MIN_DATE_ISO, "year", -1)).toBe(MIN_DATE_ISO);
  });

  it("stepTimeSegment wraps hour 0-23 and minute 0-59 without carry", () => {
    expect(stepTimeSegment("14:30", "hour", 1)).toBe("15:30");
    expect(stepTimeSegment("14:30", "minute", 1)).toBe("14:31");
    expect(stepTimeSegment("23:30", "hour", 1)).toBe("00:30");
    expect(stepTimeSegment("14:59", "minute", 1)).toBe("14:00");
    expect(stepTimeSegment("00:00", "minute", -1)).toBe("00:59");
  });
});
