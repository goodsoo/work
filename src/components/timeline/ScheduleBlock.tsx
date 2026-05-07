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
        <span className="font-mono text-sm tabular-nums text-red-600 dark:text-red-500">
          {time}
          {endTime ? `–${endTime}` : ""}
        </span>
        <span className="flex-1 text-base text-zinc-900 dark:text-zinc-100">
          {schedule.title}
        </span>
        {confirming ? (
          <span className="flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={onDelete}
              className="rounded px-2 py-0.5 text-red-600 hover:bg-red-50 dark:text-red-500 dark:hover:bg-red-950/30"
              style={{ minHeight: 0 }}
            >
              삭제
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded px-2 py-0.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              style={{ minHeight: 0 }}
            >
              취소
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label="일정 삭제"
            className="rounded p-1 text-zinc-300 transition hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-900 dark:hover:text-red-500"
            style={{ minHeight: 28, minWidth: 28 }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </TimelineBlock>
  );
}
