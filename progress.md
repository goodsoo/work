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

### 미확인 / 사용자 별도 작업

- 사용자가 같은 세션 안에서 별도 작업: `src/lib/errors.ts`, `src/lib/isTauri.ts` 생성 + 일부 파일(MeetingForm, App, SummarizeButton, SidePanel 등)에 isTauri/formatError import 추가. 이는 우리 커밋에 같은 파일로 섞여 들어갔지만 두 신규 파일은 **untracked로 남음** — 사용자가 별도 커밋 필요. 안 하면 빌드 깨짐.
- 사용자만 만진 파일: `SignInScreen.tsx`, `ActivityBar.tsx`, `index.css`, `useDebouncedSave.ts`, `MeetingsPage.tsx`. untouch.

## 다음 세션 작업

### 사용자가 처리해야 할 것 (먼저)

1. **DB 마이그레이션 적용**: `supabase db push`
2. **types 재생성** (선택, 수동 편집과 동일): `supabase gen types typescript --linked 2>/dev/null > src/lib/database.types.ts`
3. **Edge Function 배포**: `supabase functions deploy summarize`
4. **untracked 파일 커밋**: `src/lib/errors.ts`, `src/lib/isTauri.ts` 등 (그렇지 않으면 빌드 깨짐).

### V0.6 후보

- **녹음 파일 직접 업로드 → 자동 STT**: 현재는 외부 AI로 변환한 결과 복붙/업로드. Whisper API 호출 Edge Function 추가하면 자동화. 비용 발생.
- Server-side 메모 history (이전 후보 유지).

### 미확인 버그 (이전 세션부터)

- 캘린더 첫 진입 시 다른 월 표시 (rAF로 수정 시도, 실기기 확인 필요).
- 모바일 실기기 PWA 테스트.

## 알아야 할 컨텍스트

- **단축키는 Tauri only**: 브라우저는 Cmd+1/2/3 같은 단축키가 시스템과 충돌. `isTauri` 분기.
- **회의 흐름 (사용자 작업 패턴)**: 회의 중 본문에 핵심만 → 회의 후 녹음을 외부 STT → 회의 내용 탭에 붙여넣기 → AI 요약 탭에서 두 source 통합 요약 생성.
- **transcript 컬럼은 nullable**: 기존 메모는 자동으로 `null`. 필요시 사용자가 회의 내용 탭에서 추가.
- **AI 요약 prompt 우선순위**: 본문(직접 적은 메모) > transcript(STT, 오인식 가능). 충돌 시 본문.
- **마크다운 출력 (외부 복사)**: 기존 `meetingToMarkdown` 그대로. 회의 내용은 포함 안 됨 (정리된 본문 + 요약만).
- **디자인 토큰 규칙**: 색상은 반드시 `var(--token)`. Tailwind `dark:` 색상 접두사 금지.
- **"메모장" = meetings**: UI 텍스트는 "메모장"이지만 코드/DB는 `meetings` 그대로.
- **Vite 포트**: 1420 고정 (Tauri 호환).
