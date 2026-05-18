import type { VaultAdapter } from "./adapter";
import {
  parseVaultFile,
  serializeVaultFile,
  patchSection,
  patchFrontmatter,
  type VaultFile,
} from "./parser";
import { extractTodos, type TodoItem } from "./tasks";

// ─────────────────────────────────────────────────────────────────────────────
// Types — UI/hooks 가 다루는 형태

export interface MeetingMeta {
  id: string; // file path (e.g. "meetings/2026-05-16-팀-주간회의.md")
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
  unmapped: string;
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
    // CSV fallback (V0.5.3 호환)
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// H2 list 변환 (요약 H1 안의 H2 section 들)

// `## 논의 사항\n- foo\n- bar` → ['foo', 'bar']
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
    // bullet line: `- text` or `- [x] text` or `- [ ] text`
    const bullet = line.match(/^\s*- (?:\[[ x]\]\s+)?(.+?)\s*$/);
    if (bullet) items.push(bullet[1]);
  }
  return items;
}

// items → `## label\n- item1\n- item2\n` (checkbox 옵션: action_items 용)
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

// 요약 body 재구성: 기존의 다른 H2 (없을 알려진 라벨) 는 보존
export function buildSummaryBody(parts: {
  discussion_items: string[];
  decisions: string[];
  action_items: string[];
}): string {
  return [
    buildH2List("논의 사항", parts.discussion_items),
    buildH2List("결정 사항", parts.decisions),
    buildH2List("액션 아이템", parts.action_items, true),
  ]
    .filter((s) => s.trim() !== `## ${s.match(/^## (.+?)\n/)?.[1] ?? ""}`)
    .join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// File → Meeting/Journal

export function fileToMeeting(
  filePath: string,
  raw: string,
  mtime: number,
): Meeting {
  const file = parseVaultFile(raw);
  const fm = file.frontmatter;
  const summary = file.sections.get("요약") ?? "";
  const isoMtime = new Date(mtime || Date.now()).toISOString();
  const isInTrash = filePath.startsWith(".trash/");

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
    content: file.sections.get("본문") ?? "",
    transcript: file.sections.get("회의 내용") ?? "",
    discussion_items: extractH2List(summary, "논의 사항"),
    decisions: extractH2List(summary, "결정 사항"),
    action_items: extractH2List(summary, "액션 아이템"),
    unmapped: file.unmapped,
  };
}

export function fileToJournal(
  filePath: string,
  raw: string,
  mtime: number,
): Journal {
  const file = parseVaultFile(raw);
  const fm = file.frontmatter;
  // 일기는 H1 split 없이 전체 본문이 content
  const allBody = [
    file.sections.get("본문") ?? "",
    file.sections.get("회의 내용") ?? "",
    file.sections.get("요약") ?? "",
    file.unmapped,
  ]
    .filter((s) => s.trim())
    .join("\n\n");

  // 일기는 H1 없는 자유 형식이 일반적 — H1 split 안 된 raw 사용이 더 안전.
  // 기준: 알려진 H1 이 하나도 없으면 unmapped 가 전체 본문.
  const hasKnownH1 = ["본문", "회의 내용", "요약"].some(
    (h) => (file.sections.get(h) ?? "") !== "",
  );

  return {
    id: filePath,
    date: fmString(fm.date) ?? filePathToDate(filePath),
    mtime,
    content: hasKnownH1 ? allBody : file.unmapped || rawBodyAfterFrontmatter(raw),
  };
}

function rawBodyAfterFrontmatter(raw: string): string {
  const m = raw.match(/^---\s*\n[\s\S]*?\n---\s*(\n|$)/);
  return m ? raw.slice(m[0].length) : raw;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build Meeting → raw

export function meetingToRaw(meeting: Meeting): string {
  const frontmatter: Record<string, unknown> = {
    title: meeting.title,
  };
  if (meeting.date) frontmatter.date = meeting.date;
  if (meeting.time) frontmatter.time = meeting.time;
  if (meeting.attendees.length > 0) frontmatter.attendees = meeting.attendees;
  if (meeting.tags.length > 0) frontmatter.tags = meeting.tags;

  const sections = new Map<string, string>();
  sections.set("본문", meeting.content);
  sections.set("회의 내용", meeting.transcript);
  sections.set("요약", buildSummaryBody({
    discussion_items: meeting.discussion_items,
    decisions: meeting.decisions,
    action_items: meeting.action_items,
  }));

  const file: VaultFile = {
    raw: "",
    frontmatter,
    sections,
    unmapped: meeting.unmapped,
  };
  return serializeVaultFile(file);
}

export function journalToRaw(journal: Journal): string {
  const frontmatter: Record<string, unknown> = { date: journal.date };
  // 일기는 H1 split 없이 본문 그대로. patchSection 동작과 일관성 위해 본문 H1 사용 안 함.
  let raw = `---\ndate: ${journal.date}\n---\n\n${journal.content}\n`;
  if (Object.keys(frontmatter).length > 1) {
    // 추가 frontmatter 가 있으면 dump
    raw = patchFrontmatter("\n" + journal.content + "\n", frontmatter);
  }
  return raw;
}

// ─────────────────────────────────────────────────────────────────────────────
// Patch helpers — 부분 patch (전체 직렬화 안 함)

export function patchMeetingContent(raw: string, newContent: string): string {
  return patchSection(raw, "본문", newContent);
}
export function patchMeetingTranscript(
  raw: string,
  newTranscript: string,
): string {
  return patchSection(raw, "회의 내용", newTranscript);
}
export function patchMeetingSummary(
  raw: string,
  parts: {
    discussion_items: string[];
    decisions: string[];
    action_items: string[];
  },
): string {
  return patchSection(raw, "요약", buildSummaryBody(parts));
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
    try {
      const raw = await adapter.read(path);
      const meta = await adapter.readMeta(path);
      const m = fileToMeeting(path, raw, meta.mtime);
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
  // date desc, mtime desc 정렬
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

// vault 전체 *.md 스캔 → 모든 todo 추출 (휴지통 제외)
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
      items.push(...extractTodos(path, raw));
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
  await adapter.mkdir(".trash");
  const base = filePath.replace(/^.*\//, "");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const trashPath = `.trash/${stamp}-${base}`;
  await adapter.rename(filePath, trashPath);
  return trashPath;
}

export async function restoreFromTrash(
  adapter: VaultAdapter,
  trashPath: string,
): Promise<string> {
  // ".trash/2026-05-17T14-09-18-{원본경로}" → 원본경로 복원
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
