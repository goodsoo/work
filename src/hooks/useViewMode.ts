import { useEffect, useState } from "react";
import { useScopedKey } from "../lib/vault/scopedStorage";

export type BodyViewMode = "edit" | "view";

const BASE_KEY = "goodsoob:bodyViewMode";

function readKey(key: string): BodyViewMode {
  if (typeof localStorage === "undefined") return "edit";
  const v = localStorage.getItem(key);
  return v === "view" ? "view" : "edit";
}

export function useViewMode() {
  const key = useScopedKey(BASE_KEY);
  const [mode, setMode] = useState<BodyViewMode>(() => readKey(key));
  useEffect(() => {
    setMode(readKey(key));
  }, [key]);
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, mode);
  }, [key, mode]);
  return [mode, setMode] as const;
}
