import type { VaultAdapter } from "../lib/vault/adapter";
import { extractTasks, toggleTask, type TaskItem } from "../lib/vault/tasks";
import { scanAllTasks } from "../lib/vault/scan";

export type TaskPriority = "high" | "medium" | "low";
export type TaskCategory = "work" | "schedule" | "other";
export const TASK_CATEGORIES: Array<{ id: TaskCategory; label: string }> = [
  { id: "work", label: "업무" },
  { id: "schedule", label: "일정" },
  { id: "other", label: "기타" },
];

export interface Task {
  id: string; // `${file}#L${line}`
  title: string;
  done: boolean;
  // 옵시디안 `- [-]` convention. done/deleted 와 mutually exclusive.
  cancelled: boolean;
  // soft-delete. vault 라인엔 `- [D]` (custom char). 휴지통 view 에서만 보임.
  // done/cancelled 와 mutually exclusive.
  deleted: boolean;
  done_at: string | null;
  priority: TaskPriority;
  category: TaskCategory | null;
  due_date: string | null;
  due_time: string | null;
  // 메모 → 태스크 ⌘⏎ 로 만든 태스크면 원본 메모 uid. vault 라인엔
  // `#from-<uid>` tag 로 직렬화. uid 영구라 메모 rename 후에도 안 깨짐.
  source_meeting_uid: string | null;
  // Google Calendar 동기화된 일정이면 그 이벤트 ID. vault 라인엔 `#gcal-<id>`
  // tag 로 직렬화 — 줄이 이동해도 따라다니는 영구 매핑 앵커 (별도 uid 없음).
  // null = 아직 push 안 됨(로컬 전용) 또는 동기화 대상 아님.
  gcal_event_id: string | null;
  // V0.5.3 호환 — UI 가 의존. vault 에선 파일 mtime / "now" 로 대체.
  created_at: string;
  updated_at: string;
  // V0.6 internal — mutation 헬퍼용
  _source: { file: string; line: number };
}

export interface TaskInsert {
  title: string;
  done?: boolean;
  cancelled?: boolean;
  deleted?: boolean;
  category?: TaskCategory | null;
  due_date?: string | null;
  due_time?: string | null;
  priority?: TaskPriority;
  source_meeting_uid?: string | null;
  gcal_event_id?: string | null;
}

// vault 라인의 `#from-<uid>` tag prefix. uid = uuid (`-` 포함) 도 tag 정규식 매칭.
const FROM_TAG_PREFIX = "from-";
// vault 라인의 `#gcal-<eventId>` tag prefix. Google event ID 는 base32hex
// (a-v, 0-9, `_`) 라 tag 정규식 `[\p{L}\p{N}_-]+` 에 전부 매칭 → round-trip 안전.
export const GCAL_TAG_PREFIX = "gcal-";

export interface TodoUpdate {
  title?: string;
  done?: boolean;
  cancelled?: boolean;
  deleted?: boolean;
  done_at?: string | null;
  category?: TaskCategory | null;
  due_date?: string | null;
  due_time?: string | null;
  priority?: TaskPriority;
  source_meeting_uid?: string | null;
  gcal_event_id?: string | null;
}

// ─── id ↔ source ───────────────────────────────────────────────────────────

export function makeTodoId(file: string, line: number): string {
  return `${file}#L${line}`;
}

