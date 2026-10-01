# Deploying JAQA to Hostinger (static files only)

JAQA is a static web app. Hostinger only needs to **serve files**. There is no Node.js app, no PHP, no Python, no database and no build step on the server.

```
GitHub main ──► dist/ (committed, reproducible) ──► hostinger branch ──► Hostinger public_html/ (static files)
                                                                     │
User's browser ◄──────── static HTML/CSS/JS ─────────────────────────┘
User's browser ────────► verified public APIs (GLEIF, USGS, …) ────► User's browser
                         (no JAQA server in the middle)
```

## 0. "403 Forbidden — Access to this resource on the server is denied!"

Hostinger returns this when the web root (`public_html/`) has **no `index.html`**. With directory listing off, the server has nothing to show. The usual causes:

| Cause | Fix |
|---|---|
| Hostinger Git deploys a branch whose root has no `index.html`. For example, `main` before the app pull request was merged, when it held only `LICENSE`. | **Merge the app into `main`, then click Deploy in hPanel.** The repository-root `.htaccess` routes every request into `dist/`, so a deploy of `main` serves the app at `/`. Better still, deploy the **`hostinger`** branch (section 2), which contains only the site files. |
| The `dist/` **folder** was uploaded instead of its **contents** (`public_html/dist/index.html`). | Move the files up, so the page is at `public_html/index.html`. |
| Hostinger's placeholder `default.php` (or an old `index.php`) is still in `public_html/`, or the directory was not empty when Git deploy was set up. | Delete the placeholders, empty `public_html/`, and redeploy. |
| Wrong permissions after a manual upload. | Folders `755`, files `644` (File Manager → Permissions). |

## 1. Directory layout

The production artifact is `dist/`. It is built for the **domain root**, `https://jaqa.life/`:

```
dist/                                → public_html/
├── .htaccess                        # security headers + CSP (Apache/LiteSpeed)
├── index.html                       # the workspace page                https://jaqa.life/
├── assets/                          # app script, stylesheet, startup diagnostics (content-hashed names)
├── global-risk/index.html           # optional standalone routes        https://jaqa.life/global-risk/
├── finance-risk/index.html                                              https://jaqa.life/finance-risk/
├── insurance-reinsurance/index.html                                     https://jaqa.life/insurance-reinsurance/
└── procurement-bids/index.html                                          https://jaqa.life/procurement-bids/
```

To serve from a sub-folder instead, rebuild with `node scripts/build.mjs --workspace-path /workspace/` (or `--site https://other-domain` for another domain), commit, and deploy into `public_html/workspace/`. Every page is self-contained, so any location works; the flags only change canonical and Open Graph URLs.

## 2. Hostinger Git deployment (recommended)

Hostinger Git deploy copies the **root of one branch** into a directory. The repository root is source code, so it must never be the web root. Instead, `.github/workflows/publish-hostinger-branch.yml` publishes **only the contents of `dist/`** to a branch called `hostinger` on every push to `main` that changes `dist/`. It can also be run by hand from the Actions tab.

```
main  (src/, scripts/, docs/, dist/ …)
  └─ publish-hostinger-branch.yml ─► hostinger  (index.html, .htaccess, route folders — nothing else)
                                          └─ Hostinger Git deploy ─► public_html/
```

One-time setup:

1. **Merge the pull request into `main`.** The workflow runs, verifies that `dist/` is current and passes the safety check, then creates the `hostinger` branch. Check **Actions → Publish static site to hostinger branch** for a green run and confirm that the `hostinger` branch exists.
2. **Empty `public_html/`.** In **hPanel → Websites → Manage → Files → File Manager**, delete `default.php` and any other placeholder files. Hostinger Git deploy requires the target directory to be empty.
3. **Private repository only:** in **hPanel → Advanced → Git**, copy the SSH key shown. Then add it in GitHub under **Settings → Deploy keys → Add deploy key**, read-only (leave *Allow write access* unchecked).
4. In **hPanel → Advanced → Git → Create a new repository**, enter:
   - **Repository:** `git@github.com:JAQA-Life/RYLAQ.git` (use the new name if you rename the repository)
   - **Branch:** `hostinger`
   - **Directory:** leave empty (this deploys into `public_html/`)
