// V0.7 step 9 — 스크린샷 저장 (binary write, Tauri only).
//
// vault root 기준 `portfolio/_attachments/{slug}/{label}-{n}.jpg`.
// design v2.3: PNG → 1600px JPEG (canvas 다운스케일) + binary fs write.

import {
  writeFile,
  mkdir as tauriMkdir,
  exists as tauriExists,
  readDir,
} from "@tauri-apps/plugin-fs";
import { attachmentsDirFor, type ScreenshotLabel } from "../../api/portfolio";
import { downscaleToJpeg } from "./image";

function joinAbs(root: string, rel: string): string {
  const r = root.endsWith("/") ? root.slice(0, -1) : root;
  return `${r}/${rel}`;
}

export interface SaveScreenshotInput {
  vaultRoot: string;
  prSlug: string;
  file: File | Blob;
  label: ScreenshotLabel;
}

export interface SaveScreenshotResult {
  path: string; // vault root 상대 경로 — frontmatter screenshots[].path 에 저장
  width: number;
  height: number;
  bytes: number;
}

// 다음 사용 가능한 파일명 찾기. {label}-1.jpg, {label}-2.jpg, ...
async function nextAvailableName(
  absDir: string,
  prefix: string,
): Promise<string> {
  let n = 1;
  try {
    const entries = await readDir(absDir);
    const used = new Set(
      entries.filter((e) => e.isFile && e.name).map((e) => e.name as string),
    );
    while (used.has(`${prefix}-${n}.jpg`)) n++;
  } catch {
    // dir 없으면 1 부터.
  }
  return `${prefix}-${n}.jpg`;
}

export async function saveScreenshot(
  input: SaveScreenshotInput,
): Promise<SaveScreenshotResult> {
  const relDir = attachmentsDirFor(input.prSlug);
  const absDir = joinAbs(input.vaultRoot, relDir);

  // 디렉토리 생성 (recursive)
  if (!(await tauriExists(absDir))) {
    await tauriMkdir(absDir, { recursive: true });
  }

  const { bytes, width, height } = await downscaleToJpeg(input.file);

  const prefix = input.label ?? "screenshot";
  const filename = await nextAvailableName(absDir, prefix);
  const absPath = joinAbs(absDir, filename);
  await writeFile(absPath, bytes);

  return {
    path: `${relDir}/${filename}`,
    width,
    height,
    bytes: bytes.length,
  };
}
