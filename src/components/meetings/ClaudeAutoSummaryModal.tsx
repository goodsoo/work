import { useEffect, useRef, useState } from "react";
import { Sparkles, Check, RotateCw, X } from "lucide-react";
import {
  buildClaudePrompt,
  type PromptInput,
} from "../../lib/clipboardPrompt";
import { runClaude } from "../../lib/portfolio/claude";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { Text } from "../common/Text";
import { Spinner } from "../common/Spinner";
import { MarkdownView } from "./MarkdownView";

// Claude CLI 자동 요약 모달. 열리는 순간 1회 자동 호출 → 응답 마크다운 → [적용].
// V0.7.3 부터: 응답 텍스트를 통째 summary 필드에 박음. 파싱 X — 본문/요약 통합 모델.

type Props = {
  open: boolean;
  onClose: () => void;
  promptInput: PromptInput;
  onApply: (summary: string) => void;
};

export function ClaudeAutoSummaryModal({
  open,
  onClose,
  promptInput,
  onApply,
}: Props) {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const triggeredRef = useRef(false);

  // 모달 닫혔다가 다시 열릴 때마다 1회 자동 호출. close 시 state reset.
  useEffect(() => {
    if (!open) {
      triggeredRef.current = false;
      setRequesting(false);
      setError(null);
      setSuggestion(null);
      return;
    }
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    void runRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function runRequest() {
    setRequesting(true);
    setError(null);
    setSuggestion(null);
    try {
      const prompt = buildClaudePrompt(promptInput);
      const result = await runClaude(prompt);
      if (result.code !== 0) {
        const msg = result.stderr.trim();
        if (/not found|command not found/i.test(msg)) {
          throw new Error("claude CLI 가 안 보입니다. 설치 후 `claude` 로그인을 먼저 하세요.");
        }
        if (/auth|login|unauthor/i.test(msg)) {
          throw new Error("claude 로그인이 필요합니다. 터미널에서 `claude` 실행 후 인증하세요.");
        }
        throw new Error(msg || "claude CLI 실행 실패");
      }
      const text = result.stdout.trim();
      if (!text) {
        throw new Error("응답이 비어있습니다.");
      }
      setSuggestion(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRequesting(false);
    }
  }

  function handleApply() {
    if (!suggestion) return;
    onApply(suggestion);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      maxWidth="max-w-lg"
      ariaLabel="Claude 자동 요약"
    >
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: "var(--accent-primary)" }} />
            <Text variant="h3" as="h2" weight="semibold">
              Claude 자동 요약
            </Text>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            leftIcon={<X className="h-4 w-4" />}
            className="px-1.5 py-1"
            aria-label="닫기"
          />
        </div>
        <Text variant="caption" color="muted" as="p">
          구독 사용량으로 호출합니다. 본인 머신의 <code>claude</code> CLI 가 필요합니다.
        </Text>

        {requesting ? (
          <div
            className="flex items-center gap-2 rounded-md p-3"
            style={{ backgroundColor: "var(--bg-surface)" }}
          >
            <Spinner size="md" />
            <Text variant="body" color="secondary">
              Claude 에게 묻는 중…
            </Text>
          </div>
        ) : null}

        {error ? (
          <div className="flex flex-col gap-2">
            <Text
              variant="caption"
              as="div"
              className="rounded-md px-2.5 py-1.5 text-[12px]"
              style={{
                backgroundColor: "var(--accent-red-bg)",
                color: "var(--accent-red-text)",
              }}
            >
              {error}
            </Text>
            <Button
              variant="secondary"
              size="sm"
              onClick={runRequest}
              leftIcon={<RotateCw className="h-3.5 w-3.5" />}
              className="self-start px-2.5 py-1"
            >
              다시 요청
            </Button>
          </div>
        ) : null}

        {suggestion ? (
          <div
            className="rounded-md p-3"
            style={{
              backgroundColor: "var(--bg-surface-hover)",
              border: "1px solid var(--border-default)",
            }}
          >
            <MarkdownView content={suggestion} />
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-end gap-2 pt-2">
          {suggestion ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={runRequest}
                disabled={requesting}
                leftIcon={<RotateCw className="h-3.5 w-3.5" />}
                className="px-2.5 py-1"
              >
                다시 요청
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApply}
                leftIcon={<Check className="h-3.5 w-3.5" />}
                className="px-3 py-1"
              >
                적용
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="px-2.5 py-1"
            >
              닫기
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
