#!/usr/bin/env node
/*
 * Copies the licence texts of the open-source code and assets that the site
 * sends to browsers into licenses/ (committed), so scripts/build.mjs can render
 * the text-only /licenses/ page without node_modules. Run after
 * `npm run install:globe` whenever apps/globe dependencies change:
 *   node scripts/gen-licenses.mjs
 * Output: licenses/index.json (name, version, SPDX licence, file) + one text
 * file per entry, copied verbatim.
 * JAQA™ is a trademark of JAQA. © JAQA™. All rights reserved.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nm = path.join(root, 'apps', 'globe', 'node_modules');
const out = path.join(root, 'licenses');
if (!existsSync(path.join(nm, 'cesium'))) {
  console.error('apps/globe/node_modules is missing — run `npm run install:globe` first.');
  process.exit(1);
}

// Packages whose code or files reach the browser (CesiumJS's LICENSE.md also
// covers the third-party code bundled inside CesiumJS).
const PACKAGES = [
  'cesium',
  'hls.js',
  'satellite.js',
  'mgrs',
  'egm96-universal',
  'rfc4648',
  '@mapbox/vector-tile',
  '@mapbox/point-geometry',
  'pbf',
  'resolve-protobuf-schema',
  'protocol-buffers-schema',
  '@meri-imperiumi/eccodes-wasm',
  '@fontsource/inter',
  '@fontsource/jetbrains-mono',
  'material-symbols'
];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const index = [];
const slug = (s) => s.replace(/^@/, '').replace(/[^a-z0-9.]+/gi, '-');

// The 3D globe's own code (MIT), from the repository.
writeFileSync(path.join(out, 'jaqa-eye-view-MIT.txt'), readFileSync(path.join(root, 'apps', 'globe', 'LICENSE'), 'utf8'));
index.push({ name: 'God’s Eye View (code base of JAQA Eye View)', version: 'commit 082074a', license: 'MIT', file: 'jaqa-eye-view-MIT.txt', url: 'https://github.com/bilawalsidhu/gods-eye-view' });

for (const name of PACKAGES) {
  const dir = path.join(nm, ...name.split('/'));
  const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const lic = readdirSync(dir).find((f) => /^licen[cs]e(\.(md|txt))?$/i.test(f));
  if (!lic) throw new Error('No licence file in ' + name);
  const file = slug(name) + '-' + pkg.version + '.txt';
  writeFileSync(path.join(out, file), readFileSync(path.join(dir, lic), 'utf8'));
  index.push({ name, version: pkg.version, license: pkg.license, file, url: 'https://www.npmjs.com/package/' + name });
}

writeFileSync(path.join(out, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`wrote licenses/ (${index.length} entries)`);
