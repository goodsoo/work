# todo

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
