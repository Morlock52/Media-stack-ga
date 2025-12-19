#!/bin/bash
# Non-interactive setup script

set -e

# --- Configuration ---
# --- Configuration ---
DOMAIN="${DOMAIN:-example.com}"
TIMEZONE="${TIMEZONE:-Etc/UTC}"
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"
MASTER_PASSWORD="${MASTER_PASSWORD:-$(openssl rand -hex 16)}"
DATA_ROOT="${DATA_ROOT:-./data}"

# --- Create .env file ---
echo "⚙️  Creating .env file..."

cat > .env <<EOF
# .env configuration for mediastack

# =============================================================================
# GENERAL SETTINGS
# =============================================================================
TIMEZONE=${TIMEZONE}
PUID=${PUID}
PGID=${PGID}
DOMAIN=${DOMAIN}
DOCKER_NETWORK=mediastack
# Use provided profiles or default to full stack
COMPOSE_PROFILES=${COMPOSE_PROFILES:-"plex,arr,torrent,vpn,notify,stats,transcode"}

# =============================================================================
# STORAGE & PATHS
# =============================================================================
DATA_ROOT=${DATA_ROOT}
CONFIG_ROOT=\${DATA_ROOT}/config
MOVIES_PATH=\${DATA_ROOT}/media/movies
TV_SHOWS_PATH=\${DATA_ROOT}/media/tv
MUSIC_PATH=\${DATA_ROOT}/media/music
BOOKS_PATH=\${DATA_ROOT}/media/books
AUDIOBOOKS_PATH=\${DATA_ROOT}/media/audiobooks
PHOTOS_PATH=\${DATA_ROOT}/media/photos
TRANSCODE_PATH=\${DATA_ROOT}/transcode
DOWNLOADS_PATH=\${DATA_ROOT}/downloads

# =============================================================================
# SERVICE CREDENTIALS & SECRETS
# =============================================================================
CLOUDFLARE_TUNNEL_TOKEN=CHANGE_ME_TOKEN

# Authelia Secrets (Generated)
AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET=$(openssl rand -hex 32)
AUTHELIA_SESSION_SECRET=$(openssl rand -hex 32)
AUTHELIA_STORAGE_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Passwords
REDIS_PASSWORD=${MASTER_PASSWORD}

# API Keys (For Homepage Dashboard)
PLEX_TOKEN=
JELLYFIN_API_KEY=
SONARR_API_KEY=
RADARR_API_KEY=
PROWLARR_API_KEY=
BAZARR_API_KEY=
OVERSEERR_API_KEY=
TAUTULLI_API_KEY=
PORTAINER_TOKEN=

# Plex
PLEX_CLAIM=
# PhotoPrism
PHOTOPRISM_ADMIN_PASSWORD=

# Gluetun VPN (WireGuard)
WIREGUARD_PRIVATE_KEY=
WIREGUARD_ADDRESSES=
EOF

echo "✅ .env file created."

# --- Create directories ---
echo "📂 Creating directory structure in ${DATA_ROOT}..."

mkdir -p "${DATA_ROOT}/config"
mkdir -p "${DATA_ROOT}/media/movies"
mkdir -p "${DATA_ROOT}/media/tv"
mkdir -p "${DATA_ROOT}/media/music"
mkdir -p "${DATA_ROOT}/media/books"
mkdir -p "${DATA_ROOT}/media/audiobooks"
mkdir -p "${DATA_ROOT}/media/photos"
mkdir -p "${DATA_ROOT}/transcode"
mkdir -p "${DATA_ROOT}/downloads"

for service in authelia cloudflared plex jellyfin sonarr radarr prowlarr qbittorrent overseerr bazarr tautulli portainer watchtower dozzle homepage flaresolverr tdarr-server tdarr-node gluetun notifiarr mealie kavita audiobookshelf photoprism; do
    mkdir -p "${DATA_ROOT}/config/${service}"
done

echo "✅ Directory structure created."

# --- Configure Homepage ---
echo "📊 Configuring Dynamic Dashboard..."
cat > "${DATA_ROOT}/config/homepage/docker.yaml" <<EOF
my-docker:
  socket: /var/run/docker.sock
EOF

cat > "${DATA_ROOT}/config/homepage/services.yaml" <<EOF
# Services are automatically discovered via Docker labels.
EOF

echo "🎉 Setup complete!"
echo "Next steps:"
echo "1. Edit .env and set CLOUDFLARE_TUNNEL_TOKEN"
echo "2. Run 'docker compose up -d' to start the services."
