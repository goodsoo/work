# goodsoob-work — Claude Code 컨텍스트

본인 전용 시간축 통합 업무관리 PWA. 1인 본인 사용 사이드 프로젝트 (빌더 모드).

## 프로젝트 진실 source

- **기획안**: `goodsoob-work-plan.md`
- **Design doc** (eng/design review 결정 다 반영): `~/.gstack/projects/goodsoob-work/ham-no-git-design-20260506-161246.md`
- **Test plan**: `~/.gstack/projects/goodsoob-work/ham-no-git-eng-review-test-plan-20260506-170527.md`

해당 파일을 읽고 일하는 게 source of truth. 이 파일은 빠른 컨텍스트만.

## 로드맵

- ✅ V0.0~V0.5 — 기본 기능 완료 (메모 CRUD, AI 요약, 일기, Todo, 캘린더)
- ✅ V0.5.1 — 데스크탑 3-pane 레이아웃 + 캘린더 리라이트 + 디자인 토큰 + 테마
- ✅ V0.5.2 — 메모장 본문/회의 내용/요약 3-탭 + transcript 필드 + 편집/보기 토글 + 글로벌 툴팁
- ✅ V0.5.3 — 캘린더 첫 진입 버그 fix + 메모 history 메모별·탭별 분리 + 진입 자동 선택 + 페이지 전환 시 보존
- 🟡 V0.6 후보 — Server-side 메모 history (client-side 분리/보존으로 1차 해결, 새로고침 영속만 남음)
- 🟡 V0.7 후보 — UI/UX 포트폴리오 자동 기록
- 🟡 후속 — 녹음 파일 직접 업로드 → 자동 STT (현재는 외부 AI로 변환한 결과 복붙/파일 업로드)

## 핵심 결정 (review 통과됨)

