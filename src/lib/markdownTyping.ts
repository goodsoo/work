// Markdown typing helpers — Tab indent / Enter list continuation / URL paste.
// 옵시디안 본문 typing 동작과 일치. 모든 helper 는 pure — value + selection 만 받고
// 새 value + selection 반환. helper 가 null 반환하면 native 동작 유지.

const INDENT = "  "; // 2-space indent unit (default, bullet/checkbox/일반 텍스트)

// ordered list 는 marker 폭만큼 indent 해야 CommonMark 가 nest 로 인식 (1. → 3, 10. → 4).
// 현재 줄 source 기준. ordered 가 아니면 default INDENT 반환.
export function indentUnitForLine(line: string): string {
  const ordered = line.match(/^\s*(\d+)\.\s/);
  if (ordered) {
    // "{digits}. " 폭 = digits 길이 + 2 (마침표 + space).
    return " ".repeat(ordered[1].length + 2);
  }
  return INDENT;
}

// ordered list 줄의 leading 숫자를 "1" 로 재설정. ordered 가 아니면 unchanged.
// 사용처: Tab 으로 nest 진입할 때 — CommonMark 가 "1 이외" ordered list 의
// paragraph interrupt 를 금지하므로 nest 첫 줄은 무조건 1 이어야 함.
export function renumberOrderedToOne(line: string): string {
  return line.replace(/^(\s*)\d+(\.\s)/, "$11$2");
}

type LineMarker = {
  indent: string; // leading whitespace (spaces only; tabs normalize to 2-space)
  marker: string; // "- ", "* ", "+ ", "1. ", "- [ ] ", "> "
  rest: string; // content after marker (may be empty)
  kind: "bullet" | "ordered" | "checkbox" | "quote";
  num?: number; // for ordered list
};

// 한 줄에서 list/quote marker 추출. marker 없으면 null.
export function parseLineMarker(line: string): LineMarker | null {
  // checkbox 먼저 (bullet 보다 specific)
  const cb = line.match(/^([ \t]*)([-*+])\s\[([ xX])\]\s(.*)$/);
  if (cb) {
    return {
      indent: cb[1].replace(/\t/g, INDENT),
      marker: `${cb[2]} [ ] `, // 새 marker 는 항상 빈 체크박스
      rest: cb[4],
      kind: "checkbox",
    };
  }
  const bullet = line.match(/^([ \t]*)([-*+])\s(.*)$/);
  if (bullet) {
    return {
      indent: bullet[1].replace(/\t/g, INDENT),
      marker: `${bullet[2]} `,
      rest: bullet[3],
      kind: "bullet",
    };
  }
  const ordered = line.match(/^([ \t]*)(\d+)\.\s(.*)$/);
  if (ordered) {
    return {
      indent: ordered[1].replace(/\t/g, INDENT),
      marker: `${ordered[2]}. `,
      rest: ordered[3],
      kind: "ordered",
      num: parseInt(ordered[2], 10),
    };
  }
  const quote = line.match(/^([ \t]*)(>+)\s?(.*)$/);
  if (quote) {
    return {
      indent: quote[1].replace(/\t/g, INDENT),
      marker: `${quote[2]} `,
      rest: quote[3],
      kind: "quote",
    };
  }
  return null;
}

// "marker 만 있고 내용 비어있음" 판정. empty marker 줄에서 Enter = marker 삭제.
function isMarkerOnly(m: LineMarker): boolean {
  return m.rest.trim() === "";
}

// value 안에서 offset 이 속한 줄의 시작/끝 offset 반환.
function lineRange(value: string, offset: number): { start: number; end: number } {
  const start = value.lastIndexOf("\n", offset - 1) + 1;
  const nl = value.indexOf("\n", offset);
  const end = nl === -1 ? value.length : nl;
  return { start, end };
}

export type EditResult = {
  value: string;
  start: number;
  end: number;
};

