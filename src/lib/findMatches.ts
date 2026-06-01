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

// 전체 바꾸기 — text 안 query 매치를 모두 replacement 로 치환한 새 문자열을 반환.
// findAllMatches 와 달리 from = idx + query.length 로 전진해 겹치지 않는 매치만 잡는다
// (겹침까지 치환하면 데이터 유실: "aaa" 의 "aa" 2개를 둘 다 치환하면 1글자 사라짐).
// 매치를 뒤에서부터 교체하는 것과 동치인 forward rebuild — offset 안 밀림.
export function replaceAllInText(
  text: string,
  query: string,
  replacement: string,
  caseSensitive: boolean,
): string {
  if (!query) return text;
  const hay = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  let out = "";
  let from = 0;
  for (;;) {
    const idx = hay.indexOf(needle, from);
    if (idx === -1) {
      out += text.slice(from);
      break;
    }
    out += text.slice(from, idx) + replacement;
    from = idx + query.length;
  }
  return out;
}
