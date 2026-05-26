import { useEffect, useState } from "react";
import { useScopedKey } from "../lib/vault/scopedStorage";

// 포트폴리오 카드 정렬 옵션. useMeetingSort 패턴 동일 (localStorage persist).
// - merged_desc: 최신 PR (default). github_merged_at 내림차순.
// - merged_asc: 오래된 PR.
// - category: 카테고리 그룹 (PORTFOLIO_CATEGORIES 순서 = ui_ux → backend → infra → fix → other).
//             그룹 안에서는 merged_desc.
// - project: 프로젝트 그룹 (projects.md sort). 분류안됨은 맨 뒤. 그룹 안 merged_desc.
// - impact: 영향 큰 PR 위 — changedFiles + additions + deletions 합산 desc. 동률은 merged_desc.
export type PortfolioSortKey =
  | "merged_desc"
  | "merged_asc"
  | "category"
  | "project"
  | "impact";

const BASE_KEY = "goodsoob:portfolioSort";

const VALID_KEYS = new Set<PortfolioSortKey>([
  "merged_desc",
  "merged_asc",
  "category",
  "project",
  "impact",
]);

function readKey(key: string): PortfolioSortKey {
  if (typeof localStorage === "undefined") return "merged_desc";
  const v = localStorage.getItem(key);
  if (v && VALID_KEYS.has(v as PortfolioSortKey)) {
    return v as PortfolioSortKey;
  }
  return "merged_desc";
}

export function usePortfolioSort() {
  const key = useScopedKey(BASE_KEY);
  const [sortKey, setSortKey] = useState<PortfolioSortKey>(() => readKey(key));
  useEffect(() => {
    setSortKey(readKey(key));
  }, [key]);
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, sortKey);
  }, [key, sortKey]);
  return [sortKey, setSortKey] as const;
}
