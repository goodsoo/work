import SwiftUI
import VaultKit

struct NotesView: View {
    @EnvironmentObject var store: VaultStore

    var body: some View {
        NavigationStack {
            List {
                if store.notes.isEmpty {
                    ContentUnavailableViewCompat(
                        title: "메모가 없습니다",
                        message: "맥 앱에서 작성한 메모가 여기 표시됩니다.",
                        systemImage: "doc.text")
                } else {
                    ForEach(store.notes) { note in
                        NavigationLink(value: note) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(note.title)
                                Text(relativeModified(note.modified))
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("메모")
            .refreshable { await store.reload() }
            .navigationDestination(for: NoteFile.self) { note in
                NoteDetailView(note: note)
            }
        }
    }

    private func relativeModified(_ date: Date) -> String {
        let f = RelativeDateTimeFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.unitsStyle = .short
        return f.localizedString(for: date, relativeTo: Date())
    }
}

// 읽기 전용 메모 본문. 편집은 1차 범위 밖 (맥 앱에서 편집).
struct NoteDetailView: View {
    @EnvironmentObject var store: VaultStore
    let note: NoteFile
    @State private var body_ = ""
    @State private var loading = true

    var body: some View {
        ScrollView {
            if loading {
                ProgressView().padding(.top, 40)
            } else {
                Text(body_)
                    .font(.body)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
                    .padding()
            }
        }
        .navigationTitle(note.title)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            body_ = await store.readNoteBody(note)
            loading = false
        }
    }
}
