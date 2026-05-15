import { ClipboardList, CalendarDays, ListChecks } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Tab = "meetings" | "calendar" | "todos";

type Props = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
};

export const TABS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "meetings", label: "메모장", icon: ClipboardList },
  { id: "calendar", label: "캘린더", icon: CalendarDays },
  { id: "todos", label: "할 일", icon: ListChecks },
];

export function BottomTabs({ activeTab, onTabChange }: Props) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-100 bg-white/95 backdrop-blur lg:hidden dark:border-zinc-800 dark:bg-zinc-900/95"
      style={{ paddingBottom: "var(--safe-bottom)" }}
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
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition ${
                active
                  ? "text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-400 dark:text-zinc-400"
              }`}
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