5. Click **Deploy**, then open `https://jaqa.life/`.
6. **Auto-deployment:** in hPanel's Git section, enable **Auto Deployment** and copy the webhook URL. In GitHub, go to **Settings → Webhooks → Add webhook**, paste the URL, and choose content type `application/json` with *Just the push event*. From then on, merge to `main` → the workflow updates `hostinger` → the webhook triggers the Hostinger deploy.

Notes:

- Hostinger's clone puts a `.git/` folder in `public_html/`. The generated `.htaccess` refuses every dotfile path (`RewriteRule (^|/)\.(?!well-known/) - [F,L]`), so `https://jaqa.life/.git/config` returns 403. Section 9 has a check for this.
- The `hostinger` branch is append-only: every publish is a normal commit that records the source commit, and it is never force-pushed. That history is what you roll back to.
- **Deploying `main` directly also works.** The repository-root `.htaccess` rewrites every request into `dist/`:
  - `https://jaqa.life/` serves `dist/index.html`, with its CSP and headers.
  - Source paths such as `/src/…`, `/scripts/…` and `/package.json` return 404.
  - `/.git/…` returns 403.

  The source files are still copied onto the server's disk, though, and on Nginx or with `.htaccess` disabled they would be served. The `hostinger` branch is therefore the recommended target.

## 3. Manual upload (File Manager)

**Easiest:** use the ready-made package [`release/jaqa-web.zip`](../release/jaqa-web.zip), which contains exactly the `dist/` files, including `.htaccess`. Upload it to `public_html/`, right-click → **Extract** into `public_html/` itself, then delete the ZIP. The step-by-step guide is in [`release/README.md`](../release/README.md). If Git deploy is configured, disable it first, or the next deploy replaces the upload. The steps below do the same with individual files.

1. Make sure `dist/` is current: run `npm run build && npm run check`, or rely on CI.
2. In **hPanel → Files → File Manager**, open `public_html/` and delete the placeholder files.
3. Upload **all files inside `dist/`**, not the `dist` folder itself, including the hidden `.htaccess`. Enable *Show hidden files* to confirm it is there. Alternatively, download the `hostinger` branch as a ZIP from GitHub, upload it, and extract it in `public_html/`.
4. Visit `https://jaqa.life/`. The page should load with no console errors.

## 4. GitHub Actions FTPS deployment (optional alternative)

`.github/workflows/deploy-hostinger.yml` uploads `dist/` over FTPS on every push to `main` that changes `dist/`. It is **skipped**, not failed, until the secrets exist. Use either Git deploy or FTPS, not both.

1. In hPanel, go to **Files → FTP Accounts** and create a dedicated FTP account.
2. In GitHub, open **Settings → Secrets and variables → Actions** and add:
   - `HOSTINGER_FTP_SERVER`: the FTP host, for example `ftp.jaqa.life` or the server IP.
   - `HOSTINGER_FTP_USERNAME`
   - `HOSTINGER_FTP_PASSWORD`
   - `HOSTINGER_REMOTE_DIR`: optional; the default is `public_html/` (must end with `/`).
   - Optional **variable** `HOSTINGER_FTP_PROTOCOL`: `ftps` (default) or `ftp`.
3. Optional: in **Settings → Environments → production**, add required reviewers for a manual approval gate.

Safeguards in the workflow:

- `permissions: contents: read`, and it never runs from forks.
- It re-builds and refuses to deploy if `dist/` is stale.
- It runs the static safety check before uploading.
- Secrets are masked by GitHub and never echoed.
- The action is pinned to a release tag. After reviewing that release, pin it to a full commit SHA.

## 5. HTTPS

Enable the free SSL certificate in **hPanel → Security → SSL**. The generated `.htaccess` redirects HTTP to HTTPS and sends `Strict-Transport-Security`.

## 6. Security headers & CSP

