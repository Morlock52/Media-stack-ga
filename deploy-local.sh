#!/bin/bash
# deploy-local.sh - Deploy Media Stack locally with Traefik
# No Cloudflare, No Authelia - Just local access via *.local domains

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Media Stack Local Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check for .env file
if [ ! -f .env ]; then
    if [ -f .env.local.example ]; then
        echo -e "${YELLOW}No .env file found. Creating from .env.local.example...${NC}"
        cp .env.local.example .env
        echo -e "${GREEN}Created .env file. Please edit it with your settings.${NC}"
        echo ""
        echo "Run this script again after editing .env"
        exit 0
    else
        echo "Error: No .env or .env.local.example found"
        exit 1
    fi
fi

# Load environment variables
source .env

# Create directories
echo -e "${BLUE}Creating directories...${NC}"
mkdir -p "${CONFIG_ROOT:-./config}"/{traefik,homepage,plex,sonarr,radarr,prowlarr,bazarr,overseerr,qbittorrent,tautulli,jellyfin}
mkdir -p "${MOVIES_PATH:-./media/movies}"
mkdir -p "${TV_SHOWS_PATH:-./media/tv}"
mkdir -p "${MUSIC_PATH:-./media/music}"
mkdir -p "${DOWNLOADS_PATH:-./downloads}"/{complete,incomplete}
mkdir -p "${TRANSCODE_PATH:-./transcode}"

# Create Homepage config if it doesn't exist
HOMEPAGE_CONFIG="${CONFIG_ROOT:-./config}/homepage"
if [ ! -f "$HOMEPAGE_CONFIG/services.yaml" ]; then
    echo -e "${BLUE}Creating Homepage dashboard config...${NC}"
    cat > "$HOMEPAGE_CONFIG/services.yaml" << 'EOF'
---
- Media:
    - Plex:
        icon: plex.png
        href: http://localhost:32400/web
        description: Media Server
    - Jellyfin:
        icon: jellyfin.png
        href: http://jellyfin.local
        description: Free Media Server

- Automation:
    - Sonarr:
        icon: sonarr.png
        href: http://sonarr.local
        description: TV Series
    - Radarr:
        icon: radarr.png
        href: http://radarr.local
        description: Movies
    - Prowlarr:
        icon: prowlarr.png
        href: http://prowlarr.local
        description: Indexers
    - Bazarr:
        icon: bazarr.png
        href: http://bazarr.local
        description: Subtitles

- Downloads:
    - qBittorrent:
        icon: qbittorrent.png
        href: http://qbit.local
        description: Torrent Client

- Requests:
    - Overseerr:
        icon: overseerr.png
        href: http://overseerr.local
        description: Request Management

- Monitoring:
    - Tautulli:
        icon: tautulli.png
        href: http://tautulli.local
        description: Plex Statistics
    - Traefik:
        icon: traefik.png
        href: http://traefik.local
        description: Reverse Proxy
EOF

    cat > "$HOMEPAGE_CONFIG/settings.yaml" << 'EOF'
---
title: Media Stack
theme: dark
color: slate
headerStyle: clean
layout:
  Media:
    style: row
    columns: 2
  Automation:
    style: row
    columns: 4
  Downloads:
    style: row
    columns: 2
  Requests:
    style: row
    columns: 2
  Monitoring:
    style: row
    columns: 2
EOF

    cat > "$HOMEPAGE_CONFIG/widgets.yaml" << 'EOF'
---
- search:
    provider: google
    target: _blank
EOF
fi

# Get server IP
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "YOUR_SERVER_IP")

echo ""
echo -e "${BLUE}Starting containers...${NC}"
docker compose -f docker-compose.local.yml up -d

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Add this line to your /etc/hosts file:${NC}"
echo ""
echo -e "${GREEN}$SERVER_IP home.local plex.local sonarr.local radarr.local prowlarr.local bazarr.local overseerr.local qbit.local tautulli.local traefik.local jellyfin.local${NC}"
echo ""
echo -e "${BLUE}Access your services:${NC}"
echo "  Dashboard:    http://home.local"
echo "  Plex:         http://localhost:32400/web"
echo "  Sonarr:       http://sonarr.local"
echo "  Radarr:       http://radarr.local"
echo "  Prowlarr:     http://prowlarr.local"
echo "  Overseerr:    http://overseerr.local"
echo "  qBittorrent:  http://qbit.local (default: admin/adminadmin)"
echo "  Traefik:      http://localhost:8080"
echo ""
echo -e "${YELLOW}Note: Plex uses host networking - access via port 32400${NC}"
echo ""
