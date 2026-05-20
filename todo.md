# todo

PR 단위로 묶음. 각 PR 의 **한 줄 임팩트** 는 카드 frontmatter `impact_summary` 후보. 카테고리는 `ui_ux | backend | infra | fix | other`.

완료 기록은 [done.md](done.md) 참조.

---

## 🚀 메모 에디터 (마크다운) 강화

### PR — 마크다운 typing UX 강화 `ui_ux`
한 줄 임팩트: 메모 본문 typing 이 옵시디안 수준으로

- [ ] Tab/Shift+Tab indent — 단일 + 다중 줄, 리스트 안에선 list level 증가, 일반 라인은 2-space
- [ ] Enter 자동 list marker 연장 — `-` / `1.` / `- [ ]` / `>` 다음 줄 자동. 빈 marker 줄 Enter = 종료. IME composition 안전 (`e.isComposing`)
- [ ] URL paste over selection → `[선택텍스트](URL)` 자동 변환
- [ ] textarea smart dashes 비활성화 — macOS `--` → `—` 자동 변환 차단. textarea props (autoCorrect/spellCheck off) + 안 막히면 input event intercept fallback
- [ ] textarea 아래 빈 영역 클릭 → 커서 끝으로 포커스. 본문/transcript 둘 다

### PR — 마크다운 단축키 묶음 `ui_ux`
한 줄 임팩트: 본문 단축키로 마우스 동선 제거

- [ ] ⌘B / ⌘I bold/italic wrap — 선택 있으면 감싸기, 없으면 빈 wrap + 커서 가운데. toggle (이미 wrap 됐으면 unwrap)
- [ ] Alt+↑/↓ 줄 이동 — 다중 줄 선택 시 블록 전체
- [ ] ⌘Shift+D 줄 복제
- [ ] Opt+Q / Opt+W / Opt+E sub-tab 단축키 — input/textarea 포커스에서도 동작. macOS default 글자 (`œ`/`∑`/´) preventDefault. Tauri + 브라우저 둘 다

### PR — 마크다운 보기 모드 + 시각 위계 정비 `ui_ux`
한 줄 임팩트: 보기 모드가 옵시디안만큼 정확히 렌더 + 편집 모드 위계 명확

- [ ] MarkdownView 체크박스 (`- [ ]`) 렌더링 + 보기 모드 클릭 토글로 body 마크다운 직접 수정
- [ ] MarkdownView 4-space indented code block 렌더링 (pre/code 컴포넌트 매핑 점검)
- [ ] 편집 모드 line gutter — opacity 폐기. SVG dotted vertical (┊) + dotted corner 두 글리프. `inferLineKind` 에 다음 줄 look-ahead 추가 → 새 항목 = solid 아이콘 / 이어짐 중간 = dotted vertical / 이어짐 마지막 = dotted corner / plain = 빈 자리

### PR — undo/redo 변경 탭 자동 전환 `ui_ux`
한 줄 임팩트: undo 가 다른 탭에서 일어났을 때 자동 전환되어 즉시 보임

- [ ] `useStateHistory` source ("body"/"transcript"/"summary"/"meta") 추적 → undo/redo 시 해당 탭으로 `setActiveTab` 자동 호출. meta 는 본문 탭 내부라 본문 탭 유지

### PR — 메모 제목 input undo/redo `ui_ux`
한 줄 임팩트: 제목도 ⌘Z 로 되돌아감 (메타 3 field 는 이미 docHistory 통합됨)

- [ ] 제목 input 에 `useStateHistory<string>` 도입 + onCommit noop + 명시 commit (blur/Enter) 시 mutation. 본문 history 와 일관

### PR — 본문 word-wrap + gutter dynamic alignment `ui_ux`
한 줄 임팩트: 한국어 메모 자연 줄넘김 + gutter 정확 정렬

- [ ] textarea `wrap="on"` + gutter marker 가 wrap 된 visual line 과 align. hidden mirror div 가 같은 width/font/line-height 으로 source line 별 actual visual height 측정 → gutter marker height 동기. ResizeObserver 로 textarea width 변경 감지 + debounce. ~40-50줄

