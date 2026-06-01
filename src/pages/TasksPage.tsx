import { useEffect, useMemo } from "react";
import { Undo2, Redo2, AlertCircle } from "lucide-react";
import {
  useDeleteTask,
  useTasks,
  useUpdateTask,
} from "../hooks/useTasks";
import {
  recordTaskUpdate,
  useTaskUndo,
  useTaskUndoShortcut,
} from "../hooks/useTaskHistory";
import {
  TASK_CATEGORIES,
  type Task,
  type TaskPriority,
  type TaskCategory,
} from "../api/tasks";
import { categoryColor } from "../lib/taskCategory";
import { TaskRow } from "../components/tasks/TaskRow";
import { SyncStatusChip } from "../components/tasks/SyncStatusChip";
import { PageHeaderBar } from "../components/common/PageHeaderBar";
import { Button } from "../components/common/Button";
import { Text } from "../components/common/Text";
import { SelectableChip } from "../components/common/SelectableChip";
import { EmptyState } from "../components/common/EmptyState";
import type {
  TaskCategoryFilter,
  TaskStatusFilter,
} from "../components/nav/SidePanel";
import { type TaskSortKey } from "../hooks/useTaskSort";
import { TaskSortMenu } from "../components/tasks/TaskSortMenu";

type Props = {
  statusFilter?: TaskStatusFilter;
  categoryFilter?: TaskCategoryFilter;
  onCategoryChange?: (next: TaskCategoryFilter) => void;
  sortKey?: TaskSortKey;
  onSortKeyChange?: (next: TaskSortKey) => void;
  // 캘린더 사이드바 task 클릭으로 진입 시 해당 row 로 scroll. 한 번 처리 후 clear.
  scrollToTaskId?: string | null;
  onScrollHandled?: () => void;
};

