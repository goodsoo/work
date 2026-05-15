import { useState } from "react";
import { signInWithGoogle } from "../../hooks/useAuth";

export function SignInScreen() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setError(null);
    setPending(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인에 실패했어요");
      setPending(false);
    }
  }

  return (
    <main
      className="flex min-h-svh flex-col items-center justify-center px-6"
      style={{
        paddingTop: "var(--safe-top)",
        paddingBottom: "var(--safe-bottom)",
      }}
    >
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="font-serif text-3xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100">
            goodsoob-work
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            본인 전용 시간축 통합 업무관리
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignIn}
          disabled={pending}
          className="inline-flex w-full items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          <GoogleIcon className="mr-3 size-5" />
          {pending ? "로그인 중..." : "Google로 시작하기"}
        </button>

        {error ? (
          <div
            role="alert"
            className="rounded-lg border-l-4 border-red-600 bg-red-50 px-4 py-3 text-left text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200"
          >
            {error}
          </div>
        ) : null}

        <p className="text-xs text-zinc-400 dark:text-zinc-400">
          1회 로그인 후 자동 유지됩니다.
        </p>
      </div>
    </main>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M22.5 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.55c2.08-1.92 3.28-4.74 3.28-8.11z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.27-2.66l-3.55-2.76c-.99.66-2.25 1.05-3.72 1.05-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.85 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.35-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.42 3.46 1.18 4.94l3.67-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.67 2.84C6.71 7.31 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </svg>
  );
}
