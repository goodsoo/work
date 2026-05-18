import { RefreshCw } from "lucide-react";
import type { GhSyncProgress } from "../../hooks/usePortfolio";

type Props = {
  state: GhSyncProgress;
  onRun: () => void;
};

// design v2.3: 사이드바 헤더의 동기화 트리거. 진행 중이면 같은 자리에 progress.
export function SyncButton({ state, onRun }: Props) {
  if (state.running) {
    const pct =
      state.total > 0 ? Math.round((state.current / state.total) * 100) : 0;
    return (
      <div
        className="flex flex-col gap-1.5 rounded-md px-3 py-2 text-xs"
        style={{
          backgroundColor: "var(--bg-surface-active)",
          color: "var(--text-secondary)",
        }}
      >
        <div className="flex items-center justify-between">
          <span>동기화 중...</span>
          <span>
            {state.current}/{state.total || "?"}
          </span>
        </div>
        <div
          className="relative h-1 overflow-hidden rounded-full"
          style={{ backgroundColor: "var(--bg-surface-hover)" }}
        >
          <div
            className="absolute inset-y-0 left-0 transition-[width]"
            style={{
              width: `${pct}%`,
              backgroundColor: "var(--btn-primary)",
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onRun}
      className="flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition"
      style={{
        backgroundColor: "var(--btn-primary)",
        color: "var(--btn-primary-text)",
      }}
    >
      <RefreshCw className="h-3.5 w-3.5" />
      동기화
    </button>
  );
}
