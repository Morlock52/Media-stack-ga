#!/bin/bash
set -e

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed."
    exit 1
fi

# Usage help
if [ "$1" == "--help" ]; then
    echo "Usage: ./scripts/deploy-to-cloudrun.sh [PROJECT_ID] [REGION]"
    echo "Default Region: us-central1"
    exit 0
fi

# Configuration
PROJECT_ID=${1:-$(gcloud config get-value project)}
REGION=${2:-"us-central1"}
SERVICE_NAME_CONTROL="media-stack-control"
SERVICE_NAME_DOCS="media-stack-docs"

if [ -z "$PROJECT_ID" ]; then
    echo "Error: No Google Cloud Project ID found."
    echo "Please provide it as an argument: ./scripts/deploy-to-cloudrun.sh <PROJECT_ID>"
    echo "Or set it via gcloud: gcloud config set project <PROJECT_ID>"
    exit 1
fi

echo "Deploying to Project: $PROJECT_ID, Region: $REGION"
read -p "Press Enter to continue..."

# Deploy Control Server
echo ""
echo "=========================================="
echo "Deploying Control Server..."
echo "=========================================="

# Ensure we are in the root directory
if [ ! -f "docker-compose.yml" ]; then
    echo "Error: Please run this script from the root of the repository."
    exit 1
fi

# Copy docker-compose.yml to control-server context temporarily so it's included in the build
echo "Copying docker-compose.yml to control-server build context..."
cp docker-compose.yml control-server/docker-compose.yml

# We also check for .env and copy it if it exists, though heavily discouraged for production secrets
if [ -f ".env" ]; then 
    echo "Copying .env to control-server build context (Use Secret Manager for production)..."
    cp .env control-server/.env
fi

# Deploy using Cloud Run source deploy (Cloud Build)
# We set PROJECT_ROOT=/app because inside the container, we are in /app and the files are at /app.
gcloud run deploy $SERVICE_NAME_CONTROL \
    --source control-server \
    --region $REGION \
    --project $PROJECT_ID \
    --allow-unauthenticated \
    --set-env-vars="PROJECT_ROOT=/app" \
    --port 3001

# Cleanup
rm control-server/docker-compose.yml
[ -f "control-server/.env" ] && rm control-server/.env

# Deploy Docs Site
echo ""
echo "=========================================="
echo "Deploying Docs Site..."
echo "=========================================="

gcloud run deploy $SERVICE_NAME_DOCS \
    --source docs-site \
    --region $REGION \
    --project $PROJECT_ID \
    --allow-unauthenticated \
    --port 80

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "Control Server URL: $(gcloud run services describe $SERVICE_NAME_CONTROL --region $REGION --project $PROJECT_ID --format 'value(status.url)')"
echo "Docs Site URL: $(gcloud run services describe $SERVICE_NAME_DOCS --region $REGION --project $PROJECT_ID --format 'value(status.url)')"
echo "=========================================="