// Tab / Shift+Tab indent.
// - 단일 줄 (selection 안에 newline 없음):
//   - shift: 줄 시작의 indent 1단계 (2-space 또는 \t) 제거. 없으면 null.
//   - 일반: 줄 시작에 2-space prepend.
// - 다중 줄: 선택된 모든 줄에 적용.
export function applyIndent(
  value: string,
  start: number,
  end: number,
  shift: boolean,
): EditResult | null {
  const first = lineRange(value, start);
  const last = lineRange(value, end);
  const isMultiLine = first.start !== last.start;
  // 선택 끝이 줄 시작에 정확히 걸쳐있으면 그 줄은 포함 안 함 (옵시디안/VSCode 동작).
  const lastEndAdj =
    isMultiLine && end === last.start && end > start ? end - 1 : end;
  const lastAdj = lineRange(value, lastEndAdj);

  const before = value.slice(0, first.start);
  const block = value.slice(first.start, lastAdj.end);
  const after = value.slice(lastAdj.end);
  const lines = block.split("\n");

  if (shift) {
    let removedFirst = 0;
    let removedTotal = 0;
    const out = lines.map((ln, i) => {
      // 줄별 indent unit 으로 untab — ordered list 면 marker 폭만큼 떼야 대칭.
      const unit = indentUnitForLine(ln);
      let removed = 0;
      if (ln.startsWith(unit)) {
        removed = unit.length;
      } else if (ln.startsWith(INDENT)) {
        removed = INDENT.length;
      } else if (ln.startsWith("\t")) {
        removed = 1;
      } else if (ln.startsWith(" ")) {
        removed = 1; // 1-space 도 떼어줌 (애매한 indent recovery)
      }
      if (i === 0) removedFirst = removed;
      removedTotal += removed;
      return removed > 0 ? ln.slice(removed) : ln;
    });
    if (removedTotal === 0) return null;
    const newBlock = out.join("\n");
    const newValue = before + newBlock + after;
    const newStart = Math.max(first.start, start - removedFirst);
    const newEnd = Math.max(newStart, end - removedTotal);
    return { value: newValue, start: newStart, end: newEnd };
  }

  if (!isMultiLine) {
    // 단일 줄: 줄 시작에 indent prepend — ordered line 이면 marker 폭, 아니면 2-space.
    // ordered 는 추가로 marker 번호를 "1" 로 재설정 — CommonMark 가 "1 이외 숫자로 시작하는
    // ordered list 는 paragraph 를 interrupt 못 함" 이라 새 nest level 첫 item 은 1 이어야
    // 실제로 sublist 로 인식됨 (이미 sublist 면 unchanged, 첫 nest 면 차이가 큼).
    const unit = indentUnitForLine(block);
    const renumbered = renumberOrderedToOne(block);
    const newBlock = unit + renumbered;
    const newValue = before + newBlock + after;
    const delta = unit.length + (renumbered.length - block.length);
    return {
      value: newValue,
      start: start + delta,
      end: end + delta,
    };
  }

  const units = lines.map((ln) => indentUnitForLine(ln));
  const renums = lines.map((ln) => renumberOrderedToOne(ln));
  const newBlock = renums.map((ln, i) => units[i] + ln).join("\n");
  const newValue = before + newBlock + after;
  const renumDelta0 = renums[0].length - lines[0].length;
  const addedFirst = units[0].length + renumDelta0;
  const addedTotal = units.reduce((a, u) => a + u.length, 0) +
    renums.reduce((a, r, i) => a + (r.length - lines[i].length), 0);
  return {
    value: newValue,
    start: start + addedFirst,
    end: end + addedTotal,
  };
}

// Enter 자동 list marker 연장.
// - caret 위치 라인이 list/quote marker:
//   - rest 비어있음 (marker only) → marker 삭제 + indent 도 비움 (한 줄 비우기 효과).
//     같은 turn 의 Enter 는 안 만듦 (사용자가 다시 Enter 누르면 새 줄).
//   - rest 있음 → `\n${indent}${nextMarker}` 삽입. ordered 면 num+1.
// - marker 없으면 null (native Enter).
export function applyEnterContinue(
  value: string,
  start: number,
  end: number,
): EditResult | null {
  // selection 이 있을 때는 native (선택 영역 삭제 후 Enter) — marker 연장 안 함.
  if (start !== end) return null;
  const lr = lineRange(value, start);
  const line = value.slice(lr.start, lr.end);
  const marker = parseLineMarker(line);
  if (!marker) return null;

  // caret 이 marker 영역 안 (indent + marker prefix 끝나기 전) 이면 native.
  const markerEnd = lr.start + marker.indent.length + marker.marker.length;
  if (start < markerEnd) return null;

  if (isMarkerOnly(marker)) {
    // 줄 전체를 빈 줄로 (indent + marker 삭제). caret 은 그 자리.
    const newValue = value.slice(0, lr.start) + value.slice(lr.end);
    // line 끝이 파일 끝이면 그대로, 아니면 다음 줄 시작에 caret.
    // 여기서는 줄 자체를 지웠으므로 caret = lr.start.
    return { value: newValue, start: lr.start, end: lr.start };
  }

  let nextMarker = marker.marker;
  if (marker.kind === "ordered" && typeof marker.num === "number") {
    nextMarker = `${marker.num + 1}. `;
  }
  const insert = `\n${marker.indent}${nextMarker}`;
  const newValue = value.slice(0, start) + insert + value.slice(end);
  const caret = start + insert.length;
  return { value: newValue, start: caret, end: caret };
}

