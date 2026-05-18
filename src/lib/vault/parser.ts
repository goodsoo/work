import yaml from "js-yaml";

export interface VaultFile {
  raw: string;
  frontmatter: Record<string, unknown>;
  // 알려진 H1 sections: '본문', '회의 내용', '요약' → body (heading line 제외)
  sections: Map<string, string>;
  // 매핑 안 된 H1 섹션 raw (heading 포함). 데이터 손실 방지.
  unmapped: string;
}

// 회의록에서 사용하는 알려진 H1 라벨
export const KNOWN_H1_SECTIONS = ["본문", "회의 내용", "요약"] as const;
export type KnownSection = (typeof KNOWN_H1_SECTIONS)[number];

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*(\n|$)/;

export function parseVaultFile(raw: string): VaultFile {
  const fmMatch = raw.match(FRONTMATTER_RE);
  let frontmatter: Record<string, unknown> = {};
  let body = raw;

  if (fmMatch) {
    try {
      const parsed = yaml.load(fmMatch[1], { schema: yaml.JSON_SCHEMA });
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        frontmatter = parsed as Record<string, unknown>;
      }
    } catch {
      // 손상된 frontmatter — empty object 로 fallback. raw 는 그대로 보존.
      frontmatter = {};
    }
    body = raw.slice(fmMatch[0].length);
  }

  const { sections, unmapped } = splitH1Sections(body);
  return { raw, frontmatter, sections, unmapped };
}

interface SplitResult {
  sections: Map<string, string>;
  unmapped: string;
}

// KNOWN H1 (`# 본문` / `# 회의 내용` / `# 요약`) 만 섹션 경계로 인식.
// 본문 안에 사용자가 적은 임의 H1 (예: `# 회의 제목`) 은 그냥 텍스트로 유지.
// 코드블록 (``` 또는 ~~~) 안의 H1 은 무시.
function splitH1Sections(body: string): SplitResult {
  const lines = body.split("\n");
  const sections = new Map<string, string>();
  const unmappedChunks: string[] = [];

  let currentH1: string | null = null;
  let currentBuf: string[] = [];
  let inCodeFence = false;
  let codeFenceMarker = "";

  const flush = () => {
    if (currentH1 === null) {
      // 첫 KNOWN H1 이전 텍스트. frontmatter 다음 텍스트. 비어있지 않으면 unmapped 로.
      const pre = currentBuf.join("\n").trim();
      if (pre.length > 0) unmappedChunks.push(pre);
    } else {
      const content = currentBuf
        .join("\n")
        .replace(/^\n+/, "")
        .replace(/\n+$/, "");
      sections.set(currentH1, content);
    }
  };

  for (const line of lines) {
    // 코드블록 토글
    const fenceMatch = line.match(/^(```|~~~)/);
    if (fenceMatch) {
      if (!inCodeFence) {
        inCodeFence = true;
        codeFenceMarker = fenceMatch[1];
      } else if (line.startsWith(codeFenceMarker)) {
        inCodeFence = false;
        codeFenceMarker = "";
      }
      currentBuf.push(line);
      continue;
    }

    if (!inCodeFence) {
      const h1 = line.match(/^# (.+?)\s*$/);
      // KNOWN H1 만 섹션 경계. 다른 H1 은 본문 텍스트로 취급.
      if (h1 && KNOWN_H1_SECTIONS.includes(h1[1] as KnownSection)) {
        flush();
        currentH1 = h1[1];
        currentBuf = [];
        continue;
      }
    }

    currentBuf.push(line);
  }
  flush();

  // 알려진 섹션이 빠져 있으면 빈 문자열로 채움
  for (const known of KNOWN_H1_SECTIONS) {
    if (!sections.has(known)) sections.set(known, "");
  }

  return { sections, unmapped: unmappedChunks.join("\n\n") };
}

// 직렬화: frontmatter + sections + unmapped 를 다시 raw 문자열로.
// 출력 형식은 mock-vault 의 표준 형식.
export function serializeVaultFile(file: VaultFile): string {
  const parts: string[] = [];

  if (Object.keys(file.frontmatter).length > 0) {
    const fm = yaml.dump(file.frontmatter, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
      schema: yaml.JSON_SCHEMA,
    });
    parts.push(`---\n${fm.trimEnd()}\n---\n`);
  }

  for (const known of KNOWN_H1_SECTIONS) {
    const body = file.sections.get(known) ?? "";
    parts.push(`\n# ${known}\n${body}\n`);
  }

  if (file.unmapped.trim()) {
    parts.push(`\n${file.unmapped.trim()}\n`);
  }

  return parts.join("").replace(/\n{3,}/g, "\n\n");
}

// 부분 patch: frontmatter 만 교체. 본문 영역은 raw 그대로 유지.
export function patchFrontmatter(
  raw: string,
  updates: Record<string, unknown>,
): string {
  const fmMatch = raw.match(FRONTMATTER_RE);
  let existing: Record<string, unknown> = {};
  if (fmMatch) {
    try {
      const parsed = yaml.load(fmMatch[1], { schema: yaml.JSON_SCHEMA });
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        existing = parsed as Record<string, unknown>;
      }
    } catch {
      existing = {};
    }
  }
  const merged = { ...existing, ...updates };
  // null 값은 키 제거로 처리
  for (const [k, v] of Object.entries(updates)) {
    if (v === null || v === undefined) delete merged[k];
  }

  const fm = yaml.dump(merged, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
    schema: yaml.JSON_SCHEMA,
  });
  const fmBlock = `---\n${fm.trimEnd()}\n---\n`;
  if (fmMatch) {
    return fmBlock + raw.slice(fmMatch[0].length);
  }
  return fmBlock + raw;
}

