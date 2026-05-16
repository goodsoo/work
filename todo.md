# todo

## 🟢 완료 — V0.5.4 (2026-05-16, 캘린더 연속 스크롤 세션)

- [x] **캘린더 연속 스크롤 리라이트** — 월 단위 snap section 제거 → 주(週) 단위 연속 스크롤 (49주 버퍼, edge 근접 rebalance).
- [x] **MonthGrid `weeks: Date[]` prop 으로 변경** — 1일 셀에 "N월" 라벨로 월 경계 시각화.
- [x] **주 단위 snap** — 매 주 일요일 셀 `scroll-snap-align: start` + container `scroll-snap-type: y proximity`.
- [x] **헤더 기준 = top row 토요일 month** — "1일 진입" semantic (새 달 1일이 행에 들어오면 즉시 전환). 4개 옵션(일요일/다수결/1일진입/iOS sticky) 중 선택.
- [x] **현재 month 외 셀 회색톤** — `cell.month/year !== currentMonth/Year` 면 opacity 0.35.
- [x] **2026 이전 차단** — `minCenterOffset` 클램프. 초기/rebalance/jump/target 4 경로 모두 보정.
- [x] **day 클릭 시 스크롤 제거** — `setLastTarget(date)` 로 targetDate round-trip 의 rebalance 차단.
- [x] **subpixel 정확도** — `getBoundingClientRect.height` + `Math.round` (snap 후 헤더 off-by-one 버그 fix).
- [x] **사이드패널 헤더 연도 표시** — `formatDateLong` 이 다른 해면 `"2027년 5월 6일 화요일"`.

---

## 🟢 완료 — V0.5.3 (2026-05-16)

- [x] **캘린더 첫 진입 다른 월 표시 버그** — cold start 시 `useLayoutEffect` deps 에 `isLoading` 없어서 data 도착 후 effect 재실행 안 됨. deps 에 `isLoading` 추가.
- [x] **메모 history 메모별·탭별 분리** — `useStateHistory` 에 `cacheKey` 추가. MeetingForm 을 4-stack (body/transcript/summary/meta) 으로 분리. 활성 탭의 stack 만 Cmd+Z. 메모별 cache 로 메모 전환·페이지 전환 후 history 복원.
- [x] **메모장 진입 시 자동 선택** — 메모 1개 이상이면 최상단 자동 선택. `didAutoSelectThisSession` 모듈 flag 로 세션당 한 번만.
- [x] **페이지 전환 시 메모+탭 유지** — `App.tsx` 가 tab 전환 시 `selectedMeetingId` 보존. `ACTIVE_TAB_CACHE` 모듈 Map 으로 메모별 마지막 탭 보존. 메모 전환 시 "본문 reset" 동작 폐기 → 메모별 마지막 탭 유지로 변경.

---

## 🟢 완료 — V0.5.2 (2026-05-15~16)

- [x] **뷰/편집 모드 전환** — 처음 block 단위 편집기 시도 → 마크다운 spec 노출이 빌더 모드에 안 맞아 폐기. 단순 SourceBodyEditor(편집) ↔ MarkdownView(보기) 토글로 단순화. localStorage persist (`useViewMode`).
- [x] **메모장 3-탭 구조** — 본문 / 회의 내용(transcript) / 요약. 탭 row sticky. 우측 액션 compact.
- [x] **transcript 필드** — `meetings.transcript` text 컬럼. SourceBodyEditor + 파일 업로드 (.txt/.md/.vtt/.srt).
- [x] **AI 요약 두 source 통합** — Edge Function이 본문(가이드) + transcript(보조, 오인식 가능) 통합. 충돌 시 본문 우선.
- [x] **편집 모드 line gutter** — `inferLineKind` 줄별 마크다운 종류 표시 (제목/목록/인용/코드/들여쓰기 단계 + 이전 컨텍스트 "이어짐").
- [x] **마크다운 도움말 확장** — Setext heading, 들여쓰기 코드, 중첩 목록, hard line break, 링크 정의/참조, 표 정렬.
- [x] **글로벌 커스텀 툴팁** — `GlobalTooltip`이 모든 `title` 자동 가로채기.
- [x] **단축키** (Tauri only): Cmd+1/2/3 페이지 탭, Opt+1/2/3 메모 sub-tab.
- [x] **마크다운 ol start prop fix** — 떨어진 ordered list 번호 이어짐.

