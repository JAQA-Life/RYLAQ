/*
 * globe3d.js — 3D Globe: launcher for JAQA Eye View (apps/globe), served by
 * the JAQA server at /globe/. Open-source licences: /licenses/.
 *
 * JAQA only builds a link: JAQA Eye View reads its camera from the URL hash
 * (#lat=…&lon=…&alt=…&style=…; see apps/globe/src/sharelink.js). Only
 * coordinates and a style are placed in it — never a search term.
 * JAQA™ is a trademark of JAQA. © JAQA™. All rights reserved.
 */
(function (R) {
  'use strict';
  const { h } = R.util;
  const ui = R.ui;

  // JAQA optic modes → JAQA Eye View style names (sharelink.js URL values).
  const STYLE = { std: 'normal', nvg: 'nvg', flir: 'flir', crt: 'crt' };
  const num = (v, d) => (Number.isFinite(v) ? Number(v.toFixed(d)) : null);

  R.globe3d = {
    base: '/globe/',
    /** Link into the 3D globe at a location. alt in metres above the ground. */
    url(o) {
      const p = o || {};
      const lat = num(p.lat, 4);
      const lon = num(p.lon, 4);
      if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return this.base;
      const alt = Math.max(300, Math.min(20000000, Math.round(p.alt || 250000)));
      const parts = ['lat=' + lat, 'lon=' + lon, 'alt=' + alt, 'pitch=' + (alt > 2000000 ? -90 : -45)];
      if (p.style && STYLE[p.style]) parts.push('style=' + STYLE[p.style]);
      return this.base + '#' + parts.join('&');
    },
    link(label, o, cls) {
      return h('a', { class: cls || 'rq-btn rq-btn-sm', href: this.url(o) }, R.util.icon('globe', 'rq-icon-sm'), h('span', null, label));
    }
  };

  // Facts from apps/globe/README.md, not marketing claims.
  const FEATURES = [
    ['Photorealistic 3D globe', 'CesiumJS with Esri satellite imagery and OpenStreetMap keyless; Google Photorealistic 3D Tiles with a Google Maps key or Cesium ion token.'],
    ['Live contacts', 'Aircraft, ships and satellites near a target, with click-to-track, trails and a 250 km contacts roster.'],
    ['Sensor looks', 'CRT, NVG, FLIR/thermal, Noir and Snow shader styles, a detection overlay and a tactical HUD.'],
    ['Environment', 'Earthquakes, wildfires (NASA FIRMS), weather radar, wind, clouds, lightning and NHC/CPHC cyclone tracks.'],
    ['Space', 'Satellite orbits (SGP4), pass predictions and a rolling 30 days of launches.'],
    ['Cameras & infrastructure', 'Public CCTV cameras, mapped ALPR camera locations, datacenters, dams, submarine cables and military installations.'],
    ['Scene director', 'Cinematic camera tours, shareable scenes and share links.'],
    ['Voice agent', 'Hands-free control through the OpenAI Realtime API (needs a server-side OpenAI key).']
  ];

  /** 3D evidence globe (src/modules/cesiumView.js), mounted on render. */
  function cesiumSection(here) {
    const host = h('div', { class: 'rq-cesium' }, h('p', { class: 'rq-muted rq-cesium-status' }, 'Loading the 3D globe…'));
    const count = h('span', { class: 'rq-mono rq-muted' }, '');
    let ctl = null;
    const btn = (label, icon, fn) => ui.button(label, () => ctl && fn(ctl), { icon, cls: 'rq-btn-sm' });
    const controls = h(
      'div',
      { class: 'rq-row rq-row-tight' },
      btn('Zoom in', 'search', (c) => c.zoom(2)),
      btn('Zoom out', 'search', (c) => c.zoom(0.5)),
      btn('Reset view', 'globe', (c) => c.reset()),
      here ? btn('Fly to ' + here.label, 'pin', (c) => c.flyTo(here.lat, here.lon, 1500000)) : null,
      count
    );
    setTimeout(() => {
      if (!host.isConnected || !R.cesium3d) return;
      const pts = R.situation ? R.situation.collectPoints() : [];
      R.cesium3d
        .mount(host, pts, { center: here ? { lat: here.lat, lon: here.lon, height: 3000000 } : null, onCount: (n) => (count.textContent = n + ' marker(s)') })
        .then((c) => (ctl = c))
        .catch(() => {
          host.replaceChildren(ui.warning('The 3D evidence globe needs the JAQA server. It is not available on this static-only deployment; the Situation Room globe still works.', 'info'));
          controls.remove();
        });
    }, 0);
    return ui.section(
      '3D evidence globe',
      { icon: 'globe', desc: 'Your session’s evidence on a real 3D Earth: seismic events, places, the current subject and Global Monitor events. Imagery is the Natural Earth II set served by the JAQA server, so this view makes no third-party requests. Drag to rotate, scroll to zoom, click a marker for details.' },
      host,
      controls,
      h('p', { class: 'rq-fineprint' }, 'Marker positions come from the loaded public records; they are not facility, loss or exposure data.')
    );
  }

  R.modules.register({
    id: 'globe3d',
    group: 'risk',
    order: 1,
    icon: 'globe',
    title: '3D Globe (JAQA Eye View)',
    short: '3D Globe',
    description: 'Open JAQA Eye View, the photorealistic 3D globe with live aircraft, ships, satellites, hazards and cameras.',
    warnings: [
      'Opens JAQA Eye View at /globe/. It is a separate app with its own layers and requests: its data comes from public providers through the JAQA server, and its voice agent sends audio to OpenAI only if the server has an OpenAI key.',
      'Live positions, camera feeds and public registries can be delayed, incomplete or wrong. Nothing on the globe is a determination of risk, ownership, intent or exposure.'
    ],
    liveRefresh: false,
    render(ctx) {
      const s = ctx.session;
      const r = s && s.resolved;
      const here = r && Number.isFinite(r.lat) && r.lat !== null ? { lat: r.lat, lon: r.lon, label: (s.primary ? s.primary.title : r.placeLabel || r.countryName || 'current subject') } : null;
      const styles = [['std', 'Normal'], ['nvg', 'NVG'], ['flir', 'FLIR'], ['crt', 'CRT']];
      return h(
        'div',
        { class: 'rq-stack' },
        cesiumSection(here),
        h(
          'div',
          { class: 'rq-hero' },
          h('h3', { class: 'rq-hero-title' }, 'Launch JAQA Eye View'),
          h('p', null, 'JAQA Eye View opens in this tab. Use your browser’s Back button to return to the JAQA workspace.'),
          h('div', { class: 'rq-row' }, R.globe3d.link('Open 3D globe', { lat: 20, lon: 10, alt: 18000000 }, 'rq-btn rq-btn-primary'), here ? R.globe3d.link('Fly to ' + here.label, { lat: here.lat, lon: here.lon, alt: 60000 }) : null),
          h('p', { class: 'rq-fineprint' }, 'Only coordinates and a visual style go into the link, never your search terms.')
        ),
        ui.section('Open in a sensor style', { icon: 'layers', desc: here ? 'At ' + here.label + '.' : 'Whole-Earth view. Run a search first to open at a place.' }, h('div', { class: 'rq-row' }, ...styles.map(([k, l]) => R.globe3d.link(l, here ? { lat: here.lat, lon: here.lon, alt: 60000, style: k } : { lat: 20, lon: 10, alt: 18000000, style: k })))),
        ui.section('What JAQA Eye View includes', { icon: 'list' }, h('ul', { class: 'rq-list' }, ...FEATURES.map(([t, d]) => h('li', null, h('strong', null, t + ': '), d)))),
        h('p', { class: 'rq-fineprint' }, 'Map data and imagery credits are under “Data attribution” on the globe. Open-source licences: ', h('a', { href: '/licenses/' }, 'Licences'), '.')
      );
    }
  });
})(window.JAQAWorkspace);
