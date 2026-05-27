# Design System — goodsoob-work

본인 1인 사용 데스크탑 앱 (Tauri) 의 시각 토큰 + 컴포넌트 규약. 단일 consumer 라 외부 공개·npm publish 대상 X — `src/components/common/` 폴더 추출이 같은 추상화 이득을 0 비용으로 줌. 별 design-system repo 분리는 두 번째 consumer 가 생기는 시점으로 보류.

핵심 규칙 3가지:

1. **색상은 토큰으로만.** `dark:` 접두사 / 하드코딩 hex 사용 금지. (예외: `useTheme.ts` 의 radial-wipe overlay JS 상수.)
2. **Tailwind 는 레이아웃 전용.** flex / grid / padding / margin / rounded / text-size. 색상은 `style={{ color: "var(--*)" }}`.
3. **min-height 44px**: 모든 인터랙티브 요소 (모바일 터치) — `index.css` 의 `button, a` 글로벌 규칙이 처리. 작은 chip 류는 `minHeight: 0` 으로 명시 해제.

---

## 1. Color

모든 색은 `:root` (라이트) 와 `.dark` (다크) 에 정의된 CSS 변수. 다크 토글은 `useTheme()` hook → `<html>.dark` class.

### 1.1 Background

| 토큰 | 라이트 | 다크 | 사용처 |
|------|--------|------|--------|
| `--bg-base` | `#ffffff` | `#1a1a1a` | body, main, modal inner |
| `--bg-surface` | `#fafafa` | `#242424` | 카드, 사이드패널, 입력 필드 |
| `--bg-surface-hover` | `#f4f4f5` | `#2a2a2a` | hover 상태 (전역 `button:not(:disabled):hover` 도 이 토큰) |
| `--bg-surface-active` | `#e4e4e7` | `#333333` | 선택/활성 상태 |
| `--bg-overlay` | `rgba(255,255,255,0.92)` | `rgba(26,26,26,0.92)` | 헤더 backdrop, `PortfolioDetailModal` backdrop |

### 1.2 Surface frost (모달 / 토스트 / 패널)

토큰 셋. `Toast`, `MeetingForm` 의 `actionError` / `copiedToast` 안내 패널 등 floating UI 의 frost-glass 효과.

| 토큰 | 라이트 | 다크 | 사용처 |
|------|--------|------|--------|
| `--surface-frost` | `rgba(255,255,255,0.78)` | `rgba(30,30,30,0.65)` | floating panel 배경 |
| `--surface-frost-border` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.08)` | frost 경계선 |
| `--surface-frost-shadow` | `0 24px 48px -12px rgba(0,0,0,0.22), 0 8px 16px -4px rgba(0,0,0,0.1)` | `0 24px 48px -12px rgba(0,0,0,0.6), 0 8px 16px -4px rgba(0,0,0,0.35)` | 이중 shadow |

### 1.3 Text

| 토큰 | 라이트 | 다크 | 사용처 |
|------|--------|------|--------|
| `--text-primary` | `#18181b` | `#e4e4e7` | 본문 텍스트 |
| `--text-secondary` | `#71717a` | `#a1a1aa` | 라벨, 메타데이터 |
| `--text-muted` | `#a1a1aa` | `#71717a` | placeholder, 비활성 아이콘. **본문에 사용 금지** (WCAG AA 본문 기준 미달) |
| `--text-inverse` | `#ffffff` | `#18181b` | 버튼 위 텍스트 (`btn-primary` 위, accent-red 버튼 위 — `MeetingForm` 재시도 등) |

### 1.4 Border

| 토큰 | 라이트 | 다크 | 사용처 |
|------|--------|------|--------|
| `--border-default` | `#e4e4e7` | `#3f3f46` | 일반 구분선, 사이드패널 right border, 모달 inner border |
| `--border-subtle` | `#f4f4f5` | `#2a2a2a` | 캘린더 셀, 약한 구분 (헤더 안 horizontal rule 등) |

