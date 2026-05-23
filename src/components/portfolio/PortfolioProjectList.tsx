import { useMemo, type ReactNode } from "react";
import type {
  PortfolioProject,
  PortfolioWorkMeta,
} from "../../api/portfolio";
import { Button } from "../common/Button";
import { Text } from "../common/Text";

export type ProjectFilter =
  | { kind: "all" }
  | { kind: "uncategorized" }
  | { kind: "project"; slug: string }
  | { kind: "excluded" };

type Props = {
  projects: PortfolioProject[];
  works: PortfolioWorkMeta[];
  activeFilter: ProjectFilter;
  onFilterChange: (next: ProjectFilter) => void;
};

const COLOR_DOT: Record<string, string> = {
  blue: "var(--accent-blue)",
  red: "var(--accent-red)",
};

// name 에 "/" 있으면 owner/repo 분리. 본인이 한국어로 rename 한 경우는 그대로.
function renderProjectName(name: string): ReactNode {
  const slashIdx = name.indexOf("/");
  if (slashIdx < 0) return name;
  const owner = name.slice(0, slashIdx);
  const repo = name.slice(slashIdx + 1);
  return (
    <span className="flex flex-col leading-tight">
      <Text
        variant="caption"
        color="muted"
        as="span"
        className="text-[10px]"
      >
        {owner}
      </Text>
      <span className="truncate">{repo}</span>
    </span>
  );
}

export function PortfolioProjectList({
  projects,
  works,
  activeFilter,
  onFilterChange,
}: Props) {
  const counts = useMemo(() => {
    const total = works.filter((w) => w.frontmatter.included).length;
    const uncategorized = works.filter(
      (w) => w.frontmatter.included && !w.frontmatter.project,
    ).length;
    const excluded = works.filter((w) => !w.frontmatter.included).length;
    const byProject = new Map<string, number>();
    for (const w of works) {
      if (!w.frontmatter.included) continue;
      const p = w.frontmatter.project;
      if (!p) continue;
      byProject.set(p, (byProject.get(p) ?? 0) + 1);
    }
    return { total, uncategorized, excluded, byProject };
  }, [works]);

  return (
    <nav className="flex flex-col gap-1 p-3 text-sm">
      <FilterItem
        label="전체"
        count={counts.total}
        active={activeFilter.kind === "all"}
        onClick={() => onFilterChange({ kind: "all" })}
      />
      <FilterItem
        label="분류안됨"
        count={counts.uncategorized}
        active={activeFilter.kind === "uncategorized"}
        onClick={() => onFilterChange({ kind: "uncategorized" })}
      />

      {(() => {
        // PR 없는 프로젝트는 사이드바에서 숨김 (projects.md 자체엔 유지 — 옵시디안에서 직접 편집 가능).
        // 단 현재 선택된 프로젝트가 0건이어도 노출 유지 — 사용자가 막 비운 직후에도 그 자리 보임.
        const visible = projects.filter((p) => {
          if ((counts.byProject.get(p.slug) ?? 0) > 0) return true;
          if (
            activeFilter.kind === "project" &&
            activeFilter.slug === p.slug
          )
            return true;
          return false;
        });
        if (visible.length === 0) return null;
        return (
          <>
            <div
              className="my-2 h-px"
              style={{ backgroundColor: "var(--border-default)" }}
            />
            {visible.map((p) => (
              <FilterItem
                key={p.slug}
                label={renderProjectName(p.name)}
                count={counts.byProject.get(p.slug) ?? 0}
                active={
                  activeFilter.kind === "project" &&
                  activeFilter.slug === p.slug
                }
                colorDot={p.color ? COLOR_DOT[p.color] ?? p.color : undefined}
                onClick={() =>
                  onFilterChange({ kind: "project", slug: p.slug })
                }
              />
            ))}
          </>
        );
      })()}

      <div
        className="my-2 h-px"
        style={{ backgroundColor: "var(--border-default)" }}
      />

      <FilterItem
        label="미사용"
        count={counts.excluded}
        muted
        active={activeFilter.kind === "excluded"}
        onClick={() => onFilterChange({ kind: "excluded" })}
      />
    </nav>
  );
}

function FilterItem({
  label,
  count,
  active,
  muted,
  colorDot,
  onClick,
}: {
  label: ReactNode;
  count: number;
  active: boolean;
  muted?: boolean;
  colorDot?: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className="justify-between px-3 py-2 font-normal"
      style={{
        backgroundColor: active ? "var(--bg-surface-active)" : undefined,
        color: muted ? "var(--text-secondary)" : "var(--text-primary)",
      }}
    >
      <span className="flex items-center gap-2 truncate">
        {colorDot ? (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: colorDot }}
          />
        ) : null}
        <span className="truncate">{label}</span>
      </span>
      <Text variant="caption" color="muted" as="span">
        {count}
      </Text>
    </Button>
  );
}
