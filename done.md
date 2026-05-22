# done

[todo.md](todo.md) 에서 완료된 항목 아카이브. 날짜 역순.

---

## 2026-05-22

### PR #31 — 메모장/일기 단축키 단순화 (Q/W/E 제거 + Opt+Tab cycle)

- **한 줄 임팩트**: 한글 IME 와 안 싸우는 메모장 sub-tab 단축키
- **Q/W/E single-key + Opt+Q/W/E 두 블록 제거** (`MeetingForm.tsx`) — 통증: textarea 안에서 "ㅂ/ㅈ/ㄷ" (Q/W/E 자리) 타이핑이 단축키 분기와 헷갈렸음 + macOS Opt dead-key (œ/∑/´) preventDefault 도 같이 사라짐. e.code 매칭으로 IME 무관이긴 했지만 "메모 안에선 안 막힘 / 밖에선 발사" 라는 분기 자체가 인지 부하.
- **Opt+Tab / Opt+Shift+Tab = sub-tab cycle** (본문→음성기록→요약→본문, Shift 역순). textarea/input focus 무관. `SourceBodyEditor.tsx` 의 Tab handler 에 `!e.altKey` 가드 추가 — 일반 Tab=indent 보존하면서 Opt+Tab 만 window-level cycle 로 양보. 평소 indent 동작 깨짐 0.
- **Cmd+Shift+E = 본문 탭 편집/보기 토글** — `SourceBodyEditor` 의 Cmd+E (inline-code wrap, `` `text` ``) 와 충돌 회피로 Shift 동반. 다른 탭에선 no-op.
- **일기 (JournalOverlay) 도 Cmd+Shift+E 로 통일** — 기존 Cmd+E 였는데 메모장과 같은 키로 묶음. Eye/Pencil 토글 버튼 툴팁도 `⌘⇧E`.
- **설정 → 단축키 탭 갱신** — sub-tab 그룹 (Opt+Tab cycle + Cmd+Shift+E) + "일기 (캘린더)" 그룹 신설 + 본문 편집 그룹에 `⌘Enter → 할 일 inbox` 누락분 보강.
- **TabBtn `Q/W/E` kbd chip + ModeChip 툴팁 + EmptyBodyCTA `Q` kbd** 모두 `⌘⇧E` 표기 또는 제거.
- 5 modified (CLAUDE.md + 4 src). 221 tests passing. typecheck clean.
- commit `efa3554`

### PR #30 — 본문 word-wrap + gutter dynamic alignment

- **한 줄 임팩트**: 한국어 메모 자연 줄넘김 + gutter 정확 정렬
- **textarea `wrap="off"` → `"soft"`** — 긴 한국어 줄이 가로 스크롤로 빠져나가 잘리던 문제. 매일 통증이었던 부분. 그냥 wrap 만 켜면 source line 별 1:1 gutter marker 가 wrap 된 visual line 과 어긋남 — marker 는 마크다운 학습 보조 핵심이라 깨지면 안 됨.
- **hidden mirror `<div>` per-line 측정** — textarea 와 동일 width/font/line-height/padding/`white-space: pre-wrap` 으로 source line 별 actual visual height 측정. `lineHeights` state 가 mirror children 의 `offsetHeight` 배열. measure 는 변경 없을 때 setState skip (render loop 차단). `useLayoutEffect` 동기 측정 (draft 바뀔 때) + `ResizeObserver` + rAF debounce (사이드패널 collapse / 창 리사이즈) 둘 다.
- **GutterMarker per-line height + glyph 첫 visual line 고정** — 마커 컨테이너 높이 = 그 source line 의 wrap 된 총 높이. glyph (H1, bullet, quote, ...) 자체는 첫 visual line (`LINE_HEIGHT`) 안에 정렬 (`alignItems: flex-start`). wrap 으로 3줄 차지하는 bullet 항목도 marker 는 첫 줄 옆에 한 번만.
- **슬래시 popover anchorTop 보정** — `cumulativeHeight(lineHeights, slashLine + 1)` 으로 wrap 누적 위치 계산. 측정 전엔 `LINE_HEIGHT_PX` (26px) fallback — 깜빡거림 회피.
- **단일 파일 (SourceBodyEditor.tsx) 약 100줄 변경**. 221 tests passing.
- commit `4489ec6`

### PR #29 — chrome user-select 차단