export function parseTodoId(id: string): { file: string; line: number } {
  const m = id.match(/^(.+)#L(\d+)$/);
  if (!m) throw new Error(`invalid task id: ${id}`);
  return { file: m[1], line: Number(m[2]) };
}

// ─── TaskItem (vault parser 결과) → Task (API 노출) ─────────────────────────

function isCategory(t: string): t is TaskCategory {
  return t === "work" || t === "schedule" || t === "other";
}

function isPriority(t: string): t is TaskPriority {
  return t === "high" || t === "medium" || t === "low";
}

function todoFromItem(item: TaskItem, mtimeIso?: string): Task {
  const categoryTag = item.tags.find(isCategory);
  const priorityTag = item.tags.find(isPriority);
  const fromTag = item.tags.find((t) => t.startsWith(FROM_TAG_PREFIX));
  const gcalTag = item.tags.find((t) => t.startsWith(GCAL_TAG_PREFIX));
  const iso = mtimeIso ?? new Date().toISOString();
  return {
    id: makeTodoId(item.source.file, item.source.line),
    title: item.text,
    done: item.done,
    cancelled: item.cancelled,
    deleted: item.deleted,
    done_at: null, // vault md 에선 추적 안 함. UI 표시용으론 done flag 면 충분.
    priority: priorityTag ?? "medium",
    category: categoryTag ?? null,
    due_date: item.due ?? null,
    due_time: item.time ?? null,
    source_meeting_uid: fromTag ? fromTag.slice(FROM_TAG_PREFIX.length) : null,
    gcal_event_id: gcalTag ? gcalTag.slice(GCAL_TAG_PREFIX.length) : null,
    created_at: iso,
    updated_at: iso,
    _source: item.source,
  };
}

// ─── inline syntax 라인 build ───────────────────────────────────────────────

// title 안에 split 구분자 (`—` 또는 `---`) 박히면 다음 read 시 parser 가 잘못 split.
// title 차원에서 `--` 로 강등 — parser 의 DUE_SPLIT_RE 와 매칭 안 됨 → 본문 보존.
function sanitizeTaskTitle(title: string): string {
  return title.replace(/—|---/g, "--");
}

export function buildTodoLine(input: {
  title: string;
  done?: boolean;
  cancelled?: boolean;
  deleted?: boolean;
  category?: TaskCategory | null;
  due_date?: string | null;
  due_time?: string | null;
  priority?: TaskPriority;
  source_meeting_uid?: string | null;
  gcal_event_id?: string | null;
  extra_tags?: string[];
}): string {
  // 우선: deleted > cancelled > done > pending. 3 final state 중 하나만 true.
  const check = input.deleted
    ? "D"
    : input.cancelled
      ? "-"
      : input.done
        ? "x"
        : " ";
  // 시스템 생성 라인은 항상 ` --- ` + ISO 날짜. 옛 vault 의 ` — ` + M/D 도
  // parser 가 호환 매칭. ISO 박는 이유: M/D 만 박으면 연도가 read 시점 따라 점프
  // (2026 에 박은 5/22 가 2027 에 read 시 2027-05-22 로 해석되는 footgun).
  let line = `- [${check}] ${sanitizeTaskTitle(input.title)}`;
  if (input.due_date || input.due_time) {
    line += " ---";
    if (input.due_date) line += ` ${input.due_date}`;
    if (input.due_time) line += ` ${input.due_time}`;
  }
  if (input.category) line += ` #${input.category}`;
  if (input.priority && input.priority !== "medium") {
    line += ` #${input.priority}`;
  }
  if (input.source_meeting_uid) {
    line += ` #${FROM_TAG_PREFIX}${input.source_meeting_uid}`;
  }
  if (input.gcal_event_id) {
    line += ` #${GCAL_TAG_PREFIX}${input.gcal_event_id}`;
  }
  // extra_tags 에 from-/gcal- prefix 가 있으면 중복 박지 않음 (위에서 처리됨).
  for (const tag of input.extra_tags ?? []) {
    if (tag.startsWith(FROM_TAG_PREFIX)) continue;
    if (tag.startsWith(GCAL_TAG_PREFIX)) continue;
    line += ` #${tag}`;
  }
  return line;
}

// ─── API ───────────────────────────────────────────────────────────────────

export async function listTodos(adapter: VaultAdapter): Promise<Task[]> {
  const items = await scanAllTasks(adapter);
  const tasks = items.map((item) => todoFromItem(item));
  // 미완료 먼저, due_date 가까운 순, 그다음 최근
  tasks.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const da = a.due_date ?? "9999";
    const db = b.due_date ?? "9999";
    if (da !== db) return da.localeCompare(db);
    return b._source.line - a._source.line;
  });
  return tasks;
}

const INBOX_PATH = "inbox.md";

