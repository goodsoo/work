import {
  Plus,
  ClipboardList,
  BookOpen,
  HelpCircle,
  X,
  Trash2,
  ArrowUpDown,
  Check,
  Pencil,
  Circle,
  XCircle,
  FolderInput,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  Star,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  useMeetings,
  useMeetingFolders,
  useCreateMeeting,
  useCreateMeetingFolder,
  useDeleteMeetingFolder,
  useMoveMeeting,
  useRenameMeetingFolder,
  useTogglePinMeeting,
} from "../../hooks/useMeetings";
import { meetingFolder } from "../../api/meetings";
import { useMeetingSort, type MeetingSortKey } from "../../hooks/useMeetingSort";
import { type TodoSortKey } from "../../hooks/useTodoSort";
import { useJournals } from "../../hooks/useJournals";
import { useTodos, useUpdateTodo } from "../../hooks/useTodos";
import type { Meeting } from "../../api/meetings";
import type { Todo, TodoCategory } from "../../api/todos";
import { TODO_CATEGORIES } from "../../api/todos";
import { formatDateLong, isToday, todayIso } from "../../lib/dates";
import { formatError } from "../../lib/errors";
import { categoryColor } from "../../lib/todoCategory";
import { TaskAddModal } from "../tasks/TaskAddModal";
import { CheckboxButton } from "../todos/CheckboxButton";
import { JournalOverlay } from "../calendar/JournalOverlay";
import { MeetingsTreeView } from "../meetings/MeetingsTreeView";
import { MoveFolderModal } from "../meetings/MoveFolderModal";
import { Button } from "../common/Button";
import { Text } from "../common/Text";
import { Popover } from "../common/Popover";
import { useToast } from "../Toast";

/* ── Meetings Side Panel ── */

