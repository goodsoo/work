// V0.7 "내 작업" 탭 — vault 기반 PR 카드 데이터 모델 + 식별자 helpers + scan.
//
// design doc v2.3 (ENG + DESIGN CLEAR):
//   ~/.gstack/projects/goodsoob-work/ham-main-design-20260518-105501.md
//
// Step 1 = schema + interface lock-in. Step 2 = scanPortfolio + watcher 확장.
// Step 4 = sync orchestration (search + enrich, 본인 수정 필드 보존).
// useMeetings 등 기존 vault 패턴과 동형이라 step 6 hook 도 같은 시그니처로 붙음.

import yaml from "js-yaml";

import type { VaultAdapter } from "../lib/vault/adapter";
import {
  ghEnrichPR,
  ghSearchMyPRs,
  type GhPRDetail,
  type GhSearchResult,
} from "../lib/portfolio/gh";
import { downloadImageToVault } from "../lib/portfolio/imageDownload";
import { extractPRBodyImages, planImagePaths } from "../lib/portfolio/imageImport";

export const PORTFOLIO_DIR = "portfolio";
export const PROJECTS_FILE = "portfolio/projects.md";
export const SYNCED_FILE = "portfolio/.synced.md";
export const ATTACHMENTS_DIR = "portfolio/_attachments";

// ─────────────────────────────────────────────────────────────────────────────
// Enums / unions

export type PortfolioCategory = "ui_ux" | "backend" | "infra" | "fix" | "other";

export const PORTFOLIO_CATEGORIES: readonly PortfolioCategory[] = [
  "ui_ux",
  "backend",
  "infra",
  "fix",
  "other",
] as const;

export type PortfolioState = "merged" | "closed";

export type ScreenshotLabel = "before" | "after" | null;

// ─────────────────────────────────────────────────────────────────────────────
// Frontmatter schema

export interface PortfolioScreenshot {
  // vault root 상대 경로. 예: "portfolio/_attachments/owner-repo-123/before-1.jpg"
  path: string;
  label: ScreenshotLabel;
  caption: string;
}

export interface PortfolioWorkFrontmatter {
  type: "portfolio-work";

  // GitHub 원본 (gh sync 가 read-only 로 채움 — 본인 수정해도 다음 sync 덮어씀)
  // github_pr_id = GitHub 내부 PR ID (영구 불변). owner/repo rename 후에도 같음.
  // sync 가 이 id 로 vault 카드 매칭 → rename 자동 감지.
  // optional = 옛 V0.7 카드 (id 없이 만들어진 카드) 호환.
  github_pr_id?: number;
  github_owner: string;
  github_repo: string;
  github_pr_number: number;
  github_pr_url: string;
  github_state: PortfolioState;
  github_merged_at: string; // ISO 8601
  github_title: string;
  github_changed_files: number;
  github_additions: number;
  github_deletions: number;

  // 본인 수정 가능 (sync 가 보존 — 다음 sync 가 덮어쓰지 않음)
  project: string; // projects.md 의 slug. 빈 문자열 = "분류안됨".
  included: boolean; // 평가 자료 포함 여부. 신규 카드 default true.
  category: PortfolioCategory;
  impact_summary: string; // 한 줄 임팩트. ClipPromptButton paste 시 채움. 빈 문자열 OK.
  screenshots: PortfolioScreenshot[];

  synced_at: string; // ISO 8601. 마지막 enrich 시점.
}

export interface PortfolioWork {
  prSlug: string; // 파일 basename (확장자 제외). 예: "owner-repo-123"
  frontmatter: PortfolioWorkFrontmatter;
  description: string; // body 의 "## Description (from GitHub)" 섹션
  notes: string; // body 의 "## Notes" 섹션
  filePath: string; // "portfolio/{pr-slug}.md"
  mtime: number; // optimistic concurrency
}

