#!/bin/bash
set -e

# Configuration
SERVICE_NAME_CONTROL="media-stack-ga"
SERVICE_NAME_DOCS="media-stack-docs"
REGION="europe-west1" # Start with user's region from logs, or default to us-central1
PROJECT_ID=$(gcloud config get-value project)

if [ -z "$PROJECT_ID" ]; then
    echo "Error: No Google Cloud Project ID found. Please set one with 'gcloud config set project <PROJECT_ID>'."
    exit 1
fi

echo "Deploying to Project: $PROJECT_ID, Region: $REGION"

# Deploy Control Server
echo "=========================================="
echo "Deploying Control Server ($SERVICE_NAME_CONTROL)..."
echo "=========================================="

# Ensure we are in the root directory (check for control-server dir)
if [ ! -d "control-server" ]; then
    echo "Error: control-server directory not found. Please run this script from the root of the repository."
    exit 1
fi

# Copy necessary files to build context
if [ -f "docker-compose.yml" ]; then
    echo "Copying docker-compose.yml to control-server build context..."
    cp docker-compose.yml control-server/docker-compose.yml
fi
if [ -f ".env" ]; then
    echo "Copying .env to control-server build context..."
    cp .env control-server/.env
fi

# Deploy using source from control-server directory
# This fixes the "unable to evaluate symlinks in Dockerfile path" error by pointing to the directory containing the Dockerfile
gcloud run deploy $SERVICE_NAME_CONTROL \
    --source control-server \
    --region $REGION \
    --project $PROJECT_ID \
    --allow-unauthenticated \
    --set-env-vars="PROJECT_ROOT=/app" \
    --port 3001

# Cleanup
rm control-server/docker-compose.yml 2>/dev/null || true
[ -f "control-server/.env" ] && rm control-server/.env 2>/dev/null || true

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "Control Server ($SERVICE_NAME_CONTROL) deployed successfully."
echo "=========================================="
