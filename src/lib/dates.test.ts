import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  isPast,
  isToday,
  isoDateRange,
  relativeDateLabel,
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
});
