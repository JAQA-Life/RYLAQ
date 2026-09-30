/*
 * relationshipExplorer.js — MODULE 24: Relationship Explorer.
 *
 * A lazy, accessible tree (no graph library). Each edge carries provenance
 * and a confidence label. Edges reported directly by an authoritative source
 * (e.g. GLEIF Level 2) are "reported"; name-based links are "derived"
 * (dashed) and never shown as Exact. Navigation history (breadcrumbs,
 * back/forward) lives in memory only.
 */
(function (R) {
  'use strict';
  const { h, icon, extLink } = R.util;
  const ui = R.ui;
  const T = R.T;

  const ex = { root: null, history: [], index: -1, open: new Set() };
  R.events.on('session:cleared', () => Object.assign(ex, { root: null, history: [], index: -1, open: new Set() }));
  R.events.on('session:started', () => Object.assign(ex, { root: null, history: [], index: -1, open: new Set() }));

  R.explorer = {
    focus(record) {
      ex.history = ex.history.slice(0, ex.index + 1);
      ex.history.push(record);
      ex.index = ex.history.length - 1;
      ex.root = record;
      ex.open = new Set();
    }
  };

  /** Edge groups for a record: [{ id, relation, def, confidence, derived, linkout }] */
  function edgesFor(r) {
    const out = [];
    const name = (r.data && r.data.name) || r.title;
    if (r.kind === 'legal-entity' && r.ids.lei) {
      out.push({ id: 'dp', relation: 'Direct parent', def: T.gleifParent(r.ids.lei, 'direct'), confidence: 'Exact', note: 'Reported to GLEIF (Level 2)' });
      out.push({ id: 'up', relation: 'Ultimate parent', def: T.gleifParent(r.ids.lei, 'ultimate'), confidence: 'Exact', note: 'Reported to GLEIF (Level 2)' });
      out.push({ id: 'ch', relation: 'Direct children', def: T.gleifChildren(r.ids.lei), confidence: 'Exact', note: 'Reported to GLEIF (Level 2)' });
    }
    const iso2 = r.ids.country || (r.data && r.data.country);
    const c = iso2 ? R.geo.byIso2(String(iso2).slice(0, 2)) : null;
    if (c) out.push({ id: 'cty', relation: 'Jurisdiction → country context', def: T.wbCountry(c.iso3), confidence: 'Likely', derived: true, note: 'Derived from the entity’s jurisdiction/address' });
    if (r.kind === 'legal-entity' || r.kind === 'filer' || r.kind === 'unresolved-name') {
      if (r.ids.cik || (R.state.session && R.state.session.resolved.cik)) out.push({ id: 'sec', relation: 'SEC filer & filing events', def: T.secSubs(r.ids.cik || R.state.session.resolved.cik), confidence: 'Likely', derived: !r.ids.cik, note: 'Via Wikidata CIK claim or direct CIK' });
      out.push({ id: 'aw', relation: 'US federal awards (recipient name)', def: T.usaAwards({ recipient: name, kind: 'contracts' }), confidence: 'Possible', derived: true, note: 'Name match — verify UEI' });
      out.push({ id: 'rc', relation: 'Product recalls (title match)', def: T.cpscSearch(name), confidence: 'Possible', derived: true, note: 'Name match in recall titles' });
      out.push({ id: 'kv', relation: 'KEV vendor/product mentions', def: T.kevMentions(name.split(/\s+/)[0]), confidence: 'Possible', derived: true, note: 'Product-level; not deployment' });
      out.push({ id: 'ct', relation: 'Court records (name match)', def: T.courts(name, 'r'), confidence: 'Possible', derived: true, note: 'Text match — manual review' });
      out.push({ id: 'sa', relation: 'Sanctions & debarment', linkout: 'sanctions', confidence: 'Unresolved', note: 'Link-out only — no hit ≠ clear' });
      out.push({ id: 'ir', relation: 'Insurance regulators & ratings', linkout: 'insuranceRegulators', confidence: 'Unresolved', note: 'Link-out only' });
    }
    if (r.kind === 'country') {
      const iso3 = r.ids.iso3;
      out.push({ id: 'lpi', relation: 'Logistics performance', def: T.wbInd(iso3, 'lpi'), confidence: 'Exact' });
      out.push({ id: 'wgi', relation: 'Political stability (WGI)', def: T.wbInd(iso3, 'wgiPV'), confidence: 'Exact' });
      if (r.data.lat) out.push({ id: 'eq', relation: 'Earthquakes near capital', def: T.quakes(r.data.lat, r.data.lon, 500, 30), confidence: 'Likely', derived: true, note: 'Capital used as reference point' });
      out.push({ id: 'pp', relation: 'Procurement portals', linkout: 'procurement', confidence: 'Unresolved' });
    }
    if (r.kind === 'vulnerability' && r.data && r.data.vendor) out.push({ id: 'vp', relation: 'Other KEV entries for vendor', def: T.kevMentions(r.data.vendor), confidence: 'Likely', derived: true });
    return out;
  }

  function subjectRecord(ctx) {
    if (ex.root) return ex.root;
    if (ctx.primary) return ctx.primary;
    const s = ctx.session;
    if (s && s.chosen.type === 'country') {
      const t = R.tasks.get(T.wbCountry(s.chosen.iso3).key);
      if (t && t.records.length) return t.records[0];
    }
    if (s && s.chosen.type === 'cve') {
      const t = R.tasks.get(T.kevCve(s.chosen.cve).key);
      if (t && t.records.length) return t.records[0];
    }
    return null;
  }

  function nodeView(e, parentRec, depth) {
    const key = (parentRec.uid || parentRec.title) + ':' + e.id;
    const open = ex.open.has(key);
    const toggle = h('button', { type: 'button', class: 'rq-tree-toggle', 'aria-expanded': String(open), onclick: () => {
      if (open) ex.open.delete(key);
      else {
        ex.open.add(key);
        if (e.def) {
          R.tasks.ensure(e.def);
          R.tasks.start(e.def.key);
        }
      }
      R.shell.refresh();
    } }, icon('chevron', 'rq-icon-xs' + (open ? ' is-open' : '')), h('span', null, e.relation));
    const meta = h('span', { class: 'rq-tree-meta' }, ui.confidence(e.confidence), e.derived ? ui.badge('Derived link', 'neutral') : e.linkout ? ui.badge('Link-out', 'neutral') : ui.badge('Reported by source', 'ok'), e.note ? h('span', { class: 'rq-muted' }, e.note) : null);
    const li = h('li', { class: 'rq-tree-node' + (e.derived ? ' is-derived' : ''), role: 'treeitem', 'aria-expanded': String(open), 'aria-level': String(depth) }, h('div', { class: 'rq-tree-row' }, toggle, meta));
    if (open) {
      if (e.linkout) li.appendChild(ui.dir(e.linkout, null, { compact: true }));
      else if (e.def) {
        const t = R.tasks.get(e.def.key);
        if (!t || t.status === 'loading' || t.status === 'idle') li.appendChild(h('p', { class: 'rq-muted' }, 'Loading…'));
        else if (t.status === 'done')
          li.appendChild(
            h('ul', { role: 'group' }, ...t.records.slice(0, 12).map((r) =>
              h('li', { class: 'rq-tree-leaf', role: 'treeitem', 'aria-level': String(depth + 1) }, h('span', { class: 'rq-tree-leaf-title' }, r.title), ui.confidence(e.derived ? e.confidence : r.prov.confidence || e.confidence), h('span', { class: 'rq-muted' }, r.prov.sourceName), h('span', { class: 'rq-row rq-row-tight' }, ui.button('Details', () => R.shell.openDetail(r), { cls: 'rq-btn-xs' }), r.kind === 'legal-entity' || r.kind === 'country' ? ui.button('Explore from here', () => {
                R.explorer.focus(r);
                R.shell.refresh();
              }, { cls: 'rq-btn-xs', icon: 'tree' }) : null, r.prov.url ? extLink(r.prov.url, 'Source') : null))
            ))
          );
        else if (t.status === 'empty') li.appendChild(h('p', { class: 'rq-muted' }, (t.meta && t.meta.note) || 'No records reported by source.'));
        else if (t.status === 'linkout') li.appendChild(h('p', { class: 'rq-muted' }, R.net.errorText('linkout')));
        else li.appendChild(h('p', { class: 'rq-error' }, R.net.errorText(t.errorKind)));
      }
    }
    return li;
  }

  const FLOWS = [
    ['Insurance flow', ['Insurer', 'Regulator', 'Financial filings', 'Rating link-out', 'Insurance lines', 'Catastrophe exposure context', 'Reinsurer link-out', 'Broker link-out', 'Captive/ILS vehicle', 'Claims/product signals', 'Procurement opportunities'], ['org360', 'insurance', 'filings', 'insuranceStrength', 'insurance', 'climate', 'insuranceStrength', 'insurance', 'insuranceStrength', 'supplyChain', 'procurement']],
    ['Reinsurance flow', ['Reinsurer', 'Retrocessionaire link-out', 'Treaty/facultative public context', 'Cat bond/ILS link-out', 'Rating link-out', 'Regulatory link-out', 'Event losses link-out', 'Capacity market report link-out'], ['org360', 'insurance', 'insurance', 'insuranceStrength', 'insuranceStrength', 'insurance', 'climate', 'insurance']],
    ['Procurement flow', ['Tender', 'Buyer', 'CPV/UNSPSC/NAICS', 'Supplier', 'Award', 'Contract modification', 'Subcontract (where public)', 'Sanctions', 'Litigation', 'Financial filings', 'Recalls', 'Cyber', 'Country risk', 'Port/route risk', 'Insurance-related procurement'], ['procurement', 'procurement', 'procurement', 'org360', 'awards', 'awards', 'awards', 'sanctions', 'credit', 'filings', 'supplyChain', 'cyber', 'marketMacro', 'climate', 'insurance']],
    ['Finance flow', ['Counterparty', 'LEI/registry', 'Filings', 'Insolvency/liens/litigation', 'Sanctions/enforcement', 'Ratings link-out', 'Market/macro context', 'Trade exposure', 'Procurement awards', 'Insurance counterparty links'], ['org360', 'org360', 'filings', 'credit', 'sanctions', 'fragility', 'marketMacro', 'trade', 'awards', 'insuranceStrength']]
  ];

  R.modules.register({
    id: 'relationships',
    group: 'evidence',
    order: 50,
    icon: 'tree',
    title: 'Relationship Explorer',
    short: 'Relationship Explorer',
    description: 'Move through corporate families, jurisdictions, filings, awards, recalls, vulnerabilities, court records and link-outs as an expandable tree. Every node carries provenance and confidence.',
    warnings: ['Derived links (dashed) are name- or context-based and require manual review. “Possible” is never shown as “Exact”.'],
    liveRefresh: true,
    render(ctx) {
      const root = subjectRecord(ctx);
      const flows = ui.section('Canonical evidence flows', { icon: 'layers', desc: 'Each step opens the module where that evidence lives.' }, ...FLOWS.map(([name, steps, mods]) => h('div', { class: 'rq-flow-steps' }, h('h4', { class: 'rq-h4' }, name), h('ol', null, ...steps.map((s, i) => h('li', null, h('button', { type: 'button', class: 'rq-link-btn', onclick: () => R.shell.go(mods[i], { focus: true }) }, s)))))));
      if (!root) return h('div', null, ctx.session ? R.entityGate(ctx, 'relationships') || ui.warning('No explorable subject yet. Resolve an entity, country or CVE first.', 'info') : ui.needSession('relationships'), flows);
      if (!ex.history.length) R.explorer.focus(root);
      const edges = edgesFor(root);
      const crumbs = h('nav', { class: 'rq-crumbs', 'aria-label': 'Exploration trail' }, h('ol', null, ...ex.history.map((r, i) => h('li', null, i === ex.index ? h('span', { 'aria-current': 'location' }, r.title) : h('button', { type: 'button', class: 'rq-link-btn', onclick: () => {
        ex.index = i;
        ex.root = ex.history[i];
        R.shell.refresh();
      } }, r.title)))));
      const nav = h('div', { class: 'rq-row' }, ui.button('Back', () => {
        if (ex.index > 0) {
          ex.index -= 1;
          ex.root = ex.history[ex.index];
          R.shell.refresh();
        }
      }, { cls: 'rq-btn-sm', disabled: ex.index <= 0 }), ui.button('Forward', () => {
        if (ex.index < ex.history.length - 1) {
          ex.index += 1;
          ex.root = ex.history[ex.index];
          R.shell.refresh();
        }
      }, { cls: 'rq-btn-sm', disabled: ex.index >= ex.history.length - 1 }));
      const edgeRows = [];
      edges.forEach((e) => {
        const t = e.def && R.tasks.get(e.def.key);
        (t && t.records ? t.records.slice(0, 12) : []).forEach((r) => edgeRows.push([root.title, e.relation, r.title, e.derived ? e.confidence : r.prov.confidence || e.confidence, e.derived ? 'Derived' : 'Reported', r.prov.sourceName]));
      });
      return h(
        'div',
        null,
        crumbs,
        nav,
        ui.section('Tree', { icon: 'tree', desc: 'Expand a relation to load it (lazy, user-triggered).' }, h('div', { class: 'rq-tree-root' }, h('div', { class: 'rq-tree-rootnode' }, icon('building', 'rq-icon-sm'), h('strong', null, root.title), ui.confidence(root.prov.confidence), ui.button('Details', () => R.shell.openDetail(root), { cls: 'rq-btn-xs' })), h('ul', { class: 'rq-tree', role: 'tree', 'aria-label': 'Relationships of ' + root.title }, ...edges.map((e) => nodeView(e, root, 1))))),
        ui.section('Relationship table', { icon: 'list', desc: 'Loaded relations only. Text alternative to the tree.' }, edgeRows.length ? h('div', { class: 'rq-table-wrap', tabindex: '0', role: 'region', 'aria-label': 'Relationship table' }, h('table', { class: 'rq-table' }, h('thead', null, h('tr', null, ...['From', 'Relation', 'To', 'Confidence', 'Link type', 'Source'].map((c) => h('th', { scope: 'col' }, c)))), h('tbody', null, ...edgeRows.map((row) => h('tr', null, h('th', { scope: 'row' }, row[0]), ...row.slice(1).map((c) => h('td', null, c))))))) : h('p', { class: 'rq-muted' }, 'Expand relations above to populate this table.')),
        flows
      );
    }
  });
})(window.RYLAQWorkspace);
