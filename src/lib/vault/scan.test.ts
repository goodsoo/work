import { describe, it, expect } from "vitest";
import {
  slugify,
  transcriptPath,
  summaryPath,
  isMeetingSidecar,
  meetingMainPath,
} from "./scan";

describe("slugify", () => {
  it("공백 보존 (옵시디안 파일명 호환)", () => {
    expect(slugify("팀 주간 회의")).toBe("팀 주간 회의");
  });

  it("파일시스템 금지 문자 sanitize", () => {
    expect(slugify("a/b\\c:d*e?f\"g<h>i|j")).toBe("a-b-c-d-e-f-g-h-i-j");
  });

  it("옵시디안 link syntax 충돌 문자 sanitize", () => {
    expect(slugify("note#tag[[link]]^anchor")).toBe("note-tag--link---anchor");
  });

  it("앞뒤 dot/공백 제거 (Windows trim + macOS dotfile)", () => {
    expect(slugify("  .hidden  ")).toBe("hidden");
  });

  it("빈 결과는 untitled fallback", () => {
    expect(slugify("")).toBe("untitled");
    expect(slugify("   ")).toBe("untitled"); // 앞뒤 공백 trim 으로 빈 → fallback.
    // "///" 는 위험문자 치환 → "---" (dash-only). title input 차단으로 사용자 입력에선 안 옴.
    expect(slugify("///")).toBe("---");
  });

  it("200자 cap", () => {
    const long = "가".repeat(250);
    expect(slugify(long).length).toBeLessThanOrEqual(200);
  });

  it("정상 한글/숫자/dot/dash/공백 보존", () => {
    expect(slugify("v1.2-feature 회의록")).toBe("v1.2-feature 회의록");
  });
});

describe("sidecar path helpers", () => {
  it("transcriptPath / summaryPath", () => {
    const main = "meetings/2026-05-18-test.md";
    expect(transcriptPath(main)).toBe("meetings/2026-05-18-test.transcript.md");
    expect(summaryPath(main)).toBe("meetings/2026-05-18-test.summary.md");
  });

  it("isMeetingSidecar 인식", () => {
    expect(isMeetingSidecar("meetings/x.md")).toBe(false);
    expect(isMeetingSidecar("meetings/x.transcript.md")).toBe(true);
    expect(isMeetingSidecar("meetings/x.summary.md")).toBe(true);
  });

  it("meetingMainPath — sidecar → 메인 path 역변환", () => {
    expect(meetingMainPath("meetings/x.transcript.md")).toBe("meetings/x.md");
    expect(meetingMainPath("meetings/x.summary.md")).toBe("meetings/x.md");
    expect(meetingMainPath("meetings/x.md")).toBe("meetings/x.md"); // 이미 메인
  });
});
