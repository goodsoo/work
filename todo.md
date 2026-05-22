# todo

PR 단위로 묶음. 각 PR 의 **한 줄 임팩트** 는 카드 frontmatter `impact_summary` 후보. 카테고리는 `ui_ux | backend | infra | fix | other`.

🔥 = 우선순위 높음 (dogfood 통증). 🟡 = 일반 후보. 🟢 = 진행 중.

완료 기록은 [done.md](done.md) 참조.

---

## 🚀 메모 에디터 (마크다운) 강화

### PR — 사이드바 메모 탐색 (검색 + 태그 + 즐겨찾기) `ui_ux`
한 줄 임팩트: 메모 많아져도 사이드바에서 즉시 좁히기 — 이름·태그·즐겨찾기

- [ ] **검색** — 옵시디안 quick switcher 패턴. title + body 즉시 매칭, 결과 highlight. 단축키 `Cmd+P`. 사이드바 검색창 + 결과 highlight.
- [ ] **태그 필터** — 사이드바 위 태그 chip 행. frontmatter `tags: [foo, bar]` union. 클릭 = 그 태그 메모만, 다중 선택 = AND. 태그 입력 UI 는 별 작업 (frontmatter 직접 편집 의존).
- [ ] **즐겨찾기 / pin** — 메모 카드에 별/핀 토글. frontmatter `pinned: true` (옵시디안 호환). 사이드바 상단 고정 + 정렬 그룹 분리.

### PR — 사이드바 폴더 (서브 그룹) `ui_ux`
한 줄 임팩트: `meetings/{folder}/...` 트리 사이드바, 옵시디안 호환

- [ ] vault `meetings/` 안 sub-folder 인식 + 사이드바 트리 렌더 (collapse/expand). 옵시디안과 같은 폴더 구조 = 모바일 옵시디안 호환 유지.
- [ ] 새 폴더 생성 / 메모 폴더 이동 (사이드바 drag&drop 또는 컨텍스트 메뉴). 정렬은 기존 `useMeetingSort` 폴더 안에서도 적용.
- [ ] 폴더 없는 메모 (vault root `meetings/`) 는 "기타" 그룹으로 트리 하단.

### PR — 보기모드 todo 라인 → todo 페이지 추가 버튼 `ui_ux`
한 줄 임팩트: 보기 모드에서도 본문 `- [ ]` 한 줄을 todo 페이지로 한 클릭 등록

- [ ] 본문 markdown `- [ ]` / `- [x]` 라인 옆에 "todo 추가" 버튼. **hover 시에만 등장** (chrome 노이즈 회피).
- [ ] 클릭 = 편집 모드 Cmd+Enter 동등 액션 (해당 라인을 todos 페이지 카드로 추가). 보기 모드엔 textarea focus 가 없어 단축키 안 먹히는 gap 메움.
- [ ] **중복 허용** — 이미 todo 로 추가된 라인도 구분 안 함. todos 페이지가 source of truth, 메모 본문은 snapshot. 중복 카드 생기면 todos 페이지에서 정리.
- [ ] 위치 후보: 줄 우측 끝 / gutter 영역. markdown 시각 정렬 안 깨지는 곳 우선.

### PR — 본문 이미지 paste / drag&drop `ui_ux`
한 줄 임팩트: 캡쳐 이미지 본문에 paste/drop → vault `_attachments/` 저장 + markdown 자동 insert

- [ ] textarea (편집 모드) 안 이미지 paste / drag&drop 감지. `_attachments/{slug}/{n}.{ext}` 저장 + caret 위치에 `![](상대경로)` insert.
- [ ] slug = 현재 메모 title kebab-case. 같은 메모 안 이미지 N 증가.
- [ ] portfolio 카드의 `_attachments/{slug}/before-N.{ext}` 와 같은 패턴 — 자산 위치 일관.
- [ ] PR #22 의 이미지 렌더링과 정합 — 저장 후 보기 모드 즉시 정상 표시.

---

## ✨ 신규 기능

### PR — 루틴 (매일 하는 할일) `ui_ux`
한 줄 임팩트: 출퇴근 / 운동 / 일기 같은 매일 streak 시각화

- [ ] vault `routines/` 폴더 신설. 1 routine = 1 md 파일 (frontmatter `type: routine`, `schedule: every day` 등)
- [ ] 본문은 Obsidian Tasks 호환 라인 (`- [x] ✅ YYYY-MM-DD`) 이력 누적
- [ ] ActivityBar 새 탭 "루틴" (⌘5). 좌측 routine 리스트 (오늘 체크박스 + 현재 streak `🔥7`), 우측 12주 GitHub-style heatmap + 통계 (현재/최장 streak, 30일 완료율)
- [ ] 놓친 날 자동 fail (streak break). 수동 휴무일 토글 (`- [-] 휴무 YYYY-MM-DD`) 로 streak 보호

