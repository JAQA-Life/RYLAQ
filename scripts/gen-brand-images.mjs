#!/usr/bin/env node
/*
 * Dev-only: renders JAQA's share card and app icons with Playwright (Chromium)
 * from the inline-SVG monogram. Outputs are committed in src/assets/brand/ and
 * copied into dist/ by scripts/build.mjs, so builds never need a browser.
 *   NODE_PATH=<global node_modules> node scripts/gen-brand-images.mjs
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = (f) => path.join(root, 'src/assets/brand', f);
const mark = readFileSync(out('favicon.svg'), 'utf8');

const card = `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#05080f;color:#e6f6ff;font-family:"DejaVu Sans",system-ui,sans-serif;position:relative;overflow:hidden}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(34,211,238,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,.07) 1px,transparent 1px);background-size:40px 40px}
.glow{position:absolute;right:-160px;top:-60px;width:760px;height:760px;border-radius:50%;background:radial-gradient(circle at 40% 40%,rgba(34,211,238,.35),rgba(14,116,144,.15) 45%,transparent 70%)}
.globe{position:absolute;right:40px;top:95px;width:440px;height:440px;border-radius:50%;border:2px solid rgba(34,211,238,.8);box-shadow:0 0 60px rgba(34,211,238,.35),inset 0 0 80px rgba(34,211,238,.18)}
.globe i{position:absolute;inset:0;border-radius:50%;border:1px solid rgba(34,211,238,.35)}
.globe i:nth-child(1){transform:scaleX(.33)}.globe i:nth-child(2){transform:scaleX(.66)}.globe i:nth-child(3){transform:scaleY(.33)}.globe i:nth-child(4){transform:scaleY(.66)}
.c{position:absolute;width:26px;height:26px;border-color:#22d3ee;border-style:solid}
.tl{left:36px;top:36px;border-width:3px 0 0 3px}.br{right:36px;bottom:36px;border-width:0 3px 3px 0}
.content{position:absolute;left:80px;top:120px;width:640px}
.brand{display:flex;align-items:center;gap:22px;margin-bottom:34px}
.brand svg{width:96px;height:96px}
.word{font:800 64px/1 "DejaVu Sans Mono",monospace;letter-spacing:.2em;color:#fff}
h1{font-size:42px;line-height:1.2;font-weight:700;margin-bottom:22px}
p{font:400 23px/1.45 "DejaVu Sans",sans-serif;color:#a5c7dd}
.tags{position:absolute;left:80px;bottom:70px;display:flex;gap:12px}
.tags span{font:600 17px/1 "DejaVu Sans Mono",monospace;letter-spacing:.08em;padding:10px 14px;border:1px solid rgba(34,211,238,.55);color:#a5f3fc;border-radius:4px;text-transform:uppercase}
.url{position:absolute;right:80px;bottom:78px;font:700 22px/1 "DejaVu Sans Mono",monospace;color:#22d3ee;letter-spacing:.06em}
</style></head><body><div class="grid"></div><div class="glow"></div><div class="globe"><i></i><i></i><i></i><i></i></div>
<div class="c tl"></div><div class="c br"></div>
<div class="content"><div class="brand">${mark}<span class="word">JAQA</span></div>
<h1>Global Risk, Finance, Insurance &amp; Procurement Intelligence</h1>
<p>Public-source evidence triage with a live 3D globe and a monitor of official feeds.</p></div>
<div class="tags"><span>3D Globe</span><span>Global Monitor</span><span>Risk Workspace</span></div><div class="url">jaqa.life</div></body></html>`;

const icon = (size, pad) => `<!doctype html><html><head><style>*{margin:0}body{width:${size}px;height:${size}px;background:#0b1f3a;display:grid;place-items:center}svg{width:${size - 2 * pad}px;height:${size - 2 * pad}px}</style></head><body>${mark.replace('rx="7" fill="#0b1f3a"', 'rx="0" fill="#0b1f3a"')}</body></html>`;

const browser = await chromium.launch();
const shoot = async (html, w, hgt, file) => {
  const p = await browser.newPage({ viewport: { width: w, height: hgt } });
  await p.setContent(html);
  await p.screenshot({ path: out(file) });
  await p.close();
  console.log('wrote src/assets/brand/' + file);
};
await shoot(card, 1200, 630, 'og-image.png');
await shoot(icon(180, 10), 180, 180, 'apple-touch-icon.png');
await shoot(icon(192, 10), 192, 192, 'icon-192.png');
await shoot(icon(512, 26), 512, 512, 'icon-512.png');
await browser.close();
