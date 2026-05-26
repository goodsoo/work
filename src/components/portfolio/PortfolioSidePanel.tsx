import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpDown,
  BookOpen,
  Check,
  Download,
  KeyRound,
  X,
} from "lucide-react";
import {
  usePortfolioProjects,
  usePortfolioWorks,
  type GhSyncProgress,
} from "../../hooks/usePortfolio";
import { GhAuthError, GhNotInstalledError } from "../../lib/portfolio/gh";
import type { PortfolioSortKey } from "../../hooks/usePortfolioSort";
import { PortfolioProjectList, type ProjectFilter } from "./PortfolioProjectList";
import { PortfolioGuideModal } from "./PortfolioGuideModal";
import { SyncButton } from "./SyncButton";
import { Button } from "../common/Button";
import { FilterItem } from "../common/FilterItem";
import { Popover } from "../common/Popover";
import { Text } from "../common/Text";

type Props = {
  activeFilter: ProjectFilter;
  onFilterChange: (next: ProjectFilter) => void;
  sortKey: PortfolioSortKey;
  onSortKeyChange: (next: PortfolioSortKey) => void;
  syncState: GhSyncProgress;
  onSyncRun: () => void;
  onSyncCancel: () => void;
  onFullSyncRun: () => void;
  // 사용자가 모달 닫은 후 다시 열 수 있도록 사이드바 inline 에서 trigger.
  onOpenInstallGuide: () => void;
  onOpenAuthGuide: () => void;
  // 사이드바 inline 에러 row 닫기.
  onDismissSyncError: () => void;
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
  onOpenInstallGuide,
  onOpenAuthGuide,
  onDismissSyncError,
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
        {!syncState.running && syncState.error ? (
          <SyncErrorRow
            error={syncState.error}
            onOpenInstallGuide={onOpenInstallGuide}
            onOpenAuthGuide={onOpenAuthGuide}
            onDismiss={onDismissSyncError}
          />
        ) : null}
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
        onOpenInstallGuide={onOpenInstallGuide}
        onOpenAuthGuide={onOpenAuthGuide}
      />
    </div>
  );
}

// sync error 시 사이드바 inline — 모달이 자동 뜨지만 닫은 후 다시 열 수 있도록 사이드바에도
// "어떤 에러였는지 + 다시 안내 열기" 트리거. 일반 (네트워크 등) 에러는 메시지만.
function SyncErrorRow({
  error,
  onOpenInstallGuide,
  onOpenAuthGuide,
  onDismiss,
}: {
  error: Error;
  onOpenInstallGuide: () => void;
  onOpenAuthGuide: () => void;
  onDismiss: () => void;
}) {
  let icon = <AlertCircle className="h-3.5 w-3.5 shrink-0" />;
  let label = "동기화 실패";
  let detail = "네트워크 연결을 확인하세요.";
  let action: { label: string; onClick: () => void } | null = null;

  if (error instanceof GhNotInstalledError) {
    icon = <Download className="h-3.5 w-3.5 shrink-0" />;
    label = "gh CLI 가 설치되지 않았습니다";
    detail = "터미널에서 설치 후 다시 시도하세요.";
    action = { label: "설치 가이드", onClick: onOpenInstallGuide };
  } else if (error instanceof GhAuthError) {
    icon = <KeyRound className="h-3.5 w-3.5 shrink-0" />;
    label = "GitHub 로그인이 필요합니다";
    detail = "gh auth login 후 다시 시도하세요.";
    action = { label: "로그인 가이드", onClick: onOpenAuthGuide };
  }

  return (
    <div
      role="alert"
      className="flex flex-col gap-1.5 rounded-md px-3 py-2 text-xs"
      style={{
        backgroundColor: "color-mix(in srgb, var(--accent-red) 10%, var(--bg-surface))",
        border: "1px solid color-mix(in srgb, var(--accent-red) 35%, transparent)",
        color: "var(--text-primary)",
      }}
    >
      <div
        className="flex items-start gap-1.5"
        style={{ color: "var(--accent-red)" }}
      >
        {icon}
        <span className="flex-1 font-medium">{label}</span>
        <Button
          variant="icon"
          onClick={onDismiss}
          title="알림 닫기"
          aria-label="알림 닫기"
          className="-mr-1 -mt-0.5 shrink-0 rounded-sm p-0.5"
          style={{ color: "var(--accent-red)", minHeight: 0 }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      <Text variant="caption" color="secondary" as="p" className="text-[11px] leading-snug">
        {detail}
      </Text>
      {action ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={action.onClick}
          className="self-start px-2 py-1 text-[11px]"
          style={{
            color: "var(--accent-red)",
            textDecoration: "underline",
            minHeight: 0,
          }}
        >
          {action.label} 열기
        </Button>
      ) : null}
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
