# todo

## 🔴 긴급 — 회의록 데이터 복구 시도 (2026-05-07 발생)

V0.5 useStateHistory reKey 회귀로 회의록 form 이 EMPTY_DOC 으로 렌더 → 빈 form 에 타이핑 시 optimistic update 가 NULL 로 row 덮어씀. 코드 fix 는 완료 (MeetingForm.tsx:122 `reKey: data?.id`). 손실 회의록 본문 복구 시도 4가지 — 시간 지나면 더 어려워짐.

- [ ] **다른 탭/디바이스 in-memory 캐시** ⚠️ 최우선. 폰 PWA / 다른 브라우저 탭에 그 회의록 열린 상태로 남아있는지 확인. 새로고침 절대 금지. 살아있으면 본문 복사 → 메모장 백업.
- [ ] **외부 paste 흔적 검색**. Notion / Slack / iMessage / 메일 / 메모 앱에서 회의록 제목 키워드 + `## 논의 사항` 패턴 검색. "복사" 버튼 누른 적 있으면 가능성 있음.
- [ ] **Supabase Edge Functions 로그**. Dashboard → Logs → Edge Functions → `summarize` invocation 검색 (회의록에 AI 요약 한 번이라도 돌렸을 경우만). event_message 에 본문 들어가있는지.
- [ ] **Supabase Postgres 로그**. 행 값 안 남지만 `update meetings` 쿼리 발생 시각 확인용 (덮인 시각 특정 → 다른 vector 좁히기).

손실 회의록 id / 제목 메모해두기:
- _____

---

## 🟡 V0.6 후보 — Server-side 회의록 history

DB 레벨 시간축 history. 코드 회귀 / 실수 삭제 / NULL 덮어쓰기 안전망.

- 테이블: `meeting_revisions(id, meeting_id, snapshot jsonb, created_at, user_id)`. RLS 동일.
- 트리거 OR 앱 레벨. 최소 변경 간격 (5분) + 의미있는 diff 일 때만 snapshot.
- UI: MeetingForm 우측 sticky drawer "변경 이력".
- 보존 기간 정책 결정 필요.

---

## 🟡 디자인 / UI 폴리싱 (V0.5.1 세션에서 진행 중)

### 완료 (2026-05-13~14)
- [x] Obsidian 스타일 3-pane 데스크탑 레이아웃 (ActivityBar + SidePanel + Main)
- [x] 캘린더: 타임라인뷰 제거 → 무한 스크롤 달력뷰 + snap + 셀 내 이벤트 타이틀
- [x] 캘린더: 사이드 패널에 선택 날짜 상세보기
- [x] 할 일: 카테고리 아카이빙 (work/meeting) + 사이드바 필터 + 미분류 탭
- [x] 일정(schedules) → 할 일과 통합 표시, AddScheduleForm 삭제
- [x] form 요소 전역 스타일링 (select/date/time pill 스타일)
- [x] 패딩/여백 3탭 통일 (px-5 pb-16 pt-5)
- [x] 버튼 스타일 통일 (red → zinc-900 블랙/화이트)
- [x] accent 색상 정리 (red → 에러/오늘/일요일에만)
- [x] 탭 전환 fade-in 트랜지션
- [x] Supabase redirect URL에 localhost:1420 추가

### 남은 작업
- [ ] **캘린더 첫 진입 스크롤 버그**. rAF로 수정했으나 확인 필요. 5월이 아닌 다른 월이 뜨는 문제.
- [ ] **다크모드 전체 검증**. 스크린샷 기반으로 사이드 패널 elevation 수정함. form 입력 필드 밝기, 에러 상태 색상 등 추가 확인 필요.
- [ ] **모바일 실기기 테스트**. 코드 레벨 검증은 PASS. PWA로 실제 사용 시 확인 필요 (터치 타겟, 하단 탭, safe area 등).
- [ ] **에러 상태 패딩 통일**. p-3 / p-4 혼재 → p-3으로 통일.
- [ ] **font-serif 클래스 정리**. 사이드 패널 헤더 등에 아직 남아있음. font-semibold로 직접 교체하거나 .font-serif CSS를 유지하되 사용처 정리.

---

## 🟢 기타

- [ ] **로컬 파일 기반 데이터 저장 검토**. Obsidian처럼 로컬 폴더를 DB로. Tauri `fs` API 사용. 장점: 오프라인, Git 버전 관리, Supabase 의존 제거. 단점: 웹/PWA 불가 (Tauri 전용). SQLite도 대안. 방향 결정 후 진행.
- [ ] **Tauri 데스크탑 앱 빌드 마무리**. 셋업 완료 (`src-tauri/`), `bun run tauri:dev`로 실행 가능. 디스크 용량 확보 후 `bun run tauri:build`로 `.dmg` 생성 테스트 필요.
- [ ] **UI/UX 작업 포트폴리오 자동 기록** (V0.7 후보).
  - 목적: branch → UI/UX 개선 → PR 작업을 자동 기록해서 포트폴리오화.
  - 데이터 소스: GitHub API (PR diff, 커밋, 변경 파일), 수동 스크린샷 첨부.
  - AI 분석: Claude Code 세션 내에서 처리 (추가 API 비용 없음). `/portfolio-generate` 같은 커맨드로 현재 브랜치 diff를 읽고 UI/UX 관점 요약 생성.
  - 자동 수집 (API 불필요): 변경 파일 목록, CSS/컴포넌트 변경 통계, PR description.
  - 스크린샷: 수동 첨부 → before/after 정리.
  - 출력: 포트폴리오 엔트리 (마크다운 or 앱 내 탭).
