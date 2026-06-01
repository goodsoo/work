# done

[todo.md](todo.md) 에서 완료된 항목 아카이브. 날짜 역순.

---

## 2026-06-01

### PR #61 — 메모장 사이드바 컨텍스트 메뉴 통일 + 섹션별 내보내기

- **한 줄 임팩트**: 메모·폴더 메뉴를 한 곳에 모아 일관되게.
- 메모 우클릭 메뉴와 타이틀바 … 메뉴를 `MeetingMenuItems` 공유 컴포넌트로 통일 (고정 / 폴더로 이동 / 마크다운 복사 / 내보내기 / 삭제).
- 폴더 행 hover 시 우측 … 버튼 — 우클릭 외 진입 경로. 폴더 우클릭 메뉴 상단 폴더명 헤더 제거.
- 우클릭/… 대상 폴더·메모를 focus-ring inset 으로 강조 (선택과 구분).
- 내보내기 = 섹션 선택 모달 (메모/음성 기록/요약 체크박스) → 폴더 한 번 선택 후 섹션별 .md 저장. 본문=`제목.md`, 음성기록·요약=`제목 (라벨).md`.
- 사이드바 복사/내보내기는 `useGetFullMeeting` 으로 본문 fetch 후 처리, 삭제는 ConfirmDialog 경유.

### PR #60 — Google 캘린더 양방향 동기화 (날짜 있으면 자동)

- **한 줄 임팩트**: 날짜만 넣으면 Google 캘린더에 자동 동기화
- 날짜 있는 모든 일정 task ↔ 전용 Google 캘린더 양방향(생성·수정·삭제) 동기화. 앱 포커스 시 자동 + 수동 "지금 동기화".
- reconcile + tombstone 으로 좀비 부활 차단, 날짜 제거 시 캘린더에서만 제거(task 보존), vault별 캘린더 분리, 반복 일정은 동기화 제외(반복 깨짐 방지).
- 설정 동기화 패널(캘린더 이름 rename·자동 동기화 토글·재인증 CTA) + 할 일 헤더 sync 칩(연동 캘린더 tag) + Toggle 공통 컴포넌트.
- 곁들임: 할 일 정렬 "오래된순(미완료 먼저)" 기본화 + 포함 0개 카테고리 필터 dim 제거.

## 2026-05-27

### PR #59 — 메모장 UI 폴리시 (헤더 통일·요약 모달·사이드바 토글·시계)

- **한 줄 임팩트**: 메모장 헤더·토글·요약 흐름을 다듬어 편집 집중도↑
- 본문 두 번째 헤더 통일(할일·포트폴리오 ↔ 메모장) + 할 일 정렬을 본문 헤더 우측으로 이동.
- 메모 우측 "..." 메뉴(복사 + 삭제), 음성기록·요약 액션을 탭 헤더(편집 토글 왼쪽)로 모음.
- 요약 버튼 1개 + SummaryModal(자동 요약 / 붙여넣기 탭, 자동 호출 제거 → 명시 트리거), 비활성 시 안내 토스트(info kind).
- 편집/보기 세그먼트 토글(편집 파랑 / 보기 모노톤), 글자수 우측하단 fixed, 메타 read-only 박스 통일.
- 타이틀바 live 시계, 사이드바 열기/닫기 토글을 본문 PageHeaderBar 좌측으로 통일, 캘린더 PageHeaderBar 전환.
- 자동 요약은 #57 의 runClaudeStream(진행률·sonnet·중립 cwd)을 SummaryModal 자동 탭에 통합.

### PR #56 — 앱 이름·아이콘 짱수 브랜딩

- **한 줄 임팩트**: 앱을 '짱수' 이름·아이콘으로 브랜딩
- `productName` + window `title` + 인앱 헤더 h1 + `index.html` 타이틀 → "짱수". 번들 `identifier`(`com.goodsoob.work`)는 유지 — vault 경로/데이터 보존.
- 아이콘 교체 — macOS 표준 그리드(1024 캔버스 + 824 둥근 흰 배경 + 여백)로 직접 합성해 구움. macOS 가 앱 아이콘을 자동으로 둥글게 마스킹하지 않아 직접 처리. 어두운 라인아트라 흰 배경 선택. squircle 소스 + 벡터 마스터는 `src-tauri/icons/source/` 에 보관(`logo-macos.png` + `goodsoob_logo.svg`) — 재생성은 `bun run tauri icon src-tauri/icons/source/logo-macos.png`.
  - ⚠️ 2026-05-28 fix: 위 그리드를 의도했으나 실제 번들은 여백 0 인 full-bleed `logo.png` 로 구워져 Dock 에서 아이콘이 크게 보이던 버그. 올바른 여백 소스(`logo-macos.png`, 아트워크 80.6%)로 재생성해 4면 투명 여백 확보. 데스크탑 전용이라 `tauri icon` 이 딸려 만든 android/ios/64x64 는 제거.
- 내부 식별자(`package.json` name, Cargo 바이너리 name, theme 키)는 유지. ui_ux.

### 🚀 milestone — 데스크탑 앱 첫 배포 (V0.7.x 안정화 단계 진입)

- **한 줄 임팩트**: 본인 매일 실사용 시작 — 이제 vault 안 데이터가 production
- 옛 lazy migration 잔재 정리 (`f601cec`) + release 빌드 컴파일 통과 (`01444bf`) + UI 잔재 "회의" 용어 정리 (`e0514c0`) 묶음 끝낸 직후 첫 배포. 지금까지의 "본인 미사용 전제" 룰 폐기.
- **이후 정책**: vault schema 변경 시 lazy migration 코드 박는 게 default. 예전처럼 "데이터 가능성 0 이라 마이그레이션 생략" 안 됨. CLAUDE.md 의 V0.6/V0.7 섹션의 "본인 미사용" 문구 정리 필요 (별도 todo).
- **앞으로 dogfood 통증** = 다음 우선순위. 매일 사용 → 발견 → todo.md 입력 → 묶어서 PR 단위로 처리.

### 직커밋 — 실사용 전 옛 버전 마이그레이션/호환 잔재 정리 (f601cec)

- **한 줄 임팩트**: 데스크탑 첫 배포 전 dead code 정리 — schema 변경 코드 path 명확화
- **제거된 lazy migration** — V0.6→V0.7.1 frontmatter `id` lazy 발급 (5 지점: `fileToMeeting`/`fileToJournal` throw 로 단순화, `scanMeetings`/`scanJournals` 안 uuid 발급+rewrite 블록 제거, dedupe 빈 uid skip 제거). `readFullMeeting` 의 lazy migration 블록도 제거.
- **registry bootstrap 제거** — V0.5→V0.6 단일 `vaultRoot` localStorage 흡수 (`bootstrapFromLegacy` + `LEGACY_VAULT_ROOT_KEY`) + 관련 테스트 2개. 부팅 시 옛 단일 vault 키 lookup 자체 사라짐.
- **소소한 잔재** — `useMeetingSort` 의 옛 `"date"` → `"date_desc"` 변환 (옵션 5개 시절 잔재) 단순화. `usePortfolio` / `portfolio.ts` 의 옛 `projects.md` skip + `PortfolioProject` 타입 흔적 주석 제거. github_pr_id optional 사유 주석 "legacy" → "수동 카드 명시" 로 갱신.
- 8 파일 +22 / -127. 실사용 전이라 legacy 데이터 가능성 0 가정으로 진행.

### 직커밋 — Tauri release 빌드 dev 메뉴 컴파일타임 cfg 전환 (01444bf)

- **한 줄 임팩트**: 데스크탑 release 빌드 통과 — 첫 배포 차단 해제
- **`if cfg!(debug_assertions)` → `#[cfg(debug_assertions)]`** — 런타임 if 면 release 에도 코드가 compile path 에 남음. `tauri_plugin_log` / `app.handle().plugin(...)` 블록이 release 에선 devtools API 가 없어 컴파일 자체 fail. attribute cfg 로 전환해 release 빌드에선 블록 통째로 strip.
- 5 lines 변경 (1 파일).

### 직커밋 — 잔재 "회의" 용어 정리 (e0514c0)

- **한 줄 임팩트**: UI 라벨에 남은 "회의" 어휘 메모/음성 기록으로 통일
- `MeetingsList` 빈 상태 "첫 회의를 기록" → "첫 메모를 작성"
- `TrashPreview` transcript 라벨 "회의 내용" → "음성 기록" (MeetingForm 탭과 일치)
- `StyleguidePage` `--accent-blue` 토큰 설명 "회의 칩" → "primary 액션, 편집 모드" (실 사용처 반영)
- 내부 코드 (`Meeting` 타입 / `useMeeting` 등) 는 그대로 — CLAUDE.md "UI 리네이밍은 했어도 내부 코드는 meetings 유지" 패턴.

---

## 2026-05-26

