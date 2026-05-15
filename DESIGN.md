# Design System — goodsoob-work

## Color Palette

### Light Mode
- **Background**: white (`#fff`)
- **Surface (elevated)**: zinc-50 (`#fafafa`)
- **Border**: zinc-200 (`#e4e4e7`)
- **Text primary**: zinc-900 (`#18181b`)
- **Text secondary**: zinc-500 (`#71717a`)
- **Text muted**: zinc-400 (`#a1a1aa`)

### Dark Mode
- **Background**: zinc-950 (`#09090b`)
- **Surface (elevated)**: zinc-900 (`#18181b`)
- **Border**: zinc-800 (`#27272a`)
- **Text primary**: zinc-100 (`#f4f4f5`)
- **Text secondary**: zinc-400 (`#a1a1aa`)
- **Text muted**: zinc-500 (`#71717a`)

### Accent
- **Red (오늘 마커, 일요일, 에러 전용)**: red-600 / dark: red-500
- **Blue (회의 칩)**: blue-600 / dark: blue-400

### 다크모드 최소 대비 규칙
- 본문 텍스트: zinc-100 이상 (zinc-200, zinc-100)
- 보조 텍스트: zinc-400 이상 (zinc-300까지 허용)
- 비활성/muted: zinc-500 (이보다 어두우면 안 보임)
- 보더: zinc-800 (투명도 없이). zinc-800/50 사용 금지.
- 아이콘 (비활성): zinc-500 이상

## Typography

- **Font**: Pretendard Variable (한글 최적화)
- **Heading**: font-weight 700 (bold), letter-spacing -0.01em
- **Body**: font-weight 400, 16px, line-height 1.625
- **Small/Label**: 13px
- **Mono**: ui-monospace, SF Mono

### 크기 체계
| 용도 | Class | 크기 |
|------|-------|------|
| 메모 제목 | text-3xl font-bold | 30px |
| 페이지 제목 | text-lg font-semibold | 18px |
| 사이드 패널 헤더 | text-sm font-semibold | 14px |
| 본문 | text-base | 16px |
| 라벨/메타 | text-xs | 12px |
| 캘린더 이벤트 | text-[11px] | 11px |

## Spacing

8px 기반. Tailwind 단위.
| 값 | 용도 |
|----|------|
| 2 (8px) | 아이콘 간격, 인라인 gap |
| 3 (12px) | 리스트 아이템 패딩 |
| 5 (20px) | 페이지 좌우 패딩 |
| 6 (24px) | 섹션 간격 |
| 8 (32px) | 큰 섹션 구분 |
| 16 (64px) | 페이지 하단 여백 |

### 페이지 컨테이너
- 패딩: `px-5 pb-16 pt-5`
- 최대 폭: `max-w-2xl lg:max-w-4xl`
- 메모 에디터: `max-w-3xl px-6`

## Components

### 사이드 패널 아이템
- 패딩: `px-3 py-2`
- 라운드: `rounded-md`
- 활성: `bg-zinc-200/80 dark:bg-zinc-800`
- 호버: `hover:bg-zinc-100 dark:hover:bg-zinc-800/60`

### 버튼 (Primary)
- `bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900`
- 패딩: `px-3 py-1.5`
- 라운드: `rounded-lg`

### 버튼 (Secondary/Ghost)
- `text-zinc-600 dark:text-zinc-400`
- 호버: `hover:bg-zinc-100 dark:hover:bg-zinc-800`

### Form 요소
- select/date/time: index.css 전역 스타일 (pill shape)
- 라이트: `bg-#fafafa border-#e4e4e7`
- 다크: `bg-#18181b border-#3f3f46`

### AI 요약 블록
- 배경: `bg-zinc-50 dark:bg-zinc-900/60`
- 패딩: `px-4 py-3`
- 라운드: `rounded-lg`

## Layout (Desktop)

```
[ActivityBar 48px] [SidePanel 288px] [Main flex-1]
```

- ActivityBar: `bg-zinc-50 dark:bg-zinc-900`
- SidePanel: `bg-white dark:bg-zinc-900/50`, border-r
- Main: `bg-white dark:bg-zinc-950`

## 규칙

1. Red는 에러/오늘 마커/일요일에만 사용
2. 모든 인터랙티브 요소 min-height: 44px (모바일 터치)
3. 다크모드 텍스트에 zinc-600 이하 사용 금지 (안 보임)
4. 보더에 투명도 사용 금지 (dark:border-zinc-800, not /50)
5. 네이티브 form 요소는 index.css 전역 스타일 사용
