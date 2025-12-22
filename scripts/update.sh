#!/bin/bash
# One-Command Update Script (safe for multi-stack hosts)
set -euo pipefail

COMPOSE_CMD="docker compose"
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$(basename "$(pwd)")}"

echo "🔄 Starting System Update..."

# 1. Pull latest images
echo "⬇️  Pulling latest images..."
$COMPOSE_CMD pull

# 2. Recreate containers
echo "♻️  Recreating containers..."
$COMPOSE_CMD up -d --remove-orphans

# 3. Cleanup (only dangling images for this project)
echo "🧹 Cleaning up dangling images for project: ${PROJECT_NAME}"
dangling_images="$(
  docker image ls \
    --filter "label=com.docker.compose.project=${PROJECT_NAME}" \
    --filter "dangling=true" \
    -q
)"

if [ -n "$dangling_images" ]; then
  echo "$dangling_images" | xargs docker image rm -f >/dev/null
else
  echo "No dangling project images to remove."
fi

echo "✅ Update Complete!"

if [[ "${RUN_POST_DEPLOY_CHECK:-0}" == "1" ]]; then
  echo ""
  echo "🧪 Running post-deploy sanity checks..."
  bash ./scripts/post_deploy_check.sh
fi
