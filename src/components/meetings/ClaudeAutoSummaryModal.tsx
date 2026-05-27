import { useEffect, useRef, useState } from "react";
import { Sparkles, Check, RotateCw, X } from "lucide-react";
import {
  buildClaudePrompt,
  type PromptInput,
} from "../../lib/clipboardPrompt";
import {
  runClaudeStream,
  type ClaudeStreamController,
} from "../../lib/portfolio/claude";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { Text } from "../common/Text";
import { Spinner } from "../common/Spinner";
import { MarkdownView } from "./MarkdownView";

// Claude CLI 자동 요약 모달. 열리는 순간 1회 자동 호출 → 응답 마크다운 → [적용].
// V0.7.3 부터: 응답 텍스트를 통째 summary 필드에 박음. 파싱 X — 본문/요약 통합 모델.
// 진행 표시: stream-json 으로 받아 경과시간 + 도착 글자/토큰을 라이브로 보여줌
// (claude -p 가 프로젝트 컨텍스트 로딩으로 느려서 "멈춤 vs 작업 중" 구분이 안 되던 문제).

type Props = {
  open: boolean;
  onClose: () => void;
  promptInput: PromptInput;
  onApply: (summary: string) => void;
};

type Stats = {
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
};

// "claude-sonnet-4-6" → "sonnet-4-6" (claude- 접두사만 떼서 간결하게).
function shortModel(model?: string): string | null {
  if (!model) return null;
  return model.replace(/^claude-/, "");
}

// 40초 넘게 걸리면 "느린 게 정상일 수 있다"는 안내를 띄울 임계.
const SLOW_HINT_MS = 40_000;

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ClaudeAutoSummaryModal({
  open,
  onClose,
  promptInput,
  onApply,
}: Props) {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [chars, setChars] = useState(0);
  const [liveTokens, setLiveTokens] = useState<number | undefined>(undefined);
  const [liveModel, setLiveModel] = useState<string | undefined>(undefined);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);

  const triggeredRef = useRef(false);
  const controllerRef = useRef<ClaudeStreamController | null>(null);
  const startRef = useRef(0);

  // 모달 닫혔다가 다시 열릴 때마다 1회 자동 호출. close 시 진행 중 프로세스 kill + state reset.
  useEffect(() => {
    if (!open) {
      triggeredRef.current = false;
      void controllerRef.current?.cancel();
      controllerRef.current = null;
      setRequesting(false);
      setError(null);
      setSuggestion(null);
      setChars(0);
      setLiveTokens(undefined);
      setLiveModel(undefined);
      setElapsedMs(0);
      setStats(null);
      return;
    }
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    void runRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 경과시간 tick — 요청 중일 때만 200ms 마다 갱신.
  useEffect(() => {
    if (!requesting) return;
    const id = setInterval(() => setElapsedMs(Date.now() - startRef.current), 200);
    return () => clearInterval(id);
  }, [requesting]);

  async function runRequest() {
    setRequesting(true);
    setError(null);
    setSuggestion(null);
    setChars(0);
    setLiveTokens(undefined);
    setLiveModel(undefined);
    setStats(null);
    startRef.current = Date.now();
    setElapsedMs(0);

    const ctrl = runClaudeStream(buildClaudePrompt(promptInput), (p) => {
      setChars(p.chars);
      if (p.outputTokens != null) setLiveTokens(p.outputTokens);
      if (p.model) setLiveModel(p.model);
    });
    controllerRef.current = ctrl;

    try {
      const res = await ctrl.done;
      if (controllerRef.current !== ctrl) return; // 닫혔거나 재요청으로 교체됨
      const msg = res.stderr || (res.errored ? res.text : "");
      if (res.code !== 0 || res.errored || !res.text) {
        if (/not found|command not found/i.test(msg)) {
          throw new Error("claude CLI 가 안 보입니다. 설치 후 `claude` 로그인을 먼저 하세요.");
        }
        if (/auth|login|unauthor/i.test(msg)) {
          throw new Error("claude 로그인이 필요합니다. 터미널에서 `claude` 실행 후 인증하세요.");
        }
        if (!res.text) {
          throw new Error(msg.trim() || "응답이 비어있습니다.");
        }
        throw new Error(msg.trim() || "claude CLI 실행 실패");
      }
      setSuggestion(res.text);
      setStats({
        durationMs: res.durationMs,
        inputTokens: res.inputTokens,
        outputTokens: res.outputTokens,
        model: res.model,
      });
    } catch (err) {
      if (controllerRef.current !== ctrl) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (controllerRef.current === ctrl) {
        controllerRef.current = null;
        setRequesting(false);
      }
    }
  }

  function handleApply() {
    if (!suggestion) return;
    onApply(suggestion);
    onClose();
  }

  const tokenLabel = liveTokens != null ? `${liveTokens.toLocaleString()}토큰` : null;
  const liveModelLabel = shortModel(liveModel);
  const statsModelLabel = shortModel(stats?.model);

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
            className="flex flex-col gap-1.5 rounded-md p-3"
            style={{ backgroundColor: "var(--bg-surface)" }}
          >
            <div className="flex items-center gap-2">
              <Spinner size="md" />
              <Text variant="body" color="secondary">
                Claude 가 작성 중…
              </Text>
              <Text
                variant="body"
                color="secondary"
                className="ml-auto tabular-nums"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatElapsed(elapsedMs)}
              </Text>
            </div>
            <Text variant="caption" color="muted" as="div">
              {liveModelLabel ? `${liveModelLabel} · ` : ""}
              출력 {chars.toLocaleString()}자
              {tokenLabel ? ` · ${tokenLabel}` : ""}
            </Text>
            {elapsedMs > SLOW_HINT_MS ? (
              <Text variant="caption" color="muted" as="div">
                예상보다 오래 걸리고 있습니다. 입력이 길면 더 걸릴 수 있습니다.
              </Text>
            ) : null}
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
          <div className="flex flex-col gap-2">
            {stats ? (
              <Text variant="caption" color="muted" as="div">
                완료
                {statsModelLabel ? ` · ${statsModelLabel}` : ""}
                {stats.durationMs != null
                  ? ` · ${Math.round(stats.durationMs / 1000)}초`
                  : ""}
                {stats.inputTokens != null
                  ? ` · 입력 ${stats.inputTokens.toLocaleString()}토큰`
                  : ""}
                {stats.outputTokens != null
                  ? ` · 출력 ${stats.outputTokens.toLocaleString()}토큰`
                  : ""}
              </Text>
            ) : null}
            <div
              className="rounded-md p-3"
              style={{
                backgroundColor: "var(--bg-surface-hover)",
                border: "1px solid var(--border-default)",
              }}
            >
              <MarkdownView content={suggestion} />
            </div>
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
              {requesting ? "중지" : "닫기"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
