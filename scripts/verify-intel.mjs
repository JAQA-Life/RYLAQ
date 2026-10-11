#!/usr/bin/env node
/*
 * verify-intel.mjs — fetch every candidate Arsenal live-intel source with the
 * production parser, from an open-network runner. A source is "verified" when
 * its probe returns HTTP 2xx and the parser yields a non-empty, well-formed
 * result. Prints config/intel-verification.json; commit that file so the server
 * serves only verified sources (same model as verify-monitor.mjs).
 *
 *   node scripts/verify-intel.mjs            # write config/intel-verification.json
 *   node scripts/verify-intel.mjs --print    # also print it (CI copies this)
 * JAQA™ is a trademark of JAQA. © JAQA™. Licensed under AGPL-3.0-or-later.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES } from '../server/intel-sources.mjs';
import { PARSERS, USER_AGENT } from '../server/intel.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const printOnly = process.argv.includes('--print');

async function probe(s) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const resp = await fetch(s.probe, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, redirect: 'follow', signal: ctrl.signal });
    if (!resp.ok) return { verified: false, status: resp.status, error: 'http_' + resp.status };
    const json = await resp.json();
    const parsed = PARSERS[s.format](json);
    // "Non-empty" differs by shape: feeds have items; lookups/posture have a key field.
    const ok = s.format === 'kev' || s.format === 'epss' ? (parsed.items && parsed.items.length > 0)
      : s.format === 'scorecard' ? typeof parsed.score === 'number'
      : s.format === 'osv' ? Boolean(parsed.id)
      : false;
    return { verified: ok, status: resp.status, error: ok ? null : 'empty_or_unparsable', sample: s.format === 'scorecard' ? parsed.score : s.format === 'osv' ? parsed.id : (parsed.items || [])[0] };
  } catch (e) {
    return { verified: false, status: 0, error: ctrl.signal.aborted ? 'timeout' : 'network_or_parse' };
  } finally {
    clearTimeout(timer);
  }
}

const sources = {};
for (const s of SOURCES) {
  process.stderr.write(`probing ${s.id} … `);
  const r = await probe(s);
  sources[s.id] = r;
  process.stderr.write((r.verified ? 'OK' : 'FAIL ' + r.error) + '\n');
}
const out = {
  verifiedAt: new Date().toISOString(),
  runner: process.env.GITHUB_RUN_ID ? 'github-actions:' + process.env.GITHUB_RUN_ID : 'local',
  userAgent: USER_AGENT,
  method: 'Server-side GET of each source probe with the production parser; verified = HTTP 2xx and a non-empty parsed result.',
  sources
};
const text = JSON.stringify(out, null, 2) + '\n';
writeFileSync(path.join(root, 'config', 'intel-verification.json'), text);
const n = Object.values(sources).filter((s) => s.verified).length;
process.stderr.write(`\nwrote config/intel-verification.json — ${n}/${SOURCES.length} sources verified.\n`);
if (printOnly) {
  console.log('----- BEGIN config/intel-verification.json -----');
  console.log(text);
  console.log('----- END config/intel-verification.json -----');
}
