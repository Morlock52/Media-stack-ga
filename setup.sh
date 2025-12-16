#!/bin/bash

# Media Stack Setup Script
# This script helps automate the initial setup using a beautiful TUI

set -e

# Function to check and install gum
install_gum() {
    if ! command -v gum &> /dev/null; then
        echo "📦 Installing 'gum' for a beautiful setup experience..."
        
        # macOS
        if [[ "$OSTYPE" == "darwin"* ]]; then
            if command -v brew &> /dev/null; then
                brew install gum
            else
                echo "❌ Homebrew not found. Please install Homebrew or 'gum' manually."
                exit 1
            fi
        
        # Linux
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            if [ -f /etc/os-release ]; then
                . /etc/os-release
                case $ID in
                    debian|ubuntu|pop|mint)
                        echo "   Detected Debian/Ubuntu-based system."
                        sudo mkdir -p /etc/apt/keyrings
                        curl -fsSL https://repo.charm.sh/apt/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/charm.gpg
                        echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" | sudo tee /etc/apt/sources.list.d/charm.list
                        sudo apt update && sudo apt install -y gum
                        ;;
                    fedora|rhel|centos)
                        echo "   Detected Fedora/RHEL-based system."
                        echo '[charm]
name=Charm
baseurl=https://repo.charm.sh/yum/
enabled=1
gpgcheck=1
gpgkey=https://repo.charm.sh/yum/gpg.key' | sudo tee /etc/yum.repos.d/charm.repo
                        sudo dnf install -y gum
                        ;;
                    arch|manjaro)
                        echo "   Detected Arch-based system."
                        sudo pacman -S --noconfirm gum
                        ;;
                    *)
                        echo "⚠️  Unsupported Linux distribution: $ID"
                        echo "   Attempting to install via go install (if available) or binary..."
                        if command -v go &> /dev/null; then
                            go install github.com/charmbracelet/gum@latest
                        else
                            echo "❌ Please install 'gum' manually: https://github.com/charmbracelet/gum#installation"
                            exit 1
                        fi
                        ;;
                esac
            else
                echo "❌ Cannot detect Linux distribution. Please install 'gum' manually."
                exit 1
            fi
        else
            echo "❌ Unsupported OS. Please install 'gum' manually."
            exit 1
        fi
    fi
}

# Install gum if needed
install_gum

# --- TUI START ---

# Clear screen
clear

# Header
gum style \
	--foreground 212 --border-foreground 212 --border double \
	--align center --width 50 --margin "1 2" --padding "2 4" \
	"Media Stack Setup" "Initial Configuration"

# Check Docker
gum style --foreground 99 "🔍 Checking prerequisites..."
if ! command -v docker &> /dev/null; then
    gum style --foreground 196 "❌ Docker is not installed. Please install Docker first."
    exit 1
fi
# Docker Compose v2 ships as `docker compose`; fall back to legacy `docker-compose`
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker plugin ls 2>/dev/null | grep -qi compose; then
    COMPOSE_CMD="docker compose" # plugin present but command not on PATH
else
    gum style --foreground 196 "❌ Docker Compose is not installed. Please install Docker Compose (plugin or legacy) first."
    exit 1
fi
gum style --foreground 46 "✅ Docker and Docker Compose are installed"
gum style --foreground 99 "Detected Compose command: ${COMPOSE_CMD}"
echo ""

# --- Configuration ---

gum style --foreground 212 "📝 Configuration"

# Domain
DOMAIN=$(gum input --placeholder "Enter your domain (e.g., example.com)" --value "example.com" --header "Domain Name")

# Timezone
TIMEZONE=$(gum input --placeholder "Enter your timezone" --value "Etc/UTC" --header "Timezone")

# PUID/PGID
CURRENT_UID=$(id -u)
CURRENT_GID=$(id -g)
PUID=$(gum input --placeholder "PUID" --value "$CURRENT_UID" --header "User ID (PUID)")
PGID=$(gum input --placeholder "PGID" --value "$CURRENT_GID" --header "Group ID (PGID)")

# Password
MASTER_PASSWORD=$(gum input --password --placeholder "Master Password" --value "Morlock52$" --header "Master Password for all services")

# Confirm
gum style --foreground 99 "Review Configuration:"
echo "Domain: $DOMAIN"
echo "Timezone: $TIMEZONE"
echo "PUID/PGID: $PUID/$PGID"
echo "Password: ************"
gum confirm "Is this correct?" || exit 1

# --- Stack Selection ---

gum style --foreground 212 "🏗️  Stack Selection"

MODE=$(gum choose "Newbie (Recommended)" "Expert (Custom)")

PROFILES=""

if [ "$MODE" == "Newbie (Recommended)" ]; then
    gum style --foreground 46 "👍 Selected: Recommended Stack"
    gum style --foreground 240 "   Includes: Plex, *Arr Stack, qBittorrent+VPN, Notifications, Stats"
    PROFILES="plex,arr,torrent,vpn,notify,stats"
