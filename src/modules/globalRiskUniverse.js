/*
 * globalRiskUniverse.js — MODULE 2: Global Risk Universe, and the shared
 * taxonomy view reused by the Finance Risk Universe.
 *
 * The coverage matrix is computed at runtime from the Source Capability
 * Registry: a domain shows "Evidence available now" only if at least one of
 * its mapped sources is live in this browser session. Nothing here measures
 * risk; it maps where public evidence exists and where it does not.
 */
(function (R) {
  'use strict';
  const { h, extLink } = R.util;
  const ui = R.ui;

  const DIR_LABEL = {
    entity: 'Entity registries', sanctions: 'Sanctions, debarment & export control', enforcement: 'Enforcement', insolvency: 'Insolvency registries', lien: 'Lien & judgment registries',
    insuranceRegulators: 'Insurance regulators', ratingAgencies: 'Rating agencies', marketReports: 'Market reports', procurement: 'Procurement portals', devBanks: 'Development banks', ppp: 'PPP resources',
    macro: 'Macro & central banks', trade: 'Trade & customs', cyber: 'Cyber & data', climate: 'Climate & catastrophe', esg: 'ESG & human rights', regulatory: 'Regulatory', standards: 'Standards', digitalAssets: 'Digital assets', logistics: 'Logistics'
  };
  R.DIR_LABEL = DIR_LABEL;

  function liveSources(d) {
    return (d.src || []).filter((id) => R.runtime.isLive(id));
  }

  /**
   * Shared taxonomy view.
   * cfg: { list, state, kind: 'global'|'finance', notAdvice, matchKey, jsonName, csvName, domain }
   */
  R.taxonomyView = function (cfg, ctx) {
    const st = cfg.state;
    const matched = ctx.session && ctx.chosen && ctx.chosen.domains ? ctx.chosen.domains : [];
    if (!st.selected && matched.length) st.selected = matched[0];
    const groups = cfg.kind === 'global' ? Object.entries(R.taxonomy.groups).map(([k, g]) => [k, g.label]) : [];
    const regions = [...new Set(cfg.list.flatMap((d) => d.regions || []))];
    const sectors = [...new Set(cfg.list.flatMap((d) => d.sectors || []))];

    const filtered = cfg.list.filter((d) => {
      if (st.group && d.group !== st.group) return false;
      if (st.region && !(d.regions || []).includes(st.region)) return false;
      if (st.sector && !(d.sectors || []).includes(st.sector)) return false;
      const live = liveSources(d).length;
      if (st.mode === 'live' && !live) return false;
      if (st.mode === 'linkout' && live) return false;
      if (st.text) {
        const t = st.text.toLowerCase();
        if (![d.name, d.def, ...(d.sub || []), ...(d.aliases || [])].join(' ').toLowerCase().includes(t)) return false;
      }
      return true;
    });

    const rerender = () => R.shell.refresh();
    const filters = h(
      'div',
      { class: 'rq-filters' },
      groups.length ? ui.select('Risk group', [['', 'All groups'], ...groups], st.group || '', (v) => ((st.group = v), rerender())) : null,
      ui.select('Region', [['', 'All regions'], ...regions.map((r) => [r, r])], st.region || '', (v) => ((st.region = v), rerender())),
      ui.select('Sector', [['', 'All sectors'], ...sectors.map((r) => [r, r])], st.sector || '', (v) => ((st.sector = v), rerender())),
      ui.select('Source mode', [['', 'All'], ['live', 'Evidence available now (live)'], ['linkout', 'Link-out only']], st.mode || '', (v) => ((st.mode = v), rerender())),
      ui.input('Filter text', st.text || '', (v) => {
        st.text = v;
        clearTimeout(st.t);
        st.t = setTimeout(rerender, 350);
      }, { placeholder: 'e.g. flood, sanctions, liquidity' })
    );

    const withLive = filtered.filter((d) => liveSources(d).length).length;
    const summary = ui.bars(
      [
        ['Domains shown', filtered.length, 'org'],
        ['At least one live source mapped', withLive, 'ok'],
        ['Link-out only', filtered.length - withLive, 'neutral']
      ],
      { label: 'Coverage summary' }
    );

    const table = h(
      'div',
      { class: 'rq-table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Coverage matrix' },
      h(
        'table',
        { class: 'rq-table rq-matrix' },
        h('caption', { class: 'rq-sr' }, 'Coverage matrix: public-source availability by domain'),
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Domain'), cfg.kind === 'global' ? h('th', { scope: 'col' }, 'Group') : null, h('th', { scope: 'col' }, 'Evidence now'), h('th', { scope: 'col' }, 'Live sources'), h('th', { scope: 'col' }, 'Link-out directories'), h('th', { scope: 'col' }, 'Main data gap'))),
        h(
          'tbody',
          null,
          ...filtered.map((d) => {
            const live = liveSources(d);
            const isMatch = matched.includes(d.id);
            return h(
              'tr',
              { class: (isMatch ? 'is-match ' : '') + (st.selected === d.id ? 'is-selected' : '') },
              h('th', { scope: 'row' }, h('button', { type: 'button', class: 'rq-link-btn', 'aria-pressed': st.selected === d.id ? 'true' : 'false', onclick: () => {
                st.selected = d.id;
                rerender();
                setTimeout(() => {
                  const el = document.getElementById('rq-tax-detail');
                  if (el) el.focus();
                }, 30);
              } }, d.name), isMatch ? ui.badge('Matches query', 'org') : null),
              cfg.kind === 'global' ? h('td', null, d.groupLabel) : null,
              h('td', null, live.length ? ui.badge('Live evidence', 'ok') : ui.badge('Link-out only', 'neutral')),
              h('td', null, live.length ? live.map((id) => R.sources.get(id).displayName.replace(/ \(.*\)$/, '')).join(', ') : '—'),
              h('td', null, (d.dirs || []).map((k) => DIR_LABEL[k] || k).join(', ')),
              h('td', { class: R.state.prefs.highlightGaps ? 'rq-gap-cell' : '' }, d.gaps)
            );
          })
        )
      )
    );

    const sel = cfg.list.find((d) => d.id === st.selected);
    return h(
      'div',
      null,
      ui.warning(cfg.notAdvice, 'info'),
      filters,
      h('div', { class: 'rq-two-col' }, ui.section('Coverage summary', { icon: 'chart' }, summary), ui.section('Export', { icon: 'download' }, h('div', { class: 'rq-row' }, ui.button('Coverage matrix JSON', () => exportMatrix(cfg, filtered, 'json'), { icon: 'download', cls: 'rq-btn-sm' }), ui.button('Coverage matrix CSV', () => exportMatrix(cfg, filtered, 'csv'), { icon: 'download', cls: 'rq-btn-sm' })), h('p', { class: 'rq-fineprint' }, 'Exports include coverage-gap warnings and RYLAQ™ legal metadata.'))),
      sel ? domainDetail(sel, cfg, ctx) : null,
      ui.section('Coverage matrix', { icon: 'grid', desc: `${filtered.length} of ${cfg.list.length} domains. Select a domain for definitions, mappings, live lookups and official links.` }, table)
    );
  };

  function domainDetail(d, cfg, ctx) {
    const live = liveSources(d);
    const term = d.name.replace(/\s*risk$/i, '').replace(/\s*\(.*\)$/, '').split(' / ')[0];
    const lines = cfg.kind === 'global' ? R.taxonomy.insuranceLines.filter((l) => l.risks.includes(d.id)) : [];
    return h(
      'section',
      { class: 'rq-tax-detail', id: 'rq-tax-detail', tabindex: '-1', 'aria-label': d.name + ' details' },
      h('div', { class: 'rq-row rq-row-between' }, h('h3', { class: 'rq-h3' }, d.name), h('div', { class: 'rq-row' }, live.length ? ui.badge('Evidence available now', 'ok') : ui.badge('Link-out only', 'neutral'), cfg.kind === 'global' ? ui.badge(d.groupLabel, 'risk') : ui.badge('Finance risk domain', 'fin'))),
      h('p', { class: 'rq-lead' }, d.def),
      ui.kv([
        ['Why it matters (risk, procurement, insurance, finance)', d.why || d.rel],
        ['Sub-risks', (d.sub || []).join('; ') || null],
        ['Typical evidence types', (d.ev || []).join('; ') || null],
        ['Common data gaps', d.gaps],
        ['Regions covered', (d.regions || []).join('; ')],
        ['Sectors', (d.sectors || []).join('; ')],
        ['Languages', 'English source metadata; official link-outs may be multilingual (translation risk)'],
        ['Related regulators', (d.reg || []).join('; ') || null],
        ['Related standards / frameworks', (d.std || []).join('; ') || null]
      ]),
      h(
        'div',
        { class: 'rq-two-col' },
        ui.section('Risk-to-Insurance mapping', { icon: 'umbrella', desc: 'Possible related lines to discuss with qualified brokers/insurers. Not a coverage determination.' }, h('div', { class: 'rq-row' }, ...[...new Set([...(d.ins || []), ...lines.map((l) => l.name)])].map((x) => ui.badge(x, 'ins'))), (d.ins || []).length || lines.length ? null : h('p', { class: 'rq-muted' }, 'No specific line mapped.'), ui.button('Open Insurance & Reinsurance', () => R.shell.go('insurance', { focus: true }), { cls: 'rq-btn-sm' })),
        ui.section('Risk-to-Procurement mapping', { icon: 'doc', desc: 'Relevant public procurement categories. Not bid/no-bid advice.' }, h('div', { class: 'rq-row' }, ...((d.proc && d.proc.length ? d.proc : ['General goods & services'])).map((x) => ui.badge(x, 'proc'))), ui.button('Open Procurement & Bid Radar', () => R.shell.go('procurement', { focus: true }), { cls: 'rq-btn-sm' }))
      ),
      ctx.session
        ? ui.section('Live lookup: recent US regulatory documents mentioning this domain', { icon: 'search', desc: 'User-triggered. Sends the domain term (not your original query) to the Federal Register.' }, ui.taskPanel(R.T.frSearch(term, { perPage: 5, order: 'newest' }), { limit: 5 }))
        : h('p', { class: 'rq-muted' }, 'Run a search to enable live lookups for this domain.'),
      ui.section('Official link-outs', { icon: 'link' }, ...(d.dirs || []).map((k) => ui.dir(k, null, { title: DIR_LABEL[k] || k, compact: true }))),
      ui.warning('Not advice. ' + cfg.notAdvice, 'amber')
    );
  }

  function exportMatrix(cfg, list, fmtType) {
    const rows = list.map((d) => ({
      domain: d.name,
      group: d.groupLabel || 'Finance',
      definition: d.def,
      evidenceAvailableNow: liveSources(d).length > 0,
      liveSources: liveSources(d).map((id) => R.sources.get(id).displayName),
      linkoutDirectories: (d.dirs || []).map((k) => DIR_LABEL[k] || k),
      dataGaps: d.gaps,
      insuranceLines: d.ins || [],
      procurementCategories: d.proc || [],
      regulators: d.reg || [],
      standards: d.std || []
    }));
    if (fmtType === 'json') {
      const payload = Object.assign(R.legal.exportBlock(['RYLAQ Source Capability Registry']), { warnings: [cfg.notAdvice, R.exporters.DOMAIN_WARNINGS.globalRisk], coverageMatrix: rows });
      R.exporters.download(cfg.jsonName, JSON.stringify(payload, null, 2), 'application/json');
    } else {
      const head = ['Domain', 'Group', 'Evidence available now', 'Live sources', 'Link-out directories', 'Data gaps', 'Insurance lines', 'Procurement categories', 'Regulators', 'Standards'];
      const data = rows.map((r) => [r.domain, r.group, r.evidenceAvailableNow ? 'yes' : 'no', r.liveSources.join('; '), r.linkoutDirectories.join('; '), r.dataGaps, r.insuranceLines.join('; '), r.procurementCategories.join('; '), r.regulators.join('; '), r.standards.join('; ')]);
      data.push([], ['Warning', cfg.notAdvice], ['Legal', R.legal.copyright]);
      R.exporters.download(cfg.csvName, '﻿' + R.exporters.toCSV([head, ...data]), 'text/csv');
    }
  }

  const state = {};
  R.events.on('session:cleared', () => Object.keys(state).forEach((k) => delete state[k]));
  R.events.on('session:started', () => delete state.selected);

  R.modules.register({
    id: 'globalRisk',
    group: 'risk',
    order: 3,
    icon: 'globe',
    title: 'Global Risk Universe',
    short: 'Global Risk Universe',
    description: `${R.taxonomy.global.length} risk domains mapped to live public sources, official link-outs, regulators, standards, insurance lines and procurement categories.`,
    warnings: ['Global Risk Universe is a public-source map, not a risk measurement system. RYLAQ organizes public evidence about each risk; it does not measure it.'],
    render: (ctx) => R.taxonomyView({ list: R.taxonomy.global, state, kind: 'global', notAdvice: 'Coverage is incomplete by region, sector, language and source. No output here states that anything is safe, clear, covered, insured, approved or low/high risk.', jsonName: 'RYLAQ-Global-Risk-results.json', csvName: 'RYLAQ-Global-Risk-results.csv' }, ctx)
  });
})(window.RYLAQWorkspace);
