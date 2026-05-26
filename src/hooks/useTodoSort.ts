import { useEffect, useState } from "react";
import { useScopedKey } from "../lib/vault/scopedStorage";

export type TodoSortKey = "name" | "date_desc" | "date_asc";

const BASE_KEY = "goodsoob:todoSort";

function readKey(key: string): TodoSortKey {
  if (typeof localStorage === "undefined") return "date_desc";
  const v = localStorage.getItem(key);
  if (v === "date_desc") return "date_desc";
  if (v === "date_asc") return "date_asc";
  if (v === "name") return "name";
  return "date_desc";
}

export function useTodoSort() {
  const key = useScopedKey(BASE_KEY);
  const [sortKey, setSortKey] = useState<TodoSortKey>(() => readKey(key));
  useEffect(() => {
    setSortKey(readKey(key));
  }, [key]);
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, sortKey);
  }, [key, sortKey]);
  return [sortKey, setSortKey] as const;
}
