# Media Stack Setup Script for Windows
# This script helps automate the initial setup using a beautiful TUI

$ErrorActionPreference = "Stop"

# Function to check and install gum
function Install-Gum {
    if (-not (Get-Command gum -ErrorAction SilentlyContinue)) {
        Write-Host "📦 Installing 'gum' for a beautiful setup experience..." -ForegroundColor Cyan
        
        if (Get-Command winget -ErrorAction SilentlyContinue) {
            winget install Charmbracelet.Gum --accept-source-agreements --accept-package-agreements
        }
        elseif (Get-Command scoop -ErrorAction SilentlyContinue) {
            scoop install gum
        }
        elseif (Get-Command choco -ErrorAction SilentlyContinue) {
            choco install gum -y
        }
        else {
            Write-Host "❌ Package manager (winget, scoop, choco) not found. Please install 'gum' manually." -ForegroundColor Red
            exit 1
        }
        
        # Refresh env vars to find gum immediately after install
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    }
}

# Install gum if needed
Install-Gum

# --- TUI START ---

# Clear screen
Clear-Host

# Header
gum style `
    --foreground 212 --border-foreground 212 --border double `
    --align center --width 50 --margin "1 2" --padding "2 4" `
    "Media Stack Setup" "Windows Configuration"

# Check Docker
gum style --foreground 99 "🔍 Checking prerequisites..."
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    gum style --foreground 196 "❌ Docker is not installed. Please install Docker Desktop first."
    exit 1
}
if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    gum style --foreground 196 "❌ Docker Compose is not installed. Please install Docker Desktop first."
    exit 1
}
gum style --foreground 46 "✅ Docker and Docker Compose are installed"
Write-Host ""

# --- Configuration ---

gum style --foreground 212 "📝 Configuration"

# Domain
$DOMAIN = gum input --placeholder "Enter your domain (e.g., example.com)" --value "example.com" --header "Domain Name"

# Timezone
$TIMEZONE = gum input --placeholder "Enter your timezone" --value "Etc/UTC" --header "Timezone"

# PUID/PGID (Less relevant on Windows, but keeping for container compat)
$PUID = gum input --placeholder "PUID" --value "1000" --header "User ID (PUID) - Default 1000 for Windows"
$PGID = gum input --placeholder "PGID" --value "1000" --header "Group ID (PGID) - Default 1000 for Windows"

# Password
$MASTER_PASSWORD = gum input --password --placeholder "Master Password" --value "Morlock52$" --header "Master Password for all services"

# Confirm
gum style --foreground 99 "Review Configuration:"
Write-Host "Domain: $DOMAIN"
Write-Host "Timezone: $TIMEZONE"
Write-Host "PUID/PGID: $PUID/$PGID"
Write-Host "Password: ************"
if (-not (gum confirm "Is this correct?")) { exit 1 }

# --- Update .env ---

gum spin --spinner dot --title "⚙️  Updating .env file..." -- Start-Sleep -Seconds 1

# Generate Secrets
$AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
$AUTHELIA_SESSION_SECRET = -join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
$AUTHELIA_STORAGE_ENCRYPTION_KEY = -join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object { [char]$_ })

# Paths (Windows friendly)
$CURRENT_DIR = Get-Location
$DATA_ROOT = "$CURRENT_DIR\mediastack"
# Escape backslashes for .env if needed, but Docker usually handles them or prefers forward slashes.
# Let's use forward slashes for Docker compatibility even on Windows
$DATA_ROOT_DOCKER = $DATA_ROOT -replace "\\", "/"

$EnvContent = @"
# .env configuration for mediastack

# =============================================================================
# GENERAL SETTINGS
# =============================================================================
TIMEZONE=$TIMEZONE
PUID=$PUID
PGID=$PGID
DOMAIN=$DOMAIN
DOCKER_NETWORK=mediastack

# =============================================================================
# STORAGE & PATHS
# =============================================================================
DATA_ROOT=$DATA_ROOT_DOCKER
CONFIG_ROOT=`${DATA_ROOT}/config
MOVIES_PATH=`${DATA_ROOT}/media/movies
TV_SHOWS_PATH=`${DATA_ROOT}/media/tv
MUSIC_PATH=`${DATA_ROOT}/media/music
BOOKS_PATH=`${DATA_ROOT}/media/books
AUDIOBOOKS_PATH=`${DATA_ROOT}/media/audiobooks
PHOTOS_PATH=`${DATA_ROOT}/media/photos
TRANSCODE_PATH=`${DATA_ROOT}/transcode
DOWNLOADS_PATH=`${DATA_ROOT}/downloads

# =============================================================================
# SERVICE CREDENTIALS & SECRETS
# =============================================================================
CLOUDFLARE_TUNNEL_TOKEN=CHANGE_ME_TOKEN

# Authelia Secrets (Generated)
AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET=$AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET
AUTHELIA_SESSION_SECRET=$AUTHELIA_SESSION_SECRET
AUTHELIA_STORAGE_ENCRYPTION_KEY=$AUTHELIA_STORAGE_ENCRYPTION_KEY

# Passwords
REDIS_PASSWORD=$MASTER_PASSWORD

# Plex
PLEX_CLAIM=
# PhotoPrism
PHOTOPRISM_ADMIN_PASSWORD=
"@

