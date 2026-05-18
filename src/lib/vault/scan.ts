import type { VaultAdapter } from "./adapter";
import {
  parseVaultFile,
  serializeVaultFile,
  patchFrontmatter,
  patchBody,
} from "./parser";
import { extractTodos, type TodoItem } from "./tasks";

// ─────────────────────────────────────────────────────────────────────────────
// Types — UI/hooks 가 다루는 형태

export interface MeetingMeta {
  id: string; // 메인 파일 path (e.g. "meetings/2026-05-16-팀-주간회의.md")
  title: string;
  date: string | null;
  time: string | null;
  attendees: string[];
  tags: string[];
  mtime: number;
  // V0.5.3 호환 필드 (UI 가 의존). vault 에선 파일 mtime 사용.
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Meeting extends MeetingMeta {
  content: string;
  transcript: string;
  discussion_items: string[];
  decisions: string[];
  action_items: string[];
}

export interface JournalMeta {
  id: string; // file path
  date: string;
  mtime: number;
}

export interface Journal extends JournalMeta {
  content: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidecar path helpers — 메인 파일과 같은 폴더에 `.transcript.md` / `.summary.md`.
// 한 회의 = 3 파일. sidecar 는 frontmatter 없는 raw markdown.
// 본문 안에 사용자가 `# 본문` 같은 H1 적어도 충돌 0 (in-band sentinel X).

export function transcriptPath(mainPath: string): string {
  return mainPath.replace(/\.md$/, ".transcript.md");
}

export function summaryPath(mainPath: string): string {
  return mainPath.replace(/\.md$/, ".summary.md");
}

const SIDECAR_RE = /\.(transcript|summary)\.md$/;

export function isMeetingSidecar(path: string): boolean {
  return SIDECAR_RE.test(path);
}

export function meetingMainPath(path: string): string {
  return path.replace(SIDECAR_RE, ".md");
}

// ─────────────────────────────────────────────────────────────────────────────
// Frontmatter helpers

function fmString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
}

function fmStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (typeof value === "string" && value.trim() !== "") {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary body — `## 논의 사항` / `## 결정 사항` / `## 액션 아이템` H2 list 형식.
// summary sidecar 파일 안 markdown.

export function extractH2List(summaryBody: string, h2Label: string): string[] {
  const lines = summaryBody.split("\n");
  let inSection = false;
  const items: string[] = [];
  for (const line of lines) {
    const h2 = line.match(/^## (.+?)\s*$/);
    if (h2) {
      inSection = h2[1] === h2Label;
      continue;
    }
    if (!inSection) continue;
    const bullet = line.match(/^\s*- (?:\[[ x]\]\s+)?(.+?)\s*$/);
    if (bullet) items.push(bullet[1]);
  }
  return items;
}

export function buildH2List(
  h2Label: string,
  items: string[],
  withCheckbox = false,
): string {
  if (items.length === 0) return `## ${h2Label}\n`;
  const lines = items
    .map((it) => (withCheckbox ? `- [ ] ${it}` : `- ${it}`))
    .join("\n");
  return `## ${h2Label}\n${lines}\n`;
}

export function buildSummaryBody(parts: {
  discussion_items: string[];
  decisions: string[];
  action_items: string[];
}): string {
  return [
    buildH2List("논의 사항", parts.discussion_items),
    buildH2List("결정 사항", parts.decisions),
    buildH2List("액션 아이템", parts.action_items, true),
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// File → Meeting/Journal

// 메인 파일 + 두 sidecar raw 받아서 합쳐서 Meeting 객체. sidecar 가 없으면 빈 string.
export function fileToMeeting(
  filePath: string,
  mainRaw: string,
  transcriptRaw: string,
  summaryRaw: string,
  mtime: number,
): Meeting {
  const main = parseVaultFile(mainRaw);
  const fm = main.frontmatter;
  const isoMtime = new Date(mtime || Date.now()).toISOString();
  const isInTrash = filePath.startsWith(".trash/");

  const summary = transcriptOrSummaryBody(summaryRaw);

  return {
    id: filePath,
    title: fmString(fm.title) ?? filePathToTitle(filePath),
    date: fmString(fm.date),
    time: fmString(fm.time),
    attendees: fmStringArray(fm.attendees),
    tags: fmStringArray(fm.tags),
    mtime,
    created_at: isoMtime,
    updated_at: isoMtime,
    deleted_at: isInTrash ? isoMtime : null,
    content: main.body,
    transcript: transcriptOrSummaryBody(transcriptRaw),
    discussion_items: extractH2List(summary, "논의 사항"),
    decisions: extractH2List(summary, "결정 사항"),
    action_items: extractH2List(summary, "액션 아이템"),
  };
}

// sidecar 파일은 일반적으로 frontmatter 없는 raw markdown. 다만 외부 에디터가 frontmatter 끼워넣어도
// 본문만 회수.
function transcriptOrSummaryBody(raw: string): string {
  if (!raw) return "";
  return parseVaultFile(raw).body;
}

export function fileToJournal(
  filePath: string,
  raw: string,
  mtime: number,
): Journal {
  const file = parseVaultFile(raw);
  const fm = file.frontmatter;
  return {
    id: filePath,
    date: fmString(fm.date) ?? filePathToDate(filePath),
    mtime,
    content: file.body,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Build Meeting → 3 raw files

export function meetingToMainRaw(meeting: Meeting): string {
  const frontmatter: Record<string, unknown> = {
    title: meeting.title,
  };
  if (meeting.date) frontmatter.date = meeting.date;
  if (meeting.time) frontmatter.time = meeting.time;
  if (meeting.attendees.length > 0) frontmatter.attendees = meeting.attendees;
  if (meeting.tags.length > 0) frontmatter.tags = meeting.tags;

  return serializeVaultFile({
    raw: "",
    frontmatter,
    body: meeting.content,
  });
}

export function meetingToTranscriptRaw(meeting: Meeting): string {
  return meeting.transcript.length > 0 ? `${meeting.transcript}\n` : "";
}

export function meetingToSummaryRaw(meeting: Meeting): string {
  const body = buildSummaryBody({
    discussion_items: meeting.discussion_items,
    decisions: meeting.decisions,
    action_items: meeting.action_items,
  });
  // 모두 비어있으면 빈 string — sidecar 파일 자체를 안 만듦.
  if (
    meeting.discussion_items.length === 0 &&
    meeting.decisions.length === 0 &&
    meeting.action_items.length === 0
  ) {
    return "";
  }
  return body;
}

export function journalToRaw(journal: Journal): string {
  return serializeVaultFile({
    raw: "",
    frontmatter: { date: journal.date },
    body: journal.content,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Patch helpers — 부분 patch. meetings.ts api 가 사용.

export function patchMeetingMainBody(raw: string, newContent: string): string {
  return patchBody(raw, newContent);
}

export function patchMeetingFrontmatter(
  raw: string,
  updates: Record<string, unknown>,
): string {
  return patchFrontmatter(raw, updates);
}

// ─────────────────────────────────────────────────────────────────────────────
// Filename helpers

export function slugify(title: string): string {
  return title
    .trim()
    .replace(/[/:\\]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function filePathToTitle(filePath: string): string {
  const base = filePath.split("/").pop() ?? filePath;
  const m = base.match(/^\d{4}-\d{2}-\d{2}-(.+)\.md$/);
  return m ? m[1].replace(/-/g, " ") : base.replace(/\.md$/, "");
}

function filePathToDate(filePath: string): string {
  const base = filePath.split("/").pop() ?? filePath;
  const m = base.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

// meetings/YYYY-MM-DD-{slug}.md, 충돌 시 -2 suffix
export async function generateMeetingPath(
  adapter: VaultAdapter,
  date: string,
  title: string,
): Promise<string> {
  const slug = slugify(title) || "untitled";
  const base = `meetings/${date}-${slug}`;
  let candidate = `${base}.md`;
  let n = 2;
  while (await adapter.exists(candidate)) {
    candidate = `${base}-${n}.md`;
    n++;
  }
  return candidate;
}

export function journalPath(date: string): string {
  return `journals/${date}.md`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scan operations

export async function scanMeetings(adapter: VaultAdapter): Promise<MeetingMeta[]> {
  const files = await adapter.list("meetings");
  const results: MeetingMeta[] = [];
  for (const path of files) {
    if (!path.endsWith(".md")) continue;
    if (isMeetingSidecar(path)) continue; // sidecar 는 scan 대상 X
    try {
      const raw = await adapter.read(path);
      const meta = await adapter.readMeta(path);
      // meta-only — sidecar 안 읽어도 OK. fileToMeeting 으로 frontmatter 만 회수.
      const m = fileToMeeting(path, raw, "", "", meta.mtime);
      results.push({
        id: m.id,
        title: m.title,
        date: m.date,
        time: m.time,
        attendees: m.attendees,
        tags: m.tags,
        mtime: m.mtime,
        created_at: m.created_at,
        updated_at: m.updated_at,
        deleted_at: m.deleted_at,
      });
    } catch {
      // 손상된 파일 skip
    }
  }
  results.sort((a, b) => {
    const da = a.date ?? "";
    const db = b.date ?? "";
    if (da !== db) return db.localeCompare(da);
    return b.mtime - a.mtime;
  });
  return results;
}

export async function scanJournals(adapter: VaultAdapter): Promise<JournalMeta[]> {
  const files = await adapter.list("journals");
  const results: JournalMeta[] = [];
  for (const path of files) {
    if (!path.endsWith(".md")) continue;
    try {
      const meta = await adapter.readMeta(path);
      const date = filePathToDate(path);
      results.push({ id: path, date, mtime: meta.mtime });
    } catch {
      // skip
    }
  }
  results.sort((a, b) => b.date.localeCompare(a.date));
  return results;
}

// vault 전체 *.md 스캔 → 모든 todo 추출 (휴지통 제외). sidecar 도 source 가 됨 (summary 의 action_items).
export async function scanAllTodos(adapter: VaultAdapter): Promise<TodoItem[]> {
  const todoFiles: string[] = [];
  todoFiles.push(...(await adapter.list("")));
  todoFiles.push(...(await adapter.list("meetings")));
  todoFiles.push(...(await adapter.list("journals")));

  const items: TodoItem[] = [];
  for (const path of todoFiles) {
    if (!path.endsWith(".md")) continue;
    if (path.startsWith(".") || path.startsWith(".trash/")) continue;
    try {
      const raw = await adapter.read(path);
      // sidecar 면 메인 path 로 source 보고 → todo extractor 가 같은 meeting 의 항목으로 group.
      const sourcePath = isMeetingSidecar(path) ? meetingMainPath(path) : path;
      items.push(...extractTodos(sourcePath, raw));
    } catch {
      // skip
    }
  }
  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Trash (soft delete: .trash/ 폴더로 이동, 옵시디안 호환)

export async function trashFile(
  adapter: VaultAdapter,
  filePath: string,
): Promise<string> {
  return trashFileWithStamp(adapter, filePath, freshStamp());
}

// stamp 를 외부에서 주입 가능 — 메인 + sidecar 를 같은 stamp 로 묶기 위해 사용.
export async function trashFileWithStamp(
  adapter: VaultAdapter,
  filePath: string,
  stamp: string,
): Promise<string> {
  await adapter.mkdir(".trash");
  const base = filePath.replace(/^.*\//, "");
  const trashPath = `.trash/${stamp}-${base}`;
  await adapter.rename(filePath, trashPath);
  return trashPath;
}

export function freshStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export async function restoreFromTrash(
  adapter: VaultAdapter,
  trashPath: string,
): Promise<string> {
  // ".trash/2026-05-17T14-09-18-{원본base}" → 원본 base 추출
  const base = trashPath.replace(/^\.trash\//, "").replace(
    /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-/,
    "",
  );
  // 원본 폴더 구조 추정: meetings/* 또는 journals/* 또는 root
  let target: string;
  if (base.match(/^\d{4}-\d{2}-\d{2}-/) && !base.startsWith("journals/")) {
    target = `meetings/${base}`;
  } else if (base.match(/^\d{4}-\d{2}-\d{2}\.md$/)) {
    target = `journals/${base}`;
  } else {
    target = base;
  }
  // 충돌 회피
  let n = 2;
  let candidate = target;
  while (await adapter.exists(candidate)) {
    const dot = target.lastIndexOf(".");
    candidate = `${target.slice(0, dot)}-${n}${target.slice(dot)}`;
    n++;
  }
  await adapter.rename(trashPath, candidate);
  return candidate;
}

export async function scanTrash(
  adapter: VaultAdapter,
): Promise<{ id: string; deletedAt: number }[]> {
  const files = await adapter.list(".trash");
  return files
    .filter((p) => p.endsWith(".md"))
    .map((p) => {
      const base = p.replace(/^\.trash\//, "");
      const stampMatch = base.match(
        /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-/,
      );
      const deletedAt = stampMatch
        ? new Date(
            `${stampMatch[1]}T${stampMatch[2]}:${stampMatch[3]}:${stampMatch[4]}`,
          ).getTime()
        : 0;
      return { id: p, deletedAt };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Vault 초기화 (첫 실행 시)

export async function ensureVaultStructure(
  adapter: VaultAdapter,
): Promise<void> {
  await adapter.mkdir("meetings");
  await adapter.mkdir("journals");
  await adapter.mkdir("portfolio"); // V0.7
  if (!(await adapter.exists("inbox.md"))) {
    await adapter.write(
      "inbox.md",
      "# Inbox\n\n## 할 일\n\n## 일정\n\n## 빠른 메모\n",
    );
  }
}
