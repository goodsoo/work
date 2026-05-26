import { useCallback, useEffect, useState } from "react";
import {
  PORTFOLIO_CATEGORIES,
  type PortfolioCategory,
} from "../api/portfolio";

// 내 작업 카드 카테고리 chip 필터. single radio. "all" = 전체 (필터 X).
// 할일 카테고리 필터와 동일한 정신 모델 — 한 번에 하나만 본다.
// localStorage 에 직렬화. 옛 multi (string[]) 도 lazy 흡수 — 첫 값만 채용.
const STORAGE_KEY = "goodsoob:portfolioCategoryFilter";

export type PortfolioCategoryFilter = "all" | PortfolioCategory;

function read(): PortfolioCategoryFilter {
  if (typeof localStorage === "undefined") return "all";
  const raw = localStorage.getItem(STORAGE_KEY);
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
  const [selected, setSelected] = useState<PortfolioCategoryFilter>(read);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
  }, [selected]);

  const change = useCallback((next: PortfolioCategoryFilter) => {
    setSelected(next);
  }, []);

  return { selected, change } as const;
}
