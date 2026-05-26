import { useMemo } from "react";
import { LayoutGrid } from "lucide-react";
import {
  usePortfolioProjects,
  usePortfolioWorks,
} from "../hooks/usePortfolio";
import { PortfolioWorkCard } from "../components/portfolio/PortfolioWorkCard";
import type { ProjectFilter } from "../components/portfolio/PortfolioProjectList";
import {
  PORTFOLIO_CATEGORIES,
  type PortfolioCategory,
  type PortfolioProject,
  type PortfolioWorkMeta,
} from "../api/portfolio";
import type { PortfolioSortKey } from "../hooks/usePortfolioSort";
import type { PortfolioCategoryFilter } from "../hooks/usePortfolioCategoryFilter";
import { PageHeaderBar } from "../components/common/PageHeaderBar";
import { Text } from "../components/common/Text";
import { Button } from "../components/common/Button";
import { SelectableChip } from "../components/common/SelectableChip";
import { EmptyState } from "../components/common/EmptyState";

const CATEGORY_LABEL: Record<PortfolioCategory, string> = {
  ui_ux: "UI/UX",
  backend: "Backend",
  infra: "Infra",
  fix: "Fix",
  other: "기타",
};

const CATEGORY_COLOR: Record<PortfolioCategory, string> = {
  ui_ux: "var(--cat-uiux)",
  backend: "var(--cat-backend)",
  infra: "var(--cat-infra)",
  fix: "var(--cat-fix)",
  other: "var(--cat-other)",
};

type Props = {
  activeFilter: ProjectFilter;
  sortKey: PortfolioSortKey;
  selectedCategory: PortfolioCategoryFilter;
  onCategoryChange: (next: PortfolioCategoryFilter) => void;
  onSync: () => void;
  syncRunning: boolean;
};

