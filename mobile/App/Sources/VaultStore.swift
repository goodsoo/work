import Foundation
import Combine
import VaultKit

// 앱 전역 상태 + vault 읽기/쓰기. 모든 변경은 "파일 fresh read → 파서 변환 → write →
// 전체 reload" 흐름 (1인용 도구라 단순/안전 우선; 라인 인덱스 shift 를 reload 로 흡수).
@MainActor
final class VaultStore: ObservableObject {
    @Published var rootURL: URL?
    @Published var tasks: [VaultTask] = []
    @Published var events: [ScheduleEvent] = []
    @Published var notes: [NoteFile] = []
    @Published var taskFiles: [String] = []   // tasks/*.md 상대 경로 (할 일 추가 대상)
    @Published var loading = false
    @Published var errorMessage: String?

    private let bookmarkKey = "goodsoob.vaultBookmark"

    init() { restore() }

    var hasVault: Bool { rootURL != nil }
    private var io: VaultIO? { rootURL.map { VaultIO(root: $0) } }

    // ─── 폴더 선택 / 복원 ──────────────────────────────────────────────────────

    func restore() {
        guard let data = UserDefaults.standard.data(forKey: bookmarkKey) else { return }
        var stale = false
        guard let url = try? URL(resolvingBookmarkData: data, bookmarkDataIsStale: &stale) else {
            return
        }
        rootURL = url
        if stale, let fresh = try? url.bookmarkData() {
            UserDefaults.standard.set(fresh, forKey: bookmarkKey)
        }
        Task { await reload() }
    }

    /// fileImporter 가 준 보안 스코프 URL 을 영구 북마크로 저장.
    func selectFolder(_ url: URL) {
        let ok = url.startAccessingSecurityScopedResource()
        defer { if ok { url.stopAccessingSecurityScopedResource() } }
        do {
            let data = try url.bookmarkData()
            UserDefaults.standard.set(data, forKey: bookmarkKey)
            rootURL = url
            VaultIO(root: url).ensureStructure()
            Task { await reload() }
        } catch {
            errorMessage = "폴더 접근에 실패했습니다. 다시 선택하세요."
        }
    }

    func forgetVault() {
        UserDefaults.standard.removeObject(forKey: bookmarkKey)
        rootURL = nil
        tasks = []; events = []; notes = []; taskFiles = []
    }

    // ─── 읽기 ──────────────────────────────────────────────────────────────────

    struct Snapshot: Sendable {
        var tasks: [VaultTask]
        var events: [ScheduleEvent]
        var notes: [NoteFile]
        var taskFiles: [String]
    }

    func reload() async {
        guard let io else { return }
        loading = true
        defer { loading = false }
        do {
            let snap = try await Task.detached(priority: .userInitiated) {
                try Self.load(io)
            }.value
            self.tasks = snap.tasks
            self.events = snap.events
            self.notes = snap.notes
            self.taskFiles = snap.taskFiles
        } catch {
            errorMessage = Self.humanError(error)
        }
    }

    // nonisolated — Task.detached(백그라운드)에서 직접 호출 (VaultStore 는 @MainActor).
    nonisolated private static func load(_ io: VaultIO) throws -> Snapshot {
        // 할 일 — tasks/*.md 전부
        var allTasks: [VaultTask] = []
        var taskFiles: [String] = []
        for rel in io.list(VaultPaths.tasksDir) where rel.hasSuffix(".md") && !isSyncNoiseFile(rel) {
            taskFiles.append(rel)
            let raw = try io.read(rel)
            allTasks += TaskParser.extractTasks(rel, raw).map(TaskParser.task(from:))
        }
        // 일정 — schedule.md
        var events: [ScheduleEvent] = []
        if io.exists(VaultPaths.schedule) {
            let raw = try io.read(VaultPaths.schedule)
            events = ScheduleParser.sorted(ScheduleParser.extractEvents(VaultPaths.schedule, raw))
        }
        // 메모 — notes/*.md (읽기 전용 목록, mtime 최신순)
        var notes: [NoteFile] = []
        for rel in io.list(VaultPaths.notesDir) where rel.hasSuffix(".md") && !isSyncNoiseFile(rel) {
            // sidecar (.summary.md / .transcript.md) 제외 — 본문 노트만
            let name = rel.split(separator: "/").last.map(String.init) ?? rel
            if name.hasSuffix(".summary.md") || name.hasSuffix(".transcript.md") { continue }
            let title = String(name.dropLast(3)) // .md 제거
            notes.append(NoteFile(path: rel, title: title, modified: io.modified(rel)))
        }
        notes.sort { $0.modified > $1.modified }

        return Snapshot(tasks: sortTasks(allTasks), events: events,
                        notes: notes, taskFiles: taskFiles.sorted())
    }

