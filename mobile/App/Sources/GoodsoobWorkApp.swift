import SwiftUI
import UniformTypeIdentifiers

@main
struct GoodsoobWorkApp: App {
    @StateObject private var store = VaultStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
        }
    }
}

struct RootView: View {
    @EnvironmentObject var store: VaultStore

    var body: some View {
        Group {
            if store.hasVault {
                MainTabView()
            } else {
                OnboardingView()
            }
        }
        .alert("오류", isPresented: Binding(
            get: { store.errorMessage != nil },
            set: { if !$0 { store.errorMessage = nil } }
        )) {
            Button("확인", role: .cancel) { store.errorMessage = nil }
        } message: {
            Text(store.errorMessage ?? "")
        }
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            TodayView()
                .tabItem { Label("오늘", systemImage: "sun.max") }
            TasksView()
                .tabItem { Label("할 일", systemImage: "checklist") }
            ScheduleView()
                .tabItem { Label("일정", systemImage: "calendar") }
            NotesView()
                .tabItem { Label("메모", systemImage: "doc.text") }
        }
    }
}

// 첫 진입 — vault 폴더(iCloud Drive 의 work 폴더) 선택 안내.
struct OnboardingView: View {
    @EnvironmentObject var store: VaultStore
    @State private var picking = false

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "folder.badge.plus")
                .font(.system(size: 56))
                .foregroundStyle(.tint)
            VStack(spacing: 8) {
                Text("vault 폴더를 선택하세요")
                    .font(.title2.bold())
                Text("맥에서 쓰는 vault 폴더(iCloud Drive 안)를 고르면 할 일과 일정을 그대로 보고 수정할 수 있습니다.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }
            Button {
                picking = true
            } label: {
                Text("폴더 선택")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
            .buttonStyle(.borderedProminent)
            .padding(.horizontal, 32)
            Spacer()
        }
        .fileImporter(isPresented: $picking, allowedContentTypes: [.folder]) { result in
            switch result {
            case .success(let url): store.selectFolder(url)
            case .failure: store.errorMessage = "폴더를 선택하지 못했습니다. 다시 시도하세요."
            }
        }
    }
}
