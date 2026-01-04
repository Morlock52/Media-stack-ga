# Application Usage Guide

Quick how-to notes for every app in the stack. URLs assume the **reverse-proxy stack** (`docker-compose.yml`) with Authelia. The **LAN stack** (`docker-compose.local.yml`) skips SSO and uses direct ports noted in parentheses.

> Credentials come from `.env` unless noted. Keep volumes persistent so settings survive updates.

## Wizard & Control Plane

### Wizard Web — setup UI  
Project: https://github.com/Morlock52/Media-stack-ga/tree/main/docs-site  
URL: `http://localhost:3002`
- Launch with `docker compose -f docker-compose.wizard.yml up --build -d`.
- Walk through the steps, then use **Review & Generate** to download compose + `.env`.

### Wizard API — control server  
Project: https://github.com/Morlock52/Media-stack-ga/tree/main/control-server  
URL: `http://localhost:3001` (API; the UI proxies `/api` in Docker wizard mode)
- Handles AI assistance, validation, and orchestration tasks for the wizard.
- If the UI cannot connect, check `docker compose -f docker-compose.wizard.yml logs -f wizard-api`.

### Docker Socket Proxy — wizard hardening  
Project: https://github.com/Tecnativa/docker-socket-proxy  
URL: n/a (internal)
- Only used by `docker-compose.wizard.secure.yml` to restrict Docker API access.
- If deploy actions fail in secure mode, check `docker compose -f docker-compose.wizard.secure.yml logs -f socket-proxy`.

## Access & Operations

### Homepage — dashboard  
Project: https://gethomepage.dev  
URL: `https://hub.${DOMAIN}` (LAN: `http://<server-ip>:3000`)
- Central launcher; tiles pull API keys/tokens from `.env` or `config/homepage/services.yaml`.
- Edit `config/homepage/services.yaml` (reverse-proxy) or `config/homepage/services.local.yaml` (LAN) to reorder tiles, add links, and wire widgets.
- Populate `.env` (`PLEX_TOKEN`, `JELLYFIN_API_KEY`, `SONARR_API_KEY`, etc.) so widgets and Grafana tiles show data; restart homepage after updates.

### Authelia — SSO/MFA  
Project: https://www.authelia.com  
URL: `https://auth.${DOMAIN}` (not used in LAN stack)
- Default seed user: `demo` / `ChangeMe123!` from `config/authelia/users_database.yml`; change immediately and add TOTP in the UI.
- Add users/groups by editing `config/authelia/users_database.yml` then restart; protect routes is handled by Traefik labels.

### Redis — Authelia sessions  
Project: https://redis.io  
URL: n/a (internal)
- Authelia stores sessions here; set `REDIS_PASSWORD` in `.env` and keep the volume persistent.
- Check `docker compose logs -f redis` if SSO logins fail or sessions appear to reset.

### Traefik & Cloudflare Tunnel  
Projects: https://traefik.io • https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/  
URL: edge only (dashboard disabled); Cloudflare console shows tunnel status
- Traefik routes `https://<service>.${DOMAIN}` and applies Authelia where labels exist.
- Set `CLOUDFLARE_TUNNEL_TOKEN` in `.env` so hostnames stay reachable off-LAN; if the tunnel is down, use LAN ports.

### Portainer — Docker UI  
Project: https://www.portainer.io  
URL: `https://portainer.${DOMAIN}` (path `/portainer` also works)
- First run: set the admin password; the local Docker socket is auto-added as the environment.
- Use for container restarts, volume inspections, and ad-hoc console access without SSH.

### Dozzle — live logs  
Project: https://dozzle.dev  
URL: `https://dozzle.${DOMAIN}`
- Tail container logs with search/filters; useful when Grafana/Loki feels heavy or you want quick live output.

## Requests & Automation

### Overseerr — requests  
Project: https://overseerr.dev  
URL: `https://request.${DOMAIN}` (LAN: `http://<server-ip>:5055`)
- Create the admin account, then connect Plex/Jellyfin in **Settings → Services** for library sync.
- Link Sonarr/Radarr in **Settings → Services** using URLs `http://sonarr:8989` / `http://radarr:7878` and their API keys.
- Approve/deny requests; optional Discord/webhook notifications live in Overseerr settings.

### Prowlarr — indexers  
Project: https://wiki.servarr.com/prowlarr  
URL: `https://prowlarr.${DOMAIN}` (LAN: `http://<server-ip>:9696`)
- Add indexers; set FlareSolverr as proxy when needed (`http://flaresolverr:8191`).
- Push to Sonarr/Radarr via **Settings → Apps** and their API keys; in Sonarr/Radarr click **Indexers → Sync Apps** after changes.

### Sonarr — TV automation  
Project: https://sonarr.tv  
URL: `https://sonarr.${DOMAIN}` (LAN: `http://<server-ip>:8989`)
- Root folder: `/tv` (maps to `${TV_SHOWS_PATH}`); pick quality profiles and paths.
- Download client: add qBittorrent (`qbittorrent`, port `8080`, credentials set in qBittorrent) and enable RSS/auto-search.
- Health check: run “Test all” after wiring indexers and download client.

### Radarr — movie automation  
Project: https://radarr.video  
URL: `https://radarr.${DOMAIN}` (LAN: `http://<server-ip>:7878`)
- Same flow as Sonarr; root folder `/movies`.
- Optional lists (IMDb/Trakt) can auto-add wanted titles; keep `Minimum Availability` sane to avoid cams.

