import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authManager: GoogleAuthManager
    @StateObject private var viewModel = AgentViewModel()

    var body: some View {
        TabView {
            HomeView(viewModel: viewModel)
                .tabItem {
                    Label("エージェント", systemImage: "waveform.circle.fill")
                }

            CommandHistoryView(viewModel: viewModel)
                .tabItem {
                    Label("履歴", systemImage: "clock.fill")
                }

            SettingsView()
                .tabItem {
                    Label("設定", systemImage: "gear")
                }
        }
        .tint(.blue)
        .onAppear {
            viewModel.setAuthManager(authManager)
        }
    }
}
