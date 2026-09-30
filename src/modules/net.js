/*
 * net.js — request manager, runtime source status and task store.
 *
 * - Every request: cache "no-store", credentials "omit", referrerPolicy
 *   "no-referrer", mode "cors". No cookies are ever sent or received.
 * - Global concurrency cap (6) + per-source caps from the registry.
 * - In-session de-duplication of identical requests (memory only; cleared
 *   by Clear Session / refresh).
 * - AbortController per request, chained to the session controller so a new
 *   search cancels stale requests.
 * - Partial failure handling: callers use Promise.allSettled and each
 *   failure is classified (cors_or_network, timeout, rate_limited, http_4xx,
 *   http_5xx, bad_json, bad_shape, offline, linkout, aborted).
 * - A CORS/network failure during normal use marks that source unavailable
 *   for the current session and the UI falls back to official link-outs.
 * - Search terms, URLs containing them and response bodies are never logged.
 */
(function (R) {
  'use strict';

  /* ------------------------- runtime status ------------------------- */
  const status = new Map();
  function st(id) {
    if (!status.has(id)) status.set(id, { mode: null, reason: '', ok: 0, fail: 0, rateLimited: 0, skipped: 0, lastStatus: null, lastFetch: null, rateLimitedUntil: 0, sessionVerified: false, lastErrorKind: null });
    return status.get(id);
  }
  R.runtime = {
    get: st,
    all: () => status,
    reset() {
      status.clear();
      R.events.emit('net:update');
    },
    /** Effective mode for this session: runtime override, else registry default. */
    mode(id) {
      const s = R.sources.get(id);
      if (!s) return 'unavailable';
      const r = st(id);
      if (R.state.prefs.hiddenSources.has(id)) return 'hidden';
      if (r.mode) return r.mode;
      return s.defaultMode;
    },
    isLive(id) {
      return this.mode(id) === 'live';
    },
    markUnavailable(id, reason) {
      const r = st(id);
      r.mode = 'unavailable';
      r.reason = reason;
      R.events.emit('net:update');
    },
    markLive(id) {
      const r = st(id);
      r.mode = 'live';
      r.reason = '';
      r.sessionVerified = true;
      R.events.emit('net:update');
    },
    totals() {
      let ok = 0, fail = 0, rl = 0, last = null;
      for (const r of status.values()) {
        ok += r.ok;
        fail += r.fail;
        rl += r.rateLimited;
        if (r.lastFetch && (!last || r.lastFetch > last)) last = r.lastFetch;
      }
      return { ok, fail, rateLimited: rl, last };
    }
  };

  /* --------------------------- request queue ------------------------- */
  const GLOBAL_MAX = 6;
  let active = 0;
  const perSource = new Map();
  const queue = [];
  const cache = new Map(); // key -> resolved result (success only)
  const inflight = new Map(); // key -> promise

  function pump() {
    for (let i = 0; i < queue.length && active < GLOBAL_MAX; ) {
      const job = queue[i];
      const src = R.sources.get(job.sourceId);
      const cur = perSource.get(job.sourceId) || 0;
      if (cur >= (src ? src.concurrencyLimit : 1)) {
        i++;
        continue;
      }
      queue.splice(i, 1);
      active++;
      perSource.set(job.sourceId, cur + 1);
      job.start().finally(() => {
        active--;
        perSource.set(job.sourceId, (perSource.get(job.sourceId) || 1) - 1);
        pump();
      });
    }
  }

  function sessionSignal() {
    const s = R.state.session;
    return s && s.controller ? s.controller.signal : null;
  }

  /**
   * request(sourceId, url, opts) -> Promise<{ok, data, status, errorKind, retryAt}>
   * opts: { method, body (object), headers, validate(json) -> bool, allow404, probe, dedupe }
   */
  function request(sourceId, url, opts) {
    const o = opts || {};
    const src = R.sources.get(sourceId);
    const rs = st(sourceId);
    if (!src) return Promise.resolve({ ok: false, errorKind: 'unknown_source' });
    if (!o.probe && !R.runtime.isLive(sourceId)) {
      rs.skipped++;
      R.events.emit('net:update');
      return Promise.resolve({ ok: false, errorKind: 'linkout' });
    }
    if (rs.rateLimitedUntil > Date.now()) {
      rs.skipped++;
      R.events.emit('net:update');
      return Promise.resolve({ ok: false, errorKind: 'rate_limited', retryAt: rs.rateLimitedUntil });
    }
    const method = o.method || 'GET';
    const bodyStr = o.body ? JSON.stringify(o.body) : undefined;
    const key = method + ' ' + url + ' ' + (bodyStr || '');
    if (!o.probe && cache.has(key)) return Promise.resolve(cache.get(key));
    if (!o.probe && inflight.has(key)) return inflight.get(key);

    const generation = R.state.generation;
    const p = new Promise((resolve) => {
      queue.push({
        sourceId,
        start: () => run(src, url, method, bodyStr, o, generation).then((res) => {
          if (res.ok && !o.probe && generation === R.state.generation) cache.set(key, res);
          resolve(res);
        })
      });
      pump();
    });
    if (!o.probe) {
      inflight.set(key, p);
      p.finally(() => inflight.delete(key));
    }
    return p;
  }

  async function run(src, url, method, bodyStr, o, generation) {
    const rs = st(src.id);
    const ctrl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ctrl.abort();
    }, src.timeoutMs || 12000);
    const outer = o.probe ? null : sessionSignal();
    const onOuter = () => ctrl.abort();
    if (outer) {
      if (outer.aborted) ctrl.abort();
      else outer.addEventListener('abort', onOuter, { once: true });
    }
    const headers = Object.assign({ Accept: 'application/json' }, o.headers || {});
    if (bodyStr) headers['Content-Type'] = 'application/json';
    const finish = (res) => {
      clearTimeout(timer);
      if (outer) outer.removeEventListener('abort', onOuter);
      if (generation !== R.state.generation && !o.probe) return { ok: false, errorKind: 'aborted' };
      rs.lastFetch = new Date();
      if (res.ok) rs.ok++;
      else if (res.errorKind !== 'aborted') rs.fail++;
      rs.lastStatus = res.status || res.errorKind;
      rs.lastErrorKind = res.ok ? null : res.errorKind;
      R.events.emit('net:update');
      return res;
    };
    let resp;
    try {
      resp = await fetch(url, {
        method,
        headers,
        body: bodyStr,
        mode: 'cors',
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        redirect: 'follow',
        signal: ctrl.signal
      });
    } catch (e) {
      if (timedOut) return finish({ ok: false, errorKind: 'timeout' });
      if (ctrl.signal.aborted) return finish({ ok: false, errorKind: 'aborted' });
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return finish({ ok: false, errorKind: 'offline' });
      // Browsers report CORS blocks and network failures identically (TypeError).
      if (!o.probe) R.runtime.markUnavailable(src.id, 'Live request blocked or failed from this browser (CORS/network).');
      return finish({ ok: false, errorKind: 'cors_or_network' });
    }
    const code = resp.status;
    if (code === 429) {
      const ra = Number(resp.headers.get('Retry-After'));
      rs.rateLimited++;
      rs.rateLimitedUntil = Date.now() + (isFinite(ra) && ra > 0 ? ra * 1000 : 30000);
      return finish({ ok: false, status: code, errorKind: 'rate_limited', retryAt: rs.rateLimitedUntil });
    }
    if (code === 404 && o.allow404) return finish({ ok: true, status: code, data: null });
    if (code >= 500) return finish({ ok: false, status: code, errorKind: 'http_5xx' });
    if (code >= 400) return finish({ ok: false, status: code, errorKind: code === 404 ? 'not_found' : 'http_4xx' });
    let text;
    try {
      text = await resp.text();
    } catch (e) {
      return finish({ ok: false, status: code, errorKind: timedOut ? 'timeout' : 'aborted' });
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return finish({ ok: false, status: code, errorKind: 'bad_json' });
    }
    if (o.validate) {
      let valid = false;
      try {
        valid = !!o.validate(data);
      } catch (e) {
        valid = false;
      }
      if (!valid) return finish({ ok: false, status: code, errorKind: 'bad_shape' });
    }
    return finish({ ok: true, status: code, data });
  }

  const ERROR_TEXT = {
    linkout: 'Live request unavailable from this browser. Open the source directly.',
    cors_or_network: 'This source may not support live browser access. Use the official link.',
    timeout: 'This source is temporarily unavailable. You can open the official source instead.',
    rate_limited: 'Request limit reached. Please wait a moment and retry.',
    http_5xx: 'This source is temporarily unavailable. You can open the official source instead.',
    http_4xx: 'Unavailable in the current public API response.',
    not_found: 'This query returned no public records from the selected sources.',
    bad_json: 'This source returned an unexpected response. Open the official source instead.',
    bad_shape: 'This source returned an unexpected response. Open the official source instead.',
    offline: 'You appear to be offline. Reconnect and retry.',
    aborted: 'Request cancelled.',
    unknown_source: 'Unavailable in the current public API response.'
  };

  R.net = {
    request,
    errorText: (k) => ERROR_TEXT[k] || ERROR_TEXT.http_5xx,
    resetCache() {
      cache.clear();
      inflight.clear();
      queue.length = 0;
    },
    stats: () => ({ active, queued: queue.length })
  };

  /* ------------------------------------------------------------------ *
   * Task store. A task is one logical lookup (e.g. "GLEIF search for X")
   * producing normalized records. Tasks are keyed and de-duplicated per
   * session so modules can share results; nothing survives Clear Session.
   * ------------------------------------------------------------------ */
  R.tasks = {
    /** def: { key, sourceId, label, run: async () => records[] } */
    ensure(def) {
      const s = R.state.session;
      if (!s) return null;
      let t = s.tasks.get(def.key);
      if (t && t.status !== 'error') return t;
      t = { key: def.key, sourceId: def.sourceId, label: def.label, status: 'idle', records: [], errorKind: null, def };
      s.tasks.set(def.key, t);
      return t;
    },
    get(key) {
      const s = R.state.session;
      return s ? s.tasks.get(key) : null;
    },
    async start(key) {
      const s = R.state.session;
      if (!s) return null;
      const t = s.tasks.get(key);
      if (!t || t.status === 'loading' || t.status === 'done' || t.status === 'empty') return t;
      if (!R.runtime.isLive(t.sourceId)) {
        t.status = 'linkout';
        R.events.emit('task:update', t);
        return t;
      }
      const gen = R.state.generation;
      t.status = 'loading';
      t.errorKind = null;
      R.events.emit('task:update', t);
      try {
        const out = await t.def.run();
        if (gen !== R.state.generation) return t;
        if (out && out.error) {
          t.status = out.error === 'linkout' ? 'linkout' : 'error';
          t.errorKind = out.error;
          t.retryAt = out.retryAt;
        } else {
          t.records = (out && out.records) || [];
          t.meta = (out && out.meta) || null;
          t.status = t.records.length ? 'done' : 'empty';
          t.retrievedAt = new Date();
        }
      } catch (e) {
        if (gen !== R.state.generation) return t;
        t.status = 'error';
        t.errorKind = 'bad_shape';
        console.error('[RYLAQ] task failed:', t.sourceId); // no query / payload in logs
      }
      R.events.emit('task:update', t);
      return t;
    },
    /** Run several tasks with Promise.allSettled so one failure never blocks the rest. */
    runAll(keys) {
      return Promise.allSettled(keys.map((k) => this.start(k)));
    },
    retryFailed() {
      const s = R.state.session;
      if (!s) return;
      const keys = [];
      for (const t of s.tasks.values()) {
        if (t.status === 'error') {
          if (t.errorKind === 'cors_or_network') continue; // source unavailable this session
          t.status = 'idle';
          keys.push(t.key);
        }
      }
      return this.runAll(keys);
    },
    all() {
      const s = R.state.session;
      return s ? [...s.tasks.values()] : [];
    },
    records() {
      return this.all().flatMap((t) => t.records || []);
    }
  };
})(window.RYLAQWorkspace);
