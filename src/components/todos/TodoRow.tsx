import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import type { Todo, TodoPriority, TodoCategory } from "../../api/todos";
import { TODO_CATEGORIES } from "../../api/todos";
import { isPast, isToday, relativeDateLabel } from "../../lib/dates";

type Props = {
  todo: Todo;
  onToggle: (todo: Todo) => void;
  onUpdate: (todo: Todo, patch: { title?: string; priority?: TodoPriority; due_date?: string | null; category?: TodoCategory | null }) => void;
  onDelete: (todo: Todo) => void;
};

export function TodoRow({ todo, onToggle, onUpdate, onDelete }: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(todo.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTitle) inputRef.current?.focus();
  }, [editingTitle]);

  function commitTitle() {
    const next = titleDraft.trim();
    setEditingTitle(false);
    if (!next) {
      setTitleDraft(todo.title);
      return;
    }
    if (next !== todo.title) onUpdate(todo, { title: next });
  }

  return (
    <li className="flex items-start gap-3 py-3">
      <button
        type="button"
        aria-label={todo.done ? "완료 취소" : "완료"}
        onClick={() => onToggle(todo)}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${
          todo.done
            ? "border-zinc-300 bg-zinc-300 dark:border-zinc-600 dark:bg-zinc-600"
            : "border-zinc-400 bg-white hover:bg-zinc-50 dark:border-zinc-500 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        }`}
        style={{ minHeight: 20, minWidth: 20 }}
      >
        {todo.done ? (
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="h-3 w-3 text-white"
            aria-hidden
          >
            <path
              d="M3 8l3 3 7-7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </button>

      <div className="min-w-0 flex-1">
        {editingTitle ? (
          <input
            ref={inputRef}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
              if (e.key === "Escape") {
                setTitleDraft(todo.title);
                setEditingTitle(false);
              }
            }}
            className="w-full bg-transparent text-base outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingTitle(true)}
            className={`block w-full text-left text-base ${
              todo.done
                ? "text-zinc-400 line-through dark:text-zinc-500"
                : "text-zinc-900 dark:text-zinc-100"
            } ${
              priorityWeightClass(todo.priority, todo.done)
            }`}
            style={{ minHeight: 0 }}
          >
            {todo.title}
          </button>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
          <PrioritySelect
            value={todo.priority}
            onChange={(p) => onUpdate(todo, { priority: p })}
            disabled={todo.done}
          />
          <DueDateInput
            value={todo.due_date}
            onChange={(d) => onUpdate(todo, { due_date: d })}
            done={todo.done}
          />
          <CategorySelect
            value={todo.category}
            onChange={(c) => onUpdate(todo, { category: c })}
          />
          {todo.linked_meeting_id ? (
            <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-400">
              from meeting
            </span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        aria-label="삭제"
        onClick={() => onDelete(todo)}
        className="shrink-0 rounded p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-900 dark:hover:text-red-500"
        style={{ minHeight: 32, minWidth: 32 }}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function priorityWeightClass(p: TodoPriority, done: boolean): string {
  if (done) return "";
  if (p === "high") return "font-semibold";
  if (p === "low") return "font-normal text-zinc-500 dark:text-zinc-400";
  return "";
}

const PRIORITY_LABEL: Record<TodoPriority, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

function PrioritySelect({
  value,
  onChange,
  disabled,
}: {
  value: TodoPriority;
  onChange: (p: TodoPriority) => void;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-1">
      <span className="sr-only">우선순위</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TodoPriority)}
        disabled={disabled}
        className="disabled:opacity-60"
      >
        {(Object.keys(PRIORITY_LABEL) as TodoPriority[]).map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABEL[p]}
          </option>
        ))}
      </select>
    </label>
  );
}

function CategorySelect({
  value,
  onChange,
}: {
  value: TodoCategory | null;
  onChange: (c: TodoCategory | null) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1">
      <span className="sr-only">카테고리</span>
      <select
        value={value ?? ""}
        onChange={(e) =>
          onChange((e.target.value || null) as TodoCategory | null)
        }
      >
        <option value="">없음</option>
        {TODO_CATEGORIES.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DueDateInput({
  value,
  onChange,
  done,
}: {
  value: string | null;
  onChange: (date: string | null) => void;
  done: boolean;
}) {
  const overdue = !done && value && isPast(value);
  const today = !done && value && isToday(value);
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="sr-only">기한</span>
      {value ? (
        <span
          className={`font-mono text-[11px] ${
            overdue
              ? "text-red-600 dark:text-red-500"
              : today
                ? "text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500"
          }`}
        >
          {relativeDateLabel(value)}
        </span>
      ) : null}
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label="기한"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          aria-label="기한 제거"
          style={{ minHeight: 0 }}
        >
          ×
        </button>
      ) : null}
    </label>
  );
}
