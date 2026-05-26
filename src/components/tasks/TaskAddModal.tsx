import { useEffect, useRef, useState } from "react";
import { useCreateTodo } from "../../hooks/useTodos";
import { useCreateRoutine } from "../../hooks/useRoutines";
import {
  TODO_CATEGORIES,
  type TodoCategory,
  type TodoInsert,
} from "../../api/todos";
import { todayIso } from "../../lib/dates";
import { LooseDateInput } from "../common/LooseDateInput";
import { LooseTimeInput } from "../common/LooseTimeInput";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { Text } from "../common/Text";
import { useToast } from "../Toast";
import { formatError } from "../../lib/errors";

type AddType = "task" | "routine";

type Props = {
  open: boolean;
  onClose: () => void;
  prefill?: Partial<TodoInsert>;
  // 모달 default 탭. 미지정 = "task". 사이드바 polish 단계에서 사용자가 routine
  // 폴더 활성 상태에서 + 눌렀을 때 "routine" 직접 지정 가능.
  defaultType?: AddType;
};

export function TaskAddModal({
  open,
  onClose,
  prefill,
  defaultType = "task",
}: Props) {
  const [type, setType] = useState<AddType>(defaultType);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setType(defaultType);
  }, [open, defaultType]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <Modal open={open} onClose={onClose} size="sm" ariaLabelledBy="task-add-title">
      {/* min-height 로 탭 (태스크/루틴) 컨텐츠 길이 차이에 모달이 흔들리지 않도록 고정. */}
      <div className="flex flex-col p-5" style={{ minHeight: "24rem" }}>
        <Text id="task-add-title" variant="h4" as="h2">
          {type === "routine" ? "루틴 추가" : "할 일 추가"}
        </Text>

        {/* 탭 segmented control */}
        <div
          className="mt-4 inline-flex w-full overflow-hidden rounded-md"
          role="tablist"
          aria-label="추가 종류"
          style={{ border: "1px solid var(--border-default)" }}
        >
          {(["task", "routine"] as const).map((t) => {
            const active = t === type;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setType(t)}
                className="flex-1 py-1.5 text-xs transition"
                style={{
                  backgroundColor: active
                    ? "var(--btn-primary)"
                    : "transparent",
                  color: active
                    ? "var(--btn-primary-text)"
                    : "var(--text-secondary)",
                }}
              >
                {t === "task" ? "태스크" : "루틴"}
              </button>
            );
          })}
        </div>

        {type === "task" ? (
          <TaskForm prefill={prefill} onDone={onClose} />
        ) : (
          <RoutineForm onDone={onClose} />
        )}
      </div>
    </Modal>
  );
}

// ─── 태스크 폼 (기존) ──────────────────────────────────────────────────────

function TaskForm({
  prefill,
  onDone,
}: {
  prefill?: Partial<TodoInsert>;
  onDone: () => void;
}) {
  const createMutation = useCreateTodo();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [category, setCategory] = useState<TodoCategory | null>(null);
  const [done, setDone] = useState(false);
  const [sourceMeetingUid, setSourceMeetingUid] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setTitle(prefill?.title ?? "");
    setDate(prefill?.due_date ?? "");
    setTime(prefill?.due_time ?? "");
    setCategory(prefill?.category ?? null);
    setDone(prefill?.done ?? false);
    setSourceMeetingUid(prefill?.source_meeting_uid ?? null);
    requestAnimationFrame(() => titleRef.current?.focus());
  }, [prefill]);
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
        due_time: date && time ? time : null,
        category,
        source_meeting_uid: sourceMeetingUid,
      },
      { onSuccess: () => onDone() },
    );
  }

  return (
    <form className="flex flex-1 flex-col" onSubmit={handleSubmit}>
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

      <div className="mt-auto flex justify-end gap-2 pt-5">
        <Button
          variant="secondary"
          onClick={onDone}
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
  );
}

// ─── 루틴 폼 ───────────────────────────────────────────────────────────────

type RoutineErrors = { name?: string; started?: string; ends?: string };