- **한 줄 임팩트**: chrome 영역 (사이드바 / 탭 / 캘린더 셀) 실수 드래그 selection 차단
- **wrapper 단 `select-none` + content `select-text` override 패턴** — `body` 에 `user-select: none` 박고, `input` / `textarea` / `.markdown-view` 만 `user-select: text` 로 override. CSS 19줄로 끝 — chrome/content 경계가 명확해서 컴포넌트별로 박을 필요 없음.
- **chrome 영역 (selection 차단)**: 사이드바 메모 리스트, 상단 탭 row (메모/캘린더/할 일/내 작업), 메모장 sub-tab (메모/음성 기록/요약), 캘린더 셀 (날짜 / 요일 row / 월 라벨), 헤더 버튼, todo / portfolio 카드 wrapper.
- **content 영역 (그대로 selectable)**: 메모 본문 (편집 textarea + 보기 `MarkdownView`), 메모 제목 input, transcript textarea, todo 제목 input, portfolio impact_summary input, 요약 callout 안 텍스트 (form input 들이 자연 selectable + `.markdown-view` 클래스만 추가 override).
- **이미 박혀있는 `select-none` 컴포넌트는 그대로** — `TimelineBlock` 의 letter (M/J/T/S), `SourceBodyEditor` 의 line gutter 등은 자체 명시 selector 라 root 규칙과 무관.
- 221 tests passing. typecheck clean.
- commit `e681d31`

### PR #28 — 캘린더 page 정비 (일기 진입 + month 스크롤 복원)

- **한 줄 임팩트**: 캘린더에서 일기 빠른 진입 + 스크롤 위치도 페이지 전환 후 복원
- **일기 빠른 진입 동선** — 캘린더 사이드 패널 헤더 바로 아래 별도 section. 일기 없는 날 = dashed border + Plus + "일기 쓰기" CTA, 있는 날 = `BookOpen` + 본문 첫 100자 미리보기 카드 + hover 시 펜 아이콘. 클릭 → 오버레이. items list 의 일기 줄은 제거 (헤더 section 으로 승격). 빈 상태 카피 "이날의 일정 / 할 일이 없어요" (일기는 위 section 이라 별도).
- **JournalOverlay (신규)** — 설정창 spec (`max-w-3xl` + `min(560px, 80vh)`) 오버레이. edit/view 토글 (`useViewMode` 와 의도적 분리 — persist X, 닫으면 edit 으로 reset, "방금 쓴 거 이어 쓰기" 자연). 단축키: `ESC` 닫기 / `⌘Enter` 저장&닫기 / `⌘E` 모드 토글 (content 비어있으면 무효, `e.code === "KeyE"` 매칭 — 한글 IME 무관). `useDebouncedSave` (1초 debounce). 빈 본문 1초 후 자동 `deleteJournal` (사용자 명시 "내용 전부 지우면 되니까"). 모듈 `DRAFT_CACHE` 로 저장 실패 케이스 보존. backdrop drag-out 가드 (`onMouseDown` + `e.target===e.currentTarget`).
- **MonthGrid 일기 아이콘 통일** — 셀 우상단 텍스트 `✎` → `BookOpen` 아이콘 (사이드바 카드와 동일 시각 언어). 셀 `relative` + 아이콘 `absolute right-1 top-1 pointer-events-none`.
- **month 스크롤 복원** — `CalendarPage` 모듈 `calendarStateCache` 도입. anchorIso (오늘 주 일요일 ISO) 가 캐시와 동일할 때만 valid — 자정 넘기면 자동 폐기 (그 땐 오늘 기준 재배치가 자연). `scrollTop` / `centerWeekOffset` / `visibleWeekOffset` / `selectedDate` / `lastTarget` 5개 전부 복원. `latestStateRef` + `scrollTopRef` 로 unmount cleanup 시점 stale closure 차단. `initialScrollTopRef` 첫 layout effect 한 번 소비. `targetDate` round-trip race 차단 — `lastTarget` 도 cache 에 박아 같은 값 재진입 시 스크롤 재설정 안 되게.
- **Modal backdrop drag-out fix (5개)** — `ConfirmDialog` / `TrashModal` / `SettingsModal` / `TaskAddModal` / `ScreenshotLightbox` 의 backdrop `onClick={close}` → `onMouseDown` + `e.target===e.currentTarget` 가드로 일괄 통일. 본문 textarea/img 안에서 시작한 drag 가 backdrop 에서 mouseup 되어 모달이 닫히던 패턴 차단. `JournalOverlay` 만들면서 발견하고 같은 패턴 6번째 반복인 거 확인 — 별도 PR 로 `<Modal>` 추출 후보 (todo.md 추가).
- **후속 PR 후보 todo.md 등록** — `<Modal>` / `<Overlay>` 공통 컴포넌트 추출 (6개 모달 같은 boilerplate), `SourceBodyEditor` 를 prop 로 일반화해서 일기 / todo description 등에도 재사용.
- 9 modified + 1 new (`JournalOverlay.tsx`). 221 tests passing.
- commit `72a3149`

### PR #27 — 할일 페이지 UI/UX 개편 + 휴지통

