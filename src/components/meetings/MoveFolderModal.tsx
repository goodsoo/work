import { useEffect, useMemo, useRef, useState } from "react";
import { Folder, FolderRoot, Plus, X } from "lucide-react";
import {
  buildMeetingsTree,
  flattenFolderPaths,
} from "../../lib/meetingsTree";
import { useMeetingFolders, useMeetings } from "../../hooks/useMeetings";
import { meetingFolder } from "../../api/meetings";

type Props = {
  open: boolean;
  meetingId: string | null; // 현재 메모의 file path. null 이면 모달 자체가 비활성.
  meetingTitle: string;
  onClose: () => void;
  onMove: (folder: string) => Promise<void>;
};

// 메모 폴더 이동 picker. 기존 폴더 list (root 포함) + 새 폴더 만들기 input.
// 빌더 모드 단순화 — 깊이/계층 미리보기보다 path 그대로 보여줌 ("work/2026").
export function MoveFolderModal({
  open,
  meetingId,
  meetingTitle,
  onClose,
  onMove,
}: Props) {
  const { data: meetings } = useMeetings();
  const { data: emptyFolders } = useMeetingFolders();
  const currentFolder = meetingId ? meetingFolder(meetingId) : "";
  const [newFolderInput, setNewFolderInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 기존 폴더 list — 트리 평면화. 빈 폴더 (메모 0개) 도 picker 에 노출.
  const folders = useMemo(() => {
    const tree = buildMeetingsTree(meetings ?? [], undefined, emptyFolders ?? []);
    return flattenFolderPaths(tree);
  }, [meetings, emptyFolders]);

  useEffect(() => {
    if (!open) {
      setNewFolderInput("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !meetingId) return null;

  async function commitMove(target: string) {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await onMove(target);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setSubmitting(false);
    }
  }

  async function handleCreateAndMove() {
    const trimmed = newFolderInput.trim();
    if (trimmed === "") {
      setError("폴더 이름을 입력하세요");
      return;
    }
    await commitMove(trimmed);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg shadow-xl"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="min-w-0">
            <div
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              폴더로 이동
            </div>
            <div
              className="mt-0.5 truncate text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {meetingTitle || "(제목 없음)"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-7 w-7 items-center justify-center rounded-md transition"
            style={{ color: "var(--text-muted)", minHeight: 0 }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[40vh] overflow-y-auto px-2 py-2">
          {folders.map((f) => {
            const isCurrent = f === currentFolder;
            return (
              <button
                key={f || "__root__"}
                type="button"
                onClick={() => void commitMove(f)}
                disabled={isCurrent || submitting}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition disabled:opacity-50"
                style={{
                  color: "var(--text-primary)",
                  backgroundColor: isCurrent
                    ? "var(--bg-surface-active)"
                    : undefined,
                  minHeight: 0,
                }}
              >
                {f === "" ? (
                  <FolderRoot
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: "var(--text-muted)" }}
                  />
                ) : (
                  <Folder
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: "var(--text-muted)" }}
                  />
                )}
                <span className="truncate">
                  {f === "" ? "최상위" : f}
                </span>
                {isCurrent ? (
                  <span
                    className="ml-auto text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    현재
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div
          className="space-y-2 px-3 py-3"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <div className="flex items-center gap-2">
            <Plus
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              ref={inputRef}
              type="text"
              value={newFolderInput}
              onChange={(e) => setNewFolderInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleCreateAndMove();
                }
              }}
              placeholder="새 폴더 이름 (예: work 또는 work/2026)"
              disabled={submitting}
              className="flex-1 rounded-md px-2 py-1.5 text-sm outline-none"
              style={{
                backgroundColor: "var(--bg-base)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            />
            <button
              type="button"
              onClick={() => void handleCreateAndMove()}
              disabled={submitting || newFolderInput.trim() === ""}
              className="rounded-md px-3 py-1.5 text-xs font-medium transition disabled:opacity-50"
              style={{
                backgroundColor: "var(--btn-primary)",
                color: "var(--btn-primary-text)",
                minHeight: 0,
              }}
            >
              이동
            </button>
          </div>
          {error ? (
            <div
              className="rounded px-2 py-1 text-xs"
              style={{
                borderLeft: "2px solid var(--accent-red)",
                backgroundColor: "var(--accent-red-bg)",
                color: "var(--accent-red-text)",
              }}
            >
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
