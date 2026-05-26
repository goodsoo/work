import { useCallback, useEffect, useState } from "react";
import {
  PORTFOLIO_CATEGORIES,
  type PortfolioCategory,
} from "../api/portfolio";
import { useScopedKey } from "../lib/vault/scopedStorage";

// 작업 카드 카테고리 chip 필터. single radio. "all" = 전체 (필터 X).
// 할일 카테고리 필터와 동일한 정신 모델 — 한 번에 하나만 본다.
// vault id namespace 적용 — 개인/회사 vault 별 필터 분리 (PR #45 흡수).
// localStorage 에 직렬화. 옛 multi (string[]) 도 lazy 흡수 — 첫 값만 채용.
const BASE_KEY = "goodsoob:portfolioCategoryFilter";

export type PortfolioCategoryFilter = "all" | PortfolioCategory;

function readKey(key: string): PortfolioCategoryFilter {
  if (typeof localStorage === "undefined") return "all";
  const raw = localStorage.getItem(key);
  if (!raw) return "all";
  try {
    const parsed = JSON.parse(raw);
    // 옛 multi 형식 (string[]) — 첫 값만 single 로 흡수, 비어있으면 "all".
    if (Array.isArray(parsed)) {
      const first = parsed.find(
        (v) =>
          typeof v === "string" &&
          (PORTFOLIO_CATEGORIES as readonly string[]).includes(v),
      );
      return (first as PortfolioCategory | undefined) ?? "all";
    }
    if (parsed === "all") return "all";
    if (
      typeof parsed === "string" &&
      (PORTFOLIO_CATEGORIES as readonly string[]).includes(parsed)
    ) {
      return parsed as PortfolioCategory;
    }
    return "all";
  } catch {
    return "all";
  }
}

export function usePortfolioCategoryFilter() {
  const key = useScopedKey(BASE_KEY);
  const [selected, setSelected] = useState<PortfolioCategoryFilter>(() =>
    readKey(key),
  );

  // vault 전환 시 새 key 에서 다시 read.
  useEffect(() => {
    setSelected(readKey(key));
  }, [key]);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, JSON.stringify(selected));
  }, [key, selected]);

  const change = useCallback((next: PortfolioCategoryFilter) => {
    setSelected(next);
  }, []);

  return { selected, change } as const;
}
