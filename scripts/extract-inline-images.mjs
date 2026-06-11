#!/usr/bin/env node
// 본문에 박힌 base64 data-URI 이미지 (`![](data:image/png;base64,...)`) 를 파일로 빼내
// 우리 앱 규칙으로 통일한다.
//
//   ![alt](data:image/png;base64,XXXX)  →  ![alt](notes/_attachments/{uid}/{N}.png)
//   + 디코드한 바이트를 notes/_attachments/{uid}/{N}.png 로 저장.
//
// uid = 노트 frontmatter `id`. 기존 _attachments/{uid}/ 의 마지막 번호 다음부터 이어붙임.
// 외부 URL(http)·일반 경로 이미지는 안 건드림. 앱 꺼둔 상태에서 실행.
//
// 사용법:
//   node scripts/extract-inline-images.mjs <vault-root> [note-rel-path] [--dry-run] [--backup <dir>]
//     note-rel-path 생략 시 notes/ 전체 스캔.

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));
const vaultRoot = positional[0];
const onlyNote = positional[1] ?? null;
const DRY = flags.has("--dry-run");
const bi = args.indexOf("--backup");
const BACKUP = bi >= 0 ? args[bi + 1] : null;

if (!vaultRoot) {
  console.error("사용법: node scripts/extract-inline-images.mjs <vault-root> [note-rel-path] [--dry-run] [--backup <dir>]");
  process.exit(1);
}

const MIME_EXT = { png: "png", jpeg: "jpg", jpg: "jpg", gif: "gif", webp: "webp", "svg+xml": "svg" };
// ![alt](data:image/<mime>;base64,<DATA>) — DATA 엔 ')' 없음.
const DATA_RE = /!\[([^\]]*)\]\(data:image\/([a-z+]+);base64,([^)]+)\)/g;

function readUid(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const id = m[1].match(/^id:\s*(.+)$/m);
  return id ? id[1].trim().replace(/^["']|["']$/g, "") : null;
}

function nextIndex(dir) {
  if (!existsSync(dir)) return 1;
  let max = 0;
  for (const e of readdirSync(dir)) {
    const m = e.match(/^(\d+)\./);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

let mdFiles;
if (onlyNote) {
  mdFiles = [onlyNote];
} else {
  mdFiles = execSync(`find "${vaultRoot}/notes" -name "*.md" ! -path "*/.*"`, {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  })
    .split("\n")
    .filter(Boolean)
    .map((p) => p.slice(vaultRoot.length + 1));
}

let notesTouched = 0;
let imagesExtracted = 0;
const report = [];

for (const rel of mdFiles) {
  const abs = join(vaultRoot, rel);
  const raw = readFileSync(abs, "utf8");
  if (!raw.includes("data:image/")) continue;

  const uid = readUid(raw);
  if (!uid) {
    report.push(`  ⚠️  SKIP (uid 없음): ${rel}`);
    continue;
  }

  const dir = join(vaultRoot, "notes", "_attachments", uid);
  let n = nextIndex(dir);
  const writes = []; // { path, bytes }

  const newBody = raw.replace(DATA_RE, (full, alt, mime, b64) => {
    const ext = MIME_EXT[mime];
    if (!ext) return full; // 미지원 mime — 그대로
    const idx = n++;
    const destRel = `notes/_attachments/${uid}/${idx}.${ext}`;
    const bytes = Buffer.from(b64.replace(/\s/g, ""), "base64");
    writes.push({ path: join(vaultRoot, destRel), bytes });
    return `![${alt}](${destRel})`;
  });

  if (writes.length === 0) continue;

  const before = Buffer.byteLength(raw);
  const after = Buffer.byteLength(newBody);
  report.push(
    `  ${rel} (uid ${uid.slice(0, 8)}…): base64 ${writes.length}개 추출, ` +
      `${(before / 1048576).toFixed(1)}MB → ${(after / 1024).toFixed(1)}KB`,
  );
  for (const w of writes) {
    report.push(`     → ${w.path.slice(vaultRoot.length + 1)} (${(w.bytes.length / 1024).toFixed(0)}KB)`);
  }

  if (!DRY) {
    if (BACKUP) {
      const bak = join(BACKUP, rel);
      mkdirSync(dirname(bak), { recursive: true });
      copyFileSync(abs, bak);
    }
    mkdirSync(dir, { recursive: true });
    for (const w of writes) writeFileSync(w.path, w.bytes);
    writeFileSync(abs, newBody, "utf8");
  }
  notesTouched += 1;
  imagesExtracted += writes.length;
}

console.log(report.join("\n") || "  (base64 인라인 이미지 없음)");
console.log(
  `\n${DRY ? "[DRY RUN] " : ""}노트 ${notesTouched}개, 이미지 ${imagesExtracted}개 추출.${
    BACKUP && !DRY ? ` 백업: ${BACKUP}` : ""
  }`,
);
