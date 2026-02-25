# FieldSightLive Monitoring Configuration

## Cloud Monitoring Alerts

### Backend Service Alerts

```yaml
# alerts/backend-alerts.yaml
displayName: FieldSightLive Backend
conditions:
  - displayName: Backend Container CPU Utilization
    conditionThreshold:
      filter: resource.type = "cloud_run_revision" AND resource.labels.service_name = "fieldsightlive-backend"
      comparison: COMPARISON_GT
      thresholdValue: 80
      duration: 300s
      aggregations:
        - alignmentPeriod: 60s
          perSeriesAligner: ALIGN_MEAN

  - displayName: Backend Container Memory Utilization
    conditionThreshold:
      filter: resource.type = "cloud_run_revision" AND resource.labels.service_name = "fieldsightlive-backend"
      comparison: COMPARISON_GT
      thresholdValue: 85
      duration: 300s
      aggregations:
        - alignmentPeriod: 60s
          perSeriesAligner: ALIGN_MEAN

  - displayName: Backend Request Latency
    conditionThreshold:
      filter: resource.type = "cloud_run_revision" AND resource.labels.service_name = "fieldsightlive-backend"
      comparison: COMPARISON_GT
      thresholdValue: 2000
      duration: 300s
      aggregations:
        - alignmentPeriod: 60s
          perSeriesAligner: ALIGN_PERCENTILE_99

  - displayName: Backend Request Error Rate
    conditionThreshold:
      filter: resource.type = "cloud_run_revision" AND resource.labels.service_name = "fieldsightlive-backend"
      comparison: COMPARISON_GT
      thresholdValue: 5
      duration: 300s
      aggregations:
        - alignmentPeriod: 60s
          perSeriesAligner: ALIGN_RATE

  - displayName: Backend Container Startup Time
    conditionThreshold:
      filter: resource.type = "cloud_run_revision" AND resource.labels.service_name = "fieldsightlive-backend"
      comparison: COMPARISON_GT
      thresholdValue: 60000
      duration: 60s
      aggregations:
        - alignmentPeriod: 60s
          perSeriesAligner: ALIGN_MAX

### Frontend Service Alerts

  - displayName: Frontend Container CPU Utilization
    conditionThreshold:
      filter: resource.type = "cloud_run_revision" AND resource.labels.service_name = "fieldsightlive-frontend"
      comparison: COMPARISON_GT
      thresholdValue: 80
      duration: 300s
      aggregations:
        - alignmentPeriod: 60s
          perSeriesAligner: ALIGN_MEAN

  - displayName: Frontend Request Latency
    conditionThreshold:
      filter: resource.type = "cloud_run_revision" AND resource.labels.service_name = "fieldsightlive-frontend"
      comparison: COMPARISON_GT
      thresholdValue: 3000
      duration: 300s
      aggregations:
        - alignmentPeriod: 60s
          perSeriesAligner: ALIGN_PERCENTILE_99

### WebSocket Alerts

  - displayName: WebSocket Connection Errors
    conditionThreshold:
      filter: resource.type = "cloud_run_revision" AND resource.labels.service_name = "fieldsightlive-backend"
      comparison: COMPARISON_GT
      thresholdValue: 10
      duration: 300s
      aggregations:
        - alignmentPeriod: 60s
          perSeriesAligner: ALIGN_RATE

notificationChannels:
  - displayName: Email Notifications
    type: email
    labels:
      emailAddress: admin@example.com

  - displayName: Slack Alerts
    type: slack
    labels:
      channel: "#alerts"

policies:
  - displayName: FieldSightLive High CPU Usage
    conditions:
      - displayName: Backend Container CPU Utilization
    notificationChannels:
      - Email Notifications
      - Slack Alerts
    combiner: OR

  - displayName: FieldSightLive High Error Rate
    conditions:
      - displayName: Backend Request Error Rate
    notificationChannels:
      - Email Notifications
      - Slack Alerts
    combiner: OR

  - displayName: FieldSightLive High Latency
    conditions:
      - displayName: Backend Request Latency
    notificationChannels:
      - Email Notifications
    combiner: OR
```

## Dashboard Configuration

```yaml
# dashboards/fieldsightlive-dashboard.yaml
displayName: FieldSightLive Operations Dashboard
gridLayout:
  - widgets:
      - title: Backend Requests
        scoreCard:
          metric: run.googleapis.com/container/request_count
          resource: cloud_run_revision

      - title: Backend Latency (p99)
        timeSeries:
          metric: run.googleapis.com/container/request_latencies
          reducer: REDUCE_PERCENTILE_99

      - title: Backend CPU Usage
        timeSeries:
          metric: run.googleapis.com/container/cpu/throttled_limit_duration

      - title: Backend Memory Usage
        timeSeries:
          metric: run.googleapis.com/container/memory/limit_usage

      - title: Frontend Requests
        scoreCard:
          metric: run.googleapis.com/container/request_count
          resource: cloud_run_revision

      - title: WebSocket Connections
        timeSeries:
          metric: run.googleapis.com/container/connections
```

## Setup Instructions

1. **Enable Cloud Monitoring API**:
   ```bash
   gcloud services enable monitoring.googleapis.com
   ```

2. **Create alerting policies**:
   ```bash
   gcloud alpha monitoring policies create --policy-from-file=alerts/backend-alerts.yaml
   ```

3. **Create dashboard**:
   ```bash
   gcloud monitoring dashboards create --dashboard-from-file=dashboards/fieldsightlive-dashboard.yaml
   ```

4. **Configure notifications**:
   - Go to Cloud Monitoring > Notifications
   - Add email and/or Slack webhook channels

## Key Metrics to Monitor

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Request Count | Total requests served | > 10k/min |
| Request Latency (p99) | 99th percentile latency | > 2s |
| Error Rate | Percentage of 5xx errors | > 5% |
| CPU Utilization | Container CPU usage | > 80% |
| Memory Utilization | Container memory usage | > 85% |
| Cold Starts | New container starts | > 10/min |
| WebSocket Connections | Active WebSocket connections | < 10 (if expected > 100) |
