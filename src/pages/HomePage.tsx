import { useAuth, signOut } from "../hooks/useAuth";

export function HomePage() {
  const { user } = useAuth();

  return (
    <main
      className="flex min-h-svh flex-col px-6"
      style={{
        paddingTop: "var(--safe-top)",
        paddingBottom: "var(--safe-bottom)",
      }}
    >
      <header className="flex items-center justify-between border-b border-zinc-200 py-4 dark:border-zinc-800">
        <h1 className="font-serif text-lg font-medium tracking-tight">
          goodsoob-work
        </h1>
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          로그아웃
        </button>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center space-y-4 text-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">로그인 됨</p>
        <p className="font-mono text-xs text-zinc-400">
          {user?.email ?? user?.id}
        </p>
        <p className="font-serif text-2xl text-zinc-900 dark:text-zinc-100">
          여기 시간이 흐릅니다.
        </p>
        <p className="text-xs text-zinc-400">
          V0.0 — 셋업 완료. 회의록은 V0.1에서 추가 예정.
        </p>
      </section>
    </main>
  );
}
