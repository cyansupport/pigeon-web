import SwiftUI
import CoreLocation

/// Local weather for the start page: the phone's location (iOS asks once) plus Open-Meteo.
@MainActor
final class WeatherModel: NSObject, ObservableObject, CLLocationManagerDelegate {
    struct Day: Identifiable {
        let id: String
        let name: String
        let icon: String
        let high: Int
        let low: Int
    }

    @Published var city = ""
    @Published var temperature: Int?
    @Published var icon = ""
    @Published var condition = 0
    @Published var days: [Day] = []

    private let manager = CLLocationManager()
    private var loadedAt: Date?
    private var lang = "en"

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    /// Updates at most every 15 minutes; asks for location permission the first time.
    func refresh(lang: String) {
        let langChanged = lang != self.lang
        self.lang = lang
        if !langChanged, let loadedAt, Date().timeIntervalSince(loadedAt) < 15 * 60 { return }
        switch manager.authorizationStatus {
        case .notDetermined: manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways: manager.requestLocation()
        default: break
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            if status == .authorizedWhenInUse || status == .authorizedAlways { self.manager.requestLocation() }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        let lat = location.coordinate.latitude, lon = location.coordinate.longitude
        Task { @MainActor in await self.load(lat: lat, lon: lon) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}

    private struct Forecast: Decodable {
        struct Current: Decodable {
            let temperature_2m: Double
            let weather_code: Int
        }
        struct Daily: Decodable {
            let time: [String]
            let weather_code: [Int]
            let temperature_2m_max: [Double]
            let temperature_2m_min: [Double]
        }
        let current: Current
        let daily: Daily
    }

    /// WMO weather code -> emoji and an index into the translated "wx" list.
    static func describe(_ code: Int) -> (String, Int) {
        switch code {
        case 0: return ("☀️", 0)
        case ...3: return ("⛅", 1)
        case ...48: return ("🌫️", 2)
        case ...57: return ("🌦️", 3)
        case ...67: return ("🌧️", 4)
        case ...77: return ("❄️", 5)
        case ...86: return ("🌦️", 6)
        default: return ("⛈️", 7)
        }
    }

    private func load(lat: Double, lon: Double) async {
        let location = CLLocation(latitude: lat, longitude: lon)
        if let place = try? await CLGeocoder().reverseGeocodeLocation(location, preferredLocale: Locale(identifier: lang)).first {
            city = place.locality ?? place.subAdministrativeArea ?? place.administrativeArea ?? ""
        }
        let query = "latitude=\(lat)&longitude=\(lon)&current=temperature_2m,weather_code" +
            "&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4"
        guard let url = URL(string: "https://api.open-meteo.com/v1/forecast?" + query),
              let response = try? await URLSession.shared.data(from: url),
              let forecast = try? JSONDecoder().decode(Forecast.self, from: response.0) else { return }

        (icon, condition) = Self.describe(forecast.current.weather_code)
        temperature = Int(forecast.current.temperature_2m.rounded())
        let parse = DateFormatter()
        parse.dateFormat = "yyyy-MM-dd"
        let dayName = DateFormatter()
        dayName.locale = Locale(identifier: lang)
        dayName.setLocalizedDateFormatFromTemplate("EEE")
        let daily = forecast.daily
        days = daily.time.indices.dropFirst().map { i in
            Day(id: daily.time[i],
                name: parse.date(from: daily.time[i]).map(dayName.string(from:)) ?? "",
                icon: Self.describe(daily.weather_code[i]).0,
                high: Int(daily.temperature_2m_max[i].rounded()),
                low: Int(daily.temperature_2m_min[i].rounded()))
        }
        loadedAt = Date()
    }
}

/// The weather card shown under the search box once the weather has loaded.
struct WeatherCard: View {
    @EnvironmentObject var store: BrowserStore
    @ObservedObject var weather: WeatherModel

    var body: some View {
        if let temperature = weather.temperature {
            let names = store.t("wx").components(separatedBy: "|")
            HStack(spacing: 14) {
                Text(weather.icon).font(.system(size: 40))
                VStack(alignment: .leading, spacing: 2) {
                    Label(weather.city, systemImage: "location.fill")
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("\(temperature)°").font(.system(size: 30, weight: .bold, design: .rounded))
                        Text(names.indices.contains(weather.condition) ? names[weather.condition] : "")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 4)
                HStack(spacing: 10) {
                    ForEach(weather.days) { day in
                        VStack(spacing: 2) {
                            Text(day.name).font(.caption2).foregroundColor(.secondary)
                            Text(day.icon).font(.callout)
                            Text("\(day.high)°").font(.caption2.weight(.semibold))
                            Text("\(day.low)°").font(.caption2).foregroundColor(.secondary)
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .padding(.horizontal, 20)
        }
    }
}
