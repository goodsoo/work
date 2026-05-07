import type { ReactNode } from "react";
import { useAuth, signOut } from "../../hooks/useAuth";
import { BottomTabs, type Tab } from "./BottomTabs";

type Props = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  children: ReactNode;
};

export function AppShell({ activeTab, onTabChange, children }: Props) {
  const { user } = useAuth();
  return (
    <div
      className="min-h-svh bg-white dark:bg-zinc-950"
      style={{ paddingTop: "var(--safe-top)" }}
    >
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3 md:px-6">
          <h1 className="font-serif text-base font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
            goodsoob-work
          </h1>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-xs text-zinc-400 sm:inline">
              {user?.email ?? user?.id}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <main
        style={{
          paddingBottom: "calc(var(--safe-bottom) + 72px)",
        }}
      >
        {children}
      </main>
      <BottomTabs activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}