### 1.5 Accent

| 토큰 | 라이트 | 다크 | 사용처 |
|------|--------|------|--------|
| `--accent-red` | `#dc2626` | `#f87171` | 에러, 오늘 마커, 일요일, destructive 버튼 |
| `--accent-red-bg` | `#fef2f2` | `rgba(248,113,113,0.1)` | 에러 박스 배경 |
| `--accent-red-text` | `#991b1b` | `#fca5a5` | 에러 박스 텍스트 |
| `--accent-blue` | `#2563eb` | `#60a5fa` | 회의 칩, primary action confirm 버튼 |
| `--accent-blue-bg` | `#eff6ff` | `rgba(96,165,250,0.1)` | 회의 칩 배경, todo flash highlight |
| `--accent-blue-text` | `#1d4ed8` | `#93c5fd` | 회의 칩 텍스트 |
| `--accent-green` | `#16a34a` | `#4ade80` | 성공 상태 (저장 완료 Check 아이콘, MeetingForm `copiedToast`) |

### 1.6 Category dots

포트폴리오 카드 + 할 일 chip 의 카테고리 식별색. **`src/lib/todoCategory.ts` `categoryColor()` 가 todo 쪽 단일 lookup** — MonthGrid dot / SidePanel 체크박스 / TodoRow 체크박스 모두 이 함수만 사용. 포트폴리오는 `PortfolioWorkCard.tsx` 등의 `CATEGORY_COLOR` map.

| 토큰 | 라이트 | 다크 | 사용처 |
|------|--------|------|--------|
| `--cat-uiux` | `#2563eb` | `#60a5fa` | 포트폴리오 ui_ux |
| `--cat-backend` | `#16a34a` | `#4ade80` | 포트폴리오 backend |
| `--cat-infra` | `#d97706` | `#fbbf24` | 포트폴리오 infra |
| `--cat-fix` | `#dc2626` | `#f87171` | 포트폴리오 fix |
| `--cat-other` | `#7c3aed` | `#a78bfa` | 포트폴리오 other + todo 미분류 fallback (공유) |
| `--cat-work` | `#ea580c` | `#fb923c` | todo 업무 (주황 — `--cat-other` 보라와 명확히 구분) |
| `--cat-schedule` | `#0d9488` | `#2dd4bf` | todo 일정 |

미분류 (`category: null`) 인 todo 는 색 미적용 — 체크박스 border 가 `--text-muted` 기본 회색 유지, 캘린더 셀 chip 에 dot 안 그림. legacy 카드 보호.

### 1.7 Speaker chips (음성 기록 화자색)

음성 기록 보기 모드 (`MeetingForm` 의 `TranscriptView`) 의 참석자별 하이라이트. 카테고리형(positional) 팔레트 — 참석자가 적힌 순서대로 `i % 10` 배정해서 한 회의 안 10명까지 색이 안 겹침. **순서는 hue 휠 순이 아니라 연속 색이 최대한 멀어지게 정렬**: 대부분 2-4명이라 앞 색이 제일 많이 쓰이므로 앞 4개를 파랑·주황·초록·분홍 보색 쌍으로 (d3/Tableau10 방식). 라이트 = 연한 tint bg + 진한 글자, 다크 = 해당 색 `-400` 의 rgba 0.15 bg + `-300` 밝은 글자 (accent 레시피 동일). 토큰 쌍은 `--speaker-{N}-bg` / `--speaker-{N}-text` (N=0..9), 정확한 값은 `index.css`.

