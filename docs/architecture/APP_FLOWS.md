# How the Stack Connects (Requests → Download → Library)

> Follow this wiring order to get everything talking in under 10 minutes.

## Big Picture Flow

```text
User request (Overseerr)
        ↓ approved
  Sonarr / Radarr  ← indexers from Prowlarr
        ↓ sends release
   qBittorrent (via Gluetun VPN)
        ↓ completed
  Sonarr / Radarr import → Bazarr pulls subtitles
        ↓ indexed
  Plex / Jellyfin libraries update
        ↓ notify
  Notifiarr alerts (optional)
```

## 1) Requests and Libraries
- **Overseerr → Plex/Jellyfin:** In Overseerr settings, connect your Plex or Jellyfin server so requests show availability and new items are scanned in.
- **Overseerr → Arr apps:** Add your Sonarr and Radarr servers with their API keys so approved requests auto-create tasks.

## 2) Indexers (Prowlarr)
- Add your indexers inside **Prowlarr** (supports FlareSolverr if required).
- Push to Arr apps: Prowlarr → Settings → Apps → Add Sonarr/Radarr → paste API keys from each Arr app (Settings → General).
- In Sonarr/Radarr, hit **Indexers → Sync Apps** to pull updated indexers from Prowlarr.

## 3) Download Client (qBittorrent)
- In **Sonarr/Radarr:** Settings → Download Clients → Add qBittorrent.
  - Host: `qbittorrent` (container DNS) or `localhost` with the LAN stack.
  - Port: `8080` (reverse-proxy stack) or `8081` (local ports stack).
  - Credentials: set in `.env`.
- In **Gluetun** (VPN): set your provider credentials in `.env`; traffic from qBittorrent is forced through the VPN/killswitch.

## 4) Subtitle Automation (Bazarr)
- In **Bazarr:** Settings → Sonarr/Radarr → paste API keys and URLs (use container DNS names).
- Point Bazarr to the same media folders (`/data/media/TV`, `/data/media/Movies`).

## 5) Media Servers
- **Plex:** Libraries → Add folders that Arr apps import into (e.g., `/data/media/Movies`, `/data/media/TV`). Optional: enable “Empty trash automatically after every scan.”
- **Jellyfin:** Same paths; enable scheduled library scans.
- **Tautulli:** Add Plex token in Tautulli settings for analytics.

## 6) Notifications (optional)
- **Notifiarr:** Connect Plex, Sonarr, Radarr, and qBittorrent inside Notifiarr to relay status alerts to Discord/Slack/etc.

## 7) Observability
- Logs: Promtail → Loki → Grafana (`https://grafana.${DOMAIN}`) with a Loki data source.
- Live tail: Dozzle (`https://dozzle.${DOMAIN}`).
- Container health/restarts: Autoheal + Watchtower.

## Quick Wiring Checklist
- [ ] Prowlarr has indexers; Sonarr/Radarr added as **Apps**.
- [ ] Sonarr/Radarr download client: qBittorrent reachable; correct port/user/pass.
- [ ] Gluetun credentials set; container is healthy.
- [ ] Bazarr connected to Sonarr/Radarr; subtitle languages chosen.
- [ ] Plex/Jellyfin libraries pointed to Arr import paths.
- [ ] Overseerr connected to Plex/Jellyfin and Sonarr/Radarr.
- [ ] Optional: Notifiarr connected to Plex/*Arr/qBittorrent.

## Port/Hostname Cheats
- Reverse-proxy stack: `https://<service>.${DOMAIN}` (e.g., `https://sonarr.${DOMAIN}`).
- Direct-ports stack: `http://<server-ip>:8989` (Sonarr), `http://<server-ip>:7878` (Radarr), `http://<server-ip>:8081` (qBittorrent), `http://<server-ip>:32400/web/` (Plex), `http://<server-ip>:8096` (Jellyfin).
