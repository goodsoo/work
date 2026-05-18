import { AlertCircle } from "lucide-react";
import {
  usePortfolioProjects,
  usePortfolioWorks,
  type GhSyncProgress,
} from "../../hooks/usePortfolio";
import { PortfolioProjectList, type ProjectFilter } from "./PortfolioProjectList";
import { SyncButton } from "./SyncButton";

type Props = {
  activeFilter: ProjectFilter;
  onFilterChange: (next: ProjectFilter) => void;
  syncState: GhSyncProgress;
  onSyncRun: () => void;
};

export function PortfolioSidePanel({
  activeFilter,
  onFilterChange,
  syncState,
  onSyncRun,
}: Props) {
  const works = usePortfolioWorks();
  const projects = usePortfolioProjects();

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex flex-col gap-2 px-3 pt-4 pb-3"
        style={{ borderBottom: "1px solid var(--border-default)" }}
      >
        <h2
          className="text-lg font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          내 작업
        </h2>
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
    </div>
  );
}

function SyncError({ message }: { message: string }) {
  return (
    <div
      className="flex items-start gap-2 rounded-md px-3 py-2 text-xs"
      style={{
        backgroundColor: "var(--accent-red-bg)",
        color: "var(--accent-red-text)",
        borderLeft: "4px solid var(--accent-red)",
      }}
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="break-words">{message}</span>
    </div>
  );
}
