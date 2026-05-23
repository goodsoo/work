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
- [x] `portfolio/PortfolioCardMenu.tsx`
- [x] `portfolio/PortfolioProjectList.tsx`
- [x] `portfolio/PortfolioWorkCard.tsx` (큰 카드 — 본문 / 부제 + 복원/삭제 button; chip span 들은 일관 패턴이라 raw 유지)
- [x] `portfolio/ResponsePasteArea.tsx`
- [~] `portfolio/ScreenshotDropzone.tsx` (label 자체가 dropzone — 내부 inner span 그대로)
- [x] `portfolio/SyncButton.tsx`

### meetings (extras)
- [x] `meetings/AttendeeTagInput.tsx`
- [x] `meetings/CopyButton.tsx`
- [x] `meetings/EditableList.tsx`
- [~] `meetings/MarkdownView.tsx` (react-markdown component override — 이미 styled wrapper, Text 흡수 시 double wrap. 가치 미미로 raw 유지)
- [x] `meetings/MeetingsList.tsx`
- [x] `meetings/MeetingsTreeView.tsx`
- [x] `meetings/SlashCommandPopover.tsx`
- [~] `meetings/SourceBodyEditor.tsx` (textarea + mirror div — raw 유지)
- [x] `meetings/TrashPreview.tsx`

### 기타
- [x] `App.tsx` (MeetingsEmpty 의 p Text 흡수)
- [x] `Tooltip.tsx` (raw 자리 0)
- [x] `Toast.tsx` (close X icon button + 본문 Text)

### 시맨틱 토큰 (`src/index.css` `@theme`)
- [x] `--opacity-{disabled,secondary,hover,active,overlay}` (raw `opacity-40/60/90/80/50` 자리 점진 migration — utility 자동 생성됨)
- [x] `--z-{dropdown,sticky,overlay,modal,popover,tooltip,toast}` (raw `z-10/20/30/40/50` 자리 점진 migration)
- [x] `--shadow-{card,modal,popover}` (`--surface-frost-shadow` 와 별개)
- [x] `--motion-{fast,base,slow}` (Tailwind default `duration-150` 등과 호환)

### DESIGN.md 11 dimension
- [x] §1 Color
- [x] §2 Typography
- [x] §3 Spacing
- [x] §4 Radius — 사용처 분포 + Tailwind default 유지 근거
- [x] §5 Effects (5.1 Shadow / 5.2 Opacity / 5.3 Blur)
- [x] §6 Motion (motion-fast/base/slow 토큰 + keyframes)
- [x] §7 Z-index (layer scale)
- [x] §8 Layout (renumbered from §5)
- [x] §9 Interaction primitives (hover/active/focus)
- [x] §10 Icon vocabulary
- [x] §11 Components — Button + Text 노트 추가 + 11.4~11.10 정리

---

## 8. Post-1차 추출 진단 (재실행 — 2026-05-23 갱신)

ds-extract 스킬 갱신본 (9 카테고리 inventory + canonical 비교 모드 + ralph guard 추가) 으로 *1차 추출 후* 현재 상태 재진단.

### 8.1 Discovery 변화

| 항목 | 1차 전 | 1차 후 |
|------|--------|--------|
| Unique CSS vars | ~30 | **78** |
| Tailwind 자리 사용 강도 top | text(270) / button(141) | w(320) / h(255) / px(186) / gap(170) / py(163) / rounded(140) — layout 중심 |
| raw hex | 단 3건 | **4건** (대부분 useTheme.ts JS 상수, 의도된 케이스) |
| var(--*) 사용 | hex 직접 우세 | **var() 토큰 우세** — border-default(101) / text-secondary(97) / text-primary(87) / text-muted(82) / bg-surface(63) |

### 8.2 토큰 11 dimension 잔여

| dim | 1차 후 상태 | 잔여 작업 |
|-----|-----------|----------|
| Color | ✓ 토큰화 완료 | — |
| Typography | text-sm 46 / text-xs 21 / font-semibold 25 / font-mono 21 / font-serif 19 | input/textarea/container 자리 그대로 OK. Text wrap 가능 자리는 다 흡수됨 |
| Spacing | px/py/gap utility 일관 | 시맨틱 spacing 토큰 추가는 ROI 낮음 (Tailwind utility 가 design system) |
| Radius | rounded-md 56 / lg 34 / none 20 / full 20 | 분포 일관 — 토큰 추가 X |
| Effects | shadow 17 / opacity 45 (50/60/80/40 등 분포) / blur 34 | `--opacity-{disabled,hover,...}` 박힘. raw 자리 className 갈아엎기는 점진 migration (선택) |
| Motion | raw `transition` 147 / ease-out 1 | `--motion-fast/base/slow` 박힘. 자리 갈아엎기 X |
| Z-index | z-30(9) / z-50(6) / z-10(4) / z-40(3) / z-20(3) | `--z-{dropdown,sticky,...}` 박힘. raw 자리 점진 migration 가능 |
| Layout | --app-header-h / --page-header-h / --titlebar-* | 충분 |
| Interaction | hover:bg-* / hover:opacity-* — Button 흡수 | focus-visible:ring-2 통일 (현재 3자리만, micro-interaction primitive 박을 가치 미미) |
| Icon | lucide-react 일관 (Trash2/Check/Loader2/Plus/Pencil/Eye/BookOpen) | 중복 의미 0 — 표준화 0 작업 |

