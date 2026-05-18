export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  due?: string; // ISO YYYY-MM-DD
  time?: string; // HH:MM
  assignee?: string;
  tags: string[];
  source: { file: string; line: number }; // line은 0-based
  isEvent: boolean;
}

const CHECKBOX_RE = /^(\s*)- \[([ x])\] (.+)$/;
const ASSIGNEE_RE = /^\[([^\]]+)\]\s+/;
const TAG_RE = /(?:^|\s)#([\p{L}\p{N}_-]+)/gu;
const DUE_SPLIT_RE = / — (.+)$/;
const ISO_DATE_RE = /(\d{4})-(\d{2})-(\d{2})/;
const MD_DATE_RE = /(?:^|\s)(\d{1,2})\/(\d{1,2})(?=\s|$)/;
const TIME_RE = /(?:^|\s)(\d{1,2}):(\d{2})(?=\s|$)/;

export function extractTodos(filePath: string, raw: string): TodoItem[] {
  const lines = raw.split("\n");
  const items: TodoItem[] = [];
  let inCodeFence = false;
  let codeFenceMarker = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^(```|~~~)/);
    if (fence) {
      if (!inCodeFence) {
        inCodeFence = true;
        codeFenceMarker = fence[1];
      } else if (line.startsWith(codeFenceMarker)) {
        inCodeFence = false;
      }
      continue;
    }
    if (inCodeFence) continue;

    const m = line.match(CHECKBOX_RE);
    if (!m) continue;
    const done = m[2] === "x";
    const content = m[3].trim();

    const parsed = parseTodoContent(content);
    items.push({
      id: stableId(filePath, content),
      text: parsed.text,
      done,
      due: parsed.due,
      time: parsed.time,
      assignee: parsed.assignee,
      tags: parsed.tags,
      source: { file: filePath, line: i },
      isEvent: parsed.tags.includes("event") || !!parsed.time,
    });
  }

  return items;
}

interface ParsedContent {
  text: string;
  assignee?: string;
  due?: string;
  time?: string;
  tags: string[];
}

function parseTodoContent(content: string): ParsedContent {
  let remaining = content;
  let assignee: string | undefined;
  let due: string | undefined;
  let time: string | undefined;

  // 1. assignee (`[이름] `)
  const am = remaining.match(ASSIGNEE_RE);
  if (am) {
    assignee = am[1];
    remaining = remaining.slice(am[0].length);
  }

  // 2. tags 추출
  const tags: string[] = [];
  remaining = remaining.replace(TAG_RE, (_, tag: string) => {
    tags.push(tag);
    return " ";
  });

  // 3. ` — ` 이후 date/time 추출
  const dueSplit = remaining.match(DUE_SPLIT_RE);
  if (dueSplit) {
    const duePart = dueSplit[1];
    // ISO date 우선
    const iso = duePart.match(ISO_DATE_RE);
    if (iso) {
      due = `${iso[1]}-${iso[2]}-${iso[3]}`;
    } else {
      const md = duePart.match(MD_DATE_RE);
      if (md) {
        const year = new Date().getFullYear();
        due = `${year}-${md[1].padStart(2, "0")}-${md[2].padStart(2, "0")}`;
      }
    }
    const tm = duePart.match(TIME_RE);
    if (tm) {
      time = `${tm[1].padStart(2, "0")}:${tm[2]}`;
    }
    remaining = remaining.slice(0, dueSplit.index!);
  }

  return {
    text: remaining.trim(),
    assignee,
    due,
    time,
    tags,
  };
}

// DJB2 hash → base36 string. 같은 input 은 항상 같은 output.
function stableId(filePath: string, content: string): string {
  const s = `${filePath}::${content}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return Math.abs(h).toString(36);
}

// 체크박스 토글: 정확한 라인의 `- [ ]` ↔ `- [x]` 만 patch.
// 텍스트 부분은 건드리지 않음. 외부 편집으로 라인 이동했어도 라인 내 패턴만 일치하면 OK.
export function toggleTodo(
  raw: string,
  line: number,
  done: boolean,
): string {
  const lines = raw.split("\n");
  const target = lines[line];
  if (target === undefined) {
    throw new Error(`toggleTodo: line ${line} out of range (total ${lines.length})`);
  }
  const m = target.match(CHECKBOX_RE);
  if (!m) {
    throw new Error(
      `toggleTodo: line ${line} is not a checkbox: ${target}`,
    );
  }
  lines[line] = `${m[1]}- [${done ? "x" : " "}] ${m[3]}`;
  return lines.join("\n");
}
