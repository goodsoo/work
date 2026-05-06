import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Trash2, AlertCircle } from "lucide-react";
import { useMeeting, useUpdateMeeting, useDeleteMeeting } from "../../hooks/useMeetings";
import { useDebouncedSave, type SaveStatus } from "../../hooks/useDebouncedSave";
import type { MeetingUpdate } from "../../api/meetings";
import { SummarizeButton, type SummaryResult } from "./SummarizeButton";
import { CopyButton } from "./CopyButton";

type Props = {
  meetingId: string;
  onBack: () => void;
};

type FormFields = {
  title: string;
  date: string;
  time: string;
  attendees: string;
  content: string;
};

function emptyForm(): FormFields {
  return { title: "", date: "", time: "", attendees: "", content: "" };
}

type SummaryOverride = SummaryResult | null;

export function MeetingForm({ meetingId, onBack }: Props) {
  const { data, isLoading, error, refetch } = useMeeting(meetingId);
  const updateMutation = useUpdateMeeting(meetingId);
  const deleteMutation = useDeleteMeeting();

  // Initialize form from server data once per meeting id.
  const [formForId, setFormForId] = useState<string | null>(null);
  const [form, setForm] = useState<FormFields>(emptyForm);
  if (data && formForId !== data.id) {
    setFormForId(data.id);
    setForm({
      title: data.title ?? "",
      date: data.date ?? "",
      time: data.time ?? "",
      attendees: data.attendees ?? "",
      content: data.content ?? "",
    });
  }

  // Reset summary override when switching meetings.
  const [overrideForId, setOverrideForId] = useState(meetingId);
  const [overrideSummary, setOverrideSummary] = useState<SummaryOverride>(null);
  if (overrideForId !== meetingId) {
    setOverrideForId(meetingId);
    setOverrideSummary(null);
  }

  const [actionError, setActionError] = useState<string | null>(null);

  const persistedDiscussion = data?.discussion_items ?? null;
  const persistedDecisions = data?.decisions ?? null;
  const persistedActions = data?.action_items ?? null;
  const discussionItems =
    overrideSummary?.discussion_items ?? persistedDiscussion ?? [];
  const decisions = overrideSummary?.decisions ?? persistedDecisions ?? [];
  const actionItems = overrideSummary?.action_items ?? persistedActions ?? [];
  const hasAnySummary =
    discussionItems.length + decisions.length + actionItems.length > 0;

  const save = useMemo(
    () => async (next: FormFields) => {
      const patch: MeetingUpdate = {
        title: next.title.trim() || null,
        date: next.date || null,
        time: next.time.trim() || null,
        attendees: next.attendees.trim() || null,
        content: next.content,
      };
      await updateMutation.mutateAsync(patch);
    },
    [updateMutation]
  );

  const { status, schedule, flush, error: saveError } = useDebouncedSave<FormFields>({
    save,
    delay: 1000,
  });

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

  function update<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      schedule(next);
      return next;
    });
  }

  async function handleDelete() {
    if (!data) return;
    if (!window.confirm("이 회의록을 삭제할까요?")) return;
    try {
      await deleteMutation.mutateAsync(data.id);
      onBack();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  }

  async function retrySave() {
    schedule(form);
    await flush();
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 md:px-6">
        <BackHeader onBack={onBack} status="idle" />
        <div className="mt-8 rounded-lg border-l-4 border-red-600 bg-red-50 p-4 text-sm text-red-900 dark:border-red-500 dark:bg-red-950/30 dark:text-red-200">
          <div className="font-medium">회의록을 불러오지 못했어요</div>
          <div className="mt-1 font-mono text-xs opacity-80">
            {(error as Error).message}
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 text-xs underline underline-offset-2"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 md:px-6">
        <BackHeader onBack={onBack} status="idle" />
        <div className="mt-8 space-y-4" aria-hidden>
          <div className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-48 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
        </div>
      </div>
    );
  }

  const meetingForCopy = {
    title: form.title || null,
    date: form.date || null,
    time: form.time || null,
    attendees: form.attendees || null,
    discussion_items: discussionItems,
    decisions,
    action_items: actionItems,
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 md:px-6">
      <BackHeader
        onBack={onBack}
        status={status}
        onRetry={saveError ? () => void retrySave() : undefined}
      />

      {saveError ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border-l-4 border-red-600 bg-red-50 p-3 text-sm text-red-900 dark:border-red-500 dark:bg-red-950/30 dark:text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            <div className="font-medium">자동 저장 실패</div>
            <div className="mt-0.5 font-mono text-xs opacity-80">{saveError.message}</div>
          </div>
          <button
            type="button"
            onClick={() => void retrySave()}
            className="text-xs underline underline-offset-2"
          >
            재시도
          </button>
        </div>
      ) : null}

      {actionError ? (
        <div className="mt-4 rounded-lg border-l-4 border-red-600 bg-red-50 p-3 text-sm text-red-900 dark:border-red-500 dark:bg-red-950/30 dark:text-red-200">
          {actionError}
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        <input
          type="text"
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="제목 (선택)"
          autoFocus={!data.title}
          className="w-full border-0 border-b border-zinc-200 bg-transparent pb-2 font-serif text-2xl text-zinc-900 outline-none placeholder:text-zinc-300 focus:border-zinc-400 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-700 dark:focus:border-zinc-600"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">날짜</span>
            <input
              type="date"
              value={form.date}
              onChange={(e) => update("date", e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-600"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">시간</span>
            <input
              type="text"
              value={form.time}
              onChange={(e) => update("time", e.target.value)}
              placeholder="14:00 또는 오후 2시"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-600"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-1">
            <span className="text-xs text-zinc-500">참석</span>
            <input
              type="text"
              value={form.attendees}
              onChange={(e) => update("attendees", e.target.value)}
              placeholder="이름들 쉼표로"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-600"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">본문</span>
          <textarea
            value={form.content}
            onChange={(e) => update("content", e.target.value)}
            placeholder="회의 내용을 적어주세요"
            rows={12}
            className="min-h-64 resize-y rounded-lg border border-zinc-200 bg-white px-3 py-3 text-base leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-600"
          />
        </label>
      </div>

      <section className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-lg text-zinc-900 dark:text-zinc-100">
            요약
          </h3>
          <SummarizeButton
            meetingId={data.id}
            title={form.title || null}
            date={form.date || null}
            time={form.time || null}
            attendees={form.attendees || null}
            content={form.content}
            hasResult={hasAnySummary}
            onResult={async (result) => {
              setOverrideSummary(result);
              try {
                await updateMutation.mutateAsync({
                  discussion_items: result.discussion_items,
                  decisions: result.decisions,
                  action_items: result.action_items,
                });
                setOverrideSummary(null);
                setActionError(null);
              } catch (e) {
                setActionError(e instanceof Error ? e.message : String(e));
              }
            }}
            onError={setActionError}
          />
        </div>

        {hasAnySummary ? (
          <div className="space-y-5">
            <SummarySection title="논의 사항" items={discussionItems} />
            <SummarySection title="결정 사항" items={decisions} />
            <SummarySection
              title="액션 아이템"
              items={actionItems}
              redCheckbox
            />
          </div>
        ) : (
          <p className="text-sm text-zinc-400">
            본문을 입력하고 AI 요약을 눌러주세요.
          </p>
        )}
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <CopyButton meeting={meetingForCopy} onError={setActionError} />
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-red-600 disabled:opacity-50 dark:text-zinc-500 dark:hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
          삭제
        </button>
      </div>
    </div>
  );
}

function SummarySection({
  title,
  items,
  redCheckbox,
}: {
  title: string;
  items: string[];
  redCheckbox?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {title}
      </h4>
      <ul className="space-y-1.5 text-sm text-zinc-800 dark:text-zinc-200">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2">
            <span
              className={
                redCheckbox
                  ? "mt-1 inline-block h-3.5 w-3.5 shrink-0 rounded border-2 border-red-600 dark:border-red-500"
                  : "mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-zinc-400"
              }
            />
            <span className="whitespace-pre-wrap leading-relaxed">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BackHeader({
  onBack,
  status,
  onRetry,
}: {
  onBack: () => void;
  status: SaveStatus;
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ChevronLeft className="h-4 w-4" />
        목록
      </button>
      <SaveIndicator status={status} onRetry={onRetry} />
    </div>
  );
}

function SaveIndicator({
  status,
  onRetry,
}: {
  status: SaveStatus;
  onRetry?: () => void;
}) {
  if (status === "error" && onRetry) {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="text-sm text-red-600 underline underline-offset-2 dark:text-red-500"
      >
        저장 실패 · 재시도
      </button>
    );
  }
  let label = "";
  if (status === "pending" || status === "saving") label = "저장 중...";
  else if (status === "saved") label = "저장됨";
  return (
    <span
      className={`text-sm transition-opacity duration-300 ${
        label ? "opacity-100" : "opacity-0"
      } text-zinc-500 dark:text-zinc-400`}
      aria-hidden={!label}
    >
      {label || "."}
    </span>
  );
}
