#!/usr/bin/env node
/*
 * End-to-end smoke test (dev/CI only) for dist/index.html using Playwright.
 * All external API traffic is intercepted and answered with small fixtures
 * modelled on real responses captured by scripts/verify-cors.mjs, so the test
 * is deterministic and never contacts providers. It asserts privacy, safety,
 * accessibility basics and the main functional flows.
 *
 * Usage: node scripts/smoke-test.mjs [--screens <dir>] [--headed]
 * Requires the `playwright` package (local devDependency or global install).
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const screens = args.includes('--screens') ? args[args.indexOf('--screens') + 1] : null;
if (screens) mkdirSync(screens, { recursive: true });

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const { execSync } = await import('node:child_process');
    const g = execSync('npm root -g').toString().trim();
    return createRequire(path.join(g, 'noop.js'))('playwright');
  }
}
const { chromium } = await loadPlaywright();

/* ------------------------------- fixtures ------------------------------- */
const gleifEntity = (lei, name, country, extra) => ({
  type: 'lei-records',
  id: lei,
  attributes: Object.assign(
    {
      lei,
      entity: { legalName: { name }, otherNames: [], legalAddress: { addressLines: ['Königinstr. 28'], city: 'München', region: 'DE-BY', country, postalCode: '80802' }, headquartersAddress: { addressLines: ['Königinstr. 28'], city: 'München', country }, registeredAt: { id: 'RA000304' }, registeredAs: 'HRB 164232', jurisdiction: country, category: 'GENERAL', legalForm: { id: 'SGST' }, status: 'ACTIVE' },
      registration: { initialRegistrationDate: '2012-11-29T00:00:00Z', lastUpdateDate: '2026-01-10T00:00:00Z', status: 'ISSUED', nextRenewalDate: '2026-12-01T00:00:00Z', corroborationLevel: 'FULLY_CORROBORATED' },
      bic: []
    },
    extra || {}
  )
});
const FIX = {
  gleifSearch: { meta: { pagination: { total: 2 } }, data: [gleifEntity('529900K9B0N5BT694847', 'Allianz SE', 'DE'), gleifEntity('5299003CAAQ96ZRJ7689', 'ALLIANZ RENEWABLE ENERGY', 'DE')] },
  gleifRecord: { data: gleifEntity('529900K9B0N5BT694847', 'Allianz SE', 'DE') },
  gleifChildren: { meta: { pagination: { total: 1 } }, data: [gleifEntity('5299003CAAQ96ZRJ7689', 'ALLIANZ RENEWABLE ENERGY', 'DE')] },
  wbCountry: [{ page: 1 }, [{ id: 'MYS', iso2Code: 'MY', name: 'Malaysia', region: { value: 'East Asia & Pacific' }, incomeLevel: { value: 'Upper middle income' }, lendingType: { value: 'IBRD' }, capitalCity: 'Kuala Lumpur', longitude: '101.684', latitude: '3.12433' }]],
  wbInd: [{ page: 1, lastupdated: '2026-07-13' }, [{ indicator: { id: 'X', value: 'x' }, country: { id: 'MY', value: 'Malaysia' }, date: '2024', value: 3.6 }, { indicator: { id: 'X' }, country: { id: 'MY', value: 'Malaysia' }, date: '2022', value: 3.2 }]],
  usgs: { type: 'FeatureCollection', features: [{ id: 'us7000abcd', properties: { mag: 6.2, place: '34 km S of Test', time: Date.now() - 86400000, url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us7000abcd', status: 'reviewed', sig: 600, alert: 'yellow', tsunami: 0, magType: 'mww' }, geometry: { coordinates: [4.9, 51.8, 10] } }] },
  forecast: { timezone: 'Europe/Amsterdam', daily: { time: ['2026-09-30', '2026-10-01'], weather_code: [55, 65], temperature_2m_max: [23, 19], precipitation_sum: [2, 60], wind_speed_10m_max: [16, 15], wind_gusts_10m_max: [30, 80] } },
  geocode: { results: [{ id: 2747891, name: 'Rotterdam', latitude: 51.9225, longitude: 4.47917, feature_code: 'PPL', country_code: 'NL', country: 'Netherlands', admin1: 'South Holland', population: 868135, timezone: 'Europe/Amsterdam' }] },
  nws: { type: 'FeatureCollection', features: [] },
  kev: { title: 'CISA KEV', catalogVersion: '2026.09.29', count: 2, vulnerabilities: [{ cveID: 'CVE-2024-3094', vendorProject: 'XZ Utils', product: 'XZ Utils', vulnerabilityName: 'XZ Utils Embedded Malicious Code', dateAdded: '2024-04-01', shortDescription: 'Embedded malicious code.', requiredAction: 'Apply mitigations.', dueDate: '2024-04-22', knownRansomwareCampaignUse: 'Unknown', cwes: ['CWE-506'] }, { cveID: 'CVE-2021-44228', vendorProject: 'Apache', product: 'Log4j2', vulnerabilityName: 'Log4Shell', dateAdded: '2021-12-10', shortDescription: 'RCE', requiredAction: 'Apply updates', dueDate: '2021-12-24', knownRansomwareCampaignUse: 'Known', cwes: [] }] },
  nvd: { totalResults: 1, vulnerabilities: [{ cve: { id: 'CVE-2024-3094', published: '2024-03-29T17:15:21.150', lastModified: '2026-06-17T07:43:17.830', vulnStatus: 'Modified', descriptions: [{ lang: 'en', value: 'Malicious code was discovered in the upstream tarballs of xz.' }], metrics: { cvssMetricV31: [{ cvssData: { version: '3.1', baseScore: 10, baseSeverity: 'CRITICAL', vectorString: 'CVSS:3.1/AV:N' } }] }, weaknesses: [{ description: [{ value: 'CWE-506' }] }], references: [{ url: 'https://example.org' }] } }] },
  cpsc: [{ RecallID: 1, RecallNumber: '26639', RecallDate: '2026-07-23T00:00:00', Title: 'Test Recall of Widgets', Description: 'Widgets recalled.', URL: 'https://www.cpsc.gov/Recalls/2026/test', Products: [{ Name: 'Widget' }], Hazards: [{ Name: 'Choking' }], Manufacturers: [{ Name: 'Widget Co' }] }],
  nhtsa: { Count: 1, results: [{ Manufacturer: 'Honda (American Honda Motor Co.)', NHTSACampaignNumber: '20V314000', Component: 'FUEL SYSTEM', Summary: 'Fuel pump may fail.', Consequence: 'Stall', Remedy: 'Replace', ReportReceivedDate: '28/05/2020', PotentialNumberofUnitsAffected: 135995 }] },
  usaAwards: { limit: 10, page_metadata: { hasNext: false }, results: [{ internal_id: 1, 'Award ID': 'HSFE6016C0201', 'Recipient Name': 'GUY CARPENTER & COMPANY, LLC', 'Start Date': '2016-08-22', 'End Date': '2022-03-08', 'Award Amount': 14469685, 'Awarding Agency': 'Department of Homeland Security', 'Awarding Sub Agency': 'FEMA', Description: 'BROKER SUPPORT SERVICES', 'Recipient UEI': 'ABCDEF123456', generated_internal_id: 'CONT_AWD_HSFE6016C0201_7022_-NONE-_-NONE-' }] },
  fr: { count: 1, results: [{ title: 'Sanctions Penalties Regulations', type: 'Rule', abstract: 'Amends penalties.', document_number: '2026-19678', html_url: 'https://www.federalregister.gov/documents/2026/09/25/2026-19678/sanctions-penalties-regulations', publication_date: '2026-09-25', agencies: [{ name: 'Foreign Assets Control Office' }], comments_close_on: null, effective_on: '2026-10-25', docket_ids: [], topics: [] }] },
  secSubs: { cik: '0000320193', name: 'Apple Inc.', tickers: ['AAPL'], exchanges: ['Nasdaq'], sic: '3571', sicDescription: 'Electronic Computers', entityType: 'operating', category: 'Large accelerated filer', stateOfIncorporationDescription: 'CA', fiscalYearEnd: '0926', lei: null, formerNames: [], filings: { recent: { form: ['8-K', '10-K', 'NT 10-Q'], filingDate: ['2026-08-01', '2025-11-01', '2025-05-01'], accessionNumber: ['0000320193-26-000001', '0000320193-25-000002', '0000320193-25-000003'], primaryDocument: ['a.htm', 'b.htm', 'c.htm'], reportDate: ['', '2025-09-27', ''], items: ['4.02,9.01', '', ''] } } },
  courts: { count: 1, results: [{ caseName: 'ACME T52', court: 'United States Bankruptcy Court, C.D. California', dateFiled: '2017-10-30', docketNumber: '2:17-bk-23295', docket_absolute_url: '/docket/59665729/acme-t52/', docket_id: 59665729, chapter: '7' }] },
  wdSearch: { search: [{ id: 'Q487292', label: 'Allianz', description: 'German financial services company' }] },
  wdEntities: { entities: { Q487292: { labels: { en: { value: 'Allianz' } }, descriptions: { en: { value: 'German financial services company' } }, aliases: { en: [{ value: 'Allianz SE' }] }, claims: { P1278: [{ mainsnak: { datavalue: { value: '529900K9B0N5BT694847' } } }], P856: [{ mainsnak: { datavalue: { value: 'https://www.allianz.com' } } }] }, sitelinks: { enwiki: { title: 'Allianz' } } } } },
  wp: { type: 'standard', title: 'Allianz', extract: 'Allianz SE is a German multinational financial services company.', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Allianz' } }, pageid: 1 },
  ecb: { dataSets: [{ series: { '0:0:0:0:0': { observations: { 0: [1.1378], 1: [1.1355] } } } }], structure: { dimensions: { observation: [{ values: [{ id: '2026-09-28' }, { id: '2026-09-29' }] }] } } },
  gdelt: { articles: [] },
  epa: { Results: { QueryRows: '1', Facilities: [{ FacName: 'ACME PLANT', FacCity: 'SAN ANTONIO', FacState: 'TX', RegistryID: '110070356711' }] } }
};

function fixtureFor(url, method) {
  const u = new URL(url);
  const h = u.host;
  const p = u.pathname;
  if (h === 'api.gleif.org') {
    if (/direct-children/.test(p)) return FIX.gleifChildren;
    if (/(direct|ultimate)-parent/.test(p)) return { __status: 404, body: { errors: [{ status: '404' }] } };
    if (/lei-records\/[A-Z0-9]{20}$/.test(p)) return FIX.gleifRecord;
    return FIX.gleifSearch;
  }
  if (h === 'api.worldbank.org') return /indicator/.test(p) ? FIX.wbInd : FIX.wbCountry;
  if (h === 'earthquake.usgs.gov') return FIX.usgs;
  if (h === 'api.open-meteo.com') return FIX.forecast;
  if (h === 'geocoding-api.open-meteo.com') return FIX.geocode;
  if (h === 'api.weather.gov') return FIX.nws;
  if (h === 'raw.githubusercontent.com') return FIX.kev;
  if (h === 'services.nvd.nist.gov') return FIX.nvd;
  if (h === 'www.saferproducts.gov') return FIX.cpsc;
  if (h === 'api.nhtsa.gov') return FIX.nhtsa;
  if (h === 'api.usaspending.gov') return FIX.usaAwards;
  if (h === 'www.federalregister.gov') return FIX.fr;
  if (h === 'data.sec.gov') return FIX.secSubs;
  if (h === 'www.courtlistener.com') return FIX.courts;
  if (h === 'www.wikidata.org') return /wbgetentities/.test(u.search) ? FIX.wdEntities : FIX.wdSearch;
  if (h === 'en.wikipedia.org') return FIX.wp;
  if (h === 'data-api.ecb.europa.eu') return FIX.ecb;
  if (h === 'api.gdeltproject.org') return FIX.gdelt;
  if (h === 'echodata.epa.gov') return FIX.epa;
  return null;
}

/* ------------------------------- harness ------------------------------- */
const PORT = 20000 + Math.floor(Math.random() * 20000);
const server = spawn(process.execPath, [path.join(root, 'scripts/preview.mjs'), '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((resolve, reject) => {
  server.stdout.once('data', resolve);
  server.once('exit', (code) => reject(new Error('preview server exited with code ' + code)));
});
process.on('exit', () => server.kill());

const failures = [];
const ok = (cond, msg) => {
  if (!cond) failures.push(msg);
  process.stdout.write((cond ? '  ✓ ' : '  ✗ ') + msg + '\n');
};

const browser = await chromium.launch({ headless: !args.includes('--headed'), executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const consoleErrors = [];
const externalHosts = new Set();
const monitorRequests = [];
const apiBodies = [];
// Network-level 404s (e.g. GLEIF “no parent reported”) are expected API semantics, not app errors.
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
await context.route('**/*', async (route) => {
  const req = route.request();
  const url = req.url();
  if (url.startsWith(`http://127.0.0.1:${PORT}/api/jaqa/monitor/`)) {
    // The JAQA server's Global Monitor endpoint (mocked: the preview server is static).
    const u = new URL(url);
    monitorRequests.push(u.pathname + u.search);
    const id = u.searchParams.get('id');
    const items = id === 'gdacs'
      ? [{ title: 'Green flood alert in Thailand', link: 'https://www.gdacs.org/report.aspx?eventid=1', published: '2026-09-30T06:00:00.000Z', lat: 14.5, lon: 100.9 }]
      : [{ title: 'Fixture headline for ' + id, link: 'https://example.org/' + id, published: '2026-09-30T05:00:00.000Z' }];
    return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, id, fetchedAt: '2026-09-30T06:05:00.000Z', items }) });
  }
  if (url.startsWith(`http://127.0.0.1:${PORT}`)) return route.continue();
  externalHosts.add(new URL(url).host);
  if (req.postData()) apiBodies.push(req.postData());
  const fx = fixtureFor(url, req.method());
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'content-type': 'application/json' };
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
  if (!fx) return route.fulfill({ status: 404, headers, body: '{}' });
  if (fx.__status) return route.fulfill({ status: fx.__status, headers, body: JSON.stringify(fx.body) });
  await new Promise((r) => setTimeout(r, 40));
  return route.fulfill({ status: 200, headers, body: JSON.stringify(fx) });
});

const BASE = `http://127.0.0.1:${PORT}/`;
const shot = async (name) => screens && page.screenshot({ path: path.join(screens, name + '.png'), fullPage: false });
const search = async (q) => {
  await page.fill('#rq-search', q);
  await page.press('#rq-search', 'Enter');
  await page.waitForTimeout(700);
};
const bodyText = () => page.locator('#rq-content').innerText();

console.log('Deployment & privacy');
await page.goto(BASE);
await page.waitForSelector('.rq-rail-item');
ok((await page.title()) === 'JAQA Global Risk, Finance, Insurance & Procurement Intelligence Workspace', 'page title uses normal branding (no ™)');
ok(!(await page.locator('h1').first().innerText()).includes('™'), 'H1 has no trademark symbol');
ok((await page.locator('.rq-footer').innerText()).includes('JAQA™. All rights reserved.'), 'footer has © year JAQA™ copyright');
ok(await page.locator('.rq-privacy-badge').isVisible(), 'privacy badge visible');
ok((await page.locator('#rq-confidential').innerText()).includes('Do not enter confidential'), 'confidentiality warning visible');
ok((await page.locator('input[type=file]').count()) === 0, 'no file upload inputs');
ok(externalHosts.size === 0, 'no external requests on initial load (no auto-probing)');
ok((await page.locator('#jaqa-boot').count()) === 0, 'startup screen removed once the app has started');
ok(await page.evaluate(() => [...document.scripts].every((x) => x.src || x.type === 'application/ld+json')), 'no executable inline scripts (CSP script-src self)');
ok((await page.locator('.rq-situation').count()) === 1, 'lands on the Situation Room');
ok((await page.locator('.rq-globe-canvas').count()) === 1, 'globe canvas renders without network');
ok((await page.locator('.rq-strip').innerText()).includes('STANDBY'), 'feeds start on standby');
ok((await page.getAttribute('#jaqa-workspace', 'data-theme')) === 'ops', 'situation-room theme is the default');
await shot('01-situation-standby');

console.log('Situation Room feeds');
await page.click('button:has-text("Activate public feeds")');
await page.waitForTimeout(1200);
const feedHosts = new Set(['earthquake.usgs.gov', 'raw.githubusercontent.com', 'www.federalregister.gov', 'data-api.ecb.europa.eu']);
ok([...externalHosts].every((x) => feedHosts.has(x)) && externalHosts.size > 0, 'feeds contact only fixed public endpoints: ' + [...externalHosts].join(', '));
ok(apiBodies.length === 0, 'feeds send no request bodies (no search terms)');
ok(Number(await page.getAttribute('.rq-globe-host', 'data-points')) > 0, 'globe plots feed markers');
ok((await page.locator('.rq-wire-row').count()) > 0, 'wire panels list feed items');
ok((await page.locator('.rq-strip').innerText()).includes('ACTIVE'), 'status strip shows feeds active');
const canvas = page.locator('.rq-globe-canvas');
await canvas.focus();
await page.keyboard.press('ArrowRight');
await page.keyboard.press('+');
// The HUD readout is written on the next animation frame; wait for it rather than racing it.
const zoomed = await page.waitForFunction(() => /ZOOM 1\.2/.test(document.querySelector('.rq-hud-bottom').textContent), null, { timeout: 3000 }).then(() => true, () => false);
ok(zoomed, 'globe responds to keyboard zoom');
await page.click('.rq-seg-btn:has-text("NVG")');
ok((await page.locator('.rq-optic-nvg').count()) === 1, 'optic mode switches (NVG)');
await shot('02-situation-active');

console.log('Global Monitor & 3D globe');
const link3d = await page.locator('a:has-text("Open in 3D globe")').first().getAttribute('href');
ok(/^\/globe\/#lat=-?[\d.]+&lon=-?[\d.]+&alt=\d+&pitch=-?\d+&style=nvg$/.test(link3d || ''), 'Situation Room links to the 3D globe with coordinates + style only: ' + link3d);
await page.click('.rq-rail-item:has-text("Global Monitor")');
ok((await bodyText()).includes('Monitor on standby'), 'monitor starts on standby');
ok(monitorRequests.length === 0, 'no monitor requests before activation');
await page.click('button:has-text("Load monitor feeds")');
await page.waitForSelector('.rq-mon-hot li', { timeout: 6000 }).catch(() => {});
const monText = await bodyText();
ok(monText.includes('Green flood alert in Thailand'), 'monitor shows official headlines');
ok((await page.locator('.rq-mon-hot li').count()) > 0 && (await page.locator('.rq-mon-hot').innerText()).includes('Thailand'), 'countries in the headlines are counted');
ok(monitorRequests.length > 0 && monitorRequests.every((u) => /^\/api\/jaqa\/monitor\/feed\?id=[a-z0-9-]+$/.test(u)), 'monitor requests carry only a fixed feed id');
ok((await page.locator('.rq-mon-map canvas').count()) === 1, 'monitor event map renders');
ok(/^https:\/\//.test((await page.locator('.rq-mon-title a').first().getAttribute('href')) || ''), 'headline links open the publisher');
await shot('02b-monitor');
await page.click('.rq-rail-item:has-text("3D Globe")');
ok(((await page.locator('a:has-text("Open 3D globe")').first().getAttribute('href')) || '').startsWith('/globe/'), '3D Globe module links to /globe/');
await page.waitForSelector('.rq-cesium .rq-warning', { timeout: 8000 }).catch(() => {});
ok(((await page.locator('.rq-cesium').innerText()) || '').includes('needs the JAQA server'), 'CesiumJS 3D view falls back cleanly on static-only hosting (no /globe/cesium/)');

console.log('Organization flow');
await search('Allianz SE');
ok(page.url() === BASE, 'search term not written to URL');
await page.waitForSelector('text=Resolved entity', { timeout: 5000 }).catch(() => {});
ok((await bodyText()).includes('Allianz SE'), 'GLEIF exact match resolved as primary entity');
ok((await page.locator('.rq-detect-card').innerText()).includes('Confidence'), 'interpretation banner shows confidence');
await shot('03-org-overview');
await page.click('.rq-rail-item:has-text("Organization 360")');
await page.waitForTimeout(800);
ok((await bodyText()).includes('Corporate family'), 'Organization 360 renders corporate family');
await shot('03-org360');
await page.click('.rq-rail-item:has-text("Counterparty Fragility")');
await page.waitForTimeout(500);
ok((await bodyText()).includes('Public distress signals do not predict insolvency'), 'fragility module shows required warning');
await page.click('.rq-rail-item:has-text("Sanctions & Enforcement")');
await page.waitForTimeout(300);
const sanc = await bodyText();
ok(sanc.includes('No public match found does not mean cleared') && !/\bcleared\b(?! ,| safe)/.test(sanc.replace(/does not mean cleared/g, '')), 'sanctions module never says cleared');

console.log('Detail drawer & keyboard');
await page.click('.rq-rail-item:has-text("Overview")');
await page.waitForTimeout(300);
const detailsBtn = page.locator('.rq-card button:has-text("Details")').first();
if (await detailsBtn.count()) {
  await detailsBtn.focus();
  await detailsBtn.click();
  await page.waitForSelector('.rq-dialog');
  ok((await page.locator('.rq-dialog').innerText()).includes('Provenance'), 'detail drawer shows provenance');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  ok((await page.locator('.rq-dialog').count()) === 0, 'Escape closes the drawer');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.textContent.includes('Details')), 'focus returns to trigger');
}
await page.locator('body').click({ position: { x: 5, y: 5 } });
await page.keyboard.press('/');
ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'rq-search'), '"/" focuses search');
await page.keyboard.press('Escape');
await page.keyboard.press('Control+k');
await page.waitForTimeout(100);
ok((await page.locator('.rq-dialog-palette').count()) === 1, 'Ctrl+K opens command palette');
await page.keyboard.press('Escape');