---

## ✨ 신규 기능

### PR — 루틴 (매일 하는 할일) `ui_ux`
한 줄 임팩트: 출퇴근 / 운동 같은 매일 streak 시각화

- [ ] vault `routines/` 폴더 신설. 1 routine = 1 md 파일 (frontmatter `type: routine`, `schedule: every day` 등)
- [ ] 본문은 Obsidian Tasks 호환 라인 (`- [x] ✅ YYYY-MM-DD`) 이력 누적
- [ ] ActivityBar 새 탭 "루틴" (⌘5). 좌측 routine 리스트 (오늘 체크박스 + 현재 streak `🔥7`), 우측 12주 GitHub-style heatmap + 통계 (현재/최장 streak, 30일 완료율)
- [ ] 놓친 날 자동 fail (streak break). 수동 휴무일 토글 (`- [-] 휴무 YYYY-MM-DD`) 로 streak 보호

### PR — Tauri 윈도우 헤더 통합 `ui_ux`
한 줄 임팩트: ActivityBar 가 헤더로 흡수돼 본문 +48px 확보 + 무경계

- [ ] `tauri.conf.json` `titleBarStyle: "Overlay"` + `hiddenTitle: true`. ActivityBar 를 traffic light 옆 같은 줄로
- [ ] 헤더 배경 = sidepanel 배경 통일 (전체 한 덩어리)
- [ ] ActivityBar 빈 공간에 `data-tauri-drag-region` 명시
- [ ] macOS 전용 — Windows/Linux fallback (native title bar 유지)

### PR — 시간 input 자연어 키워드 `ui_ux`
한 줄 임팩트: 시간 칸에 "지금" / "now" 입력하면 현재 시각 자동

- [ ] `lib/dates.ts` 키워드 매핑 (지금 / now / 현재 → 현재 HH:mm). blur/Enter 시점에 변환. vault md 에는 실제 시각 저장 (키워드 X)

---

## 🎨 폴리시

### PR — 테마 전환 radial wipe `ui_ux`
한 줄 임팩트: 테마 토글 시 누른 곳에서 원형으로 퍼지는 wipe

- [ ] View Transitions API + clip-path circle. 토글 버튼 클릭 좌표 origin. 0.8s ease-out. 갑자기 밝아져 눈 아픈 문제 해결

### PR — toast/에러 박스 overflow 수정 `fix`
한 줄 임팩트: 긴 에러 메세지도 박스 안에 잘 fit + 재시도 버튼 보임

- [ ] toast 컨테이너 max-width + 텍스트 영역 min-w-0 + break-words + 액션 버튼 flex-shrink-0. 한 컴포넌트 수정으로 모든 toast 적용

### PR — UI 패딩 / 캘린더 폴리싱 `ui_ux`
한 줄 임팩트: 잔여 디자인 inconsistency 정리

- [ ] 에러 상태 p-3 / p-4 혼재 통일
- [ ] 캘린더 스크롤만으로 다른 월 본 상태도 페이지 전환 시 복원 (selectedDate 안 바뀌어도)

### PR — 날짜/시간 표시 포맷 통일 `ui_ux`
한 줄 임팩트: 앱 전체 날짜/시간 표시가 한 컨벤션으로

- [ ] **메모장 사이드바 카드** — `MM.DD(ddd) HH:mm · 참석자 N명`. 올해면 연도 생략, 올해 아니면 `YYYY.MM.DD(ddd) HH:mm`
- [ ] **휴지통 카드** — 메모장 카드와 동일 포맷 통일. 삭제 시각은 카드 secondary 영역 (하단 또는 작은 글씨로 별도 위치)
- [ ] **앱 전체 검토 + 통일** — 메모 본문 메타 row / 캘린더 라벨 / todos 마감일 / portfolio 카드 등 표시 위치 찾아 한 컨벤션으로
- [ ] **`lib/dates.ts` 단일 포맷 함수 도입** — `formatMeetingDate()` / `formatTrashDate()` 등 → 모든 호출처 통일. 새 표시 위치 추가 시 함수만 호출

