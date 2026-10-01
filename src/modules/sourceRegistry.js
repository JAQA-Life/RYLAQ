/*
 * sourceRegistry.js — Source Capability Registry, endpoint registry and
 * official link-out directories.
 *
 * HOW TO ADD A NEW SOURCE
 *   1. Add an entry with S('id', 'Display name', { ...fields }) below.
 *   2. If it has a documented public read-only API, set liveCapable:true,
 *      apiBase, endpoints and a `probe` URL (fixed, no user data).
 *   3. Add matching checks to scripts/verify-cors.mjs and run it (locally or
 *      via the "Verify public sources" GitHub workflow).
 *   4. Commit config/cors-verification.json and run `npm run build`.
 *
 * HOW LINK-OUT → LIVE PROMOTION WORKS
 *   A source becomes defaultMode "live" ONLY when config/cors-verification.json
 *   (compiled into corsConfig.js) marks it verified for the production origin.
 *   The build also derives CSP connect-src from that same list, so an
 *   unverified host cannot be contacted in production even by mistake.
 *   Unverified live-capable sources show status "verify" and link-outs.
 *   Paid, login-protected, regulator, rating-agency, market-report and
 *   procurement-portal sources are link-out only by policy and are never
 *   promoted or scraped.
 */
(function (R) {
  'use strict';

  const verification = (R.config.corsVerification && R.config.corsVerification.sources) || {};

  const DEFAULTS = {
    region: 'Global',
    kind: 'api',
    tier: 'C',
    liveCapable: false,
    apiBase: null,
    endpoints: [],
    linkoutSearchUrlTemplate: null,
    linkoutDetailUrlTemplate: null,
    officialDocsUrl: null,
    officialSiteUrl: null,
    attribution: '',
    privacyNote: 'Opened directly by your browser. The provider may log requests under its own policy.',
    safetyNote: '',
    rateLimitPolicy: 'Be conservative; user-triggered requests only.',
    concurrencyLimit: 2,
    timeoutMs: 12000,
    lastVerifiedNote: 'Not verified for live browser access. Link-out only.',
    featureFlag: null,
    mayLagOfficialDb: false,
    publicDataOnly: true,
    controlledAccessProhibited: true,
    paidSourceLinkOutOnly: false,
    regulatorLinkOutOnly: false,
    ratingAgencyLinkOutOnly: false,
    marketReportLinkOutOnly: false,
    procurementPortalLinkOutOnly: false,
    insolvencyRegistryLinkOutOnly: false,
    lienRegistryLinkOutOnly: false,
    sanctionsLinkOutOnly: false,
    guidelineLinkOutOnly: false,
    translationRisk: false,
    deadlineRisk: false,
    officialSourceAuthoritative: false,
    coverageGapWarning: '',
    falseNegativeRisk: false,
    legalReviewRequired: false,
    insuranceSensitive: false,
    financeSensitive: false,
    procurementSensitive: false,
    commercialConfidentialitySensitive: false,
    personalDataSensitive: false,
    keyOptional: false,
    probe: null
  };

  const SOURCES = [];
  function S(id, displayName, props) {
    const v = verification[id];
    const s = Object.assign({ id, displayName }, DEFAULTS, props);
    s.corsVerified = !!(v && v.verified && s.liveCapable);
    s.verificationDetail = v || null;
    s.defaultMode = s.corsVerified ? 'live' : props.download ? 'download' : 'linkout';
    s.status = s.corsVerified ? 'live' : s.liveCapable ? 'verify' : 'linkout';
    if (s.corsVerified) {
      const when = R.config.corsVerification.verifiedAt ? R.config.corsVerification.verifiedAt.slice(0, 10) : 'unknown date';
      s.lastVerifiedNote = `CORS + response shape verified for origin ${R.config.corsVerification.origin} on ${when} (${(v.passingEndpoints || []).join(', ')}). Re-confirm from the deployed origin in the Coverage Console.`;
    } else if (s.liveCapable) {
      s.lastVerifiedNote = v
        ? `Verification did not pass (${(v.checks || []).filter((c) => !c.ok).map((c) => c.id + (c.status ? ' → HTTP ' + c.status : '')).join('; ') || 'no passing checks'}). Link-out only until re-verified.`
        : 'Documented API, not yet verified for browser CORS from the JAQA origin. Link-out only.';
    }
    if (props.serverBacked) {
      // Same-origin feeds fetched by the JAQA server (no browser CORS involved):
      // live only when scripts/verify-monitor.mjs verified at least one feed.
      const mc = R.config.monitor || { feeds: [] };
      const n = (mc.feeds || []).length;
      s.defaultMode = n ? 'live' : 'linkout';
      s.status = n ? 'live' : 'verify';
      s.lastVerifiedNote = n
        ? `${n} official feed(s) verified by server-side fetch on ${(mc.verifiedAt || '').slice(0, 10) || 'unknown date'}. Needs the JAQA server; on static-only hosting this source is unavailable.`
        : 'No monitor feed verified yet. Link-out to the publishers only.';
    }
    SOURCES.push(s);
    return s;
  }

  /* ---------------------------- Tier A ---------------------------- */
  S('gleif', 'GLEIF LEI API', {
    tier: 'A', liveCapable: true, apiBase: 'https://api.gleif.org/api/v1',
    endpoints: ['/lei-records?filter[fulltext]=', '/lei-records/{lei}', '/lei-records/{lei}/direct-parent', '/lei-records/{lei}/ultimate-parent', '/lei-records/{lei}/direct-children'],
    linkoutSearchUrlTemplate: 'https://search.gleif.org/#/search/simpleSearch={q}', linkoutDetailUrlTemplate: 'https://search.gleif.org/#/record/{id}',
    officialDocsUrl: 'https://www.gleif.org/en/lei-data/gleif-api', officialSiteUrl: 'https://www.gleif.org/',
    attribution: 'LEI data provided by GLEIF.', rateLimitPolicy: 'GLEIF fair use (~60 requests/minute). Max 3 concurrent.', concurrencyLimit: 3,
    officialSourceAuthoritative: true, falseNegativeRisk: true,
    coverageGapWarning: 'Many private companies, SMEs and some insurers/brokers have no LEI. Missing LEI does not mean an invalid entity. Parent/child relationships are only as reported to GLEIF.',
    probe: 'https://api.gleif.org/api/v1/lei-records?page%5Bsize%5D=1'
  });
  S('worldbank', 'World Bank Indicators API', {
    tier: 'A', liveCapable: true, apiBase: 'https://api.worldbank.org/v2',
    endpoints: ['/country/{iso}', '/country/{iso}/indicator/{code}'],
    linkoutSearchUrlTemplate: 'https://data.worldbank.org/country/{id}', officialDocsUrl: 'https://datahelpdesk.worldbank.org/knowledgebase/topics/125589', officialSiteUrl: 'https://data.worldbank.org/',
    attribution: 'World Bank data provided by the World Bank Group.', mayLagOfficialDb: true,
    coverageGapWarning: 'Indicators are annual and often lag 1–3 years. Some countries/years are not reported.',
    probe: 'https://api.worldbank.org/v2/country/WLD?format=json'
  });
  S('usgs', 'USGS Earthquake Catalog (FDSN)', {
    tier: 'A', region: 'Global', liveCapable: true, apiBase: 'https://earthquake.usgs.gov/fdsnws/event/1', endpoints: ['/query?format=geojson'],
    officialDocsUrl: 'https://earthquake.usgs.gov/fdsnws/event/1/', officialSiteUrl: 'https://earthquake.usgs.gov/earthquakes/map/',
    attribution: 'Earthquake data provided by USGS.', insuranceSensitive: true,
    coverageGapWarning: 'Seismic events do not confirm facility damage, insured loss or supplier disruption.',
    probe: 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=1&minmagnitude=6'
  });
  S('openmeteo', 'Open-Meteo (forecast + geocoding)', {
    tier: 'A', liveCapable: true, apiBase: 'https://api.open-meteo.com/v1', endpoints: ['/forecast', 'https://geocoding-api.open-meteo.com/v1/search'],
    officialDocsUrl: 'https://open-meteo.com/en/docs', officialSiteUrl: 'https://open-meteo.com/',
    attribution: 'Weather data provided by Open-Meteo and underlying meteorological sources. Geocoding based on GeoNames.',
    rateLimitPolicy: 'Non-commercial fair use (<10,000 calls/day).',
    coverageGapWarning: 'Model forecasts are not official warnings. Geocoding may match the wrong place — verify.',
    probe: 'https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&daily=precipitation_sum&forecast_days=1'
  });
  S('nws', 'NOAA / National Weather Service API', {
    tier: 'A', region: 'United States', liveCapable: true, apiBase: 'https://api.weather.gov', endpoints: ['/alerts/active?point={lat},{lon}'],
    officialDocsUrl: 'https://www.weather.gov/documentation/services-web-api', officialSiteUrl: 'https://www.weather.gov/',
    attribution: 'Weather alert data provided by NOAA/NWS.', officialSourceAuthoritative: true,
    coverageGapWarning: 'US and territories only.', probe: 'https://api.weather.gov/alerts/active?area=DC'
  });
  S('reliefweb', 'ReliefWeb API (OCHA)', {
    tier: 'A', liveCapable: true, apiBase: 'https://api.reliefweb.int/v2', endpoints: ['/reports', '/disasters'],
    linkoutSearchUrlTemplate: 'https://reliefweb.int/updates?search={q}', linkoutDetailUrlTemplate: 'https://reliefweb.int/country/{id}',
    officialDocsUrl: 'https://apidoc.reliefweb.int/', officialSiteUrl: 'https://reliefweb.int/',
    attribution: 'Humanitarian event data provided by ReliefWeb / OCHA.',
    coverageGapWarning: 'API v2 requires a ReliefWeb-approved appname. Until JAQA’s appname is approved and verified, ReliefWeb is link-out only.'
  });
  S('cisaKev', 'CISA Known Exploited Vulnerabilities', {
    tier: 'A', region: 'Global (US agency)', liveCapable: true,
    apiBase: 'https://raw.githubusercontent.com/cisagov/kev-data/develop',
    endpoints: ['/known_exploited_vulnerabilities.json (official cisagov GitHub mirror of https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json)'],
    linkoutSearchUrlTemplate: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', officialDocsUrl: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', officialSiteUrl: 'https://www.cisa.gov/',
    attribution: 'KEV data provided by CISA (official cisagov/kev-data repository).', concurrencyLimit: 1, timeoutMs: 20000,
    coverageGapWarning: 'The cisa.gov feed does not send CORS headers; JAQA uses CISA’s official GitHub mirror. A KEV entry does not prove any supplier uses the affected product/version.',
    rateLimitPolicy: 'Catalog (~1–2 MB) downloaded at most once per session, only when a cyber lookup is triggered.',
    probe: 'https://raw.githubusercontent.com/cisagov/kev-data/develop/known_exploited_vulnerabilities.json'
  });
  S('cpsc', 'CPSC Recalls API', {
    tier: 'A', region: 'United States', liveCapable: true, apiBase: 'https://www.saferproducts.gov/RestWebServices', endpoints: ['/Recall?format=json&RecallTitle=', '/Recall?format=json&RecallNumber='],
    linkoutSearchUrlTemplate: 'https://www.cpsc.gov/Recalls', officialDocsUrl: 'https://www.cpsc.gov/Recalls/CPSC-Recalls-Application-Program-Interface-API-Information', officialSiteUrl: 'https://www.cpsc.gov/Recalls',
    attribution: 'Recall data provided by U.S. Consumer Product Safety Commission.', officialSourceAuthoritative: true, timeoutMs: 15000,
    coverageGapWarning: 'US consumer products only. Name matching is keyword-based and may miss or over-match.',
    probe: 'https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallNumber=26639'
  });
  S('nhtsa', 'NHTSA Recalls API', {
    tier: 'A', region: 'United States', liveCapable: true, apiBase: 'https://api.nhtsa.gov/recalls', endpoints: ['/campaignNumber?campaignNumber=', '/recallsByVehicle?make=&model=&modelYear='],
    linkoutSearchUrlTemplate: 'https://www.nhtsa.gov/recalls', officialDocsUrl: 'https://www.nhtsa.gov/nhtsa-datasets-and-apis', officialSiteUrl: 'https://www.nhtsa.gov/recalls',
    attribution: 'Recall data provided by NHTSA.', officialSourceAuthoritative: true,
    probe: 'https://api.nhtsa.gov/recalls/campaignNumber?campaignNumber=20V314000'
  });
  S('usaspending', 'USAspending API', {
    tier: 'A', region: 'United States', liveCapable: true, apiBase: 'https://api.usaspending.gov/api/v2', endpoints: ['POST /search/spending_by_award/', 'POST /autocomplete/recipient/', 'GET /awards/{generated_award_id}/'],
    linkoutSearchUrlTemplate: 'https://www.usaspending.gov/search', linkoutDetailUrlTemplate: 'https://www.usaspending.gov/award/{id}',
    officialDocsUrl: 'https://api.usaspending.gov/docs/endpoints', officialSiteUrl: 'https://www.usaspending.gov/',
    attribution: 'Federal spending data provided by USAspending.gov.', procurementSensitive: true, mayLagOfficialDb: true, officialSourceAuthoritative: true,
    coverageGapWarning: 'US federal awards only. Recipient names can be ambiguous across parent/subsidiary entities; verify the legal entity (UEI) and contract number.',
    probe: 'https://api.usaspending.gov/api/v2/references/toptier_agencies/'
  });
  S('federalRegister', 'Federal Register API', {
    tier: 'A', region: 'United States', liveCapable: true, apiBase: 'https://www.federalregister.gov/api/v1', endpoints: ['/documents.json?conditions[term]=', '/documents/{number}.json'],
    linkoutSearchUrlTemplate: 'https://www.federalregister.gov/documents/search?conditions%5Bterm%5D={q}', officialDocsUrl: 'https://www.federalregister.gov/developers/documentation/api/v1', officialSiteUrl: 'https://www.federalregister.gov/',
    attribution: 'Regulatory documents provided by Federal Register / GovInfo.', legalReviewRequired: true, officialSourceAuthoritative: true,
    probe: 'https://www.federalregister.gov/api/v1/documents.json?per_page=1'
  });
  S('sec', 'SEC EDGAR submissions', {
    tier: 'A', region: 'United States', liveCapable: true, apiBase: 'https://data.sec.gov', endpoints: ['/submissions/CIK##########.json'],
    linkoutSearchUrlTemplate: 'https://www.sec.gov/cgi-bin/browse-edgar?company={q}&owner=exclude&action=getcompany', linkoutDetailUrlTemplate: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={id}&owner=exclude',
    officialDocsUrl: 'https://www.sec.gov/search-filings/edgar-application-programming-interfaces', officialSiteUrl: 'https://www.sec.gov/edgar/search/',
    attribution: 'Public company filings provided by U.S. SEC EDGAR.', financeSensitive: true, officialSourceAuthoritative: true, concurrencyLimit: 1,
    rateLimitPolicy: 'SEC fair access: max 10 requests/second; JAQA sends at most 1 at a time, user-triggered.',
    coverageGapWarning: 'SEC registrants only. Private companies and most non-US insurers are not covered.',
    probe: 'https://data.sec.gov/submissions/CIK0000320193.json'
  });
  S('secXbrl', 'SEC EDGAR XBRL company facts', {
    tier: 'A', region: 'United States', liveCapable: true, apiBase: 'https://data.sec.gov/api/xbrl', endpoints: ['/companyfacts/CIK##########.json'],
    linkoutDetailUrlTemplate: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={id}&type=10-K&owner=exclude', officialDocsUrl: 'https://www.sec.gov/search-filings/edgar-application-programming-interfaces',
    attribution: 'XBRL financial data provided by U.S. SEC EDGAR.', financeSensitive: true, concurrencyLimit: 1, timeoutMs: 20000,
    coverageGapWarning: 'The companyfacts endpoint returned no CORS header in verification, so XBRL facts and derived metrics are link-out only (filing index remains live).',
    probe: 'https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json'
  });
  S('secFullText', 'SEC EDGAR full-text search', {
    tier: 'B', region: 'United States', liveCapable: true, apiBase: 'https://efts.sec.gov/LATEST', endpoints: ['/search-index?q='],
    linkoutSearchUrlTemplate: 'https://www.sec.gov/edgar/search/#/q=%22{q}%22', attribution: 'Filing text search provided by U.S. SEC EDGAR.', financeSensitive: true,
    coverageGapWarning: 'No CORS header returned in verification; link-out only.'
  });
  S('ted', 'TED — Tenders Electronic Daily API', {
    tier: 'A', region: 'European Union / EEA', liveCapable: true, apiBase: 'https://api.ted.europa.eu/v3', endpoints: ['POST /notices/search'],
    linkoutSearchUrlTemplate: 'https://ted.europa.eu/en/search/result?FT={q}', linkoutDetailUrlTemplate: 'https://ted.europa.eu/en/notice/-/detail/{id}',
    officialDocsUrl: 'https://docs.ted.europa.eu/api/latest/index.html', officialSiteUrl: 'https://ted.europa.eu/',
    attribution: 'EU tender data provided by TED / Publications Office of the European Union.',
    procurementSensitive: true, translationRisk: true, deadlineRisk: true, officialSourceAuthoritative: true,
    coverageGapWarning: 'Only above-threshold EU/EEA notices. The search API currently does not return CORS headers for browser POSTs, so TED is link-out only.'
  });
  S('sam', 'SAM.gov opportunities & exclusions', {
    tier: 'A', region: 'United States', linkoutSearchUrlTemplate: 'https://sam.gov/search/?index=ex', officialSiteUrl: 'https://sam.gov/', officialDocsUrl: 'https://open.gsa.gov/api/',
    attribution: 'Federal exclusion/opportunity data provided by SAM.gov / GSA.', procurementSensitive: true, sanctionsLinkOutOnly: true, falseNegativeRisk: true, officialSourceAuthoritative: true, deadlineRisk: true,
    coverageGapWarning: 'API requires a registered key; link-out only. An exclusion search is not sanctions clearance.'
  });
  S('ofac', 'OFAC Sanctions List Search', {
    tier: 'A', region: 'United States', linkoutSearchUrlTemplate: 'https://sanctionssearch.ofac.treas.gov/', officialSiteUrl: 'https://ofac.treasury.gov/',
    attribution: 'Sanctions information provided by OFAC / U.S. Department of the Treasury.', sanctionsLinkOutOnly: true, falseNegativeRisk: true, legalReviewRequired: true, officialSourceAuthoritative: true,
    coverageGapWarning: 'No hit ≠ clear. Name screening requires a sanctions screening system of record and compliance review.'
  });
  S('epa', 'EPA ECHO facility search', {
    tier: 'A', region: 'United States', liveCapable: true, apiBase: 'https://echodata.epa.gov/echo', endpoints: ['/echo_rest_services.get_facility_info?output=JSON&p_fn='],
    linkoutSearchUrlTemplate: 'https://echo.epa.gov/facilities/facility-search', officialDocsUrl: 'https://echo.epa.gov/tools/web-services', officialSiteUrl: 'https://echo.epa.gov/',
    attribution: 'Environmental compliance data provided by U.S. EPA ECHO.', timeoutMs: 20000, concurrencyLimit: 1, mayLagOfficialDb: true,
    coverageGapWarning: 'US regulated facilities only. Facility-name matches are not legal-entity matches.',
    probe: 'https://echodata.epa.gov/echo/echo_rest_services.get_facility_info?output=JSON&p_fn=ZZZZJAQAPROBE'
  });
  S('courtlistener', 'CourtListener (Free Law Project)', {
    tier: 'A', region: 'United States', liveCapable: true, apiBase: 'https://www.courtlistener.com/api/rest/v4', endpoints: ['/search/?type=r', '/search/?type=o'],
    linkoutSearchUrlTemplate: 'https://www.courtlistener.com/?q={q}', officialDocsUrl: 'https://www.courtlistener.com/help/api/rest/', officialSiteUrl: 'https://www.courtlistener.com/',
    attribution: 'Court records/metadata provided by CourtListener / RECAP (Free Law Project).', legalReviewRequired: true, falseNegativeRisk: true, concurrencyLimit: 1, timeoutMs: 15000,
    coverageGapWarning: 'Partial US federal coverage (RECAP is crowd-sourced). Not a complete litigation history. PACER is fee-based and is not bypassed.',
    probe: 'https://www.courtlistener.com/api/rest/v4/search/?q=%22reinsurance%22&type=o'
  });
  S('overpass', 'OpenStreetMap Overpass API', {
    tier: 'A', liveCapable: true, apiBase: 'https://overpass-api.de/api', endpoints: ['/interpreter?data='],
    officialDocsUrl: 'https://wiki.openstreetmap.org/wiki/Overpass_API', officialSiteUrl: 'https://www.openstreetmap.org/',
    attribution: 'Geographic data © OpenStreetMap contributors (ODbL).', concurrencyLimit: 1, timeoutMs: 25000,
    rateLimitPolicy: 'Shared community server: one small user-triggered query at a time. No map tiles.',
    coverageGapWarning: 'Community-mapped; completeness varies. Not a facility register.'
  });
  S('wikidata', 'Wikidata', {
    tier: 'A', liveCapable: true, apiBase: 'https://www.wikidata.org/w/api.php', endpoints: ['?action=wbsearchentities', '?action=wbgetentities'],
    linkoutDetailUrlTemplate: 'https://www.wikidata.org/wiki/{id}', officialDocsUrl: 'https://www.wikidata.org/wiki/Wikidata:Data_access', officialSiteUrl: 'https://www.wikidata.org/',
    attribution: 'Entity background data provided by Wikidata (CC0).',
    coverageGapWarning: 'Community-edited and not authoritative for legal, insurance, sanctions, credit, procurement, or financial status.',
    probe: 'https://www.wikidata.org/w/api.php?action=wbsearchentities&search=GLEIF&language=en&format=json&limit=1&origin=*'
  });
  S('wikipedia', 'Wikipedia REST API', {
    tier: 'A', liveCapable: true, apiBase: 'https://en.wikipedia.org/api/rest_v1', endpoints: ['/page/summary/{title}'],
    linkoutSearchUrlTemplate: 'https://en.wikipedia.org/wiki/Special:Search?search={q}', officialSiteUrl: 'https://en.wikipedia.org/',
    attribution: 'Background summaries from Wikipedia (CC BY-SA).',
    coverageGapWarning: 'Encyclopedic background only; not authoritative.', probe: 'https://en.wikipedia.org/api/rest_v1/page/summary/Legal_Entity_Identifier'
  });

  /* ---------------------------- Tier B ---------------------------- */
  S('nvd', 'NIST National Vulnerability Database', {
    tier: 'B', liveCapable: true, apiBase: 'https://services.nvd.nist.gov/rest/json/cves/2.0', endpoints: ['?cveId=', '?keywordSearch='],
    linkoutDetailUrlTemplate: 'https://nvd.nist.gov/vuln/detail/{id}', officialDocsUrl: 'https://nvd.nist.gov/developers/vulnerabilities', officialSiteUrl: 'https://nvd.nist.gov/',
    attribution: 'CVE data provided by NVD. This product uses the NVD API but is not endorsed or certified by the NVD.',
    rateLimitPolicy: 'Without a key: 5 requests per rolling 30 seconds. JAQA sends one at a time, user-triggered.', concurrencyLimit: 1, timeoutMs: 20000,
    coverageGapWarning: 'CVE records do not prove a supplier uses the affected product/version.',
    probe: 'https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=CVE-2021-44228'
  });
  S('ecb', 'ECB Data Portal API', {
    tier: 'B', region: 'Euro area', liveCapable: true, apiBase: 'https://data-api.ecb.europa.eu/service', endpoints: ['/data/EXR/D.{CUR}.EUR.SP00.A?format=jsondata'],
    officialDocsUrl: 'https://data.ecb.europa.eu/help/api/overview', officialSiteUrl: 'https://data.ecb.europa.eu/',
    attribution: 'ECB data provided by the European Central Bank.', financeSensitive: true, officialSourceAuthoritative: true,
    coverageGapWarning: 'Euro foreign exchange reference rates are for information only; they are not tradable prices.',
    probe: 'https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?format=jsondata&lastNObservations=1'
  });
  S('fred', 'FRED (Federal Reserve Bank of St. Louis)', {
    tier: 'B', region: 'United States / Global', linkoutSearchUrlTemplate: 'https://fred.stlouisfed.org/searchresults/?st={q}', officialSiteUrl: 'https://fred.stlouisfed.org/', officialDocsUrl: 'https://fred.stlouisfed.org/docs/api/fred/',
    attribution: 'Economic data provided by FRED / Federal Reserve Bank of St. Louis where used.', financeSensitive: true,
    coverageGapWarning: 'API requires a key and does not return browser CORS headers; link-out only.'
  });
  S('imf', 'IMF data & country resources', {
    tier: 'B', linkoutDetailUrlTemplate: 'https://www.imf.org/en/Countries/{id}', officialSiteUrl: 'https://www.imf.org/en/Data', attribution: 'IMF data/resources provided by the International Monetary Fund where used.', financeSensitive: true,
    coverageGapWarning: 'DataMapper API refused automated verification requests; link-out only. WEO series include projections.'
  });
  S('oecd', 'OECD data & resources', { tier: 'B', officialSiteUrl: 'https://www.oecd.org/', linkoutSearchUrlTemplate: 'https://data-explorer.oecd.org/', attribution: 'OECD data/resources provided by the OECD where used.' });
  S('bis', 'BIS statistics', { tier: 'B', officialSiteUrl: 'https://data.bis.org/', attribution: 'BIS data provided by the Bank for International Settlements where used.', financeSensitive: true });
  S('un', 'United Nations resources (UNGM, UN Stats, UN sanctions)', { tier: 'B', officialSiteUrl: 'https://www.un.org/', attribution: 'UN data/resources provided by the United Nations where used.' });
  S('ilo', 'International Labour Organization', { tier: 'B', officialSiteUrl: 'https://www.ilo.org/', attribution: 'ILO data/resources provided by the International Labour Organization where used.', guidelineLinkOutOnly: true });
  S('firms', 'NASA FIRMS active fire data', { tier: 'B', officialSiteUrl: 'https://firms.modaps.eosdis.nasa.gov/map/', attribution: 'NASA FIRMS data provided by NASA where used.', coverageGapWarning: 'API requires a MAP_KEY; link-out only.' });
  S('comtrade', 'UN Comtrade', { tier: 'B', officialSiteUrl: 'https://comtradeplus.un.org/', attribution: 'Trade data provided by UN Comtrade where used.', mayLagOfficialDb: true, coverageGapWarning: 'Keyed API without browser CORS; link-out only. Aggregated, lagging data; no shipment-level visibility.' });
  S('acled', 'ACLED conflict data', { tier: 'B', officialSiteUrl: 'https://acleddata.com/', attribution: 'Event data provided by ACLED where used.', coverageGapWarning: 'Registration/key and licence terms required; link-out only.' });
  S('gdelt', 'GDELT DOC 2.0 API', {
    tier: 'B', liveCapable: true, apiBase: 'https://api.gdeltproject.org/api/v2', endpoints: ['/doc/doc?mode=artlist&format=json'],
    officialDocsUrl: 'https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/', officialSiteUrl: 'https://www.gdeltproject.org/',
    attribution: 'Media event data provided by the GDELT Project where used.', concurrencyLimit: 1, timeoutMs: 15000,
    rateLimitPolicy: 'GDELT asks for at most one request every 5 seconds; JAQA sends user-triggered requests only.',
    coverageGapWarning: 'Noisy media signals, not truth, and not adverse-media screening. Rate-limit responses omit CORS headers, so a throttled request appears as unavailable for the session.',
    probe: 'https://api.gdeltproject.org/api/v2/doc/doc?query=%22port%20congestion%22&mode=artlist&format=json&maxrecords=1'
  });
  S('opencorporates', 'OpenCorporates', { tier: 'B', linkoutSearchUrlTemplate: 'https://opencorporates.com/companies?q={q}', officialSiteUrl: 'https://opencorporates.com/', attribution: 'Company registry data provided by OpenCorporates where used.', coverageGapWarning: 'API requires a token; link-out only.' });
  S('companiesHouse', 'UK Companies House', {
    tier: 'B', region: 'United Kingdom', linkoutSearchUrlTemplate: 'https://find-and-update.company-information.service.gov.uk/search?q={q}', linkoutDetailUrlTemplate: 'https://find-and-update.company-information.service.gov.uk/company/{id}',
    officialSiteUrl: 'https://find-and-update.company-information.service.gov.uk/', officialDocsUrl: 'https://developer.company-information.service.gov.uk/',
    attribution: 'UK company data provided by Companies House where used.', officialSourceAuthoritative: true, insolvencyRegistryLinkOutOnly: true, lienRegistryLinkOutOnly: true,
    coverageGapWarning: 'API requires a key; link-out only in this release (extension point: in-memory browser key).'
  });

  /* ------------- Server-backed (same-origin JAQA server) ------------- */
  S('jaqaMonitor', 'JAQA Global Monitor — official public feeds (via the JAQA server)', {
    tier: 'B', region: 'Global', liveCapable: true, serverBacked: true, apiBase: '/api/jaqa/monitor', endpoints: ['/feed?id={feed}'],
    officialSiteUrl: 'https://jaqa.life/', attribution: 'Headlines and links from the listed official publishers, fetched by the JAQA server. Content and copyright remain with each publisher.',
    coverageGapWarning: 'A selected set of official feeds. Headlines are not the full story and are not verified, ranked or summarized by JAQA.',
    rateLimitPolicy: 'Server-side cache of 10 minutes per feed. Max 4 concurrent.', concurrencyLimit: 4, officialSourceAuthoritative: true
  });

  /* ------------------ Tier C (link-out only by policy) ------------------ */
  S('insuranceRegulators', 'Insurance regulators (IAIS, EIOPA, NAIC, FCA/PRA, BaFin, APRA, OSFI, NFRA, IRDAI…)', { kind: 'directory', regulatorLinkOutOnly: true, insuranceSensitive: true, officialSourceAuthoritative: true, legalReviewRequired: true, attribution: 'Regulatory information provided by the respective supervisory authorities.' });
  S('ratingAgencies', 'Rating agencies (AM Best, S&P, Moody’s, Fitch, KBRA)', { kind: 'directory', ratingAgencyLinkOutOnly: true, paidSourceLinkOutOnly: true, insuranceSensitive: true, financeSensitive: true, safetyNote: 'Ratings are never scraped, reproduced or derived.' });
  S('marketReports', 'Insurance / reinsurance market reports', { kind: 'directory', marketReportLinkOutOnly: true, paidSourceLinkOutOnly: true, insuranceSensitive: true, safetyNote: 'Reports are never scraped or reproduced.' });
  S('procurementPortals', 'Global procurement portals & development banks', { kind: 'directory', procurementPortalLinkOutOnly: true, procurementSensitive: true, translationRisk: true, deadlineRisk: true, officialSourceAuthoritative: true, safetyNote: 'Portals are never scraped. Login-protected portals are link-out only.' });
  S('sanctionsLists', 'Sanctions, debarment & export-control lists', { kind: 'directory', sanctionsLinkOutOnly: true, falseNegativeRisk: true, legalReviewRequired: true, officialSourceAuthoritative: true });
  S('insolvencyRegistries', 'Insolvency & bankruptcy registries', { kind: 'directory', insolvencyRegistryLinkOutOnly: true, falseNegativeRisk: true, legalReviewRequired: true, financeSensitive: true });
  S('lienRegistries', 'Lien, UCC, charges & judgment registries', { kind: 'directory', lienRegistryLinkOutOnly: true, falseNegativeRisk: true, legalReviewRequired: true, financeSensitive: true });
  S('standards', 'Standards & frameworks publishers', { kind: 'directory', guidelineLinkOutOnly: true, safetyNote: 'References, not certifications.' });
  S('paidCommercial', 'Paid / commercial data providers', { kind: 'directory', paidSourceLinkOutOnly: true, publicDataOnly: false, safetyNote: 'Never scraped, reproduced or bypassed. Listed for orientation only; no affiliation.' });
  S('internalSystems', 'Internal enterprise systems (ERP, vendor master, claims, treasury…)', { kind: 'unavailable', publicDataOnly: false, commercialConfidentialitySensitive: true, personalDataSensitive: true, safetyNote: 'Unavailable by design. JAQA never accepts internal or confidential data.' });
  // Internal systems are unavailable by design (never link-out, never live).
  SOURCES[SOURCES.length - 1].defaultMode = 'unavailable';
  SOURCES[SOURCES.length - 1].status = 'unavailable';

  R.sources = {
    list: SOURCES,
    get: (id) => SOURCES.find((s) => s.id === id),
    liveHosts() {
      const hosts = new Set();
      SOURCES.filter((s) => s.corsVerified).forEach((s) => {
        [s.apiBase, ...(s.endpoints || [])].forEach((e) => {
          const m = /^https:\/\/[^/\s]+/.exec(e || '');
          if (m) hosts.add(m[0]);
        });
      });
      return [...hosts];
    }
  };

  /* ------------------------------------------------------------------ *
   * Official link-out directories. Every entry is opened by the USER’S
   * browser in a new tab; nothing is fetched or scraped by JAQA.
   * `search` templates carry the query only when the user has not enabled
   * “official-link-only mode”.
   * ------------------------------------------------------------------ */
  const L = (name, url, extra) => Object.assign({ name, url }, extra || {});
  R.directories = {
    entity: [
      L('GLEIF LEI Search', 'https://search.gleif.org/', { search: 'https://search.gleif.org/#/search/simpleSearch={q}', region: 'Global', kind: 'official' }),
      L('SEC EDGAR company search', 'https://www.sec.gov/edgar/searchedgar/companysearch', { search: 'https://www.sec.gov/cgi-bin/browse-edgar?company={q}&owner=exclude&action=getcompany', region: 'United States', kind: 'official' }),
      L('UK Companies House', 'https://find-and-update.company-information.service.gov.uk/', { search: 'https://find-and-update.company-information.service.gov.uk/search?q={q}', region: 'United Kingdom', kind: 'official' }),
      L('EU business registers (e-Justice / BRIS)', 'https://e-justice.europa.eu/topics/registers-business-insolvency-land/business-registers-search-company-eu_en', { region: 'European Union', kind: 'official' }),
      L('OpenCorporates', 'https://opencorporates.com/', { search: 'https://opencorporates.com/companies?q={q}', region: 'Global', kind: 'reference' }),
      L('Wikipedia search', 'https://en.wikipedia.org/', { search: 'https://en.wikipedia.org/wiki/Special:Search?search={q}', kind: 'reference', note: 'Non-authoritative background.' })
    ],
    sanctions: [
      L('OFAC Sanctions List Search', 'https://sanctionssearch.ofac.treas.gov/', { region: 'United States', kind: 'sanctions' }),
      L('OFAC SDN List', 'https://ofac.treasury.gov/specially-designated-nationals-and-blocked-persons-list-sdn-human-readable-lists', { region: 'United States', kind: 'sanctions' }),
      L('EU Sanctions Map', 'https://www.sanctionsmap.eu/', { region: 'European Union', kind: 'sanctions' }),
      L('EU consolidated financial sanctions list', 'https://data.europa.eu/data/datasets/consolidated-list-of-persons-groups-and-entities-subject-to-eu-financial-sanctions', { region: 'European Union', kind: 'sanctions' }),
      L('UK sanctions list (FCDO / OFSI)', 'https://www.gov.uk/government/publications/the-uk-sanctions-list', { region: 'United Kingdom', kind: 'sanctions' }),
      L('UN Security Council Consolidated List', 'https://main.un.org/securitycouncil/en/content/un-sc-consolidated-list', { region: 'Global', kind: 'sanctions' }),
      L('US Consolidated Screening List (trade.gov)', 'https://www.trade.gov/consolidated-screening-list', { region: 'United States', kind: 'export-control', note: 'Includes BIS Entity List, Denied Persons, Unverified List and others.' }),
      L('BIS Entity List', 'https://www.bis.gov/entity-list', { region: 'United States', kind: 'export-control' }),
      L('SAM.gov exclusions', 'https://sam.gov/search/?index=ex', { region: 'United States', kind: 'debarment' }),
      L('World Bank debarred firms & individuals', 'https://www.worldbank.org/en/projects-operations/procurement/debarred-firms', { region: 'Global (IFI)', kind: 'debarment' }),
      L('ADB Office of Anticorruption and Integrity (sanctions)', 'https://www.adb.org/who-we-are/integrity', { region: 'Asia-Pacific (IFI)', kind: 'debarment' }),
      L('AfDB debarment list', 'https://www.afdb.org/en/projects-and-operations/procurement/debarment-and-sanctions-procedures', { region: 'Africa (IFI)', kind: 'debarment' }),
      L('IDB sanctioned firms & individuals', 'https://www.iadb.org/en/who-we-are/topics/transparency/integrity-at-the-idb-group/sanctioned-firms-and-individuals', { region: 'Latin America (IFI)', kind: 'debarment' }),
      L('EBRD ineligible entities', 'https://www.ebrd.com/ineligible-entities.html', { region: 'Europe/Central Asia (IFI)', kind: 'debarment' }),
      L('UFLPA Entity List (DHS)', 'https://www.dhs.gov/uflpa-entity-list', { region: 'United States', kind: 'export-control' })
    ],
    enforcement: [
      L('SEC litigation releases', 'https://www.sec.gov/enforcement-litigation/litigation-releases', { region: 'United States' }),
      L('US DOJ news & press releases', 'https://www.justice.gov/news', { region: 'United States' }),
      L('FTC cases & proceedings', 'https://www.ftc.gov/legal-library/browse/cases-proceedings', { region: 'United States' }),
      L('FinCEN enforcement actions', 'https://www.fincen.gov/news-room/enforcement-actions', { region: 'United States' }),
      L('UK FCA enforcement', 'https://www.fca.org.uk/about/enforcement', { region: 'United Kingdom' }),
      L('UK Serious Fraud Office cases', 'https://www.sfo.gov.uk/our-cases/', { region: 'United Kingdom' }),
      L('FATF high-risk jurisdictions', 'https://www.fatf-gafi.org/en/topics/high-risk-and-other-monitored-jurisdictions.html', { region: 'Global' }),
      L('OpenSanctions (reference, no auto-screening)', 'https://www.opensanctions.org/', { region: 'Global', kind: 'reference', note: 'Third-party aggregation; link-out only, no clearance.' })
    ],
    insolvency: [
      L('UK Gazette insolvency notices', 'https://www.thegazette.co.uk/insolvency', { region: 'United Kingdom' }),
      L('UK Insolvency Service', 'https://www.gov.uk/government/organisations/insolvency-service', { region: 'United Kingdom' }),
      L('EU bankruptcy & insolvency registers (e-Justice)', 'https://e-justice.europa.eu/topics/registers-business-insolvency-land/bankruptcy-insolvency-registers_en', { region: 'European Union' }),
      L('US Bankruptcy Courts (uscourts.gov)', 'https://www.uscourts.gov/court-programs/bankruptcy', { region: 'United States' }),
      L('PACER (fee-based; no bypass)', 'https://pacer.uscourts.gov/', { region: 'United States', kind: 'paid' }),
      L('ASIC published notices', 'https://publishednotices.asic.gov.au/', { region: 'Australia' }),
      L('Canada Office of the Superintendent of Bankruptcy', 'https://ised-isde.canada.ca/site/office-superintendent-bankruptcy/en', { region: 'Canada' }),
      L('Insolvency and Bankruptcy Board of India', 'https://ibbi.gov.in/', { region: 'India' }),
      L('New Zealand Insolvency & Trustee Service', 'https://www.insolvency.govt.nz/', { region: 'New Zealand' }),
      L('Singapore Insolvency Office (MinLaw)', 'https://www.mlaw.gov.sg/', { region: 'Singapore' })
    ],
    lien: [
      L('US state UCC filing offices (NASS directory)', 'https://www.nass.org/', { region: 'United States', note: 'UCC filings are searched per state Secretary of State.' }),
      L('UK Companies House charges (per company)', 'https://find-and-update.company-information.service.gov.uk/', { region: 'United Kingdom' }),
      L('Australia PPSR', 'https://www.ppsr.gov.au/', { region: 'Australia' }),
      L('New Zealand PPSR', 'https://www.ppsr.govt.nz/', { region: 'New Zealand' }),
      L('CourtListener judgments (US, partial)', 'https://www.courtlistener.com/', { search: 'https://www.courtlistener.com/?q={q}', region: 'United States' })
    ],
    insuranceRegulators: [
      L('IAIS — International Association of Insurance Supervisors', 'https://www.iaisweb.org/', { region: 'Global' }),
      L('IAIS member directory', 'https://www.iaisweb.org/about-the-iais/iais-members/', { region: 'Global', note: 'Directory of national insurance supervisors.' }),
      L('EIOPA register of insurance undertakings', 'https://register.eiopa.europa.eu/', { region: 'European Union' }),
      L('EIOPA', 'https://www.eiopa.europa.eu/', { region: 'European Union' }),
      L('NAIC — state insurance departments', 'https://content.naic.org/state-insurance-departments', { region: 'United States' }),
      L('NAIC Consumer Insurance Search', 'https://content.naic.org/cis_consumer_information.htm', { region: 'United States' }),
      L('UK FCA Financial Services Register', 'https://register.fca.org.uk/s/', { region: 'United Kingdom' }),
      L('UK PRA (Bank of England)', 'https://www.bankofengland.co.uk/prudential-regulation', { region: 'United Kingdom' }),
      L('BaFin company database', 'https://portal.mvp.bafin.de/database/InstInfo/', { region: 'Germany' }),
      L('APRA (Australia)', 'https://www.apra.gov.au/', { region: 'Australia' }),
      L('OSFI (Canada)', 'https://www.osfi-bsif.gc.ca/', { region: 'Canada' }),
      L('NFRA (China, former CBIRC)', 'https://www.nfra.gov.cn/', { region: 'China', lang: 'zh', translationRisk: true }),
      L('IRDAI (India)', 'https://irdai.gov.in/', { region: 'India' }),
      L('MAS financial institutions directory (Singapore)', 'https://eservices.mas.gov.sg/fid', { region: 'Singapore' }),
      L('FINMA (Switzerland)', 'https://www.finma.ch/en/', { region: 'Switzerland' }),
      L('Bermuda Monetary Authority (insurance, captives, ILS)', 'https://www.bma.bm/', { region: 'Bermuda' }),
      L('Cayman Islands Monetary Authority', 'https://www.cima.ky/', { region: 'Cayman Islands' }),
      L('Guernsey Financial Services Commission', 'https://www.gfsc.gg/', { region: 'Guernsey' }),
      L('Vermont captive insurance (DFR)', 'https://dfr.vermont.gov/industry/insurance/captive-insurance', { region: 'United States (Vermont)' })
    ],
    ratingAgencies: [
      L('AM Best', 'https://web.ambest.com/', { kind: 'rating-agency' }),
      L('S&P Global Ratings', 'https://www.spglobal.com/ratings/en/', { kind: 'rating-agency' }),
      L('Moody’s Ratings', 'https://ratings.moodys.com/', { kind: 'rating-agency' }),
      L('Fitch Ratings', 'https://www.fitchratings.com/', { kind: 'rating-agency' }),
      L('KBRA', 'https://www.kbra.com/', { kind: 'rating-agency' })
    ],
    marketReports: [
      L('Swiss Re Institute (sigma)', 'https://www.swissre.com/institute/', { kind: 'market-report' }),
      L('Munich Re natural catastrophe resources', 'https://www.munichre.com/en/risks/natural-disasters.html', { kind: 'market-report' }),
      L('Gallagher Re', 'https://www.ajg.com/gallagherre/', { kind: 'market-report' }),
      L('Aon reinsurance insights', 'https://www.aon.com/en/insights', { kind: 'market-report' }),
      L('Marsh global insurance market index', 'https://www.marsh.com/en/services/international-placement-services/insights/global-insurance-market-index.html', { kind: 'market-report' }),
      L('Guy Carpenter', 'https://www.guycarp.com/', { kind: 'market-report' }),
      L('Lloyd’s of London', 'https://www.lloyds.com/', { kind: 'market-report', note: 'Public market and syndicate information.' }),
      L('Artemis ILS / cat bond deal directory', 'https://www.artemis.bm/deal-directory/', { kind: 'market-report', note: 'Industry news directory; not investment advice.' })
    ],
    procurement: [
      L('TED — Tenders Electronic Daily', 'https://ted.europa.eu/', { search: 'https://ted.europa.eu/en/search/result?FT={q}', region: 'European Union', lang: 'multi', translationRisk: true }),
      L('EU Funding & Tenders Portal', 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/', { region: 'European Union', grant: true }),
      L('UK Find a Tender', 'https://www.find-tender.service.gov.uk/', { region: 'United Kingdom' }),
      L('UK Contracts Finder', 'https://www.contractsfinder.service.gov.uk/', { region: 'United Kingdom' }),
      L('SAM.gov contract opportunities', 'https://sam.gov/search/?index=opp', { region: 'United States' }),
      L('USAspending award search', 'https://www.usaspending.gov/search', { region: 'United States' }),
      L('CanadaBuys', 'https://canadabuys.canada.ca/', { region: 'Canada', lang: 'en/fr' }),
      L('AusTender', 'https://www.tenders.gov.au/', { region: 'Australia' }),
      L('New Zealand GETS', 'https://www.gets.govt.nz/', { region: 'New Zealand' }),
      L('Singapore GeBIZ', 'https://www.gebiz.gov.sg/', { region: 'Singapore' }),
      L('India CPPP (eProcure)', 'https://eprocure.gov.in/', { region: 'India' }),
      L('India GeM', 'https://gem.gov.in/', { region: 'India' }),
      L('Brazil gov.br Compras', 'https://www.gov.br/compras/', { region: 'Brazil', lang: 'pt', translationRisk: true }),
      L('Mexico federal procurement (ComprasMX)', 'https://comprasmx.buengobierno.gob.mx/', { region: 'Mexico', lang: 'es', translationRisk: true }),
      L('Switzerland simap', 'https://www.simap.ch/', { region: 'Switzerland', lang: 'de/fr/it', translationRisk: true }),
      L('Norway Doffin', 'https://doffin.no/', { region: 'Norway', lang: 'no', translationRisk: true }),
      L('Denmark udbud.dk', 'https://udbud.dk/', { region: 'Denmark', lang: 'da', translationRisk: true }),
      L('Finland Hilma', 'https://www.hankintailmoitukset.fi/', { region: 'Finland', lang: 'fi/sv', translationRisk: true }),
      L('Japan government procurement (JETRO)', 'https://www.jetro.go.jp/en/database/procurement/', { region: 'Japan' }),
      L('Korea KONEPS', 'https://www.g2b.go.kr/', { region: 'South Korea', lang: 'ko', translationRisk: true }),
      L('China Government Procurement (CCGP)', 'https://www.ccgp.gov.cn/', { region: 'China', lang: 'zh', translationRisk: true }),
      L('UNGM — UN Global Marketplace', 'https://www.ungm.org/Public/Notice', { region: 'Global (UN)' }),
      L('UNDP procurement notices', 'https://procurement-notices.undp.org/', { region: 'Global (UN)' }),
      L('WTO Government Procurement Agreement', 'https://www.wto.org/english/tratop_e/gproc_e/gp_gpa_e.htm', { region: 'Global', kind: 'guideline' }),
      L('OECD public procurement', 'https://www.oecd.org/en/topics/public-procurement.html', { region: 'Global', kind: 'guideline' })
    ],
    devBanks: [
      L('World Bank procurement notices', 'https://projects.worldbank.org/en/projects-operations/procurement', { region: 'Global' }),
      L('World Bank projects & operations', 'https://projects.worldbank.org/en/projects-operations/projects-home', { region: 'Global', grant: true }),
      L('Asian Development Bank tenders', 'https://www.adb.org/projects/tenders', { region: 'Asia-Pacific' }),
      L('African Development Bank procurement', 'https://www.afdb.org/en/projects-and-operations/procurement', { region: 'Africa' }),
      L('Inter-American Development Bank procurement', 'https://projectprocurement.iadb.org/', { region: 'Latin America & Caribbean' }),
      L('EBRD procurement (ECEPP)', 'https://ecepp.ebrd.com/', { region: 'Europe & Central Asia' }),
      L('Islamic Development Bank procurement', 'https://www.isdb.org/project-procurement', { region: 'OIC member countries' }),
      L('US DFC', 'https://www.dfc.gov/', { region: 'Global', grant: true }),
      L('IATI d-portal (aid activity data)', 'https://d-portal.org/', { region: 'Global', grant: true }),
      L('AidData', 'https://www.aiddata.org/', { region: 'Global', grant: true }),
      L('UK FCDO Development Tracker', 'https://devtracker.fcdo.gov.uk/', { region: 'Global', grant: true }),
      L('GIZ tenders', 'https://www.giz.de/en/workingwithgiz/tenders.html', { region: 'Global' }),
      L('KfW Development Bank', 'https://www.kfw-entwicklungsbank.de/', { region: 'Global', grant: true }),
      L('JICA procurement', 'https://www.jica.go.jp/english/about/procurement/index.html', { region: 'Global' }),
      L('AFD (Agence Française de Développement)', 'https://www.afd.fr/en', { region: 'Global', grant: true })
    ],
    ppp: [
      L('World Bank PPP Resource Center', 'https://ppp.worldbank.org/', { region: 'Global' }),
      L('World Bank PPI Database', 'https://ppi.worldbank.org/', { region: 'Global' }),
      L('Global Infrastructure Hub', 'https://www.gihub.org/', { region: 'Global' }),
      L('EPEC — European PPP Expertise Centre (EIB)', 'https://www.eib.org/en/about/partners/cooperation/epec', { region: 'Europe' }),
      L('UK Infrastructure and Projects Authority', 'https://www.gov.uk/government/organisations/infrastructure-and-projects-authority', { region: 'United Kingdom' })
    ],
    macro: [
      L('World Bank Open Data', 'https://data.worldbank.org/', { region: 'Global' }),
      L('IMF Data', 'https://www.imf.org/en/Data', { region: 'Global' }),
      L('IMF World Economic Outlook', 'https://www.imf.org/en/Publications/WEO', { region: 'Global' }),
      L('OECD Data Explorer', 'https://data-explorer.oecd.org/', { region: 'OECD' }),
      L('BIS Data Portal', 'https://data.bis.org/', { region: 'Global' }),
      L('BIS central bank directory', 'https://www.bis.org/cbanks.htm', { region: 'Global' }),
      L('ECB Data Portal', 'https://data.ecb.europa.eu/', { region: 'Euro area' }),
      L('ECB euro reference exchange rates', 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html', { region: 'Euro area' }),
      L('FRED', 'https://fred.stlouisfed.org/', { search: 'https://fred.stlouisfed.org/searchresults/?st={q}', region: 'United States / Global' }),
      L('US Treasury interest rate statistics', 'https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics', { region: 'United States' }),
      L('World Bank commodity prices (Pink Sheet)', 'https://www.worldbank.org/en/research/commodity-markets', { region: 'Global' }),
      L('IMF AREAER (exchange arrangements & restrictions)', 'https://www.elibrary-areaer.imf.org/', { region: 'Global', note: 'Currency-control context.' })
    ],
    trade: [
      L('UN Comtrade', 'https://comtradeplus.un.org/', { region: 'Global' }),
      L('World Bank WITS', 'https://wits.worldbank.org/', { region: 'Global' }),
      L('USITC Harmonized Tariff Schedule', 'https://hts.usitc.gov/', { region: 'United States' }),
      L('EU TARIC', 'https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp', { region: 'European Union' }),
      L('UK Trade Tariff', 'https://www.trade-tariff.service.gov.uk/find_commodity', { region: 'United Kingdom' }),
      L('WTO Tariff & Trade Data', 'https://ttd.wto.org/', { region: 'Global' }),
      L('ITC Market Access Map', 'https://www.macmap.org/', { region: 'Global' }),
      L('WTO trade remedies (anti-dumping, countervailing)', 'https://www.wto.org/english/tratop_e/adp_e/adp_e.htm', { region: 'Global' }),
      L('UN/LOCODE code list', 'https://unece.org/trade/cefact/unlocode-code-list-country-and-territory', { region: 'Global' }),
      L('World Bank Logistics Performance Index', 'https://lpi.worldbank.org/', { region: 'Global' })
    ],
    cyber: [
      L('CISA KEV catalog', 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', { region: 'Global' }),
      L('CISA cybersecurity advisories', 'https://www.cisa.gov/news-events/cybersecurity-advisories', { region: 'Global' }),
      L('NVD', 'https://nvd.nist.gov/', { region: 'Global' }),
      L('CVE.org', 'https://www.cve.org/', { region: 'Global' }),
      L('GitHub Advisory Database', 'https://github.com/advisories', { region: 'Global' }),
      L('MITRE ATT&CK', 'https://attack.mitre.org/', { region: 'Global', kind: 'reference' }),
      L('MITRE CWE', 'https://cwe.mitre.org/', { region: 'Global', kind: 'reference' }),
      L('OpenSSF Scorecard', 'https://scorecard.dev/', { region: 'Global', kind: 'reference', note: 'Repository hygiene signal; not supplier approval.' }),
      L('CycloneDX (SBOM standard)', 'https://cyclonedx.org/', { region: 'Global', kind: 'standard' }),
      L('EDPB (EU data protection)', 'https://www.edpb.europa.eu/', { region: 'European Union' }),
      L('UK ICO', 'https://ico.org.uk/', { region: 'United Kingdom' }),
      L('NIST AI Risk Management Framework', 'https://www.nist.gov/itl/ai-risk-management-framework', { region: 'Global', kind: 'standard' })
    ],
    scannersLinkOutOnly: [
      L('Shodan', 'https://www.shodan.io/', { kind: 'reference', note: 'Link-out only. No live scanning from JAQA.' }),
      L('Censys', 'https://search.censys.io/', { kind: 'reference', note: 'Link-out only. No live scanning from JAQA.' }),
      L('VirusTotal', 'https://www.virustotal.com/', { kind: 'reference', note: 'Link-out only. Do not upload confidential files.' }),
      L('urlscan.io', 'https://urlscan.io/', { kind: 'reference', note: 'Link-out only. Submissions may be public.' })
    ],
    climate: [
      L('USGS earthquake map', 'https://earthquake.usgs.gov/earthquakes/map/', { region: 'Global' }),
      L('NASA FIRMS fire map', 'https://firms.modaps.eosdis.nasa.gov/map/', { region: 'Global' }),
      L('Copernicus Emergency Management Service', 'https://emergency.copernicus.eu/', { region: 'Global' }),
      L('EM-DAT disaster database', 'https://www.emdat.be/', { region: 'Global' }),
      L('ND-GAIN country index', 'https://gain.nd.edu/our-work/country-index/', { region: 'Global' }),
      L('World Bank Climate Change Knowledge Portal', 'https://climateknowledgeportal.worldbank.org/', { region: 'Global' }),
      L('NOAA National Hurricane Center', 'https://www.nhc.noaa.gov/', { region: 'Atlantic / Eastern Pacific' }),
      L('WMO', 'https://wmo.int/', { region: 'Global', note: 'Gateway to national meteorological services.' }),
      L('ReliefWeb', 'https://reliefweb.int/', { search: 'https://reliefweb.int/updates?search={q}', region: 'Global' }),
      L('Swiss Re Institute catastrophe reports', 'https://www.swissre.com/institute/research/sigma-research.html', { region: 'Global', kind: 'market-report' })
    ],
    esg: [
      L('EPA ECHO', 'https://echo.epa.gov/', { region: 'United States' }),
      L('ILO NORMLEX (labour standards)', 'https://normlex.ilo.org/', { region: 'Global' }),
      L('OECD Due Diligence Guidance for Responsible Business Conduct', 'https://mneguidelines.oecd.org/duediligence/', { region: 'Global' }),
      L('UN Guiding Principles on Business and Human Rights', 'https://www.ohchr.org/en/publications/reference-publications/guiding-principles-business-and-human-rights', { region: 'Global' }),
      L('UK modern slavery statement registry', 'https://modern-slavery-statement-registry.service.gov.uk/', { region: 'United Kingdom' }),
      L('Australia modern slavery register', 'https://modernslaveryregister.gov.au/', { region: 'Australia' }),
      L('US DOL list of goods produced by child or forced labor', 'https://www.dol.gov/agencies/ilab/reports/child-labor/list-of-goods', { region: 'Global' }),
      L('CBP withhold release orders & findings', 'https://www.cbp.gov/trade/forced-labor/withhold-release-orders-and-findings', { region: 'United States' }),
      L('OECD minerals due diligence', 'https://mneguidelines.oecd.org/mining.htm', { region: 'Global' }),
      L('Responsible Minerals Initiative', 'https://www.responsiblemineralsinitiative.org/', { region: 'Global' }),
      L('TNFD (nature-related disclosures)', 'https://tnfd.global/', { region: 'Global' }),
      L('World Bank Worldwide Governance Indicators', 'https://www.worldbank.org/en/publication/worldwide-governance-indicators', { region: 'Global' }),
      L('Transparency International CPI', 'https://www.transparency.org/en/cpi', { region: 'Global' })
    ],
    regulatory: [
      L('Federal Register', 'https://www.federalregister.gov/', { search: 'https://www.federalregister.gov/documents/search?conditions%5Bterm%5D={q}', region: 'United States' }),
      L('Regulations.gov', 'https://www.regulations.gov/', { search: 'https://www.regulations.gov/search?filter={q}', region: 'United States' }),
      L('EUR-Lex', 'https://eur-lex.europa.eu/', { search: 'https://eur-lex.europa.eu/search.html?scope=EURLEX&text={q}&lang=en&type=quick', region: 'European Union', lang: 'multi' }),
      L('UK legislation.gov.uk', 'https://www.legislation.gov.uk/', { region: 'United Kingdom' }),
      L('EU sanctions (Council of the EU)', 'https://www.consilium.europa.eu/en/policies/sanctions-against-russia/', { region: 'European Union' }),
      L('US BIS export administration regulations', 'https://www.bis.gov/regulations', { region: 'United States' }),
      L('IOSCO', 'https://www.iosco.org/', { region: 'Global' }),
      L('Financial Stability Board', 'https://www.fsb.org/', { region: 'Global' })
    ],
    standards: [
      L('ISO 31000 — Risk management', 'https://www.iso.org/iso-31000-risk-management.html', { publisher: 'ISO' }),
      L('ISO 22301 — Business continuity', 'https://www.iso.org/standard/75106.html', { publisher: 'ISO' }),
      L('ISO/IEC 27001 — Information security', 'https://www.iso.org/standard/27001', { publisher: 'ISO/IEC' }),
      L('ISO/IEC 27031 — ICT readiness for business continuity', 'https://www.iso.org/search.html?q=27031', { publisher: 'ISO/IEC' }),
      L('ISO/IEC 27035 — Incident management', 'https://www.iso.org/search.html?q=27035', { publisher: 'ISO/IEC' }),
      L('AICPA SOC 2 resources', 'https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2', { publisher: 'AICPA & CIMA' }),
      L('NIST Cybersecurity Framework', 'https://www.nist.gov/cyberframework', { publisher: 'NIST' }),
      L('NIST SSDF (SP 800-218)', 'https://csrc.nist.gov/projects/ssdf', { publisher: 'NIST' }),
      L('NIST AI RMF', 'https://www.nist.gov/itl/ai-risk-management-framework', { publisher: 'NIST' }),
      L('OECD Due Diligence Guidance', 'https://mneguidelines.oecd.org/duediligence/', { publisher: 'OECD' }),
      L('UN Guiding Principles on Business and Human Rights', 'https://www.ohchr.org/en/publications/reference-publications/guiding-principles-business-and-human-rights', { publisher: 'UN OHCHR' }),
      L('ILO conventions & recommendations', 'https://normlex.ilo.org/', { publisher: 'ILO' }),
      L('FIDIC contracts', 'https://fidic.org/', { publisher: 'FIDIC' }),
      L('NEC contracts', 'https://www.neccontract.com/', { publisher: 'NEC' }),
      L('World Bank Procurement Framework', 'https://www.worldbank.org/en/projects-operations/products-and-services/brief/procurement-new-framework', { publisher: 'World Bank' }),
      L('IAIS Insurance Core Principles', 'https://www.iaisweb.org/icp-online-tool/', { publisher: 'IAIS' }),
      L('Solvency II (EIOPA)', 'https://www.eiopa.europa.eu/browse/regulation-and-policy/solvency-ii_en', { publisher: 'EIOPA' }),
      L('WTO Government Procurement Agreement', 'https://www.wto.org/english/tratop_e/gproc_e/gp_gpa_e.htm', { publisher: 'WTO' }),
      L('UN Convention against Corruption', 'https://www.unodc.org/unodc/en/corruption/uncac.html', { publisher: 'UNODC' }),
      L('FATF Recommendations', 'https://www.fatf-gafi.org/en/topics/fatf-recommendations.html', { publisher: 'FATF' }),
      L('CMMC (US DoD)', 'https://dodcio.defense.gov/CMMC/', { publisher: 'US DoD CIO' }),
      L('ISO certificate check (IAF CertSearch)', 'https://www.iafcertsearch.org/', { publisher: 'IAF', note: 'Certification register; verify certificates there, not in JAQA.', kind: 'certification-register' })
    ],
    digitalAssets: [
      L('ESMA MiCA resources', 'https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/markets-crypto-assets-regulation-mica', { region: 'European Union' }),
      L('SEC crypto assets', 'https://www.sec.gov/securities-topics/crypto-assets', { region: 'United States' }),
      L('OFAC recent actions', 'https://ofac.treasury.gov/recent-actions', { region: 'United States' }),
      L('FATF virtual assets', 'https://www.fatf-gafi.org/en/topics/virtual-assets.html', { region: 'Global' })
    ],
    logistics: [
      L('Port of Rotterdam', 'https://www.portofrotterdam.com/', { region: 'Netherlands' }),
      L('Maritime and Port Authority of Singapore', 'https://www.mpa.gov.sg/', { region: 'Singapore' }),
      L('UN/LOCODE', 'https://unece.org/trade/cefact/unlocode-code-list-country-and-territory', { region: 'Global' }),
      L('World Bank LPI', 'https://lpi.worldbank.org/', { region: 'Global' }),
      L('IMO GISIS (public ship data)', 'https://gisis.imo.org/', { region: 'Global', note: 'Registration required for some modules.' }),
      L('MarineTraffic (commercial AIS)', 'https://www.marinetraffic.com/', { region: 'Global', kind: 'paid' })
    ],
    paid: [
      ['Dun & Bradstreet', 'https://www.dnb.com/'], ['Experian Business', 'https://www.experian.com/business'], ['Creditsafe', 'https://www.creditsafe.com/'],
      ['EcoVadis', 'https://ecovadis.com/'], ['Interos', 'https://www.interos.ai/'], ['Resilinc', 'https://www.resilinc.com/'], ['Everstream', 'https://www.everstream.ai/'],
      ['Exiger', 'https://www.exiger.com/'], ['Sphera', 'https://sphera.com/'], ['Assent', 'https://www.assent.com/'], ['S&P Global Market Intelligence', 'https://www.spglobal.com/market-intelligence/'],
      ['Moody’s (incl. Orbis / Bureau van Dijk)', 'https://www.moodys.com/'], ['Fitch Solutions', 'https://www.fitchsolutions.com/'], ['AM Best', 'https://web.ambest.com/'], ['KBRA', 'https://www.kbra.com/'],
      ['Bloomberg Professional', 'https://www.bloomberg.com/professional/'], ['LSEG (Refinitiv, World-Check)', 'https://www.lseg.com/'], ['PitchBook', 'https://pitchbook.com/'], ['FactSet', 'https://www.factset.com/'],
      ['Dow Jones Risk & Compliance', 'https://www.dowjones.com/professional/risk/'], ['Accuity (LexisNexis Risk)', 'https://risk.lexisnexis.com/'], ['MarineTraffic', 'https://www.marinetraffic.com/'], ['Spire Maritime', 'https://spire.com/maritime/']
    ].map(([n, u]) => L(n, u, { kind: 'paid', note: 'Paid/commercial. Link-out only; never scraped or reproduced. No affiliation.' })),
    thirdPartyRepos: [
      L('WorldMonitor', 'https://github.com/koala73/worldmonitor', { kind: 'third-party-repo', license: 'AGPL-3.0-only', mode: 'reference / link-out only', note: 'Not integrated: AGPL licence requires legal review; heavy backend/relay/service-worker stack conflicts with JAQA’s static, no-storage model. Outputs are not JAQA evidence.' }),
      L('God’s Eye View', 'https://github.com/bilawalsidhu/gods-eye-view', { kind: 'third-party-repo', license: 'Unverified — audit required', mode: 'reference / link-out only', note: 'Not integrated pending a strict audit (licence, no backend, no storage, no tiles/CDNs, no personal-data OSINT, no active scanning).' }),
      L('OWASP Dependency-Track', 'https://github.com/DependencyTrack/dependency-track', { kind: 'third-party-repo', license: 'Apache-2.0', mode: 'reference', note: 'Software supply-chain platform reference; not a backend fork.' }),
      L('Trivy', 'https://github.com/aquasecurity/trivy', { kind: 'third-party-repo', license: 'Apache-2.0', mode: 'reference', note: 'Scanner/SBOM reference; not integrated.' }),
      L('Grype', 'https://github.com/anchore/grype', { kind: 'third-party-repo', license: 'Apache-2.0', mode: 'reference', note: 'Scanner reference; not integrated.' }),
      L('Syft', 'https://github.com/anchore/syft', { kind: 'third-party-repo', license: 'Apache-2.0', mode: 'reference', note: 'SBOM generator reference; not integrated.' }),
      L('MITRE CTI (ATT&CK STIX data)', 'https://github.com/mitre/cti', { kind: 'third-party-repo', license: 'See repository', mode: 'reference', note: 'Cyber taxonomy reference.' }),
      L('MITRE ATT&CK Navigator', 'https://github.com/mitre-attack/attack-navigator', { kind: 'third-party-repo', license: 'Apache-2.0', mode: 'link-out', note: 'Not embedded (would require audit for storage/CDN/telemetry).' }),
      L('CVEProject cvelistV5', 'https://github.com/CVEProject/cvelistV5', { kind: 'third-party-repo', license: 'See repository', mode: 'reference', note: 'Not bulk-fetched into the browser.' }),
      L('CycloneDX', 'https://github.com/CycloneDX', { kind: 'third-party-repo', license: 'Apache-2.0', mode: 'link-out', note: 'SBOM standard.' }),
      L('OpenSSF Scorecard', 'https://github.com/ossf/scorecard', { kind: 'third-party-repo', license: 'Apache-2.0', mode: 'link-out', note: 'Repository hygiene; not supplier approval.' }),
      L('OpenSanctions', 'https://github.com/opensanctions/opensanctions', { kind: 'third-party-repo', license: 'See repository (data licence differs)', mode: 'link-out', note: 'No auto-screening; no clearance language.' })
    ]
  };

  /** Build a link-out URL. The query is included only when a template exists and official-link-only mode is off. */
  R.linkout = function linkout(entry, q) {
    if (!entry) return null;
    const officialOnly = R.state.prefs.officialLinkOnly;
    if (q && entry.search && !officialOnly) return { href: entry.search.replace('{q}', encodeURIComponent(q)), withQuery: true };
    return { href: entry.url, withQuery: false };
  };
  R.linkoutFromTemplate = function (tpl, value, fallback) {
    if (!tpl) return fallback || null;
    if (/\{q\}/.test(tpl) && R.state.prefs.officialLinkOnly) return fallback || tpl.replace(/[?#].*$/, '');
    return tpl.replace('{q}', encodeURIComponent(value)).replace('{id}', encodeURIComponent(value));
  };

  /* ------------------------------------------------------------------ *
   * Country reference data: ISO2|ISO3|name (ISO 3166-1). Used for local
   * detection only; all country facts are fetched live or linked out.
   * ------------------------------------------------------------------ */
  const COUNTRY_DATA =
    'AF|AFG|Afghanistan;AL|ALB|Albania;DZ|DZA|Algeria;AD|AND|Andorra;AO|AGO|Angola;AG|ATG|Antigua and Barbuda;AR|ARG|Argentina;AM|ARM|Armenia;AU|AUS|Australia;AT|AUT|Austria;AZ|AZE|Azerbaijan;BS|BHS|Bahamas;BH|BHR|Bahrain;BD|BGD|Bangladesh;BB|BRB|Barbados;BY|BLR|Belarus;BE|BEL|Belgium;BZ|BLZ|Belize;BJ|BEN|Benin;BM|BMU|Bermuda;BT|BTN|Bhutan;BO|BOL|Bolivia;BA|BIH|Bosnia and Herzegovina;BW|BWA|Botswana;BR|BRA|Brazil;BN|BRN|Brunei Darussalam;BG|BGR|Bulgaria;BF|BFA|Burkina Faso;BI|BDI|Burundi;CV|CPV|Cabo Verde;KH|KHM|Cambodia;CM|CMR|Cameroon;CA|CAN|Canada;KY|CYM|Cayman Islands;CF|CAF|Central African Republic;TD|TCD|Chad;CL|CHL|Chile;CN|CHN|China;CO|COL|Colombia;KM|COM|Comoros;CD|COD|Congo, Democratic Republic;CG|COG|Congo, Republic;CR|CRI|Costa Rica;CI|CIV|Cote d’Ivoire;HR|HRV|Croatia;CU|CUB|Cuba;CY|CYP|Cyprus;CZ|CZE|Czechia;DK|DNK|Denmark;DJ|DJI|Djibouti;DM|DMA|Dominica;DO|DOM|Dominican Republic;EC|ECU|Ecuador;EG|EGY|Egypt;SV|SLV|El Salvador;GQ|GNQ|Equatorial Guinea;ER|ERI|Eritrea;EE|EST|Estonia;SZ|SWZ|Eswatini;ET|ETH|Ethiopia;FJ|FJI|Fiji;FI|FIN|Finland;FR|FRA|France;GA|GAB|Gabon;GM|GMB|Gambia;GE|GEO|Georgia;DE|DEU|Germany;GH|GHA|Ghana;GR|GRC|Greece;GD|GRD|Grenada;GT|GTM|Guatemala;GG|GGY|Guernsey;GN|GIN|Guinea;GW|GNB|Guinea-Bissau;GY|GUY|Guyana;HT|HTI|Haiti;HN|HND|Honduras;HK|HKG|Hong Kong SAR, China;HU|HUN|Hungary;IS|ISL|Iceland;IN|IND|India;ID|IDN|Indonesia;IR|IRN|Iran;IQ|IRQ|Iraq;IE|IRL|Ireland;IM|IMN|Isle of Man;IL|ISR|Israel;IT|ITA|Italy;JM|JAM|Jamaica;JP|JPN|Japan;JE|JEY|Jersey;JO|JOR|Jordan;KZ|KAZ|Kazakhstan;KE|KEN|Kenya;KI|KIR|Kiribati;KP|PRK|Korea, North;KR|KOR|Korea, South;XK|XKX|Kosovo;KW|KWT|Kuwait;KG|KGZ|Kyrgyz Republic;LA|LAO|Lao PDR;LV|LVA|Latvia;LB|LBN|Lebanon;LS|LSO|Lesotho;LR|LBR|Liberia;LY|LBY|Libya;LI|LIE|Liechtenstein;LT|LTU|Lithuania;LU|LUX|Luxembourg;MO|MAC|Macao SAR, China;MG|MDG|Madagascar;MW|MWI|Malawi;MY|MYS|Malaysia;MV|MDV|Maldives;ML|MLI|Mali;MT|MLT|Malta;MH|MHL|Marshall Islands;MR|MRT|Mauritania;MU|MUS|Mauritius;MX|MEX|Mexico;FM|FSM|Micronesia;MD|MDA|Moldova;MC|MCO|Monaco;MN|MNG|Mongolia;ME|MNE|Montenegro;MA|MAR|Morocco;MZ|MOZ|Mozambique;MM|MMR|Myanmar;NA|NAM|Namibia;NR|NRU|Nauru;NP|NPL|Nepal;NL|NLD|Netherlands;NZ|NZL|New Zealand;NI|NIC|Nicaragua;NE|NER|Niger;NG|NGA|Nigeria;MK|MKD|North Macedonia;NO|NOR|Norway;OM|OMN|Oman;PK|PAK|Pakistan;PW|PLW|Palau;PS|PSE|West Bank and Gaza;PA|PAN|Panama;PG|PNG|Papua New Guinea;PY|PRY|Paraguay;PE|PER|Peru;PH|PHL|Philippines;PL|POL|Poland;PT|PRT|Portugal;PR|PRI|Puerto Rico;QA|QAT|Qatar;RO|ROU|Romania;RU|RUS|Russian Federation;RW|RWA|Rwanda;WS|WSM|Samoa;SM|SMR|San Marino;ST|STP|Sao Tome and Principe;SA|SAU|Saudi Arabia;SN|SEN|Senegal;RS|SRB|Serbia;SC|SYC|Seychelles;SL|SLE|Sierra Leone;SG|SGP|Singapore;SK|SVK|Slovak Republic;SI|SVN|Slovenia;SB|SLB|Solomon Islands;SO|SOM|Somalia;ZA|ZAF|South Africa;SS|SSD|South Sudan;ES|ESP|Spain;LK|LKA|Sri Lanka;KN|KNA|St. Kitts and Nevis;LC|LCA|St. Lucia;VC|VCT|St. Vincent and the Grenadines;SD|SDN|Sudan;SR|SUR|Suriname;SE|SWE|Sweden;CH|CHE|Switzerland;SY|SYR|Syrian Arab Republic;TW|TWN|Taiwan, China;TJ|TJK|Tajikistan;TZ|TZA|Tanzania;TH|THA|Thailand;TL|TLS|Timor-Leste;TG|TGO|Togo;TO|TON|Tonga;TT|TTO|Trinidad and Tobago;TN|TUN|Tunisia;TR|TUR|Turkiye;TM|TKM|Turkmenistan;TV|TUV|Tuvalu;UG|UGA|Uganda;UA|UKR|Ukraine;AE|ARE|United Arab Emirates;GB|GBR|United Kingdom;US|USA|United States;UY|URY|Uruguay;UZ|UZB|Uzbekistan;VU|VUT|Vanuatu;VE|VEN|Venezuela;VN|VNM|Viet Nam;YE|YEM|Yemen;ZM|ZMB|Zambia;ZW|ZWE|Zimbabwe';
  const COUNTRIES = COUNTRY_DATA.split(';').map((r) => {
    const [iso2, iso3, name] = r.split('|');
    return { iso2, iso3, name };
  });
  const ALIASES = {
    usa: 'US', 'united states of america': 'US', america: 'US', 'u.s.': 'US', 'u.s.a.': 'US', uk: 'GB', britain: 'GB', 'great britain': 'GB', england: 'GB',
    russia: 'RU', 'south korea': 'KR', korea: 'KR', 'north korea': 'KP', vietnam: 'VN', turkey: 'TR', 'hong kong': 'HK', macau: 'MO', macao: 'MO', taiwan: 'TW',
    iran: 'IR', syria: 'SY', laos: 'LA', 'ivory coast': 'CI', "cote d'ivoire": 'CI', 'czech republic': 'CZ', slovakia: 'SK', drc: 'CD', 'democratic republic of the congo': 'CD',
    uae: 'AE', emirates: 'AE', holland: 'NL', 'the netherlands': 'NL', burma: 'MM', swaziland: 'SZ', 'cape verde': 'CV', brunei: 'BN', kyrgyzstan: 'KG', palestine: 'PS', 'east timor': 'TL'
  };
  // Currencies published by the ECB reference-rate series (EXR). Euro-area members map to EUR.
  const EURO = ['AT', 'BE', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES', 'BG'];
  const ECB_CCY = { US: 'USD', JP: 'JPY', CZ: 'CZK', DK: 'DKK', GB: 'GBP', HU: 'HUF', PL: 'PLN', RO: 'RON', SE: 'SEK', CH: 'CHF', IS: 'ISK', NO: 'NOK', TR: 'TRY', AU: 'AUD', BR: 'BRL', CA: 'CAD', CN: 'CNY', HK: 'HKD', ID: 'IDR', IL: 'ILS', IN: 'INR', KR: 'KRW', MX: 'MXN', MY: 'MYR', NZ: 'NZD', PH: 'PHP', SG: 'SGD', TH: 'THB', ZA: 'ZAR' };

  R.geo = {
    countries: COUNTRIES,
    EU_MEMBERS: ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'],
    findCountry(q) {
      if (!q) return null;
      const t = q.trim();
      const lower = t.toLowerCase().replace(/^the\s+/, '');
      if (ALIASES[lower]) return COUNTRIES.find((c) => c.iso2 === ALIASES[lower]) || null;
      const up = t.toUpperCase();
      return (
        COUNTRIES.find((c) => c.name.toLowerCase() === lower) ||
        (t.length === 2 && t === up ? COUNTRIES.find((c) => c.iso2 === up) : null) ||
        (t.length === 3 && t === up ? COUNTRIES.find((c) => c.iso3 === up) : null) ||
        null
      );
    },
    byIso2: (iso2) => COUNTRIES.find((c) => c.iso2 === String(iso2 || '').toUpperCase()) || null,
    currencyFor(iso2) {
      if (EURO.includes(iso2)) return 'EUR';
      return ECB_CCY[iso2] || null;
    },
    ECB_CCY: Object.values(ECB_CCY)
  };
})(window.JAQAWorkspace);