// Bold(`**`) / Italic(`*`) / Inline-code(`) wrap toggle.
// - selection 있고 양옆이 이미 mark 면 unwrap.
// - selection 있고 unwrap 아니면 wrap.
// - selection 없으면 빈 wrap (`**|**`) + caret 가운데. 이미 caret 양옆이 mark 면 unwrap.
export function applyWrap(
  value: string,
  start: number,
  end: number,
  mark: "**" | "*" | "`",
): EditResult {
  const before = value.slice(0, start);
  const sel = value.slice(start, end);
  const after = value.slice(end);
  const m = mark.length;

  // unwrap: selection 자체가 양 끝에 mark
  if (sel.startsWith(mark) && sel.endsWith(mark) && sel.length >= m * 2) {
    const inner = sel.slice(m, sel.length - m);
    return { value: before + inner + after, start, end: start + inner.length };
  }
  // unwrap: selection 양옆 (밖) 이 mark
  if (before.endsWith(mark) && after.startsWith(mark)) {
    const newValue = before.slice(0, -m) + sel + after.slice(m);
    return { value: newValue, start: start - m, end: end - m };
  }
  // wrap
  const inserted = `${mark}${sel}${mark}`;
  const newValue = before + inserted + after;
  if (start === end) {
    return { value: newValue, start: start + m, end: start + m };
  }
  return { value: newValue, start: start + m, end: end + m };
}

// Alt+↑/↓ 라인 이동. 선택 안에 newline 있으면 블록 전체.
// - direction "up": 위 라인과 swap.
// - direction "down": 아래 라인과 swap.
// - 경계 (가장 위/아래) 면 null.
export function applyLineMove(
  value: string,
  start: number,
  end: number,
  direction: "up" | "down",
): EditResult | null {
  const first = lineRange(value, start);
  const last = lineRange(value, end);
  const lastEndAdj =
    first.start !== last.start && end === last.start && end > start ? end - 1 : end;
  const lastAdj = lineRange(value, lastEndAdj);

  const lines = value.split("\n");
  // first.start ~ lastAdj.end 의 line index 계산
  const firstLineIdx = value.slice(0, first.start).split("\n").length - 1;
  const lastLineIdx = value.slice(0, lastAdj.start).split("\n").length - 1;

  if (direction === "up") {
    if (firstLineIdx === 0) return null;
    const above = lines[firstLineIdx - 1];
    const block = lines.slice(firstLineIdx, lastLineIdx + 1);
    const newLines = [
      ...lines.slice(0, firstLineIdx - 1),
      ...block,
      above,
      ...lines.slice(lastLineIdx + 1),
    ];
    const newValue = newLines.join("\n");
    // caret/selection 도 한 줄 위로 (= 위 라인 길이 + 1 만큼 앞당김)
    const delta = above.length + 1;
    return { value: newValue, start: start - delta, end: end - delta };
  }
  // down
  if (lastLineIdx === lines.length - 1) return null;
  const below = lines[lastLineIdx + 1];
  const block = lines.slice(firstLineIdx, lastLineIdx + 1);
  const newLines = [
    ...lines.slice(0, firstLineIdx),
    below,
    ...block,
    ...lines.slice(lastLineIdx + 2),
  ];
  const newValue = newLines.join("\n");
  const delta = below.length + 1;
  return { value: newValue, start: start + delta, end: end + delta };
}

