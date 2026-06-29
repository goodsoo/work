import Foundation
import VaultKit

// XCTest/Xcode 없이 CLT 에서 파서 호환을 검증하는 경량 러너.
// 데스크탑 vitest 케이스를 그대로 옮겼다. 실패 시 비-0 종료.

nonisolated(unsafe) var failures = 0
nonisolated(unsafe) var checks = 0

func check(_ cond: Bool, _ msg: String, file: StaticString = #file, line: UInt = #line) {
    checks += 1
    if !cond {
        failures += 1
        print("  ✗ FAIL: \(msg)  (\(line))")
    }
}

func eq<T: Equatable>(_ a: T, _ b: T, _ msg: String, line: UInt = #line) {
    checks += 1
    if a != b {
        failures += 1
        print("  ✗ FAIL: \(msg) — got \(a), expected \(b)  (\(line))")
    }
}

func section(_ name: String) { print("• \(name)") }

// 고정 reference 날짜
func date(_ y: Int, _ m: Int, _ d: Int, _ h: Int = 12) -> Date {
    var c = DateComponents(); c.year = y; c.month = m; c.day = d; c.hour = h
    return DateParsing.calendar.date(from: c)!
}
let refTask = date(2026, 6, 23)
let refDate = date(2026, 5, 6)

func tasks(_ raw: String, _ f: String = "inbox.md") -> [TaskItem] {
    TaskParser.extractTasks(f, raw, reference: refTask)
}
func events(_ raw: String) -> [ScheduleEvent] {
    ScheduleParser.extractEvents("schedule.md", raw)
}

// ─── Task 파서 ─────────────────────────────────────────────────────────────
section("TaskParser.extractTasks")
do {
    let i = tasks("- [ ] 단순 task\n")
    eq(i.count, 1, "기본 체크박스 개수")
    eq(i[0].text, "단순 task", "기본 본문")
    eq(i[0].done, false, "기본 done")
    eq(i[0].line, 0, "라인 0-based")
}
eq(tasks("- [ ] [홍길동] 보고서 작성\n")[0].text, "[홍길동] 보고서 작성", "bracket 는 본문")
eq(tasks("- [ ] 보고서 — 5/22\n")[0].due, "2026-05-22", "M/D → 현재연도 due")
eq(tasks("- [ ] 보고서 — 5/22\n")[0].text, "보고서", "M/D split 후 본문")
eq(tasks("- [ ] 회의 — 2026-05-22\n")[0].due, "2026-05-22", "ISO due")
eq(tasks("- [ ] 발표 — 14:00\n")[0].time, "14:00", "HH:MM time")
do {
    let t = tasks("- [ ] 보고서 --- 5/22 14:00\n")[0]
    eq(t.text, "보고서", "--- 본문")
    check(t.due?.hasSuffix("-05-22") ?? false, "--- due")
    eq(t.time, "14:00", "--- time")
}
do {
    let t = tasks("- [ ] 보고서 --- 망가진뒤\n")[0]
    eq(t.text, "보고서 --- 망가진뒤", "split 실패 시 본문 보존")
    check(t.due == nil && t.time == nil, "split 실패 시 due/time 없음")
}
do {
    let t = tasks("- [ ] 회의 --- 내일\n")[0]
    eq(t.text, "회의", "자연어 날짜 후 본문")
    eq(t.due, "2026-06-24", "자연어 '내일' due")
}
eq(tasks("- [ ] 발표 --- 오후 2시\n")[0].time, "14:00", "자연어 '오후 2시'")
do {
    let t = tasks("- [ ] 보고서 --- 6/07 18시\n")[0]
    eq(t.text, "보고서", "M/D + 한글시간 본문")
    check(t.due?.hasSuffix("-06-07") ?? false, "M/D + 한글시간 due")
    eq(t.time, "18:00", "M/D + 한글시간 time (date-like false positive 차단)")
}
do {
    let t = tasks("- [ ] 보고서 #work #urgent\n")[0]
    check(t.tags.contains("work") && t.tags.contains("urgent"), "다중 태그")
    eq(t.text, "보고서", "태그 제거 후 본문")
}
eq(tasks("- [x] 완료\n")[0].done, true, "[x] done")
eq(tasks("- [-] 취소\n")[0].cancelled, true, "[-] cancelled")
eq(tasks("- [D] 삭제\n")[0].deleted, true, "[D] deleted")
do {
    let t = tasks("- [ ] [홍길동] 보고서 작성 — 5/22 14:00 #meeting #event\n", "notes/foo.md")[0]
    eq(t.text, "[홍길동] 보고서 작성", "복합 본문")
    check(t.due?.hasSuffix("-05-22") ?? false, "복합 due")
    eq(t.time, "14:00", "복합 time")
    check(t.tags.contains("meeting") && t.tags.contains("event"), "복합 태그")
}
do {
    let i = tasks("```\n- [ ] 코드 안\n```\n- [ ] 진짜\n")
    eq(i.count, 1, "코드펜스 내 무시 개수")
    eq(i[0].text, "진짜", "코드펜스 밖만")
}
do {
    let t = tasks("- [ ] 워크샵 --- 2026-06-10..2026-06-12\n")[0]
    eq(t.due, "2026-06-10", "범위 시작")
    eq(t.end, "2026-06-12", "범위 종료")
}
do {
    let t = tasks("- [ ] 출장 --- 2026-06-10..2026-06-12 14:00\n")[0]
    eq(t.due, "2026-06-10", "범위+시각 시작")
    eq(t.end, "2026-06-12", "범위+시각 종료")
    eq(t.time, "14:00", "범위+시각 time")
}
check(tasks("- [ ] 회의 --- 2026-06-10\n")[0].end == nil, "단일 날짜 end 없음")
check(tasks("- [ ] 단일 --- 2026-06-10..2026-06-10\n")[0].end == nil, "동일 범위 단일 취급")
do {
    let t = tasks("- [ ] 역전 --- 2026-06-12..2026-06-10\n")[0]
    eq(t.due, "2026-06-12", "역전 범위 start 유지")
    check(t.end == nil, "역전 범위 end 없음")
}

