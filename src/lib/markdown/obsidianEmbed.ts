// Obsidian `![[파일]]` 이미지 임베드 → 표준 마크다운 `![](경로)` 변환.
//
// 왜 파일 mutation 이 아니라 읽기 시 변환인가: 이 vault 는 Obsidian 과 공유된다.
// Obsidian (모바일/데스크탑) 이 이미지 넣을 때마다 `![[...]]` 가 계속 새로 생기므로
// 일회성 변환 스크립트로는 안 된다. 우리 앱이 읽을 때 호환 렌더하는 게 유일한 항구적
// 해법. 쓰기 규칙은 그대로 (`![](notes/_attachments/{uid}/N.ext)`), 읽기만 양방향 수용.
//
// 변환된 경로는 vault root 상대. MarkdownView 의 resolveImageSrc → vaultAssetSrc 가
// `asset://` 로 마무리한다. 공백·한글 경로는 `<...>` 로 감싸 CommonMark url 파싱 보존.

const IMG_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;

// Obsidian 임베드: `![[target]]` 또는 `![[target|alias]]`. target 은 `] | 개행` 제외.
const EMBED_RE = /!\[\[([^\]\n|]+)(?:\|([^\]\n]*))?\]\]/g;

// alias 가 순수 크기 지정 (`200`, `200x300`) 이면 alt 로 쓰지 않고 파일명을 alt 로.
const SIZE_ALIAS_RE = /^\d+(x\d+)?$/;

export type EmbedResolver = (target: string) => string | null;

// vault 파일 목록 (vault root 상대 경로) → 이미지 basename(소문자) → 경로 인덱스.
// Obsidian default 임베드는 "가장 짧은 유일 경로" = 보통 bare 파일명이라 basename 으로
// 역인덱싱한다. 동일 basename 충돌 시 첫 항목 우선 (이 vault 는 충돌 0 확인됨).
export function buildVaultImageIndex(paths: string[]): Map<string, string> {
  const idx = new Map<string, string>();
  for (const p of paths) {
    if (!IMG_EXT.test(p)) continue;
    const base = (p.split("/").pop() ?? "").toLowerCase();
    if (base && !idx.has(base)) idx.set(base, p);
  }
  return idx;
}

export function makeEmbedResolver(index: Map<string, string>): EmbedResolver {
  return (target) => {
    const t = target.trim();
    if (!IMG_EXT.test(t)) return null; // 노트 임베드 (`![[note]]`) 등 — 미지원, 원본 유지
    // 경로형 (`![[folder/img.png]]`) — Obsidian 은 vault root 상대. 그대로 사용.
    if (t.includes("/")) return t;
    return index.get(t.toLowerCase()) ?? null; // bare 파일명 — basename 룩업
  };
}

// 코드 (펜스 ``` / ~~~, 인라인 `...`) 밖만 변환. 코드 안 `![[...]]` 는 리터럴 유지.
function splitOnCode(md: string): Array<{ code: boolean; text: string }> {
  const out: Array<{ code: boolean; text: string }> = [];
  const re = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    if (m.index > last) out.push({ code: false, text: md.slice(last, m.index) });
    out.push({ code: true, text: m[0] });
    last = re.lastIndex;
  }
  if (last < md.length) out.push({ code: false, text: md.slice(last) });
  return out;
}

// `![[파일]]` 임베드를 표준 이미지 마크다운으로 확장. resolve 가 null 반환하면 원본 유지.
export function expandObsidianEmbeds(md: string, resolve: EmbedResolver): string {
  if (!md.includes("![[")) return md;
  return splitOnCode(md)
    .map((seg) =>
      seg.code
        ? seg.text
        : seg.text.replace(EMBED_RE, (full, rawTarget: string, rawAlias?: string) => {
            const target = rawTarget.trim();
            const url = resolve(target);
            if (!url) return full;
            const alias = (rawAlias ?? "").trim();
            const alt = alias && !SIZE_ALIAS_RE.test(alias) ? alias : target;
            return `![${alt}](<${url}>)`;
          }),
    )
    .join("");
}
