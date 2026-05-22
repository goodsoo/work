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

import {
  consumeJustCreatedMeetingUid,
  useMeeting,
  useMeetings,
  useUpdateMeeting,
  useDeleteMeeting,
} from "../../hooks/useMeetings";
import { useStateHistory } from "../../hooks/useStateHistory";
import { useCreateTodo } from "../../hooks/useTodos";
import type { MeetingUpdate } from "../../api/meetings";
import { ClipPromptButton } from "../common/ClipPromptButton";
import { buildClaudePrompt } from "../../lib/clipboardPrompt";
import { CopyButton } from "./CopyButton";
import { EditableList } from "./EditableList";
import { AttendeeTagInput } from "./AttendeeTagInput";
import { SourceBodyEditor } from "./SourceBodyEditor";
import { MarkdownView } from "./MarkdownView";
import { TaskAddModal } from "../tasks/TaskAddModal";
import type { TodoCategory, TodoInsert, TodoPriority } from "../../api/todos";
import { extractTodos } from "../../lib/vault/tasks";
import { useViewMode } from "../../hooks/useViewMode";
import { isTauri } from "../../lib/isTauri";
import { formatError } from "../../lib/errors";
import { TitleConflictError } from "../../lib/vault/scan";
import { weekdayShort } from "../../lib/dates";
import { LooseDateInput } from "../common/LooseDateInput";
import { LooseTimeInput } from "../common/LooseTimeInput";

