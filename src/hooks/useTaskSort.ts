import { useEffect, useState } from "react";
import { useScopedKey } from "../lib/vault/scopedStorage";

export type TaskSortKey = "name" | "date_desc" | "date_asc";

// v2 bump: 기본 정렬을 최신순→오래된순으로 바꾸면서 키를 갈아끼움. hook 이 mount
// 때 default 를 auto-persist 하던 탓에 옛 키엔 "date_desc" 가 저장돼 있어, 키를
// 안 바꾸면 새 default 가 안 먹음. v2 는 저장값이 없어 새 default(오래된순) 적용.
const BASE_KEY = "goodsoob:todoSort2";

function readKey(key: string): TaskSortKey {
  // 할일 기본 정렬 = 오래된순(date_asc). 먼저 적은 할 일부터 위에 오는 게 자연스러움.
  if (typeof localStorage === "undefined") return "date_asc";
  const v = localStorage.getItem(key);
  if (v === "date_desc") return "date_desc";
  if (v === "date_asc") return "date_asc";
  if (v === "name") return "name";
  return "date_asc";
}

export function useTaskSort() {
  const key = useScopedKey(BASE_KEY);
  const [sortKey, setSortKey] = useState<TaskSortKey>(() => readKey(key));
  useEffect(() => {
    setSortKey(readKey(key));
  }, [key]);
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, sortKey);
  }, [key, sortKey]);
  return [sortKey, setSortKey] as const;
}
