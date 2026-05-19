# todo

진행 중 / 후보만. 완료 기록은 [done.md](done.md) 참조.

---

## 🟡 V0.6.1 후속 (dogfood 단계)

- [ ] **Conflict resolution 모달**. 현재는 ConflictError throw 만. UI 에서 "내 변경 보존 / 외부 변경 가져오기" 선택지 + `.conflict-*.md` 파일 생성.
- [ ] **Vault 변경 UI**. 설정 페이지에 "다른 vault 폴더로 변경" 버튼. 현재는 localStorage 수동 비워야 picker 다시 뜸.
- [ ] **Vault 폴더 picker 후 첫 인덱싱 진행률**. 큰 vault 인 경우 spinner.
- [ ] **vault 스캔 성능 실측**. 수백 파일 < 50ms 가설 검증. 실측 후 frontmatter only 부분 캐시 도입할지 결정.
- [ ] **iCloud sync 충돌 파일 무시 룰**. `(conflicted copy)` 같은 OS sync 자체 파일 vault 스캔에서 제외.
- [ ] **vault 폴더 사라짐 graceful 처리**. 외장 디스크 disconnect 시 모달.

---

## 🟡 V0.7 dogfood 진행 중 (1주일 매일 사용)

- [ ] **첫 평가 자료 누적 시즌까지 매일 사용** — 다음 분기 평가 시 portfolio 탭만 띄워서 5분 내 펼쳐보일 수 있는지 검증.
- [ ] **다른 owner repo legacy 카드 backfill** — "내 작업" 탭의 "Legacy 카드 프롬프트" 버튼 복사 → 각 repo Claude Code 에 붙여넣어 카드 생성.
- [ ] **회사 owner repo 도 PR 워크플로 전환 시도** — branch + 셀프 PR + auto-merge (셸 alias 로 5초). 매 commit 마다 PR description 작성이 평가 자료 품질 ↑. goodsoo/work 양식 (`buildPRGuidePrompt()`) paste 로 적용.
- [ ] **backup-pre-pr-split branch 삭제 결정** — PR 분할 안전망. dogfood 며칠 후 안전 확인되면 `git branch -D`.

---

## 🟡 V0.7.x 후속 (dogfood 결과로 결정)

- [ ] **전체 재동기화 버튼** — since 무시하고 full fetch. rename 발생 시 옛 PR 도 매칭 가능. 사이드바 SyncButton 옆 별도 트리거.
- [ ] **gh search concurrency 5 병렬 enrich**. 4A 직렬. 매일 사용에서 첫 sync 3분 통증 크면 도입.
- [ ] **`gh search prs` 페이지네이션**. 1000 개 넘는 케이스. 본인 1-2년치 cover 검증 후 결정.
- [ ] **회사 HTTPS outbound 차단 시 자동 sync 끄기 설정**. dogfood 시 매일 토스트 떠야 발견.
- [ ] **gh 미설치 / 미로그인 별도 모달** — 현재는 sync error 가 sidebar inline 메시지. 첫 dogfood 시 본인 경험 안 좋으면 추가.
- [ ] **"GitHub 에서 사라진 카드 식별" 도구** — 본인 클릭 시 "이 카드 PR 이 GitHub 에 없습니다. 보관/휴지통/무시?" 선택. 자동 삭제 절대 X.
- [ ] **portfolio 진단 console.log 제거** — `syncPortfolio` 안 `[syncPortfolio]` log. dogfood 안정화 후.
- [ ] **commit cluster 카드 모델** (Plan B) — owner repo PR 워크플로 전환 부담 크면 → branch 단위 cluster + AI 입력 commit messages.
- [ ] **PR body 이미지 자동 import → screenshots frontmatter**. sync 가 PR body 의 `<img src>` / `![](url)` 패턴 추출 → URL fetch → `_attachments/{slug}/before-N.png` 다운로드 → screenshots 자동 채움. 본인이 dropzone 으로 박은 거 있으면 보존. dogfood 가치: 매 PR 마다 카드 dropzone 으로 두 번 더 박는 수고 제거. private repo URL 은 gh auth token 활용. PR #9 (`feat(nav): SidePanel 상단 탭`) 부터 적용되면 첫 효과 확인.

---

## 🟡 V0.7 다른 후보 (V0.7 dogfood 후 진입)

- [ ] **Tauri 2 Mobile**. 모바일에서 본인 디자인 UI 사용.
- [ ] **"Claude 응답 paste → 자동 callout"** (회의록 영역).
- [ ] **녹음 파일 직접 업로드 → 자동 STT**.
- [ ] **Server-side 메모 history**. vault 방식이면 git commit 으로도 가능.
- [ ] **Tauri 데스크탑 앱 빌드 마무리**. `bun run tauri:build` 로 .dmg 생성 + 코드 사인.

---

## 🟡 UX 후보

- [ ] **메모 제목/날짜/시간/참석자 undo·redo** (`⌘+Z`). 본문 textarea 의 undo 와 일관성. 4 field 각각 `useStateHistory<string>` 도입 + `onCommit` noop (자동 mutation X) + 명시 commit (blur/Enter) 시 mutation. undo/redo 자체는 mutation 트리거 안 함 — undo 후 blur 안 하면 frontmatter 변경 X (또는 undo/redo callback 안에서 자동 commit 처리). 본인이 dogfood 에서 meta typo 후 `⌘+Z` 원한 빈도로 가치 결정.
- [ ] **휴지통 자동 선택 + 미리보기 + 복원**. 휴지통 진입 시 첫 항목 자동 선택 + 메모 미리보기 (read-only). 비어있으면 placeholder ("휴지통이 비어있어요"). 휴지통 빠져나오면 기존에 선택돼 있던 메모로 복원. DeletedMeetingsList + 미리보기 컴포넌트 + App.tsx selection 복원 로직.
- [ ] **단축키 cheatsheet 모달** (옵시디안 패턴). `?` 같은 단축키로 모달 띄움 — 페이지 탭 (Cmd+1/2/3/4) / 메모 sub-tab (Cmd+[/]) / 편집-보기 토글 (Cmd+E) / undo (Cmd+Z) 등 모든 단축키 한 곳에. sub-tab tooltip 에서 단축키 표시는 이미 제거된 상태 (`MeetingForm.tsx` TabBtn). 모달 진입점 (`?` 키 또는 우상단 keyboard 아이콘) + 모달 본체 (디자인 토큰 기반).

---

## 🟡 디자인 / UI 폴리싱

- [ ] **에러 상태 패딩 통일**. p-3 / p-4 혼재.
- [ ] **캘린더 스크롤만으로 다른 월 본 상태 보존**. selectedDate 안 바뀐 채 스크롤만 이동한 경우는 페이지 전환 시 복원 안 됨. 명시적 날짜 클릭은 OK.
