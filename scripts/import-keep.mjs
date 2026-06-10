#!/usr/bin/env node
// Google Keep (Takeout) → goodsoob-work vault notes/ 변환기 (일회성 유틸).
//
// 사용법:
//   node scripts/import-keep.mjs <takeout-keep-dir> <vault-root> [옵션]
//
//   <takeout-keep-dir>  Takeout 압축 푼 후의 Keep 폴더 (안에 *.json 들이 있음)
//                       보통 "Takeout/Keep" 또는 "Takeout/Keep 보관" 류.
//   <vault-root>        vault 루트 (안에 notes/ 를 만듭니다)
//
// 옵션:
//   --include-trashed   휴지통 메모도 포함 (기본: 제외)
//   --skip-archived     보관 메모 제외 (기본: 포함, tags 에 'archived' 추가)
//   --dry-run           파일을 쓰지 않고 무엇이 만들어질지만 출력
//
// 매핑:
//   title        → 파일명 notes/{slug}.md (충돌 시 -2, -3 …)
//   textContent  → 본문
//   listContent  → 본문 (- [ ] / - [x] 체크리스트)
//   labels[].name→ frontmatter tags
//   isPinned     → frontmatter pinned: true
//   userEdited.. → frontmatter date (YYYY-MM-DD)
//   isArchived   → tags 에 'archived'
//   attachments  → notes/_attachments/ 로 복사 + 본문 끝에 ![](경로) 임베드

import { randomUUID } from "node:crypto";
import {
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  copyFileSync,
} from "node:fs";
import { join, basename, dirname } from "node:path";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));
const [keepDir, vaultRoot] = positional;

if (!keepDir || !vaultRoot) {
  console.error(
    "사용법: node scripts/import-keep.mjs <takeout-keep-dir> <vault-root> [--include-trashed] [--skip-archived] [--dry-run]",
  );
  process.exit(1);
}

const INCLUDE_TRASHED = flags.has("--include-trashed");
const SKIP_ARCHIVED = flags.has("--skip-archived");
const DRY_RUN = flags.has("--dry-run");

// 앱 slugify 규칙과 동일 (src/lib/vault/scan.ts).
// eslint-disable-next-line no-control-regex
const UNSAFE_FILENAME_RE = /[\x00-\x1f/\\:*?"<>|#^[\]]/g;
function slugify(title) {
  let s = String(title ?? "").replace(UNSAFE_FILENAME_RE, "-");
  s = s.replace(/^[.\s]+|[.\s]+$/g, "");
  if (s.length > 200) s = s.slice(0, 200).replace(/[.\s]+$/, "");
  return s || "untitled";
}

// userEditedTimestampUsec (마이크로초) → YYYY-MM-DD (로컬).
function usecToDate(usec) {
  if (!usec || typeof usec !== "number") return null;
  const d = new Date(Math.floor(usec / 1000));
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// YAML scalar 안전 인용 — 한글/공백/특수문자 대비 항상 double-quote.
function yamlStr(s) {
  return `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function buildBody(note) {
  if (Array.isArray(note.listContent) && note.listContent.length > 0) {
    return note.listContent
      .map((it) => `- [${it.isChecked ? "x" : " "}] ${it.text ?? ""}`)
      .join("\n");
  }
  return (note.textContent ?? "").replace(/\r\n/g, "\n");
}

function buildFrontmatter(note) {
  const lines = ["---", `id: ${randomUUID()}`];
  const date = usecToDate(note.userEditedTimestampUsec) ??
    usecToDate(note.createdTimestampUsec);
  if (date) lines.push(`date: ${date}`);

  const tags = [];
  if (Array.isArray(note.labels)) {
    for (const l of note.labels) if (l?.name) tags.push(l.name);
  }
  if (note.isArchived && !SKIP_ARCHIVED) tags.push("archived");
  if (tags.length > 0) {
    lines.push(`tags: [${tags.map(yamlStr).join(", ")}]`);
  }
  if (note.isPinned) lines.push("pinned: true");
  lines.push("---");
  return lines.join("\n");
}

// ── 실행 ──
const files = readdirSync(keepDir).filter((f) => f.toLowerCase().endsWith(".json"));
if (files.length === 0) {
  console.error(`'${keepDir}' 안에 .json 파일이 없습니다. Takeout Keep 폴더가 맞는지 확인하세요.`);
  process.exit(1);
}

const notesDir = join(vaultRoot, "notes");
const attachDir = join(notesDir, "_attachments");
if (!DRY_RUN) mkdirSync(notesDir, { recursive: true });

const usedNames = new Set();
function uniqueName(slug) {
  let name = slug;
  let n = 2;
  while (usedNames.has(name.toLowerCase())) name = `${slug}-${n++}`;
  usedNames.add(name.toLowerCase());
  return name;
}

let written = 0;
let skipped = 0;
const summary = [];

for (const file of files) {
  let note;
  try {
    note = JSON.parse(readFileSync(join(keepDir, file), "utf8"));
  } catch {
    console.warn(`파싱 실패, 건너뜀: ${file}`);
    continue;
  }

  if (note.isTrashed && !INCLUDE_TRASHED) {
    skipped++;
    continue;
  }

  const rawTitle = (note.title ?? "").trim();
  const fallback = (note.textContent ?? "").split("\n")[0]?.trim().slice(0, 60);
  const slug = uniqueName(slugify(rawTitle || fallback || "무제 메모"));

  let body = buildBody(note);

  // 첨부 이미지 — Takeout 은 같은 폴더에 파일을 둠. 복사 + 임베드.
  if (Array.isArray(note.attachments) && note.attachments.length > 0) {
    const embeds = [];
    for (const att of note.attachments) {
      const fp = att.filePath;
      if (!fp) continue;
      const src = join(keepDir, basename(fp));
      if (existsSync(src)) {
        const dest = join(attachDir, basename(fp));
        if (!DRY_RUN) {
          mkdirSync(dirname(dest), { recursive: true });
          copyFileSync(src, dest);
        }
        embeds.push(`![](_attachments/${basename(fp)})`);
      }
    }
    if (embeds.length > 0) body = `${body}\n\n${embeds.join("\n")}`.trim();
  }

  const content = `${buildFrontmatter(note)}\n${body}\n`;
  const outPath = join(notesDir, `${slug}.md`);
  if (!DRY_RUN) writeFileSync(outPath, content, "utf8");
  written++;
  summary.push(`  ${slug}.md`);
}

console.log(
  `${DRY_RUN ? "[DRY RUN] " : ""}변환 완료: ${written}개 작성, ${skipped}개 건너뜀(휴지통).`,
);
if (summary.length <= 40) summary.forEach((s) => console.log(s));
else console.log(`  …${summary.length}개 파일`);
console.log(`출력 위치: ${notesDir}`);
