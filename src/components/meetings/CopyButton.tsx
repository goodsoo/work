import { useState } from "react";
import { Check, ClipboardCopy } from "lucide-react";
import {
  meetingToMarkdown,
  type MeetingMarkdownInput,
  type MeetingMarkdownSection,
} from "../../lib/markdown";
import { Button } from "../common/Button";

type Props = {
  meeting: MeetingMarkdownInput;
  // 현재 탭 — 헤더(제목/일시/참석) 뒤에 이 탭 내용을 붙임.
  section?: MeetingMarkdownSection;
  onError?: (message: string) => void;
  compact?: boolean;
};

async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy path
    }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({ meeting, section, onError, compact }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const md = meetingToMarkdown(meeting, section);
    const ok = await copyText(md);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1000);
    } else {
      onError?.("복사 실패. 권한 또는 환경을 확인해주세요.");
    }
  }

  if (compact) {
    return (
      <Button
        variant="ghost"
        onClick={handleClick}
        className="px-1.5 py-1"
        style={{
          border: "1px solid var(--border-subtle)",
          color: copied ? "var(--accent-red)" : "var(--text-secondary)",
        }}
        title={copied ? "복사됨" : "마크다운 복사"}
        aria-label="마크다운 복사"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <ClipboardCopy className="h-3.5 w-3.5" />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant="secondary"
      onClick={handleClick}
      className="rounded-lg gap-2 px-3 py-2 font-normal"
      leftIcon={
        copied ? (
          <Check className="h-4 w-4" style={{ color: "var(--accent-red)" }} />
        ) : (
          <ClipboardCopy
            className="h-4 w-4"
            style={{ color: "var(--text-secondary)" }}
          />
        )
      }
      aria-label="마크다운 복사"
    >
      {copied ? "복사됨" : "마크다운 복사"}
    </Button>
  );
}
