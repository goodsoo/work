# Canonical Extraction Plan — 2026-05-23

`/ds-extract` 결과. 단일 consumer (goodsoob-work) 의 design-system 정식화 plan. 본인 dogfood — 별 repo 분리 X (§5).

> **2026-05-23 갱신**: ① main pull (PR #35·#36) 반영 — `--cat-*` 7개 토큰 + dot 섹션 이미 DESIGN.md 에 들어갔음. ② 사용자 결정: 잘게 쪼개지 말고 **단일 PR 로 묶음** (포트폴리오 카드 1장 임팩트 단위).

## 1. Hex audit

### Top hex (`src/**/*.{ts,tsx,css}`)

대부분 `src/index.css` 의 토큰 정의 안에만 등장. 누수 3건뿐:

```
src/components/meetings/MeetingForm.tsx:754   color: "#fff"            ← 토큰화 대상
src/hooks/useTheme.ts:15                       light: "#ffffff"         ← 의도된 JS 상수 (radial wipe)
src/hooks/useTheme.ts:16                       dark: "#1a1a1a"          ← 의도된 JS 상수
```

- `MeetingForm.tsx:754` — `var(--text-inverse)` 로 1줄 정리 (이번 PR 에 포함).
- `useTheme.ts:15-16` — PR #23 radial wipe overlay 의 JS 상수. CSS var 를 JS 에서 읽으려면 `getComputedStyle` 필요한데 한 프레임 animation 위한 hack 이라 의도적 상수. **유지**.

### 결론

토큰 표면 깨끗. 별도 "토큰 추출 PR" 가치 0. 진짜 작업은 §3 (DESIGN.md 갱신) + §4 (컴포넌트 추출).

---

## 2. 컴포넌트 inventory (51개)

```
src/components/
├─ ConfirmDialog.tsx       Toast.tsx       Tooltip.tsx
├─ calendar/   JournalOverlay
├─ common/     CategoryPicker · ClipPromptButton · LooseDateInput ·
│              LooseTimeInput · MeetingPicker
├─ meetings/   AttendeeTagInput · CopyButton · EditableList · MarkdownView ·
│              MeetingForm · MeetingsList · MeetingsTreeView · MoveFolderModal ·
│              SlashCommandPopover · SourceBodyEditor · TrashModal · TrashPreview
├─ nav/        AppShell · BottomTabs · PageHeader · SidePanel
├─ portfolio/  PortfolioCardMenu · PortfolioDetailModal · PortfolioGuideModal ·
│              PortfolioProjectList · PortfolioSidePanel · PortfolioTrashModal ·
│              PortfolioWorkCard · ResponsePasteArea · ScreenshotDropzone ·
│              SyncButton
├─ settings/   BackupSection · HelpSection · SettingsModal · ShortcutsSection ·
│              VaultSection
├─ tasks/      TaskAddModal
├─ timeline/   JournalBlock · MeetingBlock · MonthGrid · TimelineBlock · TodoBlock
├─ todos/      TodoRow · TodoTrashModal
└─ vault/      VaultDisconnected · VaultGate · VaultPicker
```

### Modal 클러스터 (10개) — STRONG 통일 후보

모두 동일 패턴:

```tsx
className="fixed inset-0 z-50 flex items-center justify-center p-6"
role="dialog" aria-modal="true"
onMouseDown 에 backdrop 가드 (target === currentTarget)
useEffect 로 Escape 키 → onClose
```

| 컴포넌트 | open prop | 추가 state | 비고 |
|---------|-----------|-----------|------|
| `ConfirmDialog` | always-mounted | — | 가장 단순. 변환 진입점 |
| `SettingsModal` | `isOpen` | `initialSection` | section navigation |
| `TrashModal` (meetings) | `isOpen` | `confirmOpen` (Escape 가드) | 휴지통 |
| `TodoTrashModal` | `open` | `confirmOpen` | 휴지통 — 같은 패턴 |
| `PortfolioTrashModal` | `isOpen` | `confirmOpen` | 휴지통 — 같은 패턴 |
| `PortfolioDetailModal` | always-mounted | 폼 state 다수 | 가장 복잡 |
| `PortfolioGuideModal` | `isOpen` | — | 단순 |
| `MoveFolderModal` | `open` | folder picker state | |
| `TaskAddModal` | `open` | form state | |
| `JournalOverlay` | `isOpen` | textarea + history | overlay 라고 부르지만 modal 패턴 |

**`isOpen` / `open` / always-mounted 가 섞여 있음** — 통일 시 `open` 단일화 권장.

**Backdrop 가드 주석 동일 문구가 4곳에 복붙됨** — `<Modal>` 추출 시 자동 소거.

### Trash 패턴 (3개) — 같은 PR 안 후속 정리

`TrashModal` / `PortfolioTrashModal` / `TodoTrashModal` 모두 `confirmOpen` state + Escape 가드 (confirm 열려있을 땐 닫지 않음) 공유. `<Modal>` 추출 후 동일한 `dismissOnEscape` prop + `ConfirmDialog` 중첩으로 자연스럽게 흡수. 별 hook (`useConfirm`) 까지 만들지 X — 본인 dogfood 1인이라 그 추상화 비용 ROI 미미.

### SourceBodyEditor — 통일 후보 **아님** (보존)

`SourceBodyEditor` (697 LOC) 도메인 결합 강함:
- `inferLineKind` / `getSlashOptionsForFilter` — slash command 시스템 직접 import
- `onSendLineToInbox` — `- [ ]` 라인만 인식해서 부모로 dispatch (TaskAddModal prefill)
- mirror div + per-line height 측정 — slash + inbox 빼면 빈 껍데기

**결정**: 보존. 일반화 PR 만들지 말 것.

### 단순 통일 후보 (별 안건)

- `common/` 5개 picker — 자체적으로 깔끔, 추가 추출 작업 불요.
- `Toast` / `Tooltip` — 글로벌 단일 인스턴스, 추출 의미 없음.

---

## 3. DESIGN.md vs index.css gap (pull 후)

PR #36 (todo cat colors) 가 `--cat-*` 7개 + 카테고리 dot 섹션 + `lib/todoCategory.ts` 중앙 lookup 을 이미 추가. 여전히 누락된 토큰:

| 토큰 | 정의 위치 (index.css) | 용도 |
|-----|---------------------|------|
| `--surface-frost` | `:30, :97` | 모달/팝오버 frost 배경 |
| `--surface-frost-border` | `:31, :98` | frost 경계 |
| `--surface-frost-shadow` | `:32, :99` | frost shadow (`0 24px 48px -12px` 이중) |
| `--accent-green` | `:51, :118` | 성공 상태 (Check 아이콘 등) |
| `--app-header-h` | `:75, :139` (3.5rem → mobile / 0 → desktop) | 모바일 헤더 높이 |
| `--page-header-h` | `:79` (3.25rem) | 사이드바 + 본문 헤더 공통 row |
| `--titlebar-inset` | `:76, :83` (0 → 36px on mac-tauri) | Tauri 헤더 보정 |
| `--titlebar-traffic-inset` | `:77, :85` (0 → 80px) | traffic light 회피 |
| `--safe-top/bottom/left/right` | `:71-74` | env() safe-area |
| `--font-sans/serif/mono` | `:7-11` (@theme) | typography family |

### 그룹화 부재

현재 DESIGN.md 의 "토큰 목록" 이 색상 평면 테이블 + 카테고리 dot 보조 섹션 + Typography / Spacing / Layout / Components / 규칙 으로 분산. 정리 방향:

1. **Color** — bg / text / border / accent / surface-frost / category dot
2. **Typography** — font family + scale
3. **Spacing** — 기존 유지
4. **Layout** — 기존 + app-header / page-header / titlebar / safe-area
5. **Motion** — 현재 토큰 없음. `index.css` 의 `@keyframes` 만 있고 transition timing 변수는 0. 섹션 placeholder 만 만들고 "현재 토큰 없음, 필요 시 추가" 표기 (over-engineering 회피).
6. **Components** — 사이드 패널 / 버튼 / Form / AI 요약 / 에러 + **Modal** (새 추가) + Tooltip + Toast

### Motion 토큰

부재 — 새로 만들지 X. `transition: 0.15s` / `0.12s` 같은 raw 값이 산재하지만 dogfood 중 불편 없으므로 그대로.

---

## 4. 단일 PR plan — "디자인 시스템 정식화"

### 범위 (한 PR)

- **DESIGN.md 전면 갱신**: Color/Typography/Spacing/Motion/Layout/Components 6섹션 그룹화. §3 누락 토큰 채움 + 각 토큰 "사용처" 컬럼 (grep cross-check).
- **`#fff` 1줄 토큰화**: `MeetingForm.tsx:754` → `var(--text-inverse)`.
- **`<Modal>` 추출**: `src/components/common/Modal.tsx` 신규.
  - Props: `{ open, onClose, children, labelledBy?, dismissOnEscape? = true, className? }`
  - 내부: `fixed inset-0 z-50 flex items-center justify-center p-6`, role/aria, mousedown backdrop 가드, Escape handler, body scroll lock
- **10개 modal migration** (한 묶음):
  - 단순 → 복잡 순으로 진행하되 한 PR 안에 다 들어감
  - `ConfirmDialog` → `PortfolioGuideModal` → `MoveFolderModal` → `TaskAddModal` → `JournalOverlay` → `SettingsModal` → `TodoTrashModal` → `TrashModal` → `PortfolioTrashModal` → `PortfolioDetailModal`
  - prop name 통일: `isOpen` / `open` → **`open`**
  - 옛 backdrop 가드 주석 4곳 제거 (Modal 내부로 흡수)
- **DESIGN.md 의 Modal 노트 채움**: 새 컴포넌트 사용법.

### 영향 범위 (추정)

- 신규: `src/components/common/Modal.tsx`
- 수정: 10개 modal 파일 + `DESIGN.md` + `MeetingForm.tsx` (1줄) = 12개 파일

### 회귀 리스크 + 검증

- **시각 회귀**: backdrop / Escape / mousedown 가드 가 컴포넌트 내부로 들어가니 동작 동일해야 함. dogfood 검증.
- **AFTER 캡쳐 (대표 4장)**:
  1. SettingsModal (open) — 가장 복잡한 section nav
  2. TrashModal (meetings) — confirm 중첩
  3. PortfolioDetailModal — 가장 큰 모달
  4. DESIGN.md 그룹화 후 markdown preview
- 나머지 6개 modal 은 AFTER 생략 — 같은 `<Modal>` wrapper 만 갈아끼우는 거라 시각 동일.
- **typecheck + test**: `bun run typecheck && bun run test:run` 통과 확인.

### 카테고리

`other` — 시각 변화 거의 0, 인터랙션 동작 동일, 내부 정리 + 문서 갱신. (만약 모달 디자인 자체를 손대게 되면 `ui_ux` 로 변경.)

### PR body 한 줄 임팩트 (초안)

"디자인 시스템 정식화 — 토큰 그룹화 + Modal 통일"

---

## 5. 본인용 vs 외부 공개 / repo 분리

이 repo 는 **단일 consumer** (goodsoob-work 본인 데스크탑 앱). multi-consumer canonical extraction 시나리오 X.

- **별 design-system repo 분리 안 함**: npm publish + workspace + version bump 흐름이 1인 dogfood 에서 ROI 마이너스. V0.7.x iterate 속도와 충돌. 빌더 모드 톤 (CLAUDE.md) "over-engineering 회피" 와도 안 맞음.
- 분리 의미 생기는 시점: 두 번째 consumer (회사 도구 / 다른 사이드 프로젝트) 가 실제 같은 토큰/Modal 을 import 하기 시작할 때. 그 전까진 `src/components/common/` 내부 폴더 추출이 같은 추상화 이득을 0 비용으로 줌.
- 포트폴리오 임팩트 = "DESIGN.md 정식화 + Modal 통일 PR 1장" 자체로 이미 구체적.

---

## 6. 진행

- 이 worktree (`feat/design-system`) 에서 §4 단일 PR 작업
- 작업 순서 (한 commit 또는 합쳐서):
  1. `<Modal>` 컴포넌트 신규 작성
  2. 10개 modal migration (단순 → 복잡)
  3. `MeetingForm.tsx:754` `#fff` → `var(--text-inverse)`
  4. `bun run typecheck && bun run test:run`
  5. dogfood — 데스크탑 dev 띄워서 10개 modal 다 열어보기 (포트는 다른 worktree 와 충돌 안 나게 1421)
  6. DESIGN.md 전면 갱신
  7. AFTER 캡쳐 4장
  8. `/takeoff`

---

## 7. Ralph-loop 자동 실행

이 plan 을 사용자 개입 없이 끝까지 진행:

```
/ralph-loop:ralph-loop "EXTRACTION_PLAN.md 따라 진행. 끝까지. §7 guard 엄수. [progress] 매 iteration 갱신." --completion-promise "DS_EXTRACTION_COMPLETE" --max-iterations 40
```

### guard — 의문 시 default

- **컴포넌트 추출 깊이**: wrap 가능한 모든 자리. raw `<button>` / `text-{xs,sm,base,lg,xl,2xl}` / 시맨틱 heading 자리 다 흡수. input/textarea 의 `text-*`, 컨테이너 inherit 자리만 raw 유지.
- **시맨틱 토큰**: 11 dimension 다 정식화. `--opacity-{disabled,hover,active,secondary}` / `--z-{modal,popover,tooltip,toast}` / `--shadow-{card,modal,popover}` / `--motion-{fast,base,slow}` + audit 결과 빠진 dimension 추가.
- **variant 이름**: 자체 판단 — Button: primary/secondary/danger/info/ghost/icon, Text: display/h1/h2/h3/h4/body/caption/label (이미 정의됨, src/components/common/Button.tsx / Text.tsx 참조).
- **분할 정책**: 단일 PR. "사이즈 큼" 이유로 분할 X.
- **메타 발언 금지**: "사이즈 큼" / "한 turn 안 끝남" / "분할 제안" / "다음 turn 안내" / "옵션 A vs B" 류 사용자 의사 결정 묻기 X. 의문 시 default 따라 그냥 진행.

### 매 iteration

1. grep 으로 남은 raw 자리 확인 — 한 파일 또는 한 dimension 골라 진행
2. 자리 흡수 → `bun run typecheck` pass 확인. 실패 시 같은 iteration 안에서 fix
3. `[progress]` 체크리스트 갱신 — 끝낸 파일 / 끝낸 dimension 체크
4. DESIGN.md 의 해당 dimension 섹션 갱신 (해당 iteration 에서 건드린 dimension 만)
5. `git add <changed-files>` + `git commit -m "feat(ds): <작업 단위 요약>"` — 작업 단위 (한 파일 / 한 dimension / 한 묶음) 마다 1 commit. push 안 함.

### 완료 조건

- `bun run typecheck && bun run test:run` 둘 다 pass
- raw `<button>` 자리 ~10 이하 (wrap 불가 케이스만 — `<details><summary>` 안, native control, 도메인 결합 강한 자리)
- 시맨틱 토큰 4 묶음 다 박힘 (opacity/z/shadow/motion)
- DESIGN.md 11 dimension 다 갱신
- `[progress]` 다 체크

→ `<promise>DS_EXTRACTION_COMPLETE</promise>` 출력

## [progress]

### 컴포넌트 정의
- [x] `src/components/common/Modal.tsx`
- [x] `src/components/common/Button.tsx`
- [x] `src/components/common/Text.tsx`

### 모달 클러스터 (Button + Text 흡수)
- [x] `ConfirmDialog.tsx`
- [x] `TodoTrashModal.tsx`
- [x] `MoveFolderModal.tsx`
- [x] `PortfolioGuideModal.tsx`
- [x] `PortfolioTrashModal.tsx`
- [x] `TrashModal.tsx` (meetings)
- [x] `TaskAddModal.tsx`
- [x] `JournalOverlay.tsx`
- [x] `SettingsModal.tsx`
- [x] `PortfolioDetailModal.tsx`

### 비-모달 hot spots
- [x] `nav/SidePanel.tsx` (1295줄, ~25 button + ~15 text)
- [x] `meetings/MeetingForm.tsx` (1549줄, ~15 button + ~21 text — `#fff` 토큰화 이미 됨)
- [x] `todos/TodoRow.tsx` (723줄, 7 button + 10 text)
- [x] `nav/AppShell.tsx` (438줄, 7 button)
- [x] `settings/BackupSection.tsx` (348줄, 4 button + 18 text)
- [x] `settings/VaultSection.tsx` (185줄, 4 button + 10 text)
- [x] `settings/ShortcutsSection.tsx`
- [x] `settings/HelpSection.tsx`

### 페이지
- [x] `pages/CalendarPage.tsx` (476줄, 3 button — 월 nav)
- [x] `pages/TodosPage.tsx` (raw 자리 0)
- [x] `pages/PortfolioPage.tsx` (raw 자리 0)
- [~] `pages/MeetingsPage.tsx` (파일 없음 — 컴포넌트 직접 라우팅, skip)

### timeline
- [x] `timeline/JournalBlock.tsx` (raw 자리 0)
- [x] `timeline/MeetingBlock.tsx` (2 text)
- [x] `timeline/MonthGrid.tsx` (1 button + 3 text)
- [x] `timeline/TimelineBlock.tsx` (1 text — letter span)
- [x] `timeline/TodoBlock.tsx` (1 button + 1 text)

### common
- [x] `common/CategoryPicker.tsx`
- [x] `common/ClipPromptButton.tsx`
- [~] `common/LooseDateInput.tsx` (input className text-xs/sm — raw 유지, guard 명시)
- [~] `common/LooseTimeInput.tsx` (input className — raw 유지)
- [x] `common/MeetingPicker.tsx`

### vault
- [x] `vault/VaultDisconnected.tsx`
- [x] `vault/VaultGate.tsx` (raw 자리 0)
- [x] `vault/VaultPicker.tsx`

### portfolio (extras)
- [ ] `portfolio/PortfolioCardMenu.tsx`
- [ ] `portfolio/PortfolioProjectList.tsx`
- [ ] `portfolio/PortfolioWorkCard.tsx`
- [ ] `portfolio/ResponsePasteArea.tsx`
- [ ] `portfolio/ScreenshotDropzone.tsx`
- [ ] `portfolio/SyncButton.tsx`

### meetings (extras)
- [ ] `meetings/AttendeeTagInput.tsx`
- [ ] `meetings/CopyButton.tsx`
- [ ] `meetings/EditableList.tsx`
- [ ] `meetings/MarkdownView.tsx`
- [ ] `meetings/MeetingsList.tsx`
- [ ] `meetings/MeetingsTreeView.tsx`
- [ ] `meetings/SlashCommandPopover.tsx`
- [ ] `meetings/SourceBodyEditor.tsx`
- [ ] `meetings/TrashPreview.tsx`

### 기타
- [ ] `App.tsx` (모달 caller prop 갱신 이미 됨, raw 자리 마저)
- [ ] `Tooltip.tsx` / `Toast.tsx` (글로벌 단일 인스턴스 — wrap 안 해도 됨, 검토)

### 시맨틱 토큰 (`src/index.css` `@theme`)
- [ ] `--opacity-{disabled,hover,active,secondary}` + raw `opacity-*` 자리 갈아엎기
- [ ] `--z-{dropdown,sticky,modal,popover,toast,tooltip}` + raw `z-*` 자리
- [ ] `--shadow-{card,modal,popover}` + raw `shadow-*` 자리
- [ ] `--motion-{fast,base,slow}` + raw `transition` / `duration-*` 자리 (Tailwind default 충분하면 명시만)

### DESIGN.md 11 dimension
- [x] §1 Color (이미 갱신됨)
- [x] §2 Typography
- [x] §3 Spacing
- [ ] §4 Radius — 토큰 매핑 + Button/Modal 의 radius 사용처
- [ ] §5 Effects (shadow / blur / opacity)
- [ ] §6 Motion (transition / duration)
- [ ] §7 Z-index (layer scale)
- [x] §8 Layout (이미 부분 갱신)
- [ ] §9 Interaction primitives (hover/active/focus)
- [ ] §10 Icon vocabulary
- [ ] §11 Components — Button + Text 노트 추가 (Modal 만 있음)
