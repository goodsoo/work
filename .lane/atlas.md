# goodsoob-work — Lane Atlas

> `/lane` 이 이 프로젝트를 항해할 때 펴 보는 지도책. 자동 생성 + 손보정 + 출시마다 학습으로 누적.
> 범용 규칙(voice/tone·디자인시스템·PR 양식)은 `CLAUDE.md` / `DESIGN.md` 참조 — 여기 중복 금지.

## Stack
- router: 없음 — `window.location.hash` 수동 라우팅 (`src/App.tsx:60` `readTabFromHash`)
- state: TanStack Query v5 (`src/hooks/use*.ts`) + hash 기반 로컬 React state
- data/IO: Tauri IPC + 로컬 md 파일 vault (`src/api/*.ts` → `src/lib/vault/adapter.ts`)
- test: Vitest (`src/**/*.test.ts(x)`, 33개 파일)
- style: Tailwind v4 + 디자인 토큰 (DS 연결: **yes** — `src/index.css` 의 `goodsoob-design-system` 관리 sentinel 블록)

## Backbone
- routes: `src/App.tsx:60` (`readTabFromHash` — `#calendar`(default)/`#meetings`/`#todos`/`#portfolio`/`#styleguide`). meeting 상세는 `selectedMeetingId`(uid) state + `#meeting-{uid}` hash
- state stores: `src/hooks/use*.ts` (query/mutation 훅), 전역 모달/선택 state 는 `src/App.tsx` 가 owner
- data layer: `src/api/{meetings,journals,tasks,routines,portfolio}.ts` (vault 캡슐화) → `src/lib/vault/adapter.ts` (per-path mutex + atomic write)
- vault 코어: `src/lib/vault/{adapter,parser,scan,watcher,registry,tasks}.ts`

## Flows            <!-- 현존 사용자 흐름. 쓰면서 누적. -->
- 메모장: 진입 `#meetings` → 사이드바 메모 목록(정렬 popover) → 선택 시 `App.tsx` 인라인 상세 (제목 → 메타 → 본문/음성기록/요약 3-탭, 편집↔보기 토글) → 요약은 `SummaryModal`
- 캘린더: 진입 `#calendar`(default landing) → 주 단위 연속 스크롤 → day 클릭 → 사이드 패널 상세 + gcal 동기화
- 할 일: 진입 `#todos` → 카테고리 필터(전체/업무/미팅/미분류) + routine → task/schedule 통합 표시
- 내 작업(포트폴리오): 진입 `#portfolio` → gh PR 자동 sync → 카드 그리드 + 사이드바 + 스크린샷 lightbox
- 스타일가이드: `#styleguide` (VaultGate 우회, 컴포넌트/voice 시각 카탈로그 — dev/검토용)

## Conventions      <!-- CLAUDE.md 에 없는 파이프라인 관련 관례만 -->
- 브랜치: `goodsoo/<type>/<slug>` — type ∈ `feat`/`fix`/`infra`/`perf`/`chore`. feature-slug = 마지막 세그먼트
- 테스트: 코드 옆 `*.test.ts(x)` 콜로케이션. 실행 `bun run test:run` (one-off) / `bun run test` (watch). 새 vault/parser/lib 로직은 테스트 동반, UI 회귀는 매일 사용으로 발견
- CI: push(main)+PR 마다 typecheck → test:run (`.github/workflows/ci.yml`). Tauri build 는 OS 종속이라 CI skip
- PR vs 직커밋: "왜+유저가치" 한 줄 안 잡히는 변경 = PR(`/takeoff`). 오타·dep bump·문서 한 줄 = main 직커밋
- 패키지 매니저: **bun**

## Components       <!-- 이 앱이 가진 DS 컴포넌트 + 갭 이력 -->
- 보유: `src/components/common/*` (variant+size+color prop 패턴), 도메인별 `calendar/`/`meetings/`/`tasks/`/`portfolio/`/`routines/`/`timeline/`/`nav/`/`settings/`/`vault/` + 전역 `ConfirmDialog`/`Toast`/`Tooltip`(GlobalTooltip)
- DS: canonical `goodsoob-design-system` 연결 (`index.css` sentinel). 토큰 정의는 `src/index.css` 만 (`:root`+`.dark`, semantic 단일 layer)
- 과거 갭/결정: 색은 전부 `var(--*)` 토큰 (hex 직접 금지, 예외 `useTheme.ts` radial-wipe JS 상수). Tailwind `dark:` 색상 접두사 금지

## Deploy
- target: Tauri 데스크탑 `.app` (웹 deploy 비활성 — `vercel.json` 으로 main deploy 차단)
- trigger: 수동 (CI 는 검증만, 빌드 안 함)
- deploy 단계 호출: PR 머지(`/takeoff` → `/land`) 후 `bun run tauri:build` 로 .app 산출

## Heuristics
- ui vs logic: `src/components/**`·`src/pages/**`·`App.tsx` 렌더 트리 변경 = **ui** → `/ux-review`. `src/lib/**`·`src/api/**`·`src/hooks/**` 만(화면 변화 없음) = **logic** → `/spec`. 화면에 보이는 변화 있으면 BEFORE/AFTER 캡쳐 규율 발동
- feature-slug: 현재 브랜치명 `goodsoo/<type>/<slug>` 의 마지막 세그먼트. 브랜치 없으면 사용자 입력
