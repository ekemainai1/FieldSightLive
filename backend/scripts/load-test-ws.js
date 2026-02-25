import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const messageLatency = new Trend('message_latency');

export const options = {
  stages: [
    { duration: '30s', target: 5 },    // Ramp up to 5 concurrent WS connections
    { duration: '1m', target: 5 },     // Stay at 5
    { duration: '30s', target: 20 },   // Ramp up to 20
    { duration: '1m', target: 20 },   // Stay at 20
    { duration: '30s', target: 50 },  // Ramp up to 50
    { duration: '1m', target: 50 },   // Stay at 50
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    errors: ['rate<0.1'],
  },
};

const WS_URL = __ENV.WS_URL || 'ws://localhost:8080';

export default function () {
  const sessionId = `load-test-${__VU}-${__ITER}`;
  
  ws.connect(`${WS_URL}?session=${sessionId}`, {}, function (socket) {
    socket.on('open', function () {
      check(socket, {
        'websocket connected': (s) => s !== null,
      });

      // Send initialization message
      socket.send(JSON.stringify({
        type: 'init',
        sessionId: sessionId,
      }));
    });

    socket.on('message', function (message) {
      const start = Date.now();
      try {
        const data = JSON.parse(message);
        check(data, {
          'has valid message type': (d) => d.type !== undefined,
        });
      } catch (e) {
        // Ignore parse errors for non-JSON messages
      }
      messageLatency.add(Date.now() - start);
    });

    socket.on('error', function (e) {
      errorRate.add(1);
    });

    socket.on('close', function () {
      check(socket, {
        'websocket closed': (s) => s !== null,
      });
    });

    // Send messages periodically
    let count = 0;
    const interval = setInterval(() => {
      if (count < 5) {
        socket.send(JSON.stringify({
          type: 'ping',
          timestamp: Date.now(),
        }));
        count++;
      }
    }, 1000);

    // Close after 10 seconds
    setTimeout(() => {
      clearInterval(interval);
      socket.close();
    }, 10000);
  });

  sleep(11);
}
