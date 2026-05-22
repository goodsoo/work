import { useState } from "react";
import { AlertCircle, BookOpen } from "lucide-react";
import {
  usePortfolioProjects,
  usePortfolioWorks,
  type GhSyncProgress,
} from "../../hooks/usePortfolio";
import { PortfolioProjectList, type ProjectFilter } from "./PortfolioProjectList";
import { PortfolioGuideModal } from "./PortfolioGuideModal";
import { SyncButton } from "./SyncButton";

type Props = {
  activeFilter: ProjectFilter;
  onFilterChange: (next: ProjectFilter) => void;
  syncState: GhSyncProgress;
  onSyncRun: () => void;
  onFullSyncRun: () => void;
};

export function PortfolioSidePanel({
  activeFilter,
  onFilterChange,
  syncState,
  onSyncRun,
  onFullSyncRun,
}: Props) {
  const works = usePortfolioWorks();
  const projects = usePortfolioProjects();
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <div className="relative flex h-full flex-col">
      {/* 헤더 — 메모장과 통일 (h2 font-serif text-sm + 우측 아이콘 row) */}
      <div
        className="flex shrink-0 items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border-default)" }}
      >
        <h2
          className="font-serif text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          내 작업
        </h2>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            title="가이드북"
            aria-label="가이드북"
            className="flex h-7 w-7 items-center justify-center rounded-md transition"
            style={{ color: "var(--text-secondary)", minHeight: 0 }}
          >
            <BookOpen className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 동기화 + 상태 — 헤더 아래 별도 영역. 프롬프트 도구는 가이드북 모달 안으로 이동. */}
      <div
        className="flex shrink-0 flex-col gap-2 px-3 pt-3 pb-3"
        style={{ borderBottom: "1px solid var(--border-default)" }}
      >
        <SyncButton state={syncState} onRun={onSyncRun} />
        {syncState.error ? (
          <SyncError message={syncState.error.message} />
        ) : null}
        {!syncState.running && syncState.lastResult && !syncState.error ? (
          <div
            className="rounded-md px-3 py-1.5 text-xs"
            style={{
              backgroundColor: "var(--bg-surface-hover)",
              color: "var(--text-secondary)",
            }}
          >
            마지막 동기화: 신규 {syncState.lastResult.added} / 갱신{" "}
            {syncState.lastResult.preserved} / 전체{" "}
            {syncState.lastResult.total}
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto">
        <PortfolioProjectList
          projects={projects.data ?? []}
          works={works.data ?? []}
          activeFilter={activeFilter}
          onFilterChange={onFilterChange}
        />
      </div>

      <PortfolioGuideModal
        isOpen={guideOpen}
        onClose={() => setGuideOpen(false)}
        onFullSyncRun={onFullSyncRun}
        fullSyncRunning={syncState.running}
      />
    </div>
  );
}

function SyncError({ message }: { message: string }) {
  return (
    <div
      className="flex items-start gap-2 rounded px-2 py-1 text-xs"
      style={{
        backgroundColor: "var(--accent-red-bg)",
        color: "var(--accent-red-text)",
        borderLeft: "2px solid var(--accent-red)",
      }}
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="break-words">{message}</span>
    </div>
  );
}
