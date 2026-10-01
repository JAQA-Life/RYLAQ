/*
 * JAQA Global Monitor server endpoints (clean-room; no WorldMonitor code).
 *
 *   GET /api/jaqa/monitor/feeds        verified feed catalogue
 *   GET /api/jaqa/monitor/feed?id=ID   latest headlines for one verified feed
 *
 * Fetches only allowlisted official feeds (server/monitor-feeds.mjs) that are
 * marked verified in config/monitor-verification.json. Returns headline, link,
 * date and coordinates (when the publisher supplies them) — never article text.
 * Responses are cached in memory (10 min on success, 2 min on failure). Nothing
 * is logged and no visitor data is sent upstream: requests go from this server
 * to the publisher with a fixed User-Agent.
 * JAQA™ is a trademark of JAQA. © JAQA™. All rights reserved.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, FEEDS } from './monitor-feeds.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_ITEMS = 40;
const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 12000;
const OK_TTL = 10 * 60 * 1000;
const FAIL_TTL = 2 * 60 * 1000;

export const USER_AGENT = `JAQA-Monitor/1.0 (+https://jaqa.life${process.env.JAQA_CONTACT_EMAIL ? '; ' + process.env.JAQA_CONTACT_EMAIL : ''})`;

/* ------------------------------ parsing ------------------------------ */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decode(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') {
        const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ' ';
      }
      return ENT[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}
const tag = (block, names) => {
  for (const n of names) {
    const m = new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i').exec(block);
    if (m) return m[1];
  }
  return '';
};
const safeLink = (u) => {
  try {
    const x = new URL(decode(u));
    return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : null;
  } catch {
    return null;
  }
};
const isoDate = (s) => {
  const t = Date.parse(decode(s));
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};
const coord = (lat, lon) => {
  const a = Number(lat), b = Number(lon);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 ? { lat: a, lon: b } : null;
};

export function parseRss(xml) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  const out = [];
  for (const b of blocks.slice(0, MAX_ITEMS)) {
    const title = decode(tag(b, ['title'])).slice(0, 300);
    let link = safeLink(tag(b, ['link']));
    if (!link) {
      const alt = /<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i.exec(b) || /<link\b[^>]*href=["']([^"']+)["']/i.exec(b);
      link = alt ? safeLink(alt[1]) : null;
    }
    if (!link) link = safeLink(tag(b, ['guid', 'id']));
    const published = isoDate(tag(b, ['pubDate', 'published', 'updated', 'dc:date']));
    const pt = /<georss:point>\s*([-\d.]+)\s+([-\d.]+)\s*<\/georss:point>/i.exec(b);
    const geo = pt ? coord(pt[1], pt[2]) : coord(decode(tag(b, ['geo:lat'])) || NaN, decode(tag(b, ['geo:long', 'geo:lon'])) || NaN);
    if (title && link) out.push({ title, link, published, ...(geo || {}) });
  }
  return out;
}

export function parseEonet(json) {
  return (json.events || []).slice(0, MAX_ITEMS).map((e) => {
    const g = (e.geometry || [])[e.geometry ? e.geometry.length - 1 : 0] || {};
    const c = g.type === 'Point' && Array.isArray(g.coordinates) ? coord(g.coordinates[1], g.coordinates[0]) : null;
    const src = (e.sources || [])[0];
    return {
      title: decode(e.title).slice(0, 300) + (e.categories && e.categories[0] ? ' — ' + decode(e.categories[0].title) : ''),
      link: safeLink(src && src.url) || safeLink(e.link),
      published: isoDate(g.date || ''),
      ...(c || {})
    };
  }).filter((x) => x.title && x.link);
}

export function parseGeojson(json) {
  return (json.features || []).slice(0, MAX_ITEMS).map((f) => {
    const p = f.properties || {};
    const c = f.geometry && Array.isArray(f.geometry.coordinates) ? coord(f.geometry.coordinates[1], f.geometry.coordinates[0]) : null;
    return { title: decode(p.title || p.place).slice(0, 300), link: safeLink(p.url), published: Number.isFinite(p.time) ? new Date(p.time).toISOString() : null, ...(c || {}) };
  }).filter((x) => x.title && x.link);
}

/** Fetch and parse one catalogue feed (used by the server and the verifier). */
export async function fetchFeed(feed) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(feed.url, {
      headers: { 'User-Agent': USER_AGENT, Accept: feed.format === 'rss' ? 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5' : 'application/json' },
      redirect: 'follow',
      signal: ctrl.signal
    });
    if (!resp.ok) return { ok: false, status: resp.status, error: 'http_' + resp.status };
    const reader = resp.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) {
        ctrl.abort();
        return { ok: false, status: resp.status, error: 'too_large' };
      }
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    let items;
    if (feed.format === 'rss') items = parseRss(text);
    else {
      const json = JSON.parse(text);
      items = feed.format === 'eonet' ? parseEonet(json) : parseGeojson(json);
    }
    return { ok: true, status: resp.status, items };
  } catch (e) {
    return { ok: false, status: 0, error: ctrl.signal.aborted ? 'timeout' : 'network_or_parse' };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------------------- endpoints ---------------------------- */
function verifiedFeeds() {
  const f = path.join(root, 'config', 'monitor-verification.json');
  const v = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : { feeds: {} };
  return { verifiedAt: v.verifiedAt || null, feeds: FEEDS.filter((x) => v.feeds && v.feeds[x.id] && v.feeds[x.id].verified) };
}

export function monitorPlugin() {
  const { verifiedAt, feeds } = verifiedFeeds();
  const byId = new Map(feeds.map((f) => [f.id, f]));
  const cache = new Map();
  const inflight = new Map();
  const json = (res, code, body, maxAge) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', maxAge ? `public, max-age=${maxAge}` : 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(JSON.stringify(body));
  };
  const handler = async (req, res, next) => {
    const url = new URL(req.url, 'http://x');
    if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });
    if (url.pathname === '/feeds') {
      return json(res, 200, { verifiedAt, categories: CATEGORIES, feeds: feeds.map(({ id, name, publisher, category, home }) => ({ id, name, publisher, category, home })) }, 300);
    }
    if (url.pathname === '/feed') {
      const feed = byId.get(url.searchParams.get('id') || '');
      if (!feed) return json(res, 404, { error: 'unknown_or_unverified_feed' });
      const hit = cache.get(feed.id);
      if (hit && hit.expires > Date.now()) return json(res, hit.body.ok ? 200 : 502, hit.body, hit.body.ok ? 300 : 0);
      if (!inflight.has(feed.id)) {
        inflight.set(
          feed.id,
          fetchFeed(feed).then((r) => {
            const body = r.ok
              ? { ok: true, id: feed.id, name: feed.name, publisher: feed.publisher, home: feed.home, fetchedAt: new Date().toISOString(), items: r.items }
              : { ok: false, id: feed.id, name: feed.name, publisher: feed.publisher, home: feed.home, error: r.error };
            cache.set(feed.id, { body, expires: Date.now() + (r.ok ? OK_TTL : FAIL_TTL) });
            return body;
          }).finally(() => inflight.delete(feed.id))
        );
      }
      const body = await inflight.get(feed.id);
      return json(res, body.ok ? 200 : 502, body, body.ok ? 300 : 0);
    }
    return next();
  };
  return {
    name: 'jaqa-monitor',
    enforce: 'pre',
    configurePreviewServer(server) {
      server.middlewares.use('/api/jaqa/monitor', (req, res, next) => handler(req, res, next).catch(() => json(res, 500, { error: 'server_error' })));
    }
  };
}
