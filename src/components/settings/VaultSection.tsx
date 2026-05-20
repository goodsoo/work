import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Loader2, Unlink } from "lucide-react";
import { useVault } from "../../lib/vault/useVault";

type Props = {
  onAfterSwitch?: () => void;
};

export function VaultSection({ onAfterSwitch }: Props) {
  const { vaultRoot, setVaultRoot, disconnect } = useVault();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  async function changeVault() {
    setError(null);
    setBusy(true);
    try {
      const result = await open({
        directory: true,
        multiple: false,
        title: "Vault 폴더 선택",
        defaultPath: vaultRoot ?? undefined,
      });
      if (typeof result !== "string") return; // 취소
      if (result === vaultRoot) return; // 같은 폴더 → no-op
      await setVaultRoot(result);
      onAfterSwitch?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section>
        <h3
          className="mb-2 text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          현재 vault
        </h3>
        <div
          className="break-all rounded px-3 py-2 text-xs"
          style={{
            background: "var(--bg-base)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-subtle)",
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          }}
        >
          {vaultRoot ?? "(없음)"}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={changeVault}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: "var(--btn-primary)",
              color: "var(--btn-primary-text)",
            }}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FolderOpen className="h-4 w-4" />
            )}
            {busy ? "전환 중…" : "다른 폴더로 변경"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmDisconnect(true)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: "var(--bg-base)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-default)",
            }}
          >
            <Unlink className="h-4 w-4" />
            연결 해제
          </button>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          새 폴더에 메모/일기/할 일 구조를 자동 생성. 옛 vault 의 파일은 그대로 남아있어요 (이동 X).
        </p>

        {error && (
          <div
            className="rounded px-3 py-2 text-sm"
            style={{
              color: "var(--accent-red)",
              background: "var(--bg-base)",
              border: "1px solid var(--accent-red)",
            }}
          >
            {error}
          </div>
        )}
      </section>

      {confirmDisconnect && (
        <DisconnectConfirmModal
          onConfirm={() => {
            setConfirmDisconnect(false);
            disconnect();
          }}
          onCancel={() => setConfirmDisconnect(false)}
        />
      )}
    </div>
  );
}

function DisconnectConfirmModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl p-5"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
        }}
      >
        <h3
          className="mb-2 text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          vault 연결 해제할까요?
        </h3>
        <p className="mb-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          폴더 안 파일은 그대로 남아있어요. 다시 사용하려면 vault 폴더를 다시 골라야 합니다.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded px-3 py-1.5 text-sm transition hover:opacity-90 active:opacity-80"
            style={{ color: "var(--text-secondary)" }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition hover:opacity-90 active:opacity-80"
            style={{ background: "var(--accent-red)", color: "white" }}
          >
            해제
          </button>
        </div>
      </div>
    </div>
  );
}
