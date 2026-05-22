import { useEffect, useRef, useState } from "react";
import { MoreVertical, ChevronRight, Check, Sparkles } from "lucide-react";
import type { PortfolioProject, PortfolioWorkMeta } from "../../api/portfolio";
import {
  useDeletePortfolioWork,
  usePortfolioWork,
  useUpdatePortfolioFrontmatter,
} from "../../hooks/usePortfolio";
import { buildPRPrompt } from "../../lib/clipboardPrompt";

type Props = {
  work: PortfolioWorkMeta;
  projects: PortfolioProject[];
};

type SubMenu = null | "project";

// design v2.3 카드 메뉴:
//   "프로젝트 변경 →" (submenu, 라디오 list)
//   "미사용으로 표시 / 포함" (included 토글)
//   ─────
//   "영구 삭제" (accent-red-text)
export function PortfolioCardMenu({ work, projects }: Props) {
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<SubMenu>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const updateFm = useUpdatePortfolioFrontmatter(work.prSlug);
  const deleteWork = useDeletePortfolioWork();
  // Claude 프롬프트 build 에 PR description 본문 필요 → lazy 단일 카드 fetch.
  const fullWork = usePortfolioWork(open ? work.prSlug : undefined);
  const [promptCopied, setPromptCopied] = useState(false);

  // 외부 클릭 닫기 + ESC
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setSubmenu(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSubmenu(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setSubmenu(null);
  };

  const handleProjectChange = (slug: string) => {
    updateFm.mutate({ project: slug });
    close();
  };

  const handleIncludedToggle = () => {
    const fm = work.frontmatter;
    if (fm.included) {
      const ok = window.confirm(
        `"${fm.github_title}" 을(를) 평가 자료에서 제외합니다. 사이드바 "미사용" 필터에서 다시 켤 수 있어요.`,
      );
      if (!ok) {
        close();
        return;
      }
    }
    updateFm.mutate({ included: !fm.included });
    close();
  };

  const handleCopyPrompt = async () => {
    const fm = work.frontmatter;
    const description = fullWork.data?.description ?? "";
    const prompt = buildPRPrompt({
      title: fm.github_title,
      body: description,
      url: fm.github_pr_url,
      changedFiles: fm.github_changed_files,
      additions: fm.github_additions,
      deletions: fm.github_deletions,
    });
    try {
      await navigator.clipboard.writeText(prompt);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 1500);
    } catch {
      // ignore — UI 표시 X (간단 케이스)
    }
  };

  const handleDelete = () => {
    const ok = window.confirm(
      `"${work.frontmatter.github_title}" 카드를 휴지통으로 보냅니다. 진행할까요?`,
    );
    if (!ok) return;
    deleteWork.mutate(work.prSlug);
    close();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
          setSubmenu(null);
        }}
        title="카드 메뉴"
        className="flex h-7 w-7 items-center justify-center rounded-md transition"
        style={{ color: "var(--text-muted)" }}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-8 z-10 w-44 overflow-visible rounded-lg py-1 text-sm shadow-lg"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
          }}
        >
          <MenuItem
            label={promptCopied ? "프롬프트 복사됨" : "Claude 프롬프트 복사"}
            trailing={
              promptCopied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )
            }
            onClick={handleCopyPrompt}
          />
          <div
            className="my-1 h-px"
            style={{ backgroundColor: "var(--border-default)" }}
          />
          <MenuItem
            label="프로젝트 변경"
            trailing={<ChevronRight className="h-3.5 w-3.5" />}
            onMouseEnter={() => setSubmenu("project")}
            onClick={() => setSubmenu(submenu === "project" ? null : "project")}
          />
          <MenuItem
            label={work.frontmatter.included ? "미사용" : "포함"}
            onClick={handleIncludedToggle}
          />
          <div
            className="my-1 h-px"
            style={{ backgroundColor: "var(--border-default)" }}
          />
          <MenuItem
            label="삭제"
            danger
            onClick={handleDelete}
          />

          {submenu === "project" ? (
            <ProjectSubmenu
              projects={projects}
              currentSlug={work.frontmatter.project}
              onSelect={handleProjectChange}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  label,
  danger,
  trailing,
  onClick,
  onMouseEnter,
}: {
  label: string;
  danger?: boolean;
  trailing?: React.ReactNode;
  onClick: () => void;
  onMouseEnter?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className="flex w-full items-center justify-between px-3 py-1.5 text-left transition"
      style={{
        color: danger ? "var(--accent-red-text)" : "var(--text-primary)",
      }}
    >
      <span>{label}</span>
      {trailing ?? null}
    </button>
  );
}

function ProjectSubmenu({
  projects,
  currentSlug,
  onSelect,
}: {
  projects: PortfolioProject[];
  currentSlug: string;
  onSelect: (slug: string) => void;
}) {
  return (
    <div
      className="absolute left-full top-0 ml-1 w-48 rounded-lg py-1 shadow-lg"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
      }}
    >
      <RadioRow
        label="분류안됨"
        selected={!currentSlug}
        onSelect={() => onSelect("")}
      />
      {projects.length > 0 ? (
        <div
          className="my-1 h-px"
          style={{ backgroundColor: "var(--border-default)" }}
        />
      ) : null}
      {projects.map((p) => (
        <RadioRow
          key={p.slug}
          label={p.name}
          selected={currentSlug === p.slug}
          onSelect={() => onSelect(p.slug)}
        />
      ))}
    </div>
  );
}

function RadioRow({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition"
      style={{ color: "var(--text-primary)" }}
    >
      <span className="truncate">{label}</span>
      {selected ? (
        <Check
          className="h-3.5 w-3.5 shrink-0"
          style={{ color: "var(--text-secondary)" }}
        />
      ) : null}
    </button>
  );
}
