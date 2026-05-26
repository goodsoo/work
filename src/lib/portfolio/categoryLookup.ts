// builtin 5 + categories.md user-defined 의 merged list 에서 slug 로 label/color 찾기.
// 정의 없는 slug 는 graceful fallback (slug 그대로 + muted 색) — vault 외부 편집 방어.

import type { PortfolioCategoryDef } from "../../api/portfolio";

export function categoryLabel(
  slug: string,
  defs: PortfolioCategoryDef[],
): string {
  return defs.find((c) => c.slug === slug)?.label ?? slug;
}

export function categoryColor(
  slug: string,
  defs: PortfolioCategoryDef[],
): string {
  return defs.find((c) => c.slug === slug)?.color ?? "var(--cat-other)";
}
