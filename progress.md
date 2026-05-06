# Progress

다음 세션이 빠르게 파악할 수 있도록 짧게 유지. 완료된 건 빠지고, 살아있는 컨텍스트만 남김.

## 현재 상태

**V0.0 완전 완료** (2026-05-06). 빈 React PWA가 Vercel 도메인에 떠있고, Google OAuth로 로그인 → "여기 시간이 흐릅니다." 화면까지 작동. iPhone PWA 홈 화면 설치 + 로그인 흐름도 통과.

- Repo: `git@github.com-goodsoo:goodsoo/work.git` (main에 1 commit, `2689bf3`)
- Local: `/Users/ham/Projects/goodsoob-work`
- Stack 작동 확인: Vite + React 19 + TS + Tailwind v4 + Supabase + TanStack Query + vite-plugin-pwa
- Supabase URL: `https://ycrcmjhybsakqbbkbszc.supabase.co` (프로젝트 ID `ycrcmjhybsakqbbkbszc`)
- Vercel 배포 + 환경변수 등록 + iPhone PWA 테스트 통과 (사용자 직접 확인)

## 다음 작업: V0.1 회의록 + AI 요약 + 마크다운 복사

V0.1 작업 단위 (1주 목표):
- [ ] `meetings` 테이블 마이그레이션 작성 + apply
  - 스키마: 디자인 doc 참조 — `id, user_id, title, date, attendees, content, summary, action_items jsonb, created_at, updated_at`
  - **`grant select, insert, update, delete on meetings to authenticated;`** 명시 필요 (Supabase 셋업에서 auto-expose OFF 했음)
  - **RLS는 `enable automatic RLS` ON이라 자동 활성화** — `policy meetings_owner using (auth.uid() = user_id) with check (auth.uid() = user_id)` 만 추가
  - 인덱스 `meetings_user_date_idx on meetings (user_id, date desc)`
- [ ] `api/meetings.ts` (CRUD wrappers) + `hooks/useMeetings.ts` / `useMeeting.ts` (TanStack queries)
- [ ] `hooks/useDebouncedMutation.ts` (1초 debounce 자동 저장 헬퍼)
- [ ] 회의록 CRUD UI: 목록 → 상세/편집 (`pages/MeetingsPage.tsx`, `components/meetings/MeetingForm.tsx`)
- [ ] State 명세 따라 구현: empty/loading/error/success (디자인 doc 표 참조)
- [ ] Edge Function `summarize` 작성 (Deno + `npm:@anthropic-ai/sdk`)
  - tool_use로 `{summary: string[3], action_items: string[]}` 구조화 강제
  - 환경 변수 `ANTHROPIC_API_KEY` Supabase Edge Functions secrets에 등록
- [ ] `components/meetings/SummarizeButton.tsx` (RED outlined, pending state)
- [ ] `lib/markdown.ts` `meetingToMarkdown(meeting)` + 클립보드 복사 (`components/meetings/CopyButton.tsx`)
- [ ] **테스트**: Vitest 셋업 검증 (이미 vite.config.ts에 통합됨) + `lib/markdown.test.ts` (3 unit: full / empty action_items / null summary) + `supabase/functions/summarize/smoke.ts` (deploy 전 manual)
- [ ] 본인 다음 회의에서 실사용 → 피드백

V0.1 ship 성공 기준 (디자인 doc): 회의록 작성 → AI 요약 → 마크다운 복사 → Notion/Obsidian 붙여넣기까지 1분 이내.

## 알아야 할 컨텍스트

- **Supabase 프로젝트 셋업 옵션**: `Enable Data API` ON, `Auto-expose new tables` **OFF** (defense in depth), `Auto RLS` **ON**. 이 결정이 V0.1 마이그레이션 SQL에 영향 — `grant ... to authenticated` 한 줄 매번 추가해야 함.
- **API key 형식**: 새 형식 `sb_publishable_...` 사용 중 (legacy `eyJ...` 아님). supabase-js v2가 둘 다 지원해서 OK.
- **마크다운 = 표준 CommonMark + GFM**, ❌ "Notion 호환" 표현 안 씀. 함수명 `meetingToMarkdown` (NotionMarkdown 아님).
- **Anthropic SDK는 클라이언트 import 금지** — Supabase Edge Function (Deno) 안에서 `npm:@anthropic-ai/sdk`로만 사용.
- **Server state는 TanStack Query 일관**. `useEffect + supabase.from()` 직접 호출 금지. 모든 fetch는 훅 패턴.
- **자동 저장 = debounce 1초 + TanStack mutation**. 명시적 "저장" 버튼 없음. V0.2 일기에도 같은 훅 재사용.
- **Design**: monotone zinc + RED-600 accent. RED은 의미 있는 1군데에만(오늘/primary CTA/활성 탭/pending Todo 체크박스 border).
- **iOS PWA OAuth footgun**: redirect URL 정확히. PWA 첫 로그인이 안 풀리면 Safari로 한 번 로그인 후 PWA 추가하면 풀림.

## 선택 미해결 / 나중에

- **Favicon 본인 브랜드로 교체**: `public/favicon.svg` 수정 후 `bun run icons` 재실행하면 PNG 자동 재생성. V0.1 중에 짬 날 때.
- **CLAUDE.md `## Testing` 섹션 추가**: V0.1에서 Vitest 실제로 처음 돌릴 때 명령어 + 패턴 명시. (지금은 README에만 있음)
- **TODOS.md 만들지 안 만들지**: V0.4+ 미래 기능들(음성 입력, 자연어 입력, 주간 AI 회고)을 별도 파일로 빼면 좋을지 V0.1 끝날 때쯤 결정.

## 살아있는 외부 자원 (다음 세션에서 참조)

- Design doc: `~/.gstack/projects/goodsoob-work/ham-no-git-design-20260506-161246.md` — eng + design review 결정 다 통합됨
- Test plan: `~/.gstack/projects/goodsoob-work/ham-no-git-eng-review-test-plan-20260506-170527.md` — `/qa`가 자동 사용
- 메모리: `~/.claude/projects/-Users-ham-Projects-goodsoob-work/memory/` — 권한 확인 최소화 feedback 저장됨
