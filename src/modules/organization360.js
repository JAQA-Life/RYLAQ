/*
 * organization360.js — MODULE 4: Organization 360, MODULE 5: Counterparty
 * Financial Fragility, MODULE 6: Public Filing & Financial Statement Lens,
 * MODULE 7: Credit, Insolvency & Litigation.
 *
 * HOW PUBLIC FILINGS ARE PARSED AND CAVEATED
 *   SEC submissions give form types, dates, accession numbers and 8-K item
 *   codes. RYLAQ lists specific 8-K items (1.03, 2.04, 4.01, 4.02, …) and
 *   NT (late filing) notices as source-reported filing facts with links.
 *
 * HOW DERIVED METRICS ARE CALCULATED AND LABELED
 *   Only when XBRL company facts are live: each metric shows its formula,
 *   the exact XBRL concepts and periods used, and a comparability caveat.
 *   No credit score, peer ranking, rating or investment conclusion is ever
 *   produced.
 */
(function (R) {
  'use strict';
  const { h, extLink, fmt } = R.util;
  const ui = R.ui;
  const T = R.T;

  const INSURANCE_TYPES = ['insurer', 'reinsurer', 'broker', 'mga', 'captive', 'ils', 'tpa', 'syndicate'];

  /** Returns a resolution panel when the subject is not yet a resolved entity; else null. */
  R.entityGate = function (ctx, purpose) {
    if (!ctx.session) return ui.needSession(purpose);
    if (ctx.primary) return null;
    const org = R.pipeline.ORG_TYPES.includes(ctx.type) || ['ticker', 'lei', 'cik'].includes(ctx.type);
    if (!org) return h('div', null, ui.warning(`The current query was interpreted as “${ctx.chosen.label}”. ${purpose ? 'This module works on organizations; ' : ''}search an organization, LEI, ticker or CIK, or change the interpretation above.`, 'info'), ui.button('Treat query as an organization', () => R.shell.search(ctx.q, 'organization'), { icon: 'building' }));
    if (ctx.type === 'cik') return h('div', null, ui.taskPanel(T.secSubs(ctx.chosen.cik), { auto: true, onSelect: (r) => R.pipeline.selectPrimary(r), selectLabel: 'Use this entity' }));
    if (ctx.type === 'lei') return h('div', null, ui.taskPanel(T.gleifLei(ctx.chosen.lei), { auto: true, onSelect: (r) => R.pipeline.selectPrimary(r), selectLabel: 'Use this entity' }));
    return ui.section('Choose the legal entity first', { icon: 'building', desc: 'Downstream lookups use the selected entity’s legal name and identifiers. Possible matches are never treated as exact.' }, ui.taskPanel(T.gleifSearch(ctx.chosen.orgName || ctx.q), { auto: true, onSelect: (r) => R.pipeline.selectPrimary(r), selectLabel: 'Use this entity' }), h('p', { class: 'rq-muted' }, 'No suitable LEI record? Many private companies have none.'), ui.button('Continue with the query text as a name (Possible match)', () => {
      const r = R.rec('user', 'unresolved-name', { title: ctx.q, subtitle: 'Unresolved name — no legal-entity record selected', category: 'ambiguous', confidence: 'Unresolved', badges: [{ text: 'Unresolved entity', tone: 'warn' }], fields: [['Name as entered', ctx.q]], data: { name: ctx.q } });
      r.prov.sourceName = 'User-entered name (unresolved)';
      r.prov.url = '';
      R.pipeline.selectPrimary(r, { confidence: 'Unresolved' });
    }, { cls: 'rq-btn-sm' }));
  };

  function subjectName(ctx) {
    return (ctx.primary && ctx.primary.data && ctx.primary.data.name) || ctx.primary.title;
  }
  function subjectHeader(ctx) {
    const p = ctx.primary;
    return h('div', { class: 'rq-subject' }, h('div', null, h('div', { class: 'rq-eyebrow' }, 'Subject'), h('div', { class: 'rq-resolved-name' }, p.title)), h('div', { class: 'rq-row' }, ui.confidence(ctx.session.primaryConfidence), p.ids.lei ? ui.badge('LEI ' + p.ids.lei, 'org') : ui.badge('No LEI selected', 'neutral'), ctx.resolved.cik ? ui.badge('CIK ' + ctx.resolved.cik, 'fin') : null));
  }

  const gapsList = (items) => ui.section('Data gaps', { icon: 'info' }, h('ul', { class: 'rq-gap-list' }, ...items.map((g) => h('li', null, g))));

  /* ---------------------------- Organization 360 ---------------------------- */
  R.modules.register({
    id: 'org360',
    group: 'risk',
    order: 2,
    icon: 'building',
    title: 'Organization 360',
    short: 'Organization 360',
    description: 'Legal identity, corporate family, identifiers, filings, awards and public signals for a supplier, buyer, insurer, reinsurer, broker, captive, MGA, TPA or other organization.',
    warnings: ['Corporate family coverage is incomplete. Missing LEI does not mean an invalid entity. Private companies may have limited public data. Confidence and provenance are shown for every record.'],
    render(ctx) {
      const gate = R.entityGate(ctx, 'Organization 360');
      if (gate) return gate;
      const p = ctx.primary;
      const name = subjectName(ctx);
      const lei = p.ids.lei;
      const isIns = INSURANCE_TYPES.includes(ctx.type);
      const qid = ctx.resolved.qid;
      return h(
        'div',
        null,
        subjectHeader(ctx),
        ui.section('Legal identity', { icon: 'building' }, ui.recordCard(p)),
        lei
          ? ui.section('Corporate family (GLEIF Level 2 relationship data)', { icon: 'tree', desc: 'Loaded on module open (up to 3 requests). Parent/child data is only as reported to GLEIF; reporting exceptions are common.' }, h('div', { class: 'rq-three-col' }, ui.taskPanel(T.gleifParent(lei, 'direct'), { auto: true, compact: true, noHitWarning: false }), ui.taskPanel(T.gleifParent(lei, 'ultimate'), { auto: true, compact: true, noHitWarning: false }), ui.taskPanel(T.gleifChildren(lei), { auto: true, compact: true, limit: 8, noHitWarning: false })))
          : ui.warning('No LEI selected, so GLEIF parent/child relationships cannot be loaded.', 'amber'),
        ui.section('Identifier cross-links', { icon: 'link', desc: 'Wikidata claims are community-edited and non-authoritative. Conflicts with official registries are shown, never auto-resolved.' }, qid ? ui.taskPanel(T.wdIds(qid), { auto: true }) : ui.taskPanel(T.wdSearch(name), { auto: false, onSelect: (r) => {
          ctx.session.resolved.qid = r.data.qid;
          R.tasks.ensure(T.wdIds(r.data.qid));
          R.tasks.start(T.wdIds(r.data.qid).key);
          R.shell.refresh();
        }, selectLabel: 'Use for cross-links' })),
        ctx.resolved.cik ? ui.section('SEC filings', { icon: 'doc' }, ui.taskPanel(T.secSubs(ctx.resolved.cik), { auto: true }), ui.button('Open Public Filing lens', () => R.shell.go('filings', { focus: true }), { cls: 'rq-btn-sm' })) : null,
        ui.section('Enrichment (user-triggered)', { icon: 'download', desc: 'Each lookup sends the entity name directly from your browser to the named provider.' },
          h('div', { class: 'rq-two-col' },
            ui.taskPanel(T.usaAwards({ recipient: name, kind: 'contracts' }), { limit: 5, emptyText: 'No US federal contract awards matched this recipient name.' }),
            ui.taskPanel(T.cpscSearch(name), { limit: 5, emptyText: 'No CPSC recalls matched this name in recall titles.' }),
            ui.taskPanel(T.kevMentions(name.split(/\s+/)[0]), { limit: 5, emptyText: 'No CISA KEV entries name this vendor/product text.' }),
            ui.taskPanel(T.courts(name, 'r'), { limit: 5 }),
            ui.taskPanel(T.epa(name), { limit: 5 }),
            ui.taskPanel(T.wpSummary(name), { limit: 1, noHitWarning: false })
          )
        ),
        isIns ? ui.section('Insurance regulator & rating link-outs', { icon: 'umbrella' }, ui.dir('insuranceRegulators', null, { compact: true }), ui.dir('ratingAgencies', null, { compact: true })) : null,
        ui.section('Sanctions & debarment (link-out only)', { icon: 'shield' }, ui.warning(R.legal.noHitNotClear + ' RYLAQ is not a sanctions screening system of record.', 'amber'), ui.dir('sanctions', null, { compact: true })),
        ui.section('Registries & official sources', { icon: 'link' }, ui.dir('entity', name, { compact: true })),
        gapsList([
          lei ? 'GLEIF data is self-reported by the entity via LOUs and corroborated to varying levels.' : 'No LEI selected.',
          ctx.resolved.cik ? 'SEC data covers US-registered filers only.' : 'No SEC registrant identified — financial filings may be unavailable or held by non-US registries.',
          'Name-based lookups (awards, recalls, KEV, courts, EPA) can match unrelated entities with similar names. Verify identifiers.',
          'Website, officers, beneficial owners and internal data are not collected.'
        ]),
        ui.exportBar('RYLAQ-Counterparty-Evidence-Pack.json', 'RYLAQ-Counterparty-Evidence-Pack.csv', 'globalRisk')
      );
    }
  });

  /* ---------------------- Counterparty Financial Fragility ---------------------- */
  function secSignalsView(recs, task) {
    const sigs = (task.meta && task.meta.signals) || [];
    return h(
      'div',
      null,
      ui.recordCard(recs[0]),
      h('h4', { class: 'rq-h4' }, 'Source-reported filing events (most recent first)'),
      sigs.length
        ? h('ul', { class: 'rq-signal-list' }, ...sigs.slice(0, 20).map((s) => h('li', { class: 'rq-signal rq-signal-warn' }, ui.badge('Filing event', 'warn'), h('span', null, `${s.date} — ${s.text} `), extLink(s.url, 'Open filing'))))
        : h('p', { class: 'rq-muted' }, 'No late-filing notices or listed 8-K stress items in the recent filings index. This does not indicate financial health.')
    );
  }
  R.secSignalsView = secSignalsView;

  R.modules.register({
    id: 'fragility',
    group: 'finance',
    order: 21,
    icon: 'gauge',
    title: 'Counterparty Financial Fragility',
    short: 'Counterparty Fragility',
    description: 'Public evidence of financial stress: filing events, late filings, restructuring and insolvency records, liens, litigation and enforcement link-outs.',
    warnings: ['Public distress signals do not predict insolvency. Credit, legal, treasury, and compliance review required.', 'No credit score. No approval/rejection. No “safe” or “distressed” conclusion. No confidential lender data.'],
    render(ctx) {
      const gate = R.entityGate(ctx, 'Counterparty Financial Fragility');
      if (gate) return gate;
      const name = subjectName(ctx);
      return h(
        'div',
        null,
        subjectHeader(ctx),
        ui.kv([
          ['Legal name', ctx.primary.title],
          ['LEI', ctx.primary.ids.lei],
          ['Jurisdiction', ctx.primary.data && ctx.primary.data.jurisdiction],
          ['Entity status (GLEIF)', ctx.primary.data && ctx.primary.data.status],
          ['Public company status', ctx.resolved.cik ? 'SEC registrant (CIK ' + ctx.resolved.cik + ')' : 'No SEC registrant identified'],
          ['Match confidence', ctx.session.primaryConfidence]
        ]),
        ctx.resolved.cik
          ? ui.section('Public filing events', { icon: 'doc', desc: '8-K items 1.03, 1.05, 2.04, 2.05, 2.06, 3.01, 4.01, 4.02, 5.02 and NT late-filing notices, as listed in the SEC filing index.' }, ui.taskPanel(T.secSubs(ctx.resolved.cik), { auto: true, render: secSignalsView }))
          : ui.warning('Private-company coverage limitation: no public filings identified. Request financial statements directly from the counterparty and use licensed credit data where appropriate.', 'amber'),
        ui.section('Insolvency, restructuring & court records', { icon: 'gavel', desc: 'User-triggered. CourtListener covers part of the US federal record (RECAP); PACER is fee-based and not bypassed.' }, ui.taskPanel(T.courts(name, 'r'), { limit: 8 }), ui.dir('insolvency', name, { compact: true })),
        ui.section('Liens, charges & judgments (link-out)', { icon: 'link' }, ui.warning('Lien/UCC/judgment registries are jurisdiction-specific, often delayed, and name matching is ambiguous.', 'amber'), ui.dir('lien', name, { compact: true })),
        ui.section('Sanctions, debarment & enforcement (link-out)', { icon: 'shield' }, ui.dir('sanctions', null, { compact: true }), ui.dir('enforcement', null, { compact: true })),
        ui.section('Rating agencies & market data (link-out only)', { icon: 'chart' }, ui.dir('ratingAgencies', null, { compact: true }), ui.warning('Ratings are licensed; RYLAQ never scrapes, reproduces or derives them.', 'info')),
        ui.warning('Parent/subsidiary ambiguity: stress at a subsidiary, parent or sister entity may be reported under a different legal name. Check the corporate family in Organization 360.', 'amber'),
        ui.exportBar('RYLAQ-Counterparty-Evidence-Pack.json', 'RYLAQ-Counterparty-Evidence-Pack.csv', 'finance')
      );
    }
  });

  /* ------------------------- Public Filing & XBRL lens ------------------------- */
  const XBRL = {
    Revenues: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'],
    NetIncome: ['NetIncomeLoss'],
    OperatingCashFlow: ['NetCashProvidedByUsedInOperatingActivities'],
    Cash: ['CashAndCashEquivalentsAtCarryingValue'],
    AssetsCurrent: ['AssetsCurrent'],
    LiabilitiesCurrent: ['LiabilitiesCurrent'],
    LongTermDebt: ['LongTermDebtNoncurrent', 'LongTermDebt'],
    Equity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
    InterestExpense: ['InterestExpense', 'InterestExpenseNonoperating'],
    OperatingIncome: ['OperatingIncomeLoss']
  };
  function latestFact(facts, names) {
    const g = facts && facts['us-gaap'];
    if (!g) return null;
    for (const n of names) {
      const units = g[n] && g[n].units && (g[n].units.USD || Object.values(g[n].units)[0]);
      if (!units) continue;
      const annual = units.filter((u) => /^(10-K|20-F|40-F)/.test(u.form || '') && u.fp === 'FY');
      const pick = (annual.length ? annual : units).slice().sort((a, b) => String(b.end).localeCompare(String(a.end)) || String(b.filed).localeCompare(String(a.filed)))[0];
      if (pick) return { concept: n, val: pick.val, end: pick.end, form: pick.form, fy: pick.fy, filed: pick.filed, accn: pick.accn };
    }
    return null;
  }
  R.clients.secXbrl = {
    async facts(cik) {
      const padded = R.clients.sec.padCik(cik);
      const res = await R.net.request('secXbrl', `https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`, { validate: (j) => j && typeof j.facts === 'object' });
      if (!res.ok) return { error: res.errorKind };
      const facts = res.data.facts;
      const got = Object.fromEntries(Object.entries(XBRL).map(([k, names]) => [k, latestFact(facts, names)]));
      const metric = (label, formula, a, b, caveat) => {
        const x = got[a];
        const y = got[b];
        if (!x || !y || !y.val) return [label, 'Not computable: required XBRL facts not reported'];
        return [label, `${fmt.num(x.val / y.val, 2)} — ${formula}; ${x.concept} (${x.end}) ÷ ${y.concept} (${y.end}). ${caveat}`];
      };
      const fields = [
        ...Object.entries(got).map(([k, v]) => [k + ' (latest, as reported)', v ? `${fmt.money(v.val)} · ${v.concept} · period end ${v.end} · ${v.form} filed ${v.filed}` : null]),
        metric('Current ratio (derived by RYLAQ)', 'AssetsCurrent ÷ LiabilitiesCurrent', 'AssetsCurrent', 'LiabilitiesCurrent', 'Periods may differ; not a credit metric.'),
        metric('Debt to equity (derived by RYLAQ)', 'LongTermDebt ÷ StockholdersEquity', 'LongTermDebt', 'Equity', 'Excludes short-term debt and leases; accounting policies differ.'),
        metric('Interest coverage (derived by RYLAQ)', 'OperatingIncomeLoss ÷ InterestExpense', 'OperatingIncome', 'InterestExpense', 'Operating income is not EBIT/EBITDA; periods may differ.')
      ];
      return {
        records: [
          R.rec('secXbrl', 'xbrl-financial-fact', {
            title: (res.data.entityName || 'Registrant') + ' — XBRL company facts',
            subtitle: 'Latest annual facts where available',
            recordId: padded,
            url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${padded}&type=10-K&owner=exclude`,
            endpoint: 'api/xbrl/companyfacts',
            category: 'derived-financial-metric',
            badges: [{ text: 'Derived by RYLAQ from public filing data', tone: 'fin' }, { text: 'Not a credit rating', tone: 'neutral' }],
            fields
          })
        ]
      };
    }
  };

  R.modules.register({
    id: 'filings',
    group: 'finance',
    order: 22,
    icon: 'doc',
    title: 'Public Filing & Financial Statement Lens',
    short: 'Public Filings',
    description: 'Filing index, filing events and (where live) XBRL financial facts with transparent derived metrics.',
    warnings: ['Derived by RYLAQ from public filing data. Not a credit rating. Accounting standards, fiscal periods, and restatements may limit comparability.'],
    render(ctx) {
      const gate = R.entityGate(ctx, 'the Public Filing lens');
      if (gate) return gate;
      const cik = ctx.resolved.cik;
      if (!cik)
        return h('div', null, subjectHeader(ctx), ui.warning('No SEC registrant identified for this entity (no CIK from the selection or Wikidata cross-links). Non-US and private companies file with other registries or not at all.', 'amber'), ui.dir('entity', subjectName(ctx), { title: 'Registry link-outs', compact: true }));
      const filingsTable = (recs, task) => {
        const fl = ((task.meta && task.meta.filings) || []).filter((f) => /^(10-K|10-Q|8-K|20-F|40-F|6-K|NT |S-1|424B|DEF 14A)/.test(f.form)).slice(0, 30);
        return h(
          'div',
          null,
          ui.recordCard(recs[0]),
          h('div', { class: 'rq-table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Recent filings' }, h('table', { class: 'rq-table' }, h('thead', null, h('tr', null, ...['Form', 'Filed', 'Period', '8-K items', 'Accession', 'Document'].map((c) => h('th', { scope: 'col' }, c)))), h('tbody', null, ...fl.map((f) => h('tr', null, h('th', { scope: 'row' }, f.form), h('td', null, f.date), h('td', null, f.report || '—'), h('td', null, f.items || '—'), h('td', null, f.accession), h('td', null, extLink(f.url, 'Open')))))))
        );
      };
      return h(
        'div',
        null,
        subjectHeader(ctx),
        ui.section('Filing index (SEC EDGAR submissions)', { icon: 'doc' }, ui.taskPanel(T.secSubs(cik), { auto: true, render: filingsTable })),
        ui.section('XBRL financial facts & derived metrics', { icon: 'chart', desc: 'Formula, source concepts, periods and caveats shown for every derived value. No credit score, peer ranking or investment conclusion.' }, ui.taskPanel({ key: 'secxbrl:' + cik, sourceId: 'secXbrl', label: 'SEC XBRL company facts', run: () => R.clients.secXbrl.facts(cik) }, { linkout: { href: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=10-K&owner=exclude`, label: 'Open 10-K filings on EDGAR' } })),
        ui.section('Going-concern, restatement and auditor-change disclosures', { icon: 'warn' }, h('p', null, 'Listed 8-K items 4.01 (auditor change) and 4.02 (non-reliance/restatement) appear in Counterparty Financial Fragility. Going-concern language must be read in the filings themselves:'), extLink('https://www.sec.gov/edgar/search/#/q=%22going%20concern%22&ciks=' + cik, 'EDGAR full-text search: “going concern” for this CIK')),
        ui.exportBar('RYLAQ-Finance-Risk-results.json', 'RYLAQ-Finance-Risk-results.csv', 'finance')
      );
    }
  });

  /* ------------------------ Credit, Insolvency & Litigation ------------------------ */
  R.modules.register({
    id: 'credit',
    group: 'finance',
    order: 23,
    icon: 'gavel',
    title: 'Credit, Insolvency & Litigation',
    short: 'Credit, Insolvency & Litigation',
    description: 'Public court, bankruptcy, lien, judgment, debarment and enforcement signals with jurisdictional link-outs.',
    warnings: ['No public record does not mean no distress. Private-company coverage may be limited. Court and lien registries are jurisdiction-specific and delayed. Legal and credit review required.', 'No credit score, payment recommendation, collateral valuation, lender-priority determination or personal-data aggregation.'],
    render(ctx) {
      if (!ctx.session) return h('div', null, ui.needSession('court and insolvency records'), ui.dir('insolvency', null, { title: 'Insolvency registries' }), ui.dir('lien', null, { title: 'Lien & judgment registries' }));
      const name = ctx.primary ? subjectName(ctx) : ctx.q;
      return h(
        'div',
        null,
        ctx.primary ? subjectHeader(ctx) : ui.warning('No resolved entity; lookups use the query text and may match unrelated parties.', 'amber'),
        ui.section('US federal court dockets (RECAP) — includes bankruptcy courts where indexed', { icon: 'gavel' }, ui.taskPanel(T.courts(name, 'r'), { limit: 10 })),
        ui.section('Court opinions', { icon: 'doc' }, ui.taskPanel(T.courts(name, 'o'), { limit: 10 })),
        ctx.resolved.cik ? ui.section('Bankruptcy / acceleration filing items (SEC 8-K)', { icon: 'warn' }, ui.taskPanel(T.secSubs(ctx.resolved.cik), { auto: true, render: secSignalsView })) : null,
        ui.section('Insolvency registries', { icon: 'link' }, ui.dir('insolvency', name, { compact: true })),
        ui.section('Liens, UCC, charges, tax liens & judgments', { icon: 'link' }, ui.dir('lien', name, { compact: true }), h('p', { class: 'rq-muted' }, 'Tax liens are recorded with county/state recorders (US) and equivalent offices elsewhere; many are fee-based or not searchable online.')),
        ui.section('Debarment, exclusions & enforcement', { icon: 'shield' }, ui.linkouts(R.directories.sanctions.filter((e) => e.kind === 'debarment'), null, { compact: true }), ui.dir('enforcement', null, { compact: true })),
        ui.exportBar('RYLAQ-Finance-Risk-results.json', 'RYLAQ-Finance-Risk-results.csv', 'finance')
      );
    }
  });
})(window.RYLAQWorkspace);
