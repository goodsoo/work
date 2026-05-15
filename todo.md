# todo

## 🔴 다음 작업 — 메모장 뷰/편집 모드 전환

기본 뷰 모드 (마크다운 렌더링) ↔ 클릭 시 편집 모드 (textarea) 전환.

### 동작
- 메모 진입 시 **뷰 모드**: MarkdownView로 렌더링된 결과물 표시
- 본문 영역 **클릭** → 편집 모드 (textarea) 전환
- **ESC** 또는 본문 **바깥 클릭** → 뷰 모드로 복귀
- 제목/메타데이터는 항상 편집 가능 (현재와 동일)

### 구현
- 새 라이브러리 불필요. 기존 `MarkdownView` + textarea 조합.
- `isEditing` state 하나로 전환
- 뷰→편집 전환 시 클릭 위치에 커서 근사치 배치 (선택사항)
- AI 요약 블록은 뷰/편집 모드 무관하게 항상 본문 아래에 표시

---

## 🟡 V0.6 후보 — Server-side 메모 history

DB 레벨 시간축 history. 코드 회귀 / 실수 삭제 / NULL 덮어쓰기 안전망.

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
- [ ] **캘린더 첫 진입 스크롤 버그**. rAF로 수정했으나 확인 필요.
- [ ] **모바일 실기기 테스트**. PWA로 실제 사용 시 확인 필요.
- [ ] **에러 상태 패딩 통일**. p-3 / p-4 혼재.

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
