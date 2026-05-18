# Progress

다음 세션이 빠르게 파악할 수 있도록 짧게 유지.

## 현재 상태 (2026-05-18, V0.7 ship + V0.6 dogfood fix 후)

**V0.7 "내 작업" 탭 ship 완료**. dogfood 중 V0.6 vault 파서 버그 발견 → fix 완료. **다음 세션 = 모바일 layout 통일 (drawer)** — 기획 완료, 구현 대기.

## 다음 세션 진입점 — 모바일 drawer 구현

기획은 끝났고 구현만 남음. 결정사항/변경 파일 todo.md 의 "다음 세션 진입" 섹션 참조. 핵심 요약:

- **목표**: 모바일도 데스크탑과 같은 3-pane 구조. SidePanel 을 overlay drawer 로. BottomTabs 유지.
- **트리거**: 모바일 헤더 좌측 햄버거. drawer 폭 288 (데스크탑 기본 동일). dim 탭 + 좌 swipe 닫기.
- **drawer 내용**: SidePanel 만 (ActivityBar 제외 — 모바일에선 BottomTabs 가 그 역할).
- **결정사항**:
  - 메모 선택 시 drawer 자동 닫기
  - BottomTab 변경 시 drawer 자동 닫기
  - 햄버거 = 토글 (✕ 로 안 바꿈)
  - 모바일 초기 drawer 닫힘 상태. 메모장 진입 시 desktop 과 같은 auto-select.
  - swipe-from-edge 으로 열기는 v1 미구현
  - dim 이 헤더/BottomTabs 까지 덮는지는 구현 직전 결정
- **변경 파일**:
  - `AppShell.tsx`: drawer state + 햄버거 + overlay + body scroll lock + swipe + `DrawerContext` provider
  - `App.tsx`: 메모장 탭의 `lg:hidden` / `hidden lg:block` 분기 제거 → 단일 렌더, `MeetingsPage` 의 자동 선택 로직 흡수
  - `MeetingForm.tsx`: `lg:hidden` 뒤로가기 버튼 2개 (line 306, 377) 제거
  - 각 SidePanel: item onClick 안에서 `useDrawer().close()` 호출
  - `MeetingsPage.tsx`: **파일 자체 삭제** (역할 사라짐)
- **invariant 부가 효과**: 이번 변경으로 모바일도 항상 form 표시 → "선택 0 개 안 됨" invariant 자연스럽게 만족.

## 이번 세션에 한 일 (2026-05-18)

- **parser fix** (commit `c8d5d17`): KNOWN_H1 (`본문`/`회의 내용`/`요약`) 만 섹션 경계로 인식. 사용자가 본문에 `# 회의 제목` 같은 H1 쓰면 매 저장마다 블록이 누적되는 데이터 손상 버그 fix. 회귀 테스트 포함.
- **Backspace/Delete history.back() 차단** (commit `1a025ee` 에 묶여 들어감): macOS WKWebView 가 두 키를 브라우저 뒤로가기로 처리 → SPA selection state 망가짐. 입력 컨텍스트 (`INPUT`/`TEXTAREA`/`contenteditable`) 밖에서만 `preventDefault`.
- **Tauri dev Cmd+R reload menu** (commit `1a025ee` 에 묶여 들어감): JS 가 죽어 흰 화면 됐을 때 native menu 가 받아서 reload. `cfg!(debug_assertions)` 한정.
- **모바일 drawer 기획** — 위 "다음 세션 진입점" 참조.
- **2026-05-18-회의록.md** 파일 = 본인 데이터 (parser 버그로 11번 중복 누적된 회의록). 사용자가 수동으로 정리 예정. **git 에 넣으면 안 됨** (.gitignore 에 추가하든 수동 정리 후 vault 로 이동하든).

## owner repo legacy 카드 (V0.7 dogfood 진행 중)

본인이 PR 없이 직접 commit + push 한 owner repo 의 작업들. claude code 로 한 번에 카드 생성. 자세한 프롬프트 템플릿은 이전 progress 에 있었지만, 매일 사용 중 발견되는 즉시-fix 가 우선순위 더 높음.

## V0.7 핵심 결정 요약

- **자동 분류**: `projects.md` 의 `projects[].repos: ["owner/repo"]` 매핑으로 신규 카드 자동 부여. 본인 명시 분류 (`project: <slug>`) 는 sync 가 보존.
- **rename 자동 감지**: `github_pr_id` (GitHub 내부 영구 PR ID) frontmatter 매칭. owner/repo rename 시 파일 + `_attachments/{slug}/` + `projects.md repos` 자동 갱신.
- **legacy 카드**: `pr_number=0` 허용. PR 안 만든 commit 도 schema 통과.
- **카드 자동 삭제 0**: repo 삭제되어도 vault 카드 보존.
- **gh CLI 위임**: 우리 앱은 GitHub 계정 정보 0 보관.

## 알아야 할 컨텍스트

- **design doc v2.3** = V0.7 source of truth. `~/.gstack/projects/goodsoob-work/ham-main-design-20260518-105501.md`.
- **vault 위치**: `/Users/ham/Goodsoob` (iCloud 동기화).
- **portfolio capability**: `fs:scope` 에 dotfile path 명시. 새 capability 변경 시 `tauri:dev` 재시작 필요. Rust 변경 없으면 HMR 만으로 충분.
- **selection invariant**: "노트 0개 경우 제외하고 항상 최소 1개 선택" — 사용자 명시 요구. 현재 desktop 은 만족, 모바일은 drawer 구현 후 자연스럽게 만족.

## V0.6.1 후속 (V0.7 dogfood 와 병행)

- [x] parser KNOWN_H1 만 섹션 경계 (이번 세션 완료)
- [ ] Conflict resolution 모달 (현재 throw 만)
- [ ] Vault 변경 UI (설정 페이지)
- [ ] iCloud `(conflicted copy)` 파일 무시 룰
- [ ] vault 스캔 성능 실측 + frontmatter-only fast path
- [ ] vault 폴더 사라짐 graceful

## 미해결

- 캘린더 스크롤 상태 페이지 전환 시 보존 (V0.5.4 부터 carry-over).
- 에러 상태 패딩 통일 (p-3/p-4 혼재).
- V0.5.3~V0.5.4 lint 11 errors (기존 코드 react-hooks/refs 등) — dogfood 단계에서 정리.
- `2026-05-18-회의록.md` 프로젝트 루트 untracked. 본인 정리 대기.
- `syncPortfolio` 안 `[syncPortfolio]` 진단 console.log — dogfood 안정화 후 제거.
