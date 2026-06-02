import { describe, it, expect } from "vitest";

import { inferLineKind, inferLineKinds } from "./markdownLineKind";

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

  // depth 는 나눗셈이 아니라 containment 기반 — 아래는 모두 remark-gfm 실측과 대조.
  it("점목록 부모 밑 번호 자식 (2칸) = 1단계 (floor(2/3)=0 아님)", () => {
    const k = kindOfLastLine("- 부모\n  1. 자식");
    expect(k.type).toBe("ordered");
    expect(k.type === "ordered" && k.depth).toBe(1);
  });

  it("과들여쓰기 번호 자식 (6칸) = 1단계 (floor(6/3)=2 아님)", () => {
    const k = kindOfLastLine("1. 부모\n      1. 자식");
    expect(k.type === "ordered" && k.depth).toBe(1);
  });

  it("두 자리 부모(10.) 밑 점 자식 (4칸) = 1단계 (floor(4/2)=2 아님)", () => {
    const k = kindOfLastLine("10. 부모\n    - 자식");
    expect(k.type === "bullet" && k.depth).toBe(1);
  });

  it("점>번호>점 3단 혼합 = 2단계", () => {
    const k = kindOfLastLine("- a\n  1. b\n     - c");
    expect(k.type === "bullet" && k.depth).toBe(2);
  });

  it("같은 단계 형제는 같은 depth (점부모 밑 번호 형제)", () => {
    const k = kindOfLastLine("- 부모\n  1. 자식\n  2. 형제");
    expect(k.type === "ordered" && k.depth).toBe(1);
  });

  // 부모로 인정하려면 자식이 부모 content offset(마커 폭)까지 들여써야 함 — remark 실측.
  it("점부모 + 1칸 자식 = 형제 (depth 0, content offset 2 못 미침)", () => {
    const k = kindOfLastLine("- A\n - B");
    expect(k.type === "bullet" && k.depth).toBe(0);
  });

  it("점부모 + 2칸 자식 = 중첩 (depth 1)", () => {
    const k = kindOfLastLine("- A\n  - B");
    expect(k.type === "bullet" && k.depth).toBe(1);
  });

  it("번호부모(offset 3) + 2칸 자식 = 형제 (depth 0)", () => {
    const k = kindOfLastLine("1. A\n  - B");
    expect(k.type === "bullet" && k.depth).toBe(0);
  });

  it("번호부모(offset 3) + 3칸 자식 = 중첩 (depth 1)", () => {
    const k = kindOfLastLine("1. A\n   - B");
    expect(k.type === "bullet" && k.depth).toBe(1);
  });

  it("체크박스부모(nesting 마커 `- `=2) + 2칸 자식 = 중첩", () => {
    const k = kindOfLastLine("- [ ] A\n  - B");
    expect(k.type === "bullet" && k.depth).toBe(1);
  });
});

describe("inferLineKind — 부모 없는 4칸 마커는 list 아니라 코드", () => {
  // remark-gfm 실측: 최상위(부모 list 없음)에서 4칸 들여쓴 list 마커는 코드 블록.
  // list 안에서의 4칸은 정상 중첩이므로 코드 아님.
  it("부모 없이 4칸 번호 마커 (doc 시작) → code-indent", () => {
    expect(kindOfLastLine("    1. foo").type).toBe("code-indent");
  });

  it("부모 없이 4칸 점 마커 (doc 시작) → code-indent", () => {
    expect(kindOfLastLine("    - foo").type).toBe("code-indent");
  });

  it("빈 줄 뒤 4칸 번호 마커 → code-indent", () => {
    expect(kindOfLastLine("글.\n\n    1. foo").type).toBe("code-indent");
  });

  it("3칸 번호 마커는 여전히 list (코드 아님)", () => {
    expect(kindOfLastLine("   1. foo").type).toBe("ordered");
  });

  it("부모 list 안의 4칸 자식은 코드 아니라 중첩 list", () => {
    const k = kindOfLastLine("1. 부모\n    - 자식");
    expect(k.type).toBe("bullet");
    expect(k.type === "bullet" && k.depth).toBe(1);
  });

  it("3단 중첩의 4칸(점 c)도 코드 아니라 list", () => {
    expect(kindOfLastLine("- a\n  - b\n    - c").type).toBe("bullet");
  });
});

