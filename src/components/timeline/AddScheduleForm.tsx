import { useState } from "react";
import { CalendarPlus, Plus } from "lucide-react";
import { todayIso } from "../../lib/dates";

type Props = {
  defaultDate?: string;
  onCreate: (input: { title: string; start_time: string; end_time: string | null }) => void;
  pending?: boolean;
};

export function AddScheduleForm({ defaultDate, onCreate, pending }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate ?? todayIso());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  function reset() {
    setTitle("");
    setDate(defaultDate ?? todayIso());
    setStartTime("");
    setEndTime("");
  }

  function submit() {
    const t = title.trim();
    if (!t || !date || !startTime) return;
    const startIso = combineLocalIso(date, startTime);
    const endIso = endTime ? combineLocalIso(date, endTime) : null;
    onCreate({ title: t, start_time: startIso, end_time: endIso });
    reset();
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
        style={{ minHeight: 36 }}
      >
        <CalendarPlus className="h-4 w-4 text-zinc-500" />
        일정 추가
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="일정 제목"
          autoFocus
          className="min-w-0 flex-1 bg-transparent px-2 py-1 text-base text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-transparent px-1 text-sm text-zinc-500 outline-none dark:text-zinc-400"
        />
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="bg-transparent px-1 text-sm text-zinc-500 outline-none dark:text-zinc-400"
          aria-label="시작 시간"
        />
        <span className="text-xs text-zinc-400">~</span>
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="bg-transparent px-1 text-sm text-zinc-500 outline-none dark:text-zinc-400"
          aria-label="종료 시간 (선택)"
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-100"
          style={{ minHeight: 36 }}
        >
          취소
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !title.trim() || !date || !startTime}
          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-40 dark:bg-red-500 dark:text-zinc-950 dark:hover:bg-red-600"
          style={{ minHeight: 36 }}
        >
          <Plus className="h-4 w-4" />
          추가
        </button>
      </div>
    </div>
  );
}

function combineLocalIso(date: string, time: string): string {
  // date "yyyy-MM-dd", time "HH:mm" → ISO with local tz
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
  return dt.toISOString();
}
