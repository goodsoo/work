import { describe, it, expect } from "vitest";
import {
  buildClaudePrompt,
  buildLegacyCardPrompt,
  buildPRPrompt,
  parsePRResponse,
} from "./clipboardPrompt";

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
    expect(out).toContain("## 메모");
    expect(out).toContain("회의 중 노트");
    expect(out).toContain("## 음성 기록");
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
    expect(out).not.toContain("## 메모");
  });

  it("본문/transcript 모두 비어 있어도 prompt header 는 생성 (Button 측에서 disable)", () => {
    const out = buildClaudePrompt({ title: "빈 메모" });
    expect(out).toContain("다음 메모를 정리해주세요");
    expect(out).toContain("제목: 빈 메모");
  });
});

describe("buildPRPrompt (V0.7 step 8)", () => {
  it("title + url + 변경 통계 + body 포함", () => {
    const out = buildPRPrompt({
      title: "feat: redesign dashboard",
      body: "기존 차트 가독성 낮음, 토큰 적용",
      url: "https://github.com/owner/repo/pull/42",
      changedFiles: 12,
      additions: 340,
      deletions: 87,
    });
    expect(out).toContain("제목: feat: redesign dashboard");
    expect(out).toContain("12 files, +340 -87");
    expect(out).toContain("기존 차트 가독성");
    expect(out).toContain("### 한 줄 임팩트");
    expect(out).toContain("### 카테고리");
  });

  it("긴 body 는 5000자에서 truncate marker 추가", () => {
    const out = buildPRPrompt({
      title: "x",
      body: "a".repeat(6000),
      url: "u",
      changedFiles: 1,
      additions: 1,
      deletions: 1,
    });
    expect(out).toContain("...(truncated)");
  });
});

describe("buildLegacyCardPrompt", () => {
  it("주입된 vaultRoot 경로 + pr_number 0 + category enum 명시 포함", () => {
    const out = buildLegacyCardPrompt("/Users/x/MyVault");
    expect(out).toContain("/Users/x/MyVault/portfolio/");
    expect(out).toContain("github_pr_number: 0");
    expect(out).toContain("ui_ux | backend | infra | fix | other");
    expect(out).toContain("projects.md");
  });

  it("vaultRoot null → vault 설정 안내 메시지", () => {
    const out = buildLegacyCardPrompt(null);
    expect(out).toContain("vault 폴더를 먼저 선택");
    expect(out).not.toContain("github_pr_number: 0"); // 본문 안 들어감
  });
});

describe("parsePRResponse (V0.7 step 8)", () => {
  it("정상 H3 응답 → impact + category", () => {
    const r = parsePRResponse(
      `### 한 줄 임팩트\n차트 가독성 개선\n\n### 카테고리\nui_ux\n`,
    );
    expect(r).toEqual({ impact: "차트 가독성 개선", category: "ui_ux" });
  });

  it("bullet prefix 와 공백 정리", () => {
    const r = parsePRResponse(
      `### 한 줄 임팩트\n- 로그인 속도 2배\n\n### 카테고리\n- backend\n`,
    );
    expect(r?.impact).toBe("로그인 속도 2배");
    expect(r?.category).toBe("backend");
  });

  it("카테고리 이상하면 other fallback", () => {
    const r = parsePRResponse(
      `### 한 줄 임팩트\nx\n\n### 카테고리\n뭐 모름\n`,
    );
    expect(r?.category).toBe("other");
  });

  it("impact 헤더 없음 → null", () => {
    expect(parsePRResponse(`### 카테고리\nui_ux\n`)).toBeNull();
  });

  it("60자 cap", () => {
    const long = "x".repeat(100);
    const r = parsePRResponse(`### 한 줄 임팩트\n${long}\n\n### 카테고리\nui_ux\n`);
    expect(r?.impact.length).toBe(60);
  });
});
