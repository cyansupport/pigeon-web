// Known ad / tracker hosts. A request is blocked when its hostname equals one
// of these or is a subdomain of one. Only sub-resources are blocked, never the
// page you navigate to.
const TRACKERS = new Set([
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'google-analytics.com',
  'googletagmanager.com', 'googletagservices.com', 'adservice.google.com', 'app-measurement.com',
  'scorecardresearch.com', 'quantserve.com', 'adnxs.com', 'criteo.com', 'criteo.net',
  'taboola.com', 'outbrain.com', 'hotjar.com', 'api.segment.io', 'cdn.segment.com',
  'amazon-adsystem.com', 'ads-twitter.com', 'analytics.twitter.com', 'connect.facebook.net',
  'pixel.facebook.com', 'an.facebook.com', 'bat.bing.com', 'clarity.ms', 'moatads.com',
  'adsrvr.org', 'rubiconproject.com', 'pubmatic.com', 'openx.net', 'casalemedia.com',
  'advertising.com', 'yieldmo.com', 'adform.net', 'smartadserver.com', 'bidswitch.net',
  '3lift.com', 'sharethrough.com', 'media.net', 'zedo.com', 'chartbeat.com', 'chartbeat.net',
  'fullstory.com', 'mouseflow.com', 'crazyegg.com', 'luckyorange.com', 'mc.yandex.ru',
  'adcolony.com', 'analytics.tiktok.com', 'ads.linkedin.com', 'px.ads.linkedin.com',
  'snap.licdn.com', 'tr.snapchat.com', 'sc-static.net', 'ct.pinterest.com', 'q.quora.com',
  'bounceexchange.com', 'krxd.net', 'demdex.net', 'omtrdc.net', 'everesttech.net', 'agkn.com',
  'rlcdn.com', 'tapad.com', 'exelator.com', 'bluekai.com', 'adsafeprotected.com',
  'doubleverify.com', 'mixpanel.com', 'branch.io', 'newrelic.com', 'nr-data.net'
]);

function isTracker(hostname) {
  let host = hostname.toLowerCase();
  while (host.includes('.')) {
    if (TRACKERS.has(host)) return true;
    host = host.slice(host.indexOf('.') + 1);
  }
  return false;
}

module.exports = { isTracker, size: TRACKERS.size };
