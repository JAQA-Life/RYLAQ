# Privacy, legal & branding rules

## Privacy architecture (zero retention from JAQA's side)

| Guarantee | How it is enforced |
|---|---|
| No backend, proxy, database, serverless function or logging service | Static files only. The safety check fails on proxy or backend endpoints. The CSP `connect-src` lists only verified public APIs. |
| No cookies, browser storage, IndexedDB or service workers | None used in code. The safety check fails on any of these APIs. The smoke test asserts none are set. |
| No analytics, pixels, heatmaps or session replay | None included. The safety check fails on known tracker domains. |
| Search terms never in the URL | No `pushState`/`replaceState`/`hash` writes (checked). The query is kept in memory only. |
| No logging of search terms | No `console.log`. Error logs carry only a module or source id. |
| Memory-only state | `R.state` holds everything. Refresh or **Clear Session** wipes it: session, results, watchlist, preferences, runtime status and caches. |
| Requests carry no cookies or referrer | `fetch` uses `credentials: 'omit'`, `referrerPolicy: 'no-referrer'` and `cache: 'no-store'`. The page sends `Referrer-Policy: no-referrer`. |
| Link-outs | Opened by the user's browser in a new tab with `noopener noreferrer`. A link carries the query only when the source has a search template, and the UI labels it "opens with your query". **Official-link-only mode** removes queries from all link-outs. |
| No file upload, clipboard read, geolocation, camera, microphone or contacts | Not implemented. `Permissions-Policy` disables them. The safety check asserts there is no file input. |
| Situation Room feeds | Fixed, non-personal queries (never search terms) to verified sources: USGS, CISA KEV mirror, Federal Register, ECB. They stay on **standby** until the user clicks *Activate public feeds*. They are memory-only, survive new searches, and are wiped by Clear Session or a refresh. |
| Globe | Plots only records already loaded in the session. It loads no tiles, fonts or remote assets and makes no network requests. |
| Exports | Generated in the browser. Filenames are fixed and never contain the search term. The user is warned and chooses whether to include the search term. |

**Published privacy statement:**

> JAQA does not store, proxy, log, persist, or analyze user searches. Searches are sent directly from the user's browser to selected public data providers. Hosting providers and data providers may maintain their own infrastructure logs according to their own policies.

**Visible badge:**

> JAQA Privacy: Your searches are sent directly from your browser to selected public data providers and are not stored by JAQA.

## Commercial confidentiality & sensitive-data guard

`R.privacy.checkInput()` (in `src/modules/core.js`) runs before any query leaves the page. It rejects the following, with a single generic message that does not reveal what triggered it:

- multi-line or overlong input, and narratives of more than 10 words
- emails, phone numbers, SSN-like numbers and dates of birth
- IBANs (validated with mod-97), payment cards (validated with Luhn) and long account-like digit runs
- MRN, claim and policy identifiers
- keywords indicating confidential commercial, financial, insurance, claims, bid, KYC, M&A or health content

Known public identifiers are always allowed: LEI (checksum-validated), CVE, CWE, CIK, HS, NHTSA/CPSC recall numbers, Federal Register document numbers and TED notice numbers. Rejected input is cleared from the field and is never stored or logged.

## Legal text (source of truth: `R.legal` in `src/modules/core.js`)

- Short disclaimer (header and footer): *Educational and enterprise information-discovery use only. Not legal, compliance, credit, investment, treasury, insurance, reinsurance, underwriting, claims, sanctions, AML, procurement, bid, award, tax, or supply-chain assurance advice.*
- Long disclaimer (Legal dialog, and Session & Privacy): the full list from the specification, including "No public match found does not mean cleared, safe, authorized, solvent, eligible, insured, covered, or low risk."
- Module-specific warnings are declared on each module (`warnings: [...]`) and rendered above its content.
- Exports carry domain warnings (finance, insurance, sanctions, procurement, global risk) plus the legal metadata block.

## Branding

| Context | Use |
|---|---|
| Page title, H1, tabs, buttons, placeholders, pills, status/error/loading messages, filenames, CSS classes, IDs, URLs, marketing copy | **JAQA** (no ™) |
| Footer copyright, legal notices, privacy legal section, disclaimers, source-code header comment, export JSON metadata, trademark notices, ownership statements | **JAQA™** |

The safety checker enforces this. Any line containing `JAQA™` must be in a legal context, and `™` is rejected in `<title>`, H1 and export filenames.

Required legal strings:

- `© {current year} JAQA™. All rights reserved.` (the year is computed at runtime)
- `JAQA™ is a trademark of JAQA.`
- `JAQA™ is an independent interface and is not affiliated with or endorsed by these providers unless expressly stated.`

Export metadata block:

```json
{
  "generatedBy": "JAQA Global Risk, Finance, Insurance & Procurement Intelligence Workspace",
  "host": "jaqa.life",
  "dataSources": ["…"],
  "legal": {
    "trademark": "JAQA™",
    "copyright": "© 2026 JAQA™. All rights reserved.",
    "disclaimer": "Educational and enterprise information-discovery use only. Not legal, compliance, credit, investment, treasury, insurance, reinsurance, underwriting, claims, sanctions, AML, procurement, bid, award, tax, or supply-chain assurance advice."
  }
}
```

The product carries no legacy workspace branding. The safety check fails on legacy names and oncology references.

## Visual brand

- Default **situation-room (HUD) theme**: near-black `#05080F`, cyan `#22D3EE`, teal `#5EEAD4`, monospace telemetry. Light theme uses JAQA navy `#0B2545` and teal `#14B8A6`. All colours are CSS custom properties (`--rq-*`, `--t-*`) scoped under `.jaqa-workspace`, so global JAQA CSS can override them.
- System font stack only, inline SVG icons only, no external images.
- The logo slot is an inline SVG monogram next to the "JAQA" wordmark in `src/assets/jaqa-workspace.js` (`logo()`). Replace it there with the official mark as inline SVG.
