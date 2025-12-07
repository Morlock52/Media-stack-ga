#!/bin/bash
# scripts/backup.sh
# Automated backup for Media Stack configs
# Usage: ./scripts/backup.sh [destination_dir]

set -e

# Default destination
DEST_DIR=${1:-"./backups"}
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${DEST_DIR}/mediastack_backup_${DATE}.tar.gz"

echo "📦 Starting backup to ${BACKUP_FILE}..."

# Ensure destination exists
mkdir -p "${DEST_DIR}"

# Files/Dirs to backup
# 1. .env (Secrets)
# 2. config/ (App data)
# 3. apps-registry.json (App metadata)
# Exclude heavy cache dirs if possible (e.g. Plex Transcode/Cache)

tar -czf "${BACKUP_FILE}" \
    --exclude="config/plex/Library/Application Support/Plex Media Server/Cache" \
    --exclude="config/jellyfin/cache" \
    --exclude="config/*/logs" \
    .env \
    config \
    docs-site/src/data/apps-registry.json

echo "✅ Backup complete: ${BACKUP_FILE}"
echo "Size: $(du -h "${BACKUP_FILE}" | cut -f1)"

# Rotation: Keep last 7 backups
echo "🧹 Cleaning up old backups (>7 days)..."
find "${DEST_DIR}" -name "mediastack_backup_*.tar.gz" -mtime +7 -delete
