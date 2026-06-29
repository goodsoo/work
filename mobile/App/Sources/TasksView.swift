import SwiftUI
import VaultKit

struct TasksView: View {
    @EnvironmentObject var store: VaultStore
    @State private var showDone = false
    @State private var adding = false
    @State private var editingTask: VaultTask?

    private var visible: [VaultTask] {
        store.tasks.filter { task in
            if task.deleted { return false }
            return showDone ? true : !task.done
        }
    }

    var body: some View {
        NavigationStack {
            List {
                Picker("필터", selection: $showDone) {
                    Text("미완료").tag(false)
                    Text("전체").tag(true)
                }
                .pickerStyle(.segmented)
                .listRowSeparator(.hidden)

                if visible.isEmpty {
                    ContentUnavailableViewCompat(
                        title: "할 일이 없습니다",
                        message: "오른쪽 위 + 로 새 할 일을 추가하세요.",
                        systemImage: "checklist")
                } else {
                    ForEach(visible) { task in
                        TaskRow(task: task) { Task { await store.toggle(task) } }
                            .onTapGesture { editingTask = task }
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    Task { await store.deleteTask(task) }
                                } label: { Label("삭제", systemImage: "trash") }
                            }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("할 일")
            .refreshable { await store.reload() }
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button { adding = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $adding) { TaskEditorSheet(existing: nil) }
            .sheet(item: $editingTask) { task in TaskEditorSheet(existing: task) }
        }
    }
}

// iOS 16 호환 빈 상태 (ContentUnavailableView 는 17+). 데스크탑 empty state 3단 정책.
struct ContentUnavailableViewCompat: View {
    let title: String
    let message: String
    let systemImage: String

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: systemImage)
                .font(.system(size: 40))
                .foregroundStyle(.secondary)
            Text(title).font(.headline)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
        .listRowSeparator(.hidden)
    }
}
