// textarea의 현재 줄에 어떤 마크다운 문법이 적용될지 추론.
// 정밀 parse가 아니라 줄 시작 패턴 기반 (입력 중 즉시 피드백용 gutter 표시).

export type LineKind =
  | { type: "paragraph" }
  | { type: "empty" }
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; setext?: boolean }
  | { type: "bullet"; depth: number; continuation?: boolean }
  | {
      type: "ordered";
      depth: number;
      continuation?: boolean;
      renderedNumber?: number;
    }
  | { type: "checkbox"; depth: number; continuation?: boolean }
  | { type: "quote"; continuation?: boolean }
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
  const depth = Math.floor(indent / 2);

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
  if (/^\d+\.\s/.test(trimmed)) return { type: "ordered", depth };

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
