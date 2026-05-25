import { useEffect, useState } from "react";
import { useScopedKey } from "../lib/vault/scopedStorage";

export type MeetingSortKey = "name" | "date_desc" | "date_asc";

const BASE_KEY = "goodsoob:meetingSort";

function readKey(key: string): MeetingSortKey {
  if (typeof localStorage === "undefined") return "date_desc";
  const v = localStorage.getItem(key);
  // backward compat — 옛 "date" 는 "date_desc" (최신순) 로 마이그레이트.
  if (v === "date" || v === "date_desc") return "date_desc";
  if (v === "date_asc") return "date_asc";
  if (v === "name") return "name";
  return "date_desc";
}

export function useMeetingSort() {
  const key = useScopedKey(BASE_KEY);
  const [sortKey, setSortKey] = useState<MeetingSortKey>(() => readKey(key));
  useEffect(() => {
    setSortKey(readKey(key));
  }, [key]);
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, sortKey);
  }, [key, sortKey]);
  return [sortKey, setSortKey] as const;
}