### PR #53 — 메모장 요약 흐름 모달화 + 본문과 동일 에디터로 통합

- **한 줄 임팩트**: Claude 응답을 한 번에 요약 본문으로 박는 흐름
- **두 진입점만 노출** — 요약 탭에 "Claude 한테 자동 요약" (CLI 직접 호출) / "직접 붙여넣기" (외부 Claude.ai fallback) 두 버튼. 나머지 호출/응답/적용 흐름은 각 모달 안에서 완결. 메인 탭 깔끔.
- **summary 데이터 모델 array 3개 → 단일 마크다운 string** — `discussion_items / decisions / action_items` 폐기. `.summary.md` sidecar 가 옵시디안에서 자연스러운 마크다운 노트로 보임. parseSummaryResponse / buildSummaryBody 변환 함수 제거.
- **요약 탭 본문 = SourceBodyEditor + MarkdownView** — 메모 탭과 동일 UI/UX. 슬래시 명령, line gutter, 라인 → todo dispatch, undo/redo 모두 자연 적용.
- **음성 기록 / 요약 탭에 메타 칩** — monospace + 음영 배경 (본문 inline code 와 같은 시각 어휘). trailing 자리에 액션 아이콘 (요약 = Sparkles/Clipboard, 음성 기록 = Upload) → 위치 + 스타일 통일.
- **state 별 hierarchy** — 요약 빈 상태 = 큰 primary CTA, 채워진 상태 = 메타 칩 우측 아이콘만.
- 13 파일 +625 / -434. typecheck + 336 tests pass.

### PR #52 — Portfolio 카테고리 vault union 모델 (master list 폐기)

- **한 줄 임팩트**: 카테고리 추가/정정 마찰 0 — 옵시디안 tag 식 자유 슬러그
- **vault union 모델** — 카테고리 = 카드 frontmatter.category union 으로 자연 발생. master list 파일 (`categories.md`) + builtin 5 (코드 상수 `BUILTIN_CATEGORY_DEFS`/`PORTFOLIO_CATEGORIES`/`mergeCategoryDefs`) 폐기. 카드가 박은 슬러그는 그 카테고리가 존재, 마지막 카드가 떼면 자동 소멸. typo 후 정정 = 잘못 적은 카테고리 자동 사라짐.
- **콤보박스 UI** — `PortfolioDetailModal` / `PortfolioCreateModal` 의 카테고리 `<select>` → `CategoryCombobox` (typing + 자동완성 + 매치 없으면 "+ 새로 만들기: '{input}'" 행). popover 는 React portal 로 띄워 모달 우측 패널 scroll overflow clip 회피.
- **chip 색 단일** — 모든 카테고리가 회색 하나로 통일. `KNOWN_COLORS` / 카테고리별 색 토큰 의존 제거. 색 욕구 발생 시점에 별도 `colors.md` 도입 (지금은 X). 카테고리 관리 모달 + 진입 톱니바퀴 제거.
- **AI 추천 source 교체** — `buildPRPrompt` 가 vault union 후보를 prompt 에 노출, `parsePRResponse` 는 자유 슬러그 허용 (enum 강제 X). 사용자 PR template 가이드라인 (`CLAUDE.md` 의 `ui_ux | backend | infra | fix | other`) 은 본인 작성 가이드로만 — 앱이 강제하지 않음.
- **race fix 2건** — (1) `useUpdatePortfolioFrontmatter` 가 cache 의 실제 `filePath` 직접 사용 — 폴더 안 수동 카드 / NFC·NFD 정규화 차이로 `portfolioWorkPath(slug)` 가 빗나가 read throw → optimistic rollback 으로 옛 값 복귀하던 race 차단. (2) `CategoryCombobox` 의 `onBlur` / outside-click handler 에 `draftRef` 도입 — `selectRow` 가 commit 후 input.blur() 발사하면 `onBlur` 의 stale closure 가 옛 draft 로 다시 commit 해서 새 값 덮어쓰던 race 차단.
- **마이그레이션** — 기존 vault 의 `categories.md` 는 첫 사용 시 한 번 lookup 후 무시 → 사용자가 손으로 삭제. 카드 frontmatter 의 기존 `category` 값은 그대로 vault union 에 자연 포함.

### PR #51 — 루틴 만료 분리 + 휴지통 + 내부 코드 용어 통일

- **한 줄 임팩트**: 만료 루틴 분리 + 삭제 복구 + 용어 정리
- **만료 루틴 사이드바 분리** — 종료일 < 오늘 인 루틴은 활성 list 에서 자동 빠지고 "지난 루틴 (N)" 별도 collapsible 섹션 (default 접힘). 종료일 chip 만 표시. 클릭 시 RoutineDetail 진입 → 종료일을 미래로 옮기면 자동 복귀.
- **루틴 soft delete** — `deleteRoutine` 이 즉시 파일 삭제하던 거 → `routines/.trash/{stamp}-{name}.md` 로 이동 (메모/포트폴리오와 같은 패턴). `restoreRoutine` / `purgeRoutine` / `emptyRoutineTrash` API + 같은 이름 충돌 시 `RoutineConflictError` toast. RoutineDetail confirm 문구도 "휴지통으로 옮길까요? 나중에 복원할 수 있습니다." 로 변경.
- **할 일 탭 통합 휴지통** — 옛 `TodoTrashModal` 을 `TodosTrashModal` 로 확장 + 태스크/루틴 한 flat 리스트, chip (`태스크` / `루틴`) + 아이콘 (✓ / Repeat) 으로 시각 구분. 헤더에 전체 "비우기" 하나. 사이드바 푸터 휴지통 1 아이콘 유지 (탭별 1 trash 원칙). 모달 size `md`→`lg` (포트폴리오와 동일 고정 크기 통일).
- **용어 정리** — "할 일" = 큰 집합(탭/모음), "태스크" + "루틴" = 하위. 사용자 라벨 (`TaskAddModal` 헤더, `TaskRow` "할일 삭제"/"할일 취소", `TasksPage` 빈 상태, `TodoTrashModal` chip) + 주석 ("할일 탭"→"할 일 탭", "todo→task" 등) 일관화.
- **내부 코드 rename** — `Todo`/`TodoXxx` type → `Task`/`TaskXxx`, `useTodos`/`useCreateTodo`/`useUpdateTodo`/`useDeleteTodo`/`useTodoSort`/`useTodoHistory`/`useTodoUndo`/`useTodoFlash` → `useTasks`/`useCreateTask`/`...` 등 hook, `TodoRow`/`TodoBlock`/`TodosPage`/`TodoTrashModal` 컴포넌트, `extractTodos`/`scanAllTodos`/`toggleTodo`/`setTodoCheckChar`/`onAddTodoFromLine` 함수, `todoCategory.ts`/`todoSort.ts`/`todoHistory.ts` 파일, CSS `todo-card-*` / `@keyframes todoCard*` 일괄 변경. SearchDomain literal `"todo"` → `"task"`. 13 파일 git mv. 외부 인터페이스 (탭 id `"todos"`, URL hash `#todos`, 이벤트 `"todos:add-request"`, localStorage `goodsoob:todoSort`, React Query 키 `["todos"]`, vault `inbox.md`, `TodosSidePanel`/`TodosSidePanelFooter`) 는 유지.

### 직커밋 — 루틴 추가 모달 validation 보강 (020468c, 32c7cd9)

- **한 줄 임팩트**: 시작일/종료일/이름 빈 값·역전 입력 차단
- **submit 게이트** — `name.trim() && started && (!ends || ends >= started)` 다 만족 안 하면 버튼 비활성 + 라벨에 `*` 표시. `listRoutinesActiveOn` 클램프 fail 로 루틴 사라지던 통증 차단.
- **인라인 에러** — toast 대신 input 아래 caption + red border. "이름을 입력하세요" / "시작일을 입력하세요" / "종료일은 시작일과 같거나 이후여야 합니다" — voice/tone "원인 + 해결" 2단 따름.

### PR #50 — Portfolio vault 폴더 모델 + 수동 카드/카테고리 관리

