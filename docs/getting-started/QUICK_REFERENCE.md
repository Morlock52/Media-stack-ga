<div align="center">
<img src="../images/logo.png" alt="Media Stack Logo" width="100"/>

# Quick Reference Guide
</div>

> **Last Updated:** January 4, 2026

Matrix HUD UI note: screenshots and visuals in the docs reflect the current cyber-matrix theme.

## 🚀 Quick Commands

### Start Services (Secure / Reverse Proxy)
```bash
docker compose up -d
```

### Local LAN (Direct Ports — simplest)
```bash
docker compose -f docker-compose.local.yml up -d
```

This mode exposes each app directly on its port (Plex `32400`, Sonarr `8989`, etc). No SSO and no tunnel.

### Remote Access (SSO + Cloudflare Tunnel)
```bash
docker compose --profile auth --profile cloudflared up -d
```

### Stop Services
```bash
docker compose down
```

### Start Wizard (Docker Mode)
```bash
docker compose -f docker-compose.wizard.yml up -d
# Access at http://localhost:3002
```

### Remote Deploy (Wizard)

1. Complete the wizard → **Review & Generate**.
2. Click **Deploy to Server**.
3. Use **Test Connection** to verify SSH + Docker + Compose.
4. Deploy and monitor steps in the modal.

**Tips**

- Double-click protection: concurrent deploys to the same host are rejected with **HTTP 409**.
- (Optional) Auto-fix container name conflicts and retry once.
- (Optional) If `/dev/net/tun` is missing, auto-disable VPN/torrent profiles so the rest of the stack can deploy.
- After SSH connects, the UI shows a best-effort **remote container snapshot** (name + on/off).

> Password auth requires `sshpass` on the control server host/container.

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f authelia
docker compose logs -f plex
docker compose logs -f gluetun
```

### Restart a Service
```bash
docker compose restart servicename
```

### Interactive Setup (TUI)
```bash
# Linux / macOS
./setup.sh

# Windows
.\setup.ps1
```

### Update Containers
```bash
# Manual update (Watchtower handles this automatically usually)
docker compose pull
docker compose up -d
```

### Post‑deploy sanity checks (recommended)
```bash
# VPN/Auth/Tunnel verification after updates
bash ./scripts/post_deploy_check.sh
```
See `docs/operations/POST_DEPLOY_CHECKS.md` for details and overrides.

## 🔗 Service URLs

### Wizard (setup UI)

- Wizard UI: `http://localhost:3002`
- Wizard API: `http://localhost:3001/api/health`

### Local LAN (direct ports) — `docker-compose.local.yml`

- Homepage (dashboard): `http://<server-ip>:3000`
- Plex: `http://<server-ip>:32400/web/`
- Jellyfin: `http://<server-ip>:8096/web/`
- Sonarr: `http://<server-ip>:8989`
- Radarr: `http://<server-ip>:7878`
- Prowlarr: `http://<server-ip>:9696`
- Bazarr: `http://<server-ip>:6767`
- Overseerr: `http://<server-ip>:5055`
- qBittorrent: `http://<server-ip>:8081`
- Tautulli: `http://<server-ip>:8181`
- Grafana (logs/metrics): `http://<server-ip>:3003`

### Secure / Remote (Traefik + optional Authelia + Cloudflare) — `docker-compose.yml`

After setup, access services using the hostnames defined by your domain/tunnel config:

- **Homepage:** `https://hub.${DOMAIN}` (Dashboard)
- **Authelia:** `https://auth.${DOMAIN}`
- **Portainer:** `https://portainer.${DOMAIN}`
- **Dozzle:** `https://dozzle.${DOMAIN}`
- **Plex:** `https://plex.${DOMAIN}`
- **Jellyfin:** `https://jellyfin.${DOMAIN}`
- **Grafana:** `https://grafana.${DOMAIN}`
- **Sonarr:** `https://sonarr.${DOMAIN}`
- **Radarr:** `https://radarr.${DOMAIN}`
- **Prowlarr:** `https://prowlarr.${DOMAIN}`
- **Bazarr:** `https://bazarr.${DOMAIN}`
- **Overseerr:** `https://request.${DOMAIN}`
- **qBittorrent:** `https://qbt.${DOMAIN}`
- **Tautulli:** `https://tautulli.${DOMAIN}`
- **Tdarr:** `https://tdarr.${DOMAIN}`
- **Notifiarr:** `https://notifiarr.${DOMAIN}`
- **Mealie:** `https://mealie.${DOMAIN}`
- **Kavita:** `https://kavita.${DOMAIN}`
- **Audiobookshelf:** `https://audiobookshelf.${DOMAIN}`
- **PhotoPrism:** `https://photoprism.${DOMAIN}`

