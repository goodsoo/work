import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  useCreateTodo,
  useDeleteTodo,
  useTodos,
  useUpdateTodo,
} from "../hooks/useTodos";
import type { Todo, TodoPriority } from "../api/todos";
import { TodoAddBar } from "../components/todos/TodoAddBar";
import { TodoRow } from "../components/todos/TodoRow";
import { PageHeader } from "../components/nav/PageHeader";

const PRIORITY_RANK: Record<TodoPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function TodosPage() {
  const { data, isLoading, error, refetch } = useTodos();
  const createMutation = useCreateTodo();
  const updateMutation = useUpdateTodo();
  const deleteMutation = useDeleteTodo();

  const [showDone, setShowDone] = useState(false);

  const { pending, done } = useMemo(() => {
    const all = data ?? [];
    const pending = all.filter((t) => !t.done).sort(comparePending);
    const done = all
      .filter((t) => t.done)
      .sort((a, b) => (a.done_at ?? a.updated_at) > (b.done_at ?? b.updated_at) ? -1 : 1);
    return { pending, done };
  }, [data]);

  function handleAdd(input: {
    title: string;
    priority: TodoPriority;
    due_date: string | null;
  }) {
    createMutation.mutate(input);
  }

  function handleToggle(todo: Todo) {
    const nextDone = !todo.done;
    updateMutation.mutate({
      id: todo.id,
      patch: {
        done: nextDone,
        done_at: nextDone ? new Date().toISOString() : null,
      },
    });
  }

  function handleUpdate(
    todo: Todo,
    patch: { title?: string; priority?: TodoPriority; due_date?: string | null },
  ) {
    updateMutation.mutate({ id: todo.id, patch });
  }

  function handleDelete(todo: Todo) {
    deleteMutation.mutate(todo.id);
  }

  return (
    <>
      <PageHeader
        left={
          <h2 className="font-serif text-2xl text-zinc-900 dark:text-zinc-100">
            할 일
          </h2>
        }
        right={
          pending.length > 0 ? (
            <span className="font-mono text-xs text-zinc-400">
              {pending.length}개 남음
            </span>
          ) : undefined
        }
      />
      <div className="mx-auto w-full max-w-2xl px-4 pb-12 pt-6 md:px-6">
        <TodoAddBar onAdd={handleAdd} disabled={createMutation.isPending} />

      {error ? (
        <div className="mt-6 rounded-lg border-l-4 border-red-600 bg-red-50 p-4 text-sm text-red-900 dark:border-red-500 dark:bg-red-950/30 dark:text-red-200">
          <div className="font-medium">목록을 불러오지 못했어요</div>
          <div className="mt-1 font-mono text-xs opacity-80">
            {(error as Error).message}
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 text-xs underline underline-offset-2"
            style={{ minHeight: 0 }}
          >
            다시 시도
          </button>
        </div>
      ) : isLoading ? (
        <SkeletonList />
      ) : pending.length === 0 && done.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {pending.length > 0 ? (
            <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-900">
              {pending.map((t) => (
                <TodoRow
                  key={t.id}
                  todo={t}
                  onToggle={handleToggle}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-8 text-center text-sm text-zinc-500">
              모두 완료. 할 일이 없어요.
            </p>
          )}

          {done.length > 0 ? (
            <div className="mt-8 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                className="flex items-center gap-1 text-xs text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-100"
                style={{ minHeight: 0 }}
              >
                {showDone ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                완료 {done.length}
              </button>
              {showDone ? (
                <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-900">
                  {done.map((t) => (
                    <TodoRow
                      key={t.id}
                      todo={t}
                      onToggle={handleToggle}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                    />
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </>
      )}
      </div>
    </>
  );
}

function comparePending(a: Todo, b: Todo): number {
  // due_date asc (nulls last), priority asc, created_at desc
  const ad = a.due_date;
  const bd = b.due_date;
  if (ad && bd) {
    if (ad !== bd) return ad < bd ? -1 : 1;
  } else if (ad && !bd) {
    return -1;
  } else if (!ad && bd) {
    return 1;
  }
  const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (pr !== 0) return pr;
  return a.created_at < b.created_at ? 1 : -1;
}

function SkeletonList() {
  return (
    <ul className="mt-4 space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
        />
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      <h3 className="font-serif text-2xl text-zinc-900 dark:text-zinc-100">
        할 일이 비어있어요
      </h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        오늘 가장 먼저 끝낼 한 가지를 적어보세요.
      </p>
    </div>
  );
}