- **한 줄 임팩트**: 매일 쓰는 할일 페이지, 큰 정리
- **카드 형태 + read-only/edit toggle** — 메모장 본문 토글 spirit. 카드 클릭 → edit, 외부 클릭/Enter/확인 → commit, ESC → cancel. 편집 중 draft 만 변경 → 정렬 안 흔들리고 한 번에 mutation. `TodoRow` 의 `updateDraft`(ref + setState 동기) 로 외부 클릭 시 LooseDate/Time blur 강제 → microtask 후 commit (typing 값 누락 race fix).
- **메모↔할일 backlink** — `#from-<uid>` inline tag. `lineToTaskPrefill(line, meetingId)` 이 메모 → 할일 ⌘⏎ 시점에 박음. uid 영구라 메모 rename 후에도 안 깨짐. 보기 모드 chip 클릭 시 confirm popover (메모 meta 미리보기 + 메모로 이동 / 취소). 사라진 메모 = "(연결 끊김)" + "연결 해제" outline-red button. md 의 `#from-` tag 자동 정리 X (사용자 결정 우선).
- **cancelled `[-]` / deleted `[D]`** — 옵시디안 Tasks plugin convention. `setTodoCheckChar` generic + buildTodoLine 우선순위 (deleted > cancelled > done > pending). cancelled = 사이드바 하단 entry 별도. deleted = 휴지통 modal 격리 (사이드바 entry X). 휴지통: 복원 / 영구 삭제 + 비우기 + ConfirmDialog. 메모장 TrashModal 동일 UX.
- **undo/redo header + 카드 flash** — `useTodoUndo` hook (module-level stack, listener 패턴, cross-page 유지). 사이드패널 → 메인 panel 헤더 (3.5rem grid: 좌 undo·redo / 중앙 "할 일" / 우 여백) 메모장 패턴 통일. flash = class 기반 `.todo-card-flash` (enter animation 재실행 차단).
- **두 차원 필터 + 정렬** — 상태 (전체/미완료/완료) + 카테고리 (전체/미분류/업무/일정/기타) 독립 AND. cancelled/deleted 격리. 정렬 (최신/오래된/이름) — `useTodoSort` + sidebar `SortMenu`. due_date+due_time, **null first** (기한 미적용 todo 최상단 = 보채기). 체크 토글 시 정렬 영향 X (`_source.line` 기반 미사용, due_date 기반).
- **D+N / 오늘 / 내일 / D-N due chip** — 제목 앞 chip. overdue 빨강 `accent-red-bg`, 오늘 파랑 `accent-blue-bg`, 임박 (1-3일) outline (회색 fill "끝난" 느낌 회피). 4일+ 미래는 chip 없음.
- **TaskAddModal 통합** — 사이드패널 `+` button → modal (캘린더 + 와 같은 모달). 카테고리 tag-chip (rounded-full pill). `category: "schedule"` prefill (캘린더에서 만든 todo 가 자동 "일정" 그룹).
- **CategoryPicker / MeetingPicker / SourceMeetingLink** — `# {label}` Hash icon, `📄 {title}` FileText icon. 검색 popover 패턴 일관 (외부 클릭/ESC 닫기, 최신순 + 날짜 표시).
- **글자수 제한 + word-wrap** — title input `maxLength=200`, 보기 모드 `break-words` 로 긴 todo 줄바꿈 자연.
- **vault parser/writer** — `CHECKBOX_RE` `[ x-D]` 인식, `TodoItem.cancelled/deleted` 필드, buildTodoLine 의 `#from-<uid>` tag (extra_tags 분리 + reconstruct 시 보존).
- 31 modified, 8 new, 1 deleted. 168 tests passing.
- commit `ab0f4e3`

### PR #26 — 에러 토스트 디자인 갈아엎기 + overflow fix

- **frosted glass 갈아엎기** — 디자인 시안 8개 띄워서 5번 (iOS frosted) 선택. `--surface-frost` / `--surface-frost-border` / `--surface-frost-shadow` 3개 토큰 (light/dark 둘 다) 으로 일반화. backdrop-blur-xl + rounded-2xl + 큰 그림자. 좌측 빨간 4px stripe (AI slop 톤) 제거.
- **3-row 레이아웃** — 상단 (Ban 아이콘 + 타이틀/"ERROR" + ✕), 중간 (본문, `wrap-anywhere break-all`), 하단 (액션 footer). overflow 의 구조적 원인 (한 줄 안에서 본문이 액션 버튼 밀어내던 패턴) 해결.
- **버튼 위계** — solid 빨간 [재시도] (primary) + ghost icon [복사] (secondary). 본인 dogfood 시 errno/path 만나면 Claude 에 paste 가 next-step → 복사 항상 보임. 1.5초 ✓ swap 으로 피드백.
- **아이콘 Ban (접근금지)** — AlertCircle (`(!)`) 보다 "차단/실패" 의미 더 분명.
- **wrap-anywhere + break-all** — `goodsoob-` 다음 줄 깨짐 패턴 차단. 긴 path/URL 이 width 끝까지 채워서 답답한 빈공간 제거. 한글은 자연스러운 음절 break.
- commit `eef08b1`

---

## 2026-05-21

### PR #25 — 빈 본문 편집 진입 CTA + 메모 모드 chip