> Tip: You can also access apps on a LAN without DNS via Traefik path routes (example: `http://<server-ip>/sonarr`), but the direct-ports local compose is the easiest for most home users.

## 🎙️ AI Voice Tips

- **Wake Word**: None. Just click the mic button.
- **Microphone Issues?**: Use the **Text Input** box at the bottom of the specialized modal.
- **Privacy**: No audio is recorded to disk. Transcripts are sent to OpenAI for processing only.
- **Audio quality**: With an OpenAI key saved in **Settings**, the wizard uses OpenAI TTS (`tts-1-hd` with fallback); ElevenLabs is optional via API key + voice ID.
- **Context**: The AI knows about "Plex", "Arr stack", "NAS", and "VPS". Use these terms for best results.


## 🔑 Default Credentials

⚠️ **CHANGE THESE IMMEDIATELY!**

- **Authelia (template):** `demo` / `ChangeMe123!` (see `config/authelia/users_database.yml`)
- **qBittorrent:** Default user is `admin`; the first-run password is printed in qBittorrent container logs
- **Portainer:** Set during first login
- **Grafana (local compose):** `admin` / `mediastack` (override with `GRAFANA_USER` / `GRAFANA_PASSWORD`)

## 📋 Configuration Checklist

Pick the checklist that matches how you deployed.

### Local ports (LAN) — `docker-compose.local.yml`
- [ ] Review `.env` values (set `DOMAIN` to your server IP/hostname so Homepage links work from other devices)
- [ ] Start services: `docker compose -f docker-compose.local.yml up -d`
- [ ] Log into each app once and change default passwords
- [ ] Configure Prowlarr indexers
- [ ] Connect Sonarr/Radarr to qBittorrent and Prowlarr

### Remote (SSO + Tunnel) — `docker-compose.yml`
- [ ] Review `.env` values
- [ ] Set `CLOUDFLARE_TUNNEL_TOKEN` in `.env`
- [ ] Set Authelia secrets in `.env`
- [ ] Configure Gluetun VPN credentials in `.env` (WIREGUARD_PRIVATE_KEY, etc.)
- [ ] Update `config/cloudflared/config.yml` with your tunnel ID + hostnames
- [ ] Start services: `docker compose --profile auth --profile cloudflared up -d`
- [ ] Configure Prowlarr indexers + FlareSolverr
- [ ] Connect Sonarr/Radarr to qBittorrent and Prowlarr

## 🛠️ Troubleshooting Quick Fixes

### Permission Issues (Linux/Mac)
```bash
sudo chown -R 1000:1000 /srv/mediastack
```

### Clear and Restart
```bash
# Local ports
docker compose -f docker-compose.local.yml down
docker compose -f docker-compose.local.yml up -d

# Remote / reverse proxy
docker compose down
docker compose up -d
```

### Check Container Status
```bash
docker compose ps
```

### View Container Resource Usage
```bash
docker stats
```

## 📊 Disk Space Check

```bash
# Check main storage
df -h /srv/mediastack

# Check Docker disk usage
docker system df
```

## 🔄 Backup Commands

```bash
# Backup configs
tar -czf mediastack-configs-$(date +%Y%m%d).tar.gz /srv/mediastack/config

# Backup Authelia
tar -czf authelia-backup-$(date +%Y%m%d).tar.gz config/authelia
```

## 🔐 Generate Secure Passwords

```bash
# Random hex string (64 chars)
openssl rand -hex 32

# Authelia password hash
docker run --rm authelia/authelia:latest authelia crypto hash generate argon2 --password 'YourPassword'
```

## 📁 Important File Locations

- **Docker Compose:** `docker-compose.yml`
- **Environment:** `.env`
- **Setup Script:** `setup.sh` (Linux/Mac) / `setup.ps1` (Windows)
- **Authelia Config:** `config/authelia/configuration.yml`
- **Cloudflare Config:** `config/cloudflared/config.yml`
- **Data Root:** `DATA_ROOT` (default `/srv/mediastack`)

## 🆘 Emergency Commands

### Stop everything and remove containers (data preserved)
```bash
docker compose down
```

### Stop and remove everything including volumes (⚠️ DANGER)
```bash
docker compose down -v
```

### Force recreate containers
```bash
docker compose up -d --force-recreate
```
