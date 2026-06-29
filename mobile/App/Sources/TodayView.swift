import SwiftUI
import VaultKit

// "오늘" 대시보드 — 오늘 일정 + 오늘·밀린 할 일 한 화면. 이동 중 가장 자주 보는 탭.
struct TodayView: View {
    @EnvironmentObject var store: VaultStore
    @State private var quickAdd = ""
    @State private var showSettings = false
    @State private var editingTask: VaultTask?

    private var today: String { DateParsing.todayIso() }

    private var todayEvents: [ScheduleEvent] {
        store.events.filter { $0.start <= today && (($0.end ?? $0.start) >= today) }
    }

    private var dueTasks: [VaultTask] {
        store.tasks.filter {
            !$0.done && !$0.cancelled && !$0.deleted
                && ($0.dueDate != nil && $0.dueDate! <= today)
        }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack {
                        TextField("할 일 빠른 추가", text: $quickAdd)
                            .onSubmit(submitQuickAdd)
                        if !quickAdd.isEmpty {
                            Button(action: submitQuickAdd) {
                                Image(systemName: "arrow.up.circle.fill").font(.title3)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                Section("오늘 일정") {
                    if todayEvents.isEmpty {
                        Text("오늘 일정이 없습니다").foregroundStyle(.secondary)
                    } else {
                        ForEach(todayEvents) { event in
                            EventRow(event: event)
                        }
                    }
                }

                Section("오늘·밀린 할 일") {
                    if dueTasks.isEmpty {
                        Text("오늘 할 일이 없습니다").foregroundStyle(.secondary)
                    } else {
                        ForEach(dueTasks) { task in
                            TaskRow(task: task) { Task { await store.toggle(task) } }
                                .onTapGesture { editingTask = task }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("오늘")
            .refreshable { await store.reload() }
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button { showSettings = true } label: {
                        Image(systemName: "gearshape")
                    }
                }
            }
            .sheet(isPresented: $showSettings) { SettingsView() }
            .sheet(item: $editingTask) { task in
                TaskEditorSheet(existing: task)
            }
            .overlay {
                if store.loading && store.tasks.isEmpty && store.events.isEmpty {
                    ProgressView()
                }
            }
        }
    }

    private func submitQuickAdd() {
        let t = quickAdd.trimmingCharacters(in: .whitespaces)
        guard !t.isEmpty else { return }
        quickAdd = ""
        Task { await store.addTask(title: t, dueDate: today, dueTime: nil, priority: .medium) }
    }
}

// 일정 한 줄 (시각/범위 + 내용).
struct EventRow: View {
    let event: ScheduleEvent

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .trailing, spacing: 2) {
                Text(event.time.map { Display.time($0) } ?? "종일")
                    .font(.caption)
                    .foregroundStyle(event.time == nil ? .secondary : .primary)
            }
            .frame(width: 64, alignment: .trailing)

            VStack(alignment: .leading, spacing: 2) {
                Text(event.text)
                if event.end != nil {
                    Text(Display.dateRange(start: event.start, end: event.end))
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
        }
        .contentShape(Rectangle())
    }
}
