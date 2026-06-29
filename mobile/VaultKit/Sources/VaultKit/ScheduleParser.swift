import Foundation

// 데스크탑 `src/lib/vault/schedule.ts` + `src/api/schedule.ts` 의 일정 파싱/직렬화 포팅.
// 일정 = vault 루트의 단일 파일 `schedule.md`. 체크박스 없는 "날짜-우선" 이벤트 불릿.
//   - 2026-06-15 14:30 팀 회의
//   - 2026-06-15 워크샵                (종일)
//   - 2026-06-15..2026-06-17 출장       (다일)

public let SCHEDULE_PATH = "schedule.md"

public struct ScheduleEvent: Sendable, Equatable, Identifiable {
    public var id: String        // `${file}#L${line}`
    public var text: String
    public var start: String     // ISO yyyy-MM-dd
    public var end: String?      // 다일 종료일(포함). nil = 단일일
    public var time: String?     // HH:mm. nil = 종일
    public var file: String
    public var line: Int         // 0-based
}

public enum ScheduleParser {

    static let bulletRE = RE("^(\\s*)- (.+)$")
    static let leadingRangeRE = RE("^(\\d{4}-\\d{2}-\\d{2})\\.\\.(\\d{4}-\\d{2}-\\d{2})\\b")
    static let leadingDateRE = RE("^(\\d{4}-\\d{2}-\\d{2})\\b")
    static let leadingTimeRE = RE("^(\\d{1,2}):(\\d{2})\\b")
    static let fenceRE = RE("^(```|~~~)")
    static let leadingWsRE = RE("^\\s+")

    // ─── extractEvents ─────────────────────────────────────────────────────────

    public static func extractEvents(_ filePath: String, _ raw: String) -> [ScheduleEvent] {
        let lines = raw.components(separatedBy: "\n")
        var events: [ScheduleEvent] = []
        var inCodeFence = false
        var codeFenceMarker = ""

        for (i, line) in lines.enumerated() {
            if let f = fenceRE.firstMatch(line), let marker = f.group(1) {
                if !inCodeFence {
                    inCodeFence = true
                    codeFenceMarker = marker
                } else if line.hasPrefix(codeFenceMarker) {
                    inCodeFence = false
                }
                continue
            }
            if inCodeFence { continue }

            guard let bullet = bulletRE.firstMatch(line), let body = bullet.group(2) else { continue }
            guard let parsed = parseEventContent(body.trimmingCharacters(in: .whitespaces)) else { continue }
            events.append(ScheduleEvent(
                id: "\(filePath)#L\(i)",
                text: parsed.text,
                start: parsed.start,
                end: parsed.end,
                time: parsed.time,
                file: filePath,
                line: i
            ))
        }
        return events
    }

    struct ParsedEvent {
        var text: String
        var start: String
        var end: String?
        var time: String?
    }

    static func parseEventContent(_ content: String) -> ParsedEvent? {
        var start: String
        var end: String? = nil
        var rest: String

        if let range = leadingRangeRE.firstMatch(content), let s = range.group(1), let e = range.group(2) {
            start = s
            if e > s { end = e } // 역전(e<s)·동일(e==s) 은 단일일로 강등
            rest = content.utf16Suffix(range.length)
        } else if let date = leadingDateRE.firstMatch(content), let s = date.group(1) {
            start = s
            rest = content.utf16Suffix(date.length)
        } else {
            return nil // 날짜로 시작 안 하면 이벤트 아님
        }

        if let ws = leadingWsRE.firstMatch(rest) {
            rest = rest.utf16Suffix(ws.length)
        }
        var time: String? = nil
        if let tm = leadingTimeRE.firstMatch(rest), let hh = tm.group(1), let mn = tm.group(2) {
            time = "\(hh.padLeft(2)):\(mn)"
            rest = rest.utf16Suffix(tm.length)
            if let ws = leadingWsRE.firstMatch(rest) {
                rest = rest.utf16Suffix(ws.length)
            }
        }
        return ParsedEvent(text: rest.trimmingCharacters(in: .whitespaces), start: start, end: end, time: time)
    }

    // ─── 직렬화 ────────────────────────────────────────────────────────────────

    public struct EventLineInput {
        public var start: String
        public var end: String?
        public var time: String?
        public var text: String
        public init(start: String, end: String? = nil, time: String? = nil, text: String) {
            self.start = start; self.end = end; self.time = time; self.text = text
        }
    }

    public static func buildEventLine(_ input: EventLineInput) -> String {
        var line = "- \(input.start)"
        if let end = input.end, end > input.start { line += "..\(end)" }
        if let time = input.time { line += " \(time)" }
        let text = input.text.trimmingCharacters(in: .whitespaces)
        if !text.isEmpty { line += " \(text)" }
        return line
    }

    // ─── 정렬 (데스크탑 listEvents 순서) ────────────────────────────────────────

    public static func sorted(_ events: [ScheduleEvent]) -> [ScheduleEvent] {
        events.sorted { a, b in
            if a.start != b.start { return a.start < b.start }
            let t = byTime(a.time, b.time)
            if t != 0 { return t < 0 }
            return a.text < b.text
        }
    }

    static func byTime(_ a: String?, _ b: String?) -> Int {
        let ta = a ?? "", tb = b ?? ""
        if ta == tb { return 0 }
        if ta.isEmpty { return -1 }
        if tb.isEmpty { return 1 }
        return ta < tb ? -1 : 1
    }

    // ─── raw 문자열 CRUD ───────────────────────────────────────────────────────

    public static func appendEvent(_ raw: String, _ input: EventLineInput) -> (content: String, line: Int) {
        let line = buildEventLine(input)
        let trimmed = TaskParser.trimTrailingNewlines(raw)
        let updated = "\(trimmed)\n\(line)\n"
        let lineNum = updated.components(separatedBy: "\n").count - 2
        return (updated, lineNum)
    }

    public static func applyUpdate(_ raw: String, line: Int, patch: SchedulePatch) throws -> String {
        let events = extractEvents("", raw)
        guard let existing = events.first(where: { $0.line == line }) else {
            throw VaultError.eventNotFound(line: line)
        }
        let merged = EventLineInput(
            start: patch.start ?? existing.start,
            end: patch.endSet ? patch.end : existing.end,
            time: patch.timeSet ? patch.time : existing.time,
            text: patch.text ?? existing.text
        )
        var lines = raw.components(separatedBy: "\n")
        let indent = RE("^(\\s*)").firstMatch(lines[line])?.group(1) ?? ""
        lines[line] = indent + buildEventLine(merged)
        return lines.joined(separator: "\n")
    }

    public static func deleteLine(_ raw: String, line: Int) -> String {
        TaskParser.deleteLine(raw, line: line)
    }
}

public struct SchedulePatch: Sendable {
    public var text: String?
    public var start: String?
    public var end: String?
    public var endSet: Bool = false
    public var time: String?
    public var timeSet: Bool = false
    public init() {}
    public mutating func setEnd(_ v: String?) { end = v; endSet = true }
    public mutating func setTime(_ v: String?) { time = v; timeSet = true }
}
