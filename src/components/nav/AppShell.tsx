import type { ReactNode } from "react";
import { Sun, Moon } from "lucide-react";
import { signOut } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import { BottomTabs, type Tab } from "./BottomTabs";
import { ActivityBar } from "./ActivityBar";

type Props = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  sidePanel?: ReactNode;
  children: ReactNode;
};

export function AppShell({ activeTab, onTabChange, sidePanel, children }: Props) {
  const { theme, toggle } = useTheme();
  const hasSidePanel = sidePanel != null;
  const ThemeIcon = theme === "light" ? Sun : Moon;

  return (
    <div
      className="min-h-svh"
      style={{ paddingTop: "var(--safe-top)", backgroundColor: "var(--bg-base)" }}
    >
      {/* Desktop: Activity Bar + Side Panel */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:flex">
        <ActivityBar activeTab={activeTab} onTabChange={onTabChange} />
        {hasSidePanel ? (
          <div
            className="w-72"
            style={{ backgroundColor: "var(--bg-surface)", borderRight: "1px solid var(--border-default)" }}
          >
            {sidePanel}
          </div>
        ) : null}
      </div>

      {/* Mobile header */}
      <header
        className="sticky top-0 z-10 backdrop-blur lg:hidden"
        style={{ backgroundColor: "var(--bg-overlay)", borderBottom: "1px solid var(--border-default)" }}
      >
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-2.5">
          <h1 className="text-sm font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            goodsoob
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              className="flex h-8 w-8 items-center justify-center rounded-md transition"
              style={{ color: "var(--text-muted)", minHeight: 0 }}
            >
              <ThemeIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-xs transition"
              style={{ color: "var(--text-muted)" }}
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main
        key={activeTab}
        style={{ paddingBottom: "calc(var(--safe-bottom) + 72px)" }}
        className={`animate-page-in lg:!pb-0 ${hasSidePanel ? "lg:pl-[21rem]" : "lg:pl-12"}`}
      >
        {children}
      </main>

      {/* Mobile bottom tabs */}
      <BottomTabs activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}
