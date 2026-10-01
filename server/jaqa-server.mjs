#!/usr/bin/env node
/*
 * JAQA production server — one Node process for the whole site:
 *
 *   /                 JAQA workspace (static files from dist/)
 *   /globe/           God's Eye View 3D globe (apps/globe/dist; MIT, © Bilawal Sidhu)
 *   /api/…            God's Eye View data providers (its own middleware, unmodified)
 *   /api/jaqa/…       JAQA monitor endpoints (server/monitor.mjs)
 *
 * It runs Vite's preview server with God's Eye View's own configuration, so
 * every provider behaves exactly as upstream, and adds one plugin for JAQA's
 * routes and security headers.
 *
 * Environment: PORT (default 3000), HOST (default 0.0.0.0), plus optional
 * provider keys read by God's Eye View's providers (see .env.example). Keys
 * stay on the server and are never sent to the browser, except the
 * browser-side GOOGLE_MAPS_API_KEY / CESIUM_ION_TOKEN, which are embedded at
 * build time by design.
 *
 * Request logging is deliberately absent: this server writes no access logs.
 * JAQA™ is a trademark of JAQA. © JAQA™. All rights reserved.
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { monitorPlugin } from './monitor.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jaqaDist = path.join(root, 'dist');
const globeRoot = path.join(root, 'apps', 'globe');
const globeDist = path.join(globeRoot, 'dist');

for (const [p, what] of [
  [path.join(jaqaDist, 'index.html'), 'JAQA build (run: npm run build)'],
  [path.join(globeDist, 'index.html'), "God's Eye View build (run: npm run build:globe)"],
]) {
  if (!existsSync(p)) {
    console.error('Missing ' + what + ': ' + path.relative(root, p));
    process.exit(1);
  }
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2'
};

// JAQA's security headers come from the generated dist/.htaccess, so Apache
// (static upload) and this server always send the same policy.
const jaqaHeaders = {};
for (const m of readFileSync(path.join(jaqaDist, '.htaccess'), 'utf8').matchAll(/^\s*Header always set ([A-Za-z-]+) "([^"]*)"/gm)) jaqaHeaders[m[1]] = m[2];

// God's Eye View pages: its app needs the microphone (voice agent), Google
// fonts/tiles and many data hosts, so it keeps its own browser policy; these
// headers add framing, sniffing and transport protection only.
const globeHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
  // Referrer-restricted Google/Cesium browser keys need the site origin.
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

// Root-level paths God's Eye View's code requests directly (not under /globe/).
const GLOBE_ROOT_PATHS = /^\/(models|events|scene-assets)\/|^\/(logo|mic|pin|location|visual-presets)\.svg$/;

function sendFile(res, file, headers) {
  const ext = path.extname(file).toLowerCase();
  const hashed = /\.[0-9a-f]{8,}\.(js|css)$|-[A-Za-z0-9_-]{8}\.(js|css)$/.test(file);
  res.statusCode = 200;
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.setHeader('Content-Type', TYPES[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', ext === '.html' ? 'no-cache, no-store, must-revalidate' : hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
  createReadStream(file).pipe(res);
}

// Resolve a URL path inside a directory; refuses traversal and dotfiles.
function resolveIn(dir, urlPath) {
  let rel;
  try {
    rel = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (rel.split('/').some((seg) => seg.startsWith('.'))) return null;
  let p = path.normalize(path.join(dir, rel));
  if (p !== dir && !p.startsWith(dir + path.sep)) return null;
  if (existsSync(p) && statSync(p).isDirectory()) p = path.join(p, 'index.html');
  return existsSync(p) && statSync(p).isFile() ? p : null;
}

function jaqaRoutes() {
  const handler = (req, res, next) => {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    if (p.startsWith('/api/')) return next(); // providers and /api/jaqa
    if (p === '/globe') {
      res.statusCode = 301;
      res.setHeader('Location', '/globe/');
      return res.end();
    }
    if (p.startsWith('/globe/')) {
      for (const [k, v] of Object.entries(globeHeaders)) res.setHeader(k, v);
      return next(); // Vite preview serves apps/globe/dist at /globe/
    }
    if (GLOBE_ROOT_PATHS.test(p)) {
      const f = resolveIn(globeDist, p);
      return f ? sendFile(res, f, globeHeaders) : next();
    }
    // JAQA: directory routes without a trailing slash → redirect.
    if (!p.endsWith('/') && !path.extname(p) && existsSync(path.join(jaqaDist, p)) && statSync(path.join(jaqaDist, p)).isDirectory()) {
      res.statusCode = 301;
      res.setHeader('Location', p + '/' + url.search);
      return res.end();
    }
    const f = resolveIn(jaqaDist, p);
    if (f) return sendFile(res, f, jaqaHeaders);
    const notFound = resolveIn(jaqaDist, '/404.html');
    res.statusCode = 404;
    for (const [k, v] of Object.entries(jaqaHeaders)) res.setHeader(k, v);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return notFound ? createReadStream(notFound).pipe(res) : res.end('Not found');
  };
  return {
    name: 'jaqa-routes',
    // 'pre': registered before God's Eye View's catch-all /api 404 handler.
    enforce: 'pre',
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    }
  };
}

// Vite comes from apps/globe/node_modules in a development checkout, or from
// the root node_modules in the deploy branch (where Hostinger runs npm install).
const localVite = path.join(globeRoot, 'node_modules', 'vite', 'dist', 'node', 'index.js');
const { preview } = existsSync(localVite) ? await import(pathToFileURL(localVite).href) : await import('vite');
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';
const server = await preview({
  root: globeRoot,
  configFile: path.join(globeRoot, 'vite.config.js'),
  base: '/globe/',
  logLevel: 'warn',
  plugins: [jaqaRoutes(), monitorPlugin()],
  preview: { port, host, strictPort: true, open: false, allowedHosts: true }
});
console.log(`JAQA server listening on http://${host}:${port}/ (workspace /, globe /globe/, APIs /api/)`);
const stop = () => server.httpServer.close(() => process.exit(0));
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
