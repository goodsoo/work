import type { Todo } from "../../api/todos";
import { TimelineBlock } from "./TimelineBlock";
import { Button } from "../common/Button";
import { Text } from "../common/Text";

type Props = {
  todo: Todo;
  onToggle: () => void;
};

export function TodoBlock({ todo, onToggle }: Props) {
  return (
    <TimelineBlock letter="T">
      <div className="flex items-start gap-2.5">
        <Button
          variant="ghost"
          aria-label={todo.done ? "완료 취소" : "완료"}
          onClick={onToggle}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 p-0"
          style={{
            borderColor: todo.done ? "var(--border-default)" : "var(--accent-red)",
            backgroundColor: todo.done ? "var(--border-default)" : "var(--bg-base)",
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
        </Button>
        <Text
          variant="h4"
          weight="normal"
          as="span"
          className={todo.done ? "line-through" : ""}
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
        </Text>
      </div>
    </TimelineBlock>
  );
}
