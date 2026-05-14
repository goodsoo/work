import { supabase } from "../lib/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "../lib/database.types";

export type TodoPriority = "high" | "medium" | "low";
export type TodoCategory = "work" | "meeting";
export const TODO_CATEGORIES: Array<{ id: TodoCategory; label: string }> = [
  { id: "work", label: "업무" },
  { id: "meeting", label: "미팅" },
];

type Row = Tables<"todos">;
export type Todo = Omit<Row, "priority" | "category"> & {
  priority: TodoPriority;
  category: TodoCategory | null;
};

export type TodoInsert = Omit<TablesInsert<"todos">, "user_id" | "priority" | "category"> & {
  priority?: TodoPriority;
  category?: TodoCategory | null;
};

export type TodoUpdate = Omit<TablesUpdate<"todos">, "priority" | "category"> & {
  priority?: TodoPriority;
  category?: TodoCategory | null;
};

function fromRow(row: Row): Todo {
  return {
    ...row,
    priority: row.priority as TodoPriority,
    category: (row.category as TodoCategory) ?? null,
  };
}

export async function listTodos(): Promise<Todo[]> {
  // 미완료 먼저, due_date 가까운 순 (nulls last), 그다음 우선순위, 그다음 최근 생성
  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .order("done", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function createTodo(input: TodoInsert): Promise<Todo> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요");
  const { data, error } = await supabase
    .from("todos")
    .insert({ ...input, user_id: user.id })
    .select("*")
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateTodo(
  id: string,
  patch: TodoUpdate,
): Promise<Todo> {
  // done toggle 시 done_at도 같이 (서버에서 처리 안 하므로 클라가 패치에 포함하면 됨)
  const { data, error } = await supabase
    .from("todos")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteTodo(id: string): Promise<void> {
  const { error } = await supabase.from("todos").delete().eq("id", id);
  if (error) throw error;
}
