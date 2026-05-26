import { describe, expect, it } from "vitest";
import { formatMeetingDate, meetingToMarkdown } from "./markdown";

describe("formatMeetingDate", () => {
  it("appends Korean weekday for ISO date", () => {
    // 2026-05-06 is a Wednesday → 수
    expect(formatMeetingDate("2026-05-06")).toBe("2026.05.06 (수)");
  });
  it("returns null for empty input", () => {
    expect(formatMeetingDate(null)).toBeNull();
    expect(formatMeetingDate("")).toBeNull();
  });
});

describe("meetingToMarkdown", () => {
  it("full meeting renders header + meta + summary markdown 그대로", () => {
    const summary = [
      "### 논의 사항",
      "- 항목 A",
      "- 항목 B",
      "",
      "### 결정 사항",
      "- 결정 1",
      "",
      "### 액션 아이템",
      "- [찬스] follow-up — 내일",
    ].join("\n");
    const md = meetingToMarkdown({
      title: "PhAI Studio UX 회의",
      date: "2026-05-06",
      time: "14:20",
      attendees: "정진용 교수님, 아비, 찬스",
      summary,
    });

    expect(md).toBe(
      [
        "## PhAI Studio UX 회의",
        "",
        "일시: 2026.05.06 (수) 14:20",
        "참석: 정진용 교수님, 아비, 찬스",
        "",
        summary,
        "",
      ].join("\n"),
    );
  });

  it("summary 비어있으면 메타까지만 출력", () => {
    const md = meetingToMarkdown({
      title: null,
      date: "2026-05-06",
      time: null,
      attendees: null,
      summary: null,
    });

    expect(md.startsWith("## 메모")).toBe(true);
    expect(md).toContain("일시: 2026.05.06 (수)");
    expect(md).not.toContain("참석:");
    expect(md).not.toContain("###");
  });

  it("summary trim 공백 정리 후 그대로 박음", () => {
    const md = meetingToMarkdown({
      title: "1on1",
      date: null,
      time: null,
      attendees: null,
      summary: "\n\n   ### 액션 아이템\n- [찬스] follow-up\n   ",
    });

    expect(md).toContain("### 액션 아이템");
    expect(md).toContain("- [찬스] follow-up");
    expect(md.endsWith("\n")).toBe(true);
  });
});
