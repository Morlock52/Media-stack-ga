#!/bin/bash

# rotate_secrets.sh
# Regenerates security secrets in .env and restarts affected containers.

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}⚠️  WARNING: This will regenerate critical security secrets in your .env file.${NC}"
echo -e "${YELLOW}    - Authelia sessions will be invalidated.${NC}"
echo -e "${YELLOW}    - You may need to re-authenticate.${NC}"
echo -e "${YELLOW}    - Services will be restarted.${NC}"
echo ""
read -p "Are you sure you want to proceed? (y/N): " confirm

if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborted."
    exit 0
fi

if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🔄 Rotating secrets...${NC}"

# Generate new secrets
NEW_AUTHELIA_JWT=$(openssl rand -hex 32)
NEW_AUTHELIA_SESSION=$(openssl rand -hex 32)
NEW_AUTHELIA_STORAGE=$(openssl rand -hex 32)
NEW_POSTGRES_PASS=$(openssl rand -hex 24)

# Update .env
# Use sed to replace lines starting with the key
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS requires empty string for -i
    sed -i '' "s/^AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET=.*/AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET=${NEW_AUTHELIA_JWT}/" .env
    sed -i '' "s/^AUTHELIA_SESSION_SECRET=.*/AUTHELIA_SESSION_SECRET=${NEW_AUTHELIA_SESSION}/" .env
    sed -i '' "s/^AUTHELIA_STORAGE_ENCRYPTION_KEY=.*/AUTHELIA_STORAGE_ENCRYPTION_KEY=${NEW_AUTHELIA_STORAGE}/" .env
    sed -i '' "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${NEW_POSTGRES_PASS}/" .env
else
    # Linux
    sed -i "s/^AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET=.*/AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET=${NEW_AUTHELIA_JWT}/" .env
    sed -i "s/^AUTHELIA_SESSION_SECRET=.*/AUTHELIA_SESSION_SECRET=${NEW_AUTHELIA_SESSION}/" .env
    sed -i "s/^AUTHELIA_STORAGE_ENCRYPTION_KEY=.*/AUTHELIA_STORAGE_ENCRYPTION_KEY=${NEW_AUTHELIA_STORAGE}/" .env
    sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${NEW_POSTGRES_PASS}/" .env
fi

echo -e "${GREEN}✅ Secrets updated in .env${NC}"

echo ""
echo -e "${GREEN}🔄 Restarting affected containers...${NC}"
docker-compose up -d --force-recreate authelia postgres

echo ""
echo -e "${GREEN}✅ Secret rotation complete!${NC}"
