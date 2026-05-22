import { useEffect, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Trash2,
  EyeOff,
  Eye,
  GitBranch,
  Sparkles,
  Check,
  Loader2,
  Pencil,
} from "lucide-react";
import type {
  PortfolioCategory,
  PortfolioProject,
  PortfolioWorkMeta,
} from "../../api/portfolio";
import {
  useDeletePortfolioWork,
  usePortfolioWork,
  useUpdatePortfolioFrontmatter,
} from "../../hooks/usePortfolio";
import { useVault } from "../../lib/vault/useVault";
import { vaultAssetSrc } from "../../lib/portfolio/assetUrl";
import { relativeDateLabel } from "../../lib/dates";
import { buildPRPrompt, parsePRResponse } from "../../lib/clipboardPrompt";
import { runClaude } from "../../lib/portfolio/claude";
import { ResponsePasteArea } from "./ResponsePasteArea";
import { ScreenshotDropzone } from "./ScreenshotDropzone";

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
  work: PortfolioWorkMeta;
  projects: PortfolioProject[];
  onClose: () => void;
};

// 카드 클릭 시 열리는 detail / 편집 모달.
// 좌측: 큰 스크린샷 viewer + thumb strip + dropzone
// 우측: impact / 카테고리 / 프로젝트 / paste area / 메타 / included·삭제
export function PortfolioDetailModal({ work, projects, onClose }: Props) {
  const fm = work.frontmatter;
  const updateFm = useUpdatePortfolioFrontmatter(work.prSlug);
  const deleteWork = useDeletePortfolioWork();
  const { adapter } = useVault();
  const vaultRoot = adapter.getRoot();

  const [activeShot, setActiveShot] = useState(0);
  const [editing, setEditing] = useState(false);
  // edit mode draft — 수정 완료 누르면 mutate, 취소/닫기면 버림.
  const [impactDraft, setImpactDraft] = useState(fm.impact_summary);
  const [categoryDraft, setCategoryDraft] = useState<PortfolioCategory>(
    fm.category,
  );
  const [projectDraft, setProjectDraft] = useState(fm.project);
  const [promptCopied, setPromptCopied] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<
    { impact: string; category: PortfolioCategory } | null
  >(null);
  const fullWork = usePortfolioWork(work.prSlug);

  const resetDraft = () => {
    setImpactDraft(fm.impact_summary);
    setCategoryDraft(fm.category);
    setProjectDraft(fm.project);
    setSuggestion(null);
    setRequestError(null);
  };

  const handleEnterEdit = () => {
    resetDraft();
    setEditing(true);
  };
  const handleCancelEdit = () => {
    resetDraft();
    setEditing(false);
  };
  const handleSaveEdit = () => {
    const trimmedImpact = impactDraft.trim();
    updateFm.mutate({
      impact_summary: trimmedImpact,
      category: categoryDraft,
      project: projectDraft,
    });
    setEditing(false);
    setSuggestion(null);
  };

  // 모달 닫기 — edit mode 중이면 변경 자동 취소 + 닫기.
  const handleClose = () => {
    if (editing) resetDraft();
    setEditing(false);
    onClose();
  };

  const screenshotSrc = (path: string) => vaultAssetSrc(vaultRoot, path);
  const categoryLabel = CATEGORY_LABEL[fm.category] ?? fm.category;
  const categoryColor = CATEGORY_COLOR[fm.category] ?? "var(--cat-other)";
  const relTime = fm.github_merged_at
    ? relativeDateLabel(fm.github_merged_at.slice(0, 10))
    : "";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editing) {
          handleCancelEdit();
        } else {
          handleClose();
        }
        return;
      }
      if (fm.screenshots.length === 0) return;
      if (e.key === "ArrowLeft") {
        setActiveShot((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        setActiveShot((i) => Math.min(fm.screenshots.length - 1, i + 1));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, fm.screenshots.length]);

  const handleDelete = () => {
    const ok = window.confirm(
      `"${fm.github_title}" 카드를 휴지통으로 보냅니다. 진행할까요?`,
    );
    if (!ok) return;
    deleteWork.mutate(work.prSlug);
    onClose();
  };

  const handleIncludedToggle = () => {
    if (fm.included) {
      const ok = window.confirm(
        `"${fm.github_title}" 을(를) 평가 자료에서 제외합니다. 카드 목록 "미사용" 필터에서 다시 켤 수 있어요.`,
      );
      if (!ok) return;
    }
    updateFm.mutate({ included: !fm.included });
  };

  const buildPrompt = (): string => {
    const description = fullWork.data?.description ?? "";
    return buildPRPrompt({
      title: fm.github_title,
      body: description,
      url: fm.github_pr_url,
      changedFiles: fm.github_changed_files,
      additions: fm.github_additions,
      deletions: fm.github_deletions,
    });
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildPrompt());
      setPromptCopied(true);
      window.setTimeout(() => setPromptCopied(false), 1500);
    } catch {
      // 무시
    }
  };

  const handleClaudeRequest = async () => {
    if (fullWork.isLoading) return;
    setRequesting(true);
    setRequestError(null);
    setSuggestion(null);
    try {
      const prompt = buildPrompt();
      const result = await runClaude(prompt);
      if (result.code !== 0) {
        const msg = result.stderr.trim();
        // claude 미설치 / 미인증 / 기타 — 가장 가능성 높은 두 가지를 anchor.
        if (/not found|command not found/i.test(msg)) {
          throw new Error(
            "claude CLI 가 안 보여요. 설치 후 `claude` 로그인을 먼저.",
          );
        }
        if (/auth|login|unauthor/i.test(msg)) {
          throw new Error(
            "claude 로그인이 필요해요. 터미널에서 `claude` 실행 후 인증해주세요.",
          );
        }
        throw new Error(msg || "claude CLI 실행 실패");
      }
      const parsed = parsePRResponse(result.stdout);
      if (!parsed) {
        throw new Error(
          "응답 형식을 못 알아봤어요. 아래 paste 영역으로 직접 진행해주세요.",
        );
      }
      // 자동 저장 X — preview 박스에 제안만 노출. 사용자가 [적용] 누르면 mutate.
      setSuggestion({ impact: parsed.impact, category: parsed.category });
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : String(err));
    } finally {
      setRequesting(false);
    }
  };

  // edit mode 안에서 호출됨. draft 에만 반영 — [수정 완료] 누를 때 실제 mutate.
  const applySuggestion = () => {
    if (!suggestion) return;
    setImpactDraft(suggestion.impact);
    setCategoryDraft(suggestion.category);
    setSuggestion(null);
  };

  const currentShot = fm.screenshots[activeShot];

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: "var(--bg-overlay)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-5xl flex-col overflow-hidden rounded-xl"
        style={{
          backgroundColor: "var(--bg-base)",
          border: "1px solid var(--border-default)",
          maxHeight: "85vh",
        }}
      >
        {/* 헤더 */}
        <div
          className="flex items-center gap-3 border-b px-5 py-3"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <span
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs"
            style={{
              backgroundColor: "var(--bg-surface-hover)",
              color: "var(--text-secondary)",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: categoryColor }}
            />
            {categoryLabel}
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {fm.github_owner}/{fm.github_repo}
            {fm.github_pr_number > 0 ? ` · PR #${fm.github_pr_number}` : ""}
            {relTime ? ` · ${relTime}` : ""}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition"
                  style={{
                    backgroundColor: "var(--btn-primary)",
                    color: "var(--btn-primary-text)",
                    minHeight: 0,
                  }}
                  title="변경 저장"
                >
                  <Check className="h-3.5 w-3.5" />
                  수정 완료
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition"
                  style={{
                    backgroundColor: "var(--bg-surface-hover)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-default)",
                    minHeight: 0,
                  }}
                  title="변경 버리기 (ESC)"
                >
                  취소
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleEnterEdit}
                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition"
                style={{
                  backgroundColor: "var(--bg-surface-hover)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-default)",
                  minHeight: 0,
                }}
                title="편집 모드 진입"
              >
                <Pencil className="h-3.5 w-3.5" />
                편집
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              title="닫기 (ESC)"
              className="flex h-8 w-8 items-center justify-center rounded-md transition"
              style={{ color: "var(--text-secondary)" }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 본문 — 좌 viewer / 우 편집. grid row 강제 1fr (컨텐츠가 85vh 넘어도 cell 이 grid 영역만 차지하도록). */}
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden md:grid-cols-[1.2fr_1fr]">
          {/* 좌측: 스크린샷 viewer — scroll content + sticky dropzone footer */}
          <div
            className="flex min-h-0 flex-col overflow-hidden border-b md:border-b-0 md:border-r"
            style={{ borderColor: "var(--border-subtle)" }}
          >
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            <div
              className="relative flex min-h-[280px] flex-1 items-center justify-center overflow-hidden rounded-lg"
              style={{ backgroundColor: "var(--bg-surface-hover)" }}
            >
              {currentShot ? (
                <>
                  <img
                    src={screenshotSrc(currentShot.path)}
                    alt={currentShot.caption || fm.github_title}
                    className="max-h-full max-w-full object-contain"
                  />
                  {fm.screenshots.length > 1 ? (
                    <>
                      {activeShot > 0 ? (
                        <button
                          type="button"
                          onClick={() => setActiveShot((i) => i - 1)}
                          className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition"
                          style={{
                            backgroundColor: "var(--bg-overlay)",
                            color: "var(--text-primary)",
                          }}
                          title="이전 (←)"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                      ) : null}
                      {activeShot < fm.screenshots.length - 1 ? (
                        <button
                          type="button"
                          onClick={() => setActiveShot((i) => i + 1)}
                          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition"
                          style={{
                            backgroundColor: "var(--bg-overlay)",
                            color: "var(--text-primary)",
                          }}
                          title="다음 (→)"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      ) : null}
                      <div
                        className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md px-2 py-0.5 text-[11px]"
                        style={{
                          backgroundColor: "var(--bg-overlay)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {activeShot + 1} / {fm.screenshots.length}
                        {currentShot.label ? ` · ${currentShot.label}` : ""}
                      </div>
                    </>
                  ) : currentShot.label ? (
                    <div
                      className="absolute bottom-2 left-2 rounded-md px-2 py-0.5 text-[11px]"
                      style={{
                        backgroundColor: "var(--bg-overlay)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {currentShot.label}
                    </div>
                  ) : null}
                </>
              ) : (
                <div
                  className="flex flex-col items-center gap-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  <GitBranch className="h-6 w-6" strokeWidth={1.5} />
                  <span className="text-xs">스크린샷 없음 — 아래에서 드롭/클릭</span>
                </div>
              )}
            </div>

            {/* thumbnail strip */}
            {fm.screenshots.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto">
                {fm.screenshots.map((s, i) => (
                  <button
                    key={s.path + i}
                    type="button"
                    onClick={() => setActiveShot(i)}
                    className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md transition"
                    style={{
                      border:
                        i === activeShot
                          ? "2px solid var(--text-primary)"
                          : "1px solid var(--border-default)",
                    }}
                    title={s.caption || s.path}
                  >
                    <img
                      src={screenshotSrc(s.path)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}

          </div>
            {/* dropzone — edit mode 에서만 노출. 업로드는 즉시 vault 적용 (취소와 무관). */}
            {editing ? (
              <div
                className="flex shrink-0 gap-2 border-t px-4 py-3"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div className="flex-1">
                  <ScreenshotDropzone
                    prSlug={work.prSlug}
                    existing={fm.screenshots}
                    label="before"
                  />
                </div>
                <div className="flex-1">
                  <ScreenshotDropzone
                    prSlug={work.prSlug}
                    existing={fm.screenshots}
                    label="after"
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* 우측: 편집 패널 — scroll content + sticky footer */}
          <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            <Field label="한 줄 임팩트">
              {editing ? (
                <input
                  value={impactDraft}
                  onChange={(e) => setImpactDraft(e.target.value)}
                  placeholder="60자 이내 한 문장"
                  maxLength={60}
                  className="w-full rounded-md px-2 py-1.5 text-sm font-semibold"
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              ) : (
                <div
                  className="break-words text-sm font-semibold"
                  style={{
                    color: fm.impact_summary
                      ? "var(--text-primary)"
                      : "var(--text-muted)",
                    fontStyle: fm.impact_summary ? "normal" : "italic",
                  }}
                >
                  {fm.impact_summary || "한 줄 임팩트 추가 필요"}
                </div>
              )}
            </Field>

            <Field label="PR 제목">
              <div className="flex items-start gap-2">
                <div
                  className="min-w-0 flex-1 break-words text-sm"
                  style={{ color: "var(--text-primary)" }}
                >
                  {fm.github_title}
                </div>
                {fm.github_pr_url ? (
                  <a
                    href={fm.github_pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] transition hover:underline"
                    style={{ color: "var(--text-secondary)" }}
                    title={fm.github_pr_url}
                  >
                    <ExternalLink className="h-3 w-3" />
                    깃헙에서 열기
                  </a>
                ) : null}
              </div>
            </Field>

            <Field label="카테고리">
              {editing ? (
                <select
                  value={categoryDraft}
                  onChange={(e) =>
                    setCategoryDraft(e.target.value as PortfolioCategory)
                  }
                  className="w-full rounded-md px-2 py-1.5 text-sm"
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="ui_ux">UI/UX</option>
                  <option value="backend">Backend</option>
                  <option value="infra">Infra</option>
                  <option value="fix">Fix</option>
                  <option value="other">기타</option>
                </select>
              ) : (
                <div
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm"
                  style={{
                    backgroundColor: "var(--bg-surface-hover)",
                    color: "var(--text-primary)",
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: categoryColor }}
                  />
                  {categoryLabel}
                </div>
              )}
            </Field>

            <Field label="프로젝트">
              {editing ? (
                <select
                  value={projectDraft}
                  onChange={(e) => setProjectDraft(e.target.value)}
                  className="w-full rounded-md px-2 py-1.5 text-sm"
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="">분류안됨</option>
                  {projects.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div
                  className="text-sm"
                  style={{
                    color: fm.project
                      ? "var(--text-primary)"
                      : "var(--text-muted)",
                  }}
                >
                  {fm.project
                    ? projects.find((p) => p.slug === fm.project)?.name ??
                      fm.project
                    : "분류안됨"}
                </div>
              )}
            </Field>

            {editing ? (
            <Field label="Claude 로 자동 채움">
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleClaudeRequest}
                  disabled={requesting || fullWork.isLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition disabled:opacity-60"
                  style={{
                    backgroundColor: "var(--btn-primary)",
                    color: "var(--btn-primary-text)",
                  }}
                >
                  {requesting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Claude 에게 묻는 중…
                    </>
                  ) : fullWork.isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      PR 본문 로딩…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Claude 한테 요청
                    </>
                  )}
                </button>
                <span
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  구독 사용량으로 호출. 본인 머신의 <code>claude</code> CLI 가 필요.
                </span>
                {requestError ? (
                  <div
                    className="rounded-md px-2.5 py-1.5 text-[11px]"
                    style={{
                      backgroundColor: "var(--accent-red-bg)",
                      color: "var(--accent-red-text)",
                    }}
                  >
                    {requestError}
                  </div>
                ) : null}

                {suggestion ? (
                  <div
                    className="flex flex-col gap-2 rounded-md p-3"
                    style={{
                      backgroundColor: "var(--bg-surface-hover)",
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    <span
                      className="text-[10px] uppercase tracking-wider"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Claude 제안
                    </span>
                    <div
                      className="text-sm font-semibold leading-snug"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {suggestion.impact}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px]"
                        style={{
                          backgroundColor: "var(--bg-surface)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            backgroundColor:
                              CATEGORY_COLOR[suggestion.category] ??
                              "var(--cat-other)",
                          }}
                        />
                        {CATEGORY_LABEL[suggestion.category] ?? suggestion.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={applySuggestion}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition"
                        style={{
                          backgroundColor: "var(--btn-primary)",
                          color: "var(--btn-primary-text)",
                        }}
                      >
                        <Check className="h-3.5 w-3.5" />
                        적용
                      </button>
                      <button
                        type="button"
                        onClick={handleClaudeRequest}
                        disabled={requesting}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition disabled:opacity-50"
                        style={{
                          color: "var(--text-secondary)",
                          border: "1px solid var(--border-default)",
                        }}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        다시 요청
                      </button>
                      <button
                        type="button"
                        onClick={() => setSuggestion(null)}
                        className="ml-auto flex h-7 w-7 items-center justify-center rounded-md transition"
                        style={{ color: "var(--text-muted)" }}
                        title="제안 닫기"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ) : null}

                <details className="mt-1">
                  <summary
                    className="cursor-pointer text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    직접 입력 (수동 paste)
                  </summary>
                  <div className="mt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      disabled={fullWork.isLoading}
                      className="inline-flex items-center gap-1.5 self-start rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-50"
                      style={{
                        backgroundColor: "var(--bg-surface-hover)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      {promptCopied ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {promptCopied ? "복사됨" : "프롬프트 복사"}
                    </button>
                    <ResponsePasteArea
                      onParsed={(impact, category) => {
                        setImpactDraft(impact);
                        setCategoryDraft(category as PortfolioCategory);
                      }}
                    />
                  </div>
                </details>
              </div>
            </Field>
            ) : null}

            <div
              className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t pt-3 text-[11px]"
              style={{
                borderColor: "var(--border-subtle)",
                color: "var(--text-muted)",
              }}
            >
              <span>변경:</span>
              <span>
                +{fm.github_additions} −{fm.github_deletions} ·{" "}
                {fm.github_changed_files} files
              </span>
              {fm.github_merged_at ? (
                <>
                  <span>병합:</span>
                  <span>{fm.github_merged_at.slice(0, 10)}</span>
                </>
              ) : null}
            </div>

          </div>
          {/* footer — scroll 밖, 항상 보임. solid 스타일 (Claude 요청 버튼 계열과 통일). */}
          <div
            className="flex shrink-0 items-center justify-end gap-2 border-t px-4 py-3"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <button
              type="button"
              onClick={handleIncludedToggle}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition"
              style={{
                backgroundColor: "var(--bg-surface-hover)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-default)",
                minHeight: 0,
              }}
              title={fm.included ? "평가 자료에서 제외" : "평가 자료에 포함"}
            >
              {fm.included ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              {fm.included ? "미사용" : "포함"}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition"
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
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="text-[11px] uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}
