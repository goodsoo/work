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

// ─────────────────────────────────────────────────────────────────────────────
// V0.7 — PR (portfolio) prompt + response parser (design v2.3, step 8)

const PR_PROMPT_HEADER = `다음 PR 정보를 보고 한 줄 임팩트 요약 + 카테고리를 정해주세요.

## 출력 형식
\`\`\`
### 한 줄 임팩트
(한 문장, 비즈니스/사용자 임팩트 중심, 30자 이내. bullet 안 붙임)

### 카테고리
ui_ux | backend | infra | fix | other 중 하나만
\`\`\`

규칙: PR title + body + 변경 파일 수/줄 수를 종합. 코드 변경 사실보다 "그래서 뭐가 좋아졌는지" 우선. "ui_ux" 같은 카테고리 값은 정확히 위 enum 그대로.`;

export interface PRPromptInput {
  title: string;
  body: string;
  url: string;
  changedFiles: number;
  additions: number;
  deletions: number;
}

export function buildPRPrompt(input: PRPromptInput): string {
  const parts: string[] = [PR_PROMPT_HEADER];
  parts.push("## PR 정보");
  parts.push(`제목: ${input.title}`);
  parts.push(`URL: ${input.url}`);
  parts.push(
    `변경: ${input.changedFiles} files, +${input.additions} -${input.deletions}`,
  );
  const trimmed = input.body.trim();
  if (trimmed) {
    parts.push("");
    parts.push("## PR 본문");
    const max = 5000;
    if (trimmed.length > max) {
      parts.push(trimmed.slice(0, max));
      parts.push("\n...(truncated)");
    } else {
      parts.push(trimmed);
    }
  }
  return parts.join("\n\n") + "\n";
}

// H3 split: "한 줄 임팩트" 와 "카테고리" 섹션 추출.
// 파싱 실패 시 null — 본인이 raw 텍스트 보고 직접 입력.
const IMPACT_HEADER = /^###\s+한\s*줄\s*임팩트\s*$/m;
const CATEGORY_HEADER = /^###\s+카테고리\s*$/m;
const CATEGORY_ENUM = /^(ui_ux|backend|infra|fix|other)$/i;
const PR_CATEGORIES = ["ui_ux", "backend", "infra", "fix", "other"] as const;
type PRCategory = (typeof PR_CATEGORIES)[number];

export function parsePRResponse(
  text: string,
): { impact: string; category: PRCategory } | null {
  // H3 split: 헤더 다음 ~ 다음 H3 사이의 텍스트 추출.
  const impactSection = text.split(IMPACT_HEADER)[1]?.split(/^###\s/m)[0] ?? "";
  const categorySection =
    text.split(CATEGORY_HEADER)[1]?.split(/^###\s/m)[0] ?? "";

  const impact = impactSection
    .split("\n")
    .map((l) => l.replace(/^[\s\-•*]+/, "").trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 60); // 30자 못 지키는 응답 방어 (60자 hard cap)

  const categoryFirstLine = categorySection
    .split("\n")
    .map((l) => l.replace(/^[\s\-•*]+/, "").trim())
    .filter(Boolean)[0] ?? "";

  const matched = categoryFirstLine.match(CATEGORY_ENUM);
  const category: PRCategory = matched
    ? (matched[1].toLowerCase() as PRCategory)
    : "other";

  if (!impact) return null; // 파싱 실패
  return { impact, category };
}
