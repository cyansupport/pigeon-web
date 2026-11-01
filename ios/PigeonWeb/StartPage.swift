import SwiftUI

/// The new tab page: logo, greeting, search box, shortcuts and the Discord link.
struct StartPage: View {
    @EnvironmentObject var store: BrowserStore
    @ObservedObject var tab: BrowserTab
    @State private var query = ""
    @State private var adding = false
    @State private var newName = ""
    @State private var newAddress = ""
    @State private var showInvalid = false

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 4)

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        let hello: String
        if hour < 5 {
            hello = store.t("greetNight", ["birds": store.t(store.settings.gooseMode ? "geese" : "pigeons")])
        } else if hour < 12 {
            hello = store.t("greetMorning")
        } else if hour < 18 {
            hello = store.t("greetAfternoon")
        } else {
            hello = store.t("greetEvening")
        }
        let f = DateFormatter()
        f.locale = Locale(identifier: store.lang)
        f.setLocalizedDateFormatFromTemplate("EEEEdMMMM")
        let prefix = store.settings.gooseMode ? store.t("honk") + " " : ""
        return "\(prefix)\(hello) · \(f.string(from: Date()))"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                Image(store.logo)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 96, height: 96)
                    .shadow(color: .black.opacity(0.2), radius: 10, y: 6)
                    .padding(.top, 36)

                (Text(store.birdName + " ").foregroundColor(.primary) + Text("Web").foregroundColor(store.accent))
                    .font(.system(size: 34, weight: .bold, design: .rounded))

                Text(greeting)
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                HStack(spacing: 10) {
                    Image(systemName: "magnifyingglass").foregroundColor(.secondary)
                    TextField(store.t("searchWith", ["engine": store.settings.engine.name]), text: $query)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.webSearch)
                        .submitLabel(.go)
                        .onSubmit {
                            store.navigate(query, in: tab)
                            query = ""
                        }
                }
                .padding(.horizontal, 18)
                .frame(height: 52)
                .background(Color(.secondarySystemBackground), in: Capsule())
                .padding(.horizontal, 20)
                .padding(.top, 10)

                if store.settings.showWeather {
                    WeatherCard(weather: store.weather)
                        .padding(.top, 6)
                }

                LazyVGrid(columns: columns, spacing: 16) {
                    ForEach(store.shortcuts) { shortcut in
                        Button { tab.load(shortcut.url) } label: {
                            ShortcutTile(title: shortcut.title, url: shortcut.url, accent: store.accent)
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            Button(role: .destructive) {
                                store.shortcuts.removeAll { $0.id == shortcut.id }
                            } label: {
                                Label(store.t("delete"), systemImage: "trash")
                            }
                        }
                    }
                    if store.shortcuts.count < 12 {
                        Button {
                            newName = ""
                            newAddress = ""
                            adding = true
                        } label: {
                            AddTile(title: store.t("addShortcut"))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 20)

                Button { tab.load(BrowserStore.discordInvite) } label: {
                    Label(store.t("joinDiscord"), systemImage: "bubble.left.and.bubble.right.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 18)
                        .padding(.vertical, 10)
                        .background(Color(red: 0.35, green: 0.40, blue: 0.95), in: Capsule())
                }
                .padding(.top, 26)
            }
            .frame(maxWidth: .infinity)
            .padding(.bottom, 40)
        }
        .scrollDismissesKeyboard(.interactively)
        .onAppear { if store.settings.showWeather { store.weather.refresh(lang: store.lang) } }
        .onChange(of: store.settings.showWeather) { on in if on { store.weather.refresh(lang: store.lang) } }
        .background(
            LinearGradient(colors: [store.accent.opacity(0.2), Color(.systemBackground)], startPoint: .top, endPoint: .center)
                .ignoresSafeArea()
        )
        .alert(store.t("addShortcut"), isPresented: $adding) {
            TextField(store.t("name"), text: $newName)
            TextField(store.t("webAddress"), text: $newAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.URL)
            Button(store.t("add")) {
                if !store.addShortcut(title: newName, address: newAddress) { showInvalid = true }
            }
            Button(store.t("cancel"), role: .cancel) {}
        }
        .alert(store.t("invalidAddress"), isPresented: $showInvalid) {
            Button("OK", role: .cancel) {}
        }
    }
}

struct ShortcutTile: View {
    let title: String
    let url: URL
    let accent: Color

    private var favicon: URL? {
        guard let host = url.host else { return nil }
        return URL(string: "https://\(host)/favicon.ico")
    }

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                Circle()
                    .fill(Color(.secondarySystemBackground))
                    .frame(width: 54, height: 54)
                AsyncImage(url: favicon) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFit().frame(width: 28, height: 28)
                    } else {
                        Text(String(title.prefix(1)).uppercased())
                            .font(.title3.weight(.bold))
                            .foregroundColor(accent)
                    }
                }
            }
            Text(title)
                .font(.caption)
                .lineLimit(1)
                .foregroundColor(.primary)
        }
    }
}

struct AddTile: View {
    let title: String

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                Circle()
                    .strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [4]))
                    .foregroundColor(.secondary)
                    .frame(width: 54, height: 54)
                Image(systemName: "plus")
                    .font(.title3)
                    .foregroundColor(.secondary)
            }
            Text(title)
                .font(.caption)
                .lineLimit(1)
                .foregroundColor(.secondary)
        }
    }
}
