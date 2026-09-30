#!/usr/bin/env node
/*
 * JAQA source verification (dev-only tool, never deployed).
 *
 * Sends real requests carrying `Origin: <origin>` (default https://jaqa.life)
 * to every public endpoint the workspace may call from the browser, and checks:
 *   1. HTTP status is 2xx
 *   2. Access-Control-Allow-Origin is `*` or echoes the origin
 *   3. For non-simple requests (POST JSON / custom headers) the CORS preflight passes
 *   4. The response body matches the shape the client code expects
 *
 * A source is marked `verified: true` only when every one of its required
 * checks passes. The result is written to config/cors-verification.json
 * (with --write) and consumed by scripts/build.mjs, which:
 *   - promotes verified sources to defaultMode "live"
 *   - adds only verified origins to the CSP connect-src directive
 *
 * Everything else stays link-out. Browser behaviour must still be confirmed
 * from the deployed origin using the Coverage Console ("Check availability").
 *
 * Usage:
 *   node scripts/verify-cors.mjs [--origin https://jaqa.life] [--write] [--out report.json] [--only gleif,ted]
 */
import https from 'node:https';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argVal = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const ORIGIN = argVal('--origin', 'https://jaqa.life');
const WRITE = args.includes('--write');
const OUT = argVal('--out', '');
const ONLY = argVal('--only', '').split(',').filter(Boolean);
const UA = 'JAQA-source-verification/1.0 (static site CORS check; contact via jaqa.life)';

const isArr = Array.isArray;
const obj = (v) => v && typeof v === 'object';

/**
 * required: false marks exploratory checks (alternate endpoints / versions)
 * that inform development but do not gate a source's verification.
 */
