# JAQA Global Risk, Finance, Insurance & Procurement Intelligence Workspace

Public-source triage for global risk, finance, insurance/reinsurance counterparties, procurement, bids, awards, regulations, events, and supply-chain exposure.

JAQA is a **static, privacy-first web app**. It runs entirely in the browser. It has no backend, no proxy, no database, no accounts, no cookies, no browser storage, no service workers and no analytics. Queries go **directly from the user's browser** to selected public APIs, and only APIs that have been **verified for browser CORS from the JAQA origin** are called live. Every other source is an official link-out.

> Educational and enterprise information-discovery use only. Not legal, compliance, credit, investment, treasury, insurance, reinsurance, underwriting, claims, sanctions, AML, procurement, bid, award, tax, or supply-chain assurance advice. © JAQA™. All rights reserved.

## What's in the box

| Path | Purpose |
|---|---|
| `dist/index.html` | **Production artifact**: one self-contained HTML file (CSS and JS inlined, inline SVG icons, system fonts). Upload to Hostinger or open locally. |
| `dist/.htaccess` | Security headers, HTTPS redirect, no directory listing, gzip, and a strict CSP. `script-src` is pinned to the script's SHA-256 hash and `connect-src` allows only verified API origins. |
| `dist/{global-risk,finance-risk,insurance-reinsurance,procurement-bids}/` | Optional standalone routes: the same app with route-specific title, meta and canonical, opening on the matching module. |
| `embed/jaqa-workspace-embed.html` | Fragment for CMS/intranet custom-HTML blocks. It contains no html/head/body, and its styles are scoped to `.jaqa-workspace`. |
| `src/` | Readable source: `src/index.html` loads the unbundled modules, so the app also runs from `src/` without a build. |
| `config/cors-verification.json` | Evidence for live mode: the result of real requests sent with `Origin: https://jaqa.life`. |
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

Opening `dist/index.html` directly from disk also works (`file://`). Live requests then come from the `null` origin; the CORS verification was done for `https://jaqa.life`, so some providers may respond differently from disk.

## Live sources (verified 2026-09-30 for `https://jaqa.life`)

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

See [`docs/HOSTINGER_DEPLOYMENT.md`](docs/HOSTINGER_DEPLOYMENT.md). In short, upload the **contents** of `dist/` to `public_html/workspace/` (or `public_html/`), including `.htaccess`. Hostinger needs no Node.js, PHP, database or build step. The optional GitHub Actions FTPS deploy is in `.github/workflows/deploy-hostinger.yml`.

## Licence note

The repository currently contains a `LICENSE` file with **GPL-3.0**, which predates this build. The product copy uses "© JAQA™. All rights reserved." These two positions conflict. Choose one: keep GPL-3.0 and adjust the footer wording, or replace `LICENSE` with a proprietary licence (`PROPRIETARY.md`). This is a legal decision for JAQA and was deliberately not changed here.

---
JAQA™ is a trademark of JAQA. JAQA™ is an independent interface and is not affiliated with or endorsed by data providers unless expressly stated.
