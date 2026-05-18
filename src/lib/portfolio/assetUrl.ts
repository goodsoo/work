// V0.7 step 9 — vault root 상대경로 (예: "portfolio/_attachments/owner-repo-42/before-1.jpg")
// → Tauri asset URL. 토스만 (`asset:` protocol) 으로 변환 — fs scope 안에서만 동작.

import { convertFileSrc } from "@tauri-apps/api/core";

export function vaultAssetSrc(
  vaultRoot: string | null,
  relPath: string,
): string {
  if (!vaultRoot) return relPath;
  const r = vaultRoot.endsWith("/") ? vaultRoot.slice(0, -1) : vaultRoot;
  const absPath = `${r}/${relPath}`;
  return convertFileSrc(absPath);
}
