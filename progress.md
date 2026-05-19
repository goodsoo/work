# Progress

다음 세션이 빠르게 파악할 수 있도록 짧게 유지.

## 현재 상태 (2026-05-19 밤, V0.7.1 land 직후)

**V0.7.1 vault hardening 완료** (PR #11). dogfood 중 발견한 메모 사라짐 추적 → 다섯 root cause 일괄 fix + frontmatter UUID id 도입 + Title-as-Filename 모델 전환. 이제 cache 침범 / partial write / event matching / mutation race 카테고리 모두 차단. **다음 세션 = 진입점 미정** — V0.7.x 후보 (Tauri 2 Mobile, 전체 재동기화 등) 또는 V0.6.1 robustness 후속 중 dogfood 결과로 결정.

## 이번 세션에 한 일 (2026-05-19)

### PR #11 land — vault 데이터 손실 race 5종 + UUID identity 모델

8 commit, main 8a65e4a 머지. 카테고리 `backend`. portfolio 카드 다음 sync 때 자동 생성.

다섯 root cause:
1. **`adapter.write` 동시성** — 공유 `.tmp` 파일이 두 동시 write 가 race → 첫 rename 으로 tmp 소진 + 두 번째 remove 가 결과 파일 삭제 → 두 번째 rename ENOENT → 파일이 진짜 사라짐. per-path mutex + 고유 tmp 이름 (`${abs}.${random}.tmp`) 으로 차단.
2. **`useUpdateMeeting` mutation race** — 병렬 mutation 의 closure 가 옛 id 들고 rename 후 stale ENOENT. React Query v5 `scope: { id: meeting:${uid} }` 직렬화 + mutationFn 의 effective id 재조회.
3. **Enter→blur 중복 발사** — title input 의 Enter handler 가 `commitTitle()` + `blur()` 둘 다 호출 → onBlur 가 commitTitle 또 발사. Enter 에서 commitTitle 호출 제거, blur 만.
4. **vault watcher event type 매칭** — Tauri v2 plugin-fs event `type` 이 object (`{create:{kind:"file"}}` 등) 인데 옛 `String(...)` 검사가 `"[object Object]"` 라 항상 실패 → 외부 변경 영영 반영 X. object key 분기 + metadata noise skip + macOS `.Trash` rename → deleted.
5. **path collision 침범** — 옛 메모 삭제 후 새 메모가 같은 path 차지 시 `HISTORY_CACHE` 의 옛 entry 가 새 entity 에 침범. 처음엔 cleanup 코드로 막으려 했으나 silent failure burden 영구. → 옵시디안 community 표준 (`obsidian-unique-identifiers` plugin 패턴) 채택, frontmatter `id: <uuid>` 도입, 모든 client cache key 를 uid 기반으로.

### 부수 변경 — Title-as-Filename 모델

- 파일명 = `meetings/{title}.md` only. date 빠짐 (frontmatter optional). frontmatter title 도 제거 (파일명이 곧 title, 옵시디안 default).
- 옛 모델의 모순 해소 — date 가 optional 인데 파일명엔 무조건 박혀있던 불일치.
- title 변경 = pure disk rename → inode 유지 (옵시디안 모델 동일).
- 충돌 자동 -2 안 함 → `TitleConflictError` throw → toast + ESC revert + focus 유지.
- 금지문자 (`/ \ : * ? " < > | # ^ [ ]`) commit 시점 검사 → toast.
- `slugify` 단순화 — 한글/공백 그대로, 위험문자만 치환.

### 의사결정 컨텍스트

- **다른 AI 자문** — cleanup 코드 (path 기반 cache + delete/rename 시 청소) 는 silent failure 위험 영구 burden 으로 평가. 옵시디안 community 표준 + 데이터 손실 0 우선순위에서 UUID frontmatter 가 옳음.
- **inode-기반 cache + in-place write** 대안은 iCloud daemon partial sync 위험과 정면 충돌 — V0.6 의 모바일 옵시디안 sync use case 와 양립 불가.
- **TitleConflictError 자동 -2 안 함** — 사용자가 의도한 title 과 silently 다른 파일명 생성 회피. UX 의 정직성 우선.

## 알아야 할 컨텍스트

- **vault 모델 V0.7.1** — main meeting 의 frontmatter = `id: <uuid>` + `date` (optional) + `time` + `attendees` + `tags`. **frontmatter 에 title 없음**. 파일명 = `meetings/{title}.md`. 옛 V0.6 메모 (date prefix + frontmatter title) 는 lazy migration — 첫 read 시 uid 발급 + frontmatter rewrite.
- **client cache key 통일** — React Query queryKey / `HISTORY_CACHE` / URL hash / hook signature 모두 uid 기반. `useUpdateMeeting(uid)` 가 mutationFn 시점에 list cache 의 path lookup.
- **vault 위치**: `/Users/ham/Library/Mobile Documents/iCloud~md~obsidian/Documents/goodsoob/` (사용자 dogfood vault).
- **현재 worktree 상태**: `goodsoob-work` (main repo, `feat/meetings-ux-polish` checkout — chip 작업 다른 세션), `goodsoob-work-ux` (`feat/keyboard-shortcuts-and-loose-datetime` — 단축키 + datetime 작업 다른 세션). 두 작업 모두 main 의 V0.7.1 변경과 conflict 가능 — merge 시 자연 처리.

## V0.6.1 후속 (dogfood 와 병행)

- [ ] Conflict resolution 모달 (현재 throw 만)
- [ ] Vault 변경 UI (설정 페이지)
- [ ] iCloud `(conflicted copy)` 파일 무시 룰
- [ ] vault 스캔 성능 실측 + frontmatter-only fast path
- [ ] vault 폴더 사라짐 graceful
- [ ] frontmatter parse 실패 graceful fallback (PR #11 후 추가) — YAML 깨졌을 때 빈 frontmatter + body 그대로 → 사이드바 표시 보장.
- [ ] uid 중복 감지 + 후순위 재발급 (PR #11 후 추가)
- [ ] 깨진 파일 사용자 alert — 사이드바 banner (PR #11 후 추가)

## 미해결

- 캘린더 스크롤 상태 페이지 전환 시 보존.
- 에러 상태 패딩 통일 (p-3/p-4 혼재).
- V0.5.3~V0.5.4 lint 11 errors (기존 코드 react-hooks/refs) — dogfood 단계에서 정리.
- `syncPortfolio` 안 `[syncPortfolio]` 진단 console.log — dogfood 안정화 후 제거.
- `backup-pre-pr-split` branch 안전망 — dogfood 며칠 후 삭제 결정.
- Vercel 대시보드 disconnect (선택).
