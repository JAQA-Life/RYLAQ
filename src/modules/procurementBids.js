/*
 * procurementBids.js — MODULE 19: Procurement & Bid Radar, MODULE 20:
 * Awards, Contracts & Past Performance, MODULE 21: Grants, Development &
 * Public Funding, MODULE 22: PPP, Concessions & Infrastructure Projects.
 *
 * HOW PROCUREMENT PORTALS ARE LINK-OUT-FIRST AND NEVER SCRAPED
 *   Verification showed TED’s search API does not return CORS headers for
 *   browser POSTs, and SAM.gov/national portals require keys or logins. They
 *   are therefore official link-outs. Live data comes from USAspending (US
 *   federal awards/assistance), which publishes past awards — not open
 *   opportunities. The UI says so plainly.
 *
 * HOW NO BID/NO-BID OR AWARD ADVICE IS GENERATED
 *   No ranking, eligibility, win probability or bid recommendation is
 *   computed anywhere. Deadlines are shown only as published, with timezone
 *   and amendment warnings.
 */
(function (R) {
  'use strict';
  const { h, extLink, fmt } = R.util;
  const ui = R.ui;
  const T = R.T;

  const PROC_WARN = 'RYLAQ organizes public procurement notices, awards, grants, and related evidence. It does not provide bid/no-bid advice, procurement legal advice, eligibility determinations, award predictions, or contract management advice. Always verify deadlines, eligibility, language, thresholds, lots, amendments, and official source requirements.';
  const DEADLINE_WARN = 'Tender deadlines may be jurisdiction-specific, timezone-specific, subject to amendment, translation-dependent, and controlled by official procurement portals. RYLAQ displays published metadata only and does not guarantee timeliness or eligibility.';
  const COLLUSION_WARN = 'RYLAQ must not be used to coordinate bids, share confidential pricing, allocate markets, manipulate procurement, evade sanctions, evade export controls, or engage in corrupt or anti-competitive conduct.';

  const st = { keyword: '', region: '', sort: 'amount', view: 'cards', page: 1, kind: 'contracts', run: 0, from: '', to: '' };
  R.events.on('session:cleared', () => Object.assign(st, { keyword: '', region: '', sort: 'amount', view: 'cards', page: 1, kind: 'contracts', run: 0, from: '', to: '' }));
  R.events.on('session:started', () => Object.assign(st, { keyword: '', page: 1, run: 0 }));

  const REGION_OF = (e) => {
    const r = e.region || '';
    if (/European Union|Norway|Denmark|Finland|Switzerland|United Kingdom|Europe/.test(r)) return 'Europe';
    if (/United States|Canada|Mexico|Brazil|Latin/.test(r)) return 'Americas';
    if (/Australia|New Zealand|Singapore|India|Japan|Korea|China|Asia/.test(r)) return 'Asia-Pacific';
    if (/Africa/.test(r)) return 'Africa';
    return 'Global / multilateral';
  };

  function portalTable(entries, q) {
    const groups = {};
    entries.forEach((e) => (groups[REGION_OF(e)] = groups[REGION_OF(e)] || []).push(e));
    return h(
      'div',
      { class: 'rq-table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Procurement portals by region' },
      h(
        'table',
        { class: 'rq-table' },
        h('caption', { class: 'rq-sr' }, 'Map-free geographic table of official procurement portals'),
        h('thead', null, h('tr', null, ...['Region', 'Portal', 'Jurisdiction', 'Language', 'Mode'].map((c) => h('th', { scope: 'col' }, c)))),
        h(
          'tbody',
          null,
          ...Object.entries(groups).flatMap(([g, list]) =>
            list.map((e, i) => {
              const lo = R.linkout(e, q);
              return h('tr', null, i === 0 ? h('th', { scope: 'rowgroup', rowspan: String(list.length) }, g) : null, h('td', null, extLink(lo.href, e.name), lo.withQuery ? h('span', { class: 'rq-link-meta' }, ' opens with your query') : null), h('td', null, e.region || '—'), h('td', null, e.lang ? ui.badge('Translation risk (' + e.lang + ')', 'warn') : 'en'), h('td', null, ui.badge('Official link-out', 'proc')));
            })
          )
        )
      )
    );
  }

  function sortRecords(recs) {
    const r = recs.slice();
    if (st.sort === 'amount') r.sort((a, b) => (b.data.amount || 0) - (a.data.amount || 0));
    if (st.sort === 'start') r.sort((a, b) => String(b.data.start || '').localeCompare(String(a.data.start || '')));
    if (st.sort === 'end') r.sort((a, b) => String(a.data.end || '').localeCompare(String(b.data.end || '')));
    if (st.sort === 'recipient') r.sort((a, b) => String(a.fields[1][1] || '').localeCompare(String(b.fields[1][1] || '')));
    return r;
  }

  function timelineView(recs) {
    const by = {};
    recs.forEach((r) => {
      const d = (r.data.end || r.data.start || 'Undated').slice(0, 7);
      (by[d] = by[d] || []).push(r);
    });
    return h('div', { class: 'rq-timeline' }, ...Object.keys(by).sort().map((m) => h('div', { class: 'rq-timeline-month' }, h('h4', { class: 'rq-h4' }, m === 'Undated' ? m : m + ' (period-of-performance end)'), h('ul', null, ...by[m].map((r) => h('li', null, h('button', { type: 'button', class: 'rq-link-btn', onclick: () => R.shell.openDetail(r) }, r.title), ' — ', fmt.money(r.data.amount)))))));
  }

  function awardsResults(recs, task) {
    const sorted = sortRecords(recs);
    const body = st.view === 'timeline' ? timelineView(sorted) : st.view === 'table' ? ui.recordTable(sorted, [['Award', (r) => r.title], ['Agency', (r) => r.subtitle], ['Period', (r) => r.fields[5][1]], ['Amount (as reported)', (r) => fmt.money(r.data.amount)], ['Match', (r) => r.prov.confidence || '—']]) : ui.records(sorted, { forceCards: true });
    return h(
      'div',
      null,
      h('div', { class: 'rq-filters' }, ui.select('Sort', [['amount', 'Amount (as reported)'], ['start', 'Start date (newest)'], ['end', 'End date (soonest)'], ['recipient', 'Recipient A–Z']], st.sort, (v) => ((st.sort = v), R.shell.refresh()), { key: 'proc-sort' }), ui.select('View', [['cards', 'Cards'], ['table', 'Table'], ['timeline', 'Timeline (in-memory)']], st.view, (v) => ((st.view = v), R.shell.refresh()), { key: 'proc-view' })),
      body,
      h('div', { class: 'rq-row' }, st.page > 1 ? ui.button('Previous page', () => ((st.page -= 1), R.shell.refresh()), { cls: 'rq-btn-sm' }) : null, h('span', { class: 'rq-muted' }, 'Page ' + st.page), task.meta && task.meta.hasNext ? ui.button('Next page', () => ((st.page += 1), R.shell.refresh()), { cls: 'rq-btn-sm' }) : null)
    );
  }
  R.awardsResults = awardsResults;

  function searchForm(ctx, defaults, kinds) {
    const draft = { keyword: st.keyword || defaults.keyword, from: st.from, to: st.to, kind: st.kind };
    return h(
      'form',
      { class: 'rq-filters', onsubmit: (e) => {
        e.preventDefault();
        const chk = R.privacy.checkInput(draft.keyword);
        if (!chk.ok) return R.util.announce(chk.reason);
        if (chk.value.length < 3) return R.util.announce('USAspending keyword search needs at least 3 characters.');
        Object.assign(st, draft, { keyword: chk.value, page: 1, run: st.run + 1 });
        R.shell.refresh();
      } },
      ui.input('Keyword (buyer, category, CPV/NAICS term, supplier)', draft.keyword, (v) => (draft.keyword = v), { key: 'proc-kw' }),
      kinds ? ui.select('Award type', [['contracts', 'Contracts'], ['idvs', 'IDVs / frameworks'], ['grants', 'Grants / assistance']], draft.kind, (v) => (draft.kind = v), { key: 'proc-kind' }) : null,
      ui.input('Action date from', draft.from, (v) => (draft.from = v), { type: 'date', key: 'proc-from' }),
      ui.input('Action date to', draft.to, (v) => (draft.to = v), { type: 'date', key: 'proc-to' }),
      h('button', { type: 'submit', class: 'rq-btn rq-btn-primary' }, 'Search')
    );
  }

  function defaultKeyword(ctx) {
    const c = ctx.chosen;
    if (!c) return '';
    if (c.concept) return c.insuranceRelated ? ctx.q.replace(/\b(tender|rfp)\b/gi, '').trim() : c.type === 'ppp' ? 'public-private partnership' : 'services';
    if (ctx.primary) return (ctx.primary.data && ctx.primary.data.name) || ctx.primary.title;
    return ctx.q;
  }

  /* --------------------------- Procurement & Bid Radar --------------------------- */
  R.modules.register({
    id: 'procurement',
    group: 'procurement',
    order: 40,
    icon: 'doc',
    title: 'Procurement & Bid Radar',
    short: 'Procurement & Bid Radar',
    description: 'Discover public tenders, RFPs, RFQs, frameworks, awards, grants, PPPs and concessions across official portals and development banks.',
    warnings: [PROC_WARN, DEADLINE_WARN, COLLUSION_WARN],
    render(ctx) {
      const kw = st.keyword || defaultKeyword(ctx);
      const entries = [...R.directories.procurement, ...R.directories.devBanks];
      const regions = ['Europe', 'Americas', 'Asia-Pacific', 'Africa', 'Global / multilateral'];
      const filtered = st.region ? entries.filter((e) => REGION_OF(e) === st.region) : entries;
      const tedId = ctx.chosen && ctx.chosen.type === 'tender' && ctx.chosen.ted;
      return h(
        'div',
        null,
        tedId ? ui.section('TED notice ' + tedId, { icon: 'doc' }, ui.kv([['Publication number', tedId], ['Source', 'TED (Publications Office of the EU)'], ['Mode', 'Official link-out (TED API has no browser CORS)']]), extLink('https://ted.europa.eu/en/notice/-/detail/' + encodeURIComponent(tedId), 'Open notice on TED', { cls: 'rq-btn rq-btn-primary' }), ui.warning(DEADLINE_WARN, 'amber')) : null,
        ui.section('Open opportunities', { icon: 'search', desc: 'Open notices (TED, SAM.gov, national and development-bank portals) have no verified browser API and are official link-outs. Enter your query on the portal.' }, h('div', { class: 'rq-filters' }, ui.select('Region', [['', 'All regions'], ...regions.map((r) => [r, r])], st.region, (v) => ((st.region = v), R.shell.refresh()), { key: 'proc-region' })), portalTable(filtered, kw)),
        ctx.session
          ? ui.section('US federal awards (live, USAspending)', { icon: 'chart', desc: 'Past awards — useful for buyer, category and incumbent context. Not open opportunities and not a prediction of future awards.' }, searchForm(ctx, { keyword: kw }, true), kw.length >= 3 ? ui.taskPanel(T.usaAwards({ keyword: kw, kind: st.kind, from: st.from || undefined, to: st.to || undefined, page: st.page }), { auto: st.run > 0 || ['procurement', 'tender'].includes(ctx.type), render: awardsResults }) : ui.warning('Enter at least 3 characters to search awards.', 'info'))
          : ui.needSession('award search'),
        ui.section('Procurement types & categories', { icon: 'layers' }, h('div', { class: 'rq-row' }, ...R.taxonomy.procurementTypes.map((t) => ui.badge(t, 'proc'))), h('div', { class: 'rq-row' }, ...R.taxonomy.procurementCategories.map((c) => ui.badge(c.name, 'neutral')))),
        ui.section('Deadline radar (in-memory)', { icon: 'calendar' }, h('p', { class: 'rq-muted' }, 'Deadline tracking populates only from sources that publish submission deadlines through a verified API. None do today, so deadlines must be read on the official notice. RYLAQ never stores alerts.'), ui.warning(DEADLINE_WARN, 'amber')),
        ui.exportBar('RYLAQ-Procurement-Bids-results.json', 'RYLAQ-Procurement-Bids-results.csv', 'procurement')
      );
    }
  });

  /* ---------------------- Awards, Contracts & Past Performance ---------------------- */
  R.modules.register({
    id: 'awards',
    group: 'procurement',
    order: 41,
    icon: 'chart',
    title: 'Awards, Contracts & Past Performance',
    short: 'Awards & Past Performance',
    description: 'Public award history: recipients, buyers, values, periods of performance, parent awards and competition data where published.',
    warnings: ['Public award history does not guarantee future performance.', 'Recipient name matching may be ambiguous; verify legal entity (UEI) and contract number.'],
    render(ctx) {
      if (!ctx.session) return h('div', null, ui.needSession('award history'), ui.dir('procurement', null, { compact: true }));
      const c = ctx.chosen;
      const byRecipient = !!ctx.primary || R.pipeline.ORG_TYPES.includes(c.type);
      const name = ctx.primary ? (ctx.primary.data && ctx.primary.data.name) || ctx.primary.title : c.orgName || ctx.q;
      const detailAfter = (task) => h('p', { class: 'rq-muted' }, 'Open a record’s official USAspending page for transactions, modifications and subawards.');
      return h(
        'div',
        null,
        c.generatedId ? ui.section('Award detail', { icon: 'doc' }, ui.taskPanel(T.usaAwardDetail(c.generatedId), { auto: true })) : null,
        ui.section(byRecipient ? 'Awards to this recipient (name match)' : 'Awards matching the query', { icon: 'chart', desc: byRecipient ? 'Recipient-name search. Includes affiliates with similar names — verify UEI.' : 'Keyword search across award descriptions.' }, ui.taskPanel(byRecipient ? T.usaAwards({ recipient: name, kind: 'contracts', page: st.page }) : T.usaAwards({ keyword: c.piid || (c.concept ? 'services' : ctx.q), kind: 'contracts', page: st.page }), { auto: true, render: awardsResults, after: detailAfter, emptyText: 'No US federal contract awards matched.' })),
        ui.section('EU and other award notices (link-out)', { icon: 'link' }, ui.linkouts(R.directories.procurement.filter((e) => /TED|Contracts Finder|Find a Tender|AusTender|CanadaBuys/.test(e.name)), null, { compact: true })),
        ui.section('Related checks', { icon: 'shield' }, h('div', { class: 'rq-row' }, ui.button('Sanctions & debarment', () => R.shell.go('sanctions', { focus: true }), { cls: 'rq-btn-sm' }), ui.button('Litigation', () => R.shell.go('credit', { focus: true }), { cls: 'rq-btn-sm' }), ui.button('Financial filings', () => R.shell.go('filings', { focus: true }), { cls: 'rq-btn-sm' }), ui.button('Recalls & cyber', () => R.shell.go('supplyChain', { focus: true }), { cls: 'rq-btn-sm' }))),
        ui.exportBar('RYLAQ-Awards-Past-Performance.json', 'RYLAQ-Awards-Past-Performance.csv', 'procurement')
      );
    }
  });

  /* ---------------------- Grants, Development & Public Funding ---------------------- */
  R.modules.register({
    id: 'grants',
    group: 'procurement',
    order: 42,
    icon: 'coin',
    title: 'Grants, Development & Public Funding',
    short: 'Grants & Public Funding',
    description: 'US federal assistance awards (live) and official development-finance, EU and national funding portals (link-out).',
    warnings: ['Grant eligibility and funding decisions are controlled by official funders. RYLAQ does not provide grant application advice.'],
    render(ctx) {
      const kw = ctx.session ? (ctx.chosen.concept ? 'infrastructure' : ctx.primary ? (ctx.primary.data && ctx.primary.data.name) || ctx.primary.title : ctx.q) : '';
      const byRecipient = ctx.session && !!ctx.primary;
      return h(
        'div',
        null,
        ctx.session ? ui.section('US federal grants & assistance (live, USAspending)', { icon: 'chart', desc: 'Past assistance awards; call deadlines are published by funders, not here.' }, ui.taskPanel(T.usaAwards(byRecipient ? { recipient: kw, kind: 'grants' } : { keyword: kw, kind: 'grants' }), { auto: ctx.type === 'grant', render: awardsResults })) : ui.needSession('grant records'),
        ui.section('EU, development-bank & bilateral funding (link-out)', { icon: 'globe' }, ui.linkouts([...R.directories.procurement.filter((e) => e.grant), ...R.directories.devBanks.filter((e) => e.grant)], null, { compact: true })),
        ui.exportBar('RYLAQ-Grants-PPP-results.json', 'RYLAQ-Grants-PPP-results.csv', 'procurement')
      );
    }
  });

  /* ---------------------- PPP, Concessions & Infrastructure ---------------------- */
  R.modules.register({
    id: 'ppp',
    group: 'procurement',
    order: 43,
    icon: 'building',
    title: 'PPP, Concessions & Infrastructure Projects',
    short: 'PPP & Concessions',
    description: 'Public PPP, concession and infrastructure-project resources with the risk domains typically allocated in these structures.',
    warnings: ['PPP/concession structures are legally complex. RYLAQ does not advise on project bankability, concession terms, or risk allocation.'],
    render(ctx) {
      const domains = ['construction', 'political', 'regulatory', 'infrastructure', 'catastrophe', 'esg', 'currency-control', 'expropriation'].map((id) => R.taxonomy.global.find((d) => d.id === id)).filter(Boolean);
      return h(
        'div',
        null,
        ui.section('PPP & infrastructure databases (link-out)', { icon: 'link' }, ui.dir('ppp', null, { compact: true }), ui.linkouts(R.directories.devBanks.slice(0, 7), null, { compact: true })),
        ui.section('Risk domains commonly allocated in PPPs', { icon: 'layers', desc: 'Construction, political, regulatory, availability, demand, force majeure and ESG risks. Opens the Global Risk Universe for public evidence.' }, h('div', { class: 'rq-row' }, ...domains.map((d) => ui.button(d.name, () => R.shell.search(d.name), { cls: 'rq-btn-sm' })))),
        ctx.session ? ui.section('US regulatory documents on PPPs (live)', { icon: 'search' }, ui.taskPanel(T.frSearch('public-private partnership', { perPage: 6 }), { auto: ctx.type === 'ppp', limit: 6 })) : null,
        ctx.session ? ui.section('US federal awards mentioning concessions/PPPs (live)', { icon: 'chart' }, ui.taskPanel(T.usaAwards({ keyword: ctx.type === 'ppp' && ctx.chosen.concept ? 'public-private partnership' : ctx.q, kind: 'contracts' }), { auto: ctx.type === 'ppp', render: awardsResults })) : null,
        ui.exportBar('RYLAQ-Grants-PPP-results.json', 'RYLAQ-Grants-PPP-results.csv', 'procurement')
      );
    }
  });
})(window.RYLAQWorkspace);
