import { useEffect, useState } from "react";

export type MeetingSortKey = "name" | "date_desc" | "date_asc";

const STORAGE_KEY = "goodsoob:meetingSort";

function read(): MeetingSortKey {
  if (typeof localStorage === "undefined") return "date_desc";
  const v = localStorage.getItem(STORAGE_KEY);
  // backward compat — 옛 "date" 는 "date_desc" (최신순) 로 마이그레이트.
  if (v === "date" || v === "date_desc") return "date_desc";
  if (v === "date_asc") return "date_asc";
  if (v === "name") return "name";
  return "date_desc";
}

export function useMeetingSort() {
  const [key, setKey] = useState<MeetingSortKey>(read);
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, key);
  }, [key]);
  return [key, setKey] as const;
}
