# Progress

다음 세션이 빠르게 파악할 수 있도록 짧게 유지.

## 현재 상태 (2026-05-20, PR #14 land 직후)

**휴지통 overlay 도입** 완료 (PR #14, main `e62ad30`). 메모장 사이드패널 footer 🗑️ → 중앙 overlay 모달 + 좌측 list (stamp prefix 잘려 원본 제목만) + 우측 본문 미리보기. 영구삭제 + 휴지통 비우기 ConfirmDialog 일관. 삭제 시각 `yyyy.mm.dd(요일) hh:mm`. 카테고리 `ui_ux`.

**다음 세션 진입점**: `.auto-select-fix.md` (untracked) — trash-cleanup 작업 중 발견한 메모장 자동선택 버그. 별 PR 로 분리. 새 branch `fix/meetings-auto-select` 셋업해서 진행.

## 이번 세션에 한 일 (2026-05-20)

### PR #14 land — 휴지통 overlay + 본문 미리보기 + 비우기

브랜치 `feat/trash-cleanup`, 카테고리 `ui_ux`. 머지 후 worktree + 로컬/원격 branch 정리 필요.

핵심 변경:

- **휴지통 overlay (`TrashModal.tsx`)** — 사이드패널 footer 🗑️ → 중앙 z-50 모달. SettingsModal 과 같은 패턴 (좌측 aside + 우측 section + ESC/백드롭 닫기). max-w-5xl × min(640px, 85vh). 사이드패널 view 모드 (list ↔ trash) 폐기 → App.tsx 의 state stash·restore 흐름 통째 제거.
- **stamp prefix 표시 계층에서 strip** — 디스크 표현 (`.trash/{stamp}-{base}.md`) 유지. 사이드바 row 렌더 시점에 정규식 `^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-` 잘라 표시명만 사용. scanTrash 가 이미 deletedAt 분리 반환.
- **본문 미리보기 (`TrashPreview.tsx`)** — read-only. 제목 + meta (date/time/attendees) + 본문 + 회의 내용 + 요약 callouts. 모달 우측 panel 로 mount.
- **ConfirmDialog 컴포넌트** — `src/components/ConfirmDialog.tsx`. 영구삭제 + 휴지통 비우기 둘 다. ESC = 취소, Enter = 확인, 바깥 클릭 = 취소. cancel 에 default focus (실수 방지). 디자인 토큰 + danger 모드 (accent-red). 기존 native `window.confirm` 대체.
- **휴지통 비우기 (`emptyTrash` + `useEmptyTrash`)** — `.trash/` 의 메인 메모 + sidecar 모두 영구 삭제. sequential `purgeMeeting` 호출 + 잔여 cleanup. aside header 의 메모 count 옆 빨간 `비우기` 버튼.
- **삭제 시각 포맷 (`formatDateTimeKo`)** — `2026.05.17(일) 14:09`. 같은 분 안 여러 삭제 구별 가능. sidebar row + TrashPreview 헤더 (앞에 우상단 "휴지통 미리보기" 배지 있어서 본문 meta 에서는 빼고 sidebar 만).
- **자동선택 fix 분리** — trash-cleanup 작업 중 메모장 첫 메모 자동선택 안 되는 버그 발견 (hash marker 가 selectedMeetingId 로 set 되어 effect 가 fallback skip). 진단 + fix 완료했지만 trash 와 무관해서 `.auto-select-fix.md` 에 작업 내용 저장 + App.tsx 부분 revert. 다음 세션에서 별 PR.

## 알아야 할 컨텍스트

- **vault 모델 V0.7.1** — main meeting 의 frontmatter = `id: <uuid>` + `date` (optional) + `time` + `attendees` + `tags`. **frontmatter 에 title 없음**. 파일명 = `meetings/{title}.md`. 옛 V0.6 메모 (date prefix + frontmatter title) 는 lazy migration — 첫 read 시 uid 발급 + frontmatter rewrite.
- **client cache key 통일** — React Query queryKey / `HISTORY_CACHE` / URL hash / hook signature 모두 uid 기반. `useUpdateMeeting(uid)` 가 mutationFn 시점에 list cache 의 path lookup.
- **vault 위치**: `/Users/ham/Library/Mobile Documents/iCloud~md~obsidian/Documents/goodsoob/` (사용자 dogfood vault).
- **백업 위치**: vault 내 `.backups/goodsoob-vault-YYYYMMDD-HHmmss.zip`. dot prefix 폴더라 vault scanner/watcher 무시. vault 폴더 옮길 때 백업도 자동 따라감.
- **휴지통 필터 invert** (V0.7.1 후속): `listDeletedMeetings` (`src/api/meetings.ts:134`) + `restoreFromTrash` (`src/lib/vault/scan.ts:488`) 가 V0.6 date-prefix 강제 → 순수 일기 패턴만 제외하는 negative filter 로. 새 메모 카테고리 (예: portfolio trash) 추가하면 이 자리도 같이 봐야 함.
- **ESC race 패턴** — input 컴포넌트의 ESC 핸들러에서 `setDraft(value)` 후 `blur()` 호출 시 onBlur 가 stale draft commit 하는 race. ref flag (`skipCommitRef`) 로 다음 commit skip. 새 input 컴포넌트 만들 때 같은 패턴 의식.
- **자동 백업 confirm vs silent** — 자동은 사용자가 토글 켠 시점에 rotation 사전 동의 → silent. 수동은 명시 액션이라 한도 가득 시 modal confirm. 같은 모달 컴포넌트 재사용 (이번엔 한 mode 만, action prop 제거).
- **현재 worktree 상태**: `goodsoob-work` (main repo, `feat/meetings-ux-polish` — chip 작업 다른 세션). `goodsoob-work-trash-cleanup` 은 PR #14 머지 직후 — 정리 대기 (자동선택 fix 새 worktree 시작 시점에).

## V0.6.1 후속 (dogfood 와 병행)

- [ ] Conflict resolution 모달 (현재 throw 만)
- [x] ~~Vault 변경 UI (설정 페이지)~~ — PR #13 처리
- [x] ~~vault 폴더 사라짐 graceful~~ — PR #13 처리 (3초 polling + focus event)
- [ ] iCloud `(conflicted copy)` 파일 무시 룰
- [ ] vault 스캔 성능 실측 + frontmatter-only fast path
- [ ] frontmatter parse 실패 graceful fallback — YAML 깨졌을 때 빈 frontmatter + body 그대로 → 사이드바 표시 보장.
- [ ] uid 중복 감지 + 후순위 재발급
- [ ] 깨진 파일 사용자 alert — 사이드바 banner

## 미해결

- 자동 백업 첫 실행 시 zip 시간 (vault 크기 따라 1-10초) — 본인 vault 가 크면 첫 실행 잠깐 멈춤 인지될 수 있음. dogfood 후 spinner toast 등 검토.
- vault liveness 3초 polling 의 외장 디스크 sleep spin-up risk — 실측 dogfood 중 발견 시 빈도 조정.
- 캘린더 스크롤 상태 페이지 전환 시 보존.
- 에러 상태 패딩 통일 (p-3/p-4 혼재).
- V0.5.3~V0.5.4 lint 11 errors (기존 코드 react-hooks/refs) — dogfood 단계에서 정리.
- `syncPortfolio` 안 `[syncPortfolio]` 진단 console.log — dogfood 안정화 후 제거.
- `backup-pre-pr-split` branch 안전망 — dogfood 며칠 후 삭제 결정.
- Vercel 대시보드 disconnect (선택).
