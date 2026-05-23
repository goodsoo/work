import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useVault } from "../../lib/vault/useVault";
import { Button } from "../common/Button";
import { Text } from "../common/Text";

interface Props {
  initialPath?: string | null;
  onCancel?: () => void;
}

export function VaultPicker({ initialPath = null, onCancel }: Props) {
  const { setVaultRoot } = useVault();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick() {
    setError(null);
    try {
      const result = await open({
        directory: true,
        multiple: false,
        title: "Vault 폴더 선택",
        defaultPath: initialPath ?? undefined,
      });
      if (typeof result !== "string") return; // 취소
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
        <Text variant="h2" weight="bold" as="h1" className="mb-2">
          Vault 폴더 선택
        </Text>
        <Text variant="body" color="secondary" as="p" className="mb-6">
          모든 메모/일기/할 일이 이 폴더 안의 md 파일로 저장됩니다. iCloud Drive 같은
          동기화 폴더 안에 두면 다른 기기에서도 같은 vault를 공유할 수 있어요.
        </Text>

        {initialPath && (
          <Text
            variant="caption"
            color="secondary"
            as="div"
            className="mb-4 rounded px-3 py-2"
            style={{
              background: "var(--bg-base)",
              border: "1px solid var(--border-default)",
            }}
          >
            현재: <span className="font-mono">{initialPath}</span>
          </Text>
        )}

        <Button
          variant="danger"
          disabled={busy}
          onClick={pick}
          className="w-full rounded-lg px-4 py-2.5 transition-opacity"
          style={{ opacity: busy ? 0.5 : 1 }}
        >
          {busy ? "준비 중…" : initialPath ? "다른 폴더로 변경" : "폴더 선택하기"}
        </Button>

        {onCancel && initialPath && (
          <Button
            variant="ghost"
            onClick={onCancel}
            className="mt-2 w-full px-4 py-2 font-normal"
            style={{ color: "var(--text-secondary)" }}
          >
            취소
          </Button>
        )}

        {error && (
          <Text
            variant="body"
            as="div"
            className="mt-3 rounded px-3 py-2"
            style={{
              color: "var(--accent-red)",
              background: "var(--bg-base)",
              border: "1px solid var(--accent-red)",
            }}
          >
            {error}
          </Text>
        )}
      </div>
    </main>
  );
}
