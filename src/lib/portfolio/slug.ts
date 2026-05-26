// 사용자 입력 (카테고리 label / 프로젝트 name / 카드 제목) → 파일·필터 호환 slug.
// 한글은 그대로 유지 (옵시디안 vault 가 한글 파일명 standard). 금지 문자 + 공백만 정리.

export function slugifyUserKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