// ⌘Shift+D 줄 복제. selection 있으면 블록 복제, 없으면 caret 라인 복제. caret 은 새 (복제된) 라인.
export function applyLineDuplicate(
  value: string,
  start: number,
  end: number,
): EditResult {
  const first = lineRange(value, start);
  const last = lineRange(value, end);
  const lastEndAdj =
    first.start !== last.start && end === last.start && end > start ? end - 1 : end;
  const lastAdj = lineRange(value, lastEndAdj);

  const block = value.slice(first.start, lastAdj.end);
  const insert = block + "\n";
  const newValue =
    value.slice(0, first.start) + insert + value.slice(first.start);
  const delta = insert.length;
  return { value: newValue, start: start + delta, end: end + delta };
}

// Slash command 가 한 줄을 변환할 때의 target marker.
// SlashCommandPopover 의 선택지와 1:1.
export type SlashTargetKind =
  | { type: "paragraph" } // 기존 marker 제거 (plain text 로)
  | { type: "heading"; level: 1 | 2 | 3 }
  | { type: "bullet" }
  | { type: "ordered" }
  | { type: "checkbox" }
  | { type: "quote" }
  | { type: "code-fence" }
  | { type: "hr" }
  | { type: "table" };

// 줄에서 marker (bullet/ordered/checkbox/quote/heading) 제거 → { indent, content }.
// indent 는 공백/탭 normalize 후 leading whitespace, content 는 marker 뒤 본문.
function stripLineMarker(line: string): { indent: string; content: string } {
  const indentMatch = line.match(/^([ \t]*)/);
  const indent = (indentMatch?.[1] ?? "").replace(/\t/g, INDENT);
  const rest = line.slice(indentMatch?.[1].length ?? 0);

  // ATX heading
  const heading = rest.match(/^#{1,6}\s+(.*)$/);
  if (heading) return { indent, content: heading[1] };

  const marker = parseLineMarker(rest);
  if (marker) return { indent, content: marker.rest };

  return { indent, content: rest };
}

// 한 줄을 target kind 로 변환. 기존 marker 가 있으면 교체, paragraph 면 prepend.
// indent 보존. 줄 안의 caret 위치 (lineCaretOffset) 도 함께 받아, 변환 후 caret 을
// 원래 본문 위치 + 새 marker 길이 만큼 옮긴다 (대략 — code-fence/hr/table 같은
// multi-line 변환은 첫 줄 끝으로).
export function applyLineKindTransform(
  value: string,
  caret: number,
  target: SlashTargetKind,
): EditResult {
  const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
  const nl = value.indexOf("\n", caret);
  const lineEnd = nl === -1 ? value.length : nl;
  const line = value.slice(lineStart, lineEnd);
  const { indent, content } = stripLineMarker(line);

  let newLine = "";
  let caretInLine = 0;

  switch (target.type) {
    case "paragraph":
      newLine = indent + content;
      caretInLine = indent.length + content.length;
      break;
    case "heading": {
      const prefix = "#".repeat(target.level) + " ";
      newLine = indent + prefix + content;
      caretInLine = indent.length + prefix.length + content.length;
      break;
    }
    case "bullet":
      newLine = indent + "- " + content;
      caretInLine = indent.length + 2 + content.length;
      break;
    case "ordered":
      newLine = indent + "1. " + content;
      caretInLine = indent.length + 3 + content.length;
      break;
    case "checkbox":
      newLine = indent + "- [ ] " + content;
      caretInLine = indent.length + 6 + content.length;
      break;
    case "quote":
      newLine = indent + "> " + content;
      caretInLine = indent.length + 2 + content.length;
      break;
    case "code-fence": {
      // 빈 fence pair — content 가 있으면 fence 안에 둠.
      const inner = content;
      newLine = indent + "```\n" + indent + inner + "\n" + indent + "```";
      caretInLine = indent.length + 4 + indent.length + inner.length; // fence 안쪽 끝
      break;
    }
    case "hr":
      newLine = "---";
      caretInLine = 3;
      break;
    case "table": {
      const rows = [
        indent + "| 헤더1 | 헤더2 |",
        indent + "| --- | --- |",
        indent + "| 값1 | 값2 |",
      ];
      newLine = rows.join("\n");
      // caret 을 첫 번째 헤더 셀 안 ("헤더1" 첫 글자 자리) 으로 두는 게 자연스럽지만,
      // textarea selection API 단순화 위해 첫 줄 끝.
      caretInLine = rows[0].length;
      break;
    }
  }

  const newValue = value.slice(0, lineStart) + newLine + value.slice(lineEnd);
  const newCaret = lineStart + caretInLine;
  return { value: newValue, start: newCaret, end: newCaret };
}

// ─────────────────────────────────────────────────────────────────────────────
// 화살표 자동 치환 — `->` → `→`, `=>` → `⇒`. 입력으로 pair 완성 시 onChange 에서 호출.
// 코드(펜스/인라인) 안에서는 변환 안 함 (`=>` 화살표 함수, `->` 코드 보존). 되돌리기는
// 호출부가 "방금 변환 직후 Backspace" 로 original 복원 (macOS/Notion 스마트 치환 패턴).

const ARROW_MAP: Record<string, string> = { "->": "→", "=>": "⇒" };

export type ArrowSubResult = EditResult & { original: string };

// value 의 pos 가 fenced 코드블록(``` / ~~~) 또는 현재 줄 inline code(백틱 홀수) 안인지.
function isInsideCode(value: string, pos: number): boolean {
  const before = value.slice(0, pos);
  const lines = before.split("\n");
  let fence = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^(```|~~~)/.test(lines[i])) fence += 1;
  }
  if (fence % 2 === 1) return true; // 펜스 안
  const lineStart = before.lastIndexOf("\n") + 1;
  const backticks = (before.slice(lineStart).match(/`/g) ?? []).length;
  return backticks % 2 === 1; // 현재 줄 inline code 안
}

