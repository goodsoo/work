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
import { MarkdownView } from "./MarkdownView";
import { parseAttendees } from "../../lib/attendees";
import { PageHeader } from "../nav/PageHeader";

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
  const [bodyMode, setBodyMode] = useState<"edit" | "split" | "preview">("edit");
  const [addedTodoIndices, setAddedTodoIndices] = useState<Set<number>>(
    () => new Set(),
  );

  // Reset "added to todos" tracking when meeting or action items content changes.
  const addedKey = `${meetingId}|${doc.action_items.join("\n")}`;
  const [trackedAddedKey, setTrackedAddedKey] = useState(addedKey);
  if (trackedAddedKey !== addedKey) {
    setTrackedAddedKey(addedKey);
    setAddedTodoIndices(new Set());
  }

  // Flush pending edits on unmount or page navigation.
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
    if (!window.confirm("이 회의록을 삭제할까요?")) return;
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
      // No pending edit and not currently saving — re-fire last commit.
      updateMutation.mutate(docToPatch(doc));
    }
  }

  const headerLeft = (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-900 lg:hidden dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      <ChevronLeft className="h-4 w-4" />
      목록
    </button>
  );

  const undoRedoButtons = (
    <div
      className="inline-flex overflow-hidden rounded-lg border border-zinc-200 text-xs dark:border-zinc-800"
      aria-label="실행 취소 / 다시 실행"
    >
      <button
        type="button"
        onClick={history.undo}
        disabled={!history.canUndo}
        aria-label="실행 취소 (Ctrl/⌘+Z)"
        title="실행 취소 (Ctrl/⌘+Z)"
        className="px-2 py-1 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        style={{ minHeight: 28 }}
      >
        <Undo2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={history.redo}
        disabled={!history.canRedo}
        aria-label="다시 실행 (Ctrl/⌘+Shift+Z)"
        title="다시 실행 (Ctrl/⌘+Shift+Z)"
        className="border-l border-zinc-200 px-2 py-1 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        style={{ minHeight: 28 }}
      >
        <Redo2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  if (error) {
    return (
      <>
        <PageHeader left={headerLeft} />
        <div className="mx-auto w-full max-w-2xl px-5 pb-16 pt-5 lg:max-w-4xl">
          <div className="mt-2 rounded-lg border-l-4 border-red-600 bg-red-50 p-4 text-sm text-red-900 dark:border-red-500 dark:bg-red-950/30 dark:text-red-200">
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
      </>
    );
  }

  if (isLoading || !data) {
    return (
      <>
        <PageHeader left={headerLeft} />
        <div className="mx-auto w-full max-w-2xl px-5 pb-16 pt-5 lg:max-w-4xl">
          <div className="mt-2 space-y-4" aria-hidden>
            <div className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
            <div className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
            <div className="h-48 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
          </div>
        </div>
      </>
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
    <>
      <PageHeader
        left={headerLeft}
        right={
          <>
            {undoRedoButtons}
            <SaveIndicator
              isPending={updateMutation.isPending}
              isError={updateMutation.isError}
              hasPendingEdit={history.canUndo && !updateMutation.isPending && !updateMutation.isError}
              onRetry={retrySave}
            />
          </>
        }
      />
      <div
        onKeyDown={onFormKeyDown}
        className="mx-auto w-full max-w-2xl px-5 pb-16 pt-5 lg:max-w-4xl"
      >
        {updateMutation.isError ? (
          <div className="mt-2 flex items-start gap-2 rounded-lg border-l-4 border-red-600 bg-red-50 p-3 text-sm text-red-900 dark:border-red-500 dark:bg-red-950/30 dark:text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <div className="font-medium">자동 저장 실패</div>
              <div className="mt-0.5 font-mono text-xs opacity-80">
                {(updateMutation.error as Error)?.message}
              </div>
            </div>
            <button
              type="button"
              onClick={retrySave}
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

        <div className="mt-4 space-y-4">
          <input
            type="text"
            value={doc.title}
            onChange={(e) => updateField("title", e.target.value)}
            placeholder="제목 (선택)"
            autoFocus={!data.title}
            className="w-full border-0 border-b border-zinc-100 bg-transparent pb-2 text-xl font-semibold text-zinc-900 outline-none placeholder:text-zinc-300 focus:border-zinc-300 dark:border-zinc-800/50 dark:text-zinc-100 dark:placeholder:text-zinc-700 dark:focus:border-zinc-600"
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">날짜</span>
              <input
                type="date"
                value={doc.date}
                onChange={(e) => updateField("date", e.target.value)}
                className="w-full rounded-lg px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">시간</span>
              <input
                type="text"
                value={doc.time}
                onChange={(e) => updateField("time", e.target.value)}
                placeholder="14:00 또는 오후 2시"
                className="w-full rounded-lg border border-zinc-100 bg-zinc-50/50 px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-300 dark:border-zinc-800/50 dark:bg-zinc-900/30 dark:text-zinc-100 dark:focus:border-zinc-600"
              />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-1">
              <span className="text-xs text-zinc-500">참석</span>
              <AttendeeTagInput
                value={doc.attendees}
                onChange={(next) => updateField("attendees", next)}
                suggestions={attendeeSuggestions}
              />
            </label>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xs text-zinc-500">본문 (Markdown)</span>
              <div
                className="inline-flex overflow-hidden rounded-lg border border-zinc-200 text-xs dark:border-zinc-800"
                role="tablist"
                aria-label="본문 보기 모드"
              >
                {(["edit", "split", "preview"] as const).map((m) => {
                  const label =
                    m === "edit" ? "편집" : m === "split" ? "분할" : "미리보기";
                  const active = bodyMode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setBodyMode(m)}
                      className={`px-3 py-1 transition ${
                        active
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                          : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                      }`}
                      style={{ minHeight: 28 }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            {bodyMode === "edit" ? (
              <textarea
                value={doc.content}
                onChange={(e) => updateField("content", e.target.value)}
                placeholder="회의 내용을 적어주세요. # 제목, **굵게**, - 목록, [ ] 체크박스 등 마크다운 사용 가능."
                rows={12}
                className="min-h-64 resize-y rounded-lg border border-zinc-200 bg-white px-3 py-3 font-mono text-sm leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-600"
              />
            ) : bodyMode === "preview" ? (
              <div className="min-h-64 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                <MarkdownView content={doc.content} />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <textarea
                  value={doc.content}
                  onChange={(e) => updateField("content", e.target.value)}
                  placeholder="회의 내용을 적어주세요. 마크다운 사용 가능."
                  rows={12}
                  className="h-96 resize-y rounded-lg border border-zinc-200 bg-white px-3 py-3 font-mono text-sm leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 md:h-[32rem] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-600"
                  aria-label="본문 편집"
                />
                <div
                  className="h-96 overflow-auto rounded-lg border border-zinc-200 bg-white p-3 md:h-[32rem] dark:border-zinc-800 dark:bg-zinc-950"
                  aria-label="본문 미리보기"
                >
                  <MarkdownView content={doc.content} />
                </div>
              </div>
            )}
          </div>
        </div>

        <section className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-serif text-lg text-zinc-900 dark:text-zinc-100">
              요약
            </h3>
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
          </div>

          {!hasAnySummary ? (
            <p className="mb-4 text-sm text-zinc-400">
              본문을 입력하고 AI 요약을 누르거나 직접 항목을 추가해주세요.
            </p>
          ) : null}
          <div className="space-y-5">
            <EditableList
              title="논의 사항"
              items={doc.discussion_items}
              onSave={(next) => updateField("discussion_items", next)}
              bullet="dot"
            />
            <EditableList
              title="결정 사항"
              items={doc.decisions}
              onSave={(next) => updateField("decisions", next)}
              bullet="dot"
            />
            <EditableList
              title="액션 아이템"
              items={doc.action_items}
              bullet="redCheckbox"
              onSave={(next) => updateField("action_items", next)}
              itemActions={(i, text) =>
                addedTodoIndices.has(i) ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs text-zinc-400"
                    aria-label="할 일로 추가됨"
                    style={{ minHeight: 0 }}
                  >
                    <Check className="h-3 w-3" />
                    추가됨
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => addActionItemAsTodo(i, text)}
                    disabled={createTodoMutation.isPending}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    style={{ minHeight: 0 }}
                  >
                    <ListPlus className="h-3 w-3" />
                    할 일로
                  </button>
                )
              }
            />
          </div>
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
    </>
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
        className="text-sm text-red-600 underline underline-offset-2 dark:text-red-500"
        style={{ minHeight: 28 }}
      >
        저장 실패 · 재시도
      </button>
    );
  }
  if (isPending) {
    return (
      <span className="text-sm text-zinc-500 dark:text-zinc-400">저장 중...</span>
    );
  }
  if (hasPendingEdit) {
    return (
      <span className="text-sm text-zinc-400 dark:text-zinc-500">대기 중</span>
    );
  }
  return null;
}
