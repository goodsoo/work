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
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  useMeetings,
  useMeetingFolders,
  useCreateMeeting,
  useCreateMeetingFolder,
  useDeleteMeetingFolder,
  useMoveMeeting,
  useRenameMeetingFolder,
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
import { JournalOverlay } from "../calendar/JournalOverlay";
import { MeetingsTreeView } from "../meetings/MeetingsTreeView";
import { MoveFolderModal } from "../meetings/MoveFolderModal";
import { Button } from "../common/Button";
import { Text } from "../common/Text";
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
          <MeetingsTreeView
            meetings={data ?? []}
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
        )}
      </div>

      {contextMenu ? (
        <MeetingContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onMove={() => {
            setMoveModalFor(contextMenu.meetingId);
            setContextMenu(null);
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

// 메모 우클릭 컨텍스트 메뉴. 현재는 '폴더로 이동' 하나만. 추후 항목 추가 시
// 같은 패턴으로 button list 만 늘리면 됨.
function MeetingContextMenu({
  x,
  y,
  onMove,
}: {
  x: number;
  y: number;
  onMove: () => void;
}) {
  // 우측/하단 viewport 초과 방지 — 간단히 좌표만 clamp (메뉴 크기 추정).
  const MENU_W = 180;
  const MENU_H = 44;
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
  const wrapRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 / ESC 로 닫기.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
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

  return (
    <div ref={wrapRef} className="relative">
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
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[120px] overflow-hidden rounded-md shadow-md"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
          }}
        >
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
      ) : null}
    </div>
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
};

function timestampToLocalIso(ts: string): string {
  return todayIso(new Date(ts));
}

export function CalendarDayPanel({
  selectedDate,
  onOpenMeeting,
}: CalendarDayPanelProps) {
  const meetingsQ = useMeetings();
  const journalsQ = useJournals();
  const todosQ = useTodos();
  const updateTodo = useUpdateTodo();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showJournalOverlay, setShowJournalOverlay] = useState(false);

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
    // 시간 있는 todo 가 앞 (시간순), 없는 거 뒤 (created_at 순)
    todos.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const ta = a.due_time ?? "";
      const tb = b.due_time ?? "";
      if (ta !== tb) {
        if (!ta) return 1;
        if (!tb) return -1;
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
    const nextDone = !t.done;
    updateTodo.mutate({
      id: t.id,
      patch: {
        done: nextDone,
        done_at: nextDone ? new Date().toISOString() : null,
      },
    });
  }

  // journal 은 header 바로 아래 별도 section. items list 에는 안 들어감.
  const hasItems = meetings.length > 0 || todos.length > 0;

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

      {/* Journal CTA — 일기 빠른 진입. 없는 날은 dashed border + 펜 + 한 줄, 있는 날은
          미리보기 카드 (본문 첫 ~100자) + 펜 아이콘. 클릭 시 overlay 열림. */}
      <div
        className="shrink-0 px-3 pt-3 pb-2"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        {journal ? (
          <Button
            variant="ghost"
            onClick={() => setShowJournalOverlay(true)}
            className="group w-full justify-start items-start gap-2 px-3 py-2"
            leftIcon={
              <BookOpen
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                style={{ color: "var(--text-muted)" }}
              />
            }
          >
            <div className="min-w-0 flex-1">
              <Text
                variant="caption"
                color="secondary"
                as="div"
                weight="medium"
                className="flex items-center justify-between gap-2"
              >
                <span>일기</span>
                <Pencil
                  className="h-3 w-3 opacity-0 transition group-hover:opacity-100"
                  style={{ color: "var(--text-muted)" }}
                />
              </Text>
              <Text
                variant="body"
                color="secondary"
                as="div"
                className="mt-0.5 line-clamp-3 whitespace-pre-wrap font-serif leading-snug"
              >
                {journal.content?.trim() || "(내용 없음)"}
              </Text>
            </div>
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={() => setShowJournalOverlay(true)}
            className="w-full justify-start gap-2 border border-dashed px-3 py-2"
            leftIcon={<Plus className="h-3.5 w-3.5 shrink-0" />}
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-muted)",
            }}
            aria-label="일기 쓰기"
          >
            <span>일기 쓰기</span>
          </Button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {!hasItems ? (
          <Text
            variant="body"
            color="muted"
            as="div"
            className="px-4 py-8 text-center"
          >
            이날의 일정 / 할 일이 없어요
          </Text>
        ) : (
          <div className="space-y-1 p-3">
            {/* Meetings */}
            {meetings.map((m) => (
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
            ))}

            {/* Todos — due_time 있으면 시각 prefix */}
            {todos.map((t) => {
              const catColor = categoryColor(t.category);
              const pendingBorder = catColor || "var(--text-muted)";
              const pendingFill = catColor
                ? `color-mix(in srgb, ${catColor} 4%, transparent)`
                : "transparent";
              return (
              <div
                key={t.id}
                className="flex items-start gap-2 rounded-md px-3 py-2 transition"
              >
                <button
                  type="button"
                  onClick={() => handleToggle(t)}
                  className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition"
                  style={{
                    borderColor: t.done ? "var(--text-secondary)" : pendingBorder,
                    backgroundColor: t.done ? "var(--text-secondary)" : pendingFill,
                    color: t.done ? "var(--text-inverse)" : "transparent",
                    borderWidth: t.done ? 1 : 1.5,
                    minHeight: 0,
                  }}
                >
                  {t.done ? (
                    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </button>
                <Text
                  variant="body"
                  as="span"
                  className={`flex-1 ${t.done ? "line-through" : ""}`}
                  style={{
                    color: t.done ? "var(--text-muted)" : "var(--text-primary)",
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
            })}

          </div>
        )}
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
