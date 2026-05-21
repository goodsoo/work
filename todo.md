# todo

진행 중 / 후보만. 완료 기록은 [done.md](done.md) 참조.

🔥 = 우선순위 높음 (dogfood 통증). 🟡 = 일반 후보. 🟢 = 진행 중.

---

## 🟡 V0.6.1 후속 (dogfood 단계)

- [ ] 🔥 **깨진 파일 사용자 alert** — 사이드바 banner: "N 개 메모를 읽지 못했어요" → 디스크 path. UX 약점 (메모 사라진 듯) 해소.
- [ ] 🔥 **vault 폴더 사라짐 모달** — 외장 디스크 disconnect 시 사용자 모달 (감지는 PR #13 완료, UI 만 남음).
- [ ] **Conflict resolution 모달** — 현재는 ConflictError throw 만. UI 에서 "내 변경 보존 / 외부 변경 가져오기" 선택지 + `.conflict-*.md` 파일 생성.
- [x] ~~iCloud sync 충돌 파일 무시 룰~~ — V0.7.2 `isSyncNoiseFile` 헬퍼 (conflicted copy / .icloud / dotfile).
- [x] ~~frontmatter parse 실패 시 graceful fallback~~ — `parseVaultFile` 이미 graceful (yaml 깨져도 빈 fm fallback). V0.7.2 scanMeetings catch 에 console.warn 추가로 디버깅 보강.

---

## 🟡 V0.7 dogfood 진행 중

- [ ] **다른 owner repo legacy 카드 backfill** — "내 작업" 탭의 "Legacy 카드 프롬프트" 버튼 복사 → 각 repo Claude Code 에 붙여넣어 카드 생성.
- [ ] **회사 owner repo 도 PR 워크플로 전환 시도** — branch + 셀프 PR + auto-merge (셸 alias 로 5초). 매 commit 마다 PR description 작성이 평가 자료 품질 ↑. goodsoo/work 양식 (`buildPRGuidePrompt()`) paste 로 적용.
- [ ] **backup-pre-pr-split branch 삭제 결정** — PR 분할 안전망. dogfood 며칠 후 안전 확인되면 `git branch -D`.

---

## 🟡 V0.7.x 후속 (dogfood 결과로 결정)

- [x] ~~전체 재동기화 버튼~~ — 이미 사이드바 `SyncButton` + `PortfolioPage` onSync 가 since 없이 호출 (V0.7.2 확인). 백그라운드 auto sync 만 incremental (`{since}`) 사용.
- [x] ~~portfolio 진단 console.log 제거~~ — V0.7.2 제거 완료.
- [ ] **gh search concurrency 5 병렬 enrich**. 4A 직렬. 매일 사용에서 첫 sync 3분 통증 크면 도입.
- [ ] **회사 HTTPS outbound 차단 시 자동 sync 끄기 설정**. dogfood 시 매일 토스트 떠야 발견.
- [ ] **gh 미설치 / 미로그인 별도 모달** — 현재는 sync error 가 sidebar inline 메시지. 첫 dogfood 시 본인 경험 안 좋으면 추가.
- [ ] **commit cluster 카드 모델** (Plan B) — owner repo PR 워크플로 전환 부담 크면 → branch 단위 cluster + AI 입력 commit messages.
- [ ] **PR body 이미지 자동 import → screenshots frontmatter**. sync 가 PR body 의 `<img src>` / `![](url)` 패턴 추출 → URL fetch → `_attachments/{slug}/before-N.png` 다운로드 → screenshots 자동 채움. 본인이 dropzone 으로 박은 거 있으면 보존. dogfood 가치: 매 PR 마다 카드 dropzone 으로 두 번 더 박는 수고 제거. private repo URL 은 gh auth token 활용.
- [ ] **내 작업 수동 추가** — portfolio 탭에서 GitHub 무관 카드 (오프라인 업무 / 회의 발표 / 방금 한 작업 등) 직접 만들기. UI: "새 카드" 버튼 → title/date/category/impact_summary 입력 + screenshots dropzone → 저장. frontmatter `github_pr_id` 없거나 0 → sync 가 건드리지 않음 (legacy 카드 schema 그대로 활용). 평가 자료에 PR 외 활동도 포함 가능.

---

## 🟡 V0.7 다른 후보 (V0.7 dogfood 후 진입)

- [ ] **Tauri 2 Mobile**. 모바일에서 본인 디자인 UI 사용.
- [ ] **"Claude 응답 paste → 자동 callout"** (회의록 영역).
- [ ] **녹음 파일 직접 업로드 → 자동 STT**.
- [ ] **Tauri 데스크탑 앱 빌드 마무리**. `bun run tauri:build` 로 .dmg 생성 + 코드 사인.

---

## 🟡 UX 후보

- [ ] **메모 검색 (사이드바 검색창)**. 옵시디안 quick switcher 패턴 — title + body 즉시 매칭, scope toggle (현재 탭 / 전체). 단축키 `Cmd+P`. 메모 많아지면 사이드바 스크롤 한계.
- [ ] **메모 태그 필터 (frontmatter `tags`)**. 사이드바 위에 태그 chip 행. 클릭하면 그 태그 메모만. frontmatter `tags: [foo, bar]` 입력 UI 는 별 작업.
- [ ] **본문 textarea word-wrap + gutter dynamic alignment**. 현재 `wrap="off"` 라 긴 줄 가로 scroll. 사용자 의도: 자연 줄넘김 + 좌측 gutter marker 가 wrap 된 visual line 과 정확히 align. 방법: hidden mirror div 가 textarea 와 같은 width/font/line-height/word-break 으로 source line 별 actual visual height 측정 → gutter marker height 동기. ResizeObserver 로 textarea width 변경 감지 + debounce. 작업 ~40-50줄. 한국어 글자 width 일치 + textarea native scroll bar 영향 등 측면 주의. 본인이 한국어 메모 길게 자주 → 가치 ↑.
- [ ] **메모 제목/날짜/시간/참석자 undo·redo** (`⌘+Z`). 본문 textarea 의 undo 와 일관성. 4 field 각각 `useStateHistory<string>` 도입 + `onCommit` noop (자동 mutation X) + 명시 commit (blur/Enter) 시 mutation. undo/redo 자체는 mutation 트리거 안 함 — undo 후 blur 안 하면 frontmatter 변경 X (또는 undo/redo callback 안에서 자동 commit 처리). 본인이 dogfood 에서 meta typo 후 `⌘+Z` 원한 빈도로 가치 결정.
- [ ] **휴지통 자동 선택 + 미리보기 + 복원**. 휴지통 진입 시 첫 항목 자동 선택 + 메모 미리보기 (read-only). 비어있으면 placeholder ("휴지통이 비어있어요"). 휴지통 빠져나오면 기존에 선택돼 있던 메모로 복원. DeletedMeetingsList + 미리보기 컴포넌트 + App.tsx selection 복원 로직.
- [ ] **단축키 cheatsheet 모달** (옵시디안 패턴). `?` 같은 단축키로 모달 띄움 — 페이지 탭 (Cmd+1/2/3/4) / 메모 sub-tab (Cmd+[/]) / 편집-보기 토글 (Cmd+E) / undo (Cmd+Z) 등 모든 단축키 한 곳에. 모달 진입점 (`?` 키 또는 우상단 keyboard 아이콘) + 모달 본체 (디자인 토큰 기반).

---

## 🟡 안정성 / 위생

- [ ] **useDebouncedSave race 검토** — V0.7.2 useStateHistory 의 stale closure race 가 일기 본문 자동 저장 / 캘린더 자동 저장 패턴에도 있는지 점검. `set + immediate flush` 같은 turn 호출 케이스 있으면 `valueRef` 동기 갱신 적용.
- [ ] **자동 백업 spinner toast** — vault 크기 따라 첫 zip 1-10초 침묵 = 사용자 불안. 1초+ 면 toast 띄움.
- [ ] **lint 11 errors 정리** — V0.5.3~V0.5.4 부터 잔존 (react-hooks/refs). dogfood 단계 한 번에 정리.
- [ ] **Vercel 대시보드 disconnect** — deploy 는 `vercel.json` 으로 막혔지만 대시보드 연동은 잔존. 선택.

---

## 🟡 디자인 / UI 폴리싱

- [x] ~~에러 상태 패딩 통일~~ — V0.7.2 PortfolioSidePanel SyncError 박스를 다른 사이드바 알림 톤(rounded px-2 py-1, 2px border)에 맞춤. toast(p-3) ↔ page-level(p-4) 차이는 의도된 분기로 유지.
- [ ] **캘린더 스크롤만으로 다른 월 본 상태 보존**. selectedDate 안 바뀐 채 스크롤만 이동한 경우는 페이지 전환 시 복원 안 됨. 명시적 날짜 클릭은 OK.
