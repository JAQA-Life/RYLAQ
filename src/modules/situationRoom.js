/*
 * situationRoom.js — Situation Room: the command-center landing view.
 *
 * DESIGN PROVENANCE: the layout language (dense multi-panel intelligence
 * grid, live wire/ticker, status strip) and the HUD language (reticle,
 * corner brackets, telemetry readouts, optic modes) are INSPIRED BY the
 * public WorldMonitor and God's Eye View projects. No code, assets, styles
 * or data were copied from either project; this is a clean-room
 * implementation built on RYLAQ's own verified sources. Neither project is
 * integrated, embedded or called (see docs/THIRD_PARTY_SOURCE_POLICY.md).
 *
 * PRIVACY: feeds use fixed, non-personal queries (no search terms), stay on
 * STANDBY until the user activates them, and are wiped by Clear Session.
 * The globe plots only records already loaded in this session.
 */
(function (R) {
  'use strict';
  const { h, icon, fmt, clear, extLink } = R.util;
  const ui = R.ui;
  const C = R.clients;

  const REG_TOPICS = [
    ['sanctions', 'Sanctions'],
    ['export controls', 'Export controls'],
    ['tariff', 'Tariffs & trade remedies'],
    ['insurance', 'Insurance'],
    ['cybersecurity', 'Cybersecurity'],
    ['procurement', 'Procurement'],
    ['climate disclosure', 'Climate disclosure']
  ];
  const st = { topic: 'sanctions', mode: 'std', layers: { quake: true, place: true, entity: true, signal: true } };
  R.events.on('session:cleared', () => Object.assign(st, { topic: 'sanctions', mode: 'std', layers: { quake: true, place: true, entity: true, signal: true } }));

  const FEEDS = {
    quakes: () => ({ key: 'feed:usgs:global7d', sourceId: 'usgs', label: 'Global seismic · USGS M4.5+ · 7 days', run: () => C.usgs.global(7, 4.5, { persistent: true }) }),
    kev: () => ({ key: 'feed:kev:recent', sourceId: 'cisaKev', label: 'Exploited vulnerabilities · CISA KEV · newest', run: () => C.kev.recent(12, { persistent: true }) }),
    reg: (topic) => ({ key: 'feed:fr:' + topic, sourceId: 'federalRegister', label: 'US regulatory wire · ' + topic, run: () => C.federalRegister.search(topic, { perPage: 10, order: 'newest', persistent: true }) }),
    fx: () => ({ key: 'feed:ecb:USD', sourceId: 'ecb', label: 'EUR/USD reference · ECB', run: () => C.ecb.exr('USD', 30, { persistent: true }) })
  };
  const feedDefs = () => [FEEDS.quakes(), FEEDS.kev(), FEEDS.reg(st.topic), FEEDS.fx()];

  function activateFeeds() {
    const keys = feedDefs().map((d) => R.tasks.ensure(d).key);
    R.util.announce('Activating public feeds. Fixed queries only; no search terms are sent.');
    R.tasks.runAll(keys);
    R.shell.refresh();
  }
  const feedsActive = () => feedDefs().some((d) => {
    const t = R.tasks.get(d.key);
    return t && t.status !== 'idle';
  });

  /* ------------------------------ markers ------------------------------ */
  function collectPoints() {
    const pts = [];
    const add = (p) => st.layers[p.kind] && isFinite(p.lat) && isFinite(p.lon) && pts.push(p);
    const tasks = [...R.tasks.feeds(), ...R.tasks.all()];
    for (const t of tasks) {
      for (const r of t.records || []) {
        const d = r.data || {};
        if (r.kind === 'earthquake' && isFinite(d.lat)) add({ kind: 'quake', lat: d.lat, lon: d.lon, weight: Math.max(0, Math.min(1, ((d.mag || 4.5) - 4.5) / 3)), label: r.title, record: r });
        else if (r.kind === 'place') add({ kind: 'place', lat: d.lat, lon: d.lon, label: 'Place · ' + r.title, record: r });
        else if (r.kind === 'country' && isFinite(d.lat)) add({ kind: 'place', lat: d.lat, lon: d.lon, label: 'Country reference · ' + r.title + (d.capital ? ' (' + d.capital + ')' : ''), record: r });
        else if (r.kind === 'forecast' && d.flags && d.flags.length) add({ kind: 'signal', lat: d.lat, lon: d.lon, label: 'Forecast threshold signal · ' + d.flags[0], record: r });
      }
    }
    const s = R.state.session;
    if (s && s.resolved && isFinite(s.resolved.lat) && s.resolved.lat !== null) {
      const name = s.primary ? s.primary.title : s.resolved.placeLabel || s.query;
      add({ kind: 'entity', lat: s.resolved.lat, lon: s.resolved.lon, label: 'Subject reference · ' + name, record: s.primary || null });
    }
    return pts;
  }

  let globe = null;
  let markerList = null;
  let hud = null;
  function refreshLive() {
    if (globe && hud && hud.isConnected) globe.setPoints(collectPoints());
    if (markerList && markerList.isConnected) renderMarkerList();
  }
  R.events.on('task:update', (t) => {
    if (t.status !== 'loading') refreshLive();
  });

  function renderMarkerList() {
    const pts = collectPoints().slice(0, 40);
    clear(markerList);
    if (!pts.length) {
      markerList.appendChild(h('p', { class: 'rq-muted rq-mono' }, 'NO MARKERS. Activate public feeds or run a search with a location, port or country.'));
      return;
    }
    markerList.appendChild(
      h(
        'table',
        { class: 'rq-table rq-table-dense' },
        h('caption', { class: 'rq-sr' }, 'Globe markers (text alternative)'),
        h('thead', null, h('tr', null, ...['Layer', 'Marker', 'Lat', 'Lon', ''].map((c) => h('th', { scope: 'col' }, c)))),
        h(
          'tbody',
          null,
          ...pts.map((p) =>
            h(
              'tr',
              null,
              h('td', null, h('span', { class: 'rq-layer-chip rq-layer-' + p.kind }, p.kind === 'quake' ? 'SEISMIC' : p.kind === 'entity' ? 'SUBJECT' : p.kind === 'signal' ? 'SIGNAL' : 'PLACE')),
              h('th', { scope: 'row' }, h('button', { type: 'button', class: 'rq-link-btn', onclick: () => (p.record ? R.shell.openDetail(p.record) : null) }, fmt.truncate(p.label, 90))),
              h('td', { class: 'rq-mono' }, Number(p.lat).toFixed(2)),
              h('td', { class: 'rq-mono' }, Number(p.lon).toFixed(2)),
              h('td', null, ui.button('Locate', () => globe && globe.focus(p.lat, p.lon), { cls: 'rq-btn-xs', aria: 'Rotate globe to ' + p.label }))
            )
          )
        )
      )
    );
  }

  /* ------------------------------ panels ------------------------------ */
  function panel(title, opts, ...children) {
    const o = opts || {};
    return h(
      'section',
      { class: 'rq-panel' + (o.cls ? ' ' + o.cls : ''), 'aria-label': title },
      h('header', { class: 'rq-panel-head' }, h('span', { class: 'rq-panel-title' }, o.live ? h('span', { class: 'rq-live-dot', 'aria-hidden': 'true' }) : null, title), o.meta ? h('span', { class: 'rq-panel-meta' }, o.meta) : null, o.actions || null),
      h('div', { class: 'rq-panel-body' }, ...children)
    );
  }

  /** Dense wire-style list for feed panels. */
  function wireList(recs, kind) {
    return h(
      'ol',
      { class: 'rq-wire' },
      ...recs.map((r) => {
        const d = r.data || {};
        const tag = kind === 'quake' ? 'M' + fmt.num(d.mag, 1) : kind === 'kev' ? (r.fields.find((f) => f[0] === 'Date added to KEV') || [])[1] || 'KEV' : kind === 'reg' ? (r.fields.find((f) => f[0] === 'Publication date') || [])[1] || 'FR' : '';
        const time = kind === 'quake' && d.time ? new Date(d.time).toISOString().slice(5, 16).replace('T', ' ') + 'Z' : '';
        return h(
          'li',
          { class: 'rq-wire-row' + (kind === 'quake' && d.mag >= 6 ? ' is-hot' : '') },
          h('span', { class: 'rq-wire-tag rq-mono' }, tag),
          h('button', { type: 'button', class: 'rq-wire-title', onclick: () => R.shell.openDetail(r) }, kind === 'quake' ? r.title.replace(/^M[\d.]+ — /, '') : r.title),
          time ? h('span', { class: 'rq-wire-time rq-mono' }, time) : null,
          kind === 'quake' && isFinite(d.lat) ? h('button', { type: 'button', class: 'rq-wire-locate', 'aria-label': 'Locate on globe: ' + r.title, onclick: () => globe && globe.focus(d.lat, d.lon) }, icon('globe', 'rq-icon-xs')) : null
        );
      })
    );
  }

  function feedPanel(def, kind, auto) {
    return ui.taskPanel(def, { auto, compact: true, noHitWarning: kind !== 'reg', render: (recs) => wireList(recs.slice(0, kind === 'quake' ? 40 : 12), kind) });
  }

  function tickerItems() {
    const items = [];
    const q = R.tasks.get('feed:usgs:global7d');
    if (q && q.records) q.records.filter((r) => r.data.mag >= 5.5).slice(0, 6).forEach((r) => items.push(['SEISMIC', r.title]));
    const k = R.tasks.get('feed:kev:recent');
    if (k && k.records) k.records.slice(0, 5).forEach((r) => items.push(['KEV', r.title]));
    const f = R.tasks.get(FEEDS.reg(st.topic).key);
    if (f && f.records) f.records.slice(0, 5).forEach((r) => items.push(['REG', r.title]));
    R.signals.collect().slice(0, 6).forEach((sg) => items.push(['SESSION', sg.text]));
    return items;
  }

  function ticker() {
    const items = tickerItems();
    const wrap = h('div', { class: 'rq-ticker', role: 'region', 'aria-label': 'Latest items wire' });
    if (!items.length) {
      wrap.appendChild(h('div', { class: 'rq-ticker-static rq-mono' }, h('span', { class: 'rq-ticker-tag' }, 'WIRE'), 'FEEDS ON STANDBY — activate public feeds or run a search to populate the wire. No hit ≠ clear.'));
      return wrap;
    }
    const line = () => items.map(([tag, text]) => h('span', { class: 'rq-ticker-item' }, h('span', { class: 'rq-ticker-tag' }, tag), fmt.truncate(text, 110)));
    wrap.appendChild(h('div', { class: 'rq-ticker-track', 'aria-hidden': 'true' }, h('div', { class: 'rq-ticker-run' }, line(), line())));
    wrap.appendChild(h('ul', { class: 'rq-sr' }, ...items.map(([tag, text]) => h('li', null, tag + ': ' + text))));
    return wrap;
  }

  /* ------------------------------ globe panel ------------------------------ */
  const MODES = [['std', 'STD'], ['nvg', 'NVG'], ['flir', 'FLIR'], ['crt', 'CRT']];
  function globePanel(ctx) {
    const view = R.state.globeView || (R.state.globeView = { lon: 20, lat: 18, zoom: 1, auto: true });
    const host = h('div', { class: 'rq-globe-host' });
    const readout = h('span', { class: 'rq-hud-readout rq-mono' }, 'CTR —');
    const vis = h('span', { class: 'rq-hud-readout rq-mono' }, 'MARKERS 0');
    hud = h(
      'div',
      { class: 'rq-hud rq-optic-' + st.mode },
      host,
      h('div', { class: 'rq-hud-reticle', 'aria-hidden': 'true' }),
      h('div', { class: 'rq-hud-scan', 'aria-hidden': 'true' }),
      h('span', { class: 'rq-hud-corner tl', 'aria-hidden': 'true' }),
      h('span', { class: 'rq-hud-corner tr', 'aria-hidden': 'true' }),
      h('span', { class: 'rq-hud-corner bl', 'aria-hidden': 'true' }),
      h('span', { class: 'rq-hud-corner br', 'aria-hidden': 'true' }),
      h('div', { class: 'rq-hud-top rq-mono', 'aria-hidden': 'true' }, h('span', null, 'OPTIC ' + (MODES.find((m) => m[0] === st.mode) || MODES[0])[1]), h('span', { class: 'rq-utc' }, R.shell.utcNow())),
      h('div', { class: 'rq-hud-bottom', 'aria-live': 'off' }, readout, vis)
    );
    if (globe) globe.destroy();
    globe = R.globe.create(host, {
      view,
      label: 'Situation Room evidence globe',
      onSelect: (p) => (p.record ? R.shell.openDetail(p.record) : R.util.announce(p.label)),
      onView: (v) => {
        readout.textContent = `CTR ${Math.abs(v.lat).toFixed(1)}°${v.lat >= 0 ? 'N' : 'S'} ${Math.abs(((v.lon + 540) % 360) - 180).toFixed(1)}°${((v.lon + 540) % 360) - 180 >= 0 ? 'E' : 'W'} · ZOOM ${v.zoom.toFixed(1)}×`;
        vis.textContent = `MARKERS ${v.visible}`;
      }
    });
    globe.setPoints(collectPoints());
    const s = ctx.session;
    if (s && s.resolved && isFinite(s.resolved.lat) && s.resolved.lat !== null && st.focusedFor !== s.id) {
      st.focusedFor = s.id;
      setTimeout(() => globe && globe.focus(s.resolved.lat, s.resolved.lon), 60);
    }
    const layerToggle = (k, label) => {
      const id = R.util.uid('ly');
      return h('label', { class: 'rq-chip-toggle', for: id }, h('input', { id, type: 'checkbox', checked: st.layers[k] ? true : null, onchange: (e) => {
        st.layers[k] = e.target.checked;
        refreshLive();
      } }), h('span', { class: 'rq-layer-chip rq-layer-' + k }, label));
    };
    const controls = h(
      'div',
      { class: 'rq-globe-controls' },
      h('div', { class: 'rq-seg', role: 'group', 'aria-label': 'Optic mode' }, ...MODES.map(([k, l]) => h('button', { type: 'button', class: 'rq-seg-btn' + (st.mode === k ? ' is-on' : ''), 'aria-pressed': st.mode === k ? 'true' : 'false', onclick: () => {
        st.mode = k;
        R.shell.refresh();
      } }, l))),
      h('div', { class: 'rq-row rq-row-tight', role: 'group', 'aria-label': 'Layers' }, layerToggle('quake', 'SEISMIC'), layerToggle('place', 'PLACES'), layerToggle('entity', 'SUBJECT'), layerToggle('signal', 'SIGNALS')),
      h(
        'div',
        { class: 'rq-row rq-row-tight' },
        ui.button(view.auto ? 'Auto-rotate on' : 'Auto-rotate off', (e) => {
          globe.setAuto(!view.auto);
          e.currentTarget.querySelector('span').textContent = view.auto ? 'Auto-rotate on' : 'Auto-rotate off';
        }, { cls: 'rq-btn-xs', icon: 'refresh' }),
        s && s.resolved && s.resolved.lat !== undefined && s.resolved.lat !== null ? ui.button('Recenter on subject', () => globe.focus(s.resolved.lat, s.resolved.lon), { cls: 'rq-btn-xs', icon: 'globe' }) : null
      )
    );
    return panel('Evidence globe', { cls: 'rq-panel-globe', live: feedsActive(), meta: 'Natural Earth outlines · no tiles' }, hud, controls, h('p', { class: 'rq-fineprint' }, 'Drag or use arrow keys to rotate · wheel or +/− to zoom · Enter opens the marker nearest the reticle. Markers come only from records loaded in this session. Event positions are not facility, loss or exposure data.'));
  }

  /** Compact globe for other modules (e.g. Climate & Catastrophe). */
  R.situation = {
    mountGlobe(host, points, center) {
      const g = R.globe.create(host, { view: { lon: center ? center.lon : 0, lat: center ? center.lat : 20, zoom: 1.6, auto: false }, compact: true, label: 'Local event globe', onSelect: (p) => p.record && R.shell.openDetail(p.record) });
      g.setPoints(points);
      return g;
    },
    collectPoints,
    activateFeeds
  };

  /* ------------------------------ module ------------------------------ */
  R.modules.register({
    id: 'situation',
    group: 'risk',
    order: 0,
    icon: 'globe',
    title: 'Situation Room',
    short: 'Situation Room',
    description: 'Command-center view: evidence globe, live public wires and your session’s signals in one screen.',
    warnings: ['Situational awareness from public sources only — not a real-time control tower, not a risk score, and no hit ≠ clear.'],
    render(ctx) {
      const s = ctx.session;
      const active = feedsActive();
      const live = R.sources.list.filter((x) => R.runtime.mode(x.id) === 'live').length;
      const sig = R.signals.collect();
      const strip = h(
        'div',
        { class: 'rq-strip', role: 'group', 'aria-label': 'Situation status' },
        h('span', { class: 'rq-strip-item rq-mono' }, h('span', { class: 'rq-strip-k' }, 'UTC'), h('span', { class: 'rq-utc' }, R.shell.utcNow())),
        h('span', { class: 'rq-strip-item rq-mono' }, h('span', { class: 'rq-strip-k' }, 'FEEDS'), h('span', { class: active ? 'rq-ok' : 'rq-warn-t' }, active ? 'ACTIVE' : 'STANDBY')),
        h('span', { class: 'rq-strip-item rq-mono' }, h('span', { class: 'rq-strip-k' }, 'LIVE SOURCES'), String(live)),
        h('span', { class: 'rq-strip-item rq-mono' }, h('span', { class: 'rq-strip-k' }, 'SUBJECT'), s ? fmt.truncate(s.primary ? s.primary.title : s.resolved.countryName || s.resolved.placeLabel || s.query, 40) : 'NONE'),
        h('span', { class: 'rq-strip-item rq-mono' }, h('span', { class: 'rq-strip-k' }, 'SESSION SIGNALS'), String(sig.length)),
        h('span', { class: 'rq-strip-spacer' }),
        active
          ? ui.button('Refresh feeds', () => {
              feedDefs().forEach((d) => {
                const t = R.tasks.get(d.key);
                if (t && t.status !== 'loading') t.status = 'idle';
              });
              activateFeeds();
            }, { icon: 'refresh', cls: 'rq-btn-sm' })
          : ui.button('Activate public feeds', () => activateFeeds(), { icon: 'download', variant: 'primary', cls: 'rq-btn-sm' })
      );
      markerList = h('div', { class: 'rq-marker-list', 'aria-live': 'polite' });
      const regSelect = ui.select('Topic', REG_TOPICS, st.topic, (v) => {
        st.topic = v;
        if (feedsActive()) {
          const d = FEEDS.reg(v);
          R.tasks.ensure(d);
          R.tasks.start(d.key);
        }
        R.shell.refresh();
      }, { key: 'sr-topic', cls: 'rq-field-inline' });
      const standbyNote = active ? null : h('p', { class: 'rq-standby rq-mono' }, 'STANDBY · Activating sends fixed, non-personal queries (never your search terms) directly from your browser to USGS, CISA (GitHub), the Federal Register and the ECB.');
      const subjectPanel = s
        ? panel('Current subject', { live: true, meta: s.chosen.label }, h('div', { class: 'rq-subject-hud' }, h('div', { class: 'rq-subject-name' }, s.primary ? s.primary.title : s.resolved.countryName || s.resolved.placeLabel || s.query), h('div', { class: 'rq-row rq-row-tight' }, ui.badge('Interpretation: ' + s.chosen.confidence, 'org'), s.primary ? ui.confidence(s.primaryConfidence) : null)), sig.length ? h('ul', { class: 'rq-signal-list rq-compact-list' }, ...sig.slice(0, 6).map((x) => h('li', { class: 'rq-signal' }, ui.badge(x.tone === 'serious' ? 'Serious' : 'Review', x.tone), h('button', { type: 'button', class: 'rq-link-btn', onclick: () => R.shell.openDetail(x.record) }, fmt.truncate(x.text, 100))))) : h('p', { class: 'rq-muted' }, 'No source-reported signals yet. This is not evidence of low risk.'), h('div', { class: 'rq-row rq-row-tight' }, ui.button('Overview', () => R.shell.go('overview', { focus: true }), { cls: 'rq-btn-xs' }), ui.button('Relationships', () => R.shell.go('relationships', { focus: true }), { cls: 'rq-btn-xs' }), ui.button('Evidence pack', () => R.exporters.evidencePackJSON(), { cls: 'rq-btn-xs', icon: 'download' })))
        : panel('Current subject', { meta: 'none' }, h('p', { class: 'rq-muted' }, 'No active investigation. Search a company, insurer, port, country, CVE, tender or risk concept above — results are plotted here when they carry coordinates.'), h('div', { class: 'rq-row rq-row-tight' }, ...['Port of Rotterdam', 'Malaysia', 'Allianz SE', 'CVE-2024-3094'].map((q) => ui.button(q, () => R.shell.search(q), { cls: 'rq-btn-xs' }))));
      const statusPanel = panel('Source status', { meta: live + ' live' }, ui.bars([['Live (verified)', live, 'ok'], ['Link-out / verify', R.sources.list.length - live, 'neutral'], ['Unavailable this session', R.sources.list.filter((x) => R.runtime.get(x.id).mode === 'unavailable').length, 'warn']], { label: 'Source modes' }), ui.button('Open Coverage Console', () => R.shell.go('coverage', { focus: true }), { cls: 'rq-btn-xs', icon: 'gauge' }));
      const grid = h(
        'div',
        { class: 'rq-sr-grid' },
        globePanel(ctx),
        panel('Global seismic wire', { cls: 'rq-panel-tall', live: active, meta: 'USGS · M4.5+ · 7d' }, active ? feedPanel(FEEDS.quakes(), 'quake', true) : standbyNote || null, h('p', { class: 'rq-fineprint' }, 'Seismic events do not confirm facility damage, insured loss or supplier disruption.')),
        subjectPanel,
        panel('Exploited vulnerabilities', { live: active, meta: 'CISA KEV' }, active ? feedPanel(FEEDS.kev(), 'kev', true) : h('p', { class: 'rq-muted rq-mono' }, 'STANDBY'), h('p', { class: 'rq-fineprint' }, 'A KEV entry does not show which suppliers run the affected product.')),
        panel('US regulatory wire', { live: active, meta: 'Federal Register', actions: regSelect }, active ? feedPanel(FEEDS.reg(st.topic), 'reg', true) : h('p', { class: 'rq-muted rq-mono' }, 'STANDBY'), h('p', { class: 'rq-fineprint' }, 'Not legal advice. Verify applicability and dates with counsel.')),
        panel('FX reference', { live: active, meta: 'ECB · EUR/USD' }, active ? ui.taskPanel(FEEDS.fx(), { auto: true, compact: true, render: (recs) => h('div', { class: 'rq-fx' }, h('div', { class: 'rq-fx-val rq-mono' }, (recs[0].fields[0] || [])[1] || '—'), h('div', { class: 'rq-muted rq-mono' }, (recs[0].fields[1] || [])[1] || ''), h('div', { class: 'rq-muted' }, 'Reference rate, not a tradable price.'), h('button', { type: 'button', class: 'rq-link-btn', onclick: () => R.shell.openDetail(recs[0]) }, 'Details')) }) : h('p', { class: 'rq-muted rq-mono' }, 'STANDBY')),
        panel('Markers (text alternative)', { cls: 'rq-panel-wide', meta: 'from loaded records' }, markerList),
        statusPanel
      );
      const out = h('div', { class: 'rq-situation' }, strip, ticker(), grid, h('p', { class: 'rq-fineprint' }, 'Design language inspired by public situational-awareness projects (clean-room implementation; no code, assets or data reused; no affiliation). ', extLink('https://github.com/koala73/worldmonitor', 'WorldMonitor'), ' · ', extLink('https://github.com/bilawalsidhu/gods-eye-view', 'God’s Eye View'), ' — reference links only.'));
      setTimeout(renderMarkerList, 0);
      return out;
    }
  });
})(window.RYLAQWorkspace);
