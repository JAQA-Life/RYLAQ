/*
 * scenarioLab.js — MODULE 25: Scenario Stress Lab (qualitative).
 *
 * The exposure band is a transparent count of public-signal checks, with the
 * rules printed next to the result:
 *   fewer than 2 checks loaded → Unknown
 *   0 checks with a source-reported signal → Low
 *   1 → Medium, 2 or more → High
 * No loss, premium, capital, claim, award-probability, financial-loss or
 * hedge-effectiveness figure is ever computed. No internal data is accepted.
 */
(function (R) {
  'use strict';
  const { h } = R.util;
  const ui = R.ui;
  const T = R.T;

  const st = { role: 'supplier', disruption: 'earthquake', duration: '7-30' };
  R.events.on('session:cleared', () => Object.assign(st, { role: 'supplier', disruption: 'earthquake', duration: '7-30' }));

  const DISRUPTIONS = {
    earthquake: 'Earthquake', storm: 'Storm / flood', heat: 'Extreme heat', cyber: 'Cyber (exploited vulnerability)', sanctions: 'Sanctions / export-control change',
    financial: 'Counterparty financial stress', recall: 'Product recall', political: 'Political instability / conflict', logistics: 'Logistics / port disruption', regulatory: 'Regulatory change'
  };
  const ACTIONS = {
    earthquake: ['Confirm facility addresses and seismic exposure with the counterparty', 'Request business continuity and alternate-site plans', 'Discuss property/BI programme questions with your broker (no coverage view here)'],
    storm: ['Verify official warnings with national meteorological services', 'Request site flood/wind resilience information', 'Review logistics contingency with carriers'],
    heat: ['Check worker-safety procedures and cooling resilience', 'Review energy supply contingencies'],
    cyber: ['Request confirmation of affected product/version and patch status from the vendor', 'Review SBOM/attestations and incident-response contacts', 'Check contract security obligations with counsel'],
    sanctions: ['Screen in your sanctions system of record', 'Refer matches to compliance for adjudication', 'Review export classification with trade-compliance specialists'],
    financial: ['Request recent financial statements from the counterparty', 'Consult licensed credit data and your credit team', 'Review payment terms, guarantees and step-in rights with counsel'],
    recall: ['Confirm affected SKUs/lots with the supplier', 'Coordinate with quality/regulatory teams', 'Discuss recall/product-liability questions with your broker'],
    political: ['Review country-risk policy and escalation thresholds', 'Assess alternative sourcing options', 'Discuss political-risk insurance questions with a qualified broker'],
    logistics: ['Confirm routing alternatives with logistics providers', 'Check port authority notices', 'Review inventory buffers'],
    regulatory: ['Have counsel/compliance confirm applicability and effective dates', 'Map affected contracts and specifications']
  };

  function checksFor(ctx) {
    const r = ctx.resolved || {};
    const name = ctx.primary ? (ctx.primary.data && ctx.primary.data.name) || ctx.primary.title : ctx.q;
    const iso3 = R.countryFromCtx(ctx);
    const pt = r.lat !== undefined && r.lat !== null;
    const list = [];
    const add = (label, def, test, rule) => list.push({ label, def, test, rule });
    const d = st.disruption;
    if (d === 'earthquake' && pt) add('M6+ earthquake within 300 km (30 days)', T.quakes(r.lat, r.lon, 500, 30), (recs) => recs.some((x) => x.data.mag >= 6 && x.data.dist !== null && x.data.dist <= 300), 'USGS magnitude ≥ 6.0 and distance ≤ 300 km');
    if ((d === 'storm' || d === 'heat' || d === 'logistics') && pt) add('Forecast threshold signal (7 days)', T.forecast(r.lat, r.lon, r.placeLabel), (recs) => recs.some((x) => (x.data.flags || []).some((f) => (d === 'heat' ? /temperature/ : /gust|precip/).test(f))), 'Open-Meteo thresholds shown on the forecast record');
    if ((d === 'storm' || d === 'heat') && pt && (r.iso2 === 'US' || r.iso2 === 'PR')) add('Severe/Extreme NWS alert', T.nws(r.lat, r.lon), (recs) => recs.some((x) => ['Severe', 'Extreme'].includes(x.data.severity)), 'NWS severity Severe or Extreme');
    if (d === 'cyber') add('Vendor/product text appears in CISA KEV', T.kevMentions(name.split(/\s+/)[0]), (recs) => recs.length > 0, 'At least one KEV entry matches the vendor/product text');
    if (d === 'cyber' && r.cik) add('SEC 8-K item 1.05 (cyber incident) filed', T.secSubs(r.cik), (recs) => ((recs[0] && recs[0].data.signals) || []).some((s) => s.item === '1.05'), '8-K item 1.05 present in recent filings');
    if (d === 'financial' && r.cik) add('SEC stress filing items (1.03, 2.04, 4.02) or NT filings', T.secSubs(r.cik), (recs) => ((recs[0] && recs[0].data.signals) || []).some((s) => ['1.03', '2.04', '4.02'].includes(s.item) || /^NT /.test(s.form)), 'Listed 8-K items or NT late-filing notice present');
    if (d === 'financial') add('Bankruptcy-chapter docket (name match)', T.courts(name, 'r'), (recs) => recs.some((x) => x.fields.some((f) => f[0] === 'Bankruptcy chapter' && f[1])), 'CourtListener docket with a bankruptcy chapter (Possible match)');
    if (d === 'recall') add('CPSC recall (title match)', T.cpscSearch(name), (recs) => recs.length > 0, 'At least one CPSC recall title matches');
    if ((d === 'political' || d === 'sanctions') && iso3) add('WGI Political Stability estimate below −1.0', T.wbInd(iso3, 'wgiPV'), (recs) => recs.some((x) => x.data.value < -1), 'World Bank WGI PV.EST < −1.0 (latest year)');
    if (d === 'logistics' && iso3) add('LPI overall score below 3.0', T.wbInd(iso3, 'lpi'), (recs) => recs.some((x) => x.data.value < 3), 'World Bank LPI < 3.0 (latest edition)');
    if (d === 'sanctions' || d === 'regulatory') {
      const since = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
      add('US regulatory activity in last 180 days', T.frSearch(d === 'sanctions' ? 'sanctions ' + (iso3 ? (R.geo.countries.find((c) => c.iso3 === iso3) || {}).name : '') : ctx.q, { perPage: 10, order: 'newest', from: since }), (recs) => recs.length > 0, 'At least one Federal Register document in the window');
    }
    return list;
  }

  R.modules.register({
    id: 'scenario',
    group: 'evidence',
    order: 51,
    icon: 'flask',
    title: 'Scenario Stress Lab',
    short: 'Scenario Stress Lab',
    description: 'Qualitative, public-signal scenario exploration with a transparent exposure band, missing-data list and review actions.',
    warnings: [
      'Scenario output is qualitative and based on public-source signals only.',
      'It does not calculate insured loss, premium, capital impact, claim liability, bid win probability, contract award outcome, financial loss, or hedge effectiveness. No internal data upload.'
    ],
    liveRefresh: true,
    render(ctx) {
      if (!ctx.session) return ui.needSession('a scenario');
      const inputs = h(
        'div',
        { class: 'rq-filters' },
        ui.select('Subject role', [['supplier', 'Supplier'], ['buyer', 'Buyer'], ['insurer', 'Insurer'], ['reinsurer', 'Reinsurer'], ['broker', 'Broker'], ['captive', 'Captive'], ['ils', 'ILS / cat bond entity'], ['country', 'Country'], ['port', 'Port'], ['category', 'Category / HS code'], ['project', 'Project / PPP']], st.role, (v) => ((st.role = v), R.shell.refresh()), { key: 'sc-role' }),
        ui.select('Disruption type', Object.entries(DISRUPTIONS), st.disruption, (v) => ((st.disruption = v), R.shell.refresh()), { key: 'sc-dis' }),
        ui.select('Duration', [['lt7', 'Under 7 days'], ['7-30', '7–30 days'], ['30-90', '30–90 days'], ['gt90', 'Over 90 days']], st.duration, (v) => ((st.duration = v), R.shell.refresh()), { key: 'sc-dur' })
      );
      const checks = checksFor(ctx);
      let loaded = 0;
      let signals = 0;
      const rows = checks.map((c) => {
        const t = R.tasks.ensure(c.def);
        const done = t && (t.status === 'done' || t.status === 'empty');
        let res = 'Not loaded';
        if (done) {
          loaded++;
          const hit = c.test(t.records || []);
          if (hit) signals++;
          res = hit ? 'Signal (source-reported)' : 'No signal in loaded data';
        } else if (t && t.status === 'error') res = 'Unavailable: ' + R.net.errorText(t.errorKind);
        else if (t && t.status === 'linkout') res = 'Link-out only';
        return { c, t, res };
      });
      const band = loaded < 2 ? 'Unknown' : signals === 0 ? 'Low' : signals === 1 ? 'Medium' : 'High';
      const tone = { Unknown: 'neutral', Low: 'ok', Medium: 'warn', High: 'serious' }[band];
      const subject = ctx.primary ? ctx.primary.title : ctx.resolved.countryName || ctx.resolved.placeLabel || ctx.q;
      return h(
        'div',
        null,
        inputs,
        h('div', { class: 'rq-band' }, h('div', null, h('div', { class: 'rq-stat-label' }, 'Qualitative exposure band'), h('div', { class: 'rq-band-value rq-tone-' + tone }, band)), h('div', null, h('p', null, `${DISRUPTIONS[st.disruption]} · ${st.role} · ${subject}`), h('p', { class: 'rq-muted' }, `${signals} signal(s) across ${loaded} loaded check(s) of ${checks.length}. Rule: fewer than 2 checks loaded → Unknown; 0 signals → Low; 1 → Medium; 2+ → High. Duration does not change the band; it informs review priority.`))),
        !(ctx.resolved.lat !== undefined && ctx.resolved.lat !== null) && R.countryFromCtx(ctx)
          ? ui.warning('No geographic reference point. You can use the capital of the resolved jurisdiction (' + R.countryFromCtx(ctx) + ') as an approximate reference point — facility locations may differ.', 'info')
          : null,
        !(ctx.resolved.lat !== undefined && ctx.resolved.lat !== null) && R.countryFromCtx(ctx)
          ? ui.button('Use jurisdiction capital as reference point', () => {
              const d = T.wbCountry(R.countryFromCtx(ctx));
              R.tasks.ensure(d);
              R.tasks.start(d.key);
            }, { icon: 'globe', cls: 'rq-btn-sm' })
          : null,
        ui.section('Public evidence checks', { icon: 'list' }, checks.length ? h('div', { class: 'rq-table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Evidence checks' }, h('table', { class: 'rq-table' }, h('thead', null, h('tr', null, ...['Check', 'Rule', 'Result', 'Action'].map((c) => h('th', { scope: 'col' }, c)))), h('tbody', null, ...rows.map(({ c, t, res }) => h('tr', null, h('th', { scope: 'row' }, c.label), h('td', null, c.rule), h('td', null, res), h('td', null, t && (t.status === 'idle' || (t.status === 'error' && t.errorKind !== 'cors_or_network')) && R.runtime.isLive(c.def.sourceId) ? ui.button('Load', () => {
          t.status = 'idle';
          R.tasks.start(c.def.key);
        }, { cls: 'rq-btn-xs', icon: 'download' }) : t && t.status === 'loading' ? 'Loading…' : '—')))))) : ui.warning('No public checks apply to this combination yet. Resolve a place/country or an entity to enable checks.', 'info')),
        ui.section('Missing data', { icon: 'info' }, h('ul', { class: 'rq-gap-list' }, ...rows.filter((x) => x.res === 'Not loaded' || /Unavailable|Link-out/.test(x.res)).map((x) => h('li', null, x.c.label + ' — ' + x.res)), h('li', null, 'Internal data (contracts, sites, inventory, policies, exposures) is never accepted here.'), !ctx.resolved.lat ? h('li', null, 'No geographic reference point (search a port/place/country or set one in Climate & Catastrophe).') : null)),
        ui.section('Recommended review actions', { icon: 'check', desc: 'Generic human-review steps. Not advice.' }, h('ul', null, ...(ACTIONS[st.disruption] || []).map((a) => h('li', null, a)))),
        ui.warning('No fake precision, no automatic supplier ranking, no guaranteed disruption prediction, no insurance coverage determination, no credit score, no investment advice.', 'amber')
      );
    }
  });
})(window.RYLAQWorkspace);