---

## 🟡 V0.6 후보 — 녹음 파일 직접 업로드

현재는 외부 AI로 STT 변환한 결과를 복붙/파일 업로드. 다음 단계:
- 녹음 파일 (.m4a/.mp3/.wav) 업로드 → Edge Function이 Whisper API 호출 → transcript 자동 채움
- 비용 발생 (Anthropic API와 별도). 사용 빈도 따라 결정.

---

## 🟡 V0.6 후보 — Server-side 메모 history

V0.5.3 에서 client-side history 메모별·탭별 분리 + 페이지 전환 보존으로 1차 해결. 남은 가치 = "새로고침/디바이스 변경 후에도 복원" + "실수 삭제 안전망 (soft-delete 가 일부 커버)". 빌더 모드 트레이드오프상 우선순위 낮음.

진행 시:
- 테이블: `meeting_revisions(id, meeting_id, snapshot jsonb, created_at, user_id)`. RLS 동일.
- 트리거 OR 앱 레벨. 최소 변경 간격 (5분) + 의미있는 diff 일 때만 snapshot.
- UI: MeetingForm 우측 sticky drawer "변경 이력".
- 보존 기간 정책 결정 필요.

---

## 🟡 디자인 / UI 폴리싱

### 완료 (2026-05-13~15)
- [x] Obsidian 스타일 3-pane 데스크탑 레이아웃
- [x] 캘린더: 무한 스크롤 달력뷰 + snap + 이벤트 타이틀
- [x] 할 일: 카테고리 아카이빙 + 사이드바 필터
- [x] 일정 → 할 일 통합
- [x] 시맨틱 디자인 토큰 시스템 (18개 토큰, CSS custom property)
- [x] 라이트/다크 테마 토글
- [x] 다크모드 가독성 전면 수정 (Material Design 가이드라인)
- [x] 회의록 → 메모장 리네이밍
- [x] Notion 스타일 전체 편집 레이아웃
- [x] AI 요약 인라인 블록
- [x] 참석자 한글 IME 버그 수정
- [x] 마크다운 도움말 사이드바
- [x] form 요소/패딩/버튼/accent 색상 통일

### 남은 작업
- [ ] **모바일 실기기 테스트**. PWA로 실제 사용 시 확인 필요.
- [ ] **에러 상태 패딩 통일**. p-3 / p-4 혼재.
- [ ] **캘린더 스크롤만으로 다른 월 본 상태 보존**. selectedDate 안 바뀐 채 스크롤만으로 이동한 경우는 페이지 전환 시 복원 안 됨. 명시적 날짜 클릭 시는 OK. 빌더 모드 ROI 따져 일단 패스.

---

## 🔴 긴급 — 메모 데이터 복구 시도 (2026-05-07 발생)

V0.5 useStateHistory reKey 회귀로 손실. 코드 fix 완료.

- [ ] 다른 탭/디바이스 in-memory 캐시 확인
- [ ] 외부 paste 흔적 검색
- [ ] Supabase Edge Functions 로그
- [ ] Supabase Postgres 로그

---

## 🟢 기타

- [ ] **로컬 파일 기반 데이터 저장 검토**. Obsidian 방식. Tauri fs API.
- [ ] **Tauri 데스크탑 앱 빌드 마무리**. `bun run tauri:build`로 .dmg 생성.
- [ ] **UI/UX 작업 포트폴리오 자동 기록** (V0.7 후보). GitHub API + Claude Code 세션 내 분석.
