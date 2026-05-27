// Generate PWA/app icons from favicon.svg: white (rounded) background + dark logo.
// Run: bun run scripts/gen-icons.ts
// Replace public/favicon.svg with your own brand SVG and rerun.
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const publicDir = join(import.meta.dir, "..", "public");
const svg = readFileSync(join(publicDir, "favicon.svg"));

// 로고를 한 번 큰 사이즈로 렌더 → 투명 여백 trim → 모든 아이콘에서 일관된 크기로 재사용.
const tight = await sharp(svg)
  .resize(1024, 1024, { fit: "contain", background: "#00000000" })
  .png()
  .trim()
  .toBuffer({ resolveWithObject: true });

function roundedBg(size: number, radius: number) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#ffffff"/></svg>`,
  );
}

// white (rounded) bg + 중앙 정렬 dark 로고. fill = 로고가 차지하는 비율 (긴 변 기준).
async function makeIcon(size: number, radiusPct: number, fill: number) {
  const bg = await sharp(roundedBg(size, Math.round(size * radiusPct))).png().toBuffer();
  const target = Math.round(size * fill);
  const logo = await sharp(tight.data)
    .resize(target, target, { fit: "inside", background: "#00000000" })
    .png()
    .toBuffer({ resolveWithObject: true });
  const left = Math.round((size - logo.info.width) / 2);
  const top = Math.round((size - logo.info.height) / 2);
  return sharp(bg).composite([{ input: logo.data, top, left }]).png().toBuffer();
}

const targets = [
  { size: 192, file: "icon-192.png", radiusPct: 0.22, fill: 0.62 },
  { size: 512, file: "icon-512.png", radiusPct: 0.22, fill: 0.62 },
  // maskable: 플랫폼이 마스킹하므로 full-bleed 흰 사각형 + safe-zone 안에 작은 로고.
  { size: 512, file: "icon-512-maskable.png", radiusPct: 0, fill: 0.5 },
  { size: 180, file: "apple-touch-icon.png", radiusPct: 0.22, fill: 0.62 },
];

for (const t of targets) {
  const out = await makeIcon(t.size, t.radiusPct, t.fill);
  writeFileSync(join(publicDir, t.file), out);
  console.log(`wrote public/${t.file}`);
}
