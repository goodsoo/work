import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Unlink } from "lucide-react";
import { useVault } from "../../lib/vault/useVault";
import { Button } from "../common/Button";
import { Text } from "../common/Text";
import { Modal } from "../common/Modal";
import { Spinner } from "../common/Spinner";

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
        <Text
          variant="caption"
          color="muted"
          as="h3"
          weight="semibold"
          className="mb-2 uppercase tracking-wide"
        >
          현재 vault
        </Text>
        <Text
          variant="caption"
          as="div"
          className="break-all rounded px-3 py-2"
          style={{
            background: "var(--bg-base)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-subtle)",
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          }}
        >
          {vaultRoot ?? "(없음)"}
        </Text>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            disabled={busy}
            onClick={changeVault}
            leftIcon={
              busy ? (
                <Spinner size="md" />
              ) : (
                <FolderOpen className="h-4 w-4" />
              )
            }
            className="rounded-lg px-3 py-2 active:opacity-80 disabled:opacity-50"
          >
            {busy ? "전환 중…" : "다른 폴더로 변경"}
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setConfirmDisconnect(true)}
            leftIcon={<Unlink className="h-4 w-4" />}
            className="rounded-lg px-3 py-2 active:opacity-80 disabled:opacity-50"
            style={{ background: "var(--bg-base)" }}
          >
            연결 해제
          </Button>
        </div>
        <Text variant="caption" color="muted" as="p">
          새 폴더에 메모/일기/할 일 구조를 자동 생성. 옛 vault 의 파일은 그대로 남아있어요 (이동 X).
        </Text>

        {error && (
          <Text
            variant="body"
            as="div"
            className="rounded px-3 py-2"
            style={{
              color: "var(--accent-red)",
              background: "var(--bg-base)",
              border: "1px solid var(--accent-red)",
            }}
          >
            {error}
          </Text>
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
  return (
    <Modal open onClose={onCancel} size="md" ariaLabel="vault 연결 해제">
      <div className="p-5">
        <Text variant="body" weight="semibold" as="h3" className="mb-2">
          vault 연결 해제할까요?
        </Text>
        <Text variant="body" color="secondary" as="p" className="mb-4">
          폴더 안 파일은 그대로 남아있어요. 다시 사용하려면 vault 폴더를 다시 골라야 합니다.
        </Text>
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            onClick={onCancel}
            className="px-3 py-1.5"
            style={{ color: "var(--text-secondary)" }}
          >
            취소
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            className="px-3 py-1.5"
          >
            해제
          </Button>
        </div>
      </div>
    </Modal>
  );
}
