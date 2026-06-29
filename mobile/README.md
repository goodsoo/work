# goodsoob-work mobile (iOS)

맥북 없이 **할 일·일정**을 확인/수정하기 위한 아이폰 앱. 맥 데스크탑 앱과 **같은
iCloud Drive vault 폴더의 마크다운 파일**을 직접 읽고 쓴다 (별도 서버·DB 없음).

## 구조

```
mobile/
  VaultKit/          # 순수 로직 SwiftPM 패키지 (Xcode 불필요, swift 로 검증 가능)
    Sources/VaultKit/    데스크탑 파서 1:1 포팅 (TaskParser/ScheduleParser/DateParsing)
    Sources/VaultKitCheck/   CLT 자체검증 러너
    Tests/VaultKitTests/     XCTest (Xcode 에서 실행)
  App/               # SwiftUI 앱 (Xcode 필요)
    project.yml          xcodegen 스펙 (.xcodeproj 의 source of truth)
    Sources/             앱 코드 (VaultStore + 4탭 + 에디터)
```

- **데이터 모델 동일**: 할 일 = `tasks/*.md` 체크박스 라인, 일정 = `schedule.md`
  날짜-우선 불릿. 맥 앱과 포맷 100% 호환 (round-trip 검증됨).
- **iCloud 접근**: 폴더를 1회 선택하면 security-scoped bookmark 로 영구 접근.
  읽기/쓰기는 `NSFileCoordinator` + atomic write 로 iCloud 동기화 안전.

## VaultKit 검증 (Xcode 없이 지금 가능)

```bash
cd mobile/VaultKit
swift run vaultkit-check     # 데스크탑 포맷 호환 자체검증 (119 checks)
```

Xcode 설치 후엔 XCTest 도 실행 가능:

```bash
swift test                   # 또는 Xcode 에서 ⌘U
```

## 앱 빌드 (Xcode 필요)

### 1. 선행: Xcode 설치

App Store 에서 **Xcode** 설치 후:

```bash
sudo xcode-select -s /Applications/Xcode.app
sudo xcodebuild -license accept
```

### 2. xcodegen 으로 프로젝트 생성

```bash
brew install xcodegen
cd mobile/App
xcodegen generate
open GoodsoobWork.xcodeproj
```

### 3. 서명 + 실행

- Xcode 에서 타깃 **GoodsoobWork → Signing & Capabilities** 에서 본인 Apple ID 팀 선택
  (무료 Apple ID 도 본인 기기 7일 서명으로 설치 가능).
- 아이폰 USB 연결 → 기기 선택 → ⌘R.
- 첫 실행 시 앱에서 **vault 폴더 선택** (iCloud Drive 안 맥과 같은 work 폴더).

## 1차 범위

- ✅ 할 일: 확인 / 체크 / 추가 / 편집(제목·마감·우선순위) / 삭제
- ✅ 일정: 확인 / 추가 / 편집(날짜·다일·시각) / 삭제
- ✅ 오늘 대시보드: 오늘 일정 + 오늘·밀린 할 일 + 빠른 추가
- ✅ 메모: 읽기 전용 (편집은 맥 앱)

## 주의

- `.build/`, `*.xcodeproj/`, `DerivedData/` 는 gitignore (iCloud churn 방지).
  `.xcodeproj` 는 `xcodegen generate` 로 재생성하므로 커밋하지 않음.
- iCloud 파일이 기기에 아직 안 받아졌으면(placeholder) 첫 읽기에서 다운로드를
  트리거하고, 잠시 후 당겨서 새로고침하면 보인다.