else
    # Expert Selection
    gum style --foreground 212 "🛠️  Expert Mode: Select Components"
    
    SELECTIONS=$(gum choose --no-limit --header "Select Services (Space to select, Enter to confirm)" "Plex" "Jellyfin" "*Arr Stack (Sonarr/Radarr/etc)" "Torrent Client (qBit + VPN)" "Transcoding (Tdarr)" "Stats (Tautulli)" "Notifications (Notifiarr)")
    
    if [[ "$SELECTIONS" == *"Plex"* ]]; then PROFILES="${PROFILES},plex"; fi
    if [[ "$SELECTIONS" == *"Jellyfin"* ]]; then PROFILES="${PROFILES},jellyfin"; fi
    if [[ "$SELECTIONS" == *"*Arr Stack"* ]]; then PROFILES="${PROFILES},arr"; fi
    if [[ "$SELECTIONS" == *"Torrent Client"* ]]; then PROFILES="${PROFILES},torrent,vpn"; fi
    if [[ "$SELECTIONS" == *"Transcoding"* ]]; then PROFILES="${PROFILES},transcode"; fi
    if [[ "$SELECTIONS" == *"Stats"* ]]; then PROFILES="${PROFILES},stats"; fi
    if [[ "$SELECTIONS" == *"Notifications"* ]]; then PROFILES="${PROFILES},notify"; fi
    
    # Remove leading comma
    PROFILES=$(echo $PROFILES | sed 's/^,//')
fi

# --- Cloudflare Setup ---
DATA_ROOT=/srv/mediastack # Define it here for use in this step
CONFIG_ROOT=${DATA_ROOT}/config
sudo mkdir -p "${CONFIG_ROOT}/cloudflared"

gum style --foreground 212 "☁️  Cloudflare Tunnel Setup"
CF_METHOD=$(gum choose "Manual (paste a tunnel token)" "Automatic (recommended, uses a temporary API token)")

NEXT_STEPS=""
CF_ENV_VARS=""

if [ "$CF_METHOD" == "Manual (paste a tunnel token)" ]; then
    CLOUDFLARE_TUNNEL_TOKEN=$(gum input --placeholder "Cloudflare Tunnel Token" --header "Paste your tunnel token")
    if [[ -z "$CLOUDFLARE_TUNNEL_TOKEN" || "$CLOUDFLARE_TUNNEL_TOKEN" == "CHANGE_ME_TOKEN" ]]; then
        gum style --foreground 208 "⚠️  Cloudflare Tunnel Token is empty or default. Cloudflare Tunnel may not work."
        if ! gum confirm "Are you sure you want to proceed?"; then
            CLOUDFLARE_TUNNEL_TOKEN=$(gum input --placeholder "Cloudflare Tunnel Token" --header "Please enter your Cloudflare Tunnel Token")
        fi
    fi
    CF_ENV_VARS="CLOUDFLARE_TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}"
    CLOUDFLARED_COMMAND="tunnel run --token ${CLOUDFLARE_TUNNEL_TOKEN}"
    NEXT_STEPS="1. Manually configure your public hostnames in the Cloudflare dashboard."
else
    CLOUDFLARE_API_TOKEN=$(gum input --password --placeholder "Cloudflare API Token" --header "Cloudflare API Token (see https://dash.cloudflare.com/profile/api-tokens)")
    
    gum style --foreground 99 "Logging into Cloudflare..."
    # Suppressing output here as the login command can be verbose
    docker run --rm -v "${CONFIG_ROOT}/cloudflared:/home/nonroot/.cloudflared" \
      --env CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" \
      cloudflare/cloudflared:latest tunnel login > /dev/null 2>&1
    
    TUNNEL_NAME="mediastack-$(openssl rand -hex 4)"
    gum style --foreground 99 "Creating tunnel '${TUNNEL_NAME}'..."
    TUNNEL_ID=$(docker run --rm -v "${CONFIG_ROOT}/cloudflared:/home/nonroot/.cloudflared" \
      cloudflare/cloudflared:latest tunnel create ${TUNNEL_NAME} | grep -o -E '[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}')
    
    if [ -z "$TUNNEL_ID" ]; then
        gum style --foreground 196 "❌ Failed to create Cloudflare tunnel. Please check your API token and permissions."
        exit 1
    fi
    gum style --foreground 46 "✅ Tunnel created with ID: ${TUNNEL_ID}"
    
    gum spin --spinner dot --title "Creating wildcard DNS record (*.${DOMAIN})..." -- \
        docker run --rm -v "${CONFIG_ROOT}/cloudflared:/home/nonroot/.cloudflared" \
        cloudflare/cloudflared:latest tunnel route dns ${TUNNEL_ID} "*.${DOMAIN}"
    gum style --foreground 46 "✅ DNS record created."

    CLOUDFLARED_COMMAND="tunnel run ${TUNNEL_ID}"
    CF_ENV_VARS="CLOUDFLARE_TUNNEL_ID=${TUNNEL_ID}"
    NEXT_STEPS="1. Go to your Cloudflare dashboard and add Public Hostnames to your tunnel.\n   Example: Subdomain 'hub', Service 'http://homepage:3000'"
