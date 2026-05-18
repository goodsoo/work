# Progress

다음 세션이 빠르게 파악할 수 있도록 짧게 유지.

## 현재 상태 (2026-05-18, 늦은 저녁 — V0.7 ship 완료, dogfood 진행 중)

**V0.7 "내 작업" 탭 ship.** 코드 + 첫 sync + rename 자동 감지 + 자동 분류 + dogfood fix 모두 통과. 88 tests pass. **다음 세션 = 매일 사용하면서 발견하는 거 즉시 fix + owner repo legacy 카드 작성**.

## 다음 세션 진입점

### 1. owner repo legacy 카드 작성 (우선순위)

본인이 PR 없이 직접 commit + push 한 owner repo 의 작업들. claude code 로 한 번에 카드 생성.

각 owner repo 마다:
```bash
cd ~/Projects/<repo>
claude
```

claude 에게 줄 프롬프트:
```
이 repo 의 git log 을 author=<your-email> 으로 필터해서 의미 있는 feature 단위로
묶고, 각 묶음마다 /Users/ham/Goodsoob/portfolio/<owner>-<repo>-legacy-<n>.md 파일을 만들어줘.

frontmatter:
  type: portfolio-work
  github_owner: <owner>
  github_repo: <repo>
  github_pr_number: 0
  github_pr_url: ""
  github_state: merged
  github_merged_at: <묶음 첫 commit 날짜 ISO>
  github_title: <한 줄 작업 요약>
  github_changed_files: <합산>
  github_additions: <합산>
  github_deletions: <합산>
  project: ""              # projects.md 에 그 repo 매칭되면 자동 분류, 아니면 본인이 옵시디안에서
  included: true
  category: ui_ux | backend | infra | fix | other 중 추정
  impact_summary: "한 줄, 30자 이내, '그래서 뭐가 좋아졌는지' 중심"
  screenshots: []
  synced_at: ""

body:
## Description (from GitHub)
- <sha-short> <commit message>
- ...

## Notes
(빈)

규칙:
- 의미적으로 연결된 commit 들 묶기. "fix typo", "rename" 같은 사소한 commit 은 큰 묶음에 흡수.
- 평가 자료용이라 가치 약한 묶음은 skip.
- 묶음 5-15개 정도 적절.
```

### 2. 매일 사용하면서 발견하는 UX 갈리는 곳 fix

V0.7 ship 후 1주일 매일 사용 (design step 13). 본인이 발견 시 즉시 commit.

### 3. progress.md 의 console.log 제거 (안정화 후)

`syncPortfolio` 안 `[syncPortfolio]` 진단 로그. dogfood 안정화 후 제거.

## V0.7 핵심 결정 요약

- **자동 분류**: `projects.md` 의 `projects[].repos: ["owner/repo"]` 매핑으로 신규 카드 자동 부여. 본인 명시 분류 (`project: <slug>`) 는 sync 가 보존. 빈 값 → 다음 sync 가 매핑으로 채움.
- **부트스트랩**: 첫 sync 시 projects.md 자동 생성 (1 repo = 1 project). 본인이 옵시디안에서 한국어 rename + 여러 repo 묶기.
- **rename 자동 감지**: `github_pr_id` (GitHub 내부 영구 PR ID) frontmatter 매칭. owner/repo rename 시 파일 + `_attachments/{slug}/` + `projects.md repos` 자동 갱신. 본인 수정 필드 보존.
- **legacy 카드**: `pr_number=0` 허용 (negative 만 reject). PR 안 만든 commit 도 schema 통과. UI 에선 외부 링크 비활성 (`github_pr_url=""` → `<span>` fallback).
- **카드 자동 삭제 0**: repo 삭제되어도 vault 카드 보존. 본인 평가 자료 안전.
- **gh CLI 위임**: 우리 앱은 GitHub 계정 정보 0 보관. `gh auth login` 키체인 토큰을 `sh -lc` 로 통해 사용.

## 알아야 할 컨텍스트

- **design doc v2.3 가 source of truth**. `~/.gstack/projects/goodsoob-work/ham-main-design-20260518-105501.md`. 본 progress 는 high-level only.
- **dogfood 결정**: owner repo 도 PR 워크플로 (Approach A) 시도하는 게 추천. 셀프 PR 5초/번 + PR description 강제 → 평가 자료 품질 ↑. 부담 크면 commit cluster (Plan B) 는 V0.8 후보.
- **vault 위치**: 본인 `/Users/ham/Goodsoob` (iCloud 동기화).
- **portfolio capability**: `fs:scope` 에 dotfile path 명시. 새 capability 변경 시 `tauri:dev` 재시작 필요. Rust 변경 없으면 HMR 만으로 충분.
- **gh CLI 첫 셋업**: 본인은 이미 `gh auth login` 통과 (github.com, repo scope). Enterprise 아님.

## V0.6.1 후속 (V0.7 와 병행)

- [ ] Conflict resolution 모달 (현재는 throw 만)
- [ ] Vault 변경 UI (설정 페이지)
- [ ] iCloud `(conflicted copy)` 파일 무시 룰 (portfolio 도 cover)
- [ ] vault 스캔 성능 실측 + frontmatter-only fast path
- [ ] vault 폴더 사라짐 graceful

## 미해결

- mock-vault/.obsidian/ untracked (옵시디안 자동 생성). .gitignore 에 이미 .obsidian/ 있음 — mock-vault 안쪽 cover 되는지 확인.
- 캘린더 스크롤 상태 페이지 전환 시 보존 (V0.5.4 부터 carry-over).
- 에러 상태 패딩 통일 (p-3/p-4 혼재).
- V0.5.3~V0.5.4 lint 11 errors (기존 코드 react-hooks/refs 등) — dogfood 단계에서 정리.
- 다른 세션이 `src/lib/vault/parser.ts` 와 `parser.test.ts` 수정 중. 이번 wrap 에서 건드리지 않음.
