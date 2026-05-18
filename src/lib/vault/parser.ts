import yaml from "js-yaml";

export interface VaultFile {
  raw: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

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