- **한 줄 임팩트**: GitHub PR + 오프라인 업무 한 곳에 + 옵시디안 자유 분류
- **데이터 모델 재설계** — 옛 `projects.md` 메타 + frontmatter `project` 필드 폐기. 사이드바 source = (a) 카드 frontmatter github_owner/github_repo derive 한 [GitHub] 그룹 (b) vault 실제 디렉토리 트리 = [내가 만든 폴더] 그룹. 두 그룹 시각 분리 + chevron 접힘 (vault 별 localStorage).
- **수동 카드 추가** — 사이드바 [Plus] → 모달 (제목/한 줄 임팩트/날짜/카테고리/폴더). vault `portfolio/{folder}/{title}.md` 로 저장. github 카드 (PR 또는 직커밋 legacy) 와 sentinel (`owner=local repo=manual`) 로 구분 — sync 안 건드림.
- **수동 폴더 = 메모장 패턴** — 사이드바 [FolderPlus] → "새 폴더" default + 인라인 rename 자동 진입. 우클릭 = 이름변경/삭제. nested 지원. 폴더 삭제 시 안 카드 휴지통 이동. 카드 ⋮ 메뉴 "폴더로 이동..." 으로 이동 모달 (선택 폴더 → disk rename).
- **카테고리 관리 모달** — 카테고리 chip row 끝 톱니 → 모달. builtin 5 (ui_ux/backend/infra/fix/other) 는 label/color override 만 (slug 고정·삭제 불가), 사용자 정의는 추가/수정/삭제. 색상 swatch 8개 (cat-* + accent). 삭제 시 해당 카드 "기타" 자동 마이그레이션. PortfolioCategory string union 으로 풀어 카드 frontmatter 임의 slug 도 union 에 자동 포함 (orphan 개념 0).
- **legacy 직커밋 카드 분류** — 옛 `pr_number=0` 만 봐서 수동 카드와 섞이던 거 → `owner/repo === "local"/"manual"` sentinel 가드 추가. 직커밋 자동화 카드들이 [GitHub] 그룹에 정확히 분류.
- **사이드바 헤더 정리** — [새 폴더 / 새 카드] 2 아이콘만, 가이드북 + 휴지통은 사이드바 footer 우측 하단 (휴지통과 크기 통일). SortMenu 는 본문 카테고리 chip row 오른쪽 끝.
- **DetailModal dropzone read mode 노출** — 옛 편집 모드 가드 제거. 수동 카드 빈 카드 만들고 detail 들어가도 즉시 스크린샷 추가 가능.
- **빈 썸네일 분기** — github 카드 = GithubMark (Octocat), 수동 카드 = Briefcase.
- **부수**: voice/tone placeholder 정책을 명령형 안내 (`{필드}을 입력하세요`) 로 통일 (옛 `예: ...` 예시형 폐기). vite 가 VITE_PORT env 받게 — 동시 worktree dev 지원.

### 직커밋 — vault 기본 폴더명 meetings/ → notes/ (2429502)

- **한 줄 임팩트**: UI "메모장" 과 vault 폴더명 의미 일치
- **파일시스템 경로만 rename** — `notes/{title}.md` 로 신규 vault 부트스트랩. 내부 코드명 (`Meeting` type, `useMeeting` hook, `MeetingForm` component, tab `"meetings"`, URL hash `#meetings`, React Query key `["meetings"]`, 소스 폴더 `src/components/meetings/`) 은 그대로 — CLAUDE.md 의 "UI 리네이밍은 했어도 내부 코드는 meetings 유지" 패턴 따름.
- 16 파일 234줄 (test 5개 포함). typecheck + 336 tests pass.
- 기존 vault 자동 마이그레이션 0 — 본인이 아직 실제 사용 전. Finder/옵시디안에서 `meetings/` 폴더 직접 rename 또는 그대로 두고 `notes/` 새로 시작.

### 직커밋 — 할일 체크박스 hit zone 30x30 확장 + 캘린더 사이드바 루틴 row click 활성화 (96f3b2d)

- **한 줄 임팩트**: 체크박스 밖 살짝 빗나간 클릭이 페이지 이동/편집 모드로 새던 통증 차단
- **`CheckboxButton` hit zone** — 시각 18x18 유지, 버튼 `p-1.5 -m-1.5` 로 클릭 영역만 30x30 확장. negative margin 으로 layout footprint 는 18x18 유지 → 행 높이·정렬 변동 0. 부모 행의 click navigate/edit 보다 먼저 catch.
- **캘린더 사이드바 루틴 row click 활성화** — todo row 처럼 `onOpenRoutine` prop + role=button + Enter/Space + hover bg. App.tsx 의 `openRoutine(name)` 이 todos 탭 + RoutineDetail 진입까지 처리. todo/루틴 간 인터랙션 일관성.

### 직커밋 — 캘린더·포트폴리오 background prefetch (628f9e4)

- **한 줄 임팩트**: 다른 탭 진입 시 cache hit — 첫 페인트 즉시
- 부팅 후 `useMeetings` 이후 background 으로 `useTodos` / `useJournals` / `useRoutines` / `usePortfolio` prefetch. 첫 클릭 시 skeleton 안 보임. React Query staleTime 활용.

### PR #49 — 메모장 폴더·삭제·생성 흐름 안정화 (dogfood 4건)

- **한 줄 임팩트**: 메모장 일상 흐름 안 끊기는 디테일 4건 정리
- **폴더 삭제 confirm** — Tauri WebView 에서 `window.confirm` 이 noop 통과되어 폴더가 그냥 삭제되던 이슈. ConfirmDialog 모달 (danger, 멀티라인) 로 교체. 폴더 영구 삭제 + 안 메모 N개 휴지통 이동 안내 + 폴더 안 고정 메모 N개 빨간 경고 줄. ConfirmDialog 의 `message` prop 을 `string` → `ReactNode` 확장.
- **고정 메모 중복 표시** — 옵시디안 bookmarks 패턴 (트리에서 제외) 거스르고 상단 PinnedSection + 트리 양쪽 표시. 트리에서 사라지는 게 "고정한 메모 어디 갔지" 헷갈림 더 큼.
- **삭제 후 자동 선택 = 옵시디안 패턴** — 같은 폴더 안 다음 (사이드바 정렬 적용) → 없으면 이전 → 폴더 안 다 비면 부모 폴더 첫 메모 (root 까지 재귀) → root 도 비면 empty. raw mtime desc 옛 로직은 사용자 시각 순서와 mismatch ("왔다갔다") 였음. Cmd+↑/↓ 도 같은 메커니즘으로 통일 — 폴더 경계 안 넘어감.
- **sortComparator helper 추출** — `src/lib/meetingSort.ts` 의 `buildMeetingSortComparator(sortKey)` 를 SidePanel + App.tsx 가 공유. localStorage (`goodsoob:meetingSort`) 통해 자동 동기화.
- **메모 생성 race fix** — 사이드바 + 버튼 빠르게 연달아 누르면 "이미 같은 제목 'untitled'" 토스트가 떴음. 원인: `MeetingForm` 이 다른 `meetingId` 로 reconcile 될 때 `titleDraft` useState 가 옛 메모 값으로 carryover → blur 시 `commitTitle` 이 옛 "untitled" 로 mutate → 새 메모 path 와 충돌. `key={meetingId}` 추가로 강제 remount. `activeTab` / `docHistory` 는 module-level cache (uid 기반) 라 remount 후 복원.

### PR #48 — 본문 이미지 paste/drop + 사용 안 하는 첨부 정리

- **한 줄 임팩트**: 본문에 이미지 paste/드롭 — 옵시디안 흐름 + 명시 cleanup
- **textarea paste/drag&drop** — 편집 모드 textarea 에 이미지 paste/drop → `meetings/_attachments/{uid}/{N}.{ext}` 저장 + caret 위치에 `![](path)` 자동 insert. 외부 도구로 vault 폴더 열고 직접 markdown 박던 흐름 제거.
- **slug = uid** — 메모 title 자주 바뀌어 title-slug 폴더는 분기/orphan 비용 ↑. 영구 식별자 uid 로 통일 — V0.7.1 의 "client cache key uid 기반" 정책과 정합. Finder 가독성 X 대신 grep 으로 역추적 가능 (본인 1인 도구).
- **window 레벨 dnd default 차단** — textarea 밖 drop 시 webview 가 이미지를 새 page 로 열어버려 뒤로가기도 안 되고 앱 닫을 수밖에 없던 함정 즉시 차단. `dragover` + `drop` global preventDefault.
- **drag visual 강조** — OS Finder 에서 파일 drag 진입 즉시 textarea 박스에 파란 dashed outline + 옅은 강조색. 빈 메모 (1줄짜리) 는 drop target 좁아 보이던 통증 해결: drag 중에만 min-height 8rem 으로 일시 확장, drop 끝나면 원복.
- **첨부 정리 (orphan cleanup)** — 본문에서 markdown 줄 지워도 vault 안 이미지 파일은 그대로 (옵시디안 default 와 동일). 자동 삭제는 undo 와 충돌 위험 → 설정 모달 새 섹션 "첨부 정리": 활성 메모 + 휴지통 메모 둘 다 검사 (복원 시 깨짐 방지) → orphan 카운트/사이즈/path 리스트 + 명시 정리 버튼.
- **vault adapter writeBinary** — atomic tmp→rename + per-path lock 공유 (md 파일과 동시 쓰기 race 차단). 메모리 adapter 도 binary path 별도 storage.
- **사이드바 트리 자산 폴더 제외** — `meetings/_attachments` 가 사이드바 폴더 트리에 노출되던 버그. `scanMeetingFolders` + `scanMeetings` 에서 `_attachments` 세그먼트 차단.

