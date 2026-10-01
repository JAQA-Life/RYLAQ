/*
 * cesiumView.js — the 3D evidence globe inside the JAQA workspace.
 *
 * Built on CesiumJS (Apache-2.0; notice on /licenses/), served by the JAQA
 * server from /globe/cesium/ (the same self-hosted build JAQA Eye View uses).
 * It is loaded only when this view is opened.
 *
 * Privacy: imagery is the Natural Earth II set bundled with CesiumJS, so the
 * view makes no request to any third party (no Cesium ion, no tile servers).
 * CSP: uses CesiumWidget + primitives only (no Knockout-based Viewer widgets),
 * so it runs under script-src 'self' without 'unsafe-eval'.
 * JAQA™ is a trademark of JAQA. © JAQA™. All rights reserved.
 */
(function (R) {
  'use strict';
  const { h } = R.util;
  const BASE = '/globe/cesium/';
  let loading = null;

  /** Load the self-hosted CesiumJS build once. Rejects on static-only hosting. */
  function load() {
    if (window.Cesium) return Promise.resolve(window.Cesium);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      window.CESIUM_BASE_URL = BASE;
      // CesiumJS's single-file build installs its workers as one inline string
      // (globalThis.CESIUM_WORKERS) and runs them from blob: scripts, which the
      // strict CSP blocks. With CESIUM_WORKERS undefined, CesiumJS uses its
      // standard same-origin ES-module workers (/globe/cesium/Workers/*.js);
      // the setter discards the inline copy.
      if (!Object.getOwnPropertyDescriptor(window, 'CESIUM_WORKERS')) {
        Object.defineProperty(window, 'CESIUM_WORKERS', { configurable: true, get: () => undefined, set: () => {} });
      }
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = BASE + 'Widgets/CesiumWidget/CesiumWidget.css';
      document.head.appendChild(css);
      const s = document.createElement('script');
      s.src = BASE + 'Cesium.js';
      s.async = true;
      const timer = setTimeout(() => reject(new Error('timeout')), 30000);
      s.onload = () => {
        clearTimeout(timer);
        window.Cesium ? resolve(window.Cesium) : reject(new Error('missing'));
      };
      s.onerror = () => {
        clearTimeout(timer);
        reject(new Error('unavailable'));
      };
      document.head.appendChild(s);
    }).catch((e) => {
      loading = null; // allow a retry
      throw e;
    });
    return loading;
  }

  const COLORS = { quake: '#f97316', place: '#2dd4bf', entity: '#22d3ee', signal: '#fbbf24' };
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current = null;

  /**
   * Mount a CesiumJS globe in host. points: [{kind, lat, lon, label, record}].
   * Returns a controller, or throws if CesiumJS is not available.
   */
  async function mount(host, points, opts) {
    const o = opts || {};
    const Cesium = await load();
    if (!host.isConnected) return null;
    if (current) current.destroy();
    const canvasBox = h('div', { class: 'rq-cesium-canvas', role: 'img', 'aria-label': '3D globe with evidence markers' });
    const credits = h('div', { class: 'rq-cesium-credits' });
    // No Cesium logo: this view uses no Cesium ion content (bundled imagery
    // only); the CesiumJS licence notice is on /licenses/.
    Cesium.CreditDisplay.cesiumCredit = undefined;
    host.replaceChildren(canvasBox, credits);
    const widget = new Cesium.CesiumWidget(canvasBox, {
      baseLayer: Cesium.ImageryLayer.fromProviderAsync(Cesium.TileMapServiceImageryProvider.fromUrl(Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'))),
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      creditContainer: credits,
      scene3DOnly: true,
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity
    });
    const scene = widget.scene;
    scene.globe.enableLighting = false;
    const dots = scene.primitives.add(new Cesium.PointPrimitiveCollection());

    function setPoints(list) {
      dots.removeAll();
      for (const p of list || []) {
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
        dots.add({
          position: Cesium.Cartesian3.fromDegrees(p.lon, p.lat),
          pixelSize: p.kind === 'entity' ? 14 : p.kind === 'quake' ? 8 + Math.round((p.weight || 0) * 8) : 9,
          color: Cesium.Color.fromCssColorString(COLORS[p.kind] || '#e2e8f0'),
          outlineColor: Cesium.Color.fromCssColorString('#020617'),
          outlineWidth: 2,
          id: p
        });
      }
      if (o.onCount) o.onCount(dots.length);
      scene.requestRender();
    }
    function flyTo(lat, lon, height) {
      widget.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(lon, lat, height || 2500000), duration: reduceMotion() ? 0 : 1.6 });
    }
    function zoom(factor) {
      const height = widget.camera.positionCartographic.height;
      factor > 1 ? widget.camera.zoomIn(height * (factor - 1)) : widget.camera.zoomOut(height * (1 / factor - 1));
      scene.requestRender();
    }

    const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    handler.setInputAction((e) => {
      const picked = scene.pick(e.position);
      const p = picked && picked.id;
      if (!p || !p.label) return;
      if (p.record && R.shell) R.shell.openDetail(p.record);
      else R.util.announce(p.label);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    handler.setInputAction((e) => {
      const picked = scene.pick(e.endPosition);
      canvasBox.title = picked && picked.id && picked.id.label ? picked.id.label : '';
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    setPoints(points);
    if (o.center && Number.isFinite(o.center.lat)) flyTo(o.center.lat, o.center.lon, o.center.height);
    else widget.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(10, 20, 20000000) });

    const api = {
      setPoints,
      flyTo,
      zoom,
      reset: () => flyTo(20, 10, 20000000),
      destroy() {
        handler.destroy();
        if (!widget.isDestroyed()) widget.destroy();
        if (current === api) current = null;
      },
      isConnected: () => host.isConnected
    };
    current = api;
    return api;
  }

  // Keep the open view in step with new evidence (searches, feeds, monitor).
  R.events.on('task:update', () => {
    if (!current) return;
    if (!current.isConnected()) return current.destroy();
    if (R.situation) current.setPoints(R.situation.collectPoints());
  });
  R.events.on('session:cleared', () => current && current.isConnected() && current.setPoints(R.situation ? R.situation.collectPoints() : []));

  R.cesium3d = { load, mount, current: () => current, base: BASE };
})(window.JAQAWorkspace);
