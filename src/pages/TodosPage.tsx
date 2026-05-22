import { useEffect, useMemo, useState } from "react";
import { Undo2, Redo2 } from "lucide-react";
import {
  useDeleteTodo,
  useTodos,
  useUpdateTodo,
} from "../hooks/useTodos";
import {
  recordTodoUpdate,
  useTodoUndo,
  useTodoUndoShortcut,
} from "../hooks/useTodoHistory";
import type { Todo, TodoPriority, TodoCategory } from "../api/todos";
import { TaskAddModal } from "../components/tasks/TaskAddModal";
import { TodoRow } from "../components/todos/TodoRow";
import type {
  TodosCategoryFilter,
  TodosStatusFilter,
} from "../components/nav/SidePanel";
import { type TodoSortKey } from "../hooks/useTodoSort";

type Props = {
  statusFilter?: TodosStatusFilter;
  categoryFilter?: TodosCategoryFilter;
  sortKey?: TodoSortKey;
};

export function TodosPage({
  statusFilter = "all",
  categoryFilter = "all",
  sortKey = "date_desc",
}: Props) {
  const { data, isLoading, error, refetch } = useTodos();
  const updateMutation = useUpdateTodo();
  const deleteMutation = useDeleteTodo();

  const [adding, setAdding] = useState(false);
  const { canUndo, canRedo, undo, redo } = useTodoUndo();

  useTodoUndoShortcut({ active: true });

  useEffect(() => {
    function open() {
      setAdding(true);
    }
    window.addEventListener("todos:add-request", open);
    return () => window.removeEventListener("todos:add-request", open);
  }, []);

  // 두 필터 AND + sortKey 적용한 단일 list. done todo 도 inline (체크 + line-through).
  const todos = useMemo(() => {
    const all = data ?? [];
    // deleted 는 항상 list 에서 제외 (휴지통 modal 에서만 보임). cancelled 는
    // 별도 view — cancelled view 에선 카테고리 필터 무시.
    let filtered = all.filter((t) => !t.deleted);
    if (statusFilter === "cancelled") {
      filtered = filtered.filter((t) => t.cancelled);
    } else {
      filtered = filtered.filter((t) => !t.cancelled);
      if (statusFilter === "pending")
        filtered = filtered.filter((t) => !t.done);
      else if (statusFilter === "done")
        filtered = filtered.filter((t) => t.done);
      if (categoryFilter === "uncategorized")
        filtered = filtered.filter((t) => !t.category);
      else if (categoryFilter !== "all")
        filtered = filtered.filter((t) => t.category === categoryFilter);
    }
    const copy = filtered.slice();
    // 정렬 기준은 due_date + due_time. **null first** — 날짜 미적용 todo 는 최상단
    // 으로 올려서 "기한 정해야 함" 보채는 시각 신호. tie-break 은 라인 위치.
    function cmpDate(a: Todo, b: Todo, asc: boolean): number {
      const ad = a.due_date;
      const bd = b.due_date;
      if (!ad && bd) return -1; // null first
      if (ad && !bd) return 1;
      if (ad && bd && ad !== bd) return asc ? ad.localeCompare(bd) : bd.localeCompare(ad);
      const at = a.due_time;
      const bt = b.due_time;
      if (!at && bt) return -1;
      if (at && !bt) return 1;
      if (at && bt && at !== bt) return asc ? at.localeCompare(bt) : bt.localeCompare(at);
      return b._source.line - a._source.line; // 같은 시각이면 최근 추가가 위로
    }
    if (sortKey === "name") {
      copy.sort((a, b) => a.title.localeCompare(b.title, "ko"));
    } else if (sortKey === "date_asc") {
      copy.sort((a, b) => cmpDate(a, b, true));
    } else {
      copy.sort((a, b) => cmpDate(a, b, false));
    }
    return copy;
  }, [data, statusFilter, categoryFilter, sortKey]);

  function handleToggle(todo: Todo) {
    // cancelled todo 의 체크박스 클릭 = 취소 해제 (pending 복원).
    if (todo.cancelled) {
      recordTodoUpdate(todo, { cancelled: false });
      updateMutation.mutate({ id: todo.id, patch: { cancelled: false } });
      return;
    }
    const nextDone = !todo.done;
    recordTodoUpdate(todo, { done: nextDone });
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
    patch: {
      title?: string;
      priority?: TodoPriority;
      due_date?: string | null;
      due_time?: string | null;
      category?: TodoCategory | null;
      source_meeting_uid?: string | null;
      done?: boolean;
      cancelled?: boolean;
      deleted?: boolean;
    },
  ) {
    recordTodoUpdate(todo, patch);
    updateMutation.mutate({ id: todo.id, patch });
  }

  function handleDelete(todo: Todo) {
    // soft-delete: vault 라인은 `- [D]` 로 변경 (영구 삭제 X). 휴지통 view 에서
    // 복원 / 영구 삭제 가능. 이미 삭제됨 이면 영구 삭제 (vault 라인 제거).
    if (todo.deleted) {
      deleteMutation.mutate(todo.id);
      return;
    }
    recordTodoUpdate(todo, { deleted: true });
    updateMutation.mutate({ id: todo.id, patch: { deleted: true } });
  }

  return (
    <>
      {/* 메모장 MeetingForm 헤더와 동일 markup — 3-col grid (left/center/right),
          height 3.5rem, sticky. left: undo/redo, center: 제목 (text-base font-semibold). */}
      <div
        className="sticky top-0 z-20 grid items-center gap-2 overflow-hidden px-3 backdrop-blur lg:relative lg:top-auto lg:shrink-0"
        style={{
          height: "3.5rem",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr)",
          backgroundColor: "var(--bg-overlay)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div className="flex shrink-0 items-center gap-2 justify-self-start">
          <div
            className="inline-flex overflow-hidden rounded-md"
            style={{ border: "1px solid var(--border-subtle)" }}
          >
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              title="실행 취소 (⌘Z)"
              className="px-1.5 py-1 transition disabled:opacity-20"
              style={{ color: "var(--text-secondary)", minHeight: 0 }}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              title="다시 실행 (⌘⇧Z)"
              className="px-1.5 py-1 transition disabled:opacity-20"
              style={{
                color: "var(--text-secondary)",
                borderLeft: "1px solid var(--border-subtle)",
                minHeight: 0,
              }}
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <h2
          className="justify-self-center text-center text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          할 일
        </h2>
        <div className="justify-self-end" />
      </div>
      <TaskAddModal
        open={adding}
        onClose={() => setAdding(false)}
        prefill={{
          category:
            categoryFilter === "work" ||
            categoryFilter === "schedule" ||
            categoryFilter === "other"
              ? categoryFilter
              : null,
        }}
      />
      <div className="mx-auto w-full max-w-2xl px-5 pb-16 pt-5 lg:max-w-4xl">
      {error ? (
        <div
          className="mt-6 rounded-lg p-4 text-sm"
          style={{
            borderLeft: "4px solid var(--accent-red)",
            backgroundColor: "var(--accent-red-bg)",
            color: "var(--accent-red-text)",
          }}
        >
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
      ) : todos.length === 0 ? (
        <EmptyState />
      ) : (
        <ul
          key={`${statusFilter}-${categoryFilter}-${sortKey}`}
          className="mt-2 space-y-2"
        >
          {todos.map((t) => (
            <TodoRow
              key={t.id}
              todo={t}
              onToggle={handleToggle}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}
      </div>
    </>
  );
}

function SkeletonList() {
  return (
    <ul className="mt-4 space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="h-12 animate-pulse rounded-lg"
          style={{ backgroundColor: "var(--bg-surface)" }}
        />
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      <h3
        className="text-lg font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        할 일이 비어있어요
      </h3>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        오늘 가장 먼저 끝낼 한 가지를 적어보세요.
      </p>
    </div>
  );
}