### PR #47 — gh onboarding 모달: 미설치/미로그인 분기 안내

- **한 줄 임팩트**: 동기화 실패 이유와 해결법 안내
- **에러 분류** — `runGh` 가 stderr 분석해서 `GhNotInstalledError` (`command not found: gh`) / `GhAuthError` (`auth status`, `not logged in`, `gh auth login`) 던지도록 보강. 기존엔 클래스만 정의되고 throw 안 됨 → 사이드바 toast "동기화 실패. 네트워크 확인" 한 줄로 합쳐져 사용자가 무엇이 문제인지 판단 불가.
- **InstallGuideModal** — macOS `brew install gh` / Windows `winget install ...` + 검증 단계 (`gh --version`) 카드. CommandBlock 공용 컴포넌트 (커맨드 + 클립보드 복사 버튼) 분리.
- **AuthGuideModal** — `gh auth login` 단계 + 계정 변경 시나리오 (`gh auth logout` 후 재로그인) 안내.
- **에러 종류별 모달 분기** — 사이드바 SyncButton 의 lastResult 에서 GhNotInstalledError / GhAuthError 식별 → App.tsx 가 적절한 모달 트리거. 한 화면 한 액션 원칙 (inline expand 대신 모달) — 정보 밀도 폭증 회피.

### PR #46 — 사이드바·헤더 필터 자리 통일

- **한 줄 임팩트**: 작업/할일 두 페이지 필터 정신 모델 일치
- **카테고리 = 본문 헤더 chip (single radio)** — 옛 사이드바 카테고리 (작업의 multi chip + 할일의 row 그룹) 를 페이지 본문 헤더 sub-row 로 이동. 두 페이지 동일 자리, 동일 패턴 ("전체" + 카테고리들). 작업 카테고리 데이터 모델 multi(`Set<Cat>`) → single(`"all" | Cat`), localStorage 옛 multi 형식 lazy 흡수.
- **사이드바 = single dimension row** — 두 페이지 사이드바를 한 차원으로 단순화. 작업 = 프로젝트 (전체/분류안됨/프로젝트들). 할일 = status (전체/미완료/완료). "둘 다 하나씩 선택해야 하는데 어떻게 결합?" 인지 부담 해소.
- **할일 사이드바 status row 최상단 flat** — "태스크" outer 폴더 제거. status 가 사이드바 메인. 그 아래 루틴 폴더 (별개 도메인, collapsible 유지), 하단 "취소됨" 별도 entry.
- **작업 사이드바 "미사용" 하단 이동** — 할일 "취소됨" 패턴과 동일 위치 (`border-default + px-1 py-2`). inner divider (분류안됨/프로젝트 그룹 사이) 도 제거 — 할일 사이드바와 통일.
- **공통 `common/FilterItem`** — 사이드바 row 통일 컴포넌트 (px-2 py-1 13px, count/leading/muted prop). `leading` 없으면 wrapper 자체 안 그리기 — leading 그룹 / non-leading 그룹 모두 자기 그룹 안에서 label 시작 x 일관. status row 의 빈 wrapper 12px + gap 8px = 20px 빈 공간 해소.
- **CheckboxButton `shape="circle"` prop** — 캘린더 사이드바 "할 일" 섹션 안에서 루틴 (원형) / 일회성 할일 (사각) 시각 구분. 라벨/구분선 없이 시각만으로 type 인지 + todos 사이드바 루틴 row 도 같이 원형 (전 앱 일관성).
- **캘린더 사이드바 폴더 indent + guide line** — 메모장 트리 패턴 차용. `SectionChildren` 헬퍼가 `paddingLeft: 16px` 자식 indent + `left: 14px` 세로 guide line 그림. "폴더 안에 들어있다" 시각 신호.
- **시간 폰트 통일** — 캘린더 루틴/할일/메모 row 의 인라인 시간 prefix 를 우측 정렬 `text-[11px] tabular-nums` 으로 통일. 메모장 폴더 트리 패턴과 동일.
- **캘린더 "할 일" 섹션 통합** — 옛 "루틴" / "할 일" 두 섹션을 한 collapsible 섹션으로 (구분선 없이 시각만으로). 메모/할 일 0건이면 섹션 자체 hide, 일기는 항상 노출.

### 직커밋 — 백업 가시성: 마지막 백업/폴더 열기/보관 개수/진행 toast (faf9aa2)

- **한 줄 임팩트**: 설정 모달 백업 영역에서 마지막 백업 + 경로 한눈에, 1초+ 작업은 화면 어디서나 진행 표시
- **마지막 백업 박스** — 상단에 "마지막 백업: YYYY-MM-DD HH:mm" + 그 아래 vault 안 `.backups` 절대경로 (`~` 축약). 한 번 봤을 때 백업이 실제로 도는지 + 어디 저장됐는지 즉시 확인.
- **백업 폴더 열기 버튼** — "지금 백업" 옆 ghost 버튼. `sh -lc 'open ...'` 으로 macOS Finder 진입 (portfolio capability 의 sh 권한 재사용, 추가 권한 0). zip 잃을까 걱정 시 1 클릭 확인.
- **보관 개수 사용자 설정** — 옛 `BACKUP_KEEP_COUNT = 10` 고정 → `keepCount` 필드 + select (5/10/20/30/50). `AutoBackupConfig` 에 추가, 옛 localStorage 는 default 10 으로 흡수. 큰 vault 일수록 디스크 부담, 작은 vault 일수록 안전성. 본인이 조절.
- **1초+ progress toast** — Toast 시스템에 `kind: "progress"` variant (Spinner + "진행 중" 라벨). 백업 button spinner 는 모달 안에서만 보이는데, 모달 닫거나 자동 백업이 부팅 직후 silent 로 1-10초 lock 될 때 "왜 freeze?" 체감 차단. `show()` 가 id 반환 + `dismiss(id)` expose — 호출자가 완료 시 닫음.
- **자동 백업도 동일 toast** — App 부팅 10초 뒤 트리거되는 `maybeAutoBackup` 도 같은 1초 timeout → progress toast 패턴.

- **한 줄 임팩트**: 개인용 / 회사용 vault 따로 전환 — 같은 앱에서 컨텍스트 분리
- **registry 모델** — `VaultEntry {id, name, path, addedAt}` localStorage (`goodsoob:vaults` + `goodsoob:activeVaultId`). path 중복 자동 dedupe, 빈 이름 입력 시 폴더명 자동 보충. 옛 단일 `vaultRoot` key 는 첫 부팅에서 1개 vault 로 흡수 (테스트 데이터 단계 — 정교한 migration 코드 생략).
- **VaultProvider 확장** — vaults/activeVaultId state + switchVault/addVault/removeVault/renameVault/disconnect. activeVaultId 변경 useEffect 가 단일 진입점으로 watcher.stop → adapter.setRoot → queryClient.clear → ensureStructure → watcher.start 일관 처리. 전환 시 `#meeting-{uid}` hash 도 reset (옛 vault 의 uid 가 detail page 깜빡임 일으키던 케이스 차단).
- **localStorage namespace** — `useScopedKey(baseKey)` 가 vault id suffix 자동 부착. 7개 hook 갱신 (meetingSort / todoSort / portfolioSort / portfolioCategoryFilter / bodyViewMode / sidebarCollapsed / MeetingsTreeView 폴더 collapsed). 회사 vault 의 폴더 접힘이 개인 vault 에 안 새어 들어옴.
- **헤더 vault badge dropdown** — vault 목록 라디오 (체크 표시) + "새 vault 추가" + 설정 + 스타일가이드. 1 클릭 전환.
- **설정 모달 VaultSection** — 라디오 list 패턴 (todos CheckboxButton 시각 언어 차용 — 18px, border 두께, hover preview) + 별칭 inline rename + remove + 추가. **별칭이 폴더명과 다를 때만** 행 안에 `(실제 폴더명: xxx)` muted disclosure — 별칭/폴더명 혼동 차단. 폴더 실제 rename 은 안 함 (옵시디안 default 모델 + iCloud sync 깨짐 위험 회피).
- **VaultPicker selector 모드** — vaults list 가 있고 active 가 없을 때 (disconnect 후 재진입) 기존 vault 목록 라디오 + "새 폴더 추가" 함께. 첫 진입은 기존 단순 picker 그대로.
- **테스트** — registry 9 unit (add/dedupe/remove/rename/empty-name/legacy bootstrap) + scopedKey 2 unit. 22 files, 307 tests pass.

### 직커밋 — 메모 사이드바 root drag race fix + 라벨/아이콘 polish

