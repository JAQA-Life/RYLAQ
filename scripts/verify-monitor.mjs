#!/usr/bin/env node
/*
 * Verifies every Global Monitor candidate feed (server/monitor-feeds.mjs) by
 * fetching and parsing it exactly as the server does. Writes
 * config/monitor-verification.json; the server serves ONLY feeds marked
 * verified there. Run from a network that can reach the publishers (the
 * "Verify monitor feeds" GitHub workflow does this).
 *   node scripts/verify-monitor.mjs [--print]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEEDS } from '../server/monitor-feeds.mjs';
import { fetchFeed, USER_AGENT } from '../server/monitor.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = {};
for (const f of FEEDS) {
  const r = await fetchFeed(f);
  const items = r.ok ? r.items : [];
  results[f.id] = {
    verified: r.ok && items.length > 0,
    status: r.status,
    error: r.ok ? (items.length ? null : 'no_items_parsed') : r.error,
    items: items.length,
    withCoordinates: items.filter((x) => Number.isFinite(x.lat)).length,
    withDates: items.filter((x) => x.published).length,
    sampleTitle: items[0] ? items[0].title.slice(0, 120) : null
  };
  console.log(`${results[f.id].verified ? 'PASS' : 'FAIL'}  ${f.id.padEnd(20)} HTTP ${String(r.status).padEnd(4)} items=${items.length} geo=${results[f.id].withCoordinates} ${results[f.id].error || ''}`);
}
const out = {
  verifiedAt: new Date().toISOString(),
  runner: process.env.GITHUB_RUN_ID ? 'github-actions:' + process.env.GITHUB_RUN_ID : 'local',
  userAgent: USER_AGENT,
  method: 'Server-side GET of each allowlisted feed with the production parser; verified = HTTP 2xx and at least one item with a title and an http(s) link.',
  feeds: results
};
mkdirSync(path.join(root, 'config'), { recursive: true });
writeFileSync(path.join(root, 'config', 'monitor-verification.json'), JSON.stringify(out, null, 2) + '\n');
const pass = Object.values(results).filter((x) => x.verified).length;
console.log(`\n${pass}/${FEEDS.length} feeds verified`);
if (process.argv.includes('--print')) console.log('JAQA_MONITOR_CONFIG=' + JSON.stringify(out));
