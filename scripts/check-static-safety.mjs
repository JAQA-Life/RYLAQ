#!/usr/bin/env node
/*
 * RYLAQ static safety checker (dev/CI only).
 * Scans dist/, embed/ and src/ and FAILS on anything that would break the
 * privacy, legal, branding or static-hosting guarantees:
 *   - browser storage / cookies / service workers
 *   - eval / new Function / innerHTML-style sinks / document.write
 *   - URL state writes (pushState/replaceState/location.hash=) that could leak queries
 *   - console.log (search terms must never be logged)
 *   - hardcoded API keys or secrets
 *   - external font CDNs, unnecessary script/style CDNs, analytics/tracking domains
 *   - proxy / backend endpoints
 *   - target="_blank" without rel="noopener noreferrer"
 *   - legacy brand names or oncology branding
 *   - RYLAQ™ outside legal/copyright/disclaimer/export-metadata contexts
 * It also asserts that required legal text and privacy architecture exist.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = ['dist', 'embed', 'src'];
const EXT = /\.(html|js|css|htaccess|json|txt|mjs)$|^\.htaccess$/;

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (EXT.test(f)) out.push(p);
  }
  return out;
}

// Assembled from parts so this checker does not flag itself if ever scanned.
const j = (...p) => p.join('');
const RULES = [
  [new RegExp(j('local', 'Storage')), 'browser storage (local)'],
  [new RegExp(j('session', 'Storage')), 'browser storage (session)'],
  [new RegExp(j('indexed', 'DB'), 'i'), 'browser database'],
  [new RegExp(j('document', '\\.cookie')), 'cookies'],
  [new RegExp(j('navigator', '\\.serviceWorker')), 'service worker'],
  [new RegExp(j('serviceWorker', '\\.register')), 'service worker registration'],
  [new RegExp(j('\\beval', '\\s*\\(')), 'eval('],
  [new RegExp(j('new ', 'Function\\s*\\(')), 'new Function('],
  [new RegExp(j('\\.inner', 'HTML\\s*=')), 'innerHTML assignment'],
  [new RegExp(j('\\.outer', 'HTML\\s*=')), 'outerHTML assignment'],
  [new RegExp(j('insertAdjacent', 'HTML')), 'insertAdjacentHTML'],
  [new RegExp(j('document\\.', 'write\\s*\\(')), 'document.write'],
  [new RegExp(j('push', 'State\\s*\\(')), 'history.pushState (URL state)'],
  [new RegExp(j('replace', 'State\\s*\\(')), 'history.replaceState (URL state)'],
  [new RegExp(j('location\\.hash\\s*', '=[^=]')), 'location.hash write'],
  [new RegExp(j('console', '\\.log\\s*\\(')), 'console.log (may log search terms)'],
  [new RegExp(j('Risk', 'Chain'), 'i'), 'legacy brand name'],
  [new RegExp(j('Onco', 'tics'), 'i'), 'legacy brand name'],
  [new RegExp(j('Onco', 'Gx'), 'i'), 'legacy brand name'],
  [new RegExp(j('oncolog'), 'i'), 'oncology branding'],
  [/fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|fonts\.bunny\.net|fontawesome|kit\.fontawesome/i, 'external font / icon CDN'],
  [/<script[^>]+src=["']https?:/i, 'external script'],
  [/<link[^>]+rel=["']stylesheet["'][^>]+href=["']https?:/i, 'external stylesheet'],
  [/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|code\.jquery\.com|cdn\.tailwindcss\.com/i, 'unnecessary CDN'],
  [/google-analytics\.com|googletagmanager\.com|\bgtag\s*\(|connect\.facebook\.net|hotjar\.com|cdn\.segment\.com|mixpanel\.com|plausible\.io|clarity\.ms|doubleclick\.net|fullstory\.com|amplitude\.com|heapanalytics\.com|matomo\./i, 'analytics / tracking'],
  [/cors-anywhere|allorigins|corsproxy|thingproxy|\/api\/proxy|https?:\/\/localhost|127\.0\.0\.1/i, 'proxy / backend endpoint'],
  [/AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|ghp_[A-Za-z0-9]{36}|sk-[A-Za-z0-9]{24,}|xox[bpa]-[A-Za-z0-9-]{10,}/, 'hardcoded credential'],
  [/(api[_-]?key|apikey|access[_-]?token|client[_-]?secret)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/i, 'hardcoded API key'],
  [/[?&](api_key|apikey|token)=[A-Za-z0-9_\-]{16,}/i, 'API key in URL']
];

const LEGAL_CONTEXT = /(©|trademark|legal|disclaim|advice|responsible|independent|affiliat|All rights reserved|RYLAQ™ does not|notice)/i;

const failures = [];
const fail = (file, line, msg, text) => failures.push(`${path.relative(root, file)}:${line}  ${msg}${text ? '  →  ' + text.trim().slice(0, 140) : ''}`);

const files = TARGETS.flatMap((t) => walk(path.join(root, t))).concat(existsSync(path.join(root, 'dist', '.htaccess')) ? [path.join(root, 'dist', '.htaccess')] : []);
const seen = new Set();
for (const file of files) {
  if (seen.has(file)) continue;
  seen.add(file);
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((ln, i) => {
    for (const [re, msg] of RULES) if (re.test(ln)) fail(file, i + 1, msg, ln);
    // target=_blank must always travel with rel="noopener noreferrer"
    if (/_blank/.test(ln) && !/noopener noreferrer/.test(ln)) fail(file, i + 1, 'target _blank without rel="noopener noreferrer"', ln);
    if (/<a\s[^>]*target=["']_blank["'][^>]*>/i.test(ln) && !/rel=["'][^"']*noopener[^"']*noreferrer/i.test(ln)) fail(file, i + 1, 'anchor _blank without rel', ln);
    // RYLAQ™ only in legal/copyright/privacy/disclaimer/export metadata contexts
    if (/RYLAQ™/.test(ln) && !LEGAL_CONTEXT.test(ln)) fail(file, i + 1, 'RYLAQ™ outside a legal context', ln);
    if (/RYLAQ™[\w-]*\.(json|csv)/.test(ln)) fail(file, i + 1, 'RYLAQ™ in an export filename', ln);
    if (/<title>[^<]*™/.test(ln)) fail(file, i + 1, 'Trademark symbol in page title', ln);
    if (/<h1[^>]*>[^<]*™/.test(ln) || /'h1',[^)]*™/.test(ln)) fail(file, i + 1, 'Trademark symbol in main heading', ln);
  });
}

/* Required content assertions on the production artifact. */
const distIndex = path.join(root, 'dist', 'index.html');
if (!existsSync(distIndex)) failures.push('dist/index.html missing — run npm run build');
else {
  const d = readFileSync(distIndex, 'utf8');
  const must = [
    [/RYLAQ™\. All rights reserved\./, 'footer copyright “© {year} RYLAQ™. All rights reserved.”'],
    [/RYLAQ™ is a trademark of RYLAQ\./, 'trademark notice'],
    [/does not store, proxy, log, persist, or analyze user searches/, 'privacy statement'],
    [/Do not enter confidential contract terms/, 'commercial confidentiality warning'],
    [/No public match found does not mean cleared/, 'no-hit ≠ clear warning'],
    [/"trademark": 'RYLAQ™'|trademark: 'RYLAQ™'/, 'export legal metadata block'],
    [/cache: 'no-store'/, 'fetch cache: no-store'],
    [/credentials: 'omit'/, 'fetch credentials: omit'],
    [/AbortController/, 'AbortController'],
    [/Promise\.allSettled/, 'Promise.allSettled'],
    [/id="rylaq-workspace" class="rylaq-workspace"/, 'root container'],
    [/window\.RYLAQWorkspace|global\.RYLAQWorkspace/, 'global namespace'],
    [/<title>RYLAQ Global Risk, Finance, Insurance &amp; Procurement Intelligence Workspace<\/title>/, 'page title'],
    [/type="file"/, null] // must NOT exist (checked below)
  ];
  for (const [re, label] of must) {
    if (label === null) {
      if (re.test(d)) failures.push('dist/index.html contains a file upload input (not allowed in MVP)');
      continue;
    }
    if (!re.test(d)) failures.push('dist/index.html missing required content: ' + label);
  }
  if (/geolocation\.getCurrentPosition|getUserMedia|clipboard\.readText|clipboard\.read\(/.test(d)) failures.push('dist/index.html requests a prohibited browser permission (geolocation / media / clipboard read)');
}
const ht = path.join(root, 'dist', '.htaccess');
if (!existsSync(ht)) failures.push('dist/.htaccess missing');
else {
  const h = readFileSync(ht, 'utf8');
  for (const need of ['Options -Indexes', 'X-Content-Type-Options', 'X-Frame-Options "DENY"', 'Referrer-Policy "no-referrer"', 'Permissions-Policy', 'Cross-Origin-Opener-Policy', 'Cross-Origin-Resource-Policy', 'Content-Security-Policy', "frame-ancestors 'none'", "object-src 'none'"])
    if (!h.includes(need)) failures.push('dist/.htaccess missing: ' + need);
}

if (failures.length) {
  console.error(`Static safety check FAILED (${failures.length} issue${failures.length > 1 ? 's' : ''}):\n`);
  failures.forEach((f) => console.error('  ✗ ' + f));
  process.exit(1);
}
console.log(`Static safety check passed (${seen.size} files scanned in ${TARGETS.join(', ')}).`);
