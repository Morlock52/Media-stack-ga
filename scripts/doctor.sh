#!/bin/bash
# Media Stack Doctor - Diagnostic Tool

RUN_POST_DEPLOY=false
for arg in "$@"; do
    if [[ "$arg" == "--post-deploy" ]]; then
        RUN_POST_DEPLOY=true
    fi
done

echo "🏥 Running Media Stack Doctor..."
echo "================================="

# 1. Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed!"
    exit 1
else
    echo "✅ Docker is installed"
fi

# 2. Check Docker Compose (plugin or legacy)
if docker compose version &> /dev/null; then
    echo "✅ Docker Compose v2 (docker compose) is installed"
elif command -v docker-compose &> /dev/null; then
    echo "✅ Docker Compose v1 (docker-compose) is installed"
elif docker plugin ls 2>/dev/null | grep -qi compose; then
    echo "ℹ️  Compose plugin detected but command unavailable; add CLI plugin to PATH"
else
    echo "❌ Docker Compose is not installed!"
fi

# 3. Check Ports
echo "🔍 Checking critical ports..."
PORTS=(3000 8080 8989 7878 9696 32400 8096)
for PORT in "${PORTS[@]}"; do
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $PORT is in use (this is good if stack is running, bad if not)"
    else
        echo "ℹ️  Port $PORT is free"
    fi
done

# 4. Check Environment
if [ ! -f .env ]; then
    echo "❌ .env file is missing!"
else
    echo "✅ .env file exists"
    # Check for common unsafe placeholders
    if grep -Eq '^DOMAIN=example\.com(\s*)$' .env; then
        echo "⚠️  SECURITY WARNING: DOMAIN is still set to example.com"
    fi
    if grep -Eq '^(CLOUDFLARE_TUNNEL_TOKEN|REDIS_PASSWORD|PHOTOPRISM_ADMIN_PASSWORD)=changeme(\s*)$' .env; then
        echo "⚠️  SECURITY WARNING: One or more secrets still set to 'changeme'"
    fi
    if grep -q "CHANGE_ME_TOKEN" .env; then
        echo "⚠️  SECURITY WARNING: Placeholder token 'CHANGE_ME_TOKEN' detected"
    fi
fi

# 5. Check VPN (if running)
if docker ps | grep -q gluetun; then
    echo "🛡️  Gluetun VPN container is running"
else
    echo "ℹ️  Gluetun VPN container is NOT running"
fi

echo ""
echo "🔁 Tip: deeper post-deploy checks"
echo "Run: ./scripts/post_deploy_check.sh"
echo "Or:  ./scripts/doctor.sh --post-deploy"

if [[ "$RUN_POST_DEPLOY" == "true" ]]; then
    echo ""
    echo "🧪 Running post-deploy checks..."
    bash ./scripts/post_deploy_check.sh
fi

echo "================================="
echo "🏁 Diagnostics complete."
