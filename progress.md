# Progress

다음 세션이 빠르게 파악할 수 있도록 짧게 유지.

## 현재 상태 (2026-05-18)

**V0.6 Vault 마이그레이션 코드 완료.** Supabase → 로컬 md 파일 vault 백엔드. 4개 commit. typecheck/test 통과, `bun run build` 성공. Tauri dev 도 정상 동작.

### 이번 세션에서 완료

**Phase 1 — Vault foundation** (`e853007`)
- `src/lib/vault/` 6 모듈: adapter (Tauri fs + in-memory + atomic write + ConflictError), parser (gray-matter 대신 js-yaml JSON_SCHEMA + H1 split), tasks (inline syntax + toggleTodo), scan (디렉토리 list + trashFile + ensureVaultStructure), watcher (TanStack Query invalidate + selfWriteWindow), VaultProvider/useVault (React context).
- Tauri 2 plugin: `tauri-plugin-fs` (`features = ["watch"]` 필수 — 빼면 "Command watch not found" 런타임 에러), `tauri-plugin-dialog`. permissions `fs:scope-home-recursive` + 개별 권한.
- 28 unit test (parser 12 + tasks 8 + tasks-toggle 3 + watcher 2 + conflict 2).
- design doc `V0.6-vault-design.md` + `mock-vault/` 샘플 (회의록 2 + 일기 2 + inbox).

**Phase 2 — API/hooks swap** (`ce3955c`)
- hook 시그니처 100% 유지. 내부만 vault adapter 호출.
- id 체계 변경: UUID → file path. Todo.id = `file#L{line}`.
- attendees: string CSV → string[]. UI 호환은 join/array 변환.
- soft delete: `deleted_at` → `.trash/{stamp}-{base}.md`.
- created_at/updated_at: file mtime 기반 ISO 노출 (UI 호환).
- Schedule = isEvent todo subset.

**Phase 3+4 — UI** (`4dee4ff`)
- VaultPicker / VaultGate. 첫 실행 시 폴더 선택 모달.
- AuthGate / 로그인 화면 / 로그아웃 버튼 / 유저 아바타 제거.
- ClaudePromptButton (SummarizeButton 대체) + `lib/clipboardPrompt.ts`.

**Phase 5 — cleanup + docs** (`06e0fe4`)
- 삭제: `src/lib/supabase.ts`, `database.types.ts`, `src/hooks/useAuth.ts`, `src/components/auth/*`, `SummarizeButton.tsx`, `supabase/` 폴더 전체, `.env.example`.
- CLAUDE.md V0.6 갱신 (로드맵 + vault footgun + Tauri 전용).
- PWA 제거 (vite-plugin-pwa, vite.config 의 VitePWA) — commit 1 에 통합됨.

### review 결과

`/plan-eng-review` 통과 — VaultIndexer 별도 모듈 제거 (TanStack Query 가 캐시 레이어), PWA 빌드 폐기, 모바일 V0.7+ candidate, 자체 todo syntax (옵시디안 Tasks plugin emoji 호환 X), 3 critical test 추가 (watcher/conflict/toggle). gstack review log 기록됨.

## 다음 세션 작업

### V0.6.1 dogfood / polish

1주일 본인 매일 사용. 발견 버그 fix. todo.md 의 "V0.6.1 후속" 항목들 우선:
- Conflict resolution 모달 (현재는 throw 만)
- Vault 변경 UI (설정 페이지)
- iCloud sync `(conflicted copy)` 파일 무시
- vault 스캔 실측 (수백 파일 < 50ms 가설)
- vault 폴더 사라짐 graceful

### V0.7 후보

- Tauri 2 Mobile (모바일 본인 앱)
- Claude 응답 paste → 자동 callout
- 녹음 → STT
- 메모 history (서버 또는 git 기반)

### 미해결

- mock-vault/.obsidian/ untracked — `.gitignore` 에 추가 필요 (옵시디안이 mock-vault 열면 자동 생성).
- 캘린더 스크롤 상태 페이지 전환 시 보존 (V0.5.4 부터 carry-over).
- 에러 상태 패딩 통일 (p-3/p-4 혼재).
- V0.5.3~V0.5.4 lint 11 errors (기존 코드 react-hooks/refs 등) — V0.6 영역 외, dogfood 단계에서 정리.

## 알아야 할 컨텍스트

- **Tauri fs watch 활성화**: `Cargo.toml` 의 `tauri-plugin-fs` 에 `features = ["watch"]` 명시. 안 하면 JS 측 watch 호출이 "Command watch not found" 런타임 에러로 vault init 실패 → localStorage 비워지고 picker 다시 표시.
- **id = file path 의 영향**: 메모 파일명을 옵시디안에서 rename 하면 우리 앱 입장에선 "삭제 + 신규". TanStack Query cache 무효화 + UI 가 새 id 로 다시 fetch. content 유지는 됨 (파일 내용 동일).
- **attendees 마이그레이션**: 새 vault 라 기존 데이터 없음. UI 가 string 받던 곳은 `array.join(", ")` 으로 변환. AttendeeTagInput 같은 컴포넌트가 array 다루는지 확인 필요할 수 있음 (dogfood 시).
- **소량 lint 에러**: VaultProvider 의 `setIsReady(false)` in effect 는 의도된 패턴 (vault root null 이면 즉시 reset). 한 줄 eslint-disable. 다른 V0.5.3 lint 는 기존 코드.
- **conflict 충돌 처리 흐름**: VaultAdapter.write 호출 시 expectedMtime 누락하면 검사 안 함 (`undefined`). hooks 가 mutation 시 readMeta → expectedMtime 전달하는 패턴은 V0.6 에서 부분만 적용. 정밀하게 하려면 모든 mutation 에 적용 + UI 모달.
- **gstack review log** 표준 위치: `~/.gstack/projects/goodsoob-work/`. 이번 V0.6 design doc 도 거기 sync 됨 (`ham-main-design-20260517-140918.md`).
- **mock-vault/**: 디자인 시 샘플로 작성. 실제 vault 폴더로 사용 가능 (개발 중 dogfood 용으로 적합).
