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
import { existsSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const globe = path.join(root, 'apps', 'globe');
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 24 || (major === 24 && minor < 14)) {
  console.error(`God's Eye View requires Node >= 24.14 (running ${process.versions.node}).`);
  process.exit(1);
}
if (!existsSync(path.join(globe, 'node_modules', 'vite'))) {
  console.error('Run `npm ci` in apps/globe first.');
  process.exit(1);
}

const vite = path.join(globe, 'node_modules', 'vite', 'bin', 'vite.js');
const r = spawnSync(process.execPath, [vite, 'build', '--base', '/globe/'], { cwd: globe, stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status || 1);

// vite-plugin-cesium writes Cesium's static files under <outDir>/<base>/cesium,
// while the page requests <base>cesium/…; move them so /globe/cesium/ resolves.
const dist = path.join(globe, 'dist');
const nested = path.join(dist, 'globe', 'cesium');
if (existsSync(nested)) {
  rmSync(path.join(dist, 'cesium'), { recursive: true, force: true });
  renameSync(nested, path.join(dist, 'cesium'));
  rmSync(path.join(dist, 'globe'), { recursive: true, force: true });
}
if (!existsSync(path.join(dist, 'cesium', 'Cesium.js'))) {
  console.error('Cesium runtime missing from apps/globe/dist/cesium');
  process.exit(1);
}
console.log('God\'s Eye View built to apps/globe/dist (served at /globe/).');
