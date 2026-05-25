# todo

PR 단위로 묶음. 각 PR 의 **한 줄 임팩트** 는 카드 frontmatter `impact_summary` 후보. 카테고리는 `ui_ux | backend | infra | fix | other`.

🔥 = 우선순위 높음 (dogfood 통증). 🟡 = 일반 후보. 🟢 = 진행 중.

완료 기록은 [done.md](done.md) 참조.

---

## 🚀 메모 에디터 (마크다운) 강화

### PR — 본문 이미지 paste / drag&drop `ui_ux`
한 줄 임팩트: 캡쳐 이미지 본문에 paste/drop → vault `_attachments/` 저장 + markdown 자동 insert

- [ ] textarea (편집 모드) 안 이미지 paste / drag&drop 감지. `_attachments/{slug}/{n}.{ext}` 저장 + caret 위치에 `![](상대경로)` insert.
- [ ] slug = 현재 메모 title kebab-case. 같은 메모 안 이미지 N 증가.
- [ ] portfolio 카드의 `_attachments/{slug}/before-N.{ext}` 와 같은 패턴 — 자산 위치 일관.
- [ ] PR #22 의 이미지 렌더링과 정합 — 저장 후 보기 모드 즉시 정상 표시.

---

## ✨ 신규 기능

### PR — 단축키 자료/통계 페이지 `ui_ux` 🟡
한 줄 임팩트: 분기 평가용 — 회의 N건 / 일기 streak / todos 완료율 한 화면

- [ ] ActivityBar 새 탭 또는 portfolio 탭 안 별 view. 후순위 — dogfood 통증 작음, 평가 시즌 근접에 진입 결정.
- [ ] vault scan 기반 — meetings 수 (월별), journals streak, todos 완료율 (이번 달 / 분기). 외부 의존 0.

---

## 🎨 폴리시

### PR — 동적 카테고리 (사용자 정의 분류) `backend`
한 줄 임팩트: 업무/미팅 외 본인 카테고리 자유 추가

- [ ] **데이터 모델** — `TodoCategory` union → `string`. vault 안 `categories.md` (한 줄당 `id: label`) 가 source of truth. 기본 `work / schedule / other` 부트스트랩.
- [ ] **UI** — 추가/삭제 위치 결정 (TaskAddModal select 안 inline / 설정 패널 / 사이드바 헤더 편집 모드). 사이드패널 필터 + 캘린더 사이드는 동적 빌드.
- [ ] **Sanitize 정책** — 카테고리 삭제 시 그 카테고리 todo 처리: (a) vault 라인 `#xxx` 자동 strip (b) UI null 표시 + 라인 보존 (c) 삭제 차단 + 옮기라고 경고. 한 가지 고르기.
- [ ] **알 수 없는 카테고리 표기** — vault 의 `#unknown` 같은 tag 가 카테고리 list 에 없을 때 UI 에서 어떻게 보일지 (지금은 null 로 무시 + 라인 보존).

### PR — portfolio 입력 흐름 `ui_ux`
한 줄 임팩트: ResponsePasteArea 발견성 + 드래그&드롭 동작 검증

- [ ] **`ResponsePasteArea` 발견성** — `PortfolioWorkCard.tsx:147` 의 "Claude 응답 paste" 입력란. impact_summary 비었을 때만 등장 + placeholder 만 있어 사용자가 "무슨 기능인지 모름" 체감. 라벨/도움말 보강 또는 가치 재평가 후 제거 결정. (단일 카드 메뉴의 "Claude 프롬프트 복사" 는 별개 — 그건 명확.)
- [ ] **이미지 업로드 드래그&드롭** — CLAUDE.md 엔 dropzone 명시지만 사용자 체감 안 됨. 실제 동작 점검 + 카드 그리드 어디서든 드래그 받도록 영역 확장. lightbox 안 dropzone 도 동작 검증.

### PR — 날짜/시간 표시 포맷 통일 `ui_ux`
한 줄 임팩트: 앱 전체 날짜/시간 표시가 한 컨벤션으로

