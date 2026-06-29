import SwiftUI
import VaultKit

func priorityColor(_ p: TaskPriority) -> Color {
    switch p {
    case .high: return .red
    case .medium: return .secondary
    case .low: return .gray
    }
}

// 할 일 한 줄 — 체크박스 + 제목 + 마감/우선순위. 밀린 할 일은 마감 빨강.
struct TaskRow: View {
    let task: VaultTask
    let onToggle: () -> Void

    private var overdue: Bool {
        guard !task.done, let due = task.dueDate else { return false }
        return due < DateParsing.todayIso()
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Button(action: onToggle) {
                Image(systemName: task.done ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(task.done ? Color.accentColor : .secondary)
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 3) {
                Text(task.title)
                    .strikethrough(task.done || task.cancelled)
                    .foregroundStyle(task.done || task.cancelled ? .secondary : .primary)
                HStack(spacing: 8) {
                    if task.priority == .high {
                        Text("높음").font(.caption2.bold()).foregroundStyle(.red)
                    }
                    if let due = task.dueDate {
                        Text(Display.relative(due) + (task.dueTime.map { " " + Display.time($0) } ?? ""))
                            .font(.caption)
                            .foregroundStyle(overdue ? .red : .secondary)
                    }
                }
            }
            Spacer()
        }
        .contentShape(Rectangle())
    }
}

// 할 일 추가/편집 시트. existing == nil 이면 추가.
struct TaskEditorSheet: View {
    @EnvironmentObject var store: VaultStore
    @Environment(\.dismiss) private var dismiss
    let existing: VaultTask?

    @State private var title = ""
    @State private var priority: TaskPriority = .medium
    @State private var hasDue = false
    @State private var dueDate = Date()
    @State private var hasTime = false
    @State private var dueTime = Date()
    @State private var targetFile = VaultPaths.inbox

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("할 일을 입력하세요", text: $title, axis: .vertical)
                }
                Section {
                    Picker("우선순위", selection: $priority) {
                        ForEach([TaskPriority.high, .medium, .low], id: \.self) { p in
                            Text(p.label).tag(p)
                        }
                    }
                    Toggle("마감일", isOn: $hasDue)
                    if hasDue {
                        DatePicker("날짜", selection: $dueDate, displayedComponents: .date)
                        Toggle("시각 지정", isOn: $hasTime)
                        if hasTime {
                            DatePicker("시각", selection: $dueTime, displayedComponents: .hourAndMinute)
                        }
                    }
                }
                if existing == nil && store.taskFiles.count > 1 {
                    Section("목록") {
                        Picker("목록", selection: $targetFile) {
                            ForEach(store.taskFiles, id: \.self) { f in
                                Text(listName(f)).tag(f)
                            }
                        }
                    }
                }
            }
            .navigationTitle(existing == nil ? "할 일 추가" : "할 일 편집")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장") { save() }
                        .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear(perform: prime)
        }
    }

    private func listName(_ rel: String) -> String {
        let name = rel.split(separator: "/").last.map(String.init) ?? rel
        let base = name.hasSuffix(".md") ? String(name.dropLast(3)) : name
        return base == "inbox" ? "미분류" : base
    }

    private func prime() {
        guard let t = existing else { return }
        title = t.title
        priority = t.priority
        if let due = t.dueDate, let d = Display.parseISO(due) {
            hasDue = true; dueDate = d
        }
        if let time = t.dueTime, let tt = Display.parseHHMM(time) {
            hasTime = true; dueTime = tt
        }
    }

    private func save() {
        let trimmed = title.trimmingCharacters(in: .whitespaces)
        let due = hasDue ? Display.iso(from: dueDate) : nil
        let time = (hasDue && hasTime) ? Display.hhmm(from: dueTime) : nil
        Task { @MainActor in
            if let t = existing {
                var patch = TaskPatch()
                patch.title = trimmed
                patch.priority = priority
                patch.setDueDate(due)
                patch.setDueTime(time)
                await store.updateTask(t, patch: patch)
            } else {
                await store.addTask(title: trimmed, dueDate: due, dueTime: time,
                                    priority: priority, file: targetFile)
            }
            dismiss()
        }
    }
}

// 일정 추가/편집 시트. existing == nil 이면 추가.
struct EventEditorSheet: View {
    @EnvironmentObject var store: VaultStore
    @Environment(\.dismiss) private var dismiss
    let existing: ScheduleEvent?

    @State private var text = ""
    @State private var start = Date()
    @State private var multiDay = false
    @State private var end = Date()
    @State private var hasTime = false
    @State private var time = Date()

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("일정 내용을 입력하세요", text: $text, axis: .vertical)
                }
                Section {
                    DatePicker("시작일", selection: $start, displayedComponents: .date)
                    Toggle("여러 날", isOn: $multiDay)
                    if multiDay {
                        DatePicker("종료일", selection: $end, displayedComponents: .date)
                    }
                    Toggle("시각 지정", isOn: $hasTime)
                    if hasTime {
                        DatePicker("시각", selection: $time, displayedComponents: .hourAndMinute)
                    }
                }
            }
            .navigationTitle(existing == nil ? "일정 추가" : "일정 편집")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장") { save() }
                        .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear(perform: prime)
        }
    }

    private func prime() {
        guard let e = existing else { return }
        text = e.text
        if let s = Display.parseISO(e.start) { start = s }
        if let endIso = e.end, let d = Display.parseISO(endIso) {
            multiDay = true; end = d
        }
        if let t = e.time, let tt = Display.parseHHMM(t) {
            hasTime = true; time = tt
        }
    }

    private func save() {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        let startIso = Display.iso(from: start)
        let endIso = multiDay ? Display.iso(from: end) : nil
        let timeStr = hasTime ? Display.hhmm(from: time) : nil
        Task { @MainActor in
            if let e = existing {
                var patch = SchedulePatch()
                patch.text = trimmed
                patch.start = startIso
                patch.setEnd(endIso)
                patch.setTime(timeStr)
                await store.updateEvent(e, patch: patch)
            } else {
                await store.addEvent(text: trimmed, start: startIso, end: endIso, time: timeStr)
            }
            dismiss()
        }
    }
}
