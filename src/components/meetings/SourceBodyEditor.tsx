import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Minus,
  Table,
  Link,
} from "lucide-react";
import {
  inferLineKind,
  labelForKind,
  type LineKind,
} from "../../lib/markdownLineKind";

type Props = {
  content: string;
  onChange: (next: string) => void;
};

// textarea의 한 줄 높이 (line-height = 1.625rem, text-base 기준).
const LINE_HEIGHT = "1.625rem";
const GUTTER_WIDTH = "1.75rem";

export function SourceBodyEditor({ content, onChange }: Props) {
  const [draft, setDraft] = useState(content);
  const [caretLine, setCaretLine] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skipNextValueSyncRef = useRef(true);

  function updateCaretLine() {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart ?? 0;
    setCaretLine(el.value.slice(0, pos).split("\n").length - 1);
  }

  useEffect(() => {
    if (skipNextValueSyncRef.current) {
      skipNextValueSyncRef.current = false;
      return;
    }
    setDraft(content);
  }, [content]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [draft]);

  const lineKinds = useMemo(() => {
    const lines = draft.split("\n");
    const kinds: LineKind[] = [];
    let pos = 0;
    for (const line of lines) {
      kinds.push(inferLineKind(draft, pos));
      pos += line.length + 1;
    }

    // Post-pass 1: ordered list 실제 렌더링 번호 계산.
    // depth별 counter. 첫 item은 source 의 literal 숫자(예 "3.") 사용.
    // 같은 depth에 bullet/checkbox/empty/heading 등 들어오면 해당 depth 이하 reset.
    const counters = new Map<number, number>();
    function resetAtAndDeeper(d: number) {
      for (const key of Array.from(counters.keys())) {
        if (key >= d) counters.delete(key);
      }
    }
    for (let i = 0; i < kinds.length; i++) {
      const k = kinds[i];
      const isContinuation = "continuation" in k && k.continuation === true;
      if (isContinuation) continue; // 카운터에 영향 X

      if (k.type === "ordered") {
        const d = k.depth;
        if (counters.has(d)) {
          counters.set(d, counters.get(d)! + 1);
        } else {
          const m = lines[i].match(/^\s*(\d+)\.\s/);
          counters.set(d, m ? parseInt(m[1], 10) : 1);
        }
        // 더 깊은 depth는 새 list 시작에서 리셋
        for (const key of Array.from(counters.keys())) {
          if (key > d) counters.delete(key);
        }
        kinds[i] = { ...k, renderedNumber: counters.get(d)! };
      } else if (k.type === "bullet" || k.type === "checkbox") {
        // 같은 depth의 ordered counter 끊김 (mixed type)
        resetAtAndDeeper(k.depth);
      } else if (k.type === "empty" || k.type === "paragraph") {
        counters.clear();
      } else {
        // heading / fence / hr / table / link-def / code-* → 전체 리셋
        counters.clear();
      }
    }

    // Post-pass 2: setext heading 검증 + 윗 줄에 같은 heading 표시.
    // CommonMark: setext heading은 윗 줄이 top-level paragraph일 때만 적용.
    // 윗 줄이 list 내용(item/continuation)이면 ---는 thematic break, ===는 plain text.
    for (let i = 1; i < kinds.length; i++) {
      const k = kinds[i];
      if (k.type === "heading" && k.setext) {
        const prev = kinds[i - 1];
        if (prev.type === "paragraph") {
          kinds[i - 1] = { type: "heading", level: k.level, setext: true };
        } else {
          // setext 적용 불가 → demote
          kinds[i] = k.level === 2 ? { type: "hr" } : { type: "paragraph" };
        }
      }
    }

    return kinds;
  }, [draft]);

  return (
    <div
      className="flex rounded-md"
      style={{
        minHeight: "60svh",
        backgroundColor: "var(--bg-surface)",
      }}
    >
      <div
        className="select-none"
        style={{
          width: GUTTER_WIDTH,
          color: "var(--text-muted)",
          borderRight: "1px solid var(--border-subtle)",
        }}
        aria-hidden
      >
        {lineKinds.map((kind, i) => (
          <GutterMarker key={i} kind={kind} active={i === caretLine} />
        ))}
      </div>
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => {
          skipNextValueSyncRef.current = true;
          setDraft(e.target.value);
          onChange(e.target.value);
          updateCaretLine();
        }}
        onSelect={updateCaretLine}
        onKeyUp={updateCaretLine}
        onClick={updateCaretLine}
        onFocus={updateCaretLine}
        onBlur={() => setCaretLine(null)}
        placeholder="메모 내용을 적어주세요..."
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

function GutterMarker({
  kind,
  active,
}: {
  kind: LineKind;
  active: boolean;
}) {
  const label = labelForKind(kind);
  const depth =
    "depth" in kind && typeof kind.depth === "number" ? kind.depth : 0;
  const isContinuation =
    "continuation" in kind && kind.continuation === true;

  return (
    <div
      title={label || undefined}
      className="flex items-center justify-center"
      style={{
        height: LINE_HEIGHT,
        lineHeight: LINE_HEIGHT,
        opacity: isContinuation ? 0.4 : 1,
        backgroundColor: active ? "var(--bg-surface-hover)" : undefined,
        color: active ? "var(--text-primary)" : undefined,
      }}
    >
      <span
        className="relative inline-flex items-center justify-center"
        style={{ width: "1.25rem", height: "1rem" }}
      >
        <KindGlyph kind={kind} />
        {depth > 0 ? (
          <span
            className="absolute font-mono text-[8px] font-semibold tabular-nums leading-none"
            style={{
              right: "-1px",
              bottom: "-1px",
              color: "var(--text-muted)",
            }}
          >
            {depth}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function KindGlyph({ kind }: { kind: LineKind }) {
  switch (kind.type) {
    case "paragraph":
    case "empty":
      return null;
    case "heading":
      return (
        <span
          className="font-mono text-[10px] font-semibold"
          style={{ color: "var(--text-secondary)" }}
        >
          H{kind.level}
        </span>
      );
    case "bullet":
      return <List className="h-3.5 w-3.5" />;
    case "ordered":
      if (typeof kind.renderedNumber === "number") {
        return (
          <span
            className="font-mono text-[10px] font-semibold tabular-nums"
            style={{ color: "var(--text-secondary)" }}
          >
            {kind.renderedNumber}.
          </span>
        );
      }
      return <ListOrdered className="h-3.5 w-3.5" />;
    case "checkbox":
      return <CheckSquare className="h-3.5 w-3.5" />;
    case "quote":
      return <Quote className="h-3.5 w-3.5" />;
    case "code-fence":
    case "code-block":
    case "code-indent":
      return <Code className="h-3.5 w-3.5" />;
    case "hr":
      return <Minus className="h-3.5 w-3.5" />;
    case "table":
      return <Table className="h-3.5 w-3.5" />;
    case "link-def":
      return <Link className="h-3.5 w-3.5" />;
  }
}
