#!/bin/bash

# Function to list listening ports
list_ports() {
    echo "Listening ports:"
    lsof -i -P -n | grep LISTEN
}

# Function to kill process on a specific port
kill_port() {
    local port=$1
    if [ -z "$port" ]; then
        echo "Usage: $0 --kill <port>"
        return 1
    fi
    
    local pid=$(lsof -t -i:$port)
    if [ -n "$pid" ]; then
        echo "Killing process on port $port (PID: $pid)..."
        kill -9 $pid
        echo "Process killed."
    else
        echo "No process found on port $port."
    fi
}

# Function to kill all node processes
kill_node() {
    echo "Killing all Node.js processes..."
    pkill node
    echo "Done."
}

# Main logic
case "$1" in
    --list)
        list_ports
        ;;
    --kill)
        kill_port "$2"
        ;;
    --kill-node)
        kill_node
        ;;
    *)
        echo "Usage: $0 {--list|--kill <port>|--kill-node}"
        echo "  --list       List all listening ports"
        echo "  --kill <port> Kill process on specific port"
        echo "  --kill-node  Kill all Node.js processes"
        exit 1
        ;;
esac
