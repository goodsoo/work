import { useState } from "react";
import { Eye, GitBranch, Trash2 } from "lucide-react";
import type { PortfolioProject, PortfolioWorkMeta } from "../../api/portfolio";
import { formatDateShort } from "../../lib/dates";
import { useVault } from "../../lib/vault/useVault";
import { vaultAssetSrc } from "../../lib/portfolio/assetUrl";
import {
  useDeletePortfolioWork,
  useUpdatePortfolioFrontmatter,
} from "../../hooks/usePortfolio";
import { PortfolioCardMenu } from "./PortfolioCardMenu";
import { PortfolioDetailModal } from "./PortfolioDetailModal";

const CATEGORY_LABEL: Record<string, string> = {
  ui_ux: "UI/UX",
  backend: "Backend",
  infra: "Infra",
  fix: "Fix",
  other: "기타",
};

const CATEGORY_COLOR: Record<string, string> = {
  ui_ux: "var(--cat-uiux)",
  backend: "var(--cat-backend)",
  infra: "var(--cat-infra)",
  fix: "var(--cat-fix)",
  other: "var(--cat-other)",
};

type Props = {
  work: PortfolioWorkMeta;
  projects: PortfolioProject[];
};

// F-1 카드 시각 위계 (portfolio-card-redesign):
//   1) 가로 row — 썸네일 96x72 left + 본문 right
//   2) impact_summary 메인 (14px semibold primary). 빈 카드는 dashed border + italic placeholder
//   3) PR 제목 = 부제 (11px mono secondary truncate)
//   4) 메타 row: 카테고리 dot chip + +N -M · n일 전
// 카드 본체 클릭 = PortfolioDetailModal — 큰 viewer + 모든 편집 통합.
// 우상단 "..." 메뉴 = 빠른 액션 (프로젝트 변경 / included 토글 / 영구 삭제 / Claude 프롬프트).
export function PortfolioWorkCard({ work, projects }: Props) {
  const fm = work.frontmatter;
  const firstScreenshot = fm.screenshots[0];
  const dateLabel = fm.github_merged_at
    ? formatDateShort(fm.github_merged_at.slice(0, 10))
    : "";
  const categoryLabel = CATEGORY_LABEL[fm.category] ?? fm.category;
  const categoryColor = CATEGORY_COLOR[fm.category] ?? "var(--cat-other)";
  // 프로젝트 chip = projects.md 의 name 에서 "owner/" prefix 제거 (repo 부분만).
  // 본인이 한국어로 rename 했으면 그대로 (slash 없으니).
  const fullProjectName = fm.project
    ? projects.find((p) => p.slug === fm.project)?.name ?? fm.project
    : null;
  const projectLabel = fullProjectName
    ? fullProjectName.includes("/")
      ? fullProjectName.slice(fullProjectName.indexOf("/") + 1)
      : fullProjectName
    : null;
  const { adapter } = useVault();
  const vaultRoot = adapter.getRoot();
  const [modalOpen, setModalOpen] = useState(false);
  const updateFm = useUpdatePortfolioFrontmatter(work.prSlug);
  const deleteWork = useDeletePortfolioWork();

  const screenshotSrc = (path: string) => vaultAssetSrc(vaultRoot, path);
  const isEmpty = !fm.impact_summary;
  const excluded = !fm.included;

  const handleRestore = () => {
    updateFm.mutate({ included: true });
  };

  const handleDelete = () => {
    if (!window.confirm(`"${fm.github_title}" 카드를 휴지통으로 보냅니다. 진행할까요?`)) return;
    deleteWork.mutate(work.prSlug);
  };

  // 미사용 카드 (included: false) — 클릭으로 모달 진입 X, footer 에 inline 복원/삭제만.
  if (excluded) {
    return (
      <div
        className="relative flex w-full items-stretch gap-3 rounded-lg p-3"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          opacity: 0.7,
        }}
      >
        <div
          className="flex h-[72px] w-24 shrink-0 items-center justify-center overflow-hidden rounded-md"
          style={{
            backgroundColor: "var(--bg-surface-hover)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {firstScreenshot ? (
            <img
              src={screenshotSrc(firstScreenshot.path)}
              alt={firstScreenshot.caption || fm.github_title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <GitBranch
              className="h-5 w-5"
              strokeWidth={1.5}
              style={{ color: "var(--text-muted)" }}
            />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span
            className="line-clamp-2 text-sm leading-snug"
            style={{
              color: isEmpty ? "var(--text-muted)" : "var(--text-primary)",
              fontStyle: isEmpty ? "italic" : "normal",
              fontWeight: isEmpty ? 500 : 600,
            }}
            title={fm.impact_summary || "한 줄 임팩트 추가 필요"}
          >
            {fm.impact_summary || "한 줄 임팩트 추가 필요"}
          </span>
          <span
            className="truncate font-mono text-[11px]"
            style={{ color: "var(--text-secondary)" }}
            title={fm.github_title}
          >
            {fm.github_title}
          </span>
          <div className="mt-auto flex flex-nowrap items-center gap-x-1.5 overflow-hidden pt-1">
            {dateLabel ? (
              <span
                className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px]"
                style={{
                  backgroundColor: "var(--bg-surface-hover)",
                  color: "var(--text-secondary)",
                }}
                title={`병합일: ${fm.github_merged_at?.slice(0, 10) ?? ""}`}
              >
                {dateLabel}
              </span>
            ) : null}
            {projectLabel ? (
              <span
                className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px]"
                style={{
                  backgroundColor: "var(--bg-surface-hover)",
                  color: "var(--text-secondary)",
                }}
                title={fullProjectName ?? ""}
              >
                {projectLabel}
              </span>
            ) : null}
            <span
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px]"
              style={{
                backgroundColor: "var(--bg-surface-hover)",
                color: "var(--text-secondary)",
              }}
              title={`카테고리: ${categoryLabel}`}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: categoryColor }}
              />
              {categoryLabel}
            </span>
            <span
              className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px]"
              style={{
                backgroundColor: "var(--bg-surface-hover)",
                color: "var(--text-muted)",
              }}
              title={`변경: +${fm.github_additions} −${fm.github_deletions} · ${fm.github_changed_files} files`}
            >
              +{fm.github_additions} −{fm.github_deletions}
            </span>
          </div>
          <div className="flex items-center justify-end gap-1.5 pt-1.5">
            <button
              type="button"
              onClick={handleRestore}
              className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md px-2 text-xs font-medium transition"
              style={{
                backgroundColor: "var(--bg-surface-hover)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-default)",
                minHeight: 0,
              }}
              title="평가 자료에 포함"
            >
              <Eye className="h-3.5 w-3.5" />
              복원
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md px-2 text-xs font-medium transition"
              style={{
                backgroundColor: "var(--accent-red-bg)",
                color: "var(--accent-red-text)",
                border: "1px solid var(--accent-red)",
                minHeight: 0,
              }}
              title="휴지통으로 보내기"
            >
              <Trash2 className="h-3.5 w-3.5" />
              삭제
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setModalOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setModalOpen(true);
          }
        }}
        className="group relative flex w-full cursor-pointer items-stretch gap-3 rounded-lg p-3 pr-9 text-left transition hover:border-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: isEmpty
            ? "1px dashed var(--border-default)"
            : "1px solid var(--border-default)",
        }}
      >
        <div
          className="flex h-[72px] w-24 shrink-0 items-center justify-center overflow-hidden rounded-md"
          style={{
            backgroundColor: "var(--bg-surface-hover)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {firstScreenshot ? (
            <img
              src={screenshotSrc(firstScreenshot.path)}
              alt={firstScreenshot.caption || fm.github_title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <GitBranch
              className="h-5 w-5"
              strokeWidth={1.5}
              style={{ color: "var(--text-muted)" }}
            />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span
            className="line-clamp-2 text-sm leading-snug"
            style={{
              color: isEmpty ? "var(--text-muted)" : "var(--text-primary)",
              fontStyle: isEmpty ? "italic" : "normal",
              fontWeight: isEmpty ? 500 : 600,
            }}
            title={fm.impact_summary || "한 줄 임팩트 추가 필요"}
          >
            {fm.impact_summary || "한 줄 임팩트 추가 필요"}
          </span>
          <span
            className="truncate font-mono text-[11px]"
            style={{ color: "var(--text-secondary)" }}
            title={fm.github_title}
          >
            {fm.github_title}
          </span>
          <div className="mt-auto flex flex-nowrap items-center gap-x-1.5 overflow-hidden pt-1">
            {dateLabel ? (
              <span
                className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px]"
                style={{
                  backgroundColor: "var(--bg-surface-hover)",
                  color: "var(--text-secondary)",
                }}
                title={`병합일: ${fm.github_merged_at?.slice(0, 10) ?? ""}`}
              >
                {dateLabel}
              </span>
            ) : null}
            {projectLabel ? (
              <span
                className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px]"
                style={{
                  backgroundColor: "var(--bg-surface-hover)",
                  color: "var(--text-secondary)",
                }}
                title={fullProjectName ?? ""}
              >
                {projectLabel}
              </span>
            ) : null}
            <span
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px]"
              style={{
                backgroundColor: "var(--bg-surface-hover)",
                color: "var(--text-secondary)",
              }}
              title={`카테고리: ${categoryLabel}`}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: categoryColor }}
              />
              {categoryLabel}
            </span>
            <span
              className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px]"
              style={{
                backgroundColor: "var(--bg-surface-hover)",
                color: "var(--text-muted)",
              }}
              title={`변경: +${fm.github_additions} −${fm.github_deletions} · ${fm.github_changed_files} files`}
            >
              +{fm.github_additions} −{fm.github_deletions}
            </span>
          </div>
        </div>

        {/* "..." 메뉴 — 카드 클릭과 분리 (stopPropagation) */}
        <div
          className="absolute right-2 top-2"
          onClick={(e) => e.stopPropagation()}
        >
          <PortfolioCardMenu work={work} />
        </div>
      </div>

      {modalOpen ? (
        <PortfolioDetailModal
          work={work}
          projects={projects}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </>
  );
}
