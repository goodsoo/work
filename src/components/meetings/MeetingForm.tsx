import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Trash2,
  AlertCircle,
  ListPlus,
  Check,
  Undo2,
  Redo2,
  Eye,
  Pencil,
  X,
  Calendar as CalendarIcon,
  Clock,
  Users,
  Loader2,
  Circle,
} from "lucide-react";

// 숫자 + 지정 separator 만 허용 (cmd/ctrl 단축키 + 화살표/backspace/delete/Enter 통과).
function makeNumericOnly(separators: string) {
  return (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key.length > 1) return;
    if (/[0-9]/.test(e.key)) return;
    if (separators.includes(e.key)) return;
    e.preventDefault();
  };
}
const dateKeyFilter = makeNumericOnly("-");
const timeKeyFilter = makeNumericOnly(":");
import {
  consumeJustCreatedMeetingId,
  useMeeting,
  useMeetings,
  useUpdateMeeting,
  useDeleteMeeting,
} from "../../hooks/useMeetings";
import { useStateHistory } from "../../hooks/useStateHistory";
import type { UseStateHistoryResult } from "../../hooks/useStateHistory";
import { useCreateTodo } from "../../hooks/useTodos";
import type { MeetingUpdate } from "../../api/meetings";
import { ClipPromptButton } from "../common/ClipPromptButton";
import { buildClaudePrompt } from "../../lib/clipboardPrompt";
import { CopyButton } from "./CopyButton";
import { EditableList } from "./EditableList";
import { AttendeeTagInput } from "./AttendeeTagInput";
import { SourceBodyEditor } from "./SourceBodyEditor";
import { MarkdownView } from "./MarkdownView";
import { useViewMode } from "../../hooks/useViewMode";
import { isTauri } from "../../lib/isTauri";
import { formatError } from "../../lib/errors";

type Props = {
  meetingId: string;
  onBack: () => void;
};

type SummaryDoc = {
  discussion_items: string[];
  decisions: string[];
  action_items: string[];
};

type MetaDoc = {
  title: string;
  date: string;
  time: string;
  attendees: string;
};

