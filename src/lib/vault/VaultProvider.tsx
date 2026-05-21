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
  /** 접근 불가로 끊긴 vault 의 마지막 path. 명시 disconnect 일 땐 null. */
  disconnectedFrom: string | null;
  /** disconnectedFrom 의 경로로 재연결 시도. setVaultRoot 와 동일하게 throw. */
  reconnect: () => Promise<void>;
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
  const [disconnectedFrom, setDisconnectedFrom] = useState<string | null>(null);

  const setVaultRoot = async (path: string) => {
    watcher.stop();
    adapter.setRoot(path);
    // ensureVaultStructure 의 mkdir(recursive: true) 가 root 자체도 만들어버림 —
    // 재연결 시 폴더가 없는 상태면 빈 vault 가 신생되어 사용자 데이터 손실처럼 보임.
    // 폴더가 디스크에 실재할 때만 통과시킴.
    if (!(await adapter.exists(""))) {
      throw new Error("폴더에 접근할 수 없어요. 외장 디스크 / iCloud 연결을 확인하세요.");
    }
    await ensureVaultStructure(adapter);
    localStorage.setItem(VAULT_ROOT_KEY, path);
    setDisconnectedFrom(null);
    setVaultRootState(path);
    queryClient.clear();
    await watcher.start();
    setIsReady(true);
  };

  const disconnect = () => {
    localStorage.removeItem(VAULT_ROOT_KEY);
    queryClient.clear();
    setDisconnectedFrom(null);
    setVaultRootState(null);
    // watcher / interval / focus listener 정리는 useEffect cleanup 에서 처리됨.
  };

  const reconnect = async () => {
    if (!disconnectedFrom) return;
    await setVaultRoot(disconnectedFrom);
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
      setDisconnectedFrom(vaultRoot);
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
        // vault 폴더 사라짐 / 권한 없음 → 끊김 안내 화면으로 보냄
        console.error("vault init failed", err);
        if (cancelled) return;
        localStorage.removeItem(VAULT_ROOT_KEY);
        setDisconnectedFrom(vaultRoot);
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
    () => ({
      adapter,
      watcher,
      vaultRoot,
      setVaultRoot,
      disconnect,
      isReady,
      disconnectedFrom,
      reconnect,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [adapter, watcher, vaultRoot, isReady, disconnectedFrom],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