`dist/.htaccess` (generated by `scripts/build.mjs`) sets:

| Header | Value |
|---|---|
| `Options -Indexes` | no directory listing |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | geolocation, microphone, camera, payment, usb and clipboard-read all disabled |
| `Cross-Origin-Opener-Policy` / `Cross-Origin-Resource-Policy` | `same-origin` |
| `Content-Security-Policy` | see below |
| `Cache-Control` for HTML | `no-cache, no-store, must-revalidate` (every visit gets the current page and asset names) |
| `Cache-Control` for `assets/*.js`, `*.css` | `public, max-age=31536000, immutable` (safe: a changed file always gets a new, content-hashed name) |
| `AddType` | `.js` → `text/javascript`, `.css` → `text/css`. Required because `nosniff` makes browsers refuse a script served with the wrong type. |

The Content-Security-Policy is built as follows:

- `script-src 'self'`: only the app's own files in `assets/` can run. There is no inline script, no `unsafe-inline` and no `unsafe-eval`. Because nothing is pinned to the HTML bytes, a CDN, minifier or cache that rewrites HTML cannot stop the app (earlier builds pinned an inline script by hash, which rendered a blank page when that broke).
- `style-src 'self' 'unsafe-inline'`: the stylesheet is in `assets/`; `'unsafe-inline'` covers the small startup-screen style block and style attributes set by the app.
- `connect-src`: **only** the origins of sources verified for browser CORS in `config/cors-verification.json`. Unverified sources are not reachable in production, even through the Coverage Console.
- `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `worker-src 'none'`, `upgrade-insecure-requests`.

### Nginx equivalent (if your plan uses Nginx)

```nginx
location / {
  autoindex off;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  add_header Referrer-Policy "no-referrer" always;
  add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=(), usb=(), clipboard-read=()" always;
  add_header Cross-Origin-Opener-Policy "same-origin" always;
  add_header Cross-Origin-Resource-Policy "same-origin" always;
  # Copy the exact CSP value from dist/.htaccess:
  add_header Content-Security-Policy "<paste from dist/.htaccess>" always;
  add_header Cache-Control "no-cache, no-store, must-revalidate" always;
  gzip on; gzip_types text/html text/css application/javascript application/json image/svg+xml;
}
```

## 7. Privacy nuance: hosting logs

JAQA never writes search terms into URLs, so the requests Hostinger sees are only for static files: `/`, `/index.html`, the route folders, and so on. Hostinger may still keep standard access logs under its own policy: IP address, user agent, requested path, timestamp and status code. The published privacy statement says exactly this:

> JAQA does not store, proxy, log, persist, or analyze user searches. Searches are sent directly from the user's browser to selected public data providers. Hosting providers and data providers may maintain their own infrastructure logs according to their own policies.

Do not enable Hostinger analytics or CDN features that inject scripts into pages.

## 8. Rollback

- **Manual:** keep the previous `dist/` release (for example, download it from the GitHub commit) and re-upload it.
- **Git deploy:** revert the offending commit on `main` (`git revert <sha>`) and push. The publish workflow commits the previous `dist/` to `hostinger`, and Hostinger redeploys it. For an immediate rollback, run `git revert` on the `hostinger` branch itself and click **Deploy** in hPanel.
- **FTPS:** revert on `main`. The workflow re-uploads the previous `dist/`.
- The HTML is never cached (`no-store`), so a rollback takes effect on the next page load.

## 9. Verify that no backend is required

1. Open `https://jaqa.life/`, then DevTools → **Network**. Reload. The only same-origin request should be `index.html`.
2. Run a search. The only new requests should go to public API hosts listed in the CSP `connect-src`. There should be no requests to `jaqa.life`.
3. **Application** tab: no cookies, no Local/Session Storage entries, no IndexedDB databases, no service workers.
4. The URL never changes when you search.
5. Open the **Coverage Console** and click *Check availability of all live-capable sources* to confirm live access from the production origin.
6. Visit `https://jaqa.life/.htaccess` and `https://jaqa.life/.git/config`. Both should return 403 or 404, not the file.
