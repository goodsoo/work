# Progress

다음 세션이 빠르게 파악할 수 있도록 짧게 유지.

## 현재 상태 (2026-05-16)

V0.5.2 세션 완료. 메모장 회의 흐름 구조화 + 글로벌 툴팁.

### 이번 세션에서 완료

**메모장 회의 흐름 (transcript + 3-탭)**
- `meetings.transcript` text 컬럼 추가 (마이그레이션 `20260515000000_meetings_add_transcript.sql`). 본인이 회의 중 적은 본문 외에 녹음의 외부 STT 변환 결과를 별도 보관.
- 메모 페이지 3-탭 구조: **본문** / **회의 내용**(transcript) / **요약**. default 본문. 메모 전환 시 본문 탭으로 reset.
- 탭 nav row sticky (`top: 2.5rem`). 우측 액션 그룹: 편집/보기 토글(본문 탭일 때만), 마크다운 복사(compact), 삭제(compact). 하단 액션 없음.
- 회의 내용 탭: textarea + 파일 업로드 (`.txt/.md/.vtt/.srt`). 업로드 시 기존 내용 뒤에 이어붙임.
- AI 요약 Edge Function: 본문(가이드) + transcript(STT, 오인식 가능) 통합 prompt. 충돌 시 본문 우선. 한쪽만 있어도 동작.
- `MeetingDoc`/`makeDocFromMeeting`/`docToPatch`/`docsEqual`에 transcript 반영 — useStateHistory + 자동 저장 + undo/redo 자동 포함.

**편집/보기 모드 + 라인 분석**
- 본문 탭: `SourceBodyEditor`(편집, source) ↔ `MarkdownView`(보기) 토글. `useViewMode` hook (localStorage persist).
- 편집 모드 textarea 왼쪽에 line gutter — `inferLineKind`가 줄별 마크다운 종류 표시 (제목/목록/인용/코드/Setext heading/들여쓰기 단계 등 + 위 컨텍스트로 "이어짐" 추론).
- `wrap="off"` + 세로 페이지 스크롤. 탭 콘텐츠 wrapper에 `minHeight: calc(100svh - 8rem)`로 탭이 상단 도달할 때까지 페이지 스크롤 가능.
- 사이드바 마크다운 도움말 확장: Setext heading, 들여쓰기 코드, 중첩 목록, hard line break, 링크 정의/참조, 표 정렬.

**글로벌 커스텀 툴팁**
- `GlobalTooltip` (`App.tsx`에 마운트). 모든 `title="..."` 속성 hover 시 자동 가로채기. 250ms delay + 디자인 토큰 + 위치 자동(top/bottom/left/right) + chain hover 즉시 표시. `aria-label` 자동 보강.

**기타**
- `MarkdownView` ol `start` prop 통과 — 떨어진 ordered list 번호 이어짐.
- `CopyButton`에 `compact` prop 추가 (icon-only 버전).

### 폐기된 시도 (배워둘 만한 것)

- **Block-based editor (mdast top-level block 단위)**: 600줄+ 구현. paragraph/heading split, ghost block, append mode, IME guard, exit-to-ghost 등 매우 정교. 그러나 마크다운 spec(빈 줄로 분리, list lazy continuation 등)이 그대로 노출되어 빌더 모드 1인 사용자에게 over-engineering. 결국 source 편집 + 보기 토글로 단순화. `BlockEditableBody`, `markdownBlocks.ts`, `caret.ts` 삭제. `unified`/`remark-parse` 의존성도 제거.

### 같은 날 후속 (병렬 세션, 별도 커밋됨)

병렬 세션에서 단축키 + UX 폴리싱 추가:

- **단축키 (Tauri only)**:
  - 페이지: `Cmd+1` 메모장 / `Cmd+2` 캘린더 / `Cmd+3` 할 일 (App.tsx 의 window keydown).
  - 메모 sub-tab: `Opt+1` 본문(편집/보기 토글) / `Opt+2` 회의 내용 / `Opt+3` AI 요약. `e.code === "Digit{N}"` 로 매칭 (Opt+숫자는 macOS 가 ¡™£ 로 바꿈).
  - `Opt+1` 동작: 본문 탭에서 → 편집/보기 토글, 다른 탭에서 → 본문으로 이동만 (모드 변경 X).
  - MeetingForm 의 keydown listener 는 div local `onKeyDown` 이 아니라 `window.addEventListener` 로 등록 — 빈 곳 focus 일 때도 동작.