| # | hue | 라이트 bg / text | 다크 text |
|---|-----|------------------|-----------|
| 0 | sky | `#e0f2fe` / `#0369a1` | `#7dd3fc` |
| 1 | orange | `#ffedd5` / `#c2410c` | `#fdba74` |
| 2 | emerald | `#d1fae5` / `#047857` | `#6ee7b7` |
| 3 | rose | `#ffe4e6` / `#be123c` | `#fda4af` |
| 4 | violet | `#ede9fe` / `#6d28d9` | `#c4b5fd` |
| 5 | amber | `#fef3c7` / `#b45309` | `#fcd34d` |
| 6 | teal | `#ccfbf1` / `#0f766e` | `#5eead4` |
| 7 | fuchsia | `#fae8ff` / `#a21caf` | `#f0abfc` |
| 8 | lime | `#ecfccb` / `#4d7c0f` | `#bef264` |
| 9 | indigo | `#e0e7ff` / `#4338ca` | `#a5b4fc` |

같은 보기 모드의 mm:ss 타임스탬프 칩은 인라인 코드 칩과 동일 (`--bg-surface-hover` / `--text-primary`) — 별도 팔레트 아님.

### 1.8 Interactive

| 토큰 | 라이트 | 다크 | 사용처 |
|------|--------|------|--------|
| `--btn-primary` | `#18181b` | `#e4e4e7` | primary 버튼 배경 |
| `--btn-primary-text` | `#ffffff` | `#18181b` | primary 버튼 텍스트 |
| `--focus-ring` | `#3b82f6` | `#60a5fa` | focus 표시 (현재 사용 없음 — outline 자체 토큰화는 보류) |

### 1.9 대비 기준 (WCAG 2.2 AA)

| 조합 | 라이트 | 다크 | 기준 |
|------|--------|------|------|
| text-primary on bg-base | 15.4:1 | 12.6:1 | 4.5:1 |
| text-secondary on bg-base | 4.6:1 | 4.6:1 | 4.5:1 |
| text-muted on bg-base | 3.0:1 | 3.0:1 | 3:1 (비텍스트) |
| btn-primary-text on btn-primary | 15.4:1 | 12.6:1 | 4.5:1 |

---

## 2. Typography

| 토큰 | 값 | 사용처 |
|------|-----|--------|
| `--font-sans` | `"Pretendard Variable", "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` | body 기본 |
| `--font-serif` | `"Pretendard Variable", "Pretendard", Georgia, serif` | 일기 / 메모 (Pretendard 가 serif 자리에도 들어감 — 무게+letter-spacing 차이로 시각 분리) |
| `--font-mono` | `ui-monospace, "SF Mono", "Menlo", Consolas, monospace` | 코드, kbd, frontmatter inline 표시 |

| 용도 | Class | 크기 |
|------|-------|------|
| 메모 제목 | `text-3xl font-bold` | 30px |
| 페이지 제목 | `text-lg font-semibold` | 18px |
| 사이드 패널 헤더 | `text-sm font-semibold` | 14px |
| 본문 | `text-base` | 16px |
| 라벨/메타 | `text-xs` | 12px |
| 캘린더 이벤트 | `text-[11px]` | 11px |

- **Heading**: font-weight 600~700, letter-spacing -0.01em
- **Body**: font-weight 400, line-height 1.625

---

## 3. Spacing

8px 기반 (Tailwind 단위).

| 값 | 용도 |
|----|------|
| 2 (8px) | 아이콘 간격, 인라인 gap |
| 3 (12px) | 리스트 아이템 패딩 |
| 5 (20px) | 페이지 좌우 패딩 |
| 6 (24px) | 섹션 간격, 모달 wrapper padding |
| 16 (64px) | 페이지 하단 여백 |

페이지 컨테이너:

- 일반: `px-5 pb-16 pt-5 max-w-2xl lg:max-w-4xl`
- 메모 에디터: `max-w-3xl px-6`

---

## 4. Radius

`rounded-md` (6px) 가 90% — 버튼 / Modal inner / 사이드바 항목. `rounded-lg` 는 카드 / 큰 패널. `rounded-full` 은 카테고리 dot / chip pill.

