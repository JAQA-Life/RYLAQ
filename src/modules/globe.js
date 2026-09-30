/*
 * globe.js — dependency-free orthographic globe for the Situation Room.
 *
 * Clean-room implementation (no third-party code). Draws on a <canvas>:
 * sphere, graticule, Natural Earth coastlines (R.worldLand) and evidence
 * markers taken ONLY from records already loaded in this session. It loads no
 * map tiles, no fonts and no remote assets, and makes no network requests.
 *
 * Interaction: drag / arrow keys rotate, wheel / + − zoom, 0 resets, Enter
 * selects the marker nearest the reticle. Auto-rotation and pulses are
 * disabled when the user prefers reduced motion or the tab is hidden.
 * A text alternative (marker table) is rendered by the caller.
 */
(function (R) {
  'use strict';
  const RAD = Math.PI / 180;
  const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function cssVar(el, name, fallback) {
    const v = getComputedStyle(el).getPropertyValue(name).trim();
    return v || fallback;
  }

  /**
   * create(host, opts) → controller
   * opts: { view: {lon, lat, zoom, auto}, label, onSelect(point), onView(view), compact }
   */
  function create(host, opts) {
    const o = opts || {};
    const view = o.view || { lon: 10, lat: 20, zoom: 1, auto: true };
    const canvas = document.createElement('canvas');
    canvas.className = 'rq-globe-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('tabindex', '0');
    canvas.setAttribute('aria-label', (o.label || 'Evidence globe') + '. Use arrow keys to rotate, plus and minus to zoom, Enter to open the marker nearest the centre. A text list of markers follows.');
    host.appendChild(canvas);
    const tip = document.createElement('div');
    tip.className = 'rq-globe-tip';
    tip.setAttribute('aria-hidden', 'true');
    host.appendChild(tip);

    const ctx = canvas.getContext('2d');
    let W = 0;
    let H = 0;
    let dpr = 1;
    let points = [];
    let hover = null;
    let selected = null;
    let raf = 0;
    let lastT = 0;
    let dragging = null;
    let idleUntil = 0;
    let anim = null;
    let alive = true;

    function resize() {
      const r = host.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(200, r.width);
      H = Math.max(200, r.height);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      draw(performance.now());
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(host);

    const radius = () => (Math.min(W, H) / 2) * 0.86 * view.zoom;

    /** Orthographic projection. Returns [x, y, visible]. */
    function project(lon, lat) {
      const l = (lon - view.lon) * RAD;
      const p = lat * RAD;
      const p0 = view.lat * RAD;
      const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
      const r = radius();
      const x = W / 2 + r * Math.cos(p) * Math.sin(l);
      const y = H / 2 - r * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l));
      return [x, y, cosc > 0];
    }
    /** Inverse projection for the reticle readout. */
    function invert(x, y) {
      const r = radius();
      const px = (x - W / 2) / r;
      const py = -(y - H / 2) / r;
      const rho = Math.sqrt(px * px + py * py);
      if (rho > 1) return null;
      const c = Math.asin(rho);
      const p0 = view.lat * RAD;
      const lat = rho === 0 ? view.lat : Math.asin(Math.cos(c) * Math.sin(p0) + (py * Math.sin(c) * Math.cos(p0)) / rho) / RAD;
      const lon = view.lon + Math.atan2(px * Math.sin(c), rho * Math.cos(c) * Math.cos(p0) - py * Math.sin(c) * Math.sin(p0)) / RAD;
      return { lat, lon: ((lon + 540) % 360) - 180 };
    }

    function strokePolyline(arr, step) {
      let pen = false;
      for (let i = 0; i < arr.length; i += step) {
        const [x, y, vis] = project(arr[i], arr[i + 1]);
        if (vis) {
          if (pen) ctx.lineTo(x, y);
          else {
            ctx.moveTo(x, y);
            pen = true;
          }
        } else pen = false;
      }
    }

    function draw(t) {
      if (!W) return;
      const col = {
        sea: cssVar(host, '--globe-sea', '#07152a'),
        seaEdge: cssVar(host, '--globe-sea-edge', '#0b2545'),
        grid: cssVar(host, '--globe-grid', 'rgba(45,212,191,0.14)'),
        land: cssVar(host, '--globe-land', 'rgba(94,234,212,0.85)'),
        rim: cssVar(host, '--globe-rim', 'rgba(45,212,191,0.55)'),
        quake: cssVar(host, '--globe-quake', '#fb7185'),
        place: cssVar(host, '--globe-place', '#22d3ee'),
        signal: cssVar(host, '--globe-signal', '#fbbf24'),
        entity: cssVar(host, '--globe-entity', '#a78bfa'),
        text: cssVar(host, '--globe-text', '#d8e6f5')
      };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const r = radius();
      const cx = W / 2;
      const cy = H / 2;

      // Atmosphere glow + sphere.
      const glow = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.18);
      glow.addColorStop(0, col.rim);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      const sea = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
      sea.addColorStop(0, col.seaEdge);
      sea.addColorStop(1, col.sea);
      ctx.fillStyle = sea;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Graticule every 15°.
      ctx.strokeStyle = col.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let lon = -180; lon < 180; lon += 15) {
        const a = [];
        for (let lat = -90; lat <= 90; lat += 3) a.push(lon, lat);
        strokePolyline(a, 2);
      }
      for (let lat = -75; lat <= 75; lat += 15) {
        const a = [];
        for (let lon = -180; lon <= 180; lon += 3) a.push(lon, lat);
        strokePolyline(a, 2);
      }
      ctx.stroke();

      // Coastlines.
      ctx.strokeStyle = col.land;
      ctx.lineWidth = o.compact ? 0.9 : 1.15;
      ctx.beginPath();
      for (const ln of R.worldLand()) strokePolyline(ln, 2);
      ctx.stroke();

      // Rim.
      ctx.strokeStyle = col.rim;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      // Markers.
      const phase = reduceMotion() ? 0 : (t / 1000) % 2;
      for (const pt of points) {
        const [x, y, vis] = project(pt.lon, pt.lat);
        pt._x = x;
        pt._y = y;
        pt._vis = vis;
        if (!vis) continue;
        const c = col[pt.kind] || col.place;
        const base = pt.kind === 'quake' ? 2.5 + (pt.weight || 0) * 7 : pt.kind === 'entity' ? 5 : 4;
        if (pt.kind === 'quake' && phase) {
          ctx.strokeStyle = c;
          ctx.globalAlpha = 1 - (phase % 1);
          ctx.beginPath();
          ctx.arc(x, y, base + (phase % 1) * 14, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = c;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (pt.kind === 'entity') {
          ctx.moveTo(x, y - base);
          ctx.lineTo(x + base, y);
          ctx.lineTo(x, y + base);
          ctx.lineTo(x - base, y);
          ctx.closePath();
        } else if (pt.kind === 'signal') {
          ctx.rect(x - base * 0.8, y - base * 0.8, base * 1.6, base * 1.6);
        } else ctx.arc(x, y, base, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (pt === hover || pt === selected) {
          ctx.strokeStyle = col.text;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, base + 5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      if (o.onView) o.onView({ lat: view.lat, lon: view.lon, zoom: view.zoom, visible: points.filter((p) => p._vis).length });
    }

    function needsLoop() {
      if (!alive || document.hidden || reduceMotion()) return false;
      return !!anim || (view.auto && !dragging && performance.now() > idleUntil) || points.some((p) => p.kind === 'quake');
    }
    function loop(t) {
      raf = 0;
      if (!alive) return;
      if (!host.isConnected) return destroy();
      const dt = lastT ? Math.min(64, t - lastT) : 16;
      lastT = t;
      if (anim) {
        const k = Math.min(1, (t - anim.t0) / anim.ms);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        view.lon = anim.from.lon + anim.dLon * e;
        view.lat = anim.from.lat + (anim.to.lat - anim.from.lat) * e;
        if (k >= 1) anim = null;
      } else if (view.auto && !dragging && t > idleUntil && !reduceMotion()) {
        view.lon = ((view.lon + dt * 0.004 + 540) % 360) - 180;
      }
      draw(t);
      if (needsLoop()) raf = requestAnimationFrame(loop);
    }
    function kick() {
      if (!raf && alive) {
        lastT = 0;
        raf = requestAnimationFrame(loop);
      }
    }
    function redraw() {
      if (needsLoop()) kick();
      else draw(performance.now());
    }
    const onVis = () => redraw();
    document.addEventListener('visibilitychange', onVis);

    function nearest(x, y, maxD) {
      let best = null;
      let bd = maxD;
      for (const p of points) {
        if (!p._vis) continue;
        const d = Math.hypot(p._x - x, p._y - y);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      return best;
    }
    function pause() {
      idleUntil = performance.now() + 8000;
    }

    canvas.addEventListener('pointerdown', (e) => {
      dragging = { x: e.clientX, y: e.clientY, lon: view.lon, lat: view.lat, moved: false };
      canvas.setPointerCapture(e.pointerId);
      anim = null;
    });
    canvas.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (dragging) {
        const k = 0.35 / view.zoom;
        const dx = e.clientX - dragging.x;
        const dy = e.clientY - dragging.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) dragging.moved = true;
        view.lon = ((dragging.lon - dx * k + 540) % 360) - 180;
        view.lat = Math.max(-85, Math.min(85, dragging.lat + dy * k));
        pause();
        draw(performance.now());
        return;
      }
      const h = nearest(x, y, 12);
      if (h !== hover) {
        hover = h;
        canvas.style.cursor = h ? 'pointer' : 'grab';
        if (h) {
          tip.textContent = h.label;
          tip.style.left = Math.min(W - 220, Math.max(4, x + 12)) + 'px';
          tip.style.top = Math.max(4, y - 10) + 'px';
          tip.classList.add('is-on');
        } else tip.classList.remove('is-on');
        if (!raf) draw(performance.now());
      }
    });
    const endDrag = (e) => {
      if (!dragging) return;
      const wasClick = !dragging.moved;
      dragging = null;
      if (wasClick) {
        const rect = canvas.getBoundingClientRect();
        const p = nearest(e.clientX - rect.left, e.clientY - rect.top, 14);
        if (p) select(p);
      }
      redraw();
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', () => {
      dragging = null;
      redraw();
    });
    canvas.addEventListener('pointerleave', () => {
      hover = null;
      tip.classList.remove('is-on');
    });
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        view.zoom = Math.max(0.7, Math.min(4, view.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
        pause();
        redraw();
      },
      { passive: false }
    );
    canvas.addEventListener('keydown', (e) => {
      const step = 6 / view.zoom;
      let handled = true;
      if (e.key === 'ArrowLeft') view.lon -= step;
      else if (e.key === 'ArrowRight') view.lon += step;
      else if (e.key === 'ArrowUp') view.lat = Math.min(85, view.lat + step);
      else if (e.key === 'ArrowDown') view.lat = Math.max(-85, view.lat - step);
      else if (e.key === '+' || e.key === '=') view.zoom = Math.min(4, view.zoom * 1.2);
      else if (e.key === '-' || e.key === '_') view.zoom = Math.max(0.7, view.zoom / 1.2);
      else if (e.key === '0') Object.assign(view, { zoom: 1 });
      else if (e.key === 'Enter') {
        const p = nearest(W / 2, H / 2, Math.min(W, H) / 3);
        if (p) select(p);
      } else handled = false;
      if (handled) {
        e.preventDefault();
        view.lon = ((view.lon + 540) % 360) - 180;
        pause();
        redraw();
      }
    });

    function select(p) {
      selected = p;
      focus(p.lat, p.lon);
      if (o.onSelect) o.onSelect(p);
    }
    function focus(lat, lon) {
      pause();
      const to = { lat: Math.max(-80, Math.min(80, lat)), lon };
      if (reduceMotion()) {
        view.lat = to.lat;
        view.lon = lon;
        return redraw();
      }
      let dLon = lon - view.lon;
      if (dLon > 180) dLon -= 360;
      if (dLon < -180) dLon += 360;
      anim = { from: { lat: view.lat, lon: view.lon }, to, dLon, t0: performance.now(), ms: 900 };
      kick();
    }
    function destroy() {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (ro) ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    }

    resize();
    redraw();
    return {
      view,
      setPoints(list) {
        points = list || [];
        host.setAttribute('data-points', String(points.length));
        redraw();
      },
      focus,
      redraw,
      setAuto(on) {
        view.auto = !!on;
        redraw();
      },
      destroy,
      invert: () => invert(W / 2, H / 2)
    };
  }

  R.globe = { create, reduceMotion };
})(window.RYLAQWorkspace);
