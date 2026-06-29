import Foundation
import VaultKit

// 읽기 전용 메모 파일 (notes/ 폴더). 본문은 열 때 lazy load.
struct NoteFile: Identifiable, Hashable {
    var id: String { path }   // vault 상대 경로
    var path: String
    var title: String         // 파일명에서 .md 제거 = 노트 제목 (Title-as-Filename)
    var modified: Date
}

// 한국어 날짜/시각 표시 (데스크탑 voice/tone 정책: 12시간 시각, 연도 생략 규칙).
enum Display {
    private static let weekdayFmt: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "EEE"
        return f
    }()

    /// "MM.dd(요일)" — 올해가 아니면 "yyyy.MM.dd(요일)". 데스크탑 formatDisplayDate.
    static func date(_ iso: String?, reference: Date = Date()) -> String {
        guard let iso, let d = DateParsing.isoToDate(iso) else { return "" }
        let cal = DateParsing.calendar
        let weekday = weekdayFmt.string(from: d)
        let comps = cal.dateComponents([.year, .month, .day], from: d)
        let refYear = cal.component(.year, from: reference)
        let mm = String(comps.month!).padding2()
        let dd = String(comps.day!).padding2()
        if comps.year == refYear {
            return "\(mm).\(dd)(\(weekday))"
        }
        return "\(comps.year!).\(mm).\(dd)(\(weekday))"
    }

    /// 오늘/어제/내일/N일 후/N일 전/"M.d". 데스크탑 relativeDateLabel.
    static func relative(_ iso: String, reference: Date = Date()) -> String {
        guard let target = DateParsing.isoToDate(iso) else { return "" }
        let cal = DateParsing.calendar
        let refMid = cal.startOfDay(for: reference)
        let diff = cal.dateComponents([.day], from: refMid, to: cal.startOfDay(for: target)).day ?? 0
        switch diff {
        case 0: return "오늘"
        case -1: return "어제"
        case 1: return "내일"
        case 2...6: return "\(diff)일 후"
        case -6 ..< -1: return "\(-diff)일 전"
        default:
            let c = cal.dateComponents([.month, .day], from: target)
            return "\(c.month!).\(c.day!)"
        }
    }

    /// "오전·오후 h:mm" 12시간. nil 이면 빈 문자열. 데스크탑 시간 형식 정책.
    static func time(_ hhmm: String?) -> String {
        guard let hhmm, let colon = hhmm.firstIndex(of: ":"),
              let h = Int(hhmm[hhmm.startIndex..<colon]),
              let m = Int(hhmm[hhmm.index(after: colon)...]) else { return "" }
        let ampm = h < 12 ? "오전" : "오후"
        var h12 = h % 12
        if h12 == 0 { h12 = 12 }
        return "\(ampm) \(h12):\(String(m).padding2())"
    }

    /// 다일 일정 표시 범위. 단일이면 시작일만.
    static func dateRange(start: String, end: String?, reference: Date = Date()) -> String {
        let s = date(start, reference: reference)
        guard let end else { return s }
        return "\(s) ~ \(date(end, reference: reference))"
    }

    // ─── 에디터용 변환 (Date ↔ vault 문자열) ────────────────────────────────────

    private static let hhmmFmt: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "HH:mm"
        return f
    }()

    /// Date → "yyyy-MM-dd" (로컬). vault 저장용.
    static func iso(from date: Date) -> String { DateParsing.todayIso(date) }

    /// Date → "HH:mm" (로컬). vault 저장용.
    static func hhmm(from date: Date) -> String { hhmmFmt.string(from: date) }

    /// "yyyy-MM-dd" → Date (자정). 에디터 DatePicker 초기값용.
    static func parseISO(_ iso: String?) -> Date? {
        guard let iso else { return nil }
        return DateParsing.isoToDate(iso)
    }

    /// "HH:mm" → 오늘 날짜의 그 시각 Date. 에디터 초기값용.
    static func parseHHMM(_ hhmm: String?) -> Date? {
        guard let hhmm else { return nil }
        return hhmmFmt.date(from: hhmm).map { t in
            let cal = DateParsing.calendar
            let now = cal.dateComponents([.year, .month, .day], from: Date())
            let tc = cal.dateComponents([.hour, .minute], from: t)
            var c = DateComponents()
            c.year = now.year; c.month = now.month; c.day = now.day
            c.hour = tc.hour; c.minute = tc.minute
            return cal.date(from: c) ?? t
        }
    }
}

extension TaskPriority {
    var label: String {
        switch self {
        case .high: return "높음"
        case .medium: return "보통"
        case .low: return "낮음"
        }
    }
}

private extension String {
    func padding2() -> String { count >= 2 ? self : "0" + self }
}
