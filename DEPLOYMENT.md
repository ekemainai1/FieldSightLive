# FieldSightLive Deployment Guide

## Prerequisites

1. **Google Cloud Platform Account**
   - Create a project at https://console.cloud.google.com
   - Enable billing for the project

2. **Google Cloud SDK**
   - Install: `brew install google-cloud-sdk` (macOS) or follow https://cloud.google.com/sdk/docs/install
   - Authenticate: `gcloud auth login`
   - Set project: `gcloud config set project YOUR_PROJECT_ID`

3. **Required APIs**
   ```bash
   gcloud services enable \
     run.googleapis.com \
     cloudbuild.googleapis.com \
     artifactregistry.googleapis.com \
     firestore.googleapis.com \
     storage.googleapis.com \
     pubsub.googleapis.com \
     monitoring.googleapis.com
   ```

4. **Docker** (for local builds)
   - Install: https://docs.docker.com/desktop/

## Quick Start

### 1. Clone and Configure

```bash
# Clone the repository
git clone https://github.com/your-org/fieldsightlive.git
cd fieldsightlive

# Copy environment templates
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

### 2. Configure Environment Variables

Edit `backend/.env`:

```env
# Production settings
DATA_PROVIDER=firestore
STORAGE_PROVIDER=gcs

# Gemini API (get from Google AI Studio)
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-2.5-flash

# GCP Project (required for Gemini Live)
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GEMINI_LIVE_MODEL=gemini-live-2.5-flash-native-audio

# Storage bucket
GCS_BUCKET_NAME=fieldsightlive-prod
```

Edit `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=https://fieldsightlive-backend.run.app
NEXT_PUBLIC_WS_URL=wss://fieldsightlive-backend.run.app

# Firebase config (get from Firebase Console)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### 3. Deploy to Cloud Run

#### Option A: Using the deployment script

```bash
# Make script executable
chmod +x scripts/deploy.sh

# Deploy to Cloud Run
./scripts/deploy.sh deploy --project YOUR_PROJECT_ID --region us-central1
```

#### Option B: Manual deployment

```bash
# Build and deploy backend
gcloud builds submit ./backend \
  --config cloudbuild.yaml \
  --substitutions _REGION=us-central1

# Build and deploy frontend
gcloud builds submit ./frontend \
  --config cloudbuild.yaml \
  --substitutions _REGION=us-central1,_API_URL=https://fieldsightlive-backend.run.app
```

#### Option C: Using gcloud directly

```bash
# Deploy backend
gcloud run deploy fieldsightlive-backend \
  --source ./backend \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10

# Deploy frontend
gcloud run deploy fieldsightlive-frontend \
  --source ./frontend \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10
```

## Infrastructure Setup

### 1. Create Cloud Storage Bucket

```bash
gsutil mb -l us-central1 gs://fieldsightlive-prod
gsutil iam ch allUsers:objectViewer gs://fieldsightlive-prod
```

### 2. Create Firestore Database

```bash
gcloud firestore databases create --location=us-central1
```

### 3. (Optional) Set up PostgreSQL with Cloud SQL

```bash
# Create Cloud SQL instance
gcloud sql instances create fieldsightlive-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database
gcloud sql databases create fieldsightlive --instance=fieldsightlive-db

# Create user
gcloud sql users set-password postgres \
  --instance=fieldsightlive-db \
  --password=your_password
```

## CI/CD Setup

### Cloud Build (Automatic Deployments)

1. **Push to GitHub** triggers automatic Cloud Build
2. **cloudbuild.yaml** builds and deploys both services

### GitHub Actions (Alternative)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - name: Deploy Backend
        run: |
          gcloud run deploy fieldsightlive-backend \
            --source ./backend \
            --region us-central1 \
            --allow-unauthenticated
      
      - name: Deploy Frontend
        run: |
          gcloud run deploy fieldsightlive-frontend \
            --source ./frontend \
            --region us-central1 \
            --allow-unauthenticated
```

## Verification

After deployment, verify:

1. **Backend health**: `https://fieldsightlive-backend.run.app/health`
2. **Frontend**: `https://fieldsightlive-frontend.run.app`
3. **Check Cloud Run logs** in Google Cloud Console

## Troubleshooting

### Container fails to start

- Check logs: `gcloud logs read --service=fieldsightlive-backend`
- Verify environment variables are set correctly
- Ensure GCS bucket exists

### Gemini API errors

- Verify GEMINI_API_KEY is correct
- Check API is enabled in Google Cloud Console
- Ensure GOOGLE_CLOUD_PROJECT is set correctly

### WebSocket connection issues

- Ensure Cloud Run supports WebSocket (enabled by default)
- Check firewall rules
- Verify WS_URL is correct in frontend config

### Out of memory errors

- Increase memory: `gcloud run deploy --memory 1Gi`
- Check for memory leaks in application

## Security Considerations

1. **Authentication**: Set `AUTH_REQUIRED=true` in production
2. **CORS**: Restrict `CORS_ORIGIN` to your domain
3. **Secrets**: Use Secret Manager for sensitive env vars:
   ```bash
   echo $GEMINI_API_KEY | gcloud secrets create gemini-api-key --data-file=-
   ```

4. **IAM**: Use least-privilege service accounts

## Monitoring

- View metrics in Cloud Monitoring Console
- Set up alerts (see `monitoring/README.md`)
- Check Cloud Run dashboards for real-time metrics
