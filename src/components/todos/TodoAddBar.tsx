import { useState } from "react";
import { Plus } from "lucide-react";
import type { TodoPriority } from "../../api/todos";
import { MIN_DATE_ISO, isBeforeMinDate } from "../../lib/dates";

type Props = {
  onAdd: (input: {
    title: string;
    priority: TodoPriority;
    due_date: string | null;
  }) => void;
  disabled?: boolean;
};

export function TodoAddBar({ onAdd, disabled }: Props) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("medium");
  const [dueDate, setDueDate] = useState("");

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd({ title: trimmed, priority, due_date: dueDate || null });
    setTitle("");
    setDueDate("");
    setPriority("medium");
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg p-2.5"
      style={{
        border: "1px solid var(--border-subtle)",
        backgroundColor: "var(--bg-surface)",
      }}
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="새 할 일"
        className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm outline-none"
        style={{ color: "var(--text-primary)" }}
        aria-label="새 할 일"
      />
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value as TodoPriority)}
        aria-label="우선순위"
      >
        <option value="high">높음</option>
        <option value="medium">보통</option>
        <option value="low">낮음</option>
      </select>
      <input
        type="date"
        value={dueDate}
        min={MIN_DATE_ISO}
        onChange={(e) => {
          const v = e.target.value;
          if (isBeforeMinDate(v)) return;
          setDueDate(v);
        }}
        aria-label="기한"
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !title.trim()}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-40"
        style={{
          backgroundColor: "var(--btn-primary)",
          color: "var(--btn-primary-text)",
          minHeight: 36,
        }}
      >
        <Plus className="h-4 w-4" />
        추가
      </button>
    </div>
  );
}
