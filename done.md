# done

[todo.md](todo.md) 에서 완료된 항목 아카이브. 날짜 역순.

---

## 2026-05-21

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
