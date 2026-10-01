# SPEC — JAQA Global Risk, Finance, Insurance & Procurement Intelligence Workspace

This is the condensed, authoritative specification for this repository. It is derived from the *Final JAQA Build Prompt*, which supersedes all earlier workspace prompts. Each section maps to where it is implemented. When the original prompt and this file disagree, the original prompt wins. Record the decision here.

## 0. Delivery target

GitHub (private) → Claude Code implements a static frontend → `dist/` is committed → Hostinger serves static files → the browser calls verified public APIs directly → unverified sources are official link-outs.

**Prohibited:** Node/PHP/Python backends, API proxies, databases, saved searches, analytics, authentication, server-side logging, a forked WorldMonitor runtime, integrated scanners, OSINT scrapers, paid-source bypasses, and confidential-data processing.

→ `dist/`, `docs/HOSTINGER_DEPLOYMENT.md`, `.github/workflows/*`

## 1. Non-negotiables (summary of the 55 rules)

| # | Rule |
|---|---|
| 1 | Live only after CORS is verified from the JAQA origin. |
| 2 | Never proxy. |
| 3 | Never fabricate data, hardcode demo results or invent endpoints. |
| 4 | Small initial request budget. |
| 5 | Show uncertainty, provenance and match confidence. Never present "Possible" as "Exact". |
| 6 | Label live vs link-out. |
| 7 | Intelligent routing (no wall of tabs). |
| 8 | Legal and compliance safety wording everywhere. |
| 9 | Commercial confidentiality warnings. |
| 10 | Respect rate limits. |
| 11 | Accessibility and mobile. |
| 12 | No external fonts or unnecessary CDNs. |
| 13 | No storage of searches: no cookies, browser storage, IndexedDB, service workers or analytics. |
| 14 | Public signals are never presented as clearance, certification, rating, coverage, eligibility, award, solvency or legal determination. |
| 15 | JAQA is not a sanctions system of record, credit rating agency, insurance broker/underwriter/claims adjuster, procurement advisor or award authority, or real-time control tower. |
| 16 | No scraping of paid, confidential or login sources. No reproduction of paid ratings, reports or news. |
| 17 | No assistance with bid rigging, collusion, corruption, sanctions/export-control/tax evasion or anti-competitive conduct. |
| 18 | Confidential or personal financial, health, insurance, claims or bid data is never accepted or stored. |
| 19 | Enterprise-grade quality. |
| 20 | No legacy product names or oncology branding anywhere in the product. |
| 21 | No backend, auth, accounts, saved searches, keys hardcoded, scanners, personal-data OSINT, credit scores, sanctions clearance, coverage/solvency determination, bid/no-bid advice or award prediction. |

→ enforced by `scripts/check-static-safety.mjs`, `R.privacy.checkInput`, module warnings, and `docs/ACCEPTANCE_CHECKLIST.md`.

## 2. Identity & branding

- Normal UI: **JAQA**.
- Legal, copyright, privacy, disclaimer, export-metadata and source-header text: **JAQA™**.
- Tagline: *Public-source triage for global risk, finance, insurance/reinsurance counterparties, procurement, bids, awards, regulations, events, and supply-chain exposure.*

→ `R.legal` (`src/modules/core.js`), `docs/PRIVACY_LEGAL_BRANDING.md`

## 3–4. Goal, privacy & confidentiality

The core question: *What public evidence exists about this organization, counterparty, country, port, category, HS code, CVE, tender, award, grant, PPP, recall, regulation, insurance/reinsurance entity, finance risk domain, or global risk concept?*

JAQA has zero retention on its side. The browser talks directly to providers. The privacy statement, badge, confidentiality warning, privacy modal and data-flow SVG are all included.

→ `src/assets/jaqa-workspace.js` (`privacyContent`, `dataFlowSvg`), `src/modules/net.js`

## 5–7. Design, stack, repository

- Vanilla HTML/CSS/JS with no runtime dependencies.
- Delivery: `dist/index.html` plus content-hashed `dist/assets/` files (plus optional route pages and an inline-everything `embed/` fragment). See the 2026-09-30 blank-page decision below.
- Root `<main id="jaqa-workspace" class="jaqa-workspace">`.
- `window.JAQAWorkspace`, with `.modules` (registry) and `.events` (bus).
- CSS is scoped, uses tokens, supports light/dark, uses the system font stack and inline SVG only.
- The repository structure follows §7, plus extra modules: `net.js`, `clients.js`, `taxonomies.js`, `renderers.js`, `lenses.js`, `advancedQuery.js`.

## 8–9. Live API policy & stack

The Source Capability Registry carries every field listed in §8. The modes are `live`, `linkout`, `download` and `unavailable`, and a live-capable source that has not been verified has status `verify`. Runtime status is held in memory. CORS or network failure → unavailable for the session → link-out. There is no auto-probing on load.

