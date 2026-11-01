import SwiftUI
import WebKit

struct BrowserView: View {
    @EnvironmentObject var store: BrowserStore
    @State private var showTabs = false
    @State private var showMenu = false

    var body: some View {
        Group {
            if let tab = store.activeTab {
                TabScreen(tab: tab, showTabs: $showTabs, showMenu: $showMenu)
                    .id(tab.id)
            }
        }
        .tint(store.accent)
        .sheet(isPresented: $showTabs) {
            TabsView().environmentObject(store).tint(store.accent)
        }
        .sheet(isPresented: $showMenu) {
            MenuSheet().environmentObject(store).tint(store.accent)
        }
    }
}

/// The active tab: address bar, page (or the start page) and the bottom toolbar.
struct TabScreen: View {
    @EnvironmentObject var store: BrowserStore
    @ObservedObject var tab: BrowserTab
    @Binding var showTabs: Bool
    @Binding var showMenu: Bool

    var body: some View {
        VStack(spacing: 0) {
            AddressBar(tab: tab)
            ZStack {
                WebView(webView: tab.webView)
                    .opacity(tab.url == nil ? 0 : 1)
                if tab.url == nil {
                    StartPage(tab: tab)
                }
            }
            BottomBar(tab: tab, showTabs: $showTabs, showMenu: $showMenu)
        }
        .background(Color(.systemBackground))
    }
}

struct WebView: UIViewRepresentable {
    let webView: WKWebView

    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

struct AddressBar: View {
    @EnvironmentObject var store: BrowserStore
    @ObservedObject var tab: BrowserTab
    @State private var text = ""
    @FocusState private var focused: Bool

    private static func display(_ url: URL?) -> String {
        guard let host = url?.host else { return "" }
        return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
    }

    private var icon: String {
        guard let scheme = tab.url?.scheme else { return "magnifyingglass" }
        return scheme == "https" ? "lock.fill" : "exclamationmark.triangle.fill"
    }

    private var iconColor: Color {
        guard let scheme = tab.url?.scheme else { return .secondary }
        return scheme == "https" ? .green : .orange
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.footnote)
                    .foregroundColor(iconColor)
                TextField(store.t("searchPlaceholder"), text: $text)
                    .focused($focused)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.webSearch)
                    .submitLabel(.go)
                    .multilineTextAlignment(focused ? .leading : .center)
                    .onSubmit {
                        store.navigate(text, in: tab)
                        focused = false
                    }
                if focused && !text.isEmpty {
                    Button { text = "" } label: {
                        Image(systemName: "xmark.circle.fill").foregroundColor(.secondary)
                    }
                } else if tab.url != nil {
                    Button { tab.reloadOrStop() } label: {
                        Image(systemName: tab.isLoading ? "xmark" : "arrow.clockwise")
                    }
                }
            }
            .padding(.horizontal, 12)
            .frame(height: 40)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .padding(.horizontal, 12)
            .padding(.vertical, 8)

            ProgressView(value: tab.progress)
                .progressViewStyle(.linear)
                .frame(height: 2)
                .opacity(tab.isLoading ? 1 : 0)
        }
        .onAppear { text = Self.display(tab.url) }
        .onReceive(tab.$url) { url in
            if !focused { text = Self.display(url) }
        }
        .onChange(of: focused) { isFocused in
            text = isFocused ? (tab.url?.absoluteString ?? "") : Self.display(tab.url)
        }
    }
}

struct BottomBar: View {
    @EnvironmentObject var store: BrowserStore
    @ObservedObject var tab: BrowserTab
    @Binding var showTabs: Bool
    @Binding var showMenu: Bool

    var body: some View {
        HStack {
            Button { tab.webView.goBack() } label: { Image(systemName: "chevron.backward") }
                .disabled(!tab.canGoBack)
            Spacer()
            Button { tab.webView.goForward() } label: { Image(systemName: "chevron.forward") }
                .disabled(!tab.canGoForward)
            Spacer()
            if let url = tab.url {
                ShareLink(item: url) { Image(systemName: "square.and.arrow.up") }
            } else {
                Image(systemName: "square.and.arrow.up").foregroundColor(.secondary.opacity(0.4))
            }
            Spacer()
            Button { showTabs = true } label: {
                ZStack {
                    RoundedRectangle(cornerRadius: 5, style: .continuous)
                        .stroke(lineWidth: 1.8)
                        .frame(width: 22, height: 22)
                    Text("\(store.tabs.count)")
                        .font(.system(size: 11, weight: .bold))
                }
            }
            Spacer()
            Button { showMenu = true } label: { Image(systemName: "ellipsis.circle") }
        }
        .font(.system(size: 20))
        .padding(.horizontal, 24)
        .padding(.top, 10)
        .padding(.bottom, 6)
        .background(.bar)
    }
}
