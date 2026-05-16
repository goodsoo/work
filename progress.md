# Progress

다음 세션이 빠르게 파악할 수 있도록 짧게 유지.

## 현재 상태 (2026-05-16)

V0.5.3 세션 완료. 캘린더 첫 진입 버그 fix + 메모 history 메모별·탭별 분리 + 페이지 전환 시 보존.

### 이번 세션에서 완료

**캘린더 첫 진입 시 다른 월 표시 버그 (`db8abed`)**
- 근본 원인: cold start (`isLoading=true`) 시 `useLayoutEffect` 가 spinner branch 라 `ref=null` 로 early return. data 도착 후 `centerOffset` 안 바뀌니 effect 재실행 X → 초기 scroll 점프 절대 안 됨.
- fix: `useLayoutEffect` deps 에 `isLoading` 추가. isLoading 이 true→false 로 떨어질 때 effect 재실행되어 그때 container 가 실재함.

**메모 history 메모별·탭별 분리 (`ea4a43b`)**
- 기존: `useStateHistory<MeetingDoc>` 단일 stack. 메모 전환 시 reset (P1). 본문 탭 Cmd+Z 가 직전 요약 편집을 되돌리는 문제 (P2).
- `useStateHistory`: `reKey` → `cacheKey` 로 확장. module-level `HISTORY_CACHE: Map<string, {value, history, pointer}>` 로 보존. cacheKey 변경 시 outgoing 저장 + incoming 복원 (없으면 initial). pending commit 은 deferred flush 로 outgoing onCommit 에 전달 (옛 메모의 mutation 호출 — render 시점 `onCommitRef.current` 가 이전 render 의 callback 이라 정확).
- `MeetingForm`: 4-stack 분리 — body/transcript/summary/meta. 각자 `cacheKey="{meetingId}:{stack}"`, onCommit 에서 자기 필드만 partial patch.
- Cmd+Z 는 활성 탭의 stack 만 호출 (meta 는 native input undo).
- 메타데이터 객체 비교는 `metasEqual` / `summariesEqual` (deep) — useState history 가 같은 객체 안 push 하도록.

**메모장 진입 자동 선택 + 페이지 전환 시 보존 (`c654eb7`)**
- `MeetingsPage`: 페이지 진입 시 메모 1개 이상이면 최상단(`date desc, created_at desc`) 자동 선택. module-level `didAutoSelectThisSession` flag 로 세션당 한 번만. 사용자가 onBack 후 페이지 갔다 와도 다시 자동 선택 X.
- `App.tsx`: tab 전환 시 `setSelectedMeetingId(null)` 제거 → selectedMeetingId 보존. hash 처리 분기 — 메모장 + selectedMeetingId 면 `#meeting-{id}`, 그 외 `#${next}` 또는 빈 hash. `hashchange` listener 는 hash 에 meeting id 있을 때만 set, 다른 탭일 땐 보존.
- `MeetingForm`: `ACTIVE_TAB_CACHE` 모듈 Map. 메모별 마지막 탭 보존. 기존 "메모 전환 시 본문 reset" 동작 폐기 → 메모별 마지막 탭 유지로 통합.

### 폐기 / 동작 변경

- **"메모 전환 시 본문 reset"** → "메모 전환 시도 그 메모의 마지막 탭 유지" 로 변경. CLAUDE.md 반영.

### 같은 날 다른 세션 작업 (별도 commit)

- 메모 soft-delete + 사이드패널 휴지통 뷰 (`b126906`)
- 사이드패널 너비 드래그 조절 (`dd9309f`)
- 메모 편집기 gutter 라벨 → 아이콘 + ordered 번호 미리보기 (`00465dd`)
- 캘린더 헤더 + 요일 row sticky 추출 (`d8d281b`)
- 캘린더 week-based 무한 스크롤 리라이트 (working tree 에 남아있음, 미커밋)

## 다음 세션 작업

### V0.6 후보

- **Server-side 메모 history**: V0.5.3 의 client-side 분리/보존으로 1차 해결됨. 남은 가치 = "새로고침/디바이스 변경 후에도 복원" + "실수 삭제 안전망 (soft-delete 가 일부 커버)". 빌더 모드 트레이드오프상 우선순위 낮음.
- **녹음 파일 직접 업로드 → 자동 STT**: 비용 발생 (Whisper API 등). 사용자가 외부 결제 추가 회피 명시 → 보류. 로컬 whisper.cpp (Tauri sidecar) 만 비용 0 옵션.

### 미해결

- 모바일 실기기 PWA 테스트 (V0.5.2 부터 미확인).
- 캘린더 스크롤만으로 다른 월 본 상태 보존. 명시적 날짜 클릭은 OK, 무명 스크롤만 한 케이스는 페이지 전환 시 복원 안 됨. 빌더 모드 ROI 따져 일단 패스.
- 작업 트리 미커밋 변경 — `src/pages/CalendarPage.tsx` + `src/components/timeline/MonthGrid.tsx` (다른 세션이 week-based 리라이트 중). 그쪽 세션이 마무리.

## 알아야 할 컨텍스트

- **`useStateHistory` 의 `cacheKey` 패턴**: cacheKey 가 string 이면 module-level Map 에 보존. transition 시 outgoing 저장 + incoming 복원. `onCommitRef.current` 는 render 시점에 이전 render 의 callback (useEffect 가 아직 fire 안 함) — pending commit 의 deferred flush 에서 옛 메모의 mutation 정확히 호출됨.
- **메모 4-stack 동일 mutation 공유**: 4 stack 의 `onCommit` 이 동일한 `updateMutation` 인스턴스를 호출. partial patch 라 race 없음. mutation isPending/isError 는 마지막 호출 기준.
- **메모리 한계**: 메모당 ~600KB (현실), ~3.6MB (최악, 큰 transcript 100 snapshots). 한 세션 50개 메모 들락거려도 30-180MB. 페이지 새로고침이 모든 cache 비움. 빌더 모드 OK 결론.
- **자동 선택 trigger 조건**: `selectedMeetingId === null` + 메모 1개 이상 + `didAutoSelectThisSession === false`. 한 번 fire 후 module flag 가 true 라 같은 세션엔 더 안 됨.
- **App.tsx 라우팅 변경**: `changeTab` 과 Cmd+1/2/3 단축키가 `switchTab` 헬퍼로 통합. selectedMeetingId 보존 + hash 처리 분기 한 곳에서.
- **유료 외부 API 추가 회피**: 사용자 명시. 이미 Claude Code 구독 + Anthropic API (Edge Function) 결제 중. 새 기능 제안 시 무료/로컬/기존 결제 옵션부터.
- **`useStateHistory` 테스트**: `useStateHistory.test.ts` 에 cacheKey 왕복 복원 케이스 추가 (A 편집 → B → A 복귀 시 value+history+canUndo 유지). 총 3 케이스.
- **마이그레이션 / Edge Function 배포**: 이전 세션 transcript 마이그레이션은 이미 적용됨 (`supabase db push` "up to date"). `summarize` Edge Function 도 재배포 완료.
