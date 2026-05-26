import { useEffect, useState } from "react";
import { Clipboard, Check, X } from "lucide-react";
import {
  buildClaudePrompt,
  type PromptInput,
} from "../../lib/clipboardPrompt";
import { ClipPromptButton } from "../common/ClipPromptButton";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { Text } from "../common/Text";

// 외부 Claude.ai 사용 fallback 모달. 프롬프트 복사 → 외부 Claude 에 paste → 응답
// paste → [적용]. V0.7.3 부터: 응답 텍스트를 통째 summary 필드에 박음. 파싱 X.

type Props = {
  open: boolean;
  onClose: () => void;
  promptInput: PromptInput;
  onApply: (summary: string) => void;
};

export function PasteSummaryModal({ open, onClose, promptInput, onApply }: Props) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setRaw("");
      setError(null);
    }
  }, [open]);

  function handleApply() {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      setError("응답을 붙여넣은 후 적용하세요.");
      return;
    }
    onApply(trimmed);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      maxWidth="max-w-lg"
      ariaLabel="Claude 응답 직접 붙여넣기"
    >
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clipboard className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
            <Text variant="h3" as="h2" weight="semibold">
              직접 붙여넣기
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

        <div className="flex flex-col gap-2">
          <Text variant="caption" color="muted" as="p" className="leading-relaxed">
            1) 아래 버튼으로 프롬프트를 복사한 뒤 외부 Claude.ai 에 붙여넣고,
            <br />
            2) 받은 응답을 다시 아래 영역에 붙여넣고 [적용] 을 누르세요.
          </Text>
          <ClipPromptButton
            buildPrompt={() => buildClaudePrompt(promptInput)}
            label="프롬프트 복사"
          />
        </div>

        <div className="flex flex-col gap-2">
          <textarea
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              if (error) setError(null);
            }}
            rows={8}
            placeholder="Claude 응답을 붙여넣으세요"
            className="w-full resize-y rounded-md px-2.5 py-2 text-sm transition"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: `1px solid ${error ? "var(--accent-red)" : "var(--border-default)"}`,
              color: "var(--text-primary)",
            }}
          />
          {error ? (
            <Text
              variant="caption"
              as="span"
              className="text-[11px]"
              style={{ color: "var(--accent-red-text)" }}
            >
              {error}
            </Text>
          ) : null}
        </div>

        <div className="mt-auto flex items-center justify-end gap-2 pt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="px-2.5 py-1"
          >
            닫기
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleApply}
            disabled={raw.trim().length === 0}
            leftIcon={<Check className="h-3.5 w-3.5" />}
            className="px-3 py-1 disabled:opacity-50"
          >
            적용
          </Button>
        </div>
      </div>
    </Modal>
  );
}
