import { useEffect, useReducer, useState } from "react";
import type { Task, TodoUpdate } from "../api/tasks";
import { useUpdateTask } from "./useTasks";

// Module-level stack survives TasksPage unmount (cross-page 유지).
// 새로고침 시만 reset — useStateHistory 의 HISTORY_CACHE 와 동일 패턴.
type Entry =
  | { kind: "toggle"; id: string; before: boolean }
  | { kind: "update"; id: string; before: TodoUpdate; after: TodoUpdate };

const UNDO: Entry[] = [];
const REDO: Entry[] = [];
const MAX = 50;
const listeners = new Set<() => void>();
// undo/redo 시 영향받은 task id — 카드 flash 용. listener pattern 으로 reactive.
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

/** mutation 직전 호출. patch 와 task 현재 상태로 inverse entry 만들어 stack 에 push. */
export function recordTaskUpdate(task: Task, patch: TodoUpdate) {
  const before: TodoUpdate = {};
  if (patch.title !== undefined) before.title = task.title;
  if (patch.priority !== undefined) before.priority = task.priority;
  if (patch.due_date !== undefined) before.due_date = task.due_date;
  if (patch.end_date !== undefined) before.end_date = task.end_date;
  if (patch.due_time !== undefined) before.due_time = task.due_time;
  if (patch.category !== undefined) before.category = task.category;
  if (patch.source_meeting_uid !== undefined)
    before.source_meeting_uid = task.source_meeting_uid;
  if (patch.cancelled !== undefined) before.cancelled = task.cancelled;
  if (patch.deleted !== undefined) before.deleted = task.deleted;
  // done 은 toggle entry 로 분리 — done_at 포함이라 모양이 다름.
  if (patch.done !== undefined && Object.keys(patch).length <= 2) {
    push({ kind: "toggle", id: task.id, before: task.done });
    return;
  }
  if (Object.keys(before).length === 0) return;
  const after: TodoUpdate = { ...patch };
  delete after.done;
  delete after.done_at;
  push({ kind: "update", id: task.id, before, after });
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
export function useTaskUndo() {
  useStackVersion();
  const updateMutation = useUpdateTask();

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
 * 특정 task id 의 flash 트리거 감지. undo/redo 시 영향받은 카드 잠시 깜빡임 cue.
 * 카드 mount/unmount 와 무관하게 listener 패턴.
 */
export function useTaskFlash(todoId: string): boolean {
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

export function useTaskUndoShortcut(opts: { active: boolean }) {
  const { undo, redo } = useTaskUndo();
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
