import {
  Plus,
  FileText,
  BookOpen,
  HelpCircle,
  X,
  Trash2,
  ArrowUpDown,
  Check,
  Pencil,
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
import { useActiveRoutines, useToggleRoutineDay } from "../../hooks/useRoutines";
import type { Meeting } from "../../api/meetings";
import type { Routine } from "../../api/routines";
import type { Todo, TodoCategory } from "../../api/todos";
import { formatDateLong, isToday, todayIso } from "../../lib/dates";
import { formatError } from "../../lib/errors";
import { TaskAddModal } from "../tasks/TaskAddModal";
import { CheckboxButton } from "../todos/CheckboxButton";
import { JournalOverlay } from "../calendar/JournalOverlay";
import { MeetingsTreeView } from "../meetings/MeetingsTreeView";
import { MoveFolderModal } from "../meetings/MoveFolderModal";
import { Button } from "../common/Button";
import { Text } from "../common/Text";
import { FilterItem } from "../common/FilterItem";
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
  // 루틴과 할일은 "할 일" 1개 섹션으로 통합 (안에서 구분선으로 분리). 별도 폴더 X.
  const [collapsed, setCollapsed] = useState<
    Set<"journal" | "tasks" | "meetings">
  >(() => new Set());
  function toggleSection(name: "journal" | "tasks" | "meetings") {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const today = isToday(selectedDate);
  const dayRoutines = useActiveRoutines(selectedDate);
  const toggleRoutineDayMutation = useToggleRoutineDay();

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
          <SectionChildren>
            {/* 메모 블럭과 동일 패턴 — leftIcon (BookOpen) + body Text. journal 있으면
                내용 미리보기(첫 줄), 없으면 "일기 쓰기" muted. */}
            <Button
              variant="ghost"
              onClick={() => setShowJournalOverlay(true)}
              className="w-full justify-start items-start gap-2 px-2 py-1 text-[13px]"
              leftIcon={
                <BookOpen
                  className="h-3 w-3 shrink-0"
                  style={{ color: "var(--text-muted)" }}
                />
              }
              aria-label={journal ? "일기 보기" : "일기 쓰기"}
            >
              <div className="min-w-0 flex-1">
                {journal ? (
                  <Text variant="caption" as="div" truncate className="text-[13px]">
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
                  <Text variant="caption" color="muted" as="div" className="text-[13px]">
                    일기 쓰기
                  </Text>
                )}
              </div>
            </Button>
          </SectionChildren>
        ) : null}

        {/* 할 일 section — 루틴 + 일회성 할일 통합 (구분선으로 시각 분리). 별도 폴더 X.
            내용 없으면 섹션 자체 숨김 (일기는 항상 노출, 그 외는 0건이면 hide). */}
        {dayRoutines.length + todos.length > 0 ? (
          <>
            <SidePanelSectionHeader
              label="할 일"
              collapsed={collapsed.has("tasks")}
              onToggle={() => toggleSection("tasks")}
              count={dayRoutines.length + todos.length}
            />
            {!collapsed.has("tasks") ? (
              <SectionChildren>
                {dayRoutines.map((r) => {
                  const done = r.log.has(selectedDate);
                  return (
                    <div
                      key={`routine:${r.name}`}
                      className="flex items-center gap-2 rounded-md px-2 py-1 text-[13px]"
                    >
                      <CheckboxButton
                        status={done ? "done" : "pending"}
                        category={null}
                        shape="circle"
                        onClick={() =>
                          toggleRoutineDayMutation.mutate({
                            name: r.name,
                            date: selectedDate,
                            done: !done,
                          })
                        }
                      />
                      <span
                        className={`min-w-0 flex-1 truncate ${done ? "line-through" : ""}`}
                        style={{
                          color: done
                            ? "var(--text-muted)"
                            : "var(--text-primary)",
                        }}
                      >
                        {r.name}
                      </span>
                      {r.frontmatter.time ? (
                        <span
                          className="shrink-0 text-[11px] tabular-nums"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {r.frontmatter.time}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
                {todos.map((t) => {
                  const status = t.cancelled
                    ? "cancelled"
                    : t.done
                      ? "done"
                      : "pending";
                  return (
                    <div
                      key={`todo:${t.id}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => onOpenTodo(t.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpenTodo(t.id);
                        }
                      }}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-[13px] transition hover:bg-[var(--bg-surface-hover)]"
                    >
                      <CheckboxButton
                        status={status}
                        category={t.category}
                        onClick={() => handleToggle(t)}
                      />
                      <span
                        className={`min-w-0 flex-1 truncate ${t.done ? "line-through" : ""}`}
                        style={{
                          color: t.done
                            ? "var(--text-muted)"
                            : "var(--text-primary)",
                        }}
                      >
                        {t.title}
                      </span>
                      {t.due_time ? (
                        <span
                          className="shrink-0 text-[11px] tabular-nums"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {t.due_time}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </SectionChildren>
            ) : null}
          </>
        ) : null}

        {/* 메모 section — 0건이면 섹션 자체 숨김. */}
        {meetings.length > 0 ? (
          <>
            <SidePanelSectionHeader
              label="메모"
              collapsed={collapsed.has("meetings")}
              onToggle={() => toggleSection("meetings")}
              count={meetings.length}
            />
            {!collapsed.has("meetings") ? (
              <SectionChildren>
                {meetings.map((m) => (
                <Button
                  key={m.uid}
                  variant="ghost"
                  onClick={() => onOpenMeeting(m.uid)}
                  className="w-full justify-start items-start gap-2 px-2 py-1 text-[13px]"
                  leftIcon={
                    <FileText className="mt-0.5 h-3 w-3 shrink-0 text-blue-500" />
                  }
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate">
                        {m.title?.trim() || "(제목 없음)"}
                      </span>
                      {m.time ? (
                        <span
                          className="shrink-0 text-[11px] tabular-nums"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {m.time}
                        </span>
                      ) : null}
                    </div>
                    {m.attendees ? (
                      <Text
                        variant="caption"
                        color="secondary"
                        as="div"
                        truncate
                        className="mt-0.5 text-[11px]"
                      >
                        {m.attendees}
                      </Text>
                    ) : null}
                  </div>
                </Button>
                ))}
              </SectionChildren>
            ) : null}
          </>
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

// 섹션 children wrapper — 메모장 폴더 트리의 indent + vertical guide 패턴 차용.
// 헤더 chevron(8px paddingLeft + 6px half)=14px 위치에 세로 guide line, 안의 항목들은
// paddingLeft 16px 만큼 들여쓰기 → "폴더 안에 들어있다" 시각 신호.
function SectionChildren({ children }: { children: ReactNode }) {
  return (
    <div className="relative pr-1 pb-2" style={{ paddingLeft: "16px" }}>
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 bottom-0 w-px"
        style={{ left: "14px", backgroundColor: "var(--border-default)" }}
      />
      {children}
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
      className="w-full justify-between gap-1.5 rounded-none py-1 pr-2 text-[13px] font-normal"
      style={{ paddingLeft: "8px", color: "var(--text-secondary)" }}
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
        <span
          className="text-[11px] tabular-nums"
          style={{ color: "var(--text-muted)" }}
        >
          {count}
        </span>
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
  sortKey: TodoSortKey;
  onSortKeyChange: (next: TodoSortKey) => void;
  // 사이드바 루틴 폴더의 selected entry 와 onSelect.
  // null = 루틴 미선택 (= 태스크 필터 활성). routine 선택 시 본문이 RoutineDetail 로
  // 전환되고 태스크 필터는 시각 비활성 (회색).
  selectedRoutineName: string | null;
  onSelectRoutine: (name: string | null) => void;
};

export function TodosSidePanel({
  statusFilter,
  onStatusChange,
  sortKey,
  onSortKeyChange,
  selectedRoutineName,
  onSelectRoutine,
}: TodosPanelProps) {
  const { data } = useTodos();
  const todos = data ?? [];
  const activeRoutines = useActiveRoutines(todayIso());
  const toggleRoutineDayMutation = useToggleRoutineDay();
  const today = todayIso();
  const [collapsedRoutines, setCollapsedRoutines] = useState(false);

  // 루틴 폴더 row 의 오늘 체크박스. CheckboxButton 이 e.stopPropagation 내장 — row click 안 trigger.
  function handleToggleRoutineToday(name: string) {
    const r = activeRoutines.find((x) => x.name === name);
    if (!r) return;
    const done = !r.log.has(today);
    toggleRoutineDayMutation.mutate({ name, date: today, done });
  }

  // 태스크 필터 클릭 = 루틴 미선택으로 (선택된 게 있었으면 자동 해제).
  function selectTaskFilter(fn: () => void) {
    if (selectedRoutineName !== null) onSelectRoutine(null);
    fn();
  }

  // status 별 count. 카테고리 필터는 페이지 헤더 chip 으로 이동했으니 사이드바
  // count 는 status 만 — 카테고리와 AND 결합 없음. deleted 는 휴지통 modal 전용
  // 으로 격리.
  const counts = useMemo(() => {
    const status: Record<TodosStatusFilter, number> = {
      all: 0,
      pending: 0,
      done: 0,
      cancelled: 0,
    };
    for (const t of todos) {
      if (t.deleted) continue;
      if (t.cancelled) {
        status.cancelled++;
        continue;
      }
      status.all++;
      if (t.done) status.done++;
      else status.pending++;
    }
    return { status };
  }, [todos]);

  // status row — 라벨 + 카운트만, leading 아이콘 없음. status 가 단일 차원이라
  // 라벨 텍스트만으로 충분히 명확. 캘린더/포트폴리오 패턴과 align.
  const statusItems: Array<{
    id: TodosStatusFilter;
    label: string;
    count: number;
  }> = [
    { id: "all", label: "전체", count: counts.status.all },
    { id: "pending", label: "미완료", count: counts.status.pending },
    { id: "done", label: "완료", count: counts.status.done },
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
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("todos:add-request", {
                  // 루틴 폴더 active 상태면 모달 default 탭 = routine.
                  detail: {
                    type: selectedRoutineName !== null ? "routine" : "task",
                  },
                }),
              )
            }
            title="새 할 일"
            style={{ color: "var(--text-secondary)" }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <nav
        className="flex min-h-0 flex-1 flex-col"
        aria-label="필터"
      >
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {/* status 필터 — 사이드바 최상단 flat. 카테고리 차원은 페이지 헤더 chip 으로
              이동 — 사이드바는 단일 차원 (status). 폴더 outer 없이 메모장 트리의 nav p-1 패턴. */}
          <div className="p-1">
            {statusItems.map((item) => (
              <FilterItem
                key={item.id}
                label={item.label}
                count={item.count}
                active={
                  selectedRoutineName === null && item.id === statusFilter
                }
                onClick={() =>
                  selectTaskFilter(() => onStatusChange(item.id))
                }
              />
            ))}
          </div>

          {/* 루틴 폴더 — status 아래에 별도 도메인. SectionHeader (outer) + 안 항목들은
              SectionChildren wrapper 로 들여쓰기. */}
          <SidePanelSectionHeader
            label="루틴"
            collapsed={collapsedRoutines}
            onToggle={() => setCollapsedRoutines((v) => !v)}
          />
          {!collapsedRoutines ? (
            <SectionChildren>
              {activeRoutines.length === 0 ? (
                <Text
                  variant="caption"
                  color="muted"
                  as="div"
                  className="px-2 py-1 text-[13px]"
                >
                  아직 루틴이 없어요
                </Text>
              ) : (
                activeRoutines.map((r) => (
                  <RoutineSidebarItem
                    key={r.name}
                    routine={r}
                    today={today}
                    active={r.name === selectedRoutineName}
                    onSelect={() => onSelectRoutine(r.name)}
                    onToggleToday={() => handleToggleRoutineToday(r.name)}
                  />
                ))
              )}
            </SectionChildren>
          ) : null}
        </div>
        {/* 취소됨 — 사이드바 하단 별도 entry. 폴더 밖이라 들여쓰기 없이 outer level
            (헤더 chevron 위치 8px 와 align). 좌우 padding 1 = 메모장 트리 root 와 동일. */}
        <div
          className="px-1 py-2"
          style={{ borderTop: "1px solid var(--border-default)" }}
        >
          <FilterItem
            label="취소됨"
            count={counts.status.cancelled}
            leading={
              <XCircle
                className="h-3 w-3"
                strokeWidth={1.75}
                style={{ color: "var(--text-secondary)" }}
              />
            }
            active={selectedRoutineName === null && statusFilter === "cancelled"}
            onClick={() => selectTaskFilter(() => onStatusChange("cancelled"))}
          />
        </div>
      </nav>
    </div>
  );
}

// 루틴 사이드바 row — 오늘 체크박스 + 시간 + 이름. row click = RoutineDetail 진입.
// 루틴 사이드바 row — 캘린더 사이드바의 todo row 패턴 차용 (div role=button + flex
// items-start + CheckboxButton). 디자인 시스템의 체크박스/Text 컴포넌트만 사용.
function RoutineSidebarItem({
  routine,
  today,
  active,
  onSelect,
  onToggleToday,
}: {
  routine: Routine;
  today: string;
  active: boolean;
  onSelect: () => void;
  onToggleToday: () => void;
}) {
  const done = routine.log.has(today);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-[13px] transition hover:bg-[var(--bg-surface-hover)]"
      style={{
        backgroundColor: active ? "var(--bg-surface-active)" : undefined,
      }}
    >
      <CheckboxButton
        status={done ? "done" : "pending"}
        category={null}
        shape="circle"
        onClick={onToggleToday}
      />
      <span
        className={`min-w-0 flex-1 truncate ${done ? "line-through" : ""}`}
        style={{
          color: done ? "var(--text-muted)" : "var(--text-primary)",
        }}
      >
        {routine.name}
      </span>
      {routine.frontmatter.time ? (
        <span
          className="shrink-0 text-[11px] tabular-nums"
          style={{ color: "var(--text-muted)" }}
        >
          {routine.frontmatter.time}
        </span>
      ) : null}
    </div>
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
