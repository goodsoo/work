import { useMemo } from "react";
import { Briefcase } from "lucide-react";
import {
  usePortfolioProjects,
  usePortfolioWorks,
} from "../hooks/usePortfolio";
import { PortfolioWorkCard } from "../components/portfolio/PortfolioWorkCard";
import type { ProjectFilter } from "../components/portfolio/PortfolioProjectList";
import type { PortfolioWorkMeta } from "../api/portfolio";

type Props = {
  activeFilter: ProjectFilter;
  onSync: () => void;
  syncRunning: boolean;
};

function applyFilter(
  works: PortfolioWorkMeta[],
  filter: ProjectFilter,
): PortfolioWorkMeta[] {
  switch (filter.kind) {
    case "all":
      return works.filter((w) => w.frontmatter.included);
    case "uncategorized":
      return works.filter(
        (w) => w.frontmatter.included && !w.frontmatter.project,
      );
    case "project":
      return works.filter(
        (w) => w.frontmatter.included && w.frontmatter.project === filter.slug,
      );
    case "excluded":
      return works.filter((w) => !w.frontmatter.included);
  }
}

export function PortfolioPage({ activeFilter, onSync, syncRunning }: Props) {
  const worksQuery = usePortfolioWorks();
  const projectsQuery = usePortfolioProjects();

  const filtered = useMemo(
    () => applyFilter(worksQuery.data ?? [], activeFilter),
    [worksQuery.data, activeFilter],
  );

  const allWorks = worksQuery.data ?? [];

  return (
    <>
      <PortfolioHeader />
      {worksQuery.isLoading ? (
        <SkeletonGrid count={6} />
      ) : allWorks.length === 0 ? (
        <EmptyVault onSync={onSync} running={syncRunning} />
      ) : filtered.length === 0 ? (
        <EmptyFilter filter={activeFilter} />
      ) : (
        <div className="px-6 pt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((w) => (
              <PortfolioWorkCard
                key={w.prSlug}
                work={w}
                projects={projectsQuery.data ?? []}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// 메모장 / 할일 본문 헤더와 동일 패턴 (py-3 → 자연 52px = 사이드바 헤더와 통일).
// 좌/우 액션은 일단 비움 — 추후 sync 트리거 등 추가 가능.
function PortfolioHeader() {
  return (
    <div
      className="sticky top-0 z-20 grid items-center gap-2 overflow-hidden px-3 backdrop-blur lg:relative lg:top-auto lg:shrink-0"
      style={{
        height: "var(--page-header-h)",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr)",
        backgroundColor: "var(--bg-overlay)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div />
      <h1
        className="justify-self-center text-base font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        내 작업
      </h1>
      <div />
    </div>
  );
}

function SkeletonGrid({ count }: { count: number }) {
  return (
    <div className="px-6 pt-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg"
            style={{
              backgroundColor: "var(--bg-surface-hover)",
              height: "240px",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyVault({
  onSync,
  running,
}: {
  onSync: () => void;
  running: boolean;
}) {
  return (
    <div
      className="flex h-[calc(100svh-3rem)] flex-col items-center justify-center px-6 text-center"
      style={{ color: "var(--text-secondary)" }}
    >
      <Briefcase
        className="mb-3 h-12 w-12"
        strokeWidth={1.25}
        style={{ color: "var(--text-muted)" }}
      />
      <h2
        className="mb-1 text-lg font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        아직 PR이 없어요
      </h2>
      <p className="mb-4 text-sm">
        동기화 버튼을 누르면 GitHub에서 PR을 가져옵니다.
      </p>
      <button
        type="button"
        onClick={onSync}
        disabled={running}
        className="rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50"
        style={{
          backgroundColor: "var(--btn-primary)",
          color: "var(--btn-primary-text)",
        }}
      >
        {running ? "동기화 중..." : "GitHub에서 가져오기"}
      </button>
    </div>
  );
}

function EmptyFilter({ filter }: { filter: ProjectFilter }) {
  const message =
    filter.kind === "uncategorized"
      ? "분류안됨 PR이 없습니다"
      : filter.kind === "excluded"
      ? "미사용으로 표시된 PR이 없습니다"
      : "이 프로젝트에는 PR이 없습니다";
  return (
    <div className="flex h-[calc(100svh-3rem)] items-center justify-center px-6">
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {message}
      </p>
    </div>
  );
}
