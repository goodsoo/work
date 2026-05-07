import { useCallback, useEffect, useRef, useState } from "react";
import { useUpsertJournal } from "../../hooks/useJournals";
import { useDebouncedSave } from "../../hooks/useDebouncedSave";
import { TimelineBlock } from "./TimelineBlock";
import type { Journal } from "../../api/journals";

type Props = {
  date: string;
  existing: Journal | null;
  emphasized?: boolean;
};

export function JournalBlock({ date, existing, emphasized }: Props) {
  const [content, setContent] = useState(existing?.content ?? "");
  const upsertMutation = useUpsertJournal();
  const taRef = useRef<HTMLTextAreaElement>(null);

  const save = useCallback(
    async (value: string) => {
      await upsertMutation.mutateAsync({ date, content: value });
    },
    [date, upsertMutation],
  );

  const { schedule, flush, status, error } = useDebouncedSave<string>({ save });

  // Autosize textarea
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [content]);

  // Flush on unmount + beforeunload
  useEffect(() => {
    function onBeforeUnload() {
      void flush();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      void flush();
    };
  }, [flush]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    setContent(next);
    schedule(next);
  }

  const isEmpty = content.trim().length === 0;

  return (
    <TimelineBlock letter="J">
      <div>
        <textarea
          ref={taRef}
          value={content}
          onChange={handleChange}
          onBlur={() => void flush()}
          placeholder={emphasized ? "오늘 어땠어요?" : "이날의 기억"}
          rows={1}
          className={`block w-full resize-none bg-transparent py-1 font-serif italic leading-relaxed outline-none placeholder:not-italic placeholder:text-zinc-400 ${
            isEmpty
              ? `rounded border border-dashed px-3 ${
                  emphasized
                    ? "border-zinc-300 dark:border-zinc-700"
                    : "border-zinc-200 dark:border-zinc-800"
                }`
              : "text-zinc-700 dark:text-zinc-300"
          }`}
        />
        <SaveStatus status={status} error={error} />
      </div>
    </TimelineBlock>
  );
}

function SaveStatus({
  status,
  error,
}: {
  status: "idle" | "pending" | "saving" | "saved" | "error";
  error: Error | null;
}) {
  if (status === "saving") {
    return (
      <span className="mt-1 block text-[11px] text-zinc-400">저장 중…</span>
    );
  }
  if (status === "saved") {
    return (
      <span className="mt-1 block text-[11px] text-zinc-400">저장됨</span>
    );
  }
  if (status === "error") {
    return (
      <span className="mt-1 block text-[11px] text-red-600 dark:text-red-500">
        저장 실패: {error?.message ?? "알 수 없음"}
      </span>
    );
  }
  return null;
}
