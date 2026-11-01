import WebKit

/// Blocks the same tracker and ad networks as the desktop app, using WebKit's
/// content blocker (requests are stopped before they leave the phone).
enum Blocker {
    static let domains = [
        "doubleclick.net", "googlesyndication.com", "googleadservices.com", "google-analytics.com",
        "googletagmanager.com", "googletagservices.com", "adservice.google.com", "app-measurement.com",
        "scorecardresearch.com", "quantserve.com", "adnxs.com", "criteo.com", "criteo.net",
        "taboola.com", "outbrain.com", "hotjar.com", "api.segment.io", "cdn.segment.com",
        "amazon-adsystem.com", "ads-twitter.com", "analytics.twitter.com", "connect.facebook.net",
        "pixel.facebook.com", "an.facebook.com", "bat.bing.com", "clarity.ms", "moatads.com",
        "adsrvr.org", "rubiconproject.com", "pubmatic.com", "openx.net", "casalemedia.com",
        "advertising.com", "yieldmo.com", "adform.net", "smartadserver.com", "bidswitch.net",
        "3lift.com", "sharethrough.com", "media.net", "zedo.com", "chartbeat.com", "chartbeat.net",
        "fullstory.com", "mouseflow.com", "crazyegg.com", "luckyorange.com", "mc.yandex.ru",
        "adcolony.com", "analytics.tiktok.com", "ads.linkedin.com", "px.ads.linkedin.com",
        "snap.licdn.com", "tr.snapchat.com", "sc-static.net", "ct.pinterest.com", "q.quora.com",
        "bounceexchange.com", "krxd.net", "demdex.net", "omtrdc.net", "everesttech.net", "agkn.com",
        "rlcdn.com", "tapad.com", "exelator.com", "bluekai.com", "adsafeprotected.com",
        "doubleverify.com", "mixpanel.com", "branch.io", "newrelic.com", "nr-data.net"
    ]

    static func compile(_ done: @escaping @MainActor (WKContentRuleList?) -> Void) {
        let rules: [[String: Any]] = domains.map { domain in
            let escaped = domain.replacingOccurrences(of: ".", with: "\\.")
            return [
                "trigger": ["url-filter": "^[^:]+://+([^:/]+\\.)?\(escaped)[:/]", "load-type": ["third-party"]],
                "action": ["type": "block"]
            ]
        }
        let ruleStore: WKContentRuleListStore? = WKContentRuleListStore.default()
        guard let data = try? JSONSerialization.data(withJSONObject: rules),
              let json = String(data: data, encoding: .utf8),
              let store = ruleStore else {
            Task { @MainActor in done(nil) }
            return
        }
        store.compileContentRuleList(forIdentifier: "pigeon-trackers", encodedContentRuleList: json) { list, _ in
            Task { @MainActor in done(list) }
        }
    }
}