→ `src/modules/sourceRegistry.js`, `config/cors-verification.json`, `docs/SOURCE_REGISTRY.md`

**Verification result (2026-09-30, origin `https://jaqa.life`):** 19 sources are live: GLEIF, World Bank, USGS, Open-Meteo, NWS, CISA KEV (cisagov mirror), NVD, CPSC, NHTSA, USAspending, Federal Register, SEC submissions, CourtListener, Wikidata, Wikipedia, Overpass, ECB, GDELT and EPA ECHO. TED, SEC XBRL, ReliefWeb, IMF, Comtrade, FRED, OpenCorporates, Companies House, SAM and others are link-out.

## 10. Third-party / external dashboard policy

WorldMonitor is reference/link-out only (AGPL, heavy backend). God's Eye View is audit-gated and link-out by default. Scanners and personal-data OSINT tools are never integrated.

→ `docs/THIRD_PARTY_SOURCE_POLICY.md`, Coverage Console

## 11–14. Taxonomies & domain scopes

| Scope | Location |
|---|---|
| Global Risk Universe (82 domains) | `src/modules/taxonomies.js` |
| Finance Risk Universe (32 domains) | `src/modules/taxonomies.js` |
| Insurance lines and entity types | `src/modules/taxonomies.js` |
| Procurement types and categories | `src/modules/taxonomies.js` |
| Insurance/reinsurance scope, including the three required warnings | `src/modules/insuranceReinsurance.js` |
| Procurement scope, including the three required warnings | `src/modules/procurementBids.js` |

## 15–17. Core UX, entity resolution, search pipeline

- Detection covers LEI (mod-97), CVE, CWE, CIK, HS, NHTSA/CPSC recalls, FR document numbers and dockets, TED notices, USAspending IDs, UEI, UK company numbers, IMO numbers, UN/LOCODE, countries, tickers, curated concepts, taxonomy aliases, insurance lines and entity types, ports, persons (restricted) and free text.
- Every interpretation shows a confidence label, and the user can pick another ("Was this wrong?").
- The query plan keeps the initial Tier A budget at ≤ 5 requests. Deeper sources load lazily.
- Requests use `AbortController`, `Promise.allSettled`, a queue with global (6) and per-source caps, de-duplication, timeouts and 429 back-off.

→ `src/modules/searchPipeline.js`, `src/modules/net.js`

## 18–19. Workspace structure & 29 modules

Header, universal search, quick pills, status bar, and a rail grouped into Risk / Finance / Insurance & Reinsurance / Procurement & Bids / Evidence. All 29 modules are implemented. Optional standalone routes: `/global-risk`, `/finance-risk`, `/insurance-reinsurance`, `/procurement-bids`.

→ `src/modules/*.js`

## 20–29. Provenance, legal text, PHI guard, security, performance, errors, states, accessibility, export, print

- Every record carries source, endpoint, session retrieval time, record ID, official link, category and confidence.
- Conflict panel for source discrepancies.
- Input guard for sensitive data.
- XSS-safe rendering (textContent only).
- CSV injection protection.
- Fixed export filenames.
- Friendly error messages, with a developer panel in the Coverage Console.
- Skeleton loaders, keyboard shortcuts, focus traps, aria-live regions, reduced motion.
- Print stylesheet.

## 30–33. Command palette, onboarding, display preferences, SEO

- Ctrl/⌘+K palette.
- First-run guide.
- Memory-only preferences: theme, density, view, compact warnings, gap highlighting, official-link-only mode, module-group and source visibility.
- Static meta tags, canonical, Open Graph and JSON-LD per page.

## 34–37. Code structure, Hostinger, Actions, validation scripts

The header legal comment is in `core.js` and in the built script.

| Area | Files |
|---|---|
| Hostinger | `.htaccess` (CSP `script-src 'self'` and verified `connect-src`, explicit JS/CSS MIME types), `docs/HOSTINGER_DEPLOYMENT.md` (Git deploy of the `hostinger` branch, manual, FTPS, Nginx, rollback, 403 troubleshooting) |
| GitHub Actions | `ci.yml`, `publish-hostinger-branch.yml`, `deploy-hostinger.yml` (optional), `verify-sources.yml` |
| Scripts | `build.mjs`, `check-static-safety.mjs`, `validate-links.mjs`, `verify-cors.mjs`, `preview.mjs`, `smoke-test.mjs` |

## 38–39. Acceptance tests & final checklist

→ `docs/ACCEPTANCE_CHECKLIST.md`

## Decision log

