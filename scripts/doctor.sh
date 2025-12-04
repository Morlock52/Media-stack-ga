#!/bin/bash
# Media Stack Doctor - Diagnostic Tool

echo "🏥 Running Media Stack Doctor..."
echo "================================="

# 1. Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed!"
    exit 1
else
    echo "✅ Docker is installed"
fi

# 2. Check Docker Compose
if ! docker-compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed!"
else
    echo "✅ Docker Compose is installed"
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
    # Check for default password
    if grep -q "Morlock52$" .env; then
        echo "⚠️  SECURITY WARNING: Default password found in .env!"
    fi
fi

# 5. Check VPN (if running)
if docker ps | grep -q gluetun; then
    echo "🛡️  Gluetun VPN container is running"
else
    echo "ℹ️  Gluetun VPN container is NOT running"
fi

echo "================================="
echo "🏁 Diagnostics complete."
