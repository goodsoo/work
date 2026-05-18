import { describe, it, expect } from "vitest";
import {
  parseVaultFile,
  patchSection,
  patchFrontmatter,
  serializeVaultFile,
} from "./parser";

const FULL_MEETING = `---
title: 팀 주간 회의
date: 2026-05-16
time: "14:00"
attendees:
  - 홍길동
  - 김철수
---

# 본문
회의 중 정리 노트
다음 줄

# 회의 내용
STT 결과 raw

# 요약
## 논의 사항
- 항목1
## 결정 사항
- 결정1
## 액션 아이템
- [ ] [홍길동] 보고서 — 5/22 #meeting
`;

describe("parseVaultFile", () => {
  it("정상 회의록을 frontmatter + 3 sections 로 split", () => {
    const file = parseVaultFile(FULL_MEETING);
    expect(file.frontmatter.title).toBe("팀 주간 회의");
    expect(file.frontmatter.date).toBe("2026-05-16");
    expect(file.frontmatter.time).toBe("14:00");
    expect(file.frontmatter.attendees).toEqual(["홍길동", "김철수"]);
    expect(file.sections.get("본문")).toContain("회의 중 정리 노트");
    expect(file.sections.get("회의 내용")).toBe("STT 결과 raw");
    expect(file.sections.get("요약")).toContain("## 논의 사항");
    expect(file.unmapped).toBe("");
  });

  it("frontmatter 없으면 빈 객체", () => {
    const file = parseVaultFile("# 본문\n내용\n");
    expect(file.frontmatter).toEqual({});
    expect(file.sections.get("본문")).toBe("내용");
  });

  it("H1 순서 뒤집혀도 매핑", () => {
    const raw = `# 요약
요약 내용

# 본문
본문 내용
`;
    const file = parseVaultFile(raw);
    expect(file.sections.get("본문")).toBe("본문 내용");
    expect(file.sections.get("요약")).toBe("요약 내용");
  });

  it("알려지지 않은 H1 은 unmapped 에 보존", () => {
    const raw = `# 본문
A
# 메모
B
`;
    const file = parseVaultFile(raw);
    expect(file.sections.get("본문")).toBe("A");
    expect(file.unmapped).toContain("# 메모");
    expect(file.unmapped).toContain("B");
  });

  it("손상된 frontmatter 는 빈 객체로 fallback (raw 보존)", () => {
    const raw = `---
this is: not: valid: yaml: at all
---

# 본문
내용
`;
    const file = parseVaultFile(raw);
    expect(file.frontmatter).toEqual({});
    expect(file.sections.get("본문")).toBe("내용");
  });

  it("코드블록 안의 # 라인은 H1 으로 인식하지 않음", () => {
    const raw = `# 본문
\`\`\`
# 이건 H1 아님
\`\`\`
끝
`;
    const file = parseVaultFile(raw);
    expect(file.sections.get("본문")).toContain("# 이건 H1 아님");
    expect(file.unmapped).toBe("");
  });

  it("빈 회의록도 알려진 3 sections 가 빈 문자열로 존재", () => {
    const raw = `---
title: 빈 회의
---

`;
    const file = parseVaultFile(raw);
    expect(file.sections.get("본문")).toBe("");
    expect(file.sections.get("회의 내용")).toBe("");
    expect(file.sections.get("요약")).toBe("");
  });
});

describe("patchFrontmatter", () => {
  it("기존 필드 유지 + 새 필드 추가", () => {
    const patched = patchFrontmatter(FULL_MEETING, { title: "수정된 제목" });
    expect(patched).toContain("title: 수정된 제목");
    expect(patched).toContain("date: 2026-05-16");
    // 본문은 그대로
    expect(patched).toContain("# 본문");
    expect(patched).toContain("회의 중 정리 노트");
  });

  it("frontmatter 없는 파일에 추가", () => {
    const raw = "# 본문\n내용\n";
    const patched = patchFrontmatter(raw, { title: "신규" });
    expect(patched.startsWith("---")).toBe(true);
    expect(patched).toContain("title: 신규");
    expect(patched).toContain("# 본문");
  });
});

describe("patchSection", () => {
  it("기존 섹션의 body 만 교체", () => {
    const patched = patchSection(FULL_MEETING, "본문", "새로운 본문");
    const file = parseVaultFile(patched);
    expect(file.sections.get("본문")).toBe("새로운 본문");
    // 다른 섹션 영향 없음
    expect(file.sections.get("회의 내용")).toBe("STT 결과 raw");
    expect(file.sections.get("요약")).toContain("## 액션 아이템");
    // frontmatter 유지
    expect(file.frontmatter.title).toBe("팀 주간 회의");
  });

  it("존재하지 않는 H1 추가 — body 끝에", () => {
    const raw = `---
title: T
---

# 본문
A
`;
    const patched = patchSection(raw, "요약", "## 액션 아이템\n- [ ] todo\n");
    const file = parseVaultFile(patched);
    expect(file.sections.get("본문")).toBe("A");
    expect(file.sections.get("요약")).toContain("## 액션 아이템");
  });
});

describe("serializeVaultFile", () => {
  it("round-trip: parse → serialize → 재파싱 시 동일 데이터", () => {
    const file = parseVaultFile(FULL_MEETING);
    const ser = serializeVaultFile(file);
    const reparsed = parseVaultFile(ser);
    expect(reparsed.frontmatter.title).toBe("팀 주간 회의");
    expect(reparsed.sections.get("본문")).toContain("회의 중 정리 노트");
    expect(reparsed.sections.get("회의 내용")).toBe("STT 결과 raw");
  });
});
