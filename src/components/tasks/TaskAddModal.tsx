import { useEffect, useRef, useState } from "react";
import { useCreateTodo } from "../../hooks/useTodos";
import {
  TODO_CATEGORIES,
  type TodoCategory,
  type TodoInsert,
} from "../../api/todos";
import { LooseDateInput } from "../common/LooseDateInput";
import { LooseTimeInput } from "../common/LooseTimeInput";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { Text } from "../common/Text";

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
    <Modal open={open} onClose={onClose} ariaLabelledBy="task-add-title">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg p-5 shadow-xl"
        style={{
          backgroundColor: "var(--bg-base)",
          border: "1px solid var(--border-default)",
        }}
      >
        <Text id="task-add-title" variant="h4" as="h2">
          할 일 추가
        </Text>

        <label className="mt-4 block">
          <Text
            variant="caption"
            color="secondary"
            as="span"
            weight="medium"
          >
            제목 <span style={{ color: "var(--accent-red)" }}>*</span>
          </Text>
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
            <Text
              variant="caption"
              color="secondary"
              as="span"
              weight="medium"
            >
              날짜
            </Text>
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
            <Text
              variant="caption"
              color="secondary"
              as="span"
              weight="medium"
            >
              시간
            </Text>
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
          <Text
            variant="caption"
            color="secondary"
            as="span"
            weight="medium"
          >
            카테고리
          </Text>
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
          <Text variant="caption" color="secondary" as="span">
            완료된 항목으로 추가
          </Text>
        </label>

        {createMutation.isError ? (
          <Text
            variant="caption"
            as="p"
            className="mt-3"
            style={{ color: "var(--accent-red)" }}
          >
            저장에 실패했어요. 다시 시도해주세요.
          </Text>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={createMutation.isPending}
          >
            취소
          </Button>
          <Button
            type="submit"
            variant="info"
            disabled={!canSubmit || createMutation.isPending}
          >
            {createMutation.isPending ? "저장 중…" : "저장"}
          </Button>
        </div>
      </form>
    </Modal>
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
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="rounded-full px-3 py-1"
      style={{
        backgroundColor: active ? "var(--btn-primary)" : "var(--bg-surface)",
        color: active ? "var(--btn-primary-text)" : "var(--text-secondary)",
        border: `1px solid ${active ? "var(--btn-primary)" : "var(--border-default)"}`,
      }}
    >
      {label}
    </Button>
  );
}
