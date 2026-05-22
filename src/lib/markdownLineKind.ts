// textarea의 현재 줄에 어떤 마크다운 문법이 적용될지 추론.
// 정밀 parse가 아니라 줄 시작 패턴 기반 (입력 중 즉시 피드백용 gutter 표시).

export type LineKind =
  | { type: "paragraph" }
  | { type: "empty" }
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; setext?: boolean }
  | { type: "bullet"; depth: number; continuation?: boolean; lastContinuation?: boolean }
  | {
      type: "ordered";
      depth: number;
      continuation?: boolean;
      renderedNumber?: number;
      lastContinuation?: boolean;
    }
  | { type: "checkbox"; depth: number; continuation?: boolean; lastContinuation?: boolean }
  | { type: "quote"; continuation?: boolean; lastContinuation?: boolean }
  | { type: "code-fence" }
  | { type: "code-block" }
  | { type: "code-indent" }
  | { type: "hr" }
  | { type: "table" }
  | { type: "link-def" };

function isInsideFencedCode(full: string, pos: number): boolean {
  const before = full.slice(0, pos);
  const lines = before.split("\n");
  let fenceCount = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^(```|~~~)/.test(lines[i])) fenceCount += 1;
  }
  return fenceCount % 2 === 1;
}

function getPrevLine(full: string, lineStart: number): string | null {
  if (lineStart === 0) return null;
  const prevEnd = lineStart - 1;
  const prevStart = full.lastIndexOf("\n", prevEnd - 1) + 1;
  return full.slice(prevStart, prevEnd);
}

// 현재 줄 (indent=N, 비-1 ordered marker) 의 직전 위로 거슬러 같은 indent 의
// ordered list sibling 이 존재하는지 검사. 존재하면 paragraph interrupt 가 아니라
// 기존 sublist 의 sibling 이므로 ordered 로 인식해도 됨.
// - 같은 indent 의 다른 marker (bullet/checkbox) → 다른 list type, 없음.
// - 더 낮은 indent 의 list marker → 우리 level 의 sublist 시작점 못 찾았으니 없음.
// - 더 높은 indent → 계속 위로.
// - blank line → 계속 위로 (loose list 허용).
function hasOrderedSiblingAt(full: string, lineStart: number, indent: number): boolean {
  let scanEnd = lineStart - 1;
  while (scanEnd > 0) {
    const scanStart = full.lastIndexOf("\n", scanEnd - 1) + 1;
    const ln = full.slice(scanStart, scanEnd);
    if (ln.trim() === "") {
      scanEnd = scanStart - 1;
      continue;
    }
    const lnIndent = ln.match(/^( *)/)?.[1].length ?? 0;
    const lnTrimmed = ln.slice(lnIndent);
    if (lnIndent === indent) {
      if (/^\d+\.\s/.test(lnTrimmed)) return true;
      if (/^[-*+]\s/.test(lnTrimmed)) return false;
      // 같은 indent 인데 list marker 아님 → 우리 level 의 list block 아님.
      return false;
    }
    if (lnIndent < indent) {
      // 더 낮은 indent — 부모 list 영역 진입. 우리 level 의 sibling 없음.
      return false;
    }
    // 더 높은 indent — 우리 sublist 의 깊은 줄. 계속 위로.
    if (scanStart === 0) return false;
    scanEnd = scanStart - 1;
  }
  return false;
}

// 빈 줄 만나기 전까지 위로 거슬러 가장 가까운 명시적 패턴을 찾아 continuation 반환.
// 일반 단락의 soft break는 paragraph (gutter 비움).
function findContinuationKind(full: string, lineStart: number): LineKind {
  let scanEnd = lineStart - 1;
  while (scanEnd > 0) {
    const scanStart = full.lastIndexOf("\n", scanEnd - 1) + 1;
    const ln = full.slice(scanStart, scanEnd);
    if (ln.trim() === "") return { type: "paragraph" };

    const indent = ln.match(/^( *)/)?.[1].length ?? 0;
    const trimmed = ln.slice(indent);
    const depth = Math.floor(indent / 2);

    if (/^>\s?/.test(ln)) return { type: "quote", continuation: true };
    if (/^[-*+] \[[ xX]\] /.test(trimmed)) {
      return { type: "checkbox", depth, continuation: true };
    }
    if (/^[-*+]\s/.test(trimmed)) {
      return { type: "bullet", depth, continuation: true };
    }
    if (/^\d+\.\s/.test(trimmed)) {
      return { type: "ordered", depth, continuation: true };
    }
    // heading/펜스/구분선은 multi-line 아님 → 그 다음 줄은 단락
    if (/^#{1,6} /.test(ln)) return { type: "paragraph" };
    if (/^(```|~~~)/.test(ln)) return { type: "paragraph" };
    if (/^---+$|^\*\*\*+$|^___+$/.test(ln)) return { type: "paragraph" };

    if (scanStart === 0) return { type: "paragraph" };
    scanEnd = scanStart - 1;
  }
  return { type: "paragraph" };
}

