import type { VaultAdapter } from "../lib/vault/adapter";
import { extractTodos, toggleTodo, type TodoItem } from "../lib/vault/tasks";
import { scanAllTodos } from "../lib/vault/scan";

export type TodoPriority = "high" | "medium" | "low";
export type TodoCategory = "work" | "meeting";
export const TODO_CATEGORIES: Array<{ id: TodoCategory; label: string }> = [
  { id: "work", label: "업무" },
  { id: "meeting", label: "미팅" },
];

export interface Todo {
  id: string; // `${file}#L${line}`
  title: string;
  done: boolean;
  done_at: string | null;
  priority: TodoPriority;
  category: TodoCategory | null;
  due_date: string | null;
  due_time: string | null;
  linked_meeting_id: string | null;
  // V0.5.3 호환 — UI 가 의존. vault 에선 파일 mtime / "now" 로 대체.
  created_at: string;
  updated_at: string;
  // V0.6 internal — mutation 헬퍼용
  _source: { file: string; line: number };
  _is_event: boolean;
}

export interface TodoInsert {
  title: string;
  done?: boolean;
  category?: TodoCategory | null;
  due_date?: string | null;
  due_time?: string | null;
  priority?: TodoPriority;
  linked_meeting_id?: string | null;
}

export interface TodoUpdate {
  title?: string;
  done?: boolean;
  done_at?: string | null;
  category?: TodoCategory | null;
  due_date?: string | null;
  due_time?: string | null;
  priority?: TodoPriority;
}

// ─── id ↔ source ───────────────────────────────────────────────────────────

export function makeTodoId(file: string, line: number): string {
  return `${file}#L${line}`;
}

export function parseTodoId(id: string): { file: string; line: number } {
  const m = id.match(/^(.+)#L(\d+)$/);
  if (!m) throw new Error(`invalid todo id: ${id}`);
  return { file: m[1], line: Number(m[2]) };
}

// ─── TodoItem (vault parser 결과) → Todo (API 노출) ─────────────────────────

function isCategory(t: string): t is TodoCategory {
  return t === "work" || t === "meeting";
}

function isPriority(t: string): t is TodoPriority {
  return t === "high" || t === "medium" || t === "low";
}

function todoFromItem(item: TodoItem, mtimeIso?: string): Todo {
  const categoryTag = item.tags.find(isCategory);
  const priorityTag = item.tags.find(isPriority);
  const iso = mtimeIso ?? new Date().toISOString();
  return {
    id: makeTodoId(item.source.file, item.source.line),
    title: item.text,
    done: item.done,
    done_at: null, // vault md 에선 추적 안 함. UI 표시용으론 done flag 면 충분.
    priority: priorityTag ?? "medium",
    category: categoryTag ?? null,
    due_date: item.due ?? null,
    due_time: item.time ?? null,
    linked_meeting_id: item.source.file.startsWith("meetings/")
      ? item.source.file
      : null,
    created_at: iso,
    updated_at: iso,
    _source: item.source,
    _is_event: item.isEvent,
  };
}

// ─── inline syntax 라인 build ───────────────────────────────────────────────

function formatDateForLine(iso: string): string {
  // YYYY-MM-DD → M/D (올해면) 또는 YYYY-MM-DD
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const year = Number(m[1]);
  const cur = new Date().getFullYear();
  if (year === cur) return `${Number(m[2])}/${Number(m[3])}`;
  return iso;
}

export function buildTodoLine(input: {
  title: string;
  done?: boolean;
  category?: TodoCategory | null;
  due_date?: string | null;
  due_time?: string | null;
  priority?: TodoPriority;
  extra_tags?: string[];
}): string {
  const check = input.done ? "x" : " ";
  let line = `- [${check}] ${input.title}`;
  if (input.due_date || input.due_time) {
    line += " —";
    if (input.due_date) line += ` ${formatDateForLine(input.due_date)}`;
    if (input.due_time) line += ` ${input.due_time}`;
  }
  if (input.category) line += ` #${input.category}`;
  if (input.priority && input.priority !== "medium") {
    line += ` #${input.priority}`;
  }
  for (const tag of input.extra_tags ?? []) {
    line += ` #${tag}`;
  }
  return line;
}

// ─── API ───────────────────────────────────────────────────────────────────

export async function listTodos(adapter: VaultAdapter): Promise<Todo[]> {
  const items = await scanAllTodos(adapter);
  const todos = items.map((item) => todoFromItem(item));
  // 미완료 먼저, due_date 가까운 순, 그다음 최근
  todos.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const da = a.due_date ?? "9999";
    const db = b.due_date ?? "9999";
    if (da !== db) return da.localeCompare(db);
    return b._source.line - a._source.line;
  });
  return todos;
}

const INBOX_PATH = "inbox.md";

export async function createTodo(
  adapter: VaultAdapter,
  input: TodoInsert,
): Promise<Todo> {
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
    done_at: null,
    priority: input.priority ?? "medium",
    category: input.category ?? null,
    due_date: input.due_date ?? null,
    due_time: input.due_time ?? null,
    linked_meeting_id: input.linked_meeting_id ?? null,
    created_at: iso,
    updated_at: iso,
    _source: { file: INBOX_PATH, line: lineNum },
    _is_event: !!input.due_time,
  };
}

export async function updateTodo(
  adapter: VaultAdapter,
  id: string,
  patch: TodoUpdate,
): Promise<Todo> {
  const { file, line } = parseTodoId(id);
  const raw = await adapter.read(file);
  const meta = await adapter.readMeta(file);

  // 단순 done toggle 만 있으면 toggleTodo 사용 (다른 텍스트 보존)
  const onlyDone =
    Object.keys(patch).length === 1 && "done" in patch && patch.done !== undefined;
  let updated: string;
  if (onlyDone) {
    updated = toggleTodo(raw, line, patch.done!);
  } else {
    // 라인 reconstruct (현재 inline syntax 다시 추출 + patch merge)
    const items = extractTodos(file, raw);
    const existing = items.find((i) => i.source.line === line);
    if (!existing) {
      throw new Error(`todo not found at line ${line} of ${file}`);
    }
    const merged = {
      title: patch.title ?? existing.text,
      done: patch.done ?? existing.done,
      category:
        patch.category !== undefined
          ? patch.category
          : (existing.tags.find(isCategory) ?? null),
      due_date: patch.due_date !== undefined ? patch.due_date : existing.due ?? null,
      due_time: patch.due_time !== undefined ? patch.due_time : existing.time ?? null,
      priority:
        patch.priority ??
        (existing.tags.find(isPriority) ?? "medium"),
      extra_tags: existing.tags.filter(
        (t) => !isCategory(t) && !isPriority(t),
      ),
    };
    const lines = raw.split("\n");
    const indent = lines[line].match(/^(\s*)/)?.[1] ?? "";
    lines[line] = indent + buildTodoLine(merged);
    updated = lines.join("\n");
  }

  const newMeta = await adapter.write(file, updated, meta.mtime);
  // 재추출해서 최신 객체 반환
  const items = extractTodos(file, updated);
  const after = items.find((i) => i.source.line === line);
  if (!after) {
    throw new Error(`todo disappeared after update at ${file}:${line}`);
  }
  return todoFromItem(after, new Date(newMeta.mtime).toISOString());
}

export async function deleteTodo(
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