function arraysEqual(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function summariesEqual(a: SummaryDoc, b: SummaryDoc): boolean {
  return (
    arraysEqual(a.discussion_items, b.discussion_items) &&
    arraysEqual(a.decisions, b.decisions) &&
    arraysEqual(a.action_items, b.action_items)
  );
}

function trimNewlines(s: string): string {
  return s.replace(/^\n+/, "").replace(/\n+$/, "");
}

function summaryToPatch(s: SummaryDoc): MeetingUpdate {
  return {
    discussion_items: s.discussion_items.length === 0 ? null : s.discussion_items,
    decisions: s.decisions.length === 0 ? null : s.decisions,
    action_items: s.action_items.length === 0 ? null : s.action_items,
  };
}


type ActiveTab = "body" | "transcript" | "summary";

// 메모별 마지막 활성 탭 기억. 페이지 전환으로 컴포넌트가 unmount/mount 되어도
// 살아남도록 모듈 레벨에. 새로고침 시 초기화.
const ACTIVE_TAB_CACHE = new Map<string, ActiveTab>();

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
      if (!m.attendees || m.attendees.length === 0) continue;
      for (const tag of m.attendees) set.add(tag);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
  }, [meetingsQ.data]);

  // 데이터 도착 전엔 cacheKey undefined → cache 참여 X. 데이터 도착 시
  // undefined → defined transition 으로 initial 적용. 메모 전환 시
  // cacheKey 가 바뀌면서 이전 메모의 stack state 가 모듈 캐시에 보존됨.
  const id = data?.id;
  const initialBody = data?.content ?? "";
  const initialTranscript = data?.transcript ?? "";
  const initialSummary = useMemo<SummaryDoc>(
    () => ({
      discussion_items: data?.discussion_items ?? [],
      decisions: data?.decisions ?? [],
      action_items: data?.action_items ?? [],
    }),
    [data?.discussion_items, data?.decisions, data?.action_items],
  );
  const initialMeta = useMemo<MetaDoc>(
    () => ({
      title: data?.title ?? "",
      date: data?.date ?? "",
      time: data?.time ?? "",
      attendees: data?.attendees ? data.attendees.join(", ") : "",
    }),
    [data?.title, data?.date, data?.time, data?.attendees],
  );

  const bodyHistory = useStateHistory<string>({
    initial: initialBody,
    cacheKey: id ? `${id}:body` : undefined,
    commitMs: 1000,
    onCommit: (v) => updateMutation.mutate({ content: v }),
  });

  const transcriptHistory = useStateHistory<string>({
    initial: initialTranscript,
    cacheKey: id ? `${id}:transcript` : undefined,
    commitMs: 1000,
    onCommit: (v) => updateMutation.mutate({ transcript: v || null }),
  });

  const summaryHistory = useStateHistory<SummaryDoc>({
    initial: initialSummary,
    cacheKey: id ? `${id}:summary` : undefined,
    commitMs: 1000,
    isEqual: summariesEqual,
    onCommit: (s) => updateMutation.mutate(summaryToPatch(s)),
  });

  const body = bodyHistory.value;
  const transcript = transcriptHistory.value;
  const summary = summaryHistory.value;

  const [actionError, setActionError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // meta 4 field 는 typing 중 mutation X (매번 rename / spinner 깜빡임 회피).
  // onBlur / Enter / tag 추가 같은 명시 시점에만 commit. 메모 전환 시 initialMeta 와 sync.
  const [titleDraft, setTitleDraft] = useState<string>(() => initialMeta.title);
  const [dateDraft, setDateDraft] = useState<string>(() => initialMeta.date);
  const [timeDraft, setTimeDraft] = useState<string>(() => initialMeta.time);
  const [attendeesDraft, setAttendeesDraft] = useState<string>(
    () => initialMeta.attendees,
  );
  useEffect(() => {
    setTitleDraft(initialMeta.title);
  }, [initialMeta.title]);
  useEffect(() => {
    setDateDraft(initialMeta.date);
  }, [initialMeta.date]);
  useEffect(() => {
    setTimeDraft(initialMeta.time);
  }, [initialMeta.time]);
  useEffect(() => {
    setAttendeesDraft(initialMeta.attendees);
  }, [initialMeta.attendees]);

  function commitTitle() {
    const trimmed = titleDraft.trim();
    // 빈 → 기존 제목으로 revert. 기존도 빈이면 'untitled'.
    const next = trimmed === "" ? (initialMeta.title || "untitled") : trimmed;
    if (next !== titleDraft) setTitleDraft(next);
    if (next === initialMeta.title) return;
    updateMutation.mutate({ title: next });
  }

  function commitDate() {
    const v = dateDraft.trim();
    // 빈 OK (날짜 제거). 그 외엔 YYYY-MM-DD + Date 유효.
    const valid =
      v === "" ||
      (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00")));
    if (!valid) {
      setDateDraft(initialMeta.date); // 형식 안 맞으면 기존으로 revert
      return;
    }
    if (v === initialMeta.date) return;
    updateMutation.mutate({ date: v || null });
  }

  function commitTime() {
    const v = timeDraft.trim();
    // 빈 OK. 그 외엔 HH:MM + 0-23 / 0-59.
    let valid = v === "";
    if (!valid) {
      const m = v.match(/^(\d{2}):(\d{2})$/);
      if (m) {
        const h = parseInt(m[1], 10);
        const mm = parseInt(m[2], 10);
        valid = h >= 0 && h <= 23 && mm >= 0 && mm <= 59;
      }
    }
    if (!valid) {
      setTimeDraft(initialMeta.time);
      return;
    }
    if (v === initialMeta.time) return;
    updateMutation.mutate({ time: v || null });
  }

  function commitAttendees(next: string) {
    // AttendeeTagInput onChange 는 tag 추가/제거 시점 — 이미 명시 intent. 즉시 commit.
    setAttendeesDraft(next);
    const trimmed = next.trim();
    if (trimmed === initialMeta.attendees.trim()) return;
    updateMutation.mutate({ attendees: trimmed || null });
  }
  const [activeTab, setActiveTabState] = useState<ActiveTab>(
    () => ACTIVE_TAB_CACHE.get(meetingId) ?? "body",
  );
  function setActiveTab(t: ActiveTab) {
    ACTIVE_TAB_CACHE.set(meetingId, t);
    setActiveTabState(t);
  }
  const [addedTodoIndices, setAddedTodoIndices] = useState<Set<number>>(
    () => new Set(),
  );
  const addedKey = `${meetingId}|${summary.action_items.join("\n")}`;
  const [trackedAddedKey, setTrackedAddedKey] = useState(addedKey);
  if (trackedAddedKey !== addedKey) {
    setTrackedAddedKey(addedKey);
    setAddedTodoIndices(new Set());
  }

  // beforeunload — 페이지 닫기 직전 모든 pending 변경 flush.
  // unmount 시 cleanup 은 useStateHistory 가 자체 처리하므로 여기선 listener 정리만.
  useEffect(() => {
    function onBeforeUnload() {
      bodyHistory.flush();
      transcriptHistory.flush();
      summaryHistory.flush();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [bodyHistory, transcriptHistory, summaryHistory]);

  // 메모 전환 시 그 메모의 마지막 탭으로 (cache miss 면 본문).
  useEffect(() => {
    setActiveTabState(ACTIVE_TAB_CACHE.get(meetingId) ?? "body");
  }, [meetingId]);

  // 방금 만든 메모면 title input 자동 focus + select all — 사용자가 default
  // 'memo' 위에 바로 타이핑하면 새 제목으로 교체.
  useEffect(() => {
    if (consumeJustCreatedMeetingId(meetingId)) {
      // mount 직후 ref attach 되도록 microtask 한 tick 미룸
      requestAnimationFrame(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      });
    }
  }, [meetingId]);

  // 활성 탭의 history (단축키 + 상단 undo/redo 버튼 대상).
  // meta 는 단축키 안 받음 — 메타 input 안에서는 native input undo 사용.
  const activeHistory: UseStateHistoryResult<unknown> =
    activeTab === "body"
      ? (bodyHistory as UseStateHistoryResult<unknown>)
      : activeTab === "transcript"
        ? (transcriptHistory as UseStateHistoryResult<unknown>)
        : (summaryHistory as UseStateHistoryResult<unknown>);

  // 단축키 (Tauri only):
  //   Cmd/Ctrl+Z/Y/Shift+Z = 활성 탭 stack 의 undo/redo
  //   Cmd+[ / Cmd+] = sub-tab 좌/우 cycling (메모 ↔ 음성 기록 ↔ 요약)
  //   Cmd+E = 본문 탭일 때 편집/보기 토글 (옵시디안 패턴)
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
        activeHistory.undo();
        return;
      }
      if (isRedo) {
        e.preventDefault();
        activeHistory.redo();
        return;
      }
      if (!isTauri) return;
      // Cmd+E — 메모 탭일 때만 편집/보기 토글. 다른 탭이면 무시 (textarea 통과).
      if (cmd && !e.shiftKey && !e.altKey && k === "e") {
        if (activeTab !== "body") return;
        e.preventDefault();
        setViewMode(viewMode === "edit" ? "view" : "edit");
        return;
      }
      // Cmd+] = 다음 sub-tab, Cmd+[ = 이전 sub-tab. cycling.
      if (cmd && !e.shiftKey && !e.altKey && (k === "]" || k === "[")) {
        e.preventDefault();
        const order: typeof activeTab[] = ["body", "transcript", "summary"];
        const idx = order.indexOf(activeTab);
        const next = k === "]" ? (idx + 1) % order.length : (idx - 1 + order.length) % order.length;
        setActiveTab(order[next]);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeHistory, activeTab, viewMode, setViewMode]);

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
    if (updateMutation.isPending) return;
    updateMutation.mutate({
      title: titleDraft.trim() || initialMeta.title || "untitled",
      date: dateDraft.trim() || null,
      time: timeDraft.trim() || null,
      attendees: attendeesDraft.trim() || null,
      content: body,
      transcript: transcript || null,
      ...summaryToPatch(summary),
    });
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-16">
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
    summary.discussion_items.length + summary.decisions.length + summary.action_items.length > 0;

  // 미저장 변경 여부 — memory state vs query data (optimistic update 후엔 sync).
  // typing 직후 ~ commit timer (1초) 까진 true, optimistic update 시점에 false.
  // body/transcript 는 disk write 시 앞뒤 newline trim 되므로 비교도 normalize.
  // attendees 는 textarea string vs disk-roundtrip 의 ", " join 차이 회피 위해 parseAttendees 로 array 비교.
  // title 은 별도 (titleDraft) — typing 중 일치 안 해도 spinner 표시 X (blur/Enter 만 mutation).
  // meta 4 field 는 draft 라 typing 중 spinner X — commit 후 initialMeta 갱신.
  const hasUnsavedChange =
    trimNewlines(body) !== trimNewlines(initialBody) ||
    trimNewlines(transcript) !== trimNewlines(initialTranscript) ||
    !summariesEqual(summary, initialSummary);

  const meetingForCopy = {
    title: initialMeta.title || null,
    date: initialMeta.date || null,
    time: initialMeta.time || null,
    attendees: initialMeta.attendees || null,
    discussion_items: summary.discussion_items,
    decisions: summary.decisions,
    action_items: summary.action_items,
  };

  function setSummaryField<K extends keyof SummaryDoc>(
    key: K,
    value: SummaryDoc[K],
  ) {
    summaryHistory.set({ ...summary, [key]: value });
  }

  return (
    <div className="min-h-svh lg:flex lg:h-screen lg:min-h-0 lg:flex-col">
      {/* Header — 사이드바 헤더와 같은 높이 (3.5rem). desktop 에선 flex item (top fixed),
          mobile 은 sticky. grid 로 좌/우 그룹 width 변화 무관 제목 viewport-center. */}
      <div
        className="sticky top-0 z-20 grid items-center gap-2 overflow-hidden px-3 backdrop-blur lg:shrink-0 lg:relative lg:top-auto"
        style={{
          height: "3.5rem",
          gridTemplateColumns: "1fr auto 1fr",
          backgroundColor: "var(--bg-overlay)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        {/* Left: undo/redo + save indicator */}
        <div className="flex shrink-0 items-center gap-2 justify-self-start">
          <div
            className="inline-flex overflow-hidden rounded-md"
            style={{ border: "1px solid var(--border-subtle)" }}
          >
            <button
              type="button"
              onClick={activeHistory.undo}
              disabled={!activeHistory.canUndo}
              title={`실행 취소 (${activeTab === "body" ? "메모" : activeTab === "transcript" ? "음성 기록" : "요약"})`}
              className="px-1.5 py-1 transition disabled:opacity-20"
              style={{ color: "var(--text-secondary)", minHeight: 0 }}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={activeHistory.redo}
              disabled={!activeHistory.canRedo}
              title={`다시 실행 (${activeTab === "body" ? "메모" : activeTab === "transcript" ? "음성 기록" : "요약"})`}
              className="px-1.5 py-1 transition disabled:opacity-20"
              style={{ color: "var(--text-secondary)", borderLeft: "1px solid var(--border-subtle)", minHeight: 0 }}
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <SaveIndicator
            isPending={updateMutation.isPending || hasUnsavedChange}
            isError={updateMutation.isError}
            onRetry={retrySave}
          />
        </div>

        {/* Center: title — grid auto col 안 dead-center, max-width 로 좌/우 그룹과 겹침 방지.
            typing 중엔 mutation X — onBlur / Enter 만 commit (매번 rename 회피) */}
        <input
          ref={titleInputRef}
          type="text"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitTitle();
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="untitled"
          autoFocus={!data.title}
          className="min-w-0 justify-self-center bg-transparent text-center text-base font-semibold outline-none"
          style={{
            color: "var(--text-primary)",
            maxWidth: "min(28rem, 100%)",
            width: `${Math.max((titleDraft || "untitled").length, 6) + 2}ch`,
          }}
        />

        {/* Right: edit toggle / copy / delete */}
        <div className="flex shrink-0 items-center gap-1 justify-self-end">
          <button
            type="button"
            onClick={() =>
              activeTab === "body"
                ? setViewMode(viewMode === "edit" ? "view" : "edit")
                : setActiveTab("body")
            }
            title={
              activeTab === "body"
                ? isTauri
                  ? `${viewMode === "edit" ? "보기 모드" : "편집 모드"}  ⌘ + E`
                  : viewMode === "edit"
                    ? "보기 모드"
                    : "편집 모드"
                : "메모 탭으로 이동"
            }
            className="rounded-md px-1.5 py-1 transition"
            style={{
              border: "1px solid var(--border-subtle)",
              color: activeTab === "body" ? "var(--text-secondary)" : "var(--text-muted)",
              minHeight: 0,
            }}
          >
            {viewMode === "edit" ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <Pencil className="h-3.5 w-3.5" />
            )}
          </button>
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

      {/* Full-page editor — desktop 에선 자체 scroll container (header 옆 scrollbar 회피).
          outer = full-width scroll, inner = max-w content. */}
      <div className="lg:flex-1 lg:overflow-y-auto lg:overscroll-none">
        <div className="mx-auto max-w-3xl px-6 pb-24">
        {/* Tab nav — 헤더 바로 아래에 sticky. 헤더 (3.5rem) 와 시각적으로 연결. */}
        <div
          className="sticky top-14 z-10 flex items-center justify-between backdrop-blur lg:top-0"
          style={{
            borderBottom: "1px solid var(--border-subtle)",
            backgroundColor: "var(--bg-overlay)",
          }}
        >
          <div className="flex gap-1">
            <TabBtn
              label="메모"
              badge={viewMode === "edit" ? "편집" : "보기"}
              badgeAccent={viewMode === "edit"}
              badgeTitle={
                isTauri
                  ? `${viewMode === "edit" ? "보기 모드" : "편집 모드"}  ⌘ + E`
                  : viewMode === "edit"
                    ? "보기 모드"
                    : "편집 모드"
              }
              onBadgeClick={
                activeTab === "body"
                  ? () => setViewMode(viewMode === "edit" ? "view" : "edit")
                  : undefined
              }
              active={activeTab === "body"}
              onClick={() => setActiveTab("body")}
            />
            <TabBtn
              label="음성 기록"
              active={activeTab === "transcript"}
              onClick={() => setActiveTab("transcript")}
            />
            <TabBtn
              label="요약"
              active={activeTab === "summary"}
              onClick={() => setActiveTab("summary")}
            />
          </div>
          <div className="flex items-center gap-1.5 pb-1">
            <CharCountBadge
              count={
                activeTab === "body"
                  ? body.length
                  : activeTab === "transcript"
                    ? transcript.length
                    : summary.discussion_items.reduce((s, i) => s + i.length, 0) +
                      summary.decisions.reduce((s, i) => s + i.length, 0) +
                      summary.action_items.reduce((s, i) => s + i.length, 0)
              }
            />
          </div>
        </div>

        {/* Tab content wrapper — 빈 메모일 땐 스크롤 없음, 내용 늘면 자연 scroll */}
        <div className="mt-4">
        {activeTab === "body" ? (
          <div
            key={viewMode}
            style={{ animation: "meetingViewFade 140ms ease" }}
          >
            {/* Metadata — 메모탭 안. 편집 모드 = MetaRow (icon + divider + input).
                보기 모드 = plain text (icon/divider 없음, 빈 field 안 보임). */}
            {viewMode === "edit" ? (
              <div className="mb-4">
                <MetaRow icon={<CalendarIcon className="h-3.5 w-3.5" />} label="날짜">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={dateDraft}
                    onChange={(e) => setDateDraft(e.target.value)}
                    onBlur={commitDate}
                    onKeyDown={(e) => {
                      dateKeyFilter(e);
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitDate();
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    placeholder="YYYY-MM-DD"
                    className="meta-input flex-1"
                    maxLength={10}
                  />
                </MetaRow>
                <MetaRow icon={<Clock className="h-3.5 w-3.5" />} label="시간">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={timeDraft}
                    onChange={(e) => setTimeDraft(e.target.value)}
                    onBlur={commitTime}
                    onKeyDown={(e) => {
                      timeKeyFilter(e);
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitTime();
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    placeholder="HH:MM"
                    className="meta-input flex-1"
                    maxLength={5}
                  />
                </MetaRow>
                <MetaRow icon={<Users className="h-3.5 w-3.5" />} label="참석자">
                  <div className="flex-1">
                    <AttendeeTagInput
                      value={attendeesDraft}
                      onChange={commitAttendees}
                      suggestions={attendeeSuggestions}
                      placeholder="이름 입력 후 Enter"
                    />
                  </div>
                </MetaRow>
              </div>
            ) : (
              <MetaReadOnly meta={initialMeta} />
            )}
            {viewMode === "edit" ? (
              <SourceBodyEditor
                key={`${meetingId}:body`}
                content={body}
                onChange={(v) => bodyHistory.set(v)}
              />
            ) : (
              <MarkdownView content={body} />
            )}
          </div>
        ) : null}

        {/* Transcript tab */}
        {activeTab === "transcript" ? (
          <div>
            <TranscriptArea
              key={`${meetingId}:transcript`}
              transcript={transcript}
              onChange={(v) => transcriptHistory.set(v)}
              onError={setActionError}
            />
          </div>
        ) : null}

        {/* Summary tab */}
        {activeTab === "summary" ? (
          <div className="space-y-4">
            <ClipPromptButton
              buildPrompt={() =>
                buildClaudePrompt({
                  title: initialMeta.title || null,
                  date: initialMeta.date || null,
                  time: initialMeta.time || null,
                  attendees: initialMeta.attendees || null,
                  content: body,
                  transcript: transcript || null,
                })
              }
              disabled={
                (body ?? "").trim().length === 0 &&
                (transcript ?? "").trim().length === 0
              }
              title="메모와 음성 기록을 묶어 Claude 프롬프트로 복사"
              onError={setActionError}
            />
            {hasAnySummary ? (
              <div className="space-y-3">
                {summary.discussion_items.length > 0 ? (
                  <div
                    className="rounded-lg px-4 py-3"
                    style={{ backgroundColor: "var(--bg-surface)" }}
                  >
                    <EditableList
                      title="논의 사항"
                      items={summary.discussion_items}
                      onSave={(next) => setSummaryField("discussion_items", next)}
                      bullet="dot"
                    />
                  </div>
                ) : null}
                {summary.decisions.length > 0 ? (
                  <div
                    className="rounded-lg px-4 py-3"
                    style={{ backgroundColor: "var(--bg-surface)" }}
                  >
                    <EditableList
                      title="결정 사항"
                      items={summary.decisions}
                      onSave={(next) => setSummaryField("decisions", next)}
                      bullet="dot"
                    />
                  </div>
                ) : null}
                {summary.action_items.length > 0 ? (
                  <div
                    className="rounded-lg px-4 py-3"
                    style={{ backgroundColor: "var(--bg-surface)" }}
                  >
                    <EditableList
                      title="액션 아이템"
                      items={summary.action_items}
                      bullet="redCheckbox"
                      onSave={(next) => setSummaryField("action_items", next)}
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
                메모나 음성 기록을 적은 뒤 위 버튼을 눌러 AI 요약을 만들어요.
              </p>
            )}
          </div>
        ) : null}
        </div>

        </div>
      </div>
    </div>
  );
}

function CharCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
      {count}자
    </span>
  );
}

// 본문 textarea 의 line gutter 패턴과 동일: icon col (1.75rem) + 우측 divider + 라벨 + 값.
function MetaRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="meta-row flex" style={{ minHeight: "1.625rem" }}>
      <div
        className="flex shrink-0 items-center justify-center"
        style={{
          width: "1.75rem",
          color: "var(--text-muted)",
          borderRight: "1px solid var(--border-subtle)",
        }}
        aria-hidden
      >
        {icon}
      </div>
      <div
        className="flex flex-1 items-center gap-3 text-sm"
        style={{ paddingLeft: "0.5rem", color: "var(--text-primary)" }}
      >
        <span
          className="shrink-0"
          style={{ color: "var(--text-muted)", width: "3.5rem" }}
        >
          {label}
        </span>
        {children}
      </div>
    </div>
  );
}

// 보기 모드용 meta — icon/divider 없는 plain text. 빈 field 안 보임.
// 편집 모드 MetaRow 와 같은 line height (1.625rem) + 라벨 위치 (gutter 1.75rem + paddingLeft 0.5rem).
function MetaReadOnly({ meta }: { meta: MetaDoc }) {
  const rows: { label: string; value: string }[] = [];
  if (meta.date) rows.push({ label: "날짜", value: meta.date });
  if (meta.time) rows.push({ label: "시간", value: meta.time });
  if (meta.attendees) rows.push({ label: "참석자", value: meta.attendees });
  if (rows.length === 0) return null;
  return (
    <div className="mb-4 text-sm">
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex items-center gap-3"
          style={{ minHeight: "1.625rem" }}
        >
          <span
            className="shrink-0"
            style={{ color: "var(--text-muted)", width: "3.5rem" }}
          >
            {r.label}
          </span>
          <span style={{ color: "var(--text-primary)" }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function TabBtn({
  label,
  shortcut,
  badge,
  badgeAccent,
  onBadgeClick,
  badgeTitle,
  active,
  onClick,
}: {
  label: string;
  shortcut?: string;
  badge?: string | null;
  badgeAccent?: boolean;
  onBadgeClick?: () => void;
  badgeTitle?: string;
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
      className="flex items-center gap-1.5 px-3 py-2 text-sm transition"
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
      <span>{label}</span>
      {badge ? (
        <span
          role={onBadgeClick ? "button" : undefined}
          tabIndex={onBadgeClick ? 0 : undefined}
          title={badgeTitle}
          onClick={
            onBadgeClick
              ? (e) => {
                  e.stopPropagation();
                  onBadgeClick();
                }
              : undefined
          }
          onKeyDown={
            onBadgeClick
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onBadgeClick();
                  }
                }
              : undefined
          }
          className="rounded-md px-1.5 py-0.5 text-xs"
          style={{
            backgroundColor: badgeAccent
              ? "var(--accent-blue-bg)"
              : "var(--bg-surface-hover)",
            color: badgeAccent
              ? "var(--accent-blue-text)"
              : "var(--text-secondary)",
            fontWeight: 400,
            cursor: onBadgeClick ? "pointer" : undefined,
          }}
        >
          {badge}
        </span>
      ) : null}
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // 메모탭 SourceBodyEditor 와 같은 auto-resize 패턴 — 자체 scroll X, outer scroll
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [transcript]);

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
        ref={textareaRef}
        value={transcript}
        onChange={(e) => onChange(e.target.value)}
        placeholder="음성 녹음의 텍스트 변환 결과를 여기에..."
        className="w-full resize-none bg-transparent text-base leading-relaxed outline-none"
        style={{
          color: "var(--text-primary)",
          overflowY: "hidden",
        }}
      />
    </div>
  );
}

function SaveIndicator({
  isPending,
  isError,
  onRetry,
}: {
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  // isPending 은 호출자에서 (mutation isPending OR hasUnsavedChange) 로 옴.
  // typing 시점부터 spinner — 깜빡임 회피 위해 debounce 없음.
  const state: "error" | "spinner" | "success" = isError
    ? "error"
    : isPending
      ? "spinner"
      : "success";

  const dotColor =
    state === "error"
      ? "var(--accent-red)"
      : "var(--accent-green)";

  const title =
    state === "error"
      ? "저장 실패 — 재시도"
      : state === "spinner"
        ? "저장 중"
        : "저장됨";

  const inner = (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ width: "0.875rem", height: "0.875rem" }}
    >
      {/* spinner — pending 일 때만 fade-in */}
      <Loader2
        className="absolute inset-0 h-3.5 w-3.5"
        style={{
          color: "var(--text-muted)",
          opacity: state === "spinner" ? 1 : 0,
          transition: "opacity 180ms ease",
          animation: "spin 1.6s linear infinite",
        }}
      />
      {/* 외곽선 원 (border only) — error / success / wait, spinner 와 같은 stroke */}
      <Circle
        className="absolute inset-0 h-3.5 w-3.5"
        style={{
          color: dotColor,
          opacity: state === "spinner" ? 0 : 1,
          transform: state === "spinner" ? "scale(0.6)" : "scale(1)",
          transition: "opacity 180ms ease, color 180ms ease, transform 180ms ease",
        }}
      />
    </span>
  );

  if (state === "error") {
    return (
      <button
        type="button"
        onClick={onRetry}
        title={title}
        aria-label={title}
        className="rounded p-1"
        style={{ minHeight: 0 }}
      >
        {inner}
      </button>
    );
  }
  return (
    <span
      title={title}
      aria-label={title}
      className="inline-flex items-center p-1"
    >
      {inner}
    </span>
  );
}
