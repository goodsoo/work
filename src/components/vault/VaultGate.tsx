import type { ReactNode } from "react";
import { useVault } from "../../lib/vault/useVault";
import { VaultPicker } from "./VaultPicker";

export function VaultGate({ children }: { children: ReactNode }) {
  const { vaultRoot, isReady } = useVault();

  if (!vaultRoot) {
    return <VaultPicker />;
  }
  if (!isReady) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <div
          aria-hidden="true"
          className="size-6 animate-spin rounded-full border-2"
          style={{
            borderColor: "var(--border-default)",
            borderTopColor: "var(--accent-red)",
          }}
        />
        <span className="sr-only">vault 로딩 중</span>
      </main>
    );
  }
  return <>{children}</>;
}
