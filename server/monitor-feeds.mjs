/*
 * JAQA Global Monitor — candidate feed catalogue (official / public-sector
 * publishers only). A feed is served ONLY after scripts/verify-monitor.mjs has
 * fetched and parsed it successfully and recorded that in
 * config/monitor-verification.json. Headlines and links only: article text is
 * never fetched, stored or reproduced. Users cannot add URLs (no open proxy).
 * JAQA™ is a trademark of JAQA. © JAQA™. All rights reserved.
 */
export const CATEGORIES = [
  ['world', 'World & diplomacy'],
  ['hazards', 'Disasters & hazards'],
  ['health', 'Health'],
  ['security', 'Security & cyber'],
  ['finance', 'Finance & regulators'],
  ['travel', 'Travel & trade']
];

// format: rss (RSS 2.0 / RDF / Atom, auto-detected), eonet (NASA EONET JSON), geojson (USGS)
export const FEEDS = [
  { id: 'un-news', name: 'UN News — all stories', publisher: 'United Nations', category: 'world', format: 'rss', url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', home: 'https://news.un.org/' },
  { id: 'un-peace', name: 'UN News — peace and security', publisher: 'United Nations', category: 'world', format: 'rss', url: 'https://news.un.org/feed/subscribe/en/news/topic/peace-and-security/feed/rss.xml', home: 'https://news.un.org/' },
  { id: 'wto-news', name: 'WTO news', publisher: 'World Trade Organization', category: 'travel', format: 'rss', url: 'https://www.wto.org/library/rss/latest_news_e.xml', home: 'https://www.wto.org/' },
  { id: 'gdacs', name: 'GDACS disaster alerts', publisher: 'GDACS (UN / European Commission)', category: 'hazards', format: 'rss', url: 'https://www.gdacs.org/xml/rss.xml', home: 'https://www.gdacs.org/' },
  { id: 'eonet', name: 'NASA EONET open natural events', publisher: 'NASA Earth Observatory', category: 'hazards', format: 'eonet', url: 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=60', home: 'https://eonet.gsfc.nasa.gov/' },
  { id: 'usgs-significant', name: 'USGS significant earthquakes — 30 days', publisher: 'U.S. Geological Survey', category: 'hazards', format: 'geojson', url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson', home: 'https://earthquake.usgs.gov/' },
  { id: 'nhc-atlantic', name: 'NHC Atlantic tropical cyclones', publisher: 'NOAA National Hurricane Center', category: 'hazards', format: 'rss', url: 'https://www.nhc.noaa.gov/index-at.xml', home: 'https://www.nhc.noaa.gov/' },
  { id: 'nhc-epacific', name: 'NHC Eastern Pacific tropical cyclones', publisher: 'NOAA National Hurricane Center', category: 'hazards', format: 'rss', url: 'https://www.nhc.noaa.gov/index-ep.xml', home: 'https://www.nhc.noaa.gov/' },
  { id: 'reliefweb-updates', name: 'ReliefWeb humanitarian updates', publisher: 'UN OCHA ReliefWeb', category: 'hazards', format: 'rss', url: 'https://reliefweb.int/updates/rss.xml', home: 'https://reliefweb.int/' },
  { id: 'reliefweb-disasters', name: 'ReliefWeb disasters', publisher: 'UN OCHA ReliefWeb', category: 'hazards', format: 'rss', url: 'https://reliefweb.int/disasters/rss.xml', home: 'https://reliefweb.int/' },
  { id: 'who-news', name: 'WHO news releases', publisher: 'World Health Organization', category: 'health', format: 'rss', url: 'https://www.who.int/rss-feeds/news-english.xml', home: 'https://www.who.int/' },
  { id: 'cisa-advisories', name: 'CISA cybersecurity advisories', publisher: 'U.S. CISA', category: 'security', format: 'rss', url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml', home: 'https://www.cisa.gov/' },
  { id: 'ncsc-uk', name: 'UK NCSC news and advisories', publisher: 'UK National Cyber Security Centre', category: 'security', format: 'rss', url: 'https://www.ncsc.gov.uk/api/1/services/v1/all-rss-feed.xml', home: 'https://www.ncsc.gov.uk/' },
  { id: 'ecb-press', name: 'ECB press releases', publisher: 'European Central Bank', category: 'finance', format: 'rss', url: 'https://www.ecb.europa.eu/rss/press.html', home: 'https://www.ecb.europa.eu/' },
  { id: 'fed-press', name: 'Federal Reserve press releases', publisher: 'U.S. Federal Reserve Board', category: 'finance', format: 'rss', url: 'https://www.federalreserve.gov/feeds/press_all.xml', home: 'https://www.federalreserve.gov/' },
  { id: 'sec-press', name: 'SEC press releases', publisher: 'U.S. Securities and Exchange Commission', category: 'finance', format: 'rss', url: 'https://www.sec.gov/news/pressreleases.rss', home: 'https://www.sec.gov/' },
  { id: 'boe-news', name: 'Bank of England news', publisher: 'Bank of England', category: 'finance', format: 'rss', url: 'https://www.bankofengland.co.uk/rss/news', home: 'https://www.bankofengland.co.uk/' },
  { id: 'bis-press', name: 'BIS press releases', publisher: 'Bank for International Settlements', category: 'finance', format: 'rss', url: 'https://www.bis.org/doclist/all_pressrels.rss', home: 'https://www.bis.org/' },
  { id: 'imf-news', name: 'IMF news', publisher: 'International Monetary Fund', category: 'finance', format: 'rss', url: 'https://www.imf.org/en/News/RSS?language=eng', home: 'https://www.imf.org/' },
  { id: 'us-travel', name: 'U.S. travel advisories', publisher: 'U.S. Department of State', category: 'travel', format: 'rss', url: 'https://travel.state.gov/_res/rss/TAsTWs.xml', home: 'https://travel.state.gov/' },
  { id: 'uk-travel', name: 'UK foreign travel advice', publisher: 'UK FCDO (GOV.UK)', category: 'travel', format: 'rss', url: 'https://www.gov.uk/foreign-travel-advice.atom', home: 'https://www.gov.uk/foreign-travel-advice' }
];
