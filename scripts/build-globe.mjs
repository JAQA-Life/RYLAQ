#!/usr/bin/env node
/*
 * Builds the integrated God's Eye View 3D globe (apps/globe, MIT licence,
 * © Bilawal Sidhu) for serving at /globe/ by server/jaqa-server.mjs.
 *
 *   node scripts/build-globe.mjs     (needs Node >= 24.14 and `npm ci` in apps/globe)
 *
 * GOOGLE_MAPS_API_KEY / CESIUM_ION_TOKEN, if set in the environment at build
 * time, are embedded in the browser bundle by God's Eye View's own build (they
 * are browser-side keys by design): restrict them to your domain in the
 * provider console. Nothing is hardcoded here.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const globe = path.join(root, 'apps', 'globe');
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 24 || (major === 24 && minor < 14)) {
  console.error(`JAQA Eye View requires Node >= 24.14 (running ${process.versions.node}).`);
  process.exit(1);
}
// Vite: apps/globe/node_modules (development) or the root node_modules (deploy branch).
const vite = [path.join(globe, 'node_modules', 'vite', 'bin', 'vite.js'), path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')].find((p) => existsSync(p));
if (!vite) {
  console.error('Vite not found: run `npm ci` in apps/globe (development) or `npm install` (deploy branch).');
  process.exit(1);
}

// vite-plugin-cesium reads Cesium from <apps/globe>/node_modules/cesium. In the
// deploy branch Cesium is installed at the repository root, so link it there.
const localCesium = path.join(globe, 'node_modules', 'cesium');
const rootCesium = path.join(root, 'node_modules', 'cesium');
if (!existsSync(localCesium) && existsSync(rootCesium)) {
  mkdirSync(path.dirname(localCesium), { recursive: true });
  symlinkSync(path.relative(path.dirname(localCesium), rootCesium), localCesium, 'dir');
}

// Build into a temporary folder and swap it in only after it is verified, so a
// failed rebuild never breaks the globe that is currently being served.
const dist = path.join(globe, 'dist');
const next = path.join(globe, 'dist-next');
rmSync(next, { recursive: true, force: true });
const r = spawnSync(process.execPath, [vite, 'build', '--base', '/globe/', '--outDir', 'dist-next', '--emptyOutDir'], { cwd: globe, stdio: 'inherit' });
if (r.status !== 0) {
  rmSync(next, { recursive: true, force: true });
  console.error('Globe build failed; the existing apps/globe/dist was left unchanged.');
  process.exit(r.status || 1);
}
// vite-plugin-cesium writes Cesium's static files under <outDir>/<base>/cesium,
// while the page requests <base>cesium/…; move them so /globe/cesium/ resolves.
const nested = path.join(next, 'globe', 'cesium');
if (existsSync(nested)) {
  rmSync(path.join(next, 'cesium'), { recursive: true, force: true });
  renameSync(nested, path.join(next, 'cesium'));
  rmSync(path.join(next, 'globe'), { recursive: true, force: true });
}
if (!existsSync(path.join(next, 'cesium', 'Cesium.js')) || !existsSync(path.join(next, 'index.html'))) {
  rmSync(next, { recursive: true, force: true });
  console.error('Cesium runtime missing from the new build; the existing apps/globe/dist was left unchanged.');
  process.exit(1);
}
rmSync(dist, { recursive: true, force: true });
renameSync(next, dist);
console.log('JAQA Eye View built to apps/globe/dist (served at /globe/).');
