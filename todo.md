# todo

PR 단위로 묶음. 각 PR 의 **한 줄 임팩트** 는 카드 frontmatter `impact_summary` 후보. 카테고리는 `ui_ux | backend | infra | fix | other`.

🔥 = 우선순위 높음 (dogfood 통증). 🟡 = 일반 후보. 🟢 = 진행 중.

완료 기록은 [done.md](done.md) 참조.

---

## ✨ 신규 기능

### PR — 단축키 자료/통계 페이지 `ui_ux` 🟡
한 줄 임팩트: 분기 평가용 — 회의 N건 / 일기 streak / todos 완료율 한 화면

- [ ] ActivityBar 새 탭 또는 portfolio 탭 안 별 view. 후순위 — dogfood 통증 작음, 평가 시즌 근접에 진입 결정.
- [ ] vault scan 기반 — meetings 수 (월별), journals streak, todos 완료율 (이번 달 / 분기). 외부 의존 0.

### PR — 포커스 모드 (방해 요소 hide) `ui_ux` 🟡
한 줄 임팩트: 한 키로 chrome 다 숨기고 본문 한 컬럼 집중

- [ ] 사이드바 collapse (`Cmd+\`) 는 이미 있음. ActivityBar + 헤더까지 한 키로 hide → 본문만. 옵시디안 "포커스 모드" 패턴.
- [ ] 토글 단축키 + localStorage persist. Tauri only. dogfood 중 "지금은 메모만 보고 싶어" 순간 자주 오는지 1주 관찰 후 진입.

---

## 🚨 V0.7.x — 데스크탑 첫 배포 이후 (2026-05-27 ~)

> 실사용 데이터 누적 시작. 지금까지의 "본인 미사용 → legacy 데이터 가능성 0" 전제 폐기.

### PR — 마이그레이션 헬퍼 추상화 `backend` 🟡
한 줄 임팩트: schema 변경 시 versioned migration 한 곳에서 — 호출처 산재 X

- [ ] `src/lib/vault/migrations/` 폴더 + `runMigrations(currentVersion)` runner. frontmatter `schema: N` 박고 N 미만이면 N→N+1 변환 함수 차례로 적용 후 rewrite.
- [ ] 첫 진입점 = `scanMeetings` / `readFullMeeting` (옛 lazy migration 자리). f601cec 로 지운 패턴을 versioned 형태로 부활 — 이번엔 실데이터 있으니 필요.
- [ ] 첫 실제 schema 변경 PR 박을 때 같이 도입 (지금 빈 runner 만 박으면 over-engineering). 트리거 = 다음 frontmatter 필드 추가/이름 변경.

### PR — Conflict resolution 모달 `backend` 🟡
한 줄 임팩트: 옵시디안 모바일과 동시 편집 충돌 시 보존/덮어쓰기 선택

- [ ] ConflictError throw → UI 모달 (내 변경 보존 / 외부 변경 가져오기 / `.conflict-*.md` 파일 생성)
- [ ] 모바일 viewer (read-only) 진입 전 우선 처리 — 동시 편집 발생 빈도 ↑
- 우선순위 낮춤 (2026-06-01): 현재 옵시디안 모바일 미사용 → 동시 편집 통증 없음. 모바일 viewer 진입 시 재격상.

### PR — vault 무결성 검사 + 백업 복원 `backend` 🟡
한 줄 임팩트: 정기 자가 검사 + 백업 zip 한 클릭 복원

- [ ] 설정 모달 "vault 검사" — uid 중복 / frontmatter 깨짐 / orphan attachment / 휴지통 size 한 화면 진단. 발견 시 자동 복구 가능한 것 (uid dedupe) 은 그 자리에서.
- [ ] 백업 zip 복원 흐름 — 현재는 백업만 생성, 복원 시 사용자가 직접 Finder 에서 unzip → 새 vault 선택해야 함. 1 클릭 "이 zip 으로 복원" → 임시 폴더 unzip + vault 전환 prompt.
- [ ] crash / silent fail 진단 — adapter.read/readMeta 실패 카운터 + 설정 패널 노출. dogfood 중 누락 발견 시 원인 추적.

---

## 📊 Portfolio (V0.7.x 후속)

### PR — sync 결과 카드 식별 `ui_ux`
한 줄 임팩트: 어떤 카드가 새로 들어왔는지 한눈에

- [ ] sync 직후 신규 추가 카드 우상단 "NEW" 배지. 다음 sync 까지 유지. `.synced.md` 에 `last_added_slugs: []` 저장 → 다음 sync 가 덮어씀.
- [ ] 갱신 카드 표시는 noise — 거의 매번 발생. skip.
- [ ] (선택) 사이드바 "새 카드 N" 클릭 → 그 N 개만 임시 필터.

### PR — 가이드북 UIUX 다듬기 `ui_ux`
한 줄 임팩트: 동기화 진행 표시 + 가독성 정돈

- [ ] **동기화 progress 표시** — 현재 가이드북 [전체 다시 훑기] 클릭 시 진행 상태 안 보임. 현재 N/M PR 처리 중 + 단계 (search → enrich → upsert) 노출.
- [ ] **가독성** — line height / font size / spacing / max-width 조정. 본문 한 화면 안 한 단락 + 여백 충분.
- [ ] **섹션 구분 명확화** — 헤더 위계 / 구분선 / 카드 화이트스페이스. 읽기 흐름 끊김 줄이기.

### PR — gh 호출 인프라 강화 `backend`
한 줄 임팩트: gh 인증/네트워크 실패도 매끄럽게

- [x] gh 미설치 / 미로그인 별도 모달 (현재는 sidebar inline)
- [ ] 회사 HTTPS outbound 차단 감지 + 자동 sync off 설정 (매일 토스트 떠야 발견)

### PR — commit cluster 카드 (Plan B) `backend`
한 줄 임팩트: 회사 PR 워크플로 전환 부담 크면 branch cluster 로 대체

- [ ] branch 단위 commit cluster → AI 입력 commit messages 로 카드 생성

---

## 💤 후순위 (dogfood 통증 부족)

### PR — 동적 카테고리 (사용자 정의 분류) `backend`
한 줄 임팩트: 업무/미팅 외 본인 카테고리 자유 추가

- [ ] **데이터 모델** — `TodoCategory` union → `string`. vault 안 `categories.md` (한 줄당 `id: label`) 가 source of truth. 기본 `work / schedule / other` 부트스트랩.
- [ ] **UI** — 추가/삭제 위치 결정 (TaskAddModal select 안 inline / 설정 패널 / 사이드바 헤더 편집 모드). 사이드패널 필터 + 캘린더 사이드는 동적 빌드.
- [ ] **Sanitize 정책** — 카테고리 삭제 시 그 카테고리 todo 처리: (a) vault 라인 `#xxx` 자동 strip (b) UI null 표시 + 라인 보존 (c) 삭제 차단 + 옮기라고 경고. 한 가지 고르기.
- [ ] **알 수 없는 카테고리 표기** — vault 의 `#unknown` 같은 tag 가 카테고리 list 에 없을 때 UI 에서 어떻게 보일지 (지금은 null 로 무시 + 라인 보존).

---

## 📅 매일 사용 / dogfood (작업 X, routine)

- [ ] **첫 배포 후 1주 dogfood 통증 수집** (2026-05-27 ~ 06-03) — 매일 사용 중 발견되는 마찰을 todo.md 의 신규 섹션 / 적합한 PR 묶음으로 즉시 입력. 한 주 묶어서 PR 단위 정리.
- [ ] V0.7 dogfood 매일 사용 — 다음 분기 평가 시 portfolio 탭만 띄워서 5분 내 펼쳐보일 수 있는지 검증
- [ ] 다른 owner repo legacy 카드 backfill — "Legacy 카드 프롬프트" 복사 → 각 repo Claude Code 에 paste
- [ ] 회사 owner repo PR 워크플로 전환 시도 — branch + 셀프 PR + auto-merge alias (5초)

---

## 🔮 V0.7+ 후보 (dogfood 결과로 진입 결정)

- [ ] Tauri 2 Mobile (read-only viewer 부터) — Tauri 2 Mobile 학습/탐색이 동기. 1단계 = vault read + 메모 list/detail 만 모바일 UI 로. write 는 conflict/watcher race 영역이라 학습 단계엔 보류. 옵시디안 모바일 대체보다는 프레임워크 학습 + 본인 stack 모바일 가능성 증명 용도.
- [ ] 녹음 파일 직접 업로드 → 자동 STT
- [ ] Tauri 데스크탑 `.dmg` 빌드 + 코드 사인
