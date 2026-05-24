import { useEffect, useRef, useState } from "react";
import { VaultGate } from "./components/vault/VaultGate";
import { AppShell } from "./components/nav/AppShell";
import { GlobalTooltip } from "./components/Tooltip";
import { ToastProvider, useToast } from "./components/Toast";
import { TABS, type Tab } from "./components/nav/BottomTabs";
import { MeetingForm } from "./components/meetings/MeetingForm";
import { TrashModal } from "./components/meetings/TrashModal";
import { PortfolioTrashModal } from "./components/portfolio/PortfolioTrashModal";
import {
  MeetingsSidePanel,
  MeetingsSidePanelFooter,
  PortfolioSidePanelFooter,
  CalendarDayPanel,
  TodosSidePanel,
  TodosSidePanelFooter,
  type TodosStatusFilter,
  type TodosCategoryFilter,
} from "./components/nav/SidePanel";
import { useTodoSort } from "./hooks/useTodoSort";
import { usePortfolioSort } from "./hooks/usePortfolioSort";
import { usePortfolioCategoryFilter } from "./hooks/usePortfolioCategoryFilter";
import { TodoTrashModal } from "./components/todos/TodoTrashModal";
import { Text } from "./components/common/Text";
import { EmptyState } from "./components/common/EmptyState";
import { CalendarPage } from "./pages/CalendarPage";
import { TodosPage } from "./pages/TodosPage";
import { PortfolioPage } from "./pages/PortfolioPage";
import { StyleguidePage } from "./pages/StyleguidePage";
import { PortfolioSidePanel } from "./components/portfolio/PortfolioSidePanel";
import type { ProjectFilter } from "./components/portfolio/PortfolioProjectList";
import { useGhSync } from "./hooks/usePortfolio";
import { useMeetings, useCreateMeeting, useDeleteMeeting } from "./hooks/useMeetings";
import { useVault } from "./lib/vault/useVault";
import { maybeAutoBackup } from "./lib/backup";
import { DrawerProvider, useDrawer } from "./hooks/useDrawer";
import { useSidebarCollapsed } from "./hooks/useSidebarCollapsed";
import { todayIso } from "./lib/dates";
import { isTauri } from "./lib/isTauri";

function readTabFromHash(): Tab {
  const h = window.location.hash;
  if (h.startsWith("#meeting-")) return "meetings";
  if (h === "#calendar") return "calendar";
  if (h === "#meetings") return "meetings";
  if (h === "#todos") return "todos";
  if (h === "#portfolio") return "portfolio";
  // 빈 hash = 첫 탭 (캘린더). nav-restructure 후 캘린더가 default landing.
  return TABS[0].id;
}

function readMeetingFromHash(): string | null {
  const h = window.location.hash;
  if (h.startsWith("#meeting-")) return h.slice("#meeting-".length) || null;
  return null;
}

// 세션 단위 한 번만 자동 선택. 사용자가 명시적으로 onBack/닫기 한 뒤 페이지
// 전환했다가 돌아와도 다시 자동 선택되지 않도록 모듈 변수로 보관. 새로고침하면
// 모듈이 다시 import 되며 false.
let didAutoSelectThisSession = false;

export default function App() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  if (hash === "#styleguide") return <StyleguidePage />;

  return (
    <VaultGate>
      <GlobalTooltip />
      <ToastProvider>
        <DrawerProvider>
          <AppContent />
        </DrawerProvider>
      </ToastProvider>
    </VaultGate>
  );
}