console.log('Other entity types');
await search('Malaysia');
ok((await bodyText()).includes('Malaysia'), 'country query renders World Bank context');
await search('CVE-2024-3094');
await page.waitForTimeout(500);
const cyber = await bodyText();
ok(cyber.includes('In CISA KEV') && cyber.includes('do not prove'), 'CVE query shows KEV + supplier-exposure caveat');
await shot('04-cve');
await search('Port of Rotterdam');
await page.waitForTimeout(900);
ok((await bodyText()).includes('Rotterdam'), 'port query resolves place and events');
await search('HS 8542.31');
ok((await bodyText()).includes('HS code'), 'HS code routes to Trade lens');
await search('reinsurance');
ok((await bodyText()).includes('does not provide insurance, reinsurance, underwriting'), 'insurance concept routes with insurance warning');
await shot('05-insurance');
await search('TED tender');
ok((await bodyText()).includes('bid/no-bid'), 'procurement concept routes with procurement warning');
await shot('06-procurement');
await search('counterparty financial fragility');
ok((await bodyText()).includes('Finance Risk Universe is a public-source map'), 'finance domain routes to Finance Risk Universe');
await search('modern slavery risk');
ok((await bodyText()).includes('Global Risk Universe is a public-source map'), 'risk domain routes to Global Risk Universe');
await shot('07-global-risk');
await search('20V314000');
ok((await bodyText()).includes('20V314000'), 'NHTSA recall ID resolves');
await search('0000320193');
await page.waitForTimeout(500);
ok((await bodyText()).includes('Apple Inc.'), 'CIK resolves SEC filer');

