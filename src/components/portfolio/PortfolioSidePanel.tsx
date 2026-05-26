import { useMemo, useRef, useState } from "react";
import { FolderPlus, Plus } from "lucide-react";
import {
  usePortfolioWorks,
  type GhSyncProgress,
} from "../../hooks/usePortfolio";
import {
  PortfolioSourceTree,
  type PortfolioSourceTreeHandle,
  type SourceFilter,
} from "./PortfolioSourceTree";
import { PortfolioCreateModal } from "./PortfolioCreateModal";
import { SyncButton } from "./SyncButton";
import { Button } from "../common/Button";
import { FilterItem } from "../common/FilterItem";

type Props = {
  activeFilter: SourceFilter;
  onFilterChange: (next: SourceFilter) => void;
  syncState: GhSyncProgress;
  onSyncRun: () => void;
  onSyncCancel: () => void;
};

export function PortfolioSidePanel({
  activeFilter,
  onFilterChange,
  syncState,
  onSyncRun,
  onSyncCancel,
}: Props) {
  const works = usePortfolioWorks();
  const [createOpen, setCreateOpen] = useState(false);
  const sourceTreeRef = useRef<PortfolioSourceTreeHandle>(null);

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
          포트폴리오
        </h2>
        <div className="flex items-center gap-0.5">
          <Button
            variant="icon"
            onClick={() => sourceTreeRef.current?.createAndEdit()}
            title="새 폴더"
            aria-label="새 폴더"
            style={{ color: "var(--text-secondary)" }}
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button
            variant="icon"
            onClick={() => setCreateOpen(true)}
            title="새 카드 — PR 없이 직접 추가"
            aria-label="새 카드"
            style={{ color: "var(--text-secondary)" }}
          >
            <Plus className="h-4 w-4" />
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
        <PortfolioSourceTree
          ref={sourceTreeRef}
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

      <PortfolioCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}

// SortMenu 는 PortfolioSortMenu.tsx 로 분리되어 본문 CategoryChipRow 의 오른쪽 끝에서 띄움.