- **빈 메모 + 보기 모드 CTA 박스** — 본문 비어있고 viewMode=`view` 일 때 점선 박스 (60vh) 렌더 — 클릭하면 viewMode `edit` 전환 + 다음 frame 에 textarea focus. 자동 전환은 사용자가 명시적으로 view 로 둔 의도를 덮을 수 있어 회피.
- **MarkdownView 의 빈 상태 fallback 제거** — "메모가 비어있어요. 편집으로 전환해서 적어보세요." 단순 텍스트 fallback 은 MeetingForm 분기가 가로채서 dead code. TrashPreview 는 이미 `content?.trim()` 분기라 영향 없음.
- **ModeChip 도입** — 사용자 요청. 헤더 우측 토글 버튼은 아이콘이 "다음 액션" 을 가리켜 직관적이지 않음 → 서브 헤더 글자수 옆에 현재 상태 chip (편집=accent-blue / 보기=회색). 클릭 토글 + Q 키 그대로.
- **헤더 우측 Eye/Pencil 토글 버튼 제거** — ModeChip 이 대체. 복사 + 삭제 두 개만 남김.
- commit `1384a64`

### PR #24 — portfolio sync 강화 + 날짜 min + lint 정리 (backend 묶음)

- **gh enrich concurrency 5 병렬** — `processWithConcurrency` worker pool 도입. enrich + 이미지 다운로드를 같은 worker 안에서 5 동시 처리, vault write 는 직렬 (충돌 회피). 100 PR 기준 wall clock 3분 → 30초 예상.
- **PR body 이미지 자동 import** — sync 가 PR body 의 markdown `![](url)` + GitHub drag&drop `<img src>` 추출 → Tauri shell+curl 위임으로 vault `_attachments/{slug}/{before|after}-N.{ext}` 다운로드 → `screenshots` frontmatter 자동 채움. `## Before` / `## After` 헤더 또는 alt text 로 라벨 추론. existing.screenshots 가 비어있을 때만 import (본인 dropzone 박은 거 보존). path 가 vault 에 이미 있으면 redundant 다운로드 skip. 실패해도 best-effort (다음 sync 가 재시도).
- **날짜 input 2026-01-01 min** — `src/lib/dates.ts` 에 `MIN_DATE_ISO` + `isBeforeMinDate()` export. `composeIso` 가 2026 미만 ISO 를 null 반환 (parseLooseDate 의 모든 분기 통합 차단). 앱 전체 `<input type="date">` 에 `min` 속성 + onChange silent reject. LooseDateInput 은 parseLooseDate 통해 자동 적용.
- **lint 34 errors + 3 warnings → 0** — `_err`/`_url`/`PR_CATEGORIES` 미사용 제거, `no-useless-escape` 8건, `\x00-\x1f` 정상화 (binary control char regex → escape form), 의도된 패턴은 inline disable (useStateHistory race-fix refs, react-refresh, set-state-in-effect 외부 value sync).
- **Vercel disconnect 는 drop** — 모바일 PWA 다시 살릴 가능성 보고 안전망 유지.
- commit `1609ca4`

### PR #23 — 테마 전환 radial wipe

- **View Transitions API 폐기 + 직접 구현** — macOS Ventura WKWebView (Safari 16) 가 미지원이라 fallback 으로 즉시 toggle 됐었음. fixed overlay + clip-path circle 로 직접 구현.
- **overlay 색 hardcode (`#ffffff` / `#1a1a1a`)** — `--bg-base` light/dark 값을 JS 상수로. CSS variable 평가하면 overlay 가 새 테마 cascade 못 받아 잘못된 색.
- **wipe 끝 처리** — `transitionend` → `flushSync(setThemeState)` 동기 commit 강제 + 250ms 더 overlay 유지. rAF 한 번만으론 큰 DOM paint 가 한 프레임 넘겨 "overlay 사라진 뒤 컴포넌트 늦게 따라옴" 보였음.
- **반지름 = 4 모서리 중 가장 먼 거리** — 어디서 눌러도 화면 끝까지 wipe.
- **`prefers-reduced-motion` / origin 없는 호출 → 즉시 toggle fallback**.
- **350ms ease-out + 250ms post-hold** — 처음 800ms 였는데 끝나고 멈춘 느낌이라 단축. post-hold 덕에 컨텐츠 paint 변화 안 보임.
- commit `638008a` (merge `2acccb7`)

### PR #22 — 보기 모드 마크다운 옵시디안 수준 정비 + 편집기 nest 정합