export async function createTodo(
  adapter: VaultAdapter,
  input: TaskInsert,
): Promise<Task> {
  const line = buildTodoLine(input);
  const raw = (await adapter.exists(INBOX_PATH))
    ? await adapter.read(INBOX_PATH)
    : "# Inbox\n";
  // inbox 끝에 append (마지막 라인 후)
  const trimmed = raw.replace(/\n+$/, "");
  const updated = `${trimmed}\n${line}\n`;
  const meta = await adapter.write(INBOX_PATH, updated);

  // 새 라인 번호 계산
  const lineNum = updated.split("\n").length - 2; // 마지막 \n 의 직전 라인
  const iso = new Date(meta.mtime).toISOString();
  return {
    id: makeTodoId(INBOX_PATH, lineNum),
    title: input.title,
    done: input.done ?? false,
    cancelled: input.cancelled ?? false,
    deleted: input.deleted ?? false,
    done_at: null,
    priority: input.priority ?? "medium",
    category: input.category ?? null,
    due_date: input.due_date ?? null,
    due_time: input.due_time ?? null,
    source_meeting_uid: input.source_meeting_uid ?? null,
    gcal_event_id: input.gcal_event_id ?? null,
    created_at: iso,
    updated_at: iso,
    _source: { file: INBOX_PATH, line: lineNum },
  };
}

export async function updateTask(
  adapter: VaultAdapter,
  id: string,
  patch: TodoUpdate,
): Promise<Task> {
  const { file, line } = parseTodoId(id);
  const raw = await adapter.read(file);
  const meta = await adapter.readMeta(file);

  // 단순 done toggle 만 있으면 toggleTask 사용 (다른 텍스트 보존)
  const onlyDone =
    Object.keys(patch).length === 1 && "done" in patch && patch.done !== undefined;
  let updated: string;
  if (onlyDone) {
    updated = toggleTask(raw, line, patch.done!);
  } else {
    // 라인 reconstruct (현재 inline syntax 다시 추출 + patch merge)
    const items = extractTasks(file, raw);
    const existing = items.find((i) => i.source.line === line);
    if (!existing) {
      throw new Error(`task not found at line ${line} of ${file}`);
    }
    const existingFromTag = existing.tags.find((t) =>
      t.startsWith(FROM_TAG_PREFIX),
    );
    const existingGcalTag = existing.tags.find((t) =>
      t.startsWith(GCAL_TAG_PREFIX),
    );
    const merged = {
      title: patch.title ?? existing.text,
      done: patch.done ?? existing.done,
      cancelled: patch.cancelled ?? existing.cancelled,
      deleted: patch.deleted ?? existing.deleted,
      category:
        patch.category !== undefined
          ? patch.category
          : (existing.tags.find(isCategory) ?? null),
      due_date: patch.due_date !== undefined ? patch.due_date : existing.due ?? null,
      due_time: patch.due_time !== undefined ? patch.due_time : existing.time ?? null,
      priority:
        patch.priority ??
        (existing.tags.find(isPriority) ?? "medium"),
      source_meeting_uid:
        patch.source_meeting_uid !== undefined
          ? patch.source_meeting_uid
          : existingFromTag
            ? existingFromTag.slice(FROM_TAG_PREFIX.length)
            : null,
      gcal_event_id:
        patch.gcal_event_id !== undefined
          ? patch.gcal_event_id
          : existingGcalTag
            ? existingGcalTag.slice(GCAL_TAG_PREFIX.length)
            : null,
      extra_tags: existing.tags.filter(
        (t) =>
          !isCategory(t) &&
          !isPriority(t) &&
          !t.startsWith(FROM_TAG_PREFIX) &&
          !t.startsWith(GCAL_TAG_PREFIX),
      ),
    };
    const lines = raw.split("\n");
    const indent = lines[line].match(/^(\s*)/)?.[1] ?? "";
    lines[line] = indent + buildTodoLine(merged);
    updated = lines.join("\n");
  }

  const newMeta = await adapter.write(file, updated, meta.mtime);
  // 재추출해서 최신 객체 반환
  const items = extractTasks(file, updated);
  const after = items.find((i) => i.source.line === line);
  if (!after) {
    throw new Error(`task disappeared after update at ${file}:${line}`);
  }
  return todoFromItem(after, new Date(newMeta.mtime).toISOString());
}

export async function deleteTask(
  adapter: VaultAdapter,
  id: string,
): Promise<void> {
  const { file, line } = parseTodoId(id);
  const raw = await adapter.read(file);
  const meta = await adapter.readMeta(file);
  const lines = raw.split("\n");
  if (line >= lines.length) return;
  lines.splice(line, 1);
  const updated = lines.join("\n");
  await adapter.write(file, updated, meta.mtime);
}
