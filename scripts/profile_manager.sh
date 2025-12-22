#!/bin/bash
# Profile Manager - Switch between Media Stack Profiles

PROFILES_DIR="./profiles"
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"

echo "🔄 Media Stack Profile Manager"
echo "------------------------------"

# Ensure profiles dir exists (mocking for now if not)
mkdir -p $PROFILES_DIR

echo "Available Profiles:"
echo "1. Standard (Current)"
echo "2. Low Power (Raspberry Pi)"
echo "3. Expert (Full Stack)"

read -p "Select profile to activate (1-3): " choice

case $choice in
    1)
        echo "✅ Keeping Standard Profile"
        ;;
    2)
        echo "⚡ Switching to Low Power Profile..."
        # Logic to copy/link docker-compose.lowpower.yml
        # ln -sf profiles/docker-compose.lowpower.yml docker-compose.yml
        echo "ℹ️  (Mock) Profile switched. Run './update.sh' to apply."
        ;;
    3)
        echo "🧠 Switching to Expert Profile..."
        # Logic to copy/link docker-compose.expert.yml
        # ln -sf profiles/docker-compose.expert.yml docker-compose.yml
        echo "ℹ️  (Mock) Profile switched. Run './update.sh' to apply."
        ;;
    *)
        echo "❌ Invalid selection"
        exit 1
        ;;
esac
