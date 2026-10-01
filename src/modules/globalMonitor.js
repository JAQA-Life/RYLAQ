/*
 * globalMonitor.js — Global Monitor: a live dashboard of official public
 * feeds (headlines + links), an event map, "countries in the headlines" and an
 * FX reference board. Feature set inspired by WorldMonitor's news/intel
 * dashboard; clean-room JAQA code (no WorldMonitor code, AGPL respected).
 *
 * Feeds are fetched by the JAQA server from an allowlist of official
 * publishers and verified by scripts/verify-monitor.mjs; the browser only calls
 * the same-origin /api/jaqa/monitor endpoint with a fixed feed id. Loading is
 * user-initiated; feed tasks survive new searches and Clear Session wipes them.
 * JAQA™ is a trademark of JAQA. © JAQA™. All rights reserved.
 */
(function (R) {
  'use strict';
  const { h, extLink, fmt } = R.util;
  const ui = R.ui;
  const C = R.clients;

  const cfg = () => R.config.monitor || { feeds: [], categories: [] };
  const st = { category: 'all', active: false };
  R.events.on('session:cleared', () => {
    st.active = false;
    st.category = 'all';
  });

  const FX = ['USD', 'GBP', 'JPY', 'CHF', 'CNY', 'INR'];
  const feedDef = (f) => ({ key: 'feed:monitor:' + f.id, sourceId: 'jaqaMonitor', label: f.name + ' · ' + f.publisher, run: () => C.monitor.feed(f, { persistent: true }) });
  const fxDef = (ccy) => ({ key: 'feed:ecb:' + ccy, sourceId: 'ecb', label: 'EUR/' + ccy + ' reference · ECB', run: () => C.ecb.exr(ccy, 30, { persistent: true }) });
  const visibleFeeds = () => cfg().feeds.filter((f) => st.category === 'all' || f.category === st.category);

  function activate() {
    st.active = true;
    const keys = visibleFeeds().map((f) => R.tasks.ensure(feedDef(f)).key).concat(FX.map((c) => R.tasks.ensure(fxDef(c)).key));
    R.util.announce('Loading official feeds through the JAQA server. Fixed feeds only; no search terms are sent.');
    R.tasks.runAll(keys);
    R.shell.go('monitor');
  }

  /** All loaded monitor headline records (any category). */
  function loaded() {
    const out = [];
    for (const f of cfg().feeds) {
      const t = R.tasks.get('feed:monitor:' + f.id);
      if (t && t.records) out.push(...t.records);
    }
    return out;
  }

  // Countries named in loaded headlines. A mention count, not a risk score.
  let countryRx = null;
  function hotspots(records) {
    if (!countryRx) countryRx = R.geo.countries.filter((c) => c.name.length > 3).map((c) => [c, new RegExp('\\b' + c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i')]);
    const counts = new Map();
    for (const r of records) for (const [c, rx] of countryRx) if (rx.test(r.title)) counts.set(c, (counts.get(c) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  }

  function headlineList(recs) {
    return h(
      'ul',
      { class: 'rq-wire' },
      ...recs.slice(0, 12).map((r) =>
        h(
          'li',
          { class: 'rq-wire-row rq-mon-row' },
          h('span', { class: 'rq-wire-time rq-mono', title: 'Published (UTC)' }, r.data.published ? r.data.published.slice(5, 16).replace('T', ' ') : '—'),
          h('span', { class: 'rq-mon-title' }, extLink(r.links[0].href, r.title)),
          Number.isFinite(r.data.lat) ? h('a', { class: 'rq-wire-locate', href: R.globe3d.url({ lat: r.data.lat, lon: r.data.lon, alt: 400000 }), title: 'Open this location in the 3D globe', 'aria-label': 'Open in 3D globe: ' + r.title }, R.util.icon('globe', 'rq-icon-xs')) : h('span')
        )
      )
    );
  }

  let mapGlobe = null;
  function eventMap(records) {
    const pts = records.filter((r) => Number.isFinite(r.data.lat)).map((r) => ({ kind: 'signal', lat: r.data.lat, lon: r.data.lon, label: r.title, record: r }));
    const host = h('div', { class: 'rq-local-globe' });
    setTimeout(() => {
      if (!host.isConnected) return;
      if (mapGlobe) mapGlobe.destroy();
      mapGlobe = R.situation.mountGlobe(host, pts, pts[0] ? { lat: pts[0].lat, lon: pts[0].lon } : { lat: 20, lon: 10 });
    }, 0);
    return h('div', null, host, h('p', { class: 'rq-fineprint' }, pts.length + ' event(s) with publisher-supplied coordinates. Select a marker for details, or ', R.globe3d.link('open the 3D globe', { lat: 20, lon: 10, alt: 18000000 }, 'rq-link-inline'), '.'));
  }

  R.modules.register({
    id: 'monitor',
    group: 'risk',
    order: 2,
    icon: 'chart',
    title: 'Global Monitor',
    short: 'Global Monitor',
    description: 'Live headlines from official publishers (UN, WHO, GDACS, NASA, NOAA, CISA, central banks, travel advisories), an event map, the countries named in the news and an FX board.',
    warnings: [
      'Headlines from official publishers, shown as published: not verified, ranked or summarized by JAQA. Read the source before relying on anything. No hit ≠ clear.',
      '“Countries in the headlines” counts name mentions only. It is not a risk, stability or exposure score.'
    ],
    liveRefresh: true,
    render() {
      const c = cfg();
      if (!c.feeds.length) {
        return h(
          'div',
          null,
          ui.warning('No monitor feed has been verified for this deployment yet, so nothing is loaded live. The official publishers are linked below.', 'info'),
          ui.section('Official publishers', { icon: 'link', desc: 'A feed is served only after scripts/verify-monitor.mjs has fetched and parsed it successfully.' }, h('ul', { class: 'rq-list' }, ...(c.candidates || []).map((f) => h('li', null, extLink(f.home, f.publisher + ' — ' + f.name)))))
        );
      }
      const live = R.runtime.isLive('jaqaMonitor');
      const cats = [['all', 'All categories'], ...c.categories.filter(([id]) => c.feeds.some((f) => f.category === id))];
      const head = h(
        'div',
        { class: 'rq-strip', role: 'group', 'aria-label': 'Monitor status' },
        h('span', { class: 'rq-strip-item rq-mono' }, h('span', { class: 'rq-strip-k' }, 'FEEDS'), String(c.feeds.length)),
        h('span', { class: 'rq-strip-item rq-mono' }, h('span', { class: 'rq-strip-k' }, 'VERIFIED'), (c.verifiedAt || '').slice(0, 10) || '—'),
        h('span', { class: 'rq-strip-item rq-mono' }, h('span', { class: 'rq-strip-k' }, 'STATUS'), h('span', { class: st.active ? 'rq-ok' : 'rq-warn-t' }, st.active ? 'ACTIVE' : 'STANDBY')),
        h('span', { class: 'rq-strip-spacer' }),
        ui.select('Category', cats, st.category, (v) => {
          st.category = v;
          if (st.active) activate();
          else R.shell.go('monitor');
        }, { key: 'monitor-category', cls: 'rq-field-inline' }),
        ui.button(st.active ? 'Refresh' : 'Load monitor feeds', activate, { variant: 'primary', icon: st.active ? 'refresh' : 'download', cls: 'rq-btn-sm' })
      );
      if (!live) {
        return h('div', null, head, ui.warning('The JAQA server is not available here (static-only hosting), so feeds cannot load. Open the publishers directly:', 'amber'), h('ul', { class: 'rq-list' }, ...c.feeds.map((f) => h('li', null, extLink(f.home, f.publisher + ' — ' + f.name)))));
      }
      if (!st.active) {
        return h('div', null, head, h('div', { class: 'rq-hero' }, h('h3', { class: 'rq-hero-title' }, 'Monitor on standby'), h('p', null, 'Loading asks the JAQA server for the latest headlines from ' + visibleFeeds().length + ' official feed(s). Your searches are never sent. The server caches each feed for 10 minutes.'), ui.button('Load monitor feeds', activate, { variant: 'primary', icon: 'download' })));
      }
      const recs = loaded();
      const hs = hotspots(recs);
      const feedsPanels = visibleFeeds().map((f) =>
        h('section', { class: 'rq-panel', 'aria-label': f.name }, h('div', { class: 'rq-panel-head' }, h('span', { class: 'rq-panel-title' }, f.name), h('span', { class: 'rq-panel-meta' }, f.publisher)), h('div', { class: 'rq-panel-body' }, ui.taskPanel(feedDef(f), { auto: true, compact: true, noHitWarning: false, render: headlineList, linkout: { href: f.home, label: 'Open ' + f.publisher } })))
      );
      return h(
        'div',
        { class: 'rq-stack' },
        head,
        h(
          'div',
          { class: 'rq-mon-grid' },
          h('section', { class: 'rq-panel rq-mon-map', 'aria-label': 'Event map' }, h('div', { class: 'rq-panel-head' }, h('span', { class: 'rq-panel-title' }, 'Event map'), h('span', { class: 'rq-panel-meta' }, 'publisher coordinates')), h('div', { class: 'rq-panel-body' }, eventMap(recs))),
          h(
            'section',
            { class: 'rq-panel', 'aria-label': 'Countries in the headlines' },
            h('div', { class: 'rq-panel-head' }, h('span', { class: 'rq-panel-title' }, 'Countries in the headlines'), h('span', { class: 'rq-panel-meta' }, 'mentions, not a score')),
            h(
              'div',
              { class: 'rq-panel-body' },
              hs.length
                ? h('ol', { class: 'rq-mon-hot' }, ...hs.map(([co, n]) => h('li', null, h('button', { type: 'button', class: 'rq-link-btn', onclick: () => R.shell.search(co.name), title: 'Investigate ' + co.name + ' in JAQA' }, co.name), h('span', { class: 'rq-mono rq-muted' }, ' ' + n))))
                : h('p', { class: 'rq-muted' }, 'No country names found in the loaded headlines yet.'),
              h('p', { class: 'rq-fineprint' }, 'Exact country-name matches in headline text only; abbreviations and demonyms are missed.')
            )
          ),
          h(
            'section',
            { class: 'rq-panel', 'aria-label': 'FX reference board' },
            h('div', { class: 'rq-panel-head' }, h('span', { class: 'rq-panel-title' }, 'FX reference board'), h('span', { class: 'rq-panel-meta' }, 'ECB · EUR base')),
            h(
              'div',
              { class: 'rq-panel-body rq-mon-fx' },
              ...FX.map((ccy) => ui.taskPanel(fxDef(ccy), { auto: true, compact: true, render: (rs) => h('div', { class: 'rq-fx' }, h('div', { class: 'rq-mono rq-muted' }, 'EUR/' + ccy), h('div', { class: 'rq-fx-val rq-mono' }, (rs[0].fields[0] || [])[1] || '—'), h('button', { type: 'button', class: 'rq-link-btn', onclick: () => R.shell.openDetail(rs[0]) }, 'Details')) })),
              h('p', { class: 'rq-fineprint' }, 'Reference rates, not tradable prices. Equity, commodity and crypto prices are not included: no keyless official source has been verified.')
            )
          ),
          ...feedsPanels
        )
      );
    }
  });
})(window.JAQAWorkspace);
