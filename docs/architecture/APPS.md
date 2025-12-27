# Installed Docker Applications

| Application | Docker Image | Tag | Purpose |
| :--- | :--- | :--- | :--- |
| Traefik | `traefik` | `v3.2` | Reverse proxy + routing |
| Cloudflared | `cloudflare/cloudflared` | `latest` | Cloudflare Tunnel connector |
| Authelia | `authelia/authelia` | `latest` | SSO/MFA in front of routes |
| Redis | `redis` | `alpine` | Session store for Authelia |
| Homepage | `ghcr.io/gethomepage/homepage` | `latest` | Dashboard landing page |
| Portainer | `portainer/portainer-ce` | `latest` | Docker management UI |
| Dozzle | `amir20/dozzle` | `latest` | Browser log viewer |
| Watchtower | `containrrr/watchtower` | `latest` | Auto-update containers (optional) |
| Autoheal | `willfarrell/autoheal` | `latest` | Restart unhealthy containers (optional) |
| Postgres | `postgres` | `16-alpine` | Database for *Arr apps |
| Sonarr | `lscr.io/linuxserver/sonarr` | `latest` | TV automation |
| Radarr | `lscr.io/linuxserver/radarr` | `latest` | Movie automation |
| Prowlarr | `lscr.io/linuxserver/prowlarr` | `latest` | Indexer manager |
| Overseerr | `lscr.io/linuxserver/overseerr` | `latest` | Media request UI |
| Bazarr | `lscr.io/linuxserver/bazarr` | `latest` | Subtitle manager |
| qBittorrent | `lscr.io/linuxserver/qbittorrent` | `latest` | Torrent client |
| Gluetun | `qmcgaw/gluetun` | `latest` | VPN boundary + kill-switch |
| FlareSolverr | `ghcr.io/flaresolverr/flaresolverr` | `latest` | Bypass Cloudflare challenges |
| Plex | `lscr.io/linuxserver/plex` | `latest` | Media server (Plex) |
| Jellyfin | `jellyfin/jellyfin` | `latest` | Media server (open-source) |
| Tautulli | `lscr.io/linuxserver/tautulli` | `latest` | Plex analytics |
| Tdarr | `ghcr.io/haveagitgat/tdarr` | `latest` | Distributed transcoding |
| Audiobookshelf | `lscr.io/linuxserver/audiobookshelf` | `latest` | Audiobooks/podcasts |
| Kavita | `lscr.io/linuxserver/kavita` | `latest` | Comics/ebooks server |
| Mealie | `ghcr.io/mealie-recipes/mealie` | `latest` | Recipe manager |
| PhotoPrism | `lscr.io/linuxserver/photoprism` | `latest` | Photo management |
| Notifiarr | `golift/notifiarr` | `latest` | Alerts/notifications |

Wizard components (`control-server`, `docs-site`) run only in `docker-compose.wizard*.yml` and are not part of the primary stack above.
