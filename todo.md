# todo

PR 단위로 묶음. 각 PR 의 **한 줄 임팩트** 는 카드 frontmatter `impact_summary` 후보. 카테고리는 `ui_ux | backend | infra | fix | other`.

🔥 = 우선순위 높음 (dogfood 통증). 🟡 = 일반 후보. 🟢 = 진행 중.

완료 기록은 [done.md](done.md) 참조.

---

## 🚀 메모 에디터 (마크다운) 강화

### PR — 마크다운 보기 모드 정비 `ui_ux`
한 줄 임팩트: 보기 모드가 옵시디안만큼 정확히 렌더

- [ ] **MarkdownView 체크박스 (`- [ ]`) 렌더링** + 보기 모드 클릭 토글로 body 마크다운 직접 수정. 현재 구현 약함.
- [ ] **MarkdownView 4-space indented code block 렌더링** — pre/code 컴포넌트 매핑 점검. 현재 코드블록 인식 안 됨.

### PR — 본문 word-wrap + gutter dynamic alignment `ui_ux`
한 줄 임팩트: 한국어 메모 자연 줄넘김 + gutter 정확 정렬

- [ ] textarea `wrap="on"` + gutter marker 가 wrap 된 visual line 과 align. hidden mirror div 가 같은 width/font/line-height 으로 source line 별 actual visual height 측정 → gutter marker height 동기. ResizeObserver 로 textarea width 변경 감지 + debounce. ~40-50줄

### PR — 메모 검색 (사이드바 검색창) `ui_ux`
한 줄 임팩트: 메모 많아져도 이름으로 즉시 찾기

- [ ] 옵시디안 quick switcher 패턴 — title + body 즉시 매칭, scope toggle (현재 탭 / 전체). 단축키 `Cmd+P`. 사이드바 검색창 + 결과 highlight.

### PR — 메모 태그 필터 `ui_ux`
한 줄 임팩트: frontmatter `tags` 기반 사이드바 필터

- [ ] 사이드바 위에 태그 chip 행 — frontmatter `tags: [foo, bar]` 의 union. 클릭하면 그 태그 메모만. 태그 입력 UI 는 별 작업 (frontmatter 직접 편집 의존).

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

---

## 🎨 폴리시

### PR — 테마 전환 radial wipe `ui_ux`
한 줄 임팩트: 테마 토글 시 누른 곳에서 원형으로 퍼지는 wipe (갑자기 밝아져 눈 아픈 문제)

- [ ] View Transitions API + clip-path circle. 토글 버튼 클릭 좌표 origin. 0.8s ease-out.

### PR — toast/에러 박스 overflow 수정 `fix`
한 줄 임팩트: 긴 에러 메세지도 박스 안에 잘 fit + 재시도 버튼 보임

- [ ] toast 컨테이너 max-width + 텍스트 영역 min-w-0 + break-words + 액션 버튼 flex-shrink-0. 한 컴포넌트 수정으로 모든 toast 적용. 현재는 긴 에러 시 텍스트가 박스 밖으로 나가고 재시도 버튼이 밀려서 안 보임.

### PR — UI 패딩 / 캘린더 폴리싱 `ui_ux`
한 줄 임팩트: 잔여 디자인 inconsistency 정리

- [ ] 캘린더 스크롤만으로 다른 월 본 상태도 페이지 전환 시 복원 (selectedDate 안 바뀌어도)
- [ ] **UI chrome `user-select: none`** — 마우스 실수 드래그로 사이드바 헤더 / 캘린더 셀 / 버튼 라벨 등이 파랗게 selection 되는 거 차단. 텍스트 복사 의도 있는 영역 (메모 본문, 메모 제목, 일정 제목, transcript) 은 그대로 유지. 어디까지 막을지 = chrome vs content 경계 정의 필요

### PR — 할일 페이지 UI/UX 개편 `ui_ux`
한 줄 임팩트: 할일 리스트 + 입력 흐름 dogfood 통증 한 번에 정리

- [ ] **리스트 UI 정리** — 구분선 톤 다운 (현재 너무 진함). 정보 레이아웃 재배치 (제목/메타/액션 위계 명확).
- [ ] **체크 실수 복원** — 단일 클릭 = 실수 잦음. 더블클릭으로 체크 토글 또는 ⌘Z undo 도입 (둘 다 양립 가능).
- [ ] **날짜/시간 입력 통일** — 메모장 메타 row 와 같은 패턴 (date input + time input). 현재는 날짜만 + 입력 불편 + 시간 없음. 메모장과 컴포넌트 공유 후보.
- [ ] **추가 헤더 sticky** — 할일 추가 입력란을 상단 sticky 로 고정, 또는 위로 스크롤 시 등장. 현재는 매번 최상단으로 가야 함.

