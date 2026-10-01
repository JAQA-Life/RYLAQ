# JAQA Global Risk, Finance, Insurance & Procurement Intelligence Workspace

Public-source triage for global risk, finance, insurance/reinsurance counterparties, procurement, bids, awards, regulations, events, and supply-chain exposure.

JAQA is a **static, privacy-first web app**. It runs entirely in the browser. It has no backend, no proxy, no database, no accounts, no cookies, no browser storage, no service workers and no analytics. Queries go **directly from the user's browser** to selected public APIs, and only APIs that have been **verified for browser CORS from the JAQA origin** are called live. Every other source is an official link-out.

> Educational and enterprise information-discovery use only. Not legal, compliance, credit, investment, treasury, insurance, reinsurance, underwriting, claims, sanctions, AML, procurement, bid, award, tax, or supply-chain assurance advice. © JAQA™. All rights reserved.

## JAQA Ultimate: workspace + 3D globe + Global Monitor

This branch (`jaqa-ultimate`) combines three things in one site served by one Node.js process (`server/jaqa-server.mjs`):

| Path | What | Code |
|---|---|---|
| `/` | **JAQA workspace:** Situation Room, search, 30+ modules, exports | JAQA (proprietary) |
| `/global-monitor/` | **Global Monitor:** headlines from 18 verified official feeds, event map, countries in the headlines, ECB FX board | JAQA, clean-room and WorldMonitor-inspired (no WorldMonitor code: it is AGPL) |
| `/globe/` | **3D globe:** God's Eye View (live aircraft, ships, satellites, hazards, cameras, CRT/NVG/FLIR styles, voice) | God's Eye View, MIT, © Bilawal Sidhu (`apps/globe/`) |
| `/about/`, `/faq/`, `/sources/`, `/privacy/`, `/3d-globe/` | Crawlable static pages, plus `sitemap.xml`, `robots.txt`, `llms.txt` and JSON-LD structured data | JAQA |

```bash
# Node >= 24.14 (God's Eye View's requirement)
npm run install:globe      # God's Eye View's dependencies (apps/globe)
npm run build:all          # JAQA dist/ + SEO pages, then the globe for /globe/
npm start                  # http://localhost:3000/  (PORT, HOST env vars)
node scripts/package-hostinger.mjs   # → release/jaqa-hostinger.zip (deploy bundle)
```

- **Deploy from GitHub (recommended):** see [`docs/DEPLOY-HOSTINGER-GITHUB.md`](docs/DEPLOY-HOSTINGER-GITHUB.md). In Hostinger, create a Node.js web app (Business or Cloud plan) from this repository's `hostinger-node` branch, with Node 24, build command `npm run build` and entry file `server/jaqa-server.mjs`. The *Publish full site to hostinger-node branch* workflow builds and tests every merge to `main` and publishes it there, and Hostinger redeploys on push.
- **Deploy by upload / VPS:** see [`docs/DEPLOY-NODE.md`](docs/DEPLOY-NODE.md). It covers a Hostinger VPS or a Node.js hosting plan with Node 24. Shared hosting with `public_html` only can't run the server; use the static-only `release/jaqa-web.zip` there (workspace and SEO pages, without the monitor and globe).
- **Before commercial use:** God's Eye View bundles non-commercial datasets (TeleGeography cables, the Bhote Koshi pack) and uses OpenSky, whose licence is non-commercial. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
- **Monitor feeds** are re-verified with the *Verify monitor feeds* workflow; results go into `config/monitor-verification.json`.

## What's in the box

| Path | Purpose |
|---|---|
| `dist/index.html` + `dist/assets/` | **Production artifact**: small HTML pages plus the app script, stylesheet and startup-diagnostics script as content-hashed files in `assets/` (inline SVG icons, system fonts, no external requests). Upload to Hostinger or open locally. |
| `.htaccess` (root) | Used only if Hostinger deploys the repository root (`main`). It routes every request into `dist/` and returns 404 for source files. |
| `dist/.htaccess` | Security headers, HTTPS redirect, no directory listing, gzip, and a strict CSP. `script-src 'self'` (the app runs only from its own files, so hosting-side HTML rewriting cannot break it) and `connect-src` allows only verified API origins. |
| `dist/{global-risk,finance-risk,insurance-reinsurance,procurement-bids}/` | Optional standalone routes: the same app with route-specific title, meta and canonical, opening on the matching module. |
| `release/jaqa-web.zip` | **Download-and-upload package**: the `dist/` files, including `.htaccess`, in one ZIP for Hostinger File Manager. Upload it to `public_html/` and extract it there. See [`release/README.md`](release/README.md). |
| `embed/jaqa-workspace-embed.html` | Fragment for CMS/intranet custom-HTML blocks. It contains no html/head/body, and its styles are scoped to `.jaqa-workspace`. |
| `src/` | Readable source: `src/index.html` loads the unbundled modules, so the app also runs from `src/` without a build. |
| `config/cors-verification.json` | Evidence for live mode: the result of real requests sent with `Origin: https://jaqa.life`. |
| `scripts/` | Dev-only tooling: build, safety checker, link validator, CORS verifier, preview server, and a Playwright smoke test. |
| `docs/` | Deployment, workflow, source policy, generated source registry, acceptance checklist, and privacy/legal/branding rules. |
| `SPEC.md` | Condensed authoritative specification with implementation traceability. |

## Quick start

```bash
# No install needed for production. For development:
npm run build          # regenerate dist/, embed/, release/jaqa-web.zip, docs/SOURCE_REGISTRY.md, corsConfig.js
npm run check          # static safety + link sanity checks
npm run preview        # http://127.0.0.1:8080 (serves dist/, no logging)
npm run test:smoke     # Playwright end-to-end test with mocked providers (needs `playwright`)
npm run verify:cors    # re-verify providers from your machine (network required)
```

