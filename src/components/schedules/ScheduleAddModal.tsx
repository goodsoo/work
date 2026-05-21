import { useEffect, useRef, useState } from "react";
import { useCreateSchedule } from "../../hooks/useSchedules";
import { LooseDateInput } from "../common/LooseDateInput";
import { LooseTimeInput } from "../common/LooseTimeInput";

type Props = {
  open: boolean;
  defaultDate: string;
  onClose: () => void;
};

// 현재 시각을 30분 단위로 round → "HH:mm".
function nowRoundedToHalfHour(): string {
  const d = new Date();
  const rounded = Math.round(d.getMinutes() / 30) * 30;
  let hour = d.getHours();
  let minute = rounded;
  if (rounded === 60) {
    hour = (hour + 1) % 24;
    minute = 0;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function ScheduleAddModal({ open, defaultDate, onClose }: Props) {
  const createMutation = useCreateSchedule();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(() => nowRoundedToHalfHour());
  const [endTime, setEndTime] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDate(defaultDate);
    setTime(nowRoundedToHalfHour());
    setEndTime("");
    requestAnimationFrame(() => titleRef.current?.focus());
  }, [open, defaultDate]);

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

  const canSubmit = title.trim().length > 0 && !!date && !!time;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    createMutation.mutate(
      {
        title: title.trim(),
        start_time: `${date}T${time}:00`,
        end_time: endTime ? `${date}T${endTime}:00` : null,
      },
      { onSuccess: () => onClose() },
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-add-title"
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
          id="schedule-add-title"
          className="text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          일정 추가
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
            placeholder="예: 팀 미팅"
            aria-required="true"
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
          style={{ gridTemplateColumns: "2fr 1fr 1fr" }}
        >
          <label className="block">
            <span
              className="text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              날짜 <span style={{ color: "var(--accent-red)" }}>*</span>
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
              시작 <span style={{ color: "var(--accent-red)" }}>*</span>
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
          <label className="block">
            <span
              className="text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              종료 (선택)
            </span>
            <div
              className="mt-1 rounded-md px-2 py-1.5"
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
              }}
            >
              <LooseTimeInput value={endTime} onCommit={setEndTime} fullWidth />
            </div>
          </label>
        </div>

        {createMutation.isError ? (
          <p
            className="mt-3 text-xs"
            style={{ color: "var(--accent-red)" }}
          >
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
