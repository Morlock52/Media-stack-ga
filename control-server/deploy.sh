#!/bin/bash

# Exit on error
set -e

echo "Deploying Control Server to Google Cloud Run..."

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed."
    exit 1
fi

# Set default region if not set
REGION=${REGION:-us-central1}
SERVICE_NAME="control-server"

echo "Using region: $REGION"
echo "Service name: $SERVICE_NAME"

# Deploy command
# --source . builds the container using the local Dockerfile
# --allow-unauthenticated makes the service publicly accessible (remove if strict security needed)
gcloud run deploy $SERVICE_NAME \
    --source . \
    --region $REGION \
    --allow-unauthenticated \
    --port 8080

echo "Deployment complete!"
