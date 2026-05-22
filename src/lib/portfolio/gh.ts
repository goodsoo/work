// V0.7 — gh CLI 위임 (sh -lc 래핑).
//
// design v2.3, TODO-1: Tauri macOS login shell PATH 상속 X →
// 모든 gh 호출은 `Command.create("sh", ["-lc", "gh ..."])` 패턴.
// `sh -lc` 가 사용자 login shell 환경 로딩 → brew (Apple Silicon /opt/homebrew/bin,
// Intel /usr/local/bin), ~/.local/bin, Windows PATH 모두 호환.

import { Command } from "@tauri-apps/plugin-shell";

export class GhError extends Error {
  stderr: string;
  code: number | null;
  constructor(message: string, opts: { stderr?: string; code?: number | null } = {}) {
    super(message);
    this.name = "GhError";
    this.stderr = opts.stderr ?? "";
    this.code = opts.code ?? null;
  }
}

export class GhSyncError extends GhError {
  constructor(stderr: string, code: number | null) {
    super(`gh sync 실패: ${stderr || "code " + code}`, { stderr, code });
    this.name = "GhSyncError";
  }
}

export class GhAuthError extends GhError {
  host: string;
  constructor(host: string, stderr = "") {
    super(`gh 인증 안 됨 (${host}). 터미널에서 \`gh auth login\` 실행 필요.`, {
      stderr,
    });
    this.name = "GhAuthError";
    this.host = host;
  }
}

export class GhNotInstalledError extends GhError {
  constructor(stderr = "") {
    super("gh CLI 가 설치되지 않았습니다. macOS: `brew install gh`, Windows: `winget install GitHub.cli`", {
      stderr,
    });
    this.name = "GhNotInstalledError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Low-level shell wrapper

// single-quote 안에 들어갈 값을 안전하게 escape.
// shell escape rule: ' → '\'' (close, escaped quote, reopen).
export function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

// gh 명령어를 sh -lc 안에서 실행. 인자는 각각 single-quoted.
export interface ShCommandResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

export async function runGh(args: string[]): Promise<ShCommandResult> {
  const cmdStr = `gh ${args.map(shellSingleQuote).join(" ")}`;
  const cmd = Command.create("sh", ["-lc", cmdStr]);
  const output = await cmd.execute();
  return {
    stdout: output.stdout,
    stderr: output.stderr,
    code: output.code,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth check
//
// `gh auth token --hostname <host>` 은 로그인 시 토큰 출력 + exit 0,
// 안 되어 있으면 exit 1. adversarial review #6: `gh auth status` 보다 reliable.

export async function ghAuthCheck(host: string = "github.com"): Promise<boolean> {
  try {
    const result = await runGh(["auth", "token", "--hostname", host]);
    return result.code === 0 && result.stdout.trim().length > 0;
  } catch {
    // shell 실행 자체 실패 = gh 미설치 가능성 (또는 sh 자체 부재)
    return false;
  }
}

// gh 자체 존재 여부 (auth 와 무관).
// `command -v gh` 가 exit 0 이면 PATH 에 있음.
export async function ghIsInstalled(): Promise<boolean> {
  try {
    const cmd = Command.create("sh", ["-lc", "command -v gh"]);
    const output = await cmd.execute();
    return output.code === 0 && output.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// gh search / pr view — design v2.3 Step 1 / Step 2

export interface GhSearchResult {
  id: number; // GitHub 내부 PR ID (rename / 이전 모두 불변, 영구 식별자)
  number: number;
  title: string;
  body: string;
  url: string;
  state: string; // "open" | "closed" (search 는 merged 별도 노출 안 함, post-filter)
  closedAt: string;
  repository: { nameWithOwner: string }; // "owner/repo"
}

export interface GhPRDetail {
  mergedAt: string;
  changedFiles: number;
  additions: number;
  deletions: number;
  body: string;
}

// gh search prs --author @me --merged [--merged-at >=since].
// limit default 1000 (gh 자동 페이지네이션 X — V0.7.x 에서 페이지 처리 추가).
//
// V0.7.x bug fix: 옛 코드는 positional `'is:merged merged:>=DATE'` 로 두 qualifier 를
// 한 arg 에 넣었는데 gh search prs 가 빈 배열을 반환 (positional 안 `>=` 연산자
// 미지원 추정). `--merged --merged-at '>=DATE'` flag 형으로 변경 — 같은 의미,
// 정상 동작. since 없는 full sync 는 `--merged` 만으로 충분.
export async function ghSearchMyPRs(
  opts: { since?: string; limit?: number } = {},
): Promise<GhSearchResult[]> {
  const args = [
    "search",
    "prs",
    "--author",
    "@me",
    "--merged",
    "--limit",
    String(opts.limit ?? 1000),
    "--json",
    "id,number,title,body,url,state,closedAt,repository",
  ];
  if (opts.since) {
    args.push("--merged-at", `>=${opts.since}`);
  }
  const result = await runGh(args);
  if (result.code !== 0) throw new GhSyncError(result.stderr, result.code);
  try {
    return JSON.parse(result.stdout) as GhSearchResult[];
  } catch (err) {
    throw new GhSyncError(
      `gh search 출력 파싱 실패: ${err instanceof Error ? err.message : String(err)}`,
      result.code,
    );
  }
}

// gh pr view <url> --json mergedAt,changedFiles,additions,deletions,body
export async function ghEnrichPR(url: string): Promise<GhPRDetail> {
  const args = [
    "pr",
    "view",
    url,
    "--json",
    "mergedAt,changedFiles,additions,deletions,body",
  ];
  const result = await runGh(args);
  if (result.code !== 0) throw new GhSyncError(result.stderr, result.code);
  try {
    return JSON.parse(result.stdout) as GhPRDetail;
  } catch (err) {
    throw new GhSyncError(
      `gh pr view 출력 파싱 실패: ${err instanceof Error ? err.message : String(err)}`,
      result.code,
    );
  }
}
