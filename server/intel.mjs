/*
 * JAQA Arsenal live-intelligence server endpoints (clean-room).
 *
 *   GET /api/jaqa/intel/sources              verified source catalogue
 *   GET /api/jaqa/intel/feed?id=ID           cached feed list (kind: feed)
 *   GET /api/jaqa/intel/lookup?id=ID&q=…     one strictly-validated lookup
 *
 * Only sources marked verified in config/intel-verification.json are served,
 * and only to their one allowlisted host. Inputs are validated to tight
 * patterns (CVE/GHSA id, owner/repo) before any request. Responses are cached
 * in memory; nothing is logged and no visitor data is sent upstream.
 * JAQA™ is a trademark of JAQA. © JAQA™. Licensed under AGPL-3.0-or-later.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, SOURCES, byId } from './intel-sources.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIMEOUT_MS = 12000;
const MAX_BYTES = 6 * 1024 * 1024;
const OK_TTL = 15 * 60 * 1000;
const FAIL_TTL = 2 * 60 * 1000;
export const USER_AGENT = `JAQA-Arsenal/1.0 (+https://jaqa.life${process.env.JAQA_CONTACT_EMAIL ? '; ' + process.env.JAQA_CONTACT_EMAIL : ''})`;

// Strict input patterns (reject anything else; no arbitrary URLs ever).
const VULN_ID = /^(?:CVE-\d{4}-\d{4,7}|GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}|[A-Z]{2,10}-\d{4}-\d{1,7})$/i;
const REPO_SLUG = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?\/[A-Za-z0-9._-]+$/;
const clean = (s) => String(s || '').trim();

/* ------------------------------ fetch ------------------------------ */
async function getJson(url, host) {
  // Defence in depth: the resolved URL must target the source's allowlisted host.
  let u;
  try { u = new URL(url); } catch { return { ok: false, error: 'bad_url' }; }
  if (u.protocol !== 'https:' || u.hostname !== host) return { ok: false, error: 'host_not_allowed' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(u.href, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, redirect: 'follow', signal: ctrl.signal });
    if (!resp.ok) return { ok: false, status: resp.status, error: 'http_' + resp.status };
    const reader = resp.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) { ctrl.abort(); return { ok: false, error: 'too_large' }; }
      chunks.push(value);
    }
    return { ok: true, status: resp.status, json: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
  } catch (e) {
    return { ok: false, error: ctrl.signal.aborted ? 'timeout' : 'network_or_parse' };
  } finally {
    clearTimeout(timer);
  }
}

/* ----------------------------- parsers ----------------------------- */
const str = (v, n) => clean(v).slice(0, n || 300);
export const PARSERS = {
  kev(json) {
    const rows = Array.isArray(json.vulnerabilities) ? json.vulnerabilities : [];
    const items = rows
      .map((v) => ({ cve: str(v.cveID, 20), vendor: str(v.vendorProject, 60), product: str(v.product, 60), name: str(v.vulnerabilityName, 200), dateAdded: str(v.dateAdded, 10), ransomware: str(v.knownRansomwareCampaignUse, 20) }))
      .filter((x) => /^CVE-/i.test(x.cve))
      .sort((a, b) => (a.dateAdded < b.dateAdded ? 1 : -1))
      .slice(0, 30);
    return { count: rows.length, catalogVersion: str(json.catalogVersion, 20), items };
  },
  epss(json) {
    const rows = (json && json.data) || [];
    return { items: rows.slice(0, 30).map((d) => ({ cve: str(d.cve, 20), epss: Number(d.epss) || 0, percentile: Number(d.percentile) || 0, date: str(d.date, 10) })).filter((x) => /^CVE-/i.test(x.cve)) };
  },
  scorecard(json) {
    const checks = Array.isArray(json.checks) ? json.checks : [];
    return {
      repo: str((json.repo && json.repo.name) || '', 120),
      score: typeof json.score === 'number' ? json.score : null,
      date: str(json.date, 10),
      checks: checks.map((c) => ({ name: str(c.name, 40), score: typeof c.score === 'number' ? c.score : null, reason: str(c.reason, 160) })).sort((a, b) => (a.score ?? -1) - (b.score ?? -1)).slice(0, 18)
    };
  },
  osv(json) {
    return {
      id: str(json.id, 40),
      summary: str(json.summary, 300),
      details: str(json.details, 600),
      published: str(json.published, 30),
      aliases: (json.aliases || []).slice(0, 8).map((a) => str(a, 30)),
      severity: (json.severity || []).slice(0, 3).map((s) => str(s.type + ':' + s.score, 60)),
      affected: (json.affected || []).slice(0, 8).map((a) => str((a.package && (a.package.ecosystem + '/' + a.package.name)) || '', 80)).filter(Boolean)
    };
  }
};