---

## 🛡️ Vault 안정성 (V0.6.1 후속)

### PR — vault 파일 read 안정성 `backend`
한 줄 임팩트: 깨진 frontmatter / 중복 uid / 외부 sync 충돌 파일도 데이터 표시 유지

- [ ] frontmatter parse 실패 graceful fallback — 빈 frontmatter + body 그대로. title=파일명, date=null 로 사이드바 표시. 사용자가 직접 수정 가능
- [ ] uid 중복 감지 — scanMeetings 끝에 `Set<uid>` 검사. 외부 복사/merge 로 두 파일 같은 uuid 면 mtime 늦은 메모 재발급 + write
- [ ] 깨진 파일 사용자 alert banner — "N 개 메모를 읽지 못했어요" 사이드바 banner, 클릭 시 디스크 path 표시
- [ ] iCloud `(conflicted copy)` 같은 sync 충돌 파일 vault 스캔에서 무시

### PR — Conflict resolution 모달 `backend`
한 줄 임팩트: 옵시디안 모바일과 동시 편집 충돌 시 보존/덮어쓰기 선택

- [ ] ConflictError throw → UI 모달 (내 변경 보존 / 외부 변경 가져오기 / `.conflict-*.md` 파일 생성)

### PR — vault 스캔 성능 실측 + 캐시 결정 `infra`
한 줄 임팩트: 큰 vault 도 빠르게

- [ ] 수백 파일 < 50ms 가설 실측 → frontmatter only 부분 캐시 도입할지 결정

---

## 📊 Portfolio (V0.7.x 후속)

### PR — gh 호출 인프라 강화 `backend`
한 줄 임팩트: gh 인증/네트워크 실패도 매끄럽게

- [ ] gh 미설치 / 미로그인 별도 모달 (현재는 sidebar inline)
- [ ] 회사 HTTPS outbound 차단 감지 + 자동 sync off 설정 (매일 토스트 떠야 발견)
- [ ] gh enrich concurrency 5 병렬 (현재 직렬, 첫 sync 3분 통증 시 도입)
- [ ] `gh search prs` 페이지네이션 (1000+ 케이스 대비)

### PR — 백업 / sync 개선 `infra`
한 줄 임팩트: 백업 efficiency + sync 유연성

- [ ] 기간별 백업 — 일 7개 + 주 4개 + 월 6개 bucket. 현재는 단순 full zip × 10개
- [ ] 전체 재동기화 버튼 — since 무시하고 full fetch (rename 발생 시 옛 PR 매칭)
- [ ] portfolio 진단 console.log 제거 (dogfood 안정화 후)

### PR — GitHub 카드 동기화 보호 `backend`
한 줄 임팩트: PR 삭제돼도 평가 자료 보존

- [ ] "GitHub 에서 사라진 카드 식별" 도구 — "이 카드 PR 이 GitHub 에 없습니다. 보관/휴지통/무시?" 선택. 자동 삭제 절대 X

### PR — PR body 이미지 자동 import `backend`
한 줄 임팩트: PR 의 before/after 이미지 자동 vault 다운로드

- [ ] sync 가 PR body 의 `<img src>` / `![](url)` 추출 → URL fetch → `_attachments/{slug}/before-N.png` 다운로드 → screenshots frontmatter 자동 채움. 본인 dropzone 박은 거 보존. private repo URL 은 gh auth token

### PR — commit cluster 카드 (Plan B) `backend`
한 줄 임팩트: 회사 PR 워크플로 전환 부담 크면 branch cluster 로 대체

- [ ] branch 단위 commit cluster → AI 입력 commit messages 로 카드 생성

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
- [ ] Server-side 메모 history — vault git commit 활용
- [ ] Tauri 데스크탑 `.dmg` 빌드 + 코드 사인
