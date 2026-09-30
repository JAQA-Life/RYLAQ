# Acceptance checklist

The **Verified by** column uses these codes:

| Code | Meaning |
|---|---|
| **SMOKE** | Automated in `scripts/smoke-test.mjs` (Playwright, providers mocked) |
| **STATIC** | Automated in `scripts/check-static-safety.mjs` / `validate-links.mjs` / CI build diff |
| **VERIFY** | `scripts/verify-cors.mjs` evidence in `config/cors-verification.json` |
| **DESIGN** | Enforced by construction (code path), reviewable in source |
| **MANUAL** | Must be confirmed on the deployed site or by a human reviewer |

Status as of this build: all SMOKE, STATIC and VERIFY items pass. MANUAL items are listed so they can be confirmed after deployment.

## Deployment

| # | Test | Verified by |
|---|---|---|
| 1 | Works locally without backend | SMOKE (served statically); `file://` MANUAL |
| 2 | Embeds without breaking host styles | DESIGN (all CSS scoped to `.rylaq-workspace`; `embed/` fragment); MANUAL in CMS |
| 3 | No console errors on load | SMOKE |
| 4 | No requests to RYLAQ servers besides static assets | SMOKE (only verified public hosts contacted; zero on load) |
| 5–9 | No cookies, local/session storage, IndexedDB, service workers | SMOKE + STATIC |
| 10–11 | Refresh and Clear Session wipe state | SMOKE (Clear Session); DESIGN (memory only) |
| 12 | No search term in URL | SMOKE + STATIC |
| 13–15 | No analytics, font CDNs or unnecessary CDNs | STATIC |
| 16 | `dist/index.html` serves statically on Hostinger | MANUAL (docs/HOSTINGER_DEPLOYMENT.md) |
| 17–18 | `.htaccess` headers present, no directory listing | STATIC (content); MANUAL (live response headers) |
| 19 | HTTPS works | MANUAL (enable SSL in hPanel; `.htaccess` redirects) |
| 20–21 | GitHub Actions deploy works; secrets not exposed | MANUAL (needs secrets); DESIGN (masked secrets, no echo) |

## Functional

| # | Test | Verified by |
|---|---|---|
| 22 | Company name → organization signals or link-outs | SMOKE |
| 23 | LEI → GLEIF entity | DESIGN (checksum-validated detection → GLEIF record + parents); VERIFY |
| 24 | Ticker/CIK → filings or link-out | SMOKE (CIK); ticker via Wikidata → CIK → SEC (DESIGN) |
| 25 | Country → World Bank context | SMOKE |
| 26 | Port → events and link-outs | SMOKE |
| 27 | HS code → trade context/link-outs | SMOKE |
| 28 | CVE → KEV/NVD without supplier-exposure claim | SMOKE |
| 29 | Tender ID → notice link-out | DESIGN (TED publication-number → official notice link) |
| 30 | Award ID → award record | DESIGN (USAspending generated ID → detail; PIID → keyword search) |
| 31–32 | Grant / PPP → record or link-out | DESIGN (USAspending assistance; dev-bank/PPP directories) |
| 33 | Recall → CPSC/NHTSA | SMOKE (NHTSA campaign) |
| 34 | Regulatory topic → Federal Register | SMOKE (routing) + DESIGN |
| 35 | Insurer/reinsurer/broker/captive/ILS → insurance intelligence | SMOKE (concept) + DESIGN (entity types) |
| 36–37 | Finance / global risk concept → universes | SMOKE |
| 38 | Ambiguous query → candidates + correction | SMOKE (banner) + DESIGN ("Was this wrong?", GLEIF candidate picker) |
| 39 | Unsupported source → link-out, not broken UI | DESIGN (task status `linkout`) |
| 40 | Failed request → partial results, no crash | DESIGN (`Promise.allSettled`, per-task errors, "Partial results" badge) |
| 41 | Rate limit → friendly retry | DESIGN (429 → `retryAt`, message, retry button) |
| 42 | Empty result → alternatives + no hit ≠ clear | DESIGN (empty state with warning + link-out) |

## Privacy

