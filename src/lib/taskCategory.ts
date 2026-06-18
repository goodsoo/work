import type { TaskCategory } from "../api/tasks";

// 할 일 카테고리별 시맨틱 색 단일 lookup. 오늘 사이드바 dot / SidePanel 체크박스 /
// TaskRow 체크박스 모두 이 함수만 거침. 카테고리 추가 시 여기 + index.css 토큰만
// 늘리면 됨.
//
// 미분류 (null) 은 빈 문자열 반환 — 호출처가 "색 없음" 처리 (dot 안 그림, 기존
// 회색 border 유지). 명시 폴백을 원하면 호출처에서 `|| ...` 로 처리.
export function categoryColor(category: TaskCategory | null): string {
  switch (category) {
    case "work":
      return "var(--cat-work)";
    case "schedule":
      return "var(--cat-schedule)";
    case "other":
      return "var(--cat-other)";
    default:
      return "";
  }
}
