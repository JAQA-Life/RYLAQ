# RYLAQ Global Risk, Finance, Insurance & Procurement Intelligence Workspace

Public-source triage for global risk, finance, insurance/reinsurance counterparties, procurement, bids, awards, regulations, events, and supply-chain exposure.

RYLAQ is a **static, privacy-first web app**. It runs entirely in the browser. It has no backend, no proxy, no database, no accounts, no cookies, no browser storage, no service workers and no analytics. Queries go **directly from the user's browser** to selected public APIs, and only APIs that have been **verified for browser CORS from the RYLAQ origin** are called live. Every other source is an official link-out.

> Educational and enterprise information-discovery use only. Not legal, compliance, credit, investment, treasury, insurance, reinsurance, underwriting, claims, sanctions, AML, procurement, bid, award, tax, or supply-chain assurance advice. © RYLAQ™. All rights reserved.

## What's in the box

| Path | Purpose |
|---|---|
| `dist/index.html` | **Production artifact**: one self-contained HTML file (CSS and JS inlined, inline SVG icons, system fonts). Upload to Hostinger or open locally. |
| `dist/.htaccess` | Security headers, HTTPS redirect, no directory listing, gzip, and a strict CSP. `script-src` is pinned to the script's SHA-256 hash and `connect-src` allows only verified API origins. |
| `dist/{global-risk,finance-risk,insurance-reinsurance,procurement-bids}/` | Optional standalone routes: the same app with route-specific title, meta and canonical, opening on the matching module. |
| `embed/rylaq-workspace-embed.html` | Fragment for CMS/intranet custom-HTML blocks. It contains no html/head/body, and its styles are scoped to `.rylaq-workspace`. |
| `src/` | Readable source: `src/index.html` loads the unbundled modules, so the app also runs from `src/` without a build. |
| `config/cors-verification.json` | Evidence for live mode: the result of real requests sent with `Origin: https://rylaq.com`. |
| `scripts/` | Dev-only tooling: build, safety checker, link validator, CORS verifier, preview server, and a Playwright smoke test. |
| `docs/` | Deployment, workflow, source policy, generated source registry, acceptance checklist, and privacy/legal/branding rules. |
| `SPEC.md` | Condensed authoritative specification with implementation traceability. |

## Quick start

```bash
# No install needed for production. For development:
npm run build          # regenerate dist/, embed/, docs/SOURCE_REGISTRY.md, corsConfig.js
npm run check          # static safety + link sanity checks
npm run preview        # http://127.0.0.1:8080 (serves dist/, no logging)
npm run test:smoke     # Playwright end-to-end test with mocked providers (needs `playwright`)
npm run verify:cors    # re-verify providers from your machine (network required)
```

Opening `dist/index.html` directly from disk also works (`file://`). Live requests then come from the `null` origin; the CORS verification was done for `https://rylaq.com`, so some providers may respond differently from disk.

## Live sources (verified 2026-09-30 for `https://rylaq.com`)

Live: GLEIF, World Bank, USGS, Open-Meteo, NOAA/NWS, CISA KEV (official `cisagov` GitHub mirror), NVD, CPSC, NHTSA, USAspending, Federal Register, SEC EDGAR submissions, CourtListener, Wikidata, Wikipedia, ECB, GDELT and EPA ECHO.

Link-out only (verification failed or a key/login is required):

| Source | Why it is link-out only |
|---|---|
| TED | No CORS header on the POST search. |
| SEC XBRL, EDGAR full-text search, SEC tickers | No CORS header returned. |
| ReliefWeb | API v1 is decommissioned; v2 needs an approved appname. |
| IMF | Returned 403. |
| Overpass | Server timeouts during verification (504). |
| UN Comtrade | No CORS header. |
| FRED, OpenCorporates, Companies House, SAM.gov, ACLED, NASA FIRMS | Need a key or registration. |
| Insurance regulators, rating agencies, market reports, procurement portals, sanctions lists, insolvency and lien registries, paid data providers | Link-out only by policy. |

Full detail: [`docs/SOURCE_REGISTRY.md`](docs/SOURCE_REGISTRY.md).

To promote a source to live, add checks to `scripts/verify-cors.mjs`. Then run it locally or through the *Verify public sources* GitHub workflow, commit `config/cors-verification.json`, and run `npm run build`. The build updates both the in-app registry and the CSP.

## Modules (29)

- **Risk:** Overview / Risk Triage · Organization 360 · Global Risk Universe (82 domains) · Cyber, Technology, AI & Software Supply Chain · Physical, Climate & Catastrophe · ESG, Conduct, Human Rights & Nature · Trade, Customs & Category · Supply Chain & Third-Party · Regulatory Change Radar · Standards & Frameworks
- **Finance:** Finance Risk Universe (32 domains) · Counterparty Financial Fragility · Public Filing & Financial Statement Lens · Credit, Insolvency & Litigation · Financial Crime, Sanctions & Enforcement · Market, Macro & Sovereign · FX, Interest Rate & Commodity
- **Insurance & Reinsurance:** Intelligence · Financial Strength
- **Procurement & Bids:** Procurement & Bid Radar · Awards & Past Performance · Grants & Public Funding · PPP, Concessions & Infrastructure
- **Evidence:** Relationship Explorer · Scenario Stress Lab · Watchlist / Evidence Board · Advanced Query · Coverage Console · Session & Privacy

## Deployment

See [`docs/HOSTINGER_DEPLOYMENT.md`](docs/HOSTINGER_DEPLOYMENT.md). In short, upload the **contents** of `dist/` to `public_html/workspace/` (or `public_html/`), including `.htaccess`. Hostinger needs no Node.js, PHP, database or build step. The optional GitHub Actions FTPS deploy is in `.github/workflows/deploy-hostinger.yml`.

## Licence note

The repository currently contains a `LICENSE` file with **GPL-3.0**, which predates this build. The product copy uses "© RYLAQ™. All rights reserved." These two positions conflict. Choose one: keep GPL-3.0 and adjust the footer wording, or replace `LICENSE` with a proprietary licence (`PROPRIETARY.md`). This is a legal decision for RYLAQ and was deliberately not changed here.

---
RYLAQ™ is a trademark of RYLAQ. RYLAQ™ is an independent interface and is not affiliated with or endorsed by data providers unless expressly stated.