- **race fix** (6cb0872): root → folder drop 시 dragstart 직후 9ms 만에 dragend 가 발사되어 drag 시작 자체가 안 되던 race. `handleDragStart` 의 동기 `setDragUid` 가 React reconciliation 으로 `RootDropCatcher` mount → DOM mutation → WKWebView 가 drag source 변경 감지하고 native drag operation 즉시 cancel. `setTimeout(0)` 으로 setState 를 다음 tick 으로 미뤄 native drag init commit 이후 mount. UX 도 같이 손봄 — 16px slot `RootDropCatcher` → root 메모 전체 wrapping 박스 `RootDropZone` 으로 교체, 폴더 밖 영역 어디든 drop 가능 + 평상시·drag 중 동일 layout (outline 만 toggle, margin/padding 변동 0).
- **라벨 통일** (28c3150): "내 작업" → "포트폴리오". 다른 탭 (캘린더 / 메모장 / 할 일) 명사 단독 톤과 일치, vault 폴더명 `portfolio` 와도 일치. ActivityBar / 사이드바 헤더 / 페이지 h1 / 단축키 / 가이드 모달 + 코드 주석까지 11곳.
- **아이콘 4개 정리** (5c01af5): 메모장 `ClipboardList` ↔ 할 일 `ListChecks` 가 시각 유사해 헷갈리던 문제. notion 풍 단순/평면 아이콘으로 교체 — `Calendar` / `FileText` / `CheckSquare` / `LayoutGrid`. 캘린더 셀 메모 표시, 할 일 사이드패널의 메모 링크 leftIcon, 포트폴리오 empty state, QuickSwitcher 항목까지 일관 갱신.

---

## 2026-05-25

### PR #44 — 루틴: 매일 반복 작업 별도 도메인 + 월별 그리드

- **한 줄 임팩트**: 매일 반복 작업 자동 추적 (todo 와 분리)
- **별도 도메인** — 처음 design 의 "별도 탭 + heatmap + streak" 폐기, 1차 pivot "todo 카테고리 routine 추가" 도 폐기. 최종은 vault `routines/{name}.md` 마스터 + 옵시디안 Tasks 호환 체크 로그 (`- [x] ✅ YYYY-MM-DD`). 매일 활성 기간 안에 사이드바에 자동 등장 — 본인이 매일 todo 에 같은 항목 다시 추가하는 의식 사라짐. 종료일 지나면 자동 숨김 (마스터 보존).
- **사이드바 폴더 2개** — 할 일 탭 사이드바를 `루틴` / `태스크` collapsible 폴더로 분리. 루틴 폴더 = 그날 active 마스터 + 오늘 체크박스 + 우측 시간. 태스크 폴더 = 기존 status/category 필터. 필터/폴더 우측 카운트 숫자 제거 + "전체" 항목 List 아이콘 추가 (다른 항목과 균형). 시각 계층 = outer SectionHeader (chevron) / inner px-3 wrapper 항목 (캘린더 사이드바 패턴 통일).
- **캘린더 사이드바 통합** — 일기/할일/메모 옆에 "루틴" 섹션 추가, 그날 active routine + 체크 토글. 캘린더 grid 셀은 변경 X.
- **추가 모달 탭 분리** — `+` 모달 상단 segmented 탭 `[태스크/루틴]`. 루틴 폼 = 이름/시간/시작일/종료일. 모달 owner 를 TodosPage → App.tsx 로 이전 (RoutineDetail 마운트 중에도 사이드바 + 가 트리거 가능하도록).
- **RoutineDetail + 월별 그리드** — 컴팩트 폼 (이름 / 시간·시작일·종료일 grid) + GitHub-style 박스 (13px, rounded-[3px]) 월별 그룹화한 캘린더 레이아웃 (요일 가로 7컬럼 × 6 rows). 월들은 flex-wrap + 역순 (최신 월이 좌측/위 — 본인 매일 사용 시 시야 우선). 색은 디자인시스템 토큰 — done 검정, miss 옅음, today inset ring, future·기간외 outline. streak / heatmap 통계 시각화는 폐기 (1인 사용에 generic SaaS pattern).
- **CheckboxButton 통일** — 사이드바 / 캘린더 사이드바 / RoutineDetail 14일 list 모두 기존 todo `CheckboxButton` 사용 (3-state, category null = 회색 톤). raw 박스 X. row 패턴도 캘린더 todo row 패턴 차용 (`div role=button` + `items-start` + `mt-0.5` 정렬).
- **vault adapter / hooks / watcher** — `createRoutine`/`readRoutine`/`updateRoutine`/`deleteRoutine`/`toggleRoutineDay` + `listRoutinesActiveOn` (시작일/종료일 클램프). `useToggleRoutineDay` 가 optimistic + uid scope. watcher 의 path 분기에 routines/ 추가 — 옵시디안 모바일 외부 편집 시 사이드바 즉시 반영.

### PR #43 — 사이드바 finder: pinned + Cmd+P 통합 검색

- **한 줄 임팩트**: Cmd+P 로 vault 전체 즉시 검색
- **메모 pinned (즐겨찾기)** — frontmatter `pinned: true` (옵시디안 호환, false 면 키 제거). 사이드바 상단 "고정됨" 그룹, 트리에서 mutual exclusive. 메모 우클릭 컨텍스트 메뉴 "고정 / 해제" + 행 hover 시 unpin X. `useTogglePinMeeting` (uid scope + optimistic). `--accent-yellow` 토큰 (라이트/다크) — 별 아이콘 색.
- **Cmd+P 통합 검색** — 4 도메인 (메모/할 일/포트폴리오/일기) 결과 한 list. `useGlobalSearchIndex` 가 모달 open 시 lazy fetch (메모만 본문, todo는 title, portfolio 는 github_title + impact_summary + project, journal 은 전체 content) + 30초 staleTime cache. title + body indexOf 매칭 (vault 1MB 미만, sub-ms). 매칭 부분 `<mark>` highlight. 결과 행 우측 도메인 chip — 모든 행 통일 anchor. 도메인별 라우팅 (메모 → openMeeting, 할 일 → openTodo + todos 탭 scroll, 일기 → 캘린더 selectedDate, 포트폴리오 → 포트폴리오 탭).
- **타이틀바 검색 버튼** — 설정 옆 Search 아이콘 (데스크탑/모바일 양쪽). Cmd+P 와 동일 동작. `AppShell` 의 `onOpenSearch` prop.
- **QuickSwitcher 오버레이 크기 고정** — 640×560 (작은 화면 viewport clamp). 결과 갯수 무관 모달 자체는 안 흔들림 — 내부 list 가 flex-1 overflow-y-auto 흡수.
- **chip 공용 컴포넌트 추출** — 포트폴리오 카테고리 row 가 원본. `SelectableChip` (토글 chip — active 시 color tint bg + ring) / `RemovableChip` (입력 chip — children + 우측 정사각형 X 버튼). 포트폴리오 카테고리 + 참석자 입력 chip 양쪽 통일.
- **글로벌 `button, a { min-height: 44px }` 룰 제거** — V0.0 PWA scaffold 잔재. V0.6 부터 Tauri 데스크탑 전용 전환 후 touch target 44pt 명분 사라짐. 작은 icon 버튼들이 의도 외 height 부풀어 chip 안 X 버튼 hit 영역이 12×44 가 되던 버그도 함께 해결.
- **태그 입력 UI 시도 후 폐기** — 메모 폼/사이드바에 frontmatter `tags` 입력 + chip 필터 UI 구현해뒀다가 dogfood 중 본인이 "안 쓸 것 같다" 판단 → 제거. scan.ts 의 `tags` 파싱 + 검색 인덱스의 `tags` 필드는 옵시디안 호환 위해 dormant 보존 (옵시디안에서 박은 태그는 frontmatter 에 그대로 남음).

### PR #42 — 메모 본문 체크박스 라인 → 할 일 한 클릭 추가

- **한 줄 임팩트**: 메모 본문 `- [ ]` 한 줄을 마우스로 todos 페이지에 추가
- **보기 모드 + 버튼** — `MarkdownView` 의 task li 좌측 (체크박스 왼쪽 본문 wrapper padding 영역) 에 absolute Plus. hover 시에만 등장 (chrome 노이즈 회피). markdown 시각 정렬 안 깨짐.
- **편집 모드도 동일 위치 + 버튼** — `SourceBodyEditor` 의 GutterMarker 가 checkbox 라인일 때 gutter 좌측 외부에 같은 Plus. 기존 ⌘Enter 단축키와 한 쌍 — 마우스 작업 동선 보강.
- **공통 핸들러 재사용** — 둘 다 `lineToTaskPrefill` → `TaskAddModal` 진입. extractTodos 가 `- [x] foo --- 내일 #work` 같은 자연어 토큰 그대로 파싱 → title / due_date / category / priority prefill.
- **중복 허용** — 같은 라인 다시 클릭하면 또 모달 → 또 추가. todos 페이지가 source of truth, 메모 본문은 snapshot.
- **갭 hover off fix** — group-hover 트리거 영역 (li / gutter row) 과 absolute 버튼 사이 갭에서 마우스가 통과 시 opacity 풀리던 깜빡임. `::before` invisible hit-area 24px 좌측 확장으로 영역 이음.
- **min-height 두 줄 부풂 fix** — 글로벌 `button { min-height: 44px }` (index.css) 이 inline `height: 1rem` 을 덮어 컴퓨티드 height 44px 되던 회기. `minHeight: 0` 명시 우회. size/line-height 도 inline 으로 박아 cascade 충돌 차단.

