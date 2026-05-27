import { useEffect, useState } from "react";
import { Sparkles, Clipboard, Check, RotateCw, X } from "lucide-react";
import {
  buildClaudePrompt,
  type PromptInput,
} from "../../lib/clipboardPrompt";
import { runClaude } from "../../lib/portfolio/claude";
import { ClipPromptButton } from "../common/ClipPromptButton";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { Text } from "../common/Text";
import { Spinner } from "../common/Spinner";
import { MarkdownView } from "./MarkdownView";

// 요약하기 모달 — 한 오버레이 안에 [자동 요약] / [직접 붙여넣기] 두 탭.
// 자동: claude CLI 1회 호출 → 응답 미리보기 → [적용]. 붙여넣기: 프롬프트 복사 →
// 외부 Claude → 응답 paste → [적용]. 둘 다 응답 텍스트를 통째 summary 에 박음 (파싱 X).

type Tab = "auto" | "paste";

type Props = {
  open: boolean;
  onClose: () => void;
  promptInput: PromptInput;
  onApply: (summary: string) => void;
};

export function SummaryModal({ open, onClose, promptInput, onApply }: Props) {
  const [tab, setTab] = useState<Tab>("auto");

  // 자동 요약 탭 상태. 호출은 자동이 아니라 "요약 생성" 버튼 클릭으로만 — 직접
  // 붙여넣기를 원하는 경우 헛호출 방지 (모달 열림 ≠ Claude 호출).
  const [requesting, setRequesting] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  // 직접 붙여넣기 탭 상태
  const [raw, setRaw] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  // 닫힐 때 전체 reset.
  useEffect(() => {
    if (open) return;
    setTab("auto");
    setRequesting(false);
    setAutoError(null);
    setSuggestion(null);
    setRaw("");
    setPasteError(null);
  }, [open]);

  async function runAuto() {
    setRequesting(true);
    setAutoError(null);
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
      if (!text) throw new Error("응답이 비어있습니다.");
      setSuggestion(text);
    } catch (err) {
      setAutoError(err instanceof Error ? err.message : String(err));
    } finally {
      setRequesting(false);
    }
  }

  function applyAuto() {
    if (!suggestion) return;
    onApply(suggestion);
    onClose();
  }

  function applyPaste() {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      setPasteError("응답을 붙여넣은 후 적용하세요.");
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
      ariaLabel="요약하기"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {/* header + tab nav */}
        <div className="shrink-0">
          <div className="flex items-center justify-between px-5 pt-5">
            <Text variant="h3" as="h2" weight="semibold">
              요약하기
            </Text>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              leftIcon={<X className="h-4 w-4" />}
              className="px-1.5 py-1"
              aria-label="닫기"
            />
          </div>
          <div
            className="mt-3 flex gap-1 px-5"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}
          >
            <TabBtn
              label="자동 요약"
              icon={<Sparkles className="h-3.5 w-3.5" />}
              active={tab === "auto"}
              onClick={() => setTab("auto")}
            />
            <TabBtn
              label="직접 붙여넣기"
              icon={<Clipboard className="h-3.5 w-3.5" />}
              active={tab === "paste"}
              onClick={() => setTab("paste")}
            />
          </div>
        </div>

        {/* 자동 요약 탭 */}
        {tab === "auto" ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
              <Text variant="caption" color="muted" as="p">
                구독 사용량으로 호출합니다. 본인 머신의 <code>claude</code> CLI 가
                필요합니다.
              </Text>

              {!requesting && !suggestion && !autoError ? (
                <Text variant="body" color="secondary" as="p">
                  ‘요약 생성’ 을 누르면 Claude 가 메모와 음성 기록을 요약합니다.
                </Text>
              ) : null}

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

              {autoError ? (
                <Text
                  variant="caption"
                  as="div"
                  className="rounded-md px-2.5 py-1.5 text-[12px]"
                  style={{
                    backgroundColor: "var(--accent-red-bg)",
                    color: "var(--accent-red-text)",
                  }}
                >
                  {autoError}
                </Text>
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
            </div>

            <div
              className="flex shrink-0 items-center justify-end gap-2 px-5 py-3"
              style={{ borderTop: "1px solid var(--border-subtle)" }}
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={onClose}
                className="px-2.5 py-1"
              >
                닫기
              </Button>
              {suggestion ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={runAuto}
                    disabled={requesting}
                    leftIcon={<RotateCw className="h-3.5 w-3.5" />}
                    className="px-2.5 py-1 disabled:opacity-50"
                  >
                    다시 요청
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={applyAuto}
                    leftIcon={<Check className="h-3.5 w-3.5" />}
                    className="px-3 py-1"
                  >
                    적용
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={runAuto}
                  disabled={requesting}
                  leftIcon={<Sparkles className="h-3.5 w-3.5" />}
                  className="px-3 py-1 disabled:opacity-50"
                >
                  {requesting ? "생성 중…" : autoError ? "다시 요청" : "요약 생성"}
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
              <div className="flex flex-col gap-2">
                <Text
                  variant="caption"
                  color="muted"
                  as="p"
                  className="leading-relaxed"
                >
                  1) 아래 버튼으로 프롬프트를 복사한 뒤 외부 Claude.ai 에 붙여넣고,
                  <br />
                  2) 받은 응답을 다시 아래 영역에 붙여넣고 [적용] 을 누르세요.
                </Text>
                <ClipPromptButton
                  buildPrompt={() => buildClaudePrompt(promptInput)}
                  label="프롬프트 복사"
                />
              </div>

              <div className="flex flex-1 flex-col gap-2">
                <textarea
                  value={raw}
                  onChange={(e) => {
                    setRaw(e.target.value);
                    if (pasteError) setPasteError(null);
                  }}
                  placeholder="Claude 응답을 붙여넣으세요"
                  className="min-h-[8rem] w-full flex-1 resize-none rounded-md px-2.5 py-2 text-sm transition"
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    border: `1px solid ${pasteError ? "var(--accent-red)" : "var(--border-default)"}`,
                    color: "var(--text-primary)",
                  }}
                />
                {pasteError ? (
                  <Text
                    variant="caption"
                    as="span"
                    className="text-[11px]"
                    style={{ color: "var(--accent-red-text)" }}
                  >
                    {pasteError}
                  </Text>
                ) : null}
              </div>
            </div>

            <div
              className="flex shrink-0 items-center justify-end gap-2 px-5 py-3"
              style={{ borderTop: "1px solid var(--border-subtle)" }}
            >
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
                onClick={applyPaste}
                disabled={raw.trim().length === 0}
                leftIcon={<Check className="h-3.5 w-3.5" />}
                className="px-3 py-1 disabled:opacity-50"
              >
                적용
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function TabBtn({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className="gap-1.5 rounded-none px-3 py-2"
      style={{
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        borderBottom: active
          ? "2px solid var(--text-primary)"
          : "2px solid transparent",
        marginBottom: "-1px",
        fontWeight: active ? 600 : 400,
      }}
    >
      {icon}
      <span>{label}</span>
    </Button>
  );
}
