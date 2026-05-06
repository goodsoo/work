# goodsoob-work — Claude Code 컨텍스트

본인 전용 시간축 통합 업무관리 PWA. 1인 본인 사용 사이드 프로젝트 (빌더 모드).

## 프로젝트 진실 source

- **기획안**: `goodsoob-work-plan.md`
- **Design doc** (eng/design review 결정 다 반영): `~/.gstack/projects/goodsoob-work/ham-no-git-design-20260506-161246.md`
- **Test plan**: `~/.gstack/projects/goodsoob-work/ham-no-git-eng-review-test-plan-20260506-170527.md`

해당 파일을 읽고 일하는 게 source of truth. 이 파일은 빠른 컨텍스트만.

## 로드맵 (현재 V0.0 완료)

- ✅ V0.0 — Vite + Supabase Auth + Hello world. PWA 셋업.
- V0.1 — 회의록 CRUD + AI 요약 + 마크다운 복사 (Edge Function `summarize`).
- V0.2 — 일기 + 주간 캘린더.
- V0.3 — Todo + 일정 + **통합 타임라인** (이 프로젝트의 진짜 design 도전).
- V0.4+ — 액션아이템 → Todo 1-click 이동.

## 핵심 결정 (review 통과됨)

- **Server state**: TanStack Query 일관 사용. 모든 fetch는 `useMeetings` 같은 훅 패턴.
- **Auto-save**: debounce 1초 + TanStack mutation. 회의록 / 일기 본문 둘 다.
- **Edge Function 에러**: try/catch + toast + retry button + Anthropic SDK `tool_use` 구조화 출력 강제.
- **테스트**: Vitest. V0.1은 `lib/markdown.test.ts` (3 unit) + Edge Function smoke 1개. UI 회귀는 본인이 매일 사용으로 발견.
- **Design**: Pretendard + zinc monotone + **red-600 accent** + rounded-lg. UI는 monotone, RED은 1군데에만 (오늘 marker / primary CTA / 활성 탭).
- **마크다운**: 표준 CommonMark + GFM checkbox. Notion / Obsidian / Bear / iA Writer 어디서나 호환. ❌ "Notion 호환"이라는 표현 쓰지 말 것 — 그냥 표준 마크다운.

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

## 주의사항 / 알려진 footgun

- **iOS PWA + Google OAuth**: redirect URL 정확히 등록 필수 (Supabase URL Configuration + Google Cloud Console). PWA 스탠드얼론 모드 세션은 Safari와 분리됨 — PWA 안에서만 로그인 유지됨.
- **Anthropic API key**: 절대 클라이언트에 안 노출. Supabase Edge Function 환경변수에만. SDK도 클라이언트 import 금지.
- **RLS**: 1인 사용자라도 RLS 켜기 (`auth.uid() = user_id`). anon key 노출 시 데이터 보호.
- **Pretendard CDN**: `index.html`에서 로드. 본인 도메인에서 첫 로딩 ~50ms 추가. 빠른 로컬 fallback (`-apple-system`)이 base case.
