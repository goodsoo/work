# Progress

다음 세션이 빠르게 파악할 수 있도록 짧게 유지. 완료된 건 빠지고, 살아있는 컨텍스트만 남김.

## 현재 상태

**V0.2 ~ V0.5 코드 일괄 ship (2026-05-06 밤 ~ 2026-05-07 새벽)** — 1인 빌더 모드. 일기 + 통합 타임라인 + Todo + 일정 + 액션아이템→Todo + wishlist 5건 (요약 inline 편집 / 참석자 태그 / 마크다운 편집·분할·미리보기 / 월간 달력뷰 / sticky 페이지 헤더) + 회의록 폼 전체 undo/redo. typecheck / lint / vitest 10개 / production build 전부 green.

### 이번 세션에서 ship된 것

#### V0.2 + V0.3 + V0.4 (기본 기능)
- 하단 탭바 라우팅: `회의록 / 캘린더 / 할 일` (`src/components/nav/AppShell.tsx` + `BottomTabs.tsx`). URL hash 기반 deep-link 지원 (`#meeting-{id}`, `#calendar`, `#todos`).
- 마이그레이션 3개 (Supabase remote에 apply 완료):
  - `20260506230000_create_journals.sql` — `(user_id, date)` unique 제약 (1인 1날짜 1로우)
  - `20260506230100_create_todos.sql` — priority text+check, due_date, done_at, **linked_meeting_id (V0.4용)**
  - `20260506230200_create_schedules.sql` — start_time / end_time / linked_todo_id
- `src/lib/database.types.ts` 갱신
- API + TanStack hooks: `journals.ts` + `useJournals.ts` (upsert by date), `todos.ts` + `useTodos.ts` (optimistic toggle), `schedules.ts` + `useSchedules.ts`
- `src/lib/dates.ts` + `dates.test.ts` (5 unit) — todayIso, addDaysIso, isoDateRange, formatDateLong, relativeDateLabel, isToday, isPast
- TodosPage: 인라인 추가/편집/삭제, priority + due_date 칩 셀렉트, "완료 N개" 접기, 빈 상태 톤 (Pretendard Serif)
- 통합 타임라인 (CalendarPage): ±7일 윈도우, M/J/T/S 글리프, 오늘 RED dot, schedule 추가/삭제 (`AddScheduleForm`), 일기 자동 저장 (`useDebouncedSave` 재사용), todo toggle + meeting 탭으로 이동
- V0.4 액션아이템 → Todo 1-click: 회의록 요약 패널의 액션아이템마다 "할 일로" 버튼 + `linked_meeting_id` 연결. 추가된 항목은 인덱스 trace로 "추가됨" 배지

#### 사용자 wishlist (V0.5)
- **요약 inline 편집** (`EditableList.tsx`): discussion_items / decisions / action_items 클릭→인라인 textarea, Enter/blur commit, ESC 취소. 항목 추가/삭제. AI 요약 안 한 회의도 직접 입력 가능. `useUpdateMeeting` optimistic update 추가 (수정 즉시 반영)
- **참석자 태그 입력** (`AttendeeTagInput.tsx`): 기존 회의록의 attendees 필드에서 distinct 추출 + 자동완성 dropdown (prefix > substring 정렬) + chip 표시 + Backspace 마지막 chip 제거 + ↑↓ 키보드 네비. 스키마는 그대로 (콤마 구분 text), 파싱은 `lib/attendees.ts`
- **마크다운 본문** (`MarkdownView.tsx`): 본문 textarea 위에 `편집 / 분할 / 미리보기` 3-way 토글. 분할 모드는 데스크톱(md+)에서 좌우, 모바일에서 위아래 stack. react-markdown + remark-gfm (GFM checkbox / table / strikethrough). 편집 시 textarea는 mono font
- **월간 달력뷰** (`MonthGrid.tsx`): CalendarPage에 `타임라인 / 달력` view 토글. 5-6주 그리드, 일~토 헤더, 날짜 cell에 M/J/T/S 카운트 글리프 표시, 일요일 RED. 셀 탭 → 타임라인 view + 그날을 centerDate로 (타임라인 윈도우 ±7일이 그 날 중심으로 이동)
- **Sticky 페이지 헤더** (`PageHeader.tsx`): 모든 페이지 (회의록 / 캘린더 / 할 일 / 회의록 상세) 상단의 타이틀 + 액션 버튼이 AppShell 헤더 바로 아래에 sticky pin. CSS var `--app-header-h: 4.25rem`으로 오프셋 관리
- **폼 전체 undo/redo** (`useStateHistory<MeetingDoc>` + 회의록 상세): 제목 / 날짜 / 시간 / 참석자 / 본문 / 논의·결정·액션 3리스트 = 한 doc snapshot. 1초 debounce 후 onCommit → updateMutation. PageHeader sticky 우상단에 ↶↷ 버튼 + Cmd/Ctrl+Z 키보드 (폼 어느 필드든). 기존 `useTextHistory` + `useDebouncedSave` + `overrideSummary` 4개 → 1개 hook으로 통합

