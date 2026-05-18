// Claude 등 외부 AI 에 회의록 요약 요청할 프롬프트 생성.

export interface PromptInput {
  title?: string | null;
  date?: string | null;
  time?: string | null;
  attendees?: string | string[] | null;
  content?: string | null;
  transcript?: string | null;
}

function attendeesToString(v: PromptInput["attendees"]): string {
  if (!v) return "";
  if (Array.isArray(v)) return v.join(", ");
  return v;
}

const PROMPT_HEADER = `다음 회의록을 정리해주세요.

## 출력 형식
\`\`\`
### 논의 사항
- 항목1
- 항목2

### 결정 사항
- 합의/확정된 결정만

### 액션 아이템
- [담당자] 할 일 — 기한
\`\`\`

규칙: 본문에 있는 정보를 우선하고, 회의 내용(transcript)은 디테일 보조. 충돌 시 본문 우선. 빈 섹션은 생략.`;

export function buildClaudePrompt(input: PromptInput): string {
  const parts: string[] = [PROMPT_HEADER];

  const metaLines: string[] = [];
  if (input.title) metaLines.push(`제목: ${input.title}`);
  if (input.date) metaLines.push(`일시: ${input.date}${input.time ? ` ${input.time}` : ""}`);
  const att = attendeesToString(input.attendees);
  if (att.trim()) metaLines.push(`참석: ${att.trim()}`);
  if (metaLines.length > 0) {
    parts.push("## 메타");
    parts.push(metaLines.join("\n"));
  }

  const content = (input.content ?? "").trim();
  if (content) {
    parts.push("## 본문");
    parts.push(content);
  }

  const transcript = (input.transcript ?? "").trim();
  if (transcript) {
    parts.push("## 회의 내용");
    parts.push(transcript);
  }

  return parts.join("\n\n") + "\n";
}