// ─── Task 빌드/CRUD round-trip ─────────────────────────────────────────────
section("TaskParser build / CRUD")
do {
    var input = TaskParser.TodoLineInput(title: "보고서")
    input.dueDate = "2026-05-22"; input.dueTime = "14:00"; input.priority = .high
    let line = TaskParser.buildTodoLine(input)
    eq(line, "- [ ] 보고서 --- 2026-05-22 14:00 #high", "buildTodoLine 직렬화")
    let t = tasks(line + "\n")[0]
    eq(t.due, "2026-05-22", "round-trip due")
    eq(t.time, "14:00", "round-trip time")
    check(t.tags.contains("high"), "round-trip priority tag")
}
do {
    var input = TaskParser.TodoLineInput(title: "동기화")
    input.sourceMeetingUid = "550e8400-e29b-41d4-a716-446655440000"
    input.gcalEventId = "abc123_x"
    let t = TaskParser.task(from: tasks(TaskParser.buildTodoLine(input) + "\n")[0])
    eq(t.sourceMeetingUid, "550e8400-e29b-41d4-a716-446655440000", "from- 태그 round-trip")
    eq(t.gcalEventId, "abc123_x", "gcal- 태그 round-trip")
}
do {
    let line = TaskParser.buildTodoLine(TaskParser.TodoLineInput(title: "A — B --- C"))
    check(!line.contains(" — ") && !line.contains(" --- "), "제목 split 구분자 강등")
    let t = tasks(line + "\n")[0]
    eq(t.text, "A -- B -- C", "강등된 제목 본문 보존")
    check(t.due == nil, "강등 제목 due 없음")
}
do {
    let raw = "- [ ] 보고서 --- 2026-05-22 #high\n"
    let updated = try! TaskParser.toggleTask(raw, line: 0, done: true)
    check(updated.contains("- [x] 보고서 --- 2026-05-22 #high"), "toggle done 텍스트 보존")
}
do {
    let raw = "- [ ] 보고서 --- 2026-05-22 #high #프로젝트A #from-uid1\n"
    var patch = TaskPatch(); patch.title = "보고서 v2"; patch.priority = .low
    let updated = try! TaskParser.applyUpdate(raw, line: 0, patch: patch, reference: refTask)
    let t = tasks(updated)[0]
    eq(t.text, "보고서 v2", "update 제목")
    eq(t.due, "2026-05-22", "update 후 due 보존")
    check(t.tags.contains("low"), "update priority 갱신")
    check(t.tags.contains("프로젝트A"), "update 후 사용자 태그 보존")
    check(t.tags.contains("from-uid1"), "update 후 from- 태그 보존")
}
do {
    let raw = "# 미분류\n- [ ] 기존\n"
    let (added, ln) = TaskParser.appendTodo(raw, TaskParser.TodoLineInput(title: "새 할 일"))
    eq(ln, 2, "append 라인번호")
    eq(tasks(added).count, 2, "append 후 개수")
    let afterDelete = TaskParser.deleteLine(added, line: 1)
    let rem = tasks(afterDelete)
    eq(rem.count, 1, "delete 후 개수")
    eq(rem[0].text, "새 할 일", "delete 후 올바른 항목 남음")
}

