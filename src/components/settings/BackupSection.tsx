import { useEffect, useState } from "react";
import { Archive, Loader2, Trash2 } from "lucide-react";
import { useVault } from "../../lib/vault/useVault";
import {
  runBackup,
  listBackups,
  deleteBackup,
  readAutoBackupConfig,
  writeAutoBackupConfig,
  deletionsRequiredForNewBackup,
  BACKUP_KEEP_COUNT,
  type BackupEntry,
  type AutoBackupConfig,
} from "../../lib/backup";

export function BackupSection() {
  const { adapter } = useVault();
  const [entries, setEntries] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cfg, setCfg] = useState<AutoBackupConfig>(() => readAutoBackupConfig());
  const [confirmCandidates, setConfirmCandidates] = useState<BackupEntry[] | null>(null);

  async function refresh() {
    try {
      const list = await listBackups(adapter);
      setEntries(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  // 첫 mount 시 1회 비동기 fetch — refresh 가 내부에서 set* 호출.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    void refresh();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  async function handleManualBackup() {
    setError(null);
    const toDelete = deletionsRequiredForNewBackup(entries, BACKUP_KEEP_COUNT);
    if (toDelete.length > 0) {
      setConfirmCandidates(toDelete);
      return;
    }
    await actuallyBackup();
  }

  async function actuallyBackup() {
    setRunning(true);
    try {
      await runBackup(adapter);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  async function confirmBackup() {
    if (!confirmCandidates) return;
    setError(null);
    setRunning(true);
    try {
      for (const c of confirmCandidates) {
        await deleteBackup(adapter, c.path);
      }
      await runBackup(adapter);
      setConfirmCandidates(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  function cancelConfirm() {
    if (running) return;
    setConfirmCandidates(null);
  }

  async function handleDelete(path: string) {
    setError(null);
    try {
      await deleteBackup(adapter, path);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function updateConfig(patch: Partial<AutoBackupConfig>) {
    const next = { ...cfg, ...patch };
    setCfg(next);
    writeAutoBackupConfig(next);
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <button
          type="button"
          onClick={handleManualBackup}
          disabled={running}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: "var(--btn-primary)",
            color: "var(--btn-primary-text)",
          }}
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Archive className="h-4 w-4" />
          )}
          {running ? "백업 중…" : "지금 백업"}
        </button>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          vault 안 <code>.backups/</code> 폴더에 zip 으로 저장됩니다.
        </p>
      </section>

      <section className="space-y-2">
        <h3
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          자동 백업
        </h3>
        <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
          <input
            type="checkbox"
            checked={cfg.enabled}
            onChange={(e) => updateConfig({ enabled: e.target.checked })}
          />
          앱 실행 시 자동 백업
        </label>
        {cfg.enabled && (
          <div className="flex items-end gap-4 pl-6 pt-1">
            <label className="text-xs" style={{ color: "var(--text-secondary)" }}>
              <span className="mb-1 block">주기</span>
              <select
                value={cfg.intervalDays}
                onChange={(e) => updateConfig({ intervalDays: Number(e.target.value) })}
                className="cursor-pointer rounded px-2 py-1 text-sm"
                style={{
                  background: "var(--bg-base)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                }}
              >
                <option value={0.5}>12시간</option>
                <option value={1}>1일</option>
                <option value={3}>3일</option>
                <option value={7}>7일</option>
              </select>
            </label>
            <p className="pb-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
              최근 {BACKUP_KEEP_COUNT}개까지 보관
            </p>
          </div>
        )}
      </section>

      {confirmCandidates && (
        <BackupConfirmModal
          candidates={confirmCandidates}
          keepCount={BACKUP_KEEP_COUNT}
          running={running}
          onConfirm={confirmBackup}
          onCancel={cancelConfirm}
        />
      )}

      <section>
        <h3
          className="mb-2 text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          최근 백업{entries.length > 0 ? ` (${entries.length})` : ""}
        </h3>
        {loading ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            불러오는 중…
          </p>
        ) : entries.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            백업 없음. 위 버튼으로 시작하세요.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {entries.map((e) => (
              <li
                key={e.path}
                className="flex items-center justify-between gap-3 rounded px-2 py-1.5"
              >
                <div className="min-w-0">
                  <div
                    className="text-sm"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {formatBackupDate(e.mtime)}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {formatSize(e.size)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(e.path)}
                  aria-label="삭제"
                  title="삭제"
                  className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded transition hover:opacity-90"
                  style={{ color: "var(--text-muted)" }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

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
    </div>
  );
}

function formatBackupDate(mtime: number): string {
  const d = new Date(mtime);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type BackupConfirmModalProps = {
  candidates: BackupEntry[];
  keepCount: number;
  running: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

function BackupConfirmModal({
  candidates,
  keepCount,
  running,
  onConfirm,
  onCancel,
}: BackupConfirmModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !running) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, running]);

  const title = `보관 한도 가득 (${keepCount}개)`;
  const desc = `새 백업을 만들려면 오래된 ${candidates.length}개 삭제 필요:`;
  const confirmLabel = "삭제 후 백업";

  return (
    <div
      onClick={() => !running && onCancel()}
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
          {title}
        </h3>
        <p className="mb-3 text-sm" style={{ color: "var(--text-secondary)" }}>
          {desc}
        </p>
        <ul
          className="mb-4 max-h-40 space-y-0.5 overflow-y-auto rounded px-3 py-2 text-xs"
          style={{
            background: "var(--bg-base)",
            color: "var(--text-muted)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {candidates.map((c) => (
            <li key={c.path}>{c.filename}</li>
          ))}
        </ul>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={running}
            className="cursor-pointer rounded px-3 py-1.5 text-sm transition hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ color: "var(--text-secondary)" }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={running}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "var(--accent-red)", color: "white" }}
          >
            {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