### 남은 manual 단계 (사용자가 해야 함)

#### 1. (필요시) 인증 세션 리프레시
- 새로 추가된 `journals / todos / schedules` 테이블에 RLS + grants 적용 완료. anon key는 그대로. 기존 로그인 그대로 작동해야 함
- 만약 처음 열었을 때 데이터가 안 보이면 한번 로그아웃 후 재로그인

#### 2. P1 검증 (1인 본인 실사용)
- **회의록**: 다음 회의에서 — 작성 → 참석자 태그 자동완성 → AI 요약 → 요약 inline 편집 → 액션아이템 "할 일로" 1-click → 마크다운 분할 미리보기 → Notion 복사. **undo/redo 시도** (Cmd+Z, 버튼)
- **할 일**: TodosPage에 5개 추가 → priority/due 변경 → 완료 토글 → "완료 N" 접기
- **일정**: CalendarPage 우상단 "일정 추가" → 오늘 일정 1개 등록
- **일기**: CalendarPage 오늘 섹션의 "오늘 어땠어요?" 박스에 짧게 입력 → 1초 후 "저장됨" 확인
- **달력 뷰**: CalendarPage 우상단 "달력" 토글 → 그리드 cell 탭 → 타임라인 그 날로 jump 확인
- **Sticky 헤더**: 각 페이지에서 스크롤 시 상단 타이틀 + 액션 버튼이 고정되는지 확인 (특히 모바일 PWA)

P1에서 막히는 부분 메모해서 다음 세션에 가져오기.

#### 3. (선택) 배포
- 코드만 ship, 배포는 안 함. 평소처럼 git push → Vercel 자동 또는 수동 배포

## 알아야 할 컨텍스트

