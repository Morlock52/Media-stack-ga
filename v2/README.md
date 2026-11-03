# Media Stack v2

TRaSH-Guides-aligned rebuild of `media-stack-ga` (Nov 2026). Compose-only — no wizard, no Node control server.

## Layout

```
compose.yaml                 # include: list — the only file you run
compose/
  core.yaml                  # socket-proxy · traefik v3.7 · tinyauth→Pocket ID · cloudflared · homepage
  downloads.yaml             # gluetun (PIA + port-forward) · qbittorrent · unpackerr · cleanuparr
  arr.yaml                   # prowlarr · byparr · sonarr · radarr · lidarr · bazarr · recyclarr · seerr
  media.yaml                 # plex · jellyfin · tautulli · audiobookshelf
  ops.yaml                   # dozzle · wud · autoheal(+restart-only proxy) · backrest
  observability.yaml         # loki · alloy · grafana   (optional)
config/                      # config-as-code that lives in git (recyclarr, alloy, loki, traefik)
scripts/init-folders.sh      # creates TRaSH tree, fixes perms, verifies hardlinks
.env.example
docker-compose.override.yaml.example   # GPU transcoding etc.
```

App state lives in `CONFIG_ROOT` (outside git). Media lives in `DATA_ROOT`:

```
/srv/data
├── torrents/{tv,movies,music,books}      ← qBittorrent sees only this (/data/torrents)
└── media/{tv,movies,music,books,audiobooks,podcasts}  ← Plex/Jellyfin see only this, read-only
```
*arrs mount all of `/srv/data` as `/data` → hardlinks + instant moves.

## First run

```bash
cp .env.example .env && chmod 600 .env     # fill in values
sudo ./scripts/init-folders.sh             # creates tree + app dirs, must print ✅ for hardlinks
docker compose config -q                   # validate
docker compose up -d
```

Then, in order:
1. **qBittorrent** (`https://qbt.<domain>`, temp password in `docker logs qbittorrent`) → set a real password; Options → WebUI: enable *Bypass authentication for clients on localhost* (needed for the VPN port hook); Downloads: default path `/data/torrents`.
2. `sudo ./scripts/connect-services.sh` — reads API keys into `.env`, adds root folders, the qBittorrent client (`gluetun:8080`, categories tv/movies/music), Prowlarr→Sonarr/Radarr/Lidarr sync and the Byparr proxy. Safe to re-run.
3. `docker compose up -d homepage unpackerr recyclarr && docker compose exec recyclarr recyclarr sync` — pushes TRaSH profiles (WEB-1080p / HD Bluray + WEB). Toggle custom-format groups in `config/recyclarr/recyclarr.yml`.
4. **Prowlarr** → add indexers; tag Cloudflare-protected ones with `flaresolverr`.
5. **Seerr** → `https://request.<domain>` → connect Plex/Jellyfin, Sonarr, Radarr.
6. **Pocket ID** → create an OIDC client for Tinyauth (callback `https://auth.<domain>/api/oauth/callback/pocketid`), put ID/secret in `.env`.
7. **Cloudflare Zero Trust** → tunnel public hostname `*.<domain>` → `http://traefik:80`. Keep Plex off the tunnel; use port 32400.

## Migrating from v1

| v1 | v2 | Action |
|---|---|---|
| `/movies`, `/tv`, `/downloads` mounts | single `/data` | Move files into the new tree, then in Sonarr/Radarr use *Mass Editor → change root folder* to `/data/media/...`. Re-point qBit categories. |
| Overseerr | Seerr | Back up, stop Overseerr, copy its `config/` to `${CONFIG_ROOT}/seerr`, then `docker run --rm -v ${CONFIG_ROOT}/seerr:/data alpine chown -R 1000:1000 /data` (Seerr runs as UID 1000). Start Seerr — DB + settings migrate automatically on first boot. |
| Authelia + Redis | Tinyauth → Pocket ID | Delete both; nothing was actually protected before (no router used the middleware). |
| Watchtower | WUD (notify) | Remove. |
| Promtail | Alloy | `observability` profile only. |
| FlareSolverr | Byparr | Same API; change Prowlarr proxy host to `byparr`. |
| Postgres + postgres-backup | SQLite + Backrest | The *arrs were never on Postgres (wrong env var names), so nothing to migrate. |
| Portainer | Dozzle + WUD (+ optional Komodo/Dockge) | Remove. |
| Tdarr, Mealie, PhotoPrism, Kavita, Notifiarr | separate stacks | Not part of the media pipeline; run them from their own compose project if you still want them. |

## Tested (Nov 3 2026, Docker 29.9, Compose 5.6)

Brought up core + ops + arr on a clean host: all containers healthy; Traefik routes + HSTS; Tinyauth 302s browsers to login on every protected host, Seerr public; Homepage auto-discovers services through socket-proxy; hardlink created inside Sonarr between `/data/torrents` and `/data/media` (2 links); Recyclarr v8.8 sync created 37 Sonarr / 41 Radarr custom formats + both profiles; `connect-services.sh` wired root folders, qBittorrent client and Prowlarr app sync, and is idempotent.
Not testable there: Gluetun/PIA (needs your account), Plex claim, Byparr's Cloudflare solving, Pocket ID login.

## Extras (opt-in profiles — add to `COMPOSE_PROFILES`, then re-run `connect-services.sh`)

| Profile | What you get | Notes |
|---|---|---|
| `usenet` | **SABnzbd** at `sab.<domain>` | Script sets `/data/usenet/{incomplete,complete}`, categories, host whitelist, and adds it to every *arr. Add your Usenet server in SABnzbd → Servers. |
| `crossseed` | **cross-seed v6** daemon | Hardlinks matches into `/data/torrents/cross-seed` and injects into qBittorrent. Script fills `config.js` (client, *arrs, one torznab URL per Prowlarr torrent indexer). |
| `4k` | **Radarr-4K** at `radarr4k.<domain>` | Separate `/data/media/movies-4k` library + `movies-4k` category. Rename `config/recyclarr/configs/radarr-4k.yml.disabled` → `.yml` for the TRaSH UHD profile. Seerr: add it as the 4K Radarr server. |
| `books` | **Chaptarr** (beta) + Audiobookshelf | Root folders `/data/media/books` and `/data/media/audiobooks`; add Chaptarr to Prowlarr manually (Readarr-type app). |
| `jellystat` | **Jellystat** + its own Postgres 18.1 | Set `JELLYSTAT_DB_PASSWORD` / `JELLYSTAT_JWT_SECRET`; connect to Jellyfin in its first-run wizard. |

Extras live-tested the same day: all healthy, behind Tinyauth, auto-discovered by Homepage; SABnzbd + qBittorrent wired into Sonarr/Radarr/Radarr-4K; cross-seed started and authenticated to qBittorrent; Recyclarr synced 56 UHD custom formats into Radarr-4K.

## Links

- Visual sheet (Figma): https://www.figma.com/design/BOgAVtdkLhS7w5AwSzmfq8
- Full change log (Notion): Media Stack v2 — Rebuild & Change Log (Nov 2026)
