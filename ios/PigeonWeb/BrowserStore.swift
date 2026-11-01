import SwiftUI
import WebKit

struct Bookmark: Codable, Identifiable, Hashable {
    var id = UUID()
    var title: String
    var url: URL
}

struct HistoryItem: Codable, Identifiable, Hashable {
    var id = UUID()
    var title: String
    var url: URL
    var date: Date
}

struct Shortcut: Codable, Identifiable, Hashable {
    var id = UUID()
    var title: String
    var url: URL
}

enum SearchEngine: String, Codable, CaseIterable, Identifiable {
    case google, duckduckgo, bing, brave, ecosia

    var id: String { rawValue }

    var name: String {
        switch self {
        case .google: return "Google"
        case .duckduckgo: return "DuckDuckGo"
        case .bing: return "Bing"
        case .brave: return "Brave Search"
        case .ecosia: return "Ecosia"
        }
    }

    func searchURL(_ query: String) -> URL? {
        let base: String
        switch self {
        case .google: base = "https://www.google.com/search?q="
        case .duckduckgo: base = "https://duckduckgo.com/?q="
        case .bing: base = "https://www.bing.com/search?q="
        case .brave: base = "https://search.brave.com/search?q="
        case .ecosia: base = "https://www.ecosia.org/search?q="
        }
        let q = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed.subtracting(CharacterSet(charactersIn: "&+=?#"))) ?? query
        return URL(string: base + q)
    }
}

struct AppSettings: Codable, Equatable {
    var engine: SearchEngine = .google
    var blockTrackers = true
    var gooseMode = false
    var language = "auto"
    var showWeather = true

    init() {}

    // Settings saved by an older version lack the newer keys; those keep their defaults.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        engine = try c.decodeIfPresent(SearchEngine.self, forKey: .engine) ?? .google
        blockTrackers = try c.decodeIfPresent(Bool.self, forKey: .blockTrackers) ?? true
        gooseMode = try c.decodeIfPresent(Bool.self, forKey: .gooseMode) ?? false
        language = try c.decodeIfPresent(String.self, forKey: .language) ?? "auto"
        showWeather = try c.decodeIfPresent(Bool.self, forKey: .showWeather) ?? true
    }
}

/// Everything that is saved between launches.
private struct SavedState: Codable {
    var bookmarks: [Bookmark] = []
    var history: [HistoryItem] = []
    var shortcuts: [Shortcut] = []
    var settings = AppSettings()
    var openTabs: [URL] = []
}

@MainActor
final class BrowserStore: ObservableObject {
    static let discordInvite = URL(string: "https://discord.gg/aymngeTrWY")!
    static let releasesPage = URL(string: "https://github.com/cyansupport/pigeon-web/releases/latest")!

    @Published var tabs: [BrowserTab] = []
    @Published var activeID: UUID?
    @Published var bookmarks: [Bookmark] = [] { didSet { save() } }
    @Published var history: [HistoryItem] = [] { didSet { save() } }
    @Published var shortcuts: [Shortcut] = [] { didSet { save() } }
    @Published var settings = AppSettings() {
        didSet {
            save()
            if settings.blockTrackers != oldValue.blockTrackers { applyBlocking() }
        }
    }

    let weather = WeatherModel()
    private var ruleList: WKContentRuleList?
    private var loading = true
    private let storageKey = "pigeon.state.v1"

    init() {
        if let data = UserDefaults.standard.data(forKey: storageKey),
           let saved = try? JSONDecoder().decode(SavedState.self, from: data) {
            bookmarks = saved.bookmarks
            history = saved.history
            shortcuts = saved.shortcuts
            settings = saved.settings
            for url in saved.openTabs.prefix(10) { tabs.append(BrowserTab(store: self, url: url)) }
        }
        if tabs.isEmpty { tabs.append(BrowserTab(store: self)) }
        activeID = tabs.first?.id
        loading = false
        Blocker.compile { [weak self] list in
            self?.ruleList = list
            self?.applyBlocking()
        }
    }

    // MARK: - Brand & language

    var brandName: String { settings.gooseMode ? "Goose Web" : "Pigeon Web" }
    var birdName: String { settings.gooseMode ? "Goose" : "Pigeon" }
    var logo: String { settings.gooseMode ? "Goose" : "Pigeon" }
    var accent: Color {
        settings.gooseMode ? Color(red: 0.96, green: 0.65, blue: 0.14) : Color(red: 0.61, green: 0.55, blue: 1.0)
    }
    var lang: String { L10n.resolve(settings.language) }
    func t(_ key: String, _ vars: [String: String] = [:]) -> String { L10n.text(key, lang: lang, vars: vars) }