| 자리 | Tailwind | 값 |
|------|----------|-----|
| 버튼 / 사이드바 항목 / chip | `rounded-md` | 6px |
| 카드 / 모달 inner / textarea wrapper | `rounded-lg` | 8px |
| 큰 모달 (PortfolioDetailModal 등) | `rounded-xl` | 12px |
| 카테고리 dot / pill chip | `rounded-full` | 9999px |

별 시맨틱 토큰 추가 없이 Tailwind default 그대로. 1인 dogfood 에선 변종 0 (audit: rounded-md 128 / lg 34 / full 20 / xl 10 / 2xl 3 / sm 2). 의도된 분포라 token 화 가치 0.

---

## 5. Effects

### 5.1 Shadow

| 토큰 | 값 | 사용처 |
|------|-----|--------|
| `--shadow-card` | `0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.06)` | 일반 카드 (1인 dogfood 사용 자리 0 — Tailwind `shadow-md/lg/xl` 으로 대체) |
| `--shadow-modal` | `0 24px 48px -12px rgba(0,0,0,0.22), 0 8px 16px -4px rgba(0,0,0,0.1)` | 모달 wrapper (= `--surface-frost-shadow` 와 동일 값) |
| `--shadow-popover` | `0 8px 16px -4px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.08)` | 팝오버 / 컨텍스트 메뉴 / Sort menu |

raw `shadow-md/lg/xl` 17자리 — 의도된 사용 (Modal/inner panel). 점진 시맨틱 migration 후보지만 1인 dogfood 차원에서 ROI 낮음.

### 5.2 Opacity

| 토큰 | 값 | 사용처 |
|------|-----|--------|
| `--opacity-disabled` | 0.4 | disabled button / form 필드 |
| `--opacity-secondary` | 0.6 | secondary text / icon |
| `--opacity-overlay` | 0.5 | 페이지 외 셀 dim (캘린더 inCurrentMonth: false) |
| `--opacity-hover` | 0.9 | primary button hover (`hover:opacity-90`) |
| `--opacity-active` | 0.8 | button active (`active:opacity-80`) |

Tailwind v4 가 `opacity-disabled` 같은 utility 자동 생성. 기존 `opacity-40/60/80/90` 자리는 점진 migration.

### 5.3 Blur / backdrop

`backdrop-blur-xl` (Toast / MeetingForm error 카드 — frost-glass) + raw `blur` (29자리, Tooltip / 페이지 전환 등). 의도된 사용 — 토큰화 없이 raw 유지.

---

## 6. Motion

| 토큰 | 값 | 사용처 |
|------|-----|--------|
| `--motion-fast` | 120ms | toggle / chip 활성 전환 |
| `--motion-base` | 150ms | 일반 transition (Tailwind `duration-150` 과 호환) |
| `--motion-slow` | 250ms | 페이지 전환, modal mount/unmount |

raw `transition` 147자리 (Tailwind default `transition: all 0.15s ease`). 토큰 박았지만 자리 갈아엎기는 점진 — Tailwind default 충분히 일관되어 미진행 OK.

`index.css` 의 `@keyframes`:

| 이름 | duration | 사용처 |
|------|----------|--------|
| `fade-in` | 0.15s | 페이지 전환 (`.animate-page-in`) |
| `meetingViewFade` | — | 메모 편집↔보기 토글 |
| `todoCardEnter` | 180ms | todo list mount fade (필터/정렬 변경) |
| `todoCardExit` | — | todo 삭제 시 unmount 직전 (forwards) |
| `todoCardFlash` | 600ms | undo/redo 영향 카드 highlight |

---

## 7. Z-index

layer scale: dropdown < sticky < overlay < modal < popover < tooltip < toast.

