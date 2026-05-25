import { useCallback, useEffect, useState } from "react";
import {
  PORTFOLIO_CATEGORIES,
  type PortfolioCategory,
} from "../api/portfolio";

// 포트폴리오 카드 카테고리 chip 필터. 다중 OR. 빈 Set = 전체 (필터 X).
// localStorage 에 string[] 직렬화 — 빈 배열도 보존 (사용자가 의도적으로 다 끄고 빈 상태로 둘 수도 있음).
const STORAGE_KEY = "goodsoob:portfolioCategoryFilter";

function read(): Set<PortfolioCategory> {
  if (typeof localStorage === "undefined") return new Set();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const out = new Set<PortfolioCategory>();
    for (const v of parsed) {
      if (typeof v === "string" && (PORTFOLIO_CATEGORIES as readonly string[]).includes(v)) {
        out.add(v as PortfolioCategory);
      }
    }
    return out;
  } catch {
    return new Set();
  }
}

export function usePortfolioCategoryFilter() {
  const [selected, setSelected] = useState<Set<PortfolioCategory>>(read);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(selected)));
  }, [selected]);

  const toggle = useCallback((cat: PortfolioCategory) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
  }, []);

  return { selected, toggle, clear, setSelected } as const;
}
