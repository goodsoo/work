import type { Todo } from "../../api/todos";
import { TimelineBlock } from "./TimelineBlock";

type Props = {
  todo: Todo;
  onToggle: () => void;
};

export function TodoBlock({ todo, onToggle }: Props) {
  return (
    <TimelineBlock letter="T">
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          aria-label={todo.done ? "완료 취소" : "완료"}
          onClick={onToggle}
          className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition"
          style={{
            borderColor: todo.done ? "var(--border-default)" : "var(--accent-red)",
            backgroundColor: todo.done ? "var(--border-default)" : "var(--bg-base)",
            minHeight: 16,
            minWidth: 16,
          }}
        >
          {todo.done ? (
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="h-2.5 w-2.5"
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
        <span
          className={`text-base ${todo.done ? "line-through" : ""}`}
          style={{
            color: todo.done
              ? "var(--text-muted)"
              : todo.priority === "high"
                ? "var(--text-primary)"
                : todo.priority === "low"
                  ? "var(--text-secondary)"
                  : "var(--text-primary)",
            fontWeight: !todo.done && todo.priority === "high" ? 600 : undefined,
          }}
        >
          {todo.title}
        </span>
      </div>
    </TimelineBlock>
  );
}
