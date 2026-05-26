import type { Meeting } from "../api/meetings";
import type { MeetingSortKey } from "../hooks/useMeetingSort";

// 사이드바 메모 정렬 comparator. SidePanel + App.tsx (메모 삭제 후 자동 선택,
// Cmd+↑/↓ 이동) 가 같은 정렬 적용해야 시각적 직관과 일치 — 그래서 helper 로 분리.
//
// 키 우선순위: date → time → mtime. date/time 없는 메모는 같은 그룹 안 맨 아래.
// name 정렬은 ko locale 비교 (한글 자모).
export function buildMeetingSortComparator(
  sortKey: MeetingSortKey,
): (a: Meeting, b: Meeting) => number {
  return (a, b) => {
    if (sortKey === "name") {
      const ta = (a.title ?? "").trim();
      const tb = (b.title ?? "").trim();
      if (!ta && !tb) return b.mtime - a.mtime;
      if (!ta) return 1;
      if (!tb) return -1;
      return ta.localeCompare(tb, "ko");
    }
    const asc = sortKey === "date_asc";
    const da = a.date ?? "";
    const db = b.date ?? "";
    if (da !== db) {
      if (!da) return 1;
      if (!db) return -1;
      return asc ? da.localeCompare(db) : db.localeCompare(da);
    }
    const ta = a.time ?? "";
    const tb = b.time ?? "";
    if (ta !== tb) {
      if (!ta) return 1;
      if (!tb) return -1;
      return asc ? ta.localeCompare(tb) : tb.localeCompare(ta);
    }
    return asc ? a.mtime - b.mtime : b.mtime - a.mtime;
  };
}
