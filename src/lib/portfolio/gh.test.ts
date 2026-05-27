import { describe, expect, it } from "vitest";
import {
  classifyGhError,
  GhAuthError,
  GhNotInstalledError,
  GhSyncError,
  LOGIN_SHELL_PROGRAM,
  loginShellArgs,
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

describe("loginShellArgs — release Finder PATH fix", () => {
  // 회귀: release .app(Finder 실행)은 launchd 최소 PATH 라 gh(~/.local/bin)·claude(nvm)
  // 가 PATH 밖. `sh -lc` 로 되돌리면 .bash_profile 미로딩 → command not found 로 깨짐.
  it("bash login 셸로 래핑 (sh 아님)", () => {
    expect(LOGIN_SHELL_PROGRAM).toBe("bash");
  });

  it("-lc + 명령 문자열을 그대로 args 로", () => {
    expect(loginShellArgs("gh --version")).toEqual(["-lc", "gh --version"]);
    expect(loginShellArgs("command -v gh")).toEqual(["-lc", "command -v gh"]);
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
