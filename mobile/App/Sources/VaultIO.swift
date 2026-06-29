import Foundation

// iCloud-안전 파일 IO. 보안 스코프 북마크로 접근하는 vault 루트 기준 상대 경로.
// NSFileCoordinator 로 iCloud/다른 앱과의 동시 접근을 조율하고, 쓰기는 atomic.
// 데스크탑 vault adapter 의 atomic write(tmp→rename) + iCloud placeholder 처리 대응.
struct VaultIO: Sendable {
    let root: URL

    enum IOError: LocalizedError {
        case notFound(String)
        case decode(String)
        var errorDescription: String? {
            switch self {
            case .notFound(let p): return "파일을 찾을 수 없습니다: \(p). iCloud 동기화를 확인하고 다시 시도하세요."
            case .decode(let p): return "파일을 읽을 수 없습니다: \(p). 파일 인코딩(UTF-8)을 확인하세요."
            }
        }
    }

    private func scoped<T>(_ body: () throws -> T) throws -> T {
        let ok = root.startAccessingSecurityScopedResource()
        defer { if ok { root.stopAccessingSecurityScopedResource() } }
        return try body()
    }

    func exists(_ rel: String) -> Bool {
        (try? scoped {
            FileManager.default.fileExists(atPath: root.appendingPathComponent(rel).path)
        }) ?? false
    }

    func read(_ rel: String) throws -> String {
        try scoped {
            let url = root.appendingPathComponent(rel)
            // iCloud placeholder 면 다운로드 트리거 (best-effort) — coordinated read 가
            // 보통 자동 유발하지만 명시 호출로 stuck 회피.
            try? FileManager.default.startDownloadingUbiquitousItem(at: url)
            var coordErr: NSError?
            var out: String?
            var thrown: Error?
            NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &coordErr) { u in
                guard let data = FileManager.default.contents(atPath: u.path) else {
                    thrown = IOError.notFound(rel); return
                }
                guard let s = String(data: data, encoding: .utf8) else {
                    thrown = IOError.decode(rel); return
                }
                out = s
            }
            if let coordErr { throw coordErr }
            if let thrown { throw thrown }
            guard let out else { throw IOError.notFound(rel) }
            return out
        }
    }

    func write(_ rel: String, _ content: String) throws {
        try scoped {
            let url = root.appendingPathComponent(rel)
            var coordErr: NSError?
            var thrown: Error?
            NSFileCoordinator().coordinate(writingItemAt: url, options: .forReplacing, error: &coordErr) { u in
                do {
                    try FileManager.default.createDirectory(
                        at: u.deletingLastPathComponent(),
                        withIntermediateDirectories: true)
                    // atomically: true → tmp 파일에 쓴 뒤 rename (iCloud partial sync 회피).
                    try content.data(using: .utf8)!.write(to: u, options: .atomic)
                } catch { thrown = error }
            }
            if let coordErr { throw coordErr }
            if let thrown { throw thrown }
        }
    }

    /// 디렉터리 내 항목의 vault 상대 경로 목록. 디렉터리 없으면 빈 배열.
    func list(_ rel: String) -> [String] {
        (try? scoped {
            let dir = root.appendingPathComponent(rel)
            let urls = try FileManager.default.contentsOfDirectory(
                at: dir, includingPropertiesForKeys: nil, options: [.skipsHiddenFiles])
            return urls.map { rel.isEmpty ? $0.lastPathComponent : "\(rel)/\($0.lastPathComponent)" }
        }) ?? []
    }

    func modified(_ rel: String) -> Date {
        (try? scoped {
            let url = root.appendingPathComponent(rel)
            let vals = try url.resourceValues(forKeys: [.contentModificationDateKey])
            return vals.contentModificationDate ?? .distantPast
        }) ?? .distantPast
    }

    /// 필수 폴더(tasks/) 보장 + inbox 초기화. 데스크탑 ensureVaultStructure 축소판.
    func ensureStructure() {
        try? scoped {
            let tasks = root.appendingPathComponent("tasks")
            try? FileManager.default.createDirectory(at: tasks, withIntermediateDirectories: true)
        }
    }
}