function RoutineForm({ onDone }: { onDone: () => void }) {
  const createMutation = useCreateRoutine();
  const toast = useToast();
  const [name, setName] = useState("");
  const [time, setTime] = useState("");
  const [started, setStarted] = useState(todayIso());
  const [ends, setEnds] = useState("");
  const [errors, setErrors] = useState<RoutineErrors>({});
  const nameRef = useRef<HTMLInputElement>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setName("");
    setTime("");
    setStarted(todayIso());
    setEnds("");
    setErrors({});
    requestAnimationFrame(() => nameRef.current?.focus());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function validate(): RoutineErrors {
    const next: RoutineErrors = {};
    if (!name.trim()) next.name = "이름을 입력하세요.";
    if (!started) next.started = "시작일을 입력하세요.";
    if (started && ends && ends < started) {
      next.ends = "종료일은 시작일과 같거나 이후여야 합니다.";
    }
    return next;
  }

  // 클릭 못 누르는 게 1차 게이트 — 사용자가 비활성 이유를 빠르게 인지하도록 라벨의 `*` +
  // started/ends onCommit 의 즉시 인라인 에러로 보강.
  const canSubmit =
    name.trim().length > 0 && !!started && (!ends || ends >= started);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = validate();
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    createMutation.mutate(
      {
        name: name.trim(),
        time: time || undefined,
        started,
        ends: ends || undefined,
      },
      {
        onSuccess: () => onDone(),
        onError: (err) => toast.show(formatError(err)),
      },
    );
  }

  function clearError(field: keyof RoutineErrors) {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function setError(field: keyof RoutineErrors, msg: string) {
    setErrors((prev) => (prev[field] === msg ? prev : { ...prev, [field]: msg }));
  }

  return (
    <form className="flex flex-1 flex-col" onSubmit={handleSubmit}>
      <label className="mt-4 block">
        <Text
          variant="caption"
          color="secondary"
          as="span"
          weight="medium"
        >
          이름 <span style={{ color: "var(--accent-red)" }}>*</span>
        </Text>
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearError("name");
          }}
          placeholder="예: 운동, 일기"
          aria-required="true"
          aria-invalid={errors.name ? true : undefined}
          maxLength={100}
          className="mt-1 w-full rounded-md px-2 py-1.5 text-sm outline-none"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: `1px solid ${errors.name ? "var(--accent-red)" : "var(--border-default)"}`,
            color: "var(--text-primary)",
          }}
        />
        {errors.name ? (
          <Text
            variant="caption"
            as="p"
            className="mt-1"
            style={{ color: "var(--accent-red)" }}
          >
            {errors.name}
          </Text>
        ) : null}
      </label>

      <label className="mt-3 block">
        <Text variant="caption" color="secondary" as="span" weight="medium">
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

      <div
        className="mt-3 grid gap-2"
        style={{ gridTemplateColumns: "1fr 1fr" }}
      >
        <label className="block">
          <Text variant="caption" color="secondary" as="span" weight="medium">
            시작일 <span style={{ color: "var(--accent-red)" }}>*</span>
          </Text>
          <div
            className="mt-1 rounded-md px-2 py-1.5"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: `1px solid ${errors.started ? "var(--accent-red)" : "var(--border-default)"}`,
            }}
          >
            <LooseDateInput
              value={started}
              onCommit={(next) => {
                setStarted(next);
                if (!next) {
                  setError("started", "시작일을 입력하세요.");
                } else {
                  clearError("started");
                }
                if (next && ends) {
                  if (ends >= next) clearError("ends");
                  else setError("ends", "종료일은 시작일과 같거나 이후여야 합니다.");
                }
              }}
              fullWidth
            />
          </div>
        </label>
        <label className="block">
          <Text variant="caption" color="secondary" as="span" weight="medium">
            종료일 (선택)
          </Text>
          <div
            className="mt-1 rounded-md px-2 py-1.5"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: `1px solid ${errors.ends ? "var(--accent-red)" : "var(--border-default)"}`,
            }}
          >
            <LooseDateInput
              value={ends}
              onCommit={(next) => {
                setEnds(next);
                if (started && next && next < started) {
                  setError("ends", "종료일은 시작일과 같거나 이후여야 합니다.");
                } else {
                  clearError("ends");
                }
              }}
              fullWidth
            />
          </div>
        </label>
      </div>

      {errors.started || errors.ends ? (
        <Text
          variant="caption"
          as="p"
          className="mt-1"
          style={{ color: "var(--accent-red)" }}
        >
          {errors.started ?? errors.ends}
        </Text>
      ) : null}

      <div className="mt-auto flex justify-end gap-2 pt-5">
        <Button
          variant="secondary"
          onClick={onDone}
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
