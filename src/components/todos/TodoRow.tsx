import { useEffect, useRef, useState } from "react";
import {
  Calendar as CalendarIcon,
  Check,
  Clock,
  FileText,
  Hash,
} from "lucide-react";
import type { Todo, TodoPriority, TodoCategory } from "../../api/todos";
import { TODO_CATEGORIES } from "../../api/todos";
import { useMeetings } from "../../hooks/useMeetings";
import { useUpdateTodo } from "../../hooks/useTodos";
import { useTodoFlash } from "../../hooks/useTodoHistory";
import {
  daysFromToday,
  formatDateShort,
  formatDateShortWithDay,
  parseIsoDate,
  weekdayShort,
} from "../../lib/dates";
import { LooseDateInput } from "../common/LooseDateInput";
import { LooseTimeInput } from "../common/LooseTimeInput";
import { MeetingPicker } from "../common/MeetingPicker";
import { CategoryPicker } from "../common/CategoryPicker";

type Props = {
  todo: Todo;
  onToggle: (todo: Todo) => void;
  onUpdate: (
    todo: Todo,
    patch: {
      title?: string;
      priority?: TodoPriority;
      due_date?: string | null;
      due_time?: string | null;
      category?: TodoCategory | null;
      source_meeting_uid?: string | null;
      done?: boolean;
      cancelled?: boolean;
      deleted?: boolean;
    },
  ) => void;
  onDelete: (todo: Todo) => void;
};

type Draft = {
  title: string;
  due_date: string;
  due_time: string;
  category: TodoCategory | null;
  source_meeting_uid: string | null;
  cancelled: boolean;
  done: boolean;
};

function draftFromTodo(todo: Todo): Draft {
  return {
    title: todo.title,
    due_date: todo.due_date ?? "",
    due_time: todo.due_time ?? "",
    category: todo.category,
    source_meeting_uid: todo.source_meeting_uid,
    cancelled: todo.cancelled,
    done: todo.done,
  };
}

