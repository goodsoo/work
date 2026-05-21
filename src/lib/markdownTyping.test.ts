import { describe, it, expect } from "vitest";
import {
  applyIndent,
  applyEnterContinue,
  applyUrlPaste,
  applyWrap,
  applyLineMove,
  applyLineDuplicate,
  parseLineMarker,
} from "./markdownTyping";

describe("parseLineMarker", () => {
  it("bullet", () => {
    expect(parseLineMarker("- hello")).toMatchObject({
      kind: "bullet",
      marker: "- ",
      rest: "hello",
    });
  });
  it("ordered", () => {
    expect(parseLineMarker("  3. third")).toMatchObject({
      kind: "ordered",
      indent: "  ",
      marker: "3. ",
      num: 3,
    });
  });
  it("checkbox", () => {
    expect(parseLineMarker("- [ ] todo")).toMatchObject({
      kind: "checkbox",
      marker: "- [ ] ",
      rest: "todo",
    });
  });
  it("quote", () => {
    expect(parseLineMarker("> quoted")).toMatchObject({
      kind: "quote",
      marker: "> ",
      rest: "quoted",
    });
  });
  it("no marker", () => {
    expect(parseLineMarker("plain")).toBeNull();
  });
});

describe("applyIndent", () => {
  it("single line: prepend 2-space", () => {
    const r = applyIndent("hello", 2, 2, false);
    expect(r).toEqual({ value: "  hello", start: 4, end: 4 });
  });
  it("single line shift: strip 2-space", () => {
    const r = applyIndent("  hello", 4, 4, true);
    expect(r).toEqual({ value: "hello", start: 2, end: 2 });
  });
  it("shift on bare line returns null", () => {
    expect(applyIndent("hello", 2, 2, true)).toBeNull();
  });
  it("multi-line: indent every line", () => {
    const r = applyIndent("a\nb\nc", 0, 5, false);
    expect(r?.value).toBe("  a\n  b\n  c");
    expect(r?.start).toBe(2);
    expect(r?.end).toBe(11);
  });
  it("bullet line indent → level 증가", () => {
    const r = applyIndent("- item", 6, 6, false);
    expect(r?.value).toBe("  - item");
  });
});

describe("applyEnterContinue", () => {
  it("bullet rest 있음 → marker 연장", () => {
    const r = applyEnterContinue("- hello", 7, 7);
    expect(r?.value).toBe("- hello\n- ");
    expect(r?.start).toBe(10);
  });
  it("ordered → num+1", () => {
    const r = applyEnterContinue("1. one", 6, 6);
    expect(r?.value).toBe("1. one\n2. ");
  });
  it("indented ordered → indent 유지 + num+1", () => {
    const r = applyEnterContinue("  3. x", 6, 6);
    expect(r?.value).toBe("  3. x\n  4. ");
  });
  it("checkbox → 빈 체크박스", () => {
    const r = applyEnterContinue("- [x] done", 10, 10);
    expect(r?.value).toBe("- [x] done\n- [ ] ");
  });
  it("empty marker → 줄 삭제", () => {
    const r = applyEnterContinue("- ", 2, 2);
    expect(r?.value).toBe("");
    expect(r?.start).toBe(0);
  });
  it("empty marker mid-doc → 그 줄만 비움", () => {
    const r = applyEnterContinue("first\n- \nthird", 8, 8);
    expect(r?.value).toBe("first\n\nthird");
  });
  it("no marker → null", () => {
    expect(applyEnterContinue("plain", 5, 5)).toBeNull();
  });
  it("selection 있음 → null (native)", () => {
    expect(applyEnterContinue("- hello", 2, 5)).toBeNull();
  });
});

