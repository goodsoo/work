# Progress

다음 세션이 빠르게 파악할 수 있도록 짧게 유지.

## 현재 상태 (2026-05-20, PR #15 open)

**V0.7.2 — 안정성 race 묶음 + 사이드바 정렬** (PR #15 https://github.com/goodsoo/work/pull/15, branch `feat/small-fixes`). 카테고리 `fix`. PR open 상태 — CI 통과 후 사용자 merge.

핵심 변경 11종:

- **useMeeting list-loaded gate** — 새로고침 시 hash 의 uid 가 즉시 set → detail queryFn 이 list 보다 먼저 돌고 uidToPath miss → null 영구 캐시 → 본문 영구 skeleton 이던 race 차단. `useMeeting` 이 `useMeetings().isSuccess` 까지 대기 (`src/hooks/useMeetings.ts`).
- **readFullMeeting throw + retry** — `adapter.exists` false 시 null 대신 throw. React Query 자동 retry (1·2·4초) 가 iCloud 짧은 sync 중 stuck 자동 복구. 진짜 실패는 error UI 의 "재시도" 버튼이 잡음 (`src/api/meetings.ts`).
- **useStateHistory valueRef race fix** — `set` 안에서 valueRef 동기 갱신, `flush` 가 그걸 사용. set + immediate flush 같은 turn 호출 시 closure 의 stale value 가 history 에 박혀 undo 가 안 먹던 race. 시간/날짜 commit 후 undo 가 정상 동작 (`src/hooks/useStateHistory.ts`).
- **docHistory cacheKey path → uid** — title 변경 = file rename 이라 cacheKey 가 매번 새로 잡혀 그 메모의 편집 history 가 통째로 사라지던 거 해결 (`src/components/meetings/MeetingForm.tsx`).
- **isSyncNoiseFile** — `(conflicted copy)`, `.icloud` placeholder, dotfile 을 scanMeetings/Journals/AllTodos/Trash 에서 모두 제외 (`src/lib/vault/scan.ts`).
- **Tauri assetProtocol enable** — `tauri.conf.json` 의 `app.security.assetProtocol = { enable: true, scope: ["$HOME/**"] }`. `Cargo.toml` 에 `tauri` feature `protocol-asset` 추가. 이게 없어서 portfolio 카드의 vault 안 스크린샷이 안 떴음.
- **사이드바 정렬 popover** — 최신순 (기본) / 오래된순 / 이름순. 키 우선순위 `date → time → mtime`. localStorage `goodsoob:meetingSort` persist. `useMeetingSort` hook (`src/hooks/useMeetingSort.ts`) + SortMenu (`src/components/nav/SidePanel.tsx`).
- 날짜/시간 input 색 `--text-secondary` → `--text-primary` 로 통일.
- 달력/시계 아이콘 툴팁 제거 + MetaRow `iconTitle` prop dead code 제거.
- portfolio `[syncPortfolio]` 진단 console.log 제거.
- PortfolioSidePanel SyncError 박스를 다른 사이드바 알림 톤 (rounded px-2 py-1, 2px border) 으로 통일.
- scanMeetings catch 에 `console.warn(path, err)` — read 실패 메모 디버깅용.

스크린샷은 `.github/screenshots/feat-small-fixes/` 에 commit, PR body 에 raw.githubusercontent + commit SHA URL 로 박음 (drag&drop 0번).

## 다음 진입점

- **PR #15 merge 대기** — CI 통과 후 land.
- **다른 worktree 의 chip 작업** (`feat/meetings-ux-polish`), **trash-cleanup** (`feat/trash-cleanup`) 진행 중일 수 있음. 충돌 영역 (MeetingForm.tsx, SidePanel.tsx, scan.ts) 가 겹침 — merge 순서 따라 rebase 필요할 듯.
- **V0.7.x 후보 중 dogfood 통증 명확해진 거부터**:
  - 깨진 파일 사용자 alert (사이드바 banner)
  - uid 중복 감지 + 후순위 재발급
  - vault 폴더 사라짐 모달 (이미 vault liveness 감지는 PR #13 에서 했음, 모달만 필요)
  - 단축키 cheatsheet 모달 (todo line 60)

## 알아야 할 컨텍스트

- **vault 모델 V0.7.1** — main meeting 의 frontmatter = `id: <uuid>` + `date` (optional) + `time` + `attendees` + `tags`. **frontmatter 에 title 없음**. 파일명 = `meetings/{title}.md`. 옛 V0.6 메모는 lazy migration.
- **client cache key 통일** (V0.7.2 부터 docHistory 까지) — React Query queryKey / `HISTORY_CACHE` (docHistory cacheKey 포함) / URL hash / hook signature 모두 uid 기반.
- **null 캐시 stuck 패턴** (V0.7.2 교훈) — TanStack Query 의 queryFn 이 null 반환하면 영구 캐시되어 자동 refetch trigger 없음. 일시적 실패 (iCloud, list cache miss) 는 **throw → retry** 패턴이 안전. 진짜 missing 도 retry 후 error UI 로 사용자 인지.
- **useStateHistory race 패턴** (V0.7.2 교훈) — `set(next)` 의 setValue 가 비동기라 같은 turn 의 `flush()` useCallback closure 는 stale value 봄. valueRef 동기 갱신 필요. 이 hook 의 다른 사용처 (useDebouncedSave 등) 도 같은 패턴 의식.
- **vault 위치**: `/Users/ham/Library/Mobile Documents/iCloud~md~obsidian/Documents/goodsoob/` (사용자 dogfood vault).
- **백업 위치**: vault 내 `.backups/goodsoob-vault-YYYYMMDD-HHmmss.zip`. dot prefix 라 vault scanner/watcher 무시.
- **ESC race 패턴** — input 컴포넌트의 ESC 핸들러에서 `setDraft(value)` 후 `blur()` 호출 시 onBlur 가 stale draft commit 하는 race. ref flag (`skipCommitRef`) 로 다음 commit skip. 새 input 컴포넌트 만들 때 같은 패턴.
- **PR 스크린샷 자동 첨부** — 사용자가 `~/Screenshots/goodsoob-work/{slug}-{before|after}-N.png` 저장만 하면, PR 만드는 시점에 Claude 가 repo 안 `.github/screenshots/{branch}/` 에 commit + raw URL 박음. drag&drop 0번. 메모리 `feedback_pr_screenshot_auto_attach.md` 에 패턴.
- **assetProtocol scope `$HOME/**`** (V0.7.2) — `fs:scope-home-recursive` 와 동등 권한. 좁히려면 vault root 동적 scope 가 필요한데 별 작업. `Cargo.toml` 의 `tauri` feature `protocol-asset` 가 동작 조건.

## V0.6.1 후속 (dogfood 와 병행)

- [ ] Conflict resolution 모달 (현재 throw 만)
- [x] ~~Vault 변경 UI~~ — PR #13
- [x] ~~vault 폴더 사라짐 graceful~~ — PR #13 (감지). 모달 UI 만 별 항목으로 남음.
- [x] ~~iCloud `(conflicted copy)` 무시~~ — PR #15
- [ ] vault 스캔 성능 실측 + frontmatter-only fast path
- [x] ~~frontmatter parse graceful fallback~~ — `parseVaultFile` 이미 graceful 임 확인. PR #15 console.warn 만 추가.
- [ ] uid 중복 감지 + 후순위 재발급
- [ ] 깨진 파일 사용자 alert — 사이드바 banner

## 미해결

- 자동 백업 첫 실행 시 zip 시간 (vault 크기 따라 1-10초) — dogfood 후 spinner toast 검토.
- vault liveness 3초 polling 의 외장 디스크 sleep spin-up risk.
- 캘린더 스크롤 상태 페이지 전환 시 보존.
- V0.5.3~V0.5.4 lint 11 errors (기존 코드 react-hooks/refs) — dogfood 단계 정리.
- `backup-pre-pr-split` branch 안전망 — 며칠 후 삭제 결정.
- Vercel 대시보드 disconnect (선택).
- `useDebouncedSave` 가 useStateHistory 와 같은 stale closure race 가지는지 검토 (V0.7.2 교훈 적용).
