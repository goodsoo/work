# goodsoob-work — Claude Code 컨텍스트

본인 전용 시간축 통합 업무관리 PWA. 1인 본인 사용 사이드 프로젝트 (빌더 모드).

## 프로젝트 진실 source

- **기획안**: `goodsoob-work-plan.md`
- **Design doc** (eng/design review 결정 다 반영): `~/.gstack/projects/goodsoob-work/ham-no-git-design-20260506-161246.md`
- **Test plan**: `~/.gstack/projects/goodsoob-work/ham-no-git-eng-review-test-plan-20260506-170527.md`

해당 파일을 읽고 일하는 게 source of truth. 이 파일은 빠른 컨텍스트만.

## 로드맵 (V0.5 코드 완료, 본인 실사용 검증 대기)

- ✅ V0.0 — Vite + Supabase Auth + Hello world. PWA 셋업.
- ✅ V0.1 — 회의록 CRUD + AI 요약 + 마크다운 복사.
- ✅ V0.2 — 일기 (journals 테이블).
- ✅ V0.3 — Todo + 일정 + 통합 타임라인 (CalendarPage = ±7일 윈도우 + 월간 그리드 토글).
- ✅ V0.4 — 액션아이템 → Todo 1-click (`todos.linked_meeting_id`).
- ✅ V0.5 — wishlist 4건: 요약 inline 편집 / 참석자 태그 자동완성 / 본문 마크다운 편집·미리보기 / 폼 전체 undo/redo
- 🟡 V0.6 후보 — GitHub 커밋 기반 포트폴리오 탭 (큰 기능, 다음 세션 plan-eng-review로).

## 핵심 결정 (review 통과됨)

- **Server state**: TanStack Query 일관 사용. 모든 fetch는 `useMeetings` 같은 훅 패턴. `src/api/{meetings,journals,todos,schedules}.ts` 가 supabase-js 캡슐화 + `src/hooks/use*.ts` 가 query/mutation 정의. `useUpdateMeeting` 은 optimistic update (인라인 편집 즉시 반영).
- **회의록 폼 상태**: `useStateHistory<MeetingDoc>` 단일 hook 이 제목/날짜/시간/참석자/본문/요약 3리스트 모두 관리. 1초 debounce 후 onCommit → `updateMutation`. undo/redo + Cmd/Ctrl+Z 키보드 + 폼 전체 적용.
- **일기/캘린더 자동 저장**: `useDebouncedSave` (queue coalescing) — 일기 본문 등 텍스트 단일 필드용. 회의록은 위 useStateHistory가 대체.
- **Edge Function 에러**: try/catch + toast + retry button + Anthropic SDK `tool_use` 구조화 출력 강제. 모델은 `claude-haiku-4-5-20251001`.
- **회의록 AI 출력 schema**: `{discussion_items, decisions, action_items}` 3분리 (V0.1.1). action_items 형식 `[담당자] 할 일 — 기한`. 결정 사항은 합의/확정된 것만.
- **테스트**: Vitest. `lib/markdown.test.ts` (5 unit) + `lib/dates.test.ts` (5 unit) + Edge Function smoke 1개. UI 회귀는 본인이 매일 사용으로 발견.
- **Design**: Pretendard + zinc monotone + **red-600 accent** + rounded-lg. RED은 1군데에만 (오늘 marker / primary CTA / 활성 탭 / pending todo 체크박스 / error left-border).
- **레이아웃**: AppShell 상단 sticky 헤더(`--app-header-h: 4.25rem`) + 페이지별 sticky `PageHeader` (top: var(--app-header-h)) + `<main>` paddingBottom: tab bar height + safe-bottom. 각 페이지 라우팅: URL hash 기반 (`#meetings` / `#calendar` / `#todos` / `#meeting-{id}`).
- **통합 타임라인** (CalendarPage): ±7일 윈도우, M/J/T/S 글리프 블록, 그리드 view 토글 (월간 5-6주). centerDate state로 그리드 cell 탭 시 타임라인 점프. 일기는 today 또는 기존 entry 있는 날만 placeholder 표시.
- **마크다운 출력 포맷** (본인 회의록 spec, 외부 복사용): `## {title or "회의록"}` → `일시: YYYY.MM.DD (요일) [시간]` + `참석:` → `### 논의 사항` / `### 결정 사항` / `### 액션 아이템` 3섹션. 빈 섹션 omit. `lib/markdown.ts` `meetingToMarkdown()` 가 단일 source. ❌ "Notion 호환" 표현 쓰지 말 것.
- **본문 마크다운 미리보기** (편집 중 시각화): `react-markdown` + `remark-gfm`. `MarkdownView.tsx` 가 zinc/serif 톤 컴포넌트로 element 별 override.

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
