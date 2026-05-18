import { describe, it, expect } from "vitest";
import {
  parseVaultFile,
  serializeVaultFile,
  patchFrontmatter,
  patchBody,
} from "./parser";

describe("parseVaultFile", () => {
  it("frontmatter + body 분리", () => {
    const raw = `---
title: 회의
date: '2026-05-18'
---

본문 텍스트
`;
    const file = parseVaultFile(raw);
    expect(file.frontmatter.title).toBe("회의");
    expect(file.frontmatter.date).toBe("2026-05-18");
    expect(file.body).toBe("본문 텍스트");
  });

  it("frontmatter 없으면 빈 객체 + body 전체 보존", () => {
    const file = parseVaultFile("그냥 본문\n");
    expect(file.frontmatter).toEqual({});
    expect(file.body).toBe("그냥 본문");
  });

  it("본문 안 임의 H1 (예: # 본문) 도 body 텍스트로 그대로 유지 (sentinel X)", () => {
    const raw = `---
title: x
---

# 본문
A
# 회의 내용
B
# 요약
C
`;
    const file = parseVaultFile(raw);
    expect(file.body).toBe("# 본문\nA\n# 회의 내용\nB\n# 요약\nC");
  });

  it("손상된 frontmatter 는 빈 객체로 fallback", () => {
    const raw = `---
:::invalid yaml
---

body
`;
    const file = parseVaultFile(raw);
    expect(file.frontmatter).toEqual({});
    expect(file.body).toBe("body");
  });
});

describe("serializeVaultFile", () => {
  it("frontmatter + body 직렬화", () => {
    const raw = serializeVaultFile({
      raw: "",
      frontmatter: { title: "회의" },
      body: "본문",
    });
    expect(raw).toContain("title: 회의");
    expect(raw).toContain("\n\n본문\n");
  });

  it("frontmatter 없으면 body 만", () => {
    const raw = serializeVaultFile({
      raw: "",
      frontmatter: {},
      body: "raw body",
    });
    expect(raw).toBe("raw body\n");
  });
});

describe("patchFrontmatter", () => {
  it("기존 frontmatter merge — 미언급 키 보존", () => {
    const raw = `---
title: old
date: '2026-05-18'
---

body
`;
    const patched = patchFrontmatter(raw, { title: "new" });
    expect(patched).toContain("title: new");
    expect(patched).toContain("date: 2026-05-18");
    expect(patched).toContain("body");
  });

  it("null 값은 키 제거", () => {
    const raw = `---
title: x
time: '10:00'
---

body
`;
    const patched = patchFrontmatter(raw, { time: null });
    expect(patched).not.toContain("time:");
    expect(patched).toContain("title: x");
  });
});

describe("patchBody", () => {
  it("frontmatter 보존 + body 통째 교체", () => {
    const raw = `---
title: x
---

old body
`;
    const patched = patchBody(raw, "new body");
    expect(patched).toContain("title: x");
    expect(patched).toContain("new body");
    expect(patched).not.toContain("old body");
  });

  it("frontmatter 없으면 그냥 body", () => {
    const patched = patchBody("old", "new");
    expect(patched).toBe("new\n");
  });
});
