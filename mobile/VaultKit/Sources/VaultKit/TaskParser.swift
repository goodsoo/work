import Foundation

// 데스크탑 `src/lib/vault/tasks.ts` + `src/api/tasks.ts` 의 할 일 파싱/직렬화 포팅.
// 파일 IO 는 앱 계층(VaultStore)에 두고, 여기서는 raw 문자열 → raw 문자열 순수
// 변환만 담당한다. data-loss 위험의 핵심이라 데스크탑 동작을 1:1 로 옮긴다.

public enum TaskPriority: String, Sendable, Equatable {
    case high, medium, low
}

// 파서 결과 (data 라인 한 줄). 데스크탑 `TaskItem`.
public struct TaskItem: Sendable, Equatable {
    public var id: String
    public var text: String
    public var done: Bool
    public var cancelled: Bool   // `- [-]`  취소
    public var deleted: Bool     // `- [D]`  soft-delete (휴지통 전용)
    public var due: String?      // ISO yyyy-MM-dd (다일이면 시작일)
    public var end: String?      // ISO yyyy-MM-dd 종료일(포함). 단일일이면 nil
    public var time: String?     // HH:mm
    public var tags: [String]
    public var file: String
    public var line: Int         // 0-based
}

// 앱이 다루는 할 일 (UI 모델). 데스크탑 `Task`.
// 이름은 `VaultTask` — Swift Concurrency 의 `Task` 와 충돌 회피.
public struct VaultTask: Sendable, Equatable, Identifiable {
    public var id: String        // `${file}#L${line}`
    public var title: String
    public var done: Bool
    public var cancelled: Bool
    public var deleted: Bool
    public var priority: TaskPriority
    public var dueDate: String?
    public var dueTime: String?
    public var sourceMeetingUid: String?
    public var gcalEventId: String?
    public var file: String
    public var line: Int
}

public enum TaskParser {

    // ─── 정규식 (데스크탑과 문자 그대로 동일) ─────────────────────────────────
    static let checkboxRE = RE("^(\\s*)- \\[([ xD-])\\] (.+)$")
    static let tagRE = RE("(?:^|\\s)#([\\p{L}\\p{N}_-]+)")
    static let dueSplitRE = RE(" (?:—|---) (.+)$")
    static let isoDateRE = RE("(\\d{4})-(\\d{2})-(\\d{2})")
    static let dateRangeRE = RE("(\\d{4}-\\d{2}-\\d{2})\\.\\.(\\d{4}-\\d{2}-\\d{2})")
    static let mdDateRE = RE("(?:^|\\s)(\\d{1,2})/(\\d{1,2})(?=\\s|$)")
    static let timeRE = RE("(?:^|\\s)(\\d{1,2}):(\\d{2})(?=\\s|$)")
    static let fenceRE = RE("^(```|~~~)")
    static let meridiemTokenRE = RE("^(오전|오후|am|pm)$", [.caseInsensitive])
    static let dateLikeSlashDashRE = RE("[/\\-]")
    static let hasDigitRE = RE("\\d")

    static let fromTagPrefix = "from-"
    static let gcalTagPrefix = "gcal-"
    static let legacyCategoryTags: Set<String> = ["work", "schedule", "other"]

    // ─── extractTasks ────────────────────────────────────────────────────────

