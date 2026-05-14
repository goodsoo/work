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

## 🟡 V0.6 후보 — Server-side 회의록 history (이번 사건이 만든 진짜 우선순위)

V0.5 의 `useStateHistory` 는 _세션 내_ undo/redo 만. DB 레벨 시간축 history 가 따로 필요 — 이번처럼 코드 회귀 / 실수 삭제 / NULL 덮어쓰기 모두에 안전망.

대략 스케치 (다음 세션 `/plan-eng-review` 로 디테일 lock):

- 테이블: `meeting_revisions(id, meeting_id, snapshot jsonb, created_at, user_id)`. RLS 동일.
- 트리거 OR 앱 레벨: `useUpdateMeeting` mutation 안에서 update + insert revision (트랜잭션으로 묶기, 또는 Postgres trigger 로 server-side 자동화).
- 빈도: 매 commit (1초 debounce 단위) — 너무 잦으면 storage 비용 / row 폭증. 최소 변경 간격 (5분) + 의미있는 diff 일 때만 snapshot 등 정책 결정 필요.
- UI: MeetingForm 우측 sticky drawer "변경 이력" — 시점 클릭 → preview → "이 버전으로 되돌리기" 버튼.
- 보존 기간 정책: 90일? 영구? 1인 사용 데이터 양 고려.
- 다른 entity (journals / todos) 에도 확장할지 결정 — 회의록만 vs 통합.

원래 V0.6 후보였던 GitHub 커밋 기반 포트폴리오 탭은 **이거 다음 (V0.7)** 으로 밀기.

---

## 🟢 기타

- [ ] **로컬 파일 기반 데이터 저장 검토**. 현재 Supabase 대신 로컬 폴더를 DB로 쓰는 방식. Obsidian처럼 `~/goodsoob-data/meetings/*.json` 구조. Tauri `fs` API 사용. 장점: 오프라인, Git 버전 관리, Supabase 의존 제거. 단점: 웹/PWA 불가 (Tauri 전용). 대안으로 SQLite 로컬 파일도 가능. 방향 결정 후 진행.
- [ ] **Tauri 데스크탑 앱 빌드 마무리**. 셋업 완료 (`src-tauri/`), `bun run tauri:dev`로 실행 가능. 디스크 용량 확보 후 `bun run tauri:build`로 `.dmg` 생성 테스트 필요.
