/*
 * advancedQuery.js — MODULE 27: Advanced Query.
 *
 * Builds a request (live, verified sources) or an official link-out URL from
 * structured fields. Nothing is sent until the user clicks “Run Query”. The
 * raw request is previewed in a collapsible Technical Details panel. No
 * secrets are ever included.
 */
(function (R) {
  'use strict';
  const { h, extLink } = R.util;
  const ui = R.ui;
  const C = R.clients;

  const RESOURCES = {
    gleif: { label: 'Legal entities (GLEIF)', source: 'gleif', fields: [['name', 'Legal name or keyword'], ['lei', 'LEI (optional, overrides name)']], build: (v) => (v.lei ? { url: `https://api.gleif.org/api/v1/lei-records/${encodeURIComponent(v.lei)}`, run: () => C.gleif.byLei(v.lei) } : { url: `https://api.gleif.org/api/v1/lei-records?filter[fulltext]=${encodeURIComponent(v.name)}&page[size]=10`, run: () => C.gleif.search(v.name) }), need: (v) => v.name || v.lei },
    fr: { label: 'Regulatory documents (Federal Register)', source: 'federalRegister', fields: [['term', 'Keyword / topic'], ['type', 'Type (RULE, PRORULE, NOTICE, PRESDOCU)'], ['agency', 'Agency slug (e.g. treasury-department)'], ['from', 'Published from (YYYY-MM-DD)'], ['to', 'Published to (YYYY-MM-DD)']], build: (v) => ({ url: `https://www.federalregister.gov/api/v1/documents.json?conditions[term]=${encodeURIComponent(v.term)}${v.type ? '&conditions[type][]=' + v.type : ''}${v.agency ? '&conditions[agencies][]=' + v.agency : ''}${v.from ? '&conditions[publication_date][gte]=' + v.from : ''}${v.to ? '&conditions[publication_date][lte]=' + v.to : ''}&per_page=20&order=newest`, run: () => C.federalRegister.search(v.term, { perPage: 20, order: 'newest', type: v.type, agency: v.agency, from: v.from, to: v.to }) }), need: (v) => v.term },
    usa: { label: 'US federal awards (USAspending)', source: 'usaspending', fields: [['keyword', 'Keyword (≥3 chars)'], ['recipient', 'Recipient name (optional)'], ['kind', 'Type: contracts | idvs | grants'], ['from', 'Action date from (YYYY-MM-DD)'], ['to', 'Action date to (YYYY-MM-DD)']], build: (v) => ({ url: 'POST https://api.usaspending.gov/api/v2/search/spending_by_award/', body: { filters: { keywords: v.keyword ? [v.keyword] : undefined, recipient_search_text: v.recipient ? [v.recipient] : undefined }, limit: 20 }, run: () => C.usaspending.awards({ keyword: v.keyword || undefined, recipient: v.recipient || undefined, kind: v.kind || 'contracts', from: v.from || undefined, to: v.to || undefined, limit: 20 }) }), need: (v) => (v.keyword && v.keyword.length >= 3) || v.recipient },
    kev: { label: 'Known exploited vulnerabilities (CISA KEV)', source: 'cisaKev', fields: [['cve', 'CVE ID (optional)'], ['vendor', 'Vendor / product text']], build: (v) => ({ url: 'https://raw.githubusercontent.com/cisagov/kev-data/develop/known_exploited_vulnerabilities.json (filtered in your browser)', run: () => (v.cve ? C.kev.byCve(v.cve) : C.kev.mentions(v.vendor)) }), need: (v) => v.cve || (v.vendor && v.vendor.length >= 3) },
    nvd: { label: 'CVE records (NVD)', source: 'nvd', fields: [['cve', 'CVE ID'], ['keyword', 'Keyword (if no CVE)']], build: (v) => ({ url: v.cve ? `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${v.cve}` : `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(v.keyword)}&resultsPerPage=10`, run: () => (v.cve ? C.nvd.cve(v.cve) : C.nvd.keyword(v.keyword)) }), need: (v) => v.cve || v.keyword },
    usgs: { label: 'Earthquakes (USGS)', source: 'usgs', fields: [['lat', 'Latitude'], ['lon', 'Longitude'], ['radius', 'Radius km (≤ 2000)'], ['days', 'Days back (≤ 365)']], build: (v) => ({ url: `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${v.lat}&longitude=${v.lon}&maxradiuskm=${v.radius || 500}&minmagnitude=4.5`, run: () => C.usgs.near(+v.lat, +v.lon, Math.min(+v.radius || 500, 2000), Math.min(+v.days || 30, 365), 4.5) }), need: (v) => isFinite(+v.lat) && isFinite(+v.lon) && v.lat !== '' && v.lon !== '' && Math.abs(+v.lat) <= 90 && Math.abs(+v.lon) <= 180 },
    wb: { label: 'Country indicator (World Bank)', source: 'worldbank', fields: [['iso3', 'Country ISO3'], ['indicator', 'Indicator key: ' + Object.keys(C.worldbank.INDICATORS).join(', ')]], build: (v) => ({ url: `https://api.worldbank.org/v2/country/${v.iso3}/indicator/${(C.worldbank.INDICATORS[v.indicator] || [v.indicator])[0]}?format=json&mrv=6`, run: () => C.worldbank.indicator(v.iso3.toUpperCase(), v.indicator) }), need: (v) => /^[A-Za-z]{3}$/.test(v.iso3 || '') && v.indicator },
    recall: { label: 'Recalls (CPSC / NHTSA)', source: 'cpsc', fields: [['title', 'CPSC recall title keyword'], ['campaign', 'NHTSA campaign number (overrides)']], build: (v) => (v.campaign ? { url: `https://api.nhtsa.gov/recalls/campaignNumber?campaignNumber=${v.campaign}`, run: () => C.nhtsa.campaign(v.campaign), source: 'nhtsa' } : { url: `https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallTitle=${encodeURIComponent(v.title)}`, run: () => C.cpsc.search(v.title) }), need: (v) => v.title || v.campaign },
    courts: { label: 'Court records (CourtListener)', source: 'courtlistener', fields: [['q', 'Party / keyword'], ['type', 'r = dockets, o = opinions']], build: (v) => ({ url: `https://www.courtlistener.com/api/rest/v4/search/?q="${encodeURIComponent(v.q)}"&type=${v.type === 'o' ? 'o' : 'r'}`, run: () => C.courtlistener.search(v.q, v.type) }), need: (v) => v.q },
    ecb: { label: 'FX reference rate (ECB)', source: 'ecb', fields: [['ccy', 'Currency (' + R.geo.ECB_CCY.join(', ') + ')']], build: (v) => ({ url: `https://data-api.ecb.europa.eu/service/data/EXR/D.${(v.ccy || '').toUpperCase()}.EUR.SP00.A?format=jsondata&lastNObservations=30`, run: () => C.ecb.exr((v.ccy || '').toUpperCase(), 30) }), need: (v) => R.geo.ECB_CCY.includes((v.ccy || '').toUpperCase()) },
    sec: { label: 'SEC filings index (EDGAR submissions)', source: 'sec', fields: [['cik', 'CIK (digits)']], build: (v) => ({ url: `https://data.sec.gov/submissions/CIK${C.sec.padCik(v.cik || '')}.json`, run: () => C.sec.submissions(v.cik) }), need: (v) => /^\d{1,10}$/.test(v.cik || '') },
    ted: { label: 'EU tenders (TED) — link-out', linkout: true, fields: [['kw', 'Keyword'], ['notice', 'Notice publication number (e.g. 123456-2025)']], build: (v) => ({ url: v.notice ? 'https://ted.europa.eu/en/notice/-/detail/' + encodeURIComponent(v.notice) : R.linkoutFromTemplate('https://ted.europa.eu/en/search/result?FT={q}', v.kw, 'https://ted.europa.eu/') }), need: (v) => v.kw || v.notice },
    sam: { label: 'SAM.gov opportunities/exclusions — link-out', linkout: true, fields: [['index', 'opp (opportunities) or ex (exclusions)']], build: (v) => ({ url: 'https://sam.gov/search/?index=' + (v.index === 'ex' ? 'ex' : 'opp') }), need: () => true },
    comtrade: { label: 'Trade flows (UN Comtrade) — link-out', linkout: true, fields: [['hs', 'HS code']], build: () => ({ url: 'https://comtradeplus.un.org/' }), need: () => true }
  };

  const st = { res: 'gleif', values: {}, run: 0, result: null };
  R.events.on('session:cleared', () => Object.assign(st, { res: 'gleif', values: {}, run: 0, result: null }));

  R.modules.register({
    id: 'advanced',
    group: 'evidence',
    order: 53,
    icon: 'sliders',
    title: 'Advanced Query',
    short: 'Advanced Query',
    description: 'Power-user query builder for verified live APIs and official link-outs, with a raw request preview.',
    warnings: ['Nothing is sent until you click Run Query. Do not enter PHI, personal data or confidential financial, bid, underwriting or claims data. Protected portals are never scraped and paywalls are never bypassed.'],
    render(ctx) {
      const def = RESOURCES[st.res];
      const v = st.values[st.res] || (st.values[st.res] = {});
      const built = def.need(v) ? def.build(v) : null;
      const sourceId = built && built.source ? built.source : def.source;
      const form = h(
        'form',
        { class: 'rq-adv', onsubmit: (e) => {
          e.preventDefault();
          if (!built) return R.util.announce('Please complete the required fields.');
          for (const val of Object.values(v)) {
            if (val && !R.privacy.checkInput(String(val)).ok) return R.util.announce(R.privacy.GENERIC_REJECT);
          }
          if (def.linkout) {
            R.shell.openExternal(built.url);
            return;
          }
          R.pipeline.ensureSession();
          st.run += 1;
          st.result = { key: 'adv:' + st.run, sourceId, label: def.label + ' (advanced query)', run: built.run };
          R.shell.refresh();
        } },
        h('div', { class: 'rq-filters' }, ui.select('Resource type', Object.entries(RESOURCES).map(([k, r]) => [k, r.label]), st.res, (val) => ((st.res = val), (st.result = null), R.shell.refresh()), { key: 'adv-res' }), ...def.fields.map(([k, label]) => ui.input(label, v[k] || '', (val) => {
          v[k] = val.trim();
        }, { key: 'adv-' + st.res + '-' + k }))),
        h('div', { class: 'rq-row' }, ui.button('Update preview', () => R.shell.refresh(), { cls: 'rq-btn-sm' }), h('button', { type: 'submit', class: 'rq-btn rq-btn-primary' }, def.linkout ? 'Open official source' : 'Run Query'), def.linkout ? null : ui.modeBadge(sourceId))
      );
      const tech = h('details', { class: 'rq-tech' }, h('summary', null, 'Technical details (request preview)'), built ? h('pre', { class: 'rq-pre' }, (built.url || '') + (built.body ? '\n\nBody:\n' + JSON.stringify(built.body, null, 2) : '')) : h('p', { class: 'rq-muted' }, 'Complete the required fields and press “Update preview”.'), h('p', { class: 'rq-fineprint' }, 'Headers: Accept: application/json · credentials: omit · cache: no-store · referrer: none. No API keys are used.'));
      if (built && !def.linkout && !R.runtime.isLive(sourceId)) tech.appendChild(ui.warning('This source is not live in this browser session; running will show the official link-out instead.', 'amber'));
      return h('div', null, form, tech, st.result && R.state.session ? ui.section('Results', { icon: 'list' }, ui.taskPanel(st.result, { auto: true })) : null);
    }
  });
})(window.JAQAWorkspace);
