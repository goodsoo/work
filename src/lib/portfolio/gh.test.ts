import { describe, expect, it } from "vitest";
import { shellSingleQuote } from "./gh";

describe("shellSingleQuote (TODO-1 sh -lc 래핑)", () => {
  it("일반 문자열 → 양 끝 single-quote", () => {
    expect(shellSingleQuote("foo")).toBe("'foo'");
  });

  it("내부 single-quote → '\\'' escape", () => {
    expect(shellSingleQuote("it's")).toBe("'it'\\''s'");
  });

  it("공백 / 특수문자 안전", () => {
    expect(shellSingleQuote("a b c")).toBe("'a b c'");
    expect(shellSingleQuote("$(rm -rf /)")).toBe("'$(rm -rf /)'");
    expect(shellSingleQuote("a;b|c&d")).toBe("'a;b|c&d'");
  });

  it("빈 문자열", () => {
    expect(shellSingleQuote("")).toBe("''");
  });
});
