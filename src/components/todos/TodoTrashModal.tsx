import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Trash2, X } from "lucide-react";
import {
  useDeleteTodo,
  useTodos,
  useUpdateTodo,
} from "../../hooks/useTodos";
import {
  formatDateShort,
  parseIsoDate,
  weekdayShort,
} from "../../lib/dates";
import { TODO_CATEGORIES, type Todo } from "../../api/todos";
import { ConfirmDialog } from "../ConfirmDialog";

type Props = {
  open: boolean;
  onClose: () => void;
};

// 삭제된 (deleted=true) todo 모아보기. 카드 클릭 시 편집 X — 복원 / 영구 삭제 만.
// 메모장 TrashModal 과 같은 overlay 패턴.
export function TodoTrashModal({ open, onClose }: Props) {
  const { data } = useTodos();
  const updateMutation = useUpdateTodo();
  const deleteMutation = useDeleteTodo();
  const [purgeTarget, setPurgeTarget] = useState<Todo | null>(null);
  const [emptyConfirm, setEmptyConfirm] = useState(false);

  const deleted = useMemo(() => {
    return (data ?? []).filter((t) => t.deleted);
  }, [data]);

  const confirmOpen = purgeTarget !== null || emptyConfirm;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      // ConfirmDialog 가 열려있으면 그쪽이 ESC 잡음.
      if (e.key === "Escape" && !confirmOpen) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, confirmOpen]);

  // 모달 닫힐 때 confirm state 리셋
  useEffect(() => {
    if (!open) {
      setPurgeTarget(null);
      setEmptyConfirm(false);
    }
  }, [open]);

  function handleEmpty() {
    for (const t of deleted) {
      deleteMutation.mutate(t.id);
    }
    setEmptyConfirm(false);
  }

  function handlePurge() {
    if (!purgeTarget) return;
    deleteMutation.mutate(purgeTarget.id);
    setPurgeTarget(null);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="todo-trash-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full max-h-[36rem] w-full max-w-md flex-col overflow-hidden rounded-lg shadow-xl"
        style={{
          backgroundColor: "var(--bg-base)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div
          className="flex shrink-0 items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <h2
            id="todo-trash-title"
            className="font-serif text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            휴지통{deleted.length > 0 ? ` (${deleted.length})` : ""}
          </h2>
          <div className="flex items-center gap-1">
            {deleted.length > 0 ? (
              <button
                type="button"
                onClick={() => setEmptyConfirm(true)}
                className="rounded-md px-2 py-1 text-xs transition hover:bg-[var(--bg-surface-hover)]"
                style={{ color: "var(--accent-red)", minHeight: 0 }}
              >
                비우기
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="rounded p-1 transition hover:bg-[var(--bg-surface-hover)]"
              style={{ color: "var(--text-muted)", minHeight: 0 }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {deleted.length === 0 ? (
            <div
              className="px-4 py-12 text-center text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              휴지통이 비어있어요
            </div>
          ) : (
            <ul className="p-2">
              {deleted.map((t) => (
                <li
                  key={t.id}
                  className="rounded-md px-3 py-2 transition hover:bg-[var(--bg-surface)]"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div
                        className="break-words text-sm"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {t.title || (
                          <span style={{ color: "var(--text-muted)" }}>
                            (제목 없음)
                          </span>
                        )}
                      </div>
                      <TrashedMeta todo={t} />
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateMutation.mutate({
                            id: t.id,
                            patch: { deleted: false },
                          })
                        }
                        title="복원"
                        aria-label="복원"
                        className="rounded p-1.5 transition hover:bg-[var(--bg-surface-hover)]"
                        style={{ color: "var(--text-secondary)", minHeight: 0 }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPurgeTarget(t)}
                        title="영구 삭제"
                        aria-label="영구 삭제"
                        className="rounded p-1.5 transition hover:bg-[var(--bg-surface-hover)]"
                        style={{ color: "var(--accent-red)", minHeight: 0 }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={purgeTarget !== null}
        title="영구 삭제"
        message={
          purgeTarget
            ? `"${purgeTarget.title.trim() || "(제목 없음)"}" 을(를) 영구 삭제할까요? 되돌릴 수 없어요.`
            : ""
        }
        confirmLabel="영구 삭제"
        danger
        onConfirm={handlePurge}
        onCancel={() => setPurgeTarget(null)}
      />
      <ConfirmDialog
        open={emptyConfirm}
        title="휴지통 비우기"
        message={`${deleted.length}개 항목을 모두 영구 삭제할까요? 되돌릴 수 없어요.`}
        confirmLabel="비우기"
        danger
        onConfirm={handleEmpty}
        onCancel={() => setEmptyConfirm(false)}
      />
    </div>
  );
}

function TrashedMeta({
  todo,
}: {
  todo: { due_date: string | null; due_time: string | null; category: string | null };
}) {
  const hasDate = !!todo.due_date;
  const hasTime = !!todo.due_time;
  const categoryLabel = TODO_CATEGORIES.find((c) => c.id === todo.category)?.label;
  if (!hasDate && !hasTime && !categoryLabel) return null;
  const wd = todo.due_date ? weekdayShort(todo.due_date) : null;
  const sameYear =
    todo.due_date &&
    parseIsoDate(todo.due_date).getFullYear() === new Date().getFullYear();
  const dateLabel = sameYear ? formatDateShort(todo.due_date!) : todo.due_date;
  return (
    <div
      className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"
      style={{ color: "var(--text-muted)" }}
    >
      {hasDate ? (
        <span>
          {dateLabel}
          {wd ? ` (${wd})` : ""}
        </span>
      ) : null}
      {hasTime ? <span>{todo.due_time}</span> : null}
      {categoryLabel ? <span>#{categoryLabel}</span> : null}
    </div>
  );
}
