import { Command } from "@tauri-apps/plugin-shell";
import {
  LOGIN_SHELL_PROGRAM,
  loginShellArgs,
  shellSingleQuote,
  type ShCommandResult,
} from "./gh";

// Claude Code CLI (`claude -p <prompt>`) 호출. 구독 로그인 (~/.claude OAuth) 자격으로 동작 — API key 불필요.
// portfolio sync 가 gh 부르는 패턴과 동일. bash login 셸 안에서 single-quoted arg
// (claude 는 nvm 경로 → release Finder 실행에선 login 셸 PATH 가 필수, gh.ts 헤더 참조).

export async function runClaude(prompt: string): Promise<ShCommandResult> {
  // claude -p '<prompt>' — prompt 는 인자로 전달, ' 는 '\'' 으로 escape.
  // shell arg max (macOS ~1MB) 안에서 buildPRPrompt 출력 (~5KB) 안전.
  const cmdStr = `claude -p ${shellSingleQuote(prompt)}`;
  const cmd = Command.create(LOGIN_SHELL_PROGRAM, loginShellArgs(cmdStr));
  const output = await cmd.execute();
  return { stdout: output.stdout, stderr: output.stderr, code: output.code };
}
