# Progress

다음 세션이 빠르게 파악할 수 있도록 짧게 유지.

## 현재 상태 (2026-05-20, PR #14 land + dogfood 후 todo.md 재구조화)

**휴지통 overlay 도입** 완료 (PR #14, main `e62ad30`). 그 후 dogfood 1 세션 진행 → 13 항목 발견 → todo.md 를 PR 단위 21개로 재구조화 + done.md 신설 (`accbc8a`).

**다음 세션 진입점**: `.auto-select-fix.md` (untracked) — trash-cleanup 작업 중 발견한 메모장 자동선택 버그. fix 코드는 작성됨 + revert 됨 + 별 PR 대기. 새 worktree (`fix/meetings-auto-select`) 셋업해서 가장 먼저 land.

그 다음 잡고 갈 PR 후보 (사용자가 선호하는 순서):
1. 빠른 polish — toast overflow / radial wipe / undo 변경 탭 전환
2. 마크다운 typing UX — Tab/Enter 자동연장/URL paste/smart dashes/빈영역 클릭
3. 큰 신규 — 루틴 또는 Tauri 헤더 통합 (둘 다 단독 PR 크기)

## 이번 세션에 한 일 (2026-05-20)

### dogfood 13개 항목 검토 + todo.md PR 단위 재구조화

사용자 dogfood 발견 항목 (제목 그대로):
- 투두 매일 하는 할일 / 에러 박스 overflow / undo·redo 통합 / 체크박스+코드블록 / 자동 선택 / line gutter 이어짐 / 텍스트 색상 / `---` 한 줄 / Opt+QWE / 테마 전환 애니 / 헤더 디자인 / 시간 키워드 / textarea 빈영역 클릭

각 항목 깊게 분석 + 옵션 비교 + 사용자 결정 받음. 핵심 결정 사항:

- **루틴 (매일 할일)** — `routines/` 폴더 + 1 routine = 1 md 파일 + Obsidian Tasks 호환 라인 이력 누적 + ActivityBar 새 탭 + 12주 heatmap. todos / journals 와 분리.
- **line gutter "이어짐" 표시** — opacity 폐기 → SVG **dotted vertical (┊) + dotted corner**. inferLineKind 에 다음 줄 look-ahead 추가. 사용자가 점선 corner 선호 명시 (solid ╰ 거부).
- **테마 전환 애니** — (c) cascade stagger 가 아니라 **(d) radial wipe from toggle**. View Transitions API + clip-path. macOS 시스템 다크모드 토글과 동일 패턴. ~15줄.
- **Tauri 윈도우 헤더** — α (ActivityBar 헤더 흡수) + β (배경 통일) 결합 = **γ**. 본문 +48px + 무경계.
- **단축키 cheatsheet 모달** — `?` 키 진입점 별도 추가 X (PR #13 의 설정 모달 단축키 섹션으로 가치 달성). todo 에서 제거.
- **메타 undo/redo** — 메타 3 field (date/time/attendees) 는 PR #12 `b8ec87d` 에서 docHistory 통합 완료. 제목만 남음 → todo 좁힘.
- **smart dashes** — macOS 가 `--` → `—` 변환해서 `---` (hr) / 마크다운 표 입력 불가. textarea autoCorrect/spellCheck off + input event intercept fallback.
- **마크다운 입력 자동화** — Tab/Shift+Tab indent (리스트 안 list level) + Enter 자동 list marker 연장 + 빈 marker Enter 종료 + IME composition 안전. 옵시디안 표준 동작.
- **마크다운 단축키** — ⌘B/⌘I wrap (toggle) + Alt+↑/↓ 줄 이동 + ⌘Shift+D 복제 + URL paste over selection 자동 링크.
- **Opt+Q/W/E** — input/textarea 포커스에서도 동작. macOS default 글자 preventDefault. Tauri + 브라우저 둘 다.

### todo.md 재구조화 (16 신규 + 기존 V0.6.1/V0.7.x 통합)

PR 단위로 21개. 각 PR 에 한 줄 임팩트 후보 + 카테고리 (`ui_ux | backend | infra | fix`) 라벨 — 카드 frontmatter `impact_summary` 로 직접 옮길 수 있게. dogfood 항목 추가:
- 날짜/시간 표시 포맷 통일 (메모 사이드바 카드 + 휴지통 카드 + 앱 전체 검토 + `lib/dates.ts` 단일 함수)

### done.md 신설

`PR #12 / #13 / #14 + dogfood 확인 2건` 아카이브. todo.md → done.md 로 이동 패턴 정착.

## 알아야 할 컨텍스트

- **vault 모델 V0.7.1** — main meeting frontmatter = `id: <uuid>` + `date` (optional) + `time` + `attendees` + `tags`. frontmatter 에 title 없음. 파일명 = `meetings/{title}.md`. lazy migration.
- **client cache key 통일** — uid 기반. `useUpdateMeeting(uid)` 가 mutationFn 시점에 path lookup.
- **vault 위치**: `/Users/ham/Library/Mobile Documents/iCloud~md~obsidian/Documents/goodsoob/`
- **백업 위치**: vault 내 `.backups/goodsoob-vault-YYYYMMDD-HHmmss.zip` — dot prefix 라 scanner/watcher 무시
- **휴지통 필터 invert** (V0.7.1 후속): `listDeletedMeetings` + `restoreFromTrash` 가 negative filter. 새 메모 카테고리 추가 시 같이 봐야 함.
- **ESC race 패턴** — input 컴포넌트 ESC 핸들러 `setDraft(value) → blur()` 가 onBlur stale draft commit race. `skipCommitRef` 로 다음 commit skip.
- **자동 백업 confirm vs silent** — 자동은 토글 시점에 rotation 사전 동의 → silent. 수동은 한도 가득 시 modal confirm.
- **DocSnapshot 통합** — `useStateHistory` 1 stack = `{ body, transcript, summary, meta(date+time+attendees) }`. 제목은 별도 (native input undo).
- **현재 worktree 상태**: `goodsoob-work-trash-cleanup` 은 PR #14 + todo 재구조화 후 정리 대기. `.auto-select-fix.md` 별 worktree 분리 필요.

## 미해결

- **자동선택 fix 별 PR** — `.auto-select-fix.md` 의 fix 를 새 worktree (`fix/meetings-auto-select`) 로 land. 가장 먼저.
- 자동 백업 첫 실행 zip 시간 — 큰 vault 면 1-10초 멈춤. spinner toast 등 검토.
- vault liveness 3초 polling 외장 디스크 sleep spin-up risk — dogfood 빈도 봐서 조정.
- 캘린더 스크롤 상태 페이지 전환 보존.
- 에러 상태 패딩 p-3/p-4 혼재.
- V0.5.3~V0.5.4 lint 11 errors (기존 코드 react-hooks/refs).
- `syncPortfolio` 진단 console.log 제거 (dogfood 안정화 후).
- `backup-pre-pr-split` branch 안전망 — 며칠 후 삭제 결정.
- Vercel 대시보드 disconnect (선택).
