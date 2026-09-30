/*
 * overview.js — MODULE 1: Overview / Risk Triage, plus the shared signal and
 * data-gap collectors used by other modules.
 *
 * Signals are source-reported facts only (e.g. "in CISA KEV", "8-K item
 * 1.03 filed", "NWS Severe alert"). Nothing is scored, ranked or cleared.
 */
(function (R) {
  'use strict';
  const { h, icon, fmt, extLink } = R.util;
  const ui = R.ui;

  /* --------------------------- signal collector --------------------------- */
  R.signals = {
    collect() {
      const out = [];
      for (const t of R.tasks.all()) {
        for (const r of t.records || []) {
          r.badges.filter((b) => b.tone === 'serious' || (b.tone === 'warn' && !/Translation|Comment period/.test(b.text))).forEach((b) => out.push({ text: `${b.text} — ${r.title}`, tone: b.tone, record: r }));
          if (r.data && r.data.signals) r.data.signals.slice(0, 8).forEach((sg) => out.push({ text: `${sg.text} (${sg.date})`, tone: 'warn', record: r, url: sg.url }));
          if (r.data && r.data.flags && r.data.flags.length) out.push({ text: `Forecast threshold signal(s): ${r.data.flags.slice(0, 3).join('; ')}`, tone: 'warn', record: r });
        }
      }
      const seen = new Set();
      return out.filter((s) => (seen.has(s.text) ? false : seen.add(s.text)));
    },
    gaps() {
      const s = R.state.session;
      const gaps = [];
      if (!s) return gaps;
      const type = s.chosen.type;
      const org = R.pipeline.ORG_TYPES.includes(type) || ['lei', 'ticker', 'cik'].includes(type);
      const gl = R.tasks.all().find((t) => t.key.startsWith('gleif:search:'));
      if (org && gl && gl.status === 'empty') gaps.push('No LEI record found. Missing LEI does not mean an invalid entity; many private companies and SMEs have no LEI.');
      if (org && gl && gl.status === 'done' && !s.primary) gaps.push('Entity not yet resolved: several candidates match. Select the correct legal entity before relying on downstream evidence.');
      if (org && !s.resolved.cik) gaps.push('No SEC registrant identified. Private companies and most non-US entities have limited public financial data.');
      if (org) gaps.push('Sanctions/debarment status is not checked live. Use official lists and your screening system of record (no hit ≠ clear).');
      if (['insurer', 'reinsurer', 'broker', 'mga', 'captive', 'ils', 'tpa', 'syndicate'].includes(type)) gaps.push('Insurer financial strength ratings, solvency ratios and market reports are paid or regulator-held; link-out only.');
      if (['procurement', 'tender'].includes(type)) gaps.push('TED and most national portals are link-out only (no CORS-enabled public API). Deadlines/eligibility must be verified officially.');
      if (['country', 'port', 'place'].includes(type)) gaps.push('ReliefWeb humanitarian reports are link-out only until an approved API appname is verified.');
      if (type === 'port' && !s.resolved.lat) gaps.push('Location not yet resolved; event proximity checks need verified coordinates.');
      if (['hs', 'category'].includes(type)) gaps.push('UN Comtrade trade flows require a key and are link-out only. No shipment-level data is available.');
      if (type === 'cve') gaps.push('A CVE record does not show which suppliers run the affected product/version. Asset inventories and SBOMs are needed.');
      for (const t of R.tasks.all()) if (t.status === 'error') gaps.push(`${t.label}: ${R.net.errorText(t.errorKind)}`);
      return [...new Set(gaps)];
    },
    /** Conflicts between sources on the same identifier (never auto-resolved). */
    conflicts() {
      const s = R.state.session;
      const out = [];
      if (!s || !s.primary) return out;
      const gleifLei = s.primary.prov.sourceId === 'gleif' ? s.primary.ids.lei : null;
      const wd = R.tasks.all().find((t) => t.key.startsWith('wd:ids:') && t.records.length);
      const sec = R.tasks.all().find((t) => t.key.startsWith('sec:subs:') && t.records.length);
      if (gleifLei && wd && wd.records[0].data.lei && wd.records[0].data.lei !== gleifLei)
        out.push(['LEI for the selected entity', [{ source: 'GLEIF (selected record)', value: gleifLei, url: s.primary.prov.url }, { source: 'Wikidata claim', value: wd.records[0].data.lei, url: wd.records[0].prov.url }]]);
      if (gleifLei && sec && sec.records[0].ids.lei && sec.records[0].ids.lei !== gleifLei)
        out.push(['LEI reported to SEC vs GLEIF', [{ source: 'GLEIF (selected record)', value: gleifLei, url: s.primary.prov.url }, { source: 'SEC EDGAR submissions', value: sec.records[0].ids.lei, url: sec.records[0].prov.url }]]);
      return out;
    }
  };

  /* ------------------------------ first run ------------------------------ */
  function firstRun() {
    const groups = R.modules.GROUPS.map((g) => h('div', { class: 'rq-mod-group' }, h('h4', { class: 'rq-h4' }, g.label), h('ul', null, ...R.modules.all().filter((m) => m.group === g.id).map((m) => h('li', null, h('button', { type: 'button', class: 'rq-link-btn', onclick: () => R.shell.go(m.id, { focus: true }) }, m.title))))));
    const live = R.sources.list.filter((s) => s.corsVerified);
    return h(
      'div',
      { class: 'rq-firstrun' },
      h(
        'div',
        { class: 'rq-hero' },
        h('h3', { class: 'rq-hero-title' }, 'Start with a company, insurer, reinsurer, broker, country, port, HS code, CVE, tender, award, grant, PPP, regulation, or risk concept'),
        h('p', null, 'JAQA assembles public evidence from ', h('strong', null, live.length + ' live public APIs'), ' verified for browser access, and routes everything else to official link-outs — with provenance, confidence and coverage gaps on every result.'),
        h('div', { class: 'rq-row' }, ui.button('Focus search', () => R.shell.focusSearch(), { variant: 'primary', icon: 'search' }), ui.button('How it works', () => R.shell.openHelp(), { icon: 'help' }), ui.button('Coverage Console', () => R.shell.go('coverage', { focus: true }), { icon: 'gauge' }))
      ),
      h(
        'div',
        { class: 'rq-principles' },
        h('div', { class: 'rq-principle' }, icon('lock'), h('h4', { class: 'rq-h4' }, 'Private by design'), h('p', null, 'No accounts, cookies, browser storage or analytics. Refresh or Clear Session wipes everything. Queries go straight from your browser to public providers.')),
        h('div', { class: 'rq-principle' }, icon('globe'), h('h4', { class: 'rq-h4' }, 'Live where verified'), h('p', null, live.map((s) => s.displayName.replace(/ \(.*\)$/, '')).slice(0, 9).join(', ') + ' and more. Unverified sources stay link-out.')),
        h('div', { class: 'rq-principle' }, icon('warn'), h('h4', { class: 'rq-h4' }, 'No hit ≠ clear'), h('p', null, 'Public data is incomplete, delayed and ambiguous. Absence of a record never means cleared, solvent, covered, eligible or low risk.')),
        h('div', { class: 'rq-principle' }, icon('gavel'), h('h4', { class: 'rq-h4' }, 'Evidence, not advice'), h('p', null, 'No insurance, credit, investment, treasury, sanctions, procurement, bid, award, legal or tax advice. Human, qualified review is required.'))
      ),
      R.state.helpDismissed
        ? null
        : h('div', { class: 'rq-help-panel' }, h('div', { class: 'rq-row rq-row-between' }, h('h3', { class: 'rq-h3' }, 'Quick guide'), ui.button('Dismiss for this session', () => {
            R.state.helpDismissed = true;
            R.shell.refresh();
          }, { cls: 'rq-btn-sm rq-btn-ghost' })), R.shell.helpContent(true)),
      ui.section('Modules', { icon: 'layers' }, h('div', { class: 'rq-mod-groups' }, ...groups)),
      ui.warning(R.legal.shortDisclaimer, 'info', 'Legal.')
    );
  }

  /* ------------------------------- overview ------------------------------- */
  const MODULE_ACTIONS = [
    ['org360', 'Open Organization 360'], ['fragility', 'Open Counterparty Financial Fragility'], ['insurance', 'Open Insurance & Reinsurance'], ['sanctions', 'Open Sanctions & Debarment'],
    ['cyber', 'Open Cyber Exposure'], ['climate', 'Open Physical/Climate Disruption'], ['trade', 'Open Trade & Category'], ['procurement', 'Open Procurement Radar'], ['relationships', 'Open Relationship Explorer']
  ];

  function resolutionBlock(ctx) {
    const s = ctx.session;
    const org = R.pipeline.ORG_TYPES.includes(ctx.type) || ctx.type === 'ticker';
    if (s.primary) {
      const p = s.primary;
      return ui.section('Resolved entity', { icon: 'building', actions: [ui.button('Change entity', () => {
        s.primary = null;
        s.resolved.entityName = null;
        R.events.emit('primary:changed', null);
      }, { cls: 'rq-btn-sm' }), ui.button('Add to Watchlist', () => ui.pin(p), { icon: 'pin', cls: 'rq-btn-sm' })] },
        h('div', { class: 'rq-resolved' }, h('div', null, h('div', { class: 'rq-resolved-name' }, p.title), h('div', { class: 'rq-muted' }, p.subtitle)), h('div', { class: 'rq-row' }, ui.confidence(s.primaryConfidence), s.primaryAuto ? ui.badge('Auto-selected (single exact match)', 'neutral') : ui.badge('Selected by you', 'org'), p.ids.lei ? ui.badge('LEI ' + p.ids.lei, 'org') : null)),
        s.primaryConfidence === 'Possible' ? ui.warning('This is a possible match only. Manual review recommended before relying on linked evidence.', 'amber') : null
      );
    }
    if (org) {
      const def = R.T.gleifSearch(s.chosen.orgName || s.query);
      return ui.section('Entity resolution — choose the legal entity', { icon: 'building', desc: 'Candidates from GLEIF, sorted by match confidence. JAQA never silently picks a “Possible” match.' }, ui.taskPanel(def, { auto: true, onSelect: (r) => R.pipeline.selectPrimary(r), selectLabel: 'Use this entity', emptyText: 'No LEI records matched. The entity may be private, unregistered with GLEIF, or known under a different legal name.', linkout: { href: R.linkoutFromTemplate('https://search.gleif.org/#/search/simpleSearch={q}', s.query), label: 'Search GLEIF directly' } }));
    }
    return null;
  }

  function coverageSummary() {
    const tasks = R.tasks.all();
    const by = (st) => tasks.filter((t) => t.status === st).length;
    return ui.bars(
      [
        ['Records returned', by('done'), 'ok'],
        ['No records', by('empty'), 'neutral'],
        ['Loading', by('loading'), 'org'],
        ['Link-out only', by('linkout'), 'neutral'],
        ['Failed', by('error'), 'warn']
      ],
      { label: 'Lookups by status' }
    );
  }

  function overview(ctx) {
    if (!ctx.session) return firstRun();
    const s = ctx.session;
    const sig = R.signals.collect();
    const gaps = R.signals.gaps();
    const conflicts = R.signals.conflicts();
    const lensSet = new Set(s.lenses || []);
    const actions = MODULE_ACTIONS.filter(([id]) => lensSet.has(id) || ['org360', 'sanctions', 'relationships'].includes(id));
    const autoTasks = (s.autoKeys || []).map((k) => R.tasks.get(k)).filter(Boolean);

    return h(
      'div',
      { class: 'rq-overview' },
      h(
        'div',
        { class: 'rq-summary-grid' },
        h('div', { class: 'rq-stat' }, h('div', { class: 'rq-stat-label' }, 'Interpreted as'), h('div', { class: 'rq-stat-value' }, s.chosen.label), h('div', { class: 'rq-muted' }, 'Confidence: ' + s.chosen.confidence)),
        h('div', { class: 'rq-stat' }, h('div', { class: 'rq-stat-label' }, 'Primary subject'), h('div', { class: 'rq-stat-value rq-truncate' }, s.primary ? s.primary.title : s.resolved.countryName || s.resolved.placeLabel || ctx.name), h('div', { class: 'rq-muted' }, s.primary ? 'Match: ' + s.primaryConfidence : 'Not a resolved legal entity')),
        h('div', { class: 'rq-stat' }, h('div', { class: 'rq-stat-label' }, 'Source-reported signals'), h('div', { class: 'rq-stat-value' }, String(sig.length)), h('div', { class: 'rq-muted' }, 'Facts to review — not scores')),
        h('div', { class: 'rq-stat' }, h('div', { class: 'rq-stat-label' }, 'Data gaps'), h('div', { class: 'rq-stat-value' }, String(gaps.length)), h('div', { class: 'rq-muted' }, 'Coverage limits for this query'))
      ),
      h('div', { class: 'rq-row rq-quick-actions', role: 'group', 'aria-label': 'Quick actions' }, ...actions.map(([id, label]) => ui.button(label, () => R.shell.go(id, { focus: true }), { cls: 'rq-btn-sm' })), s.primary ? ui.button('Add to Watchlist', () => ui.pin(s.primary), { icon: 'pin', cls: 'rq-btn-sm' }) : null, ui.button('Export Evidence Pack', () => R.exporters.evidencePackJSON(), { icon: 'download', cls: 'rq-btn-sm', variant: 'primary' })),
      resolutionBlock(ctx),
      conflicts.length ? ui.section('Source discrepancies', { icon: 'warn' }, ...conflicts.map(([l, items]) => ui.conflict(l, items))) : null,
      h(
        'div',
        { class: 'rq-two-col' },
        ui.section('Top source-reported signals', { icon: 'warn', desc: 'Direct facts from sources that merit human review. Not a risk score.' }, sig.length ? h('ul', { class: 'rq-signal-list' }, ...sig.slice(0, 12).map((x) => h('li', { class: 'rq-signal rq-signal-' + x.tone }, ui.badge(x.tone === 'serious' ? 'Serious (source-reported)' : 'Review', x.tone), h('button', { type: 'button', class: 'rq-link-btn', onclick: () => R.shell.openDetail(x.record) }, x.text), h('span', { class: 'rq-muted' }, ' — ' + x.record.prov.sourceName)))) : h('p', { class: 'rq-muted' }, 'No source-reported signals yet. This is not evidence of low risk.')),
        ui.section('Top data gaps', { icon: 'info' }, gaps.length ? h('ul', { class: 'rq-gap-list' }, ...gaps.slice(0, 10).map((g) => h('li', null, g))) : h('p', { class: 'rq-muted' }, 'No specific gaps detected yet. Coverage is still incomplete by design.'))
      ),
      h('div', { class: 'rq-two-col' }, ui.section('Source coverage for this query', { icon: 'chart' }, coverageSummary()), ui.section('Freshness', { icon: 'calendar' }, h('ul', { class: 'rq-fresh-list' }, ...R.tasks.all().filter((t) => t.retrievedAt).map((t) => {
        const src = R.sources.get(t.sourceId);
        return h('li', null, h('strong', null, t.label), ' — retrieved ' + fmt.time(t.retrievedAt) + (src && src.mayLagOfficialDb ? ' · may lag the official database' : ''));
      })), R.tasks.all().some((t) => t.retrievedAt) ? null : h('p', { class: 'rq-muted' }, 'Nothing retrieved yet.'))),
      ui.section('Initial lookups', { icon: 'search', desc: 'A small first request budget. Deeper sources load when you open a module or click Load.' }, ...autoTasks.filter((t) => !(t.key.startsWith('gleif:search:') && !s.primary && (R.pipeline.ORG_TYPES.includes(ctx.type) || ctx.type === 'ticker'))).map((t) => ui.taskPanel(t.def, { auto: true, limit: 6 }))),
      ui.warning('Overview summarizes public records and link-outs. It does not approve, clear, score, rank, insure, cover, fund, award, or certify counterparties, countries, products, or opportunities.', 'info')
    );
  }

  R.modules.register({ id: 'overview', group: 'risk', order: 1, icon: 'gauge', liveRefresh: true, title: 'Overview / Risk Triage', short: 'Overview', description: 'Unified summary of the investigated subject: interpretation, resolution, signals, gaps, coverage and freshness.', render: overview });
})(window.JAQAWorkspace);
