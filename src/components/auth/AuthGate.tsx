import type { ReactNode } from "react";
import { useAuth } from "../../hooks/useAuth";
import { SignInScreen } from "./SignInScreen";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <div
          aria-hidden="true"
          className="size-6 animate-spin rounded-full border-2 border-zinc-300 border-t-red-600"
        />
        <span className="sr-only">불러오는 중</span>
      </main>
    );
  }

  if (!user) {
    return <SignInScreen />;
  }

  return <>{children}</>;
}
