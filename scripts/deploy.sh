#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

usage() {
  echo "FieldSightLive Deployment Script"
  echo ""
  echo "Usage: $0 [command] [options]"
  echo ""
  echo "Commands:"
  echo "  deploy         Deploy to Cloud Run (requires gcloud CLI)"
  echo "  build-docker   Build Docker images locally"
  echo "  build          Build TypeScript (no Docker)"
  echo "  test           Run tests"
  echo ""
  echo "Options:"
  echo "  --region       GCP region (default: us-central1)"
  echo "  --project      GCP project ID"
  echo "  --data-provider    firestore or postgres (default: firestore)"
  echo "  --storage-provider gcs or minio (default: gcs)"
  echo ""
  echo "Examples:"
  echo "  $0 deploy --project my-project --region us-central1"
  echo "  $0 build-docker --project my-project"
  echo "  $0 build"
  exit 1
}

COMMAND=""
REGION="us-central1"
PROJECT_ID=""
DATA_PROVIDER="firestore"
STORAGE_PROVIDER="gcs"

while [[ $# -gt 0 ]]; do
  case $1 in
    deploy|build-docker|build|test)
      COMMAND="$1"
      shift
      ;;
    --region)
      REGION="$2"
      shift 2
      ;;
    --project)
      PROJECT_ID="$2"
      shift 2
      ;;
    --data-provider)
      DATA_PROVIDER="$2"
      shift 2
      ;;
    --storage-provider)
      STORAGE_PROVIDER="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      usage
      ;;
  esac
done

if [ -z "$COMMAND" ]; then
  usage
fi

if [ "$COMMAND" = "deploy" ] && [ -z "$PROJECT_ID" ]; then
  echo "Error: --project is required for deploy command"
  usage
fi

echo "=== FieldSightLive Deployment ==="
echo "Command: $COMMAND"
echo "Project: ${PROJECT_ID:-local}"
echo "Region: $REGION"
echo "Data Provider: $DATA_PROVIDER"
echo "Storage Provider: $STORAGE_PROVIDER"
echo ""

build_backend() {
  echo "Building backend..."
  cd "$PROJECT_ROOT/backend"
  npm install
  npm run build
  echo "Backend build complete."
}

build_frontend() {
  echo "Building frontend..."
  cd "$PROJECT_ROOT/frontend"
  npm install
  npm run build
  echo "Frontend build complete."
}

run_tests() {
  echo "Running backend tests..."
  cd "$PROJECT_ROOT/backend"
  npm test
  
  echo "Running frontend tests..."
  cd "$PROJECT_ROOT/frontend"
  npm test
  echo "All tests complete."
}

build_docker() {
  if [ -z "$PROJECT_ID" ]; then
    echo "Error: --project is required for build-docker command"
    exit 1
  fi
  
  echo "Building Docker images..."
  
  echo "Building backend image..."
  docker build -t "gcr.io/$PROJECT_ID/fieldsightlive-backend:latest" "$PROJECT_ROOT/backend"
  
  echo "Building frontend image..."
  docker build -t "gcr.io/$PROJECT_ID/fieldsightlive-frontend:latest" "$PROJECT_ROOT/frontend"
  
  echo "Pushing to GCR..."
  docker push "gcr.io/$PROJECT_ID/fieldsightlive-backend:latest"
  docker push "gcr.io/$PROJECT_ID/fieldsightlive-frontend:latest"
  
  echo "Docker build and push complete."
}

deploy() {
  if [ -z "$PROJECT_ID" ]; then
    echo "Error: --project is required for deploy command"
    exit 1
  fi
  
  echo "Configuring gcloud..."
  gcloud config set project "$PROJECT_ID"
  gcloud auth configure-docker
  
  IMAGE_TAG="gcr.io/$PROJECT_ID/fieldsightlive"
  
  echo "Building and deploying backend..."
  gcloud builds submit "$PROJECT_ROOT/backend" \
    --config "$PROJECT_ROOT/cloudbuild.yaml" \
    --substitutions "_REGION=$REGION,_DATA_PROVIDER=$DATA_PROVIDER,_STORAGE_PROVIDER=$STORAGE_PROVIDER" \
    --verbosity=info
  
  echo ""
  echo "=== Deployment Complete ==="
  echo "Backend: https://fieldsightlive-backend-$REGION-$PROJECT_ID.run.app"
  echo "Frontend: https://fieldsightlive-frontend-$REGION-$PROJECT_ID.run.app"
}

case $COMMAND in
  build)
    build_backend
    build_frontend
    ;;
  test)
    run_tests
    ;;
  build-docker)
    build_docker
    ;;
  deploy)
    deploy
    ;;
esac

echo "Done!"
