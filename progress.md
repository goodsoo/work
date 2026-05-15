# Progress

다음 세션이 빠르게 파악할 수 있도록 짧게 유지.

## 현재 상태 (2026-05-15)

V0.5.1 세션 완료. 대규모 UI/UX 리팩토링 + 디자인 시스템 구축.

### 이번 세션에서 완료 (커밋 17개)

- **데스크탑 3-pane 레이아웃**: ActivityBar(아이콘) + SidePanel(탭별 목록) + Main. Obsidian 스타일.
- **캘린더 전면 리라이트**: 타임라인뷰 제거 → 무한 스크롤 MonthGrid + snap. 셀 내 이벤트 타이틀. 사이드 패널에 선택 날짜 상세.
- **할 일 카테고리**: DB `todos.category` 추가 (work/meeting). 사이드바 필터.
- **일정 → 할 일 통합**: AddScheduleForm 삭제. 기존 데이터는 캘린더에 표시 유지.
- **회의록 → 메모장 리네이밍**: UI 텍스트 전체 변경. 내부 코드는 meetings 유지.
- **메모장 에디터**: Notion 스타일 풀페이지. 본문 textarea가 화면 전체. AI 요약 인라인 블록.
- **시맨틱 디자인 토큰**: 18개 CSS custom property. 86개 하드코딩 색상값 → 토큰 참조. `DESIGN.md` 문서화.
- **라이트/다크 테마 토글**: `useTheme` hook. class 기반. ActivityBar + 모바일 헤더에 Sun/Moon 버튼.
- **다크모드 가독성**: Material Design 가이드라인 적용. #1a1a1a base.
- **기타**: 한글 IME 버그 수정, form 요소 통일, accent 색상 정리, 탭 전환 트랜지션, 마크다운 도움말 사이드바.

### Tauri 데스크탑 앱
- `src-tauri/` 셋업 완료. `bun run tauri:dev`로 실행 가능.
- 디스크 용량 부족으로 `tauri:build` (.dmg) 미테스트.
- Supabase redirect URL에 localhost:1420 추가됨.

## 다음 세션 작업

### 1순위: 메모장 뷰/편집 모드 전환
- 기본 뷰 모드 (MarkdownView 렌더링) ↔ 클릭 시 편집 (textarea)
- ESC / 바깥 클릭 → 뷰 모드 복귀
- 새 라이브러리 불필요. 기존 MarkdownView + textarea 조합.
- 상세: `todo.md` 참조

### 미확인 버그
- 캘린더 첫 진입 시 현재 월이 아닌 다른 월이 표시되는 문제 (rAF로 수정했으나 확인 필요)

## 알아야 할 컨텍스트

- **디자인 토큰 규칙**: 색상은 반드시 `var(--token)` 사용. Tailwind `dark:` 색상 접두사 금지. `DESIGN.md` 참조.
- **"메모장" = meetings**: UI 텍스트는 "메모장"이지만 코드/DB는 `meetings` 그대로.
- **schedules 테이블**: 아직 살아있음. 새 추가 UI 제거했지만 기존 데이터는 캘린더/사이드패널에서 읽기/삭제 가능.
- **Vite 포트**: 1420 고정 (Tauri 호환).