type MeetingsPanelProps = {
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function MeetingsSidePanel({
  selectedId,
  onSelect,
}: MeetingsPanelProps) {
  const { data, isLoading } = useMeetings();
  const { data: folders } = useMeetingFolders();
  const createMutation = useCreateMeeting();
  const createFolderMutation = useCreateMeetingFolder();
  const deleteFolderMutation = useDeleteMeetingFolder();
  const renameFolderMutation = useRenameMeetingFolder();
  const moveMutation = useMoveMeeting();
  const togglePinMutation = useTogglePinMeeting();
  const toast = useToast();
  const [sortKey, setSortKey] = useMeetingSort();
  const [contextMenu, setContextMenu] = useState<{
    meetingId: string;
    x: number;
    y: number;
  } | null>(null);
  const [folderContextMenu, setFolderContextMenu] = useState<{
    folder: string;
    x: number;
    y: number;
  } | null>(null);
  const [moveModalFor, setMoveModalFor] = useState<string | null>(null);
  // 폴더 행 in-place 편집 — 옵시디안 패턴. 새 폴더 만든 직후 자동 진입 / 우클릭
  // "이름 변경" 으로도 진입. value 가 비면 commit 시 cancel 로 처리.
  const [editingFolder, setEditingFolder] = useState<
    { folder: string; value: string } | null
  >(null);

  // 메모 정렬 — 폴더 안에서만 적용. 폴더 위계는 alphabetic 고정 (정렬 popover 무관).
  // 키 우선순위: date → time → mtime. date 없는 메모는 같은 그룹 안 맨 아래.
  const sortComparator = useMemo(() => {
    return (a: Meeting, b: Meeting): number => {
      if (sortKey === "name") {
        const ta = (a.title ?? "").trim();
        const tb = (b.title ?? "").trim();
        if (!ta && !tb) return b.mtime - a.mtime;
        if (!ta) return 1;
        if (!tb) return -1;
        return ta.localeCompare(tb, "ko");
      }
      const asc = sortKey === "date_asc";
      const da = a.date ?? "";
      const db = b.date ?? "";
      if (da !== db) {
        if (!da) return 1;
        if (!db) return -1;
        return asc ? da.localeCompare(db) : db.localeCompare(da);
      }
      const ta = a.time ?? "";
      const tb = b.time ?? "";
      if (ta !== tb) {
        if (!ta) return 1;
        if (!tb) return -1;
        return asc ? ta.localeCompare(tb) : tb.localeCompare(ta);
      }
      return asc ? a.mtime - b.mtime : b.mtime - a.mtime;
    };
  }, [sortKey]);

  // 컨텍스트 메뉴 닫기 — 바깥 클릭 / ESC / scroll. 메모 + 폴더 컨텍스트 메뉴 공통.
  useEffect(() => {
    if (!contextMenu && !folderContextMenu) return;
    function close() {
      setContextMenu(null);
      setFolderContextMenu(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    // mousedown 으로 (클릭 시작 시점에 즉시 닫음 — child 메뉴 항목의 click 도
    // 자기 onClick 안에서 닫기 trigger 함)
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [contextMenu, folderContextMenu]);

  async function handleCreate() {
    try {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const created = await createMutation.mutateAsync({
        title: null,
        date: `${y}-${m}-${d}`,
        time: null,
        attendees: null,
        content: "",
        discussion_items: null,
        decisions: null,
        action_items: null,
      });
      onSelect(created.uid);
    } catch (e) {
      toast.show(formatError(e));
    }
  }

  // 옵시디안 패턴: "+폴더" 클릭 → "새 폴더" default 이름으로 즉시 생성 → 그 폴더
  // 행에 인라인 rename 자동 진입. 이미 "새 폴더" 가 있으면 "새 폴더 2" 식으로 N
  // 증가. 빠른 생성 + 즉시 이름 입력 = 한 단계 흐름.
  async function handleCreateFolder() {
    const base = "새 폴더";
    const existing = new Set(
      (folders ?? []).map((f) => f.replace(/^meetings\//, "")),
    );
    let candidate = base;
    let n = 2;
    while (existing.has(candidate)) {
      candidate = `${base} ${n}`;
      n++;
    }
    try {
      const full = await createFolderMutation.mutateAsync(candidate);
      const folderRel = full.replace(/^meetings\//, "");
      // 즉시 rename mode 로. 입력은 폴더 행 안 input (MeetingsTreeView 가 렌더).
      setEditingFolder({ folder: folderRel, value: folderRel });
    } catch (e) {
      toast.show(formatError(e));
    }
  }

  function handleContextMenu(meetingId: string, x: number, y: number) {
    setContextMenu({ meetingId, x, y });
  }

  function handleFolderContextMenu(folder: string, x: number, y: number) {
    setFolderContextMenu({ folder, x, y });
  }

  // 폴더 안 메모 카운트 — useMeetings list 에서 derive. sub-folder 도 포함.
  function countInFolder(folder: string): number {
    if (!data) return 0;
    return data.filter((m) => {
      const f = meetingFolder(m.id);
      return f === folder || f.startsWith(folder + "/");
    }).length;
  }

  function openRenameInput(folder: string) {
    const lastSeg = folder.split("/").pop() ?? folder;
    setEditingFolder({ folder, value: lastSeg });
  }

  async function commitEditingFolder() {
    if (!editingFolder) return;
    const { folder, value } = editingFolder;
    const lastSeg = folder.split("/").pop() ?? folder;
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === lastSeg) {
      setEditingFolder(null);
      return;
    }
    try {
      await renameFolderMutation.mutateAsync({ folder, newName: trimmed });
      setEditingFolder(null);
    } catch (e) {
      // 실패 시 input 닫고 원래 이름 복원 — server data 가 list 새로고침 시 그대로.
      // 에러는 우측하단 toast 로.
      setEditingFolder(null);
      toast.show(formatError(e));
    }
  }

  async function handleDeleteFolder(folder: string) {
    const n = countInFolder(folder);
    const msg =
      n === 0
        ? `폴더 '${folder}' 를 삭제할까요?`
        : `폴더 '${folder}' 와 안에 있는 메모 ${n}개를 휴지통으로 옮길까요?`;
    if (!window.confirm(msg)) return;
    try {
      await deleteFolderMutation.mutateAsync(folder);
    } catch (e) {
      toast.show(formatError(e));
    }
  }

  // DnD drop 직접 처리 (모달 안 거치고). 충돌 시 toast.
  async function handleMoveDrop(uid: string, folder: string) {
    try {
      await moveMutation.mutateAsync({ uid, folder });
    } catch (e) {
      toast.show(formatError(e));
    }
  }

  // pinned 토글 — 컨텍스트 메뉴 / 별 아이콘 hover 클릭. uid 기반 (path rename 무관).
  async function handleTogglePin(uid: string, nextPinned: boolean) {
    try {
      await togglePinMutation.mutateAsync({ uid, pinned: nextPinned });
    } catch (e) {
      toast.show(formatError(e));
    }
  }

  // 모달 경유 이동 — modal 안에서 commit 결과 throw 받아서 모달에 toast.
  async function handleMoveFromModal(folder: string) {
    if (!moveModalFor) return;
    const m = (data ?? []).find((x) => x.id === moveModalFor);
    if (!m) throw new Error("메모를 찾을 수 없습니다");
    await moveMutation.mutateAsync({ uid: m.uid, folder });
  }

  const moveModalMeeting = useMemo(() => {
    if (!moveModalFor || !data) return null;
    return data.find((m) => m.id === moveModalFor) ?? null;
  }, [moveModalFor, data]);

  // 컨텍스트 메뉴가 가리키는 메모 — pinned 라벨/icon 결정용 ("고정" vs "고정 해제").
  const contextMeeting = useMemo(() => {
    if (!contextMenu || !data) return null;
    return data.find((m) => m.id === contextMenu.meetingId) ?? null;
  }, [contextMenu, data]);

  // pinned 메모는 트리에서 제외 (옵시디안 bookmarks 패턴) — 같은 메모가 두 곳에 보이지 않음.
  // 정렬은 일반 트리와 동일 comparator 적용 — 사용자가 이름순 바꾸면 pinned 도 따라감.
  const { pinnedMeetings, unpinnedMeetings } = useMemo(() => {
    const all = data ?? [];
    const pinned = all.filter((m) => m.pinned).sort(sortComparator);
    const unpinned = all.filter((m) => !m.pinned);
    return { pinnedMeetings: pinned, unpinnedMeetings: unpinned };
  }, [data, sortComparator]);

  return (
    <div className="relative flex h-full flex-col">
      <div
        className="flex shrink-0 items-center justify-between px-4"
        style={{
          height: "var(--page-header-h)",
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        <h2
          className="font-serif text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          메모장
        </h2>
        <div className="flex items-center gap-0.5">
          <SortMenu value={sortKey} onChange={setSortKey} />
          <Button
            variant="icon"
            onClick={() => void handleCreateFolder()}
            disabled={createFolderMutation.isPending}
            title="새 폴더"
            className="disabled:opacity-50"
            style={{ color: "var(--text-secondary)" }}
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button
            variant="icon"
            onClick={handleCreate}
            disabled={createMutation.isPending}
            title="새 메모장"
            className="disabled:opacity-50"
            style={{ color: "var(--text-secondary)" }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

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
        ) : (!data || data.length === 0) && (!folders || folders.length === 0) ? (
          <Text
            variant="body"
            color="muted"
            as="div"
            className="px-4 py-8 text-center"
          >
            아직 메모장이 없어요
          </Text>
        ) : (
          <>
            {pinnedMeetings.length > 0 ? (
              <PinnedSection
                meetings={pinnedMeetings}
                selectedUid={selectedId}
                onSelect={onSelect}
                onContextMenu={handleContextMenu}
                onUnpin={(uid) => void handleTogglePin(uid, false)}
              />
            ) : null}
            <MeetingsTreeView
              meetings={unpinnedMeetings}
              extraFolders={folders ?? []}
              selectedUid={selectedId}
              sortMeetings={sortComparator}
              editingFolder={editingFolder}
              editingFolderPending={renameFolderMutation.isPending}
              onEditingFolderChange={(v) =>
                setEditingFolder((prev) => (prev ? { ...prev, value: v } : prev))
              }
              onEditingFolderCommit={() => void commitEditingFolder()}
              onEditingFolderCancel={() => setEditingFolder(null)}
              onSelect={onSelect}
              onContextMenu={handleContextMenu}
              onFolderContextMenu={handleFolderContextMenu}
              onMoveDrop={(uid, folder) => void handleMoveDrop(uid, folder)}
            />
          </>
        )}
      </div>

      {contextMenu ? (
        <MeetingContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          pinned={contextMeeting?.pinned ?? false}
          onMove={() => {
            setMoveModalFor(contextMenu.meetingId);
            setContextMenu(null);
          }}
          onTogglePin={() => {
            const m = contextMeeting;
            setContextMenu(null);
            if (!m) return;
            void handleTogglePin(m.uid, !m.pinned);
          }}
        />
      ) : null}

      {folderContextMenu ? (
        <FolderContextMenu
          x={folderContextMenu.x}
          y={folderContextMenu.y}
          folder={folderContextMenu.folder}
          onRename={() => {
            const f = folderContextMenu.folder;
            setFolderContextMenu(null);
            openRenameInput(f);
          }}
          onDelete={() => {
            const f = folderContextMenu.folder;
            setFolderContextMenu(null);
            void handleDeleteFolder(f);
          }}
        />
      ) : null}

      <MoveFolderModal
        open={moveModalFor !== null}
        meetingId={moveModalFor}
        meetingTitle={moveModalMeeting?.title ?? ""}
        onClose={() => setMoveModalFor(null)}
        onMove={handleMoveFromModal}
      />
    </div>
  );
}

// 사이드바 상단 즐겨찾기 그룹 — MeetingsTreeView 와 별도. 폴더/drag 없는 flat 리스트.
// 옵시디안 bookmarks 패턴: 같은 메모가 트리에도 보이지 않음 (mutual exclusive).
// 행 hover 시 우측에 채워진 별 아이콘 (클릭 = 고정 해제). 정렬은 사이드바 sortKey 적용.
function PinnedSection({
  meetings,
  selectedUid,
  onSelect,
  onContextMenu,
  onUnpin,
}: {
  meetings: Meeting[];
  selectedUid: string | null;
  onSelect: (uid: string) => void;
  onContextMenu: (meetingId: string, x: number, y: number) => void;
  onUnpin: (uid: string) => void;
}) {
  return (
    <div className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
      <div
        className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        고정됨
      </div>
      <ul className="p-1 pt-0">
        {meetings.map((m) => (
          <li key={m.uid} className="list-none">
            <Button
              variant="ghost"
              onClick={() => onSelect(m.uid)}
              onContextMenu={(e) => {
                e.preventDefault();
                onContextMenu(m.id, e.clientX, e.clientY);
              }}
              className="group w-full justify-start gap-1.5 rounded py-1 pr-2 text-[13px] font-normal"
              style={{
                paddingLeft: "8px",
                backgroundColor:
                  m.uid === selectedUid ? "var(--bg-surface-active)" : undefined,
                color: "var(--text-primary)",
              }}
            >
              <Star
                className="h-3 w-3 shrink-0"
                fill="var(--accent-yellow)"
                style={{ color: "var(--accent-yellow)" }}
              />
              <span className="min-w-0 flex-1 truncate text-left">
                {m.title?.trim() || "(제목 없음)"}
              </span>
              {/* hover 시 우측에 unpin 버튼 (X 처럼 — 별 위에 사선 대신 단순 X 가
                  명확). nested button 회피 위해 span + onMouseDown 처리. */}
              <span
                role="button"
                aria-label="고정 해제"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onUnpin(m.uid);
                }}
                className="hidden h-4 w-4 shrink-0 items-center justify-center rounded group-hover:inline-flex"
                style={{ color: "var(--text-muted)" }}
              >
                <X className="h-3 w-3" />
              </span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// 폴더 우클릭 컨텍스트 메뉴 — 이름 변경 + 삭제.
function FolderContextMenu({
  x,
  y,
  folder,
  onRename,
  onDelete,
}: {
  x: number;
  y: number;
  folder: string;
  onRename: () => void;
  onDelete: () => void;
}) {
  const MENU_W = 200;
  const MENU_H = 88;
  const left = Math.min(x, window.innerWidth - MENU_W - 8);
  const top = Math.min(y, window.innerHeight - MENU_H - 8);
  return (
    <div
      className="fixed z-50 overflow-hidden rounded-md shadow-lg"
      style={{
        left,
        top,
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        minWidth: MENU_W,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Text
        variant="caption"
        color="muted"
        as="div"
        className="truncate px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider"
      >
        {folder}
      </Text>
      <Button
        variant="ghost"
        onClick={onRename}
        className="w-full justify-start gap-2 rounded-none px-3 py-2"
        leftIcon={
          <Pencil
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: "var(--text-muted)" }}
          />
        }
        style={{ color: "var(--text-primary)" }}
      >
        이름 변경...
      </Button>
      <Button
        variant="ghost"
        onClick={onDelete}
        className="w-full justify-start gap-2 rounded-none px-3 py-2"
        leftIcon={<Trash2 className="h-3.5 w-3.5 shrink-0" />}
        style={{ color: "var(--accent-red)" }}
      >
        폴더 삭제...
      </Button>
    </div>
  );
}

// 메모 우클릭 컨텍스트 메뉴. '고정/해제' + '폴더로 이동'. 추후 항목 추가 시
// 같은 패턴으로 button list 만 늘리면 됨.
function MeetingContextMenu({
  x,
  y,
  pinned,
  onMove,
  onTogglePin,
}: {
  x: number;
  y: number;
  pinned: boolean;
  onMove: () => void;
  onTogglePin: () => void;
}) {
  // 우측/하단 viewport 초과 방지 — 간단히 좌표만 clamp (메뉴 크기 추정).
  const MENU_W = 180;
  const MENU_H = 80;
  const left = Math.min(x, window.innerWidth - MENU_W - 8);
  const top = Math.min(y, window.innerHeight - MENU_H - 8);
  return (
    <div
      className="fixed z-50 overflow-hidden rounded-md shadow-lg"
      style={{
        left,
        top,
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        minWidth: MENU_W,
      }}
      // mousedown 으로 메뉴 자체 클릭이 outside-close trigger 되지 않도록 막음
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        onClick={onTogglePin}
        className="w-full justify-start gap-2 rounded-none px-3 py-2"
        leftIcon={
          <Star
            className="h-3.5 w-3.5 shrink-0"
            // 고정 상태면 채워진 별 — 의미 신호. 해제 액션 시각 단서.
            fill={pinned ? "var(--accent-yellow)" : "none"}
            style={{ color: pinned ? "var(--accent-yellow)" : "var(--text-muted)" }}
          />
        }
        style={{ color: "var(--text-primary)" }}
      >
        {pinned ? "고정 해제" : "고정"}
      </Button>
      <Button
        variant="ghost"
        onClick={onMove}
        className="w-full justify-start gap-2 rounded-none px-3 py-2"
        leftIcon={
          <FolderInput
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: "var(--text-muted)" }}
          />
        }
        style={{ color: "var(--text-primary)" }}
      >
        폴더로 이동...
      </Button>
    </div>
  );
}

// AppShell.sidePanelFooter slot 으로 주입. 메모장 탭의 list 모드일 때만 보임.
export function MeetingsSidePanelFooter({
  onTrashOpen,
}: {
  onTrashOpen: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <MarkdownHelp />
      <Button
        variant="icon"
        onClick={onTrashOpen}
        title="휴지통"
        aria-label="휴지통"
        style={{ color: "var(--text-muted)" }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// portfolio 탭에서만 보임. 메모장과 별개 도메인 휴지통 (portfolio/.trash/).
export function PortfolioSidePanelFooter({
  onTrashOpen,
}: {
  onTrashOpen: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="icon"
        onClick={onTrashOpen}
        title="포트폴리오 휴지통"
        aria-label="포트폴리오 휴지통"
        style={{ color: "var(--text-muted)" }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function MarkdownHelp() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="icon"
        onClick={() => setOpen(true)}
        title="마크다운 도움말"
        aria-label="마크다운 도움말"
        style={{ color: "var(--text-muted)" }}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </Button>
      {open ? (
        <div
          className="absolute inset-0 z-30 flex flex-col overflow-y-auto"
          style={{ backgroundColor: "var(--bg-surface)" }}
        >
          <div className="flex items-center justify-between px-4" style={{ height: "var(--page-header-h)", borderBottom: "1px solid var(--border-default)" }}>
            <Text variant="body" weight="semibold" as="span">
              마크다운 문법
            </Text>
            <Button
              variant="icon"
              onClick={() => setOpen(false)}
              style={{ color: "var(--text-muted)" }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1.5 px-4 py-4 text-sm" style={{ color: "var(--text-primary)" }}>
            {MARKDOWN_HINTS.map((h, i) => (
              <div key={i}>
                {h.section ? (
                  <div
                    className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wider first:mt-0"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {h.section}
                  </div>
                ) : null}
                <div className="flex items-baseline gap-2">
                  <code
                    className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px]"
                    style={{ backgroundColor: "var(--bg-surface-active)", color: "var(--text-secondary)" }}
                  >
                    {h.syntax}
                  </code>
                  <Text variant="caption" color="muted" as="span">{h.desc}</Text>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

const SORT_OPTIONS: Array<{ id: MeetingSortKey; label: string }> = [
  { id: "date_desc", label: "최신순" },
  { id: "date_asc", label: "오래된순" },
  { id: "name", label: "이름순" },
];

function SortMenu({
  value,
  onChange,
}: {
  value: MeetingSortKey;
  onChange: (next: MeetingSortKey) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      className="relative"
      panelClassName="absolute right-0 top-full z-30 mt-1 min-w-[120px] overflow-hidden rounded-md shadow-md"
      panelStyle={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
      }}
      trigger={
        <Button
          variant="icon"
          onClick={() => setOpen((v) => !v)}
          title="정렬"
          aria-label="정렬"
          aria-haspopup="menu"
          aria-expanded={open}
          style={{
            color: "var(--text-secondary)",
            backgroundColor: open ? "var(--bg-surface-active)" : undefined,
          }}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
        </Button>
      }
    >
      <div role="menu">
        {SORT_OPTIONS.map((opt) => {
          const active = opt.id === value;
          return (
            <Button
              key={opt.id}
              variant="ghost"
              size="sm"
              role="menuitemradio"
              aria-checked={active}
              onClick={() => {
                onChange(opt.id);
                setOpen(false);
              }}
              className="w-full justify-between rounded-none px-3 py-1.5"
              style={{
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                backgroundColor: active ? "var(--bg-surface-active)" : undefined,
              }}
            >
              <span>{opt.label}</span>
              {active ? (
                <Check className="h-3 w-3" style={{ color: "var(--text-secondary)" }} />
              ) : null}
            </Button>
          );
        })}
      </div>
    </Popover>
  );
}

const MARKDOWN_HINTS: Array<{ syntax: string; desc: string; section?: string }> = [
  { section: "제목", syntax: "# 제목", desc: "H1 (대제목)" },
  { syntax: "## 소제목", desc: "H2" },
  { syntax: "### 소소제목", desc: "H3" },
  { syntax: "#### 제목 4", desc: "H4" },
  { syntax: "##### 제목 5", desc: "H5" },
  { syntax: "###### 제목 6", desc: "H6" },
  { syntax: "===", desc: "윗줄을 H1으로 (밑줄식)" },
  { syntax: "---", desc: "윗줄을 H2로 (밑줄식, 윗줄에 텍스트 있을 때)" },

  { section: "서식 (인라인)", syntax: "**굵게**", desc: "굵은 글씨" },
  { syntax: "*기울임*", desc: "기울인 글씨" },
  { syntax: "~~취소선~~", desc: "취소선" },
  { syntax: "`코드`", desc: "인라인 코드" },

  { section: "목록", syntax: "- 항목", desc: "글머리 목록" },
  { syntax: "1. 항목", desc: "번호 목록" },
  { syntax: "- [ ] 할 일", desc: "체크박스" },
  { syntax: "- [x] 완료", desc: "완료 체크박스" },
  { syntax: "␣␣- 항목", desc: "중첩 목록 (2칸 들여쓰기 = 1단계)" },
  { syntax: "␣␣␣␣- 항목", desc: "중첩 목록 (4칸 = 2단계)" },

  { section: "블록", syntax: "> 인용문", desc: "인용 블록 (여러 줄은 줄마다 >)" },
  { syntax: "```\n코드\n```", desc: "코드 블록 (펜스)" },
  { syntax: "␣␣␣␣코드", desc: "코드 블록 (4칸 들여쓰기, list 밖에서)" },
  { syntax: "---", desc: "구분선 (앞뒤로 빈 줄, 단독)" },

  { section: "줄바꿈", syntax: "줄 끝␣␣", desc: "강제 줄바꿈 (줄 끝 공백 2개)" },

  { section: "링크/이미지", syntax: "[텍스트](URL)", desc: "링크" },
  { syntax: "![설명](URL)", desc: "이미지" },
  { syntax: "<URL>", desc: "자동 링크" },
  { syntax: "[label]: URL", desc: "참조 링크 정의 (별도 줄)" },
  { syntax: "[텍스트][label]", desc: "참조 링크 사용" },

  { section: "표", syntax: "| A | B |", desc: "표 (GFM)" },
  { syntax: "|---|---|", desc: "표 헤더 구분선" },
  { syntax: "|:---|---:|", desc: "정렬 (왼쪽/오른쪽)" },
];

/* ── Calendar Day Detail Panel ── */

type CalendarDayPanelProps = {
  selectedDate: string;
  onOpenMeeting: (id: string) => void;
  onOpenTodo: (id: string) => void;
};

function timestampToLocalIso(ts: string): string {
  return todayIso(new Date(ts));
}

export function CalendarDayPanel({
  selectedDate,
  onOpenMeeting,
  onOpenTodo,
}: CalendarDayPanelProps) {
  const meetingsQ = useMeetings();
  const journalsQ = useJournals();
  const todosQ = useTodos();
  const updateTodo = useUpdateTodo();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showJournalOverlay, setShowJournalOverlay] = useState(false);
  // 3개 섹션 collapse — 메모장 폴더 패턴 차용. 새로고침 시 모두 펴짐 (session 단위).
  const [collapsed, setCollapsed] = useState<Set<"journal" | "todos" | "meetings">>(
    () => new Set(),
  );
  function toggleSection(name: "journal" | "todos" | "meetings") {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const today = isToday(selectedDate);

  const { meetings, todos, journal } = useMemo(() => {
    const meetings = (meetingsQ.data ?? []).filter(
      (m) => m.date === selectedDate,
    );
    const journals = (journalsQ.data ?? []).filter(
      (j) => j.date === selectedDate,
    );
    const todos = (todosQ.data ?? []).filter((t) => {
      if (t.done) {
        const d = t.done_at
          ? timestampToLocalIso(t.done_at)
          : t.due_date;
        return d === selectedDate;
      }
      return t.due_date === selectedDate;
    });

    meetings.sort((a, b) => {
      const ta = a.time ?? "";
      const tb = b.time ?? "";
      if (ta !== tb) return ta < tb ? -1 : 1;
      return a.created_at < b.created_at ? -1 : 1;
    });
    // 시간 없는 todo 가 앞 (할일 탭과 동일 — "정해진 시각 없는 작업 먼저"),
    // 시간 있는 것은 시간순 뒤로.
    todos.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const ta = a.due_time ?? "";
      const tb = b.due_time ?? "";
      if (ta !== tb) {
        if (!ta) return -1;
        if (!tb) return 1;
        return ta < tb ? -1 : 1;
      }
      return a.created_at < b.created_at ? -1 : 1;
    });

    return {
      meetings,
      todos,
      journal: journals[0] ?? null,
    };
  }, [meetingsQ.data, journalsQ.data, todosQ.data, selectedDate]);

  function handleToggle(t: Todo) {
    // done 만 patch — vault md 에 done_at 안 저장돼 refetch 후 항상 null 로 돌아옴.
    // optimistic 시 done_at=ISO 박으면 filter 가 today 로 판정 → 미래·과거 날 사이드바에서
    // 토글 직후 잠깐 사라졌다 (invalidate 후 due_date fallback 으로) 다시 생기는 깜빡임 발생.
    updateTodo.mutate({ id: t.id, patch: { done: !t.done } });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Date header */}
      <div
        className="flex shrink-0 items-center justify-between px-4"
        style={{
          height: "var(--page-header-h)",
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        <div className="flex items-center gap-2">
          {today ? (
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: "var(--accent-red)" }}
            />
          ) : null}
          <h2
            className="font-serif text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {formatDateLong(selectedDate)}
          </h2>
        </div>
        <Button
          variant="icon"
          onClick={() => setShowAddModal(true)}
          title="할 일 추가"
          aria-label="할 일 추가"
          style={{ color: "var(--text-secondary)" }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* 3개 섹션 — 메모장 폴더 패턴 차용. chevron + 13px secondary 라벨, click 시 collapse.
          섹션 간 시각 분리는 헤더 자체로 충분 (border 없이). */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* 일기 section */}
        <SidePanelSectionHeader
          label="일기"
          collapsed={collapsed.has("journal")}
          onToggle={() => toggleSection("journal")}
        />
        {!collapsed.has("journal") ? (
          <div className="px-3 pb-2">
            {/* 메모 블럭과 동일 패턴 — leftIcon (BookOpen) + body Text. journal 있으면
                내용 미리보기(첫 줄), 없으면 "일기 쓰기" muted. */}
            <Button
              variant="ghost"
              onClick={() => setShowJournalOverlay(true)}
              className="w-full justify-start items-start gap-2 px-3 py-2"
              leftIcon={
                <BookOpen
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  style={{ color: "var(--text-muted)" }}
                />
              }
              aria-label={journal ? "일기 보기" : "일기 쓰기"}
            >
              <div className="min-w-0 flex-1">
                {journal ? (
                  <Text variant="body" as="div" truncate>
                    {(() => {
                      // 첫 non-empty 줄을 제목처럼 표시. 마크다운 ATX heading prefix
                      // (`# `, `## `, ...) 만 strip — `#안녕` 처럼 공백 없는 케이스는
                      // heading 이 아니라 일반 텍스트라 그대로 보존.
                      const first = journal.content
                        ?.split("\n")
                        .map((l) => l.trim())
                        .find((l) => l.length > 0);
                      return first?.replace(/^#+\s+/, "") || "(내용 없음)";
                    })()}
                  </Text>
                ) : (
                  <Text variant="body" color="muted" as="div">
                    일기 쓰기
                  </Text>
                )}
              </div>
            </Button>
          </div>
        ) : null}

        {/* 할 일 section */}
        <SidePanelSectionHeader
          label="할 일"
          collapsed={collapsed.has("todos")}
          onToggle={() => toggleSection("todos")}
          count={todos.length}
        />
        {!collapsed.has("todos") ? (
          <div className="space-y-1 px-3 pb-2">
            {todos.length === 0 ? (
              <Text
                variant="caption"
                color="muted"
                as="div"
                className="px-3 py-1.5"
              >
                할 일이 없어요
              </Text>
            ) : (
              todos.map((t) => {
                const status = t.cancelled
                  ? "cancelled"
                  : t.done
                    ? "done"
                    : "pending";
                return (
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenTodo(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpenTodo(t.id);
                      }
                    }}
                    className="flex cursor-pointer items-start gap-2 rounded-md px-3 py-2 transition hover:bg-[var(--bg-surface-hover)]"
                  >
                    <span className="mt-0.5">
                      <CheckboxButton
                        status={status}
                        category={t.category}
                        onClick={() => handleToggle(t)}
                      />
                    </span>
                    <Text
                      variant="body"
                      as="span"
                      className={`flex-1 ${t.done ? "line-through" : ""}`}
                      style={{
                        color: t.done
                          ? "var(--text-muted)"
                          : "var(--text-primary)",
                      }}
                    >
                      {t.due_time ? (
                        <Text variant="body" color="muted" as="span">
                          {t.due_time}{" "}
                        </Text>
                      ) : null}
                      {t.title}
                    </Text>
                  </div>
                );
              })
            )}
          </div>
        ) : null}

        {/* 메모 section */}
        <SidePanelSectionHeader
          label="메모"
          collapsed={collapsed.has("meetings")}
          onToggle={() => toggleSection("meetings")}
          count={meetings.length}
        />
        {!collapsed.has("meetings") ? (
          <div className="space-y-1 px-3 pb-2">
            {meetings.length === 0 ? (
              <Text
                variant="caption"
                color="muted"
                as="div"
                className="px-3 py-1.5"
              >
                메모가 없어요
              </Text>
            ) : (
              meetings.map((m) => (
                <Button
                  key={m.uid}
                  variant="ghost"
                  onClick={() => onOpenMeeting(m.uid)}
                  className="w-full justify-start items-start gap-2 px-3 py-2"
                  leftIcon={
                    <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                  }
                >
                  <div className="min-w-0 flex-1">
                    <Text variant="body" as="div">
                      {m.time ? (
                        <Text variant="body" color="muted" as="span">
                          {m.time}
                        </Text>
                      ) : null}{" "}
                      {m.title?.trim() || "(제목 없음)"}
                    </Text>
                    {m.attendees ? (
                      <Text
                        variant="caption"
                        color="secondary"
                        as="div"
                        truncate
                        className="mt-0.5"
                      >
                        {m.attendees}
                      </Text>
                    ) : null}
                  </div>
                </Button>
              ))
            )}
          </div>
        ) : null}
      </div>

      <TaskAddModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        prefill={{ due_date: selectedDate, category: "schedule" }}
      />
      <JournalOverlay
        open={showJournalOverlay}
        date={selectedDate}
        onClose={() => setShowJournalOverlay(false)}
      />
    </div>
  );
}

// 캘린더 day panel 의 섹션 헤더 — 메모장 폴더 패턴 (chevron + 13px secondary 라벨) 차용.
// 클릭 시 collapse. count 가 있으면 라벨 옆에 mono 숫자.
function SidePanelSectionHeader({
  label,
  collapsed,
  onToggle,
  count,
}: {
  label: string;
  collapsed: boolean;
  onToggle: () => void;
  count?: number;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onToggle}
      className="w-full justify-between gap-1.5 rounded-none px-3 py-1 text-[13px] font-normal"
      style={{ color: "var(--text-secondary)" }}
    >
      <span className="inline-flex items-center gap-1.5">
        {collapsed ? (
          <ChevronRight className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0" />
        )}
        <span>{label}</span>
      </span>
      {typeof count === "number" ? (
        <Text
          variant="caption"
          as="span"
          className="font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          {count}
        </Text>
      ) : null}
    </Button>
  );
}

/* ── Todos Side Panel — 상태 필터 + 카테고리 필터 (독립 차원, AND 결합) ── */

export type TodosStatusFilter = "all" | "pending" | "done" | "cancelled";
export type TodosCategoryFilter =
  | "all"
  | "uncategorized"
  | TodoCategory;

type TodosPanelProps = {
  statusFilter: TodosStatusFilter;
  onStatusChange: (next: TodosStatusFilter) => void;
  categoryFilter: TodosCategoryFilter;
  onCategoryChange: (next: TodosCategoryFilter) => void;
  sortKey: TodoSortKey;
  onSortKeyChange: (next: TodoSortKey) => void;
};

export function TodosSidePanel({
  statusFilter,
  onStatusChange,
  categoryFilter,
  onCategoryChange,
  sortKey,
  onSortKeyChange,
}: TodosPanelProps) {
  const { data } = useTodos();
  const todos = data ?? [];

  // 두 차원 독립. 한 차원 count 는 다른 차원과 AND 후 — 사용자가 "현재 다른
  // 차원 적용 후 이 옵션 누르면 몇 개?" 미리 보기. (예: status=done 일 때
  // 카테고리별 count 는 done 만 센 값.)
  // status: 미완료 = !done && !cancelled (actionable), 완료 = done, 취소 = cancelled.
  // cancelled 는 별도 view 로 분리 (사이드바 하단 entry). deleted 는 footer 의
  // 휴지통 modal 에서 처리 — 다른 모든 필터 (전체/미완료/완료 + 카테고리) 에서
  // 격리.
  const counts = useMemo(() => {
    function inStatus(t: Todo): boolean {
      if (t.deleted) return false; // deleted 는 절대 안 셈
      if (statusFilter === "cancelled") return t.cancelled;
      if (t.cancelled) return false;
      if (statusFilter === "all") return true;
      if (statusFilter === "pending") return !t.done;
      return t.done;
    }
    function inCategory(t: Todo): boolean {
      if (categoryFilter === "all") return true;
      if (categoryFilter === "uncategorized") return !t.category;
      return t.category === categoryFilter;
    }
    const status: Record<TodosStatusFilter, number> = {
      all: 0,
      pending: 0,
      done: 0,
      cancelled: 0,
    };
    const category: Record<string, number> = { all: 0, uncategorized: 0 };
    for (const c of TODO_CATEGORIES) category[c.id] = 0;
    for (const t of todos) {
      if (t.deleted) continue; // 휴지통 modal 에서만 보임
      if (t.cancelled) {
        status.cancelled++;
        continue;
      }
      if (inCategory(t)) {
        status.all++;
        if (t.done) status.done++;
        else status.pending++;
      }
      if (inStatus(t)) {
        category.all++;
        if (t.category) {
          category[t.category] = (category[t.category] ?? 0) + 1;
        } else {
          category.uncategorized++;
        }
      }
    }
    return { status, category };
  }, [todos, statusFilter, categoryFilter]);

  // status leading 아이콘 — 카테고리 dot 과 동일한 12px 박스 안에서 정렬.
  // "전체" 는 카테고리 "전체"와 동일하게 leading 비움 (시각 비대칭이 의미 신호).
  const statusItems: Array<{
    id: TodosStatusFilter;
    label: string;
    count: number;
    leading: ReactNode;
  }> = [
    { id: "all", label: "전체", count: counts.status.all, leading: null },
    {
      id: "pending",
      label: "미완료",
      count: counts.status.pending,
      leading: (
        <Circle
          className="h-3 w-3"
          strokeWidth={1.75}
          style={{ color: "var(--text-secondary)" }}
        />
      ),
    },
    {
      id: "done",
      label: "완료",
      count: counts.status.done,
      // CheckCircle2 (lucide) 의 내부 체크가 12px 사이즈에서 너무 작아 보여 →
      // filled 원 + Check (체크만 아이콘, strokeWidth 굵게) wrapper 로 교체.
      // 체크 path 가 원 영역을 더 많이 차지 → 작은 사이즈에서도 또렷.
      leading: (
        <span
          className="inline-flex h-3 w-3 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--text-secondary)" }}
        >
          <Check
            className="h-2 w-2"
            strokeWidth={3.5}
            style={{ color: "var(--text-inverse)" }}
          />
        </span>
      ),
    },
  ];
  const categoryItems: Array<{ id: TodosCategoryFilter; label: string; count: number }> = [
    { id: "all", label: "전체", count: counts.category.all },
    { id: "uncategorized", label: "미분류", count: counts.category.uncategorized },
    ...TODO_CATEGORIES.map((c) => ({
      id: c.id as TodosCategoryFilter,
      label: c.label,
      count: counts.category[c.id] ?? 0,
    })),
  ];

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex shrink-0 items-center justify-between px-4"
        style={{
          height: "var(--page-header-h)",
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        <h2
          className="font-serif text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          할 일
        </h2>
        <div className="flex items-center gap-0.5">
          <SortMenu value={sortKey} onChange={onSortKeyChange} />
          <Button
            variant="icon"
            onClick={() => window.dispatchEvent(new Event("todos:add-request"))}
            title="새 할 일"
            style={{ color: "var(--text-secondary)" }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col p-2" aria-label="필터">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {statusItems.map((item) => (
            <TodosFilterItem
              key={item.id}
              item={item}
              leading={item.leading}
              active={item.id === statusFilter}
              onClick={() => onStatusChange(item.id)}
            />
          ))}
          <div
            className="my-2"
            style={{ borderTop: "1px solid var(--border-subtle)" }}
          />
          {categoryItems.map((item) => {
            // 카테고리 필터 entry 옆에 시맨틱 색 dot — 캘린더 / 체크박스 와
            // 동일 토큰. uncategorized 는 회색 (--text-muted) 로 명시. "전체"
            // 는 status "전체" 와 동일하게 leading 비움.
            const dotColor =
              item.id === "uncategorized"
                ? "var(--text-muted)"
                : item.id === "all"
                  ? ""
                  : categoryColor(item.id as TodoCategory);
            const leading = dotColor ? (
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: dotColor }}
              />
            ) : null;
            return (
              <TodosFilterItem
                key={item.id}
                item={item}
                leading={leading}
                active={item.id === categoryFilter}
                onClick={() => onCategoryChange(item.id)}
              />
            );
          })}
        </div>
        {/* 취소됨 — 사이드바 하단 별도 entry. 클릭 시 다른 필터 무시. */}
        <div
          className="mt-2 pt-2"
          style={{ borderTop: "1px solid var(--border-default)" }}
        >
          <TodosFilterItem
            item={{ label: "취소됨", count: counts.status.cancelled }}
            leading={
              <XCircle
                className="h-3 w-3"
                strokeWidth={1.75}
                style={{ color: "var(--text-secondary)" }}
              />
            }
            active={statusFilter === "cancelled"}
            onClick={() => onStatusChange("cancelled")}
          />
        </div>
      </nav>
    </div>
  );
}

function TodosFilterItem({
  item,
  active,
  onClick,
  leading,
}: {
  item: { label: string; count: number };
  active: boolean;
  onClick: () => void;
  leading?: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={`w-full justify-between px-3 py-2 ${
        active ? "font-medium" : ""
      }`}
      style={{
        backgroundColor: active ? "var(--bg-surface-active)" : undefined,
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
      }}
    >
      <span className="inline-flex items-center gap-2">
        {/* 12px fixed area — dot/icon 다 가운데 정렬 → 라벨 좌측 align 통일. */}
        <span
          aria-hidden
          className="inline-flex h-3 w-3 shrink-0 items-center justify-center"
        >
          {leading}
        </span>
        {item.label}
      </span>
      <Text
        variant="caption"
        as="span"
        className="font-mono"
        style={{
          color: active ? "var(--text-secondary)" : "var(--text-muted)",
        }}
      >
        {item.count}
      </Text>
    </Button>
  );
}

// AppShell.sidePanelFooter slot 으로 주입. 할 일 탭의 휴지통 entry.
// 메모장 MeetingsSidePanelFooter 와 동일 패턴.
export function TodosSidePanelFooter({
  onTrashOpen,
}: {
  onTrashOpen: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="icon"
        onClick={onTrashOpen}
        title="휴지통"
        aria-label="휴지통"
        style={{ color: "var(--text-muted)" }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