    public static func extractTasks(_ filePath: String, _ raw: String, reference: Date = Date()) -> [TaskItem] {
        let lines = raw.components(separatedBy: "\n")
        var items: [TaskItem] = []
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

            guard let m = checkboxRE.firstMatch(line) else { continue }
            let checkChar = m.group(2) ?? " "
            let done = checkChar == "x"
            let cancelled = checkChar == "-"
            let deleted = checkChar == "D"
            let content = (m.group(3) ?? "").trimmingCharacters(in: .whitespaces)

            let parsed = parseTaskContent(content, reference: reference)
            items.append(TaskItem(
                id: stableId(filePath, content),
                text: parsed.text,
                done: done,
                cancelled: cancelled,
                deleted: deleted,
                due: parsed.due,
                end: parsed.end,
                time: parsed.time,
                tags: parsed.tags,
                file: filePath,
                line: i
            ))
        }
        return items
    }

    struct ParsedContent {
        var text: String
        var due: String?
        var end: String?
        var time: String?
        var tags: [String]
    }

    static func parseTaskContent(_ content: String, reference: Date = Date()) -> ParsedContent {
        var remaining = content
        var due: String? = nil
        var end: String? = nil
        var time: String? = nil

        // 1. tags
        var tags: [String] = []
        remaining = tagRE.replaceAll(remaining) { _, g1 in
            if let t = g1 { tags.append(t) }
            return " "
        }

        // 2. ` — ` / ` --- ` 이후 date/time
        if let dueSplit = dueSplitRE.firstMatch(remaining), let duePart = dueSplit.group(1) {
            // 다일 범위 우선
            if let range = dateRangeRE.firstMatch(duePart),
               let s = range.group(1), let e = range.group(2), e >= s {
                due = s
                if e > s { end = e }
            }
            // ISO 우선
            if due == nil, let iso = isoDateRE.firstMatch(duePart),
               let y = iso.group(1), let mo = iso.group(2), let d = iso.group(3) {
                due = "\(y)-\(mo)-\(d)"
            } else if due == nil, let md = mdDateRE.firstMatch(duePart),
                      let mm = md.group(1), let dd = md.group(2) {
                let year = DateParsing.calendar.component(.year, from: reference)
                due = "\(String(year).padLeft(4))-\(mm.padLeft(2))-\(dd.padLeft(2))"
            }
            if let tm = timeRE.firstMatch(duePart), let hh = tm.group(1), let mn = tm.group(2) {
                time = "\(hh.padLeft(2)):\(mn)"
            }

            // 자연어 fallback
            if due == nil {
                if let d = DateParsing.parseLooseDate(duePart, reference: reference) { due = d }
            }
            if due == nil || time == nil {
                let tokens = duePart.split(whereSeparator: { $0 == " " || $0 == "\t" || $0 == "\n" }).map(String.init)
                // 1. 시간 prefix sliding window — "오후 2시"
                if time == nil && tokens.count >= 2 {
                    for i in 0..<(tokens.count - 1) {
                        if !meridiemTokenRE.matches(tokens[i]) { continue }
                        if let t = DateParsing.parseLooseTime("\(tokens[i]) \(tokens[i + 1])") {
                            time = t
                            break
                        }
                    }
                }
                // 2. 단일 토큰
                for tok in tokens {
                    if due == nil {
                        if let d = DateParsing.parseLooseDate(tok, reference: reference) { due = d }
                    }
                    if time == nil {
                        let isDateLike = dateLikeSlashDashRE.matches(tok) && hasDigitRE.matches(tok)
                        if !isDateLike {
                            if let t = DateParsing.parseLooseTime(tok) { time = t }
                        }
                    }
                }
            }

            // date/time 적어도 하나 매칭 시만 split 유효 (둘 다 실패면 본문 보존)
            if due != nil || time != nil {
                remaining = remaining.utf16Prefix(dueSplit.index)
            }
        }

        return ParsedContent(
            text: remaining.trimmingCharacters(in: .whitespaces),
            due: due, end: end, time: time, tags: tags
        )
    }

    // DJB2 → base36 (JS Int32 wraparound 동일). TaskItem.id 용 (앱은 file#Lline 사용).
    static func stableId(_ filePath: String, _ content: String) -> String {
        let s = "\(filePath)::\(content)"
        var h: Int32 = 5381
        for unit in s.utf16 {
            h = (h &<< 5 &+ h) ^ Int32(unit)
        }
        return String(abs(Int(h)), radix: 36)
    }

    // ─── 라인 직렬화 ───────────────────────────────────────────────────────────

    // title 안 split 구분자(— / ---)를 `--` 로 강등해 다음 read 시 오분리 방지.
    static func sanitizeTaskTitle(_ title: String) -> String {
        // 긴 토큰(`---`)을 먼저 치환해야 `—` 치환과 겹치지 않음.
        title.replacingOccurrences(of: "---", with: "--")
             .replacingOccurrences(of: "—", with: "--")
    }

    public struct TodoLineInput {
        public var title: String
        public var done: Bool = false
        public var cancelled: Bool = false
        public var deleted: Bool = false
        public var dueDate: String? = nil
        public var dueTime: String? = nil
        public var priority: TaskPriority = .medium
        public var sourceMeetingUid: String? = nil
        public var gcalEventId: String? = nil
        public var extraTags: [String] = []

        public init(title: String, done: Bool = false, cancelled: Bool = false,
                    deleted: Bool = false, dueDate: String? = nil, dueTime: String? = nil,
                    priority: TaskPriority = .medium, sourceMeetingUid: String? = nil,
                    gcalEventId: String? = nil, extraTags: [String] = []) {
            self.title = title; self.done = done; self.cancelled = cancelled
            self.deleted = deleted; self.dueDate = dueDate; self.dueTime = dueTime
            self.priority = priority; self.sourceMeetingUid = sourceMeetingUid
            self.gcalEventId = gcalEventId; self.extraTags = extraTags
        }
    }

    public static func buildTodoLine(_ input: TodoLineInput) -> String {
        let check = input.deleted ? "D" : (input.cancelled ? "-" : (input.done ? "x" : " "))
        var line = "- [\(check)] \(sanitizeTaskTitle(input.title))"
        if input.dueDate != nil || input.dueTime != nil {
            line += " ---"
            if let d = input.dueDate { line += " \(d)" }
            if let t = input.dueTime { line += " \(t)" }
        }
        if input.priority != .medium {
            line += " #\(input.priority.rawValue)"
        }
        if let uid = input.sourceMeetingUid {
            line += " #\(fromTagPrefix)\(uid)"
        }
        if let g = input.gcalEventId {
            line += " #\(gcalTagPrefix)\(g)"
        }
        for tag in input.extraTags {
            if tag.hasPrefix(fromTagPrefix) || tag.hasPrefix(gcalTagPrefix) { continue }
            line += " #\(tag)"
        }
        return line
    }

    // ─── 체크박스 토글 ─────────────────────────────────────────────────────────

    static func setTaskCheckChar(_ raw: String, _ line: Int, _ char: String) throws -> String {
        var lines = raw.components(separatedBy: "\n")
        guard line >= 0 && line < lines.count else {
            throw VaultError.lineOutOfRange(line: line, total: lines.count)
        }
        guard let m = checkboxRE.firstMatch(lines[line]) else {
            throw VaultError.notACheckbox(line: line, content: lines[line])
        }
        let indent = m.group(1) ?? ""
        let body = m.group(3) ?? ""
        lines[line] = "\(indent)- [\(char)] \(body)"
        return lines.joined(separator: "\n")
    }

    public static func toggleTask(_ raw: String, line: Int, done: Bool) throws -> String {
        try setTaskCheckChar(raw, line, done ? "x" : " ")
    }

    // ─── 모델 매핑 ─────────────────────────────────────────────────────────────

    public static func task(from item: TaskItem) -> VaultTask {
        let priority = item.tags.compactMap { TaskPriority(rawValue: $0) }.first ?? .medium
        let fromTag = item.tags.first { $0.hasPrefix(fromTagPrefix) }
        let gcalTag = item.tags.first { $0.hasPrefix(gcalTagPrefix) }
        return VaultTask(
            id: "\(item.file)#L\(item.line)",
            title: item.text,
            done: item.done,
            cancelled: item.cancelled,
            deleted: item.deleted,
            priority: priority,
            dueDate: item.due,
            dueTime: item.time,
            sourceMeetingUid: fromTag.map { String($0.dropFirst(fromTagPrefix.count)) },
            gcalEventId: gcalTag.map { String($0.dropFirst(gcalTagPrefix.count)) },
            file: item.file,
            line: item.line
        )
    }

    // ─── raw 문자열 CRUD (IO 없는 순수 변환) ────────────────────────────────────

    /// 파일 끝에 새 할 일 라인 append. 데스크탑 `createTodo` 의 문자열 부분.
    public static func appendTodo(_ raw: String, _ input: TodoLineInput) -> (content: String, line: Int) {
        let line = buildTodoLine(input)
        // 끝의 연속 개행 제거 후 `\n{line}\n`
        let trimmed = trimTrailingNewlines(raw)
        let updated = "\(trimmed)\n\(line)\n"
        let lineNum = updated.components(separatedBy: "\n").count - 2
        return (updated, lineNum)
    }

    /// 특정 라인의 할 일을 patch 로 갱신해 재직렬화. 데스크탑 `updateTask` 의 문자열 부분.
    /// done 단일 patch 면 텍스트 보존 위해 토글만. 그 외엔 라인 reconstruct.
    public static func applyUpdate(_ raw: String, line: Int, patch: TaskPatch, reference: Date = Date()) throws -> String {
        if patch.isOnlyDone, let done = patch.done {
            return try toggleTask(raw, line: line, done: done)
        }
        let items = extractTasks("", raw, reference: reference)
        guard let existing = items.first(where: { $0.line == line }) else {
            throw VaultError.taskNotFound(line: line)
        }
        let existingFromTag = existing.tags.first { $0.hasPrefix(fromTagPrefix) }
        let existingGcalTag = existing.tags.first { $0.hasPrefix(gcalTagPrefix) }
        let existingPriority = existing.tags.compactMap { TaskPriority(rawValue: $0) }.first ?? .medium

        let merged = TodoLineInput(
            title: patch.title ?? existing.text,
            done: patch.done ?? existing.done,
            cancelled: patch.cancelled ?? existing.cancelled,
            deleted: patch.deleted ?? existing.deleted,
            dueDate: patch.dueDateSet ? patch.dueDate : existing.due,
            dueTime: patch.dueTimeSet ? patch.dueTime : existing.time,
            priority: patch.priority ?? existingPriority,
            sourceMeetingUid: patch.sourceMeetingUidSet
                ? patch.sourceMeetingUid
                : existingFromTag.map { String($0.dropFirst(fromTagPrefix.count)) },
            gcalEventId: patch.gcalEventIdSet
                ? patch.gcalEventId
                : existingGcalTag.map { String($0.dropFirst(gcalTagPrefix.count)) },
            // 옛 카테고리 태그·priority·from·gcal 제외한 나머지 태그 보존
            extraTags: existing.tags.filter {
                !legacyCategoryTags.contains($0)
                    && TaskPriority(rawValue: $0) == nil
                    && !$0.hasPrefix(fromTagPrefix)
                    && !$0.hasPrefix(gcalTagPrefix)
            }
        )
        var lines = raw.components(separatedBy: "\n")
        let indent = RE("^(\\s*)").firstMatch(lines[line])?.group(1) ?? ""
        lines[line] = indent + buildTodoLine(merged)
        return lines.joined(separator: "\n")
    }

    /// 특정 라인 삭제(휴지통 아님 — 완전 제거). 데스크탑 `deleteTask` 의 문자열 부분.
    public static func deleteLine(_ raw: String, line: Int) -> String {
        var lines = raw.components(separatedBy: "\n")
        guard line >= 0 && line < lines.count else { return raw }
        lines.remove(at: line)
        return lines.joined(separator: "\n")
    }

    static func trimTrailingNewlines(_ s: String) -> String {
        var end = s.endIndex
        while end > s.startIndex, s[s.index(before: end)] == "\n" {
            end = s.index(before: end)
        }
        return String(s[s.startIndex..<end])
    }
}

