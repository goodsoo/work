import { describe, it, expect } from "vitest";
import { buildClaudePrompt } from "./clipboardPrompt";

describe("buildClaudePrompt", () => {
  it("본문 + transcript + meta 가 모두 포함된 프롬프트", () => {
    const out = buildClaudePrompt({
      title: "팀 회의",
      date: "2026-05-16",
      time: "14:00",
      attendees: ["홍길동", "김철수"],
      content: "회의 중 노트",
      transcript: "STT 결과",
    });
    expect(out).toContain("## 본문");
    expect(out).toContain("회의 중 노트");
    expect(out).toContain("## 회의 내용");
    expect(out).toContain("STT 결과");
    expect(out).toContain("제목: 팀 회의");
    expect(out).toContain("참석: 홍길동, 김철수");
    // 출력 형식 spec 포함
    expect(out).toContain("### 액션 아이템");
  });

  it("transcript 만 있어도 동작", () => {
    const out = buildClaudePrompt({
      title: "녹음만 있음",
      content: null,
      transcript: "녹음 텍스트",
    });
    expect(out).toContain("녹음 텍스트");
    expect(out).not.toContain("## 본문");
  });

  it("본문/transcript 모두 비어 있어도 prompt header 는 생성 (Button 측에서 disable)", () => {
    const out = buildClaudePrompt({ title: "빈 메모" });
    expect(out).toContain("다음 회의록을 정리해주세요");
    expect(out).toContain("제목: 빈 메모");
  });
});
