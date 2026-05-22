import { useEffect, useState } from "react";
import { GitBranch, RotateCcw, Trash2, X } from "lucide-react";
import {
  useEmptyPortfolioTrash,
  usePurgePortfolioWork,
  useRestorePortfolioWork,
  useTrashedPortfolioWorks,
} from "../../hooks/usePortfolio";
import type { TrashedPortfolioWork } from "../../api/portfolio";
import { useVault } from "../../lib/vault/useVault";
import { vaultAssetSrc } from "../../lib/portfolio/assetUrl";
import { formatDateTimeKo } from "../../lib/dates";
import { formatError } from "../../lib/errors";
import { ConfirmDialog } from "../ConfirmDialog";

const CATEGORY_LABEL: Record<string, string> = {
  ui_ux: "UI/UX",
  backend: "Backend",
  infra: "Infra",
  fix: "Fix",
  other: "기타",
};
const CATEGORY_COLOR: Record<string, string> = {
  ui_ux: "var(--cat-uiux)",
  backend: "var(--cat-backend)",
  infra: "var(--cat-infra)",
  fix: "var(--cat-fix)",
  other: "var(--cat-other)",
};

// stamp → 표시용 ISO ms (TrashedPortfolioWork.deletedAt 에 이미 ms 변환되어 있음).

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function PortfolioTrashModal({ isOpen, onClose }: Props) {
  const { data, isLoading } = useTrashedPortfolioWorks();
  const restore = useRestorePortfolioWork();
  const purge = usePurgePortfolioWork();
  const empty = useEmptyPortfolioTrash();
  const { adapter } = useVault();
  const vaultRoot = adapter.getRoot();

  const [error, setError] = useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<TrashedPortfolioWork | null>(
    null,
  );
  const [emptyConfirm, setEmptyConfirm] = useState(false);
  const confirmOpen = purgeTarget !== null || emptyConfirm;

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !confirmOpen) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, confirmOpen]);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setPurgeTarget(null);
      setEmptyConfirm(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleRestore(trashPath: string) {
    setError(null);
    try {
      await restore.mutateAsync(trashPath);
    } catch (e) {
      setError(formatError(e));
    }
  }

  async function confirmPurge() {
    if (!purgeTarget) return;
    try {
      await purge.mutateAsync(purgeTarget.trashPath);
      setPurgeTarget(null);
    } catch (e) {
      setError(formatError(e));
      setPurgeTarget(null);
    }
  }

  async function confirmEmpty() {
    try {
      await empty.mutateAsync();
      setEmptyConfirm(false);
    } catch (e) {
      setError(formatError(e));
      setEmptyConfirm(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      role="dialog"
      aria-modal="true"
      aria-label="휴지통"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-xl"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          height: "min(640px, 85vh)",
        }}
      >
        <aside
          className="flex min-h-0 flex-1 flex-col"
          style={{ background: "var(--bg-base)" }}
        >
          <div
            className="flex h-12 shrink-0 items-center gap-2 px-4 text-sm font-semibold"
            style={{
              color: "var(--text-primary)",
              borderBottom: "1px solid var(--border-default)",
            }}
          >
            <Trash2 className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
            휴지통
            {data && data.length > 0 ? (
              <span
                className="text-xs font-normal"
                style={{ color: "var(--text-muted)" }}
              >
                {data.length}
              </span>
            ) : null}
            <div className="ml-auto flex items-center gap-1">
              {data && data.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setEmptyConfirm(true);
                  }}
                  disabled={empty.isPending}
                  title="휴지통 비우기"
                  className="rounded-md px-2 py-1 text-xs font-normal transition disabled:opacity-40"
                  style={{
                    backgroundColor: "var(--accent-red-bg)",
                    color: "var(--accent-red-text)",
                    border: "1px solid var(--accent-red)",
                    minHeight: 0,
                  }}
                >
                  비우기
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                title="닫기  ESC"
                aria-label="닫기"
                className="flex h-7 w-7 items-center justify-center rounded-md transition"
                style={{ color: "var(--text-muted)" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {error ? (
            <div
              className="mx-3 mt-2 rounded px-2 py-1 text-xs"
              style={{
                borderLeft: "2px solid var(--accent-red)",
                backgroundColor: "var(--accent-red-bg)",
                color: "var(--accent-red-text)",
              }}
            >
              {error}
            </div>
          ) : null}

          {data && data.length > 0 ? (
            <div
              className="mx-3 mt-2 rounded-md px-2 py-1.5 text-[11px] leading-relaxed"
              style={{
                backgroundColor: "var(--accent-blue-bg)",
                color: "var(--accent-blue-text)",
                border: "1px solid var(--accent-blue)",
              }}
            >
              여기 있는 카드는 <strong>전체 동기화</strong> 시 같은 PR 로 다시
              생성됩니다. 부활 없이 안 보이게만 두려면 <strong>미사용</strong>
              으로 옮겨주세요. <strong>복원</strong> 누르면 자동으로 미사용
              자리로 돌아갑니다.
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-md"
                    style={{ backgroundColor: "var(--bg-surface)" }}
                  />
                ))}
              </div>
            ) : !data || data.length === 0 ? (
              <div
                className="px-4 py-8 text-center text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                휴지통이 비어 있어요
              </div>
            ) : (
              <ul className="flex flex-col gap-2 p-3">
                {data.map((t) => (
                  <TrashListItem
                    key={t.trashPath}
                    work={t}
                    vaultRoot={vaultRoot ?? ""}
                    onRestore={() => handleRestore(t.trashPath)}
                    onPurge={() => setPurgeTarget(t)}
                    busy={
                      (restore.isPending && restore.variables === t.trashPath) ||
                      (purge.isPending && purge.variables === t.trashPath)
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={purgeTarget !== null}
        danger
        title="영구 삭제"
        message={
          purgeTarget
            ? `"${purgeTarget.frontmatter.impact_summary || purgeTarget.frontmatter.github_title}" 카드를 영구 삭제할까요? 되돌릴 수 없어요.`
            : ""
        }
        confirmLabel="영구 삭제"
        busy={purge.isPending}
        onConfirm={confirmPurge}
        onCancel={() => setPurgeTarget(null)}
      />
      <ConfirmDialog
        open={emptyConfirm}
        danger
        title="휴지통 비우기"
        message={`휴지통의 ${data?.length ?? 0}개 항목을 모두 영구 삭제할까요? 되돌릴 수 없어요.`}
        confirmLabel="비우기"
        busy={empty.isPending}
        onConfirm={confirmEmpty}
        onCancel={() => setEmptyConfirm(false)}
      />
    </div>
  );
}

function TrashListItem({
  work,
  vaultRoot,
  onRestore,
  onPurge,
  busy,
}: {
  work: TrashedPortfolioWork;
  vaultRoot: string;
  onRestore: () => void;
  onPurge: () => void;
  busy: boolean;
}) {
  const fm = work.frontmatter;
  const firstShot = fm.screenshots[0];
  const title = fm.impact_summary || fm.github_title;
  const categoryLabel = CATEGORY_LABEL[fm.category] ?? fm.category;
  const categoryColor = CATEGORY_COLOR[fm.category] ?? "var(--cat-other)";
  return (
    <li
      className="flex items-center gap-3 rounded-md px-3 py-2"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
      }}
    >
      <div
        className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md"
        style={{
          backgroundColor: "var(--bg-surface-hover)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {firstShot ? (
          <img
            src={vaultAssetSrc(vaultRoot, firstShot.path)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <GitBranch
            className="h-4 w-4"
            strokeWidth={1.5}
            style={{ color: "var(--text-muted)" }}
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div
          className="truncate text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
          title={title}
        >
          {title}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px]"
            style={{
              backgroundColor: "var(--bg-surface-hover)",
              color: "var(--text-secondary)",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: categoryColor }}
            />
            {categoryLabel}
          </span>
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {work.deletedAt
              ? `${formatDateTimeKo(new Date(work.deletedAt).toISOString())} 삭제`
              : ""}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onRestore}
          disabled={busy}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition disabled:opacity-40"
          style={{
            backgroundColor: "var(--bg-surface-hover)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
            minHeight: 0,
          }}
          title="미사용 자리로 복원 (평가 자료에는 포함 안 됨)"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          미사용 복원
        </button>
        <button
          type="button"
          onClick={onPurge}
          disabled={busy}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition disabled:opacity-40"
          style={{
            backgroundColor: "var(--accent-red-bg)",
            color: "var(--accent-red-text)",
            border: "1px solid var(--accent-red)",
            minHeight: 0,
          }}
          title="영구 삭제"
        >
          <Trash2 className="h-3.5 w-3.5" />
          삭제
        </button>
      </div>
    </li>
  );
}