export interface PortfolioProject {
  slug: string; // kebab-case
  name: string;
  description?: string;
  color?: string;
  sort: number;
  // repo nameWithOwner ("owner/repo") 리스트. sync 시 신규 카드를 이 project 로 자동 분류.
  // 비면 자동 분류 X (본인이 카드 메뉴 "프로젝트 변경" 으로 수동).
  repos?: string[];
}

export interface PortfolioSyncState {
  last_sync: string | null; // ISO 8601. null = 한 번도 sync 안 함.
  last_sync_pr_count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Identifier helpers
//
// owner / repo / number 는 모두 immutable → 한 번 정한 prSlug 는 rename 안 함.

export function prSlug(owner: string, repo: string, number: number): string {
  return `${owner}-${repo}-${number}`;
}

// gh search 의 repository.nameWithOwner ("owner/repo") 형태에서 직접.
export function prSlugFromNameWithOwner(
  nameWithOwner: string,
  number: number,
): string {
  const [owner, repo] = nameWithOwner.split("/");
  return prSlug(owner, repo, number);
}

export function portfolioWorkPath(slug: string): string {
  return `${PORTFOLIO_DIR}/${slug}.md`;
}

export function attachmentsDirFor(slug: string): string {
  return `${ATTACHMENTS_DIR}/${slug}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Defaults — sync 가 신규 카드 만들 때 본인 수정 필드 초기값

export type PortfolioUserFields = Pick<
  PortfolioWorkFrontmatter,
  "project" | "included" | "category" | "impact_summary" | "screenshots"
>;

export function defaultUserFields(): PortfolioUserFields {
  return {
    project: "",
    included: true,
    category: "other",
    impact_summary: "",
    screenshots: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Body sections (H2) — Description / Notes

export const DESCRIPTION_HEADER = "## Description (from GitHub)";
export const NOTES_HEADER = "## Notes";

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*(\n|$)/;

// 부분 view — 카드 그리드 / 사이드바 카운트용 (description / notes 본문 제외).
export interface PortfolioWorkMeta {
  prSlug: string;
  frontmatter: PortfolioWorkFrontmatter;
  filePath: string;
  mtime: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Frontmatter validation

function isPortfolioState(v: unknown): v is PortfolioState {
  return v === "merged" || v === "closed";
}

function isCategory(v: unknown): v is PortfolioCategory {
  return (
    typeof v === "string" &&
    (PORTFOLIO_CATEGORIES as readonly string[]).includes(v)
  );
}

function fmStr(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return fallback;
}

function fmNum(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function fmBool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}

function fmScreenshots(v: unknown): PortfolioScreenshot[] {
  if (!Array.isArray(v)) return [];
  const out: PortfolioScreenshot[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const path = fmStr(obj.path);
    if (!path) continue;
    const label = obj.label === "before" || obj.label === "after"
      ? (obj.label as "before" | "after")
      : null;
    out.push({ path, label, caption: fmStr(obj.caption) });
  }
  return out;
}

// 손상/누락 frontmatter → null. scan 에서는 skip, 외부 에디터 직접 편집 방어.
// pr_number=0 = legacy 카드 (PR 없이 직접 커밋 → 본인 또는 claude 가 수동 작성).
// owner/repo 만 필수, pr_number 는 음수만 reject.
export function parsePortfolioFrontmatter(
  fm: Record<string, unknown>,
): PortfolioWorkFrontmatter | null {
  if (fm.type !== "portfolio-work") return null;
  const github_owner = fmStr(fm.github_owner);
  const github_repo = fmStr(fm.github_repo);
  const github_pr_number = fmNum(fm.github_pr_number);
  if (!github_owner || !github_repo || github_pr_number < 0) return null;

  const idRaw = fmNum(fm.github_pr_id, 0);
  return {
    type: "portfolio-work",
    github_pr_id: idRaw > 0 ? idRaw : undefined,
    github_owner,
    github_repo,
    github_pr_number,
    github_pr_url: fmStr(fm.github_pr_url),
    github_state: isPortfolioState(fm.github_state) ? fm.github_state : "merged",
    github_merged_at: fmStr(fm.github_merged_at),
    github_title: fmStr(fm.github_title),
    github_changed_files: fmNum(fm.github_changed_files),
    github_additions: fmNum(fm.github_additions),
    github_deletions: fmNum(fm.github_deletions),
    project: fmStr(fm.project),
    included: fmBool(fm.included, true), // 누락 시 default true (v2.2 T4-NEW)
    category: isCategory(fm.category) ? fm.category : "other",
    impact_summary: fmStr(fm.impact_summary),
    screenshots: fmScreenshots(fm.screenshots),
    synced_at: fmStr(fm.synced_at),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Body parsing — frontmatter 분리 후 H2 split (Description / Notes)

function stripFrontmatter(
  raw: string,
): { fm: Record<string, unknown>; body: string } {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return { fm: {}, body: raw };
  let fm: Record<string, unknown> = {};
  try {
    const parsed = yaml.load(match[1], { schema: yaml.JSON_SCHEMA });
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      fm = parsed as Record<string, unknown>;
    }
  } catch {
    fm = {};
  }
  return { fm, body: raw.slice(match[0].length) };
}

// "## Description (from GitHub)" / "## Notes" 사이로 분할. 헤더 외 H2 는 보존 안 함
// (PR 카드 외 H2 는 owner-edit 영역인 Notes 안에 들어가야 함).
export function splitPortfolioBody(
  body: string,
): { description: string; notes: string } {
  const descIdx = body.indexOf(DESCRIPTION_HEADER);
  const notesIdx = body.indexOf(NOTES_HEADER);

  const sliceSection = (startHeader: string, startIdx: number): string => {
    if (startIdx < 0) return "";
    // Header line 끝까지 skip
    const afterHeader = startIdx + startHeader.length;
    const newlineAfter = body.indexOf("\n", afterHeader);
    const contentStart = newlineAfter < 0 ? body.length : newlineAfter + 1;
    // 다음 section 시작 찾기 — header 자체와 다른 시작점 중 contentStart 이후 가장 가까운 것
    const candidates = [
      descIdx === startIdx ? -1 : descIdx,
      notesIdx === startIdx ? -1 : notesIdx,
    ].filter((i) => i >= contentStart);
    const end = candidates.length === 0 ? body.length : Math.min(...candidates);
    return body.slice(contentStart, end).replace(/^\n+/, "").replace(/\n+$/, "");
  };

  return {
    description: sliceSection(DESCRIPTION_HEADER, descIdx),
    notes: sliceSection(NOTES_HEADER, notesIdx),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// File → PortfolioWork

export function fileToPortfolioWork(
  filePath: string,
  raw: string,
  mtime: number,
): PortfolioWork | null {
  const { fm, body } = stripFrontmatter(raw);
  const frontmatter = parsePortfolioFrontmatter(fm);
  if (!frontmatter) return null;

  const { description, notes } = splitPortfolioBody(body);
  const base = filePath.split("/").pop() ?? filePath;
  const slug = base.replace(/\.md$/, "");

  return {
    prSlug: slug,
    frontmatter,
    description,
    notes,
    filePath,
    mtime,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Scan portfolio dir (v2.2 flat — projects.md / .synced.md skip,
// _attachments/ 는 dir 라 adapter.list 의 isFile 필터로 자동 제외).

const PORTFOLIO_SKIP = new Set<string>([
  "portfolio/projects.md",
  "portfolio/.synced.md",
]);

export async function scanPortfolio(
  adapter: VaultAdapter,
): Promise<PortfolioWorkMeta[]> {
  const files = await adapter.list(PORTFOLIO_DIR);
  const results: PortfolioWorkMeta[] = [];
  for (const path of files) {
    if (!path.endsWith(".md")) continue;
    if (PORTFOLIO_SKIP.has(path)) continue;
    try {
      const raw = await adapter.read(path);
      const meta = await adapter.readMeta(path);
      const work = fileToPortfolioWork(path, raw, meta.mtime);
      if (!work) continue; // type 불일치 / 손상 → skip
      results.push({
        prSlug: work.prSlug,
        frontmatter: work.frontmatter,
        filePath: work.filePath,
        mtime: work.mtime,
      });
    } catch {
      // 손상된 파일 skip (vault 패턴)
    }
  }
  // github_merged_at desc, mtime desc 정렬 (평가 자료 = 최근 작업 위)
  results.sort((a, b) => {
    const da = a.frontmatter.github_merged_at;
    const db = b.frontmatter.github_merged_at;
    if (da !== db) return db.localeCompare(da);
    return b.mtime - a.mtime;
  });
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Single read / serialize

export async function readPortfolioWork(
  adapter: VaultAdapter,
  slug: string,
): Promise<PortfolioWork | null> {
  const path = portfolioWorkPath(slug);
  if (!(await adapter.exists(path))) return null;
  const raw = await adapter.read(path);
  const meta = await adapter.readMeta(path);
  return fileToPortfolioWork(path, raw, meta.mtime);
}

const DESCRIPTION_TRUNCATE_AT = 5000;
const TRUNCATED_MARKER = "\n\n...(truncated)";

function truncateDescription(body: string): string {
  if (body.length <= DESCRIPTION_TRUNCATE_AT) return body;
  return body.slice(0, DESCRIPTION_TRUNCATE_AT) + TRUNCATED_MARKER;
}

export function portfolioWorkToRaw(work: PortfolioWork): string {
  const fm = yaml.dump(work.frontmatter, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
    schema: yaml.JSON_SCHEMA,
  });
  // body: H2 두 섹션. 빈 섹션이라도 헤더는 보존 (옵시디안에서 카드 형식 인식).
  return (
    `---\n${fm.trimEnd()}\n---\n\n` +
    `${DESCRIPTION_HEADER}\n\n${work.description}\n\n` +
    `${NOTES_HEADER}\n\n${work.notes}\n`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync state (.synced.md) — last_sync 만 (tombstone 폐기, v2.2 T4-NEW)

export async function readSyncState(
  adapter: VaultAdapter,
): Promise<PortfolioSyncState> {
  if (!(await adapter.exists(SYNCED_FILE))) {
    return { last_sync: null, last_sync_pr_count: 0 };
  }
  const raw = await adapter.read(SYNCED_FILE);
  const { fm } = stripFrontmatter(raw);
  return {
    last_sync: fmStr(fm.last_sync) || null,
    last_sync_pr_count: fmNum(fm.last_sync_pr_count),
  };
}

export async function writeSyncState(
  adapter: VaultAdapter,
  state: PortfolioSyncState,
): Promise<void> {
  await adapter.mkdir(PORTFOLIO_DIR);
  const fm = yaml.dump(state, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
    schema: yaml.JSON_SCHEMA,
  });
  const body =
    `---\n${fm.trimEnd()}\n---\n\n# Sync state\n\n` +
    `마지막 성공한 sync 시점. \`since=last_sync\` 가 다음 sync 의 ` +
    `\`merged:>=\` qualifier 로 전달됨.\n`;
  await adapter.write(SYNCED_FILE, body);
}

// ─────────────────────────────────────────────────────────────────────────────
// Upsert — sync 가 신규 카드 만들거나 기존 카드 refresh.
//
// preserveUserFields 가 있으면 본인 수정 필드 (project / included / category /
// impact_summary / screenshots) + notes 본문 보존 → sync 가 덮어쓰지 않음 (v2.2 3A).

export interface UpsertPortfolioWorkInput {
  search: GhSearchResult;
  detail: GhPRDetail;
  // 기존 카드 — 있으면 본인 수정 필드 보존, 없으면 default.
  existing?: PortfolioWork | null;
  // projects.md 의 entries — 신규 카드의 project 자동 매핑에 사용.
  // 기존 카드는 본인 수정 보존 (v2.2 3A) — 매핑이 덮어쓰지 않음.
  projects?: PortfolioProject[];
  // V0.7.x — PR body 이미지에서 자동 추출/다운로드한 스크린샷.
  // existing.screenshots 가 비었을 때만 사용 (본인 dropzone 박은 거 보존).
  importedScreenshots?: PortfolioScreenshot[];
}

export async function upsertPortfolioWork(
  adapter: VaultAdapter,
  input: UpsertPortfolioWorkInput,
): Promise<PortfolioWork> {
  const { search, detail, existing, projects, importedScreenshots } = input;
  const [owner, repo] = search.repository.nameWithOwner.split("/");
  const slug = prSlug(owner, repo, search.number);
  const path = portfolioWorkPath(slug);

  const autoProject = projects
    ? projectSlugForRepo(projects, search.repository.nameWithOwner)
    : "";

  // PR body 이미지 자동 import: existing.screenshots 가 비었을 때만 사용.
  // 본인이 옵시디안에서 박은 거 (length > 0) 는 sync 가 덮어쓰지 않음 (보존).
  const existingScreenshots = existing?.frontmatter.screenshots ?? [];
  const screenshots: PortfolioScreenshot[] =
    existingScreenshots.length > 0
      ? existingScreenshots
      : (importedScreenshots ?? []);

  const userFields: PortfolioUserFields = existing
    ? {
        // 본인이 명시 분류한 project 는 보존, "분류안됨" (빈) 이면 자동 매핑.
        // included/category/impact 는 무조건 보존 (3A).
        project: existing.frontmatter.project || autoProject,
        included: existing.frontmatter.included,
        category: existing.frontmatter.category,
        impact_summary: existing.frontmatter.impact_summary,
        screenshots,
      }
    : { ...defaultUserFields(), project: autoProject, screenshots };

  // body 우선순위: detail.body (gh pr view, 더 fresh) > search.body (gh search prs).
  const rawDescription = detail.body || search.body || "";

  const frontmatter: PortfolioWorkFrontmatter = {
    type: "portfolio-work",
    github_pr_id: search.id, // 영구 식별자 — rename 자동 감지에 사용
    github_owner: owner,
    github_repo: repo,
    github_pr_number: search.number,
    github_pr_url: search.url,
    github_state: "merged", // search 단계에서 is:merged filter, post-filter (state === "closed")
    github_merged_at: detail.mergedAt,
    github_title: search.title,
    github_changed_files: detail.changedFiles,
    github_additions: detail.additions,
    github_deletions: detail.deletions,
    ...userFields,
    synced_at: new Date().toISOString(),
  };

  const work: PortfolioWork = {
    prSlug: slug,
    frontmatter,
    description: truncateDescription(rawDescription),
    notes: existing?.notes ?? "",
    filePath: path,
    mtime: 0,
  };

  const meta = await adapter.write(path, portfolioWorkToRaw(work));
  return { ...work, mtime: meta.mtime };
}

// ─────────────────────────────────────────────────────────────────────────────
// Projects (projects.md frontmatter — 사이드바 그룹 source of truth)

function parseProjectEntry(item: unknown): PortfolioProject | null {
  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;
  const slug = fmStr(obj.slug);
  const name = fmStr(obj.name);
  if (!slug || !name) return null;
  const repos = Array.isArray(obj.repos)
    ? obj.repos.filter((r): r is string => typeof r === "string" && r.includes("/"))
    : undefined;
  return {
    slug,
    name,
    description: fmStr(obj.description) || undefined,
    color: fmStr(obj.color) || undefined,
    sort: fmNum(obj.sort, 0),
    repos: repos && repos.length > 0 ? repos : undefined,
  };
}

// repo nameWithOwner → project slug 룩업. 매칭 없으면 빈 문자열 (분류안됨).
export function projectSlugForRepo(
  projects: PortfolioProject[],
  nameWithOwner: string,
): string {
  for (const p of projects) {
    if (p.repos?.includes(nameWithOwner)) return p.slug;
  }
  return "";
}

// repo → slug 자동 생성 (부트스트랩 용). nameWithOwner 의 "/" 를 "-" 로.
// "company-org/dashboard" → "company-org-dashboard"
function slugFromRepo(nameWithOwner: string): string {
  return nameWithOwner
    .toLowerCase()
    .replace(/[^a-z0-9/-]/g, "-")
    .replace(/\//g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

// 첫 sync 후 projects.md 가 비었을 때 1회 부트스트랩.
// 가져온 PR 들의 unique nameWithOwner 마다 1 project 씩 생성 (slug = kebab-case).
// 본인이 이후 옵시디안/UI 에서 merge/split 가능 (회사 멀티-repo 프로젝트는 본인이 묶기).
export function buildBootstrapProjects(
  repos: string[],
): PortfolioProject[] {
  const unique = Array.from(new Set(repos)).sort();
  return unique.map((r, i) => ({
    slug: slugFromRepo(r),
    name: r, // 일단 nameWithOwner 그대로 — 본인이 옵시디안에서 한국어로 rename
    sort: i + 1,
    repos: [r],
  }));
}

export async function readPortfolioProjects(
  adapter: VaultAdapter,
): Promise<PortfolioProject[]> {
  if (!(await adapter.exists(PROJECTS_FILE))) return [];
  const raw = await adapter.read(PROJECTS_FILE);
  const { fm } = stripFrontmatter(raw);
  if (!Array.isArray(fm.projects)) return [];
  const list = fm.projects
    .map(parseProjectEntry)
    .filter((p): p is PortfolioProject => p !== null);
  list.sort((a, b) => {
    if (a.sort !== b.sort) return a.sort - b.sort;
    return a.name.localeCompare(b.name);
  });
  return list;
}

export async function writePortfolioProjects(
  adapter: VaultAdapter,
  projects: PortfolioProject[],
): Promise<void> {
  const fm = yaml.dump(
    { projects },
    {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
      schema: yaml.JSON_SCHEMA,
    },
  );
  const body =
    `---\n${fm.trimEnd()}\n---\n\n# Portfolio Projects\n\n` +
    `V0.7 "내 작업" 탭 사이드바의 source. frontmatter \`projects\` 배열을 ` +
    `수정하면 사이드바 반영. slug 는 kebab-case (폴더명 호환).\n`;
  await adapter.write(PROJECTS_FILE, body);
}

// ─────────────────────────────────────────────────────────────────────────────
// Rename helper — github_pr_id 매칭 후 옛 파일/디렉토리 → 새 slug.

async function renamePortfolioCard(
  adapter: VaultAdapter,
  oldSlug: string,
  newSlug: string,
): Promise<void> {
  const oldPath = portfolioWorkPath(oldSlug);
  const newPath = portfolioWorkPath(newSlug);
  // 새 path 에 이미 파일 있으면 (다른 PR 과 slug 충돌 등) 옛 카드를 .trash 로 도피.
  if (await adapter.exists(newPath)) {
    await adapter.mkdir(".trash");
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    await adapter.rename(oldPath, `.trash/${stamp}-rename-conflict-${oldSlug}.md`);
  } else {
    await adapter.rename(oldPath, newPath);
  }
  // _attachments/{oldSlug}/ → _attachments/{newSlug}/ (best effort, 없으면 skip)
  const oldAttach = `${ATTACHMENTS_DIR}/${oldSlug}`;
  const newAttach = `${ATTACHMENTS_DIR}/${newSlug}`;
  try {
    if (await adapter.exists(oldAttach)) {
      await adapter.rename(oldAttach, newAttach);
    }
  } catch {
    // 디렉토리 rename 실패 — Tauri/OS 의존, best effort
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync orchestration (v2.2 — 4A 직렬, 1B atomic per-PR, 3A 보존)

export interface SyncPortfolioResult {
  added: number;
  preserved: number;
  total: number;
}

export interface SyncPortfolioOpts {
  // since 미지정 = 전체 (첫 sync 또는 .synced.md 미존재).
  since?: string;
  // 테스트 / mock 용 injection. default 인자로 hide → call site 변경 0 (v2.2 3A test #8).
  searchFn?: typeof ghSearchMyPRs;
  enrichFn?: typeof ghEnrichPR;
  // PR body 이미지 다운로드 (Tauri shell+curl 위임). 테스트 / mock 용 injection.
  downloadFn?: (relPath: string, url: string) => Promise<void>;
  // 진행률 콜백 (modal). current = 0-indexed, total = 전체 PR 수.
  onProgress?: (current: number, total: number) => void;
  // 사용자 cancel.
  signal?: AbortSignal;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const err = new Error("sync cancelled");
    err.name = "AbortError";
    throw err;
  }
}

// gh pr view / curl 동시 호출 상한. gh CLI 한 호출당 1-2초, curl 다운로드 0.3-2초
// — 5 동시로 wall clock 1/5 단축. 너무 키우면 GitHub rate limit + macOS 의 sh fork
// 부하 (현실적 5 면 안정).
const NETWORK_CONCURRENCY = 5;

// p-limit 류 dep 안 쓰고 fixed-size worker pool 로 처리. abort/error 는 worker
// 안에서 throw → Promise.all 이 즉시 reject (다른 worker 도 다음 i++ 안 집어듦).
async function processWithConcurrency<I, O>(
  items: I[],
  concurrency: number,
  worker: (item: I, index: number) => Promise<O>,
  signal: AbortSignal | undefined,
  onItemDone?: () => void,
): Promise<O[]> {
  const results = new Array<O>(items.length);
  let next = 0;
  async function run(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      throwIfAborted(signal);
      results[i] = await worker(items[i], i);
      onItemDone?.();
    }
  }
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, run));
  return results;
}

export async function syncPortfolio(
  adapter: VaultAdapter,
  opts: SyncPortfolioOpts = {},
): Promise<SyncPortfolioResult> {
  const search = opts.searchFn ?? ghSearchMyPRs;
  const enrich = opts.enrichFn ?? ghEnrichPR;
  const download =
    opts.downloadFn ??
    ((relPath: string, url: string) =>
      downloadImageToVault(adapter, relPath, url));

  throwIfAborted(opts.signal);
  await adapter.mkdir(PORTFOLIO_DIR); // 기존 vault (V0.6) 에 portfolio/ 없는 경우 보장
  const results = await search({ since: opts.since, limit: 1000 });
  // gh search prs 의 --json state 는 GraphQL enum 으로 "OPEN"/"CLOSED"/"MERGED"
  // (대문자) 가 일반적. 안전하게 case-insensitive + MERGED 포함.
  const closed = results.filter((pr) => {
    const s = (pr.state || "").toUpperCase();
    return s === "CLOSED" || s === "MERGED";
  });

  // 부트스트랩: projects.md 가 비었고 가져온 PR 이 있으면 unique repo 별로
  // default project 1개씩 자동 생성 (1 repo = 1 project, slug = kebab nameWithOwner).
  // 본인이 옵시디안/UI 에서 이후 merge/split 가능.
  let projects = await readPortfolioProjects(adapter);
  if (projects.length === 0 && closed.length > 0) {
    const uniqueRepos = closed.map((pr) => pr.repository.nameWithOwner);
    projects = buildBootstrapProjects(uniqueRepos);
    await writePortfolioProjects(adapter, projects);
  }

  // vault scan → github_pr_id + slug 인덱스. rename 자동 감지 + 본인 screenshots 보존에 사용.
  const allWorks = await scanPortfolio(adapter);
  const byId = new Map<number, PortfolioWorkMeta>();
  const bySlug = new Map<string, PortfolioWorkMeta>();
  for (const w of allWorks) {
    const id = w.frontmatter.github_pr_id;
    if (id) byId.set(id, w);
    bySlug.set(w.prSlug, w);
  }

  // Phase A: 각 PR 의 enrich + (필요 시) PR body 이미지 다운로드. 5 concurrency 로
  // wall clock 의 대부분 (gh pr view + curl) 을 N/5 로 압축. progress 콜백은 PR 완료
  // 카운트 기준 (사용자가 체감하는 "GitHub 에서 가져오는" 진행도).
  let progressDone = 0;
  const phaseA = await processWithConcurrency(
    closed,
    NETWORK_CONCURRENCY,
    async (pr) => {
      const detail = await enrich(pr.url);

      // PR body 이미지 자동 import: existing.screenshots 가 비었을 때만.
      // 본인 dropzone 박은 거 (length > 0) 는 보존.
      const [owner, repo] = pr.repository.nameWithOwner.split("/");
      const slug = prSlug(owner, repo, pr.number);
      const existingMeta = byId.get(pr.id) ?? bySlug.get(slug);
      const existingShots = existingMeta?.frontmatter.screenshots ?? [];

      const imported: PortfolioScreenshot[] = [];
      if (existingShots.length === 0) {
        const images = extractPRBodyImages(detail.body);
        if (images.length > 0) {
          const plan = planImagePaths(slug, images);
          for (const { image, relPath } of plan) {
            try {
              const already = await adapter.exists(relPath);
              if (!already) await download(relPath, image.url);
              imported.push({
                path: relPath,
                label: image.label,
                caption: image.caption,
              });
            } catch {
              // best effort — 실패한 이미지는 다음 sync 가 재시도.
            }
          }
        }
      }
      return { detail, imported };
    },
    opts.signal,
    () => {
      progressDone++;
      opts.onProgress?.(progressDone, closed.length);
    },
  );

  // Phase B: vault write 는 직렬 — file rename / write 충돌 / id 매칭 race 회피.
  let added = 0;
  let preserved = 0;
  let projectsMutated = false;
  for (let i = 0; i < closed.length; i++) {
    throwIfAborted(opts.signal);
    const pr = closed[i];
    const [owner, repo] = pr.repository.nameWithOwner.split("/");
    const newSlug = prSlug(owner, repo, pr.number);

    // 1) id 매칭 — owner/repo rename 감지. slug 다르면 옛 파일을 새 slug 로 이동.
    const idMatch = byId.get(pr.id);
    if (idMatch && idMatch.prSlug !== newSlug) {
      const oldNameWithOwner = `${idMatch.frontmatter.github_owner}/${idMatch.frontmatter.github_repo}`;
      await renamePortfolioCard(adapter, idMatch.prSlug, newSlug);
      // projects.md repos 자동 갱신 (옛 nameWithOwner → 새)
      for (const p of projects) {
        if (p.repos?.includes(oldNameWithOwner)) {
          p.repos = p.repos.map((r) =>
            r === oldNameWithOwner ? pr.repository.nameWithOwner : r,
          );
          projectsMutated = true;
        }
      }
    }

    // 2) existing fetch (rename 후 새 slug 또는 같은 slug)
    const existing = await readPortfolioWork(adapter, newSlug);
    await upsertPortfolioWork(adapter, {
      search: pr,
      detail: phaseA[i].detail,
      existing,
      projects, // 신규 카드 자동 매핑
      importedScreenshots: phaseA[i].imported,
    });
    if (existing) preserved++;
    else added++;
  }
  opts.onProgress?.(closed.length, closed.length);

  if (projectsMutated) {
    await writePortfolioProjects(adapter, projects);
  }

  await writeSyncState(adapter, {
    last_sync: new Date().toISOString(),
    last_sync_pr_count: closed.length,
  });

  return { added, preserved, total: closed.length };
}
