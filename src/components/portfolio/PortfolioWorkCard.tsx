import { useState } from "react";
import { GitBranch } from "lucide-react";
import type { PortfolioProject, PortfolioWorkMeta } from "../../api/portfolio";
import { relativeDateLabel } from "../../lib/dates";
import { useUpdatePortfolioFrontmatter } from "../../hooks/usePortfolio";
import { useVault } from "../../lib/vault/useVault";
import { vaultAssetSrc } from "../../lib/portfolio/assetUrl";
import { PortfolioCardMenu } from "./PortfolioCardMenu";
import { ResponsePasteArea } from "./ResponsePasteArea";
import { ScreenshotDropzone } from "./ScreenshotDropzone";
import { ScreenshotLightbox } from "./ScreenshotLightbox";
import type { PortfolioCategory } from "../../api/portfolio";

const CATEGORY_LABEL: Record<string, string> = {
  ui_ux: "UI/UX",
  backend: "Backend",
  infra: "Infra",
  fix: "Fix",
  other: "기타",
};

type Props = {
  work: PortfolioWorkMeta;
  projects: PortfolioProject[];
  onClick?: () => void;
};

// design v2.3 카드 시각 위계:
//   1) 썸네일 (16:10) — 첫 스크린샷 또는 placeholder
//   2) 제목 (text-base font-semibold, 2줄 max)
//   3) 한 줄 임팩트 (text-sm text-secondary, 1줄)
//   4) 메타 row: category chip (left) + +N -M · n일 전 (right)
// monochrome chip (accent-blue 는 "회의" 전용). AI slop 회피.
// 우상단 "..." 메뉴 = step 7 (프로젝트 변경 / included 토글 / 영구 삭제).
export function PortfolioWorkCard({ work, projects, onClick }: Props) {
  const fm = work.frontmatter;
  const firstScreenshot = fm.screenshots[0];
  const relTime = fm.github_merged_at
    ? relativeDateLabel(fm.github_merged_at.slice(0, 10))
    : "";
  const categoryLabel = CATEGORY_LABEL[fm.category] ?? fm.category;
  const updateFm = useUpdatePortfolioFrontmatter(work.prSlug);
  const { adapter } = useVault();
  const vaultRoot = adapter.getRoot();
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  const screenshotSrc = (path: string) => vaultAssetSrc(vaultRoot, path);

  return (
    <div
      className="group relative flex w-full flex-col overflow-hidden rounded-lg text-left transition"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        opacity: fm.included ? 1 : 0.6,
      }}
    >
      {/* 썸네일 영역 (16:10) — 스크린샷 있으면 클릭 = lightbox, 없으면 placeholder */}
      <div
        className="flex aspect-[16/10] w-full cursor-pointer items-center justify-center overflow-hidden"
        style={{
          backgroundColor: "var(--bg-surface-hover)",
          borderBottom: "1px solid var(--border-default)",
        }}
        onClick={(e) => {
          if (firstScreenshot) {
            e.stopPropagation();
            setLightboxIndex(0);
          } else {
            onClick?.();
          }
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
          <div
            className="flex flex-col items-center gap-1.5"
            style={{ color: "var(--text-muted)" }}
          >
            <GitBranch className="h-5 w-5" strokeWidth={1.5} />
            <span className="text-xs">
              {fm.github_owner}/{fm.github_repo}
            </span>
          </div>
        )}
      </div>

      {/* 본문 (인라인 편집 가능) */}
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        {fm.github_pr_url ? (
          <a
            href={fm.github_pr_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
            className="line-clamp-2 text-base font-semibold transition hover:underline"
            style={{ color: "var(--text-primary)" }}
          >
            {fm.github_title}
          </a>
        ) : (
          // legacy 카드 (PR 없이 직접 커밋) — 외부 링크 없음
          <span
            className="line-clamp-2 text-base font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {fm.github_title}
          </span>
        )}
        <ImpactSummaryEdit
          value={fm.impact_summary}
          onSave={(next) => updateFm.mutate({ impact_summary: next })}
        />
        <div className="mt-1.5 flex items-center justify-between">
          <span
            className="rounded-md px-2 py-0.5 text-xs"
            style={{
              backgroundColor: "var(--bg-surface-hover)",
              color: "var(--text-secondary)",
            }}
          >
            {categoryLabel}
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            +{fm.github_additions} −{fm.github_deletions} · {relTime}
          </span>
        </div>
      </div>

      {/* "..." 메뉴 — card body 와 분리된 별도 sibling */}
      <div
        className="absolute right-2 top-2"
        onClick={(e) => e.stopPropagation()}
      >
        <PortfolioCardMenu work={work} projects={projects} />
      </div>

      {/* Claude 응답 paste — impact_summary 비었을 때만, 카드 아래쪽 */}
      {!fm.impact_summary ? (
        <div
          className="border-t px-4 py-2"
          style={{ borderColor: "var(--border-subtle)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <ResponsePasteArea
            onParsed={(impact, category) => {
              updateFm.mutate({
                impact_summary: impact,
                category: category as PortfolioCategory,
              });
            }}
          />
        </div>
      ) : null}

      {/* 스크린샷 strip + 드롭존 */}
      <div
        className="flex items-center gap-2 overflow-x-auto border-t px-3 py-2"
        style={{ borderColor: "var(--border-subtle)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {fm.screenshots.length > 0 ? (
          <>
            {fm.screenshots.map((s, i) => (
              <button
                key={s.path + i}
                type="button"
                onClick={() => setLightboxIndex(i)}
                className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md"
                style={{ border: "1px solid var(--border-default)" }}
                title={s.caption || s.path}
              >
                <img
                  src={screenshotSrc(s.path)}
                  alt={s.caption || ""}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                {s.label ? (
                  <span
                    className="absolute left-0.5 top-0.5 rounded px-1 text-[10px]"
                    style={{
                      backgroundColor: "var(--bg-surface)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {s.label}
                  </span>
                ) : null}
              </button>
            ))}
          </>
        ) : null}
        <div className="flex shrink-0 gap-1.5">
          <div className="w-28">
            <ScreenshotDropzone
              prSlug={work.prSlug}
              existing={fm.screenshots}
              label="before"
            />
          </div>
          <div className="w-28">
            <ScreenshotDropzone
              prSlug={work.prSlug}
              existing={fm.screenshots}
              label="after"
            />
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <ScreenshotLightbox
        screenshots={fm.screenshots}
        activeIndex={lightboxIndex}
        resolveSrc={screenshotSrc}
        onClose={() => setLightboxIndex(-1)}
        onNavigate={setLightboxIndex}
      />
    </div>
  );
}

// 인라인 편집 — value 클릭 → input, Enter/blur → 저장, Esc → 취소.
function ImpactSummaryEdit({
  value,
  onSave,
}: {
  value: string;
  onSave: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="line-clamp-1 w-full truncate text-left text-sm transition"
        style={{
          color: value ? "var(--text-secondary)" : "var(--text-muted)",
        }}
        title={value || "임팩트 미작성"}
      >
        {value || "임팩트 미작성"}
      </button>
    );
  }

  const commit = (next: string) => {
    setEditing(false);
    if (next !== value) onSave(next);
  };

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => commit(draft.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit(draft.trim());
        } else if (e.key === "Escape") {
          e.preventDefault();
          setEditing(false);
        }
      }}
      placeholder="한 줄 임팩트 입력"
      maxLength={60}
      className="w-full rounded-md px-1 py-0.5 text-sm"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        color: "var(--text-primary)",
      }}
    />
  );
}
