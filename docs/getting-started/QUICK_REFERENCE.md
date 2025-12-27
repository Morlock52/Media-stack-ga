<div align="center">
<img src="../images/logo.png" alt="Media Stack Logo" width="100"/>

# Quick Reference Guide
</div>

> **Last Updated:** December 27, 2025

Matrix HUD UI note: screenshots and visuals in the docs reflect the current cyber-matrix theme.

## 🚀 Quick Commands

### Start Services
```bash
docker compose up -d
```

### Local LAN (no SSO/tunnel)
```bash
docker compose up -d
```

Set `DOMAIN=local` and add LAN DNS/hosts entries for subdomains you want to use.

> **Security on LAN still matters:** use strong passwords, keep Authelia enabled for shared admin apps, and segment your LAN when possible.

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

After setup, access services using the subdomains defined in `.env`:

- **Audiobookshelf:** `https://audiobookshelf.${DOMAIN}`
- **Authelia:** `https://auth.${DOMAIN}`
- **Bazarr:** `https://bazarr.${DOMAIN}`
- **Dozzle:** `https://logs.${DOMAIN}`
- **Homepage:** `https://hub.${DOMAIN}` (Dashboard)
- **Jellyfin:** `https://jellyfin.${DOMAIN}`
- **Kavita:** `https://kavita.${DOMAIN}`
- **Mealie:** `https://mealie.${DOMAIN}`
- **Monitor:** `https://monitor.${DOMAIN}`
- **Notifiarr:** `https://notifiarr.${DOMAIN}`
- **Overseerr:** `https://request.${DOMAIN}`
- **PhotoPrism:** `https://photoprism.${DOMAIN}`
- **Plex:** `https://plex.${DOMAIN}`
- **Portainer:** `https://portainer.${DOMAIN}`
- **Prowlarr:** `https://prowlarr.${DOMAIN}`
- **qBittorrent:** `https://torrent.${DOMAIN}`
- **Radarr:** `https://radarr.${DOMAIN}`
- **Sonarr:** `https://sonarr.${DOMAIN}`
- **Tautulli:** `https://tautulli.${DOMAIN}`
- **Tdarr:** `https://tdarr.${DOMAIN}`

### Local/LAN access without DNS

- **Homepage dashboard:** `http://<server-ip>`
- Add `/etc/hosts` entries if you want subdomain access without DNS:

```
<server-ip> plex.local
<server-ip> sonarr.local
<server-ip> radarr.local
```

## 🎙️ AI Voice Tips

- **Wake Word**: None. Just click the mic button.
- **Microphone Issues?**: Use the **Text Input** box at the bottom of the specialized modal.
- **Privacy**: No audio is recorded to disk. Transcripts are sent to OpenAI for processing only.
- **Audio quality**: With an OpenAI key saved in **Settings**, the wizard uses OpenAI TTS (`gpt-5.2-mini-tts` with fallback); ElevenLabs is optional via API key + voice ID.
- **Context**: The AI knows about "Plex", "Arr stack", "NAS", and "VPS". Use these terms for best results.


## 🔑 Default Credentials

⚠️ **CHANGE THESE IMMEDIATELY!**

- **Authelia:** `morlock` / *(the master password you set during setup)*
- **qBittorrent:** Default user is `admin`; the first-run password is printed in qBittorrent container logs
- **Portainer:** Set during first login

## 📋 Configuration Checklist

- [ ] Run `./setup.sh` (Linux/Mac) or `.\setup.ps1` (Windows)
- [ ] Review `.env` values
- [ ] Set `CLOUDFLARE_TUNNEL_TOKEN` in `.env`
- [ ] Set `AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET` in `.env`
- [ ] Update `config/cloudflared/config.yml` with your Tunnel ID and hostnames
- [ ] Configure Gluetun VPN credentials in `.env` (WIREGUARD_PRIVATE_KEY, etc.)
- [ ] Start services: `docker compose up -d`
- [ ] Configure Prowlarr indexers + FlareSolverr
- [ ] Connect Sonarr/Radarr to Prowlarr and qBittorrent

## 🛠️ Troubleshooting Quick Fixes

### Permission Issues (Linux/Mac)
```bash
sudo chown -R 1000:1000 /srv/mediastack
```

### Clear and Restart
```bash
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
