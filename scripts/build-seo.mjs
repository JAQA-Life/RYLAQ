/*
 * SEO / GEO / AEO layer for the JAQA build (called by scripts/build.mjs).
 *
 *  - head(): canonical, Open Graph, Twitter card, icons and manifest tags
 *  - jsonLd(): Organization + WebSite + WebApplication (+ FAQPage on home)
 *  - aboutSection(): crawlable About + FAQ block on every workspace page
 *    (visible text, so crawlers that do not run JavaScript still get content)
 *  - staticPages(): /about/ /faq/ /sources/ /privacy/ /3d-globe/ /licenses/ /404.html,
 *    robots.txt, sitemap.xml, llms.txt, llms-full.txt, manifest, icons
 *
 * Output is deterministic (dates come from the verification files) so CI can
 * diff dist/. Pages carry no script except JSON-LD data blocks.
 * JAQA™ is a trademark of JAQA. © JAQA™. All rights reserved.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFINITION, FAQ, FEATURES, PRIVACY_POINTS, TAGLINE } from './seo-content.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readRepo = (p) => readFileSync(path.join(ROOT, p), 'utf8');

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ld = (obj) => `<script type="application/ld+json">\n${JSON.stringify(obj).replace(/</g, '\\u003c')}\n</script>`;

export function createSeo({ SITE, R, monitorConfig, lastmod, arsenalConfig }) {
  const live = R.sources.list.filter((s) => s.corsVerified);
  const n = { live: live.length, feeds: monitorConfig.feeds.length };
  const faq = FAQ(n);
  const ORG = { '@type': 'Organization', '@id': SITE + '/#org', name: 'JAQA', url: SITE + '/', logo: SITE + '/icon-512.png' };
  const WEBSITE = { '@type': 'WebSite', '@id': SITE + '/#website', name: 'JAQA', url: SITE + '/', description: TAGLINE, inLanguage: 'en', publisher: { '@id': SITE + '/#org' } };
  const faqLd = (items) => ({ '@type': 'FAQPage', mainEntity: items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
  const crumbs = (items) => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url })) });

  /** Head tags shared by every page. up = relative prefix to the site root. */
  function head({ title, description, canonical, up, type }) {
    return [
      `<title>${esc(title)}</title>`,
      `<meta name="description" content="${esc(description)}">`,
      `<link rel="canonical" href="${canonical}">`,
      `<meta property="og:site_name" content="JAQA">`,
      `<meta property="og:title" content="${esc(title)}">`,
      `<meta property="og:description" content="${esc(description)}">`,
      `<meta property="og:type" content="${type || 'website'}">`,
      `<meta property="og:url" content="${canonical}">`,
      `<meta property="og:locale" content="en_US">`,
      `<meta property="og:image" content="${SITE}/og-image.png">`,
      `<meta property="og:image:width" content="1200">`,
      `<meta property="og:image:height" content="630">`,
      `<meta property="og:image:alt" content="JAQA — global risk, finance, insurance and procurement intelligence">`,
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${esc(title)}">`,
      `<meta name="twitter:description" content="${esc(description)}">`,
      `<meta name="twitter:image" content="${SITE}/og-image.png">`,
      `<link rel="icon" href="${up}favicon.svg" type="image/svg+xml">`,
      `<link rel="apple-touch-icon" href="${up}apple-touch-icon.png">`,
      `<link rel="manifest" href="${up}manifest.webmanifest">`
    ].join('\n');
  }

  /** JSON-LD for a workspace page (home adds the FAQ it displays). */
  function workspaceLd({ title, description, canonical, home }) {
    const app = { '@type': 'WebApplication', '@id': canonical + '#app', name: title, url: canonical, description, applicationCategory: 'BusinessApplication', operatingSystem: 'Any (web browser)', isAccessibleForFree: true, inLanguage: 'en', publisher: { '@id': SITE + '/#org' }, isPartOf: { '@id': SITE + '/#website' } };
    return ld({ '@context': 'https://schema.org', '@graph': [ORG, WEBSITE, app, ...(home ? [faqLd(faq.slice(0, 6))] : [])] });
  }

  /** Crawlable About + FAQ section shown below the workspace. */
  function aboutSection(up) {
    const link = (href, label) => `<a href="${up}${href}">${esc(label)}</a>`;
    return `<section class="jaqa-about" id="about-jaqa" aria-labelledby="about-jaqa-h">
<div class="jaqa-about-inner">
<h2 id="about-jaqa-h">About JAQA</h2>
<p>${esc(DEFINITION(n))}</p>
<ul class="jaqa-about-features">
${FEATURES.map(([t, d]) => `<li><strong>${esc(t)}.</strong> ${esc(d)}</li>`).join('\n')}
</ul>
<h2>Frequently asked questions</h2>
${faq.slice(0, 6).map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n')}
<p class="jaqa-about-nav">${[link('about/', 'About'), link('faq/', 'All questions'), link('sources/', 'Data sources'), link('privacy/', 'Privacy'), link('3d-globe/', '3D Globe'), link('global-monitor/', 'Global Monitor'), link('licenses/', 'Licences')].join(' · ')}</p>
<p class="jaqa-about-legal">© 2026 JAQA™. All rights reserved. JAQA™ is a trademark of JAQA. Educational and information-discovery use only; not legal, compliance, credit, investment, insurance, sanctions or procurement advice.</p>
</div>
</section>`;
  }

  /* -------------------------- static pages -------------------------- */
  const NAV = [['', 'Workspace'], ['3d-globe/', '3D Globe'], ['global-monitor/', 'Global Monitor'], ['arsenal/', 'Arsenal'], ['about/', 'About'], ['faq/', 'FAQ'], ['sources/', 'Sources'], ['privacy/', 'Privacy']];
  function shell({ path, title, description, h1, lead, body, graph, siteCss, noindex }) {
    const up = path ? '../'.repeat(path.split('/').filter(Boolean).length) : '';
    const canonical = SITE + '/' + path;
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#05080F">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}${head({ title, description, canonical, up, type: 'article' })}
<link rel="stylesheet" href="${up}${siteCss}">
${graph ? ld({ '@context': 'https://schema.org', '@graph': [ORG, WEBSITE, ...graph(canonical)] }) : ''}
</head>
<body>
<a class="site-skip" href="#content">Skip to content</a>
<header class="site-head">
<a class="site-brand" href="${up || './'}" aria-label="JAQA workspace home"><img src="${up}favicon.svg" alt="" width="32" height="32"><span>JAQA</span></a>
<nav aria-label="Site"><ul>${NAV.map(([href, label]) => `<li><a href="${up}${href || ''}"${href === path ? ' aria-current="page"' : ''}>${label}</a></li>`).join('')}</ul></nav>
</header>
<main id="content" class="site-main">
<h1>${esc(h1)}</h1>
${lead ? `<p class="site-lead">${esc(lead)}</p>` : ''}
${body}
</main>
<footer class="site-foot">
<p><a href="${up}">Open the JAQA workspace</a> · <a href="${up}globe/">Open the 3D globe</a> · <a href="${up}licenses/">Licences</a></p>
<p>© 2026 JAQA™. All rights reserved. JAQA™ is a trademark of JAQA. JAQA™ is an independent interface and is not affiliated with or endorsed by data providers unless expressly stated.</p>
<p>Educational and enterprise information-discovery use only. Not legal, compliance, credit, investment, treasury, insurance, reinsurance, underwriting, claims, sanctions, AML, procurement, bid, award, tax, or supply-chain assurance advice.</p>
</footer>
</body>
</html>
`;
  }

  function staticPages({ write, copy, siteCss }) {
    const page = (p) => shell({ ...p, siteCss });
    const bc = (name, url) => (canonical) => [crumbs([['JAQA', SITE + '/'], [name, url || canonical]])];

    // /about/
    write('dist/about/index.html', page({
      path: 'about/', title: 'About JAQA | Public-Source Risk, Finance, Insurance & Procurement Intelligence', description: `What JAQA is: a privacy-first workspace for public evidence on risk, finance, insurance and procurement, with a 3D globe and a monitor of official feeds.`,
      h1: 'About JAQA', lead: TAGLINE,
      graph: (c) => [{ '@type': 'AboutPage', name: 'About JAQA', url: c, about: { '@id': SITE + '/#org' } }, ...bc('About')(c)],
      body: `<p>${esc(DEFINITION(n))}</p>
<h2>What you can do</h2>
<ul class="site-list">${FEATURES.map(([t, d]) => `<li><strong>${esc(t)}.</strong> ${esc(d)}</li>`).join('')}</ul>
<h2>How it works</h2>
<ol class="site-list">
<li>You search for an organization, country, port, CVE, HS code, tender, regulation or risk concept.</li>
<li>JAQA detects what you typed and shows how confident it is in that interpretation, so you can correct it.</li>
<li>It sends a small number of requests directly from your browser to verified public data sources, and loads deeper sources only when you ask.</li>
<li>Every record shows its source, retrieval time, record ID, official link and match confidence. Sources without a verified API become official link-outs.</li>
</ol>
<h2>Privacy by design</h2>
<ul class="site-list">${PRIVACY_POINTS.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
<h2>What JAQA is not</h2>
<p>JAQA is not a sanctions system of record, a credit rating agency, an insurance broker, underwriter or claims adjuster, a procurement advisor or award authority, or a real-time control tower. Public signals are never presented as clearance, certification, rating, coverage, eligibility, award, solvency or legal determination.</p>
<h2>Open source</h2>
<p>JAQA uses open-source software and open data. Their licences and credits are on the <a href="../licenses/">Licences</a> page.</p>`
    }));

    // /faq/
    write('dist/faq/index.html', page({
      path: 'faq/', title: 'JAQA FAQ | Data Sources, Privacy, 3D Globe and Global Monitor', description: 'Answers about JAQA: what it is, where its data comes from, how sources are verified, privacy, the 3D globe, the Global Monitor, coverage and what JAQA does not do.',
      h1: 'Frequently asked questions', lead: 'Short, direct answers about how JAQA works.',
      graph: (c) => [faqLd(faq), ...bc('FAQ')(c)],
      body: faq.map(([q, a]) => `<section class="site-faq"><h2>${esc(q)}</h2><p>${esc(a)}</p></section>`).join('\n')
    }));

    // /sources/
    const regionOf = (s) => esc(s.region || 'Global');
    const linkouts = R.sources.list.filter((s) => !s.corsVerified && !s.serverBacked && s.defaultMode !== 'unavailable');
    write('dist/sources/index.html', page({
      path: 'sources/', title: `JAQA Data Sources | ${n.live} Verified Live APIs and ${n.feeds} Official Feeds`, description: `The public data sources JAQA uses: ${n.live} APIs verified for live browser access from jaqa.life, ${n.feeds} verified official feeds in the Global Monitor, and official link-outs for everything else.`,
      h1: 'Data sources', lead: `JAQA uses public sources only. Live access is enabled only after automated verification; everything else is an official link-out.`,
      graph: (c) => [{ '@type': 'CollectionPage', name: 'JAQA data sources', url: c }, ...bc('Sources')(c)],
      body: `<h2>${n.live} live public APIs (called from your browser)</h2>
<p>Verified for browser access (CORS) and response shape from the jaqa.life origin on ${esc((R.config.corsVerification.verifiedAt || '').slice(0, 10))}.</p>
<div class="site-table-wrap"><table class="site-table"><thead><tr><th scope="col">Source</th><th scope="col">Region</th><th scope="col">Official site</th></tr></thead><tbody>
${live.map((s) => `<tr><td>${esc(s.displayName)}</td><td>${regionOf(s)}</td><td>${s.officialSiteUrl ? `<a href="${esc(s.officialSiteUrl)}" rel="noopener noreferrer">${esc(new URL(s.officialSiteUrl).host)}</a>` : ''}</td></tr>`).join('\n')}
</tbody></table></div>
<h2>${n.feeds} official feeds (Global Monitor, fetched by the JAQA server)</h2>
<p>Each feed was fetched and parsed with the production parser on ${esc((monitorConfig.verifiedAt || '').slice(0, 10))}. JAQA shows headlines and links only; the content belongs to each publisher.</p>
<div class="site-table-wrap"><table class="site-table"><thead><tr><th scope="col">Feed</th><th scope="col">Publisher</th><th scope="col">Category</th></tr></thead><tbody>
${monitorConfig.feeds.map((f) => `<tr><td>${esc(f.name)}</td><td><a href="${esc(f.home)}" rel="noopener noreferrer">${esc(f.publisher)}</a></td><td>${esc((monitorConfig.categories.find(([id]) => id === f.category) || [0, f.category])[1])}</td></tr>`).join('\n')}
</tbody></table></div>
<h2>Link-out sources (${linkouts.length})</h2>
<p>Official registries, portals, regulators and data services that JAQA links to but does not call — because verification failed, a key or login is required, or policy (paid ratings, sanctions lists, market reports) requires it.</p>
<ul class="site-list site-cols">${linkouts.map((s) => `<li>${esc(s.displayName)}</li>`).join('')}</ul>
<h2>3D globe data</h2>
<p>JAQA Eye View uses its own providers (for example OpenSky and ADS-B aircraft, AIS ships, CelesTrak satellites, USGS earthquakes, NASA FIRMS fires, NOAA weather and cyclones, Launch Library 2, OpenStreetMap). Each layer’s credit is listed under “Data attribution” on the globe.</p>`
    }));

    // /privacy/
    write('dist/privacy/index.html', page({
      path: 'privacy/', title: 'JAQA Privacy | No Accounts, No Cookies, No Stored Searches', description: 'How JAQA handles privacy: no accounts, cookies, browser storage or analytics; searches go directly from your browser to public data providers and are never stored or logged by JAQA.',
      h1: 'Privacy', lead: R.legal.privacyStatement || 'JAQA does not store, proxy, log, persist, or analyze user searches.',
      graph: (c) => [{ '@type': 'WebPage', name: 'JAQA privacy', url: c }, ...bc('Privacy')(c)],
      body: `<ul class="site-list">${PRIVACY_POINTS.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
<h2>What not to enter</h2>
<p>Do not enter confidential commercial, financial, insurance, claims, procurement, personal, health, bank, payment or other protected information. JAQA rejects inputs that look sensitive and never stores them.</p>
<h2>The 3D globe</h2>
<p>JAQA Eye View runs at /globe/ and requests its layers from public providers through the JAQA server. If its voice agent is enabled on the server, your voice is sent to OpenAI to operate it. Links from the workspace to the globe carry only coordinates and a visual style, never your search terms.</p>
<h2>Legal notice</h2>
<p>${esc(R.legal.shortDisclaimer || '')}</p>`
    }));

    // /3d-globe/
    write('dist/3d-globe/index.html', page({
      path: '3d-globe/', title: 'JAQA Eye View | 3D Globe with Live Aircraft, Ships, Satellites & Hazards', description: 'JAQA Eye View: a photorealistic 3D globe with live aircraft, ships, satellites, earthquakes, wildfires, weather and CRT, NVG and FLIR sensor styles.',
      h1: 'JAQA Eye View', lead: 'A photorealistic 3D globe of live public signals, part of JAQA.',
      graph: (c) => [{ '@type': 'WebPage', name: 'JAQA 3D Globe', url: c, about: { '@type': 'WebApplication', name: 'JAQA Eye View', applicationCategory: 'MultimediaApplication', operatingSystem: 'Any (web browser with WebGL)', isAccessibleForFree: true, publisher: { '@id': SITE + '/#org' }, url: SITE + '/globe/' } }, ...bc('3D Globe')(c)],
      body: `<p><a class="site-cta" href="../globe/">Open the 3D globe</a></p>
<h2>What it shows</h2>
<ul class="site-list">
<li><strong>Photorealistic Earth.</strong> Satellite imagery and OpenStreetMap without keys; photorealistic 3D city tiles when the server has a Google Maps key or Cesium ion token.</li>
<li><strong>Live contacts.</strong> Aircraft, ships and satellites, with click-to-track, trails and a 250 km contacts roster.</li>
<li><strong>Hazards and weather.</strong> Earthquakes, wildfires, weather radar, wind, clouds, lightning and tropical cyclone tracks.</li>
<li><strong>Space.</strong> Satellite orbits, pass predictions and a rolling 30 days of launches.</li>
<li><strong>Cameras and infrastructure.</strong> Public CCTV cameras, mapped ALPR camera locations, datacenters, dams, submarine cables and military installations.</li>
<li><strong>Sensor looks.</strong> CRT, NVG, FLIR/thermal, Noir and Snow styles, a detection overlay and a tactical HUD.</li>
<li><strong>Voice control.</strong> Hands-free control through the OpenAI Realtime API when the server has an OpenAI key.</li>
</ul>
<h2>From the workspace</h2>
<p>The Situation Room, the Global Monitor and the 3D Globe screen in the workspace open the globe at the place you are looking at. Links carry only coordinates and a style, never your search.</p>
<h2>Data and licences</h2>
<p>Each map layer’s source is credited under “Data attribution” on the globe. Open-source licences are on the <a href="../licenses/">Licences</a> page. Positions, feeds and camera images can be delayed, incomplete or wrong; nothing on the globe is a determination of risk, ownership, intent or exposure.</p>`
    }));

    // /arsenal/ — crawlable catalogue overview (the interactive, filterable
    // registry lives in the workspace; this page is for SEO/AEO + deep links).
    const A = arsenalConfig || { totals: {}, domains: [] };
    write('dist/arsenal/index.html', page({
      path: 'arsenal/', title: `JAQA Arsenal | ${A.totals.uniqueRepos || 0} Open-Source Security, Supply-Chain & Medical Tools`, description: `A curated, searchable registry of ${A.totals.uniqueRepos || 0} open-source projects across security, software supply chain and medical/health IT, organised into ${A.totals.categories || 0} categories. Reference and link-out only.`,
      h1: 'JAQA Arsenal', lead: `A curated registry of ${A.totals.uniqueRepos || 0} open-source projects across security, supply chain and medical/health — browse and filter them inside the workspace.`,
      graph: (c) => [{ '@type': 'CollectionPage', name: 'JAQA Arsenal', url: c }, ...bc('Arsenal')(c)],
      body: `<p><a class="site-cta" href="../arsenal-tools/">Open the Arsenal in the workspace</a></p>
<p>The Arsenal is reference and link-out only: each entry opens its GitHub page in a new tab. JAQA does not run, bundle or call these tools, and listing is not endorsement, certification or a security guarantee. Dual-use security tooling is for authorised testing, defence, research and education under each project's licence. Licences for what JAQA itself ships are on the <a href="../licenses/">Licences</a> page.</p>
${A.domains.map((d) => `<h2>${esc(d.label)} — ${d.count} projects</h2>
<p>${esc(d.blurb)}</p>
<ul class="site-list site-cols">${d.categories.map((c) => `<li><strong>${esc(c.label)}</strong> (${c.count})</li>`).join('')}</ul>`).join('\n')}`
    }));

    // /licenses/ — text only: open-source licences (copied verbatim by
    // scripts/gen-licenses.mjs) and the credits that licences require.
    const licIndex = JSON.parse(readRepo('licenses/index.json'));
    const mdLinks = (t) => esc(t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)').replace(/`/g, ''));
    const modelRows = readRepo('apps/globe/public/models/README.md').split('\n').filter((l) => /^\| `[^`]+\.glb` \|/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
    const landNotice = (readRepo('src/modules/worldLand.js').match(/Copyright 2013-2019 Michael Bostock[\s\S]*?THIS SOFTWARE\./) || [''])[0].replace(/^\s*\* ?/gm, '');
    if (!landNotice) throw new Error('world-atlas notice not found in src/modules/worldLand.js');
    write('dist/licenses/index.html', page({
      path: 'licenses/', title: 'Licences | JAQA', description: 'Open-source licences and credits for the software, fonts, 3D models and map data used by JAQA and JAQA Eye View.',
      h1: 'Licences', lead: 'JAQA uses open-source software and open data. Their licences and the credits they require are reproduced here.',
      graph: (c) => [{ '@type': 'WebPage', name: 'JAQA licences', url: c }, ...bc('Licences')(c)],
      body: `<h2>Software and fonts</h2>
<p>Each licence text below is copied unmodified from the package or project it covers. The CesiumJS licence also lists the third-party code bundled inside CesiumJS.</p>
${licIndex.map((e) => `<details class="site-license"><summary><strong>${esc(e.name)}</strong> ${esc(e.version)} · ${esc(e.license)}</summary><p><a href="${esc(e.url)}" rel="noopener noreferrer">${esc(e.url.replace(/^https:\/\//, ''))}</a></p><pre>${esc(readRepo('licenses/' + e.file))}</pre></details>`).join('\n')}
<h2>3D models (JAQA Eye View)</h2>
<p>These models are licensed under <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener noreferrer">CC BY 4.0</a> and were modified for the globe as described. The credits do not imply endorsement by the creators.</p>
<div class="site-table-wrap"><table class="site-table"><thead><tr><th scope="col">File</th><th scope="col">Work and creator</th><th scope="col">Source</th><th scope="col">Modifications</th></tr></thead><tbody>
${modelRows.map(([f, w, src, , mod]) => `<tr><td>${mdLinks(f)}</td><td>${mdLinks(w)}</td><td>${mdLinks(src)}</td><td>${mdLinks(mod)}</td></tr>`).join('\n')}
</tbody></table></div>
<h2>Map data</h2>
<p>The workspace’s land outlines come from Natural Earth (public domain) through the world-atlas package:</p>
<pre class="site-pre">${esc(landNotice)}</pre>
<p>The 3D evidence globe in the workspace uses the Natural Earth II imagery bundled with CesiumJS (public domain). JAQA Eye View credits each live map layer and bundled dataset (for example OpenStreetMap contributors, Esri and its imagery partners, NASA, NOAA and USGS) under “Data attribution” on the globe. Those datasets keep their own licences and terms; some are licensed for non-commercial use only.</p>`
    }));

    // 404
    write('dist/404.html', page({ path: '404.html', title: 'Page not found | JAQA', description: 'This page does not exist on jaqa.life.', h1: 'Page not found', lead: 'The address may be mistyped or the page may have moved.', noindex: true, body: '<p>Use the links above, or open the workspace to start a search.</p>' }).replace(/<link rel="canonical"[^>]*>\n/, '').replace(/href="\.\.\/+/g, 'href="/').replace(/src="\.\.\/+/g, 'src="/'));

    // robots.txt, sitemap.xml
    write('dist/robots.txt', `# JAQA — ${SITE}/\nUser-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);
    const urls = ['', 'global-monitor/', 'global-risk/', 'finance-risk/', 'insurance-reinsurance/', 'procurement-bids/', '3d-globe/', 'globe/', 'arsenal/', 'arsenal-tools/', 'about/', 'faq/', 'sources/', 'privacy/', 'licenses/'];
    write('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE}/${u}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`);

    // llms.txt (https://llmstxt.org) + full text
    const pages = [
      ['JAQA workspace', '', 'the interactive workspace (Situation Room, search, all modules)'],
      ['Global Monitor', 'global-monitor/', `headlines from ${n.feeds} verified official feeds, event map, countries in the headlines, FX board`],
      ['JAQA Eye View (3D globe)', '3d-globe/', 'photorealistic 3D globe with live aircraft, ships, satellites and hazards'],
      ['About', 'about/', 'what JAQA is, how it works, what it is not'],
      ['FAQ', 'faq/', 'direct answers about sources, privacy, verification and coverage'],
      ['Data sources', 'sources/', 'every live API, official feed and link-out'],
      ['Privacy', 'privacy/', 'no accounts, cookies, storage or stored searches'],
      ['Arsenal', 'arsenal/', 'curated registry of open-source security, supply-chain and medical tooling'],
      ['Licences', 'licenses/', 'open-source licences and credits']
    ];
    write('dist/llms.txt', `# JAQA\n\n> ${TAGLINE}\n\n${DEFINITION(n)}\n\n## Pages\n\n${pages.map(([t, u, d]) => `- [${t}](${SITE}/${u}): ${d}`).join('\n')}\n\n## Optional\n\n- [Full text for language models](${SITE}/llms-full.txt): about, features, FAQ, privacy and source lists in one file\n`);
    write('dist/llms-full.txt', [
      `# JAQA\n\n> ${TAGLINE}\n\n${DEFINITION(n)}`,
      `## Features\n\n${FEATURES.map(([t, d]) => `- **${t}**: ${d}`).join('\n')}`,
      `## Frequently asked questions\n\n${faq.map(([q, a]) => `### ${q}\n\n${a}`).join('\n\n')}`,
      `## Privacy\n\n${PRIVACY_POINTS.map((p) => `- ${p}`).join('\n')}`,
      `## Live public APIs (${n.live})\n\n${live.map((s) => `- ${s.displayName}${s.officialSiteUrl ? ' — ' + s.officialSiteUrl : ''}`).join('\n')}`,
      `## Global Monitor feeds (${n.feeds})\n\n${monitorConfig.feeds.map((f) => `- ${f.name} — ${f.publisher} — ${f.home}`).join('\n')}`,
      `## Legal\n\n© 2026 JAQA™. All rights reserved. JAQA™ is a trademark of JAQA. Educational and information-discovery use only; not legal, compliance, credit, investment, insurance, sanctions or procurement advice.`
    ].join('\n\n') + '\n');

    // Web app manifest + icons
    write('dist/manifest.webmanifest', JSON.stringify({ name: 'JAQA Intelligence Workspace', short_name: 'JAQA', description: TAGLINE, start_url: '/', scope: '/', display: 'standalone', background_color: '#05080f', theme_color: '#05080f', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }] }, null, 2) + '\n');
    for (const f of ['favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'og-image.png']) copy('src/assets/brand/' + f, 'dist/' + f);
    return urls;
  }

  return { n, head, workspaceLd, aboutSection, staticPages };
}
