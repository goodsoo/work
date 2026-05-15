import { useState } from "react";
import { Check, ClipboardCopy } from "lucide-react";
import { meetingToMarkdown, type MeetingMarkdownInput } from "../../lib/markdown";

type Props = {
  meeting: MeetingMarkdownInput;
  onError?: (message: string) => void;
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

export function CopyButton({ meeting, onError }: Props) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        const md = meetingToMarkdown(meeting);
        const ok = await copyText(md);
        if (ok) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1000);
        } else {
          onError?.("복사 실패. 권한 또는 환경을 확인해주세요.");
        }
      }}
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition"
      style={{
        border: "1px solid var(--border-default)",
        color: "var(--text-secondary)",
      }}
      aria-label="마크다운 복사"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" style={{ color: "var(--accent-red)" }} />
          <span>복사됨</span>
        </>
      ) : (
        <>
          <ClipboardCopy className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
          <span>마크다운 복사</span>
        </>
      )}
    </button>
  );
}
