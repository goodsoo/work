import { useEffect, useState } from "react";
import { RotateCcw, Trash2, X } from "lucide-react";
import {
  useDeletedMeetings,
  useEmptyTrash,
  useRestoreMeeting,
  usePurgeMeeting,
} from "../../hooks/useMeetings";
import type { Meeting } from "../../api/meetings";
import { formatDateTimeKo } from "../../lib/dates";
import { formatError } from "../../lib/errors";
import { ConfirmDialog } from "../ConfirmDialog";
import { TrashPreview } from "./TrashPreview";

// 휴지통 파일명 stamp prefix (`YYYY-MM-DDTHH-MM-SS-`) 는 디스크 표현이지 표시명이
// 아니다. 표시 직전에 잘라낸다. scanTrash / listDeletedMeetings / restoreFromTrash 는
// 그대로 stamp 사용.
function stripTrashStamp(title: string | null | undefined): string {
  return (title ?? "").replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-/, "");
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onMeetingPurged?: (id: string) => void;
};

export function TrashModal({ isOpen, onClose, onMeetingPurged }: Props) {
  const { data, isLoading } = useDeletedMeetings();
  const restore = useRestoreMeeting();
  const purge = usePurgeMeeting();
  const empty = useEmptyTrash();
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<Meeting | null>(null);
  const [emptyConfirm, setEmptyConfirm] = useState(false);

  const confirmOpen = purgeTarget !== null || emptyConfirm;

  // ESC 닫기 — confirm 열려있을 땐 ConfirmDialog 가 ESC 처리
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !confirmOpen) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, confirmOpen]);

  // 모달 닫힐 때 state 리셋
  useEffect(() => {
    if (!isOpen) {
      setSelectedId(null);
      setError(null);
      setPurgeTarget(null);
      setEmptyConfirm(false);
    }
  }, [isOpen]);

  // 첫 항목 auto-select + invalid selection fallback
  useEffect(() => {
    if (!isOpen || !data) return;
    if (data.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    const inList = selectedId && data.some((m) => m.id === selectedId);
    if (!inList) setSelectedId(data[0].id);
  }, [isOpen, data, selectedId]);

  async function handleRestore(id: string) {
    setError(null);
    try {
      await restore.mutateAsync(id);
    } catch (e) {
      setError(formatError(e));
    }
  }

  function handlePurge(meeting: Meeting) {
    setError(null);
    setPurgeTarget(meeting);
  }

  async function confirmPurge() {
    if (!purgeTarget) return;
    const id = purgeTarget.id;
    try {
      await purge.mutateAsync(id);
      onMeetingPurged?.(id);
      setPurgeTarget(null);
    } catch (e) {
      setError(formatError(e));
      setPurgeTarget(null);
    }
  }

  async function confirmEmpty() {
    try {
      await empty.mutateAsync();
      setEmptyConfirm(false);
    } catch (e) {
      setError(formatError(e));
      setEmptyConfirm(false);
    }
  }

  if (!isOpen) return null;

  const selected = selectedId
    ? data?.find((m) => m.id === selectedId) ?? null
    : null;
  const selectedBusy = selected
    ? (restore.isPending && restore.variables === selected.id) ||
      (purge.isPending && purge.variables === selected.id)
    : false;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      role="dialog"
      aria-modal="true"
      aria-label="휴지통"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-5xl overflow-hidden rounded-xl"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          height: "min(640px, 85vh)",
        }}
      >
        {/* Left list */}
        <aside
          className="flex w-72 shrink-0 flex-col"
          style={{
            background: "var(--bg-base)",
            borderRight: "1px solid var(--border-default)",
          }}
        >
          <div
            className="flex h-12 shrink-0 items-center gap-2 px-4 text-sm font-semibold"
            style={{
              color: "var(--text-primary)",
              borderBottom: "1px solid var(--border-default)",
            }}
          >
            <Trash2 className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
            휴지통
            {data && data.length > 0 ? (
              <>
                <span
                  className="ml-auto text-xs font-normal"
                  style={{ color: "var(--text-muted)" }}
                >
                  {data.length}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setEmptyConfirm(true);
                  }}
                  disabled={empty.isPending}
                  title="휴지통 비우기"
                  className="rounded-md px-2 py-1 text-xs font-normal transition disabled:opacity-40"
                  style={{
                    color: "var(--accent-red)",
                    border: "1px solid var(--border-default)",
                    minHeight: 0,
                  }}
                >
                  비우기
                </button>
              </>
            ) : null}
          </div>

          {error ? (
            <div
              className="mx-3 mt-2 rounded px-2 py-1 text-xs"
              style={{
                borderLeft: "2px solid var(--accent-red)",
                backgroundColor: "var(--accent-red-bg)",
                color: "var(--accent-red-text)",
              }}
            >
              {error}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-md"
                    style={{ backgroundColor: "var(--bg-surface)" }}
                  />
                ))}
              </div>
            ) : !data || data.length === 0 ? (
              <div
                className="px-4 py-8 text-center text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                휴지통이 비어 있어요
              </div>
            ) : (
              <ul className="p-2">
                {data.map((m) => (
                  <DeletedMeetingItem
                    key={m.id}
                    meeting={m}
                    selected={m.id === selectedId}
                    onSelect={() => setSelectedId(m.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Right preview */}
        <section className="flex min-w-0 flex-1 flex-col">
          <header
            className="flex h-12 shrink-0 items-center justify-between gap-2 px-5"
            style={{ borderBottom: "1px solid var(--border-default)" }}
          >
            <h2
              className="truncate text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {selected
                ? stripTrashStamp(selected.title).trim() || "(제목 없음)"
                : "휴지통"}
            </h2>
            <div className="flex shrink-0 items-center gap-1">
              {selected ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleRestore(selected.id)}
                    disabled={selectedBusy}
                    title="복원"
                    aria-label="복원"
                    className="flex h-7 items-center gap-1 rounded-md px-2 text-xs transition disabled:opacity-40"
                    style={{
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-default)",
                      minHeight: 0,
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    복원
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePurge(selected)}
                    disabled={selectedBusy}
                    title="영구 삭제"
                    aria-label="영구 삭제"
                    className="flex h-7 items-center gap-1 rounded-md px-2 text-xs transition disabled:opacity-40"
                    style={{
                      color: "var(--accent-red)",
                      border: "1px solid var(--border-default)",
                      minHeight: 0,
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    영구 삭제
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                aria-label="닫기"
                title="닫기  ESC"
                className="flex h-7 w-7 items-center justify-center rounded-md transition"
                style={{ color: "var(--text-muted)" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-hidden">
            <TrashPreview selectedId={selectedId} />
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={purgeTarget !== null}
        danger
        title="영구 삭제"
        message={
          purgeTarget
            ? `"${stripTrashStamp(purgeTarget.title).trim() || "(제목 없음)"}" 을(를) 영구 삭제할까요? 되돌릴 수 없어요.`
            : ""
        }
        confirmLabel="영구 삭제"
        busy={purge.isPending}
        onConfirm={confirmPurge}
        onCancel={() => setPurgeTarget(null)}
      />
      <ConfirmDialog
        open={emptyConfirm}
        danger
        title="휴지통 비우기"
        message={`휴지통의 ${data?.length ?? 0}개 항목을 모두 영구 삭제할까요? 되돌릴 수 없어요.`}
        confirmLabel="비우기"
        busy={empty.isPending}
        onConfirm={confirmEmpty}
        onCancel={() => setEmptyConfirm(false)}
      />
    </div>
  );
}

function DeletedMeetingItem({
  meeting,
  selected,
  onSelect,
}: {
  meeting: Meeting;
  selected: boolean;
  onSelect: () => void;
}) {
  const displayTitle = stripTrashStamp(meeting.title).trim() || "(제목 없음)";
  return (
    <li className="list-none">
      <button
        type="button"
        onClick={onSelect}
        className="w-full rounded-md px-3 py-2 text-left transition"
        style={{
          backgroundColor: selected ? "var(--bg-surface-active)" : undefined,
          color: selected ? "var(--text-primary)" : "var(--text-secondary)",
          minHeight: 0,
        }}
      >
        <div
          className="truncate text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {displayTitle}
        </div>
        <div
          className="mt-0.5 truncate text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {meeting.deleted_at
            ? `${formatDateTimeKo(meeting.deleted_at)} 삭제`
            : ""}
        </div>
      </button>
    </li>
  );
}