// 파일시스템 + 옵시디안 link syntax 금지 문자. title input commit 시 검사.
const TITLE_UNSAFE_RE = /[/\\:*?"<>|#\^\[\]]/;

type Props = {
  meetingId: string;
  onBack: () => void;
};

type SummaryDoc = {
  discussion_items: string[];
  decisions: string[];
  action_items: string[];
};

// title 은 history 미참여 (별도 commitTitle 가 직접 mutation).
type MetaDoc = {
  date: string;
  time: string;
  attendees: string;
};

// 전체 메모 도큐먼트 = 1 history stack (옵시디안/notion 패턴).
// __source = 마지막 set 의 출처 ("body"/"transcript"/"summary:*"/"meta:*"). undo/redo 시
// 자동으로 그 탭으로 setActiveTab 하는 UX 용 metadata. docsEqual / docToPatch 에서 무시.
type DocSnapshot = {
  body: string;
  transcript: string;
  summary: SummaryDoc;
  meta: MetaDoc;
  __source?: string;
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

function metasEqual(a: MetaDoc, b: MetaDoc): boolean {
  return a.date === b.date && a.time === b.time && a.attendees === b.attendees;
}

function metaToPatch(m: MetaDoc): MeetingUpdate {
  return {
    date: m.date || null,
    time: m.time.trim() || null,
    attendees: m.attendees.trim() || null,
  };
}

function docsEqual(a: DocSnapshot, b: DocSnapshot): boolean {
  return (
    a.body === b.body &&
    a.transcript === b.transcript &&
    summariesEqual(a.summary, b.summary) &&
    metasEqual(a.meta, b.meta)
  );
}

function docToPatch(d: DocSnapshot): MeetingUpdate {
  return {
    content: d.body,
    transcript: d.transcript || null,
    ...summaryToPatch(d.summary),
    ...metaToPatch(d.meta),
  };
}


type ActiveTab = "body" | "transcript" | "summary";

// 메모별 마지막 활성 탭 기억. 페이지 전환으로 컴포넌트가 unmount/mount 되어도
// 살아남도록 모듈 레벨에. 새로고침 시 초기화.
const ACTIVE_TAB_CACHE = new Map<string, ActiveTab>();
// 메모 + 탭 별 scroll 위치 기억 (`${meetingId}:${tab}` → scrollTop). 탭 전환/페이지
// 전환 시 outgoing 탭의 위치 저장 + incoming 탭의 위치 복원. 새로고침 시 초기화.
const SCROLL_CACHE = new Map<string, number>();

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
  //
  // V0.7.1 title-as-filename 모델: title 변경 = file path rename. 그래서 cacheKey
  // 는 path (`data.id`) 가 아니라 영구 식별자 uid 기반 — 제목 바뀌어도 history 유지.
  const uid = data?.uid;
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
      date: data?.date ?? "",
      time: data?.time ?? "",
      attendees: data?.attendees ? data.attendees.join(", ") : "",
    }),
    [data?.date, data?.time, data?.attendees],
  );

  const initialDoc = useMemo<DocSnapshot>(
    () => ({
      body: initialBody,
      transcript: initialTranscript,
      summary: initialSummary,
      meta: initialMeta,
    }),
    [initialBody, initialTranscript, initialSummary, initialMeta],
  );

  // 메모 전체 = 1 history stack. body 키타이프 / transcript / summary edit /
  // date·time·attendees commit 모두 하나의 timeline. Cmd+Z 는 focus 무관 마지막
  // 변경 undo (옵시디안/notion 패턴). 제목은 history 미참여 — commitTitle 직접 mutation.
  const docHistory = useStateHistory<DocSnapshot>({
    initial: initialDoc,
    cacheKey: uid ? `${uid}:doc` : undefined,
    commitMs: 1000,
    isEqual: docsEqual,
    onCommit: (d) => updateMutation.mutate(docToPatch(d)),
  });

  const doc = docHistory.value;
  const body = doc.body;
  const transcript = doc.transcript;
  const summary = doc.summary;
  const meta = doc.meta;

  // history entry boundary 추적 — 직전 set 의 source 와 다르면 flush 먼저
  // (= 직전 source 의 pending 을 별도 entry 로 마감, 새 entry 시작).
  const lastSourceRef = useRef<string | null>(null);
  function setDoc(source: string, next: DocSnapshot, immediate = false) {
    if (lastSourceRef.current !== null && lastSourceRef.current !== source) {
      docHistory.flush();
    }
    lastSourceRef.current = source;
    docHistory.set({ ...next, __source: source });
    if (immediate) docHistory.flush();
  }

  // undo/redo 시 doc.__source 보고 자동 탭 전환 (옵시디안/notion 처럼 변경 시점 탭으로).
  // meta:* 는 본문 탭 내부 영역이라 body 로 라우팅. typing 중에도 effect 가 fire 되지만
  // 이미 그 탭에 있으니 no-op.


  const [actionError, setActionError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  // ESC revert 직후 onBlur 가 commitTitle 다시 발사하는 것 차단용.
  const skipNextTitleCommit = useRef(false);

  // title 은 history 미참여 — draft + blur/Enter 시 직접 mutation.
  const initialTitle = data?.title ?? "";
  const [titleDraft, setTitleDraft] = useState<string>(initialTitle);
  const [attendeesDraft, setAttendeesDraft] = useState<string>(
    () => meta.attendees,
  );
  useEffect(() => {
    // 사용자가 typing 중 (input focus) 이면 server value 로 덮어쓰기 회피.
    if (document.activeElement === titleInputRef.current) return;
    setTitleDraft(initialTitle);
  }, [initialTitle]);
  useEffect(() => {
    setAttendeesDraft(meta.attendees);
  }, [meta.attendees]);

  async function commitTitle() {
    if (skipNextTitleCommit.current) {
      skipNextTitleCommit.current = false;
      return;
    }
    const trimmed = titleDraft.trim();
    const next = trimmed === "" ? (initialTitle || "untitled") : trimmed;
    if (next !== titleDraft) setTitleDraft(next);
    if (next === initialTitle) return;
    if (TITLE_UNSAFE_RE.test(next)) {
      setActionError(
        `제목에 다음 문자 사용 불가: / \\ : * ? " < > | # ^ [ ]\n계속 수정하거나 ESC 로 원래 제목 유지하세요.`,
      );
      requestAnimationFrame(() => titleInputRef.current?.focus());
      return;
    }
    try {
      await updateMutation.mutateAsync({ title: next });
    } catch (err) {
      if (err instanceof TitleConflictError) {
        setActionError(
          `이미 같은 제목의 메모가 있어요: "${next}"\n계속 수정하거나 ESC 로 원래 제목 유지하세요.`,
        );
        requestAnimationFrame(() => titleInputRef.current?.focus());
      }
    }
  }

  // meta 변경은 명시 commit (blur/Enter/tag 추가) — source 별로 분리 entry,
  // immediate=true 로 즉시 history append.
  function commitDate(next: string) {
    if (next === meta.date) return;
    setDoc("meta:date", { ...doc, meta: { ...meta, date: next } }, true);
  }

  function commitTime(next: string) {
    if (next === meta.time) return;
    setDoc("meta:time", { ...doc, meta: { ...meta, time: next } }, true);
  }

  function commitAttendees(next: string) {
    setAttendeesDraft(next);
    if (next.trim() === meta.attendees.trim()) return;
    setDoc("meta:attendees", { ...doc, meta: { ...meta, attendees: next } }, true);
  }
  const [activeTab, setActiveTabState] = useState<ActiveTab>(
    () => ACTIVE_TAB_CACHE.get(meetingId) ?? "body",
  );
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  function setActiveTab(t: ActiveTab) {
    ACTIVE_TAB_CACHE.set(meetingId, t);
    setActiveTabState(t);
  }
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalPrefill, setTaskModalPrefill] = useState<
    Partial<TodoInsert>
  >({});
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
      docHistory.flush();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [docHistory]);

  // 메모 전환 시 그 메모의 마지막 탭으로 (cache miss 면 본문).
  useEffect(() => {
    setActiveTabState(ACTIVE_TAB_CACHE.get(meetingId) ?? "body");
  }, [meetingId]);

  // 탭/메모 전환 후 layout 직후 — incoming 탭의 scroll 위치 복원 (없으면 0).
  // content mount 직후엔 textarea auto-resize 등으로 height 가 정해지지 않아
  // scrollTop set 이 cap 될 수 있음. immediate + next frame 두 번 set 으로 안전.
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const saved = SCROLL_CACHE.get(`${meetingId}:${activeTab}`) ?? 0;
    el.scrollTop = saved;
    const raf = requestAnimationFrame(() => {
      el.scrollTop = saved;
    });
    return () => cancelAnimationFrame(raf);
  }, [meetingId, activeTab]);

  // undo/redo 시 변경되는 영역의 탭으로 자동 전환.
  //   undo → from.__source (= 되돌려지는 변경의 출처)
  //   redo → to.__source   (= 적용되는 변경의 출처)
  // 둘 다 "변경이 일어나는" 탭으로 가는 일관 규칙.
  function routeToSource(src: string | undefined) {
    if (!src) return;
    if (src === "transcript") setActiveTab("transcript");
    else if (src.startsWith("summary")) setActiveTab("summary");
    else setActiveTab("body"); // "body" 또는 "meta:*"
  }

  // 방금 만든 메모면 title input 자동 focus + select all — 사용자가 default
  // 'memo' 위에 바로 타이핑하면 새 제목으로 교체.
  useEffect(() => {
    if (consumeJustCreatedMeetingUid(meetingId)) {
      // mount 직후 ref attach 되도록 microtask 한 tick 미룸
      requestAnimationFrame(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      });
    }
  }, [meetingId]);

  // ESC: 활성 input/textarea/contenteditable 의 focus 제거. 제목/날짜/시간/참석자는
  // 각자 onKeyDown 의 Esc 핸들러가 먼저 발동해 draft → 이전값 revert + 자체 blur.
  // 본문/음성 기록 textarea 는 값 유지 + 여기서 blur 만.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const a = document.activeElement as HTMLElement | null;
      if (!a) return;
      const tag = a.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || a.isContentEditable) {
        a.blur();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // 단축키 (Tauri only):
  //   Cmd/Ctrl+Z/Y/Shift+Z = docHistory undo/redo (전체 도큐먼트 timeline. 제목 제외).
  //     focus 가 제목 input 이면 native input undo 사용 (preventDefault X).
  //   Q / W / E = sub-tab 메모 / 음성 기록 / 요약 (input/textarea 밖에서만). Q 두 번째 =
  //     본문 탭일 때 편집/보기 토글. e.code 매칭으로 한글 IME 켜져 있어도 동작.
  useEffect(() => {
    function isInTextInput(t: EventTarget | null): boolean {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      return t.isContentEditable;
    }

    function isInTitleInput(): boolean {
      return document.activeElement === titleInputRef.current;
    }

    function onKeyDown(e: KeyboardEvent) {
      const cmd = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const isUndo = cmd && !e.shiftKey && !e.altKey && k === "z";
      const isRedo =
        (cmd && !e.altKey && k === "y") ||
        (cmd && e.shiftKey && !e.altKey && k === "z");
      // 제목 input focus 면 native input undo 통과 (title 은 history 미참여).
      if ((isUndo || isRedo) && isInTitleInput()) return;
      if (isUndo) {
        e.preventDefault();
        const t = docHistory.undo();
        if (t) routeToSource((t.from as DocSnapshot).__source);
        return;
      }
      if (isRedo) {
        e.preventDefault();
        const t = docHistory.redo();
        if (t) routeToSource((t.to as DocSnapshot).__source);
        return;
      }
      // Opt+Q/W/E — input/textarea 안에서도 동작 (브라우저/Tauri 둘 다).
      // macOS default 글자 (œ/∑/´ dead-key) preventDefault.
      if (e.altKey && !cmd && !e.shiftKey) {
        if (e.code === "KeyQ") {
          e.preventDefault();
          if (activeTab === "body") {
            setViewMode(viewMode === "edit" ? "view" : "edit");
          } else {
            setActiveTab("body");
          }
          return;
        }
        if (e.code === "KeyW") {
          e.preventDefault();
          setActiveTab("transcript");
          return;
        }
        if (e.code === "KeyE") {
          e.preventDefault();
          setActiveTab("summary");
          return;
        }
      }
      if (!isTauri) return;
      // single-key sub-tab — modifier 있으면 무시.
      if (cmd || e.shiftKey || e.altKey) return;
      if (isInTextInput(e.target)) return;
      if (e.code === "KeyQ") {
        e.preventDefault();
        if (activeTab === "body") {
          setViewMode(viewMode === "edit" ? "view" : "edit");
        } else {
          setActiveTab("body");
        }
      } else if (e.code === "KeyW") {
        e.preventDefault();
        setActiveTab("transcript");
      } else if (e.code === "KeyE") {
        e.preventDefault();
        setActiveTab("summary");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [docHistory, activeTab, viewMode, setViewMode]);

  async function handleDelete() {
    if (!data) return;
    if (!window.confirm("이 메모를 휴지통으로 옮길까요?")) return;
    try {
      await deleteMutation.mutateAsync(data.uid);
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
      title: titleDraft.trim() || initialTitle || "untitled",
      ...docToPatch(doc),
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
    title: titleDraft.trim() || initialTitle || null,
    date: meta.date || null,
    time: meta.time || null,
    attendees: meta.attendees || null,
    discussion_items: summary.discussion_items,
    decisions: summary.decisions,
    action_items: summary.action_items,
  };

  function setSummaryField<K extends keyof SummaryDoc>(
    key: K,
    value: SummaryDoc[K],
  ) {
    // summary list 변경은 명시 intent (Enter, 삭제 등) — 즉시 entry.
    setDoc(`summary:${key}`, { ...doc, summary: { ...summary, [key]: value } }, true);
  }

  return (
    <div className="min-h-svh lg:flex lg:h-screen lg:min-h-0 lg:flex-col">
      {/* Header — 사이드바 헤더와 같은 높이 (3.5rem). desktop 에선 flex item (top fixed),
          mobile 은 sticky. grid 로 좌/우 그룹 width 변화 무관 제목 viewport-center. */}
      <div
        className="sticky top-0 z-20 grid items-center gap-2 overflow-hidden px-3 backdrop-blur lg:shrink-0 lg:relative lg:top-auto"
        style={{
          height: "3.5rem",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr)",
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
              onClick={() => {
                const t = docHistory.undo();
                if (t) routeToSource((t.from as DocSnapshot).__source);
              }}
              disabled={!docHistory.canUndo}
              title={`실행 취소 (${activeTab === "body" ? "메모" : activeTab === "transcript" ? "음성 기록" : "요약"})`}
              className="px-1.5 py-1 transition disabled:opacity-20"
              style={{ color: "var(--text-secondary)", minHeight: 0 }}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                const t = docHistory.redo();
                if (t) routeToSource((t.to as DocSnapshot).__source);
              }}
              disabled={!docHistory.canRedo}
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
              // blur 만 — onBlur 가 commitTitle 발사. 직접 호출하면 commit 2번 → mutation race.
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              e.preventDefault();
              // 원래 제목으로 revert + blur. 다음 onBlur 의 commitTitle 는 skip.
              setTitleDraft(initialTitle);
              skipNextTitleCommit.current = true;
              setActionError(null);
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="untitled"
          autoFocus={!data.title}
          className="min-w-0 justify-self-center bg-transparent text-center text-base font-semibold outline-none"
          style={{
            color: "var(--text-primary)",
            // field-sizing: input width 가 자동으로 content 길이 따라감 (한글/영문 정확).
            // max-width 28rem 또는 grid track 안 100% 로 cap, 초과 시 native ellipsis.
            fieldSizing: "content",
            maxWidth: "min(100%, 28rem)",
            textOverflow: "ellipsis",
            overflow: "hidden",
          } as React.CSSProperties}
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
                  ? `${viewMode === "edit" ? "보기 모드" : "편집 모드"}  Q`
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
          outer = full-width scroll, inner = max-w content.
          onScroll = 탭별 scroll 위치 매번 cache (탭/메모 전환 시 복원). */}
      <div
        ref={scrollContainerRef}
        className="lg:flex-1 lg:overflow-y-auto lg:overscroll-none"
        onScroll={(e) => {
          SCROLL_CACHE.set(
            `${meetingId}:${activeTab}`,
            (e.currentTarget as HTMLDivElement).scrollTop,
          );
        }}
      >
        <div
          className="mx-auto max-w-3xl px-6 pb-24"
          onMouseDown={(e) => {
            // wrapper 의 padding 영역 (특히 pb-24 하단) 클릭 → 활성 textarea 끝으로 focus.
            // 좌우 px-6 (24px) 영역은 제외 — 사용자가 좌우 padding 은 클릭으로 잡지 말라고 했음.
            if (e.target !== e.currentTarget) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (x < 24 || x > rect.width - 24) return;
            const ta = e.currentTarget.querySelector("textarea");
            if (!(ta instanceof HTMLTextAreaElement)) return;
            e.preventDefault();
            ta.focus();
            const end = ta.value.length;
            ta.setSelectionRange(end, end);
          }}
        >
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
              shortcut={isTauri ? "Q" : undefined}
              active={activeTab === "body"}
              onClick={() => setActiveTab("body")}
            />
            <TabBtn
              label="음성 기록"
              shortcut={isTauri ? "W" : undefined}
              active={activeTab === "transcript"}
              onClick={() => setActiveTab("transcript")}
            />
            <TabBtn
              label="요약"
              shortcut={isTauri ? "E" : undefined}
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
                <MetaRow
                  icon={<CalendarIcon className="h-3.5 w-3.5" />}
                  label="날짜"
                >
                  <LooseDateInput
                    value={meta.date}
                    onCommit={commitDate}
                  />
                </MetaRow>
                <MetaRow
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label="시간"
                >
                  <LooseTimeInput
                    value={meta.time}
                    onCommit={commitTime}
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
              <MetaReadOnly meta={meta} />
            )}
            {viewMode === "edit" ? (
              <SourceBodyEditor
                key={`${meetingId}:body`}
                content={body}
                onChange={(v) => {
                  // 줄이 늘었으면 직전 줄까지 별도 entry.
                  const prevLines = (doc.body.match(/\n/g)?.length ?? 0);
                  const newLines = (v.match(/\n/g)?.length ?? 0);
                  if (newLines > prevLines) docHistory.flush();
                  setDoc("body", { ...doc, body: v });
                }}
                onSendLineToInbox={(lineText) => {
                  setTaskModalPrefill(lineToTaskPrefill(lineText, meetingId));
                  setTaskModalOpen(true);
                }}
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
              onChange={(v) => {
                const prevLines = (doc.transcript.match(/\n/g)?.length ?? 0);
                const newLines = (v.match(/\n/g)?.length ?? 0);
                if (newLines > prevLines) docHistory.flush();
                setDoc("transcript", { ...doc, transcript: v });
              }}
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
                  title: titleDraft.trim() || initialTitle || null,
                  date: meta.date || null,
                  time: meta.time || null,
                  attendees: meta.attendees || null,
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
      <TaskAddModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        prefill={taskModalPrefill}
      />
    </div>
  );
}

// 메모 안 한 줄 → TaskAddModal prefill. extractTodos parser 가 자연어까지 처리
// (오늘, 내일, 월/화/일요일, 한글/압축 날짜, "오후 2시" 등).
// 문법: `- [x] 본문 --- (날짜) (시간) #category #priority`
//   - [x] / [ ]    = done
//   --- 또는 —     = date/time split (앞 본문, 뒤 매칭 토큰들)
//   #work / #meeting       = category
//   #high / #medium / #low = priority
// 매칭 안 되는 토큰은 모두 본문으로 (예 `[안건 1]` 같은 bracket).
function lineToTaskPrefill(
  lineText: string,
  meetingUid: string,
): Partial<TodoInsert> {
  const items = extractTodos("inbox.md", `${lineText}\n`);
  const item = items[0];
  if (!item) return { source_meeting_uid: meetingUid };
  const prefill: Partial<TodoInsert> = {
    title: item.text,
    done: item.done,
    source_meeting_uid: meetingUid,
  };
  if (item.due) prefill.due_date = item.due;
  if (item.time) prefill.due_time = item.time;
  const cat = item.tags.find((t): t is TodoCategory => t === "work" || t === "schedule" || t === "other");
  if (cat) prefill.category = cat;
  const pri = item.tags.find((t): t is TodoPriority =>
    t === "high" || t === "medium" || t === "low",
  );
  if (pri) prefill.priority = pri;
  return prefill;
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
  const wd = weekdayShort(meta.date);
  const rows: { label: string; value: string }[] = [];
  if (meta.date) rows.push({ label: "날짜", value: wd ? `${meta.date} (${wd})` : meta.date });
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
      {shortcut ? (
        <kbd
          aria-hidden
          className="rounded font-mono text-[10px] leading-none"
          style={{
            padding: "2px 5px",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-muted)",
            backgroundColor: "var(--bg-surface)",
          }}
        >
          {shortcut}
        </kbd>
      ) : null}
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

  // macOS smart substitution fallback (autoCorrect="off" 안 막힐 때)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    function onBeforeInput(e: Event) {
      const ev = e as InputEvent;
      if (ev.inputType === "insertReplacementText") {
        const d = ev.data ?? "";
        if (d.includes("—") || d.includes("–") || d.includes("“") || d.includes("”") || d.includes("‘") || d.includes("’") || d.includes("…")) {
          e.preventDefault();
        }
      }
    }
    el.addEventListener("beforeinput", onBeforeInput);
    return () => el.removeEventListener("beforeinput", onBeforeInput);
  }, []);

  function onContainerMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) {
      const el = textareaRef.current;
      if (!el) return;
      e.preventDefault();
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    }
  }

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
      <div onMouseDown={onContainerMouseDown} style={{ minHeight: "60vh" }}>
        <textarea
          ref={textareaRef}
          value={transcript}
          onChange={(e) => onChange(e.target.value)}
          placeholder="음성 녹음의 텍스트 변환 결과를 여기에..."
          className="w-full resize-none bg-transparent text-base leading-relaxed outline-none"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          style={{
            color: "var(--text-primary)",
            overflowY: "hidden",
          }}
        />
      </div>
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