- **글로벌 hover 효과**: `button:not(:disabled):not([aria-current="page"]):hover { background-color: var(--bg-surface-hover); }` 한 줄. 버튼 50개 일일이 안 만져도 됨. inline `bg: transparent` 가진 곳은 specificity 로 안 먹어서 ActivityBar inactive 탭은 `undefined` 로 수정.
- **글로벌 툴팁 개선**:
  - 화면 좌측 가장자리 (rect.left < 60) 트리거는 → 오른쪽 placement. ActivityBar 아이콘이 창 밖으로 안 삐져나감.
  - 4방향 placement 모두 화살표 삽입 (border-triangle).
  - `useEffect` deps `[pos]` → `[]` + ref 패턴으로 변경. tooltip 떠/사라질 때마다 listener 재등록되던 race condition 제거.
  - Chain hover (다른 `[data-tooltip]` 로 바로 이동) 시 SHOW_DELAY 무시하고 즉시 표시.
- **자동저장 실패 토스트 우측 하단 fixed**: 페이지 inline 에서 떴다가 컴포넌트 밀어내던 문제 해결. 닫기(X) + 실제 에러 메시지 표시 + retry 동작 수정.
- **`retrySave` 버그 수정**: `if (history.canUndo === false ...)` 조건이 거꾸로 박혀 있어서 보통 케이스에서 아무것도 안 했음. 단순 mutate 재호출로 변경.
- **`formatError` 헬퍼**: Supabase PostgrestError 등 non-Error 객체에서 `.message` 추출. 기존 6곳 `e instanceof Error ? e.message : String(e)` → `formatError(e)`. "[object Object]" 메시지 사라짐.
- **단축키 hint tooltip**: ActivityBar 탭 title 에 `⌘1/2/3` 표기, MeetingForm TabBtn 에 `⌥1/2/3` 표기 (Tauri 만).

## 다음 세션 작업

### 사용자가 처리해야 할 것 (먼저)

1. **DB 마이그레이션 적용**: `supabase db push`
2. **types 재생성** (선택, 수동 편집과 동일): `supabase gen types typescript --linked 2>/dev/null > src/lib/database.types.ts`
3. **Edge Function 배포**: `supabase functions deploy summarize`

### V0.6 후보

- **녹음 파일 직접 업로드 → 자동 STT**: 현재는 외부 AI로 변환한 결과 복붙/업로드. Whisper API 호출 Edge Function 추가하면 자동화. 비용 발생.
- Server-side 메모 history (이전 후보 유지).

### 미확인 버그 (이전 세션부터)

- 캘린더 첫 진입 시 다른 월 표시 (rAF로 수정 시도, 실기기 확인 필요).
- 모바일 실기기 PWA 테스트.

## 알아야 할 컨텍스트

- **단축키는 Tauri only**: 브라우저는 Cmd+1/2/3 (탭 전환) / Cmd+E (find selection) / Cmd+R (reload) / Cmd+T (new tab) 등 시스템과 충돌. `isTauri` 분기로 Tauri 일 때만 동작.
- **Tauri webview 가 일부 Cmd+키 가로챔**: 그래서 sub-tab 은 Cmd+ 가 아니라 Opt+ 로 매핑. Opt+숫자는 macOS 가 특수문자로 바꾸므로 `e.key` 대신 `e.code === "Digit{N}"` 매칭 필수.
- **Tauri 에서 새로고침**: `Cmd+R` 안 먹음 (WKWebView 기본 동작 없음). 우클릭 → Inspect Element → DevTools 에서 Cmd+R, 또는 앱 종료 후 `bun run tauri:dev`.
- **회의 흐름 (사용자 작업 패턴)**: 회의 중 본문에 핵심만 → 회의 후 녹음을 외부 STT → 회의 내용 탭에 붙여넣기 → AI 요약 탭에서 두 source 통합 요약 생성.
- **transcript 컬럼은 nullable**: 기존 메모는 자동으로 `null`. 필요시 사용자가 회의 내용 탭에서 추가.
- **AI 요약 prompt 우선순위**: 본문(직접 적은 메모) > transcript(STT, 오인식 가능). 충돌 시 본문.
- **마크다운 출력 (외부 복사)**: 기존 `meetingToMarkdown` 그대로. 회의 내용은 포함 안 됨 (정리된 본문 + 요약만).
- **디자인 토큰 규칙**: 색상은 반드시 `var(--token)`. Tailwind `dark:` 색상 접두사 금지.
- **"메모장" = meetings**: UI 텍스트는 "메모장"이지만 코드/DB는 `meetings` 그대로.
- **Vite 포트**: 1420 고정 (Tauri 호환).
