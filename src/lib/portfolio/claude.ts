import { Command, type Child } from "@tauri-apps/plugin-shell";
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

// 스트리밍 호출 — 자동 요약 모달이 진행 상황(경과시간·도착 글자·토큰)을 보여주려고 쓴다.
// --output-format stream-json --verbose --include-partial-messages 로 NDJSON 라인이
// 토큰 단위로 흘러나옴: content_block_delta(텍스트) / message_delta·result(usage).
// Tauri shell 의 stdout 'data' 는 라인 단위(개행 strip)라 chunk 마다 "\n" 재부착 후 split.

export type ClaudeStreamProgress = {
  chars: number;
  outputTokens?: number;
  model?: string;
};

export type ClaudeStreamResult = {
  code: number | null;
  text: string;
  stderr: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  model?: string;
  errored: boolean;
};

export type ClaudeStreamController = {
  done: Promise<ClaudeStreamResult>;
  cancel: () => Promise<void>;
};

export function runClaudeStream(
  prompt: string,
  onProgress?: (p: ClaudeStreamProgress) => void,
): ClaudeStreamController {
  // /tmp 에서 실행 → 프로젝트 CLAUDE.md/memory 미로드, --strict-mcp-config → MCP 0개,
  // --model sonnet → opus 대비 속도/비용 대폭 절감 (요약은 단순 추출이라 sonnet 충분).
  // 실측: opus+프로젝트컨텍스트 12s/$0.18 → sonnet+중립cwd+MCP0 4.7s/$0.04.
  const cmdStr =
    `cd /tmp && claude -p ${shellSingleQuote(prompt)}` +
    " --model sonnet --strict-mcp-config" +
    " --output-format stream-json --verbose --include-partial-messages";
  const cmd = Command.create(LOGIN_SHELL_PROGRAM, loginShellArgs(cmdStr));

  let text = ""; // delta 누적 (live 글자수 + 최종 fallback)
  let finalText = ""; // result 이벤트의 정제된 최종 텍스트
  let stderr = "";
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let durationMs: number | undefined;
  let model: string | undefined;
  let resultErr = false;
  let buf = "";

  let childRef: Child | null = null;
  let canceled = false;

  const done = new Promise<ClaudeStreamResult>((resolve) => {
    let settled = false;
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      resolve({
        code,
        text: (finalText || text).trim(),
        stderr: stderr.trim(),
        inputTokens,
        outputTokens,
        durationMs,
        model,
        errored: resultErr,
      });
    };

    const emitProgress = () =>
      onProgress?.({ chars: text.length, outputTokens, model });

    const parseLine = (line: string) => {
      let obj: unknown;
      try {
        obj = JSON.parse(line);
      } catch {
        return; // 부분 라인/비 JSON 무시
      }
      if (!obj || typeof obj !== "object") return;
      const o = obj as Record<string, any>;
      if (o.type === "system" && o.subtype === "init") {
        if (typeof o.model === "string") {
          model = o.model;
          emitProgress();
        }
      } else if (o.type === "stream_event") {
        const ev = o.event;
        if (ev?.type === "content_block_delta" && ev.delta?.type === "text_delta") {
          text += ev.delta.text ?? "";
          emitProgress();
        } else if (ev?.type === "message_start") {
          inputTokens = ev.message?.usage?.input_tokens ?? inputTokens;
        } else if (ev?.type === "message_delta") {
          outputTokens = ev.usage?.output_tokens ?? outputTokens;
          emitProgress();
        }
      } else if (o.type === "result") {
        if (typeof o.result === "string" && o.result) finalText = o.result;
        outputTokens = o.usage?.output_tokens ?? outputTokens;
        inputTokens = o.usage?.input_tokens ?? inputTokens;
        durationMs = o.duration_ms ?? durationMs;
        if (o.is_error) resultErr = true;
        emitProgress();
      }
    };

    const flush = () => {
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (line) parseLine(line);
      }
    };

    cmd.stdout.on("data", (chunk: string) => {
      buf += chunk + "\n";
      flush();
    });
    cmd.stderr.on("data", (chunk: string) => {
      stderr += chunk + "\n";
    });
    cmd.on("close", (payload: { code: number | null }) => {
      flush();
      finish(payload?.code ?? null);
    });
    cmd.on("error", (err: string) => {
      stderr += String(err) + "\n";
      finish(null);
    });

    cmd
      .spawn()
      .then((child) => {
        childRef = child;
        if (canceled) void child.kill().catch(() => {});
      })
      .catch((err) => {
        stderr += String(err) + "\n";
        finish(null);
      });
  });

  return {
    done,
    cancel: async () => {
      canceled = true;
      try {
        await childRef?.kill();
      } catch {
        // 이미 종료됐으면 무시
      }
    },
  };
}
