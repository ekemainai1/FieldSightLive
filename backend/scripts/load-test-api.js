import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 10 },    // Stay at 10 users
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 100 },  // Ramp up to 100 users
    { duration: '1m', target: 100 },   // Stay at 100 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || '';

const headers = {
  'Content-Type': 'application/json',
  ...(API_KEY ? { 'Authorization': `Bearer ${API_KEY}` } : {}),
};

export default function () {
  // Test 1: Health check
  {
    const res = http.get(`${BASE_URL}/health`, { headers });
    const success = check(res, {
      'health check status is 200': (r) => r.status === 200,
    });
    errorRate.add(!success);
    responseTime.add(res.timings.duration);
    sleep(0.1);
  }

  // Test 2: List technicians
  {
    const res = http.get(`${BASE_URL}/api/v1/technicians`, { headers });
    const success = check(res, {
      'list technicians status is 200': (r) => r.status === 200,
    });
    errorRate.add(!success);
    responseTime.add(res.timings.duration);
    sleep(0.1);
  }

  // Test 3: List sites
  {
    const res = http.get(`${BASE_URL}/api/v1/sites`, { headers });
    const success = check(res, {
      'list sites status is 200': (r) => r.status === 200,
    });
    errorRate.add(!success);
    responseTime.add(res.timings.duration);
    sleep(0.1);
  }

  // Test 4: Create inspection
  {
    const payload = JSON.stringify({
      technicianId: 'tech-load-test',
      siteId: 'site-load-test',
    });
    const res = http.post(`${BASE_URL}/api/v1/inspections`, payload, { headers });
    const success = check(res, {
      'create inspection status is 201 or 200': (r) => r.status === 201 || r.status === 200,
    });
    errorRate.add(!success);
    responseTime.add(res.timings.duration);
    sleep(0.1);
  }

  sleep(1);
}
