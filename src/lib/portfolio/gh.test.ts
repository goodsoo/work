import { describe, expect, it } from "vitest";
import {
  classifyGhError,
  GhAuthError,
  GhNotInstalledError,
  GhSyncError,
  shellSingleQuote,
} from "./gh";

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

describe("classifyGhError — stderr 패턴 분류", () => {
  it("sh: gh: command not found → GhNotInstalledError", () => {
    const err = classifyGhError("sh: gh: command not found", 127);
    expect(err).toBeInstanceOf(GhNotInstalledError);
  });

  it("code 127 단독 → GhNotInstalledError", () => {
    const err = classifyGhError("", 127);
    expect(err).toBeInstanceOf(GhNotInstalledError);
  });

  it("'You are not logged into any GitHub host' → GhAuthError", () => {
    const err = classifyGhError(
      "You are not logged into any GitHub hosts. Run gh auth login to authenticate.",
      1,
    );
    expect(err).toBeInstanceOf(GhAuthError);
    expect((err as GhAuthError).host).toBe("github.com");
  });

  it("'authentication required' → GhAuthError", () => {
    const err = classifyGhError("authentication required", 1);
    expect(err).toBeInstanceOf(GhAuthError);
  });

  it("일반 네트워크 에러 → GhSyncError fallback", () => {
    const err = classifyGhError("Could not resolve host: api.github.com", 1);
    expect(err).toBeInstanceOf(GhSyncError);
  });

  it("빈 stderr + code 1 → GhSyncError fallback", () => {
    const err = classifyGhError("", 1);
    expect(err).toBeInstanceOf(GhSyncError);
  });
});
