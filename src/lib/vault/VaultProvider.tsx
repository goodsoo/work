import {
  createContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createTauriAdapter, type VaultAdapter } from "./adapter";
import { createVaultWatcher, type VaultWatcher } from "./watcher";
import { ensureVaultStructure } from "./scan";

const VAULT_ROOT_KEY = "vaultRoot";

interface VaultContextValue {
  adapter: VaultAdapter;
  watcher: VaultWatcher;
  vaultRoot: string | null;
  setVaultRoot: (path: string) => Promise<void>;
  disconnect: () => void;
  isReady: boolean;
}

// eslint-disable-next-line react-refresh/only-export-components
export const VaultContext = createContext<VaultContextValue | null>(null);
export type { VaultContextValue };

export function VaultProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [adapter] = useState<VaultAdapter>(() => createTauriAdapter());
  const [watcher] = useState<VaultWatcher>(() =>
    createVaultWatcher(adapter, queryClient),
  );

  const [vaultRoot, setVaultRootState] = useState<string | null>(() => {
    return localStorage.getItem(VAULT_ROOT_KEY);
  });
  const [isReady, setIsReady] = useState(false);

  const setVaultRoot = async (path: string) => {
    watcher.stop();
    adapter.setRoot(path);
    await ensureVaultStructure(adapter);
    localStorage.setItem(VAULT_ROOT_KEY, path);
    setVaultRootState(path);
    queryClient.clear();
    await watcher.start();
    setIsReady(true);
  };

  const disconnect = () => {
    localStorage.removeItem(VAULT_ROOT_KEY);
    queryClient.clear();
    setVaultRootState(null);
    // watcher / interval / focus listener 정리는 useEffect cleanup 에서 처리됨.
  };

  useEffect(() => {
    if (!vaultRoot) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsReady(false);
      return;
    }
    let cancelled = false;
    let aliveTimer: ReturnType<typeof setInterval> | null = null;

    function handleVaultGone() {
      if (cancelled) return;
      cancelled = true;
      watcher.stop();
      if (aliveTimer) clearInterval(aliveTimer);
      window.removeEventListener("focus", checkAlive);
      localStorage.removeItem(VAULT_ROOT_KEY);
      queryClient.clear();
      setVaultRootState(null);
    }

    async function checkAlive() {
      if (cancelled) return;
      try {
        const ok = await adapter.exists("");
        if (!ok) handleVaultGone();
      } catch {
        handleVaultGone();
      }
    }

    (async () => {
      adapter.setRoot(vaultRoot);
      try {
        await ensureVaultStructure(adapter);
        if (cancelled) return;
        await watcher.start();
        setIsReady(true);
        // 폴더 사라짐 감지 — 3초 주기 + window focus 즉시.
        aliveTimer = setInterval(checkAlive, 3000);
        window.addEventListener("focus", checkAlive);
      } catch (err) {
        // vault 폴더 사라짐 / 권한 없음 → 다시 picker 필요
        console.error("vault init failed", err);
        localStorage.removeItem(VAULT_ROOT_KEY);
        setVaultRootState(null);
        setIsReady(false);
      }
    })();
    return () => {
      cancelled = true;
      watcher.stop();
      if (aliveTimer) clearInterval(aliveTimer);
      window.removeEventListener("focus", checkAlive);
    };
  }, [vaultRoot, adapter, watcher, queryClient]);

  const value = useMemo<VaultContextValue>(
    () => ({ adapter, watcher, vaultRoot, setVaultRoot, disconnect, isReady }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [adapter, watcher, vaultRoot, isReady],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

