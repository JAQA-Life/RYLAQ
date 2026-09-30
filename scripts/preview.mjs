#!/usr/bin/env node
/*
 * Dev-only static preview server for dist/ (or --dir src). Binds to 127.0.0.1,
 * serves files only, and writes NO request logs (requests may contain nothing
 * sensitive anyway because queries never go in URLs). Not used in production.
 * Usage: node scripts/preview.mjs [--dir dist] [--port 8080]
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const dir = path.join(root, arg('--dir', 'dist'));
const port = Number(arg('--port', 8080));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let p = path.normalize(path.join(dir, decodeURIComponent(url.pathname)));
      if (!p.startsWith(dir) || path.basename(p).startsWith('.')) throw new Error('forbidden');
      if ((await stat(p)).isDirectory()) p = path.join(p, 'index.html');
      const body = await readFile(p);
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  })
  .listen(port, '127.0.0.1', () => process.stdout.write(`JAQA preview: http://127.0.0.1:${port}/ (serving ${path.relative(root, dir)})\n`));
