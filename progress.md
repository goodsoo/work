# Progress

다음 세션이 빠르게 파악할 수 있도록 짧게 유지.

## 현재 상태 (2026-05-20, PR #13 land 직후)

**설정 탭 도입** 완료 (PR #13, main `cd183d1`). 사이드패널 footer ⚙️ → 중앙 모달 + 좌측 sub-nav (Vault / 백업 / 단축키 / 도움말). vault 폴더 변경/연결 해제, 자동 백업 (zip), vault 사라짐 자동 감지, 단축키 cheatsheet, 날짜·시간 입력 형식 도움말 한 자리에. 카테고리 `ui_ux`.

**다음 세션 진입점 미정** — V0.7.x 후보 (Tauri 2 Mobile, 전체 재동기화, 기간별 백업 등) 또는 V0.6.1 robustness 후속 중 dogfood 결과로 결정.

## 이번 세션에 한 일 (2026-05-20)

### PR #13 land — 설정 탭

브랜치 `feat/settings-tab`, 카테고리 `ui_ux`. 머지 후 worktree + 로컬/원격 branch 정리 완료.

핵심 변경:

- **설정 모달** — 사이드패널 footer 우측 ⚙️ 진입점. 중앙 모달 (z-50) + 좌측 sub-nav (44/Vault/백업/단축키/도움말 4 섹션) + 우측 detail. ESC / 백드롭 닫기. macOS System Settings 패턴.
- **Vault 폴더 변경/해제** — 현재 path 표시, "다른 폴더로 변경" (`setVaultRoot` 재호출 → watcher 재시작 + queryClient.clear), "연결 해제" (`disconnect` → localStorage clear → VaultGate 가 자동 VaultPicker 표시). 둘 다 confirm 패턴 (해제는 z-60 모달).
- **Vault 사라짐 자동 감지** (`VaultProvider`) — 3초 주기 `adapter.exists("")` polling + window `focus` 이벤트. false 또는 throw 시 즉시 `handleVaultGone` (watcher.stop + clearInterval + listener 정리 + localStorage clear + queryClient.clear + vaultRoot=null). 외장 디스크 unmount / Finder 삭제 / iCloud 디렉토리 이동 모두 cover.
- **백업 (zip)** — `src/lib/backup.ts` 신규. macOS 기본 `zip` 을 `sh -lc` 로 호출 (기존 portfolio shell capability 재사용). vault 내부 `.backups/` 에 저장 (dot prefix 라 scanner 자동 무시). zip 생성 시 `.backups/*` exclude 로 self-inclusion 방지. `tmp → rename` atomic.
  - **보관 10개 고정** (사용자 설정 X) — 처음엔 user-configurable 로 만들었으나 "한도 감소 confirm" 흐름 복잡 + 본인이 실제로 바꿀 일 거의 없음 → 단순성 우선.
  - **자동 백업** — vault ready 후 10초 background. 주기 12시간/1/3/7일 (사용자 토글). 한도 초과 예정이면 가장 오래된 N개 silent rotation (사용자 사전 동의).
  - **수동 백업** — 한도 가득 시 z-60 confirm 모달 ("삭제 후 백업" / "취소"). 실수 방지.
- **단축키 cheatsheet** — 4 그룹 (페이지 / 메모 관리 / sub-tab / 편집). `<kbd>` chip + 디자인 토큰.
- **도움말** — `parseLooseDate` / `parseLooseTime` 의 지원 형식 예시. 날짜 (자연어 / 요일 / 전체 / 짧은 형식 / 압축 / 한글) + 시간 (기본 / 12시간제 / 압축).
- **레이아웃** — 단축키·도움말 모두 `grid-cols-[repeat(auto-fit,minmax(240px,1fr))]` — 모달 폭에 따라 1↔2 열 자동.
- **todo.md** — V0.7.x 후속에 "기간별 백업 (incremental / bucket 패턴)" 추가. vault 가 커지면 full zip × 10개 부담될 때 진입 후보.

### `/new-pr` skill 개선

- `~/.claude/commands/new-pr.md` 에 `<intent>` 선택 인자 추가. 새 worktree 루트에 `.pr-intent.md` (untracked) 작성 → 새 세션 시작 시 Claude 가 `git status` 에서 인지 → 작업 의도 추측 불필요. 작업 끝나면 본인이 직접 삭제.

## 알아야 할 컨텍스트

- **vault 모델 V0.7.1** — main meeting 의 frontmatter = `id: <uuid>` + `date` (optional) + `time` + `attendees` + `tags`. **frontmatter 에 title 없음**. 파일명 = `meetings/{title}.md`. 옛 V0.6 메모 (date prefix + frontmatter title) 는 lazy migration — 첫 read 시 uid 발급 + frontmatter rewrite.
- **client cache key 통일** — React Query queryKey / `HISTORY_CACHE` / URL hash / hook signature 모두 uid 기반. `useUpdateMeeting(uid)` 가 mutationFn 시점에 list cache 의 path lookup.
- **vault 위치**: `/Users/ham/Library/Mobile Documents/iCloud~md~obsidian/Documents/goodsoob/` (사용자 dogfood vault).
- **백업 위치**: vault 내 `.backups/goodsoob-vault-YYYYMMDD-HHmmss.zip`. dot prefix 폴더라 vault scanner/watcher 무시. vault 폴더 옮길 때 백업도 자동 따라감.
- **휴지통 필터 invert** (V0.7.1 후속): `listDeletedMeetings` (`src/api/meetings.ts:134`) + `restoreFromTrash` (`src/lib/vault/scan.ts:488`) 가 V0.6 date-prefix 강제 → 순수 일기 패턴만 제외하는 negative filter 로. 새 메모 카테고리 (예: portfolio trash) 추가하면 이 자리도 같이 봐야 함.
- **ESC race 패턴** — input 컴포넌트의 ESC 핸들러에서 `setDraft(value)` 후 `blur()` 호출 시 onBlur 가 stale draft commit 하는 race. ref flag (`skipCommitRef`) 로 다음 commit skip. 새 input 컴포넌트 만들 때 같은 패턴 의식.
- **자동 백업 confirm vs silent** — 자동은 사용자가 토글 켠 시점에 rotation 사전 동의 → silent. 수동은 명시 액션이라 한도 가득 시 modal confirm. 같은 모달 컴포넌트 재사용 (이번엔 한 mode 만, action prop 제거).
- **현재 worktree 상태**: `goodsoob-work` (main repo, `feat/meetings-ux-polish` — chip 작업 다른 세션), `goodsoob-work-trash-cleanup` (`feat/trash-cleanup` — 다른 세션). `goodsoob-work-settings-tab` 은 PR #13 머지 후 제거.

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
