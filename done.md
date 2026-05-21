# done

[todo.md](todo.md) 에서 완료된 항목 아카이브. 날짜 역순.

---

## 2026-05-21

### PR #18 — 메모 본문 typing 옵시디안 수준으로

- **마크다운 typing UX** — Tab/Shift+Tab indent (single + multi-line) / Enter 자동 list marker 연장 (bullet/ordered/checkbox/quote, empty marker 종료, IME-safe) / URL paste over selection → markdown link / smart dashes 비활성화 (autoCorrect="off" + beforeinput intercept fallback, 본문+transcript 둘 다) / textarea 빈 영역 클릭 → 끝 포커스. helper = `src/lib/markdownTyping.ts` 의 pure function 묶음 + 33 unit test.
- **마크다운 단축키 묶음** — ⌘B/⌘I wrap toggle (caret 만 있을 땐 빈 wrap + 가운데) / Alt+↑/↓ 줄 이동 / ⌘Shift+D 복제 / Opt+Q/W/E sub-tab (input/textarea 안에서도 동작, macOS dead-key œ/∑/´ preventDefault).
- **편집 모드 시각 위계 정비** — gutter 의 lucide 아이콘 + heading H1/H2/H3 + ordered 번호 모두 accent-blue 통일 (편집 모드 신호) / alignSelf flex-start 로 작성된 부분에만 border+아이콘 / `LineKind.lastContinuation` look-ahead + SVG dotted vertical (이어짐 중간) + dotted corner (이어짐 마지막), opacity 차이 폐기 / active marker = 정사각형 둥근 accent-blue-bg chip (회색 직사각형 폐기, gutter borderRight 와 4px 여백).
- **undo/redo 자동 탭 전환** — `useStateHistory` 의 undo/redo 가 `{from, to}` return 으로 라우팅 결정 노출. `DocSnapshot.__source` 추적 + undo → `from.__source` / redo → `to.__source` 의 탭으로 자동 전환 (변경이 일어나는 탭으로 일관 규칙). 다른 탭 보다가 ⌘Z 눌러도 즉시 변경 위치로 점프.
- **탭별 scroll 위치 유지** — `SCROLL_CACHE` 모듈 Map (`${meetingId}:${tab}`). onScroll 매 step cache + 탭/메모 전환 직후 useLayoutEffect + RAF 두 번 set (content height mount 직후 미정 케이스). 메모/음성/요약 탭 왕복해도 보던 위치 그대로.
- **wrapper padding 클릭 → 활성 textarea focus** — `mx-auto max-w-3xl px-6 pb-24` wrapper 에 onMouseDown 부착 + 좌우 px-6 영역은 좌표로 제외. 본문/transcript/summary 활성 탭의 textarea 자동 인식.
- **시간 input 자연어 키워드** — `parseLooseTime` 가장 앞에 `(지금|현재|now)` 매칭 → `new Date()` HH:mm. vault md 에는 실제 시각만 저장.
- commit `946f340..49ec51e` (5개 — helpers/typing+gutter/history+scroll+Opt+QWE/dates/screenshots), merge `07969bf`

### PR #17 — 노트 삭제 stale 선택 복원 race + 단축키 uid 정합

- **stale 선택 복원 race fix** — `list.isSuccess` 후 `selectedMeetingId` 가 list 에 없으면 null fallback + hash replaceState. 노트 삭제 후 `history.back` 이 이미 purge 된 메모로 popstate 가거나 / 초기 진입 hash 가 다른 세션 (옵시디안 모바일 sync 등) 에서 삭제된 메모 uid 인 두 경로에서 `useMeeting` throw → React Query retry → 영구 error UI 차단.
- **Cmd+N / Cmd+↑↓ uid 정합** — selectedMeetingId 에 `.id` (path) 대신 `.uid` 박도록. V0.7.1 uid 통일 누락분 — 사이드바 클릭/자동선택은 정상이고 이 두 단축키만 깨져있던 것 복원.
- **useDebouncedSave race 점검** — JournalBlock 은 `schedule` 가 `pendingRef` 에 sync write → `flush` 가 같은 ref read 구조라 V0.7.2 useStateHistory 의 closure-stale 패턴 없음. 캘린더는 자동 저장 자체 없음. fix 0.
- **dead callback chain 제거** — TrashModal `onMeetingPurged` + App.tsx `handleMeetingPurged` — uid vs trash path 비교라 절대 match 안 되던 dead code. 새 validation effect 가 같은 의도 cover 하므로 제거.
- commit `03b294d` + `51720b4`, merge `5df5e0e`

