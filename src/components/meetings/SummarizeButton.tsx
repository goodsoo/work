import { useState } from "react";
import { Sparkles, Loader2, RefreshCcw } from "lucide-react";
import { supabase } from "../../lib/supabase";

export type SummaryResult = {
  discussion_items: string[];
  decisions: string[];
  action_items: string[];
};

type Props = {
  meetingId: string;
  title: string | null;
  date: string | null;
  time: string | null;
  attendees: string | null;
  content: string | null;
  hasResult: boolean;
  onResult: (result: SummaryResult) => void;
  onError: (message: string) => void;
};

export function SummarizeButton({
  title,
  date,
  time,
  attendees,
  content,
  hasResult,
  onResult,
  onError,
}: Props) {
  const [pending, setPending] = useState(false);
  const trimmed = (content ?? "").trim();
  const disabled = pending || trimmed.length === 0;

  async function run() {
    setPending(true);
    try {
      const { data, error } = await supabase.functions.invoke<SummaryResult>(
        "summarize",
        { body: { title, date, time, attendees, content: trimmed } }
      );
      if (error) throw error;
      if (
        !data ||
        !Array.isArray(data.discussion_items) ||
        !Array.isArray(data.decisions) ||
        !Array.isArray(data.action_items)
      ) {
        throw new Error("응답 형식이 올바르지 않아요.");
      }
      onResult(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onError(msg || "요약에 실패했어요.");
    } finally {
      setPending(false);
    }
  }

  if (hasResult && !pending) {
    return (
      <button
        type="button"
        onClick={run}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 underline-offset-2 transition hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <RefreshCcw className="h-3 w-3" />
        다시 요약
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-lg border border-red-600 px-3 py-2 text-sm text-red-600 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500 dark:text-red-500 dark:hover:bg-red-500 dark:hover:text-zinc-950"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>요약 중...</span>
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" />
          <span>AI 요약</span>
        </>
      )}
    </button>
  );
}