export function TasksPage({
  statusFilter = "all",
  categoryFilter = "all",
  onCategoryChange,
  sortKey = "date_asc",
  onSortKeyChange,
  scrollToTaskId = null,
  onScrollHandled,
}: Props) {
  const { data, isLoading, error, refetch } = useTasks();
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();

  // 카테고리별 카운트 — cancelled/deleted 제외. 카테고리 chip 의 dim 처리에 사용.
  const categoryCounts = useMemo(() => {
    const map = new Map<TaskCategory | "uncategorized", number>();
    let uncategorized = 0;
    for (const t of data ?? []) {
      if (t.deleted || t.cancelled) continue;
      if (!t.category) uncategorized++;
      else map.set(t.category, (map.get(t.category) ?? 0) + 1);
    }
    map.set("uncategorized", uncategorized);
    return map;
  }, [data]);

  const { canUndo, canRedo, undo, redo } = useTaskUndo();

  useTaskUndoShortcut({ active: true });

  // 두 필터 AND + sortKey 적용한 단일 list. done task 도 inline (체크 + line-through).
  const tasks = useMemo(() => {
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
    // 정렬 기준은 due_date + due_time. **null first** — 날짜 미적용 task 는 최상단
    // 으로 올려서 "기한 정해야 함" 보채는 시각 신호. tie-break 은 라인 위치.
    function cmpDate(a: Task, b: Task, asc: boolean): number {
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
    } else if (sortKey === "date_asc_undone") {
      // 미완료 먼저 → 그 안에서 오래된순. 끝낸 일은 아래로 내려보냄.
      copy.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return cmpDate(a, b, true);
      });
    } else {
      copy.sort((a, b) => cmpDate(a, b, false));
    }
    return copy;
  }, [data, statusFilter, categoryFilter, sortKey]);

  // 캘린더 사이드바에서 태스크 클릭 → 할 일 탭 진입 시 해당 row 로 부드럽게 scroll 후
  // 편집모드 자동 진입 (el.click() 이 TaskRow li 의 onClick → setEditing(true) 트리거).
  // list 렌더 완료 후 (tasks / scrollToTaskId 모두 valid) 한 번만 실행 → onScrollHandled
  // 로 부모 state 정리. tasks.length 의존: filter reset 후 list 가 도착해야 element 가 mount 됨.
  useEffect(() => {
    if (!scrollToTaskId || tasks.length === 0) return;
    const el = document.querySelector<HTMLElement>(
      `[data-todoid="${CSS.escape(scrollToTaskId)}"]`,
    );
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.click();
    }
    onScrollHandled?.();
  }, [scrollToTaskId, tasks, onScrollHandled]);

  function handleToggle(task: Task) {
    // cancelled task 의 체크박스 클릭 = 취소 해제 (pending 복원).
    if (task.cancelled) {
      recordTaskUpdate(task, { cancelled: false });
      updateMutation.mutate({ id: task.id, patch: { cancelled: false } });
      return;
    }
    const nextDone = !task.done;
    recordTaskUpdate(task, { done: nextDone });
    updateMutation.mutate({
      id: task.id,
      patch: {
        done: nextDone,
        done_at: nextDone ? new Date().toISOString() : null,
      },
    });
  }

  function handleUpdate(
    task: Task,
    patch: {
      title?: string;
      priority?: TaskPriority;
      due_date?: string | null;
      due_time?: string | null;
      category?: TaskCategory | null;
      source_meeting_uid?: string | null;
      done?: boolean;
      cancelled?: boolean;
      deleted?: boolean;
    },
  ) {
    recordTaskUpdate(task, patch);
    updateMutation.mutate({ id: task.id, patch });
  }

  function handleDelete(task: Task) {
    // soft-delete: vault 라인은 `- [D]` 로 변경 (영구 삭제 X). 휴지통 view 에서
    // 복원 / 영구 삭제 가능. 이미 삭제됨 이면 영구 삭제 (vault 라인 제거).
    if (task.deleted) {
      deleteMutation.mutate(task.id);
      return;
    }
    recordTaskUpdate(task, { deleted: true });
    updateMutation.mutate({ id: task.id, patch: { deleted: true } });
  }

  return (
    <>
      <PageHeaderBar
        left={
          <div
            className="inline-flex overflow-hidden rounded-md"
            style={{ border: "1px solid var(--border-subtle)" }}
          >
            <Button
              variant="ghost"
              onClick={undo}
              disabled={!canUndo}
              title="실행 취소 (⌘Z)"
              className="rounded-none px-1.5 py-1 disabled:opacity-20"
              style={{ color: "var(--text-secondary)" }}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              onClick={redo}
              disabled={!canRedo}
              title="다시 실행 (⌘⇧Z)"
              className="rounded-none px-1.5 py-1 disabled:opacity-20"
              style={{
                color: "var(--text-secondary)",
                borderLeft: "1px solid var(--border-subtle)",
              }}
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
        center={
          <Text variant="h4" as="h2" className="text-center">
            할 일
          </Text>
        }
        right={<SyncStatusChip />}
      />
      {onCategoryChange ? (
        <CategoryChipRow
          selected={categoryFilter}
          counts={categoryCounts}
          onChange={onCategoryChange}
          sortKey={sortKey}
          onSortKeyChange={onSortKeyChange}
        />
      ) : null}
      <div className="mx-auto w-full max-w-2xl px-5 pb-16 pt-5 lg:max-w-4xl">
      {error ? (
        <EmptyState
          icon={
            <AlertCircle
              className="h-12 w-12"
              style={{ color: "var(--accent-red)" }}
              strokeWidth={1.25}
            />
          }
          title="목록을 불러오지 못했습니다"
          description={
            <>
              <Text variant="body" color="secondary" as="p">
                잠시 후 다시 시도하세요.
              </Text>
              <Text variant="caption" color="muted" as="p" className="mt-1 font-mono">
                {(error as Error).message}
              </Text>
            </>
          }
          action={
            <Button variant="primary" onClick={() => void refetch()}>
              다시 시도
            </Button>
          }
        />
      ) : isLoading ? (
        <SkeletonList />
      ) : tasks.length === 0 ? (
        <TasksEmptyState />
      ) : (
        <ul
          key={`${statusFilter}-${categoryFilter}-${sortKey}`}
          className="mt-2 space-y-2"
        >
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
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

// 페이지 헤더 아래 sub-header — 카테고리 chip group (single radio). 작업 페이지의
// 같은 자리와 동일 패턴. "전체 / 미분류 / 업무 / 일정 / 기타" 5개 chip 가로 wrap.
function CategoryChipRow({
  selected,
  counts,
  onChange,
  sortKey,
  onSortKeyChange,
}: {
  selected: TaskCategoryFilter;
  counts: Map<TaskCategory | "uncategorized", number>;
  onChange: (next: TaskCategoryFilter) => void;
  sortKey: TaskSortKey;
  onSortKeyChange?: (next: TaskSortKey) => void;
}) {
  return (
    <div
      className="sticky z-10 shrink-0 px-6 py-2 backdrop-blur"
      style={{
        top: "var(--page-header-h)",
        borderBottom: "1px solid var(--border-subtle)",
        backgroundColor: "var(--bg-overlay)",
      }}
    >
      <div className="flex flex-wrap items-center gap-1">
        <SelectableChip
          active={selected === "all"}
          onToggle={() => onChange("all")}
          title="전체 카테고리"
        >
          전체
        </SelectableChip>
        <SelectableChip
          active={selected === "uncategorized"}
          color="var(--text-muted)"
          onToggle={() => onChange("uncategorized")}
          title="미분류"
        >
          미분류
        </SelectableChip>
        {TASK_CATEGORIES.map((c) => {
          const active = selected === c.id;
          const count = counts.get(c.id) ?? 0;
          const color = categoryColor(c.id);
          return (
            <SelectableChip
              key={c.id}
              active={active}
              color={color}
              onToggle={() => onChange(c.id)}
              title={`${c.label} ${count > 0 ? `(${count})` : ""}`.trim()}
            >
              {c.label}
            </SelectableChip>
          );
        })}
        {onSortKeyChange ? (
          <div className="ml-auto">
            <TaskSortMenu value={sortKey} onChange={onSortKeyChange} />
          </div>
        ) : null}
      </div>
    </div>
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

function TasksEmptyState() {
  return (
    <EmptyState
      title="태스크가 비어있어요"
      description="오늘 가장 먼저 끝낼 한 가지를 적어보세요."
    />
  );
}