- **체크박스 (`- [ ]`) 렌더링 + 클릭 토글** — task-list-item 안 default `<input>` 트리 walk 로 찾아 null + 직후 공백 1칸 strip (remark-gfm loose-list `<p>` 한 번 더 감싸는 케이스 대응). 토글은 mdast `checked` 가 아니라 source 의 `[ ]`/`[x]` 위치 (li `position.start.offset`) 기준 직접 수정 — React Query optimistic update 와 자연스럽게 합쳐짐.
- **4-space indented code block** — `code` 의 inline vs block 구분에 className 만 보면 language class 없는 indented case 누락. `<pre>` ancestry 를 React Context 로 추적해 inline/block 정확히 분기.
- **h4~h6 시각 위계** — 본문 글자와 구별 안 되던 거 단계별 정리.
- **ordered list nest** — Tab 으로 들여쓰기 시 leading 숫자를 무조건 "1" 로 rewrite (CommonMark: 1 이외 숫자 ordered list 는 paragraph interrupt 못 함 → source `2.` 면 nest 실패). 시각 번호는 CommonMark 가 position 으로 다시 매김.
- **gutter ↔ parse 일치** — 비-1 ordered marker 가 들여쓰여 있어도 직전 sibling 없으면 ContinuationGlyph (점선 vertical) 로 표시.
- **`<br>` null 처리** — `<p>` 의 `whitespace-pre-wrap` 가 `\n` 시각 줄바꿈 처리하는데 hard break (`  \n`) 가 `<br>` + `\n` 둘 다 박혀 줄 두 번 끊김 → `<br>` 자체 null. Soft/hard 둘 다 한 줄.
- **이미지 (`![](path)`)** — vault 안 로컬 경로 / URL 둘 다 정상 렌더.
- **편집 단축키 도움말 정리** — ⌘B/I/E, ⌘⇧D, Alt+↑↓ 설정 → 단축키 cheatsheet 에 한꺼번에.
- commit `79e1bb7` (merge)

### PR #21 — 메모/할일 데이터 도메인 정리 + 메모→할일 ⌘⏎

- **두 도메인으로 환원** — Note (`meetings/` + `journals/`, 폴더로 분리한 같은 schema md 파일) / Task (`inbox.md` 안 `- [ ]` 라인, 일정/할일 통합). 사용자 mental model 의 메모/일기/일정/할일 4 개념을 2 entity 로.
- **journals schema meetings 와 통일** — frontmatter `id: <uuid>` lazy migration 추가 (`scanJournals` / `upsertJournal`). 옛 일기 첫 read 시 uuid 발급 + rewrite.
- **Task scan 범위 축소** — `scanAllTodos` 가 vault 전체 → `inbox.md` only. 메모/일기 안 `- [ ]` 는 단순 체크박스 (의도 보존). 회의록 의안 체크리스트, 타인 할일, 옵션 list 가 todo 페이지에 false positive 로 침범하던 통증 해소.
- **Schedule entity 폐기** — `_is_event` / `Schedule` 타입 / `schedules.ts` / `useSchedules` / `ScheduleBlock.tsx` 제거. 캘린더 / SidePanel / MonthGrid 가 `Task` 직접 사용. **캘린더 셀에 같은 task 가 schedule 줄 + todo 줄 두 번 등장하던 중복 push 버그** (`CalendarPage.tsx:107-125`) 자동 해소.
- **`TaskAddModal` 통합** — `ScheduleAddModal` → `components/tasks/TaskAddModal.tsx` 신설. 필드: 제목 / 날짜 (optional) / 시간 (optional) / 카테고리 / 우선순위 / 완료됨 토글. `prefill?: Partial<TodoInsert>` props. 호출처 통일 (할일 페이지, 캘린더 셀 클릭, 사이드 패널 `+` 모두 같은 모달).
- **메모 → 할일 ⌘⏎ 액션** — 메모 본문 cursor 가 `- [ ]` 라인 위 → 단축키 `⌘⏎`. `SourceBodyEditor` 가 `onSendLineToInbox` prop 호출, MeetingForm 의 `lineToTaskPrefill` 이 `extractTodos` parser 재사용해서 라인 분석 → TaskAddModal prefill (체크 상태 / 날짜 / 시간 / 카테고리 / 우선순위 모두 자동). **메모 라인은 그대로 (일방향 복제, 두 라인 완전 독립 — sync X)**. Apple Notes → Reminders 패턴.
- **inline 문법** — `- [x] 본문 --- YYYY-MM-DD HH:MM #category #priority`. em dash `—` 대신 triple hyphen `---` 도 매칭 (한국어 키보드에서 em dash 직접 입력 불가능). `lib/dates` 의 `parseLooseDate` / `parseLooseTime` 자연어 fallback — `오늘 / 내일 / 모레 / 월 / 오후 2시 / 2026.05.04 / 1830` 등 흡수.
- **footgun fix — `buildTodoLine` 항상 ISO 박음**. 이전엔 올해 case 에 한해 `M/D` 박았는데 연도 바뀌면 `getFullYear()` 가 새 해로 보충해 모든 M/D todo 가 1년 미래로 점프하던 버그. 이제 라인 자체에 연도 보존.
- **parser graceful split** — `---` 뒤 date/time 매칭 둘 다 실패하면 split 무효, 본문 보존. 외부 편집 / 사용자 실수로 망가져도 텍스트 손실 X.
- **`sanitizeTaskTitle`** — title 안 `—` / `---` 박혀있으면 저장 시 `--` 로 강등. 다음 read 의 잘못된 split 차단.
- **date-like 토큰 time false positive 차단** — `parseLooseTime("6/07")` 가 `parseInt` 로 `06:00` 잘못 매칭하던 거 fix. 자연어 fallback 의 토큰별 시도에서 slash/dash 포함 토큰은 time 매칭 skip. 인접 2-token sliding window 는 `오전/오후/AM/PM` prefix 일 때만 — "오후 2시" 같은 multi-word 보존.
- **assignee 추출 폐기** — UI 에 기능 없는데 parser 가 `[X] 본문` bracket 을 assignee 로 흡수해 본문에서 분리. `[ ] 안녕`, `[홍길동] 보고서` 같은 케이스에서 본문 일부 사라지던 문제. `ASSIGNEE_RE` / `TodoItem.assignee` / 관련 테스트 제거. bracket 도 본문 일부로 보존.
- **"일정" 라벨 정리** — 사이드 패널 `+` 의 "일정 추가" → "할 일 추가". 카피 통일.
- 19 modified, 4 deleted, 2 new. 168 tests passing (+19 신규 자연어/sanitize/graceful split/`---` 매칭/assignee 폐기 등).
- commit `c5555b4` (squash)

