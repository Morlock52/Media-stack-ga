# Media Stack Implementation & Verification Plan

> For setup instructions, start with `docs/getting-started/START_HERE.md`.  
> For the modernization roadmap, see `docs/PLAN_MODERNIZATION.md`.

This plan outlines the review and verification steps for all functions (services) within the media stack project. The goal is to ensure all components are correctly configured, integrated, and operational.

## Prerequisites

- Docker >= 20.10 and Docker Compose >= 1.29
- Copy the env template and edit it:
  ```bash
  cp .env.example .env
  ```
- If you enable the VPN profile, the host must provide `/dev/net/tun` (enable TUN in your hypervisor/host before starting Gluetun).
- Validate your compose config:
  ```bash
  docker compose config >/dev/null
  ```
- A valid domain + Cloudflare account are required only if you enable the `cloudflared` profile for remote access.
- Cloudflare Tunnel requires a real token/command in `.env` (`CLOUDFLARE_TUNNEL_TOKEN` or `CLOUDFLARED_COMMAND`).

## User Review Required

> [!IMPORTANT]
> **Security Warning**: Do not deploy with placeholder/default credentials. Set strong secrets in `.env` and application configs before exposing services to the internet.

> [!NOTE]
> **Domain Configuration**: Ensure you have a valid domain and Cloudflare account as this stack relies on Cloudflare Tunnel for remote access.

## Proposed Changes / Configuration Steps

This section details the configuration required for each functional component (service).

### Core Infrastructure

#### [MODIFY] [.env](.env)
- Update `DOMAIN`.
- Set `TIMEZONE`.
- Generate and set secure passwords/secrets for:
    - `AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET`, `AUTHELIA_SESSION_SECRET`, `AUTHELIA_STORAGE_ENCRYPTION_KEY`
    - `REDIS_PASSWORD`
    - `CLOUDFLARE_TUNNEL_TOKEN`
- Verify storage paths (`DATA_ROOT`, etc.).

#### [MODIFY] [config/authelia/configuration.yml](config/authelia/configuration.yml)
- Update domain references to match `.env`.
- Ensure Redis password matches `.env`.

#### [MODIFY] [config/cloudflared/config.yml](config/cloudflared/config.yml)
- Update ingress rules to match your domain and service ports.

### Media Services

#### [VERIFY] Plex / Jellyfin
- **Plex**: Ensure `PLEX_CLAIM` is set if using a new server.
- **Jellyfin**: Verify hardware acceleration mapping (`/dev/dri`) if applicable.
- Confirm both see the same libraries (`MOVIES_PATH`, `TV_SHOWS_PATH`, `MUSIC_PATH`) so Tdarr and the *Arr stack operate on a single, consistent media tree.

#### [VERIFY] The "Arr" Stack (Sonarr, Radarr, Prowlarr)
- Ensure volume mappings for `/tv`, `/movies`, and `/downloads` are consistent across all containers to support hardlinking.
- In Prowlarr, configure FlareSolverr (`http://flaresolverr:8191`) as the proxy for indexers that require it.
- Verify Sonarr/Radarr are added as *applications* in Prowlarr and that test searches succeed.

#### [VERIFY] Download Clients (qBittorrent)
- Verify port `6881` (UDP/TCP) is correctly exposed for P2P traffic.
- Ensure any placeholder/default credentials are changed upon first login.
- Confirm qBittorrent is routed via Gluetun (`network_mode: service:gluetun`) and that its reported external IP matches your VPN endpoint.

#### [VERIFY] Subtitles & Analytics (Bazarr, Tautulli)
- **Bazarr**: Confirm it points at the same movie/TV paths used by Sonarr/Radarr and your media server(s).
- **Tautulli**: Connect it to Plex using a read-only token and verify playback statistics appear.

#### [VERIFY] Transcoding (Tdarr)
- Ensure Tdarr server can see the same movie/TV paths as Plex/Jellyfin.
- Create at least one test workflow (e.g., H.264 → H.265) and confirm a file is processed successfully.

#### [VERIFY] Notifications (Notifiarr)
- Connect Notifiarr to Sonarr, Radarr, Prowlarr, and Tautulli using your preferred notification targets (Discord, etc.).
- Trigger a test download and confirm a notification is received.

### Supporting & UX Services

