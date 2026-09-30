# GitHub + Claude Code workflow

## Branching

- `main` is production. A push to `main` that changes `dist/` triggers the optional Hostinger deploy.
- Work on feature branches (for example `claude/<topic>`) and open a pull request into `main`.
- CI (`.github/workflows/ci.yml`) must pass before merging.

## The build contract

`dist/` is **committed** so Hostinger can serve it directly. It must always match `src/`:

```bash
npm run build     # regenerates dist/, embed/, docs/SOURCE_REGISTRY.md, src/modules/corsConfig.js
npm run check     # static safety + link sanity
npm run test:smoke   # optional locally (needs Playwright); always runs in CI
git add -A && git commit
```

CI rebuilds and fails if `git diff` shows any change to `dist/`, `embed/` or `corsConfig.js`. In practice that means someone edited `src/` without rebuilding, or edited `dist/` by hand, which is not allowed.

## What CI checks

| Job | Checks |
|---|---|
| `static-checks` | `node --check` on every JS module and script. Reproducible build (no stale `dist/`). `scripts/check-static-safety.mjs`. `scripts/validate-links.mjs`. The inlined script parses. |
| `smoke-test` | Headless Chromium against `dist/`, with every provider request intercepted and answered by fixtures. It covers privacy (no cookies, storage or service workers; URL unchanged), input hygiene, routing for every entity type, all 29 modules rendering, exports (fixed filenames, legal metadata, provenance), CSV-injection protection, keyboard behaviour, mobile layout and dark mode. |

`check-static-safety.mjs` fails the build if it finds any of the following:

- storage APIs, cookies or service workers
- `eval` or `new Function`
- `innerHTML`/`outerHTML` assignment, `insertAdjacentHTML` or `document.write`
- `pushState`/`replaceState`/`location.hash` writes
- `console.log`
- hardcoded keys
- external font or icon CDNs, unnecessary script/style CDNs, analytics or trackers
- proxy or backend endpoints
- `_blank` links without `rel="noopener noreferrer"`
- legacy brand names or oncology branding
- `JAQA™` outside a legal context, or in titles, headings or filenames

It also asserts that the required legal, privacy and security content exists in `dist/`.

## Source verification (`verify-sources.yml`)

`scripts/verify-cors.mjs` sends real requests with `Origin: https://jaqa.life`. It emulates CORS preflights and validates response shapes. The GitHub workflow runs it from a GitHub-hosted runner, which has open network access, prints the resulting config as a single line, and uploads the full report as an artifact.

To refresh:

1. **Actions → Verify public sources (CORS + shape) → Run workflow.** Set the origin to the real production origin.
2. Download the artifact, or copy the `JAQA_CORS_CONFIG=` line, into `config/cors-verification.json`.
3. Run `npm run build`, review the diff (live sources, CSP `connect-src`, `docs/SOURCE_REGISTRY.md`), then commit.

Never mark a source live by hand. The build derives live mode and CSP from this file only.

## Working with Claude Code

- Treat `SPEC.md` as the authoritative requirements summary, and `docs/ACCEPTANCE_CHECKLIST.md` as the definition of done.
- Keep modules in `src/modules/`. Register UI modules with `R.modules.register({...})`. Load order is declared once, in `src/index.html`.
- Add sources in `src/modules/sourceRegistry.js`, clients in `src/modules/clients.js`, and verification checks in `scripts/verify-cors.mjs`.
- Never add backend code, storage, analytics, external fonts or CDNs, API keys, scrapers or scanners. The safety check will fail.
- Before pushing, run `npm run build && npm run check`.

## Supply-chain hygiene for Actions

- Workflows use `permissions: contents: read`.
- Third-party actions are pinned to release tags. For maximum safety, pin to full commit SHAs after review:
  `uses: SamKirkland/FTP-Deploy-Action@<40-char-sha> # v4.3.5`.
- The deploy job never runs for forks, and it can be gated behind a protected `production` environment.
