# Design System — goodsoob-work

## Design Tokens

모든 색상은 CSS custom property로 정의. 컴포넌트는 토큰만 참조하고 `dark:` 접두사를 사용하지 않음.

### 토큰 목록

| 토큰 | 라이트 | 다크 | 용도 |
|------|--------|------|------|
| `--bg-base` | `#ffffff` | `#1a1a1a` | 기본 배경 (body, main) |
| `--bg-surface` | `#fafafa` | `#242424` | 카드, 사이드패널, 입력 필드 배경 |
| `--bg-surface-hover` | `#f4f4f5` | `#2a2a2a` | hover 상태 |
| `--bg-surface-active` | `#e4e4e7` | `#333333` | 선택/활성 상태 |
| `--bg-overlay` | `rgba(255,255,255,0.92)` | `rgba(26,26,26,0.92)` | 헤더, 탭바 backdrop |
| `--text-primary` | `#18181b` | `#e4e4e7` | 본문 텍스트 |
| `--text-secondary` | `#71717a` | `#a1a1aa` | 라벨, 메타데이터 |
| `--text-muted` | `#a1a1aa` | `#71717a` | placeholder, 비활성 |
| `--text-inverse` | `#ffffff` | `#18181b` | 버튼 위 텍스트 |
| `--border-default` | `#e4e4e7` | `#3f3f46` | 일반 구분선 |
| `--border-subtle` | `#f4f4f5` | `#2a2a2a` | 캘린더 셀, 약한 구분 |
| `--accent-red` | `#dc2626` | `#f87171` | 에러, 오늘 마커, 일요일 |
| `--accent-red-bg` | `#fef2f2` | `rgba(248,113,113,0.1)` | 에러 배경 |
| `--accent-red-text` | `#991b1b` | `#fca5a5` | 에러 텍스트 |
| `--accent-blue` | `#2563eb` | `#60a5fa` | 회의 칩 |
| `--accent-blue-bg` | `#eff6ff` | `rgba(96,165,250,0.1)` | 회의 칩 배경 |
| `--accent-blue-text` | `#1d4ed8` | `#93c5fd` | 회의 칩 텍스트 |
| `--btn-primary` | `#18181b` | `#e4e4e7` | primary 버튼 배경 |
| `--btn-primary-text` | `#ffffff` | `#18181b` | primary 버튼 텍스트 |
| `--focus-ring` | `#3b82f6` | `#60a5fa` | focus 표시 |

### 사용 방법

```tsx
// 컴포넌트에서 토큰 사용
<div style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-primary)" }}>
  ...
</div>

// Tailwind 레이아웃 + 토큰 색상 조합
<button
  className="rounded-lg px-3 py-1.5 text-sm font-medium"
  style={{ backgroundColor: "var(--btn-primary)", color: "var(--btn-primary-text)" }}
>
```

### 다크모드 전환

- `useTheme()` hook: `{ theme, toggle, setTheme }`
- `<html>` 에 `.dark` 클래스 토글 → CSS 변수 오버라이드
- 첫 방문: OS `prefers-color-scheme` 따라 초기값 → localStorage 저장
- 이후: 수동 토글만 (라이트 ↔ 다크)
- FOUC 방지: index.html 인라인 스크립트로 `.dark` 즉시 적용

### 대비 기준 (WCAG 2.2 AA)

| 조합 | 라이트 대비 | 다크 대비 | 기준 |
|------|-----------|----------|------|
| text-primary on bg-base | 15.4:1 | 12.6:1 | 4.5:1 |
| text-secondary on bg-base | 4.6:1 | 4.6:1 | 4.5:1 |
| text-muted on bg-base | 3.0:1 | 3.0:1 | 3:1 (비텍스트) |
| btn-primary-text on btn-primary | 15.4:1 | 12.6:1 | 4.5:1 |

---

## Typography

| 용도 | Class | 크기 |
|------|-------|------|
| 메모 제목 | `text-3xl font-bold` | 30px |
| 페이지 제목 | `text-lg font-semibold` | 18px |
| 사이드 패널 헤더 | `text-sm font-semibold` | 14px |
| 본문 | `text-base` | 16px |
| 라벨/메타 | `text-xs` | 12px |
| 캘린더 이벤트 | `text-[11px]` | 11px |

- **Font**: Pretendard Variable
- **Heading**: font-weight 600~700, letter-spacing -0.01em
- **Body**: font-weight 400, line-height 1.625

---

## Spacing

8px 기반 (Tailwind 단위).

| 값 | 용도 |
|----|------|
| 2 (8px) | 아이콘 간격, 인라인 gap |
| 3 (12px) | 리스트 아이템 패딩 |
| 5 (20px) | 페이지 좌우 패딩 |
| 6 (24px) | 섹션 간격 |
| 16 (64px) | 페이지 하단 여백 |

### 페이지 컨테이너
- `px-5 pb-16 pt-5 max-w-2xl lg:max-w-4xl`
- 메모 에디터: `max-w-3xl px-6`

---

## Layout (Desktop)

```
[ActivityBar 48px] [SidePanel 288px] [Main flex-1]
```

- ActivityBar: `--bg-surface`
- SidePanel: `--bg-surface` + `--border-default` right border
- Main: `--bg-base`

---

## Components

### 사이드 패널 아이템
- 패딩: `px-3 py-2`, rounded: `rounded-md`
- 활성: `--bg-surface-active`
- 호버: `--bg-surface-hover`

### 버튼 (Primary)
- 배경: `--btn-primary`, 텍스트: `--btn-primary-text`
- 패딩: `px-3 py-1.5`, rounded: `rounded-lg`

### Form 요소
- select/date/time: index.css 전역 스타일
- 배경: `--bg-surface`, 보더: `--border-default`

### AI 요약 블록
- 배경: `--bg-surface`, 패딩: `px-4 py-3`, rounded: `rounded-lg`

### 에러 상태
- 보더: `4px solid var(--accent-red)` (왼쪽)
- 배경: `--accent-red-bg`, 텍스트: `--accent-red-text`

---

## 규칙

1. **색상은 반드시 토큰으로.** `dark:` 접두사, 하드코딩 hex 사용 금지.
2. **Tailwind은 레이아웃 전용.** flex, grid, padding, margin, rounded, text-size 등.
3. **accent-red**: 에러/오늘 마커/일요일에만.
4. **accent-blue**: 회의 관련 칩에만.
5. **min-height: 44px**: 모든 인터랙티브 요소 (모바일 터치).
6. **text-muted 주의**: 본문 텍스트에 사용 금지 (WCAG AA 본문 기준 미달). 비텍스트 UI(아이콘, placeholder)에만.