    // MARK: - Tabs

    var activeTab: BrowserTab? { tabs.first { $0.id == activeID } ?? tabs.first }

    func newTab(_ url: URL? = nil) {
        open(BrowserTab(store: self, url: url))
    }

    func open(_ tab: BrowserTab) {
        if let i = tabs.firstIndex(where: { $0.id == activeID }) { tabs.insert(tab, at: i + 1) } else { tabs.append(tab) }
        activeID = tab.id
        saveTabs()
    }

    func select(_ tab: BrowserTab) { activeID = tab.id }

    func close(_ tab: BrowserTab) {
        guard let i = tabs.firstIndex(where: { $0.id == tab.id }) else { return }
        tab.webView.stopLoading()
        tabs.remove(at: i)
        if tabs.isEmpty { tabs.append(BrowserTab(store: self)) }
        if activeID == tab.id { activeID = tabs[min(i, tabs.count - 1)].id }
        saveTabs()
    }

    func closeAll() {
        tabs.forEach { $0.webView.stopLoading() }
        tabs = [BrowserTab(store: self)]
        activeID = tabs.first?.id
        saveTabs()
    }

    // MARK: - Navigation

    /// Turns what the user typed into a URL: an address if it looks like one, otherwise a search.
    func url(from text: String) -> URL? {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return nil }
        if t.range(of: "^[a-zA-Z][a-zA-Z0-9+.-]*://", options: .regularExpression) != nil { return URL(string: t) }
        if t.range(of: "^localhost(:\\d+)?(/|$)", options: .regularExpression) != nil { return URL(string: "http://" + t) }
        if !t.contains(" "), t.range(of: "^[^\\s/]+\\.[a-zA-Z]{2,}(:\\d+)?([/?#].*)?$", options: .regularExpression) != nil {
            return URL(string: "https://" + t)
        }
        return settings.engine.searchURL(t)
    }

    func navigate(_ text: String, in tab: BrowserTab?) {
        guard let url = url(from: text) else { return }
        if let tab { tab.load(url) } else { newTab(url) }
    }

    // MARK: - Bookmarks, history, shortcuts

    func isBookmarked(_ url: URL?) -> Bool { url.map { u in bookmarks.contains { $0.url == u } } ?? false }

    func toggleBookmark(_ tab: BrowserTab) {
        guard let url = tab.url else { return }
        if let i = bookmarks.firstIndex(where: { $0.url == url }) {
            bookmarks.remove(at: i)
        } else {
            bookmarks.append(Bookmark(title: tab.title.isEmpty ? (url.host ?? url.absoluteString) : tab.title, url: url))
        }
    }

    func addHistory(title: String, url: URL) {
        guard url.scheme == "https" || url.scheme == "http" else { return }
        if let last = history.first, last.url == url {
            history[0].title = title.isEmpty ? last.title : title
            history[0].date = Date()
        } else {
            history.insert(HistoryItem(title: title.isEmpty ? (url.host ?? url.absoluteString) : title, url: url, date: Date()), at: 0)
            if history.count > 1000 { history.removeLast(history.count - 1000) }
        }
        saveTabs()
    }

    func addShortcut(title: String, address: String) -> Bool {
        var a = address.trimmingCharacters(in: .whitespaces)
        if !a.contains("://") { a = "https://" + a }
        guard let url = URL(string: a), let host = url.host, host.contains(".") || host == "localhost", shortcuts.count < 12 else { return false }
        let name = title.trimmingCharacters(in: .whitespaces)
        shortcuts.append(Shortcut(title: name.isEmpty ? host.replacingOccurrences(of: "www.", with: "") : name, url: url))
        return true
    }

    // MARK: - Tracker blocking

    func configureNewWebView(_ config: WKWebViewConfiguration) {
        if settings.blockTrackers, let list = ruleList { config.userContentController.add(list) }
    }

    private func applyBlocking() {
        for tab in tabs {
            let ucc = tab.webView.configuration.userContentController
            ucc.removeAllContentRuleLists()
            if settings.blockTrackers, let list = ruleList { ucc.add(list) }
        }
    }

    // MARK: - Saving

    func saveTabs() { save() }

    private func save() {
        guard !loading else { return }
        let state = SavedState(bookmarks: bookmarks, history: history, shortcuts: shortcuts, settings: settings,
                               openTabs: tabs.compactMap { $0.url })
        if let data = try? JSONEncoder().encode(state) { UserDefaults.standard.set(data, forKey: storageKey) }
    }
}
