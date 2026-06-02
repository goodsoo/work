import yaml from "js-yaml";

export interface VaultFile {
  raw: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*(\n|$)/;

// frontmatter 블록만 파싱. body 는 raw slice 그대로 (개행 trim 안 함) — 소비자마다
// body 처리(루틴 로그 / 포트폴리오 H2 split / 메모 본문)가 달라 정리는 각자 한다.
// parseVaultFile 은 여기에 메모 본문용 앞뒤 개행 trim 을 얹은 것.
export function splitFrontmatter(raw: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const m = raw.match(FRONTMATTER_RE);
  if (!m) return { frontmatter: {}, body: raw };
  let frontmatter: Record<string, unknown> = {};
  try {
    const parsed = yaml.load(m[1], { schema: yaml.JSON_SCHEMA });
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      frontmatter = parsed as Record<string, unknown>;
    }
  } catch {
    // 손상된 frontmatter — empty object 로 fallback. raw 는 그대로 보존.
    frontmatter = {};
  }
  return { frontmatter, body: raw.slice(m[0].length) };
}

export function parseVaultFile(raw: string): VaultFile {
  const { frontmatter, body } = splitFrontmatter(raw);
  return { raw, frontmatter, body: body.replace(/^\n+/, "").replace(/\n+$/, "") };
}

export function serializeVaultFile(file: VaultFile): string {
  if (Object.keys(file.frontmatter).length === 0) {
    return file.body.length > 0 ? `${file.body}\n` : "";
  }
  const fm = yaml.dump(file.frontmatter, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
    schema: yaml.JSON_SCHEMA,
  });
  return `---\n${fm.trimEnd()}\n---\n\n${file.body}\n`;
}

// frontmatter 만 부분 교체. body 는 raw 그대로 유지.
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
  // null/undefined 는 키 제거
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

// body 전체 교체 (frontmatter 보존). meetings 본문 / journals 본문 / sidecar 파일 update 공통.
export function patchBody(raw: string, newBody: string): string {
  const fmMatch = raw.match(FRONTMATTER_RE);
  const fmBlock = fmMatch ? fmMatch[0] : "";
  const cleaned = newBody.replace(/^\n+/, "").replace(/\n+$/, "");
  if (!fmBlock) return cleaned.length > 0 ? `${cleaned}\n` : "";
  return `${fmBlock}\n${cleaned}\n`;
}
