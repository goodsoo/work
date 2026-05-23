import type { ReactNode } from "react";

type Props = {
  // 3-col grid 의 좌/가운데/우 slot. 빈 칸은 빈 div 자동 채움 (grid track 유지 → 가운데 viewport-center).
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  // 추가 className (drag region / 배경 override 등). default 패턴은 wrapper 가 다 제공.
  className?: string;
};

// 본문 페이지 헤더 — 메모/할일/내작업/캘린더 4 페이지 공통 패턴.
// height = var(--page-header-h) (52px, 사이드바 헤더와 통일).
// grid 3-col (1fr / auto / 1fr) — 좌/우 그룹 너비 변해도 가운데 viewport-center 유지.
// sticky top-0 z-20 — mobile body scroll / desktop main scroll 둘 다 fixed.
// lg:shrink-0 — desktop 의 MeetingForm 같은 flex-col 부모 안에서 자동 고정.
export function PageHeaderBar({ left, center, right, className = "" }: Props) {
  return (
    <div
      className={`sticky top-0 z-20 grid items-center gap-2 overflow-hidden px-3 backdrop-blur lg:shrink-0 ${className}`}
      style={{
        height: "var(--page-header-h)",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr)",
        backgroundColor: "var(--bg-overlay)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div className="flex shrink-0 items-center gap-2 justify-self-start">
        {left}
      </div>
      <div className="justify-self-center">{center}</div>
      <div className="flex shrink-0 items-center gap-1 justify-self-end">
        {right}
      </div>
    </div>
  );
}