/* --------------------------- verification --------------------------- */
function verified() {
  const f = path.join(root, 'config', 'intel-verification.json');
  const v = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : { sources: {} };
  return { verifiedAt: v.verifiedAt || null, map: v.sources || {} };
}

/* ----------------------------- plugin ------------------------------ */
export function intelPlugin() {
  const { verifiedAt, map } = verified();
  const live = SOURCES.filter((s) => map[s.id] && map[s.id].verified);
  const liveById = new Map(live.map((s) => [s.id, s]));
  const feedCache = new Map();
  const lookupCache = new Map();

  const json = (res, code, body, maxAge) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', maxAge ? `public, max-age=${maxAge}` : 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(JSON.stringify(body));
  };

  async function feed(s) {
    const hit = feedCache.get(s.id);
    if (hit && hit.expires > Date.now()) return hit.body;
    const r = await getJson(s.url, s.host);
    const body = r.ok
      ? { ok: true, id: s.id, name: s.name, repo: s.repo, home: s.home, fetchedAt: new Date().toISOString(), data: PARSERS[s.format](r.json) }
      : { ok: false, id: s.id, name: s.name, repo: s.repo, home: s.home, error: r.error };
    feedCache.set(s.id, { body, expires: Date.now() + (r.ok ? OK_TTL : FAIL_TTL) });
    return body;
  }

  async function lookup(s, q) {
    const key = s.id + ':' + q;
    const hit = lookupCache.get(key);
    if (hit && hit.expires > Date.now()) return hit.body;
    const r = await getJson(s.url(q), s.host);
    const body = r.ok
      ? { ok: true, id: s.id, query: q, fetchedAt: new Date().toISOString(), data: PARSERS[s.format](r.json) }
      : { ok: false, id: s.id, query: q, error: r.status === 404 ? 'not_found' : r.error };
    lookupCache.set(key, { body, expires: Date.now() + (r.ok ? OK_TTL : FAIL_TTL) });
    if (lookupCache.size > 500) lookupCache.clear();
    return body;
  }

  const handler = async (req, res, next) => {
    if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/sources') {
      return json(res, 200, { verifiedAt, categories: CATEGORIES, sources: live.map((s) => ({ id: s.id, name: s.name, repo: s.repo, home: s.home, category: s.category, kind: s.kind, input: s.input || null, note: s.note })) }, 300);
    }
    if (url.pathname === '/feed') {
      const s = liveById.get(clean(url.searchParams.get('id')));
      if (!s || s.kind !== 'feed') return json(res, 404, { error: 'unknown_or_unverified_source' });
      const body = await feed(s);
      return json(res, body.ok ? 200 : 502, body, body.ok ? 300 : 0);
    }
    if (url.pathname === '/lookup') {
      const s = liveById.get(clean(url.searchParams.get('id')));
      if (!s || s.kind !== 'lookup') return json(res, 404, { error: 'unknown_or_unverified_source' });
      const q = clean(url.searchParams.get('q'));
      const valid = s.input === 'repo' ? REPO_SLUG.test(q) : VULN_ID.test(q);
      if (!valid) return json(res, 400, { error: 'invalid_input' });
      const body = await lookup(s, s.input === 'vulnId' ? q.toUpperCase() : q);
      return json(res, body.ok ? 200 : body.error === 'not_found' ? 404 : 502, body, body.ok ? 300 : 0);
    }
    return next();
  };

  return {
    name: 'jaqa-intel',
    enforce: 'pre',
    configurePreviewServer(server) {
      server.middlewares.use('/api/jaqa/intel', (req, res, next) => handler(req, res, next).catch(() => json(res, 500, { error: 'server_error' })));
    }
  };
}
