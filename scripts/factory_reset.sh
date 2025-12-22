#!/bin/bash
# Factory Reset Utility

echo "⚠️  FACTORY RESET UTILITY ⚠️"
echo "This will PERMANENTLY DELETE configuration data for selected services."
echo "Use with caution!"
echo ""

# Docker Compose v2 ships as `docker compose`; fall back to legacy `docker-compose`
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    echo "❌ Docker Compose is not installed (need docker compose or docker-compose)."
    exit 1
fi

# List services with config
CONFIG_DIR="./config"
SERVICES=$(ls $CONFIG_DIR)

echo "Available services to reset:"
PS3="Select a service to reset (or 'Quit'): "

select SERVICE in $SERVICES "Quit"; do
    if [[ $SERVICE == "Quit" ]]; then
        break
    elif [[ -n $SERVICE ]]; then
        read -p "🔴 Are you sure you want to DELETE ALL DATA for $SERVICE? (y/N): " confirm
        if [[ $confirm == "y" || $confirm == "Y" ]]; then
            echo "Stopping container..."
            $COMPOSE_CMD stop $SERVICE
            echo "Deleting data..."
            rm -rf "$CONFIG_DIR/$SERVICE"/*
            echo "✅ Reset complete for $SERVICE"
        else
            echo "❌ Operation cancelled."
        fi
    else
        echo "Invalid selection."
    fi
done
