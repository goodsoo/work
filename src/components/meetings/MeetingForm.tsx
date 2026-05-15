import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  Trash2,
  AlertCircle,
  ListPlus,
  Check,
  Undo2,
  Redo2,
} from "lucide-react";
import {
  useMeeting,
  useMeetings,
  useUpdateMeeting,
  useDeleteMeeting,
} from "../../hooks/useMeetings";
import { useStateHistory } from "../../hooks/useStateHistory";
import { useCreateTodo } from "../../hooks/useTodos";
import type { Meeting, MeetingUpdate } from "../../api/meetings";
import { SummarizeButton } from "./SummarizeButton";
import { CopyButton } from "./CopyButton";
import { EditableList } from "./EditableList";
import { AttendeeTagInput } from "./AttendeeTagInput";
import { parseAttendees } from "../../lib/attendees";

type Props = {
  meetingId: string;
  onBack: () => void;
};

type MeetingDoc = {
  title: string;
  date: string;
  time: string;
  attendees: string;
  content: string;
  discussion_items: string[];
  decisions: string[];
  action_items: string[];
};

const EMPTY_DOC: MeetingDoc = {
  title: "",
  date: "",
  time: "",
  attendees: "",
  content: "",
  discussion_items: [],
  decisions: [],
  action_items: [],
};

function makeDocFromMeeting(m: Meeting | null | undefined): MeetingDoc {
  if (!m) return EMPTY_DOC;
  return {
    title: m.title ?? "",
    date: m.date ?? "",
    time: m.time ?? "",
    attendees: m.attendees ?? "",
    content: m.content ?? "",
    discussion_items: m.discussion_items ?? [],
    decisions: m.decisions ?? [],
    action_items: m.action_items ?? [],
  };
}

