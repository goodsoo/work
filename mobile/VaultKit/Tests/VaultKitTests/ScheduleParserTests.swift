import XCTest
@testable import VaultKit

// 데스크탑 src/lib/vault/schedule.test.ts 포팅 + CRUD round-trip.

final class ScheduleParserTests: XCTestCase {

    func extract(_ raw: String) -> [ScheduleEvent] {
        ScheduleParser.extractEvents("schedule.md", raw)
    }

    func testTimedSingleDay() {
        let e = extract("- 2026-06-15 14:30 팀 회의")[0]
        XCTAssertEqual(e.start, "2026-06-15")
        XCTAssertEqual(e.time, "14:30")
        XCTAssertEqual(e.text, "팀 회의")
        XCTAssertNil(e.end)
    }

    func testAllDaySingle() {
        let e = extract("- 2026-06-15 워크샵")[0]
        XCTAssertEqual(e.start, "2026-06-15")
        XCTAssertEqual(e.text, "워크샵")
        XCTAssertNil(e.time)
        XCTAssertNil(e.end)
    }

    func testRangeNoTime() {
        let e = extract("- 2026-06-15..2026-06-17 출장")[0]
        XCTAssertEqual(e.start, "2026-06-15")
        XCTAssertEqual(e.end, "2026-06-17")
        XCTAssertEqual(e.text, "출장")
        XCTAssertNil(e.time)
    }

    func testRangePlusTime() {
        let e = extract("- 2026-06-15..2026-06-17 14:30 컨퍼런스")[0]
        XCTAssertEqual(e.start, "2026-06-15")
        XCTAssertEqual(e.end, "2026-06-17")
        XCTAssertEqual(e.time, "14:30")
        XCTAssertEqual(e.text, "컨퍼런스")
    }

    func testLineNumbers() {
        let raw = "# 일정\n\n- 2026-06-15 회의\n- 2026-06-16 점심"
        let events = extract(raw)
        XCTAssertEqual(events.map { $0.line }, [2, 3])
    }

    func testNonDateBulletsAndCheckboxesExcluded() {
        let raw = "- 그냥 메모\n- [ ] 할 일 --- 2026-06-15\n- 2026-06-15 진짜 이벤트"
        let events = extract(raw)
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events[0].text, "진짜 이벤트")
    }

    func testCodeFenceIgnored() {
        let raw = "```\n- 2026-06-15 코드 안\n```\n- 2026-06-16 진짜"
        let events = extract(raw)
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events[0].start, "2026-06-16")
    }

    func testReversedRangeDemoted() {
        let e = extract("- 2026-06-17..2026-06-15 오타")[0]
        XCTAssertEqual(e.start, "2026-06-17")
        XCTAssertNil(e.end)
    }

    // ─── buildEventLine round-trip ───────────────────────────────────────────

    func testBuildRoundTrip() {
        let cases: [ScheduleParser.EventLineInput] = [
            .init(start: "2026-06-15", time: "14:30", text: "팀 회의"),
            .init(start: "2026-06-15", text: "워크샵"),
            .init(start: "2026-06-15", end: "2026-06-17", text: "출장"),
            .init(start: "2026-06-15", end: "2026-06-17", time: "14:30", text: "컨퍼런스"),
        ]
        for c in cases {
            let line = ScheduleParser.buildEventLine(c)
            let e = extract(line)[0]
            XCTAssertEqual(e.start, c.start)
            XCTAssertEqual(e.text, c.text)
            XCTAssertEqual(e.time, c.time)
            XCTAssertEqual(e.end, c.end)
        }
    }

    func testEqualRangeNoToken() {
        let line = ScheduleParser.buildEventLine(.init(start: "2026-06-15", end: "2026-06-15", text: "x"))
        XCTAssertEqual(line, "- 2026-06-15 x")
    }

    // ─── CRUD round-trip ─────────────────────────────────────────────────────

    func testAppendUpdateDelete() throws {
        let raw = "# 일정\n- 2026-06-15 회의\n"
        let (added, line) = ScheduleParser.appendEvent(raw, .init(start: "2026-06-20", time: "09:00", text: "스탠드업"))
        XCTAssertEqual(line, 2)
        var events = extract(added)
        XCTAssertEqual(events.count, 2)

        var patch = SchedulePatch()
        patch.text = "데일리 스탠드업"
        patch.setTime("09:30")
        let updated = try ScheduleParser.applyUpdate(added, line: 2, patch: patch)
        let e = extract(updated).first { $0.line == 2 }!
        XCTAssertEqual(e.text, "데일리 스탠드업")
        XCTAssertEqual(e.time, "09:30")
        XCTAssertEqual(e.start, "2026-06-20")  // 보존

        let afterDelete = ScheduleParser.deleteLine(updated, line: 1)
        events = extract(afterDelete)
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events[0].text, "데일리 스탠드업")
    }

    func testSorted() {
        let raw = "- 2026-06-16 점심\n- 2026-06-15 14:00 오후\n- 2026-06-15 종일\n"
        let sorted = ScheduleParser.sorted(extract(raw))
        // 6-15 종일(시각 없음 먼저) → 6-15 14:00 → 6-16
        XCTAssertEqual(sorted.map { $0.text }, ["종일", "오후", "점심"])
    }
}
