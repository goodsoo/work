import type { VaultAdapter } from "../lib/vault/adapter";
import {
  createTodo,
  deleteTodo,
  listTodos,
  parseTodoId,
  updateTodo,
  type Todo,
} from "./todos";

// V0.6: schedule = event (time 있거나 #event 태그 있는 inline todo).
// 별도 entity 없음 — vault 의 todo 중 isEvent=true 만 schedule 로 표현.

export interface Schedule {
  id: string;
  title: string;
  start_time: string; // ISO datetime (YYYY-MM-DDTHH:MM:SS)
  end_time: string | null;
  linked_todo_id: string | null;
}

export interface ScheduleInsert {
  title: string;
  start_time: string; // ISO datetime
  end_time?: string | null;
}

export interface ScheduleUpdate {
  title?: string;
  start_time?: string;
  end_time?: string | null;
}

function isoToParts(iso: string): { date: string; time: string } {
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);
  if (!m) return { date: iso, time: "" };
  return { date: m[1], time: m[2] ?? "" };
}

function todoToSchedule(t: Todo): Schedule {
  const time = t.due_time ?? "00:00";
  const date = t.due_date ?? "";
  const startIso = date ? `${date}T${time}:00` : "";
  return {
    id: t.id,
    title: t.title,
    start_time: startIso,
    end_time: null,
    linked_todo_id: t.id,
  };
}

export async function listSchedules(
  adapter: VaultAdapter,
): Promise<Schedule[]> {
  const todos = await listTodos(adapter);
  return todos
    .filter((t) => t._is_event && t.due_date)
    .map(todoToSchedule)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export async function createSchedule(
  adapter: VaultAdapter,
  input: ScheduleInsert,
): Promise<Schedule> {
  const { date, time } = isoToParts(input.start_time);
  const todo = await createTodo(adapter, {
    title: input.title,
    due_date: date,
    due_time: time || null,
  });
  return todoToSchedule(todo);
}

export async function updateSchedule(
  adapter: VaultAdapter,
  id: string,
  patch: ScheduleUpdate,
): Promise<Schedule> {
  const updates: Parameters<typeof updateTodo>[2] = {};
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.start_time !== undefined) {
    const { date, time } = isoToParts(patch.start_time);
    updates.due_date = date;
    updates.due_time = time || null;
  }
  const todo = await updateTodo(adapter, id, updates);
  return todoToSchedule(todo);
}

export async function deleteSchedule(
  adapter: VaultAdapter,
  id: string,
): Promise<void> {
  void parseTodoId(id); // validate
  await deleteTodo(adapter, id);
}
