import SwiftUI
import WebKit

/// One browser tab: a WKWebView plus the state the UI shows for it.
@MainActor
final class BrowserTab: NSObject, ObservableObject, Identifiable, WKNavigationDelegate, WKUIDelegate {
    let id = UUID()
    let webView: WKWebView
    weak var store: BrowserStore?

    @Published var title = ""
    @Published var url: URL?
    @Published var progress: Double = 0
    @Published var isLoading = false
    @Published var canGoBack = false
    @Published var canGoForward = false

    private var observers: [NSKeyValueObservation] = []

    init(store: BrowserStore, configuration: WKWebViewConfiguration? = nil, url: URL? = nil) {
        let config: WKWebViewConfiguration
        if let configuration {
            config = configuration
        } else {
            config = WKWebViewConfiguration()
            config.allowsInlineMediaPlayback = true
            store.configureNewWebView(config)
        }
        webView = WKWebView(frame: .zero, configuration: config)
        self.store = store
        super.init()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsLinkPreview = true
        observe()
        if let url { load(url) }
    }

    // KVO callbacks aren't main-actor isolated, so they only read the change value
    // and hop to the main actor to update the published state.
    private func observe() {
        observers = [
            webView.observe(\.title, options: [.new]) { [weak self] _, change in
                let value = (change.newValue ?? nil) ?? ""
                Task { @MainActor in self?.title = value }
            },
            webView.observe(\.url, options: [.new]) { [weak self] _, change in
                guard let value = change.newValue ?? nil else { return }
                Task { @MainActor in
                    self?.url = value
                    self?.store?.saveTabs()
                }
            },
            webView.observe(\.estimatedProgress, options: [.new]) { [weak self] _, change in
                let value = change.newValue ?? 0
                Task { @MainActor in self?.progress = value }
            },
            webView.observe(\.isLoading, options: [.new]) { [weak self] _, change in
                let value = change.newValue ?? false
                Task { @MainActor in self?.isLoading = value }
            },
            webView.observe(\.canGoBack, options: [.new]) { [weak self] _, change in
                let value = change.newValue ?? false
                Task { @MainActor in self?.canGoBack = value }
            },
            webView.observe(\.canGoForward, options: [.new]) { [weak self] _, change in
                let value = change.newValue ?? false
                Task { @MainActor in self?.canGoForward = value }
            }
        ]
    }

    var displayTitle: String {
        if url == nil { return store?.t("newTab") ?? "New Tab" }
        return title.isEmpty ? (url?.host ?? "") : title
    }

    func load(_ url: URL) {
        self.url = url
        webView.load(URLRequest(url: url))
    }

    func reloadOrStop() {
        if isLoading { webView.stopLoading() } else { webView.reload() }
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if let url = webView.url { store?.addHistory(title: webView.title ?? "", url: url) }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
        // Hand mail, phone, App Store and similar links to iOS.
        if let url = navigationAction.request.url, let scheme = url.scheme?.lowercased(),
           !["http", "https", "about", "data", "blob", "file", "javascript"].contains(scheme) {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
            return .cancel
        }
        return .allow
    }

    // MARK: - WKUIDelegate

    /// Links that open a new window (target=_blank, window.open, "Open in New Tab") become a new tab.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard let store else { return nil }
        let tab = BrowserTab(store: store, configuration: configuration)
        store.open(tab)
        return tab.webView
    }

    func webViewDidClose(_ webView: WKWebView) {
        store?.close(self)
    }
}
