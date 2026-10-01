# Deploy JAQA (full site) to Hostinger from GitHub

This deploys **all features** — the JAQA workspace, the JAQA Eye View 3D globe, the Global Monitor and their data APIs — as a Hostinger **Node.js web app** connected to GitHub. After the one-time setup below, every merge to `main` goes live automatically.

```
merge to main ─► GitHub Actions builds + tests the full site ─► branch hostinger-node ─► Hostinger redeploys
```

Everything is compiled by GitHub Actions; Hostinger only installs packages and starts the server, so its build step finishes in seconds.

## What you need

- A Hostinger plan that includes **Node.js web apps**. According to Hostinger these are available on **Business Web Hosting** and **Cloud** plans (Cloud Startup and up). If your plan is lower (for example Premium), upgrade or use a VPS (see the end of this guide).
- Your domain `jaqa.life` in the same Hostinger account.
- The branch `hostinger-node` in `JAQA-Life/RYLAQ`. It is created automatically the first time `main` is updated after this change is merged (GitHub → *Actions → Publish full site to hostinger-node branch*). You can also start that workflow by hand with *Run workflow*.

## One-time setup in hPanel

Menu names can differ slightly between hPanel versions; the settings are what matter.

1. **Free the domain from the old static site.** `jaqa.life` previously served static files from `public_html` (File Manager upload or Git deployment). In **hPanel → Websites → jaqa.life**, turn off/remove the **Git** deployment if you set one up, and back up anything you want to keep. If hPanel later says the domain is already in use, remove the old website entry so the Node.js app can take the domain.
2. **Create the Node.js app:** hPanel → **Websites → Add website → Node.js app** → **Import Git repository** → connect your **GitHub** account and allow access to `JAQA-Life/RYLAQ`.
3. **Choose the repository and branch:** repository `JAQA-Life/RYLAQ`, branch **`hostinger-node`**.
4. **Build settings** (Hostinger may pre-fill these by detecting the project; check each one):

   | Setting | Value |
   |---|---|
   | Framework preset | **Express** / **Other** (a custom Node.js server — not "Vite" and not a static preset) |
   | Node.js version | **24.x** |
   | Build command | `npm run build` |
   | Entry file | `server/jaqa-server.mjs` |
   | Output directory | leave empty / default (this is a server app) |

5. **Environment variables** (optional — the site works without any; you can add them later):

   | Variable | What it does |
   |---|---|
   | `JAQA_CONTACT_EMAIL` | Adds a contact address to the Global Monitor's User-Agent (some publishers, e.g. the SEC, ask for one) |
   | `OPENAI_API_KEY` | Enables the 3D globe's voice agent (audio goes to OpenAI) |
   | `AISSTREAM_API_KEY` | Live ships (AIS) on the globe |
   | `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET` | Higher OpenSky flight limits |
   | `TOMTOM_API_KEY` | Live traffic tiles |
   | `FIRMS_MAP_KEY` | NASA FIRMS wildfire layer |
   | `GOOGLE_MAPS_API_KEY` or `CESIUM_ION_TOKEN` | Photorealistic 3D cities. Setting either one makes `npm run build` rebuild the globe with the key embedded (restrict the key to `jaqa.life` in the Google Cloud / Cesium ion console) |

   The full list with descriptions is in `apps/globe/.env.example`. Hostinger provides `PORT` itself; the server reads it.

6. **Deploy.** Then connect/confirm the domain **jaqa.life** for this app and make sure SSL is active.

## Check it

- `https://jaqa.life/` — the workspace (Situation Room)
- `https://jaqa.life/global-monitor/` → **Load monitor feeds** — live headlines from 18 official feeds
- `https://jaqa.life/globe/` — the 3D globe
- `https://jaqa.life/faq/`, `/sitemap.xml`, `/llms.txt` — search / AI-crawler pages
- `https://jaqa.life/api/jaqa/monitor/feeds` — JSON list of the verified feeds

If the build succeeds but the site does not respond, open the app's **Runtime logs** in hPanel. Hostinger names missing environment variables and the wrong port as the most common causes; this server always listens on Hostinger's `PORT`.

## How updates work

1. Changes are merged into `main` on GitHub.
2. *Publish full site to hostinger-node branch* builds everything, starts the server on a GitHub runner, checks every page and API (and a live monitor feed), and only then commits the result to `hostinger-node`.
3. Hostinger sees the new commit and redeploys.

To roll back, revert the bad commit on `main` (or revert the last commit on `hostinger-node`); the previous version is redeployed.

## Before commercial use

God's Eye View's MIT licence covers its code, not all of its data: the TeleGeography submarine-cable map and the Bhote Koshi flood scene are non-commercial, and OpenSky flight data is licensed non-commercially. See `THIRD_PARTY_NOTICES.md` for what to remove or license if jaqa.life is operated commercially.

## Using a Hostinger VPS instead

On a VPS there is no hPanel Node.js app; the same branch works from the command line:

```bash
# once (Node 24 installed — see docs/DEPLOY-NODE.md):
git clone --branch hostinger-node --depth 1 https://github.com/JAQA-Life/RYLAQ.git /var/www/jaqa
cd /var/www/jaqa && npm ci && PORT=3000 HOST=127.0.0.1 npm start   # then systemd + Nginx per DEPLOY-NODE.md
# each update:
cd /var/www/jaqa && git pull && npm ci && npm run build && sudo systemctl restart jaqa
```

(A private repository needs a GitHub deploy key or token on the VPS.)
