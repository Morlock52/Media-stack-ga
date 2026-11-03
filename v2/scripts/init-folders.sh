#!/usr/bin/env bash
# Creates the TRaSH-Guides folder tree and sets permissions (775 dirs / 664 files).
# Usage: sudo ./scripts/init-folders.sh            (reads DATA_ROOT/CONFIG_ROOT/PUID/PGID from .env)
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

mkdir -p "$DATA_ROOT"/torrents/{tv,movies,movies-4k,music,books,cross-seed} \
         "$DATA_ROOT"/usenet/incomplete "$DATA_ROOT"/usenet/complete/{tv,movies,movies-4k,music,books} \
         "$DATA_ROOT"/media/{tv,movies,movies-4k,music,books,audiobooks,podcasts} \
         "$CONFIG_ROOT" "$BACKUP_REPO_PATH"

# Seed Homepage config (docker.yaml points discovery at socket-proxy) — never overwrites
mkdir -p "$CONFIG_ROOT/homepage"
cp -n config/homepage/*.yaml "$CONFIG_ROOT/homepage/" 2>/dev/null || true

# Pre-create app dirs so Docker doesn't create them as root on first start
mkdir -p "$CONFIG_ROOT"/{traefik/letsencrypt,gluetun,qbittorrent,cleanuparr,prowlarr,sonarr,radarr,lidarr,bazarr,seerr,recyclarr,plex,jellyfin/{config,cache},tautulli,audiobookshelf/{config,metadata},wud,backrest/{data,config,cache},loki,alloy,grafana,sabnzbd,cross-seed,radarr-4k,chaptarr,jellystat/{db,backup}}

chown -R "$PUID:$PGID" "$DATA_ROOT" "$CONFIG_ROOT"
chown -R 1000:1000 "$CONFIG_ROOT/seerr"    # Seerr always runs as UID 1000 (node)
chown -R 10001:10001 "$CONFIG_ROOT/loki"   # Loki image runs as 10001
chown -R 472:0 "$CONFIG_ROOT/grafana"      # Grafana image runs as 472
chmod -R a=,a+rX,u+w,g+w "$DATA_ROOT"

# Hardlink sanity check: torrents and media must be the same filesystem
t=$(stat -c %d "$DATA_ROOT/torrents"); m=$(stat -c %d "$DATA_ROOT/media")
if [[ "$t" == "$m" ]]; then echo "✅ torrents + media on one filesystem — hardlinks will work"
else echo "❌ torrents and media are on different filesystems — hardlinks WILL NOT work"; exit 1; fi
