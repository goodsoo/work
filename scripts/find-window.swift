// goodsoob-work dev 창의 CGWindowID 를 표준출력으로 내보낸다.
// 1순위: 창 제목이 인자와 정확히 일치 (앱이 부팅 시 `짱수 · {branch}` 로 setTitle 한 값).
// 2순위(fallback): 앱(owner "app"/"짱수") 창이 정확히 1개면 그것 — 화면 기록 권한이 없어
//                  제목을 못 읽는 단일 세션 케이스 대비.
// 사용: swift find-window.swift "짱수 · feat/foo"
import CoreGraphics
import Foundation

let target = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ""

// onScreenOnly 는 쓰지 않는다 — dev 창이 다른 Space/최소화 상태면 빠진다.
// screencapture -l 은 windowID 만 있으면 다른 Space 창도 잡으므로 전체 목록에서 찾는다.
guard
  let list = CGWindowListCopyWindowInfo(
    [.excludeDesktopElements], kCGNullWindowID
  ) as? [[String: Any]]
else {
  FileHandle.standardError.write("WINDOW_LIST_FAILED\n".data(using: .utf8)!)
  exit(1)
}

var exactID: CGWindowID?
var ownedIDs: [CGWindowID] = []

for w in list {
  guard (w[kCGWindowLayer as String] as? Int ?? -1) == 0 else { continue }  // 일반 창만
  let num = w[kCGWindowNumber as String] as? CGWindowID ?? 0
  let name = w[kCGWindowName as String] as? String ?? ""
  let owner = w[kCGWindowOwnerName as String] as? String ?? ""

  if !target.isEmpty && name == target {
    exactID = num
    break
  }
  if owner == "app" || owner == "짱수" {
    let bounds = w[kCGWindowBounds as String] as? [String: Any]
    let h = bounds?["Height"] as? Double ?? 0
    if h >= 200 { ownedIDs.append(num) }  // 작은 보조 창 제외
  }
}

if let id = exactID {
  print(id)
} else if ownedIDs.count == 1 {
  print(ownedIDs[0])
} else {
  FileHandle.standardError.write("NO_MATCH owned=\(ownedIDs.count)\n".data(using: .utf8)!)
  exit(1)
}