### 8.3 9 카테고리 cover 진단

| # | 카테고리 | 현 cover | 갭 |
|---|---------|---------|----|
| 1 | Form / Input | Button + common/LooseDate/Time/Meeting/CategoryPicker — 5/22 | Input/Textarea/Select/Combobox/Checkbox/Radio/Switch/Slider 등 17개 미정의 (도메인 필요 시 신규 구축) |
| 2 | Feedback / Status | Toast + Tooltip — 2/20 | Badge/Chip/Tag/Pill/Progress/Spinner/Skeleton/EmptyState/StatusBox 18개 갭. **EmptyState 패턴 4 자리 산재** — 추출 후보 |
| 3 | Data display | Card 패턴 (PortfolioWorkCard, MeetingsList) + MarkdownView (code/table/tree) — 2/22 | List/Stat/Avatar 등 미정의 (필요 시) |
| 4 | Navigation | PageHeaderBar + SidePanel + AppShell + BottomTabs + PageHeader — 5/19 | 충분 (1인 dogfood 한정) |
| 5 | Overlay | **Modal** (common) — 1/12. ConfirmDialog/10 modal 모두 Modal 흡수 ✓ | Popover (Sort menu / dropdown 패턴 산재) **추출 후보**, Drawer/Sheet 미정의 |
| 6 | Layout | PageHeaderBar / AppShell / Modal — 3/21 | Container/Stack/Divider 미정의 (Tailwind utility 가 대체) |
| 7 | Disclosure | — 0/6 | **명백한 갭** — accordion/collapsible 미사용 (현재 도메인 필요성 X) |
| 8 | Media | — 0/5 | **명백한 갭** (consumer 가 media 안 다룸, 의도된 누락) |
| 9 | Utility / Primitive | **Text** (common) — 1/10 | Kbd (MeetingForm/JournalOverlay 인라인 4자리 — **추출 후보**), Icon wrapper 미정의 (lucide-react 직접) |

### 8.4 prop API audit

- variant prop: Button(primary/secondary/danger/info/ghost/icon), Text(display/h1/h2/h3/h4/body/caption/label) — 일관 enum
- size prop: Button(sm/md), Text variant 안 흡수
- cva 사용: **0** — 자체 변형 시스템 (variant 내부 분기)
- clsx/tailwind-merge: **0** — 자체 className 합치기
- Radix / Headless / Aria: **0** — Tailwind + raw HTML

진단: variant/size 일관. variant 시스템 cva 도입은 1인 dogfood 차원 ROI 낮음.

### 8.5 2차 추출 후보 (선택)

1차에서 빠진 것 + 진단 결과 신규 후보:

| 컴포넌트 | 자리 | ROI |
|---------|------|-----|
| **`<EmptyState>`** | App.tsx MeetingsEmpty / PortfolioPage EmptyVault·EmptyFilter / TodosPage EmptyState / 4 자리 패턴 동일 (큰 안내 + 아이콘 + 옵션 button) | 중 (4 자리, 미래 페이지 추가 시 재사용) |
| **`<Popover>`** | SidePanel Sort menu / FolderContextMenu / MeetingContextMenu / TodoRow 연결 메모 dropdown / MeetingPicker / CategoryPicker — 6 자리 패턴 (외부 클릭 닫기 + ESC + ref tracking) | 큼 (6 자리, 큰 boilerplate 흡수) |
| **`<Kbd>`** | PortfolioGuideModal Kbd helper + MeetingForm EmptyBodyCTA + ShortcutsSection kbd row — 일관 styling | 작음 (3-4 자리, 짧은 작업) |
| **`<Spinner>`** | Loader2 + animate-spin 5 자리 일관 | 작음 (4-5 자리, wrap 가치 미미) |
| **`<Badge>`** / **`<Chip>`** | TaskAddModal CategoryChip / portfolio chip / DueChip / meeting chip — 8+ 자리 chip 패턴 산재 | 큼 (8+ 자리, variant 통일 가치) |

### 8.6 PR 순서 plan (2차)

위험도 + 자리 수 + dogfood 의존성 기준:

- **PR 2a — `<Popover>` 추출** (6 자리, 가장 큰 boilerplate)
- **PR 2b — `<EmptyState>` 추출** (4 자리, 미래 페이지 보호)
- **PR 2c — `<Badge>` / `<Chip>` 추출** (8+ 자리, variant 통일)
- **PR 2d — `<Kbd>` / `<Spinner>` 작은 추출** (선택, 묶음 가능)

각 PR 별로 단일 PR (포트폴리오 카드 1장 임팩트). 시각 회귀 위험 dogfood 검증.

### 8.7 변경 사항 (1차 작업 통계)

- commit: 18개 (Modal/Button/Text/PageHeaderBar 정의 + 모달 10 + 비-모달 + 시맨틱 토큰 + DESIGN.md + 회기 fix)
- 파일 변경: 80+ 파일
- typecheck + test pass
- raw `<button>` 자리 11개 (Button 정의 2개 제외 9개 — wrap 불가 케이스)
- DESIGN.md 11 dimension 갱신 + Button/Text/Modal/PageHeaderBar 노트
