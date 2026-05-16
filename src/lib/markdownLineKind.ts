// textarea의 현재 cursor 줄에 어떤 마크다운 문법이 적용될지 추론.
// 정밀 parse가 아니라 줄 시작 패턴 기반 (사용자가 입력 중 즉시 피드백용).

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

// 빈 줄 만나기 전까지 위로 거슬러 가장 가까운 명시적 패턴을 찾아 "이어짐" 라벨 반환.
// 일반 단락의 soft break는 "단락" (= 빈 라벨로 표시됨).
function findContinuationKind(full: string, lineStart: number): string {
  let scanEnd = lineStart - 1;
  while (scanEnd > 0) {
    const scanStart = full.lastIndexOf("\n", scanEnd - 1) + 1;
    const ln = full.slice(scanStart, scanEnd);
    if (ln.trim() === "") return "단락";

    const indent = ln.match(/^( *)/)?.[1].length ?? 0;
    const trimmed = ln.slice(indent);
    const d = Math.floor(indent / 2);

    if (/^>\s?/.test(ln)) return "인용 이어짐";
    if (/^[-*+] \[[ xX]\] /.test(trimmed)) {
      return d > 0 ? `체크박스 ${d}단계 이어짐` : "체크박스 이어짐";
    }
    if (/^[-*+]\s/.test(trimmed)) {
      return d > 0 ? `점 목록 ${d}단계 이어짐` : "점 목록 이어짐";
    }
    if (/^\d+\.\s/.test(trimmed)) {
      return d > 0 ? `번호 목록 ${d}단계 이어짐` : "번호 목록 이어짐";
    }
    // heading/펜스/구분선 등은 multi-line 아님 → 그 다음 줄은 새 단락
    if (/^#{1,6} /.test(ln)) return "단락";
    if (/^(```|~~~)/.test(ln)) return "단락";
    if (/^---+$|^\*\*\*+$|^___+$/.test(ln)) return "단락";

    // 일반 텍스트 줄: 더 위로 거슬러 올라감 (paragraph multi-line)
    if (scanStart === 0) return "단락";
    scanEnd = scanStart - 1;
  }
  return "단락";
}

export function inferLineKind(full: string, pos: number): string {
  const lineStart = full.lastIndexOf("\n", pos - 1) + 1;
  const nextNewline = full.indexOf("\n", pos);
  const line = full.slice(
    lineStart,
    nextNewline === -1 ? undefined : nextNewline,
  );

  // 코드 펜스 안
  if (isInsideFencedCode(full, pos)) return "코드 블록";

  // 코드 펜스 시작/끝
  if (/^(```|~~~)/.test(line)) return "코드 펜스";

  // Setext heading — `===` 또는 `---`만 있는 줄 + 이전 줄이 텍스트
  if (/^=+\s*$/.test(line) && line.trim().length >= 1) {
    const prev = getPrevLine(full, lineStart);
    if (prev && prev.trim()) return "제목 1 (밑줄)";
  }
  if (/^-+\s*$/.test(line) && line.trim().length >= 2) {
    const prev = getPrevLine(full, lineStart);
    if (prev && prev.trim()) return "제목 2 (밑줄)";
  }

  // ATX heading
  if (/^#{6} /.test(line)) return "제목 6";
  if (/^#{5} /.test(line)) return "제목 5";
  if (/^#{4} /.test(line)) return "제목 4";
  if (/^### /.test(line)) return "제목 3";
  if (/^## /.test(line)) return "제목 2";
  if (/^# /.test(line)) return "제목 1";

  // 들여쓰기 분석
  const indentMatch = line.match(/^( +)/);
  const indent = indentMatch ? indentMatch[1].length : 0;
  const trimmed = line.slice(indent);
  const depth = Math.floor(indent / 2); // 2칸 = 1단계

  // 4+ spaces + list marker 아님 → indented code block
  if (
    indent >= 4 &&
    !/^[-*+]\s/.test(trimmed) &&
    !/^\d+\.\s/.test(trimmed) &&
    trimmed.length > 0
  ) {
    return "코드 (들여쓰기)";
  }

  // 체크박스 (들여쓰기 인식)
  if (/^[-*+] \[[ xX]\] /.test(trimmed)) {
    return depth > 0 ? `체크박스 ${depth}단계` : "체크박스";
  }

  // 점 목록 (들여쓰기 인식)
  if (/^[-*+]\s/.test(trimmed)) {
    return depth > 0 ? `점 목록 ${depth}단계` : "점 목록";
  }

  // 번호 목록 (들여쓰기 인식)
  if (/^\d+\.\s/.test(trimmed)) {
    return depth > 0 ? `번호 목록 ${depth}단계` : "번호 목록";
  }

  // 인용
  if (/^>\s?/.test(line)) return "인용";

  // 구분선 (setext 매칭 안 됐을 때만 도달)
  if (/^---+$|^\*\*\*+$|^___+$/.test(line)) return "구분선";

  // 표
  if (/^\|/.test(line)) return "표";

  // 링크 정의: [label]: url
  if (/^\[[^\]]+\]:\s/.test(line)) return "링크 정의";

  if (line.trim() === "") return "빈 줄";
  // 명시적 패턴 매칭 안 됨 → 위 컨텍스트 보고 "이어짐" 또는 "단락"
  return findContinuationKind(full, lineStart);
}
