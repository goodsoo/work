import Foundation

// vault 폴더 구조 상수 + sync 도구 부산물 필터. 데스크탑 `scan.ts` 와 동일 규칙.

public enum VaultPaths {
    public static let tasksDir = "tasks"
    public static let inbox = "tasks/inbox.md"
    public static let schedule = "schedule.md"
    public static let notesDir = "notes"
    public static let journalsDir = "journals"
}

// iCloud/Dropbox 충돌 사본·placeholder·dotfile 은 스캔에서 제외. 데스크탑 isSyncNoiseFile.
private let syncNoiseRE = RE("\\(conflicted copy|\\(conflict[^/]*\\d{4}-\\d{2}-\\d{2}", [.caseInsensitive])

public func isSyncNoiseFile(_ path: String) -> Bool {
    let name = path.split(separator: "/").last.map(String.init) ?? path
    if name.hasPrefix(".") { return true }
    if name.hasSuffix(".icloud") { return true }
    return syncNoiseRE.matches(name)
}
