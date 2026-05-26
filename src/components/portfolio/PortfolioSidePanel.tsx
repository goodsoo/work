import { useMemo, useState } from "react";
import { ArrowUpDown, BookOpen, Check } from "lucide-react";
import {
  usePortfolioProjects,
  usePortfolioWorks,
  type GhSyncProgress,
} from "../../hooks/usePortfolio";
import type { PortfolioSortKey } from "../../hooks/usePortfolioSort";
import { PortfolioProjectList, type ProjectFilter } from "./PortfolioProjectList";
import { PortfolioGuideModal } from "./PortfolioGuideModal";
import { SyncButton } from "./SyncButton";
import { Button } from "../common/Button";
import { FilterItem } from "../common/FilterItem";
import { Popover } from "../common/Popover";

type Props = {
  activeFilter: ProjectFilter;
  onFilterChange: (next: ProjectFilter) => void;
  sortKey: PortfolioSortKey;
  onSortKeyChange: (next: PortfolioSortKey) => void;
  syncState: GhSyncProgress;
  onSyncRun: () => void;
  onSyncCancel: () => void;
  onFullSyncRun: () => void;
};

export function PortfolioSidePanel({
  activeFilter,
  onFilterChange,
  sortKey,
  onSortKeyChange,
  syncState,
  onSyncRun,
  onSyncCancel,
  onFullSyncRun,
}: Props) {
  const works = usePortfolioWorks();
  const projects = usePortfolioProjects();
  const [guideOpen, setGuideOpen] = useState(false);

  // "미사용" entry 의 count — included=false 인 카드 수. 0 이어도 항상 노출
  // (할일 사이드바 "취소됨" 패턴과 동일).
  const excludedCount = useMemo(
    () => (works.data ?? []).filter((w) => !w.frontmatter.included).length,
    [works.data],
  );

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
          내 작업
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

      <div className="flex-1 overflow-y-auto">
        <PortfolioProjectList
          projects={projects.data ?? []}
          works={works.data ?? []}
          activeFilter={activeFilter}
          onFilterChange={onFilterChange}
        />
      </div>

      {/* 미사용 — 사이드바 하단 별도 entry. 할일 "취소됨" 패턴과 동일.
          좌우 padding 1 = 메모장 트리 root + 할일 사이드바 와 동일. */}
      <div
        className="px-1 py-2"
        style={{ borderTop: "1px solid var(--border-default)" }}
      >
        <FilterItem
          label="미사용"
          count={excludedCount}
          muted
          active={activeFilter.kind === "excluded"}
          onClick={() => onFilterChange({ kind: "excluded" })}
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