| # | Test | Verified by |
|---|---|---|
| 43–46 | Privacy badge, provider list, confidentiality and personal-data warnings | SMOKE + DESIGN |
| 47–49 | No file upload, geolocation or clipboard read | STATIC + SMOKE |
| 50 | No console logging of search terms | STATIC (`console.log` banned; error logs carry ids only) |
| 51–52 | Export filenames have no search terms; JSON has RYLAQ™ metadata | SMOKE |
| 53 | Link-outs labeled as opened by the user's browser | DESIGN (labels + fine print) |
| 54–56 | No proxy, no scraping, no confidential data accepted | STATIC + SMOKE (input guard) |
| 57 | Hostinger log nuance documented | DESIGN (privacy statement, docs) |

## Accessibility

| # | Test | Verified by |
|---|---|---|
| 58–63 | Keyboard reach, rail arrows, Escape, focus trap and return, aria-live | SMOKE (search `/`, Escape, focus return, palette) + DESIGN |
| 64 | Badges carry text | DESIGN |
| 65 | Table headers | DESIGN (`scope` on all headers) |
| 66 | Contrast light/dark | MANUAL (tokens chosen for AA; verify with a contrast tool) |
| 67–68 | Touch targets; reduced motion | DESIGN (≥ 30–38px controls; `prefers-reduced-motion`) |
| 69–70 | No buy/sell colour semantics; screen-reader-friendly warnings | DESIGN |

## Branding

| # | Test | Verified by |
|---|---|---|
| 71–76 | RYLAQ vs RYLAQ™ placement, footer, header comment, export metadata, privacy legal section | STATIC + SMOKE |
| 77–80 | No legacy or oncology branding | STATIC |

## Safety / legal

| # | Test | Verified by |
|---|---|---|
| 81 | Sanctions never says "cleared" | SMOKE + DESIGN |
| 82 | No credit score | DESIGN (derived metrics labeled; no scoring code) |
| 83 | CVE ≠ supplier exposure | SMOKE |
| 84 | No fabricated shipments | DESIGN (no shipment data source) |
| 85 | No bid/no-bid or performance guarantee | DESIGN + module warnings |
| 86 | ESG not certification | DESIGN + module warnings |
| 87 | Scenario lab gives no fake precision | DESIGN (count-based band with printed rules) |
| 88–89 | No coverage/solvency determination; no investment/hedging advice | DESIGN + module warnings |
| 90 | Exports include disclaimers and provenance | SMOKE |
| 91 | All link-outs use `rel="noopener noreferrer"` | STATIC (single `extLink` helper) |
| 92–94 | No paid scraping, no confidential storage, no misconduct assistance | STATIC + DESIGN |
| 95–98 | WorldMonitor and God's Eye View link-out only; no forked backend; no scanners | DESIGN (docs/THIRD_PARTY_SOURCE_POLICY.md) |

## Domain tests

| Test | Verified by |
|---|---|
| GR1–GR5 | SMOKE (routing) + DESIGN (coverage matrix, gaps, insurance/procurement mappings with "not a determination" labels) |
| INS1–INS8 | SMOKE (concept) + DESIGN (regulator/rating/market link-outs only; ILS/captive warnings; insurance-related procurement via USAspending + portals) |
| PROC1–PROC10 | SMOKE (routing) + DESIGN. TED and portals are link-out (verified: no CORS). Deadline radar is in memory and states that no verified API publishes deadlines. Translation-risk badges are shown. |
| FIN1–FIN20 | SMOKE (CIK, finance universe, exports) + DESIGN (8-K item signals, derived metrics with formulas, no scores, link-outs for liens, insolvency and ratings, no heavy auto-loads) |

## Known limitations (honest)

- **Open tender discovery is link-out only.** TED's API did not return CORS headers for browser POSTs, and SAM.gov needs a key. Live procurement data is limited to US federal awards (USAspending).
- **ReliefWeb** v2 requires an approved appname. Request one at apidoc.reliefweb.int, add a check, and re-verify.
- **SEC XBRL** (companyfacts) lacks CORS. Derived metrics only appear if a future verification passes. The filing index and 8-K signals are live.
- **Overpass** was flaky during verification (504), so it is link-out. It can be re-verified.
- **GDELT** omits CORS headers on 429 responses. A throttled request marks GDELT unavailable for the session.
- CORS verification was done from a server with the production `Origin` header. Re-confirm in the Coverage Console from the deployed site.
