import { parseLooseDate, parseLooseTime } from "../dates";

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  due?: string; // ISO YYYY-MM-DD
  time?: string; // HH:MM
  tags: string[];
  source: { file: string; line: number }; // line은 0-based
}

const CHECKBOX_RE = /^(\s*)- \[([ x])\] (.+)$/;
const TAG_RE = /(?:^|\s)#([\p{L}\p{N}_-]+)/gu;
// em dash (— U+2014) 또는 triple hyphen (---). 한국어 키보드는 em dash 직접 입력
// 어려워서 --- 도 같이 매칭. -- (2개) 는 CLI 옵션 / 영어 본문 false positive 우려로
// 채택 X. macOS 스마트 dash 자동 치환은 SourceBodyEditor 가 차단.
const DUE_SPLIT_RE = / (?:—|---) (.+)$/;
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
      tags: parsed.tags,
      source: { file: filePath, line: i },
    });
  }

  return items;
}

interface ParsedContent {
  text: string;
  due?: string;
  time?: string;
  tags: string[];
}

function parseTodoContent(content: string): ParsedContent {
  let remaining = content;
  let due: string | undefined;
  let time: string | undefined;

  // 1. tags 추출
  const tags: string[] = [];
  remaining = remaining.replace(TAG_RE, (_, tag: string) => {
    tags.push(tag);
    return " ";
  });

  // 2. ` — ` 또는 ` --- ` 이후 date/time 추출
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
    // 자연어 fallback — lib/dates 의 parser 로 "내일", "월", "오후 2시", "1830"
    // 같은 토큰 흡수. ISO/M/D/HH:MM 이 못 잡은 부분만 시도.
    // parseLooseTime 이 너무 관대해서 date-like 토큰을 시간으로 잘못 흡수하는 걸 차단:
    //   - duePart 전체 시도는 date 만 (시간은 false positive 잦음)
    //   - 토큰별 시간 시도는 slash/dash 포함 토큰 skip
    //   - 인접 2-token window 는 시간 prefix (오전/오후/AM/PM) 일 때만 — "오후 2시"
    if (!due) {
      const d = parseLooseDate(duePart);
      if (d) due = d;
    }
    if (!due || !time) {
      const tokens = duePart.split(/\s+/).filter(Boolean);
      // 1. 시간 prefix sliding window — "오후 2시" 같은 multi-word
      if (!time && tokens.length >= 2) {
        for (let i = 0; i < tokens.length - 1; i++) {
          if (!/^(오전|오후|am|pm)$/i.test(tokens[i])) continue;
          const t = parseLooseTime(`${tokens[i]} ${tokens[i + 1]}`);
          if (t) {
            time = t;
            break;
          }
        }
      }
      // 2. 단일 토큰
      for (const tok of tokens) {
        if (!due) {
          const d = parseLooseDate(tok);
          if (d) due = d;
        }
        if (!time) {
          const isDateLike = /[/\-]/.test(tok) && /\d/.test(tok);
          if (!isDateLike) {
            const t = parseLooseTime(tok);
            if (t) time = t;
          }
        }
      }
    }
    // date / time 적어도 하나 매칭 시만 split 유효. 둘 다 실패면 --- 자체를
    // 본문 일부로 보존 — 외부 편집 / 사용자 실수로 매칭 깨졌을 때 텍스트 손실 방지.
    if (due || time) {
      remaining = remaining.slice(0, dueSplit.index!);
    }
  }

  return {
    text: remaining.trim(),
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
