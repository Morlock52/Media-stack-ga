# Installed Docker Applications (What they do + how they connect)

> Use this as your field guide. URLs are based on the **reverse-proxy** stack (`docker-compose.yml`). In LAN/direct-ports mode (`docker-compose.local.yml`), use `http://<server-ip>:<port>` instead.

---

## Access, Identity, and Edge

| Application | Purpose | URL (reverse proxy) | Key links |
| --- | --- | --- | --- |
| Traefik (`traefik:v3.6`) | Reverse proxy + routing | `https://hub.${DOMAIN}` (dash via Traefik plugin) | Routes every app; attach middleware (Authelia) + certificates |
| Cloudflared (`cloudflare/cloudflared:latest`) | Cloudflare Tunnel connector | N/A (runs headless) | Publishes `${DOMAIN}` hostnames to Cloudflare |
| Authelia (`authelia/authelia:latest`) | SSO/MFA gateway | `https://auth.${DOMAIN}` | Protects routed apps; uses Redis + local users file |
| Redis (`redis:alpine`) | Session store for Authelia | N/A | Required for Authelia |
| Homepage (`ghcr.io/gethomepage/homepage:latest`) | Landing dashboard | `https://hub.${DOMAIN}` | App links + widgets |
| Portainer (`portainer/portainer-ce:latest`) | Docker management UI | `https://portainer.${DOMAIN}` | Manage containers/volumes remotely |
| Dozzle (`amir20/dozzle:latest`) | Live log viewer | `https://dozzle.${DOMAIN}` | View container logs without CLI |

---

## Media Automation (“Arr stack” + requests + subs)

| Application | Purpose | URL | Integrations |
| --- | --- | --- | --- |
| Overseerr (`lscr.io/linuxserver/overseerr`) | Request portal for users | `https://request.${DOMAIN}` | Talks to Plex/Jellyfin for library sync; forwards approved requests to Sonarr/Radarr |
| Prowlarr (`lscr.io/linuxserver/prowlarr`) | Indexer manager (both Arrs) | `https://prowlarr.${DOMAIN}` | Add indexers here; push to Sonarr/Radarr with their API keys |
| Sonarr (`lscr.io/linuxserver/sonarr`) | TV automation | `https://sonarr.${DOMAIN}` | Add qBittorrent as download client; add Prowlarr via API; root folder: `/data/media/TV` (default) |
| Radarr (`lscr.io/linuxserver/radarr`) | Movie automation | `https://radarr.${DOMAIN}` | Same as Sonarr but movies (`/data/media/Movies`) |
| Bazarr (`lscr.io/linuxserver/bazarr`) | Subtitle automation | `https://bazarr.${DOMAIN}` | Connect to Sonarr/Radarr API; monitors media paths for subs |

**Quick wiring (Arr + Prowlarr + qBittorrent)**
- In Prowlarr: Settings → Apps → Add Sonarr/Radarr → paste their API keys (from each app’s Settings → General).
- In Sonarr/Radarr: Settings → Download Clients → Add qBittorrent → host `qbittorrent`, port `8080` (or `8081` in local stack) → credentials set in `.env`.
- In Sonarr/Radarr: Indexers tab → “Sync Apps” to pull indexers from Prowlarr.

---

## Download Boundary

| Application | Purpose | URL | Notes |
| --- | --- | --- | --- |
| qBittorrent (`lscr.io/linuxserver/qbittorrent`) | Torrent client | `https://qbt.${DOMAIN}` | In VPN mode, traffic exits via Gluetun; change default password on first login. |
| Gluetun (`qmcgaw/gluetun`) | VPN + kill-switch | N/A | Wraps qBittorrent; set VPN credentials in `.env`; blocks traffic if VPN fails. |
| FlareSolverr (`ghcr.io/flaresolverr/flaresolverr`) | Bypass Cloudflare/JS challenges | `http://flaresolverr:8191` (internal) | Point Prowlarr to it for tough indexers. |

---

## Media Servers and Libraries

| Application | Purpose | URL | Notes |
| --- | --- | --- | --- |
| Plex (`lscr.io/linuxserver/plex`) | Media server | `https://plex.${DOMAIN}` | Hardware transcode requires proper device pass‑through. |
| Jellyfin (`jellyfin/jellyfin`) | Open-source media server | `https://jellyfin.${DOMAIN}` | Alternative to Plex; no cloud auth. |
| Tautulli (`lscr.io/linuxserver/tautulli`) | Plex analytics | `https://tautulli.${DOMAIN}` | Connect to Plex token in settings. |
| Tdarr (`ghcr.io/haveagitgat/tdarr`) | Transcode/health pipeline | `https://tdarr.${DOMAIN}` | Optional background transcodes. |
| Audiobookshelf (`lscr.io/linuxserver/audiobookshelf`) | Audiobooks/podcasts | `https://audiobookshelf.${DOMAIN}` | Point libraries to `/data/media/Audiobooks`. |
| Kavita (`lscr.io/linuxserver/kavita`) | Comics/ebooks | `https://kavita.${DOMAIN}` | Libraries under `/data/media/Comics`/`Books`. |
| Mealie (`ghcr.io/mealie-recipes/mealie`) | Recipe manager | `https://mealie.${DOMAIN}` | Not media-linked; standalone. |
| PhotoPrism (`lscr.io/linuxserver/photoprism`) | Photos | `https://photoprism.${DOMAIN}` | Point to photo library path. |

---

## Monitoring, Updates, and Notifications

| Application | Purpose | URL | Notes |
| --- | --- | --- | --- |
| Loki (`grafana/loki`) | Log aggregation | N/A | Receives logs from Promtail. |
| Promtail (`grafana/promtail`) | Log shipper | N/A | Scrapes Docker logs; sends to Loki. |
| Grafana (`grafana/grafana`) | Dashboards + log explorer | `https://grafana.${DOMAIN}` | Use Loki data source; Homepage widget uses Grafana creds. |
| Watchtower (`containrrr/watchtower`) | Auto-update containers | N/A | Optional; can be disabled. |
| Autoheal (`willfarrell/autoheal`) | Restart unhealthy containers | N/A | Monitors healthchecks. |
| Notifiarr (`golift/notifiarr`) | Notifications | `https://notifiarr.${DOMAIN}` | Integrates with Plex/*Arr/qBittorrent for alerts. |

---

## Databases and Internals

| Application | Purpose | URL | Notes |
| --- | --- | --- | --- |
| Postgres (`16-alpine`) | DB for *Arr apps | N/A | Internal service; no public port. |

Wizard components (`control-server`, `docs-site`) live only in `docker-compose.wizard*.yml` and are not part of the main media stack.

> LAN/direct-ports mode (`docker-compose.local.yml`) skips Traefik, Authelia, Cloudflared, and exposes apps directly (e.g., Sonarr `8989`, Radarr `7878`, qBittorrent `8081`, Grafana `3003`). Use this for a trusted home network. 
