import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import type { Todo, TodoPriority, TodoCategory } from "../../api/todos";
import { TODO_CATEGORIES } from "../../api/todos";
import {
  MIN_DATE_ISO,
  isBeforeMinDate,
  isPast,
  isToday,
  relativeDateLabel,
} from "../../lib/dates";

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
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition"
        style={{
          borderColor: todo.done ? "var(--border-default)" : "var(--text-muted)",
          backgroundColor: todo.done ? "var(--border-default)" : "var(--bg-base)",
          minHeight: 20,
          minWidth: 20,
        }}
      >
        {todo.done ? (
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="h-3 w-3"
            style={{ color: "var(--text-inverse)" }}
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
              todo.done ? "line-through" : ""
            } ${
              priorityWeightClass(todo.priority, todo.done)
            }`}
            style={{
              color: todo.done
                ? "var(--text-muted)"
                : todo.priority === "low"
                  ? "var(--text-secondary)"
                  : "var(--text-primary)",
              minHeight: 0,
            }}
          >
            {todo.title}
          </button>
        )}

        <div
          className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
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
        </div>
      </div>

      <button
        type="button"
        aria-label="삭제"
        onClick={() => onDelete(todo)}
        className="shrink-0 rounded p-1 transition"
        style={{ color: "var(--text-muted)", minHeight: 32, minWidth: 32 }}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function priorityWeightClass(p: TodoPriority, done: boolean): string {
  if (done) return "";
  if (p === "high") return "font-semibold";
  if (p === "low") return "font-normal";
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
          className="font-mono text-[11px]"
          style={{
            color: overdue
              ? "var(--accent-red)"
              : today
                ? "var(--text-primary)"
                : "var(--text-secondary)",
          }}
        >
          {relativeDateLabel(value)}
        </span>
      ) : null}
      <input
        type="date"
        value={value ?? ""}
        min={MIN_DATE_ISO}
        onChange={(e) => {
          const v = e.target.value;
          if (isBeforeMinDate(v)) return;
          onChange(v || null);
        }}
        aria-label="기한"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-[10px]"
          style={{ color: "var(--text-muted)", minHeight: 0 }}
          aria-label="기한 제거"
        >
          ×
        </button>
      ) : null}
    </label>
  );
}
