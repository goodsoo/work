// goodsoob-work dev 창의 CGWindowID 를 표준출력으로 내보낸다.
//
// 제목에 의존하지 않는다 — dev 창 제목이 "짱수 · {branch}" 로 안 박히고 "app" 으로
// 남는 환경이 있어(setTitle 타이밍/define 문제) 제목 매칭은 신뢰 불가. 대신 화면에
// 보이는 앱(owner "app"/"짱수") 창 중 "가장 앞(최근 포커스)" 창을 고른다. 캡쳐 직전
// 원하는 창을 앞으로 가져오면(클릭) 그 창이 잡힌다. dev 세션이 여러 개여도 동작.
//
// owner 이름·bounds 만 읽고 창 제목(kCGWindowName)은 안 읽으므로 화면 기록 권한이
// 없어도 창을 찾는다 (실제 픽셀 캡쳐는 screencapture 가 권한 사용).
// 사용: swift find-window.swift
import CoreGraphics
import Foundation

// optionOnScreenOnly → 화면에 보이는 창만, 앞→뒤 z-order 로 반환 (첫 매칭 = 최전면).
guard
  let list = CGWindowListCopyWindowInfo(
    [.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID
  ) as? [[String: Any]]
else {
  FileHandle.standardError.write("WINDOW_LIST_FAILED\n".data(using: .utf8)!)
  exit(1)
}

for w in list {
  guard (w[kCGWindowLayer as String] as? Int ?? -1) == 0 else { continue }  // 일반 창만
  let owner = w[kCGWindowOwnerName as String] as? String ?? ""
  guard owner == "app" || owner == "짱수" else { continue }
  let bounds = w[kCGWindowBounds as String] as? [String: Any]
  let h = bounds?["Height"] as? Double ?? 0
  guard h >= 200 else { continue }  // 작은 보조 창 제외
  print(w[kCGWindowNumber as String] as? CGWindowID ?? 0)
  exit(0)
}

FileHandle.standardError.write("NO_MATCH\n".data(using: .utf8)!)
exit(1)
