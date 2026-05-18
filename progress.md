# Progress

다음 세션이 빠르게 파악할 수 있도록 짧게 유지.

## 현재 상태 (2026-05-18 저녁, legacy 카드 프롬프트 + goodsoo/work 자체 카드 5장 완료 후)

**V0.7 "내 작업" 탭 ship + dogfood fix + legacy 카드 도구 완료**. owner repo `goodsoo/work` 자체에 대한 평가 자료 (V0.0~V0.7 마일스톤 5장) 도 vault 에 누적. **다음 세션 = 모바일 layout 통일 (drawer)** — 기획 완료, 구현 대기.

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

## 이번 세션에 한 일 (2026-05-18 저녁)

- **legacy 카드 작성 프롬프트 + 복사 버튼** (commit `9f7ffed`): `src/lib/clipboardPrompt.ts` 에 `buildLegacyCardPrompt(vaultRoot)` 추가. PR 없이 직접 push 한 owner repo 에서 git log 기반으로 일관된 schema 의 portfolio 카드를 생성하라는 self-contained 지시 프롬프트. `PortfolioSidePanel` 의 `ClipPromptButton` (compact) 으로 한 번에 클립보드 복사. vaultRoot 는 `useVault()` 에서 주입 — picker 가 바뀌어도 자동 반영, 미설정 시 vault 선택 안내 메시지로 대체. 테스트 2 케이스 추가 (12개 pass).
- **goodsoo/work 자체 legacy 카드 5장 생성**: 위 프롬프트 schema 그대로 적용. 본인 71 커밋을 V0.0~V0.7 마일스톤 5개로 그룹핑 + 각 그룹 첫커밋~끝커밋 `git diff --shortstat` 정확 산출. vault `portfolio/goodsoo-work-{v0-0-to-0-5-web-mvp,v0-5-1-desktop-layout,v0-5-2-to-0-5-4-memo-polish,v0-6-vault-migration,v0-7-portfolio}.md` + `projects.md` 에 `goodsoo-work` slug (sort=5, repos=[goodsoo/work]) 추가. 모두 vault 안 직접 작성이라 git diff 에 없음.

**직전 세션 (2026-05-18 낮) 작업** (이미 ship): parser KNOWN_H1 fix (`c8d5d17`) / Backspace history.back 차단 + Tauri dev Cmd+R reload (`1a025ee` 에 묶임) / 모바일 drawer 기획.

- **2026-05-18-회의록.md** 파일 = 본인 데이터 (parser 버그로 중복 누적된 회의록). 여전히 프로젝트 루트 untracked. 사용자가 수동 정리 예정. **git 에 넣으면 안 됨**.

## V0.7 핵심 결정 요약

- **자동 분류**: `projects.md` 의 `projects[].repos: ["owner/repo"]` 매핑으로 신규 카드 자동 부여. 본인 명시 분류 (`project: <slug>`) 는 sync 가 보존.
- **rename 자동 감지**: `github_pr_id` (GitHub 내부 영구 PR ID) frontmatter 매칭. owner/repo rename 시 파일 + `_attachments/{slug}/` + `projects.md repos` 자동 갱신.
- **legacy 카드**: `pr_number=0` 허용. PR 안 만든 commit 도 schema 통과.
- **카드 자동 삭제 0**: repo 삭제되어도 vault 카드 보존.
- **gh CLI 위임**: 우리 앱은 GitHub 계정 정보 0 보관.

## 알아야 할 컨텍스트

- **design doc v2.3** = V0.7 source of truth. `~/.gstack/projects/goodsoob-work/ham-main-design-20260518-105501.md`.
- **vault 위치**: `/Users/ham/Library/Mobile Documents/com~apple~CloudDocs/Goodsoob/` (iCloud Drive, 옵시디안 호환).
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