#### [VERIFY] Homepage Dashboard
- Open `https://hub.yourdomain.com` and confirm all tiles from `config/homepage/services.yaml` render with correct icons, names, and status.
- Verify links for each app match the Cloudflare ingress hostnames and Authelia-protected URLs.

#### [VERIFY] Logs, Updates & Management
- **Dozzle**: Confirm you can see real-time logs for all containers.
- **Watchtower**: Check logs to ensure image update checks are running on the configured schedule.
- **Portainer**: Verify Portainer is reachable only via Authelia (no direct IP/port access) and that all containers appear in its dashboard.

## New Improvements (2025 Expert Review)

Enhance automation, monitoring, and usability:

### 🛠️  Deployment & Updates
1. **Interactive Setup Script**: `setup.sh` prompts for domain/passwords with sensible defaults.
2. **Watchtower**: automated container updates.
3. **FlareSolverr**: bypass Cloudflare challenges for Prowlarr.
4. **Arr Key Bootstrap**: One-click API key extraction via `bootstrap_arr` tool.

### 📊  Monitoring & Dashboards
4. **Dozzle**: real‑time logs in the browser.
5. **Modern Homepage**: unified web dashboard for all services.
6. **Notifiarr**: centralized notifications (e.g. Discord).

### 🔐  Security & Performance

7. **Gluetun VPN**: route qBittorrent traffic through VPN.
8. **Redis Persistence**: session data survives restarts.
9. **Tdarr**: distributed H.265 transcoding.
10. **Expanded Authelia/Cloudflare Coverage**: consistent protection and routing for every exposed service.

## Implemented Features (2025 Updates)
The following features have been successfully integrated into the stack:

### 📚 Library & Content
1.  **Audiobookshelf**: Dedicated self-hosted audiobook and podcast server.
2.  **Kavita**: Comic book and manga server with web reader.
3.  **Mealie**: Self-hosted recipe manager and meal planner.
4.  **PhotoPrism**: AI-powered photo management library.

### 🧠 Automation & Intelligence
5.  **Voice Companion**: AI-driven voice setup assistant.
6.  **Dr. Debug**: Context-aware error analysis and suggestions.
7.  **Web Wizard**: Interactive, React-based setup with Bento grid dashboard.
8.  **Arr-Stack Bootstrap**: Automated extraction and sync of API keys from running containers.
9.  **Premium UI**: Glassmorphism, intelligent pulsing animations, and SVG data export.
10. **Dockerized Control Plane**: Run the Wizard and Control Server entirely in Docker (`docker-compose.wizard.yml`).

## 🚀 Future Roadmap: 20 Functional Updates

The following improvements are scheduled for future iterations to expand capabilities and robustness.

### 📚 Library & Content Expansion

1. **Lidarr**: Add music collection manager (similar to Sonarr/Radarr).
2. **Readarr**: Add ebook and audiobook manager (alternative to Audiobookshelf).
3. **Bazarr Providers**: Expand subtitle providers with additional API keys.

### 🧠 Automation & Intelligence

4. **Recyclarr**: Automatically sync TRaSH guides (custom formats/quality profiles) to Sonarr/Radarr.
5. **AutoBrr**: Real-time release automation (IRC announcer) for racing private trackers.
6. **Cross-Seed**: Automatically cross-seed torrents across multiple trackers to build ratio.
7. **Unpackerr**: Automated extraction of archives for Sonarr/Radarr/Lidarr downloads.
8. **Plex Meta Manager (Kometa)**: Python script to update Plex metadata and build collections automatically.

### 🛠️ System & Maintenance

9. **Scrutiny**: Hard drive S.M.A.R.T. monitoring dashboard.
10. **Uptime Kuma**: Sophisticated monitoring tool for services with status pages.
11. **Speedtest-Tracker**: Continuous internet speed monitoring and history.
12. **PostgreSQL Migration**: Migrate *Arr apps to PostgreSQL for improved performance on large libraries.
13. **Backup Strategy**: Implement `restic` or similar for off-site backups of `${CONFIG_ROOT}`.

### ⚡ Streaming & Transcoding