describe("inferLineKind — 들여쓰기 코드는 열린 단락/리스트/인용을 interrupt 못 함", () => {
  // remark-gfm 실측: 4칸 들여써도 바로 윗 줄이 단락/항목/인용 본문이면 그 lazy
  // continuation (코드 아님). 빈 줄·제목·구분선 뒤라야 코드 블록.
  it("단락 직후 4칸 평문 → 단락 이어짐 (코드 아님)", () => {
    expect(kindOfLastLine("글\n    텍스트").type).toBe("paragraph");
  });

  it("단락 직후 4칸 번호 마커 → 단락 이어짐 (코드도 list 도 아님)", () => {
    expect(kindOfLastLine("글\n    1. foo").type).toBe("paragraph");
  });

  it("4칸 줄 체인 — 둘째 줄도 단락 이어짐", () => {
    expect(kindOfLastLine("글\n    줄1\n    줄2").type).toBe("paragraph");
  });

  it("제목 직후 4칸 → 코드 (제목은 닫힌 블록)", () => {
    expect(kindOfLastLine("# 제목\n    텍스트").type).toBe("code-indent");
  });

  it("구분선 직후 4칸 → 코드", () => {
    expect(kindOfLastLine("***\n    텍스트").type).toBe("code-indent");
  });

  it("인용 직후 4칸 → 인용 이어짐", () => {
    const k = kindOfLastLine("> 인용\n    텍스트");
    expect(k.type).toBe("quote");
  });

  it("점항목 직후 4칸 평문 → 점목록 이어짐", () => {
    const k = kindOfLastLine("- 항목\n    텍스트");
    expect(k.type).toBe("bullet");
  });

  it("빈 줄 뒤 4칸 2줄 → 둘 다 코드", () => {
    expect(kindOfLastLine("글\n\n    줄1\n    줄2").type).toBe("code-indent");
  });
});

describe("inferLineKinds — 배치(O(n)) 는 단건(O(n²)) 과 동일 결과", () => {
  // O(n²) 제거 리팩터의 안전 속성: forward-pass fence 누적이 줄마다 처음부터
  // 재스캔하던 isInsideFencedCode 와 한 글자도 다르지 않아야 한다.
  function perLine(src: string) {
    const lines = src.split("\n");
    const out = [];
    let pos = 0;
    for (const line of lines) {
      out.push(inferLineKind(src, pos));
      pos += line.length + 1;
    }
    return out;
  }

  const DOCS = [
    "# 제목\n본문 한 줄\n\n- 점\n  1. 번호\n- 점2",
    "단락\n```\n코드 1\n코드 2\n```\n단락 뒤",
    "```ts\nconst a = 1;\n```\n\n## 다음\n> 인용\n    들여쓰기 코드",
    "열린 펜스\n~~~\n안 닫힘\n여전히 코드\n## 가짜 제목",
    "| a | b |\n| --- | --- |\n| 1 | 2 |\n\n글\n    4칸",
    "1. 하나\n   ```\n   중첩 코드\n   ```\n2. 둘",
  ];

  it.each(DOCS.map((d, i) => [i, d] as const))(
    "doc[%i] 배치 == 단건",
    (_i, doc) => {
      expect(inferLineKinds(doc)).toEqual(perLine(doc));
    },
  );

  it("빈 문자열 / 단일 줄도 동일", () => {
    expect(inferLineKinds("")).toEqual(perLine(""));
    expect(inferLineKinds("그냥 한 줄")).toEqual(perLine("그냥 한 줄"));
  });
});