| 토큰 | 값 | 사용처 |
|------|-----|--------|
| `--z-dropdown` | 10 | 메모장 컨텍스트 메뉴 / 폴더 메뉴 |
| `--z-sticky` | 20 | 사이드 패널 헤더 sticky / MeetingForm 헤더 |
| `--z-overlay` | 30 | popover / MarkdownHelp |
| `--z-modal` | 50 | 모든 `<Modal>` (z-50) |
| `--z-popover` | 55 | 모달 안 popover (드물게) |
| `--z-tooltip` | 60 | `<GlobalTooltip />` |
| `--z-toast` | 70 | `<ToastProvider>` |

raw `z-10/20/30/40/50` 분포 명확 — 점진 migration 후보지만 자리 적어 (~30) 의미별 갈아엎기 ROI 낮음. 토큰 정의해두고 새 자리는 시맨틱 쓰는 패턴.

---

## 8. Layout

### 8.1 Desktop 3-pane

```
[ActivityBar 48px] [SidePanel 288px] [Main flex-1]
```

- ActivityBar: `--bg-surface`
- SidePanel: `--bg-surface` + `--border-default` right border
- Main: `--bg-base`

`--breakpoint-lg: 640px` — 기본 Tailwind `lg=1024px` 보다 일찍 진입. 코드 `lg:` 유틸리티 + raw `@media (min-width: 640px)` 모두 이 값 기준.

### 8.2 헤더 / safe-area 토큰

| 토큰 | 값 | 사용처 |
|------|-----|--------|
| `--app-header-h` | `3.5rem` (모바일) / `0px` (desktop ≥640px) | 모바일 상단 헤더 높이. `PageHeader.tsx`, `CalendarPage` 의 viewport 계산 |
| `--page-header-h` | `3.25rem` (52px) | 사이드바 + 본문 헤더 공통 row. `SidePanel`, `MeetingForm`, `CalendarPage`, `PortfolioPage`, `TodosPage` 모두 같은 줄에 align |
| `--titlebar-inset` | `0px` → `36px` on `:root.is-mac-tauri` | macOS Tauri 헤더 영역 보정 (window padding-top) |
| `--titlebar-traffic-inset` | `0px` → `80px` on `:root.is-mac-tauri` | macOS traffic light 좌측 여유 (헤더 콘텐츠 시작 위치) |
| `--safe-top/bottom/left/right` | `env(safe-area-inset-*)` | iOS notch / 홈 인디케이터 회피 (mobile 한정) |

### 8.3 데스크탑 viewport scroll

```css
@media (min-width: 640px) {
  html, body {
    height: 100%;
    overflow: hidden;
  }
}
```

body scroll 막고 main 안에서만 scroll — viewport 전체 scrollbar 회피.

---

## 9. Interaction primitives

| 패턴 | 자리 | 토큰 매핑 |
|------|------|----------|
| `hover:bg-[var(--bg-surface-hover)]` | 사이드바 항목 / 버튼 / context menu — 19자리 | Button variant="ghost"/"icon" 의 default |
| `hover:opacity-90` | primary/danger/info button | Button 의 hover (variant 별 자동) |
| `active:opacity-80` | press 효과 | Tailwind `active:opacity-80` (7자리, raw 유지) |
| `focus-visible:ring-2` | 카드 / 키보드 focus | Tooltip + 카드 (3자리, focus-visible 일관 미정착) |

Button / Text 컴포넌트가 hover/active 흡수. raw 패턴 자리는 점진 migration.

---

## 10. Icon vocabulary

`lucide-react` 통일. 같은 action 에 다른 아이콘 X (Trash2 9 / Check 6 / Loader2 5 / Plus 4 / Pencil 4 / Eye 4 / BookOpen 4 등 audit 결과 일관).

| 의미 | 아이콘 |
|------|--------|
| 휴지통 / 영구 삭제 | `Trash2` |
| 확인 / 성공 | `Check` |
| 로딩 | `Loader2` (animate-spin) |
| 추가 | `Plus` |
| 편집 | `Pencil` |
| 보기 / 포함 | `Eye` / `EyeOff` |
| 가이드 / 도움말 | `BookOpen` / `HelpCircle` |
| AI / Claude | `Sparkles` |
| 외부 링크 | `ExternalLink` |
| 메뉴 | `MoreVertical` |
| 닫기 | `X` |

