import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useVault } from "../../lib/vault/useVault";

interface Props {
  from: string;
}

export function VaultDisconnected({ from }: Props) {
  const { reconnect, setVaultRoot } = useVault();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function tryReconnect() {
    setError(null);
    setBusy(true);
    try {
      await reconnect();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "여전히 vault 폴더에 접근할 수 없어요.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function pickAnother() {
    setError(null);
    try {
      const result = await open({
        directory: true,
        multiple: false,
        title: "Vault 폴더 선택",
        defaultPath: from,
      });
      if (typeof result !== "string") return; // 취소 → disconnected 화면 유지
      setBusy(true);
      await setVaultRoot(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="flex min-h-svh items-center justify-center px-6"
      style={{ background: "var(--bg-base)" }}
    >
      <div
        className="w-full max-w-md rounded-xl p-6"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
        }}
      >
        <h1
          className="text-xl font-bold mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          vault 폴더에 접근할 수 없어요
        </h1>
        <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
          외장 디스크가 빠졌거나 iCloud 동기화가 꺼져있는지 확인한 후 재연결해
          주세요. 다른 폴더를 vault 로 쓰려면 [다른 폴더 선택] 을 누르세요.
        </p>

        <div
          className="text-xs mb-5 px-3 py-2 rounded break-all"
          style={{
            background: "var(--bg-base)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border-default)",
          }}
        >
          이전 vault: <span className="font-mono">{from}</span>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={tryReconnect}
          className="w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-opacity"
          style={{
            background: "var(--accent-red)",
            color: "white",
            opacity: busy ? 0.5 : 1,
          }}
        >
          {busy ? "재연결 중…" : "재연결"}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={pickAnother}
          className="w-full mt-2 px-4 py-2 text-sm rounded-lg"
          style={{
            color: "var(--text-secondary)",
            border: "1px solid var(--border-default)",
          }}
        >
          다른 폴더 선택
        </button>

        {error && (
          <div
            className="mt-3 text-sm px-3 py-2 rounded"
            style={{
              color: "var(--accent-red)",
              background: "var(--bg-base)",
              border: "1px solid var(--accent-red)",
            }}
          >
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
