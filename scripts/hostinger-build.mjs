#!/usr/bin/env node
/*
 * Build step for the Hostinger deploy branch (`npm run build`).
 *
 * Everything is prebuilt by GitHub Actions, so by default there is nothing to
 * do. Only if a browser-side key is set in Hostinger's environment variables
 * (GOOGLE_MAPS_API_KEY or CESIUM_ION_TOKEN) is the 3D globe rebuilt, so the
 * key is embedded for Google Photorealistic 3D Tiles. Restrict those keys to
 * your domain in the provider console.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.GOOGLE_MAPS_API_KEY && !process.env.CESIUM_ION_TOKEN) {
  console.log('JAQA: prebuilt site — nothing to build. (Set GOOGLE_MAPS_API_KEY or CESIUM_ION_TOKEN to rebuild the 3D globe with photorealistic tiles.)');
  process.exit(0);
}
console.log('JAQA: browser key found — rebuilding the 3D globe so it is embedded.');
const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'build-globe.mjs')], { stdio: 'inherit' });
process.exit(r.status || 0);
