# Progress

다음 세션이 빠르게 파악할 수 있도록 짧게 유지.

## 현재 상태 (2026-05-18, 오후)

**V0.7 "내 작업" 탭 plan-eng-review CLEAR.** design doc v2.2 ship-ready. 구현 코드는 아직 0줄. 다음 세션에서 step 1 진입.

### 이번 세션에서 한 일 (코드 변경 0)

전부 design / 메모리 / log 작업. 프로젝트 git working tree 변경 없음 (todo.md / progress.md 만 이 wrap 단계에서 갱신).

- **V0.7 plan-eng-review resume + 마무리** — 이전 세션 API surrogate 에러로 Section 3 중간에 죽었던 거 이어 받음. Section 3 (Tests) / Section 4 (Performance) / Outputs / Outside voice 까지 완주.
- **5개 본인 결정 받음**:
  - 1A — Vault 구조 flat (`portfolio/{pr-slug}.md` 단일 폴더, project = frontmatter)
  - 1B — atomic per-PR write + 시작/완료/중단 toast
  - 2A — `ClipPromptButton` 일반화 (meeting/PR/journal 공유, `ClaudePromptButton` 흡수)
  - 3A → T4-NEW — tombstone 폐기, `included: true/false` frontmatter (옵시디안 모바일 race 자연 해결, 본인 제안)
  - 4A — sync 직렬 호출 유지 (첫 sync 3분, toast expectation set)
- **outside voice (Claude subagent, Codex 미설치)** — 7 issues. 4개 본문 반영 (T2 scan 단축, T3 attachments cleanup, T5 `--limit 1000`, T7 이름 정리). T6 (ROI 재고) 본인이 명시적 "지금 구현 진입" 선택.
- **design doc v2.2 patch** — `~/.gstack/projects/goodsoob-work/ham-main-design-20260518-105501.md`. 9 섹션 갱신 (헤더, 데이터 모델, sync 흐름, syncPortfolio, Tauri 셋업, 컴포넌트, 카드 메뉴, Reviewer Concerns, Next Steps, Spec Review History, GSTACK REVIEW REPORT).
- **test plan artifact** — `~/.gstack/projects/goodsoob-work/ham-main-eng-review-test-plan-20260518-125206.md`. 8 unit + 1 manual smoke.
- **TODO-1 신규** — Tauri macOS PATH 대응. 모든 gh 호출을 `Command.create("sh", ["-lc", ...])` 로 감쌈. design 본문 코드 예시에 적용됨.

## 다음 세션 작업

### V0.7 step 1 부터 진입

design doc 의 Next Steps 13 step 순서대로:

1. **frontmatter schema + TypeScript interface lock-in** — `src/api/portfolio.ts` 빈 스켈레톤. `PortfolioWorkFrontmatter` (project + included 포함), `PortfolioWork`, `PortfolioProject`. CC 30분.
2. **scanPortfolio + watcher 확장** — `adapter.list("portfolio")` flat, `scanMeetings` 패턴 복붙. watcher `portfolio/` 케이스 추가. CC 15분.
3. **Tauri shell + 5초 hook + TODO-1 sh -lc 래핑** — Cargo.toml + capability + AppShell. CC 2-3시간. **여기서 Tauri dev 재시작 1번 필요.**
4. **2-step sync + frontmatter 보존 + tombstone 폐기 + injection** — CC 2-3시간.
5. 이후 step 5-13.

### 병행 검토 후보

- **Design Review** — V0.7 가 UI 컴포넌트 6개 신규 (카드, 그리드, 사이드바, 드롭존, lightbox, ResponsePasteArea). `/plan-design-review` 돌리면 디자인 토큰 / 시각 위계 / 인터랙션 점검. 선택.

## 알아야 할 컨텍스트

- **design doc v2.2 가 source of truth**. todo.md / progress.md 는 high-level 트래커. 구현 디테일 (frontmatter 스키마, sync 로직, 컴포넌트 이름 등) 은 design doc 한 파일만 보면 됨.
- **dev 서버 재시작 시점**: src/**.tsx 만 변경하면 HMR 자동. `src-tauri/` Cargo.toml / capability / lib.rs / `vite.config.ts` 변경하면 재시작 필요. V0.7 step 3 이 첫 재시작 지점.
- **이번 세션 API surrogate 에러**: 한국어 + emoji + 긴 컨텍스트 조합에서 UTF-16 surrogate pair 가 깨지면서 750KB 직렬화 fail. 메모리에 저장 (`feedback_korean_output_quality.md`). 다음 세션부터 짧은 평범한 단어 / 한자 약자 회피 / emoji + 한글 혼용 절제 적용.
- **review log**: `~/.gstack/projects/goodsoob-work/main-reviews.jsonl` 에 2건 (`plan-eng-review` CLEAR + `codex-plan-review` issues_found). `/ship` 시 readiness dashboard 가 이걸 봄.
- **본인 워크플로 confirm**: `gh` 설치 + login + `repo` scope OK. github.com (Enterprise 아님). 회사 + 개인 repo 모두 personal 계정으로 접근. The Assignment #1 종료.
- **V0.7 ROI risk (outside voice T6)**: 분기 1회 평가 자료 작성 × 연 4시간 수동 vs CC 2일 + Human 1-2주 + 매년 유지보수. 본인이 ROI 재고 후 "지금 구현 진입" 선택. 첫 dogfood 시즌 (다음 분기 평가) 에서 실제 가치 검증 시점 도래.

## V0.6.1 후속 (dogfood 진행 중, V0.7 와 병행)

- [ ] Conflict resolution 모달 (현재는 throw 만)
- [ ] Vault 변경 UI (설정 페이지)
- [ ] iCloud `(conflicted copy)` 파일 무시 룰 (portfolio 도 같이 cover)
- [ ] vault 스캔 성능 실측 + frontmatter-only fast path
- [ ] vault 폴더 사라짐 graceful

## 미해결

- mock-vault/.obsidian/ untracked (옵시디안이 자동 생성). .gitignore 에 이미 .obsidian/ 있음 — mock-vault 안쪽도 cover 되는지 확인.
- 캘린더 스크롤 상태 페이지 전환 시 보존 (V0.5.4 부터 carry-over).
- 에러 상태 패딩 통일 (p-3/p-4 혼재).
- V0.5.3~V0.5.4 lint 11 errors (기존 코드 react-hooks/refs 등) — V0.6 영역 외, dogfood 단계에서 정리.
