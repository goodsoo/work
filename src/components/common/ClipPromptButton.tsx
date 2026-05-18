import { useState } from "react";
import { Sparkles, Check } from "lucide-react";

// design v2.3 2A: 일반화된 Claude 프롬프트 복사 버튼.
// meeting / PR / journal 등 모든 케이스에서 공유. caller 가 buildPrompt 를 전달.

type Variant = "outlined" | "compact";

type Props = {
  buildPrompt: () => string;
  disabled?: boolean;
  label?: string;
  title?: string;
  variant?: Variant;
  onError?: (message: string) => void;
};

export function ClipPromptButton({
  buildPrompt,
  disabled,
  label = "Claude 프롬프트 복사",
  title = "Claude 에 붙여넣을 프롬프트로 복사",
  variant = "outlined",
  onError,
}: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      const prompt = buildPrompt();
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      onError?.(
        err instanceof Error ? err.message : "클립보드에 복사하지 못했어요.",
      );
    }
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={copy}
        disabled={disabled}
        title={title}
        className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs transition disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          backgroundColor: "var(--bg-surface-hover)",
          color: "var(--text-secondary)",
        }}
      >
        {copied ? (
          <Check className="h-3 w-3" />
        ) : (
          <Sparkles className="h-3 w-3" />
        )}
        <span>{copied ? "복사됨" : label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        border: "1px solid var(--border-default)",
        color: "var(--text-secondary)",
      }}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" />
          <span>복사됨</span>
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
