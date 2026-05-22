import { useEffect, useReducer, useState } from "react";
import type { Todo, TodoUpdate } from "../api/todos";
import { useUpdateTodo } from "./useTodos";

// Module-level stack survives TodosPage unmount (cross-page 유지).
// 새로고침 시만 reset — useStateHistory 의 HISTORY_CACHE 와 동일 패턴.
type Entry =
  | { kind: "toggle"; id: string; before: boolean }
  | { kind: "update"; id: string; before: TodoUpdate; after: TodoUpdate };

const UNDO: Entry[] = [];
const REDO: Entry[] = [];
const MAX = 50;
const listeners = new Set<() => void>();
// undo/redo 시 영향받은 todo id — 카드 flash 용. listener pattern 으로 reactive.
const flashListeners = new Set<(id: string) => void>();

function notify() {
  for (const fn of listeners) fn();
}

function notifyFlash(id: string) {
  for (const fn of flashListeners) fn(id);
}

function push(entry: Entry) {
  UNDO.push(entry);
  if (UNDO.length > MAX) UNDO.shift();
  REDO.length = 0;
  notify();
}

/** mutation 직전 호출. patch 와 todo 현재 상태로 inverse entry 만들어 stack 에 push. */
export function recordTodoUpdate(todo: Todo, patch: TodoUpdate) {
  const before: TodoUpdate = {};
  if (patch.title !== undefined) before.title = todo.title;
  if (patch.priority !== undefined) before.priority = todo.priority;
  if (patch.due_date !== undefined) before.due_date = todo.due_date;
  if (patch.due_time !== undefined) before.due_time = todo.due_time;
  if (patch.category !== undefined) before.category = todo.category;
  if (patch.source_meeting_uid !== undefined)
    before.source_meeting_uid = todo.source_meeting_uid;
  if (patch.cancelled !== undefined) before.cancelled = todo.cancelled;
  if (patch.deleted !== undefined) before.deleted = todo.deleted;
  // done 은 toggle entry 로 분리 — done_at 포함이라 모양이 다름.
  if (patch.done !== undefined && Object.keys(patch).length <= 2) {
    push({ kind: "toggle", id: todo.id, before: todo.done });
    return;
  }
  if (Object.keys(before).length === 0) return;
  const after: TodoUpdate = { ...patch };
  delete after.done;
  delete after.done_at;
  push({ kind: "update", id: todo.id, before, after });
}

export function clearTodoHistory() {
  UNDO.length = 0;
  REDO.length = 0;
  notify();
}

// React subscribe — stack 변경 시 component re-render. canUndo/canRedo 등 reactive.
function useStackVersion() {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, []);
}

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return true;
  if (el.isContentEditable) return true;
  return false;
}

/**
 * undo/redo 액션 + reactive canUndo/canRedo. 사이드패널 button + 페이지 단축키
 * listener 가 같은 hook 사용. 같은 module stack 공유.
 */
export function useTodoUndo() {
  useStackVersion();
  const updateMutation = useUpdateTodo();

  function applyToggle(id: string, nextDone: boolean) {
    updateMutation.mutate({
      id,
      patch: {
        done: nextDone,
        done_at: nextDone ? new Date().toISOString() : null,
      },
    });
  }
  function applyUpdate(id: string, patch: TodoUpdate) {
    updateMutation.mutate({ id, patch });
  }

  function undo() {
    const entry = UNDO.pop();
    if (!entry) return;
    REDO.push(entry);
    notify();
    notifyFlash(entry.id);
    if (entry.kind === "toggle") applyToggle(entry.id, entry.before);
    else applyUpdate(entry.id, entry.before);
  }

  function redo() {
    const entry = REDO.pop();
    if (!entry) return;
    UNDO.push(entry);
    notify();
    notifyFlash(entry.id);
    if (entry.kind === "toggle") applyToggle(entry.id, !entry.before);
    else applyUpdate(entry.id, entry.after);
  }

  return {
    canUndo: UNDO.length > 0,
    canRedo: REDO.length > 0,
    undo,
    redo,
  };
}

/**
 * 특정 todo id 의 flash 트리거 감지. undo/redo 시 영향받은 카드 잠시 깜빡임 cue.
 * 카드 mount/unmount 와 무관하게 listener 패턴.
 */
export function useTodoFlash(todoId: string): boolean {
  const [flashing, setFlashing] = useState(false);
  useEffect(() => {
    function onFlash(id: string) {
      if (id !== todoId) return;
      setFlashing(true);
      window.setTimeout(() => setFlashing(false), 600);
    }
    flashListeners.add(onFlash);
    return () => {
      flashListeners.delete(onFlash);
    };
  }, [todoId]);
  return flashing;
}

export function useTodoUndoShortcut(opts: { active: boolean }) {
  const { undo, redo } = useTodoUndo();
  useEffect(() => {
    if (!opts.active) return;
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      if (key !== "z") return;
      // input/textarea focus 중엔 native undo 우선 (메모장 제목 패턴).
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [opts.active, undo, redo]);
}
