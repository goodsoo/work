import { describe, it, expect } from "vitest";

import { inferLineKind } from "./markdownLineKind";

function kindOfLastLine(src: string) {
  return inferLineKind(src, src.length);
}

describe("inferLineKind — ordered list paragraph-interrupt 규칙", () => {
  it("top-level ordered (indent=0) 은 number 무관 ordered", () => {
    expect(kindOfLastLine("1. foo").type).toBe("ordered");
    expect(kindOfLastLine("5. foo").type).toBe("ordered");
  });

  it("indented 1. marker 는 nest 진입 — ordered 로 인식", () => {
    const src = "1. 하나\n   1. 둘";
    const k = kindOfLastLine(src);
    expect(k.type).toBe("ordered");
  });

  it("indented 비-1 marker 는 paragraph continuation (CommonMark interrupt 금지)", () => {
    const src = "1. 하나\n   2. 둘";
    const k = kindOfLastLine(src);
    // findContinuationKind 가 위 ordered 줄을 발견해 continuation 으로 표시.
    // gutter 는 이걸 ContinuationGlyph (점선) 으로 그림 — "2." 칩 X.
    const isContinuation = "continuation" in k && k.continuation === true;
    expect(isContinuation).toBe(true);
  });

  it("같은 indent 에 직전 ordered sibling 이 있으면 비-1 marker 도 ordered (sublist 의 N번째)", () => {
    const src = "1. 하나\n   1. nested\n   2. sibling";
    const k = kindOfLastLine(src);
    expect(k.type).toBe("ordered");
  });

  it("blank line 있어도 직전 sibling 인식", () => {
    const src = "1. 하나\n   1. nested\n\n   2. ???";
    const k = kindOfLastLine(src);
    expect(k.type).toBe("ordered");
  });
});

describe("inferLineKind — depth 계산", () => {
  it("bullet 2-space = 1단계, 4-space = 2단계", () => {
    const k1 = kindOfLastLine("- a\n  - b");
    expect(k1.type === "bullet" && k1.depth).toBe(1);
    const k2 = kindOfLastLine("- a\n  - b\n    - c");
    expect(k2.type === "bullet" && k2.depth).toBe(2);
  });

  it("ordered 3-space = 1단계 (marker 폭 기준)", () => {
    const k = kindOfLastLine("1. a\n   1. b");
    expect(k.type === "ordered" && k.depth).toBe(1);
  });
});