// patch 의 "필드 지정 안 함" vs "nil 로 지정함" 구분을 위해 *Set 플래그를 둔다
// (TS 의 `patch.x !== undefined` 동작 재현 — undefined=미지정, null=명시적 비움).
public struct TaskPatch: Sendable {
    public var title: String?
    public var done: Bool?
    public var cancelled: Bool?
    public var deleted: Bool?
    public var priority: TaskPriority?

    public var dueDate: String?
    public var dueDateSet: Bool = false
    public var dueTime: String?
    public var dueTimeSet: Bool = false
    public var sourceMeetingUid: String?
    public var sourceMeetingUidSet: Bool = false
    public var gcalEventId: String?
    public var gcalEventIdSet: Bool = false

    public init() {}

    var isOnlyDone: Bool {
        done != nil && title == nil && cancelled == nil && deleted == nil
            && priority == nil && !dueDateSet && !dueTimeSet
            && !sourceMeetingUidSet && !gcalEventIdSet
    }

    public mutating func setDueDate(_ v: String?) { dueDate = v; dueDateSet = true }
    public mutating func setDueTime(_ v: String?) { dueTime = v; dueTimeSet = true }
    public mutating func setSourceMeetingUid(_ v: String?) { sourceMeetingUid = v; sourceMeetingUidSet = true }
    public mutating func setGcalEventId(_ v: String?) { gcalEventId = v; gcalEventIdSet = true }
}

public enum VaultError: Error, Equatable {
    case lineOutOfRange(line: Int, total: Int)
    case notACheckbox(line: Int, content: String)
    case taskNotFound(line: Int)
    case eventNotFound(line: Int)
}
