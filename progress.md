# Progress

다음 세션이 빠르게 파악할 수 있도록 짧게 유지. 완료된 건 빠지고, 살아있는 컨텍스트만 남김.

## 현재 상태

**V0.1 코드 완료 (2026-05-06)** — meetings CRUD + 자동 저장 + AI 요약 + 마크다운 복사 전부 구현 + Edge Function 배포 + typecheck/lint/test 통과 + production build 통과. 단, 사용자 manual 단계 2개 남음 (아래 "남은 manual 단계").

### 이번 세션에서 ship된 것
- `supabase/migrations/20260506210000_create_meetings.sql` apply됨 (Supabase remote DB에 meetings 테이블 + RLS + index + updated_at trigger)
- `supabase gen types` 로 `src/lib/database.types.ts` 갱신
- `src/api/meetings.ts` (CRUD wrappers) — `Meeting` 타입은 `action_items: string[] | null` 로 캐스팅
- `src/hooks/useMeetings.ts` (TanStack: useMeetings, useMeeting, useCreate/Update/DeleteMeeting — optimistic cache 갱신)
- `src/hooks/useDebouncedSave.ts` (1초 debounce + saving/saved/error 상태 + flush + queue coalescing)
- `src/lib/markdown.ts` + `src/lib/markdown.test.ts` (Vitest 3개 통과)
- `src/components/meetings/`: `MeetingsList.tsx`, `MeetingForm.tsx`, `SummarizeButton.tsx`, `CopyButton.tsx`
- `src/pages/MeetingsPage.tsx` (기존 HomePage 대체. `App.tsx` 도 업데이트, HomePage.tsx 제거됨)
- 라우팅: 라이브러리 없이 `selectedId` state + `history.pushState` 로 브라우저 back 버튼 지원
- `supabase/functions/summarize/index.ts` 배포됨 (Anthropic Haiku 4.5 + tool_use 로 `{summary, action_items}` 강제)
- `supabase/functions/summarize/smoke.ts` (deploy 후 1회 manual 검증 스크립트)
- ESLint config: `supabase/functions/**` ignore 추가 (Deno 코드는 별 환경)

## 남은 manual 단계 (사용자가 해야 함)

### 1. ANTHROPIC_API_KEY 시크릿 등록 (필수, AI 요약 작동 위해)
```
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxx
```
또는 https://supabase.com/dashboard/project/ycrcmjhybsakqbbkbszc/settings/functions 에서 등록. 등록 후 Edge Function 재배포 불필요 (런타임 환경변수).

### 2. P1 검증 (실사용 1회)
- 다음 회의에서 본인이 직접: 작성 → AI 요약 → 마크다운 복사 → Notion 붙여넣기까지 1분 이내
- 안 되면 어디서 막히는지 메모해서 다음 세션에 가져오기

### 3. (선택) 사전 smoke test
키 등록 후, deploy 안정성 한번 확인하고 싶으면:
```
SUMMARIZE_URL=https://ycrcmjhybsakqbbkbszc.supabase.co/functions/v1/summarize \
SUPABASE_ANON_KEY=sb_publishable_uBf5D54I0MKAWyxczYxYIw_FEjuWeEf \
deno run --allow-env --allow-net supabase/functions/summarize/smoke.ts
```

## 알아야 할 컨텍스트

- **Supabase 셋업 옵션**: `Auto-expose new tables` **OFF**, `Auto RLS` **ON**. 마이그레이션마다 `grant select, insert, update, delete on <table> to authenticated;` 명시 필요. RLS는 자동 enable.
- **마크다운 = 표준 CommonMark + GFM**. `meetingToMarkdown()` 출력. `## 본문 / ## 요약 / ## 액션아이템` 섹션, `- [ ]` GFM checkbox.
- **Anthropic SDK는 클라이언트 import 금지**. Edge Function에서 `npm:@anthropic-ai/sdk@0.39.0`. Edge Function 모델은 `claude-haiku-4-5-20251001` (빠르고 저렴).
- **자동 저장 = `useDebouncedSave` (1초)**. textarea/input change 마다 `schedule(form)`. unmount + beforeunload 시 `flush`. 동일 훅을 V0.2 일기 본문에서도 재사용 예정.
- **새 회의록 생성 흐름**: "+ 새 회의록" 클릭 시 즉시 `createMeeting({date: today, content: ""})` POST → 받은 id로 폼 진입. 빈 회의록이 list에 즉시 보임 ("(제목 없음)"). 본인이 작성 시작하면 1초 후 자동 저장.
- **Design**: monotone zinc + RED-600. RED은 primary CTA / pending 체크박스 border / 활성 탭 / 오늘 marker / 에러 left-border 5군데에만.
- **iOS PWA OAuth footgun**: PWA 첫 로그인 안 풀리면 Safari로 한 번 로그인 후 PWA 설치하면 풀림.
- **권한 footgun**: settings.local.json `Bash(supabase functions *)` 패턴이 있어도 `supabase ... 2>&1 | tail` 같은 파이프 추가하면 매칭 깨져 다시 prompt 뜸. 명령어 단순하게 실행.

## 선택 미해결 / 나중에

- **Favicon 본인 브랜드로 교체**: `public/favicon.svg` 수정 후 `bun run icons` 재실행하면 PNG 자동 재생성.
- **CLAUDE.md `## Testing` 섹션 추가**: 명령어 (`bun run test:run`) + 패턴 명시. 지금은 README에만.
- **TODOS.md vs progress.md**: 미래 기능들(음성 입력, 자연어 입력, 주간 AI 회고)을 별도로 빼면 좋을지 V0.2 시작 시 결정.
- **회의록 본문 매우 김 (10K+자) 가드**: design doc edge case로 메모됨. V0.1.1 또는 V0.2에서 본인 실사용 후 결정.

## 살아있는 외부 자원

- Design doc: `~/.gstack/projects/goodsoob-work/ham-no-git-design-20260506-161246.md` — eng + design review 결정 통합
- Test plan: `~/.gstack/projects/goodsoob-work/ham-no-git-eng-review-test-plan-20260506-170527.md` — `/qa` 자동 사용
- 메모리: `~/.claude/projects/-Users-ham-Projects-goodsoob-work/memory/`