14. **Threadfin**: M3U proxy server for IPTV management (replacing xTeVe).
15. **ErsatzTV**: Create custom live channels from your media library.
16. **Autoscan**: Replace Plex default scanning with webhook-based triggers for instant updates.
17. **Jellyseerr**: Fork of Overseerr optimized specifically for Jellyfin users.
18. **GPU Mapping**: Refine NVIDIA/Intel QSV pass-through for Tdarr nodes and Plex/Jellyfin.

## Verification Plan

We will verify the "functions" of the stack by confirming the status and accessibility of each service.

### Automated Verification
Run the following command (using your chosen compose profile) to check container health:
```bash
docker compose ps
```
Expected output: All containers should be in `Up` state.

### Manual Verification

#### 1. Core Services
- **Authelia**: Visit `https://auth.yourdomain.com`. Should see login page.
- **Cloudflare Tunnel**: Check logs `docker compose logs cloudflared`. Should show "Registered tunnel connection".
- **Authelia state API**: If `/api/state` returns 403 behind a proxy, ensure forwarded headers are present (`X-Forwarded-Proto`, `X-Forwarded-Host`). You can override via env when running the post-deploy check: `AUTHELIA_HOST=auth.example.com AUTHELIA_PROTO=https`.

#### 2. Media Applications
- **Plex**: Visit `http://localhost:32400/web` (tunnel required for remote).
- **Jellyfin**: Visit `http://localhost:8096`.
- **Sonarr/Radarr**: Visit `http://localhost:8989` / `http://localhost:7878`.
- **qBittorrent**: Visit `http://localhost:8080`. Try adding a test torrent (e.g., Ubuntu ISO).
- **Bazarr**: Visit `http://localhost:6767` and verify it detects your Plex/Jellyfin libraries.
- **Tautulli**: Visit `http://localhost:8181` and confirm Plex connectivity.
- **Tdarr**: Visit `http://localhost:8265` and ensure the server and internal node show as `Online`.
- **Homepage**: Visit `http://localhost:3000` and verify service tiles and health indicators.
- **Portainer**: Visit `http://localhost:9000` for container management.
- **Dozzle**: Visit `http://localhost:8080` (or the mapped port) for logs.

#### 3. Integration Tests
- **Prowlarr -> Sonarr/Radarr**: Add Prowlarr as an indexer in Sonarr/Radarr. Test connection.
- **Sonarr/Radarr -> qBittorrent**: Add qBittorrent as a download client. Test connection.
- **Overseerr -> Plex/Jellyfin**: Connect media server. Sync library.
- **Notifiarr -> Sonarr/Radarr/Prowlarr/Tautulli**: Configure integrations and send a test notification.
- **Gluetun -> qBittorrent**: Confirm the external IP inside qBittorrent is the VPN IP, not your ISP IP.
- **Authelia + Cloudflare Tunnel**: Access each `*.yourdomain.com` hostname and verify you are prompted for SSO (with 2FA) and redirected back to the requested app after login.
- **Homepage + Authelia**: Ensure the Homepage dashboard itself is protected by Authelia and loads only over HTTPS via Cloudflare Tunnel.

## Stress testing (Docker + SSH only)

Use the Dockerized k6 harness to stress the control server (health + settings endpoints). Run it locally or over SSH on the target host:

```bash
ssh <user>@<host> 'cd <deployPath> && TARGET_BASE=http://localhost:3001 DURATION=2m VUS=25 bash scripts/stress_control_server.sh'
```

- Adjust `TARGET_BASE` if the control server is behind a reverse proxy (e.g., `http://host.docker.internal:3001` when running on Docker Desktop).
- The script uses `--network=host`; if host networking is unavailable, set `TARGET_BASE` to a reachable address and remove that flag.
- Thresholds: `<1%` failures, p95 latency `<500ms`. Inspect the k6 summary for regressions.

---

## 📝 Checklist

| Step                                   | ✓ |
|----------------------------------------|:-:|
| `.env` configured with strong secrets  |   |
| Authelia domain & Redis configured     |   |
| Cloudflared ingress rules applied      |   |
| Plex/Jellyfin setup                    |   |
| Arr stack volume mappings              |   |
| qBittorrent port & credentials         |   |
| Watchtower & Dozzle enabled            |   |
| Integration tests (Prowlarr → Sonarr)   |   |
| Integration tests (Sonarr → qBittorrent)|   |
| Overseerr → Plex/Jellyfin sync         |   |
