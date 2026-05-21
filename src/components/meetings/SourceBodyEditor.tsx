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
import {
  applyIndent,
  applyEnterContinue,
  applyUrlPaste,
  applyWrap,
  applyLineMove,
  applyLineDuplicate,
  applyLineKindTransform,
  detectSlashTrigger,
  type EditResult,
} from "../../lib/markdownTyping";
import {
  SlashCommandPopover,
  getSlashOptionsForFilter,
  type SlashOption,
} from "./SlashCommandPopover";

type Props = {
  content: string;
  onChange: (next: string) => void;
};

// textarea의 한 줄 높이 (line-height = 1.625rem, text-base 기준).
const LINE_HEIGHT = "1.625rem";
const GUTTER_WIDTH = "1.75rem";

type SlashState = {
  slashStart: number; // value 안 `/` 의 offset
  filter: string;
  selectedIndex: number;
  slashLine: number; // popover top 계산용 (slash 가 있는 줄 index)
};

export function SourceBodyEditor({ content, onChange }: Props) {
  const [draft, setDraft] = useState(content);
  const [caretLine, setCaretLine] = useState<number | null>(null);
  const [slashState, setSlashState] = useState<SlashState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skipNextValueSyncRef = useRef(true);
  // 다음 render 직후 textarea selection 을 강제로 set 할 위치. Tab/Enter/Paste 같은
  // 프로그램 edit 에서 caret 을 정확히 이동시키기 위함.
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);

  function updateCaretLine() {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart ?? 0;
    setCaretLine(el.value.slice(0, pos).split("\n").length - 1);
    updateSlashTrigger(el.value, pos);
  }

  // value + caret 위치 기준으로 slash trigger 재평가. 활성 trigger 면 state set,
  // 아니면 close.
  function updateSlashTrigger(value: string, caret: number) {
    const t = detectSlashTrigger(value, caret);
    if (!t) {
      if (slashState) setSlashState(null);
      return;
    }
    const slashLine = value.slice(0, t.slashStart).split("\n").length - 1;
    setSlashState((prev) => {
      // filter 가 바뀌면 selectedIndex 는 0 으로 reset.
      if (!prev || prev.slashStart !== t.slashStart) {
        return {
          slashStart: t.slashStart,
          filter: t.filter,
          selectedIndex: 0,
          slashLine,
        };
      }
      if (prev.filter === t.filter) return prev;
      return { ...prev, filter: t.filter, selectedIndex: 0, slashLine };
    });
  }

  // SlashCommandPopover 옵션 선택 시: `/{filter}` literal 을 제거하고 target kind 로
  // 줄 변환. 변환 후 caret 은 transform 결과의 caret 위치로.
  function commitSlashOption(option: SlashOption) {
    const el = textareaRef.current;
    if (!el || !slashState) return;
    const value = el.value;
    const { slashStart, filter } = slashState;
    const slashEnd = slashStart + 1 + filter.length;
    // 1) `/{filter}` 제거
    const stripped = value.slice(0, slashStart) + value.slice(slashEnd);
    // 2) 그 자리 (slashStart) 의 줄을 target kind 로 변환
    const r = applyLineKindTransform(stripped, slashStart, option.target);
    commitEdit(r);
    setSlashState(null);
  }

  function commitEdit(r: EditResult) {
    pendingSelectionRef.current = { start: r.start, end: r.end };
    skipNextValueSyncRef.current = true;
    setDraft(r.value);
    onChange(r.value);
  }

  // gutter 클릭 → 해당 줄 전체 선택 (줄 시작 ~ 끝, 개행 제외) + focus
  function focusLine(lineIndex: number) {
    const el = textareaRef.current;
    if (!el) return;
    const lines = el.value.split("\n");
    let start = 0;
    for (let i = 0; i < lineIndex && i < lines.length; i++) {
      start += lines[i].length + 1; // +1 = "\n"
    }
    const end = start + (lines[lineIndex]?.length ?? 0);
    el.focus();
    el.setSelectionRange(start, end);
    setCaretLine(lineIndex);
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
    if (pendingSelectionRef.current) {
      const { start, end } = pendingSelectionRef.current;
      el.setSelectionRange(start, end);
      pendingSelectionRef.current = null;
      // caret line 도 새 위치로
      setCaretLine(el.value.slice(0, start).split("\n").length - 1);
    }
  }, [draft]);

  // macOS 의 "스마트 인용 부호와 줄표" 가 -- → — 자동 치환을 emit 할 때,
  // beforeinput inputType "insertReplacementText" 로 들어옴 — preventDefault.
  // textarea props (autoCorrect/spellCheck/autoCapitalize="off") 로 대부분 막히지만
  // 시스템 설정에 따라 안 막히는 케이스 fallback.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    function onBeforeInput(e: Event) {
      const ev = e as InputEvent;
      if (ev.inputType === "insertReplacementText") {
        const d = ev.data ?? "";
        if (d.includes("—") || d.includes("–") || d.includes("“") || d.includes("”") || d.includes("‘") || d.includes("’") || d.includes("…")) {
          e.preventDefault();
        }
      }
    }
    el.addEventListener("beforeinput", onBeforeInput);
    return () => el.removeEventListener("beforeinput", onBeforeInput);
  }, []);

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

    // Post-pass 3: continuation 마지막 표시 — 다음 줄이 같은 marker 종류 continuation/항목이
    // 아니면 lastContinuation = true. gutter dotted vertical (중간) vs dotted corner (마지막).
    for (let i = 0; i < kinds.length; i++) {
      const k = kinds[i];
      const isContinuation = "continuation" in k && k.continuation === true;
      if (!isContinuation) continue;
      const next = kinds[i + 1];
      const sameTypeContinues = !!next && next.type === k.type;
      if (!sameTypeContinues) {
        kinds[i] = { ...k, lastContinuation: true } as LineKind;
      }
    }

    return kinds;
  }, [draft]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // IME composition (한글 등) 중에는 절대 가로채지 않음.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    const ta = e.currentTarget;
    // 슬래시 커맨드 popover 열려있을 때 — 위/아래/Enter/Tab/Esc 가로채기.
    if (slashState) {
      const opts = getSlashOptionsForFilter(slashState.filter);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (opts.length === 0) return;
        setSlashState({
          ...slashState,
          selectedIndex: (slashState.selectedIndex + 1) % opts.length,
        });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (opts.length === 0) return;
        setSlashState({
          ...slashState,
          selectedIndex:
            (slashState.selectedIndex - 1 + opts.length) % opts.length,
        });
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        if (opts.length === 0) {
          setSlashState(null);
          return; // native 동작 진행 (Enter list continue 등)
        }
        e.preventDefault();
        const chosen = opts[Math.min(slashState.selectedIndex, opts.length - 1)];
        commitSlashOption(chosen);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashState(null);
        return;
      }
      // 다른 키 (typing 등) 는 통과 — onChange 가 다시 trigger 평가.
    }
    if (e.key === "Tab") {
      // 항상 preventDefault — applyIndent 가 null 이어도 native Tab 이 prev focusable
      // (참석자 input 등) 로 빠져나가는 것 차단. textarea 안 머무름.
      e.preventDefault();
      const r = applyIndent(
        ta.value,
        ta.selectionStart,
        ta.selectionEnd,
        e.shiftKey,
      );
      if (r) commitEdit(r);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !(e.metaKey || e.ctrlKey || e.altKey)) {
      const r = applyEnterContinue(ta.value, ta.selectionStart, ta.selectionEnd);
      if (r) {
        e.preventDefault();
        commitEdit(r);
      }
      return;
    }
    const mod = e.metaKey || e.ctrlKey;
    // ⌘B / ⌘I bold-italic wrap toggle
    if (mod && !e.shiftKey && !e.altKey && (e.code === "KeyB" || e.code === "KeyI")) {
      const mark = e.code === "KeyB" ? "**" : "*";
      e.preventDefault();
      commitEdit(applyWrap(ta.value, ta.selectionStart, ta.selectionEnd, mark));
      return;
    }
    // ⌘Shift+D 줄 복제
    if (mod && e.shiftKey && !e.altKey && e.code === "KeyD") {
      e.preventDefault();
      commitEdit(applyLineDuplicate(ta.value, ta.selectionStart, ta.selectionEnd));
      return;
    }
    // Alt+↑/↓ 줄 이동
    if (e.altKey && !mod && !e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      const dir = e.key === "ArrowUp" ? "up" : "down";
      const r = applyLineMove(ta.value, ta.selectionStart, ta.selectionEnd, dir);
      if (r) {
        e.preventDefault();
        commitEdit(r);
      }
      return;
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    const ta = e.currentTarget;
    const r = applyUrlPaste(ta.value, ta.selectionStart, ta.selectionEnd, text);
    if (r) {
      e.preventDefault();
      commitEdit(r);
    }
  }

  // textarea 아래/우측 빈 영역 클릭 → textarea focus + caret 끝.
  function onContainerMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) {
      const el = textareaRef.current;
      if (!el) return;
      e.preventDefault();
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
      setCaretLine(el.value.slice(0, end).split("\n").length - 1);
    }
  }

  return (
    <div
      className="flex"
      onMouseDown={onContainerMouseDown}
      style={{ minHeight: "60vh", alignItems: "stretch", position: "relative" }}
    >
      <div
        className="select-none"
        style={{
          width: GUTTER_WIDTH,
          paddingRight: "4px", // active background 와 borderRight 사이 여백
          color: "var(--accent-blue-text)", // 편집 모드 signal — 보기 모드엔 gutter 자체 없음
          borderRight: "1px solid var(--border-subtle)",
          alignSelf: "flex-start", // outer flex stretch 무시 — 실제 줄 수까지만 border/marker 보임
        }}
      >
        {lineKinds.map((kind, i) => (
          <GutterMarker
            key={i}
            kind={kind}
            active={i === caretLine}
            onClick={() => focusLine(i)}
          />
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
          updateSlashTrigger(e.target.value, e.target.selectionStart ?? 0);
        }}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onSelect={updateCaretLine}
        onKeyUp={updateCaretLine}
        onClick={updateCaretLine}
        onFocus={updateCaretLine}
        onBlur={() => setCaretLine(null)}
        placeholder="메모 내용을 적어주세요..."
        className="flex-1 resize-none bg-transparent text-base outline-none"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        style={{
          color: "var(--text-primary)",
          lineHeight: LINE_HEIGHT,
          padding: 0,
          paddingLeft: "0.5rem",
          paddingBottom: "1rem", // 가로 scrollbar 가 마지막 줄 위에 겹치지 않게 여유
          overflowY: "hidden",
          overscrollBehaviorX: "none", // 좌우만 bounce 제거 — y 는 부모 scroll 로 propagate
        }}
        wrap="off"
      />
      {slashState ? (
        <SlashCommandPopover
          filter={slashState.filter}
          selectedIndex={slashState.selectedIndex}
          onSelect={commitSlashOption}
          onClose={() => setSlashState(null)}
          // gutter (1.75rem) + textarea paddingLeft (0.5rem) = 2.25rem 안쪽.
          anchorLeft="2.25rem"
          // slash 줄 바로 아래 — (slashLine + 1) * LINE_HEIGHT.
          anchorTop={`calc(${slashState.slashLine + 1} * ${LINE_HEIGHT})`}
        />
      ) : null}
    </div>
  );
}