---

## 11. Components

### 11.1 Button (`src/components/common/Button.tsx`)

141 자리 raw `<button>` 흡수. variant 별 색/배경/border + size 별 padding/text-size.

```tsx
<Button variant="primary" size="md" onClick={...}>저장</Button>
<Button variant="icon" aria-label="닫기"><X className="h-4 w-4" /></Button>
<Button variant="danger" leftIcon={<Trash2 className="h-4 w-4" />}>삭제</Button>
```

**variant**:
- `primary` — `--btn-primary` 배경 / `--btn-primary-text` 텍스트, hover opacity-90
- `secondary` — 1px border + `--text-secondary`, hover surface-hover
- `danger` — `--accent-red` 배경 / `--text-inverse` 텍스트
- `info` — `--accent-blue` 배경 / `--text-inverse` 텍스트
- `ghost` — fill X border X, hover surface-hover
- `icon` — 정사각 아이콘 only (p-1.5), variant 의 size prop 무시

**size**: `sm` (px-2.5 py-1 text-xs) / `md` (px-3 py-1.5 text-sm, default)
**props**: `leftIcon`, `rightIcon`, `loading`, 나머지 button HTMLAttributes
**override**: className / style 그대로 통과 — 자리별 미세 override 가능 (예: `className="rounded-full px-3 py-1"` 으로 chip 모양)

### 11.2 Text (`src/components/common/Text.tsx`)

270 자리 raw `text-*` utility 흡수. variant 별 size + weight, as prop 으로 시맨틱 태그 매핑.

```tsx
<Text variant="h1" as="h1">제목</Text>
<Text variant="body" color="secondary">본문</Text>
<Text variant="caption" color="muted" as="span" truncate>요약</Text>
```

**variant**: `display` / `h1` / `h2` / `h3` / `h4` / `body` (default) / `caption` / `label`
**color**: `primary` (default) / `secondary` / `muted` / `inverse` / `danger` / `info` / `inherit`
**weight**: `normal` / `medium` / `semibold` / `bold` (variant default override)
**as**: 시맨틱 tag 결정 (variant 별 default 있음 — body→p, caption→span, label→label)
**truncate**: text-overflow ellipsis

input / textarea 안 text-* / 컨테이너 inherit 자리는 raw 유지 (wrap 불가). `MarkdownView` 의 react-markdown override 도 raw 유지 (이미 styled wrapper, double wrap 가치 미미).

### 11.3 Modal (`src/components/common/Modal.tsx`)

10개 모달 (`ConfirmDialog`, `SettingsModal`, `TrashModal`, `TodoTrashModal`, `PortfolioTrashModal`, `JournalOverlay`, `MoveFolderModal`, `TaskAddModal`, `PortfolioGuideModal`, `PortfolioDetailModal`) 의 공통 wrapper.

```tsx
<Modal open={open} onClose={onClose} ariaLabel="설정">
  <div className="...inner panel styles...">...</div>
</Modal>
```

내부 동작:
- `fixed inset-0 z-50 flex items-center justify-center p-6` wrapper
- backdrop = `rgba(0,0,0,0.4)` (default) 또는 `var(--bg-overlay)` (`backdrop="overlay"`, lightbox/이미지 viewer 류)
- `onMouseDown` backdrop 가드 — drag-out 시 닫히는 케이스 차단 (`e.target === e.currentTarget` 만 닫음)
- Escape → `onClose` (default true, `dismissOnEscape={false}` 로 비활성 가능 — 자체 분기 필요한 모달용)
- 중첩 confirm: 부모가 `dismissOnEscape={!confirmOpen}` + `dismissOnBackdrop={!confirmOpen}` 전달해서 confirm 떠있을 땐 부모 모달 닫지 않음 (trash 3종 패턴)

