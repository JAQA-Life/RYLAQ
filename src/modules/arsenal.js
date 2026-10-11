/*
 * arsenal.js — JAQA Arsenal: a curated, searchable registry of open-source
 * security, supply-chain and medical/health repositories.
 *
 * Clean-room and link-out only: the data comes from config/arsenal.json
 * (generated from config/arsenal-catalog.mjs). JAQA does not run, embed, bundle
 * or call any listed project — every item opens its GitHub page in a new tab.
 *
 * Privacy: the filter box runs entirely in memory. The search term is never
 * sent anywhere, never written to the URL, and never logged (no console.log).
 * Clear Session resets every Arsenal filter.
 * JAQA™ is a trademark of JAQA. © JAQA™. Licensed under AGPL-3.0-or-later.
 */
(function (R) {
  'use strict';
  const { h, extLink } = R.util;
  const ui = R.ui;

  const cfg = () => R.config.arsenal || { totals: {}, domains: [] };
  const domainOf = (id) => cfg().domains.find((d) => d.id === id) || null;

  // Per-domain view state (filter text + active category). Wiped on Clear Session.
  const state = {};
  const st = (id) => (state[id] = state[id] || { q: '', cat: 'all' });
  R.events.on('session:cleared', () => {
    for (const k of Object.keys(state)) delete state[k];
  });

  const matches = (e, q) => !q || e.repo.toLowerCase().includes(q) || e.desc.toLowerCase().includes(q);

  function repoCard(e) {
    const owner = e.repo.split('/')[0];
    const liveChip = e.liveIntel
      ? h('button', { type: 'button', class: 'rq-badge rq-tone-ok rq-arsenal-live', title: 'Served live inside the JAQA app', onclick: () => R.shell.go('intel', { focus: true }) }, 'Live in app')
      : null;
    return h(
      'li',
      { class: 'rq-arsenal-item' },
      h('div', { class: 'rq-arsenal-head' }, extLink(e.url, e.repo, { cls: 'rq-arsenal-repo' }), ui.badge(owner, 'neutral', 'GitHub owner'), liveChip),
      h('p', { class: 'rq-arsenal-desc' }, e.desc)
    );
  }

  function render(domainId) {
    const d = domainOf(domainId);
    if (!d) return ui.emptyModule('The Arsenal catalogue is not available in this build.');
    const s = st(domainId);
    const q = s.q.trim().toLowerCase();

    // Category filter options (with counts) + the live result set.
    const cats = [['all', 'All categories (' + d.count + ')'], ...d.categories.map((c) => [c.id, c.label + ' (' + c.count + ')'])];
    const visibleCats = d.categories.filter((c) => s.cat === 'all' || c.id === s.cat);
    let shown = 0;
    const blocks = visibleCats
      .map((c) => {
        const hits = c.entries.filter((e) => matches(e, q));
        if (!hits.length) return null;
        shown += hits.length;
        return h(
          'section',
          { class: 'rq-arsenal-cat', 'aria-label': c.label },
          h('div', { class: 'rq-arsenal-cat-head' }, h('h3', { class: 'rq-h4' }, c.label), h('span', { class: 'rq-mono rq-muted' }, hits.length + (hits.length === c.count ? '' : ' / ' + c.count))),
          h('ul', { class: 'rq-arsenal-grid' }, ...hits.map(repoCard))
        );
      })
      .filter(Boolean);

    const controls = h(
      'div',
      { class: 'rq-strip', role: 'group', 'aria-label': d.label + ' Arsenal filters' },
      ui.input('Filter', s.q, (v) => {
        s.q = v;
        R.shell.go('arsenal-' + domainId);
      }, { key: 'arsenal-q-' + domainId, placeholder: 'repo or keyword…', cls: 'rq-field-inline', maxlength: 60 }),
      ui.select('Category', cats, s.cat, (v) => {
        s.cat = v;
        R.shell.go('arsenal-' + domainId);
      }, { key: 'arsenal-cat-' + domainId, cls: 'rq-field-inline' }),
      h('span', { class: 'rq-strip-spacer' }),
      h('span', { class: 'rq-strip-item rq-mono' }, h('span', { class: 'rq-strip-k' }, 'SHOWING'), String(shown)),
      h('span', { class: 'rq-strip-item rq-mono' }, h('span', { class: 'rq-strip-k' }, 'IN DOMAIN'), String(d.count))
    );

    return h(
      'div',
      { class: 'rq-stack' },
      controls,
      blocks.length ? h('div', { class: 'rq-arsenal' }, ...blocks) : ui.warning('No repositories match “' + s.q + '” in this view. Clear the filter or pick another category.', 'info'),
      h('p', { class: 'rq-fineprint' }, 'Curated reference only. Listing a project is not endorsement, certification or a security guarantee; each project carries its own licence and terms. Links open GitHub directly — JAQA does not run, bundle or call these tools, and your filter text stays in your browser. Open-source licences for what JAQA itself ships are on the ', h('a', { href: '/licenses/' }, 'Licences'), ' page.')
    );
  }

  const DOMAIN_META = {
    security: { order: 1, icon: 'shield', title: 'Arsenal · Security', short: 'Arsenal · Security' },
    'supply-chain': { order: 2, icon: 'layers', title: 'Arsenal · Supply chain', short: 'Arsenal · Supply chain' },
    medical: { order: 3, icon: 'flask', title: 'Arsenal · Medical', short: 'Arsenal · Medical' }
  };

  for (const d of cfg().domains) {
    const meta = DOMAIN_META[d.id] || { order: 9, icon: 'list', title: 'Arsenal · ' + d.label, short: d.label };
    R.modules.register({
      id: 'arsenal-' + d.id,
      group: 'arsenal',
      order: meta.order,
      icon: meta.icon,
      title: meta.title,
      short: meta.short,
      description: d.blurb,
      warnings: [
        'A curated catalogue of third-party open-source projects for reference. JAQA is not affiliated with them, does not run or bundle them, and listing is not endorsement or a security assurance.',
        'Dual-use security tooling is for authorised testing, defence, research and education only. You are responsible for lawful, authorised use under each project’s licence.'
      ],
      liveRefresh: false,
      render: () => render(d.id)
    });
  }
})(window.JAQAWorkspace);
