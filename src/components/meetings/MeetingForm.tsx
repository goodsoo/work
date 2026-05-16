import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  Trash2,
  AlertCircle,
  ListPlus,
  Check,
  Undo2,
  Redo2,
  Eye,
  Pencil,
  X,
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
import { SourceBodyEditor } from "./SourceBodyEditor";
import { MarkdownView } from "./MarkdownView";
import { parseAttendees } from "../../lib/attendees";
import { useViewMode } from "../../hooks/useViewMode";
import { isTauri } from "../../lib/isTauri";
import { formatError } from "../../lib/errors";

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
  transcript: string;
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
  transcript: "",
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
    transcript: m.transcript ?? "",
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
    transcript: doc.transcript || null,
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
    a.transcript === b.transcript &&
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
  const [viewMode, setViewMode] = useViewMode();

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
  const [activeTab, setActiveTab] = useState<"body" | "transcript" | "summary">(
    "body",
  );
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

  // 메모 전환 시 본문 탭으로 reset
  useEffect(() => {
    setActiveTab("body");
  }, [meetingId]);

  function updateField<K extends keyof MeetingDoc>(key: K, value: MeetingDoc[K]) {
    history.set({ ...doc, [key]: value });
  }

  // 단축키: undo/redo (모든 환경) + Opt+1/2/3 sub-tab (Tauri only)
  // window 에 직접 listener — 빈 곳에 focus 있어도 동작
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const cmd = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const isUndo = cmd && !e.shiftKey && !e.altKey && k === "z";
      const isRedo =
        (cmd && !e.altKey && k === "y") ||
        (cmd && e.shiftKey && !e.altKey && k === "z");
      if (isUndo) {
        e.preventDefault();
        history.undo();
        return;
      }
      if (isRedo) {
        e.preventDefault();
        history.redo();
        return;
      }
      // Opt+1/2/3 — Opt+숫자는 macOS 가 ¡™£ 로 바꾸므로 e.code 로 매칭
      if (!isTauri || !e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (e.code === "Digit1") {
        e.preventDefault();
        if (activeTab === "body") {
          setViewMode(viewMode === "edit" ? "view" : "edit");
        } else {
          setActiveTab("body");
        }
      } else if (e.code === "Digit2") {
        e.preventDefault();
        setActiveTab("transcript");
      } else if (e.code === "Digit3") {
        e.preventDefault();
        setActiveTab("summary");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [history, viewMode, setViewMode, activeTab]);

  async function handleDelete() {
    if (!data) return;
    if (!window.confirm("이 메모를 휴지통으로 옮길까요?")) return;
    try {
      await deleteMutation.mutateAsync(data.id);
      onBack();
    } catch (e) {
      setActionError(formatError(e));
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
      setActionError(formatError(e));
    }
  }

  function retrySave() {
    history.flush();
    if (!updateMutation.isPending) {
      updateMutation.mutate(docToPatch(doc));
    }
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-16">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex items-center gap-1 text-sm lg:hidden"
          style={{ color: "var(--text-secondary)" }}
        >
          <ChevronLeft className="h-4 w-4" /> 목록
        </button>
        <div
          className="rounded-lg p-4 text-sm"
          style={{
            borderLeft: "4px solid var(--accent-red)",
            backgroundColor: "var(--accent-red-bg)",
            color: "var(--accent-red-text)",
          }}
        >
          불러오지 못했어요. <button type="button" onClick={() => void refetch()} className="underline">재시도</button>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-16">
        <div className="space-y-4" aria-hidden>
          <div className="h-10 w-48 animate-pulse rounded" style={{ backgroundColor: "var(--bg-surface)" }} />
          <div className="h-6 w-32 animate-pulse rounded" style={{ backgroundColor: "var(--bg-surface)" }} />
          <div className="h-64 animate-pulse rounded" style={{ backgroundColor: "var(--bg-surface)" }} />
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
    <div className="min-h-svh">
      {/* Top bar — compact, floating feel */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-5 py-2 backdrop-blur lg:top-0"
        style={{ backgroundColor: "var(--bg-overlay)" }}
      >
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm transition lg:hidden"
          style={{ color: "var(--text-muted)" }}
        >
          <ChevronLeft className="h-4 w-4" /> 목록
        </button>
        <div className="flex items-center gap-2">
          <div
            className="inline-flex overflow-hidden rounded-md"
            style={{ border: "1px solid var(--border-subtle)" }}
          >
            <button
              type="button"
              onClick={history.undo}
              disabled={!history.canUndo}
              title="실행 취소"
              className="px-1.5 py-1 transition disabled:opacity-20"
              style={{ color: "var(--text-secondary)", minHeight: 0 }}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={history.redo}
              disabled={!history.canRedo}
              title="다시 실행"
              className="px-1.5 py-1 transition disabled:opacity-20"
              style={{ color: "var(--text-secondary)", borderLeft: "1px solid var(--border-subtle)", minHeight: 0 }}
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

      {/* Error toasts — fixed bottom-right, 본문 레이아웃에 영향 없음 */}
      {updateMutation.isError || actionError ? (
        <div
          className="fixed z-50 flex max-w-sm flex-col gap-2"
          style={{
            bottom: "calc(var(--safe-bottom) + 1rem)",
            right: "1rem",
          }}
        >
          {updateMutation.isError ? (
            <div
              className="animate-page-in flex items-start gap-2 rounded-lg p-3 text-sm shadow-lg"
              style={{
                borderLeft: "4px solid var(--accent-red)",
                backgroundColor: "var(--accent-red-bg)",
                color: "var(--accent-red-text)",
              }}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <div className="font-medium">자동 저장 실패</div>
                {updateMutation.error ? (
                  <div className="mt-0.5 text-xs opacity-80">
                    {formatError(updateMutation.error)}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={retrySave}
                disabled={updateMutation.isPending}
                className="text-xs underline disabled:opacity-40"
                style={{ minHeight: 0 }}
              >
                {updateMutation.isPending ? "재시도 중..." : "재시도"}
              </button>
              <button
                type="button"
                onClick={() => updateMutation.reset()}
                title="닫기"
                aria-label="닫기"
                className="rounded p-0.5 transition"
                style={{ color: "var(--accent-red-text)", minHeight: 0 }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
          {actionError ? (
            <div
              className="animate-page-in flex items-start gap-2 rounded-lg p-3 text-sm shadow-lg"
              style={{
                borderLeft: "4px solid var(--accent-red)",
                backgroundColor: "var(--accent-red-bg)",
                color: "var(--accent-red-text)",
              }}
            >
              <span className="flex-1">{actionError}</span>
              <button
                type="button"
                onClick={() => setActionError(null)}
                title="닫기"
                aria-label="닫기"
                className="rounded p-0.5 transition"
                style={{ color: "var(--accent-red-text)", minHeight: 0 }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
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
          className="w-full bg-transparent text-3xl font-bold outline-none"
          style={{ color: "var(--text-primary)" }}
        />

        {/* Metadata — subtle, inline */}
        <div
          className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          <label className="inline-flex items-center gap-1.5">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>날짜</span>
            <input
              type="date"
              value={doc.date}
              onChange={(e) => updateField("date", e.target.value)}
            />
          </label>
          <label className="inline-flex items-center gap-1.5">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>시간</span>
            <input
              type="text"
              value={doc.time}
              onChange={(e) => updateField("time", e.target.value)}
              placeholder="14:00"
              className="w-20 border-0 bg-transparent text-sm outline-none"
              style={{ color: "var(--text-secondary)" }}
            />
          </label>
          <div className="inline-flex items-center gap-1.5">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>참석</span>
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

        {/* Tab nav + 액션 (sticky: 메타 아래에서 시작, 스크롤 시 상단 도달하면 고정) */}
        <div
          className="sticky z-10 mt-6 flex items-center justify-between"
          style={{
            top: "2.5rem",
            borderBottom: "1px solid var(--border-subtle)",
            backgroundColor: "var(--bg-base)",
          }}
        >
          <div className="flex gap-1">
            <TabBtn
              label="본문"
              shortcut={isTauri ? "⌥1" : undefined}
              active={activeTab === "body"}
              onClick={() => setActiveTab("body")}
            />
            <TabBtn
              label="회의 내용"
              shortcut={isTauri ? "⌥2" : undefined}
              active={activeTab === "transcript"}
              onClick={() => setActiveTab("transcript")}
            />
            <TabBtn
              label="요약"
              shortcut={isTauri ? "⌥3" : undefined}
              active={activeTab === "summary"}
              onClick={() => setActiveTab("summary")}
            />
          </div>
          <div className="flex items-center gap-1.5 pb-1">
            {activeTab === "body" ? (
              <button
                type="button"
                onClick={() =>
                  setViewMode(viewMode === "edit" ? "view" : "edit")
                }
                title={
                  isTauri
                    ? `${viewMode === "edit" ? "보기 모드" : "편집 모드"}  ⌥1`
                    : viewMode === "edit"
                      ? "보기 모드"
                      : "편집 모드"
                }
                className="rounded-md px-1.5 py-1 transition"
                style={{
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-secondary)",
                  minHeight: 0,
                }}
              >
                {viewMode === "edit" ? (
                  <Eye className="h-3.5 w-3.5" />
                ) : (
                  <Pencil className="h-3.5 w-3.5" />
                )}
              </button>
            ) : null}
            <CopyButton meeting={meetingForCopy} onError={setActionError} compact />
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              title="메모 삭제"
              aria-label="메모 삭제"
              className="rounded-md px-1.5 py-1 transition disabled:opacity-40"
              style={{
                border: "1px solid var(--border-subtle)",
                color: "var(--text-muted)",
                minHeight: 0,
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Tab content wrapper — 탭이 상단 도달할 때까지 페이지 스크롤 가능하도록 minHeight 보장 */}
        <div className="mt-4" style={{ minHeight: "calc(100svh - 8rem)" }}>
        {activeTab === "body" ? (
          <div>
            {viewMode === "edit" ? (
              <SourceBodyEditor
                key={`${meetingId}:body`}
                content={doc.content}
                onChange={(v) => updateField("content", v)}
              />
            ) : (
              <MarkdownView content={doc.content} />
            )}
          </div>
        ) : null}

        {/* Transcript tab */}
        {activeTab === "transcript" ? (
          <div>
            <TranscriptArea
              key={`${meetingId}:transcript`}
              transcript={doc.transcript}
              onChange={(v) => updateField("transcript", v)}
              onError={setActionError}
            />
          </div>
        ) : null}

        {/* Summary tab */}
        {activeTab === "summary" ? (
          <div className="space-y-4">
            <SummarizeButton
              meetingId={data.id}
              title={doc.title || null}
              date={doc.date || null}
              time={doc.time || null}
              attendees={doc.attendees || null}
              content={doc.content}
              transcript={doc.transcript || null}
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
            {hasAnySummary ? (
              <div className="space-y-3">
                {doc.discussion_items.length > 0 ? (
                  <div
                    className="rounded-lg px-4 py-3"
                    style={{ backgroundColor: "var(--bg-surface)" }}
                  >
                    <EditableList
                      title="논의 사항"
                      items={doc.discussion_items}
                      onSave={(next) => updateField("discussion_items", next)}
                      bullet="dot"
                    />
                  </div>
                ) : null}
                {doc.decisions.length > 0 ? (
                  <div
                    className="rounded-lg px-4 py-3"
                    style={{ backgroundColor: "var(--bg-surface)" }}
                  >
                    <EditableList
                      title="결정 사항"
                      items={doc.decisions}
                      onSave={(next) => updateField("decisions", next)}
                      bullet="dot"
                    />
                  </div>
                ) : null}
                {doc.action_items.length > 0 ? (
                  <div
                    className="rounded-lg px-4 py-3"
                    style={{ backgroundColor: "var(--bg-surface)" }}
                  >
                    <EditableList
                      title="액션 아이템"
                      items={doc.action_items}
                      bullet="redCheckbox"
                      onSave={(next) => updateField("action_items", next)}
                      itemActions={(i, text) =>
                        addedTodoIndices.has(i) ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs"
                            style={{ color: "var(--text-muted)", minHeight: 0 }}
                          >
                            <Check className="h-3 w-3" /> 추가됨
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => addActionItemAsTodo(i, text)}
                            disabled={createTodoMutation.isPending}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition disabled:opacity-40"
                            style={{ color: "var(--text-secondary)", minHeight: 0 }}
                          >
                            <ListPlus className="h-3 w-3" /> 할 일로
                          </button>
                        )
                      }
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                본문이나 회의 내용을 적은 뒤 위 버튼을 눌러 AI 요약을 만들어요.
              </p>
            )}
          </div>
        ) : null}
        </div>

      </div>
    </div>
  );
}

function TabBtn({
  label,
  shortcut,
  active,
  onClick,
}: {
  label: string;
  shortcut?: string;
  active: boolean;
  onClick: () => void;
}) {
  const title = shortcut ? `${label}  ${shortcut}` : label;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-current={active ? "page" : undefined}
      className="px-3 py-2 text-sm transition"
      style={{
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        borderBottom: active
          ? "2px solid var(--text-primary)"
          : "2px solid transparent",
        marginBottom: "-1px",
        minHeight: 0,
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}

function TranscriptArea({
  transcript,
  onChange,
  onError,
}: {
  transcript: string;
  onChange: (v: string) => void;
  onError: (msg: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      if (typeof text !== "string") {
        onError("파일을 텍스트로 읽지 못했어요");
        return;
      }
      // 기존 내용 뒤에 이어붙이기 (덮어쓰기 방지). 비어있으면 그대로.
      onChange(transcript ? `${transcript}\n\n${text}` : text);
    };
    reader.onerror = () => onError("파일 읽기 실패");
    reader.readAsText(file);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          녹음을 STT로 변환한 텍스트를 붙여넣거나 파일 업로드
        </span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md px-2 py-1 text-xs transition"
          style={{
            border: "1px solid var(--border-default)",
            color: "var(--text-secondary)",
            minHeight: 0,
          }}
        >
          파일 업로드
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.vtt,.srt,text/*"
          onChange={handleFile}
          className="hidden"
        />
      </div>
      <textarea
        value={transcript}
        onChange={(e) => onChange(e.target.value)}
        placeholder="회의 녹음의 텍스트 변환 결과를 여기에..."
        className="w-full resize-none bg-transparent text-base leading-relaxed outline-none"
        style={{
          color: "var(--text-primary)",
          height: "60svh",
        }}
      />
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
        className="text-xs underline"
        style={{ color: "var(--accent-red)", minHeight: 0 }}
      >
        저장 실패
      </button>
    );
  }
  if (isPending) {
    return <span className="text-xs" style={{ color: "var(--text-muted)" }}>저장 중...</span>;
  }
  if (hasPendingEdit) {
    return <span className="text-xs" style={{ color: "var(--text-muted)" }}>...</span>;
  }
  return null;
}
