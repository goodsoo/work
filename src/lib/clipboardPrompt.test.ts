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

  it("default templateId = meeting — 기존 회의록 헤더와 byte 동일", () => {
    const input = { title: "회의", content: "노트" };
    expect(buildClaudePrompt(input)).toBe(
      buildClaudePrompt(input, "meeting"),
    );
  });

  it("work 템플릿 — 작업 요약 인트로 + 섹션", () => {
    const out = buildClaudePrompt({ content: "오늘 작업" }, "work");
    expect(out).toContain("다음 내용을 정리해주세요");
    expect(out).toContain("### 한 일");
    expect(out).toContain("### 다음 할 일");
    expect(out).not.toContain("### 논의 사항"); // 회의록 섹션 안 섞임
  });

  it("lecture 템플릿 — 강의 인트로 + 섹션, 입력은 동일 파이프라인", () => {
    const out = buildClaudePrompt(
      { content: "강의 노트", transcript: "녹음" },
      "lecture",
    );
    expect(out).toContain("### 핵심 개념");
    expect(out).toContain("### 적용점");
    // 빈 섹션 생략은 출력 형식 spec, 입력은 그대로 합성
    expect(out).toContain("## 메모");
    expect(out).toContain("## 음성 기록");
  });

  it("general 템플릿 — 빠짐없이 자세히 정리 규칙 + 상세 정리 섹션", () => {
    const out = buildClaudePrompt({ content: "긴 노트" }, "general");
    expect(out).toContain("다음 내용을 정리해주세요");
    expect(out).toContain("### 상세 정리");
    expect(out).toContain("빠짐없이 자세히");
    expect(out).not.toContain("### 논의 사항"); // 회의록 섹션 안 섞임
  });

  it("모든 템플릿에 '기타' 섹션 + 규칙 문구 포함", () => {
    for (const id of ["meeting", "work", "lecture", "general"]) {
      const out = buildClaudePrompt({ content: "x" }, id);
      expect(out).toContain("### 기타");
      expect(out).toContain("'기타' 에 모읍니다");
    }
  });

  it("알 수 없는 templateId → meeting fallback", () => {
    const out = buildClaudePrompt({ content: "x" }, "nope");
    expect(out).toContain("다음 메모를 정리해주세요");
    expect(out).toContain("### 액션 아이템");
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

  it("자유 슬러그 — 한글 + 공백은 공백만 제거해 받음 (vault union 모델)", () => {
    const r = parsePRResponse(
      `### 한 줄 임팩트\nx\n\n### 카테고리\n뭐 모름\n`,
    );
    expect(r?.category).toBe("뭐모름");
  });

  it("카테고리 라인이 빈 응답 → other fallback", () => {
    const r = parsePRResponse(
      `### 한 줄 임팩트\nx\n\n### 카테고리\n\n`,
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

  it("H2 PR body 양식도 동일하게 파싱 (sync 자동 추출)", () => {
    const body = `## 한 줄 임팩트
차트 가독성 개선

## 문제 (Why)
기존 차트 안 보임

## Before
![before](url)

## After
![after](url)

## 디자인 결정
- 토큰 적용

## 유저가 얻는 것
- 한눈에 들어옴

## 카테고리
ui_ux
`;
    expect(parsePRResponse(body)).toEqual({
      impact: "차트 가독성 개선",
      category: "ui_ux",
    });
  });

  it("H2 PR body — 자유 슬러그 그대로 통과 (vault union 모델)", () => {
    const body = `## 한 줄 임팩트
뭔가 좋아짐

## 카테고리
무분류
`;
    expect(parsePRResponse(body)?.category).toBe("무분류");
  });
});