- **회의록 폼 = 단일 doc**: `useStateHistory<MeetingDoc>` 가 form (제목/날짜/시간/참석자/본문) + summary (논의/결정/액션) 통째로 관리. UI는 `history.value` 만 읽고, 변경은 `updateField(key, value)` 로. `setForm`/`overrideSummary` 같은 부수 state 전부 제거됨
- **자동 저장 동작**: history.set → 1초 debounce → onCommit → `updateMutation.mutate(docToPatch(doc))`. undo/redo 는 즉시 commit (debounce 우회). beforeunload + unmount 시 `history.flush()`로 pending 강제 commit
- **저장 인디케이터**: PageHeader 우상단. `updateMutation.isPending` → "저장 중", `isError` → "저장 실패 · 재시도", `history.canUndo && !pending` → "대기 중", 그 외 hidden
- **마크다운 본문**: 편집/분할/미리보기 3-way. 분할은 양쪽이 `history.value.content` 동일 source. 외부 복사용 마크다운(`meetingToMarkdown()`)은 별개 (Notion 호환 포맷)
- **참석자**: DB 컬럼은 `attendees text` 그대로 (콤마 구분). UI만 chip + 자동완성. 다음 회의록에서 같은 사람 재입력하면 dropdown에 뜸
- **action_items → Todo 추적**: 인덱스 기반 "추가됨" 배지는 component 메모리에만 (재로드 시 사라짐). 정확한 추적은 `todos.linked_meeting_id`로 가능 (필요 시 V0.6)
- **CalendarPage centerDate**: 달력 cell 탭 시 timeline window가 그 날 중심으로 이동. "오늘로" 버튼으로 today로 복귀
- **Sticky 레이아웃**: `--app-header-h: 4.25rem` (index.css). PageHeader는 이 var로 top offset. iOS PWA 노치 처리는 `--safe-top` (현재 AppShell 헤더 외부 padding) — 노치 디바이스에서 스크롤 시 sticky 헤더가 노치로 들어갈 수 있음 (V0.6에서 폴리싱 후보)
- **테이블별 RLS 정책 이름**: `meetings_owner / journals_owner / todos_owner / schedules_owner`. 모두 `auth.uid() = user_id` using/check
- **권한 footgun**: `supabase ... 2>&1 | tail` 같은 파이프 추가 시 settings.local.json 매칭 깨짐. 단순 명령어 그대로 사용
- **supabase gen types stderr**: `supabase gen types typescript --linked` 출력 끝에 "A new version of CLI..." 줄이 섞일 때 있음. 항상 `2>/dev/null > types.ts` 로 stderr 분리

## 선택 미해결 / 다음 세션

### V0.6 후보: GitHub 커밋 기반 포트폴리오 탭 (사용자 wishlist #5)
- 큰 기능. 자율 작업 부적합 (manual 셋업 필요)
- 필요한 것:
  - GitHub OAuth 또는 PAT 등록 (사용자가 https://github.com/settings/tokens 또는 GitHub OAuth App 등록)
  - Supabase에 `github_token` 시크릿 + `github_repos` 테이블 (사용자가 추적할 repo 목록)
  - 새 Edge Function `summarize_commits` (Anthropic Haiku로 commit message 묶음 요약)
  - 새 탭: `포트폴리오` 또는 `리포트`. repo selector + 기간 selector + AI 생성 보고서 markdown
- 추천 시작: `/plan-eng-review` 또는 `/office-hours`로 scope 정리부터
- 그 외 polish 후보:
  - **Favicon 본인 브랜드로 교체**: `public/favicon.svg` + `bun run icons`
  - **회의록 본문 매우 김 (10K+자) 가드**: 마크다운 미리보기 성능 검증 후 결정
  - **action item → Todo 추적 정확화**: `linked_meeting_id`로 todos 쿼리해서 매칭 (정확한 "추가됨" 표시)
  - **Todo undo/redo**: 사용자 wishlist에 있었으나 데이터 모델 + 행 단위 액션이라 별도 설계 필요 (예: 명령 패턴 stack with todos.linked_meeting_id 보존). 실사용 후 정말 필요한지 검증 권장
  - **dev server에서 UI dogfood**: Claude Code 자율 모드는 헤드리스 검증만 가능. 본인이 `bun run dev` 후 한 바퀴 돌리는 게 진짜 검증
  - **tests**: useStateHistory undo/redo 시퀀스, 통합 타임라인 grouping 로직, MonthGrid 셀 카운트 로직, AttendeeTagInput 키보드 인터랙션 — 회귀 좋은 포인트. 매일 사용 검증으로 충분하면 skip

## 살아있는 외부 자원

- 기획안: `goodsoob-work-plan.md`
- Design doc: `~/.gstack/projects/goodsoob-work/ham-no-git-design-20260506-161246.md` — eng + design review 결정 통합
- Test plan: `~/.gstack/projects/goodsoob-work/ham-no-git-eng-review-test-plan-20260506-170527.md`
- 메모리: `~/.claude/projects/-Users-ham-Projects-goodsoob-work/memory/`
