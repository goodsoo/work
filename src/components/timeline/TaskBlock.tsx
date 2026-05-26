import type { Task } from "../../api/tasks";
import { TimelineBlock } from "./TimelineBlock";
import { Button } from "../common/Button";
import { Text } from "../common/Text";

type Props = {
  task: Task;
  onToggle: () => void;
};

export function TaskBlock({ task, onToggle }: Props) {
  return (
    <TimelineBlock letter="T">
      <div className="flex items-start gap-2.5">
        <Button
          variant="ghost"
          aria-label={task.done ? "완료 취소" : "완료"}
          onClick={onToggle}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 p-0"
          style={{
            borderColor: task.done ? "var(--border-default)" : "var(--accent-red)",
            backgroundColor: task.done ? "var(--border-default)" : "var(--bg-base)",
            minWidth: 16,
          }}
        >
          {task.done ? (
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
          className={task.done ? "line-through" : ""}
          style={{
            color: task.done
              ? "var(--text-muted)"
              : task.priority === "high"
                ? "var(--text-primary)"
                : task.priority === "low"
                  ? "var(--text-secondary)"
                  : "var(--text-primary)",
            fontWeight: !task.done && task.priority === "high" ? 600 : undefined,
          }}
        >
          {task.title}
        </Text>
      </div>
    </TimelineBlock>
  );
}
