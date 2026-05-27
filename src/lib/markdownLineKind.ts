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

// `|` 로 시작하는 줄이 직전 list item 의 lazy continuation 으로 흡수되는지.
// GFM (실측: remark-gfm 4.0.1 / react-markdown 10): 목록(번호/점/체크박스) 바로
// 다음에 빈 줄 없이 쓴 표는 표로 렌더 안 되고 목록 항목 텍스트로 흡수된다 — 빈 줄을
// 끼워야 표가 됨. 단락 다음 표는 단락을 interrupt 해서 정상 렌더되므로 false.
function tableLineAbsorbedByList(full: string, lineStart: number): boolean {
  let scanEnd = lineStart - 1;
  while (scanEnd > 0) {
    const scanStart = full.lastIndexOf("\n", scanEnd - 1) + 1;
    const ln = full.slice(scanStart, scanEnd);
    if (ln.trim() === "") return false; // 빈 줄 다음 → 진짜 표
    if (/^\|/.test(ln)) {
      // 같은 표 후보의 윗 줄 — anchor 찾아 계속 위로
      if (scanStart === 0) return false;
      scanEnd = scanStart - 1;
      continue;
    }
    // 첫 비-`|`·비-blank anchor 줄
    const trimmed = ln.replace(/^ +/, "");
    if (/^[-*+] \[[ xX]\] /.test(trimmed)) return true; // 체크박스
    if (/^[-*+]\s/.test(trimmed)) return true; // 점 목록
    if (/^\d+\.\s/.test(trimmed)) return true; // 번호 목록
    return false; // 단락/제목/인용 등 → 표가 interrupt → 진짜 표
  }
  return false; // 문서 시작 → 진짜 표
}

// pipe row(`|` 포함 줄)의 컬럼 수. 양 끝 파이프 1개씩 제거 후 `|` 로 split.
// (이스케이프 `\|`·코드스팬 내 파이프는 gutter 휴리스틱상 무시.)
function pipeRowCols(line: string): number {
  let t = line.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|")) t = t.slice(0, -1);
  return t.split("|").length;
}

// 구분행이면 컬럼 수, 아니면 null. 셀이 모두 `:?-+:?` (하이픈 1+ 에 옵션 정렬콜론).
function delimiterRowCols(line: string): number | null {
  let t = line.trim();
  if (t === "") return null;
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|")) t = t.slice(0, -1);
  const cells = t.split("|");
  for (const c of cells) {
    if (!/^\s*:?-+:?\s*$/.test(c)) return null;
  }
  return cells.length;
}

function getNextLine(full: string, lineStart: number, line: string): string | null {
  const afterLine = lineStart + line.length; // `\n` 위치 또는 full.length
  if (afterLine >= full.length) return null;
  const ns = afterLine + 1;
  const ne = full.indexOf("\n", ns);
  return full.slice(ns, ne === -1 ? undefined : ne);
}

// `|` 로 시작하는 줄이 "유효한 GFM 표"의 일부인지 (헤더 / 구분행 / 데이터행).
// 핵심은 구분행 — `|` 만으로는 표가 아니고, 헤더행 바로 밑 구분행(+컬럼 수 일치)이
// 있어야 표가 된다. 실측(remark-gfm 4.0.1): 구분행 없는 `| a | b |` 한 줄은 단락,
// 헤더2칸 + 구분행1칸 처럼 컬럼 수가 어긋나도 표 아님, 헤더 없는 구분행도 표 아님.
function isTablePipeRow(full: string, lineStart: number, line: string): boolean {
  const dc = delimiterRowCols(line);
  if (dc !== null) {
    // 현재 줄 = 구분행 → 바로 위가 컬럼 수 맞는 헤더여야 표.
    const prev = getPrevLine(full, lineStart);
    return !!(
      prev &&
      prev.trim() !== "" &&
      delimiterRowCols(prev) === null &&
      pipeRowCols(prev) === dc
    );
  }
  const cols = pipeRowCols(line);
  // 현재 줄 = 헤더? 바로 아래가 컬럼 수 맞는 구분행.
  const next = getNextLine(full, lineStart, line);
  if (next !== null && delimiterRowCols(next) === cols) return true;
  // 현재 줄 = 데이터행? 위로 contiguous pipe row 거슬러 구분행(+유효 헤더) 발견.
  let scanEnd = lineStart - 1;
  while (scanEnd > 0) {
    const scanStart = full.lastIndexOf("\n", scanEnd - 1) + 1;
    const ln = full.slice(scanStart, scanEnd);
    if (ln.trim() === "") return false; // 빈 줄 → 표 블록 끝
    const ldc = delimiterRowCols(ln);
    if (ldc !== null) {
      const h = getPrevLine(full, scanStart);
      return !!(
        h &&
        h.trim() !== "" &&
        delimiterRowCols(h) === null &&
        pipeRowCols(h) === ldc
      );
    }
    if (!/^\|/.test(ln)) return false; // pipe row 도 구분행도 아님 → 표 아님
    if (scanStart === 0) return false;
    scanEnd = scanStart - 1;
  }
  return false;
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
  if (/^\|/.test(line)) {
    // 구분행 없는 `|` 줄은 표가 아니라 단락/목록 텍스트. 유효한 표라도 목록 직후
    // (빈 줄 없이)면 흡수돼 렌더 안 됨 → 둘 다 단락/목록 이어짐으로 표시.
    if (
      !isTablePipeRow(full, lineStart, line) ||
      tableLineAbsorbedByList(full, lineStart)
    ) {
      return findContinuationKind(full, lineStart);
    }
    return { type: "table" };
  }
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
