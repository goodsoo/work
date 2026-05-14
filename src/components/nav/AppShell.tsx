import type { ReactNode } from "react";
import { useAuth, signOut } from "../../hooks/useAuth";
import { BottomTabs, type Tab } from "./BottomTabs";
import { ActivityBar } from "./ActivityBar";

type Props = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  sidePanel?: ReactNode;
  children: ReactNode;
};

export function AppShell({ activeTab, onTabChange, sidePanel, children }: Props) {
  const { user } = useAuth();
  const hasSidePanel = sidePanel != null;

  return (
    <div
      className="min-h-svh bg-white dark:bg-zinc-950"
      style={{ paddingTop: "var(--safe-top)" }}
    >
      {/* Desktop: Activity Bar + Side Panel (fixed) */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:flex">
        <ActivityBar activeTab={activeTab} onTabChange={onTabChange} />
        {hasSidePanel ? (
          <div className="w-72 border-r border-zinc-100 bg-white dark:border-zinc-800/50 dark:bg-zinc-950">
            {sidePanel}
          </div>
        ) : null}
      </div>

      {/* Mobile header */}
      <header className="sticky top-0 z-10 border-b border-zinc-100 bg-white/90 backdrop-blur lg:hidden dark:border-zinc-800/50 dark:bg-zinc-950/90">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-2.5">
          <h1 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            goodsoob
          </h1>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[11px] text-zinc-400 sm:inline">
              {user?.email ?? user?.id}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-xs text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-300"
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