---

## 2026-05-24

### PR #41 — 캘린더 사이드바 정리 + 셀 chip UI + 카테고리 범례

- **한 줄 임팩트**: 캘린더 화면 한눈에 들어오게
- **사이드바 3섹션 헤더** — 일기 / 할 일 / 메모. 메모장 폴더 패턴 (chevron + 13px secondary 라벨) + click collapse + 항목 count. 일기 블럭이 메모와 동일 패턴 (leftIcon + 한 줄 truncate). ATX heading `# `, `## ` prefix 만 strip — `#안녕` 같은 일반 텍스트는 보존.
- **todo navigate** — 사이드바 todo 클릭 (체크박스 외) → 할일 탭 + 필터 reset + 해당 row 로 scrollIntoView + 편집모드 자동 진입 (el.click()). `data-todoid` 박고 `scrollToTodoId` 한 번 흐름.
- **체크박스 토글 깜빡임 fix** — vault md 가 done_at 추적 안 하는데 optimistic 에 done_at=ISO 박혀서 selectedDate 가 due_date 와 다른 날일 때 잠깐 사라졌다가 invalidate 후 due_date fallback 으로 다시 나타나던 race. `useUpdateTodo.mutate` patch 에서 done_at 제거 → onlyDone 분기 (toggleTodo path) 활성, 더 안전.
- **셀 chip UI** — dot 제거 → 카테고리 색 18% alpha bg tint. 좌 label flex-1 truncate / 우 time shrink-0 (절대 잘리지 않음). text-primary 진하게. 시간 짧게 (정각 `9시`, 한자리 `9:30`). 미분류도 회색 tint visible.
- **메모 우상단 압축** — 셀 안 chip 에서 meeting 빼고 우상단 BookOpen + ClipboardList N 아이콘으로. 본문 chip area 는 todo 만.
- **selected 셀 ring** — `inset 0 0 0 2px var(--accent-blue)`. 오늘(red dot) 과 차원 분리.
- **카테고리 범례** — 헤더 좌측에 swatch (chip bg 와 동일 18% + 40% border) + 한글 라벨 (업무 / 일정 / 기타 / 미분류).
- **셀 padding inline style** — Button common sizeClass override 보정. 좌우 4px / 상하 2px.
- **외곽 grid padding 제거** — `px-3 lg:px-5` 제거, 셀 viewport 양 끝까지.
- **셀 + chip width 100%** — Button inline-flex 의 content-fit + items-start cross-axis stretch 비활성 보정. 짧은 todo 도 chip 박스가 셀 가로 폭 100%, 긴 텍스트는 truncate.
- **오늘 빨간 원 row h-5** — 다른 셀 일자 텍스트와 동일 높이 → 아래 chip 라인 어긋남 fix.
- **다른 달 opacity 한정** — 셀 전체 → day number row 에만. chip / 주말 bg / 일기 아이콘 등 정상 색.
- **주말 칸 살짝 다른 배경** — `--text-muted` 6% tint, 평일과 시각 구분.
- **`CheckboxButton` 컴포넌트 추출** — TodoRow 안 local function → `src/components/todos/CheckboxButton.tsx` 별도 파일. TodoRow + CalendarDayPanel 양쪽 재사용. hover 미리보기 svg + 카테고리 색 border tint + e.stopPropagation 내장.

### PR #40 — SourceBodyEditor 풀세트 일기 적용 + 보기 모드 일관성

- **한 줄 임팩트**: 일기에서도 마크다운 에디터 풀세트 (gutter/슬래시/단축키)
- **`SourceBodyEditor` 4 prop 추가** — `placeholder` / `className` / `textareaRef` / `onBlur`. 회의록 호출부 영향 0, 다른 소비처 재사용 baseline.
- **폰트 토큰화** — textarea `text-base` 제거 + mirror `fontSize: inherit` → outer wrapper className 의 `font-*` 가 자연스럽게 inherit. 일기 wrapper `font-serif text-[15px]`, 메모장 default.
- **`.font-serif { font-weight: 600 }` footgun 캡슐화** — `SourceBodyEditor` textarea + `MarkdownView` root 에서 fontWeight 400 가로채기. 새 소비처가 wrapper 에 font-serif 박아도 본문 weight 일관.
- **`MarkdownView` 보기 모드 일관성** — `text-base` 제거 → wrapper font-size inherit (편집/보기 토글 시 점프 차단), code/pre/table-th 배경 `bg-surface` → `bg-surface-hover` (모달 안에서 가시성).
- **`SlashCommandPopover` body portal + `position: fixed` + `z-[70]`** — 모달 `overflow-y-auto` clipping 우회 + Modal `z-60` 위로.
- **popover flip-up** — textarea 의 `closest('[role="dialog"]')` bottom 까지 안 닿게 추정 height (`opts × 28 + 8`) 로 cursor 줄 바로 위에 붙임. 메모장 (dialog 없음) 은 viewport bottom fallback.
- **`Modal` `maxWidth` prop 추가** — size 토큰의 height/flex 유지하고 가로만 override 가능 (향후 활용 baseline).

### PR #39 — portfolio 사이드바 정렬/카테고리 chip 필터 + 본문 active 배너

- **한 줄 임팩트**: 카드 많아져도 카테고리/정렬로 좁히기
- **5종 정렬 옵션** — 최신 PR / 오래된 PR / 카테고리 / 프로젝트 / 영향. `usePortfolioSort` localStorage persist (useMeetingSort 패턴 동일). 사이드바 헤더 ⇅ 아이콘 → popover.
- **카테고리 chip 다중 OR 필터** — `usePortfolioCategoryFilter` Set state. 5 카테고리 chip (UI/UX·Backend·Infra·Fix·기타) flex-wrap. active 시 카테고리 색 ring + tinted bg. fontWeight 토글 X (글자 너비 흔들림 방지).
- **본문 active filter 배너** — 카드 그리드 위 "필터: [chip] [chip] 전체 해제". 필터 켜둔 걸 까먹어 "왜 카드 적지" 당황 방지. chip 클릭 = 단독 해제, "전체 해제" 한 번에 끔.
- **사이드바 폴리시** — 카테고리 row 높이 고정 (해제 버튼 토글로 흔들리지 않게). FilterItem px-2 py-1 text-[13px] compact. SyncButton 진행 중 X 버튼 contrast 개선. sync 결과 라벨 풀어쓰기 ("새 카드 / 갱신 / 전체" + title tooltip).

### 직커밋 — portfolio sync 시 PR body 7섹션 자동 파싱 → frontmatter

- **한 줄 임팩트**: PR body 양식 그대로 적은 임팩트/카테고리가 카드 frontmatter 에 자동 들어감
- **`parsePRBodySections`** — `src/api/portfolio.ts` 에 H2 split 파서 추가. `## 한 줄 임팩트` / `## 카테고리` / `## 문제 (Why)` / `## 디자인 결정` / `## 유저가 얻는 것` / `## Before` / `## After` 7섹션 추출. `clipboardPrompt.ts` 의 `parsePRResponse()` 와 동일한 H2 split 룰.
- **`upsertPortfolioWork` 통합** — sync 신규 카드 생성 시 PR body 파싱 결과를 frontmatter 초기값으로 사용. impact_summary / category default 빈값 → PR body 양식 적었으면 자동 채움.
- **카테고리 enum 정규화** — body 의 카테고리 값이 enum (`ui_ux | backend | infra | fix | other`) 아닐 때 fallback 빈값. parsePRResponse 와 동일 규칙.
- **빈 default 필드만 sync 채우는 룰** — 본인이 모달에서 수정한 값은 sync 가 덮어쓰지 않음. impact_summary / category 가 빈 값일 때만 PR body 재파싱 결과로 갱신. 3A 보존 룰 강화.
- 직커밋 (백엔드 파싱 로직만, visual diff 0 — 포트폴리오 카드 가치 적음). commit `e3bd3b7` + `a9e36c0`.

### PR #38 — 디자인 시스템 카탈로그 페이지

