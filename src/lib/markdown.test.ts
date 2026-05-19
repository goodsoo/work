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
  it("full meeting renders header + 3 sections in spec format", () => {
    const md = meetingToMarkdown({
      title: "PhAI Studio UX 회의",
      date: "2026-05-06",
      time: "14:20",
      attendees: "정진용 교수님, 아비, 찬스",
      discussion_items: [
        "PhAI Studio UX 플로우: 데이터 수집 → 세션 → 시각화 → AI 학습 흐름 전반 검토",
        "ONE PhAI ↔ PhAI Studio 사이드바 통합: 왼쪽 사이드바 겹침 문제 해결 방향 논의",
      ],
      decisions: [
        "ONE PhAI와 PhAI Studio 사이드바를 상단으로 통합하기로 결정",
      ],
      action_items: [
        "[찬스] 전체 UX 플로우 문서 작성 — 5/8 (금)",
        "[아비] UX 플로우 기반 프론트엔드 구현 — 5/12~13",
      ],
    });

    expect(md).toBe(
      [
        "## PhAI Studio UX 회의",
        "",
        "일시: 2026.05.06 (수) 14:20",
        "참석: 정진용 교수님, 아비, 찬스",
        "",
        "### 논의 사항",
        "- PhAI Studio UX 플로우: 데이터 수집 → 세션 → 시각화 → AI 학습 흐름 전반 검토",
        "- ONE PhAI ↔ PhAI Studio 사이드바 통합: 왼쪽 사이드바 겹침 문제 해결 방향 논의",
        "",
        "### 결정 사항",
        "- ONE PhAI와 PhAI Studio 사이드바를 상단으로 통합하기로 결정",
        "",
        "### 액션 아이템",
        "- [찬스] 전체 UX 플로우 문서 작성 — 5/8 (금)",
        "- [아비] UX 플로우 기반 프론트엔드 구현 — 5/12~13",
        "",
      ].join("\n")
    );
  });

  it("empty sections are omitted", () => {
    const md = meetingToMarkdown({
      title: null,
      date: "2026-05-06",
      time: null,
      attendees: null,
      discussion_items: ["[기획안 검토]: 1차 초안 공유"],
      decisions: [],
      action_items: null,
    });

    expect(md.startsWith("## 메모")).toBe(true);
    expect(md).toContain("일시: 2026.05.06 (수)");
    expect(md).not.toContain("참석:");
    expect(md).toContain("### 논의 사항");
    expect(md).not.toContain("### 결정 사항");
    expect(md).not.toContain("### 액션 아이템");
  });

  it("filters empty/whitespace items in lists", () => {
    const md = meetingToMarkdown({
      title: "1on1",
      date: null,
      time: null,
      attendees: null,
      discussion_items: ["", "  ", "[Q1 회고]: 잘 됨"],
      decisions: ["   "],
      action_items: ["[찬스] follow-up — 내일"],
    });

    expect(md).toContain("- [Q1 회고]: 잘 됨");
    expect(md).not.toContain("### 결정 사항");
    expect(md).toContain("- [찬스] follow-up — 내일");
  });
});