function docToPatch(doc: MeetingDoc): MeetingUpdate {
  return {
    title: doc.title.trim() || null,
    date: doc.date || null,
    time: doc.time.trim() || null,
    attendees: doc.attendees.trim() || null,
    content: doc.content,
    discussion_items: doc.discussion_items.length === 0 ? null : doc.discussion_items,
    decisions: doc.decisions.length === 0 ? null : doc.decisions,
    action_items: doc.action_items.length === 0 ? null : doc.action_items,
  };
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function docsEqual(a: MeetingDoc, b: MeetingDoc): boolean {
  return (
    a.title === b.title &&
    a.date === b.date &&
    a.time === b.time &&
    a.attendees === b.attendees &&
    a.content === b.content &&
    arraysEqual(a.discussion_items, b.discussion_items) &&
    arraysEqual(a.decisions, b.decisions) &&
    arraysEqual(a.action_items, b.action_items)
  );
}

export function MeetingForm({ meetingId, onBack }: Props) {
  const { data, isLoading, error, refetch } = useMeeting(meetingId);
  const meetingsQ = useMeetings();
  const updateMutation = useUpdateMeeting(meetingId);
  const deleteMutation = useDeleteMeeting();
  const createTodoMutation = useCreateTodo();

  const attendeeSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const m of meetingsQ.data ?? []) {
      if (!m.attendees) continue;
      for (const tag of parseAttendees(m.attendees)) set.add(tag);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
  }, [meetingsQ.data]);

  const docInitial = useMemo(() => makeDocFromMeeting(data), [data]);

  const history = useStateHistory<MeetingDoc>({
    initial: docInitial,
    reKey: data?.id,
    commitMs: 1000,
    isEqual: docsEqual,
    onCommit: (doc) => {
      updateMutation.mutate(docToPatch(doc));
    },
  });

  const doc = history.value;

  const [actionError, setActionError] = useState<string | null>(null);
  const [addedTodoIndices, setAddedTodoIndices] = useState<Set<number>>(
    () => new Set(),
  );
  const addedKey = `${meetingId}|${doc.action_items.join("\n")}`;
  const [trackedAddedKey, setTrackedAddedKey] = useState(addedKey);
  if (trackedAddedKey !== addedKey) {
    setTrackedAddedKey(addedKey);
    setAddedTodoIndices(new Set());
  }

  useEffect(() => {
    function onBeforeUnload() {
      history.flush();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      history.flush();
    };
  }, [history]);

  function updateField<K extends keyof MeetingDoc>(key: K, value: MeetingDoc[K]) {
    history.set({ ...doc, [key]: value });
  }

  function onFormKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const isUndo =
      (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z";
    const isRedo =
      ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") ||
      ((e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "z");
    if (isUndo) {
      e.preventDefault();
      history.undo();
    } else if (isRedo) {
      e.preventDefault();
      history.redo();
    }
  }

  async function handleDelete() {
    if (!data) return;
    if (!window.confirm("이 메모를 삭제할까요?")) return;
    try {
      await deleteMutation.mutateAsync(data.id);
      onBack();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  }

  async function addActionItemAsTodo(index: number, text: string) {
    if (addedTodoIndices.has(index)) return;
    try {
      await createTodoMutation.mutateAsync({
        title: text,
        priority: "medium",
        due_date: null,
        linked_meeting_id: meetingId,
      });
      setAddedTodoIndices((prev) => {
        const next = new Set(prev);
        next.add(index);
        return next;
      });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  }

  function retrySave() {
    history.flush();
    if (history.canUndo === false && !updateMutation.isPending) {
      updateMutation.mutate(docToPatch(doc));
    }
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-16">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-500 lg:hidden"
        >
          <ChevronLeft className="h-4 w-4" /> 목록
        </button>
        <div className="rounded-lg border-l-4 border-red-600 bg-red-50 p-4 text-sm text-red-900 dark:border-red-500 dark:bg-red-950/30 dark:text-red-200">
          불러오지 못했어요. <button type="button" onClick={() => void refetch()} className="underline">재시도</button>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-16">
        <div className="space-y-4" aria-hidden>
          <div className="h-10 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-6 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-64 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
        </div>
      </div>
    );
  }

  const hasAnySummary =
    doc.discussion_items.length + doc.decisions.length + doc.action_items.length > 0;

  const meetingForCopy = {
    title: doc.title || null,
    date: doc.date || null,
    time: doc.time || null,
    attendees: doc.attendees || null,
    discussion_items: doc.discussion_items,
    decisions: doc.decisions,
    action_items: doc.action_items,
  };

  return (
    <div onKeyDown={onFormKeyDown} className="min-h-svh">
      {/* Top bar — compact, floating feel */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white/90 px-5 py-2 backdrop-blur lg:top-0 dark:bg-zinc-950/90">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-zinc-400 transition hover:text-zinc-700 lg:hidden dark:hover:text-zinc-300"
        >
          <ChevronLeft className="h-4 w-4" /> 목록
        </button>
        <div className="flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-md border border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={history.undo}
              disabled={!history.canUndo}
              title="실행 취소"
              className="px-1.5 py-1 text-zinc-500 transition hover:bg-zinc-50 disabled:opacity-20 dark:hover:bg-zinc-900"
              style={{ minHeight: 0 }}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={history.redo}
              disabled={!history.canRedo}
              title="다시 실행"
              className="border-l border-zinc-100 px-1.5 py-1 text-zinc-500 transition hover:bg-zinc-50 disabled:opacity-20 dark:border-zinc-800 dark:hover:bg-zinc-900"
              style={{ minHeight: 0 }}
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <SaveIndicator
            isPending={updateMutation.isPending}
            isError={updateMutation.isError}
            hasPendingEdit={history.canUndo && !updateMutation.isPending && !updateMutation.isError}
            onRetry={retrySave}
          />
        </div>
      </div>

      {/* Error alerts */}
      {updateMutation.isError || actionError ? (
        <div className="mx-auto max-w-3xl px-6 pt-2">
          {updateMutation.isError ? (
            <div className="flex items-start gap-2 rounded-lg border-l-4 border-red-600 bg-red-50 p-3 text-sm text-red-900 dark:border-red-500 dark:bg-red-950/30 dark:text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">자동 저장 실패</span>
              <button type="button" onClick={retrySave} className="text-xs underline">재시도</button>
            </div>
          ) : null}
          {actionError ? (
            <div className="mt-2 rounded-lg border-l-4 border-red-600 bg-red-50 p-3 text-sm text-red-900 dark:border-red-500 dark:bg-red-950/30 dark:text-red-200">
              {actionError}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Full-page editor */}
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-8">
        {/* Title — large, Notion-style */}
        <input
          type="text"
          value={doc.title}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="제목 없음"
          autoFocus={!data.title}
          className="w-full bg-transparent text-3xl font-bold text-zinc-900 outline-none placeholder:text-zinc-300 dark:text-zinc-100 dark:placeholder:text-zinc-700"
        />

        {/* Metadata — subtle, inline */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-500">
          <label className="inline-flex items-center gap-1.5">
            <span className="text-xs text-zinc-400">날짜</span>
            <input
              type="date"
              value={doc.date}
              onChange={(e) => updateField("date", e.target.value)}
            />
          </label>
          <label className="inline-flex items-center gap-1.5">
            <span className="text-xs text-zinc-400">시간</span>
            <input
              type="text"
              value={doc.time}
              onChange={(e) => updateField("time", e.target.value)}
              placeholder="14:00"
              className="w-20 border-0 bg-transparent text-sm outline-none placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
            />
          </label>
          <div className="inline-flex items-center gap-1.5">
            <span className="text-xs text-zinc-400">참석</span>
            <div className="min-w-[12em]">
              <AttendeeTagInput
                value={doc.attendees}
                onChange={(next) => updateField("attendees", next)}
                suggestions={attendeeSuggestions}
                placeholder="이름"
              />
            </div>
          </div>
        </div>

        {/* Body — fills the viewport, no border, no chrome */}
        <textarea
          value={doc.content}
          onChange={(e) => updateField("content", e.target.value)}
          placeholder="내용을 입력하세요..."
          className="mt-6 w-full resize-none overflow-hidden bg-transparent text-base leading-relaxed text-zinc-800 outline-none placeholder:text-zinc-300 dark:text-zinc-200 dark:placeholder:text-zinc-600"
          style={{ minHeight: "60svh" }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = el.scrollHeight + "px";
          }}
        />

        {/* AI Summary — inline callout blocks, part of the document flow */}
        {hasAnySummary ? (
          <div className="mt-6 space-y-3">
            {doc.discussion_items.length > 0 ? (
              <div className="rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-900/40">
                <EditableList
                  title="논의 사항"
                  items={doc.discussion_items}
                  onSave={(next) => updateField("discussion_items", next)}
                  bullet="dot"
                />
              </div>
            ) : null}
            {doc.decisions.length > 0 ? (
              <div className="rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-900/40">
                <EditableList
                  title="결정 사항"
                  items={doc.decisions}
                  onSave={(next) => updateField("decisions", next)}
                  bullet="dot"
                />
              </div>
            ) : null}
            {doc.action_items.length > 0 ? (
              <div className="rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-900/40">
                <EditableList
                  title="액션 아이템"
                  items={doc.action_items}
                  bullet="redCheckbox"
                  onSave={(next) => updateField("action_items", next)}
                  itemActions={(i, text) =>
                    addedTodoIndices.has(i) ? (
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-400" style={{ minHeight: 0 }}>
                        <Check className="h-3 w-3" /> 추가됨
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addActionItemAsTodo(i, text)}
                        disabled={createTodoMutation.isPending}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                        style={{ minHeight: 0 }}
                      >
                        <ListPlus className="h-3 w-3" /> 할 일로
                      </button>
                    )
                  }
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Inline actions — AI summarize + copy + delete */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <SummarizeButton
            meetingId={data.id}
            title={doc.title || null}
            date={doc.date || null}
            time={doc.time || null}
            attendees={doc.attendees || null}
            content={doc.content}
            hasResult={hasAnySummary}
            onResult={(result) => {
              history.set({
                ...doc,
                discussion_items: result.discussion_items,
                decisions: result.decisions,
                action_items: result.action_items,
              });
              history.flush();
              setActionError(null);
            }}
            onError={setActionError}
          />
          <CopyButton meeting={meetingForCopy} onError={setActionError} />
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-red-600 disabled:opacity-50 dark:hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" /> 삭제
          </button>
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({
  isPending,
  isError,
  hasPendingEdit,
  onRetry,
}: {
  isPending: boolean;
  isError: boolean;
  hasPendingEdit: boolean;
  onRetry: () => void;
}) {
  if (isError) {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="text-xs text-red-600 underline dark:text-red-500"
        style={{ minHeight: 0 }}
      >
        저장 실패
      </button>
    );
  }
  if (isPending) {
    return <span className="text-xs text-zinc-400">저장 중...</span>;
  }
  if (hasPendingEdit) {
    return <span className="text-xs text-zinc-300 dark:text-zinc-600">...</span>;
  }
  return null;
}