const CHECKS = [
  // GLEIF
  { source: 'gleif', id: 'gleif-fulltext', url: 'https://api.gleif.org/api/v1/lei-records?filter%5Bfulltext%5D=Allianz&page%5Bsize%5D=2', shape: (j) => isArr(j.data) },
  { source: 'gleif', id: 'gleif-record', url: 'https://api.gleif.org/api/v1/lei-records/529900K9B0N5BT694847', shape: (j) => obj(j.data) && obj(j.data.attributes) },
  { source: 'gleif', id: 'gleif-children', url: 'https://api.gleif.org/api/v1/lei-records/529900K9B0N5BT694847/direct-children?page%5Bsize%5D=2', shape: (j) => isArr(j.data), required: false },
  { source: 'gleif', id: 'gleif-direct-parent', url: 'https://api.gleif.org/api/v1/lei-records/5299003CAAQ96ZRJ7689/direct-parent', shape: (j) => obj(j.data), required: false },
  { source: 'gleif', id: 'gleif-ultimate-parent', url: 'https://api.gleif.org/api/v1/lei-records/5299003CAAQ96ZRJ7689/ultimate-parent', shape: (j) => obj(j.data), required: false },
  { source: 'gleif', id: 'gleif-fuzzy', url: 'https://api.gleif.org/api/v1/fuzzycompletions?field=entity.legalName&q=munich%20re', shape: (j) => isArr(j.data), required: false },

  // World Bank
  { source: 'worldbank', id: 'wb-country', url: 'https://api.worldbank.org/v2/country/MYS?format=json', shape: (j) => isArr(j) && isArr(j[1]) },
  { source: 'worldbank', id: 'wb-lpi', url: 'https://api.worldbank.org/v2/country/MYS/indicator/LP.LPI.OVRL.XQ?format=json&mrv=3', shape: (j) => isArr(j) },
  { source: 'worldbank', id: 'wb-wgi-legacy', url: 'https://api.worldbank.org/v2/country/MYS/indicator/CC.EST?format=json&mrv=1', shape: (j) => isArr(j) && isArr(j[1]), required: false },
  { source: 'worldbank', id: 'wb-wgi-source3', url: 'https://api.worldbank.org/v2/country/MYS/indicator/CC.EST?format=json&mrv=1&source=3', shape: (j) => isArr(j) && isArr(j[1]), required: false },
  { source: 'worldbank', id: 'wb-wgi-gov', url: 'https://api.worldbank.org/v2/country/MYS/indicator/GOV_WGI_CC.EST?format=json&mrv=1', shape: (j) => isArr(j) && isArr(j[1]), required: false },
  { source: 'worldbank', id: 'wb-inflation', url: 'https://api.worldbank.org/v2/country/MYS/indicator/FP.CPI.TOTL.ZG?format=json&mrv=2', shape: (j) => isArr(j) && isArr(j[1]), required: false },

  // IMF DataMapper
  { source: 'imf', id: 'imf-datamapper', url: 'https://www.imf.org/external/datamapper/api/v1/NGDP_RPCH/MYS', shape: (j) => obj(j) && obj(j.values) },

  // USGS
  { source: 'usgs', id: 'usgs-query', url: 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=1.29&longitude=103.85&maxradiuskm=800&minmagnitude=4&limit=3', shape: (j) => isArr(j.features) },

  // Open-Meteo (forecast + geocoding)
  { source: 'openmeteo', id: 'om-forecast', url: 'https://api.open-meteo.com/v1/forecast?latitude=51.92&longitude=4.48&daily=weather_code,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,temperature_2m_max&forecast_days=3&timezone=auto', shape: (j) => obj(j.daily) },
  { source: 'openmeteo', id: 'om-geocode', url: 'https://geocoding-api.open-meteo.com/v1/search?name=Rotterdam&count=3&language=en&format=json', shape: (j) => isArr(j.results) },

  // NOAA / NWS
  { source: 'nws', id: 'nws-alerts-point', url: 'https://api.weather.gov/alerts/active?point=29.76,-95.37', accept: 'application/geo+json', shape: (j) => isArr(j.features) },

  // ReliefWeb
  { source: 'reliefweb', id: 'rw-v2-reports', url: 'https://api.reliefweb.int/v2/reports?appname=jaqa.life&query%5Bvalue%5D=Malaysia&limit=2&sort%5B%5D=date:desc&fields%5Binclude%5D%5B%5D=title&fields%5Binclude%5D%5B%5D=url&fields%5Binclude%5D%5B%5D=date.created', shape: (j) => isArr(j.data) },
  { source: 'reliefweb', id: 'rw-v1-reports', url: 'https://api.reliefweb.int/v1/reports?appname=jaqa.life&query%5Bvalue%5D=Malaysia&limit=2', shape: (j) => isArr(j.data), required: false },

  // CISA KEV (official feed + official cisagov GitHub mirror)
  { source: 'cisaKev', id: 'kev-cisa-gov', url: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', shape: (j) => isArr(j.vulnerabilities), required: false },
  { source: 'cisaKev', id: 'kev-cisagov-github', url: 'https://raw.githubusercontent.com/cisagov/kev-data/develop/known_exploited_vulnerabilities.json', shape: (j) => isArr(j.vulnerabilities) },

  // NVD
  { source: 'nvd', id: 'nvd-cve', url: 'https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=CVE-2024-3094', shape: (j) => isArr(j.vulnerabilities) },
  { source: 'nvd', id: 'nvd-keyword', url: 'https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=xz%20utils&resultsPerPage=2', shape: (j) => isArr(j.vulnerabilities), required: false },
  { source: 'nvd', id: 'nvd-apikey-preflight', preflightOnly: true, headers: { apiKey: 'x' }, url: 'https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=CVE-2024-3094', shape: () => true, required: false },

  // CPSC
  { source: 'cpsc', id: 'cpsc-recall-number', url: 'https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallNumber=26639', shape: (j) => isArr(j), required: false },
  { source: 'cpsc', id: 'cpsc-recall', url: 'https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallTitle=stroller', shape: (j) => isArr(j) },

  // NHTSA
  { source: 'nhtsa', id: 'nhtsa-campaign', url: 'https://api.nhtsa.gov/recalls/campaignNumber?campaignNumber=20V314000', shape: (j) => obj(j) && isArr(j.results) },
  { source: 'nhtsa', id: 'nhtsa-vehicle', url: 'https://api.nhtsa.gov/recalls/recallsByVehicle?make=honda&model=accord&modelYear=2020', shape: (j) => obj(j) && isArr(j.results), required: false },

  // USAspending (POST JSON -> preflight)
  { source: 'usaspending', id: 'usa-autocomplete-recipient', method: 'POST', url: 'https://api.usaspending.gov/api/v2/autocomplete/recipient/', body: { search_text: 'lockheed', limit: 2 }, shape: (j) => obj(j), required: false },
  { source: 'usaspending', id: 'usa-awards', method: 'POST', url: 'https://api.usaspending.gov/api/v2/search/spending_by_award/', body: { filters: { keywords: ['reinsurance'], award_type_codes: ['A', 'B', 'C', 'D'] }, fields: ['Award ID', 'Recipient Name', 'Start Date', 'End Date', 'Award Amount', 'Awarding Agency', 'Description'], limit: 2, page: 1, sort: 'Award Amount', order: 'desc' }, shape: (j) => isArr(j.results) },
  { source: 'usaspending', id: 'usa-award-detail', url: 'https://api.usaspending.gov/api/v2/awards/CONT_AWD_HSFE6016C0201_7022_-NONE-_-NONE-/', shape: (j) => obj(j), required: false },
  { source: 'usaspending', id: 'usa-grants', method: 'POST', url: 'https://api.usaspending.gov/api/v2/search/spending_by_award/', body: { filters: { keywords: ['resilience'], award_type_codes: ['02', '03', '04', '05'] }, fields: ['Award ID', 'Recipient Name', 'Start Date', 'End Date', 'Award Amount', 'Awarding Agency', 'Description'], limit: 2, page: 1, sort: 'Award Amount', order: 'desc' }, shape: (j) => isArr(j.results), required: false },

  // Federal Register
  { source: 'federalRegister', id: 'fr-agency', url: 'https://www.federalregister.gov/api/v1/documents.json?conditions%5Bterm%5D=sanctions&conditions%5Btype%5D%5B%5D=RULE&per_page=1&fields%5B%5D=title&fields%5B%5D=document_number&fields%5B%5D=html_url&fields%5B%5D=agencies&fields%5B%5D=publication_date', shape: (j) => isArr(j.results), required: false },
  { source: 'federalRegister', id: 'fr-search', url: 'https://www.federalregister.gov/api/v1/documents.json?conditions%5Bterm%5D=reinsurance&per_page=2&order=newest', shape: (j) => isArr(j.results) },

  // SEC EDGAR
  { source: 'sec', id: 'sec-submissions', url: 'https://data.sec.gov/submissions/CIK0000320193.json', shape: (j) => obj(j.filings) },
  { source: 'secXbrl', id: 'sec-companyfacts', url: 'https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json', shape: (j) => obj(j.facts) },
  { source: 'secXbrl', id: 'sec-companyconcept', url: 'https://data.sec.gov/api/xbrl/companyconcept/CIK0000320193/us-gaap/AssetsCurrent.json', shape: (j) => obj(j.units), required: false },
  { source: 'secTickers', id: 'sec-tickers', url: 'https://www.sec.gov/files/company_tickers.json', shape: (j) => obj(j) },
  { source: 'secFullText', id: 'sec-efts', url: 'https://efts.sec.gov/LATEST/search-index?q=%22going%20concern%22&forms=10-K', shape: (j) => obj(j) },

  // TED (POST JSON -> preflight)
  { source: 'ted', id: 'ted-search', method: 'POST', url: 'https://api.ted.europa.eu/v3/notices/search', body: { query: 'FT ~ "insurance"', fields: ['publication-number', 'notice-title', 'buyer-name', 'buyer-country', 'publication-date', 'notice-type', 'deadline-receipt-tender-date-lot', 'classification-cpv', 'procedure-type', 'links'], limit: 2 }, shape: (j) => isArr(j.notices) },

  // CourtListener
  { source: 'courtlistener', id: 'cl-v4-search', url: 'https://www.courtlistener.com/api/rest/v4/search/?q=%22Acme%22&type=r', shape: (j) => isArr(j.results) },
  { source: 'courtlistener', id: 'cl-v4-opinions', url: 'https://www.courtlistener.com/api/rest/v4/search/?q=%22reinsurance%22&type=o', shape: (j) => isArr(j.results), required: false },

  // Wikidata / Wikipedia
  { source: 'wikidata', id: 'wd-search', url: 'https://www.wikidata.org/w/api.php?action=wbsearchentities&search=Munich%20Re&language=en&format=json&limit=3&origin=*', shape: (j) => isArr(j.search) },
  { source: 'wikidata', id: 'wd-entities', url: 'https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q312&props=claims%7Clabels%7Cdescriptions&languages=en&format=json&origin=*', shape: (j) => obj(j.entities) },
  { source: 'wikipedia', id: 'wp-summary', url: 'https://en.wikipedia.org/api/rest_v1/page/summary/Munich_Re', shape: (j) => typeof j.title === 'string' },

  // Overpass (OpenStreetMap)
  { source: 'overpass', id: 'overpass-around', url: 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent('[out:json][timeout:20];nwr["landuse"="port"](around:3000,51.95,4.14);out center 2;'), shape: (j) => isArr(j.elements) },

  // ECB Data Portal
  { source: 'ecb', id: 'ecb-exr', url: 'https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?format=jsondata&lastNObservations=2', shape: (j) => obj(j) && (isArr(j.dataSets) || obj(j.data)) },

  // GDELT
  { source: 'gdelt', id: 'gdelt-doc', url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=%22port%20strike%22&mode=artlist&format=json&maxrecords=2', shape: (j) => obj(j) },

  // EPA ECHO (exploratory)
  { source: 'epa', id: 'echo-facility-info', url: 'https://echodata.epa.gov/echo/echo_rest_services.get_facility_info?output=JSON&p_fn=ACME', shape: (j) => obj(j), required: true },

  // UN Comtrade public preview (exploratory, no key)
  { source: 'comtrade', id: 'comtrade-preview', url: 'https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode=458&period=2023&cmdCode=854231&flowCode=M', shape: (j) => obj(j) && isArr(j.data) },

  // Key-gated sources: preflight / ACAO information only; never verified without a key
  { source: 'fred', id: 'fred-nokey', url: 'https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&file_type=json', shape: () => false, required: true },
  { source: 'companiesHouse', id: 'ch-preflight', method: 'GET', preflightOnly: true, headers: { Authorization: 'x' }, url: 'https://api.company-information.service.gov.uk/search/companies?q=acme', shape: () => true },
  { source: 'opencorporates', id: 'oc-search', url: 'https://api.opencorporates.com/v0.4/companies/search?q=acme', shape: (j) => obj(j) && obj(j.results) }
];

function request(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const u = new URL(url);
    const req = https.request(
      { method, hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': UA, ...headers }, timeout: 30000 },
      (res) => {
        const chunks = [];
        let size = 0;
        res.on('data', (c) => {
          size += c.length;
          if (size < 8_000_000) chunks.push(c);
        });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8'), ms: Date.now() - started }));
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ status: 0, headers: {}, body: '', error: String(e.message || e), ms: Date.now() - started }));
    if (body) req.write(body);
    req.end();
  });
}

const acaoOk = (h) => {
  const v = h['access-control-allow-origin'];
  return v === '*' || v === ORIGIN;
};

async function runCheck(c) {
  const method = c.method || 'GET';
  const extraHeaders = { ...(c.headers || {}) };
  const needsPreflight = method !== 'GET' || Object.keys(extraHeaders).some((k) => !['accept', 'accept-language', 'content-language'].includes(k.toLowerCase()));
  const result = { id: c.id, source: c.source, method, url: c.url, required: c.required !== false };

  if (needsPreflight) {
    const reqHeaders = [...Object.keys(extraHeaders).map((k) => k.toLowerCase()), ...(c.body ? ['content-type'] : [])].join(',');
    const pf = await request(c.url, {
      method: 'OPTIONS',
      headers: { Origin: ORIGIN, 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': reqHeaders }
    });
    const allowHeaders = String(pf.headers['access-control-allow-headers'] || '').toLowerCase();
    const allowMethods = String(pf.headers['access-control-allow-methods'] || '').toUpperCase();
    result.preflight = {
      status: pf.status,
      acao: pf.headers['access-control-allow-origin'] || null,
      allowMethods: allowMethods || null,
      allowHeaders: allowHeaders || null,
      ok:
        pf.status >= 200 && pf.status < 300 && acaoOk(pf.headers) &&
        (allowMethods.includes(method) || allowMethods.includes('*') || method === 'GET') &&
        reqHeaders.split(',').filter(Boolean).every((h) => allowHeaders.includes(h) || allowHeaders.includes('*'))
    };
    if (c.preflightOnly) {
      result.ok = result.preflight.ok;
      result.note = 'Preflight only (key-gated source); a live call additionally requires a user-supplied in-memory key.';
      return result;
    }
  }

  const headers = { Origin: ORIGIN, Accept: c.accept || 'application/json', ...extraHeaders };
  let body;
  if (c.body) {
    body = JSON.stringify(c.body);
    headers['Content-Type'] = 'application/json';
  }
  const r = await request(c.url, { method, headers, body });
  result.status = r.status;
  result.ms = r.ms;
  result.error = r.error || null;
  result.acao = r.headers['access-control-allow-origin'] || null;
  result.contentType = r.headers['content-type'] || null;
  result.rateLimit = r.headers['x-ratelimit-limit'] || r.headers['ratelimit-limit'] || null;
  let json = null;
  try {
    json = JSON.parse(r.body);
  } catch {
    /* not JSON */
  }
  let shapeOk = false;
  try {
    shapeOk = json !== null && !!c.shape(json);
  } catch {
    shapeOk = false;
  }
  result.jsonOk = json !== null;
  result.shapeOk = shapeOk;
  result.acaoOk = acaoOk(r.headers);
  result.ok = r.status >= 200 && r.status < 300 && result.acaoOk && shapeOk && (!result.preflight || result.preflight.ok);
  result.snippet = r.body.slice(0, 900).replace(/\s+/g, ' ');
  return result;
}

const checks = ONLY.length ? CHECKS.filter((c) => ONLY.includes(c.source)) : CHECKS;
const results = [];
for (const c of checks) {
  // Sequential on purpose: polite to providers, respects rate limits.
  const r = await runCheck(c);
  results.push(r);
  const pf = r.preflight ? ` preflight=${r.preflight.status}/${r.preflight.ok ? 'ok' : 'FAIL'}` : '';
  console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.source.padEnd(16)} ${r.id.padEnd(28)} status=${r.status ?? '-'} acao=${r.acao ?? '-'} shape=${r.shapeOk ?? '-'}${pf} ${r.error || ''}`);
  await new Promise((res) => setTimeout(res, 400));
}

const sources = {};
for (const r of results) {
  const s = (sources[r.source] ||= { verified: true, checks: [] });
  s.checks.push({ id: r.id, ok: !!r.ok, required: r.required, status: r.status ?? null, acao: r.acao ?? null, preflightOk: r.preflight ? r.preflight.ok : null, shapeOk: r.shapeOk ?? null });
  if (r.required && !r.ok) s.verified = false;
}
for (const [id, s] of Object.entries(sources)) {
  if (!s.checks.some((c) => c.required)) s.verified = false;
  s.passingEndpoints = s.checks.filter((c) => c.ok).map((c) => c.id);
  if (id === 'fred' || id === 'companiesHouse' || id === 'opencorporates') {
    s.preflightVerified = s.checks.some((c) => c.ok);
    s.keyGated = true;
    s.verified = false; // key-gated sources are never promoted automatically
  }
}

const report = {
  origin: ORIGIN,
  verifiedAt: new Date().toISOString(),
  runner: process.env.GITHUB_ACTIONS ? `github-actions:${process.env.GITHUB_RUN_ID || ''}` : 'local',
  method: 'Server-side request with Origin header + CORS preflight emulation + response-shape validation. Confirm from the deployed origin with the Coverage Console.',
  sources
};

console.log('\n=== SOURCE SUMMARY ===');
for (const [id, s] of Object.entries(sources)) console.log(`${s.verified ? 'VERIFIED ' : 'LINK-OUT '} ${id}  passing: ${s.passingEndpoints.join(', ') || 'none'}`);
console.log('\n=== SNIPPETS ===');
for (const r of results) console.log(`--- ${r.id} [${r.status}] ${r.snippet ? r.snippet.slice(0, 900) : r.error || ''}`);

if (OUT) writeFileSync(OUT, JSON.stringify({ report, results }, null, 2));
if (WRITE) {
  mkdirSync(path.join(root, 'config'), { recursive: true });
  const file = path.join(root, 'config', 'cors-verification.json');
  const prev = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  console.log(`\nWrote ${path.relative(root, file)}${prev ? ` (previous run: ${prev.verifiedAt})` : ''}`);
}
