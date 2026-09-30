# Third-party source & external project policy

JAQA may **reference** public risk, security, sanctions, cyber, trade and intelligence projects. It must not become a forked backend platform, a scanner, an OSINT scraper or a heavy dashboard.

## Integration patterns

| Pattern | When | Rules |
|---|---|---|
| **1. Link-out only** (default) | Third-party dashboards, aggregators, scanners, platforms, paid/commercial sources, regulators, rating agencies, market reports, procurement portals | Opens in a new tab with `rel="noopener noreferrer"` and no referrer. Clearly labeled as external. No iframes. No live calls unless CORS, terms, privacy and rate limits are verified. |
| **2. Reference / taxonomy inspiration** | Design patterns, risk taxonomies, signal-card concepts | Borrow concepts, never runtime code. Clean-room implementation. No proprietary logic, paid data or licence-incompatible code. |
| **3. Public dataset / download** | Openly licensed public data | Only with appropriate licence, attribution, privacy and size. No bulk fetches into the browser. Prefer official APIs or curated link-outs. |
| **4. Narrow frontend adaptation** | A small static component | Only if static, accessible, licence-compatible and privacy-safe, and stripped of backend, storage, analytics, CDNs, service workers, map tiles, external fonts and extra dependencies. |

## Live API rules

A source may be **live** only if **all** of these hold:

1. It has a documented public read-only API.
2. Browser CORS works from the real JAQA origin. Verified by `scripts/verify-cors.mjs`, then re-confirmed in the Coverage Console.
3. Its terms allow programmatic access.
4. Its response shape can be validated. Every client validates before rendering.
5. Its rate limits can be respected through concurrency caps, deduplication, user-triggered enrichment and 429 back-off.

If any of these is uncertain, the source is marked **verify** and falls back to link-out. **A proxy is never used to get around CORS.**

## Design inspiration (clean-room)

The **Situation Room** landing view and the default **situation-room (HUD) theme** take their *design language* from WorldMonitor and God's Eye View. From WorldMonitor: a dense multi-panel intelligence grid, a live wire/ticker and a status strip. From God's Eye View: a globe with reticle, corner brackets, telemetry readouts and optic modes (NVG / FLIR / CRT). This is allowed under pattern **2** above:

- It is a clean-room implementation. No code, CSS, images, fonts, data or configuration from either project was copied, adapted or bundled.
- Neither project is embedded (no iframe), called, forked or depended on at runtime.
- The globe is JAQA's own dependency-free canvas renderer (`src/modules/globe.js`). It uses public-domain Natural Earth outlines (see `THIRD_PARTY_NOTICES.md`), with no map tiles and no WebGL libraries.
- Everything plotted comes from JAQA's verified public sources. The Situation Room feeds are fixed, non-personal queries that stay on standby until the user activates them.
- The UI shows both projects only as reference link-outs, with a no-affiliation statement.

## Specific projects

| Project | Status | Reason |
|---|---|---|
| **WorldMonitor** (`github.com/koala73/worldmonitor`) | Reference / link-out only | AGPL-3.0-only (legal review required before any fork, modification or deployment). Heavy stack (Vite, TS, globe.gl, Three.js, deck.gl, MapLibre, Tauri, Node sidecar, Redis, edge functions, relay, service worker, AI providers). This conflicts with JAQA's static, no-storage, no-tiles, no-proxy model. **No iframe, no API integration, no copied code. Its outputs are never presented as JAQA evidence.** |
| **God's Eye View** (`github.com/bilawalsidhu/gods-eye-view`) | Conditional audit; link-out/reference by default | Not integrated. Integration would require an audit confirming: a permissive or cleared licence; no backend or proxy; no cookies, storage or service workers; no external font/icon/JS/CSS CDNs; no map tiles by default; no scraping of paid, login or confidential sources; no personal-data aggregation; no active scanning; clear provenance and uncertainty labeling. While uncertain, it stays link-out only: no runtime, no iframe, no API calls. |
| OWASP Dependency-Track | Reference | Backend platform. Not forked. |
| Trivy, Grype, Syft | Reference | Scanners / SBOM tools. Not integrated. |
| MITRE ATT&CK / CTI / CWE | Link-out / reference | Taxonomy only. |
| MITRE ATT&CK Navigator | Link-out | Would need a storage/CDN/telemetry audit before any static embedding. |
| CVEProject cvelistV5 | Reference | Never bulk-fetched into the browser. |
| OpenSanctions | Link-out | No auto-screening and no clearance language. The data licence differs from the code licence. |
| CycloneDX, OpenSSF Scorecard | Link-out | Standards / hygiene signals. Not supplier approval. |
| DefectDojo, MISP, OpenCTI, TheHive, DFIR-IRIS | Reference only | Backend platforms. Not suitable for JAQA. |
| SpiderFoot, Recon-ng, Amass, Subfinder, httpx, Nuclei, SQLMap, ZAP | **Never integrated, not linked in the UI** | Active scanning or reconnaissance tools. |
| Sherlock, Maigret and other username-OSINT tools | **Never integrated, not linked in the UI** | Personal-data risk. |
| Shodan, Censys, VirusTotal, urlscan | Link-out only (Cyber module) | No live scanning from JAQA. Labeled with authorization and confidentiality warnings. |

Every external reference in the UI (Coverage Console → *Third-party projects*) shows: name, URL, licence/status where known, mode, a note, and the no-affiliation / no-clearance statement.

## Paid and commercial sources

Dun & Bradstreet, Experian, Creditsafe, EcoVadis, Interos, Resilinc, Everstream, Exiger, Sphera, Assent, S&P Global, Moody's/Orbis, Fitch, AM Best, KBRA, Bloomberg, LSEG/World-Check, PitchBook, FactSet, Dow Jones R&C, Accuity, MarineTraffic, Spire, paywalled news and PACER are listed as **link-out only**. They are never scraped, reproduced, derived or bypassed. Listing them implies no affiliation.

## Internal systems

ERP, vendor master, spend cube, contracts, POs, invoices, questionnaires, credit bureau reports, internal risk scores, audit findings, bid documents, underwriting and claims files, policy administration, treasury, hedging, payments and KYC repositories are **unavailable by design**. JAQA accepts no file uploads and no internal data.