### PR #20 — 본문 슬래시 커맨드

- **`/` 한 글자로 줄 type 즉시 변환** — 메모 본문 빈 줄 또는 marker 뒤에서 `/` → popover (H1-3 / bullet / ordered / checkbox / quote / code-fence / hr / table 10개). ↑/↓ nav, Enter/Tab 선택, Esc 닫기. 타이핑으로 filter (`/h1`, `/체크`, 한글 키워드 매칭). 옵시디안 community "Slash Command Suggester" 호환 — vault md source 변화 X (표준 markdown). paragraph 면 marker prepend, 이미 marker 있으면 교체 (bullet → checkbox 등), indent 보존.
- **trigger 룰** — 줄에서 caret 직전이 indent · marker (`- `, `1. `, `- [ ] `, `> `, `# `) 뒤 빈 곳일 때만. URL / 날짜 / 일반 문장 중 `/` 는 false positive 차단. `markdownTyping.ts` 의 `detectSlashTrigger` 가 single regex 로 판정.
- **`applyLineKindTransform` helper** — pure function. paragraph/bullet/ordered/checkbox/quote/heading 1-3/code-fence/hr/table 10개 target. `stripLineMarker` 가 기존 marker (ATX heading + parseLineMarker 통합) 제거 후 새 marker prepend. indent 정규화 + caret 재계산.
- **`SlashCommandPopover` 컴포넌트** — 키워드 startsWith filter + 라벨 contains. `mousedown` 으로 옵션 선택 (textarea blur race 차단). 옵션마다 lucide 아이콘 + 라벨 + hint (`# `, `- `, `1. `). 일치 0 이면 안내만 (자동 닫기 X, backspace 로 복구).
- **SourceBodyEditor 통합** — slashState (slashStart/filter/selectedIndex/slashLine). onKeyDown 에서 popover 활성 시 Up/Down/Enter/Tab/Esc 가로채기, 다른 키는 통과 → onChange 가 다시 trigger 평가. popover 위치 = gutter (1.75rem) + textarea paddingLeft (0.5rem) 안쪽, `calc(slashLine+1 * 1.625rem)` top (현재 줄 바로 아래).
- 17개 unit test 추가 (applyLineKindTransform 9 + detectSlashTrigger 8). 163 통과.
- commit `57fa603`, merge `dc169ab`

### 직커밋 — vault 폴더 사라짐 명시 안내 + 재연결 시 빈 vault 신생 방지

- **`VaultDisconnected` 화면 신설** — `VaultProvider` 에 `disconnectedFrom` state 추가 + 끊김 감지 (`handleVaultGone` / init failed) 가 직전 path 보존. `VaultGate` 가 `vaultRoot` null && `disconnectedFrom` 있으면 새 화면 ("vault 폴더에 접근할 수 없어요" + 이전 path mono + [재연결] / [다른 폴더 선택]) 렌더, 그 외 기존 `VaultPicker`. 끊긴 이유/경로 모른 채 picker 가 *조용히* 뜨던 문제 해소.
- **재연결 시 빈 vault 신생 방지** — `setVaultRoot` 첫 줄에 `adapter.exists("")` 검사 추가 + 실패 시 throw. 기존엔 폴더가 사라진 상태로 setVaultRoot 가 호출되면 `ensureVaultStructure` 의 `mkdir(recursive: true)` 가 root 까지 통째로 만들어버려 "재연결" 한 클릭이 빈 vault 를 신생시키던 footgun 차단. inline 에러로 "외장 디스크 / iCloud 연결 확인" 안내.
- **"다른 폴더 선택" 즉시 다이얼로그** — 화면에서 한 번 더 클릭하지 않고 바로 Tauri `open({ directory: true })` 띄움 (defaultPath = 이전 vault). 취소 시 disconnected 화면 유지.
- 직커밋 (포트폴리오 카드 가치 적다고 판단 — UI 새 화면이지만 disconnect 트리거 자체가 dogfood 일상에서 거의 안 발생).

### PR #19 — 캘린더 헤더 nav + 일정 추가 modal