// caret 바로 앞 2글자가 `->`/`=>` 면 화살표로 치환한 EditResult. 코드 안이거나
// 매칭 안 되면 null. (arrow 는 1글자라 caret 은 -1.)
export function applyArrowSubstitution(
  value: string,
  caret: number,
): ArrowSubResult | null {
  if (caret < 2) return null;
  const pair = value.slice(caret - 2, caret);
  const arrow = ARROW_MAP[pair];
  if (!arrow) return null;
  if (isInsideCode(value, caret)) return null;
  const newValue = value.slice(0, caret - 2) + arrow + value.slice(caret);
  const newCaret = caret - 2 + arrow.length;
  return { value: newValue, start: newCaret, end: newCaret, original: pair };
}

// `/{filter}` 슬래시 커맨드 trigger 가 살아있는지 판정.
// 현재 줄에서 caret 위치까지의 text 가 `^{indent or marker}\/{filter}$` 패턴이면 true.
// filter 는 한 단어 (공백/줄바꿈 없음). marker 뒤에 친 `/` 도 허용 — 그 줄을 다른
// kind 로 바꾸는 시나리오 (bullet → checkbox 등).
const SLASH_TRIGGER_RE =
  /^[ \t]*(?:[-*+] \[[ xX]\] |[-*+] |\d+\. |> |#{1,6} )?\/([^\s/]*)$/;

export type SlashTriggerState = {
  slashStart: number; // value 안 `/` literal 의 시작 offset
  filter: string;
};

// caret 위치 기준으로 slash trigger 가 활성 상태인지 확인. 활성이면 slashStart + filter,
// 아니면 null. value 변경 / 키 입력마다 호출해서 popover 상태 갱신.
export function detectSlashTrigger(
  value: string,
  caret: number,
): SlashTriggerState | null {
  const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
  const beforeCaret = value.slice(lineStart, caret);
  const m = beforeCaret.match(SLASH_TRIGGER_RE);
  if (!m) return null;
  const filter = m[1];
  const slashStart = caret - filter.length - 1; // -1 = `/` 자체
  return { slashStart, filter };
}

// URL paste over selection → `[selected](URL)` 자동 변환.
// - selection 비어있으면 null (native paste).
// - pasted text 가 단일 URL (http/https, 공백 없음) 아니면 null.
const URL_PASTE_RE = /^https?:\/\/\S+$/;
export function applyUrlPaste(
  value: string,
  start: number,
  end: number,
  pasted: string,
): EditResult | null {
  if (start === end) return null;
  const trimmed = pasted.trim();
  if (!URL_PASTE_RE.test(trimmed)) return null;
  const selected = value.slice(start, end);
  // 선택 자체가 URL 이면 변환 X (URL 위에 URL paste 는 그냥 교체).
  if (URL_PASTE_RE.test(selected.trim())) return null;
  const insert = `[${selected}](${trimmed})`;
  const newValue = value.slice(0, start) + insert + value.slice(end);
  const caret = start + insert.length;
  return { value: newValue, start: caret, end: caret };
}