Opening `dist/index.html` directly from disk also works (`file://`). Live requests then come from the `null` origin; the CORS verification was done for `https://jaqa.life`, so some providers may respond differently from disk.

## Live sources (verified 2026-09-30 for `https://jaqa.life`)

Live (19): GLEIF, World Bank, USGS, Open-Meteo, NOAA/NWS, CISA KEV (official `cisagov` GitHub mirror), NVD, CPSC, NHTSA, USAspending, Federal Register, SEC EDGAR submissions, CourtListener, Wikidata, Wikipedia, OpenStreetMap Overpass, ECB, GDELT and EPA ECHO.

Link-out only (verification failed or a key/login is required):

| Source | Why it is link-out only |
|---|---|
| TED | No CORS header on the POST search. |
| SEC XBRL, EDGAR full-text search, SEC tickers | No CORS header returned. |
| ReliefWeb | API v1 is decommissioned; v2 needs an approved appname. |
| IMF | Returned 403. |
| UN Comtrade | No CORS header. |
| FRED, OpenCorporates, Companies House, SAM.gov, ACLED, NASA FIRMS | Need a key or registration. |
| Insurance regulators, rating agencies, market reports, procurement portals, sanctions lists, insolvency and lien registries, paid data providers | Link-out only by policy. |

Full detail: [`docs/SOURCE_REGISTRY.md`](docs/SOURCE_REGISTRY.md).

To promote a source to live, add checks to `scripts/verify-cors.mjs`. Then run it locally or through the *Verify public sources* GitHub workflow, commit `config/cors-verification.json`, and run `npm run build`. The build updates both the in-app registry and the CSP.

## Design: Situation Room + HUD theme

The workspace opens on the **Situation Room**: a command-center grid with an interactive evidence globe, live public wires and the current investigation's signals. The default **situation-room theme** is dark, with a HUD look: grid background, cyan instrumentation, monospace telemetry and bracketed panels. **Dark** and **Light** themes are one click away (they are not saved). The design language is inspired by WorldMonitor and God's Eye View through a clean-room implementation, with no code or assets reused; see `THIRD_PARTY_NOTICES.md`.

| Feature | Details |
|---|---|
| Evidence globe | Dependency-free canvas orthographic globe with Natural Earth coastlines and no map tiles. Drag, wheel and keyboard control; auto-rotate; optic modes STD / NVG / FLIR / CRT; layer toggles; and a text-alternative marker table. Markers come only from records loaded in the session: seismic events, places, subject reference points and forecast signals. |
| Public feeds | Global seismic (USGS), exploited vulnerabilities (CISA KEV), US regulatory wire (Federal Register, fixed topics) and EUR/USD (ECB). They are **on standby until you activate them**, send fixed non-personal queries, and are wiped by Clear Session. |
| Integration | Search results are plotted automatically, and the Climate & Catastrophe module has a local event globe. Reduced-motion preferences disable rotation, pulses and the ticker. |

## Modules (30)

- **Risk:** Situation Room · Overview / Risk Triage · Organization 360 · Global Risk Universe (82 domains) · Cyber, Technology, AI & Software Supply Chain · Physical, Climate & Catastrophe · ESG, Conduct, Human Rights & Nature · Trade, Customs & Category · Supply Chain & Third-Party · Regulatory Change Radar · Standards & Frameworks
- **Finance:** Finance Risk Universe (32 domains) · Counterparty Financial Fragility · Public Filing & Financial Statement Lens · Credit, Insolvency & Litigation · Financial Crime, Sanctions & Enforcement · Market, Macro & Sovereign · FX, Interest Rate & Commodity
- **Insurance & Reinsurance:** Intelligence · Financial Strength
- **Procurement & Bids:** Procurement & Bid Radar · Awards & Past Performance · Grants & Public Funding · PPP, Concessions & Infrastructure
- **Evidence:** Relationship Explorer · Scenario Stress Lab · Watchlist / Evidence Board · Advanced Query · Coverage Console · Session & Privacy

## Deployment

**Simplest:** download [`release/jaqa-web.zip`](release/jaqa-web.zip), upload it in Hostinger File Manager to `public_html/`, and extract it there (steps in [`release/README.md`](release/README.md)).

See [`docs/HOSTINGER_DEPLOYMENT.md`](docs/HOSTINGER_DEPLOYMENT.md). The site is built for the domain root, `https://jaqa.life/`. On every push to `main`, `.github/workflows/publish-hostinger-branch.yml` publishes **only the contents of `dist/`** to the `hostinger` branch. Point **hPanel → Advanced → Git** at branch `hostinger` with an empty directory (that is, `public_html/`). If Hostinger stays pointed at `main`, the repository-root `.htaccess` serves `dist/` at `/` and hides everything else, so that works too once the app is merged. Manual upload of the `dist/` contents (including `.htaccess`) and the optional FTPS workflow (`deploy-hostinger.yml`, skipped until secrets are set) also work. Hostinger needs no Node.js, PHP, database or build step.

## Licence

**Proprietary — © JAQA. All rights reserved.** See [`LICENSE`](LICENSE). No licence is granted to use, copy, modify, deploy or distribute this software without JAQA's written permission. Third-party material (Natural Earth outlines via world-atlas, ISC) keeps its own licence; see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). The earlier GPL-3.0 placeholder licence was replaced so that the licence matches the product's "All rights reserved" notice. Have counsel review `LICENSE` before external distribution.

---
JAQA™ is a trademark of JAQA. JAQA™ is an independent interface and is not affiliated with or endorsed by data providers unless expressly stated.
