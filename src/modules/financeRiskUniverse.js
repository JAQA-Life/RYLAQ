/*
 * financeRiskUniverse.js — MODULE 3: Finance Risk Universe,
 * MODULE 9: Market, Macro & Sovereign Risk, MODULE 10: FX, Interest Rate &
 * Commodity Context.
 *
 * No credit score, sovereign rating, default prediction, investment advice,
 * hedging advice or exposure calculation is produced. Indicators are shown
 * with source, period, frequency and latency warnings.
 */
(function (R) {
  'use strict';
  const { h, extLink } = R.util;
  const ui = R.ui;

  const state = {};
  const macro = { iso3: null, more: false };
  const fx = { ccy: null };
  R.events.on('session:cleared', () => {
    Object.keys(state).forEach((k) => delete state[k]);
    macro.iso3 = null;
    macro.more = false;
    fx.ccy = null;
  });
  R.events.on('session:started', () => {
    delete state.selected;
    macro.iso3 = null;
    fx.ccy = null;
  });

  R.modules.register({
    id: 'financeRisk',
    group: 'finance',
    order: 20,
    icon: 'coin',
    title: 'Finance Risk Universe',
    short: 'Finance Risk Universe',
    description: `${R.taxonomy.finance.length} finance-risk domains mapped to public filings, macro indicators, registries, regulators and official link-outs.`,
    warnings: ['Finance Risk Universe is a public-source map, not a financial risk measurement system. No credit score, rating, solvency opinion, investment or treasury advice is produced.'],
    render: (ctx) => R.taxonomyView({ list: R.taxonomy.finance, state, kind: 'finance', notAdvice: 'Not credit, investment, treasury, insurance, legal, tax, AML or sanctions advice. Public records may be delayed, restated or incomplete.', jsonName: 'JAQA-Finance-Risk-results.json', csvName: 'JAQA-Finance-Risk-results.csv' }, ctx)
  });

  /* ---------------------- country resolution helper ---------------------- */
  function countryFromCtx(ctx) {
    const r = ctx.resolved || {};
    if (r.iso3) return r.iso3;
    const iso2 = r.iso2 || (ctx.primary && ctx.primary.ids && ctx.primary.ids.country);
    const c = iso2 ? R.geo.byIso2(iso2) : null;
    return c ? c.iso3 : null;
  }
  R.countryFromCtx = countryFromCtx;

  function countryPicker(current, onPick) {
    return ui.select('Country / sovereign', [['', 'Select a country…'], ...R.geo.countries.map((c) => [c.iso3, `${c.name} (${c.iso3})`])], current || '', onPick, { key: 'country-picker' });
  }
  R.countryPicker = countryPicker;

  function indicatorGrid(iso3, keys, auto) {
    return h('div', { class: 'rq-indicator-grid' }, ...keys.map((k) => ui.taskPanel(R.T.wbInd(iso3, k), { auto, compact: true, emptyText: 'Not reported by source for recent years.' })));
  }

  /* ---------------------- Market, Macro & Sovereign ---------------------- */
  R.modules.register({
    id: 'marketMacro',
    group: 'finance',
    order: 25,
    icon: 'chart',
    title: 'Market, Macro & Sovereign Risk',
    short: 'Market, Macro & Sovereign',
    description: 'Public macro-financial and sovereign context: growth, inflation, debt, external position, banking and governance indicators.',
    warnings: ['Market data may be delayed. Reference rates are not tradable prices. JAQA does not provide investment or hedging advice and produces no sovereign rating or default prediction.'],
    render(ctx) {
      if (!ctx.session) return h('div', null, ui.needSession('macro and sovereign indicators'), ui.dir('macro', null, { title: 'Official macro & central bank sources' }));
      const iso3 = macro.iso3 || countryFromCtx(ctx);
      const c = iso3 ? R.geo.countries.find((x) => x.iso3 === iso3) : null;
      const picker = countryPicker(iso3, (v) => {
        macro.iso3 = v || null;
        R.shell.refresh();
      });
      if (ctx.type === 'digitalAsset')
        return h('div', null, ui.warning('Digital-asset markets are highly volatile and differently regulated across jurisdictions. Link-out only; no investment advice, no price data, no wallet or address screening.', 'amber', 'Digital asset context.'), ui.dir('digitalAssets', null, { title: 'Official digital-asset resources' }), ui.dir('sanctions', null, { title: 'Sanctions resources (address listings appear in official lists only)', compact: true }));
      if (!c) return h('div', null, h('div', { class: 'rq-filters' }, picker), ui.warning('Select a country, or search a country/entity with a known jurisdiction, to load sovereign context.', 'info'), ui.dir('macro', null, { title: 'Official macro & central bank sources' }));
      return h(
        'div',
        null,
        h('div', { class: 'rq-filters' }, picker, h('div', { class: 'rq-field' }, h('span', null, 'Official link-outs'), h('div', { class: 'rq-row' }, extLink('https://www.imf.org/en/Countries/' + c.iso3, 'IMF country page'), extLink('https://data.worldbank.org/country/' + c.iso2, 'World Bank country data')))),
        ui.section('Growth, prices & fiscal position — ' + c.name, { icon: 'chart', desc: 'World Bank WDI, annual. Loaded on module open (4 requests).' }, indicatorGrid(c.iso3, ['gdpGrowth', 'inflation', 'govDebt', 'currentAccount'], true)),
        macro.more
          ? h(
              'div',
              null,
              ui.section('External position, rates & banking', { icon: 'coin' }, indicatorGrid(c.iso3, ['reserves', 'extDebt', 'lending', 'realRate', 'npl', 'bankCapital', 'privCredit'], true)),
              ui.section('Governance (Worldwide Governance Indicators)', { icon: 'gavel', desc: 'Estimates range approximately −2.5 to +2.5 and carry margins of error. Not a rating.' }, indicatorGrid(c.iso3, ['wgiPV', 'wgiGE', 'wgiRQ', 'wgiRL', 'wgiCC', 'wgiVA'], true))
            )
          : ui.button('Load external, banking & governance indicators (13 more requests)', () => {
              macro.more = true;
              R.shell.refresh();
            }, { icon: 'download' }),
        ui.section('Sovereign, subnational & market link-outs', { icon: 'link' }, ui.dir('macro', null, { compact: true }), h('p', { class: 'rq-muted' }, 'Sovereign credit ratings, CDS spreads and equity index data are licensed; JAQA links to providers and never reproduces them.'), ui.dir('ratingAgencies', null, { compact: true })),
        ui.exportBar('JAQA-Market-Macro-indicators.json', 'JAQA-Market-Macro-indicators.csv', 'finance')
      );
    }
  });

  /* ------------------------- FX, Rate & Commodity ------------------------- */
  R.modules.register({
    id: 'fx',
    group: 'finance',
    order: 26,
    icon: 'coin',
    title: 'FX, Interest Rate & Commodity Context',
    short: 'FX, Rates & Commodities',
    description: 'Reference rates, rate indicators, commodity benchmarks and currency-control/sanctions context for treasury, procurement and category teams.',
    warnings: [
      'Actual exposure requires internal contracts, debt schedules, payables/receivables and hedge data. JAQA does not calculate exposure from public data alone and never accepts internal positions.',
      'No hedging advice. No treasury execution advice. No trade execution.'
    ],
    render(ctx) {
      const iso3 = countryFromCtx(ctx);
      const c = iso3 ? R.geo.countries.find((x) => x.iso3 === iso3) : null;
      const defCcy = fx.ccy || (c && R.geo.currencyFor(c.iso2) !== 'EUR' ? R.geo.currencyFor(c.iso2) : null) || 'USD';
      const picker = ui.select('Currency vs EUR (ECB reference rates)', R.geo.ECB_CCY.map((x) => [x, x]), defCcy, (v) => {
        fx.ccy = v;
        R.shell.refresh();
      }, { key: 'fx-ccy' });
      return h(
        'div',
        null,
        h('div', { class: 'rq-filters' }, picker),
        ctx.session
          ? ui.section('Euro foreign exchange reference rate', { icon: 'coin', desc: 'ECB Data Portal, last 30 observations. Loaded on module open (1 request).' }, ui.taskPanel(R.T.ecb(defCcy), { auto: true }))
          : ui.needSession('FX reference rates'),
        c && ctx.session ? ui.section('Country rate & FX indicators — ' + c.name, { icon: 'chart', desc: 'User-triggered (World Bank, annual).' }, indicatorGrid(c.iso3, ['fx', 'lending', 'realRate'], false)) : null,
        ui.section('Commodity benchmarks & currency controls (link-outs)', { icon: 'link' }, ui.linkouts(R.directories.macro.filter((e) => /commodity|AREAER|Treasury|FRED|ECB/i.test(e.name)), null, { compact: true })),
        ui.section('Sanctions & payment restrictions (link-outs)', { icon: 'shield' }, ui.linkouts(R.directories.sanctions.slice(0, 6), null, { compact: true }), ui.warning(R.legal.noHitNotClear, 'amber')),
        ui.section('Trade & category exposure', { icon: 'ship' }, h('p', null, 'Public trade data is aggregated and lagging; it cannot reveal your organization’s exposure.'), ui.button('Open Trade, Customs & Category Exposure', () => R.shell.go('trade', { focus: true }), { cls: 'rq-btn-sm' })),
        ui.exportBar('JAQA-Market-Macro-indicators.json', 'JAQA-Market-Macro-indicators.csv', 'finance')
      );
    }
  });
})(window.JAQAWorkspace);