- **헤더 nav** — `[<][오늘][>]` 1개월 instant jump, buffer 49주 rebalance 호환. `minCenterOffset` 클램프 (2026-01 이전 차단) 유지. `visibleWeekOffset` 즉시 set 으로 month label race 차단 (smooth scroll 마지막 frame onScroll 누락 또는 stale closure 로 라벨 안 바뀌던 증상).
- **헤더 사이즈 통일** — 메모장 본문 헤더 spec (56px height, `text-base font-semibold`, `bg-overlay` + `backdrop-blur`). 요일 row 는 헤더 안 별도 row + divider.
- **사이드패널 `+` 버튼 → `ScheduleAddModal`** — 제목 / 날짜 / 시작·종료 시간, default 시작 = 현재 시각 30분 round. 메모장 사이드바 패턴 (라벨 left, 액션 right) 따라 사이드패널 헤더에 배치 — 캘린더 sticky 헤더에 modal trigger 까지 박으면 chrome 비대.
- **`LooseDateInput`/`LooseTimeInput` 추출** — `MeetingForm` 의 inline 함수 → `components/common/` 으로. `fullWidth` prop 추가로 modal form 스타일 호환. `parseLooseTime` 호출만 하므로 main 의 새 시간 키워드 (`지금|now|현재`) 자동 호환.
- **사이드패널 "· 오늘" 텍스트 제거** — 빨간 점과 중복.
- commit `551ef56..ee61bb2` (refactor + feat), merge `7e1456c`

### PR #18 — 메모 본문 typing 옵시디안 수준으로

- **마크다운 typing UX** — Tab/Shift+Tab indent (single + multi-line) / Enter 자동 list marker 연장 (bullet/ordered/checkbox/quote, empty marker 종료, IME-safe) / URL paste over selection → markdown link / smart dashes 비활성화 (autoCorrect="off" + beforeinput intercept fallback, 본문+transcript 둘 다) / textarea 빈 영역 클릭 → 끝 포커스. helper = `src/lib/markdownTyping.ts` 의 pure function 묶음 + 33 unit test.
- **마크다운 단축키 묶음** — ⌘B/⌘I wrap toggle (caret 만 있을 땐 빈 wrap + 가운데) / Alt+↑/↓ 줄 이동 / ⌘Shift+D 복제 / Opt+Q/W/E sub-tab (input/textarea 안에서도 동작, macOS dead-key œ/∑/´ preventDefault).
- **편집 모드 시각 위계 정비** — gutter 의 lucide 아이콘 + heading H1/H2/H3 + ordered 번호 모두 accent-blue 통일 (편집 모드 신호) / alignSelf flex-start 로 작성된 부분에만 border+아이콘 / `LineKind.lastContinuation` look-ahead + SVG dotted vertical (이어짐 중간) + dotted corner (이어짐 마지막), opacity 차이 폐기 / active marker = 정사각형 둥근 accent-blue-bg chip (회색 직사각형 폐기, gutter borderRight 와 4px 여백).
- **undo/redo 자동 탭 전환** — `useStateHistory` 의 undo/redo 가 `{from, to}` return 으로 라우팅 결정 노출. `DocSnapshot.__source` 추적 + undo → `from.__source` / redo → `to.__source` 의 탭으로 자동 전환 (변경이 일어나는 탭으로 일관 규칙). 다른 탭 보다가 ⌘Z 눌러도 즉시 변경 위치로 점프.
- **탭별 scroll 위치 유지** — `SCROLL_CACHE` 모듈 Map (`${meetingId}:${tab}`). onScroll 매 step cache + 탭/메모 전환 직후 useLayoutEffect + RAF 두 번 set (content height mount 직후 미정 케이스). 메모/음성/요약 탭 왕복해도 보던 위치 그대로.
- **wrapper padding 클릭 → 활성 textarea focus** — `mx-auto max-w-3xl px-6 pb-24` wrapper 에 onMouseDown 부착 + 좌우 px-6 영역은 좌표로 제외. 본문/transcript/summary 활성 탭의 textarea 자동 인식.
- **시간 input 자연어 키워드** — `parseLooseTime` 가장 앞에 `(지금|현재|now)` 매칭 → `new Date()` HH:mm. vault md 에는 실제 시각만 저장.
- commit `946f340..49ec51e` (5개 — helpers/typing+gutter/history+scroll+Opt+QWE/dates/screenshots), merge `07969bf`

### PR #17 — 노트 삭제 stale 선택 복원 race + 단축키 uid 정합

- **stale 선택 복원 race fix** — `list.isSuccess` 후 `selectedMeetingId` 가 list 에 없으면 null fallback + hash replaceState. 노트 삭제 후 `history.back` 이 이미 purge 된 메모로 popstate 가거나 / 초기 진입 hash 가 다른 세션 (옵시디안 모바일 sync 등) 에서 삭제된 메모 uid 인 두 경로에서 `useMeeting` throw → React Query retry → 영구 error UI 차단.
- **Cmd+N / Cmd+↑↓ uid 정합** — selectedMeetingId 에 `.id` (path) 대신 `.uid` 박도록. V0.7.1 uid 통일 누락분 — 사이드바 클릭/자동선택은 정상이고 이 두 단축키만 깨져있던 것 복원.
- **useDebouncedSave race 점검** — JournalBlock 은 `schedule` 가 `pendingRef` 에 sync write → `flush` 가 같은 ref read 구조라 V0.7.2 useStateHistory 의 closure-stale 패턴 없음. 캘린더는 자동 저장 자체 없음. fix 0.
- **dead callback chain 제거** — TrashModal `onMeetingPurged` + App.tsx `handleMeetingPurged` — uid vs trash path 비교라 절대 match 안 되던 dead code. 새 validation effect 가 같은 의도 cover 하므로 제거.
- commit `03b294d` + `51720b4`, merge `5df5e0e`

