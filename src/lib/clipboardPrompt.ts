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

// ─────────────────────────────────────────────────────────────────────────────
// Legacy card prompt — PR 없이 직접 push 한 repo 에서 git log 보고 portfolio
// 카드 작성하라고 "다른 프로젝트의 Claude" 에게 지시하는 self-contained 프롬프트.
// 한 번 복사해서 그 repo 의 Claude Code 에 붙여넣으면 vault 에 카드들이 생김.
// vaultRoot 는 현재 활성 vault 의 절대 경로 — useVault().vaultRoot 에서 주입.

function legacyCardPromptHeader(vaultRoot: string): string {
  return `# Goodsoob 포트폴리오: Legacy 카드 작성 (PR 없는 repo)

지금 이 repo 의 git log 를 보고 본인 (이메일: zzompang2@gmail.com / GitHub: goodsoo, 옛 username: zzompang2) 의 작업을 PR 단위처럼 그룹핑해서 \`${vaultRoot}/portfolio/\` 폴더에 카드 .md 파일들을 만들어줘. 본인이 평가/회고 자료로 쓰는 옵시디안 vault 야.`;
}

const LEGACY_CARD_PROMPT_BODY = `

## 1. 사전 작업

- \`git remote -v\` 로 owner/repo 확인 (\`origin\` 기준, GitHub Enterprise 면 host 도 메모).
- \`git log --reverse --pretty=format:"%h|%ai|%an|%ae|%s"\` 로 전체 히스토리 확보.
- 작성자 필터: 본인 이메일/이름 커밋만 매칭. 이메일은 \`zzompang2@gmail.com\`, author name 은 \`goodsoo\` 또는 옛 username \`zzompang2\` (rename 전 커밋). 회사 도메인 (\`@angel-robotics.com\` 등) 이메일로 커밋된 작업이 있으면 그것도 본인 거니까 포함. 다른 사람 커밋은 카드 만들지 마.
- vault 폴더 \`portfolio/\` 안에 이미 같은 owner/repo 의 카드가 있는지 확인. 있으면 그 다음 시점부터만 만들고, 기존 카드는 절대 덮어쓰지 마.

## 2. 그룹핑 룰

PR 사이즈를 흉내내: 같은 주제 + 시간 근접 (보통 1-3일 안) + 의미있는 마일스톤 1개 단위. 한 마일스톤당 5-30 커밋이 보통, 너무 작으면 합치고 너무 크면 쪼개.

- 같은 기능/리팩토링/버그픽스 흐름은 한 카드로.
- \`chore\`/\`docs\` 만 있는 일회성 커밋은 인접 feat 카드에 흡수.
- 버전 태깅(V0.x) 이나 "ship" 커밋 메시지가 자연스러운 경계.

각 그룹의 의미를 한 줄로 요약할 수 있어야 1개 카드. 못 하면 더 쪼개거나 합쳐.

## 3. 파일 작성

파일 이름: \`portfolio/{owner}-{repo}-{milestone-slug}.md\` (전부 kebab-case). 예: \`goodsoo-work-v0-7-portfolio.md\`. \`{milestone-slug}\` 는 버전 또는 짧은 영문/숫자 식별자 (한글 X).

각 파일 내용:

\`\`\`markdown
---
type: portfolio-work
github_owner: {owner}
github_repo: {repo}
github_pr_number: 0
github_pr_url: ''
github_state: merged
github_merged_at: {그룹 마지막 커밋의 author date, ISO 8601 UTC, 예 2026-05-18T11:30:23Z}
github_title: '{한 줄 마일스톤 제목, 한국어 OK, 작은따옴표 escape}'
github_changed_files: {그룹 첫커밋~끝커밋 git diff --shortstat 의 files changed}
github_additions: {같은 shortstat 의 insertions}
github_deletions: {같은 shortstat 의 deletions}
project: {projects.md 의 slug, 아래 4번 참고}
included: true
category: {ui_ux | backend | infra | fix | other 중 하나}
impact_summary: '{한 문장, 30자 이내, 비즈니스/사용자 임팩트 중심}'
screenshots: []
synced_at: ''
---

## Description (from GitHub)

## Summary
- {PR description 처럼 3-6 bullet, 무엇을/왜 했는지}

## What changed
- {주요 변경 area 별로 1-2 줄씩}

## Notes
{선택 — 의도적 미터치, 알려진 후속작업, 회고 등}


## Notes

\`\`\`

주의:
- 파일 마지막에 빈 \`## Notes\` 섹션을 한 번 더 둬 (본인이 외부 에디터로 메모 추가하는 영역, 위 Description 안의 ## Notes 와 별개).
- \`github_pr_number: 0\` 이 legacy 카드 표식. 절대 0 이 아닌 값 쓰지 마.
- \`github_pr_url: ''\` 빈 문자열.
- \`category\` 는 enum 5개 중 하나만, 정확한 spelling (\`ui_ux\` 언더바).
- diff stat 은 \`git diff --shortstat <first-commit>~..<last-commit>\` 한 번에 뽑아서 정확히 옮겨. merge commit 끼면 \`--no-merges\` 추가.

## 4. project 분류

\`portfolio/projects.md\` 를 먼저 읽어. frontmatter 의 \`projects:\` 배열에서 이 repo 의 \`nameWithOwner\` 가 \`repos:\` 에 포함된 항목 찾아 그 \`slug\` 를 카드의 \`project\` 필드에 써.

없으면 \`projects:\` 배열 끝에 새 항목을 추가:

\`\`\`yaml
- slug: {owner-repo kebab-case, "/" → "-"}
  name: {owner}/{repo}
  sort: {기존 max(sort)+1}
  repos:
    - {owner}/{repo}
\`\`\`

그리고 새 slug 를 카드의 \`project\` 에 사용.

## 5. 출력

- 모든 카드 파일 작성 완료한 다음, 어떤 마일스톤 N개를 어떤 파일명으로 만들었는지 list 로 보여줘.
- projects.md 수정 했으면 그것도 알려줘.
- 못 정한 그룹핑/category 가 있으면 임의 결정하지 말고 본인한테 물어봐.
`;

export function buildLegacyCardPrompt(vaultRoot: string | null): string {
  // vault 미설정 (vaultRoot null) → 본인에게 vault picker 띄우라고 안내.
  if (!vaultRoot) {
    return `# Goodsoob 포트폴리오: Legacy 카드 작성

본인의 Goodsoob vault 가 아직 설정되지 않았어. 데스크탑 앱에서 vault 폴더를 먼저 선택한 다음 다시 이 버튼 눌러서 프롬프트 복사해줘.
`;
  }
  return legacyCardPromptHeader(vaultRoot) + LEGACY_CARD_PROMPT_BODY;
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
