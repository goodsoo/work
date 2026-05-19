# todo

## 🟢 완료 — V0.6 (2026-05-17~18, Vault 마이그레이션)

- [x] **로컬 파일 기반 데이터 저장 검토 → 채택**. 옵시디안 스타일 vault 폴더 + md 파일. 회사 공유 + 외부 도구 호환 + 1인 사용 모두 충족.
- [x] **Vault layer foundation**. adapter (Tauri fs + in-memory) + parser (frontmatter H1 split) + tasks (inline syntax + toggle) + scan + watcher.
- [x] **Optimistic concurrency**. `expectedMtime` 으로 동시 편집 충돌 감지 (`ConflictError`).
- [x] **Atomic write**. tmp 파일 → rename. 중간 crash 시 원본 보존.
- [x] **API/hooks vault 백엔드로 swap**. useMeetings/Journals/Todos/Schedules 시그니처 유지, 내부만 vault.
- [x] **id 체계 변경**. UUID → file path / `file#L{line}` (todo).
- [x] **soft delete**. Supabase `deleted_at` → `.trash/` 폴더 (옵시디안 호환).
- [x] **attendees**. string CSV → string[] (frontmatter array).
- [x] **VaultPicker / VaultGate**. 첫 실행 시 폴더 선택 모달.
- [x] **Auth 완전 제거**. AuthGate / SignInScreen / useAuth / Google OAuth.
- [x] **Claude 프롬프트 복사 헬퍼**. SummarizeButton 대체. 본문+transcript+meta → 클립보드.
- [x] **Supabase 완전 제거**. supabase 폴더 + Edge Functions + 클라이언트 + 자동 생성 타입 + deps.
- [x] **PWA 빌드 폐기**. Tauri 데스크탑 전용 (vite-plugin-pwa 제거).
- [x] **28 + 3 unit test 추가**. parser/tasks/tasks-toggle/watcher/conflict/clipboardPrompt.

---

## 🟡 V0.6.1 후속 (dogfood 단계)

- [x] **parser KNOWN_H1 만 섹션 경계** (2026-05-18). 사용자가 본문에 `# 회의 제목` 같은 H1 적으면 파서가 새 섹션 시작으로 오해 → UI 본문 빈 화면 + 매 저장마다 블록 누적 (한 파일에 11번 중복). `splitH1Sections` / `patchSection` 모두 `본문`/`회의 내용`/`요약` 만 경계로 인식하도록 수정. 회귀 테스트 추가.
- [ ] **Conflict resolution 모달**. 현재는 ConflictError throw 만. UI 에서 "내 변경 보존 / 외부 변경 가져오기" 선택지 + `.conflict-*.md` 파일 생성.
- [ ] **Vault 변경 UI**. 설정 페이지에 "다른 vault 폴더로 변경" 버튼. 현재는 localStorage 수동 비워야 picker 다시 뜸.
- [ ] **Vault 폴더 picker 후 첫 인덱싱 진행률**. 큰 vault 인 경우 spinner.
- [ ] **vault 스캔 성능 실측**. 수백 파일 < 50ms 가설 검증. 실측 후 frontmatter only 부분 캐시 도입할지 결정.
- [ ] **iCloud sync 충돌 파일 무시 룰**. `(conflicted copy)` 같은 OS sync 자체 파일 vault 스캔에서 제외.
- [ ] **vault 폴더 사라짐 graceful 처리**. 외장 디스크 disconnect 시 모달.

---

## 🟢 완료 — V0.7 (2026-05-18, "내 작업" 탭)

- [x] **V0.7 step 1~10 핵심 구현** (단일 세션). design doc: `~/.gstack/projects/goodsoob-work/ham-main-design-20260518-105501.md` (v2.3, plan-eng-review + plan-design-review CLEAR).
- [x] **dogfood fix** (실사용 중 발견):
  - capability `fs:scope` 에 dotfile path 추가 (`.synced.md` 등)
  - `ensureVaultStructure` + `syncPortfolio` + `writeSyncState` 에 portfolio mkdir
  - gh state 필터 case-insensitive + "MERGED" (GraphQL enum)
  - 사이드바 마지막 sync 결과 표시 (신규/갱신/전체)
