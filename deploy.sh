#!/bin/bash
set -e

# Deployment Helper Script

PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"

echo "🚀 Starting Deployment for Project: $PROJECT_ID"

if [ -z "$PROJECT_ID" ]; then
  echo "❌ No Google Cloud Project ID found. Please run 'gcloud config set project <PROJECT_ID>' first."
  exit 1
fi

echo "📦 Submitting build to Cloud Build..."
gcloud builds submit --config=cloudbuild.yaml .

echo "✅ Build & Deploy submitted!"
echo "   Monitor status at: https://console.cloud.google.com/cloud-build/builds?project=$PROJECT_ID"
