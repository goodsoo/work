import { useEffect, useState } from "react";

export type BodyViewMode = "edit" | "view";

const STORAGE_KEY = "goodsoob:bodyViewMode";

function read(): BodyViewMode {
  if (typeof localStorage === "undefined") return "edit";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "view" ? "view" : "edit";
}

export function useViewMode() {
  const [mode, setMode] = useState<BodyViewMode>(read);
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);
  return [mode, setMode] as const;
}
