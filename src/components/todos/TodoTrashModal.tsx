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
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { Text } from "../common/Text";

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

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      ariaLabelledBy="todo-trash-title"
      dismissOnEscape={!confirmOpen}
      dismissOnBackdrop={!confirmOpen}
    >
        <div
          className="flex items-center justify-between px-4 py-3"
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEmptyConfirm(true)}
                style={{ color: "var(--accent-red)" }}
              >
                비우기
              </Button>
            ) : null}
            <Button
              variant="icon"
              onClick={onClose}
              aria-label="닫기"
              style={{ color: "var(--text-muted)" }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {deleted.length === 0 ? (
            <Text
              variant="body"
              color="muted"
              as="div"
              className="px-4 py-12 text-center"
            >
              휴지통이 비어있어요
            </Text>
          ) : (
            <ul className="p-2">
              {deleted.map((t) => (
                <li
                  key={t.id}
                  className="rounded-md px-3 py-2 transition hover:bg-[var(--bg-surface)]"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <Text variant="body" as="div" className="break-words">
                        {t.title || (
                          <Text variant="body" color="muted" as="span">
                            (제목 없음)
                          </Text>
                        )}
                      </Text>
                      <TrashedMeta todo={t} />
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="icon"
                        onClick={() =>
                          updateMutation.mutate({
                            id: t.id,
                            patch: { deleted: false },
                          })
                        }
                        title="복원"
                        aria-label="복원"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="icon"
                        onClick={() => setPurgeTarget(t)}
                        title="영구 삭제"
                        aria-label="영구 삭제"
                        style={{ color: "var(--accent-red)" }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
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
    </Modal>
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
