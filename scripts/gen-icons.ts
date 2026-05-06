// Generate PWA icons from SVG. Run: bun run scripts/gen-icons.ts
// Replace public/favicon.svg with your own brand SVG and rerun.
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const svgPath = join(import.meta.dir, "..", "public", "favicon.svg");
const publicDir = join(import.meta.dir, "..", "public");
const svg = readFileSync(svgPath);

const targets = [
  { size: 192, file: "icon-192.png", maskable: false },
  { size: 512, file: "icon-512.png", maskable: false },
  { size: 512, file: "icon-512-maskable.png", maskable: true },
  { size: 180, file: "apple-touch-icon.png", maskable: false },
];

for (const t of targets) {
  const padding = t.maskable ? Math.round(t.size * 0.1) : 0;
  const inner = t.size - padding * 2;
  const innerPng = await sharp(svg).resize(inner, inner).png().toBuffer();
  const out = await sharp({
    create: {
      width: t.size,
      height: t.size,
      channels: 4,
      background: { r: 24, g: 24, b: 27, alpha: 1 }, // zinc-900
    },
  })
    .composite([{ input: innerPng, top: padding, left: padding }])
    .png()
    .toBuffer();
  writeFileSync(join(publicDir, t.file), out);
  console.log(`wrote public/${t.file}`);
}
