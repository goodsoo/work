import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { inferLineKind } from "../../lib/markdownLineKind";

type Props = {
  content: string;
  onChange: (next: string) => void;
};

// textarea의 한 줄 높이 (line-height = 1.625rem, text-base 기준).
const LINE_HEIGHT = "1.625rem";

// 원본 텍스트(마크다운 source) textarea 편집기.
// 왼쪽 gutter에 각 줄의 마크다운 종류 표시.
// 세로는 페이지 스크롤 (textarea height = scrollHeight). wrap="off"라 긴 줄만 textarea 자체 가로 스크롤.
export function SourceBodyEditor({ content, onChange }: Props) {
  const [draft, setDraft] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skipNextValueSyncRef = useRef(true);

  useEffect(() => {
    if (skipNextValueSyncRef.current) {
      skipNextValueSyncRef.current = false;
      return;
    }
    setDraft(content);
  }, [content]);

  // textarea 세로 자동 맞춤 → 페이지 전체 스크롤
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [draft]);

  // 각 줄에 대해 inferLineKind
  const lineKinds = useMemo(() => {
    const lines = draft.split("\n");
    const kinds: string[] = [];
    let pos = 0;
    for (const line of lines) {
      kinds.push(inferLineKind(draft, pos));
      pos += line.length + 1;
    }
    return kinds;
  }, [draft]);

  return (
    <div className="flex" style={{ minHeight: "60svh" }}>
      <div
        className="select-none"
        style={{
          width: "5.5rem",
          color: "var(--text-muted)",
          borderRight: "1px solid var(--border-subtle)",
        }}
        aria-hidden
      >
        {lineKinds.map((kind, i) => (
          <div
            key={i}
            className="overflow-hidden whitespace-nowrap pr-2 text-right text-xs"
            style={{
              height: LINE_HEIGHT,
              lineHeight: LINE_HEIGHT,
            }}
          >
            {kind === "단락" || kind === "빈 줄" ? "" : kind}
          </div>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => {
          skipNextValueSyncRef.current = true;
          setDraft(e.target.value);
          onChange(e.target.value);
        }}
        placeholder="내용을 입력하세요..."
        className="flex-1 resize-none bg-transparent text-base outline-none"
        style={{
          color: "var(--text-primary)",
          lineHeight: LINE_HEIGHT,
          padding: 0,
          paddingLeft: "0.5rem",
          overflowY: "hidden",
        }}
        wrap="off"
      />
    </div>
  );
}