prop name 통일: 모든 modal 의 open prop = **`open`** (이전 `isOpen` 혼재 정리됨).

### 11.4 사이드 패널 아이템
- 패딩: `px-3 py-2`, rounded: `rounded-md`
- 활성: `--bg-surface-active`
- 호버: `--bg-surface-hover`
- Button variant="ghost" + className override 패턴

### 11.5 Form 요소
- select / date / time: `index.css` 전역 스타일
- 배경: `--bg-surface`, 보더: `--border-default`
- focus 시 `border-color: var(--text-muted)` (subtle)

### 11.6 AI 요약 블록
- 배경: `--bg-surface`, 패딩: `px-4 py-3`, rounded: `rounded-lg`

### 11.7 에러 표현

inline 빨간 박스 (옛 `4px solid` border-left + `accent-red-bg`) 폐기. 의미별 3 패턴.

**(a) Transient 에러 → Toast**: 사용자 트리거 작업 (저장, 동기화 등) 실패. `useToast().show(...)`. 카드 스타일은 `--surface-frost` 토큰 셋 (§1.2). voice/tone 원인+해결 2단. 자리: 포트폴리오 sync 실패 (App.tsx `portfolioRunIncrementalSync` 등).

**(b) 영구 load 실패 → `EmptyState` + AlertCircle**: 목록/메모 자체 fetch 실패. data 안 보이는 영구 상태이므로 `EmptyState` 의 icon 자리에 `AlertCircle` (`h-12 w-12`, `color: var(--accent-red)`, `strokeWidth={1.25}`), title 사용자 안내문, action 에 "다시 시도" Button (variant=primary). 자리: `MeetingsList` ErrorState / `MeetingForm` error 분기 / `TodosPage` error 분기.

**(c) Danger zone (destructive 영역)**: 영구 destructive 액션 카드. `1px solid var(--accent-red)` 전체 border + 텍스트 `--accent-red` (배경 없음). 패딩 `p-3`, 모서리 `rounded-md`. 자리: `VaultSection` disconnect / `BackupSection` wipe.

### 11.8 Toast (`src/components/Toast.tsx`)
- 글로벌 단일 인스턴스 (`<ToastProvider>` 가 App.tsx 에 마운트, `useToast()` hook)
- 카드 스타일 = surface-frost 토큰 셋 (1.2 참고)

### 11.9 Tooltip (`src/components/Tooltip.tsx`)
- `<GlobalTooltip />` 가 App.tsx 에 마운트
- 모든 `title="..."` 속성을 250ms delay hover 시 자동 커스텀 툴팁으로 변환
- 위치 자동 (top/bottom/left/right), chain hover 즉시 표시
- native title 비우고 `aria-label` 자동 보강

### 11.10 메타 row (옵시디안 properties 스타일)
- `.meta-input` — appearance reset, border 0, transparent bg, line-height 1.625rem
- `.meta-row:focus-within` — `bg-surface` + inset 1px ring (`border-default`)
- 메모 제목 아래 일시/참석/태그 row 가 이 패턴

---

## 12. 다크모드 전환 (`useTheme`)

```tsx
const { theme, toggle, setTheme } = useTheme();
```

- `<html>` 에 `.dark` class 토글 → CSS 변수 오버라이드
- 첫 방문: OS `prefers-color-scheme` → localStorage 저장
- 이후: 수동 토글만 (라이트 ↔ 다크 2단계)
- FOUC 방지: `index.html` 인라인 스크립트로 `.dark` 즉시 적용
- 토글 시각 효과: radial wipe (PR #23) — `useTheme.ts` 내 `#ffffff` / `#1a1a1a` 상수는 의도된 JS 상수 (한 프레임 animation 위한 hack, `getComputedStyle` 회피)
