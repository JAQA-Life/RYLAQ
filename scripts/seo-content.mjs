/*
 * Crawlable site copy for JAQA's static pages, home-page "About" section,
 * FAQ structured data and llms.txt. Every statement describes what this
 * repository actually implements; counts are computed at build time from the
 * source registry and verification files, never typed in by hand.
 * JAQA™ is a trademark of JAQA. © JAQA™. All rights reserved.
 */
export const TAGLINE = 'Public-source triage for global risk, finance, insurance/reinsurance counterparties, procurement, bids, awards, regulations, events, and supply-chain exposure.';

export const DEFINITION = (n) =>
  `JAQA is a privacy-first web workspace for investigating public evidence about organizations, countries, ports, vulnerabilities, tenders, regulations and global risk events. It queries ${n.live} verified public data sources directly from your browser, includes a photorealistic 3D globe (God’s Eye View) and a Global Monitor of ${n.feeds} official public feeds, and links out to official sources for everything else. It does not store searches, and it does not give credit, sanctions, insurance, legal or investment determinations.`;

export const FEATURES = [
  ['Situation Room', 'A command-center view with an interactive evidence globe, a live wire of public feeds (earthquakes, exploited vulnerabilities, US regulatory notices, ECB reference rates) and the signals from your current investigation.'],
  ['3D Globe (God’s Eye View)', 'The open-source God’s Eye View app (MIT licence, by Bilawal Sidhu), integrated at /globe/: a photorealistic 3D globe with live aircraft, ships, satellites, earthquakes, wildfires, weather, space launches, public cameras and sensor styles (CRT, NVG, FLIR).'],
  ['CesiumJS 3D evidence globe', 'Inside the workspace, your session’s evidence — seismic events, places, the current subject and monitor events — on a CesiumJS 3D Earth (CesiumGS, Apache-2.0) with bundled Natural Earth imagery, so the view makes no third-party requests.'],
  ['Global Monitor', 'Latest headlines from official publishers (UN, WHO, GDACS, NASA EONET, USGS, NOAA NHC, CISA, UK NCSC, ECB, Federal Reserve, SEC, Bank of England, BIS, WTO, US and UK travel advice), an event map, the countries named in the headlines and an ECB FX board.'],
  ['Organization & counterparty evidence', 'Across the workspace: legal-entity (GLEIF LEI) records and parents, SEC filings and 8-K event signals, court dockets, US federal awards, environmental enforcement and product-recall records — each with its source, retrieval time and match confidence.'],
  ['Risk universes', 'A Global Risk Universe of 82 domains and a Finance Risk Universe of 32 domains, each mapped to the public sources that can evidence it and to the gaps where none can.'],
  ['Insurance & procurement lenses', 'Insurer, reinsurer, broker, captive and ILS context, plus tenders, awards, grants, PPPs and concessions — with official link-outs where no verified API exists.']
];

export const PRIVACY_POINTS = [
  'No accounts, cookies, local storage, browser databases, service workers, analytics or tracking pixels.',
  'Workspace searches go directly from your browser to the selected public data providers. They are never sent to JAQA, never written into the URL and never stored.',
  'The JAQA server only fetches fixed, allowlisted official feeds (Global Monitor) and serves the 3D globe’s data providers. It writes no access logs.',
  'Clear Session wipes everything in memory. Closing the tab does the same.',
  'Hosting providers and data providers may keep their own infrastructure logs under their own policies.'
];

// Question → answer pairs. Shown on /faq/ (FAQPage JSON-LD) and, the first
// six, on the home page. Answers are plain text.
export const FAQ = (n) => [
  ['What is JAQA?', DEFINITION(n)],
  ['Where does JAQA’s data come from?', `From public sources only. ${n.live} public APIs are called live from your browser after their browser access (CORS) and response shape were verified from the jaqa.life origin. ${n.feeds} official feeds are fetched by the JAQA server for the Global Monitor after a separate verification run. Everything else — including paid, login-only and unverified sources — is an official link-out. The full list is on the Sources page.`],
  ['Does JAQA store or track my searches?', 'No. JAQA has no accounts, cookies, browser storage, service workers or analytics. Workspace searches go straight from your browser to public data providers and are never sent to or logged by JAQA, or written into the URL. Clear Session wipes the in-memory state.'],
  ['What is the 3D globe?', 'It is God’s Eye View, an open-source app by Bilawal Sidhu (MIT licence), integrated into JAQA at jaqa.life/globe/. It shows a photorealistic 3D Earth with live aircraft, ships, satellites, earthquakes, wildfires, weather, space launches and public cameras, with CRT, NVG and FLIR sensor styles. JAQA can open it at the location you are investigating. The workspace also has its own CesiumJS 3D evidence globe, which plots your session’s evidence using CesiumJS (CesiumGS, Apache-2.0) and bundled imagery, without third-party requests.'],
  ['What is the Global Monitor?', `A live dashboard of ${n.feeds} verified official feeds — for example the UN, WHO, GDACS, NASA EONET, USGS, CISA, the ECB, the Federal Reserve, the SEC and US and UK travel advice. It shows headlines with links to the publisher, an event map from publisher-supplied coordinates, the countries named in the headlines and an ECB FX board. Headlines are shown as published; JAQA does not rank, summarize or verify them.`],
  ['Does JAQA give credit scores, sanctions clearance or advice?', 'No. JAQA shows public evidence with its source, date and match confidence. It does not produce credit scores, sanctions or AML clearance, insurance, underwriting or claims decisions, bid or award predictions, or legal, investment or treasury advice. A missing public record never means “clear”.'],
  ['Which regions does JAQA cover?', 'Global sources such as GLEIF, the World Bank, USGS, Open-Meteo, GDELT, Wikidata and the Global Monitor feeds cover most countries. Several deep sources are US-specific (SEC filings, USAspending awards, the Federal Register, CPSC and NHTSA recalls, CourtListener, EPA ECHO). For other jurisdictions JAQA links to the official registries and portals.'],
  ['How does JAQA verify a data source?', 'A source is used live only after automated checks pass: real requests from the production origin must return the expected data with browser-access (CORS) headers. Monitor feeds are fetched and parsed with the production parser. Results are committed to the code, and sources that fail stay link-out only. Each source shows its status in the Coverage Console.'],
  ['Does JAQA work on phones?', 'Yes. The workspace, the Global Monitor and these pages adapt to phone screens. The 3D globe needs a browser with WebGL; it runs on current phones, but it is heavier than the rest of the site.'],
  ['Is JAQA affiliated with the data providers, God’s Eye View or WorldMonitor?', 'No. JAQA is an independent interface. God’s Eye View is integrated under its MIT licence with credit to its author. The Global Monitor is JAQA’s own code inspired by public situational-awareness dashboards such as WorldMonitor; no WorldMonitor code is used.']
];