- **2026-09-30 — Licence.** The GPL-3.0 placeholder `LICENSE` was replaced with a proprietary JAQA licence (all rights reserved; `package.json` `license: UNLICENSED`), which resolves the conflict with the product's copyright notice.
- **2026-09-30 — Rename.** The product brand is **JAQA** (formerly RYLAQ) and the production domain is **jaqa.life**. CORS was re-verified from `https://jaqa.life`: 19 sources are live, and Overpass passed this run.
- **2026-09-30 — Design direction.** At the product owner's request, the UI/UX takes its design language from WorldMonitor (dense intelligence grid, wire, status strip) and God's Eye View (HUD globe, reticle, optic modes). The outcome:
  - The Situation Room is the landing module.
  - The situation-room HUD theme is the default. Dark and light remain available; the original §5 white/slate palette is now the "light" theme.
  - The implementation is clean-room: no code or assets reused, and nothing from those projects embedded or called. §10 policy is unchanged, and both projects remain reference/link-out only.
  - The globe uses public-domain Natural Earth outlines and no tiles.
  - Feeds are fixed, non-personal, user-activated queries to already-verified sources.

- **2026-09-30 — Hosting path.** The site is served from the domain root, `https://jaqa.life/` (build default `--workspace-path /`), and deployed with Hostinger Git from the generated `hostinger` branch, which contains only the `dist/` contents. This fixes the Hostinger *403 Forbidden* that occurred when the deployed branch root had no `index.html`, and keeps source files off the web server.

- **2026-09-30 — Blank page on Hostinger → external assets.** The single-file build pinned the inline script with a CSP SHA-256 hash in `.htaccess`. A build bug made that hash wrong, so production rendered blank. More fundamentally, the design breaks whenever anything between the build and the browser changes the HTML: a CDN or minifier, a stale cached page, or a leftover `.htaccess`. The workspace therefore now loads its JS and CSS from content-hashed files in `dist/assets/` under `script-src 'self'`, which has no dependency on HTML bytes.
  - A startup screen (`#jaqa-boot`, `src/assets/jaqa-boot.js`) stays visible with the reason and the fix steps if the app cannot start; the app removes it once it has fully started.
  - `check-static-safety.mjs` enforces: no executable inline scripts, all referenced assets exist, and `script-src` is exactly `'self'`.
  - The preview server and smoke test run under the production CSP.
- **2026-09-30 — Command-center density.** In the situation-room theme on desktop (≥ 1100px), the header, search and Situation Room head are compacted so the evidence globe and live panels fill the first screen. Only spacing and type change; every notice, warning and control stays visible.

- **2026-09-30 — JAQA Ultimate (branch `jaqa-ultimate`).** The product owner asked for one site combining JAQA, God's Eye View and WorldMonitor, and decided:
  1. **WorldMonitor** is AGPL-3.0, so JAQA stays proprietary and its features are rebuilt clean-room as the **Global Monitor**. The monitor serves allowlisted official feeds with headlines and links only, and only feeds verified by `scripts/verify-monitor.mjs` (18 of 21 on 2026-09-30).
  2. **Add a server.** `server/jaqa-server.mjs` (Node ≥ 24.14) serves the workspace, God's Eye View at `/globe/` and its data providers, and writes no access logs. This supersedes "no backend / no proxy" for the full site. The static-only package (`release/jaqa-web.zip`) keeps the original no-backend model, without the monitor and globe.
  3. **God's Eye View** (MIT code) is integrated with **all** layers, including CCTV, ALPR locations, live tracking and the voice agent. This overrides the earlier personal-data OSINT exclusion. Non-commercial data carve-outs are documented in `THIRD_PARTY_NOTICES.md`.
  4. **SEO/GEO/AEO:** crawlable static pages, JSON-LD, sitemap, robots and `llms.txt`, all generated from implemented facts only.

- **2026-10-01 — CesiumJS in the workspace.** At the product owner's request ("use CesiumGS/cesium"), the workspace's 3D Globe screen includes a CesiumJS 3D evidence globe. It loads the self-hosted CesiumJS build from `/globe/cesium/`, uses the bundled Natural Earth II imagery (no third-party requests), and is built from `CesiumWidget` plus primitives (no Knockout widgets).
  - **CSP:** `script-src 'self' 'wasm-unsafe-eval'` (CesiumJS compiles WebAssembly; JavaScript `eval` stays blocked) and `worker-src 'self'`.
  - **Workers:** CesiumJS is steered to its same-origin ES-module workers instead of `blob:` scripts.
  - **Verified in Chromium** under the production CSP: no console errors and no external requests. The only CSP report is protobuf's caught `require` probe, which stays blocked.

## Open decisions

1. **ReliefWeb appname.** Request an approved appname, then re-verify.
2. **Logo.** Replace the inline SVG monogram with the official JAQA mark (inline SVG) when available.
