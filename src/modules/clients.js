/*
 * clients.js — API clients for verified public sources.
 *
 * Every client returns { records, meta } or { error }. Records are normalized:
 *   { uid, kind, title, subtitle, fields: [[label, value]], badges, ids,
 *     links: [{label, href}], prov: { sourceId, sourceName, endpoint,
 *     retrievedAt, recordId, url, category, confidence }, data }
 *
 * Provenance is attached here, at the point of normalization, so every
 * rendered fact can be traced back to its source record. Missing fields are
 * rendered as "Not reported by source" — never guessed.
 *
 * Endpoints and response shapes used here were validated by
 * scripts/verify-cors.mjs (see config/cors-verification.json).
 */
(function (R) {
  'use strict';
  const { fmt } = R.util;
  const enc = encodeURIComponent;
  const isArr = Array.isArray;
  const obj = (v) => v && typeof v === 'object';

  let n = 0;
  function rec(sourceId, kind, p) {
    const src = R.sources.get(sourceId);
    return {
      uid: 'r' + ++n,
      kind,
      title: p.title || 'Untitled record',
      subtitle: p.subtitle || '',
      fields: (p.fields || []).filter((f) => f && f[1] !== undefined),
      badges: p.badges || [],
      ids: p.ids || {},
      links: p.links || [],
      summary: p.summary || '',
      data: p.data || {},
      flags: p.flags || {},
      prov: {
        sourceId,
        sourceName: src ? src.displayName : sourceId,
        endpoint: p.endpoint || '',
        retrievedAt: new Date(),
        recordId: p.recordId || '',
        url: p.url || (src && src.officialSiteUrl) || '',
        category: p.category || 'public-record',
        confidence: p.confidence || null,
        attribution: src ? src.attribution : ''
      }
    };
  }
  R.rec = rec;

  async function call(sourceId, url, opts) {
    const res = await R.net.request(sourceId, url, opts);
    if (!res.ok) return { error: res.errorKind, retryAt: res.retryAt };
    return { data: res.data };
  }

  /* ------------------------- name matching ------------------------- */
  const SUFFIX = /\b(incorporated|inc|corporation|corp|company|co|limited|ltd|plc|llc|llp|lp|ag|se|sa|s\.a|nv|bv|gmbh|kgaa|kg|spa|s\.p\.a|srl|sarl|oyj|ab|asa|as|pte|bhd|berhad|kk|pty|holdings?|group|the)\b/g;
  function normName(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[.,'’()\-/]/g, ' ')
      .replace(SUFFIX, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function matchConfidence(query, name) {
    const a = normName(query);
    const b = normName(name);
    if (!a || !b) return 'Unresolved';
    if (a === b) return 'Exact';
    if (b.startsWith(a + ' ') || a.startsWith(b + ' ')) return 'Likely';
    const ta = new Set(a.split(' '));
    const tb = b.split(' ');
    const overlap = tb.filter((t) => ta.has(t)).length;
    if (overlap && overlap >= Math.min(ta.size, tb.length)) return 'Likely';
    return 'Possible';
  }
  R.match = { normName, matchConfidence };

  function haversineKm(lat1, lon1, lat2, lon2) {
    const toR = (d) => (d * Math.PI) / 180;
    const dLat = toR(lat2 - lat1);
    const dLon = toR(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  R.util.haversineKm = haversineKm;

  const C = (R.clients = {});

  /* ------------------------------ GLEIF ------------------------------ */
  const GL = 'https://api.gleif.org/api/v1';
  function gleifRecord(d, query) {
    const a = (d && d.attributes) || {};
    const e = a.entity || {};
    const reg = a.registration || {};
    const addr = (x) => (x ? [...(x.addressLines || []), x.city, x.region, x.postalCode, x.country].filter(Boolean).join(', ') : null);
    const name = (e.legalName && e.legalName.name) || a.lei;
    const other = (e.otherNames || []).map((o) => o.name).filter(Boolean);
    const conf = query ? matchConfidence(query, name) : 'Exact';
    const badges = [{ text: 'Legal entity (LEI)', tone: 'org' }];
    if (e.status && e.status !== 'ACTIVE') badges.push({ text: 'Entity status: ' + e.status, tone: 'warn' });
    if (reg.status && reg.status !== 'ISSUED') badges.push({ text: 'LEI registration: ' + reg.status, tone: 'warn' });
    return rec('gleif', 'legal-entity', {
      title: name,
      subtitle: [e.jurisdiction, e.legalAddress && e.legalAddress.city].filter(Boolean).join(' · '),
      recordId: a.lei,
      url: 'https://search.gleif.org/#/record/' + a.lei,
      endpoint: 'lei-records',
      category: 'public-record',
      confidence: conf,
      ids: { lei: a.lei, country: e.jurisdiction ? String(e.jurisdiction).slice(0, 2) : (e.legalAddress && e.legalAddress.country) || null },
      badges,
      fields: [
        ['LEI', a.lei],
        ['Legal name', name],
        ['Other names', other.length ? other.join('; ') : null],
        ['Jurisdiction', e.jurisdiction],
        ['Legal form (ELF code)', e.legalForm && e.legalForm.id],
        ['Entity category', e.category],
        ['Entity status', e.status],
        ['Legal address', addr(e.legalAddress)],
        ['Headquarters address', addr(e.headquartersAddress)],
        ['Registered as', e.registeredAs],
        ['Registration authority ID', e.registeredAt && e.registeredAt.id],
        ['LEI registration status', reg.status],
        ['Initial registration', reg.initialRegistrationDate ? fmt.date(reg.initialRegistrationDate) : null],
        ['Last update', reg.lastUpdateDate ? fmt.date(reg.lastUpdateDate) : null],
        ['Next renewal', reg.nextRenewalDate ? fmt.date(reg.nextRenewalDate) : null],
        ['Corroboration level', reg.corroborationLevel],
        ['BIC (as reported)', isArr(a.bic) && a.bic.length ? a.bic.join(', ') : null]
      ],
      data: { name, lei: a.lei, jurisdiction: e.jurisdiction, country: (e.legalAddress && e.legalAddress.country) || null, status: e.status, otherNames: other }
    });
  }
  C.gleif = {
    async search(q, size) {
      const r = await call('gleif', `${GL}/lei-records?filter%5Bfulltext%5D=${enc(q)}&page%5Bsize%5D=${size || 10}`, { validate: (j) => isArr(j.data) });
      if (r.error) return r;
      const records = r.data.data.map((d) => gleifRecord(d, q));
      const order = { Exact: 0, Likely: 1, Possible: 2, Unresolved: 3 };
      records.sort((x, y) => order[x.prov.confidence] - order[y.prov.confidence]);
      const total = r.data.meta && r.data.meta.pagination ? r.data.meta.pagination.total : records.length;
      return { records, meta: { total } };
    },
    async byLei(lei) {
      const r = await call('gleif', `${GL}/lei-records/${enc(lei)}`, { allow404: true, validate: (j) => j === null || obj(j.data) });
      if (r.error) return r;
      return { records: r.data ? [gleifRecord(r.data.data)] : [] };
    },
    async parent(lei, which) {
      const path = which === 'ultimate' ? 'ultimate-parent' : 'direct-parent';
      const r = await call('gleif', `${GL}/lei-records/${enc(lei)}/${path}`, { allow404: true, validate: (j) => j === null || obj(j.data) });
      if (r.error) return r;
      if (!r.data) return { records: [], meta: { note: 'No ' + (which === 'ultimate' ? 'ultimate' : 'direct') + ' parent reported to GLEIF (the entity may be top-level, or may have filed a reporting exception).' } };
      const x = gleifRecord(r.data.data);
      x.prov.endpoint = path;
      x.prov.category = 'public-record';
      x.badges.push({ text: which === 'ultimate' ? 'Ultimate parent (GLEIF Level 2)' : 'Direct parent (GLEIF Level 2)', tone: 'org' });
      return { records: [x] };
    },
    async children(lei, size) {
      const r = await call('gleif', `${GL}/lei-records/${enc(lei)}/direct-children?page%5Bsize%5D=${size || 20}`, { allow404: true, validate: (j) => j === null || isArr(j.data) });
      if (r.error) return r;
      if (!r.data) return { records: [], meta: { total: 0 } };
      return { records: r.data.data.map((d) => gleifRecord(d)), meta: { total: r.data.meta && r.data.meta.pagination ? r.data.meta.pagination.total : r.data.data.length } };
    }
  };

  /* ---------------------------- World Bank ---------------------------- */
  const WB = 'https://api.worldbank.org/v2';
  C.worldbank = {
    INDICATORS: {
      lpi: ['LP.LPI.OVRL.XQ', 'Logistics Performance Index: overall (1=low to 5=high)'],
      gdpGrowth: ['NY.GDP.MKTP.KD.ZG', 'GDP growth (annual %)'],
      inflation: ['FP.CPI.TOTL.ZG', 'Inflation, consumer prices (annual %)'],
      fx: ['PA.NUS.FCRF', 'Official exchange rate (LCU per US$, period average)'],
      lending: ['FR.INR.LEND', 'Lending interest rate (%)'],
      realRate: ['FR.INR.RINR', 'Real interest rate (%)'],
      govDebt: ['GC.DOD.TOTL.GD.ZS', 'Central government debt, total (% of GDP)'],
      currentAccount: ['BN.CAB.XOKA.GD.ZS', 'Current account balance (% of GDP)'],
      reserves: ['FI.RES.TOTL.MO', 'Total reserves in months of imports'],
      extDebt: ['DT.DOD.DECT.GN.ZS', 'External debt stocks (% of GNI)'],
      npl: ['FB.AST.NPER.ZS', 'Bank nonperforming loans to total gross loans (%)'],
      bankCapital: ['FB.BNK.CAPA.ZS', 'Bank capital to assets ratio (%)'],
      privCredit: ['FS.AST.PRVT.GD.ZS', 'Domestic credit to private sector (% of GDP)'],
      trade: ['NE.TRD.GNFS.ZS', 'Trade (% of GDP)'],
      hightech: ['TX.VAL.TECH.MF.ZS', 'High-technology exports (% of manufactured exports)'],
      wgiCC: ['GOV_WGI_CC.EST', 'Control of Corruption: estimate (approx. -2.5 to +2.5)'],
      wgiGE: ['GOV_WGI_GE.EST', 'Government Effectiveness: estimate'],
      wgiPV: ['GOV_WGI_PV.EST', 'Political Stability and Absence of Violence/Terrorism: estimate'],
      wgiRQ: ['GOV_WGI_RQ.EST', 'Regulatory Quality: estimate'],
      wgiRL: ['GOV_WGI_RL.EST', 'Rule of Law: estimate'],
      wgiVA: ['GOV_WGI_VA.EST', 'Voice and Accountability: estimate']
    },
    async country(iso) {
      const r = await call('worldbank', `${WB}/country/${enc(iso)}?format=json`, { validate: (j) => isArr(j) });
      if (r.error) return r;
      const c = isArr(r.data[1]) ? r.data[1][0] : null;
      if (!c) return { records: [] };
      return {
        records: [
          rec('worldbank', 'country', {
            title: c.name,
            subtitle: [c.region && c.region.value, c.incomeLevel && c.incomeLevel.value].filter(Boolean).join(' · '),
            recordId: c.id,
            url: 'https://data.worldbank.org/country/' + c.iso2Code,
            endpoint: 'country',
            category: 'public-record',
            confidence: 'Exact',
            ids: { iso2: c.iso2Code, iso3: c.id },
            badges: [{ text: 'Country / sovereign', tone: 'risk' }],
            fields: [
              ['ISO codes', c.iso2Code + ' / ' + c.id],
              ['Region', c.region && c.region.value],
              ['Income level', c.incomeLevel && c.incomeLevel.value],
              ['Lending type', c.lendingType && c.lendingType.value],
              ['Capital city', c.capitalCity || null],
              ['Capital coordinates', c.latitude && c.longitude ? `${Number(c.latitude).toFixed(3)}, ${Number(c.longitude).toFixed(3)}` : null]
            ],
            data: { iso2: c.iso2Code, iso3: c.id, name: c.name, lat: Number(c.latitude) || null, lon: Number(c.longitude) || null, capital: c.capitalCity }
          })
        ]
      };
    },
    async indicator(iso, key) {
      const [code, label] = this.INDICATORS[key] || [key, key];
      const r = await call('worldbank', `${WB}/country/${enc(iso)}/indicator/${enc(code)}?format=json&mrv=6`, { validate: (j) => isArr(j) });
      if (r.error) return r;
      const rows = isArr(r.data[1]) ? r.data[1].filter((x) => x.value !== null) : [];
      if (!rows.length) return { records: [] };
      const latest = rows[0];
      const series = rows.map((x) => [x.date, x.value]).reverse();
      return {
        records: [
          rec('worldbank', 'indicator', {
            title: label,
            subtitle: `${latest.country && latest.country.value} · ${latest.date}`,
            recordId: code,
            url: `https://data.worldbank.org/indicator/${code}?locations=${latest.country ? latest.country.id : ''}`,
            endpoint: 'indicator/' + code,
            category: 'public-market-indicator',
            ids: { indicator: code },
            badges: [{ text: 'Annual indicator', tone: 'fin' }],
            fields: [
              ['Latest value', fmt.num(latest.value, 3)],
              ['Period', latest.date],
              ['Series (as reported)', series.map(([y, v]) => `${y}: ${fmt.num(v, 2)}`).join(' · ')],
              ['Source last updated', (r.data[0] && r.data[0].lastupdated) || null],
              ['Frequency / latency', 'Annual; typically lags 1–3 years']
            ],
            data: { code, value: latest.value, year: latest.date, series }
          })
        ]
      };
    }
  };

  /* ------------------------------- USGS ------------------------------- */
  function quakeRecord(f, ref) {
    const p = f.properties || {};
    const [lo, la, depth] = (f.geometry && f.geometry.coordinates) || [];
    const dist = ref && isFinite(la) ? haversineKm(ref.lat, ref.lon, la, lo) : null;
    const badges = [{ text: 'Seismic event', tone: 'warn' }];
    if (p.alert) badges.push({ text: 'USGS PAGER alert: ' + p.alert, tone: p.alert === 'green' ? 'neutral' : 'serious' });
    if (p.tsunami) badges.push({ text: 'Tsunami flag (source-reported)', tone: 'serious' });
    return rec('usgs', 'earthquake', {
      title: `M${fmt.num(p.mag, 1)} — ${p.place || 'location not reported'}`,
      subtitle: new Date(p.time).toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
      recordId: f.id,
      url: p.url,
      endpoint: 'fdsnws/event/1/query',
      category: 'public-event',
      badges,
      fields: [
        ['Magnitude', fmt.num(p.mag, 1) + (p.magType ? ' ' + p.magType : '')],
        ['Time (UTC)', new Date(p.time).toISOString()],
        ['Depth (km)', fmt.num(depth, 1)],
        ['Coordinates', isFinite(la) ? `${Number(la).toFixed(3)}, ${Number(lo).toFixed(3)}` : null],
        ref ? ['Distance from reference point (km, derived by JAQA)', dist !== null ? fmt.num(dist, 0) : null] : null,
        ['Review status', p.status],
        ['Significance (USGS sig)', p.sig]
      ].filter(Boolean),
      data: { mag: p.mag, dist, alert: p.alert, time: p.time, lat: la, lon: lo }
    });
  }
  C.usgs = {
    async near(lat, lon, radiusKm, days, minMag) {
      const start = new Date(Date.now() - (days || 30) * 86400000).toISOString().slice(0, 10);
      const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${lat}&longitude=${lon}&maxradiuskm=${radiusKm || 500}&minmagnitude=${minMag || 4.5}&starttime=${start}&orderby=magnitude&limit=20`;
      const r = await call('usgs', url, { validate: (j) => isArr(j.features) });
      if (r.error) return r;
      return { records: r.data.features.map((f) => quakeRecord(f, { lat, lon })), meta: { query: { radiusKm, days, minMag } } };
    },
    /** Global feed (fixed query, no user data): M≥minMag worldwide over the last N days. */
    async global(days, minMag, opts) {
      const start = new Date(Date.now() - (days || 7) * 86400000).toISOString().slice(0, 10);
      const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=${minMag || 4.5}&starttime=${start}&orderby=time&limit=150`;
      const r = await call('usgs', url, Object.assign({ validate: (j) => isArr(j.features) }, opts || {}));
      if (r.error) return r;
      return { records: r.data.features.map((f) => quakeRecord(f, null)), meta: { total: r.data.features.length } };
    }
  };

  /* ---------------------------- Open-Meteo ---------------------------- */
  C.openmeteo = {
    async geocode(name) {
      const r = await call('openmeteo', `https://geocoding-api.open-meteo.com/v1/search?name=${enc(name)}&count=5&language=en&format=json`, { validate: (j) => obj(j) });
      if (r.error) return r;
      const rows = isArr(r.data.results) ? r.data.results : [];
      return {
        records: rows.map((p, i) =>
          rec('openmeteo', 'place', {
            title: [p.name, p.admin1, p.country].filter(Boolean).join(', '),
            subtitle: `${fmt.num(p.latitude, 3)}, ${fmt.num(p.longitude, 3)}`,
            recordId: String(p.id),
            url: `https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=10/${p.latitude}/${p.longitude}`,
            endpoint: 'geocoding/search',
            category: 'public-record',
            confidence: i === 0 && rows.length === 1 ? 'Likely' : 'Possible',
            ids: { country: p.country_code },
            badges: [{ text: 'Geographic location', tone: 'neutral' }],
            fields: [
              ['Country', p.country],
              ['Admin region', p.admin1],
              ['Coordinates', `${p.latitude}, ${p.longitude}`],
              ['Feature code (GeoNames)', p.feature_code],
              ['Population (as reported)', p.population ? fmt.num(p.population, 0) : null],
              ['Timezone', p.timezone]
            ],
            data: { lat: p.latitude, lon: p.longitude, country: p.country_code, name: p.name }
          })
        )
      };
    },
    async forecast(lat, lon, label) {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max&forecast_days=7&timezone=auto`;
      const r = await call('openmeteo', url, { validate: (j) => obj(j.daily) && isArr(j.daily.time) });
      if (r.error) return r;
      const d = r.data.daily;
      const T = { gust: 75, rain: 50, heat: 40 };
      const flags = [];
      d.time.forEach((day, i) => {
        if (d.wind_gusts_10m_max[i] >= T.gust) flags.push(`${day}: gusts ${d.wind_gusts_10m_max[i]} km/h`);
        if (d.precipitation_sum[i] >= T.rain) flags.push(`${day}: precipitation ${d.precipitation_sum[i]} mm`);
        if (d.temperature_2m_max[i] >= T.heat) flags.push(`${day}: max temperature ${d.temperature_2m_max[i]} °C`);
      });
      const max = (a) => Math.max(...a.filter((x) => x !== null));
      const sum = (a) => a.reduce((s, x) => s + (x || 0), 0);
      return {
        records: [
          rec('openmeteo', 'forecast', {
            title: '7-day weather forecast' + (label ? ' — ' + label : ''),
            subtitle: `${d.time[0]} to ${d.time[d.time.length - 1]} (${r.data.timezone || 'local'})`,
            recordId: `${lat},${lon}`,
            url: 'https://open-meteo.com/',
            endpoint: 'v1/forecast',
            category: 'public-event',
            badges: [{ text: 'Model forecast (not an official warning)', tone: 'neutral' }, ...(flags.length ? [{ text: flags.length + ' threshold signal(s)', tone: 'warn' }] : [])],
            fields: [
              ['Max wind gust (km/h)', fmt.num(max(d.wind_gusts_10m_max), 0)],
              ['Total precipitation (mm)', fmt.num(sum(d.precipitation_sum), 1)],
              ['Max temperature (°C)', fmt.num(max(d.temperature_2m_max), 1)],
              ['Threshold signals (derived by JAQA)', flags.length ? flags.join('; ') : 'None at the displayed thresholds'],
              ['Thresholds used', `gust ≥ ${T.gust} km/h, daily precipitation ≥ ${T.rain} mm, max temperature ≥ ${T.heat} °C`]
            ],
            data: { flags, lat, lon }
          })
        ]
      };
    }
  };

  /* -------------------------------- NWS -------------------------------- */
  C.nws = {
    async alertsAt(lat, lon) {
      const r = await call('nws', `https://api.weather.gov/alerts/active?point=${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`, { validate: (j) => isArr(j.features), headers: { Accept: 'application/geo+json' } });
      if (r.error) return r;
      return {
        records: r.data.features.map((f) => {
          const p = f.properties || {};
          const serious = ['Extreme', 'Severe'].includes(p.severity);
          return rec('nws', 'weather-alert', {
            title: p.event || 'Weather alert',
            subtitle: p.areaDesc || '',
            recordId: p.id || f.id,
            url: 'https://alerts.weather.gov/',
            endpoint: 'alerts/active',
            category: 'public-event',
            badges: [{ text: 'Official NWS alert', tone: serious ? 'serious' : 'warn' }, { text: 'Severity: ' + (p.severity || 'not reported'), tone: 'neutral' }],
            fields: [
              ['Headline', p.headline],
              ['Severity', p.severity],
              ['Urgency', p.urgency],
              ['Certainty', p.certainty],
              ['Effective', p.effective],
              ['Expires', p.expires],
              ['Issued by', p.senderName]
            ],
            data: { severity: p.severity }
          });
        })
      };
    }
  };

  /* ------------------------------ CISA KEV ------------------------------ */
  let kevCatalog = null;
  R.events.on('session:cleared', () => {
    kevCatalog = null;
  });
  async function loadKev(opts) {
    if (kevCatalog) return { data: kevCatalog };
    const r = await call('cisaKev', 'https://raw.githubusercontent.com/cisagov/kev-data/develop/known_exploited_vulnerabilities.json', Object.assign({ validate: (j) => isArr(j.vulnerabilities) }, opts || {}));
    if (r.error) return r;
    kevCatalog = r.data;
    return r;
  }
  function kevRecord(v, catalogVersion) {
    return rec('cisaKev', 'vulnerability', {
      title: `${v.cveID} — ${v.vulnerabilityName || ''}`.trim(),
      subtitle: `${v.vendorProject || ''} · ${v.product || ''}`,
      recordId: v.cveID,
      url: 'https://nvd.nist.gov/vuln/detail/' + v.cveID,
      endpoint: 'known_exploited_vulnerabilities.json',
      category: 'public-record',
      ids: { cve: v.cveID },
      badges: [{ text: 'In CISA KEV (known exploited)', tone: 'serious' }, ...(v.knownRansomwareCampaignUse === 'Known' ? [{ text: 'Ransomware use: Known (source-reported)', tone: 'serious' }] : [])],
      fields: [
        ['CVE', v.cveID],
        ['Vendor / project', v.vendorProject],
        ['Product', v.product],
        ['Date added to KEV', v.dateAdded],
        ['Federal remediation due date', v.dueDate],
        ['Known ransomware campaign use', v.knownRansomwareCampaignUse],
        ['Required action (CISA)', v.requiredAction],
        ['Description', v.shortDescription],
        ['CWE', isArr(v.cwes) ? v.cwes.join(', ') : null],
        ['KEV catalog version', catalogVersion]
      ],
      links: [{ label: 'CISA KEV catalog', href: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog' }],
      data: { vendor: v.vendorProject, product: v.product }
    });
  }
  C.kev = {
    async byCve(cve) {
      const r = await loadKev();
      if (r.error) return r;
      const v = r.data.vulnerabilities.find((x) => String(x.cveID).toUpperCase() === cve.toUpperCase());
      return { records: v ? [kevRecord(v, r.data.catalogVersion)] : [], meta: { catalogVersion: r.data.catalogVersion, count: r.data.count } };
    },
    async recent(n, opts) {
      const r = await loadKev(opts);
      if (r.error) return r;
      const rows = r.data.vulnerabilities.slice().sort((a, b) => String(b.dateAdded).localeCompare(String(a.dateAdded)));
      return { records: rows.slice(0, n || 15).map((v) => kevRecord(v, r.data.catalogVersion)), meta: { total: r.data.count, catalogVersion: r.data.catalogVersion } };
    },
    async mentions(term) {
      const t = String(term || '').toLowerCase().trim();
      if (t.length < 3) return { records: [] };
      const r = await loadKev();
      if (r.error) return r;
      const hits = r.data.vulnerabilities.filter((v) => `${v.vendorProject} ${v.product}`.toLowerCase().includes(t));
      hits.sort((a, b) => String(b.dateAdded).localeCompare(String(a.dateAdded)));
      return { records: hits.slice(0, 25).map((v) => kevRecord(v, r.data.catalogVersion)), meta: { total: hits.length, catalogVersion: r.data.catalogVersion } };
    }
  };

  /* -------------------------------- NVD -------------------------------- */
  function nvdRecord(c) {
    const desc = (c.descriptions || []).find((d) => d.lang === 'en');
    const m = c.metrics || {};
    const pick = (m.cvssMetricV40 || m.cvssMetricV31 || m.cvssMetricV30 || m.cvssMetricV2 || [])[0];
    const cvss = pick && pick.cvssData ? pick.cvssData : null;
    const sev = cvss ? cvss.baseSeverity || (pick && pick.baseSeverity) : null;
    const cwes = (c.weaknesses || []).flatMap((w) => (w.description || []).map((d) => d.value)).filter((x) => /^CWE-/.test(x));
    return rec('nvd', 'vulnerability', {
      title: c.id,
      subtitle: `Published ${fmt.date(c.published)} · ${c.vulnStatus || ''}`,
      recordId: c.id,
      url: 'https://nvd.nist.gov/vuln/detail/' + c.id,
      endpoint: 'cves/2.0',
      category: 'public-record',
      ids: { cve: c.id },
      badges: [{ text: 'CVE record', tone: 'cyber' }, ...(sev ? [{ text: 'CVSS severity (source-reported): ' + sev, tone: 'neutral' }] : [])],
      summary: desc ? desc.value : '',
      fields: [
        ['CVE', c.id],
        ['Status', c.vulnStatus],
        ['Published', fmt.date(c.published)],
        ['Last modified', fmt.date(c.lastModified)],
        ['CVSS version / base score', cvss ? `${cvss.version || ''} / ${cvss.baseScore}` : null],
        ['CVSS vector', cvss ? cvss.vectorString : null],
        ['Weaknesses', cwes.length ? [...new Set(cwes)].join(', ') : null],
        ['References', isArr(c.references) ? c.references.length + ' (open NVD record)' : null],
        ['CISA KEV date added (per NVD)', c.cisaExploitAdd || null]
      ],
      data: { cwes }
    });
  }
  C.nvd = {
    async cve(id) {
      const r = await call('nvd', `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${enc(id)}`, { validate: (j) => isArr(j.vulnerabilities) });
      if (r.error) return r;
      return { records: r.data.vulnerabilities.map((v) => nvdRecord(v.cve)) };
    },
    async keyword(term) {
      const r = await call('nvd', `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${enc(term)}&resultsPerPage=10`, { validate: (j) => isArr(j.vulnerabilities) });
      if (r.error) return r;
      return { records: r.data.vulnerabilities.map((v) => nvdRecord(v.cve)), meta: { total: r.data.totalResults } };
    }
  };

  /* ------------------------------- CPSC ------------------------------- */
  function cpscRecord(x) {
    const names = (arr, k) => (isArr(arr) ? arr.map((a) => a[k || 'Name']).filter(Boolean).join('; ') : null);
    return rec('cpsc', 'recall', {
      title: x.Title || 'CPSC recall ' + x.RecallNumber,
      subtitle: `Recall ${x.RecallNumber} · ${fmt.date(x.RecallDate)}`,
      recordId: String(x.RecallNumber),
      url: x.URL,
      endpoint: 'RestWebServices/Recall',
      category: 'public-record',
      ids: { recall: String(x.RecallNumber) },
      badges: [{ text: 'Product recall (US CPSC)', tone: 'serious' }],
      fields: [
        ['Recall number', x.RecallNumber],
        ['Recall date', fmt.date(x.RecallDate)],
        ['Products', names(x.Products)],
        ['Hazards', names(x.Hazards)],
        ['Manufacturers', names(x.Manufacturers)],
        ['Retailers', names(x.Retailers)],
        ['Manufacturer countries', names(x.ManufacturerCountries, 'Country')],
        ['Remedies', names(x.Remedies)],
        ['Units (as reported)', names(x.Products, 'NumberOfUnits')]
      ],
      summary: x.Description || '',
      data: {}
    });
  }
  C.cpsc = {
    async search(title) {
      const r = await call('cpsc', `https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallTitle=${enc(title)}`, { validate: (j) => isArr(j) });
      if (r.error) return r;
      const rows = r.data.slice().sort((a, b) => String(b.RecallDate).localeCompare(String(a.RecallDate)));
      return { records: rows.slice(0, 20).map(cpscRecord), meta: { total: rows.length } };
    },
    async byNumber(num) {
      const r = await call('cpsc', `https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallNumber=${enc(num)}`, { validate: (j) => isArr(j) });
      if (r.error) return r;
      return { records: r.data.slice(0, 5).map(cpscRecord) };
    }
  };

  /* ------------------------------- NHTSA ------------------------------- */
  function nhtsaRecord(x) {
    return rec('nhtsa', 'recall', {
      title: `${x.NHTSACampaignNumber} — ${x.Component || 'Vehicle recall'}`,
      subtitle: `${x.Manufacturer || ''}${x.ModelYear ? ' · ' + [x.Make, x.Model, x.ModelYear].filter(Boolean).join(' ') : ''}`,
      recordId: x.NHTSACampaignNumber,
      url: 'https://www.nhtsa.gov/recalls',
      endpoint: 'recalls',
      category: 'public-record',
      ids: { recall: x.NHTSACampaignNumber },
      badges: [{ text: 'Vehicle recall (US NHTSA)', tone: 'serious' }],
      summary: x.Summary || '',
      fields: [
        ['Campaign number', x.NHTSACampaignNumber],
        ['Manufacturer', x.Manufacturer],
        ['Report received (as published)', x.ReportReceivedDate],
        ['Component', x.Component],
        ['Potential units affected', x.PotentialNumberofUnitsAffected ? fmt.num(x.PotentialNumberofUnitsAffected, 0) : null],
        ['Consequence', x.Consequence],
        ['Remedy', x.Remedy],
        ['Vehicle (make/model/year)', [x.Make, x.Model, x.ModelYear].filter(Boolean).join(' ') || null]
      ]
    });
  }
  C.nhtsa = {
    async campaign(id) {
      const r = await call('nhtsa', `https://api.nhtsa.gov/recalls/campaignNumber?campaignNumber=${enc(id)}`, { validate: (j) => isArr(j.results) });
      if (r.error) return r;
      return { records: r.data.results.slice(0, 20).map(nhtsaRecord), meta: { total: r.data.Count } };
    },
    async vehicle(make, model, year) {
      const r = await call('nhtsa', `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${enc(make)}&model=${enc(model)}&modelYear=${enc(year)}`, { validate: (j) => isArr(j.results) });
      if (r.error) return r;
      return { records: r.data.results.slice(0, 25).map(nhtsaRecord), meta: { total: r.data.Count } };
    }
  };

  /* ---------------------------- USAspending ---------------------------- */
  const USA = 'https://api.usaspending.gov/api/v2';
  const CONTRACT_CODES = ['A', 'B', 'C', 'D'];
  const GRANT_CODES = ['02', '03', '04', '05'];
  C.usaspending = {
    async awards(opts) {
      const o = opts || {};
      const filters = { award_type_codes: o.kind === 'grants' ? GRANT_CODES : o.kind === 'idvs' ? ['IDV_A', 'IDV_B', 'IDV_B_A', 'IDV_B_B', 'IDV_B_C', 'IDV_C', 'IDV_D', 'IDV_E'] : CONTRACT_CODES };
      if (o.recipient) filters.recipient_search_text = [o.recipient];
      if (o.keyword) filters.keywords = [o.keyword];
      if (o.from || o.to) filters.time_period = [{ start_date: o.from || '2007-10-01', end_date: o.to || new Date().toISOString().slice(0, 10) }];
      const body = {
        filters,
        fields: ['Award ID', 'Recipient Name', 'Start Date', 'End Date', 'Award Amount', 'Awarding Agency', 'Awarding Sub Agency', 'Description', 'Recipient UEI'],
        limit: o.limit || 10,
        page: o.page || 1,
        sort: o.sort || 'Award Amount',
        order: 'desc'
      };
      const r = await call('usaspending', `${USA}/search/spending_by_award/`, { method: 'POST', body, validate: (j) => isArr(j.results) });
      if (r.error) return r;
      const isGrant = o.kind === 'grants';
      return {
        records: r.data.results.map((x) =>
          rec('usaspending', isGrant ? 'grant' : 'award', {
            title: `${x['Award ID'] || 'Award'} — ${x['Recipient Name'] || 'Recipient not reported'}`,
            subtitle: [x['Awarding Agency'], x['Awarding Sub Agency']].filter(Boolean).join(' · '),
            recordId: x.generated_internal_id || x['Award ID'],
            url: x.generated_internal_id ? 'https://www.usaspending.gov/award/' + x.generated_internal_id : 'https://www.usaspending.gov/search',
            endpoint: 'search/spending_by_award',
            category: isGrant ? 'grant-notice' : 'award-notice',
            confidence: o.recipient ? matchConfidence(o.recipient, x['Recipient Name']) : null,
            ids: { award: x['Award ID'], uei: x['Recipient UEI'] || null },
            badges: [{ text: isGrant ? 'US federal grant/assistance award' : 'US federal contract award', tone: 'proc' }],
            summary: x.Description || '',
            fields: [
              ['Award ID', x['Award ID']],
              ['Recipient (as reported)', x['Recipient Name']],
              ['Recipient UEI', x['Recipient UEI']],
              ['Awarding agency', x['Awarding Agency']],
              ['Awarding sub-agency', x['Awarding Sub Agency']],
              ['Period of performance', `${x['Start Date'] || '?'} → ${x['End Date'] || '?'}`],
              ['Award amount (USD, as reported)', fmt.money(x['Award Amount'], 'USD')]
            ],
            data: { amount: x['Award Amount'], start: x['Start Date'], end: x['End Date'], generatedId: x.generated_internal_id }
          })
        ),
        meta: { hasNext: r.data.page_metadata ? !!r.data.page_metadata.hasNext : false }
      };
    },
    async awardDetail(generatedId) {
      const r = await call('usaspending', `${USA}/awards/${enc(generatedId)}/`, { validate: (j) => obj(j) });
      if (r.error) return r;
      const x = r.data;
      const lt = x.latest_transaction_contract_data || {};
      return {
        records: [
          rec('usaspending', 'award', {
            title: `${x.piid || x.fain || x.uri || generatedId} — ${(x.recipient && x.recipient.recipient_name) || ''}`,
            subtitle: x.type_description || x.category,
            recordId: x.generated_unique_award_id,
            url: 'https://www.usaspending.gov/award/' + x.generated_unique_award_id,
            endpoint: 'awards/{id}',
            category: 'award-notice',
            ids: { award: x.piid || x.fain },
            badges: [{ text: 'Award detail', tone: 'proc' }],
            summary: x.description || '',
            fields: [
              ['Type', x.type_description],
              ['Date signed', x.date_signed],
              ['Total obligation (USD)', fmt.money(x.total_obligation)],
              ['Base and all options (USD)', fmt.money(x.base_and_all_options)],
              ['Subaward count', x.subaward_count],
              ['Parent award', x.parent_award && (x.parent_award.piid || x.parent_award.generated_unique_award_id)],
              ['Solicitation identifier', lt.solicitation_identifier],
              ['Extent competed', lt.extent_competed_description],
              ['Number of offers received', lt.number_of_offers_received],
              ['Recipient parent (as reported)', x.recipient && x.recipient.parent_recipient_name],
              ['Period of performance', x.period_of_performance ? `${x.period_of_performance.start_date} → ${x.period_of_performance.end_date}` : null]
            ]
          })
        ]
      };
    }
  };

  /* -------------------------- Federal Register -------------------------- */
  const FR_FIELDS = ['title', 'type', 'abstract', 'document_number', 'html_url', 'publication_date', 'agencies', 'comments_close_on', 'effective_on', 'docket_ids', 'topics'];
  function frRecord(d) {
    const agencies = isArr(d.agencies) ? d.agencies.map((a) => a.name || a.raw_name).filter(Boolean) : [];
    const badges = [{ text: 'US regulatory document: ' + (d.type || 'document'), tone: 'reg' }];
    if (d.comments_close_on && d.comments_close_on >= new Date().toISOString().slice(0, 10)) badges.push({ text: 'Comment period open (verify)', tone: 'warn' });
    return rec('federalRegister', 'regulatory-document', {
      title: d.title,
      subtitle: `${agencies.join('; ')} · ${d.publication_date || ''}`,
      recordId: d.document_number,
      url: d.html_url,
      endpoint: 'documents',
      category: 'official-source-authoritative',
      ids: { frDoc: d.document_number },
      badges,
      summary: d.abstract || '',
      fields: [
        ['Document number', d.document_number],
        ['Action type', d.type],
        ['Agencies', agencies.length ? agencies.join('; ') : null],
        ['Publication date', d.publication_date],
        ['Comment deadline', d.comments_close_on || null],
        ['Effective date', d.effective_on || null],
        ['Dockets', isArr(d.docket_ids) && d.docket_ids.length ? d.docket_ids.join(', ') : null],
        ['Topics', isArr(d.topics) && d.topics.length ? d.topics.join(', ') : null]
      ],
      flags: { legalReviewRequired: true, deadlineRisk: !!d.comments_close_on }
    });
  }
  C.federalRegister = {
    async search(term, opts) {
      const o = opts || {};
      let url = `https://www.federalregister.gov/api/v1/documents.json?conditions%5Bterm%5D=${enc(term)}&per_page=${o.perPage || 10}&order=${o.order || 'relevance'}`;
      FR_FIELDS.forEach((f) => (url += '&fields%5B%5D=' + f));
      if (o.type) url += '&conditions%5Btype%5D%5B%5D=' + enc(o.type);
      if (o.agency) url += '&conditions%5Bagencies%5D%5B%5D=' + enc(o.agency);
      if (o.from) url += '&conditions%5Bpublication_date%5D%5Bgte%5D=' + enc(o.from);
      if (o.to) url += '&conditions%5Bpublication_date%5D%5Blte%5D=' + enc(o.to);
      const r = await call('federalRegister', url, { validate: (j) => obj(j), persistent: !!o.persistent });
      if (r.error) return r;
      return { records: (r.data.results || []).map(frRecord), meta: { total: r.data.count || 0 } };
    },
    async doc(num) {
      let url = `https://www.federalregister.gov/api/v1/documents/${enc(num)}.json?`;
      FR_FIELDS.forEach((f) => (url += 'fields%5B%5D=' + f + '&'));
      const r = await call('federalRegister', url, { allow404: true, validate: (j) => j === null || obj(j) });
      if (r.error) return r;
      return { records: r.data && r.data.document_number ? [frRecord(r.data)] : [] };
    }
  };

  /* ------------------------------ SEC EDGAR ------------------------------ */
  // 8-K item codes that correspond to publicly disclosed financial-stress,
  // audit or governance events. Presence is a source-reported filing fact —
  // not a prediction, score or conclusion.
  const EIGHT_K_ITEMS = {
    '1.03': 'Bankruptcy or Receivership',
    '1.05': 'Material Cybersecurity Incidents',
    '2.04': 'Triggering Events That Accelerate or Increase a Direct Financial Obligation',
    '2.05': 'Costs Associated with Exit or Disposal Activities',
    '2.06': 'Material Impairments',
    '3.01': 'Notice of Delisting or Failure to Satisfy a Continued Listing Rule',
    '4.01': 'Changes in Registrant’s Certifying Accountant',
    '4.02': 'Non-Reliance on Previously Issued Financial Statements (restatement)',
    '5.02': 'Departure/Appointment of Directors or Certain Officers'
  };
  C.sec = {
    EIGHT_K_ITEMS,
    padCik: (c) => String(c).replace(/\D/g, '').padStart(10, '0'),
    async submissions(cik) {
      const padded = this.padCik(cik);
      const r = await call('sec', `https://data.sec.gov/submissions/CIK${padded}.json`, { allow404: true, validate: (j) => j === null || obj(j.filings) });
      if (r.error) return r;
      if (!r.data) return { records: [] };
      const d = r.data;
      const rc = (d.filings && d.filings.recent) || {};
      const cikInt = String(Number(padded));
      const filings = [];
      const signals = [];
      const forms = rc.form || [];
      for (let i = 0; i < forms.length && filings.length < 400; i++) {
        const acc = rc.accessionNumber[i];
        const url = `https://www.sec.gov/Archives/edgar/data/${cikInt}/${String(acc).replace(/-/g, '')}/${rc.primaryDocument[i] || ''}`;
        const f = { form: forms[i], date: rc.filingDate[i], accession: acc, report: rc.reportDate ? rc.reportDate[i] : null, items: rc.items ? rc.items[i] : '', url };
        filings.push(f);
        if (/^NT /.test(f.form)) signals.push({ date: f.date, text: `${f.form} filed (notification of late filing)`, url, form: f.form });
        if (/^8-K/.test(f.form) && f.items) {
          String(f.items)
            .split(',')
            .map((s) => s.trim())
            .filter((it) => EIGHT_K_ITEMS[it])
            .forEach((it) => signals.push({ date: f.date, text: `8-K item ${it}: ${EIGHT_K_ITEMS[it]}`, url, form: f.form, item: it }));
        }
      }
      const latest = (re) => filings.find((f) => re.test(f.form));
      const k = latest(/^(10-K|20-F|40-F)$/);
      const q = latest(/^10-Q$/);
      const entity = rec('sec', 'filer', {
        title: d.name,
        subtitle: `CIK ${padded}${d.tickers && d.tickers.length ? ' · ' + d.tickers.join(', ') : ''}`,
        recordId: padded,
        url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${padded}&owner=exclude`,
        endpoint: 'submissions',
        category: 'public-filing',
        confidence: 'Exact',
        ids: { cik: padded, ticker: (d.tickers || [])[0] || null, lei: d.lei || null },
        badges: [{ text: 'SEC registrant', tone: 'fin' }, ...(signals.length ? [{ text: signals.length + ' filing event(s) to review', tone: 'warn' }] : [])],
        fields: [
          ['Name', d.name],
          ['CIK', padded],
          ['Tickers', (d.tickers || []).join(', ') || null],
          ['Exchanges', (d.exchanges || []).join(', ') || null],
          ['SIC', d.sic ? `${d.sic} — ${d.sicDescription || ''}` : null],
          ['Entity type', d.entityType],
          ['Filer category', d.category],
          ['State of incorporation', d.stateOfIncorporationDescription || d.stateOfIncorporation],
          ['Fiscal year end (MMDD)', d.fiscalYearEnd],
          ['LEI (as reported to SEC)', d.lei || null],
          ['Latest annual report', k ? `${k.form} filed ${k.date}` : null],
          ['Latest quarterly report', q ? `${q.form} filed ${q.date}` : null],
          ['Former names', isArr(d.formerNames) && d.formerNames.length ? d.formerNames.map((x) => x.name).join('; ') : null]
        ],
        data: { filings, signals, name: d.name }
      });
      return { records: [entity], meta: { filings, signals } };
    }
  };

  /* ---------------------------- CourtListener ---------------------------- */
  C.courtlistener = {
    async search(q, type) {
      const t = type === 'o' ? 'o' : 'r';
      const r = await call('courtlistener', `https://www.courtlistener.com/api/rest/v4/search/?q=${enc('"' + q.replace(/"/g, '') + '"')}&type=${t}&order_by=score%20desc`, { validate: (j) => isArr(j.results) });
      if (r.error) return r;
      return {
        records: r.data.results.slice(0, 15).map((x) =>
          rec('courtlistener', 'court-record', {
            title: x.caseName || x.caseNameFull || 'Case',
            subtitle: `${x.court || ''} · filed ${x.dateFiled || '?'}`,
            recordId: String(x.docket_id || x.cluster_id || ''),
            url: 'https://www.courtlistener.com' + (x.docket_absolute_url || x.absolute_url || '/'),
            endpoint: 'search (' + (t === 'o' ? 'opinions' : 'RECAP dockets') + ')',
            category: 'litigation-record',
            confidence: 'Possible',
            badges: [{ text: t === 'o' ? 'Court opinion' : 'Court docket (RECAP)', tone: 'legal' }, ...(x.chapter ? [{ text: 'Bankruptcy chapter ' + x.chapter + ' (source-reported)', tone: 'warn' }] : [])],
            fields: [
              ['Case name', x.caseName],
              ['Court', x.court],
              ['Docket number', x.docketNumber],
              ['Date filed', x.dateFiled],
              ['Date terminated', x.dateTerminated || null],
              ['Bankruptcy chapter', x.chapter || null],
              ['Cause / nature', x.cause || x.suitNature || null],
              ['Match basis', 'Name/keyword text match only — manual review recommended']
            ],
            flags: { legalReviewRequired: true }
          })
        ),
        meta: { total: r.data.count }
      };
    }
  };

  /* ------------------------ Wikidata / Wikipedia ------------------------ */
  const WD = 'https://www.wikidata.org/w/api.php';
  const claim = (claims, p) => (claims && claims[p] ? claims[p].map((c) => c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value).filter((v) => v !== undefined && v !== null) : []);
  C.wikidata = {
    async search(q) {
      const r = await call('wikidata', `${WD}?action=wbsearchentities&search=${enc(q)}&language=en&uselang=en&type=item&format=json&limit=6&origin=*`, { validate: (j) => isArr(j.search) });
      if (r.error) return r;
      return {
        records: r.data.search.map((x) =>
          rec('wikidata', 'background', {
            title: x.label || x.id,
            subtitle: x.description || '',
            recordId: x.id,
            url: 'https://www.wikidata.org/wiki/' + x.id,
            endpoint: 'wbsearchentities',
            category: 'public-record',
            confidence: matchConfidence(q, x.label) === 'Exact' ? 'Likely' : 'Possible',
            ids: { wikidata: x.id },
            badges: [{ text: 'Background (non-authoritative)', tone: 'neutral' }],
            fields: [
              ['Wikidata ID', x.id],
              ['Description', x.description || null]
            ],
            data: { qid: x.id, label: x.label }
          })
        )
      };
    },
    async identifiers(qid) {
      const r = await call('wikidata', `${WD}?action=wbgetentities&ids=${enc(qid)}&props=claims%7Clabels%7Cdescriptions%7Caliases%7Csitelinks&sitefilter=enwiki&languages=en&format=json&origin=*`, { validate: (j) => obj(j.entities) });
      if (r.error) return r;
      const e = r.data.entities[qid];
      if (!e) return { records: [] };
      const cl = e.claims || {};
      const tickers = [];
      (cl.P414 || []).forEach((c) => ((c.qualifiers && c.qualifiers.P249) || []).forEach((q) => q.datavalue && tickers.push(q.datavalue.value)));
      const lei = claim(cl, 'P1278')[0] || null;
      const cik = claim(cl, 'P5531')[0] || null;
      const website = claim(cl, 'P856')[0] || null;
      const isin = claim(cl, 'P946');
      const ukco = claim(cl, 'P2622')[0] || null;
      const oc = claim(cl, 'P1320')[0] || null;
      const inception = claim(cl, 'P571')[0];
      const label = e.labels && e.labels.en ? e.labels.en.value : qid;
      const aliases = e.aliases && e.aliases.en ? e.aliases.en.map((a) => a.value) : [];
      const enwiki = e.sitelinks && e.sitelinks.enwiki ? e.sitelinks.enwiki.title : null;
      return {
        records: [
          rec('wikidata', 'background', {
            title: label,
            subtitle: e.descriptions && e.descriptions.en ? e.descriptions.en.value : '',
            recordId: qid,
            url: 'https://www.wikidata.org/wiki/' + qid,
            endpoint: 'wbgetentities',
            category: 'public-record',
            confidence: 'Possible',
            ids: { wikidata: qid, lei, cik, ticker: tickers[0] || null, ukCompany: ukco },
            badges: [{ text: 'Identifier cross-links (non-authoritative)', tone: 'neutral' }],
            fields: [
              ['Aliases', aliases.length ? aliases.slice(0, 8).join('; ') : null],
              ['LEI (claimed on Wikidata)', lei],
              ['SEC CIK (claimed on Wikidata)', cik],
              ['Ticker(s)', tickers.length ? [...new Set(tickers)].join(', ') : null],
              ['ISIN(s)', isin.length ? isin.slice(0, 5).join(', ') : null],
              ['UK company number', ukco],
              ['OpenCorporates ID', oc],
              ['Official website (as listed)', website],
              ['Inception', inception && inception.time ? String(inception.time).replace(/^\+/, '').slice(0, 10) : null]
            ],
            links: [website ? { label: 'Official website (as listed on Wikidata)', href: website } : null, enwiki ? { label: 'Wikipedia article', href: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(enwiki.replace(/ /g, '_')) } : null].filter(Boolean),
            data: { lei, cik, tickers, website, enwiki, label, aliases }
          })
        ]
      };
    }
  };
  C.wikipedia = {
    async summary(title) {
      const r = await call('wikipedia', `https://en.wikipedia.org/api/rest_v1/page/summary/${enc(title.replace(/ /g, '_'))}`, { allow404: true, validate: (j) => j === null || obj(j) });
      if (r.error) return r;
      const d = r.data;
      if (!d || d.type === 'disambiguation' || !d.extract) return { records: [] };
      return {
        records: [
          rec('wikipedia', 'background', {
            title: d.title,
            subtitle: d.description || '',
            recordId: String(d.pageid || d.title),
            url: d.content_urls && d.content_urls.desktop ? d.content_urls.desktop.page : 'https://en.wikipedia.org/',
            endpoint: 'page/summary',
            category: 'public-record',
            confidence: 'Possible',
            badges: [{ text: 'Encyclopedic background (non-authoritative)', tone: 'neutral' }],
            summary: d.extract,
            fields: [['Last edited', d.timestamp ? fmt.date(d.timestamp) : null]]
          })
        ]
      };
    }
  };

  /* ------------------------------ Overpass ------------------------------ */
  C.overpass = {
    async portsNear(lat, lon, radiusM) {
      const rad = Math.min(radiusM || 15000, 30000);
      const q = `[out:json][timeout:20];(nwr["landuse"="port"](around:${rad},${lat},${lon});nwr["industrial"="port"](around:${rad},${lat},${lon});nwr["harbour"="yes"]["name"](around:${rad},${lat},${lon}););out center tags 25;`;
      const r = await call('overpass', 'https://overpass-api.de/api/interpreter?data=' + enc(q), { validate: (j) => isArr(j.elements) });
      if (r.error) return r;
      return {
        records: r.data.elements.map((e) => {
          const t = e.tags || {};
          const la = e.lat || (e.center && e.center.lat);
          const lo = e.lon || (e.center && e.center.lon);
          return rec('overpass', 'facility', {
            title: t.name || t['name:en'] || 'Unnamed port feature',
            subtitle: [t.operator, t.landuse || t.industrial || (t.harbour ? 'harbour' : '')].filter(Boolean).join(' · '),
            recordId: `${e.type}/${e.id}`,
            url: `https://www.openstreetmap.org/${e.type}/${e.id}`,
            endpoint: 'interpreter',
            category: 'public-record',
            confidence: 'Possible',
            badges: [{ text: 'Mapped port feature (OSM)', tone: 'neutral' }],
            fields: [
              ['Name', t.name],
              ['Operator (as mapped)', t.operator],
              ['Tag', t.landuse ? 'landuse=' + t.landuse : t.industrial ? 'industrial=' + t.industrial : 'harbour=yes'],
              ['Coordinates', la && lo ? `${Number(la).toFixed(4)}, ${Number(lo).toFixed(4)}` : null],
              ['Distance from reference (km, derived by JAQA)', la && lo ? fmt.num(haversineKm(lat, lon, la, lo), 1) : null]
            ]
          });
        })
      };
    }
  };

  /* -------------------------------- ECB -------------------------------- */
  C.ecb = {
    async exr(ccy, n, opts) {
      const r = await call('ecb', `https://data-api.ecb.europa.eu/service/data/EXR/D.${enc(ccy)}.EUR.SP00.A?format=jsondata&lastNObservations=${n || 30}`, Object.assign({ allow404: true, validate: (j) => j === null || isArr(j.dataSets) }, opts || {}));
      if (r.error) return r;
      if (!r.data) return { records: [] };
      const ds = r.data.dataSets[0] || {};
      const key = Object.keys(ds.series || {})[0];
      if (!key) return { records: [] };
      const obs = ds.series[key].observations || {};
      const dims = (r.data.structure && r.data.structure.dimensions && r.data.structure.dimensions.observation && r.data.structure.dimensions.observation[0] && r.data.structure.dimensions.observation[0].values) || [];
      const pts = Object.keys(obs)
        .map((k) => [dims[Number(k)] ? dims[Number(k)].id : k, obs[k][0]])
        .filter((p) => p[1] !== null)
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
      if (!pts.length) return { records: [] };
      const last = pts[pts.length - 1];
      const first = pts[0];
      const chg = first[1] ? ((last[1] - first[1]) / first[1]) * 100 : null;
      return {
        records: [
          rec('ecb', 'fx-rate', {
            title: `EUR/${ccy} euro foreign exchange reference rate`,
            subtitle: `Latest ${last[0]}`,
            recordId: `EXR.D.${ccy}.EUR.SP00.A`,
            url: `https://data.ecb.europa.eu/data/datasets/EXR/EXR.D.${ccy}.EUR.SP00.A`,
            endpoint: 'data/EXR',
            category: 'public-market-indicator',
            badges: [{ text: 'Reference rate (not a tradable price)', tone: 'fin' }],
            fields: [
              ['Latest (units of ' + ccy + ' per EUR)', fmt.num(last[1], 4)],
              ['Observation date', last[0]],
              ['Observations shown', `${pts.length} business days (${first[0]} → ${last[0]})`],
              ['Change over window (%, derived by JAQA)', chg !== null ? fmt.num(chg, 2) : null],
              ['Formula', '(latest − first) ÷ first × 100 over the displayed window'],
              ['Frequency / latency', 'Daily reference rate, published ~16:00 CET on TARGET business days']
            ],
            data: { series: pts, ccy }
          })
        ]
      };
    }
  };

  /* ------------------------------- GDELT ------------------------------- */
  C.gdelt = {
    async articles(q) {
      const r = await call('gdelt', `https://api.gdeltproject.org/api/v2/doc/doc?query=${enc('"' + q.replace(/"/g, '') + '"')}&mode=artlist&format=json&maxrecords=15&sort=datedesc&timespan=3months`, { validate: (j) => obj(j) });
      if (r.error) return r;
      const arts = isArr(r.data.articles) ? r.data.articles : [];
      return {
        records: arts.map((a) =>
          rec('gdelt', 'news-signal', {
            title: a.title || a.url,
            subtitle: `${a.domain || ''} · ${a.sourcecountry || ''} · ${a.language || ''}`,
            recordId: a.url,
            url: a.url,
            endpoint: 'doc/doc artlist',
            category: 'public-event',
            confidence: 'Possible',
            badges: [{ text: 'Media signal (noisy, unverified)', tone: 'neutral' }, ...(a.language && a.language !== 'English' ? [{ text: 'Translation risk', tone: 'warn' }] : [])],
            fields: [
              ['Seen (UTC, as reported)', a.seendate ? String(a.seendate).replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2}).*/, '$1-$2-$3 $4:$5') : null],
              ['Outlet domain', a.domain],
              ['Language', a.language],
              ['Source country', a.sourcecountry]
            ],
            flags: { translationRisk: a.language && a.language !== 'English' }
          })
        )
      };
    }
  };

  /* ------------------------------ EPA ECHO ------------------------------ */
  /* ---------------- JAQA Global Monitor (same-origin JAQA server) ---------------- */
  C.monitor = {
    /** Latest headlines of one verified official feed. Fixed feed id; no search terms are sent. */
    async feed(feed, opts) {
      const endpoint = '/api/jaqa/monitor/feed?id=' + enc(feed.id);
      const r = await call('jaqaMonitor', endpoint, Object.assign({ validate: (j) => !!j && j.ok === true && isArr(j.items) }, opts || {}));
      // Only verified feed ids are requested, so a 404 means there is no JAQA
      // server here (static-only hosting): switch the source to link-out.
      if (r.error === 'not_found') {
        R.runtime.markUnavailable('jaqaMonitor', 'The JAQA server is not available on this deployment (static hosting).');
        return { error: 'linkout' };
      }
      if (r.error) return r;
      return {
        records: r.data.items.map((it) =>
          rec('jaqaMonitor', 'monitor', {
            title: it.title,
            subtitle: feed.publisher + (it.published ? ' · ' + it.published.slice(0, 16).replace('T', ' ') + ' UTC' : ''),
            fields: [['Publisher', feed.publisher], ['Feed', feed.name], ['Published', it.published ? it.published.replace('T', ' ').slice(0, 19) + ' UTC' : 'not stated'], ['Coordinates', isFinite(it.lat) ? it.lat.toFixed(2) + ', ' + it.lon.toFixed(2) + ' (publisher-supplied)' : undefined]],
            links: [{ label: 'Read at ' + feed.publisher, href: it.link }],
            data: { feedId: feed.id, category: feed.category, publisher: feed.publisher, published: it.published || null, lat: isFinite(it.lat) ? it.lat : undefined, lon: isFinite(it.lon) ? it.lon : undefined },
            url: it.link, recordId: it.link, endpoint, category: 'official-feed-headline', confidence: 'Source-reported'
          })
        ),
        meta: { fetchedAt: r.data.fetchedAt }
      };
    }
  };

  C.epa = {
    async facilities(name) {
      const r = await call('epa', `https://echodata.epa.gov/echo/echo_rest_services.get_facility_info?output=JSON&p_fn=${enc(name)}`, { validate: (j) => obj(j) && obj(j.Results) });
      if (r.error) return r;
      const rows = isArr(r.data.Results.Facilities) ? r.data.Results.Facilities : [];
      const g = (x, ...keys) => {
        for (const k of keys) if (x[k] !== undefined && x[k] !== null && x[k] !== '') return x[k];
        return null;
      };
      return {
        records: rows.slice(0, 25).map((x) =>
          rec('epa', 'facility', {
            title: x.FacName || 'Facility',
            subtitle: [x.FacCity, x.FacState].filter(Boolean).join(', '),
            recordId: x.RegistryID,
            url: x.RegistryID ? 'https://echo.epa.gov/detailed-facility-report?fid=' + x.RegistryID : 'https://echo.epa.gov/',
            endpoint: 'get_facility_info',
            category: 'public-record',
            confidence: 'Possible',
            badges: [{ text: 'EPA-regulated facility (name match)', tone: 'esg' }],
            fields: [
              ['Registry ID', x.RegistryID],
              ['Address', [x.FacStreet, x.FacCity, x.FacState, x.FacZip].filter(Boolean).join(', ') || null],
              ['County', x.FacCounty],
              ['Compliance status (as reported)', g(x, 'FacComplianceStatus', 'FacCurrCompStatus')],
              ['Quarters with violation (as reported)', g(x, 'FacQtrsWithNC')],
              ['Significant noncompliance flag', g(x, 'FacSNCFlg')],
              ['Inspections (5 yr, as reported)', g(x, 'FacInspectionCount')],
              ['Formal actions (5 yr, as reported)', g(x, 'FacFormalActionCount')],
              ['Penalties (as reported)', g(x, 'FacTotalPenalties')],
              ['Last inspection', g(x, 'FacDateLastInspection', 'FacLastInspectionDate')],
              ['Match basis', 'Facility-name text match — not a legal-entity match']
            ]
          })
        ),
        meta: { total: Number(r.data.Results.QueryRows) || rows.length }
      };
    }
  };

  /** Coverage Console availability check (user-triggered, fixed probe URL, no user data). */
  R.probeSource = async function probeSource(id) {
    const s = R.sources.get(id);
    if (!s || !s.probe) return { ok: false, errorKind: 'unknown_source' };
    const res = await R.net.request(id, s.probe, { probe: true });
    if (res.ok) R.runtime.markLive(id);
    else if (res.errorKind === 'cors_or_network') R.runtime.markUnavailable(id, 'Availability check failed from this browser (CORS, network, or site security policy).');
    return res;
  };
})(window.JAQAWorkspace);