### PR — 내 작업 (portfolio) UI/UX 개편 `ui_ux`
한 줄 임팩트: 카드 view + 편집 흐름 + 업로드 dogfood 통증 한 번에 정리

- [ ] **카드 크기/레이아웃 재설계** — 현재 카드 너무 크고 한눈에 중요 정보 (impact_summary / 날짜 / 카테고리) 안 들어옴. 정보 우선순위 정리 + 작은 카드 그리드.
- [ ] **카드 inline 편집** — 현재 lightbox 모달 진입 후 편집. 카드 클릭 = inline 펼침 + 편집 모드 전환 검토. 메모장 패턴 (제목 → 본문 inline) 과 비교.
- [ ] **`ResponsePasteArea` 발견성** — `PortfolioWorkCard.tsx:147` 의 "Claude 응답 paste" 입력란. impact_summary 비었을 때만 등장 + placeholder 만 있어 사용자가 "무슨 기능인지 모름" 체감. 라벨/도움말 보강 또는 가치 재평가 후 제거 결정. (단일 카드 메뉴의 "Claude 프롬프트 복사" 는 별개 — 그건 명확.)
- [ ] **이미지 업로드 드래그&드롭** — CLAUDE.md 엔 dropzone 명시지만 사용자 체감 안 됨. 실제 동작 점검 + 카드 그리드 어디서든 드래그 받도록 영역 확장. lightbox 안 dropzone 도 동작 검증.
- [ ] **참고**: "내 작업 수동 추가" 는 별도 PR 로 📊 Portfolio 섹션에 이미 있음 (`#portfolio` 탭에 "새 카드" 버튼).

### PR — 날짜 input 2026년 이전 차단 `fix`
한 줄 임팩트: 오타로 2025/0202 같은 과거 날짜 입력 방지

- [ ] 메모장 메타 row 의 date input, 일정 / 투두 마감일 date input 등 앱 전체 `<input type="date">` 에 `min="2026-01-01"`. 캘린더의 `minCenterOffset` (2026-01 이전 차단) 과 컨벤션 통일. 키보드 직접 입력으로 2025 박는 케이스도 onChange 에서 reject + 원복 (브라우저 native min 은 picker 만 막고 typing 은 통과). toast/경고 X — 조용히 못 들어가게.

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
- [ ] gh enrich concurrency 5 병렬 (현재 직렬, 첫 sync 3분 통증 시 도입)

### PR — PR body 이미지 자동 import `backend`
한 줄 임팩트: PR 의 before/after 이미지 자동 vault 다운로드

- [ ] sync 가 PR body 의 `<img src>` / `![](url)` 추출 → URL fetch → `_attachments/{slug}/before-N.png` 다운로드 → screenshots frontmatter 자동 채움. 본인 dropzone 박은 거 보존. private repo URL 은 gh auth token.

### PR — commit cluster 카드 (Plan B) `backend`
한 줄 임팩트: 회사 PR 워크플로 전환 부담 크면 branch cluster 로 대체

- [ ] branch 단위 commit cluster → AI 입력 commit messages 로 카드 생성

---

## 🧹 안정성 / 위생

### PR — 자동 백업 spinner toast `ui_ux`
한 줄 임팩트: 첫 zip 1-10초 침묵 = 사용자 불안 → spinner

- [ ] vault 크기 따라 첫 zip 1-10초 침묵. 1초+ 면 toast 띄움.

### PR — lint 정리 + Vercel disconnect `infra`
한 줄 임팩트: 잔여 위생

- [ ] **lint 정리** — 현재 28 errors + 3 warnings (V0.5.3~V0.5.4 부터 누적, react-hooks/refs 위주). dogfood 단계 한 번에 정리.
- [ ] **Vercel 대시보드 disconnect** — deploy 는 `vercel.json` 으로 막혔지만 대시보드 연동은 잔존. 선택.

---

## 📅 매일 사용 / dogfood (작업 X, routine)

- [ ] V0.7 dogfood 매일 사용 — 다음 분기 평가 시 portfolio 탭만 띄워서 5분 내 펼쳐보일 수 있는지 검증
- [ ] 다른 owner repo legacy 카드 backfill — "Legacy 카드 프롬프트" 복사 → 각 repo Claude Code 에 paste
- [ ] 회사 owner repo PR 워크플로 전환 시도 — branch + 셀프 PR + auto-merge alias (5초)
- [ ] backup-pre-pr-split branch 삭제 결정 (dogfood 며칠 후 안전 확인)

---

## 🔮 V0.7+ 후보 (dogfood 결과로 진입 결정)

- [ ] Tauri 2 Mobile — 모바일에서 본인 UI 사용
- [ ] "Claude 응답 paste → 자동 callout" 회의록 영역
- [ ] 녹음 파일 직접 업로드 → 자동 STT
- [ ] Tauri 데스크탑 `.dmg` 빌드 + 코드 사인
