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
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition ${
            todo.done
              ? "border-zinc-300 bg-zinc-300 dark:border-zinc-600 dark:bg-zinc-600"
              : "border-red-600 bg-white hover:bg-red-50 dark:border-red-500 dark:bg-zinc-950 dark:hover:bg-red-950/30"
          }`}
          style={{ minHeight: 16, minWidth: 16 }}
        >
          {todo.done ? (
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="h-2.5 w-2.5 text-white"
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
          className={`text-base ${
            todo.done
              ? "text-zinc-400 line-through dark:text-zinc-400"
              : todo.priority === "high"
                ? "font-semibold text-zinc-900 dark:text-zinc-100"
                : todo.priority === "low"
                  ? "text-zinc-500 dark:text-zinc-400"
                  : "text-zinc-900 dark:text-zinc-100"
          }`}
        >
          {todo.title}
        </span>
      </div>
    </TimelineBlock>
  );
}