$EnvContent | Out-File -FilePath .env -Encoding utf8

# Load .env variables for script use
$env:REDIS_PASSWORD = $MASTER_PASSWORD

# --- Directories ---

gum spin --spinner dot --title "📂 Creating directory structure..." -- Start-Sleep -Seconds 1

# Create directories
$Dirs = @(
    "$DATA_ROOT\config",
    "$DATA_ROOT\media\movies",
    "$DATA_ROOT\media\tv",
    "$DATA_ROOT\media\music",
    "$DATA_ROOT\media\books",
    "$DATA_ROOT\media\audiobooks",
    "$DATA_ROOT\media\photos",
    "$DATA_ROOT\transcode",
    "$DATA_ROOT\downloads"
)

foreach ($Dir in $Dirs) {
    if (-not (Test-Path -Path $Dir)) {
        New-Item -ItemType Directory -Path $Dir -Force | Out-Null
    }
}

# Create config subdirectories
$Services = @("authelia", "cloudflared", "plex", "jellyfin", "sonarr", "radarr", "prowlarr", "qbittorrent", "overseerr", "bazarr", "tautulli", "portainer", "watchtower", "dozzle", "homepage", "flaresolverr", "tdarr-server", "tdarr-node", "gluetun", "notifiarr", "mealie", "kavita", "audiobookshelf", "photoprism")
foreach ($Service in $Services) {
    $ConfigDir = "$DATA_ROOT\config\$Service"
    if (-not (Test-Path -Path $ConfigDir)) {
        New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
    }
}

# Update Authelia
if (Test-Path "config\authelia\configuration.yml") {
    (Get-Content "config\authelia\configuration.yml") -replace "password: .*", "password: $env:REDIS_PASSWORD" | Set-Content "config\authelia\configuration.yml"
}

# --- Pull Images ---

gum style --foreground 99 "📥 Pulling Docker images..."
docker-compose pull | gum format

# --- Container Checks ---

gum style --foreground 212 "🔍 Checking for existing containers..."

$Containers = @(
    "authelia", "bazarr", "cloudflared", "dozzle", "flaresolverr", "gluetun",
    "homepage", "jellyfin", "notifiarr", "overseerr", "plex", "portainer",
    "prowlarr", "qbittorrent", "radarr", "redis", "sonarr", "tautulli",
    "tdarr", "watchtower"
)

foreach ($Container in $Containers) {
    if (docker ps -a --format '{{.Names}}' | Select-String -Pattern "^$Container$") {
        gum style --foreground 208 "⚠️  Container '$Container' already exists."
        $Choice = gum choose "Delete and Replace" "Skip" "Keep Existing"
        switch ($Choice) {
            "Delete and Replace" {
                gum spin --spinner minidot --title "🗑️  Deleting '$Container'..." -- docker rm -f "$Container"
            }
            "Skip" {
                gum style --foreground 240 "   ⏭️  Skipping check for '$Container'."
            }
            Default {
                gum style --foreground 240 "   🛑 Keeping existing '$Container'."
            }
        }
    }
}

# --- Completion ---

gum style `
    --foreground 212 --border-foreground 212 --border double `
    --align center --width 50 --margin "1 2" --padding "2 4" `
    "Setup Complete!"

gum style --foreground 99 "Next steps:"
Write-Host ""

$CLOUDFLARE_TUNNEL_TOKEN = Read-Host "Enter your Cloudflare Tunnel Token (leave empty if not using Cloudflare Tunnel)"
if ([string]::IsNullOrWhiteSpace($CLOUDFLARE_TUNNEL_TOKEN) -or $CLOUDFLARE_TUNNEL_TOKEN -eq "CHANGE_ME_TOKEN") {
    Write-Host "Warning: CLOUDFLARE_TUNNEL_TOKEN is empty or default. Cloudflare Tunnel may not work." -ForegroundColor Yellow
    $confirm_cf = Read-Host "Are you sure you want to proceed without setting the Cloudflare Tunnel Token? (y/n)"
    if ($confirm_cf -ne "y") {
        $CLOUDFLARE_TUNNEL_TOKEN = Read-Host "Please enter your Cloudflare Tunnel Token"
    }
}

# Update CLOUDFLARE_TUNNEL_TOKEN in .env if provided
if (-not [string]::IsNullOrWhiteSpace($CLOUDFLARE_TUNNEL_TOKEN) -and $CLOUDFLARE_TUNNEL_TOKEN -ne "CHANGE_ME_TOKEN") {
    (Get-Content .env) -replace "CLOUDFLARE_TUNNEL_TOKEN=.*", "CLOUDFLARE_TUNNEL_TOKEN=$CLOUDFLARE_TUNNEL_TOKEN" | Set-Content .env -Encoding utf8
    Write-Host "CLOUDFLARE_TUNNEL_TOKEN updated in .env file." -ForegroundColor Green
}

if (gum confirm "🚀 Do you want to start the media stack now?") {
    gum spin --spinner dot --title "🚀 Starting stack..." -- docker-compose up -d
    gum style --foreground 46 "✅ Stack started! Check status with: docker-compose ps"
}
else {
    Write-Host "OK. Start later with: docker-compose up -d"
}