describe("applyWrap", () => {
  it("bold wrap selection", () => {
    const r = applyWrap("hello world", 0, 5, "**");
    expect(r).toEqual({ value: "**hello** world", start: 2, end: 7 });
  });
  it("bold unwrap when selection includes marks", () => {
    const r = applyWrap("**hello** world", 0, 9, "**");
    expect(r.value).toBe("hello world");
  });
  it("bold unwrap when marks are outside selection", () => {
    const r = applyWrap("**hello** world", 2, 7, "**");
    expect(r.value).toBe("hello world");
    expect(r.start).toBe(0);
    expect(r.end).toBe(5);
  });
  it("italic wrap empty selection → caret 가운데", () => {
    const r = applyWrap("ab", 1, 1, "*");
    expect(r.value).toBe("a**b");
    expect(r.start).toBe(2);
    expect(r.end).toBe(2);
  });
  it("inline-code wrap selection", () => {
    const r = applyWrap("run npm install now", 4, 15, "`");
    expect(r).toEqual({ value: "run `npm install` now", start: 5, end: 16 });
  });
  it("inline-code unwrap when selection 양옆이 ` 이미 있음", () => {
    const r = applyWrap("run `code` now", 5, 9, "`");
    expect(r.value).toBe("run code now");
    expect(r.start).toBe(4);
    expect(r.end).toBe(8);
  });
});

describe("applyIndent — marker 폭 적응", () => {
  it("bullet 줄 Tab = 2-space", () => {
    const r = applyIndent("- foo", 5, 5, false);
    expect(r?.value).toBe("  - foo");
    expect(r?.start).toBe(7);
  });
  it("ordered 1. 줄 Tab = 3-space (CommonMark nest 요구)", () => {
    const r = applyIndent("1. foo", 6, 6, false);
    expect(r?.value).toBe("   1. foo");
    expect(r?.start).toBe(9);
  });
  it("ordered 10. 줄 Tab = 4-space + marker 1 로 재설정", () => {
    const r = applyIndent("10. foo", 7, 7, false);
    // marker 폭 4 spaces prepend + 마커 자체는 "10." → "1." 로 줄어듦.
    expect(r?.value).toBe("    1. foo");
  });
  it("nest 진입 시 marker 번호를 1 로 재설정 (paragraph interrupt 규칙)", () => {
    // Enter 자동 연장이 만든 "2. 둘" 을 Tab 하면 그냥 indent 만 더해선 nest 안 됨.
    // marker 도 "1." 로 바꿔야 CommonMark 가 sublist 로 인식.
    const v = "1. 하나\n2. 둘";
    const caret = v.length;
    const r = applyIndent(v, caret, caret, false);
    expect(r?.value).toBe("1. 하나\n   1. 둘");
  });
  it("ordered Shift+Tab = marker 폭만큼 떼기", () => {
    const r = applyIndent("   1. foo", 9, 9, true);
    expect(r?.value).toBe("1. foo");
  });
});

describe("applyLineMove", () => {
  it("down: swap with next line", () => {
    const r = applyLineMove("a\nb\nc", 0, 0, "down");
    expect(r?.value).toBe("b\na\nc");
    expect(r?.start).toBe(2);
  });
  it("up: swap with previous line", () => {
    const r = applyLineMove("a\nb\nc", 2, 2, "up");
    expect(r?.value).toBe("b\na\nc");
    expect(r?.start).toBe(0);
  });
  it("at top boundary up → null", () => {
    expect(applyLineMove("a\nb", 0, 0, "up")).toBeNull();
  });
  it("at bottom boundary down → null", () => {
    expect(applyLineMove("a\nb", 3, 3, "down")).toBeNull();
  });
  it("multi-line block move down", () => {
    const r = applyLineMove("a\nb\nc\nd", 0, 3, "down");
    expect(r?.value).toBe("c\na\nb\nd");
  });
});

describe("applyLineDuplicate", () => {
  it("single line duplicate", () => {
    const r = applyLineDuplicate("hello", 3, 3);
    expect(r.value).toBe("hello\nhello");
    expect(r.start).toBe(9);
  });
  it("multi-line block duplicate", () => {
    const r = applyLineDuplicate("a\nb\nc", 0, 3);
    expect(r.value).toBe("a\nb\na\nb\nc");
  });
});

describe("applyUrlPaste", () => {
  it("selection 위에 URL paste → markdown link", () => {
    const r = applyUrlPaste("see google here", 4, 10, "https://google.com");
    expect(r?.value).toBe("see [google](https://google.com) here");
  });
  it("selection 없으면 null", () => {
    expect(applyUrlPaste("plain", 5, 5, "https://x.com")).toBeNull();
  });
  it("URL 아니면 null", () => {
    expect(applyUrlPaste("ab", 0, 2, "not a url")).toBeNull();
  });
  it("선택이 URL 이면 null (그냥 교체)", () => {
    expect(
      applyUrlPaste("see https://a.com here", 4, 17, "https://b.com"),
    ).toBeNull();
  });
});