    // 데스크탑 listTodos 정렬: 미완료 먼저 → due 가까운 순(없으면 뒤) → 최근(line desc)
    nonisolated private static func sortTasks(_ tasks: [VaultTask]) -> [VaultTask] {
        tasks.sorted { a, b in
            if a.done != b.done { return !a.done }
            let da = a.dueDate ?? "9999", db = b.dueDate ?? "9999"
            if da != db { return da < db }
            return a.line > b.line
        }
    }

    func readNoteBody(_ note: NoteFile) async -> String {
        guard let io else { return "" }
        let path = note.path
        return (try? await Task.detached(priority: .userInitiated) {
            try io.read(path)
        }.value) ?? ""
    }

    // ─── 할 일 변경 ─────────────────────────────────────────────────────────────

    func toggle(_ task: VaultTask) async {
        await mutate(file: task.file) { raw in
            try TaskParser.toggleTask(raw, line: task.line, done: !task.done)
        }
    }

    func addTask(title: String, dueDate: String?, dueTime: String?,
                 priority: TaskPriority, file: String = VaultPaths.inbox) async {
        guard let io else { return }
        do {
            try await Task.detached(priority: .userInitiated) {
                let raw = io.exists(file) ? try io.read(file) : "# 미분류\n"
                var input = TaskParser.TodoLineInput(title: title)
                input.dueDate = dueDate
                input.dueTime = dueTime
                input.priority = priority
                let (updated, _) = TaskParser.appendTodo(raw, input)
                try io.write(file, updated)
            }.value
            await reload()
        } catch {
            errorMessage = Self.humanError(error)
        }
    }

    func updateTask(_ task: VaultTask, patch: TaskPatch) async {
        await mutate(file: task.file) { raw in
            try TaskParser.applyUpdate(raw, line: task.line, patch: patch)
        }
    }

    func deleteTask(_ task: VaultTask) async {
        await mutate(file: task.file) { raw in
            TaskParser.deleteLine(raw, line: task.line)
        }
    }

    // ─── 일정 변경 ─────────────────────────────────────────────────────────────

    func addEvent(text: String, start: String, end: String?, time: String?) async {
        guard let io else { return }
        do {
            try await Task.detached(priority: .userInitiated) {
                let raw = io.exists(VaultPaths.schedule) ? try io.read(VaultPaths.schedule) : "# 일정\n"
                let input = ScheduleParser.EventLineInput(start: start, end: end, time: time, text: text)
                let (updated, _) = ScheduleParser.appendEvent(raw, input)
                try io.write(VaultPaths.schedule, updated)
            }.value
            await reload()
        } catch {
            errorMessage = Self.humanError(error)
        }
    }

    func updateEvent(_ event: ScheduleEvent, patch: SchedulePatch) async {
        await mutate(file: event.file) { raw in
            try ScheduleParser.applyUpdate(raw, line: event.line, patch: patch)
        }
    }

    func deleteEvent(_ event: ScheduleEvent) async {
        await mutate(file: event.file) { raw in
            ScheduleParser.deleteLine(raw, line: event.line)
        }
    }

    // ─── 공통 mutate ────────────────────────────────────────────────────────────

    private func mutate(file: String,
                        _ transform: @Sendable @escaping (String) throws -> String) async {
        guard let io else { return }
        do {
            try await Task.detached(priority: .userInitiated) {
                let raw = try io.read(file)
                let updated = try transform(raw)
                try io.write(file, updated)
            }.value
            await reload()
        } catch {
            errorMessage = Self.humanError(error)
        }
    }

    private static func humanError(_ error: Error) -> String {
        if let e = error as? VaultIO.IOError { return e.errorDescription ?? "\(error)" }
        if let e = error as? LocalizedError, let d = e.errorDescription { return d }
        return "작업에 실패했습니다. 다시 시도하세요."
    }
}
