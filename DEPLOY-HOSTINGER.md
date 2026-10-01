# Deploying the full JAQA site on Hostinger (Node.js)

This guide covers `jaqa-hostinger.zip`. It runs the **whole site** from one Node.js process:

| Path | What it serves |
|---|---|
| `/` | JAQA workspace, plus `/about/`, `/faq/`, `/sources/`, `/privacy/`, `/3d-globe/`, `/global-monitor/` and the other section pages |
| `/globe/` | JAQA Eye View 3D globe (built on God's Eye View, MIT, © Bilawal Sidhu) |
| `/api/…` | God's Eye View's data providers (aircraft, ships, satellites, weather, cameras, …) |
| `/api/jaqa/monitor/…` | JAQA Global Monitor feeds (18 verified official feeds) |

A plain file upload to shared hosting (`public_html`) **cannot** run this; that option serves only static files. You need a plan that runs Node.js: a **Hostinger VPS**, or a Hostinger plan that offers Node.js apps with Node 24.

## Requirements

- **Node.js 24.14 or newer.** God's Eye View requires it. In testing, the server also started and served every route on Node 22.22, but upstream only supports 24, so use 24.
- About 1 GB of disk space for the code and dependencies, and 512 MB+ RAM.
- Outbound internet access from the server to the public data providers.

## Option A — Hostinger VPS (Ubuntu), recommended

```bash
# 1. Node.js 24 from the official binaries (use the newest v24.x listed at
#    https://nodejs.org/dist/latest-v24.x/ — v24.21.0 was current when this was written)
V=v24.21.0
curl -fsSLO https://nodejs.org/dist/$V/node-$V-linux-x64.tar.xz
curl -fsSL https://nodejs.org/dist/$V/SHASUMS256.txt | grep "node-$V-linux-x64.tar.xz" | sha256sum -c -
tar -xJf node-$V-linux-x64.tar.xz -C /usr/local --strip-components=1
node --version    # v24.x

# 2. Upload and unpack the bundle
scp jaqa-hostinger.zip root@YOUR_VPS_IP:/var/www/
ssh root@YOUR_VPS_IP
cd /var/www && unzip jaqa-hostinger.zip && cd jaqa

# 3. Install runtime dependencies (God's Eye View's; nothing else is needed)
npm run setup

# 4. Try it
PORT=3000 HOST=127.0.0.1 npm start      # then: curl -I http://127.0.0.1:3000/
```

### Keep it running (systemd)

Create `/etc/systemd/system/jaqa.service`:

```ini
[Unit]
Description=JAQA site (workspace, 3D globe, APIs)
After=network-online.target

[Service]
WorkingDirectory=/var/www/jaqa
ExecStart=/usr/local/bin/node server/jaqa-server.mjs
Environment=PORT=3000
Environment=HOST=127.0.0.1
Environment=NODE_ENV=production
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
chown -R www-data:www-data /var/www/jaqa
systemctl daemon-reload && systemctl enable --now jaqa
systemctl status jaqa
```

Adjust `ExecStart` if `which node` prints another path.

### HTTPS with Nginx in front

```nginx
server {
  listen 80;
  server_name jaqa.life www.jaqa.life;
  # JAQA's privacy promise: no access logs of visitors' requests.
  access_log off;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 60s;
  }
}
```

Then issue a certificate, for example with `certbot --nginx -d jaqa.life -d www.jaqa.life`. The Node server sends the security headers (CSP, HSTS, nosniff, frame denial) itself.

## Option B — Hostinger plan with Node.js apps

If your hPanel lets you create a Node.js app with **Node 24**:

1. Upload `jaqa-hostinger.zip` and extract it.
2. Set the application root to the extracted `jaqa` folder.
3. Set the startup file to `server/jaqa-server.mjs`, or the start command to `npm start`.
4. Run `npm run setup` (the install step) once, then start the app.
5. The app reads `PORT` from the environment. Most Node hosting sets it; otherwise it listens on 3000.

If only older Node versions are offered, use Option A.

## Optional keys (more layers on the 3D globe)

The globe works **without keys**, using Esri satellite imagery, OpenStreetMap and keyless feeds. Keys unlock more; see `apps/globe/.env.example` and the "API Keys" section of `apps/globe/README.md`.

- **Server-side keys** stay on the server: OpenAI (voice agent), AISStream (live ships), OpenSky, TomTom, NASA FIRMS and others.
  1. Copy `apps/globe/.env.example` to `apps/globe/.env`.
  2. Fill in the keys.
  3. Restart the service.
- **Browser-side keys** (`GOOGLE_MAPS_API_KEY`, `CESIUM_ION_TOKEN`) are embedded when the globe is built.
  1. Put them in the environment or in `apps/globe/.env`.
  2. Run `npm run build:globe` (installs no extra packages).
  3. Restart the service.
  4. Restrict these keys to `jaqa.life` in the Google Cloud / Cesium ion console.

Optional: set `JAQA_CONTACT_EMAIL` so the Global Monitor's User-Agent includes a contact address, as some publishers (for example the SEC) request.

## Check the deployment

```bash
curl -sI https://jaqa.life/ | head -1                                  # 200
curl -s  https://jaqa.life/api/jaqa/monitor/feeds | head -c 200         # verified feed list
curl -s "https://jaqa.life/api/jaqa/monitor/feed?id=gdacs" | head -c 300  # live headlines
curl -sI https://jaqa.life/globe/ | head -1                            # 200
curl -sI https://jaqa.life/.htaccess | head -1                         # 404 (never served)
```

Then open `https://jaqa.life/`, go to **Global Monitor → Load monitor feeds**, and open the **3D Globe**.

## Before commercial use: licences

God's Eye View's MIT licence covers its code, not its bundled data. If jaqa.life is operated commercially:

- Delete `apps/globe/src/data/local_data/telegeography_submarine_cables/` (CC BY-NC-SA 3.0), or license it from TeleGeography, and rebuild with `npm run build:globe`.
- The Bhote Koshi flood scene (CC BY-NC 4.0) needs separate permission, or must be removed from the source and build.
- OpenSky flight data is licensed for non-commercial use; contact OpenSky for commercial terms.

Details are in `THIRD_PARTY_NOTICES.md` and `apps/globe/DATA_SOURCES.md`.

## Privacy notes

- The server writes no access logs. Also keep `access_log off;` in Nginx.
- Workspace searches still go from the visitor's browser straight to public APIs. The server only proxies God's Eye View's layers and the fixed, allowlisted monitor feeds.
- God's Eye View's voice agent sends audio to OpenAI **only** if you add an OpenAI key.

## Updating

Upload the new zip, extract it over the old folder (keep `apps/globe/.env`), then run `npm run setup` and `systemctl restart jaqa`.