function AppContent() {
  const drawer = useDrawer();
  const [tab, setTab] = useState<Tab>(() => readTabFromHash());
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(() =>
    readMeetingFromHash(),
  );
  const [calendarDate, setCalendarDate] = useState<string>(todayIso());
  const [todoStatus, setTodoStatus] = useState<TodosStatusFilter>("all");
  const [todoCategory, setTodoCategory] = useState<TodosCategoryFilter>("all");
  const [todoSortKey, setTodoSortKey] = useTodoSort();
  const [portfolioFilter, setPortfolioFilter] = useState<ProjectFilter>({
    kind: "all",
  });
  const [portfolioSortKey, setPortfolioSortKey] = usePortfolioSort();
  const portfolioCategoryFilter = usePortfolioCategoryFilter();
  // 휴지통은 overlay — utility 액션이라 SettingsModal 과 같은 패턴.
  // 메모 + todo 휴지통 별도 — 데이터 영역 다름.
  const [trashOpen, setTrashOpen] = useState(false);
  const [todoTrashOpen, setTodoTrashOpen] = useState(false);
  const [portfolioTrashOpen, setPortfolioTrashOpen] = useState(false);
  const portfolioSync = useGhSync();
  const toast = useToast();

  // last_sync - 1일 buffer 의 YYYY-MM-DD. 첫 sync (last_sync 없음) 면 undefined → 전체.
  // gh search 의 `merged:>=YYYY-MM-DD` 가 날짜 단위라 1일 buffer 충분.
  // 사용자가 직접 트리거한 sync 실패는 toast 발사. background auto-sync 는 silent (5초마다 noise 회피).
  const portfolioRunIncrementalSync = async () => {
    try {
      await portfolioSync.run({ incremental: true });
    } catch (err) {
      console.error("[portfolio] incremental sync failed:", err);
      toast.show("동기화에 실패했습니다. 네트워크 연결을 확인하세요.");
    }
  };
  const portfolioRunFullSync = async () => {
    try {
      await portfolioSync.run({});
    } catch (err) {
      console.error("[portfolio] full sync failed:", err);
      toast.show("전체 동기화에 실패했습니다. 네트워크 연결을 확인하세요.");
    }
  };
  const { adapter, isReady } = useVault();
  const meetings = useMeetings();
  const sidebar = useSidebarCollapsed();
  const createMeetingMutation = useCreateMeeting();
  const deleteMeetingMutation = useDeleteMeeting();
  const autoSyncDone = useRef(false);
  const autoBackupDone = useRef(false);
  const autoSelectedRef = useRef(didAutoSelectThisSession);

  // V0.7 design step 3 (1B): vault ready 후 5초 background sync 1회 (since=last_sync).
  // 본인 매일 앱 켜면 silent fetch — 의식 0 으로 카드 누적. Tauri 만 (gh 호출 필요).
  // useGhSync 의 callId 가드 + cancel 강제 리셋 덕분에 stuck 회복 가능 (V0.7.x).
  useEffect(() => {
    if (!isTauri || !isReady || autoSyncDone.current) return;
    autoSyncDone.current = true;
    const t = setTimeout(() => {
      portfolioSync.run({ incremental: true }).catch((err) => {
        // background — silent. 5초마다 toast 뜨면 noise. 사용자 트리거 sync 만 toast.
        console.error("[portfolio] background sync failed:", err);
      });
    }, 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  // 자동 백업 — vault ready 후 10초 뒤 1회. interval/keepCount 설정에 따라 실행.
  useEffect(() => {
    if (!isTauri || !isReady || autoBackupDone.current) return;
    autoBackupDone.current = true;
    const t = setTimeout(async () => {
      try {
        await maybeAutoBackup(adapter);
      } catch (err) {
        console.error("auto backup failed", err);
      }
    }, 10000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  // 메모장 진입 시 세션당 한 번 자동 선택 (V0.5.3). 모듈 flag 로 페이지 갔다와도
  // 다시 발동 안 함. 메모 0개면 skip.
  useEffect(() => {
    if (tab !== "meetings") return;
    if (autoSelectedRef.current) return;
    if (selectedMeetingId) {
      autoSelectedRef.current = true;
      didAutoSelectThisSession = true;
      return;
    }
    const list = meetings.data;
    if (!list || list.length === 0) return;
    autoSelectedRef.current = true;
    didAutoSelectThisSession = true;
    openMeeting(list[0].uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedMeetingId, meetings.data]);

  // list 로드 후 selectedMeetingId 가 이미 사라진 uid 면 정리. 케이스:
  //   1. 노트 삭제 직후 closeMeeting→history.back 이 stale entry (그 사이 purge 된 메모) 의
  //      uid 로 popstate 를 발사 → setSelectedMeetingId 가 dead uid 로 set
  //   2. 초기 진입 시 URL hash 가 다른 세션에서 삭제된 메모 uid (옵시디안 모바일 sync 등)
  // 어느 쪽이든 selectedMeetingId 를 그대로 두면 useMeeting 이 throw → React Query retry 3회 →
  // 영구 error UI. list cache 에 없으면 null 로 fallback + hash 정리 (다음 back 이 재발 X).
  useEffect(() => {
    if (!meetings.isSuccess) return;
    if (!selectedMeetingId) return;
    const exists = meetings.data?.some((m) => m.uid === selectedMeetingId);
    if (exists) return;
    // 의도: list cache 가 도착했는데 hash 의 uid 가 사라진 케이스 — 즉시 정리.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedMeetingId(null);
    if (window.location.hash.startsWith("#meeting-")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [meetings.isSuccess, meetings.data, selectedMeetingId]);

  useEffect(() => {
    function syncFromHash() {
      setTab(readTabFromHash());
      // hash 에 meeting id 가 있을 때만 set. 다른 탭으로 갔을 땐 selectedMeetingId
      // 를 보존 — 메모장 돌아오면 그 메모가 다시 열림.
      const idFromHash = readMeetingFromHash();
      if (idFromHash !== null) {
        setSelectedMeetingId(idFromHash);
      }
    }
    window.addEventListener("popstate", syncFromHash);
    window.addEventListener("hashchange", syncFromHash);
    return () => {
      window.removeEventListener("popstate", syncFromHash);
      window.removeEventListener("hashchange", syncFromHash);
    };
  }, []);

  // macOS WKWebView 가 Backspace/Delete 를 history.back() 으로 처리 — SPA state 망가짐.
  // 텍스트 입력 컨텍스트가 아니면 막음.
  useEffect(() => {
    function blockNavKeys(e: KeyboardEvent) {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (t.isContentEditable) return;
      }
      e.preventDefault();
    }
    window.addEventListener("keydown", blockNavKeys);
    return () => window.removeEventListener("keydown", blockNavKeys);
  }, []);

  // Desktop (Tauri) 전용 단축키: Cmd+1/2/3/4 (TABS index 기반), Cmd+\ (사이드바 토글).
  // 탭 순서 바뀌면 단축키 의미도 자동 swap (캘린더 첫번째 → Cmd+1=캘린더).
  useEffect(() => {
    if (!isTauri) return;
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      // Cmd+\ — 사이드바 collapse 토글 (input/textarea 안에서도 동작)
      if (e.key === "\\") {
        e.preventDefault();
        sidebar.toggle();
        return;
      }
      const idx = "1234".indexOf(e.key);
      if (idx === -1) return;
      const target = TABS[idx];
      if (!target) return;
      e.preventDefault();
      switchTab(target.id);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // switchTab 은 의도적으로 dep 제외 — 매 렌더 새 ref 라 listener re-register 폭주 회피.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMeetingId, sidebar.toggle]);

  // 메모장 단축키 (Tauri only):
  // - Cmd+N: 새 메모 생성 + 자동 선택 (textarea 안에서도 동작)
  // - Cmd+Backspace/Delete: 현재 메모 삭제 (input/textarea 밖에서만)
  // - Cmd+↑/↓: 이전/다음 메모 (input/textarea 밖에서만)
  useEffect(() => {
    if (!isTauri) return;
    if (tab !== "meetings") return;

    function isInTextInput(t: EventTarget | null): boolean {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      return t.isContentEditable;
    }

    async function handleCreate() {
      if (createMeetingMutation.isPending) return;
      try {
        const created = await createMeetingMutation.mutateAsync({
          title: null,
          date: todayIso(),
          time: null,
          attendees: null,
          content: "",
          discussion_items: null,
          decisions: null,
          action_items: null,
        });
        openMeeting(created.uid);
      } catch {
        // 사이드 패널의 createError 와 별도 — 단축키 실패는 silent (drawer 안에서도 동작)
      }
    }

    async function handleDelete() {
      if (!selectedMeetingId) return;
      if (deleteMeetingMutation.isPending) return;
      if (!window.confirm("이 메모를 휴지통으로 옮길까요?")) return;
      try {
        await deleteMeetingMutation.mutateAsync(selectedMeetingId);
        closeMeeting();
      } catch {
        // ignore — TanStack Query mutation state 에 반영됨
      }
    }

    function moveSelection(dir: 1 | -1) {
      const list = meetings.data;
      if (!list || list.length === 0) return;
      const currIdx = selectedMeetingId
        ? list.findIndex((m) => m.uid === selectedMeetingId)
        : -1;
      let nextIdx: number;
      if (currIdx === -1) {
        nextIdx = dir === 1 ? 0 : list.length - 1;
      } else {
        nextIdx =
          dir === 1
            ? Math.min(currIdx + 1, list.length - 1)
            : Math.max(currIdx - 1, 0);
      }
      if (nextIdx === currIdx) return;
      openMeeting(list[nextIdx].uid);
    }

    function onKeyDown(e: KeyboardEvent) {
      const cmd = e.metaKey || e.ctrlKey;
      if (!cmd) return;
      if (e.altKey) return;

      // Cmd+N: 새 메모 (textarea/input 안에서도 동작)
      if ((e.key === "n" || e.key === "N") && !e.shiftKey) {
        e.preventDefault();
        void handleCreate();
        return;
      }

      // 아래 단축키는 input/textarea 밖에서만
      if (isInTextInput(e.target)) return;

      // Cmd+Backspace/Delete: 메모 삭제
      if ((e.key === "Backspace" || e.key === "Delete") && !e.shiftKey) {
        if (!selectedMeetingId) return;
        e.preventDefault();
        void handleDelete();
        return;
      }

      // Cmd+↑/↓: 메모 이동
      if (e.key === "ArrowUp" && !e.shiftKey) {
        e.preventDefault();
        moveSelection(-1);
        return;
      }
      if (e.key === "ArrowDown" && !e.shiftKey) {
        e.preventDefault();
        moveSelection(1);
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedMeetingId, meetings.data]);

  function switchTab(next: Tab) {
    setTab(next);
    // selectedMeetingId 는 보존. 메모장으로 돌아오면 그 메모가 다시 열림.
    const target =
      next === "meetings"
        ? selectedMeetingId
          ? `#meeting-${selectedMeetingId}`
          : ""
        : `#${next}`;
    if (window.location.hash !== target) {
      window.history.pushState(
        { tab: next, meetingId: selectedMeetingId },
        "",
        target || window.location.pathname,
      );
    }
  }

  function changeTab(next: Tab) {
    if (next === tab) return;
    switchTab(next);
  }

  function openMeeting(id: string) {
    drawer.close();
    setTab("meetings");
    setSelectedMeetingId(id);
    window.history.pushState({ meetingId: id }, "", `#meeting-${id}`);
  }

  function closeMeeting() {
    if (window.history.state?.meetingId) {
      window.history.back();
    } else {
      setSelectedMeetingId(null);
    }
  }

  // Side panel per tab (모바일에선 drawer, 데스크탑에선 3-pane 왼쪽 컬럼).
  const sidePanel =
    tab === "meetings" ? (
      <MeetingsSidePanel
        selectedId={selectedMeetingId}
        onSelect={openMeeting}
      />
    ) : tab === "calendar" ? (
      <CalendarDayPanel
        selectedDate={calendarDate}
        onOpenMeeting={openMeeting}
      />
    ) : tab === "todos" ? (
      <TodosSidePanel
        statusFilter={todoStatus}
        onStatusChange={setTodoStatus}
        categoryFilter={todoCategory}
        onCategoryChange={setTodoCategory}
        sortKey={todoSortKey}
        onSortKeyChange={setTodoSortKey}
      />
    ) : tab === "portfolio" ? (
      <PortfolioSidePanel
        activeFilter={portfolioFilter}
        onFilterChange={setPortfolioFilter}
        sortKey={portfolioSortKey}
        onSortKeyChange={setPortfolioSortKey}
        selectedCategories={portfolioCategoryFilter.selected}
        onCategoryToggle={portfolioCategoryFilter.toggle}
        onCategoryClear={portfolioCategoryFilter.clear}
        syncState={portfolioSync.state}
        onSyncRun={portfolioRunIncrementalSync}
        onSyncCancel={portfolioSync.cancel}
        onFullSyncRun={portfolioRunFullSync}
      />
    ) : undefined;

  // 탭별 footer slot. 휴지통은 overlay 모달, 도메인별 분리.
  const sidePanelFooter =
    tab === "meetings" ? (
      <MeetingsSidePanelFooter onTrashOpen={() => setTrashOpen(true)} />
    ) : tab === "todos" ? (
      <TodosSidePanelFooter onTrashOpen={() => setTodoTrashOpen(true)} />
    ) : tab === "portfolio" ? (
      <PortfolioSidePanelFooter
        onTrashOpen={() => setPortfolioTrashOpen(true)}
      />
    ) : undefined;

  return (
    <AppShell
      activeTab={tab}
      onTabChange={changeTab}
      sidePanel={sidePanel}
      sidePanelFooter={sidePanelFooter}
      sidebarCollapsed={sidebar.collapsed}
    >
      {tab === "meetings" ? (
        selectedMeetingId ? (
          <MeetingForm meetingId={selectedMeetingId} onBack={closeMeeting} />
        ) : (
          <MeetingsEmpty count={meetings.data?.length ?? 0} loading={meetings.isLoading} />
        )
      ) : tab === "calendar" ? (
        <CalendarPage
          targetDate={calendarDate}
          onSelectedDateChange={setCalendarDate}
        />
      ) : tab === "portfolio" ? (
        <PortfolioPage
          activeFilter={portfolioFilter}
          sortKey={portfolioSortKey}
          selectedCategories={portfolioCategoryFilter.selected}
          onCategoryToggle={portfolioCategoryFilter.toggle}
          onCategoryClear={portfolioCategoryFilter.clear}
          onSync={portfolioRunFullSync}
          syncRunning={portfolioSync.state.running}
        />
      ) : (
        <TodosPage
          statusFilter={todoStatus}
          categoryFilter={todoCategory}
          sortKey={todoSortKey}
        />
      )}
      <TrashModal
        open={trashOpen}
        onClose={() => setTrashOpen(false)}
      />
      <TodoTrashModal
        open={todoTrashOpen}
        onClose={() => setTodoTrashOpen(false)}
      />
      <PortfolioTrashModal
        open={portfolioTrashOpen}
        onClose={() => setPortfolioTrashOpen(false)}
      />
    </AppShell>
  );
}

function MeetingsEmpty({ count, loading }: { count: number; loading: boolean }) {
  const message = loading
    ? ""
    : count === 0
      ? "아직 메모가 없어요. 메뉴에서 + 를 눌러 새 메모를 만드세요."
      : "메뉴에서 메모를 선택하세요.";
  return (
    <EmptyState
      className="flex h-[calc(100svh-3rem)] flex-col items-center justify-center gap-3 px-6 text-center"
      description={<Text variant="body" color="muted" as="span">{message}</Text>}
    />
  );
}
