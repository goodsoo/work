import { Sun, Calendar, FileText, CheckSquare, LayoutGrid } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Tab = "today" | "meetings" | "calendar" | "todos" | "portfolio";

type Props = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
};

// SidePanel / ActivityBar / 단축키 분기에서 공유. 함수/상수도 같은 파일에서 export.
// eslint-disable-next-line react-refresh/only-export-components
// 순서 = 사용 빈도 + Cmd+1.. 의미 (App.tsx 단축키가 TABS index 기반).
// "오늘" 이 기본 진입 (SIMPLIFY: 매일 처음 보는 화면). 캘린더는 특정 날짜 훑기용으로 강등.
export const TABS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "today", label: "오늘", icon: Sun },
  { id: "meetings", label: "메모장", icon: FileText },
  { id: "todos", label: "할 일", icon: CheckSquare },
  { id: "calendar", label: "캘린더", icon: Calendar },
  { id: "portfolio", label: "포트폴리오", icon: LayoutGrid },
];

export function BottomTabs({ activeTab, onTabChange }: Props) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 backdrop-blur lg:hidden"
      style={{
        paddingBottom: "var(--safe-bottom)",
        backgroundColor: "var(--bg-overlay)",
        borderTop: "1px solid var(--border-default)",
      }}
      aria-label="primary"
    >
      <div className="mx-auto flex w-full max-w-2xl">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = id === activeTab;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition"
              style={{ color: active ? "var(--text-primary)" : "var(--text-muted)" }}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.5} />
              <span className={active ? "font-medium" : ""}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