- **Server state**: TanStack Query 일관 사용. 모든 fetch는 `useMeetings` 같은 훅 패턴. `src/api/{meetings,journals,todos,schedules}.ts` 가 supabase-js 캡슐화 + `src/hooks/use*.ts` 가 query/mutation 정의. `useUpdateMeeting` 은 optimistic update (인라인 편집 즉시 반영).
- **회의록 폼 상태** (V0.5.3): `useStateHistory` 를 4개 stack 으로 분리 — `body`(content) / `transcript` / `summary`(discussion_items + decisions + action_items) / `meta`(title + date + time + attendees). 각자 `cacheKey="${meetingId}:${stack}"` 로 module-level Map 에 보존. 메모 전환 또는 페이지 전환 후 같은 메모로 돌아오면 value + history + canUndo 가 그대로 복원됨. 각 stack 의 `onCommit` 은 자기 필드만 partial patch → `useUpdateMeeting` (optimistic). pending commit 은 cacheKey transition 시 outgoing onCommit (옛 메모의 mutation) 에 deferred flush.
- **일기/캘린더 자동 저장**: `useDebouncedSave` (queue coalescing) — 일기 본문 등 텍스트 단일 필드용. 회의록은 위 useStateHistory가 대체.
- **Edge Function 에러**: try/catch + toast + retry button + Anthropic SDK `tool_use` 구조화 출력 강제. 모델은 `claude-haiku-4-5-20251001`.
- **회의록 AI 출력 schema**: `{discussion_items, decisions, action_items}` 3분리 (V0.1.1). action_items 형식 `[담당자] 할 일 — 기한`. 결정 사항은 합의/확정된 것만.
- **회의록 AI 입력 source** (V0.5.2): 본문(`content`, 회의 중 직접 적은 정리 노트) + 회의 내용(`transcript`, 녹음의 외부 STT 변환 결과). 본문 우선, transcript는 디테일 보조. 충돌 시 본문 우선. 한쪽만 있어도 동작. 둘 다 비면 SummarizeButton 비활성.
- **테스트**: Vitest. `lib/markdown.test.ts` (5 unit) + `lib/dates.test.ts` (5 unit) + Edge Function smoke 1개. UI 회귀는 본인이 매일 사용으로 발견.
- **디자인 토큰**: 시맨틱 CSS custom property 기반 (18개 토큰). `DESIGN.md` 참조. 컴포넌트에서 `style={{ color: "var(--text-primary)" }}` 패턴. Tailwind `dark:` 색상 접두사 사용 금지.
- **테마**: `useTheme` hook. 라이트/다크 2단계 토글. 첫 방문 시 OS 설정 → localStorage 저장. `.dark` class 기반 (`@custom-variant dark`).
- **레이아웃 (데스크탑)**: Obsidian 스타일 3-pane. `ActivityBar` (48px 아이콘) + `SidePanel` (288px, 탭별 내용) + Main. 모바일: 하단 탭 + 단일 컬럼.
- **"회의록" → "메모장"**: UI 전체 리네이밍 완료. 내부 코드는 `meetings` 유지.
- **메모장 에디터** (V0.5.2): 제목(3xl) → 메타데이터(인라인) → 3-탭 [본문 / 회의 내용 / 요약]. 탭 row sticky(`top: 2.5rem`). 우측 액션(편집/보기 토글, 마크다운 복사, 삭제) compact 아이콘. 하단에 액션 X.
  - **본문 탭**: `SourceBodyEditor` (편집, 마크다운 source) ↔ `MarkdownView` (보기). 토글은 `useViewMode` (localStorage persist). 편집 모드 textarea 왼쪽에 line gutter — `inferLineKind`가 줄별 마크다운 종류 표시 (제목/목록/인용/코드/Setext heading/들여쓰기 단계 등 + 이전 컨텍스트로 "이어짐" 추론). `wrap="off"` + 세로 페이지 스크롤.
  - **회의 내용 탭** (`transcript`): raw textarea + 파일 업로드 (`.txt/.md/.vtt/.srt`). 업로드 시 기존 내용 뒤에 이어붙임.
  - **요약 탭**: `SummarizeButton` + 기존 callout 3개 + 액션 아이템 → todo 변환.
  - **메모/탭 전환 동작** (V0.5.3): 메모 전환 시 `ACTIVE_TAB_CACHE` 모듈 Map 에서 그 메모의 마지막 탭으로 (없으면 본문). 페이지 전환(메모장 ↔ 캘린더 등) 후 돌아와도 메모 + 마지막 탭 + 4-stack history 모두 유지. 새로고침 시 모듈 cache 비워짐.
  - 단축키 (Tauri only): Cmd/Ctrl+Z (활성 탭 stack 의 undo — meta 는 native input undo), Cmd+1/2/3 페이지 탭, Opt+1/2/3 메모 sub-tab (Opt+1은 본문 탭이면 편집/보기 토글). 브라우저는 시스템 단축키 충돌로 sub-tab 단축키 없음.