- **한 줄 임팩트**: 디자인 시스템을 브라우저에서 시각 확인
- **`#styleguide` 라우트** — `src/pages/StyleguidePage.tsx` 신규. VaultGate 우회 단독 페이지. 11 섹션 (Color / Typography / Spacing / Radius / Effects / Motion / Z / Layout / Icons / Components / Writing). macOS Tauri drag region (titlebar-inset) 포함.
- **좌측 sticky 목차 사이드바** — anchor 클릭은 `scrollIntoView` (hash 변경 X — `#styleguide` 라우팅 유지).
- **타이틀바 dropdown 진입점** — `VaultBadge` (vault 폴더명) 를 Popover 로 변환. "Vault 설정" (기존 SettingsModal) / "스타일가이드" (#styleguide 진입) 두 항목.
- **voice/tone 9 카테고리 lock-in** — CLAUDE.md 에 `~합니다` 통일 / 명사형 액션 / 원인+해결 에러 / `YYYY.MM.DD` / `오전·오후 h:mm` / `예: ...` placeholder / heading+body+CTA empty state / `keep-all` wrap / em dash 금지 명시.
- **inline 빨간 박스 4자리 폐기** — `PortfolioSidePanel SyncError` / `MeetingsList ErrorState` / `MeetingForm error` 분기 / `TodosPage error` 분기. Transient 는 `useToast` (사용자 트리거 sync 만, background auto-sync 는 silent), 영구 load 실패 는 `EmptyState` (icon=AlertCircle accent-red + "다시 시도" Button) 로 통일. DESIGN.md §11.7 "에러 표현" 3 패턴 (Toast / EmptyState / Danger zone) 명시.

---

## 2026-05-23

### PR #37 — 디자인 시스템 정식화

- **한 줄 임팩트**: 9 공통 컴포넌트 + 시맨틱 토큰 + DESIGN.md 11 dimension
- **컴포넌트 추출 9개** — `src/components/common/` 에 `Modal` / `Button` / `Text` / `PageHeaderBar` / `Popover` / `EmptyState` / `Chip` / `Kbd` / `Spinner`. wrap 가능한 모든 자리 흡수 — raw `<button>` 자리 9개만 남김 (input/textarea/특수 자리만).
- **시맨틱 토큰** — `:root` 안 `--opacity-{disabled,hover,active,secondary,overlay}` / `--z-{dropdown,sticky,overlay,modal,popover,tooltip,toast}` / `--shadow-{card,modal,popover}` / `--motion-{fast,base,slow}`. `@theme` 안 박으면 Tailwind v4 default scale (z-50 / opacity-40 등) 무력화되는 케이스 발견 → `:root` 분리.
- **DESIGN.md 11 dimension** — ds-extract skill 의 표준 11 dimension (Color / Typography / Spacing / Radius / Effects / Motion / Z-index / Layout / Interaction / Icon vocabulary / Components) 다 갱신. 빠진 5 섹션 신규.
- **회기 fix 묶음** — Button base 의 `justify-center` 제거 + `text-left` 박음 (사이드바 폴더명/메모제목/할일제목 가운데 정렬되던 케이스 차단), 본문 헤더의 `lg:relative lg:top-auto` 제거 (데스크탑 sticky 무력화), MeetingForm outer `lg:h-screen` → `lg:h-full` (main padding-top 만큼 overflow scroll 차단), sub-tab 인라인 sticky 보장.
- **PageHeaderBar 추출** — 4 페이지 같은 헤더 패턴 (3-col grid + sticky + lg:shrink-0 + bg-overlay backdrop) 추출. MeetingForm 만 `sticky={false}` — flex-col 부모 안에서 shrink-0 가 자동 고정.
- **2차 추출 26 자리** — Popover (4) / EmptyState (4) / Chip (10) / Kbd (3) / Spinner (5) 자리 흡수. ds-extract 재진단 § 8 추가.
- **`--ralph` flag + ralph-loop guard** — ds-extract skill 에 `--ralph` 인자 추가 (EXTRACTION_PLAN.md 의 §7 자동 실행 섹션 추가). 사용자 개입 없이 끝까지 진행하는 큰 마이그레이션 작업의 표준 패턴 박음.
- **21 commit** — 작업 단위 (컴포넌트 정의 / 모달 클러스터 / SidePanel / MeetingForm / TodoRow / AppShell / Settings / pages / timeline / common / vault / portfolio extras / meetings extras / App+Toast / 시맨틱 토큰 / DESIGN.md / 회기 fix / 2차 추출).

### PR #36 — 할 일 카테고리 색 시그널

- **한 줄 임팩트**: 카테고리 색으로 할 일 한눈에 구분
- **단일 lookup** — `lib/todoCategory.ts` `categoryColor(category)` 가 single source. 향후 카테고리 추가/변경 (`todo.md PR — 동적 카테고리`) 시 한 곳만 확장.
- **색 토큰** — `--cat-work` 주황 (`#ea580c` / `#fb923c`), `--cat-schedule` 틸 (`#0d9488` / `#2dd4bf`), `--cat-other` 보라 (portfolio 와 공유). 처음엔 work=인디고 시안 → 보라(other)와 시각 구분 약해 work 주황으로 교체.
- **MonthGrid todo chip dot** — 셀 안 todo chip 앞 6px 색 dot. 미분류는 안 그림.
- **체크박스 디자인** — `rounded-md + 1.5px border + 4% catColor tint`. 기존 `rounded + 2px border` 보다 부드러움. tint 는 `color-mix(in srgb, ${catColor} 4%, transparent)` 로 다크모드 자동 따라감.
- **사이드바 통일성** — TodosSidePanel 의 status filter (전체/미완료/완료/취소됨) 도 카테고리 dot 패턴과 align. 12px box 안에 미완료 = `Circle` outline, 완료 = filled 원 + 흰 체크 (작은 사이즈에서도 또렷), 취소됨 = `XCircle`. 카테고리 entry 는 8px 색 dot (미분류 = `--text-muted`).
- **DueChip 정리** — bg 색 제거 (체크박스 카테고리 tint 와 layer 충돌) → outline + 글자색. 오늘 = 빨강 filled bold (액션 강조), 지남 = 빨강 outline (정보), 임박 = 회색 outline. 빨강 한 색으로 통일해 가짓수 절감. 위치도 제목 앞 → 카드 우측 끝 (Linear/Things/Todoist 패턴).
- **DESIGN.md** — 카테고리 dot 토큰 표 + 단일 lookup 위치 명시.

### PR #35 — portfolio sync 안정성 (gh search 빈 배열 fix + stuck 회복)

- **한 줄 임팩트**: 내 작업 sync 가 새 PR 안 빠뜨림
- **진짜 버그 — `gh search prs` positional 두 qualifier**: 옛 코드는 `'is:merged merged:>=DATE'` 한 arg 박았는데 gh CLI 가 빈 배열 반환 (full sync `'is:merged'` 단일은 정상). 결과적으로 last_sync 이후 머지된 PR 들이 incremental 에 누락 → 매번 [전체 다시 훑기] 수동 호출. `--merged --merged-at '>=DATE'` flag 형으로 분리해 정상 동작 (터미널 직접 확인: 0건 vs 21건).
- **runningRef stuck 회복 경로 보강**: HMR / Tauri full-reload 중 in-flight invoke 응답이 사라져 promise pending 되는 dev 환경 시나리오 방어. `useGhSync` 에 callIdRef 모노토닉 가드 — hang 된 invoke 가 뒤늦게 resolve 돼도 stale setState 무시. `cancel()` 강화 — abort + callId 증가 + runningRef 강제 false. `SyncButton` 진행 중 X 아이콘으로 manual 회복 경로 노출.
- **`readSyncState` 5s timeout fallback**: hang 시 since 없이 full sync 로 자동 fallback (since 만 손해). 옛 broken sync 가 또 나와도 incremental 가 멈추지 X.
- **5초 background auto-sync 재활성**: 옛 portfolio-card-redesign PR 의 임시 비활성 해제. CLAUDE.md V0.7 의 "5초 background auto-sync + 사이드바 수동 트리거" 명시 항목 복원.
- 6 modified. 221 tests passing. typecheck clean. 실제 동작 검증 (신규 7 + 갱신 14).

---

## 2026-05-22

### PR #34 — 메모장 사이드바 폴더 트리 + 탭 순서 swap

- **한 줄 임팩트**: 메모장 폴더 트리 + 메뉴 순서 변경
- **탭 swap** (`BottomTabs.tsx`, `App.tsx`) — TABS 배열을 캘린더 → 메모장 → 할 일 → 내 작업 순으로 (사용 빈도 우선). Cmd+1/2/3/4 가 TABS index 기반 자동 매핑이라 Cmd+1=캘린더로 의미 변경. 빈 hash default 도 캘린더 + `#meetings` hash 추가.
- **폴더 트리** (옵시디안 호환). `adapter.listRecursive` / `listFoldersRecursive` 신규 — `meetings/{folder}/` 중첩 구조 + 빈 폴더 모두 scan. `scan.ts` 에 `meetingFolder` / `normalizeFolderPath` / `moveMeetingToFolder` / `renameMeetingFolder` 등 helper. `buildMeetingsTree(meetings, sort, extraFolders)` 가 메모 + disk 빈 폴더 합쳐 트리 빌드.
- **사이드바 UI** — `MeetingsTreeView` 신규. 옵시디안 스타일 컴팩트 단일 라인 + chevron 만 폴더에 + 메모는 column align (아이콘 X). 트리 vertical guide 라인 (`border-default` 컬러로 진하게). 클릭존 = 아이콘 직전부터 (indent 공간은 wrapper paddingLeft, dead zone). 메모 진하게 (text-primary), 폴더 흐리게 (text-secondary) — leaf > organizational 위계. inline 메타: 올해 `MM/DD`, 작년 이전 `YY/MM/DD`.
- **폴더 CRUD** — 헤더 `+폴더` 버튼: '새 폴더' 즉시 생성 + 인라인 rename 자동 진입 (옵시디안 패턴). 폴더 우클릭: 이름 변경 (in-place input) / 폴더 삭제 (안 메모 휴지통 이동 + 빈 dir 정리). 메모 우클릭: 폴더로 이동... → `MoveFolderModal`.
- **DnD** 메모 → 폴더 — Tauri `dragDropEnabled: false` 로 native file-drop 가로채기 해제 + `WebkitUserDrag: element` 명시 (macOS WKWebView 호환). dragover 의 `preventDefault` 무조건 호출 (types 검사가 일부 WebView 에서 빈 배열 반환).
- **글로벌 Toast 시스템** (`Toast.tsx` 신규) — frost 카드 우측하단. mutation 실패 (메모 생성/폴더 생성/이동/이름변경/삭제) 모두 `useToast().show()` 통합. 사이드바 inline error row 제거.
- **정렬** — 폴더 alphabetic 고정, 메모만 `useMeetingSort` 적용. 폴더 / 메모 순서는 정렬 옵션과 무관하게 폴더 먼저.
- 19 files, 266 tests passing. typecheck clean.

### PR #33 — macOS 윈도우 헤더 통합 + sidebar collapse

- **한 줄 임팩트**: 윈도우 헤더 통합으로 본문 +56px
- **`titleBarStyle: Overlay` + `hiddenTitle: true`** — native titlebar bar 제거, traffic lights 만 시스템이 유지. 옆 영역 `data-tauri-drag-region` 으로 윈도우 드래그.
- **vault badge + 탭 4개 + settings/theme 한 줄 통합** — SidePanel 안 TopTabsRow 56px 사라지고 윈도우 헤더로 흡수. 본문 수직 +56px 확보.
- **vault column 너비 = SidePanel 너비 line up** — "vault 안에 sidebar + main" 시각 계층. 추후 multi-vault switcher 발판 (vault badge 클릭 = settings vault section, 추후 dropdown).
- **folder tab pattern** — active 탭이 main 색 (`--bg-base`) 으로 빠져나와 헤더 borderBottom 을 `-1px` 넘어가 가림 → main 영역과 시각 연결. Chrome/옵시디안 탭 strip 패턴.
- **header height `--page-header-h: 52px` 토큰 통일** — 사이드바 헤더 4곳 (메모장/캘린더/할일/포트폴리오 SidePanel) + 본문 헤더 4곳 (MeetingForm/TodosPage/CalendarPage/PortfolioPage) 같은 줄에 align. 캘린더 month label 도 같이.
- **내 작업 페이지 sticky 헤더 신설** — 다른 페이지와 동일 패턴 + 동일 높이.
- **sidebar collapse `Cmd+\`** — 옵시디안 패턴. `useSidebarCollapsed` hook (localStorage `goodsoob:sidebarCollapsed` persist).
- **`isMacTauri` 판별** — macOS Tauri 만 효과. Windows/Linux Tauri + 웹 = `--titlebar-inset: 0` fallback. mobile drawer 영향 X.
- **Tauri capability `core:window:allow-start-dragging`** — `data-tauri-drag-region` 동작 위해 추가.
- 시도하다 거부: vibrancy material (`windowEffects: ["sidebar"]` + `transparent` + `macOSPrivateApi`) — sidebar 가 wallpaper 비쳐 디자인 토큰 무력화. tabs | vault 순서 — mental model "vault > tabs" 시각 mismatch.
- 14 modified + 2 new + 2 screenshots. 221 tests passing. typecheck clean.
- commit `055532f`

### PR #32 — F-1 카드 + 모달 편집 + 가이드북 + 휴지통 분리

- **한 줄 임팩트**: 카드 한눈에 N장 + 모달로 안전한 편집
- **F-1 가로형 dense 카드** — 썸네일 96×72 left + impact main + PR title 부제 + 메타 chip 4개 (날짜·프로젝트·카테고리·코드줄). 카테고리 dot 색 5종, 프로젝트 = repo 부분만, 메타 row 좁아지면 자연 truncate. 1280px 폭에서 카드 일람 가능 — 회고/평가 자료 가치 회복.
- **카드 = 읽기 전용, 편집은 모달 통합** — PortfolioDetailModal: 좌 viewer (큰 스크린샷 + 좌우 nav + thumb strip + dropzone) / 우 편집 패널 (impact, 카테고리/프로젝트 select, Claude 자동 채움). read-only ↔ edit mode 분리. `[편집]` 진입 → draft state → `[수정 완료]` / `[취소]` / 모달 닫기 = 자동 취소. todo "inline 편집" 대신 modal 편집으로 trade — impact 실수 저장 0.
- **Claude CLI 자동 호출** — `claude -p` shell spawn (gh CLI 패턴 동일). 구독 자격 활용, API key 결제 0. 응답 → draft 박스에 `[적용]` / `[다시 요청]` / `[×]`. 수동 paste 도 details 토글로 보존.
- **휴지통 도메인 분리** — vault `.trash/` (메모장) 와 `portfolio/.trash/` 분리. 복원 = 항상 `included: false` (미사용 자리). 휴지통/가이드북에 "전체 동기화 시 부활" 안내.
- **가이드북 모달** — 사이드바의 PR 가이드 / Legacy 프롬프트 + 동기화 설명 + `[전체 다시 훑기]` 모달 안으로 통합. 사이드바 깔끔.
- **incremental vs 전체 sync 분리** — 사이드바 = incremental, 가이드북 = 전체. `useGhSync.run` race 차단 (`runningRef`) + 5초 background auto-sync 임시 비활성 (todo 에 안정성 PR 등록).
- 본인 수정 frontmatter (impact / category / project / included / screenshots) 는 sync 가 절대 안 덮어씀.
- commit `a282157`

### PR #31 — 메모장/일기 단축키 단순화 (Q/W/E 제거 + Opt+Tab cycle)

- **한 줄 임팩트**: 한글 IME 와 안 싸우는 메모장 sub-tab 단축키
- **Q/W/E single-key + Opt+Q/W/E 두 블록 제거** (`MeetingForm.tsx`) — 통증: textarea 안에서 "ㅂ/ㅈ/ㄷ" (Q/W/E 자리) 타이핑이 단축키 분기와 헷갈렸음 + macOS Opt dead-key (œ/∑/´) preventDefault 도 같이 사라짐. e.code 매칭으로 IME 무관이긴 했지만 "메모 안에선 안 막힘 / 밖에선 발사" 라는 분기 자체가 인지 부하.
- **Opt+Tab / Opt+Shift+Tab = sub-tab cycle** (본문→음성기록→요약→본문, Shift 역순). textarea/input focus 무관. `SourceBodyEditor.tsx` 의 Tab handler 에 `!e.altKey` 가드 추가 — 일반 Tab=indent 보존하면서 Opt+Tab 만 window-level cycle 로 양보. 평소 indent 동작 깨짐 0.
- **Cmd+Shift+E = 본문 탭 편집/보기 토글** — `SourceBodyEditor` 의 Cmd+E (inline-code wrap, `` `text` ``) 와 충돌 회피로 Shift 동반. 다른 탭에선 no-op.
- **일기 (JournalOverlay) 도 Cmd+Shift+E 로 통일** — 기존 Cmd+E 였는데 메모장과 같은 키로 묶음. Eye/Pencil 토글 버튼 툴팁도 `⌘⇧E`.
- **설정 → 단축키 탭 갱신** — sub-tab 그룹 (Opt+Tab cycle + Cmd+Shift+E) + "일기 (캘린더)" 그룹 신설 + 본문 편집 그룹에 `⌘Enter → 할 일 inbox` 누락분 보강.
- **TabBtn `Q/W/E` kbd chip + ModeChip 툴팁 + EmptyBodyCTA `Q` kbd** 모두 `⌘⇧E` 표기 또는 제거.
- 5 modified (CLAUDE.md + 4 src). 221 tests passing. typecheck clean.
- commit `83ed237`

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