### PR — Tauri 윈도우 헤더 통합 `ui_ux`
한 줄 임팩트: ActivityBar 가 헤더로 흡수돼 본문 +48px 확보 + 무경계 (traffic light 옆 같은 줄로)

- [ ] `tauri.conf.json` `titleBarStyle: "Overlay"` + `hiddenTitle: true`. ActivityBar 를 traffic light 옆 같은 줄로
- [ ] 헤더 배경 = sidepanel 배경 통일 (전체 한 덩어리)
- [ ] ActivityBar 빈 공간에 `data-tauri-drag-region` 명시
- [ ] macOS 전용 — Windows/Linux fallback (native title bar 유지)

### PR — 사이드바 collapse 단축키 `ui_ux`
한 줄 임팩트: `Cmd+\` 로 SidePanel 토글, 본문 집중 모드

- [ ] 옵시디안 패턴 — `Cmd+\` 로 SidePanel 토글. localStorage persist (`goodsoob:sidebarCollapsed`).
- [ ] 애니메이션 = 좌측 slide. 본문 width 자동 확장. ActivityBar 는 그대로 노출.
- [ ] 모바일은 별개 (이미 단일 컬럼).

### PR — 단축키 자료/통계 페이지 `ui_ux` 🟡
한 줄 임팩트: 분기 평가용 — 회의 N건 / 일기 streak / todos 완료율 한 화면

- [ ] ActivityBar 새 탭 또는 portfolio 탭 안 별 view. 후순위 — dogfood 통증 작음, 평가 시즌 근접에 진입 결정.
- [ ] vault scan 기반 — meetings 수 (월별), journals streak, todos 완료율 (이번 달 / 분기). 외부 의존 0.

---

## 🎨 폴리시

### PR — 오버레이 컴포넌트 통일 `other`
한 줄 임팩트: 6+ 모달 boilerplate (`backdrop` + ESC + 사이즈 spec) 한 컴포넌트로

- [ ] 공통 `<Modal>` (또는 `<Overlay>`) 추출 — `backdrop onMouseDown` close + `e.target===e.currentTarget` 가드, ESC 닫기, rgba bg, center align, 사이즈 prop (`sm | md | lg` 또는 width/height). SettingsModal / TrashModal / TaskAddModal / ConfirmDialog / ScreenshotLightbox / JournalOverlay 6개가 같은 패턴 반복.
- [ ] 사이즈 spec: 설정창 표준 = `max-w-3xl` + `min(560px, 80vh)`. 작은 confirm 류는 `max-w-sm`. lightbox 는 full-screen variant.
- [ ] 기존 모달들 마이그레이션 — body 만 children prop 으로, 헤더 closure 아이콘 / 사이즈 prop 만 다름.

### PR — 마크다운 에디터 컴포넌트 통일 `other`
한 줄 임팩트: `SourceBodyEditor` 의 풀세트 (gutter / wrap / slash / 단축키) 를 prop 으로 토글, 일기 등에서도 재사용

- [ ] `SourceBodyEditor` 에 `wrap?: "off" | "soft"`, `enableSlashCommand?`, `enableGutter?`, `enableShortcuts?` 같은 prop 추가. 회의록은 기존 동작 (모두 on), 일기는 wrap=soft + gutter/slash off 정도로 가져옴.
- [ ] 일기 오버레이의 plain textarea → `SourceBodyEditor` (옵션 끄고) 로 교체. 메모장과 동일한 마크다운 편집 UX (자동 들여쓰기, `⌘B/I/E` wrap 등) 일기에도 적용.
- [ ] 추후 todo description 등 다른 마크다운 입력에도 같은 컴포넌트 쓸 수 있게 baseline.

### PR — 동적 카테고리 (사용자 정의 분류) `backend`
한 줄 임팩트: 업무/미팅 외 본인 카테고리 자유 추가

- [ ] **데이터 모델** — `TodoCategory` union → `string`. vault 안 `categories.md` (한 줄당 `id: label`) 가 source of truth. 기본 `work / schedule / other` 부트스트랩.
- [ ] **UI** — 추가/삭제 위치 결정 (TaskAddModal select 안 inline / 설정 패널 / 사이드바 헤더 편집 모드). 사이드패널 필터 + 캘린더 사이드는 동적 빌드.
- [ ] **Sanitize 정책** — 카테고리 삭제 시 그 카테고리 todo 처리: (a) vault 라인 `#xxx` 자동 strip (b) UI null 표시 + 라인 보존 (c) 삭제 차단 + 옮기라고 경고. 한 가지 고르기.
- [ ] **알 수 없는 카테고리 표기** — vault 의 `#unknown` 같은 tag 가 카테고리 list 에 없을 때 UI 에서 어떻게 보일지 (지금은 null 로 무시 + 라인 보존).