function GutterMarker({
  kind,
  active,
  onClick,
}: {
  kind: LineKind;
  active: boolean;
  onClick: () => void;
}) {
  const label = labelForKind(kind);
  const depth =
    "depth" in kind && typeof kind.depth === "number" ? kind.depth : 0;

  return (
    <div
      title={label || "이 줄로 이동"}
      onClick={onClick}
      className="flex cursor-pointer items-center justify-center"
      style={{
        height: LINE_HEIGHT,
        lineHeight: LINE_HEIGHT,
        color: active ? "var(--accent-blue)" : undefined,
      }}
    >
      <span
        className="relative inline-flex items-center justify-center"
        style={{
          width: "1.5rem",
          height: "1.5rem",
          backgroundColor: active ? "var(--accent-blue-bg)" : undefined,
          borderRadius: active ? "0.375rem" : undefined,
        }}
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

// 이어짐 줄 표시 — 위 항목과 시각적으로 묶이는 dotted line.
// variant "vertical" = 중간, "corner" = 마지막 (└ 모양).
function ContinuationGlyph({ variant }: { variant: "vertical" | "corner" }) {
  return (
    <svg
      width={20}
      height={26}
      viewBox="0 0 20 26"
      fill="none"
      aria-hidden
      style={{ display: "block" }}
    >
      <line
        x1="10"
        y1="0"
        x2="10"
        y2={variant === "corner" ? 14 : 26}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="1.5 3"
      />
      {variant === "corner" ? (
        <path
          d="M 10 14 Q 10 18 14 18"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="1.5 3"
        />
      ) : null}
    </svg>
  );
}

function KindGlyph({ kind }: { kind: LineKind }) {
  const isContinuation =
    "continuation" in kind && kind.continuation === true;
  if (isContinuation) {
    const isLast =
      "lastContinuation" in kind && kind.lastContinuation === true;
    return <ContinuationGlyph variant={isLast ? "corner" : "vertical"} />;
  }
  switch (kind.type) {
    case "paragraph":
    case "empty":
      return null;
    case "heading":
      return (
        <span className="font-mono text-[10px] font-semibold">
          H{kind.level}
        </span>
      );
    case "bullet":
      return <List className="h-3.5 w-3.5" />;
    case "ordered":
      if (typeof kind.renderedNumber === "number") {
        return (
          <span className="font-mono text-[10px] font-semibold tabular-nums">
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
