#!/usr/bin/env node
/*
 * Assembles the Hostinger (Node.js / VPS) deployment bundle:
 *   release/jaqa-hostinger.zip  →  jaqa/…  (upload, `npm run setup`, `npm start`)
 *
 * Contents: the built JAQA site (dist/), the unified server (server/), monitor
 * verification (config/), and God's Eye View (apps/globe: source needed by its
 * providers + the built client in apps/globe/dist; no node_modules, tests or
 * docs media). Run after `npm run build:all`. Needs the `zip` command.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stageRoot = path.join(root, 'release', 'stage');
const stage = path.join(stageRoot, 'jaqa');
const out = path.join(root, 'release', 'jaqa-hostinger.zip');

for (const need of ['dist/index.html', 'dist/.htaccess', 'apps/globe/dist/index.html', 'apps/globe/dist/cesium/Cesium.js', 'config/monitor-verification.json']) {
  if (!existsSync(path.join(root, need))) {
    console.error('Missing ' + need + ' — run `npm run build:all` first.');
    process.exit(1);
  }
}
rmSync(stageRoot, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

const copy = (from, to = from, filter) => cpSync(path.join(root, from), path.join(stage, to), { recursive: true, filter: filter ? (src) => filter(path.relative(root, src)) : undefined });
copy('dist');
copy('server');
copy('config/monitor-verification.json');
copy('scripts/build-globe.mjs');
copy('LICENSE');
copy('THIRD_PARTY_NOTICES.md');
copy('docs/DEPLOY-NODE.md', 'DEPLOY-HOSTINGER.md');
// God's Eye View: everything its server and a rebuild need; not node_modules, tests or docs.
const globeFiles = (rel) => {
  const r = rel.split(path.sep).join('/');
  if (/^apps\/globe\/(node_modules|docs|screenshots)(\/|$)/.test(r)) return false;
  if (/\.test\.mjs$/.test(r)) return false;
  if (/^apps\/globe\/\.env(\..*)?$/.test(r) && !r.endsWith('.env.example')) return false; // never ship credentials
  return true;
};
copy('apps/globe', 'apps/globe', globeFiles);

writeFileSync(
  path.join(stage, 'package.json'),
  JSON.stringify(
    {
      name: 'jaqa-site',
      version: '1.0.0',
      private: true,
      description: 'JAQA site: workspace (/), God’s Eye View 3D globe (/globe/) and data APIs (/api/) in one Node.js server.',
      type: 'module',
      engines: { node: '>=24.14' },
      scripts: {
        setup: 'npm ci --omit=dev --prefix apps/globe',
        start: 'node server/jaqa-server.mjs',
        'build:globe': 'node scripts/build-globe.mjs'
      },
      license: 'UNLICENSED'
    },
    null,
    2
  ) + '\n'
);

rmSync(out, { force: true });
execFileSync('zip', ['-q', '-r', '-X', out, 'jaqa'], { cwd: stageRoot });
rmSync(stageRoot, { recursive: true, force: true });
const mb = (statSync(out).size / 1048576).toFixed(1);
console.log(`wrote release/jaqa-hostinger.zip (${mb} MB)`);
