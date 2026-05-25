import { useMemo, useState } from "react";
import { ArrowUpDown, BookOpen, Check, X } from "lucide-react";
import {
  usePortfolioProjects,
  usePortfolioWorks,
  type GhSyncProgress,
} from "../../hooks/usePortfolio";
import {
  PORTFOLIO_CATEGORIES,
  type PortfolioCategory,
} from "../../api/portfolio";
import type { PortfolioSortKey } from "../../hooks/usePortfolioSort";
import { PortfolioProjectList, type ProjectFilter } from "./PortfolioProjectList";
import { PortfolioGuideModal } from "./PortfolioGuideModal";
import { SyncButton } from "./SyncButton";
import { Button } from "../common/Button";
import { SelectableChip } from "../common/SelectableChip";
import { Text } from "../common/Text";
import { Popover } from "../common/Popover";

type Props = {
  activeFilter: ProjectFilter;
  onFilterChange: (next: ProjectFilter) => void;
  sortKey: PortfolioSortKey;
  onSortKeyChange: (next: PortfolioSortKey) => void;
  selectedCategories: Set<PortfolioCategory>;
  onCategoryToggle: (cat: PortfolioCategory) => void;
  onCategoryClear: () => void;
  syncState: GhSyncProgress;
  onSyncRun: () => void;
  onSyncCancel: () => void;
  onFullSyncRun: () => void;
};

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

export function PortfolioSidePanel({
  activeFilter,
  onFilterChange,
  sortKey,
  onSortKeyChange,
  selectedCategories,
  onCategoryToggle,
  onCategoryClear,
  syncState,
  onSyncRun,
  onSyncCancel,
  onFullSyncRun,
}: Props) {
  const works = usePortfolioWorks();
  const projects = usePortfolioProjects();
  const [guideOpen, setGuideOpen] = useState(false);

  // 카테고리별 카운트 — included 만 (사이드바 chip 옆 표시).
  const categoryCounts = useMemo(() => {
    const map = new Map<PortfolioCategory, number>();
    for (const w of works.data ?? []) {
      if (!w.frontmatter.included) continue;
      const c = w.frontmatter.category;
      map.set(c, (map.get(c) ?? 0) + 1);
    }
    return map;
  }, [works.data]);

  return (
    <div className="relative flex h-full flex-col">
      {/* 헤더 — 메모장 패턴 통일 (페이지 헤더 높이 + 우측 icon row) */}
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
          포트폴리오
        </h2>
        <div className="flex items-center gap-0.5">
          <SortMenu value={sortKey} onChange={onSortKeyChange} />
          <Button
            variant="icon"
            onClick={() => setGuideOpen(true)}
            title="가이드북"
            aria-label="가이드북"
            style={{ color: "var(--text-secondary)" }}
          >
            <BookOpen className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 동기화 + 상태 — 헤더 아래 별도 영역. 프롬프트 도구는 가이드북 모달 안으로 이동. */}
      <div
        className="flex shrink-0 flex-col gap-2 px-3 pt-3 pb-3"
        style={{ borderBottom: "1px solid var(--border-default)" }}
      >
        <SyncButton
          state={syncState}
          onRun={onSyncRun}
          onCancel={onSyncCancel}
        />
        {!syncState.running && syncState.lastResult && !syncState.error ? (
          <div
            className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md px-3 py-1.5 text-xs"
            style={{
              backgroundColor: "var(--bg-surface-hover)",
              color: "var(--text-secondary)",
            }}
          >
            <span>
              <span
                title="이번에 새로 추가된 PR — vault 에 카드가 처음 만들어진 것"
                style={{ cursor: "help" }}
              >
                새 카드 {syncState.lastResult.added}
              </span>
              {" · "}
              <span
                title="이미 있던 카드의 GitHub 정보 (제목/머지일/통계) 만 새로 받아옴. 본인이 수정한 필드 (한 줄 임팩트/카테고리/프로젝트/스크린샷) 는 그대로 보존"
                style={{ cursor: "help" }}
              >
                갱신 {syncState.lastResult.preserved}
              </span>
              {" · "}
              <span title="GitHub 에서 가져온 머지된 PR 전체 갯수">
                전체 {syncState.lastResult.total}
              </span>
            </span>
          </div>
        ) : null}
      </div>

      {/* 카테고리 chip 필터 — 다중 OR. 비면 전체. */}
      <CategoryChipRow
        selected={selectedCategories}
        counts={categoryCounts}
        onToggle={onCategoryToggle}
        onClear={onCategoryClear}
      />

      <div className="flex-1 overflow-y-auto">
        <PortfolioProjectList
          projects={projects.data ?? []}
          works={works.data ?? []}
          activeFilter={activeFilter}
          onFilterChange={onFilterChange}
        />
      </div>

      <PortfolioGuideModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        onFullSyncRun={onFullSyncRun}
        fullSyncRunning={syncState.running}
      />
    </div>
  );
}

// 카테고리 chip 다중 OR 필터. 메모장 사이드바 정렬 popover 와 다르게 항상 노출
// — 카드 많아진 후 빠르게 좁히는 데 화면 진입성이 중요. 5개 chip 한 row 에
// flex-wrap (md 컬럼 너비에서 보통 한 줄 ~ 두 줄). 헤더 우측에 선택 해제 버튼.
function CategoryChipRow({
  selected,
  counts,
  onToggle,
  onClear,
}: {
  selected: Set<PortfolioCategory>;
  counts: Map<PortfolioCategory, number>;
  onToggle: (cat: PortfolioCategory) => void;
  onClear: () => void;
}) {
  const hasSelection = selected.size > 0;
  return (
    <div
      className="shrink-0 px-3 pt-3 pb-2"
      style={{ borderBottom: "1px solid var(--border-default)" }}
    >
      {/* 해제 버튼 토글로 row 높이 흔들리지 않게 h-4 고정 */}
      <div className="mb-1.5 flex h-4 items-center justify-between px-1">
        <Text
          variant="caption"
          color="muted"
          as="span"
          className="text-[10px] uppercase tracking-wider leading-none"
        >
          카테고리
        </Text>
        <button
          type="button"
          onClick={onClear}
          title="필터 해제"
          aria-label="필터 해제"
          className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wider leading-none transition hover:underline disabled:invisible"
          style={{ color: "var(--text-muted)", minHeight: 0 }}
          disabled={!hasSelection}
        >
          <X className="h-2.5 w-2.5" />
          해제
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {PORTFOLIO_CATEGORIES.map((cat) => {
          const active = selected.has(cat);
          const count = counts.get(cat) ?? 0;
          const color = CATEGORY_COLOR[cat];
          return (
            <SelectableChip
              key={cat}
              active={active}
              count={count}
              color={color}
              onToggle={() => onToggle(cat)}
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

const SORT_OPTIONS: Array<{ id: PortfolioSortKey; label: string }> = [
  { id: "merged_desc", label: "최신 PR" },
  { id: "merged_asc", label: "오래된 PR" },
  { id: "category", label: "카테고리" },
  { id: "project", label: "프로젝트" },
  { id: "impact", label: "영향 큰 순" },
];

function SortMenu({
  value,
  onChange,
}: {
  value: PortfolioSortKey;
  onChange: (next: PortfolioSortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      className="relative"
      panelClassName="absolute right-0 top-full z-30 mt-1 min-w-[140px] overflow-hidden rounded-md shadow-md"
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
                <Check
                  className="h-3 w-3"
                  style={{ color: "var(--text-secondary)" }}
                />
              ) : null}
            </Button>
          );
        })}
      </div>
    </Popover>
  );
}
