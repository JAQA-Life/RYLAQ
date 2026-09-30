# God's Eye View inside JAQA

This folder is **God's Eye View** by Bilawal Sidhu, integrated into the JAQA site as its 3D globe at `/globe/`.

| | |
|---|---|
| Upstream | https://github.com/JAQA-Life/gods-eye-view (fork of https://github.com/bilawalsidhu/gods-eye-view) |
| Upstream commit | `082074a00684af97458b85529093e2b2a9f28ed1` |
| Licence | MIT: see [`LICENSE`](LICENSE) (Copyright (c) 2026 Bilawal Sidhu). The notice must stay with the code. |
| Excluded from this copy | `docs/media/` (68 MB of demo GIFs and videos), `.github/`, `.agents/` |

## JAQA changes to the upstream code

1. **Fonts are self-hosted.** `index.html` no longer loads Google Fonts:
   - `src/jaqaFonts.css` (imported first in `src/main.js`) supplies Inter and JetBrains Mono from `@fontsource` (SIL OFL 1.1).
   - Material Symbols Outlined (Apache-2.0) is subset to the app's icons by `scripts/jaqa-subset-icons.py` into `public/fonts/material-symbols-outlined-subset.woff2` (5 KB).
   - The `icon_names` list stays in `index.html` as a comment, so upstream's `src/materialSymbolsSubset.test.mjs` still guards it.
2. **Search and share metadata** (description, canonical `https://jaqa.life/globe/`, Open Graph) were added to `index.html`.
3. **It is built for `/globe/`** by `../../scripts/build-globe.mjs` (`vite build --base /globe/`).
4. **It is served by `../../server/jaqa-server.mjs`**, which runs Vite's preview server with this folder's unmodified `vite.config.js`. All providers are God's Eye View's own middleware, and upstream's dev-only key-setup endpoint is not registered in production.

Upstream's unit suite (`npm test`) passes on this copy: 4,736 passed, 0 failed, 1 skipped (as upstream).

## Keys

Provider keys are read from the server environment; see [`.env.example`](.env.example) and upstream [`README.md`](README.md) under "API Keys":
- `GOOGLE_MAPS_API_KEY` and `CESIUM_ION_TOKEN` are browser-side keys, embedded at build time by upstream's build. Restrict them to your domain in the provider console.
- All others (OpenAI, AISStream, OpenSky, TomTom, FIRMS, …) stay on the server.

Without keys, the globe runs keyless: Esri satellite imagery plus OpenStreetMap, and the keyless feeds listed in upstream's README.
