import { LogOut, Sun, Moon } from "lucide-react";
import { useAuth, signOut } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import { TABS, type Tab } from "./BottomTabs";

type Props = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
};

export function ActivityBar({ activeTab, onTabChange }: Props) {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const ThemeIcon = theme === "light" ? Sun : Moon;

  return (
    <div
      className="flex h-full w-12 flex-col items-center py-4"
      style={{ backgroundColor: "var(--bg-surface)" }}
    >
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
              className="flex h-9 w-9 items-center justify-center rounded-lg transition"
              style={{
                backgroundColor: active ? "var(--btn-primary)" : "transparent",
                color: active ? "var(--btn-primary-text)" : "var(--text-muted)",
              }}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2 : 1.5} />
            </button>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          title={theme === "light" ? "다크 모드로" : "라이트 모드로"}
          className="flex h-7 w-7 items-center justify-center rounded-lg transition"
          style={{ color: "var(--text-muted)", minHeight: 0 }}
        >
          <ThemeIcon className="h-3.5 w-3.5" />
        </button>
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold"
          title={user?.email ?? user?.id ?? ""}
          style={{ backgroundColor: "var(--bg-surface-active)", color: "var(--text-secondary)" }}
        >
          {(user?.email ?? "U")[0].toUpperCase()}
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          title="로그아웃"
          className="flex h-7 w-7 items-center justify-center rounded-lg transition"
          style={{ color: "var(--text-muted)", minHeight: 0 }}
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
