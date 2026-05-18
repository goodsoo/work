import { useState } from "react";
import { Sparkles, Check } from "lucide-react";
import { buildClaudePrompt, type PromptInput } from "../../lib/clipboardPrompt";

interface Props extends PromptInput {
  onError?: (message: string) => void;
}

export function ClaudePromptButton({ onError, ...input }: Props) {
  const [copied, setCopied] = useState(false);
  const trimmedContent = (input.content ?? "").trim();
  const trimmedTranscript = (input.transcript ?? "").trim();
  const disabled = trimmedContent.length === 0 && trimmedTranscript.length === 0;

  async function copy() {
    try {
      const prompt = buildClaudePrompt(input);
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      onError?.(
        err instanceof Error
          ? err.message
          : "클립보드에 복사하지 못했어요.",
      );
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={disabled}
      title="본문과 회의 내용을 묶어 Claude에 붙여넣을 프롬프트로 복사"
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
          <span>Claude 프롬프트 복사</span>
        </>
      )}
    </button>
  );
}
