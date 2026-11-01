import SwiftUI

@main
struct PigeonWebApp: App {
    @StateObject private var store = BrowserStore()

    var body: some Scene {
        WindowGroup {
            BrowserView()
                .environmentObject(store)
        }
    }
}
