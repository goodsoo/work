# Progress

다음 세션이 빠르게 파악할 수 있도록 짧게 유지.

## 현재 상태 (2026-05-16)

V0.5.4 세션 완료. 캘린더 연속 스크롤 리라이트.

### 이번 세션에서 완료

**캘린더 연속 스크롤 리라이트 (`745624c`)**
- 기존: 월 단위 snap-mandatory section. 각 월이 viewport-height. 인접 월의 leading/trailing partial week 가 중복 표시되는 문제.
- 새 구조: 주(週) 단위 연속 스크롤. 49주 버퍼 (`WEEK_BUFFER=49`, `WEEK_CENTER=24`). 가장자리 근접(`REBALANCE_EDGE=8`) 시 rebalance로 버퍼 shift + scrollTop 보정.
- `MonthGrid` 시그니처: `year/month` → `weeks: Date[]` (각 주의 일요일). 평탄 7-col grid (`gridAutoRows: clamp(100px, 18svh, 180px)`).
- 1일 셀에 "N월" 텍스트 inline 라벨 — 월 경계 시각 cue.
- 매 주 일요일 셀에 `scroll-snap-align: start` + container `scroll-snap-type: y proximity`. 자유 스크롤 + 주 단위 정렬.
- 헤더 month 기준: top row 토요일 month ("1일 진입" semantic — 새 달 1일이 행에 들어오면 토요일이 새 달이라 즉시 전환).
- 현재 month 외 셀 `opacity: 0.35` 회색톤 (`cell.year/month vs currentYear/Month`).
- 2026 이전 차단: `MIN_DATE = 2026-01-01`. `minCenterOffset = round((startOfWeek(MIN_DATE) - anchor) / WEEK_MS) + WEEK_CENTER`. 4 경로 모두 클램프 — 초기 centerOffset, handleScroll rebalance, jumpToToday, targetDate effect. 클램프 시 user 시각 위치 보존 위해 `newIdx = idx - appliedDelta` 로 scroll target 재계산.
- day 클릭 시 스크롤 제거: `setLastTarget(date)` 로 round-trip `App.calendarDate → targetDate prop` 의 rebalance effect 차단. selection / 사이드패널만 갱신.
- subpixel 정확도: `getBoundingClientRect().height` 측정 + `Math.round(scrollTop / rh)`. 이전 `offsetHeight` + `floor` 가 snap 후 off-by-one 발생.

**`formatDateLong` 연도 표시 (`c8e42fd`)**
- 다른 해 날짜면 `"2027년 5월 6일 화요일"`, 올해면 기존 `"5월 6일 화요일"`. 사이드패널 헤더 한 곳 호출.

### 폐기 / 동작 변경

- **월 snap-by-month** → 주 단위 연속 스크롤. snap 단위가 1개월 → 1주.
- **MonthGrid 의 inMonth 그레이아웃 (인접 월 셀 0.3)** → currentMonth 외 셀 (헤더 기준) 0.35. 의미가 달라짐: 이전엔 "이 grid 가 표시하는 월", 이제는 "헤더가 가리키는 월".

## 다음 세션 작업

### V0.6 후보

- **Server-side 메모 history**: V0.5.3 의 client-side 분리/보존으로 1차 해결됨. 우선순위 낮음.
- **녹음 파일 직접 업로드 → 자동 STT**: 유료 외부 API 추가 회피 정책으로 보류. 로컬 whisper.cpp (Tauri sidecar) 만 비용 0 옵션.

### 미해결

- **캘린더 스크롤 상태 페이지 전환 시 보존 안 됨**: `visibleWeekOffset` / `centerWeekOffset` 이 component state. 캘린더 탭 떠나면 unmount → 상태 reset. 명시적 날짜 클릭(`calendarDate`)은 App 에 보존돼서 복원 OK. 스크롤만 한 케이스는 페이지 전환 시 초기 위치(today)로 돌아감. 빌더 모드 ROI 따져 일단 패스.
- 모바일 실기기 PWA 테스트 (V0.5.2 부터 미확인).

## 알아야 할 컨텍스트

- **캘린더 anchor 고정**: `anchorWeekStart = startOfWeek(today, sun)` 가 useState 로 마운트 시 한 번. 이후 절대 변경 X. 모든 offset 계산 (centerOffset, visibleOffset, todayWeekOffset, minCenterOffset) 이 anchor 기준.
- **rebalance 클램프 패턴**: `newCenter = max(minCenterOffset, centerOffset + delta)`. `newCenter === centerOffset` 이면 early return (더 못 미는 케이스 = 이미 minCenter). `appliedDelta = newCenter - centerOffset`, `newIdx = idx - appliedDelta`. 스크롤 target = `newIdx * rh + remainder`.
- **헤더 month 계산**: `addDays(anchor, visibleWeekOffset * 7 + 6).getMonth()`. `+6` 으로 토요일을 가리킴 → "1일 진입" semantic.
- **scroll-snap 과 React state**: snap 후 `scrollTop` 이 정확히 row 경계여도 subpixel 오차 가능. `getBoundingClientRect.height` (float) + `Math.round` 필수. `offsetHeight` (integer) + `floor` 는 boundary 에서 off-by-one.
- **유료 외부 API 추가 회피**: 사용자 명시. 이미 Claude Code 구독 + Anthropic API (Edge Function) 결제 중. STT/이미지생성 등 새 결제 옵션은 기본 거름.
- **CLAUDE.md 의 캘린더 라인**: 이번 세션에서 갱신 (월 단위 무한 스크롤 → 주 단위 연속 스크롤 + 1일 진입 기준 + 회색톤 + 2026 차단 등).
