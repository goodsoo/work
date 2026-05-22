import { useEffect, useState } from "react";

export type TodoSortKey = "name" | "date_desc" | "date_asc";

const STORAGE_KEY = "goodsoob:todoSort";

function read(): TodoSortKey {
  if (typeof localStorage === "undefined") return "date_desc";
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === "date_desc") return "date_desc";
  if (v === "date_asc") return "date_asc";
  if (v === "name") return "name";
  return "date_desc";
}

export function useTodoSort() {
  const [key, setKey] = useState<TodoSortKey>(read);
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, key);
  }, [key]);
  return [key, setKey] as const;
}
