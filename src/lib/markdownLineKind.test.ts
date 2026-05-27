import { describe, it, expect } from "vitest";

import { inferLineKind } from "./markdownLineKind";

function kindOfLastLine(src: string) {
  return inferLineKind(src, src.length);
}

// 특정 줄(0-based)의 시작 위치 기준 kind. 헤더행처럼 마지막이 아닌 줄 검사용.
function kindOfLine(src: string, lineIdx: number) {
  const lines = src.split("\n");
  let pos = 0;
  for (let i = 0; i < lineIdx; i++) pos += lines[i].length + 1;
  return inferLineKind(src, pos);
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

describe("inferLineKind — 표는 구분행이 있어야 표 (GFM)", () => {
  // 실측(remark-gfm 4.0.1 / react-markdown 10): `|` 만으로는 표가 아니고
  // 헤더행 바로 밑 구분행(+컬럼 수 일치)이 있어야 표. gutter 가 이와 일치해야 함.
  it("구분행 없는 `| a | b |` 한 줄 → 표 아님 (단락)", () => {
    expect(kindOfLastLine("| a | b |").type).toBe("paragraph");
  });

  it("헤더 + 구분행 → 헤더행·구분행 모두 표", () => {
    const src = "| a | b |\n| --- | --- |";
    expect(kindOfLine(src, 0).type).toBe("table"); // 헤더
    expect(kindOfLastLine(src).type).toBe("table"); // 구분행
  });

  it("헤더 + 구분행 + 데이터 → 데이터행도 표", () => {
    expect(kindOfLastLine("| a | b |\n| --- | --- |\n| 1 | 2 |").type).toBe(
      "table",
    );
  });

  it("짧은 하이픈 `|-|-|` 구분행도 표", () => {
    expect(kindOfLastLine("| a | b |\n|-|-|").type).toBe("table");
  });

  it("정렬 콜론 구분행도 표", () => {
    expect(kindOfLastLine("| a | b |\n| :--- | ---: |").type).toBe("table");
  });

  it("컬럼 수 불일치(헤더2·구분1) → 표 아님", () => {
    const src = "| a | b |\n| --- |";
    expect(kindOfLine(src, 0).type).not.toBe("table");
    expect(kindOfLastLine(src).type).not.toBe("table");
  });

  it("`|` 텍스트 2줄(구분행 없음) → 표 아님", () => {
    expect(kindOfLastLine("| 메모 |\n| 또 메모 |").type).toBe("paragraph");
  });

  it("헤더 없는 구분행(첫 줄) → 표 아님", () => {
    const src = "| --- | --- |\n| 1 | 2 |";
    expect(kindOfLine(src, 0).type).not.toBe("table");
    expect(kindOfLastLine(src).type).not.toBe("table");
  });

  it("단락 직후 빈 줄 없는 표 → 표 (단락 interrupt)", () => {
    expect(kindOfLastLine("보통 문장\n| a | b |\n| --- | --- |").type).toBe(
      "table",
    );
  });
});

describe("inferLineKind — 목록 직후 빈 줄 없는 표 흡수", () => {
  // 목록 바로 다음(빈 줄 없이) 표는 구분행이 있어도 목록 항목 텍스트로 흡수돼
  // 렌더 안 됨 → gutter 는 표 X, 목록 이어짐.
  it("번호목록 직후 빈 줄 없는 표(구분행 포함) → 표 아님 (번호목록 이어짐)", () => {
    const k = kindOfLastLine("1. 하나\n| a | b |\n| --- | --- |");
    expect(k.type).toBe("ordered");
    expect("continuation" in k && k.continuation).toBe(true);
  });

  it("점목록 직후 빈 줄 없는 표 → 표 아님 (점목록 이어짐)", () => {
    const k = kindOfLastLine("- 하나\n| a | b |\n| --- | --- |");
    expect(k.type).toBe("bullet");
    expect("continuation" in k && k.continuation).toBe(true);
  });

  it("체크박스 직후 빈 줄 없는 표 → 표 아님 (체크박스 이어짐)", () => {
    const k = kindOfLastLine("- [ ] 하나\n| a | b |\n| --- | --- |");
    expect(k.type).toBe("checkbox");
    expect("continuation" in k && k.continuation).toBe(true);
  });

  it("번호목록 + 빈 줄 + 표 → 진짜 표", () => {
    expect(kindOfLastLine("1. 하나\n2. 둘\n\n| a | b |\n| --- | --- |").type).toBe(
      "table",
    );
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
