#!/bin/bash
# Factory Reset Utility

echo "⚠️  FACTORY RESET UTILITY ⚠️"
echo "This will PERMANENTLY DELETE configuration data for selected services."
echo "Use with caution!"
echo ""

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
            docker-compose stop $SERVICE
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
