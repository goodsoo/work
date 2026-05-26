import { useMemo, useState } from "react";
import { LayoutGrid, Settings2 } from "lucide-react";
import {
  usePortfolioCategories,
  usePortfolioWorks,
} from "../hooks/usePortfolio";
import { PortfolioWorkCard } from "../components/portfolio/PortfolioWorkCard";
import { PortfolioCategoryManageModal } from "../components/portfolio/PortfolioCategoryManageModal";
import { PortfolioSortMenu } from "../components/portfolio/PortfolioSortMenu";
import type { SourceFilter } from "../components/portfolio/PortfolioSourceTree";
import {
  folderPathOfCard,
  isGithubCard,
  type PortfolioCategoryDef,
  type PortfolioWorkMeta,
} from "../api/portfolio";
import type { PortfolioSortKey } from "../hooks/usePortfolioSort";
import type { PortfolioCategoryFilter } from "../hooks/usePortfolioCategoryFilter";
import { PageHeaderBar } from "../components/common/PageHeaderBar";
import { Text } from "../components/common/Text";
import { Button } from "../components/common/Button";
import { SelectableChip } from "../components/common/SelectableChip";
import { EmptyState } from "../components/common/EmptyState";

type Props = {
  activeFilter: SourceFilter;
  sortKey: PortfolioSortKey;
  onSortKeyChange: (next: PortfolioSortKey) => void;
  selectedCategory: PortfolioCategoryFilter;
  onCategoryChange: (next: PortfolioCategoryFilter) => void;
  onSync: () => void;
  syncRunning: boolean;
};

function applySourceFilter(
  works: PortfolioWorkMeta[],
  filter: SourceFilter,
): PortfolioWorkMeta[] {
  switch (filter.kind) {
    case "all":
      return works.filter((w) => w.frontmatter.included);
    case "github":
      return works.filter(
        (w) =>
          w.frontmatter.included &&
          isGithubCard(w.frontmatter) &&
          `${w.frontmatter.github_owner}/${w.frontmatter.github_repo}` ===
            filter.repo,
      );
    case "folder":
      return works.filter(
        (w) =>
          w.frontmatter.included &&
          !isGithubCard(w.frontmatter) &&
          folderPathOfCard(w.filePath) === filter.path,
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
// categories merged list 의 순서를 따라 카테고리 정렬 (builtin 5 → 사용자 추가).
// "project" 정렬은 github 카드 = repo nameWithOwner, 수동 카드 = vault folder path
// (root = 빈) 기준 — 즉 사이드바 트리 분류 자리와 1:1.
function applySort(
  works: PortfolioWorkMeta[],
  sortKey: PortfolioSortKey,
  categories: PortfolioCategoryDef[],
): PortfolioWorkMeta[] {
  const categoryOrder = new Map<string, number>();
  categories.forEach((c, i) => categoryOrder.set(c.slug, i));
  const sourceKey = (w: PortfolioWorkMeta): string => {
    if (isGithubCard(w.frontmatter)) {
      return `g:${w.frontmatter.github_owner}/${w.frontmatter.github_repo}`;
    }
    return `f:${folderPathOfCard(w.filePath)}`;
  };

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
        const oa = categoryOrder.get(a.frontmatter.category) ?? 9999;
        const ob = categoryOrder.get(b.frontmatter.category) ?? 9999;
        if (oa !== ob) return oa - ob;
        return cmpMergedDesc(a, b);
      });
      break;
    case "project":
      arr.sort((a, b) => {
        const ka = sourceKey(a);
        const kb = sourceKey(b);
        if (ka !== kb) return ka.localeCompare(kb);
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
  onSortKeyChange,
  selectedCategory,
  onCategoryChange,
  onSync,
  syncRunning,
}: Props) {
  const worksQuery = usePortfolioWorks();
  const categoriesQuery = usePortfolioCategories();

  const filtered = useMemo(() => {
    const categories = categoriesQuery.data ?? [];
    const all = worksQuery.data ?? [];
    const afterSource = applySourceFilter(all, activeFilter);
    const afterCategory = applyCategoryFilter(afterSource, selectedCategory);
    return applySort(afterCategory, sortKey, categories);
  }, [
    worksQuery.data,
    categoriesQuery.data,
    activeFilter,
    selectedCategory,
    sortKey,
  ]);

  // 카테고리별 카운트 — included 만 (chip 의 dim 처리에 사용).
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
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
          categories={categoriesQuery.data ?? []}
          onChange={onCategoryChange}
          sortKey={sortKey}
          onSortKeyChange={onSortKeyChange}
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
        <div className="px-6 pt-6 pb-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((w) => (
              <PortfolioWorkCard key={w.prSlug} work={w} />
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
  categories,
  onChange,
  sortKey,
  onSortKeyChange,
}: {
  selected: PortfolioCategoryFilter;
  counts: Map<string, number>;
  categories: PortfolioCategoryDef[];
  onChange: (next: PortfolioCategoryFilter) => void;
  sortKey: PortfolioSortKey;
  onSortKeyChange: (next: PortfolioSortKey) => void;
}) {
  const [manageOpen, setManageOpen] = useState(false);
  return (
    <div
      className="shrink-0 px-6 py-3"
      style={{ borderBottom: "1px solid var(--border-default)" }}
    >
      <div className="flex flex-wrap items-center gap-1">
        <SelectableChip
          active={selected === "all"}
          onToggle={() => onChange("all")}
          title="전체 카테고리"
        >
          전체
        </SelectableChip>
        {categories.map((cat) => {
          const active = selected === cat.slug;
          const count = counts.get(cat.slug) ?? 0;
          const color = cat.color ?? "var(--cat-other)";
          return (
            <SelectableChip
              key={cat.slug}
              active={active}
              count={count}
              color={color}
              onToggle={() => onChange(cat.slug)}
              title={`${cat.label} ${count > 0 ? `(${count})` : ""}`.trim()}
            >
              {cat.label}
            </SelectableChip>
          );
        })}
        <Button
          variant="icon"
          onClick={() => setManageOpen(true)}
          title="카테고리 관리"
          aria-label="카테고리 관리"
          className="ml-1"
          style={{ color: "var(--text-muted)" }}
        >
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
        <div className="ml-auto">
          <PortfolioSortMenu value={sortKey} onChange={onSortKeyChange} />
        </div>
      </div>
      <PortfolioCategoryManageModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
      />
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
  filter: SourceFilter;
  hasCategoryFilter: boolean;
}) {
  // 카테고리 필터가 같이 걸려 있으면 그쪽 메시지를 우선 — 사용자가 가장 최근 만진 필터.
  const message = hasCategoryFilter
    ? "선택한 카테고리에 해당하는 카드가 없습니다"
    : filter.kind === "excluded"
    ? "미사용으로 표시된 카드가 없습니다"
    : filter.kind === "github"
    ? "이 repo 의 카드가 없습니다"
    : filter.kind === "folder"
    ? "이 폴더에는 카드가 없습니다"
    : "카드가 없습니다";
  return (
    <EmptyState
      className="flex h-[calc(100svh-3rem)] flex-col items-center justify-center gap-3 px-6"
      description={message}
    />
  );
}