- [x] **자동 분류 + rename 감지** (dogfood 중 결정):
  - **repo → project 자동 매핑** — `projects.md` 의 `repos: [...]` 배열로 신규 카드 자동 분류. 첫 sync 시 unique repo 마다 1 project 부트스트랩 (옵시디안에서 한국어 rename / merge 가능).
  - **github_pr_id 영구 식별자** — owner/repo rename 시 vault 카드 + `_attachments` + `projects.md repos` 자동 갱신. 본인 수정 필드 (impact_summary/project/category/screenshots/notes) 보존.
  - **legacy 카드** — `pr_number=0` 허용. owner repo 에서 PR 안 만들고 직접 commit 하는 워크플로 cover (claude code 가 git log 보고 vault 에 카드 생성).
  - **카드 자동 삭제 0** — GitHub repo 삭제되어도 vault 카드 보존 (본인 평가 자료 안전).
- [x] **테스트** — 11 test files, **88 tests**. typecheck + cargo check 통과.

---

## 🟡 V0.7 dogfood 진행 중 (1주일 매일 사용)

- [ ] **첫 평가 자료 누적 시즌까지 매일 사용** — 다음 분기 평가 시 portfolio 탭만 띄워서 5분 내 펼쳐보일 수 있는지 검증.
- [x] **legacy 카드 작성 프롬프트 + 복사 버튼** (2026-05-18). `buildLegacyCardPrompt(vaultRoot)` + PortfolioSidePanel 의 `ClipPromptButton`. vaultRoot 는 `useVault()` 에서 주입 (picker 바뀌어도 자동 반영, 미설정 시 vault 선택 안내). owner repo `goodsoo/work` 자체에도 적용 → V0.0~V0.7 마일스톤 5장 카드 + `projects.md` 에 `goodsoo-work` slug 추가.
- [ ] **다른 owner repo legacy 카드 backfill** — "내 작업" 탭의 "Legacy 카드 프롬프트" 버튼 복사 → 각 repo Claude Code 에 붙여넣어 카드 생성.
- [x] **goodsoo/work PR 워크플로 셋업** (2026-05-18 밤). 23 commit 을 5 PR 로 retroactive 분할 — V0.5.x polish (#1) / V0.6 vault (#2) / V0.7 portfolio (#3) / ops CI+Vercel (#4) / PR body 7섹션 양식 (#5). `.github/workflows/ci.yml` 도입 (push/PR 마다 typecheck + test:run). `vercel.json` 으로 main deploy 비활성화.
- [ ] **회사 owner repo 도 PR 워크플로 전환 시도** — branch + 셀프 PR + auto-merge (셸 alias 로 5초). 매 commit 마다 PR description 작성이 평가 자료 품질 ↑. goodsoo/work 양식 (`buildPRGuidePrompt()`) paste 로 적용.
- [ ] **backup-pre-pr-split branch 삭제 결정** — PR 분할 안전망. dogfood 며칠 후 안전 확인되면 `git branch -D`.

## 🟡 V0.7.x 후속 (dogfood 결과로 결정)

- [ ] **전체 재동기화 버튼** — since 무시하고 full fetch. rename 발생 시 옛 PR 도 매칭 가능. 사이드바 SyncButton 옆 별도 트리거.
- [ ] **gh search concurrency 5 병렬 enrich**. 4A 직렬. 매일 사용에서 첫 sync 3분 통증 크면 도입.
- [ ] **`gh search prs` 페이지네이션**. 1000 개 넘는 케이스. 본인 1-2년치 cover 검증 후 결정.
- [ ] **회사 HTTPS outbound 차단 시 자동 sync 끄기 설정**. dogfood 시 매일 토스트 떠야 발견.
- [ ] **gh 미설치 / 미로그인 별도 모달** — 현재는 sync error 가 sidebar inline 메시지. 첫 dogfood 시 본인 경험 안 좋으면 추가.
- [ ] **"GitHub 에서 사라진 카드 식별" 도구** — 본인 클릭 시 "이 카드 PR 이 GitHub 에 없습니다. 보관/휴지통/무시?" 선택. 자동 삭제 절대 X.
- [ ] **portfolio 진단 console.log 제거** — `syncPortfolio` 안 `[syncPortfolio]` log. dogfood 안정화 후.
- [ ] **commit cluster 카드 모델** (Plan B) — owner repo PR 워크플로 전환 부담 크면 → branch 단위 cluster + AI 입력 commit messages.

## 🟡 V0.7 다른 후보 (V0.7 dogfood 후 진입)

- [ ] **Tauri 2 Mobile**. 모바일에서 본인 디자인 UI 사용.
- [ ] **"Claude 응답 paste → 자동 callout"** (회의록 영역).
- [ ] **녹음 파일 직접 업로드 → 자동 STT**.
- [ ] **Server-side 메모 history**. vault 방식이면 git commit 으로도 가능.
- [ ] **Tauri 데스크탑 앱 빌드 마무리**. `bun run tauri:build` 로 .dmg 생성 + 코드 사인.

---

## 🟠 다음 세션 진입 — 모바일 layout 통일 (drawer)

- [ ] **모바일 = 데스크탑 3-pane 구조 + SidePanel 만 overlay drawer 화**. BottomTabs 유지, 햄버거는 모바일 헤더 좌측, 드로어 폭 288 (데스크탑 기본), dim 탭/스와이프 좌로 닫기, drawer 내용 = SidePanel 만 (ActivityBar 제외). 기획 완료, 구현 대기.
  - 변경: `AppShell.tsx` (drawer state + 햄버거 + overlay + body scroll lock + swipe + DrawerContext)
  - 변경: `App.tsx` (모바일/데스크탑 메모장 분기 제거 → 단일 렌더, 자동 선택 로직 흡수)
  - 제거: `MeetingsPage.tsx` 파일 자체 deprecate (역할 없어짐)
  - 변경: `MeetingForm.tsx` `lg:hidden` 뒤로가기 버튼 2개 제거
  - 변경: 각 SidePanel 의 item onClick 안에서 `closeDrawer()` 호출 (context)
  - 결정사항: 메모 선택 시 자동 drawer 닫기, BottomTab 변경 시 자동 닫기, 햄버거 = 토글 (✕ 로 변경 X), drawer 가 헤더 + BottomTabs 까지 dim 으로 덮을지는 구현 직전 결정. v1 에서 swipe-from-edge 열기 미구현.
  - 자세한 기획: `progress.md` 참조.

## 🟡 UX 후보

- [ ] **휴지통 자동 선택 + 미리보기 + 복원**. 휴지통 진입 시 첫 항목 자동 선택 + 메모 미리보기 (read-only). 비어있으면 placeholder ("휴지통이 비어있어요"). 휴지통 빠져나오면 기존에 선택돼 있던 메모로 복원. DeletedMeetingsList + 미리보기 컴포넌트 + App.tsx selection 복원 로직.
- [ ] **단축키 cheatsheet 모달** (옵시디안 패턴). `?` 같은 단축키로 모달 띄움 — 페이지 탭 (Cmd+1/2/3/4) / 메모 sub-tab (Cmd+[/]) / 편집-보기 토글 (Cmd+E) / undo (Cmd+Z) 등 모든 단축키 한 곳에. sub-tab tooltip 에서 단축키 표시는 이미 제거된 상태 (`MeetingForm.tsx` TabBtn). 모달 진입점 (`?` 키 또는 우상단 keyboard 아이콘) + 모달 본체 (디자인 토큰 기반).

## 🟡 디자인 / UI 폴리싱 (남은 작업)

- [ ] **에러 상태 패딩 통일**. p-3 / p-4 혼재.
- [ ] **캘린더 스크롤만으로 다른 월 본 상태 보존**. selectedDate 안 바뀐 채 스크롤만 이동한 경우는 페이지 전환 시 복원 안 됨. 명시적 날짜 클릭은 OK.
- [ ] **mock-vault/.obsidian 무시**. `.gitignore` 에 추가.

---

## 🟢 완료 이전 버전 (참고용)

V0.6 (Vault 마이그레이션): Supabase 제거 + 로컬 md vault + Tauri 전용 + Claude 프롬프트 복사.
V0.5.4 (캘린더 연속 스크롤): 주 단위 연속 스크롤 + 1일 진입 기준 헤더 + 2026 이전 차단 + 다른 해 연도 표시.
V0.5.3 (메모 history 분리): cacheKey 4-stack + 페이지 전환 시 보존 + 진입 자동 선택.
V0.5.2 (3-탭 + transcript): 본문/회의 내용/요약 탭 + line gutter + 글로벌 툴팁.