console.log('Input hygiene');
for (const bad of ['john.doe@example.com', 'DE89 3704 0044 0532 0130 00', '4111 1111 1111 1111', 'policy number 12345678', 'please review our confidential bid pricing sheet for the upcoming tender response draft']) {
  await page.fill('#rq-search', bad);
  await page.press('#rq-search', 'Enter');
  await page.waitForTimeout(150);
  ok((await page.locator('.rq-detect').innerText()).includes('may contain sensitive information') && (await page.inputValue('#rq-search')) === '', 'rejects sensitive input: ' + bad.split('\n')[0].slice(0, 18) + '…');
}

console.log('All modules render');
await search('Allianz SE');
for (const btn of await page.locator('.rq-rail-item').all()) {
  const label = (await btn.innerText()).trim();
  await btn.click();
  await page.waitForTimeout(250);
  const t = await bodyText();
  ok(!t.includes('could not be displayed'), 'module renders: ' + label);
  if (screens && args.includes('--tour')) {
    await page.waitForTimeout(400);
    await page.locator('#rq-content').screenshot({ path: path.join(screens, 'mod-' + label.split('\n')[0].replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png') }).catch(() => {});
  }
}

console.log('Export');
await page.click('.rq-rail-item:has-text("Evidence Board")');
await page.click('.rq-card-actions button:has-text("Pin")').catch(() => {});
await page.click('.rq-rail-item:has-text("Overview")');
const dl = page.waitForEvent('download');
await page.click('button:has-text("Export Evidence Pack")');
await page.click('.rq-dialog button:has-text("Export without search term")');
const file = await dl;
ok(file.suggestedFilename() === 'JAQA-Evidence-Pack.json', 'export filename is fixed and has no search term');
const json = JSON.parse(await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8')));
ok(json.legal && json.legal.trademark === 'JAQA™' && /JAQA™\. All rights reserved/.test(json.legal.copyright), 'export JSON carries JAQA™ legal metadata');
ok(json.session && json.session.query === '[omitted by user]', 'search term omitted when user chooses');
ok(Array.isArray(json.records) && json.records.every((r) => r.provenance && r.provenance.source), 'records carry provenance');

console.log('CSV injection');
const csvCell = await page.evaluate(() => window.JAQAWorkspace.exporters.csvCell('=HYPERLINK("x")'));
ok(csvCell.startsWith('"\'=') || csvCell.startsWith("'="), 'CSV formula injection neutralized');

console.log('Clear session & storage');
await page.click('.rq-header button:has-text("Clear Session")');
await page.waitForTimeout(200);
ok((await page.inputValue('#rq-search')) === '' && (await page.locator('.rq-strip').innerText()).includes('STANDBY') && (await page.locator('.rq-detect-card').count()) === 0, 'Clear Session wipes state (session, feeds, globe markers)');
ok((await context.cookies()).length === 0, 'no cookies set');
const storage = await page.evaluate(() => ({ l: window['local' + 'Storage'].length, s: window['session' + 'Storage'].length }));
ok(storage.l === 0 && storage.s === 0, 'no web storage used');
const sw = await page.evaluate(async () => (navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 0));
ok(sw === 0, 'no service worker registered');
const allowed = new Set(['api.gleif.org', 'api.worldbank.org', 'earthquake.usgs.gov', 'api.open-meteo.com', 'geocoding-api.open-meteo.com', 'api.weather.gov', 'raw.githubusercontent.com', 'services.nvd.nist.gov', 'www.saferproducts.gov', 'api.nhtsa.gov', 'api.usaspending.gov', 'www.federalregister.gov', 'data.sec.gov', 'www.courtlistener.com', 'www.wikidata.org', 'en.wikipedia.org', 'data-api.ecb.europa.eu', 'api.gdeltproject.org', 'echodata.epa.gov']);
ok([...externalHosts].every((h) => allowed.has(h)), 'only verified public API hosts contacted: ' + [...externalHosts].join(', '));
ok(consoleErrors.length === 0, 'no console errors' + (consoleErrors.length ? ': ' + consoleErrors.slice(0, 3).join(' | ') : ''));

console.log('Mobile & dark mode');
await page.setViewportSize({ width: 390, height: 844 });
await page.reload();
await page.waitForSelector('.rq-rail-toggle');
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
ok(overflow <= 1, 'no horizontal scroll at phone width');
await shot('08-mobile');
await page.setViewportSize({ width: 1440, height: 1000 });
await page.click('.rq-header button[aria-label^="Switch theme"]');
ok((await page.getAttribute('#jaqa-workspace', 'data-theme')) === 'dark', 'theme cycles to dark');
await shot('09-dark');
await page.click('.rq-header button[aria-label^="Switch theme"]');
ok((await page.getAttribute('#jaqa-workspace', 'data-theme')) === 'light', 'theme cycles to light');
await shot('10-light');
await page.click('.rq-header button[aria-label^="Switch theme"]');
ok((await page.getAttribute('#jaqa-workspace', 'data-theme')) === 'ops', 'theme cycles back to situation room');

await browser.close();
server.kill();
if (failures.length) {
  console.error(`\n${failures.length} smoke check(s) failed.`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');