- [ ] **메모장 사이드바 카드** — `MM.DD(ddd) HH:mm · 참석자 N명`. 올해면 연도 생략, 올해 아니면 `YYYY.MM.DD(ddd) HH:mm`
- [ ] **휴지통 카드** — 메모장 카드와 동일 포맷 통일. 삭제 시각은 카드 secondary 영역 (하단 또는 작은 글씨로 별도 위치)
- [ ] **앱 전체 검토 + 통일** — 메모 본문 메타 row / 캘린더 라벨 / todos 마감일 / portfolio 카드 등 표시 위치 찾아 한 컨벤션으로
- [ ] **`lib/dates.ts` 단일 포맷 함수 도입** — `formatMeetingDate()` / `formatTrashDate()` 등 → 모든 호출처 통일. 새 표시 위치 추가 시 함수만 호출

---

## 🛡️ Vault 안정성 (V0.6.1 후속)

### PR — Conflict resolution 모달 `backend`
한 줄 임팩트: 옵시디안 모바일과 동시 편집 충돌 시 보존/덮어쓰기 선택

- [ ] ConflictError throw → UI 모달 (내 변경 보존 / 외부 변경 가져오기 / `.conflict-*.md` 파일 생성)

---

## 📊 Portfolio (V0.7.x 후속)

### PR — 내 작업 수동 추가 `ui_ux`
한 줄 임팩트: GitHub PR 무관 카드 (오프라인 업무 / 회의 발표) 도 portfolio 에 직접 추가

- [ ] portfolio 탭에서 "새 카드" 버튼 → title/date/category/impact_summary 입력 + screenshots dropzone → 저장. frontmatter `github_pr_id` 없거나 0 → sync 가 건드리지 않음 (legacy 카드 schema 그대로 활용). 평가 자료에 PR 외 활동도 포함.

### PR — sync 결과 카드 식별 `ui_ux`
한 줄 임팩트: 어떤 카드가 새로 들어왔는지 한눈에

- [ ] sync 직후 신규 추가 카드 우상단 "NEW" 배지. 다음 sync 까지 유지. `.synced.md` 에 `last_added_slugs: []` 저장 → 다음 sync 가 덮어씀.
- [ ] 갱신 카드 표시는 noise — 거의 매번 발생. skip.
- [ ] (선택) 사이드바 "새 카드 N" 클릭 → 그 N 개만 임시 필터.

### PR — 사이드바 FilterItem 통일 `ui_ux`
한 줄 임팩트: 메모장/캘린더/할일/포트폴리오 사이드바 공통 컴포넌트화

- [ ] 현재 PortfolioProjectList 의 FilterItem (px-2 py-1 text-[13px]) 과 SidePanel.tsx 의 TodosFilterItem (px-3 py-2 text-sm) 사이즈/패턴 차이. common/FilterItem 으로 추출 + 모든 사이드바 마이그레이트.

### PR — 가이드북 UIUX 다듬기 `ui_ux`
한 줄 임팩트: 동기화 진행 표시 + 가독성 정돈

- [ ] **동기화 progress 표시** — 현재 가이드북 [전체 다시 훑기] 클릭 시 진행 상태 안 보임. 현재 N/M PR 처리 중 + 단계 (search → enrich → upsert) 노출.
- [ ] **가독성** — line height / font size / spacing / max-width 조정. 본문 한 화면 안 한 단락 + 여백 충분.
- [ ] **섹션 구분 명확화** — 헤더 위계 / 구분선 / 카드 화이트스페이스. 읽기 흐름 끊김 줄이기.

### PR — gh 호출 인프라 강화 `backend`
한 줄 임팩트: gh 인증/네트워크 실패도 매끄럽게

- [ ] gh 미설치 / 미로그인 별도 모달 (현재는 sidebar inline)
- [ ] 회사 HTTPS outbound 차단 감지 + 자동 sync off 설정 (매일 토스트 떠야 발견)

