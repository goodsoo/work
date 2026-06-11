#!/usr/bin/env node
// 기존 Obsidian `![[이미지]]` 임베드를 우리 앱 규칙으로 통일하는 일회성 마이그레이션.
//
//   notes/.../{note}.md 본문의 ![[name]]  →  ![](notes/_attachments/{uid}/{N}.{ext})
//   이미지 파일 자체도 notes/_attachments/{uid}/{N}.{ext} 로 이동.
//
// uid = 노트 frontmatter 의 `id`. 참조된 이미지만 건드림 (orphan = 미참조 파일은 그대로).
// 앱은 꺼둔 상태에서 실행할 것 (watcher race 회피).
//
// 사용법:
//   node scripts/migrate-obsidian-embeds.mjs <vault-root> [--dry-run] [--backup <dir>]

import {
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  copyFileSync,
  existsSync,
} from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname, basename, extname } from "node:path";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));
const vaultRoot = positional[0];
const DRY = flags.has("--dry-run");
const backupIdx = args.indexOf("--backup");
const BACKUP = backupIdx >= 0 ? args[backupIdx + 1] : null;

if (!vaultRoot) {
  console.error("사용법: node scripts/migrate-obsidian-embeds.mjs <vault-root> [--dry-run] [--backup <dir>]");
  process.exit(1);
}

const IMG_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;
const EMBED_RE = /!\[\[([^\]\n|]+)(?:\|([^\]\n]*))?\]\]/g;

// frontmatter `id:` 추출.
function readUid(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const idLine = m[1].match(/^id:\s*(.+)$/m);
  return idLine ? idLine[1].trim().replace(/^["']|["']$/g, "") : null;
}

// vault 전체 파일 목록 (vault root 상대). dotfile 제외.
const allFiles = execSync(`find "${vaultRoot}" -type f ! -path "*/.*"`, {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
})
  .split("\n")
  .filter(Boolean)
  .map((p) => p.slice(vaultRoot.length + 1));

// basename(소문자) → vault 상대경로 (이미지만).
const imgIndex = new Map();
for (const p of allFiles) {
  if (!IMG_EXT.test(p)) continue;
  const b = basename(p).toLowerCase();
  if (!imgIndex.has(b)) imgIndex.set(b, p);
}

// ![[..]] 임베드 가진 노트만.
const mdFiles = allFiles.filter((p) => p.endsWith(".md"));
let notesTouched = 0;
let imagesMoved = 0;
const report = [];

for (const rel of mdFiles) {
  const abs = join(vaultRoot, rel);
  const raw = readFileSync(abs, "utf8");
  if (!raw.includes("![[")) continue;

  const uid = readUid(raw);
  if (!uid) {
    report.push(`  ⚠️  SKIP (uid 없음): ${rel}`);
    continue;
  }

  let n = 0;
  const moves = []; // { from, to }
  const newBody = raw.replace(EMBED_RE, (full, rawName, alias) => {
    const name = rawName.trim();
    if (!IMG_EXT.test(name)) return full; // 노트 임베드 등 — 그대로
    const srcRel = name.includes("/") ? name : imgIndex.get(name.toLowerCase());
    if (!srcRel || !existsSync(join(vaultRoot, srcRel))) {
      report.push(`  ⚠️  미해석 임베드 그대로: ![[${name}]] (in ${rel})`);
      return full;
    }
    n += 1;
    const ext = extname(srcRel) || ".png";
    const destRel = `notes/_attachments/${uid}/${n}${ext}`;
    moves.push({ from: srcRel, to: destRel });
    const altPart = (alias ?? "").trim();
    return `![${altPart}](${destRel})`;
  });

  if (moves.length === 0) continue;

  report.push(`  ${rel}  (uid ${uid.slice(0, 8)}…)`);
  for (const mv of moves) report.push(`     ${mv.from}  →  ${mv.to}`);

  if (!DRY) {
    // 백업
    if (BACKUP) {
      const noteBak = join(BACKUP, rel);
      mkdirSync(dirname(noteBak), { recursive: true });
      copyFileSync(abs, noteBak);
      for (const mv of moves) {
        const imgBak = join(BACKUP, mv.from);
        mkdirSync(dirname(imgBak), { recursive: true });
        copyFileSync(join(vaultRoot, mv.from), imgBak);
      }
    }
    // 이미지 이동
    for (const mv of moves) {
      const destAbs = join(vaultRoot, mv.to);
      mkdirSync(dirname(destAbs), { recursive: true });
      renameSync(join(vaultRoot, mv.from), destAbs);
      imagesMoved += 1;
    }
    // 본문 재작성
    writeFileSync(abs, newBody, "utf8");
  } else {
    imagesMoved += moves.length;
  }
  notesTouched += 1;
}

console.log(report.join("\n") || "  (대상 없음)");
console.log(
  `\n${DRY ? "[DRY RUN] " : ""}노트 ${notesTouched}개, 이미지 ${imagesMoved}개 정리.${
    BACKUP && !DRY ? ` 백업: ${BACKUP}` : ""
  }`,
);
