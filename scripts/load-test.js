/**
 * Load test for the read endpoints, with autocannon. Start the API first (npm start), then:
 *   node scripts/load-test.js [baseUrl] [seconds] [connections]
 * AI, search and PayPal routes are left out on purpose: they call paid or rate-limited services,
 * and the API already limits how often each user can call them.
 */
const autocannon = require('autocannon');

const BASE = process.argv[2] || 'http://localhost:8080/api/v1';
const SECONDS = Number(process.argv[3]) || 10;
const CONNECTIONS = Number(process.argv[4]) || 50;

function run(title, path, headers = {}) {
  return new Promise((resolve, reject) => {
    autocannon(
      { url: BASE + path, connections: CONNECTIONS, duration: SECONDS, headers: { 'accept-encoding': 'gzip', ...headers } },
      (err, r) => {
        if (err) return reject(err);
        resolve({
          endpoint: title,
          'req/sec (avg)': Math.round(r.requests.average),
          'latency p50 ms': r.latency.p50,
          'latency p99 ms': r.latency.p99,
          'non-2xx': r.non2xx,
          errors: r.errors + r.timeouts,
          requests: r.requests.total,
        });
      },
    );
  });
}

(async () => {
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@waitforit.app', password: 'demo12345' }),
  }).then((r) => r.json());
  if (!login.token) throw new Error('Could not log in as the demo user. Run: node scripts/seed.js');
  const auth = { authorization: `Bearer ${login.token}` };
  const { wishes } = await fetch(`${BASE}/wishes`, { headers: auth }).then((r) => r.json());

  console.log(`${CONNECTIONS} concurrent connections, ${SECONDS}s per endpoint\n`);
  const rows = [];
  rows.push(await run('GET /health', '/health'));
  rows.push(await run('GET /config', '/config'));
  rows.push(await run('GET /wishes (signed in, DB)', '/wishes', auth));
  rows.push(await run('GET /wishes/:id (signed in, DB)', `/wishes/${wishes[0]._id}`, auth));
  rows.push(await run('GET /wishes/stats (signed in, DB)', '/wishes/stats', auth));
  console.table(rows);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
