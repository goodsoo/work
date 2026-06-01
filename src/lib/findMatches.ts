// 메모장 탭 내 찾기 — 현재 탭 본문 문자열에서 검색어의 모든 매치 시작 index 를 반환.
// textarea 선택(setSelectionRange)에 그대로 쓰도록 시작 offset 만 돌려준다 (길이는
// query.length 고정). 겹치는 매치는 1글자씩 전진해 모두 포함 (예: "aa" in "aaa" → 2개).
export function findAllMatches(
  text: string,
  query: string,
  caseSensitive: boolean,
): number[] {
  if (!query) return [];
  const hay = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const out: number[] = [];
  let from = 0;
  for (;;) {
    const idx = hay.indexOf(needle, from);
    if (idx === -1) break;
    out.push(idx);
    from = idx + 1;
  }
  return out;
}
