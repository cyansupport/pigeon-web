import SwiftUI

// MARK: - Tab switcher

struct TabsView: View {
    @EnvironmentObject var store: BrowserStore
    @Environment(\.dismiss) private var dismiss

    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(store.tabs) { tab in
                        TabCard(tab: tab, active: tab.id == store.activeID, logo: store.logo, accent: store.accent,
                                onSelect: { store.select(tab); dismiss() },
                                onClose: { store.close(tab) })
                    }
                }
                .padding(12)
            }
            .navigationTitle(store.t("tabs"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(store.t("closeAll"), role: .destructive) {
                        store.closeAll()
                        dismiss()
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(store.t("done")) { dismiss() }
                }
                ToolbarItem(placement: .bottomBar) {
                    Button {
                        store.newTab()
                        dismiss()
                    } label: {
                        Label(store.t("newTabButton"), systemImage: "plus")
                    }
                }
            }
        }
    }
}

struct TabCard: View {
    @ObservedObject var tab: BrowserTab
    let active: Bool
    let logo: String
    let accent: Color
    let onSelect: () -> Void
    let onClose: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                Text(tab.displayTitle)
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
                Spacer(minLength: 4)
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.caption.weight(.bold))
                        .foregroundColor(.secondary)
                        .padding(4)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(Color(.tertiarySystemBackground))

            ZStack {
                Color(.secondarySystemBackground)
                if tab.url == nil {
                    Image(logo).resizable().scaledToFit().frame(width: 54, height: 54)
                } else {
                    VStack(spacing: 6) {
                        Text(String((tab.url?.host ?? "?").replacingOccurrences(of: "www.", with: "").prefix(1)).uppercased())
                            .font(.system(size: 34, weight: .bold, design: .rounded))
                            .foregroundColor(accent)
                        Text(tab.url?.host ?? "")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                            .padding(.horizontal, 8)
                    }
                }
            }
            .frame(height: 150)
        }
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(active ? accent : Color.secondary.opacity(0.25), lineWidth: active ? 2.5 : 1)
        )
        .contentShape(Rectangle())
        .onTapGesture(perform: onSelect)
    }
}

// MARK: - Menu

struct MenuSheet: View {
    @EnvironmentObject var store: BrowserStore
    @Environment(\.dismiss) private var dismiss

    private var version: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
    }

    var body: some View {
        NavigationStack {
            List {
                if let tab = store.activeTab, tab.url != nil {
                    Section {
                        let saved = store.isBookmarked(tab.url)
                        Button {
                            store.toggleBookmark(tab)
                        } label: {
                            Label(store.t(saved ? "removeBookmark" : "addBookmark"), systemImage: saved ? "star.fill" : "star")
                        }
                    }
                }
                Section {
                    NavigationLink {
                        BookmarksList(onOpen: { dismiss() })
                    } label: {
                        Label(store.t("bookmarks"), systemImage: "book")
                    }
                    NavigationLink {
                        HistoryList(onOpen: { dismiss() })
                    } label: {
                        Label(store.t("history"), systemImage: "clock")
                    }
                    NavigationLink {
                        SettingsList()
                    } label: {
                        Label(store.t("settings"), systemImage: "gearshape")
                    }
                }
                Section {
                    Button {
                        store.newTab(BrowserStore.discordInvite)
                        dismiss()
                    } label: {
                        Label(store.t("joinDiscord"), systemImage: "bubble.left.and.bubble.right")
                    }
                    Button {
                        store.newTab(BrowserStore.releasesPage)
                        dismiss()
                    } label: {
                        Label(store.t("checkUpdates"), systemImage: "arrow.down.circle")
                    }
                } footer: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(store.t("about", ["name": store.brandName])).fontWeight(.semibold)
                        Text(store.t("version", ["v": version]))
                        Text(store.t("aboutText"))
                    }
                    .padding(.top, 8)
                }
            }
            .navigationTitle(store.brandName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(store.t("done")) { dismiss() }
                }
            }
        }
    }
}

struct BookmarksList: View {
    @EnvironmentObject var store: BrowserStore
    let onOpen: () -> Void

    var body: some View {
        List {
            if store.bookmarks.isEmpty {
                Text(store.t("noBookmarks")).foregroundColor(.secondary)
            }
            ForEach(store.bookmarks) { b in
                Button {
                    store.activeTab?.load(b.url)
                    onOpen()
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(b.title).foregroundColor(.primary).lineLimit(1)
                        Text(b.url.host ?? b.url.absoluteString).font(.caption).foregroundColor(.secondary).lineLimit(1)
                    }
                }
            }
            .onDelete { store.bookmarks.remove(atOffsets: $0) }
        }
        .navigationTitle(store.t("bookmarks"))
    }
}

struct HistoryList: View {
    @EnvironmentObject var store: BrowserStore
    let onOpen: () -> Void

    private var today: [HistoryItem] { store.history.filter { Calendar.current.isDateInToday($0.date) } }
    private var earlier: [HistoryItem] { store.history.filter { !Calendar.current.isDateInToday($0.date) } }

    var body: some View {
        List {
            if store.history.isEmpty {
                Text(store.t("noHistory")).foregroundColor(.secondary)
            }
            if !today.isEmpty {
                Section(store.t("today")) { rows(today) }
            }
            if !earlier.isEmpty {
                Section(store.t("earlier")) { rows(earlier) }
            }
        }
        .navigationTitle(store.t("history"))
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(store.t("clearHistory"), role: .destructive) { store.history.removeAll() }
                    .disabled(store.history.isEmpty)
            }
        }
    }

    private func rows(_ items: [HistoryItem]) -> some View {
        ForEach(items) { item in
            Button {
                store.activeTab?.load(item.url)
                onOpen()
            } label: {
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title).foregroundColor(.primary).lineLimit(1)
                    Text(item.url.host ?? item.url.absoluteString).font(.caption).foregroundColor(.secondary).lineLimit(1)
                }
            }
        }
    }
}

struct SettingsList: View {
    @EnvironmentObject var store: BrowserStore

    var body: some View {
        Form {
            Section {
                Picker(store.t("language"), selection: $store.settings.language) {
                    Text(store.t("systemDefault")).tag("auto")
                    ForEach(L10n.languages, id: \.code) { lang in
                        Text(lang.name).tag(lang.code)
                    }
                }
                Picker(store.t("searchEngine"), selection: $store.settings.engine) {
                    ForEach(SearchEngine.allCases) { engine in
                        Text(engine.name).tag(engine)
                    }
                }
            }
            Section {
                Toggle(store.t("blockTrackers"), isOn: $store.settings.blockTrackers)
            } footer: {
                Text(store.t("blockTrackersInfo", ["n": "\(Blocker.domains.count)"]))
            }
            Section {
                Toggle(store.t("gooseMode"), isOn: $store.settings.gooseMode)
            }
            Section {
                Toggle(store.t("showWeather"), isOn: $store.settings.showWeather)
            } footer: {
                Text(store.t("showWeatherInfo"))
            }
        }
        .navigationTitle(store.t("settings"))
    }
}
