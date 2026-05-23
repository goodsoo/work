import { useState } from "react";
import { Hash } from "lucide-react";
import { TODO_CATEGORIES, type TodoCategory } from "../../api/todos";
import { Button } from "./Button";
import { Popover } from "./Popover";

type Props = {
  value: TodoCategory | null;
  onChange: (next: TodoCategory | null) => void;
  // 부모 wrap 너비에 맞춰 button 100% — 카테고리 라벨 길이 변해도 흔들림 X.
  fullWidth?: boolean;
};

// 카테고리 picker. MeetingPicker 와 같은 popover 패턴으로 시각 통일.
// 옵션 작아서 검색 input 은 없음 — 단순 list 만.
export function CategoryPicker({ value, onChange, fullWidth }: Props) {
  const [open, setOpen] = useState(false);
  const label =
    TODO_CATEGORIES.find((c) => c.id === value)?.label ?? "미분류";

  const options: Array<{ id: TodoCategory | null; label: string }> = [
    { id: null, label: "미분류" },
    ...TODO_CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
  ];

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      className={`relative items-center ${fullWidth ? "flex w-full" : "inline-flex"}`}
      panelClassName="absolute left-0 top-full z-30 mt-1 min-w-[8rem] overflow-hidden rounded-md shadow-md"
      panelStyle={{
        backgroundColor: "var(--bg-base)",
        border: "1px solid var(--border-default)",
      }}
      trigger={
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className={`overflow-hidden px-2 py-0.5 font-normal ${
            fullWidth ? "w-full" : ""
          }`}
          style={{ color: "var(--text-secondary)" }}
          aria-haspopup="listbox"
          aria-expanded={open}
          leftIcon={<Hash className="h-3 w-3 shrink-0 opacity-60" aria-hidden />}
        >
          <span className="truncate">{label}</span>
        </Button>
      }
    >
      <ul className="py-1" onClick={(e) => e.stopPropagation()}>
        {options.map((opt) => {
          const active = opt.id === value;
          return (
            <li key={opt.id ?? "null"}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                className="w-full justify-start rounded-none px-3 py-1.5 font-normal"
                style={{
                  backgroundColor: active
                    ? "var(--bg-surface-active)"
                    : undefined,
                  color: active
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
                }}
              >
                {opt.label}
              </Button>
            </li>
          );
        })}
      </ul>
    </Popover>
  );
}