// ─── Schedule 파서 ─────────────────────────────────────────────────────────
section("ScheduleParser.extractEvents")
do {
    let e = events("- 2026-06-15 14:30 팀 회의")[0]
    eq(e.start, "2026-06-15", "단일 timed start")
    eq(e.time, "14:30", "단일 timed time")
    eq(e.text, "팀 회의", "단일 timed text")
    check(e.end == nil, "단일 timed end 없음")
}
do {
    let e = events("- 2026-06-15 워크샵")[0]
    check(e.time == nil && e.end == nil, "종일 단일 time/end 없음")
    eq(e.text, "워크샵", "종일 단일 text")
}
do {
    let e = events("- 2026-06-15..2026-06-17 출장")[0]
    eq(e.end, "2026-06-17", "범위 end")
    eq(e.text, "출장", "범위 text")
    check(e.time == nil, "범위 time 없음")
}
do {
    let e = events("- 2026-06-15..2026-06-17 14:30 컨퍼런스")[0]
    eq(e.end, "2026-06-17", "범위+시각 end")
    eq(e.time, "14:30", "범위+시각 time")
    eq(e.text, "컨퍼런스", "범위+시각 text")
}
eq(events("# 일정\n\n- 2026-06-15 회의\n- 2026-06-16 점심").map { $0.line }, [2, 3], "line 0-based")
do {
    let e = events("- 그냥 메모\n- [ ] 할 일 --- 2026-06-15\n- 2026-06-15 진짜 이벤트")
    eq(e.count, 1, "날짜-시작 아닌 불릿·체크박스 제외 개수")
    eq(e[0].text, "진짜 이벤트", "이벤트만")
}
do {
    let e = events("```\n- 2026-06-15 코드 안\n```\n- 2026-06-16 진짜")
    eq(e.count, 1, "코드펜스 제외 개수")
    eq(e[0].start, "2026-06-16", "코드펜스 밖만")
}
do {
    let e = events("- 2026-06-17..2026-06-15 오타")[0]
    eq(e.start, "2026-06-17", "역전 범위 start")
    check(e.end == nil, "역전 범위 end 강등")
}

