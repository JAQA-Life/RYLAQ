#!/usr/bin/env node
/*
 * Assembles the ready-to-run Hostinger (Node.js) deployment:
 *   node scripts/package-hostinger.mjs              → release/jaqa-hostinger.zip (jaqa/…)
 *   node scripts/package-hostinger.mjs --dir <path> → that folder (used by the
 *        publish-hostinger-node workflow for the `hostinger-node` branch)
 * Runtime dependencies are declared in the ROOT package.json (with an exact
 * package-lock.json), because Hostinger's Node.js apps run `npm install` at the
 * repository root; nothing needs to be compiled there.
 *
 * Contents: the built JAQA site (dist/), the unified server (server/), monitor
 * verification (config/), and God's Eye View (apps/globe: source needed by its
 * providers + the built client in apps/globe/dist; no node_modules, tests or
 * docs media). Run after `npm run build:all`. Needs the `zip` command.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dirArg = process.argv.indexOf('--dir');
const outDir = dirArg > 0 ? path.resolve(process.argv[dirArg + 1]) : null;
const stageRoot = path.join(root, 'release', 'stage');
const stage = outDir || path.join(stageRoot, 'jaqa');
const out = path.join(root, 'release', 'jaqa-hostinger.zip');

for (const need of ['dist/index.html', 'dist/.htaccess', 'apps/globe/dist/index.html', 'apps/globe/dist/cesium/Cesium.js', 'config/monitor-verification.json']) {
  if (!existsSync(path.join(root, need))) {
    console.error('Missing ' + need + ' — run `npm run build:all` first.');
    process.exit(1);
  }
}
if (outDir) {
  // Keep a .git entry (the publish workflow's worktree link); replace everything else.
  mkdirSync(stage, { recursive: true });
  for (const f of readdirSync(stage)) if (f !== '.git') rmSync(path.join(stage, f), { recursive: true, force: true });
} else {
  rmSync(stageRoot, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
}

const copy = (from, to = from, filter) => cpSync(path.join(root, from), path.join(stage, to), { recursive: true, filter: filter ? (src) => filter(path.relative(root, src)) : undefined });
copy('dist');
copy('server');
copy('config/monitor-verification.json');
copy('scripts/build-globe.mjs');
copy('scripts/hostinger-build.mjs');
copy('LICENSE');
copy('THIRD_PARTY_NOTICES.md');
copy('licenses');
copy('docs/DEPLOY-NODE.md', 'DEPLOY-HOSTINGER.md');
copy('docs/DEPLOY-HOSTINGER-GITHUB.md', 'README.md');
// God's Eye View: everything its server and a rebuild need; not node_modules, tests or docs.
const globeFiles = (rel) => {
  const r = rel.split(path.sep).join('/');
  if (/^apps\/globe\/(node_modules|docs|screenshots)(\/|$)/.test(r)) return false;
  if (/\.test\.mjs$/.test(r)) return false;
  if (/^apps\/globe\/\.env(\..*)?$/.test(r) && !r.endsWith('.env.example')) return false; // never ship credentials
  return true;
};
copy('apps/globe', 'apps/globe', globeFiles);

const globePkg = JSON.parse(readFileSync(path.join(root, 'apps', 'globe', 'package.json'), 'utf8'));
writeFileSync(
  path.join(stage, 'package.json'),
  JSON.stringify(
    {
      name: 'jaqa-site',
      version: '1.0.0',
      private: true,
      description: 'JAQA site: workspace (/), JAQA Eye View 3D globe (/globe/) and data APIs (/api/) in one Node.js server.',
      type: 'module',
      main: 'server/jaqa-server.mjs',
      engines: { node: '>=24.14' },
      scripts: {
        build: 'node scripts/hostinger-build.mjs',
        start: 'node server/jaqa-server.mjs',
        setup: 'npm ci --omit=dev',
        'build:globe': 'node scripts/build-globe.mjs'
      },
      // God's Eye View's runtime dependencies (installed at the root so every
      // module under apps/globe resolves them by walking up the tree).
      dependencies: globePkg.dependencies,
      license: 'AGPL-3.0-or-later'
    },
    null,
    2
  ) + '\n'
);
// Exact, reproducible install for Hostinger (`npm ci`/`npm install`): seeded
// from God's Eye View's lockfile so the tested versions are kept (npm only
// prunes the dev-only packages).
cpSync(path.join(root, 'apps', 'globe', 'package-lock.json'), path.join(stage, 'package-lock.json'));
execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: stage, stdio: 'inherit' });
writeFileSync(path.join(stage, '.nvmrc'), '24\n');
writeFileSync(path.join(stage, '.gitignore'), 'node_modules/\n.env\n.env.*\n!.env.example\napps/globe/.env\napps/globe/dist-next/\n');
// God's Eye View's own .gitignore excludes `dist`; in the deploy branch the
// built globe IS the payload, so keep every rule except that one.
{
  const gi = path.join(stage, 'apps', 'globe', '.gitignore');
  const kept = readFileSync(gi, 'utf8').split('\n').filter((l) => l.trim() !== 'dist' && l.trim() !== '/dist' && l.trim() !== 'dist/');
  writeFileSync(gi, kept.join('\n'));
}

if (outDir) {
  console.log('wrote deployment to ' + outDir);
  process.exit(0);
}
rmSync(out, { force: true });
execFileSync('zip', ['-q', '-r', '-X', out, 'jaqa'], { cwd: stageRoot });
rmSync(stageRoot, { recursive: true, force: true });
const mb = (statSync(out).size / 1048576).toFixed(1);
console.log(`wrote release/jaqa-hostinger.zip (${mb} MB)`);
