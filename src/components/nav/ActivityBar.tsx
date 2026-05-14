import { LogOut } from "lucide-react";
import { useAuth, signOut } from "../../hooks/useAuth";
import { TABS, type Tab } from "./BottomTabs";

type Props = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
};

export function ActivityBar({ activeTab, onTabChange }: Props) {
  const { user } = useAuth();
  return (
    <div className="flex h-full w-12 flex-col items-center bg-zinc-50 py-4 dark:bg-zinc-900/40">
      <nav className="flex flex-col gap-1.5" aria-label="primary">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = id === activeTab;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              aria-current={active ? "page" : undefined}
              title={label}
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                active
                  ? "bg-zinc-900 text-white dark:bg-zinc-700 dark:text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-200/50 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-300"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2 : 1.5} />
            </button>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          title={user?.email ?? user?.id ?? ""}
        >
          {(user?.email ?? "U")[0].toUpperCase()}
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          title="로그아웃"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-300 transition hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
          style={{ minHeight: 0 }}
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