### PR — commit cluster 카드 (Plan B) `backend`
한 줄 임팩트: 회사 PR 워크플로 전환 부담 크면 branch cluster 로 대체

- [ ] branch 단위 commit cluster → AI 입력 commit messages 로 카드 생성

---

## 🧹 안정성 / 위생

### PR — 메모 사이드바 드래그 race fix `fix`
한 줄 임팩트: drop 한 번 한 뒤 잠시 dragstart 안 잡히던 race fix

- [ ] **재현** — 메모를 폴더로 drag&drop 성공한 직후, 같은/다른 메모 다시 잡으면 dragstart 자체가 안 시작됨. 수초~수십초 지나면 자동 회복.
- [ ] **원인 추정** — PR #34 의 Tauri `dragDropEnabled: false` + WKWebView dragend 후 native drop layer reset 타이밍 race. dragend 발화 누락 또는 element draggable 속성 복구 지연 의심.
- [ ] **fix 방향** — dragend 이후 강제 reset (draggable 속성 toggle, native drop layer 명시 해제). 재현 안 되는 케이스 대비 dev 로그 먼저 박고 며칠 dogfood 후 확정.

### PR — 루틴 추가 모달 validation 보강 `fix`
한 줄 임팩트: 루틴 추가/편집 시 시작일/종료일/이름 빈 값·역전 차단

- [ ] **시작일 빈 값 차단** — 빈 값이면 active 기간 판단 망가짐 (`listRoutinesActiveOn` 클램프 fail). 현재 빈 값으로도 저장됨.
- [ ] **종료일 < 시작일 차단** — 음수 기간 루틴 저장 차단.
- [ ] **이름 빈 값 차단** — 빈 이름은 파일명도 안 잡힘.
- [ ] **UI** — submit 버튼 비활성 + 인라인 에러 (toast 보다 즉시 인식). voice/tone "원인 + 해결" 2단 따름.

### PR — 백업 가시성 강화 `ui_ux`
한 줄 임팩트: spinner + 마지막 백업 시각 + 오래된 zip 정리 = 백업 영역 dogfood 폴리싱

- [ ] **첫 zip spinner toast** — vault 크기 따라 첫 zip 1-10초 침묵. 1초+ 면 spinner toast.
- [ ] **설정 모달에 마지막 백업 시각 + 백업 path 노출** — "마지막 백업: 2026-05-21 14:32 · 경로 ~/Backups/...". 클릭 = path 클립보드 또는 Finder 진입.
- [ ] **오래된 zip 자동 정리** — 최근 N개 (default 30개) 만 유지, 그 외 삭제. 정책 = 설정 모달에서 조정 가능.

---

## 📅 매일 사용 / dogfood (작업 X, routine)

- [ ] V0.7 dogfood 매일 사용 — 다음 분기 평가 시 portfolio 탭만 띄워서 5분 내 펼쳐보일 수 있는지 검증
- [ ] 다른 owner repo legacy 카드 backfill — "Legacy 카드 프롬프트" 복사 → 각 repo Claude Code 에 paste
- [ ] 회사 owner repo PR 워크플로 전환 시도 — branch + 셀프 PR + auto-merge alias (5초)
- [ ] backup-pre-pr-split branch 삭제 결정 (dogfood 며칠 후 안전 확인)

---

## 🔮 V0.7+ 후보 (dogfood 결과로 진입 결정)

- [ ] Tauri 2 Mobile (read-only viewer 부터) — Tauri 2 Mobile 학습/탐색이 동기. 1단계 = vault read + 메모 list/detail 만 모바일 UI 로. write 는 conflict/watcher race 영역이라 학습 단계엔 보류. 옵시디안 모바일 대체보다는 프레임워크 학습 + 본인 stack 모바일 가능성 증명 용도.
- [ ] "Claude 응답 paste → 자동 callout" 회의록 영역
- [ ] 녹음 파일 직접 업로드 → 자동 STT
- [ ] Tauri 데스크탑 `.dmg` 빌드 + 코드 사인