### 결정 — "깨진 파일 alert banner" 작업 X

todo "vault 파일 read 안정성" PR 그룹 마무리. 다른 sub-task (uid 중복 dedupe / parseVaultFile graceful / sync noise 무시) 3개는 이미 ✅. 마지막 🔥 항목 "깨진 파일 사용자 alert banner" 는 dogfood 검증 결과 가치 0 — PR #16 dedupe 가 중복 uid 자동 재발급 + parseVaultFile 이 yaml 깨져도 빈 fm fallback 이라 사이드바에서 메모 안 사라짐. 진짜 silent fail 은 `adapter.read/readMeta` 자체 실패 (iCloud evict / 권한) 한정인데 dogfood 에서 거의 발생 안 함. banner 가 보여줄 깨진 파일 수가 사실상 0 → dead UI 가 되므로 작업 X. 코드 변경 없음, todo.md PR 그룹 제거 + done.md 기록만.

### PR #16 — uid 중복 자동 복구

- **uid 중복 감지 + 후순위 재발급** — scanMeetings 끝 `Set<uid>` 검사 + mtime 작은 entry 만 새 uuid 재발급 + 디스크 rewrite. 외부 도구 (옵시디안 모바일 merge / 백업 복원) 가 같은 uuid 갖는 파일 두 개 만들어도 사이드바 리로드 때 silent 자동 복구. commit `346fea5`

---

## 2026-05-20

### PR #15 — 안정성 race + 사이드바 정렬

- **race fix 묶음** (5종) — useMeeting list-loaded gate / readFullMeeting throw + React Query retry / useStateHistory `valueRef` 동기 갱신 / docHistory cacheKey path → uid / scanMeetings catch console.warn. 새로고침 · 시간 수정 · 제목 변경 · iCloud sync 흐름에서 본문 영구 skeleton + undo 막힘 + history 통째로 사라짐 차단.
- **iCloud sync 노이즈 무시 룰** — `isSyncNoiseFile` 헬퍼 (`(conflicted copy)`, `.icloud` placeholder, dotfile). scanMeetings / Journals / AllTodos / Trash 모두 적용.
- **사이드바 정렬 popover** — 최신순 (기본) / 오래된순 / 이름순. 키 우선순위 date → time → mtime. localStorage `goodsoob:meetingSort` persist.
- **Tauri assetProtocol enable** — `app.security.assetProtocol.scope=["$HOME/**"]` + Cargo `protocol-asset` feature. portfolio 카드 vault 안 스크린샷 `convertFileSrc` 로 로드.
- **잡정리** — portfolio sync 진단 console.log 제거 / SyncError 박스 톤 사이드바 알림 통일 / 메타 input 색상 `--text-primary` 통일 / 달력·시계 아이콘 툴팁 제거.
- commit `1b2f7d9`, merge `90bdcd6`

### PR #14 — 휴지통 overlay

- **휴지통 자동 선택 + 미리보기 + 복원 (overlay 모달)** — commit `8c2c77f`

### PR #13 — 설정 탭

- **Vault 폴더 변경 UI** — 설정 모달의 Vault 섹션. 현재 path 표시 + "다른 폴더로 변경" + "연결 해제" (confirm). picker 후 첫 인덱싱 progress 처리. commit `2a65578`
- **vault 폴더 사라짐 graceful** — Vault liveness 3초 polling + window focus event. 외장 디스크 unmount / Finder 삭제 / iCloud 이동 → 즉시 VaultPicker 복귀. commit `2a65578`
- **단축키 cheatsheet** — 설정 모달의 "단축키" 섹션 (4 그룹 페이지/메모/sub-tab/편집 kbd chip). `?` 키 별도 진입점은 추가 가치 약함 판단. commit `2a65578`

### PR #12 — 키보드 흐름 + 날짜·시간 입력

- **메모 메타 (날짜/시간/참석자) undo/redo** — useStateHistory 1 stack docHistory 통합. DocSnapshot 에 meta 포함 → ⌘Z 로 메타도 되돌아감. 제목은 별도 (history 미참여, native input undo). commit `b8ec87d`

### dogfood 확인 (작업 X, 이미 해결돼 있음)

- **메모 1개 디폴트 선택 안 됨 / 새로고침 시 풀림** — V0.5.3 자동 선택 동작 정상 작동 확인
- **편집모드 메모/시간 입력 텍스트 색상 연함** — 해결돼 있음 확인
