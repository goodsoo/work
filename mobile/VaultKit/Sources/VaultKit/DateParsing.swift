import Foundation

// 데스크탑 `src/lib/dates.ts` 의 느슨한 날짜/시각 파서 포팅.
// 시스템이 vault 에 쓰는 라인은 항상 ISO 날짜 + HH:mm 라 정규식이 직접 잡지만,
// 외부 에디터에서 사람이 자연어("내일", "오후 2시")로 적은 경우를 흡수하기 위한
// fallback. 포팅 충실도를 위해 동작을 1:1 로 옮긴다.

public enum DateParsing {

    /// 로컬 그레고리력 (TS `new Date(...)` 의 로컬 타임존 동작 대응).
    public static let calendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone.current
        return c
    }()

    /// "yyyy-MM-dd" (로컬). TS `todayIso`.
    public static func todayIso(_ now: Date = Date()) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: now)
        return "\(String(c.year!).padLeft(4))-\(String(c.month!).padLeft(2))-\(String(c.day!).padLeft(2))"
    }

    /// ISO 날짜에 days 더해 새 ISO. TS `addDaysIso`.
    public static func addDaysIso(_ iso: String, _ days: Int) -> String {
        guard let base = isoToDate(iso),
              let next = calendar.date(byAdding: .day, value: days, to: base) else { return iso }
        return todayIso(next)
    }

    /// ISO(yyyy-MM-dd) → 자정 Date. 유효하지 않으면 nil.
    public static func isoToDate(_ iso: String) -> Date? {
        let m = isoDateAnchoredRE.firstMatch(iso)
        guard let m,
              let y = m.group(1).flatMap({ Int($0) }),
              let mo = m.group(2).flatMap({ Int($0) }),
              let d = m.group(3).flatMap({ Int($0) }) else { return nil }
        var c = DateComponents()
        c.year = y; c.month = mo; c.day = d
        return calendar.date(from: c)
    }

    private static let isoDateAnchoredRE = RE("^(\\d{4})-(\\d{2})-(\\d{2})$")

    // ─── parseLooseDate ──────────────────────────────────────────────────────

    private static let weekdays = ["일", "월", "화", "수", "목", "금", "토"]
    private static let compact8RE = RE("^\\d{8}$")
    private static let compact6RE = RE("^\\d{6}$")
    private static let fullWeekdayRE = RE("^[일월화수목금토]요일$")
    private static let yearMonthDaySplitRE = RE("[\\s/.\\-]+")

    /// 느슨한 날짜 파서 → ISO(yyyy-MM-dd) 또는 nil. TS `parseLooseDate`.
    public static func parseLooseDate(_ raw: String, reference: Date = Date()) -> String? {
        let s = raw.trimmingCharacters(in: .whitespaces)
        if s.isEmpty { return nil }

        let refIso = todayIso(reference)
        let lower = s.lowercased()
        if s == "오늘" || lower == "today" { return refIso }
        if s == "내일" || lower == "tomorrow" { return addDaysIso(refIso, 1) }
        if s == "어제" || lower == "yesterday" { return addDaysIso(refIso, -1) }
        if s == "모레" { return addDaysIso(refIso, 2) }
        if s == "그제" || s == "그저께" { return addDaysIso(refIso, -2) }

        // 요일 단축 — 오늘 포함 가장 가까운 미래의 해당 요일.
        let todayIdx = calendar.component(.weekday, from: reference) - 1 // 1=Sun → 0
        if let wIdx = weekdays.firstIndex(of: s) {
            let diff = (wIdx - todayIdx + 7) % 7
            return addDaysIso(refIso, diff)
        }
        if fullWeekdayRE.matches(s) {
            let first = String(s.first!)
            if let wIdx2 = weekdays.firstIndex(of: first) {
                let diff = (wIdx2 - todayIdx + 7) % 7
                return addDaysIso(refIso, diff)
            }
        }

        // 압축 yyyymmdd / yymmdd
        if compact8RE.matches(s) {
            let chars = Array(s)
            let y = Int(String(chars[0..<4]))!
            let mo = Int(String(chars[4..<6]))!
            let d = Int(String(chars[6..<8]))!
            return composeIso(y, mo, d)
        }
        if compact6RE.matches(s) {
            let chars = Array(s)
            let yy = Int(String(chars[0..<2]))!
            let mo = Int(String(chars[2..<4]))!
            let d = Int(String(chars[4..<6]))!
            return composeIso(2000 + yy, mo, d)
        }

        // 한글 단위 또는 일반 구분자
        let normalized = s
            .replacingOccurrences(of: "년", with: " ")
            .replacingOccurrences(of: "월", with: " ")
            .replacingOccurrences(of: "일", with: " ")
        let parts = yearMonthDaySplitRE
            .replaceAll(normalized) { _, _ in "\u{1}" } // 구분자 → 센티넬
            .split(separator: "\u{1}")
            .map(String.init)
            .filter { !$0.isEmpty }

        let refYear = calendar.component(.year, from: reference)
        if parts.count == 2 {
            guard let mo = Int(parts[0]), let d = Int(parts[1]) else { return nil }
            return composeIso(refYear, mo, d)
        }
        if parts.count == 3 {
            guard let a = Int(parts[0]), let b = Int(parts[1]), let c = Int(parts[2]) else { return nil }
            let yearFirst = parts[0].count == 4 || a >= 32
            let year = yearFirst ? (a < 100 ? 2000 + a : a) : (c < 100 ? 2000 + c : c)
            let month = yearFirst ? b : a
            let day = yearFirst ? c : b
            return composeIso(year, month, day)
        }
        return nil
    }

    /// (year, month, day) → ISO. 범위/실재(2/30 등) 검증 실패 시 nil. TS `composeIso`.
    public static func composeIso(_ year: Int, _ month: Int, _ day: Int) -> String? {
        if month < 1 || month > 12 { return nil }
        if day < 1 || day > 31 { return nil }
        var c = DateComponents()
        c.year = year; c.month = month; c.day = day
        guard let probe = calendar.date(from: c) else { return nil }
        let back = calendar.dateComponents([.year, .month, .day], from: probe)
        if back.year != year || back.month != month || back.day != day { return nil }
        return "\(String(year).padLeft(4))-\(String(month).padLeft(2))-\(String(day).padLeft(2))"
    }

    // ─── parseLooseTime ──────────────────────────────────────────────────────

    private static let nowRE = RE("^(지금|현재|now)$", [.caseInsensitive])
    private static let pmRE = RE("오후|pm", [.caseInsensitive])
    private static let amRE = RE("오전|am", [.caseInsensitive])
    private static let stripMeridiemRE = RE("오전|오후|am|pm|a\\.m\\.|p\\.m\\.", [.caseInsensitive])
    private static let hhmmColonRE = RE("^\\d{1,2}:\\d{1,2}$")
    private static let compactTimeRE = RE("^\\d{3,4}$")
    private static let wsRE = RE("\\s+")

    /// 느슨한 시각 파서 → "HH:mm" 또는 nil. TS `parseLooseTime`.
    public static func parseLooseTime(_ raw: String) -> String? {
        let s = raw.trimmingCharacters(in: .whitespaces)
        if s.isEmpty { return nil }

        if nowRE.matches(s) {
            let c = calendar.dateComponents([.hour, .minute], from: Date())
            return "\(String(c.hour!).padLeft(2)):\(String(c.minute!).padLeft(2))"
        }

        var amPm: String? = nil
        if pmRE.matches(s) { amPm = "pm" }
        else if amRE.matches(s) { amPm = "am" }

        var body = stripMeridiemRE.replaceAll(s) { _, _ in " " }
        body = body.replacingOccurrences(of: "시", with: " ")
        body = body.replacingOccurrences(of: "분", with: " ")
        body = body.trimmingCharacters(in: .whitespaces)

        var hour: Int
        var minute = 0

        if hhmmColonRE.matches(body) {
            let comps = body.split(separator: ":").map(String.init)
            guard let h = Int(comps[0]), let m = Int(comps[1]) else { return nil }
            hour = h; minute = m
        } else if compactTimeRE.matches(body) {
            let chars = Array(body)
            if chars.count == 3 {
                hour = Int(String(chars[0..<1]))!
                minute = Int(String(chars[1...]))!
            } else {
                hour = Int(String(chars[0..<2]))!
                minute = Int(String(chars[2...]))!
            }
        } else {
            let parts = wsRE.replaceAll(body) { _, _ in "\u{1}" }
                .split(separator: "\u{1}").map(String.init).filter { !$0.isEmpty }
            if parts.count == 1 {
                guard let h = Int(parts[0]) else { return nil }
                hour = h
            } else if parts.count == 2 {
                guard let h = Int(parts[0]), let m = Int(parts[1]) else { return nil }
                hour = h; minute = m
            } else {
                return nil
            }
        }

        if amPm == "pm" && hour < 12 { hour += 12 }
        if amPm == "am" && hour == 12 { hour = 0 }
        if hour < 0 || hour > 23 { return nil }
        if minute < 0 || minute > 59 { return nil }
        return "\(String(hour).padLeft(2)):\(String(minute).padLeft(2))"
    }
}