fi

# --- Update .env ---

gum spin --spinner dot --title "⚙️  Updating .env file..." -- sleep 1

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
COMPOSE_PROFILES=${PROFILES}

# =============================================================================
# STORAGE & PATHS
# =============================================================================
DATA_ROOT=/srv/mediastack
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
# Cloudflare
${CF_ENV_VARS}
CLOUDFLARED_COMMAND=${CLOUDFLARED_COMMAND}

# Authelia Secrets (Generated)
AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET=$(openssl rand -hex 32)
AUTHELIA_SESSION_SECRET=$(openssl rand -hex 32)
AUTHELIA_STORAGE_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Passwords
REDIS_PASSWORD=${MASTER_PASSWORD}

# API Keys (For Homepage Dashboard)
# Fill these in after setting up the services to enable widgets
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

source .env

# --- Directories ---

gum spin --spinner dot --title "📂 Creating directory structure..." -- sleep 1

# Create directories with proper permissions
sudo mkdir -p "${DATA_ROOT}/config"
sudo mkdir -p "${MOVIES_PATH}"
sudo mkdir -p "${TV_SHOWS_PATH}"
sudo mkdir -p "${MUSIC_PATH}"
sudo mkdir -p "${BOOKS_PATH}"
sudo mkdir -p "${AUDIOBOOKS_PATH}"
sudo mkdir -p "${PHOTOS_PATH}"
sudo mkdir -p "${TRANSCODE_PATH}"
sudo mkdir -p "${DOWNLOADS_PATH}"

# Create config subdirectories
for service in authelia cloudflared plex jellyfin sonarr radarr prowlarr qbittorrent overseerr bazarr tautulli portainer watchtower dozzle homepage flaresolverr tdarr-server tdarr-node gluetun notifiarr mealie kavita audiobookshelf photoprism; do
    if [ "$service" != "cloudflared" ]; then # cloudflared dir is already created
        sudo mkdir -p "${DATA_ROOT}/config/${service}"
    fi
done

# Set ownership
gum style --foreground 212 "🔐 Setting permissions (sudo required)..."
sudo chown -R ${PUID}:${PGID} "${DATA_ROOT}"

# Update Authelia
if [ -f config/authelia/configuration.yml ]; then
    sed -i "s/password: .*/password: ${REDIS_PASSWORD}/g" config/authelia/configuration.yml
fi

# --- Configure Homepage (Dynamic Dashboard) ---
gum style --foreground 212 "📊 Configuring Dynamic Dashboard..."

# Enable Docker Discovery
cat > "${DATA_ROOT}/config/homepage/docker.yaml" <<EOF
my-docker:
  socket: /var/run/docker.sock
EOF

# Clear static services (we use Docker labels now)
cat > "${DATA_ROOT}/config/homepage/services.yaml" <<EOF
# Services are automatically discovered via Docker labels.
# See docker-compose.yml for configuration.
EOF

# --- Pull Images ---

gum style --foreground 99 "📥 Pulling Docker images..."
docker-compose pull | gum format

# --- Container Checks ---

gum style --foreground 212 "🔍 Checking for existing containers..."

CONTAINERS=(
    "authelia" "bazarr" "cloudflared" "dozzle" "flaresolverr" "gluetun"
    "homepage" "jellyfin" "notifiarr" "overseerr" "plex" "portainer"
    "prowlarr" "qbittorrent" "radarr" "redis" "sonarr" "tautulli"
    "tdarr" "watchtower"
)

for container in "${CONTAINERS[@]}"; do
    if docker ps -a --format '{{.Names}}' | grep -w -q "^${container}$"; then
        gum style --foreground 208 "⚠️  Container '${container}' already exists."
        CHOICE=$(gum choose "Delete and Replace" "Skip" "Keep Existing")
        case "$CHOICE" in
            "Delete and Replace")
                gum spin --spinner minidot --title "🗑️  Deleting '${container}'..." -- docker rm -f "${container}"
                ;;
            "Skip")
                gum style --foreground 240 "   ⏭️  Skipping check for '${container}'."
                ;;
            *)
                gum style --foreground 240 "   🛑 Keeping existing '${container}'."
                ;;
        esac
    fi
done

# --- Completion ---

gum style \
	--foreground 212 --border-foreground 212 --border double \
	--align center --width 50 --margin "1 2" --padding "2 4" \
	"Setup Complete!"

gum style --foreground 99 "Next steps:"
echo -e "${NEXT_STEPS}"
if command -v bun &> /dev/null; then
    echo "2. (Optional) Run 'cd docs-site && bun run dev' for the interactive guide."
else
    echo "2. (Optional) Run 'cd docs-site && npm run dev' for the interactive guide."
fi
echo ""

if gum confirm "🚀 Do you want to start the media stack now?"; then
    gum spin --spinner dot --title "🚀 Starting stack..." -- docker-compose up -d
    gum style --foreground 46 "✅ Stack started! Check status with: docker-compose ps"
else
    echo "OK. Start later with: docker-compose up -d"
fi