export function inferLineKind(full: string, pos: number): LineKind {
  const lineStart = full.lastIndexOf("\n", pos - 1) + 1;
  const nextNewline = full.indexOf("\n", pos);
  const line = full.slice(
    lineStart,
    nextNewline === -1 ? undefined : nextNewline,
  );

  if (isInsideFencedCode(full, pos)) return { type: "code-block" };
  if (/^(```|~~~)/.test(line)) return { type: "code-fence" };

  // Setext heading
  if (/^=+\s*$/.test(line) && line.trim().length >= 1) {
    const prev = getPrevLine(full, lineStart);
    if (prev && prev.trim()) return { type: "heading", level: 1, setext: true };
  }
  if (/^-+\s*$/.test(line) && line.trim().length >= 2) {
    const prev = getPrevLine(full, lineStart);
    if (prev && prev.trim()) return { type: "heading", level: 2, setext: true };
  }

  // ATX heading
  if (/^#{6} /.test(line)) return { type: "heading", level: 6 };
  if (/^#{5} /.test(line)) return { type: "heading", level: 5 };
  if (/^#{4} /.test(line)) return { type: "heading", level: 4 };
  if (/^### /.test(line)) return { type: "heading", level: 3 };
  if (/^## /.test(line)) return { type: "heading", level: 2 };
  if (/^# /.test(line)) return { type: "heading", level: 1 };

  const indentMatch = line.match(/^( +)/);
  const indent = indentMatch ? indentMatch[1].length : 0;
  const trimmed = line.slice(indent);
  // bullet/checkbox 는 2-space nest, ordered 는 marker 폭 (1. = 3, 10. = 4) nest.
  // depth 계산도 그에 맞춰 — 안 그러면 gutter 가 실제 parse 와 어긋남.
  const depth = Math.floor(indent / 2);
  const orderedMarker = trimmed.match(/^(\d+)\.\s/);
  const orderedUnit = orderedMarker ? orderedMarker[1].length + 2 : 3;
  const orderedDepth = Math.floor(indent / orderedUnit);

  if (
    indent >= 4 &&
    !/^[-*+]\s/.test(trimmed) &&
    !/^\d+\.\s/.test(trimmed) &&
    trimmed.length > 0
  ) {
    return { type: "code-indent" };
  }

  if (/^[-*+] \[[ xX]\] /.test(trimmed)) return { type: "checkbox", depth };
  if (/^[-*+]\s/.test(trimmed)) return { type: "bullet", depth };
  if (orderedMarker) {
    const num = parseInt(orderedMarker[1], 10);
    // 비-1 marker 는 paragraph 를 interrupt 못 함. top-level (indent=0) 이거나
    // 같은 indent 의 직전 ordered sibling 이 있을 때만 ordered 로 인식. 그 외엔
    // CommonMark 가 continuation 텍스트로 처리.
    if (num === 1 || indent === 0 || hasOrderedSiblingAt(full, lineStart, indent)) {
      return { type: "ordered", depth: orderedDepth };
    }
    return findContinuationKind(full, lineStart);
  }

  if (/^>\s?/.test(line)) return { type: "quote" };
  if (/^---+$|^\*\*\*+$|^___+$/.test(line)) return { type: "hr" };
  if (/^\|/.test(line)) return { type: "table" };
  if (/^\[[^\]]+\]:\s/.test(line)) return { type: "link-def" };
  if (line.trim() === "") return { type: "empty" };

  return findContinuationKind(full, lineStart);
}

// gutter title (hover 툴팁) 용 한글 라벨.
export function labelForKind(k: LineKind): string {
  switch (k.type) {
    case "paragraph":
    case "empty":
      return "";
    case "heading":
      return k.setext ? `제목 ${k.level} (밑줄식)` : `제목 ${k.level}`;
    case "bullet":
      return k.continuation
        ? k.depth > 0
          ? `점 목록 ${k.depth}단계 이어짐`
          : "점 목록 이어짐"
        : k.depth > 0
          ? `점 목록 ${k.depth}단계`
          : "점 목록";
    case "ordered":
      return k.continuation
        ? k.depth > 0
          ? `번호 목록 ${k.depth}단계 이어짐`
          : "번호 목록 이어짐"
        : k.depth > 0
          ? `번호 목록 ${k.depth}단계`
          : "번호 목록";
    case "checkbox":
      return k.continuation
        ? k.depth > 0
          ? `체크박스 ${k.depth}단계 이어짐`
          : "체크박스 이어짐"
        : k.depth > 0
          ? `체크박스 ${k.depth}단계`
          : "체크박스";
    case "quote":
      return k.continuation ? "인용 이어짐" : "인용";
    case "code-fence":
      return "코드 펜스";
    case "code-block":
      return "코드 블록";
    case "code-indent":
      return "코드 (들여쓰기)";
    case "hr":
      return "구분선";
    case "table":
      return "표";
    case "link-def":
      return "링크 정의";
  }
}