- **캘린더**: 타임라인뷰 제거. 무한 스크롤 MonthGrid + snap. 셀 내 이벤트 타이틀 표시. 사이드 패널에 선택 날짜 상세.
- **할 일 카테고리**: `todos.category` (work/meeting). 사이드바 필터 (전체/업무/미팅/미분류). 일정(schedules)과 통합 표시.
- **라우팅**: URL hash 기반 (`#meetings` / `#calendar` / `#todos` / `#meeting-{id}`). tab 전환 시 `selectedMeetingId` 보존 — 메모장 ↔ 다른 탭 왕복해도 보던 메모 그대로. `hashchange` listener 는 hash 에 meeting id 있을 때만 set, 다른 hash 일 땐 보존.
- **메모장 자동 선택** (V0.5.3): 페이지 진입 시 메모 1개 이상이면 최상단(`date desc, created_at desc`) 자동 선택. 모듈 flag (`didAutoSelectThisSession`) 로 세션당 한 번만 — 사용자가 onBack 한 뒤 페이지 갔다 와도 다시 자동 선택 X. 새로고침 시 reset.
- **마크다운 출력 포맷** (본인 회의록 spec, 외부 복사용): `## {title or "회의록"}` → `일시: YYYY.MM.DD (요일) [시간]` + `참석:` → `### 논의 사항` / `### 결정 사항` / `### 액션 아이템` 3섹션. 빈 섹션 omit. `lib/markdown.ts` `meetingToMarkdown()` 가 단일 source. ❌ "Notion 호환" 표현 쓰지 말 것.
- **마크다운 렌더링**: `react-markdown` + `remark-gfm`. `MarkdownView.tsx` — 디자인 토큰 기반 스타일링. `ol` 컴포넌트에서 `start` prop 통과 (떨어진 ordered list 번호 이어짐).
- **글로벌 툴팁** (V0.5.2): `<GlobalTooltip />` (`App.tsx`에 마운트). 모든 `title="..."` 속성을 hover 시 자동 커스텀 툴팁으로 변환. 250ms delay + 디자인 토큰 + 위치 자동 (top/bottom/left/right) + chain hover 즉시 표시. native title 비우고 `aria-label` 자동 보강.
- **Tauri**: 데스크탑 앱 셋업 완료 (`src-tauri/`). `bun run tauri:dev` / `tauri:build`. Vite 포트 1420 고정.

## 빌더 모드 톤

- 1인 본인 사용 도구. 매일 본인이 직접 쓰는 것이 검증.
- Over-engineering 회피. "production grade"가 정답이 아님.
- 매일 사용 시 신뢰 깨지는 곳 (data loss, 한 번도 발생 안 한 에러 silent fail)은 단단히.
- 그 외 generic SaaS pattern (multi-user, sharing, analytics, complex permissions) 절대 안 만듦.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. The
skill has multi-step workflows, checklists, and quality gates that produce better
results than an ad-hoc answer.

- 새 기능 brainstorm → `/office-hours`
- 아키텍처 검토 → `/plan-eng-review`
- 디자인 검토 (특히 V0.3 시작 시) → `/plan-design-review`
- 버그/의문 → `/investigate`
- 사이트 테스트 → `/qa` 또는 `/qa-only`
- 변경 review → `/review`
- 시각 폴리싱 → `/design-review`
- 배포 / PR → `/ship`

## 환경 / 명령어

- 패키지 매니저: **bun** (`bun install`, `bun run dev`, `bun add`, etc.)
- Tailwind v4 (`@import "tailwindcss"` + `@theme` block in `src/index.css`)
- TypeScript strict
- Tests: `bun run test:run` (one-off), `bun run test` (watch)
- Build: `bun run build`
- Typecheck: `bun run typecheck`
- 마이그레이션: `supabase db push` (linked project로 적용) → `supabase gen types typescript --linked 2>/dev/null > src/lib/database.types.ts`. **stderr 분리 필수** — 안 그러면 CLI 업데이트 알림 줄이 types 파일에 섞여 들어가 typecheck 깨짐.

## 주의사항 / 알려진 footgun

- **iOS PWA + Google OAuth**: redirect URL 정확히 등록 필수 (Supabase URL Configuration + Google Cloud Console). PWA 스탠드얼론 모드 세션은 Safari와 분리됨 — PWA 안에서만 로그인 유지됨.
- **Anthropic API key**: 절대 클라이언트에 안 노출. `supabase secrets set ANTHROPIC_API_KEY=...` 로 Edge Functions 환경변수에만. SDK도 클라이언트 import 금지. claude.ai 구독과 별개 결제 (console.anthropic.com).
- **RLS**: 1인 사용자라도 RLS 켜기 (`auth.uid() = user_id`). anon key 노출 시 데이터 보호. Supabase 셋업: `Auto-expose new tables` **OFF** + `Auto RLS` **ON** — 마이그레이션마다 `grant select, insert, update, delete on <table> to authenticated;` 명시 필요.
- **Pretendard CDN**: `index.html`에서 로드. 본인 도메인에서 첫 로딩 ~50ms 추가. 빠른 로컬 fallback (`-apple-system`)이 base case.
