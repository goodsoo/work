# todo

## 🟢 완료 — V0.6 (2026-05-17~18, Vault 마이그레이션)

- [x] **로컬 파일 기반 데이터 저장 검토 → 채택**. 옵시디안 스타일 vault 폴더 + md 파일. 회사 공유 + 외부 도구 호환 + 1인 사용 모두 충족.
- [x] **Vault layer foundation**. adapter (Tauri fs + in-memory) + parser (frontmatter H1 split) + tasks (inline syntax + toggle) + scan + watcher.
- [x] **Optimistic concurrency**. `expectedMtime` 으로 동시 편집 충돌 감지 (`ConflictError`).
- [x] **Atomic write**. tmp 파일 → rename. 중간 crash 시 원본 보존.
- [x] **API/hooks vault 백엔드로 swap**. useMeetings/Journals/Todos/Schedules 시그니처 유지, 내부만 vault.
- [x] **id 체계 변경**. UUID → file path / `file#L{line}` (todo).
- [x] **soft delete**. Supabase `deleted_at` → `.trash/` 폴더 (옵시디안 호환).
- [x] **attendees**. string CSV → string[] (frontmatter array).
- [x] **VaultPicker / VaultGate**. 첫 실행 시 폴더 선택 모달.
- [x] **Auth 완전 제거**. AuthGate / SignInScreen / useAuth / Google OAuth.
- [x] **Claude 프롬프트 복사 헬퍼**. SummarizeButton 대체. 본문+transcript+meta → 클립보드.
- [x] **Supabase 완전 제거**. supabase 폴더 + Edge Functions + 클라이언트 + 자동 생성 타입 + deps.
- [x] **PWA 빌드 폐기**. Tauri 데스크탑 전용 (vite-plugin-pwa 제거).
- [x] **28 + 3 unit test 추가**. parser/tasks/tasks-toggle/watcher/conflict/clipboardPrompt.

---

## 🟡 V0.6.1 후속 (dogfood 단계)

- [ ] **Conflict resolution 모달**. 현재는 ConflictError throw 만. UI 에서 "내 변경 보존 / 외부 변경 가져오기" 선택지 + `.conflict-*.md` 파일 생성.
- [ ] **Vault 변경 UI**. 설정 페이지에 "다른 vault 폴더로 변경" 버튼. 현재는 localStorage 수동 비워야 picker 다시 뜸.
- [ ] **Vault 폴더 picker 후 첫 인덱싱 진행률**. 큰 vault 인 경우 spinner.
- [ ] **vault 스캔 성능 실측**. 수백 파일 < 50ms 가설 검증. 실측 후 frontmatter only 부분 캐시 도입할지 결정.
- [ ] **iCloud sync 충돌 파일 무시 룰**. `(conflicted copy)` 같은 OS sync 자체 파일 vault 스캔에서 제외.
- [ ] **vault 폴더 사라짐 graceful 처리**. 외장 디스크 disconnect 시 모달.

---

## 🟡 V0.7 후보

- [ ] **Tauri 2 Mobile**. 모바일에서 본인 디자인 UI 사용. iOS sandbox/document picker + security-scoped bookmark 패턴. 일단 옵시디안 모바일로 dogfood 후 진짜 필요한지 평가.
- [ ] **"Claude 응답 paste → 자동 callout"**. Claude 응답 paste 시 H2 split → 요약 탭 callout 자동 채움.
- [ ] **녹음 파일 직접 업로드 → 자동 STT**. 현재는 외부 AI로 변환한 결과 복붙. 비용/사용 빈도 따져 결정.
- [ ] **Server-side 메모 history**. 새로고침/디바이스 변경 후에도 복원. vault 방식이면 git commit 으로도 가능.
- [ ] **UI/UX 작업 포트폴리오 자동 기록**. GitHub API + Claude Code 세션 내 분석.
- [ ] **Tauri 데스크탑 앱 빌드 마무리**. `bun run tauri:build` 로 .dmg 생성 + 코드 사인 (선택).

---

## 🟡 디자인 / UI 폴리싱 (남은 작업)

- [ ] **에러 상태 패딩 통일**. p-3 / p-4 혼재.
- [ ] **캘린더 스크롤만으로 다른 월 본 상태 보존**. selectedDate 안 바뀐 채 스크롤만 이동한 경우는 페이지 전환 시 복원 안 됨. 명시적 날짜 클릭은 OK.
- [ ] **mock-vault/.obsidian 무시**. `.gitignore` 에 추가.

---

## 🟢 완료 이전 버전 (참고용)

V0.5.4 (캘린더 연속 스크롤): 주 단위 연속 스크롤 + 1일 진입 기준 헤더 + 2026 이전 차단 + 다른 해 연도 표시.
V0.5.3 (메모 history 분리): cacheKey 4-stack + 페이지 전환 시 보존 + 진입 자동 선택.
V0.5.2 (3-탭 + transcript): 본문/회의 내용/요약 탭 + line gutter + 글로벌 툴팁.
