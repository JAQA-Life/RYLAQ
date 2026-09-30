/*
 * searchPipeline.js — entity detection, intent routing, query plans and
 * session lifecycle.
 *
 * Pipeline: sanitize → privacy guard → local pattern detection → (optional)
 * live resolution → plan a SMALL initial request budget (≤ 5 Tier A calls)
 * → render Overview progressively → deeper modules lazy-load on open or on
 * explicit user action.
 *
 * Detection never guesses silently: it returns a primary interpretation with
 * a confidence label plus alternative candidates the user can switch to.
 * Cross-module hand-off happens through R.state.session (memory only); the
 * search term is never written to the URL.
 */
(function (R) {
  'use strict';

  /* --------------------------- task factories --------------------------- */
  const norm = (s) => String(s || '').toLowerCase().trim();
  const C = R.clients;
  const T = (R.T = {
    gleifSearch: (q) => ({ key: 'gleif:search:' + norm(q), sourceId: 'gleif', label: 'GLEIF legal entity search', run: () => C.gleif.search(q) }),
    gleifLei: (lei) => ({ key: 'gleif:lei:' + lei, sourceId: 'gleif', label: 'GLEIF LEI record', run: () => C.gleif.byLei(lei) }),
    gleifParent: (lei, which) => ({ key: `gleif:${which}:${lei}`, sourceId: 'gleif', label: which === 'ultimate' ? 'GLEIF ultimate parent' : 'GLEIF direct parent', run: () => C.gleif.parent(lei, which) }),
    gleifChildren: (lei) => ({ key: 'gleif:children:' + lei, sourceId: 'gleif', label: 'GLEIF direct children', run: () => C.gleif.children(lei, 20) }),
    wdSearch: (q) => ({ key: 'wd:search:' + norm(q), sourceId: 'wikidata', label: 'Wikidata background search', run: () => C.wikidata.search(q) }),
    wdIds: (qid) => ({ key: 'wd:ids:' + qid, sourceId: 'wikidata', label: 'Wikidata identifier cross-links', run: () => C.wikidata.identifiers(qid) }),
    wpSummary: (title) => ({ key: 'wp:' + norm(title), sourceId: 'wikipedia', label: 'Wikipedia summary', run: () => C.wikipedia.summary(title) }),
    secSubs: (cik) => ({ key: 'sec:subs:' + C.sec.padCik(cik), sourceId: 'sec', label: 'SEC EDGAR submissions', run: () => C.sec.submissions(cik) }),
    wbCountry: (iso) => ({ key: 'wb:country:' + iso, sourceId: 'worldbank', label: 'World Bank country profile', run: () => C.worldbank.country(iso) }),
    wbInd: (iso, k) => ({ key: `wb:ind:${iso}:${k}`, sourceId: 'worldbank', label: 'World Bank: ' + (C.worldbank.INDICATORS[k] || [k, k])[1], run: () => C.worldbank.indicator(iso, k) }),
    geocode: (name) => ({ key: 'geo:' + norm(name), sourceId: 'openmeteo', label: 'Location resolution (Open-Meteo geocoding)', run: () => C.openmeteo.geocode(name) }),
    quakes: (lat, lon, radius, days) => ({ key: `usgs:${(+lat).toFixed(2)},${(+lon).toFixed(2)}:${radius || 500}:${days || 30}`, sourceId: 'usgs', label: `USGS earthquakes (M4.5+, ${radius || 500} km, ${days || 30} days)`, run: () => C.usgs.near(lat, lon, radius || 500, days || 30, 4.5) }),
    forecast: (lat, lon, label) => ({ key: `om:fc:${(+lat).toFixed(2)},${(+lon).toFixed(2)}`, sourceId: 'openmeteo', label: '7-day forecast (Open-Meteo)', run: () => C.openmeteo.forecast(lat, lon, label) }),
    nws: (lat, lon) => ({ key: `nws:${(+lat).toFixed(2)},${(+lon).toFixed(2)}`, sourceId: 'nws', label: 'NWS active alerts (US only)', run: () => C.nws.alertsAt(lat, lon) }),
    overpass: (lat, lon) => ({ key: `osm:ports:${(+lat).toFixed(2)},${(+lon).toFixed(2)}`, sourceId: 'overpass', label: 'Mapped port features within 15 km (OpenStreetMap)', run: () => C.overpass.portsNear(lat, lon, 15000) }),
    kevCve: (cve) => ({ key: 'kev:cve:' + cve.toUpperCase(), sourceId: 'cisaKev', label: 'CISA KEV lookup', run: () => C.kev.byCve(cve) }),
    kevMentions: (t) => ({ key: 'kev:mentions:' + norm(t), sourceId: 'cisaKev', label: 'CISA KEV vendor/product mentions', run: () => C.kev.mentions(t) }),
    nvdCve: (cve) => ({ key: 'nvd:cve:' + cve.toUpperCase(), sourceId: 'nvd', label: 'NVD CVE record', run: () => C.nvd.cve(cve) }),
    nvdKeyword: (t) => ({ key: 'nvd:kw:' + norm(t), sourceId: 'nvd', label: 'NVD keyword search', run: () => C.nvd.keyword(t) }),
    cpscSearch: (t) => ({ key: 'cpsc:title:' + norm(t), sourceId: 'cpsc', label: 'CPSC recalls (title match)', run: () => C.cpsc.search(t) }),
    cpscNum: (n) => ({ key: 'cpsc:num:' + n, sourceId: 'cpsc', label: 'CPSC recall number', run: () => C.cpsc.byNumber(n) }),
    nhtsaCampaign: (id) => ({ key: 'nhtsa:' + id.toUpperCase(), sourceId: 'nhtsa', label: 'NHTSA recall campaign', run: () => C.nhtsa.campaign(id.toUpperCase()) }),
    usaAwards: (o) => ({ key: `usa:${o.kind || 'contracts'}:${o.recipient ? 'r:' + norm(o.recipient) : 'k:' + norm(o.keyword)}:${o.from || ''}:${o.to || ''}:${o.page || 1}`, sourceId: 'usaspending', label: `USAspending ${o.kind === 'grants' ? 'grants/assistance' : o.kind === 'idvs' ? 'IDVs / frameworks' : 'contract awards'} (${o.recipient ? 'recipient' : 'keyword'})`, run: () => C.usaspending.awards(o) }),
    usaAwardDetail: (id) => ({ key: 'usa:detail:' + id, sourceId: 'usaspending', label: 'USAspending award detail', run: () => C.usaspending.awardDetail(id) }),
    frSearch: (term, o) => ({ key: `fr:${norm(term)}:${JSON.stringify(o || {})}`, sourceId: 'federalRegister', label: 'Federal Register documents' + (o && o.type ? ' (' + o.type + ')' : ''), run: () => C.federalRegister.search(term, o) }),
    frDoc: (n) => ({ key: 'fr:doc:' + n, sourceId: 'federalRegister', label: 'Federal Register document', run: () => C.federalRegister.doc(n) }),
    courts: (q, type) => ({ key: `cl:${type || 'r'}:${norm(q)}`, sourceId: 'courtlistener', label: type === 'o' ? 'CourtListener opinions' : 'CourtListener dockets (RECAP)', run: () => C.courtlistener.search(q, type) }),
    ecb: (ccy) => ({ key: 'ecb:' + ccy, sourceId: 'ecb', label: 'ECB reference rate EUR/' + ccy, run: () => C.ecb.exr(ccy, 30) }),
    gdelt: (q) => ({ key: 'gdelt:' + norm(q), sourceId: 'gdelt', label: 'GDELT media signals (3 months)', run: () => C.gdelt.articles(q) }),
    epa: (name) => ({ key: 'epa:' + norm(name), sourceId: 'epa', label: 'EPA ECHO facilities (name match)', run: () => C.epa.facilities(name) })
  });

  /* ----------------------------- detection ----------------------------- */
  const TYPES = {
    organization: 'Organization', lei: 'Legal entity / LEI', ticker: 'Public company / ticker', cik: 'SEC CIK', registration: 'Registration number',
    insurer: 'Insurer', reinsurer: 'Reinsurer', broker: 'Broker', mga: 'MGA', captive: 'Captive / protected cell / RRG', ils: 'ILS / cat bond entity', tpa: 'TPA / claims administrator', syndicate: 'Lloyd’s syndicate',
    regulator: 'Regulator', ratingAgency: 'Rating agency (link-out)', country: 'Country / sovereign', port: 'Port / logistics node', place: 'Facility / geographic location',
    hs: 'Product / HS code', category: 'Category', cve: 'Cyber vulnerability (CVE)', cwe: 'Weakness (CWE)', tender: 'Tender / procurement notice', award: 'Award / contract', grant: 'Grant / funding opportunity',
    ppp: 'PPP / concession / infrastructure project', recall: 'Recall', regdoc: 'Regulatory document', sanctionsId: 'Sanctions / debarment triage', financeDomain: 'Finance risk domain', riskDomain: 'Global risk domain',
    insuranceLine: 'Insurance / reinsurance line', procurement: 'Procurement concept', standard: 'Standard / certification framework', digitalAsset: 'Digital asset concept', vessel: 'Vessel', aircraft: 'Aircraft', person: 'Person (restricted)', freetext: 'Free-text concept'
  };

  // Curated concept routes for common enterprise phrases (quick pills and typed concepts).
  const CONCEPTS = [
    [/^(ted( tender)?s?|tenders electronic daily)$/i, 'procurement', { focus: 'ted' }],
    [/^(usaspending( award)?s?|federal awards?)$/i, 'award', { focus: 'usaspending' }],
    [/^(sam( exclusions?| opportunit(y|ies))?|sam\.gov.*)$/i, 'sanctionsId', { focus: 'sam' }],
    [/^(ofac( search)?|sdn( list)?|sanctions( list)?( search)?|export control( entity list)?|entity list|debarment( list)?)$/i, 'sanctionsId', {}],
    [/^(cisa kev|kev|known exploited vulnerabilit(y|ies))$/i, 'riskDomain', { domain: 'cyber' }],
    [/^(cpsc recalls?|nhtsa recalls?|product recalls?)$/i, 'recall', { concept: true }],
    [/^(federal register( rules?)?|regulatory change( radar)?)$/i, 'regdoc', { concept: true }],
    [/^(world bank lpi|logistics performance( index)?|lpi)$/i, 'riskDomain', { domain: 'logistics' }],
    [/^(un procurement|ungm|world bank procurement|adb tenders?|afdb procurement|idb procurement|ebrd procurement|isdb procurement|development bank procurement)$/i, 'procurement', { focus: 'devBanks' }],
    [/^(eu funding( and| &) tenders|grants?|funding opportunit(y|ies)|subsid(y|ies))$/i, 'grant', {}],
    [/^(ppp( concession)?|concessions?|infrastructure projects?|public[- ]private partnership)$/i, 'ppp', {}],
    [/^(broker panel( tender)?|insurance claims platform( rfp)?|actuarial services( tender)?|captive management( tender)?)$/i, 'procurement', { insuranceRelated: true }],
    [/^(tenders?|rfps?|rfqs?|itts?|eois?|pqqs?|bids?|framework agreements?|dynamic purchasing system|procurement)$/i, 'procurement', {}],
    [/^(modern slavery( registry| register)?)$/i, 'riskDomain', { domain: 'modern-slavery' }],
    [/^(iso ?\d{4,5}(-\d)?|iso\/iec ?\d{4,5}|nist (csf|ai rmf|ssdf)|oecd due diligence|soc ?2|fidic|nec contracts?|solvency ii|iais icps?|cmmc|wto gpa|uncac|fatf)$/i, 'standard', {}],
    [/^(cat ?bonds?|ils|insurance[- ]linked securities?|captives?|reinsurance|retrocession|mga|tpa)$/i, 'insuranceLine', {}],
    [/^(crypto(currency)?|bitcoin|stablecoins?|digital assets?|virtual assets?)$/i, 'digitalAsset', {}],
    [/^(semiconductors?|battery materials|lithium[- ]ion batter(y|ies)|packaging resins?|plastics?|rare earth magnets?|permanent magnets?|steel|aluminium|aluminum|copper|solar panels?|pharmaceuticals?)$/i, 'category', {}]
  ];

  // HS heading hints for common categories (WCO HS nomenclature headings; verify with the official tariff).
  const CATEGORY_HS = {
    semiconductor: ['8541', '8542'], 'battery materials': ['2836.91', '2825.20', '8507.60'], 'lithium-ion': ['8507.60'], 'packaging resins': ['3901', '3902', '3907', '3923'], plastics: ['3901', '3923'],
    'rare earth magnets': ['8505.11', '2846'], 'permanent magnets': ['8505.11'], steel: ['72', '73'], aluminium: ['76'], aluminum: ['76'], copper: ['74'], 'solar panels': ['8541.43'], pharmaceuticals: ['30']
  };

  function categoryHs(q) {
    const t = q.toLowerCase();
    for (const [k, v] of Object.entries(CATEGORY_HS)) if (t.includes(k)) return v;
    return [];
  }

  const COMPANY_SUFFIX = /\b(inc|incorporated|corp|corporation|co|company|ltd|limited|llc|llp|plc|ag|se|sa|nv|bv|gmbh|kgaa|spa|s\.p\.a\.|srl|oyj|ab|asa|pte|bhd|berhad|kk|pty|holdings?|group|partners|industries|technologies|systems|manufacturing|logistics|bank|capital|trust|fund)\.?$/i;

  function detect(raw) {
    const q = raw.trim();
    const up = q.toUpperCase();
    const cands = [];
    const add = (type, confidence, reason, extra) => cands.push(Object.assign({ type, label: TYPES[type], confidence, reason }, extra || {}));

    // Strong identifier patterns first.
    if (R.privacy.isValidLei(up)) add('lei', 'High', 'Matches ISO 17442 LEI format with valid check digits', { lei: up });
    else if (/^[A-Z0-9]{18}[0-9]{2}$/.test(up)) add('lei', 'Low', 'Looks like an LEI but check digits do not validate', { lei: up });
    let m;
    if ((m = /^CVE-(\d{4})-(\d{4,})$/i.exec(q))) add('cve', 'High', 'CVE identifier pattern', { cve: up });
    if ((m = /^CWE-(\d{1,5})$/i.exec(q))) add('cwe', 'High', 'CWE identifier pattern', { cwe: m[1] });
    if ((m = /^(?:CIK\s*)?(\d{10})$/i.exec(q)) || (m = /^CIK\s*(\d{1,10})$/i.exec(q))) add('cik', /^CIK/i.test(q) ? 'High' : 'Medium', '10-digit number may be an SEC CIK', { cik: m[1] });
    if ((m = /^HS\s*(\d{4}(?:[.\s]?\d{2}){0,3})$/i.exec(q))) add('hs', 'High', 'Explicit HS code', { hs: m[1].replace(/\s/g, '') });
    else if ((m = /^(\d{4}\.\d{2}(?:\.\d{2}){0,2})$/.exec(q))) add('hs', 'Medium', 'Dotted HS-style code', { hs: m[1] });
    else if ((m = /^(\d{4}|\d{6}|\d{8})$/.exec(q))) add('hs', 'Low', 'Digits could be an HS heading/subheading (or UNSPSC/NAICS)', { hs: m[1] });
    if ((m = /^(\d{2}[VETC]\d{6})$/i.exec(q))) add('recall', 'High', 'NHTSA recall campaign number pattern', { nhtsa: up });
    if ((m = /^(?:CPSC\s*)?(\d{2}-?\d{3})$/i.exec(q))) add('recall', /CPSC/i.test(q) ? 'High' : 'Low', 'Could be a CPSC recall number', { cpsc: m[1].replace('-', '') });
    if ((m = /^(\d{4}-\d{5})$/.exec(q))) add('regdoc', 'High', 'Federal Register document number pattern', { frDoc: m[1] });
    if (/^[A-Z]{2,8}(-[A-Z0-9]{1,8}){1,3}-\d{4}-\d{3,5}$/.test(up)) add('regdoc', 'Medium', 'Regulatory docket pattern', { docket: up });
    if ((m = /^(\d{1,8}-\d{4})$/.exec(q))) add('tender', 'High', 'TED notice publication-number pattern', { ted: m[1] });
    if (/^\d{4}\/S \d{3}-\d{6}$/i.test(q)) add('tender', 'High', 'Legacy TED OJ S reference', { ted: q });
    if (/^(CONT_AWD|CONT_IDV|ASST_NON|ASST_AGG)_/i.test(q)) add(/^ASST/i.test(q) ? 'grant' : 'award', 'High', 'USAspending generated award identifier', { generatedId: q });
    else if (/^[A-Z0-9]{4,6}\d{2}[A-Z]\d{4,}$/i.test(q) && /\d/.test(q) && /[A-Z]/i.test(q)) add('award', 'Low', 'Could be a US federal contract PIID', { piid: up });
    if (/^[A-Z0-9]{12}$/.test(up) && /\d/.test(up) && /[A-Z]/.test(up) && !cands.length) add('registration', 'Low', 'Could be a SAM.gov UEI (12 characters)', { uei: up });
    if (/^(SC|NI|OC|SO|NC|R0)?\d{6,8}$/i.test(q) && !cands.some((c) => c.type === 'hs' && c.confidence !== 'Low')) add('registration', 'Low', 'Could be a UK Companies House number', { ukco: up });
    if ((m = /^IMO\s?(\d{7})$/i.exec(q))) add('vessel', 'High', 'IMO ship identification number', { imo: m[1] });
    if (/^([A-Z]{2})\s?([A-Z2-9]{3})$/.test(up) && q === up && q.length >= 5 && R.geo.byIso2(up.slice(0, 2))) add('port', 'Low', 'Could be a UN/LOCODE', { locode: up.replace(/\s/g, '') });
    if (/^N\d{1,5}[A-Z]{0,2}$/.test(up) && q === up) add('aircraft', 'Low', 'Could be a US aircraft N-number');

    const country = R.geo.findCountry(q);
    if (country) add('country', q.length <= 3 ? 'Medium' : 'High', 'Matches a country name or ISO code', { iso2: country.iso2, iso3: country.iso3, countryName: country.name });

    if (/^\$?[A-Z]{1,5}(\.[A-Z])?$/.test(q) && q === up && !/^(CVE|CWE)$/.test(q)) add('ticker', country ? 'Low' : 'Medium', 'Uppercase short symbol could be a stock ticker', { ticker: q.replace('$', '') });
    if ((m = /^(NYSE|NASDAQ|LSE|TSX|ASX|XETRA|EURONEXT)\s*[:\s]\s*([A-Z.]{1,6})$/i.exec(q))) add('ticker', 'High', 'Exchange-qualified ticker', { ticker: m[2].toUpperCase(), exchange: m[1].toUpperCase() });

    // Curated concepts.
    for (const [re, type, extra] of CONCEPTS) if (re.test(q)) add(type, 'High', 'Recognized enterprise concept', Object.assign({ concept: true }, extra));

    // Taxonomy matches.
    const tx = R.taxonomy.matchDomains(q);
    if (tx.finance.length) add('financeDomain', 'High', 'Matches Finance Risk Universe domain', { domains: tx.finance.map((x) => x.id) });
    if (tx.global.length) add('riskDomain', 'High', 'Matches Global Risk Universe domain', { domains: tx.global.map((x) => x.id) });
    const lines = R.taxonomy.matchInsuranceLine(q);
    if (lines.length && /\b(insurance|cover|coverage|liability|d&o|e&o|indemnity|marine|cargo|reinsurance)\b/i.test(q) && !COMPANY_SUFFIX.test(q)) add('insuranceLine', 'High', 'Matches an insurance line', { lines: lines.map((l) => l.id) });

    // Ports and places.
    if (/\b(port of|port|harbou?r|terminal|seaport|airport)\b/i.test(q) && !cands.some((c) => c.type === 'port' && c.confidence !== 'Low')) {
      const place = q.replace(/\b(port of|port|harbou?r|terminal|seaport|airport)\b/gi, '').replace(/\s+/g, ' ').trim();
      if (place.length >= 3) add('port', 'Medium', 'Contains a port/logistics keyword', { placeName: place });
    }

    // Insurance entity types (organization names containing insurance words).
    const insType = R.taxonomy.insuranceEntityTypes.find((t) => t.re.test(q));
    const isConcept = cands.some((c) => c.concept);
    if (insType && !isConcept && q.split(' ').length >= 2) add(insType.id, 'Medium', 'Organization name contains “' + insType.name.toLowerCase() + '” terms', { orgName: q });

    // Generic organization / category / person / free-text.
    const strong = cands.some((c) => c.confidence === 'High');
    if (!strong || COMPANY_SUFFIX.test(q)) {
      if (COMPANY_SUFFIX.test(q)) add('organization', 'High', 'Contains a legal-entity suffix', { orgName: q });
      else if (/^[A-Za-z0-9&.,'’\- ]{2,80}$/.test(q) && !cands.length) add('organization', 'Medium', 'Looks like an organization name', { orgName: q });
      else if (!cands.some((c) => c.type === 'organization')) add('organization', 'Low', 'Could be an organization name', { orgName: q });
    }
    if (cands.some((c) => c.type === 'category')) cands.find((c) => c.type === 'category').hsHints = categoryHs(q);
    if (/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(q) && !COMPANY_SUFFIX.test(q) && !country && !insType) add('person', 'Low', 'Looks like a personal name — person searches are restricted');
    add('freetext', 'Low', 'Treat as a free-text concept', {});

    // De-duplicate by type keeping the highest confidence, then order.
    const rank = { High: 0, Medium: 1, Low: 2 };
    const byType = new Map();
    cands.forEach((c) => {
      const prev = byType.get(c.type);
      if (!prev || rank[c.confidence] < rank[prev.confidence]) byType.set(c.type, Object.assign({}, prev || {}, c));
    });
    const list = [...byType.values()].sort((a, b) => rank[a.confidence] - rank[b.confidence] || (a.type === 'freetext') - (b.type === 'freetext'));
    return { query: q, primary: list[0], candidates: list };
  }

  /* --------------------------- routing & plans --------------------------- */
  const ORG_TYPES = ['organization', 'insurer', 'reinsurer', 'broker', 'mga', 'captive', 'ils', 'tpa', 'syndicate', 'registration'];
  const ROUTE = {
    riskDomain: 'globalRisk', financeDomain: 'financeRisk', insuranceLine: 'insurance', procurement: 'procurement', tender: 'procurement', award: 'awards', grant: 'grants', ppp: 'ppp',
    cve: 'cyber', cwe: 'cyber', regdoc: 'regulatory', standard: 'standards', sanctionsId: 'sanctions', hs: 'trade', category: 'trade', digitalAsset: 'marketMacro', person: 'overview'
  };
  function lensesFor(type) {
    if (ORG_TYPES.includes(type) || ['lei', 'ticker', 'cik'].includes(type)) {
      const base = ['org360', 'fragility', 'sanctions', 'credit', 'supplyChain', 'awards', 'cyber', 'relationships'];
      if (['insurer', 'reinsurer', 'broker', 'mga', 'captive', 'ils', 'tpa', 'syndicate'].includes(type)) base.splice(1, 0, 'insurance', 'insuranceStrength');
      if (['ticker', 'cik'].includes(type)) base.splice(1, 0, 'filings');
      return base;
    }
    const map = {
      country: ['marketMacro', 'climate', 'esg', 'trade', 'sanctions', 'procurement', 'globalRisk'],
      port: ['climate', 'supplyChain', 'trade', 'relationships'],
      place: ['climate', 'supplyChain'],
      hs: ['trade', 'supplyChain', 'regulatory'],
      category: ['trade', 'supplyChain', 'procurement', 'regulatory'],
      cve: ['cyber', 'supplyChain'],
      cwe: ['cyber'],
      recall: ['supplyChain', 'org360'],
      regdoc: ['regulatory'],
      tender: ['procurement', 'awards'],
      award: ['awards', 'procurement', 'org360'],
      grant: ['grants', 'procurement'],
      ppp: ['ppp', 'grants', 'procurement'],
      riskDomain: ['globalRisk', 'regulatory', 'scenario'],
      financeDomain: ['financeRisk', 'fragility', 'marketMacro'],
      insuranceLine: ['insurance', 'insuranceStrength', 'climate', 'procurement'],
      procurement: ['procurement', 'awards', 'grants', 'ppp'],
      standard: ['standards', 'cyber', 'esg'],
      sanctionsId: ['sanctions', 'credit'],
      digitalAsset: ['marketMacro', 'sanctions'],
      vessel: ['supplyChain', 'sanctions'],
      aircraft: ['supplyChain'],
      person: ['session'],
      freetext: ['globalRisk', 'regulatory', 'org360']
    };
    return map[type] || ['globalRisk'];
  }

  /** Initial (Tier A) plan. Keep it small: at most five requests. */
  function initialPlan(c, q) {
    const p = [];
    const t = c.type;
    if (ORG_TYPES.includes(t)) {
      const name = c.orgName || q;
      p.push(T.gleifSearch(name), T.wdSearch(name));
    } else if (t === 'lei') {
      p.push(T.gleifLei(c.lei), T.gleifParent(c.lei, 'direct'), T.gleifParent(c.lei, 'ultimate'));
    } else if (t === 'cik') {
      p.push(T.secSubs(c.cik));
    } else if (t === 'ticker') {
      p.push(T.wdSearch(c.ticker + ' company'), T.gleifSearch(c.ticker));
    } else if (t === 'country') {
      p.push(T.wbCountry(c.iso3), T.wbInd(c.iso3, 'lpi'), T.wbInd(c.iso3, 'inflation'), T.wbInd(c.iso3, 'wgiPV'));
    } else if (t === 'port' || t === 'place') {
      if (c.placeName) p.push(T.geocode(c.placeName));
    } else if (t === 'cve') {
      p.push(T.kevCve(c.cve), T.nvdCve(c.cve));
    } else if (t === 'recall') {
      if (c.nhtsa) p.push(T.nhtsaCampaign(c.nhtsa));
      if (c.cpsc) p.push(T.cpscNum(c.cpsc));
      if (c.concept) p.push(T.frSearch('recall', { perPage: 5, order: 'newest' }));
    } else if (t === 'regdoc') {
      if (c.frDoc) p.push(T.frDoc(c.frDoc));
      else p.push(T.frSearch(c.docket || (c.concept ? 'rule' : q), { perPage: 10, order: 'newest' }));
    } else if (t === 'award') {
      if (c.generatedId) p.push(T.usaAwardDetail(c.generatedId));
      else p.push(T.usaAwards({ keyword: c.piid || (c.concept ? 'services' : q), kind: 'contracts' }));
    } else if (t === 'grant') {
      if (c.generatedId) p.push(T.usaAwardDetail(c.generatedId));
      else p.push(T.usaAwards({ keyword: c.concept ? 'infrastructure' : q, kind: 'grants' }));
    } else if (t === 'riskDomain' || t === 'financeDomain' || t === 'freetext' || t === 'standard') {
      p.push(T.frSearch(q, { perPage: 8 }));
      if (t === 'freetext') p.push(T.gleifSearch(q));
    } else if (t === 'insuranceLine') {
      p.push(T.frSearch(q, { perPage: 8 }), T.usaAwards({ keyword: q.replace(/\binsurance\b/i, '').trim().length > 3 ? q : 'insurance', kind: 'contracts' }));
    } else if (t === 'procurement' || t === 'tender' || t === 'ppp') {
      const kw = c.concept ? (c.insuranceRelated ? q.replace(/\b(tender|rfp)\b/i, '').trim() : t === 'ppp' ? 'public-private partnership' : 'services') : q;
      p.push(T.usaAwards({ keyword: kw, kind: 'contracts' }));
      if (t === 'ppp') p.push(T.frSearch('public-private partnership', { perPage: 5 }));
    } else if (t === 'hs' || t === 'category') {
      p.push(T.frSearch(t === 'hs' ? 'HTS ' + c.hs.slice(0, 4) : q + ' tariff', { perPage: 8, order: 'newest' }));
      if (t === 'category') p.push(T.cpscSearch(q));
    } else if (t === 'sanctionsId') {
      p.push(T.frSearch(c.focus === 'sam' ? 'debarment' : 'sanctions', { perPage: 8, order: 'newest' }));
    } else if (t === 'digitalAsset') {
      p.push(T.frSearch(q, { perPage: 8, order: 'newest' }));
    } else if (t === 'cwe') {
      // Link-out only (MITRE CWE); no live request needed.
    }
    return p.slice(0, 5);
  }

  /* ----------------------------- session ----------------------------- */
  function newSession(query, detection, chosen) {
    if (R.state.session && R.state.session.controller) R.state.session.controller.abort();
    R.state.generation += 1;
    R.net.resetCache();
    R.state.session = {
      id: R.util.uid('s'),
      query,
      detection,
      chosen,
      tasks: new Map(),
      controller: new AbortController(),
      startedAt: new Date(),
      primary: null,
      resolved: {},
      history: [],
      historyIndex: -1
    };
    return R.state.session;
  }

  /** After a place is resolved, fan out to event sources (still within budget). */
  function afterGeocode(task) {
    const s = R.state.session;
    if (!s || !task.records.length) return;
    const top = task.records[0];
    const { lat, lon, country } = top.data;
    s.resolved.lat = lat;
    s.resolved.lon = lon;
    s.resolved.placeLabel = top.title;
    s.resolved.iso2 = s.resolved.iso2 || country;
    const plan = [T.quakes(lat, lon, 500, 30), T.forecast(lat, lon, top.title)];
    if (country === 'US' || country === 'PR') plan.push(T.nws(lat, lon));
    const keys = plan.map((d) => R.tasks.ensure(d).key);
    s.autoKeys.push(...keys);
    R.tasks.runAll(keys);
    R.events.emit('session:resolved');
  }

  /** Organization flow: pick an unambiguous GLEIF/Wikidata match; otherwise ask the user. */
  function afterOrgSearch(task) {
    const s = R.state.session;
    if (!s) return;
    if (task.sourceId === 'gleif' && !s.primary) {
      const exact = task.records.filter((r) => r.prov.confidence === 'Exact');
      if (exact.length === 1) selectPrimary(exact[0], { auto: true });
    }
    if (task.sourceId === 'wikidata' && task.records.length && !s.resolved.qid) {
      const q = s.chosen.orgName || s.chosen.ticker || s.query;
      const top = task.records[0];
      const conf = R.match.matchConfidence(q.replace(/ company$/i, ''), top.data.label);
      if (conf === 'Exact' || conf === 'Likely' || s.chosen.type === 'ticker') {
        s.resolved.qid = top.data.qid;
        const d = T.wdIds(top.data.qid);
        R.tasks.ensure(d);
        s.autoKeys.push(d.key);
        R.tasks.start(d.key);
      }
    }
    if (task.key.startsWith('wd:ids:') && task.records.length) {
      const ids = task.records[0].data;
      if (ids.cik && !s.resolved.cik) {
        s.resolved.cik = ids.cik;
        const d = T.secSubs(ids.cik);
        R.tasks.ensure(d);
        s.autoKeys.push(d.key);
        R.tasks.start(d.key);
      }
      if (ids.lei && !s.resolved.lei && s.chosen.type === 'ticker') {
        const d = T.gleifLei(ids.lei);
        R.tasks.ensure(d);
        s.autoKeys.push(d.key);
        R.tasks.start(d.key).then((t) => t && t.records[0] && !s.primary && selectPrimary(t.records[0], { auto: true, confidence: 'Likely' }));
      }
    }
    if (task.key.startsWith('gleif:lei:') && task.records.length && !s.primary && s.chosen.type === 'lei') selectPrimary(task.records[0], { auto: true });
    if (task.key.startsWith('sec:subs:') && task.records.length) {
      s.resolved.secName = task.records[0].data.name;
      if (!s.primary && s.chosen.type === 'cik') selectPrimary(task.records[0], { auto: true });
    }
    if (task.key.startsWith('wb:country:') && task.records.length) {
      const c = task.records[0].data;
      Object.assign(s.resolved, { iso2: c.iso2, iso3: c.iso3, countryName: c.name, lat: c.lat, lon: c.lon, placeLabel: c.capital ? c.capital + ' (capital, reference point)' : c.name });
      R.events.emit('session:resolved');
    }
  }

  function selectPrimary(record, opts) {
    const s = R.state.session;
    if (!s) return;
    s.primary = record;
    s.primaryConfidence = (opts && opts.confidence) || record.prov.confidence || 'Likely';
    s.primaryAuto = !!(opts && opts.auto);
    if (record.ids.lei) s.resolved.lei = record.ids.lei;
    if (record.ids.cik) s.resolved.cik = record.ids.cik;
    if (record.data && record.data.country && !s.resolved.iso2) s.resolved.iso2 = String(record.data.country).slice(0, 2);
    s.resolved.entityName = record.title;
    R.events.emit('primary:changed', record);
  }

  async function run(rawQuery, forcedType) {
    const check = R.privacy.checkInput(rawQuery);
    if (!check.ok) return { rejected: true, reason: check.reason };
    const detection = detect(check.value);
    let chosen = detection.primary;
    if (forcedType) chosen = detection.candidates.find((c) => c.type === forcedType) || Object.assign({ type: forcedType, label: TYPES[forcedType], confidence: 'Manual', reason: 'Selected by user' }, forcedType === 'organization' ? { orgName: check.value } : forcedType === 'port' || forcedType === 'place' ? { placeName: check.value } : {});
    const s = newSession(check.value, detection, chosen);
    s.autoKeys = [];
    s.lenses = lensesFor(chosen.type);
    if (chosen.type === 'country') Object.assign(s.resolved, { iso2: chosen.iso2, iso3: chosen.iso3, countryName: chosen.countryName });
    if (chosen.type === 'lei') s.resolved.lei = chosen.lei;
    if (chosen.type === 'cik') s.resolved.cik = chosen.cik;
    const plan = initialPlan(chosen, check.value);
    plan.forEach((d) => R.tasks.ensure(d));
    s.autoKeys = plan.map((d) => d.key);
    R.events.emit('session:started', s);
    R.util.announce('Investigating. Results will appear as sources respond.');
    await R.tasks.runAll(s.autoKeys.slice());
    return { session: s, route: ROUTE[chosen.type] || 'overview' };
  }

  // Follow-up hooks (kept here so all orchestration is in one place).
  R.events.on('task:update', (t) => {
    const s = R.state.session;
    if (!s || !(t.status === 'done' || t.status === 'empty')) return;
    if (t.key.startsWith('geo:')) afterGeocode(t);
    if (/^(gleif:search|wd:search|wd:ids|gleif:lei|sec:subs|wb:country)/.test(t.key)) afterOrgSearch(t);
  });

  /** Minimal session for Advanced Query when no search has run (no initial plan). */
  function ensureSession() {
    if (R.state.session) return R.state.session;
    const chosen = { type: 'freetext', label: 'Advanced query', confidence: 'Manual', reason: 'Advanced Query builder' };
    const s = newSession('(advanced query)', { query: '', primary: chosen, candidates: [chosen] }, chosen);
    s.autoKeys = [];
    s.lenses = [];
    return s;
  }

  R.pipeline = { detect, run, ensureSession, selectPrimary, lensesFor, TYPES, ORG_TYPES, ROUTE, categoryHs };
})(window.JAQAWorkspace);
