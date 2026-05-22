import { useEffect, useRef, useState } from "react";
import { useCreateTodo } from "../../hooks/useTodos";
import {
  TODO_CATEGORIES,
  type TodoCategory,
  type TodoInsert,
} from "../../api/todos";
import { LooseDateInput } from "../common/LooseDateInput";
import { LooseTimeInput } from "../common/LooseTimeInput";

type Props = {
  open: boolean;
  onClose: () => void;
  // 메모 "할일로 보내기" / 캘린더 셀 클릭 등에서 prefill 채워서 띄움.
  // title/date/time/category 모두 optional. 사용자가 모달 안에서 다듬음.
  prefill?: Partial<TodoInsert>;
};

export function TaskAddModal({ open, onClose, prefill }: Props) {
  const createMutation = useCreateTodo();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [category, setCategory] = useState<TodoCategory | null>(null);
  const [done, setDone] = useState(false);
  // 메모 → 할일 prefill 시점에 set, 사용자가 모달에서 못 바꿈 (origin 정보).
  const [sourceMeetingUid, setSourceMeetingUid] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // 모달 열림 + prefill 이 바뀌면 draft 동기화 (보기 모드 → 편집 모드 전환 등).
  // 의도된 sync.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setTitle(prefill?.title ?? "");
    setDate(prefill?.due_date ?? "");
    setTime(prefill?.due_time ?? "");
    setCategory(prefill?.category ?? null);
    setDone(prefill?.done ?? false);
    setSourceMeetingUid(prefill?.source_meeting_uid ?? null);
    requestAnimationFrame(() => titleRef.current?.focus());
  }, [open, prefill]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const canSubmit = title.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    createMutation.mutate(
      {
        title: title.trim(),
        done,
        due_date: date || null,
        due_time: date && time ? time : null, // 시간만 있고 날짜 없으면 무시
        category,
        source_meeting_uid: sourceMeetingUid,
      },
      { onSuccess: () => onClose() },
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-add-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg p-5 shadow-xl"
        style={{
          backgroundColor: "var(--bg-base)",
          border: "1px solid var(--border-default)",
        }}
      >
        <h2
          id="task-add-title"
          className="text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          할 일 추가
        </h2>

        <label className="mt-4 block">
          <span
            className="text-xs font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            제목 <span style={{ color: "var(--accent-red)" }}>*</span>
          </span>
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 보고서 작성"
            aria-required="true"
            maxLength={200}
            className="mt-1 w-full rounded-md px-2 py-1.5 text-sm outline-none"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              color: "var(--text-primary)",
            }}
          />
        </label>

        <div
          className="mt-3 grid gap-2"
          style={{ gridTemplateColumns: "2fr 1fr" }}
        >
          <label className="block">
            <span
              className="text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              날짜
            </span>
            <div
              className="mt-1 rounded-md px-2 py-1.5"
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
              }}
            >
              <LooseDateInput value={date} onCommit={setDate} fullWidth />
            </div>
          </label>
          <label className="block">
            <span
              className="text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              시간
            </span>
            <div
              className="mt-1 rounded-md px-2 py-1.5"
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
              }}
            >
              <LooseTimeInput value={time} onCommit={setTime} fullWidth />
            </div>
          </label>
        </div>

        <div className="mt-3">
          <span
            className="text-xs font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            카테고리
          </span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <CategoryChip
              label="미분류"
              active={category === null}
              onClick={() => setCategory(null)}
            />
            {TODO_CATEGORIES.map((c) => (
              <CategoryChip
                key={c.id}
                label={c.label}
                active={category === c.id}
                onClick={() => setCategory(c.id)}
              />
            ))}
          </div>
        </div>

        <label className="mt-3 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={done}
            onChange={(e) => setDone(e.target.checked)}
          />
          <span style={{ color: "var(--text-secondary)" }}>
            완료된 항목으로 추가
          </span>
        </label>

        {createMutation.isError ? (
          <p className="mt-3 text-xs" style={{ color: "var(--accent-red)" }}>
            저장에 실패했어요. 다시 시도해주세요.
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={createMutation.isPending}
            className="rounded-md px-3 py-1.5 text-sm transition disabled:opacity-40"
            style={{
              border: "1px solid var(--border-default)",
              color: "var(--text-secondary)",
              minHeight: 0,
            }}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!canSubmit || createMutation.isPending}
            className="rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-40"
            style={{
              backgroundColor: "var(--accent-blue)",
              color: "white",
              minHeight: 0,
            }}
          >
            {createMutation.isPending ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3 py-1 text-xs transition"
      style={{
        backgroundColor: active ? "var(--btn-primary)" : "var(--bg-surface)",
        color: active ? "var(--btn-primary-text)" : "var(--text-secondary)",
        border: `1px solid ${active ? "var(--btn-primary)" : "var(--border-default)"}`,
        minHeight: 0,
      }}
    >
      {label}
    </button>
  );
}
