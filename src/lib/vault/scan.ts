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
  id: string; // 메인 파일 path (e.g. "notes/2026-05-16-팀-주간회의.md")
  uid: string; // frontmatter 의 영구 id (uuid). path 변해도 그대로. cache key 의 진실.
  title: string;
  date: string | null;
  time: string | null;
  attendees: string[];
  tags: string[];
  // 즐겨찾기 — frontmatter `pinned: true`. 옵시디안 community 표준 (bookmarks /
  // pin-it-to-the-top 등) 과 호환. 사이드바 상단에 별도 그룹으로 고정.
  pinned: boolean;
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
  uid: string; // frontmatter `id` 영구 식별자 (uuid). 메모와 동일 모델.
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

// iCloud / Dropbox / OneDrive 등 sync 도구가 동기화 중 생성하는 부산물 파일.
// scan 대상에서 제외 — 사이드바에 노이즈로 뜨거나 read 가 실패해 메모 행세하지
// 않도록.
//   - "(conflicted copy ...)" / "(Mac's conflicted copy ...)" — iCloud/Dropbox
//   - ".foo.md.icloud" — iCloud evicted placeholder (dot prefix)
//   - dot prefix 일반 — OS 메타 파일 (.DS_Store 등)
const SYNC_NOISE_RE = /\(conflicted copy|\(conflict[^/]*\d{4}-\d{2}-\d{2}/i;
export function isSyncNoiseFile(path: string): boolean {
  // 파일명만 검사 — 폴더 경로에 dot 있어도 상관 X.
  const name = path.split("/").pop() ?? path;
  if (name.startsWith(".")) return true;
  if (name.endsWith(".icloud")) return true;
  return SYNC_NOISE_RE.test(name);
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

function fmBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "yes" || v === "1";
  }
  return false;
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
    uid: fmString(fm.id) ?? "", // 빈 string 면 lazy migration (scanMeetings / getMeeting 가 발급).
    title: filePathToTitle(filePath),
    date: fmString(fm.date),
    time: fmString(fm.time),
    attendees: fmStringArray(fm.attendees),
    tags: fmStringArray(fm.tags),
    pinned: fmBoolean(fm.pinned),
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
    uid: fmString(fm.id) ?? "", // 빈 string 면 lazy migration (scanJournals / upsertJournal).
    date: fmString(fm.date) ?? filePathToDate(filePath),
    mtime,
    content: file.body,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Build Meeting → 3 raw files

export function meetingToMainRaw(meeting: Meeting): string {
  // title 은 파일명이 곧 title — frontmatter 안 박음. title 변경 = pure disk rename →
  // inode 유지 (옵시디안 모델 정확 일치). frontmatter patch write 안 발사.
  const frontmatter: Record<string, unknown> = {
    id: meeting.uid, // 옵시디안 community 표준 (obsidian-unique-identifiers 등) — frontmatter `id` 가 영구 식별자.
  };
  if (meeting.date) frontmatter.date = meeting.date;
  if (meeting.time) frontmatter.time = meeting.time;
  if (meeting.attendees.length > 0) frontmatter.attendees = meeting.attendees;
  if (meeting.tags.length > 0) frontmatter.tags = meeting.tags;
  // pinned 는 true 일 때만 박음 — false 면 frontmatter 자체에서 제거 (옵시디안 다른
  // pin 플러그인들과 mutual: 우리 앱이 false 박아두면 사용자가 옵시디안에서 pin 해도
  // 다음 write 때 사라짐). default = absent 가 곧 false.
  if (meeting.pinned) frontmatter.pinned = true;

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
  const frontmatter: Record<string, unknown> = {
    id: journal.uid, // 메모와 동일 — 영구 식별자.
    date: journal.date,
  };
  return serializeVaultFile({
    raw: "",
    frontmatter,
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

// 파일시스템 금지 문자 (`/ \ : * ? " < > |`) + 옵시디안 link syntax 와 충돌하는
// 문자 (`# ^ [ ] |`) 는 `-` 로 치환. NUL/제어문자 (\x00-\x1f) 도 제거.
// 빈 결과 → "untitled" fallback. 100자 cap.
// eslint-disable-next-line no-control-regex
const UNSAFE_FILENAME_RE = /[\x00-\x1f/\\:*?"<>|#^[\]]/g;

export function slugify(title: string): string {
  let s = title.replace(UNSAFE_FILENAME_RE, "-");
  // 앞뒤 dot/공백 제거 — Windows trim + macOS dotfile 회피
  s = s.replace(/^[.\s]+|[.\s]+$/g, "");
  if (s.length > 200) s = s.slice(0, 200).replace(/[.\s]+$/, "");
  return s || "untitled";
}

function filePathToTitle(filePath: string): string {
  const base = filePath.split("/").pop() ?? filePath;
  return base.replace(/\.md$/, "");
}

function filePathToDate(filePath: string): string {
  const base = filePath.split("/").pop() ?? filePath;
  const m = base.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

// 메모 경로에서 폴더 부분 추출. `notes/foo.md` → `""`, `notes/work/foo.md`
// → `"work"`, `notes/work/2026/foo.md` → `"work/2026"`. id 가 `notes/` 로
// 시작 안 하면 빈 문자열 (방어).
export function meetingFolder(meetingPath: string): string {
  if (!meetingPath.startsWith("notes/")) return "";
  const rest = meetingPath.slice("notes/".length);
  const lastSlash = rest.lastIndexOf("/");
  if (lastSlash === -1) return "";
  return rest.slice(0, lastSlash);
}

// `notes/{folder?}/{slug}.md` 빌더. folder 가 빈 문자열이면 root.
function buildMeetingPath(folder: string, slug: string): string {
  const f = folder.replace(/^\/+|\/+$/g, "");
  return f === "" ? `notes/${slug}.md` : `notes/${f}/${slug}.md`;
}

// 폴더 path 정규화 + 검증. 외부 슬래시 trim, `..` 차단, segment 별 slugify 적용
// (UNSAFE_FILENAME_RE 동일 규칙). 빈 segment 는 squash.
// 빈 문자열 입력 → 빈 문자열 출력 (root).
export function normalizeFolderPath(folder: string): string {
  const trimmed = folder.replace(/^\/+|\/+$/g, "").trim();
  if (trimmed === "") return "";
  const parts = trimmed.split("/").filter(Boolean);
  if (parts.some((p) => p === "..")) {
    throw new Error(`folder path traversal blocked: ${folder}`);
  }
  return parts.map((p) => slugify(p)).join("/");
}

// notes/{folder?}/{slug}.md — date 없음. date 는 순수 frontmatter optional.
// 새 메모 default ("untitled") 충돌 시만 -2 suffix. 사용자 명시 title 의 충돌은
// computeRenamedMeetingPath 가 throw 로 처리 (자동 -2 안 함).
export async function generateMeetingPath(
  adapter: VaultAdapter,
  title: string,
  folder = "",
): Promise<string> {
  const slug = slugify(title);
  const f = normalizeFolderPath(folder);
  let candidate = buildMeetingPath(f, slug);
  let n = 2;
  while (await adapter.exists(candidate)) {
    candidate = buildMeetingPath(f, `${slug}-${n}`);
    n++;
  }
  return candidate;
}

// title 변경 전용 충돌 에러. 사용자가 toast 보고 다른 title 로 재시도.
export class TitleConflictError extends Error {
  slug: string;
  path: string;
  constructor(slug: string, path: string) {
    super(`title already in use: ${slug}`);
    this.name = "TitleConflictError";
    this.slug = slug;
    this.path = path;
  }
}

// title 변경 시 새 path 계산. 같으면 currentId 반환 (no-op).
// 다른 메모와 충돌 시 throw — 사용자가 다른 title 로 재시도해야 함.
// 자동 -2 suffix 안 함 (의도된 title 과 다른 파일명을 silently 만들지 않기 위해).
// 폴더는 currentId 에서 유지 — title rename 으로 폴더가 바뀌진 않음 (별도 move API).
export async function computeRenamedMeetingPath(
  adapter: VaultAdapter,
  currentId: string,
  newTitle: string,
): Promise<string> {
  const slug = slugify(newTitle);
  const folder = meetingFolder(currentId);
  const target = buildMeetingPath(folder, slug);
  if (target === currentId) return currentId;
  if (await adapter.exists(target)) {
    throw new TitleConflictError(slug, target);
  }
  return target;
}

// 같은 title 그대로 둔 채 폴더만 이동. newFolder 가 currentId 와 같은 폴더면 no-op.
// 충돌 시 throw (같은 folder 안에 같은 title 메모 존재).
export async function computeMovedMeetingPath(
  adapter: VaultAdapter,
  currentId: string,
  newFolder: string,
): Promise<string> {
  if (!currentId.startsWith("notes/")) {
    throw new Error(`not a meeting path: ${currentId}`);
  }
  const base = currentId.split("/").pop() ?? "";
  const slug = base.replace(/\.md$/, "");
  const target = buildMeetingPath(normalizeFolderPath(newFolder), slug);
  if (target === currentId) return currentId;
  if (await adapter.exists(target)) {
    throw new TitleConflictError(slug, target);
  }
  return target;
}

// 폴더 이동 — 메인 + sidecar 한 묶음 rename. 새 폴더가 디스크에 없으면 mkdir 선행.
// computeMovedMeetingPath 가 throw 안 한 케이스 (충돌 X) 만 호출.
export async function moveMeetingToFolder(
  adapter: VaultAdapter,
  oldPath: string,
  newPath: string,
): Promise<void> {
  if (oldPath === newPath) return;
  // newPath 의 부모 폴더 (`notes/{folder}` 또는 `notes`) mkdir 보장.
  // Tauri rename 은 부모가 없으면 실패.
  const parentSlash = newPath.lastIndexOf("/");
  if (parentSlash > 0) {
    const parent = newPath.slice(0, parentSlash);
    await adapter.mkdir(parent);
  }
  await renameMeetingFiles(adapter, oldPath, newPath);
}

// 폴더 자체의 마지막 segment 이름만 바꿈. 부모 path 유지 — 위계 이동 X.
// "work" → "프로젝트" (root 폴더 rename), "work/2026" → "work/2027" (sub-folder rename).
// 안에 있는 메모는 디스크 rename 으로 자동 따라옴 (POSIX mv). 충돌 시 throw.
// oldFolder 는 notes-relative ("work" 또는 "work/2026"), newName 은 새 마지막 segment.
// 반환: 새 vault-relative path ("notes/프로젝트").
export async function renameMeetingFolder(
  adapter: VaultAdapter,
  oldFolder: string,
  newName: string,
): Promise<string> {
  const normalized = normalizeFolderPath(oldFolder);
  if (normalized === "") {
    throw new Error("root 폴더는 이름을 바꿀 수 없습니다");
  }
  const newSeg = slugify(newName);
  if (newSeg === "" || newSeg === "untitled") {
    throw new Error("폴더 이름이 비어있습니다");
  }
  const lastSlash = normalized.lastIndexOf("/");
  const parent = lastSlash === -1 ? "" : normalized.slice(0, lastSlash);
  const newRel = parent === "" ? newSeg : `${parent}/${newSeg}`;
  if (newRel === normalized) return `notes/${normalized}`;
  const oldFull = `notes/${normalized}`;
  const newFull = `notes/${newRel}`;
  if (await adapter.exists(newFull)) {
    throw new TitleConflictError(newSeg, newFull);
  }
  // 부모 폴더가 사라진 경우 (외부 삭제 등) 만 mkdir. parent === "" 이면 notes/ 가 부모.
  await adapter.mkdir(parent === "" ? "notes" : `notes/${parent}`);
  await adapter.rename(oldFull, newFull);
  return newFull;
}

// 메인 + 두 sidecar 한 묶음 rename. sidecar 가 없으면 skip.
export async function renameMeetingFiles(
  adapter: VaultAdapter,
  oldPath: string,
  newPath: string,
): Promise<void> {
  if (oldPath === newPath) return;
  await adapter.rename(oldPath, newPath);
  const oldT = transcriptPath(oldPath);
  const newT = transcriptPath(newPath);
  if (await adapter.exists(oldT)) {
    await adapter.rename(oldT, newT);
  }
  const oldS = summaryPath(oldPath);
  const newS = summaryPath(newPath);
  if (await adapter.exists(oldS)) {
    await adapter.rename(oldS, newS);
  }
}

export function journalPath(date: string): string {
  return `journals/${date}.md`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scan operations

// 메모 도메인 안 시스템 폴더 — 사이드바 트리/메모 scan 양쪽에서 제외. underscore prefix
// 는 옵시디안 convention 으로 메모와 구분되는 "자산/시스템" 표시 (`_attachments` 등).
// dotfile 처럼 listRecursive 단에서 막진 않음 — 사용자 mkdir 한 일반 메모 폴더가
// underscore 로 시작할 수 있어 (rare 지만), domain-specific 한 곳에서만 차단.
function isMeetingSystemSegment(seg: string): boolean {
  return seg === "_attachments";
}

function isInMeetingSystemFolder(relPath: string): boolean {
  // relPath = "notes/_attachments/..." 같은 형식. "notes/" 떼고 첫 segment 검사.
  if (!relPath.startsWith("notes/")) return false;
  const rest = relPath.slice("notes/".length);
  const firstSeg = rest.split("/")[0];
  return isMeetingSystemSegment(firstSeg);
}

// notes/ 안 모든 폴더 path 반환 (빈 폴더 포함, vault root 기준).
// `["notes/work", "notes/work/2026", "notes/personal"]` 처럼.
// 메모 0개라도 옵시디안에서 mkdir 한 폴더는 보여야 — 사이드바 트리가 buildMeetingsTree
// 에 이 list 를 extra 로 전달. `_attachments` 는 메모가 아니라 자산 폴더라 제외.
export async function scanMeetingFolders(
  adapter: VaultAdapter,
): Promise<string[]> {
  const all = await adapter.listFoldersRecursive("notes");
  return all.filter((p) => !isInMeetingSystemFolder(p));
}

export async function scanMeetings(adapter: VaultAdapter): Promise<MeetingMeta[]> {
  // listRecursive — nav-restructure 이후 `notes/{folder}/...` 중첩 폴더 지원.
  // sub-folder 안 메모도 사이드바 트리에 잡히도록.
  const files = await adapter.listRecursive("notes");
  const results: MeetingMeta[] = [];
  for (const path of files) {
    if (!path.endsWith(".md")) continue;
    if (isInMeetingSystemFolder(path)) continue; // _attachments 등 자산 폴더 제외
    if (isMeetingSidecar(path)) continue; // sidecar 는 scan 대상 X
    if (isSyncNoiseFile(path)) continue; // iCloud/Dropbox 충돌·placeholder skip
    try {
      let raw = await adapter.read(path);
      let meta = await adapter.readMeta(path);
      let m = fileToMeeting(path, raw, "", "", meta.mtime);
      // Lazy migration — 옛 V0.6 메모 (frontmatter id 없음) 처음 만나면 uuid 발급 + rewrite.
      // 한 번만 발생. 옵시디안 community 표준 (frontmatter `id` 영구 식별자) 으로 통일.
      if (m.uid === "") {
        const uid = crypto.randomUUID();
        const updated = { ...m, uid };
        try {
          const newRaw = meetingToMainRaw(updated);
          const newMeta = await adapter.write(path, newRaw, meta.mtime);
          raw = newRaw;
          meta = newMeta;
          m = fileToMeeting(path, raw, "", "", meta.mtime);
        } catch {
          // write 실패 시 (권한 / sync conflict) — 메모리 uid 만 채워서 list 표시.
          // 다음 scan 또는 사용자 edit 시 다시 시도.
          m = { ...m, uid };
        }
      }
      results.push({
        id: m.id,
        uid: m.uid,
        title: m.title,
        date: m.date,
        time: m.time,
        attendees: m.attendees,
        tags: m.tags,
        pinned: m.pinned,
        mtime: m.mtime,
        created_at: m.created_at,
        updated_at: m.updated_at,
        deleted_at: m.deleted_at,
      });
    } catch (err) {
      // read / readMeta 실패 — yaml 깨짐이 아니라 디스크 access 실패 (iCloud
      // evict, 권한 등). parseVaultFile 자체는 graceful 이므로 frontmatter 손상
      // 만으론 안 떨어짐. 디버깅용 path 로깅 — 사용자가 메모가 비어 보이는 이유
      // 추적 가능.
      console.warn(`[scanMeetings] skip ${path}:`, err);
    }
  }
  await dedupeUids(adapter, results);
  results.sort((a, b) => {
    const da = a.date ?? "";
    const db = b.date ?? "";
    if (da !== db) return db.localeCompare(da);
    return b.mtime - a.mtime;
  });
  return results;
}

// 같은 uid 두 entry 가 vault 에 존재하면 (외부 복사 / 옵시디안 모바일 merge /
// 백업 복원) React key 충돌 + 같은 uid hash 라우팅 시 어느 파일 잡힐지 race.
// 후순위 (mtime 작은, 동률이면 path 알파벳 큰) entries 의 uid 를 새 uuid 로
// 재발급 + frontmatter rewrite. rewrite 가 watcher 다시 trigger 하지만 dedup
// 은 idempotent (다음 scan 에 이미 unique → no-op) 이라 무한 루프 X.
// in-place 로 results 의 uid 필드 갱신 — 같은 turn UI 가 새 uid 로 routing 가능.
// export — 테스트에서 직접 호출.
export async function dedupeUids(
  adapter: VaultAdapter,
  results: MeetingMeta[],
): Promise<void> {
  const groups = new Map<string, MeetingMeta[]>();
  for (const m of results) {
    if (!m.uid) continue; // lazy migration 실패한 entry — skip
    const existing = groups.get(m.uid);
    if (existing) existing.push(m);
    else groups.set(m.uid, [m]);
  }

  for (const [uid, entries] of groups) {
    if (entries.length < 2) continue;
    // 우선순위: mtime 큰 → 같으면 path 알파벳 작은. entries[0] 이 keeper.
    entries.sort((a, b) => {
      if (a.mtime !== b.mtime) return b.mtime - a.mtime;
      return a.id.localeCompare(b.id);
    });
    for (let i = 1; i < entries.length; i++) {
      const entry = entries[i];
      const newUid = crypto.randomUUID();
      try {
        const raw = await adapter.read(entry.id);
        const newRaw = patchFrontmatter(raw, { id: newUid });
        const newMeta = await adapter.write(entry.id, newRaw, entry.mtime);
        entry.uid = newUid;
        entry.mtime = newMeta.mtime;
        console.warn(
          `[scanMeetings] dedupe uid: ${entry.id} (was ${uid}, now ${newUid})`,
        );
      } catch (err) {
        // read-only vault / sync conflict / 권한 — 메모리 uid 만 분리해서
        // React key 충돌 0. 다음 scan 또는 사용자 edit 시 다시 시도.
        entry.uid = newUid;
        console.warn(
          `[scanMeetings] dedupe rewrite 실패 ${entry.id}: 메모리 uid 만 분리`,
          err,
        );
      }
    }
  }
}

export async function scanJournals(adapter: VaultAdapter): Promise<JournalMeta[]> {
  const files = await adapter.list("journals");
  const results: JournalMeta[] = [];
  for (const path of files) {
    if (!path.endsWith(".md")) continue;
    if (isSyncNoiseFile(path)) continue;
    try {
      let raw = await adapter.read(path);
      let meta = await adapter.readMeta(path);
      let j = fileToJournal(path, raw, meta.mtime);
      // Lazy migration — 옛 일기 (frontmatter id 없음) 첫 만나면 uuid 발급 + rewrite.
      // 메모 (scanMeetings) 패턴 동일. 한 번만 발생.
      if (j.uid === "") {
        const uid = crypto.randomUUID();
        const updated = { ...j, uid };
        try {
          const newRaw = journalToRaw(updated);
          const newMeta = await adapter.write(path, newRaw, meta.mtime);
          raw = newRaw;
          meta = newMeta;
          j = fileToJournal(path, raw, meta.mtime);
        } catch {
          // write 실패 — 메모리 uid 만 채워 list 표시. 다음 scan 시 재시도.
          j = { ...j, uid };
        }
      }
      results.push({ id: j.id, uid: j.uid, date: j.date, mtime: j.mtime });
    } catch (err) {
      console.warn(`[scanJournals] skip ${path}:`, err);
    }
  }
  results.sort((a, b) => b.date.localeCompare(a.date));
  return results;
}

// inbox.md 안 todo 만 수집. 메모/일기 안 - [ ] 는 todo 페이지 등장 X
// (단순 체크박스 / 시각 element). 메모 → inbox 는 명시적 "할일로 보내기" 액션.
export async function scanAllTodos(adapter: VaultAdapter): Promise<TodoItem[]> {
  const path = "inbox.md";
  if (!(await adapter.exists(path))) return [];
  try {
    const raw = await adapter.read(path);
    return extractTodos(path, raw);
  } catch {
    return [];
  }
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
  // 원본 폴더 구조 추정. V0.7.1: 메모는 notes/{title}.md (date prefix 없음).
  // 순수 YYYY-MM-DD.md 만 일기, 그 외 (legacy date-prefix + V0.7.1 title-only)
  // 는 모두 메모로 복원.
  let target: string;
  if (base.match(/^\d{4}-\d{2}-\d{2}\.md$/)) {
    target = `journals/${base}`;
  } else {
    target = `notes/${base}`;
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
    .filter((p) => p.endsWith(".md") && !isSyncNoiseFile(p))
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
  await adapter.mkdir("notes");
  await adapter.mkdir("journals");
  await adapter.mkdir("portfolio"); // V0.7
  if (!(await adapter.exists("inbox.md"))) {
    await adapter.write(
      "inbox.md",
      "# Inbox\n\n## 할 일\n\n## 일정\n\n## 빠른 메모\n",
    );
  }
}
