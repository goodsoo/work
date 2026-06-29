import XCTest
@testable import VaultKit

// 데스크탑 src/lib/dates.test.ts 중 VaultKit 이 포팅한 함수(parseLooseDate/Time,
// todayIso, addDaysIso) 케이스 포팅.

final class DateParsingTests: XCTestCase {

    // 2026-05-06T12:00:00 local (= 수요일)
    let ref: Date = {
        var c = DateComponents()
        c.year = 2026; c.month = 5; c.day = 6; c.hour = 12
        return DateParsing.calendar.date(from: c)!
    }()

    func testTodayIso() {
        XCTAssertEqual(DateParsing.todayIso(ref), "2026-05-06")
    }

    func testAddDaysIso() {
        XCTAssertEqual(DateParsing.addDaysIso("2026-05-06", 1), "2026-05-07")
        XCTAssertEqual(DateParsing.addDaysIso("2026-05-06", -1), "2026-05-05")
        XCTAssertEqual(DateParsing.addDaysIso("2026-05-31", 1), "2026-06-01")
    }

    func testNaturalLanguage() {
        XCTAssertEqual(DateParsing.parseLooseDate("오늘", reference: ref), "2026-05-06")
        XCTAssertEqual(DateParsing.parseLooseDate("내일", reference: ref), "2026-05-07")
        XCTAssertEqual(DateParsing.parseLooseDate("어제", reference: ref), "2026-05-05")
        XCTAssertEqual(DateParsing.parseLooseDate("모레", reference: ref), "2026-05-08")
        XCTAssertEqual(DateParsing.parseLooseDate("그제", reference: ref), "2026-05-04")
    }

    func testWeekdayShortcut() {
        XCTAssertEqual(DateParsing.parseLooseDate("수", reference: ref), "2026-05-06") // 오늘
        XCTAssertEqual(DateParsing.parseLooseDate("목", reference: ref), "2026-05-07")
        XCTAssertEqual(DateParsing.parseLooseDate("화", reference: ref), "2026-05-12") // 다음주 화
        XCTAssertEqual(DateParsing.parseLooseDate("수요일", reference: ref), "2026-05-06")
        XCTAssertEqual(DateParsing.parseLooseDate("화요일", reference: ref), "2026-05-12")
    }

    func testSeparators() {
        XCTAssertEqual(DateParsing.parseLooseDate("5/19", reference: ref), "2026-05-19")
        XCTAssertEqual(DateParsing.parseLooseDate("5.19", reference: ref), "2026-05-19")
        XCTAssertEqual(DateParsing.parseLooseDate("5-19", reference: ref), "2026-05-19")
        XCTAssertEqual(DateParsing.parseLooseDate("5 19", reference: ref), "2026-05-19")
        XCTAssertEqual(DateParsing.parseLooseDate("5월 19일", reference: ref), "2026-05-19")
    }

    func testFullYearAndCompact() {
        XCTAssertEqual(DateParsing.parseLooseDate("2027/3/4", reference: ref), "2027-03-04")
        XCTAssertEqual(DateParsing.parseLooseDate("2026.05.19", reference: ref), "2026-05-19")
        XCTAssertEqual(DateParsing.parseLooseDate("2026년 5월 19일", reference: ref), "2026-05-19")
        XCTAssertEqual(DateParsing.parseLooseDate("20260519", reference: ref), "2026-05-19")
        XCTAssertEqual(DateParsing.parseLooseDate("260519", reference: ref), "2026-05-19")
    }

    func testInvalidDate() {
        XCTAssertNil(DateParsing.parseLooseDate("13/40", reference: ref))
        XCTAssertNil(DateParsing.parseLooseDate("2/30", reference: ref))
        XCTAssertNil(DateParsing.parseLooseDate("", reference: ref))
        XCTAssertNil(DateParsing.parseLooseDate("아무말", reference: ref))
    }

    func testBefore2026() {
        XCTAssertEqual(DateParsing.parseLooseDate("2025-12-31", reference: ref), "2025-12-31")
        XCTAssertEqual(DateParsing.parseLooseDate("2025.12.31", reference: ref), "2025-12-31")
        XCTAssertEqual(DateParsing.parseLooseDate("251231", reference: ref), "2025-12-31")
        XCTAssertEqual(DateParsing.parseLooseDate("2026-01-01", reference: ref), "2026-01-01")
    }

    func testParseTime() {
        XCTAssertEqual(DateParsing.parseLooseTime("14:30"), "14:30")
        XCTAssertEqual(DateParsing.parseLooseTime("2:30"), "02:30")
        XCTAssertEqual(DateParsing.parseLooseTime("14시 30분"), "14:30")
        XCTAssertEqual(DateParsing.parseLooseTime("14시"), "14:00")
        XCTAssertEqual(DateParsing.parseLooseTime("오후 2시"), "14:00")
        XCTAssertEqual(DateParsing.parseLooseTime("오후 2시 30분"), "14:30")
        XCTAssertEqual(DateParsing.parseLooseTime("오전 9시"), "09:00")
        XCTAssertEqual(DateParsing.parseLooseTime("오전 12시"), "00:00")
        XCTAssertEqual(DateParsing.parseLooseTime("오후 12시"), "12:00")
        XCTAssertEqual(DateParsing.parseLooseTime("2pm"), "14:00")
        XCTAssertEqual(DateParsing.parseLooseTime("2:30 PM"), "14:30")
        XCTAssertEqual(DateParsing.parseLooseTime("11am"), "11:00")
        XCTAssertEqual(DateParsing.parseLooseTime("1430"), "14:30")
        XCTAssertEqual(DateParsing.parseLooseTime("930"), "09:30")
    }

    func testInvalidTime() {
        XCTAssertNil(DateParsing.parseLooseTime("25:00"))
        XCTAssertNil(DateParsing.parseLooseTime("14:99"))
        XCTAssertNil(DateParsing.parseLooseTime(""))
        XCTAssertNil(DateParsing.parseLooseTime("아침"))
    }
}