### PR — portfolio 카드 시각 재설계 `ui_ux`
한 줄 임팩트: 카드 크기 축소 + 한눈에 정보 + inline 편집

- [ ] **카드 크기/레이아웃 재설계** — 현재 카드 너무 크고 한눈에 중요 정보 (impact_summary / 날짜 / 카테고리) 안 들어옴. 정보 우선순위 정리 + 작은 카드 그리드.
- [ ] **카드 inline 편집** — 현재 lightbox 모달 진입 후 편집. 카드 클릭 = inline 펼침 + 편집 모드 전환 검토. 메모장 패턴 (제목 → 본문 inline) 과 비교.

### PR — portfolio sync 안정성 `fix`
한 줄 임팩트: 사이드바 [동기화] 가 Tauri callback 손실 없이 작동

- [ ] **사이드바 [동기화] (incremental) callback 손실** — `useGhSync.run({incremental:true})` 호출 시 Tauri 가 `Couldn't find callback id ...` warning 후 promise 영원 pending. `runningRef` 가 stuck → 다음 클릭 무시. portfolio-card-redesign PR (#TBD) 에서 임시로 5초 background auto-sync 비활성 + race 차단 (`runningRef`) 추가. 진짜 원인 — HMR 이슈인지, readSyncState + sync 두 Tauri command 의 sequencing race 인지, gh CLI spawn 직렬화 문제인지 파악 후 fix. 가이드북 [전체 다시 훑기] 는 정상 작동 (since 없는 path).
- [ ] **5초 background auto-sync 재활성** — 위 fix 완료 후 design 의 silent fetch 기능 복원. CLAUDE.md V0.7 의 "5초 background auto-sync + 사이드바 수동 트리거" 명시 항목.

### PR — sync 시 PR body 의 7섹션 자동 파싱 → frontmatter `backend`
한 줄 임팩트: PR 양식 그대로 적은 임팩트/카테고리가 카드 frontmatter 에 자동 들어감

- [ ] **PR body 자동 파싱** — 현재 sync 는 PR body 를 markdown body 로 그대로 박음. frontmatter `impact_summary` / `category` 는 default 빈값. 본인이 PR body 에 7섹션 양식 (`## 한 줄 임팩트`, `## 카테고리` 등) 적었는데도 frontmatter 안 채워져서, 매번 모달 [Claude 한테 요청] / paste 로 후작업해야. `clipboardPrompt.ts` 의 `parsePRResponse()` 와 비슷한 H2/H3 split 로 PR body 에서 직접 추출 → `upsertPortfolioWork` 가 existing 없을 때 신규 카드의 frontmatter 초기값으로. 본인 수정값 보존 룰 (3A) 유지.
- [ ] **카테고리 enum 정규화** — body 의 카테고리 값이 enum (`ui_ux | backend | infra | fix | other`) 이 아닐 때 fallback. parsePRResponse 와 동일 규칙.

### PR — portfolio 입력 흐름 `ui_ux`
한 줄 임팩트: ResponsePasteArea 발견성 + 드래그&드롭 동작 검증

- [ ] **`ResponsePasteArea` 발견성** — `PortfolioWorkCard.tsx:147` 의 "Claude 응답 paste" 입력란. impact_summary 비었을 때만 등장 + placeholder 만 있어 사용자가 "무슨 기능인지 모름" 체감. 라벨/도움말 보강 또는 가치 재평가 후 제거 결정. (단일 카드 메뉴의 "Claude 프롬프트 복사" 는 별개 — 그건 명확.)
- [ ] **이미지 업로드 드래그&드롭** — CLAUDE.md 엔 dropzone 명시지만 사용자 체감 안 됨. 실제 동작 점검 + 카드 그리드 어디서든 드래그 받도록 영역 확장. lightbox 안 dropzone 도 동작 검증.

### PR — 날짜/시간 표시 포맷 통일 `ui_ux`
한 줄 임팩트: 앱 전체 날짜/시간 표시가 한 컨벤션으로

- [ ] **메모장 사이드바 카드** — `MM.DD(ddd) HH:mm · 참석자 N명`. 올해면 연도 생략, 올해 아니면 `YYYY.MM.DD(ddd) HH:mm`
- [ ] **휴지통 카드** — 메모장 카드와 동일 포맷 통일. 삭제 시각은 카드 secondary 영역 (하단 또는 작은 글씨로 별도 위치)
- [ ] **앱 전체 검토 + 통일** — 메모 본문 메타 row / 캘린더 라벨 / todos 마감일 / portfolio 카드 등 표시 위치 찾아 한 컨벤션으로
- [ ] **`lib/dates.ts` 단일 포맷 함수 도입** — `formatMeetingDate()` / `formatTrashDate()` 등 → 모든 호출처 통일. 새 표시 위치 추가 시 함수만 호출

---

## 🛡️ Vault 안정성 (V0.6.1 후속)

### PR — Conflict resolution 모달 `backend`
한 줄 임팩트: 옵시디안 모바일과 동시 편집 충돌 시 보존/덮어쓰기 선택

- [ ] ConflictError throw → UI 모달 (내 변경 보존 / 외부 변경 가져오기 / `.conflict-*.md` 파일 생성)

---

## 📊 Portfolio (V0.7.x 후속)

### PR — 내 작업 수동 추가 `ui_ux`
한 줄 임팩트: GitHub PR 무관 카드 (오프라인 업무 / 회의 발표) 도 portfolio 에 직접 추가

- [ ] portfolio 탭에서 "새 카드" 버튼 → title/date/category/impact_summary 입력 + screenshots dropzone → 저장. frontmatter `github_pr_id` 없거나 0 → sync 가 건드리지 않음 (legacy 카드 schema 그대로 활용). 평가 자료에 PR 외 활동도 포함.

### PR — gh 호출 인프라 강화 `backend`
한 줄 임팩트: gh 인증/네트워크 실패도 매끄럽게

- [ ] gh 미설치 / 미로그인 별도 모달 (현재는 sidebar inline)
- [ ] 회사 HTTPS outbound 차단 감지 + 자동 sync off 설정 (매일 토스트 떠야 발견)

### PR — commit cluster 카드 (Plan B) `backend`
한 줄 임팩트: 회사 PR 워크플로 전환 부담 크면 branch cluster 로 대체

- [ ] branch 단위 commit cluster → AI 입력 commit messages 로 카드 생성

---

## 🧹 안정성 / 위생

### PR — 백업 가시성 강화 `ui_ux`
한 줄 임팩트: spinner + 마지막 백업 시각 + 오래된 zip 정리 = 백업 영역 dogfood 폴리싱

- [ ] **첫 zip spinner toast** — vault 크기 따라 첫 zip 1-10초 침묵. 1초+ 면 spinner toast.
- [ ] **설정 모달에 마지막 백업 시각 + 백업 path 노출** — "마지막 백업: 2026-05-21 14:32 · 경로 ~/Backups/...". 클릭 = path 클립보드 또는 Finder 진입.
- [ ] **오래된 zip 자동 정리** — 최근 N개 (default 30개) 만 유지, 그 외 삭제. 정책 = 설정 모달에서 조정 가능.

---

## 📅 매일 사용 / dogfood (작업 X, routine)

- [ ] V0.7 dogfood 매일 사용 — 다음 분기 평가 시 portfolio 탭만 띄워서 5분 내 펼쳐보일 수 있는지 검증
- [ ] 다른 owner repo legacy 카드 backfill — "Legacy 카드 프롬프트" 복사 → 각 repo Claude Code 에 paste
- [ ] 회사 owner repo PR 워크플로 전환 시도 — branch + 셀프 PR + auto-merge alias (5초)
- [ ] backup-pre-pr-split branch 삭제 결정 (dogfood 며칠 후 안전 확인)

---

## 🔮 V0.7+ 후보 (dogfood 결과로 진입 결정)

- [ ] Tauri 2 Mobile (read-only viewer 부터) — Tauri 2 Mobile 학습/탐색이 동기. 1단계 = vault read + 메모 list/detail 만 모바일 UI 로. write 는 conflict/watcher race 영역이라 학습 단계엔 보류. 옵시디안 모바일 대체보다는 프레임워크 학습 + 본인 stack 모바일 가능성 증명 용도.
- [ ] "Claude 응답 paste → 자동 callout" 회의록 영역
- [ ] 녹음 파일 직접 업로드 → 자동 STT
- [ ] Tauri 데스크탑 `.dmg` 빌드 + 코드 사인
