# Progress

다음 세션이 빠르게 파악할 수 있도록 짧게 유지.

## 현재 상태 (2026-05-20, PR #12 land 직후)

**메모장 키보드 흐름 + 너그러운 날짜·시간 입력** 완료 (PR #12, main `660b48a`). 14 feature commit + 2 fix commit. Tauri 데스크탑에서 메모 작성을 키보드만으로 끝낼 수 있게 단축키 정리 + LooseDate/Time 자유 형식 입력 + undo/redo 1-stack 통합. ESC 동작 확장 검토 중 발견한 두 회귀 (메타 input revert / 휴지통 V0.7.1 호환) 도 같은 PR 에 묶음.

**다음 세션 진입점 미정** — V0.7.x 후보 (Tauri 2 Mobile, 전체 재동기화 등) 또는 V0.6.1 robustness 후속 중 dogfood 결과로 결정.

## 이번 세션에 한 일 (2026-05-20)

### PR #12 land — 메모장 키보드 흐름 + 날짜·시간 파싱 넓히기

브랜치 `feat/keyboard-shortcuts-and-loose-datetime` 의 14 feature commit 검토 중 발견된 2 bug 를 추가 fix 한 후 머지. 카테고리 `ui_ux`.

검토 중 발견·fix 한 2 bug:

1. **ESC revert race** — LooseDate/Time + AttendeeTagInput 의 ESC 핸들러가 `setDraft(value)` (async) + `blur()` (sync) 호출 → `onBlur → commit()` 가 stale draft 클로저 읽고 수정값을 저장. ESC 가 blur 만 하고 revert 안 되던 회귀. ref flag (`skipCommitRef` / `skipBlurAddRef`) 로 다음 blur 의 commit 한 번 skip.
2. **휴지통 V0.7.1 호환** — `listDeletedMeetings` + `restoreFromTrash` 가 옛 V0.6 date-prefix 패턴 강제. V0.7.1 title-as-filename 메모 삭제 시 휴지통에 안 나타나고 복원 시 vault 루트로 떨어지던 회귀. 순수 일기 패턴 (`YYYY-MM-DD.md`) 만 제외하도록 invert — legacy + V0.7.1 둘 다 메모로.

브랜치 본체 (다른 세션 작업) 의 핵심 변경:
- Tauri 단축키 (Q/W/E single-key sub-tab + Cmd+N/Backspace/↑↓/1-4 페이지 등). 브라우저는 시스템 단축키 충돌로 skip.
- `lib/dates.ts` 신규 — parseLooseDate/Time + 요일 단축 ("월" → 가장 가까운 그 요일).
- undo/redo 1 stack docHistory — 본문/transcript/요약/meta 도큐먼트 timeline. 제목은 native input undo + rename 별도.
- 본문 line gutter 클릭 줄 선택, GlobalTooltip wrap, 헤더 height 통일, breakpoint 640px 등 polish.

## 알아야 할 컨텍스트

- **vault 모델 V0.7.1** — main meeting 의 frontmatter = `id: <uuid>` + `date` (optional) + `time` + `attendees` + `tags`. **frontmatter 에 title 없음**. 파일명 = `meetings/{title}.md`. 옛 V0.6 메모 (date prefix + frontmatter title) 는 lazy migration — 첫 read 시 uid 발급 + frontmatter rewrite.
- **client cache key 통일** — React Query queryKey / `HISTORY_CACHE` / URL hash / hook signature 모두 uid 기반. `useUpdateMeeting(uid)` 가 mutationFn 시점에 list cache 의 path lookup.
- **vault 위치**: `/Users/ham/Library/Mobile Documents/iCloud~md~obsidian/Documents/goodsoob/` (사용자 dogfood vault).
- **휴지통 필터 invert** (V0.7.1 후속): `listDeletedMeetings` (`src/api/meetings.ts:134`) + `restoreFromTrash` (`src/lib/vault/scan.ts:488`) 가 V0.6 date-prefix 강제 → 순수 일기 패턴만 제외하는 negative filter 로. 새 메모 카테고리 (예: 미래에 portfolio 가 trash 사용) 추가하면 이 자리도 같이 봐야 함.
- **ESC race 패턴** — input 컴포넌트의 ESC 핸들러에서 `setDraft(value)` 후 `blur()` 호출 시 onBlur 가 stale draft commit 하는 race. ref flag (`skipCommitRef`) 로 다음 commit skip. 새 input 컴포넌트 만들 때 같은 패턴 의식.
- **현재 worktree 상태**: `goodsoob-work` (main repo, `feat/meetings-ux-polish` — chip 작업 다른 세션), `goodsoob-work-ux` (방금 main 으로 복귀).

## V0.6.1 후속 (dogfood 와 병행)

- [ ] Conflict resolution 모달 (현재 throw 만)
- [ ] Vault 변경 UI (설정 페이지)
- [ ] iCloud `(conflicted copy)` 파일 무시 룰
- [ ] vault 스캔 성능 실측 + frontmatter-only fast path
- [ ] vault 폴더 사라짐 graceful
- [ ] frontmatter parse 실패 graceful fallback — YAML 깨졌을 때 빈 frontmatter + body 그대로 → 사이드바 표시 보장.
- [ ] uid 중복 감지 + 후순위 재발급
- [ ] 깨진 파일 사용자 alert — 사이드바 banner

## 미해결

- 캘린더 스크롤 상태 페이지 전환 시 보존.
- 에러 상태 패딩 통일 (p-3/p-4 혼재).
- V0.5.3~V0.5.4 lint 11 errors (기존 코드 react-hooks/refs) — dogfood 단계에서 정리.
- `syncPortfolio` 안 `[syncPortfolio]` 진단 console.log — dogfood 안정화 후 제거.
- `backup-pre-pr-split` branch 안전망 — dogfood 며칠 후 삭제 결정.
- Vercel 대시보드 disconnect (선택).
