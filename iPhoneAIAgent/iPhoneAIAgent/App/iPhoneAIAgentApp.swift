import SwiftUI

@main
struct iPhoneAIAgentApp: App {
    @StateObject private var authManager = GoogleAuthManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
                .onOpenURL { url in
                    authManager.handleRedirect(url: url)
                }
        }
    }
}
