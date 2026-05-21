// 보기 모드 체크박스 클릭 → body source 의 task marker 1개 토글.
// MarkdownView 가 `node.position.start.offset` 으로 정확한 offset 을 넘김.
// `- [ ]` ↔ `- [x]`, `* [X]` 등 GFM task list 표기 그대로 보존.

const TASK_MARKER_RE = /^(\s*[-*+]\s+)\[([ xX])\]/;

export function toggleTaskCheckboxAt(source: string, offset: number): string {
  if (offset < 0 || offset > source.length) return source;
  const slice = source.slice(offset);
  const m = slice.match(TASK_MARKER_RE);
  if (!m) return source;
  const checked = m[2].toLowerCase() === "x";
  const next = slice.replace(
    TASK_MARKER_RE,
    (_full, prefix) => `${prefix}[${checked ? " " : "x"}]`,
  );
  return source.slice(0, offset) + next;
}