### Bazarr — subtitles  
Project: https://www.bazarr.media  
URL: `https://bazarr.${DOMAIN}` (LAN: `http://<server-ip>:6767`)
- First run: choose languages, then connect Sonarr/Radarr with their URLs and API keys.
- Map libraries to `/movies` and `/tv`; enable hearing-impaired or forced-subs as desired.

### qBittorrent — download client  
Project: https://www.qbittorrent.org  
URL: `https://qbt.${DOMAIN}` (LAN: `http://<server-ip>:8081`, reverse-proxy shares port 8080 via Gluetun)
- Default credentials from linuxserver: `admin` / `adminadmin`; change in **Settings → WebUI**.
- Set save paths to `/downloads` and ensure “Bittorrent → Default Save Path” aligns with Arr import paths.
- If accessing via domain, add your hostname to **WebUI → Host header whitelist** to avoid 403s.

### Gluetun — VPN boundary  
Project: https://github.com/qdm12/gluetun  
URL: n/a (internals only)
- Provide VPN credentials in `.env`; qBittorrent waits until Gluetun is healthy (kill-switch).
- Status endpoint inside the network: `http://gluetun:8000/v1/openvpn/status`; keep this service running for privacy.

### FlareSolverr — anti-bot helper  
Project: https://github.com/FlareSolverr/FlareSolverr  
URL: n/a (internal)
- Used by Prowlarr for stubborn indexers. Point proxies to `http://flaresolverr:8191`; no extra setup required.

### Postgres + backup job  
Projects: https://www.postgresql.org • https://github.com/prodrigestivill/docker-postgres-backup-local  
URL: n/a (background)
- Sonarr/Radarr/Prowlarr store data here; credentials from `.env`.
- Backups land in `${CONFIG_ROOT}/backups/postgres` via the `postgres-backup` service; keep that volume safe.

## Media Servers

### Plex  
Project: https://www.plex.tv  
URL: `https://plex.${DOMAIN}` (LAN: `http://<server-ip>:32400/web`)
- Claim with `PLEX_CLAIM` once, then sign in normally.
- Libraries: `/movies`, `/tv`, `/music`; enable scheduled scans and optional hardware transcode.
- For remote access, either rely on Cloudflare + Authelia or Plex’s own remote-access toggle.

### Jellyfin  
Project: https://jellyfin.org  
URL: `https://jellyfin.${DOMAIN}` (LAN: `http://<server-ip>:8096`)
- Create admin user; add libraries `/data/movies`, `/data/tvshows`, `/data/music`.
- Enable scheduled metadata refresh and library scans; configure hardware acceleration if the host supports it.

### Tautulli — Plex analytics  
Project: https://tautulli.com  
URL: `https://tautulli.${DOMAIN}` (LAN: `http://<server-ip>:8181`)
- In **Settings → Plex Media Server**, paste your Plex token to pull watch stats.
- Use notifications/history reports to track playback and troubleshoot buffering.

### Tdarr — transcode/health  
Project: https://tdarr.io  
URL: `https://tdarr.${DOMAIN}` (LAN: `http://<server-ip>:8265`)
- Libraries: `/media/movies` and `/media/tv`; set temp path `/temp` with enough space.
- Create health-check or transcode workflows; monitor the queue for stuck jobs.

## Utility Apps

### Mealie — recipes  
Project: https://mealie.io  
URL: `https://mealie.${DOMAIN}` (LAN: `http://<server-ip>:9000`)
- Create the first admin user; import recipes or start new collections; meal plans and shopping lists live here.

### Kavita — books/comics  
Project: https://www.kavitareader.com  
URL: `https://kavita.${DOMAIN}` (LAN: `http://<server-ip>:5000`)
- Add libraries pointing to `/books`; organize series/collections and invite readers.

### Audiobookshelf — audiobooks/podcasts  
Project: https://www.audiobookshelf.org  
URL: `https://audiobookshelf.${DOMAIN}` (LAN: `http://<server-ip>:13378`)
- Add libraries `/audiobooks` (and `/podcasts` if used); choose metadata providers; create user accounts.

### PhotoPrism — photos  
Project: https://photoprism.app  
URL: `https://photoprism.${DOMAIN}` (LAN: `http://<server-ip>:2342`)
- Sign in with `PHOTOPRISM_ADMIN_PASSWORD` from `.env`, change it, and start indexing `/photos`.
- Configure TensorFlow/AI options as needed; set backup/export paths before large imports.

## Observability & Notifications

### Grafana + Loki/Promtail  
Projects: https://grafana.com • https://grafana.com/oss/loki/  
URL: `https://grafana.${DOMAIN}` (LAN: `http://<server-ip>:3003`)
- Default admin `${GRAFANA_USER:-admin}` / `${GRAFANA_PASSWORD}`; change after first login.
- Loki data source is pre-provisioned; use **Explore** to search `container="<name>"` logs and build dashboards.

### Notifiarr — alert hub  
Project: https://notifiarr.com  
URL: `https://notifiarr.${DOMAIN}` (LAN: `http://<server-ip>:5454`)
- Sign in with your Notifiarr account; URLs/API keys for Plex/*Arr are pre-seeded from env vars.
- Add Discord/Slack/Push targets for alerts; toggle which events each app sends.

### Watchtower & Autoheal  
Projects: https://containrrr.dev/watchtower • https://github.com/willfarrell/docker-autoheal  
URL: n/a (background)
- Watchtower updates images on the defined schedule; Autoheal restarts unhealthy containers.
- Disable or adjust schedules via compose profiles or env if you prefer manual upgrades.
