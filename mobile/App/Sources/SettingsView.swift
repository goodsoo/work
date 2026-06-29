import SwiftUI
import UniformTypeIdentifiers

struct SettingsView: View {
    @EnvironmentObject var store: VaultStore
    @Environment(\.dismiss) private var dismiss
    @State private var picking = false
    @State private var confirmForget = false

    var body: some View {
        NavigationStack {
            Form {
                Section("vault 폴더") {
                    if let url = store.rootURL {
                        Text(url.lastPathComponent).font(.subheadline)
                        Text(url.path)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                    Button("폴더 변경") { picking = true }
                    Button("새로고침") { Task { await store.reload() } }
                }

                Section {
                    Button("연결 해제", role: .destructive) { confirmForget = true }
                } footer: {
                    Text("연결을 해제해도 vault 파일은 그대로 남습니다. 다시 폴더를 선택하면 재연결됩니다.")
                }

                Section {
                    HStack {
                        Text("버전")
                        Spacer()
                        Text(appVersion).foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("설정")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("완료") { dismiss() }
                }
            }
            .fileImporter(isPresented: $picking, allowedContentTypes: [.folder]) { result in
                if case .success(let url) = result { store.selectFolder(url) }
            }
            .alert("연결 해제", isPresented: $confirmForget) {
                Button("취소", role: .cancel) {}
                Button("해제", role: .destructive) {
                    store.forgetVault()
                    dismiss()
                }
            } message: {
                Text("vault 연결을 해제하시겠습니까?")
            }
        }
    }

    private var appVersion: String {
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        let b = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?"
        return "\(v) (\(b))"
    }
}
