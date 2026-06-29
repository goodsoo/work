// swift-tools-version: 6.0
import PackageDescription

// VaultKit — goodsoob-work 데스크탑 앱과 동일한 마크다운 vault 포맷을 읽고 쓰는
// 순수 로직 계층. 아이폰 앱(SwiftUI)이 import 하며, Xcode 없이도 `swift test` 로
// 포맷 호환(round-trip)을 검증할 수 있도록 SwiftPM 패키지로 분리.
let package = Package(
    name: "VaultKit",
    platforms: [
        .iOS(.v16),
        .macOS(.v13),
    ],
    products: [
        .library(name: "VaultKit", targets: ["VaultKit"]),
        // CLT 전용 자체검증 러너 — XCTest/Xcode 없이 `swift run vaultkit-check` 로
        // 파서 호환을 검증한다. Xcode 설치 후엔 VaultKitTests(XCTest)도 사용.
        .executable(name: "vaultkit-check", targets: ["VaultKitCheck"]),
    ],
    targets: [
        .target(name: "VaultKit"),
        .executableTarget(name: "VaultKitCheck", dependencies: ["VaultKit"]),
        .testTarget(name: "VaultKitTests", dependencies: ["VaultKit"]),
    ]
)
