import { useCallback, useEffect, useState } from "react";

export const SIDE_PANEL_MIN = 220;
export const SIDE_PANEL_MAX = 480;
export const SIDE_PANEL_DEFAULT = 288;

const STORAGE_KEY = "side-panel-w";

function clamp(n: number): number {
  return Math.min(SIDE_PANEL_MAX, Math.max(SIDE_PANEL_MIN, n));
}

function readInitial(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n)) return clamp(n);
    }
  } catch {
    // localStorage 차단 — default 사용
  }
  return SIDE_PANEL_DEFAULT;
}

export function useSidePanelWidth() {
  const [width, setWidthState] = useState<number>(readInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(width));
    } catch {
      // 무시
    }
  }, [width]);

  const setWidth = useCallback((next: number) => {
    setWidthState(clamp(next));
  }, []);

  return { width, setWidth };
}