### 결정 — "깨진 파일 alert banner" 작업 X

todo "vault 파일 read 안정성" PR 그룹 마무리. 다른 sub-task (uid 중복 dedupe / parseVaultFile graceful / sync noise 무시) 3개는 이미 ✅. 마지막 🔥 항목 "깨진 파일 사용자 alert banner" 는 dogfood 검증 결과 가치 0 — PR #16 dedupe 가 중복 uid 자동 재발급 + parseVaultFile 이 yaml 깨져도 빈 fm fallback 이라 사이드바에서 메모 안 사라짐. 진짜 silent fail 은 `adapter.read/readMeta` 자체 실패 (iCloud evict / 권한) 한정인데 dogfood 에서 거의 발생 안 함. banner 가 보여줄 깨진 파일 수가 사실상 0 → dead UI 가 되므로 작업 X. 코드 변경 없음, todo.md PR 그룹 제거 + done.md 기록만.

### PR #16 — uid 중복 자동 복구

- **uid 중복 감지 + 후순위 재발급** — scanMeetings 끝 `Set<uid>` 검사 + mtime 작은 entry 만 새 uuid 재발급 + 디스크 rewrite. 외부 도구 (옵시디안 모바일 merge / 백업 복원) 가 같은 uuid 갖는 파일 두 개 만들어도 사이드바 리로드 때 silent 자동 복구. commit `346fea5`

---

## 2026-05-20

### PR #15 — 안정성 race + 사이드바 정렬

- **race fix 묶음** (5종) — useMeeting list-loaded gate / readFullMeeting throw + React Query retry / useStateHistory `valueRef` 동기 갱신 / docHistory cacheKey path → uid / scanMeetings catch console.warn. 새로고침 · 시간 수정 · 제목 변경 · iCloud sync 흐름에서 본문 영구 skeleton + undo 막힘 + history 통째로 사라짐 차단.
- **iCloud sync 노이즈 무시 룰** — `isSyncNoiseFile` 헬퍼 (`(conflicted copy)`, `.icloud` placeholder, dotfile). scanMeetings / Journals / AllTodos / Trash 모두 적용.
- **사이드바 정렬 popover** — 최신순 (기본) / 오래된순 / 이름순. 키 우선순위 date → time → mtime. localStorage `goodsoob:meetingSort` persist.
- **Tauri assetProtocol enable** — `app.security.assetProtocol.scope=["$HOME/**"]` + Cargo `protocol-asset` feature. portfolio 카드 vault 안 스크린샷 `convertFileSrc` 로 로드.
- **잡정리** — portfolio sync 진단 console.log 제거 / SyncError 박스 톤 사이드바 알림 통일 / 메타 input 색상 `--text-primary` 통일 / 달력·시계 아이콘 툴팁 제거.
- commit `1b2f7d9`, merge `90bdcd6`

### PR #14 — 휴지통 overlay

- **휴지통 자동 선택 + 미리보기 + 복원 (overlay 모달)** — commit `8c2c77f`

### PR #13 — 설정 탭

- **Vault 폴더 변경 UI** — 설정 모달의 Vault 섹션. 현재 path 표시 + "다른 폴더로 변경" + "연결 해제" (confirm). picker 후 첫 인덱싱 progress 처리. commit `2a65578`
- **vault 폴더 사라짐 graceful** — Vault liveness 3초 polling + window focus event. 외장 디스크 unmount / Finder 삭제 / iCloud 이동 → 즉시 VaultPicker 복귀. commit `2a65578`
- **단축키 cheatsheet** — 설정 모달의 "단축키" 섹션 (4 그룹 페이지/메모/sub-tab/편집 kbd chip). `?` 키 별도 진입점은 추가 가치 약함 판단. commit `2a65578`

### PR #12 — 키보드 흐름 + 날짜·시간 입력

- **메모 메타 (날짜/시간/참석자) undo/redo** — useStateHistory 1 stack docHistory 통합. DocSnapshot 에 meta 포함 → ⌘Z 로 메타도 되돌아감. 제목은 별도 (history 미참여, native input undo). commit `b8ec87d`

### dogfood 확인 (작업 X, 이미 해결돼 있음)

- **메모 1개 디폴트 선택 안 됨 / 새로고침 시 풀림** — V0.5.3 자동 선택 동작 정상 작동 확인
- **편집모드 메모/시간 입력 텍스트 색상 연함** — 해결돼 있음 확인