export function TodoRow({ todo, onToggle, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const flashing = useTodoFlash(todo.id);
  // edit 모드 진입 시 todo 의 모든 편집 가능한 값을 draft 로 복사. 사용자가
  // 모든 input 다듬는 동안 mutation 호출 X → 리스트 정렬 안 흔들림.
  // 확인 / 외부 클릭 / Enter (title) 시점에 diff 만 단일 patch 로 commit.
  const [draft, setDraft] = useState<Draft>(() => draftFromTodo(todo));
  // draftRef = 최신 draft. setDraft 는 React state 라 비동기 — 외부 클릭 시
  // microtask 안에서 commit 시 closure stale 위험. ref 로 동기 동기화.
  const draftRef = useRef(draft);
  const cardRef = useRef<HTMLLIElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  function updateDraft(patch: Partial<Draft>) {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
  }

  useEffect(() => {
    if (editing) {
      const fresh = draftFromTodo(todo);
      draftRef.current = fresh;
      setDraft(fresh);
      requestAnimationFrame(() => {
        const el = titleRef.current;
        if (!el) return;
        el.focus();
        // 커서를 텍스트 끝에 — 전체 선택 X (사용자가 끝에 이어쓰기 자연).
        const len = el.value.length;
        el.setSelectionRange(len, len);
      });
    }
    // editing false 일 때 draft 는 stale 이지만 다음 entering 시 reset 됨.
  }, [editing, todo]);

  // 외부 클릭 시 commit + close. LooseDate/Time 처럼 blur 시 onCommit 하는 input
  // 의 경우 — mousedown 시점엔 아직 focus 라 onCommit 미발생. blur() 강제 호출
  // → 자식 onCommit → updateDraft → draftRef.current 동기 갱신. microtask 에서
  // commitAndClose 실행 시 최신 ref 사용.
  useEffect(() => {
    if (!editing) return;
    function onMouseDown(e: MouseEvent) {
      if (cardRef.current?.contains(e.target as Node)) return;
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        cardRef.current?.contains(active)
      ) {
        active.blur();
      }
      queueMicrotask(commitAndClose);
    }
    function onKey(e: KeyboardEvent) {
      // ESC = 모든 변경 폐기. 자식 input (LooseDate/Time, MeetingPicker 등) 의
      // 자체 ESC handler 가 먼저 자기 input revert 후 bubble → 여기서 cancelEdit.
      if (e.key === "Escape") cancelEdit();
      // Enter = commit (어떤 input focus 든). LooseDate/Time 의 Enter handler 는
      // 자체 blur → onCommit → updateDraft 동기 갱신 → 우리 listener 가 catch.
      if (e.key === "Enter") {
        const active = document.activeElement;
        if (
          active instanceof HTMLElement &&
          cardRef.current?.contains(active)
        ) {
          active.blur();
        }
        queueMicrotask(commitAndClose);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // 카드 unmount 직전 짧은 fade-out 으로 "사라짐" cue. 그 후 실제 mutation.
  // delete + cancel 신규 시 (view 에서 사라지는 경우) 만 적용.
  function fadeOutThen(fn: () => void) {
    if (cardRef.current) {
      cardRef.current.style.animation = "todoCardExit 180ms ease forwards";
      setTimeout(fn, 180);
    } else {
      fn();
    }
  }

  function commitAndClose() {
    const d = draftRef.current;
    const patch: Parameters<typeof onUpdate>[1] = {};
    const titleTrimmed = d.title.trim();
    if (titleTrimmed && titleTrimmed !== todo.title) {
      patch.title = titleTrimmed;
    }
    const nextDate = d.due_date || null;
    if (nextDate !== todo.due_date) patch.due_date = nextDate;
    const nextTime = d.due_time || null;
    if (nextTime !== todo.due_time) patch.due_time = nextTime;
    if (d.category !== todo.category) patch.category = d.category;
    if (d.source_meeting_uid !== todo.source_meeting_uid)
      patch.source_meeting_uid = d.source_meeting_uid;
    if (d.cancelled !== todo.cancelled) patch.cancelled = d.cancelled;
    if (d.done !== todo.done) patch.done = d.done;
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }
    // cancelled / deleted 신규 true = view 에서 사라짐. fadeOut.
    const willDisappear =
      (patch.cancelled === true && !todo.cancelled) ||
      (patch.deleted === true && !todo.deleted);
    if (willDisappear) {
      fadeOutThen(() => {
        onUpdate(todo, patch);
        setEditing(false);
      });
    } else {
      onUpdate(todo, patch);
      setEditing(false);
    }
  }

  function cancelEdit() {
    setEditing(false);
  }

  function handleDeleteWithFade() {
    fadeOutThen(() => onDelete(todo));
  }


  return (
    <li
      ref={cardRef}
      onClick={() => {
        if (!editing) setEditing(true);
      }}
      className={`rounded-lg border transition ${editing ? "" : "cursor-pointer hover:bg-[var(--bg-surface)]"} ${flashing ? "todo-card-flash" : "todo-card-enter"}`}
      style={{
        borderColor: editing ? "var(--border-default)" : "var(--border-subtle)",
        backgroundColor: editing ? "var(--bg-surface)" : undefined,
      }}
    >
      {editing ? (
        <div className="px-3 py-2.5">
          {/* 윗줄: 체크박스 + 제목 input (전체 너비) */}
          <div className="flex items-center gap-3">
            <CheckboxButton
              status={
                draft.cancelled ? "cancelled" : draft.done ? "done" : "pending"
              }
              onClick={() => {
                if (draft.cancelled) {
                  updateDraft({ cancelled: false });
                } else {
                  updateDraft({ done: !draft.done });
                }
              }}
            />
            <input
              ref={titleRef}
              value={draft.title}
              onChange={(e) => updateDraft({ title: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  commitAndClose();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  cancelEdit();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder="제목"
              maxLength={200}
              className="min-w-0 flex-1 bg-transparent text-base outline-none"
              style={{ color: "var(--text-primary)" }}
            />
          </div>

          {/* 아랫줄: 좌측 메타 cluster + 우측 액션 cluster. 체크박스 (h-5 + gap-3) 만큼 들여쓰기. */}
          <div
            className="mt-2 flex items-center justify-between gap-2 pl-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              <span className="inline-flex shrink-0 items-center gap-1">
                <CalendarIcon className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                <LooseDateInput
                  value={draft.due_date}
                  onCommit={(next) => updateDraft({ due_date: next })}
                  compact
                />
              </span>
              <span className="inline-flex shrink-0 items-center gap-1">
                <Clock className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                <LooseTimeInput
                  value={draft.due_time}
                  onCommit={(next) => updateDraft({ due_time: next })}
                  compact
                />
              </span>
              <CategoryPicker
                value={draft.category}
                onChange={(cat) => updateDraft({ category: cat })}
              />
              <MeetingPicker
                value={draft.source_meeting_uid}
                onChange={(uid) => updateDraft({ source_meeting_uid: uid })}
              />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  updateDraft({
                    cancelled: !draft.cancelled,
                    // cancelled 면서 done 일 수 없음 — 둘 다 final state.
                    ...(!draft.cancelled && draft.done ? { done: false } : {}),
                  })
                }
                title={draft.cancelled ? "취소 해제" : "할일 취소"}
                className="rounded-md px-2 py-1 text-xs transition hover:bg-[var(--bg-surface-hover)]"
                style={{
                  color: draft.cancelled
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
                  border: `1px solid ${draft.cancelled ? "var(--text-muted)" : "var(--border-subtle)"}`,
                  minHeight: 0,
                }}
              >
                {draft.cancelled ? "✗ 취소됨" : "취소"}
              </button>
              <button
                type="button"
                onClick={handleDeleteWithFade}
                title="할일 삭제"
                className="rounded-md px-2 py-1 text-xs transition hover:bg-[var(--bg-surface-hover)]"
                style={{
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-subtle)",
                  minHeight: 0,
                }}
              >
                삭제
              </button>
              <button
                type="button"
                onClick={commitAndClose}
                title="완료 (변경 저장)"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition"
                style={{
                  backgroundColor: "var(--btn-primary)",
                  color: "var(--btn-primary-text)",
                  minHeight: 0,
                }}
              >
                <Check className="h-3 w-3" />
                완료
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-3 py-2.5">
          <CheckboxButton
            status={
              todo.cancelled ? "cancelled" : todo.done ? "done" : "pending"
            }
            onClick={() => onToggle(todo)}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <DueChip todo={todo} />
              <div
                className={`min-w-0 break-words text-base ${todo.done || todo.cancelled ? "line-through" : ""}`}
                style={{
                  color:
                    todo.done || todo.cancelled
                      ? "var(--text-muted)"
                      : "var(--text-primary)",
                }}
              >
                {todo.title || (
                  <span style={{ color: "var(--text-muted)" }}>(제목 없음)</span>
                )}
              </div>
            </div>
            <ReadOnlyMeta todo={todo} />
          </div>
        </div>
      )}
    </li>
  );
}

// 체크박스 button — pending / done / cancelled 3 state. editing 중엔 draft 기반,
// 보기 모드는 todo 기반.
function CheckboxButton({
  status,
  onClick,
}: {
  status: "pending" | "done" | "cancelled";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={
        status === "cancelled"
          ? "취소 해제"
          : status === "done"
            ? "완료 취소"
            : "완료"
      }
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`group/check flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${
        status === "done"
          ? "border-[var(--border-default)] bg-[var(--border-default)]"
          : status === "cancelled"
            ? "border-[var(--text-muted)] bg-[var(--bg-surface)]"
            : "border-[var(--text-muted)] bg-[var(--bg-base)] hover:scale-110 hover:border-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] hover:shadow-sm"
      }`}
      style={{ minHeight: 20, minWidth: 20 }}
    >
      {status === "done" ? (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="h-3 w-3"
          style={{ color: "var(--text-inverse)" }}
          aria-hidden
        >
          <path
            d="M3 8l3 3 7-7"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : status === "cancelled" ? (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="h-3 w-3"
          style={{ color: "var(--text-muted)" }}
          aria-hidden
        >
          <path
            d="M4 4l8 8M12 4l-8 8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="h-3 w-3 opacity-0 transition-opacity group-hover/check:opacity-50"
          style={{ color: "var(--text-primary)" }}
          aria-hidden
        >
          <path
            d="M3 8l3 3 7-7"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

// 제목 앞 chip — 오늘 / 임박 (내일~3일) / 기한 지남 (D+N). 4일 이상 미래는
// chip 없음 (메타 row 의 날짜로 충분). done / cancelled 도 X.
function DueChip({ todo }: { todo: Todo }) {
  if (todo.done || todo.cancelled || !todo.due_date) return null;
  const diff = daysFromToday(todo.due_date);
  const base = "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium";
  if (diff === 0) {
    return (
      <span
        className={base}
        style={{
          backgroundColor: "var(--accent-blue-bg)",
          color: "var(--accent-blue-text)",
        }}
      >
        오늘
      </span>
    );
  }
  if (diff < 0) {
    return (
      <span
        className={base}
        style={{
          backgroundColor: "var(--accent-red-bg)",
          color: "var(--accent-red-text)",
        }}
      >
        D+{-diff}
      </span>
    );
  }
  if (diff >= 1 && diff <= 3) {
    return (
      <span
        className={base}
        style={{
          backgroundColor: "transparent",
          color: "var(--text-secondary)",
          border: "1px solid var(--border-default)",
        }}
      >
        {diff === 1 ? "내일" : `D-${diff}`}
      </span>
    );
  }
  return null;
}

// read-only: 값이 있는 메타만 chip 으로 표시. 모두 비어있으면 아무것도 렌더 X.
function ReadOnlyMeta({ todo }: { todo: Todo }) {
  const hasDate = !!todo.due_date;
  const hasTime = !!todo.due_time;
  const categoryLabel = TODO_CATEGORIES.find((c) => c.id === todo.category)?.label;
  const hasSource = !!todo.source_meeting_uid;
  if (!hasDate && !hasTime && !categoryLabel && !hasSource) return null;
  const wd = todo.due_date ? weekdayShort(todo.due_date) : null;
  return (
    <div
      className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
      style={{ color: "var(--text-secondary)" }}
    >
      {hasDate ? (
        <span>
          {(() => {
            const sameYear =
              parseIsoDate(todo.due_date!).getFullYear() ===
              new Date().getFullYear();
            const dateLabel = sameYear
              ? formatDateShort(todo.due_date!)
              : todo.due_date;
            return `${dateLabel}${wd ? ` (${wd})` : ""}`;
          })()}
        </span>
      ) : null}
      {hasTime ? <span>{todo.due_time}</span> : null}
      {categoryLabel ? (
        <span className="inline-flex items-center gap-0.5">
          <Hash className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
          {categoryLabel}
        </span>
      ) : null}
      {hasSource ? (
        <SourceMeetingLink uid={todo.source_meeting_uid!} todoId={todo.id} />
      ) : null}
    </div>
  );
}

// 메모 chip 을 클릭하면 confirm popover. "이동" 누르면 navigate, 외부 클릭/ESC 닫음.
// 실수로 카드 클릭 → 다른 화면 이동하는 거 차단.
// vault 에서 메모 사라진 경우 — "연결 끊김" 표시 + 이동 button 비활성. md 의
// #from-<uid> tag 는 그대로 두고 (자동 정리 X) 사용자가 직접 편집.
function SourceMeetingLink({ uid, todoId }: { uid: string; todoId: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const meetingsQ = useMeetings();
  const updateMutation = useUpdateTodo();
  const meeting = meetingsQ.data?.find((m) => m.uid === uid) ?? null;
  // list 가 fetched (isSuccess) 인데도 없으면 진짜 사라진 메모.
  const disconnected = meetingsQ.isSuccess && !meeting;

  function disconnect() {
    updateMutation.mutate({
      id: todoId,
      patch: { source_meeting_uid: null },
    });
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const chipLabel = disconnected
    ? "(연결 끊김)"
    : meeting?.title?.trim() || "원본 메모";

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`inline-flex max-w-[12rem] items-center gap-1 truncate underline-offset-2 ${disconnected ? "" : "hover:underline"}`}
        style={{ color: "var(--text-secondary)", minHeight: 0 }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <FileText className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
        <span className="truncate">{chipLabel}</span>
      </button>
      {open ? (
        <div
          className="absolute left-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-md shadow-md"
          style={{
            backgroundColor: "var(--bg-base)",
            border: "1px solid var(--border-default)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="px-3 py-2 text-xs"
            style={{
              borderBottom: "1px solid var(--border-subtle)",
              color: "var(--text-secondary)",
            }}
          >
            <div style={{ color: "var(--text-muted)" }}>연결된 메모</div>
            {disconnected ? (
              <div
                className="mt-0.5 text-[11px]"
                style={{ color: "var(--text-muted)" }}
              >
                메모를 찾을 수 없어요. (md 안 연결 id 는 그대로 보존)
              </div>
            ) : (
              <>
                <div
                  className="mt-0.5 truncate font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  {meeting?.title?.trim() || "(제목 없음)"}
                </div>
                {meeting?.date || meeting?.time || meeting?.attendees?.length ? (
                  <div
                    className="mt-1 truncate text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {meeting.date ? formatDateShortWithDay(meeting.date) : null}
                    {meeting.time ? ` · ${meeting.time}` : null}
                    {meeting.attendees && meeting.attendees.length > 0
                      ? ` · ${meeting.attendees.join(", ")}`
                      : null}
                  </div>
                ) : null}
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 px-3 py-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-1.5 text-xs transition"
              style={{
                border: "1px solid var(--border-default)",
                color: "var(--text-secondary)",
                minHeight: 0,
              }}
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                if (disconnected) {
                  disconnect();
                  return;
                }
                setOpen(false);
                window.location.hash = `#meeting-${uid}`;
              }}
              className="rounded-md px-3 py-1.5 text-xs font-medium transition"
              style={
                disconnected
                  ? {
                      backgroundColor: "transparent",
                      color: "var(--accent-red)",
                      border: "1px solid var(--accent-red)",
                      minHeight: 0,
                    }
                  : {
                      backgroundColor: "var(--accent-blue)",
                      color: "white",
                      minHeight: 0,
                    }
              }
            >
              {disconnected ? "연결 해제" : "메모로 이동"}
            </button>
          </div>
        </div>
      ) : null}
    </span>
  );
}
