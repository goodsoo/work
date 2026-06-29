import SwiftUI
import VaultKit

struct ScheduleView: View {
    @EnvironmentObject var store: VaultStore
    @State private var adding = false
    @State private var editingEvent: ScheduleEvent?

    private var today: String { DateParsing.todayIso() }

    private var upcoming: [ScheduleEvent] {
        store.events.filter { ($0.end ?? $0.start) >= today }
    }
    private var past: [ScheduleEvent] {
        Array(store.events.filter { ($0.end ?? $0.start) < today }.reversed())
    }

    var body: some View {
        NavigationStack {
            List {
                if upcoming.isEmpty && past.isEmpty {
                    ContentUnavailableViewCompat(
                        title: "일정이 없습니다",
                        message: "오른쪽 위 + 로 새 일정을 추가하세요.",
                        systemImage: "calendar")
                } else {
                    Section("다가오는 일정") {
                        if upcoming.isEmpty {
                            Text("다가오는 일정이 없습니다").foregroundStyle(.secondary)
                        }
                        ForEach(upcoming) { event in
                            eventRow(event)
                        }
                    }
                    if !past.isEmpty {
                        Section("지난 일정") {
                            ForEach(Array(past)) { event in
                                eventRow(event)
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("일정")
            .refreshable { await store.reload() }
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button { adding = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $adding) { EventEditorSheet(existing: nil) }
            .sheet(item: $editingEvent) { event in EventEditorSheet(existing: event) }
        }
    }

    @ViewBuilder
    private func eventRow(_ event: ScheduleEvent) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(Display.dateRange(start: event.start, end: event.end))
                .font(.caption).foregroundStyle(.secondary)
            HStack(alignment: .top, spacing: 12) {
                Text(event.time.map { Display.time($0) } ?? "종일")
                    .font(.caption)
                    .foregroundStyle(event.time == nil ? .secondary : .primary)
                    .frame(width: 64, alignment: .leading)
                Text(event.text)
                Spacer()
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { editingEvent = event }
        .swipeActions(edge: .trailing) {
            Button(role: .destructive) {
                Task { await store.deleteEvent(event) }
            } label: { Label("삭제", systemImage: "trash") }
        }
    }
}
