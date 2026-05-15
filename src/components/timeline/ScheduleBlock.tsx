import { useState } from "react";
import { X } from "lucide-react";
import type { Schedule } from "../../api/schedules";
import { TimelineBlock } from "./TimelineBlock";

function formatTime(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

type Props = {
  schedule: Schedule;
  onDelete: () => void;
};

export function ScheduleBlock({ schedule, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);
  const time = formatTime(schedule.start_time);
  const endTime = schedule.end_time ? formatTime(schedule.end_time) : null;

  return (
    <TimelineBlock letter="S">
      <div className="flex items-center gap-2">
        <span
          className="font-mono text-sm tabular-nums"
          style={{ color: "var(--accent-red)" }}
        >
          {time}
          {endTime ? `–${endTime}` : ""}
        </span>
        <span
          className="flex-1 text-base"
          style={{ color: "var(--text-primary)" }}
        >
          {schedule.title}
        </span>
        {confirming ? (
          <span className="flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={onDelete}
              className="rounded px-2 py-0.5"
              style={{ color: "var(--accent-red)", minHeight: 0 }}
            >
              삭제
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded px-2 py-0.5"
              style={{ color: "var(--text-secondary)", minHeight: 0 }}
            >
              취소
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label="일정 삭제"
            className="rounded p-1 transition"
            style={{ color: "var(--text-muted)", minHeight: 28, minWidth: 28 }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </TimelineBlock>
  );
}
