import XCTest
@testable import VaultKit

// 데스크탑 src/lib/vault/tasks.test.ts 포팅 + 라인 빌드/CRUD round-trip.

final class TaskParserTests: XCTestCase {

    // 연도 의존 케이스용 고정 reference (2026-06-23).
    let ref: Date = {
        var c = DateComponents()
        c.year = 2026; c.month = 6; c.day = 23
        return DateParsing.calendar.date(from: c)!
    }()

    func extract(_ raw: String, _ file: String = "inbox.md") -> [TaskItem] {
        TaskParser.extractTasks(file, raw, reference: ref)
    }

    func testBasicCheckbox() {
        let items = extract("- [ ] 단순 task\n")
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0].text, "단순 task")
        XCTAssertFalse(items[0].done)
        XCTAssertEqual(items[0].file, "inbox.md")
        XCTAssertEqual(items[0].line, 0)
    }

    func testBracketIsBody() {
        let items = extract("- [ ] [홍길동] 보고서 작성\n")
        XCTAssertEqual(items[0].text, "[홍길동] 보고서 작성")
    }

    func testMDDateCurrentYear() {
        let items = extract("- [ ] 보고서 — 5/22\n")
        XCTAssertEqual(items[0].due, "2026-05-22")
        XCTAssertEqual(items[0].text, "보고서")
    }

    func testISODate() {
        let items = extract("- [ ] 회의 — 2026-05-22\n")
        XCTAssertEqual(items[0].due, "2026-05-22")
    }

    func testTime() {
        let items = extract("- [ ] 발표 — 14:00\n")
        XCTAssertEqual(items[0].time, "14:00")
    }

    func testTripleHyphen() {
        let items = extract("- [ ] 보고서 --- 5/22 14:00\n")
        XCTAssertEqual(items[0].text, "보고서")
        XCTAssertTrue(items[0].due?.hasSuffix("-05-22") ?? false)
        XCTAssertEqual(items[0].time, "14:00")
    }

    func testBrokenSplitPreservesBody() {
        let items = extract("- [ ] 보고서 --- 망가진뒤\n")
        XCTAssertEqual(items[0].text, "보고서 --- 망가진뒤")
        XCTAssertNil(items[0].due)
        XCTAssertNil(items[0].time)
    }

    func testNaturalLanguageDate() {
        let items = extract("- [ ] 회의 --- 내일\n")
        XCTAssertEqual(items[0].text, "회의")
        XCTAssertEqual(items[0].due, "2026-06-24")
    }

    func testNaturalLanguageTime() {
        let items = extract("- [ ] 발표 --- 오후 2시\n")
        XCTAssertEqual(items[0].text, "발표")
        XCTAssertEqual(items[0].time, "14:00")
    }

    func testMDPlusKoreanTime() {
        let items = extract("- [ ] 보고서 --- 6/07 18시\n")
        XCTAssertEqual(items[0].text, "보고서")
        XCTAssertTrue(items[0].due?.hasSuffix("-06-07") ?? false)
        XCTAssertEqual(items[0].time, "18:00")
    }

    func testTags() {
        let items = extract("- [ ] 보고서 #work #urgent\n")
        XCTAssertTrue(items[0].tags.contains("work"))
        XCTAssertTrue(items[0].tags.contains("urgent"))
        XCTAssertEqual(items[0].text, "보고서")
    }

    func testDone() {
        let items = extract("- [x] 완료한 항목\n")
        XCTAssertTrue(items[0].done)
    }

    func testCancelledAndDeleted() {
        XCTAssertTrue(extract("- [-] 취소\n")[0].cancelled)
        XCTAssertTrue(extract("- [D] 삭제\n")[0].deleted)
    }

    func testCompound() {
        let items = extract("- [ ] [홍길동] 보고서 작성 — 5/22 14:00 #meeting #event\n", "notes/foo.md")
        let t = items[0]
        XCTAssertEqual(t.text, "[홍길동] 보고서 작성")
        XCTAssertTrue(t.due?.hasSuffix("-05-22") ?? false)
        XCTAssertEqual(t.time, "14:00")
        XCTAssertTrue(t.tags.contains("meeting"))
        XCTAssertTrue(t.tags.contains("event"))
    }

    func testCodeFenceIgnored() {
        let items = extract("```\n- [ ] 코드 안\n```\n- [ ] 진짜\n")
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0].text, "진짜")
    }

    func testDateRange() {
        let items = extract("- [ ] 워크샵 --- 2026-06-10..2026-06-12\n")
        XCTAssertEqual(items[0].text, "워크샵")
        XCTAssertEqual(items[0].due, "2026-06-10")
        XCTAssertEqual(items[0].end, "2026-06-12")
    }

    func testDateRangePlusTime() {
        let items = extract("- [ ] 출장 --- 2026-06-10..2026-06-12 14:00\n")
        XCTAssertEqual(items[0].text, "출장")
        XCTAssertEqual(items[0].due, "2026-06-10")
        XCTAssertEqual(items[0].end, "2026-06-12")
        XCTAssertEqual(items[0].time, "14:00")
    }

    func testSingleDateNoEnd() {
        let items = extract("- [ ] 회의 --- 2026-06-10\n")
        XCTAssertEqual(items[0].due, "2026-06-10")
        XCTAssertNil(items[0].end)
    }

    func testEqualRangeIsSingle() {
        let items = extract("- [ ] 단일 --- 2026-06-10..2026-06-10\n")
        XCTAssertEqual(items[0].due, "2026-06-10")
        XCTAssertNil(items[0].end)
    }

    func testReversedRange() {
        let items = extract("- [ ] 역전 --- 2026-06-12..2026-06-10\n")
        XCTAssertEqual(items[0].due, "2026-06-12")
        XCTAssertNil(items[0].end)
    }

    // ─── 라인 빌드 / round-trip ────────────────────────────────────────────────

    func testBuildTodoLineBasic() {
        var input = TaskParser.TodoLineInput(title: "보고서")
        input.dueDate = "2026-05-22"
        input.dueTime = "14:00"
        input.priority = .high
        let line = TaskParser.buildTodoLine(input)
        XCTAssertEqual(line, "- [ ] 보고서 --- 2026-05-22 14:00 #high")
        // round-trip
        let item = extract(line + "\n")[0]
        XCTAssertEqual(item.text, "보고서")
        XCTAssertEqual(item.due, "2026-05-22")
        XCTAssertEqual(item.time, "14:00")
        XCTAssertTrue(item.tags.contains("high"))
    }

    func testBuildPreservesFromAndGcalTags() {
        var input = TaskParser.TodoLineInput(title: "동기화 항목")
        input.sourceMeetingUid = "550e8400-e29b-41d4-a716-446655440000"
        input.gcalEventId = "abc123_x"
        let line = TaskParser.buildTodoLine(input)
        let item = extract(line + "\n")[0]
        let task = TaskParser.task(from: item)
        XCTAssertEqual(task.sourceMeetingUid, "550e8400-e29b-41d4-a716-446655440000")
        XCTAssertEqual(task.gcalEventId, "abc123_x")
    }

    func testTitleSanitizeSplitChars() {
        // 제목에 split 구분자가 있으면 `--` 로 강등 → round-trip 시 본문 보존
        let input = TaskParser.TodoLineInput(title: "A — B --- C")
        let line = TaskParser.buildTodoLine(input)
        XCTAssertFalse(line.contains(" — "))
        XCTAssertFalse(line.contains(" --- "))
        let item = extract(line + "\n")[0]
        XCTAssertEqual(item.text, "A -- B -- C")
        XCTAssertNil(item.due)
    }

    func testToggleDonePreservesText() throws {
        let raw = "- [ ] 보고서 --- 2026-05-22 #high\n"
        let updated = try TaskParser.toggleTask(raw, line: 0, done: true)
        XCTAssertTrue(updated.contains("- [x] 보고서 --- 2026-05-22 #high"))
        let item = extract(updated)[0]
        XCTAssertTrue(item.done)
        XCTAssertEqual(item.due, "2026-05-22")
    }

    func testApplyUpdateReconstructsAndPreservesExtraTags() throws {
        let raw = "- [ ] 보고서 --- 2026-05-22 #high #프로젝트A #from-uid1\n"
        var patch = TaskPatch()
        patch.title = "보고서 v2"
        patch.priority = .low
        let updated = try TaskParser.applyUpdate(raw, line: 0, patch: patch, reference: ref)
        let item = extract(updated)[0]
        XCTAssertEqual(item.text, "보고서 v2")
        XCTAssertEqual(item.due, "2026-05-22")           // 보존
        XCTAssertTrue(item.tags.contains("low"))          // 갱신
        XCTAssertTrue(item.tags.contains("프로젝트A"))     // 보존
        XCTAssertTrue(item.tags.contains("from-uid1"))    // 보존
    }

    func testAppendAndDeleteLine() {
        let raw = "# 미분류\n- [ ] 기존\n"
        let (added, line) = TaskParser.appendTodo(raw, TaskParser.TodoLineInput(title: "새 할 일"))
        XCTAssertEqual(line, 2)
        let items = extract(added)
        XCTAssertEqual(items.count, 2)
        XCTAssertEqual(items[1].text, "새 할 일")
        // 삭제
        let afterDelete = TaskParser.deleteLine(added, line: 1)
        let remaining = extract(afterDelete)
        XCTAssertEqual(remaining.count, 1)
        XCTAssertEqual(remaining[0].text, "새 할 일")
    }
}
