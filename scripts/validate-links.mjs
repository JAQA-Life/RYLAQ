#!/usr/bin/env node
/*
 * Link sanity checker (dev/CI). Extracts every https:// URL from src/ and
 * validates syntax, HTTPS-only, and template placeholders. With --online it
 * also requests each link-out URL (HEAD, falling back to GET) sequentially
 * with a short timeout and reports non-2xx/3xx results as warnings (sites
 * often block bots, so online failures never fail the build).
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const online = process.argv.includes('--online');
const files = [];
for (const d of ['src/modules', 'src/assets']) for (const f of readdirSync(path.join(root, d))) if (/\.js$/.test(f)) files.push(path.join(root, d, f));

const urls = new Map();
const problems = [];
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/(['"`])(https?:\/\/[^'"`\s]+)\1/g)) {
    const u = m[2];
    if (u.includes('${')) continue; // runtime-built URLs are validated by their builders
    if (u === 'http://www.w3.org/2000/svg') continue; // XML namespace identifier, not a link
    if (!u.startsWith('https://')) problems.push(`${path.relative(root, f)}: non-HTTPS URL ${u}`);
    const probe = u.replace(/\{q\}|\{id\}/g, 'test');
    try {
      new URL(probe);
    } catch {
      problems.push(`${path.relative(root, f)}: invalid URL ${u}`);
    }
    if (/\{(?!q\}|id\})[^}]*\}/.test(u)) problems.push(`${path.relative(root, f)}: unknown placeholder in ${u}`);
    if (!urls.has(u)) urls.set(u, path.relative(root, f));
  }
}

if (problems.length) {
  console.error('Link validation FAILED:\n' + problems.map((p) => '  ✗ ' + p).join('\n'));
  process.exit(1);
}
console.log(`Link syntax check passed (${urls.size} unique URLs).`);

if (online) {
  const skip = /api\.|\/api\/|data\.sec\.gov|efts\.sec\.gov|raw\.githubusercontent|services\.nvd|echodata|overpass|RestWebServices|interpreter/;
  let warn = 0;
  for (const [u] of urls) {
    if (skip.test(u) || /\{/.test(u)) continue;
    const ctrl = AbortSignal.timeout(12000);
    let status = 0;
    try {
      let r = await fetch(u, { method: 'HEAD', redirect: 'follow', signal: ctrl });
      if (r.status >= 400) r = await fetch(u, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(12000) });
      status = r.status;
    } catch {
      status = 0;
    }
    if (!(status >= 200 && status < 400)) {
      warn++;
      console.warn(`  ⚠ ${status || 'ERR'}  ${u}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log(`Online check complete: ${warn} warning(s). Bot-blocking sites may report 403 even when the link works in a browser.`);
}
