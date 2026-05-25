import { ClipboardList, CalendarDays, ListChecks, Briefcase } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Tab = "meetings" | "calendar" | "todos" | "portfolio";

type Props = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
};

// SidePanel / ActivityBar / 단축키 분기에서 공유. 함수/상수도 같은 파일에서 export.
// eslint-disable-next-line react-refresh/only-export-components
// 순서 = 사용 빈도 + Cmd+1..4 의미 (App.tsx 단축키가 TABS index 기반).
// 캘린더 첫 진입이 본인 daily routine — 메모장은 메모 선택 후 본문 작업이라 진입 빈도 낮음.
export const TABS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "calendar", label: "캘린더", icon: CalendarDays },
  { id: "meetings", label: "메모장", icon: ClipboardList },
  { id: "todos", label: "할 일", icon: ListChecks },
  { id: "portfolio", label: "포트폴리오", icon: Briefcase },
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