// 부분 patch: 특정 H1 섹션의 body 만 교체. 다른 섹션/frontmatter/unmapped 보존.
export function patchSection(
  raw: string,
  h1Title: string,
  newBody: string,
): string {
  // frontmatter 분리
  const fmMatch = raw.match(FRONTMATTER_RE);
  const fmBlock = fmMatch ? fmMatch[0] : "";
  const body = fmMatch ? raw.slice(fmMatch[0].length) : raw;

  // H1 영역 찾기 (코드블록 고려)
  const lines = body.split("\n");
  let startLine = -1;
  let endLine = lines.length; // exclusive
  let inCodeFence = false;
  let codeFenceMarker = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(/^(```|~~~)/);
    if (fenceMatch) {
      if (!inCodeFence) {
        inCodeFence = true;
        codeFenceMarker = fenceMatch[1];
      } else if (line.startsWith(codeFenceMarker)) {
        inCodeFence = false;
      }
      continue;
    }
    if (inCodeFence) continue;

    const h1 = line.match(/^# (.+?)\s*$/);
    if (!h1) continue;
    // KNOWN H1 만 섹션 경계. 본문 안 사용자 H1 은 건너뜀.
    if (!KNOWN_H1_SECTIONS.includes(h1[1] as KnownSection)) continue;

    if (startLine === -1 && h1[1] === h1Title) {
      startLine = i;
    } else if (startLine !== -1) {
      endLine = i;
      break;
    }
  }

  if (startLine === -1) {
    // 섹션 없음 — body 끝에 추가
    const prefix = body.replace(/\n+$/, "");
    const newSection = `# ${h1Title}\n${newBody}\n`;
    return fmBlock + (prefix ? prefix + "\n\n" : "") + newSection;
  }

  // 기존 섹션 body 교체
  const before = lines.slice(0, startLine + 1).join("\n");
  const after = endLine < lines.length ? "\n" + lines.slice(endLine).join("\n") : "";
  const middle = newBody.replace(/^\n+/, "").replace(/\n+$/, "");
  return fmBlock + before + "\n" + middle + (after || "\n");
}