function applyProjectFilter(
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

function applyCategoryFilter(
  works: PortfolioWorkMeta[],
  selected: PortfolioCategoryFilter,
): PortfolioWorkMeta[] {
  if (selected === "all") return works;
  return works.filter((w) => w.frontmatter.category === selected);
}

// 정렬 — sort 옵션에 따라 비교. 안정 정렬 보장 위해 동률은 mtime desc tiebreaker.
function applySort(
  works: PortfolioWorkMeta[],
  sortKey: PortfolioSortKey,
  projects: PortfolioProject[],
): PortfolioWorkMeta[] {
  const projectOrder = new Map<string, number>();
  projects.forEach((p, i) => projectOrder.set(p.slug, p.sort * 1000 + i));
  const categoryOrder = new Map<PortfolioCategory, number>();
  PORTFOLIO_CATEGORIES.forEach((c, i) => categoryOrder.set(c, i));

  const cmpMergedDesc = (a: PortfolioWorkMeta, b: PortfolioWorkMeta): number => {
    const da = a.frontmatter.github_merged_at;
    const db = b.frontmatter.github_merged_at;
    if (da !== db) return db.localeCompare(da);
    return b.mtime - a.mtime;
  };

  const arr = [...works];
  switch (sortKey) {
    case "merged_desc":
      arr.sort(cmpMergedDesc);
      break;
    case "merged_asc":
      arr.sort((a, b) => {
        const da = a.frontmatter.github_merged_at;
        const db = b.frontmatter.github_merged_at;
        if (da !== db) return da.localeCompare(db);
        return a.mtime - b.mtime;
      });
      break;
    case "category":
      arr.sort((a, b) => {
        const oa = categoryOrder.get(a.frontmatter.category) ?? 999;
        const ob = categoryOrder.get(b.frontmatter.category) ?? 999;
        if (oa !== ob) return oa - ob;
        return cmpMergedDesc(a, b);
      });
      break;
    case "project":
      arr.sort((a, b) => {
        // 분류안됨 (빈 string) 은 맨 뒤
        const pa = a.frontmatter.project;
        const pb = b.frontmatter.project;
        if (!pa && pb) return 1;
        if (pa && !pb) return -1;
        if (pa !== pb) {
          const oa = projectOrder.get(pa) ?? 999999;
          const ob = projectOrder.get(pb) ?? 999999;
          if (oa !== ob) return oa - ob;
          return pa.localeCompare(pb);
        }
        return cmpMergedDesc(a, b);
      });
      break;
    case "impact":
      arr.sort((a, b) => {
        const ia =
          a.frontmatter.github_changed_files +
          a.frontmatter.github_additions +
          a.frontmatter.github_deletions;
        const ib =
          b.frontmatter.github_changed_files +
          b.frontmatter.github_additions +
          b.frontmatter.github_deletions;
        if (ia !== ib) return ib - ia;
        return cmpMergedDesc(a, b);
      });
      break;
  }
  return arr;
}

export function PortfolioPage({
  activeFilter,
  sortKey,
  selectedCategory,
  onCategoryChange,
  onSync,
  syncRunning,
}: Props) {
  const worksQuery = usePortfolioWorks();
  const projectsQuery = usePortfolioProjects();

  const filtered = useMemo(() => {
    const projects = projectsQuery.data ?? [];
    const all = worksQuery.data ?? [];
    const afterProject = applyProjectFilter(all, activeFilter);
    const afterCategory = applyCategoryFilter(afterProject, selectedCategory);
    return applySort(afterCategory, sortKey, projects);
  }, [
    worksQuery.data,
    projectsQuery.data,
    activeFilter,
    selectedCategory,
    sortKey,
  ]);

  // 카테고리별 카운트 — included 만 (chip 의 dim 처리에 사용).
  const categoryCounts = useMemo(() => {
    const map = new Map<PortfolioCategory, number>();
    for (const w of worksQuery.data ?? []) {
      if (!w.frontmatter.included) continue;
      const c = w.frontmatter.category;
      map.set(c, (map.get(c) ?? 0) + 1);
    }
    return map;
  }, [worksQuery.data]);

  const allWorks = worksQuery.data ?? [];

  return (
    <>
      <PortfolioHeader />
      {allWorks.length > 0 ? (
        <CategoryChipRow
          selected={selectedCategory}
          counts={categoryCounts}
          onChange={onCategoryChange}
        />
      ) : null}
      {worksQuery.isLoading ? (
        <SkeletonGrid count={6} />
      ) : allWorks.length === 0 ? (
        <EmptyVault onSync={onSync} running={syncRunning} />
      ) : filtered.length === 0 ? (
        <EmptyFilter
          filter={activeFilter}
          hasCategoryFilter={selectedCategory !== "all"}
        />
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

// 페이지 헤더 아래 sub-header — 카테고리 chip group (single radio). 옛 사이드바
// CategoryChipRow 를 본문 헤더로 옮긴 자리. 할일 페이지의 같은 자리와 통일.
// "전체" chip 1개 + 카테고리 5개 = 6개 chip 가로 wrap.
function CategoryChipRow({
  selected,
  counts,
  onChange,
}: {
  selected: PortfolioCategoryFilter;
  counts: Map<PortfolioCategory, number>;
  onChange: (next: PortfolioCategoryFilter) => void;
}) {
  return (
    <div
      className="shrink-0 px-6 py-3"
      style={{ borderBottom: "1px solid var(--border-default)" }}
    >
      <div className="flex flex-wrap gap-1">
        <SelectableChip
          active={selected === "all"}
          onToggle={() => onChange("all")}
          title="전체 카테고리"
        >
          전체
        </SelectableChip>
        {PORTFOLIO_CATEGORIES.map((cat) => {
          const active = selected === cat;
          const count = counts.get(cat) ?? 0;
          const color = CATEGORY_COLOR[cat];
          return (
            <SelectableChip
              key={cat}
              active={active}
              count={count}
              color={color}
              onToggle={() => onChange(cat)}
              title={`${CATEGORY_LABEL[cat]} ${count > 0 ? `(${count})` : ""}`.trim()}
            >
              {CATEGORY_LABEL[cat]}
            </SelectableChip>
          );
        })}
      </div>
    </div>
  );
}

function PortfolioHeader() {
  return (
    <PageHeaderBar
      center={
        <Text variant="h4" as="h1">
          포트폴리오
        </Text>
      }
    />
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
    <EmptyState
      className="flex h-[calc(100svh-3rem)] flex-col items-center justify-center gap-3 px-6 text-center"
      icon={
        <LayoutGrid
          className="h-12 w-12"
          strokeWidth={1.25}
          style={{ color: "var(--text-muted)" }}
        />
      }
      title="아직 PR이 없어요"
      description="동기화 버튼을 누르면 GitHub에서 PR을 가져옵니다."
      action={
        <Button
          variant="primary"
          onClick={onSync}
          disabled={running}
          className="px-4 py-2 disabled:opacity-50"
        >
          {running ? "동기화 중..." : "GitHub에서 가져오기"}
        </Button>
      }
    />
  );
}

function EmptyFilter({
  filter,
  hasCategoryFilter,
}: {
  filter: ProjectFilter;
  hasCategoryFilter: boolean;
}) {
  // 카테고리 필터가 같이 걸려 있으면 그쪽 메시지를 우선 — 사용자가 가장 최근 만진 필터.
  const message = hasCategoryFilter
    ? "선택한 카테고리에 해당하는 PR이 없습니다"
    : filter.kind === "uncategorized"
    ? "분류안됨 PR이 없습니다"
    : filter.kind === "excluded"
    ? "미사용으로 표시된 PR이 없습니다"
    : "이 프로젝트에는 PR이 없습니다";
  return (
    <EmptyState
      className="flex h-[calc(100svh-3rem)] flex-col items-center justify-center gap-3 px-6"
      description={message}
    />
  );
}