// ─── Schedule build round-trip + CRUD ──────────────────────────────────────
section("ScheduleParser build / CRUD")
do {
    let cs: [ScheduleParser.EventLineInput] = [
        .init(start: "2026-06-15", time: "14:30", text: "팀 회의"),
        .init(start: "2026-06-15", text: "워크샵"),
        .init(start: "2026-06-15", end: "2026-06-17", text: "출장"),
        .init(start: "2026-06-15", end: "2026-06-17", time: "14:30", text: "컨퍼런스"),
    ]
    for c in cs {
        let e = events(ScheduleParser.buildEventLine(c))[0]
        eq(e.start, c.start, "round-trip start (\(c.text))")
        eq(e.text, c.text, "round-trip text (\(c.text))")
        eq(e.time, c.time, "round-trip time (\(c.text))")
        eq(e.end, c.end, "round-trip end (\(c.text))")
    }
}
eq(ScheduleParser.buildEventLine(.init(start: "2026-06-15", end: "2026-06-15", text: "x")),
   "- 2026-06-15 x", "동일 범위 토큰 안 박음")
do {
    let raw = "# 일정\n- 2026-06-15 회의\n"
    let (added, ln) = ScheduleParser.appendEvent(raw, .init(start: "2026-06-20", time: "09:00", text: "스탠드업"))
    eq(ln, 2, "event append 라인번호")
    var patch = SchedulePatch(); patch.text = "데일리 스탠드업"; patch.setTime("09:30")
    let updated = try! ScheduleParser.applyUpdate(added, line: 2, patch: patch)
    let e = events(updated).first { $0.line == 2 }!
    eq(e.text, "데일리 스탠드업", "event update text")
    eq(e.time, "09:30", "event update time")
    eq(e.start, "2026-06-20", "event update 후 start 보존")
    let afterDelete = ScheduleParser.deleteLine(updated, line: 1)
    eq(events(afterDelete).count, 1, "event delete 후 개수")
}
do {
    let raw = "- 2026-06-16 점심\n- 2026-06-15 14:00 오후\n- 2026-06-15 종일\n"
    eq(ScheduleParser.sorted(events(raw)).map { $0.text }, ["종일", "오후", "점심"], "정렬: 종일 먼저→시각→날짜")
}

// ─── 날짜 파서 ─────────────────────────────────────────────────────────────
section("DateParsing")
eq(DateParsing.todayIso(refDate), "2026-05-06", "todayIso")
eq(DateParsing.addDaysIso("2026-05-31", 1), "2026-06-01", "addDaysIso 월 넘김")
eq(DateParsing.parseLooseDate("내일", reference: refDate), "2026-05-07", "내일")
eq(DateParsing.parseLooseDate("모레", reference: refDate), "2026-05-08", "모레")
eq(DateParsing.parseLooseDate("화", reference: refDate), "2026-05-12", "요일 단축 다음주")
eq(DateParsing.parseLooseDate("5월 19일", reference: refDate), "2026-05-19", "한글 단위")
eq(DateParsing.parseLooseDate("20260519", reference: refDate), "2026-05-19", "압축 8자리")
eq(DateParsing.parseLooseDate("260519", reference: refDate), "2026-05-19", "압축 6자리")
eq(DateParsing.parseLooseDate("251231", reference: refDate), "2025-12-31", "2026 이전")
check(DateParsing.parseLooseDate("2/30", reference: refDate) == nil, "2/30 무효")
check(DateParsing.parseLooseDate("아무말", reference: refDate) == nil, "비날짜 nil")
eq(DateParsing.parseLooseTime("오후 2시 30분"), "14:30", "오후 2시 30분")
eq(DateParsing.parseLooseTime("오전 12시"), "00:00", "오전 12시")
eq(DateParsing.parseLooseTime("오후 12시"), "12:00", "오후 12시")
eq(DateParsing.parseLooseTime("2:30 PM"), "14:30", "PM")
eq(DateParsing.parseLooseTime("930"), "09:30", "압축 3자리")
check(DateParsing.parseLooseTime("25:00") == nil, "25:00 무효")
check(DateParsing.parseLooseTime("아침") == nil, "비시각 nil")

// ─── 결과 ──────────────────────────────────────────────────────────────────
print("")
if failures == 0 {
    print("✅ 전체 통과: \(checks) checks")
    exit(0)
} else {
    print("❌ \(failures)/\(checks) 실패")
    exit(1)
}
