import { isTauri } from "./isTauri";

export const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

// macOS Tauri 데스크탑 — Overlay titlebar 가 적용되는 환경.
// Windows/Linux Tauri 와 웹 (PWA, dev) 에서는 false.
export const isMacTauri = isTauri && isMac && !/iPhone|iPad/.test(navigator?.userAgent ?? "");

export function applyPlatformClasses(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (isMacTauri) root.classList.add("is-mac-tauri");
}
