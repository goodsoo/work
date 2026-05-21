import { ClipboardList, CalendarDays, ListChecks, Briefcase } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Tab = "meetings" | "calendar" | "todos" | "portfolio";

type Props = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
};

// SidePanel / ActivityBar / 단축키 분기에서 공유. 함수/상수도 같은 파일에서 export.
// eslint-disable-next-line react-refresh/only-export-components
export const TABS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "meetings", label: "메모장", icon: ClipboardList },
  { id: "calendar", label: "캘린더", icon: CalendarDays },
  { id: "todos", label: "할 일", icon: ListChecks },
  { id: "portfolio", label: "내 작업", icon: Briefcase },
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
