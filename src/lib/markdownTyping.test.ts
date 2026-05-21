import { describe, it, expect } from "vitest";
import {
  applyIndent,
  applyEnterContinue,
  applyUrlPaste,
  applyWrap,
  applyLineMove,
  applyLineDuplicate,
  applyLineKindTransform,
  detectSlashTrigger,
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

describe("applyLineKindTransform", () => {
  it("paragraph → heading prepend", () => {
    const r = applyLineKindTransform("hello", 5, { type: "heading", level: 1 });
    expect(r.value).toBe("# hello");
    expect(r.start).toBe(7);
  });
  it("paragraph → bullet prepend", () => {
    const r = applyLineKindTransform("hello", 0, { type: "bullet" });
    expect(r.value).toBe("- hello");
  });
  it("bullet → checkbox 교체 (marker 만 바뀜)", () => {
    const r = applyLineKindTransform("- foo bar", 5, { type: "checkbox" });
    expect(r.value).toBe("- [ ] foo bar");
  });
  it("ordered → bullet 교체", () => {
    const r = applyLineKindTransform("1. foo", 3, { type: "bullet" });
    expect(r.value).toBe("- foo");
  });
  it("heading → paragraph (marker 제거)", () => {
    const r = applyLineKindTransform("## hi", 5, { type: "paragraph" });
    expect(r.value).toBe("hi");
  });
  it("indent 보존 — 들여쓴 bullet → checkbox", () => {
    const r = applyLineKindTransform("  - foo", 5, { type: "checkbox" });
    expect(r.value).toBe("  - [ ] foo");
  });
  it("여러 줄 중 caret 줄만 변환", () => {
    const value = "first\nhello\nthird";
    const caret = value.indexOf("hello") + 2; // "he|llo"
    const r = applyLineKindTransform(value, caret, { type: "heading", level: 2 });
    expect(r.value).toBe("first\n## hello\nthird");
  });
  it("hr → 줄 통째로 ---", () => {
    const r = applyLineKindTransform("anything", 4, { type: "hr" });
    expect(r.value).toBe("---");
  });
  it("code-fence → fence pair (multi-line)", () => {
    const r = applyLineKindTransform("", 0, { type: "code-fence" });
    expect(r.value).toBe("```\n\n```");
  });
});

describe("detectSlashTrigger", () => {
  it("빈 줄 column 0 의 `/` → trigger", () => {
    const r = detectSlashTrigger("/", 1);
    expect(r).toEqual({ slashStart: 0, filter: "" });
  });
  it("indent 뒤 `/` → trigger", () => {
    const r = detectSlashTrigger("  /", 3);
    expect(r).toEqual({ slashStart: 2, filter: "" });
  });
  it("`/h1` filter 매칭", () => {
    const r = detectSlashTrigger("/h1", 3);
    expect(r).toEqual({ slashStart: 0, filter: "h1" });
  });
  it("bullet marker 뒤 `/` → trigger (marker 교체 시나리오)", () => {
    const r = detectSlashTrigger("- /", 3);
    expect(r).toEqual({ slashStart: 2, filter: "" });
  });
  it("일반 텍스트 중 `/` → null", () => {
    expect(detectSlashTrigger("foo /", 5)).toBeNull();
  });
  it("URL 안의 `/` → null", () => {
    expect(detectSlashTrigger("https://", 8)).toBeNull();
  });
  it("filter 안에 공백 → null (filter 끊김)", () => {
    expect(detectSlashTrigger("/h 1", 4)).toBeNull();
  });
  it("이전 줄에 텍스트 있어도 현재 줄 빈 곳이면 trigger", () => {
    const value = "first line\n/";
    const r = detectSlashTrigger(value, value.length);
    expect(r).toEqual({ slashStart: 11, filter: "" });
  });
});
