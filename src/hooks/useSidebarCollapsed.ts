import { useCallback, useEffect, useState } from "react";

const KEY = "goodsoob:sidebarCollapsed";

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, collapsed ? "1" : "0");
    } catch {
      // ignore — private mode / quota
    }
  }, [collapsed]);

  const toggle = useCallback(() => {
    setCollapsed((v) => !v);
  }, []);

  return { collapsed, toggle, setCollapsed };
}
