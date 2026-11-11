require('dotenv').config({ quiet: true });

const isProd = process.env.NODE_ENV === 'production';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
  return value;
}

module.exports = {
  isProd,
  isTest: process.env.NODE_ENV === 'test',
  port: Number(process.env.PORT) || 8080,
  mongoUrl: () => required('MONGO_URL'),
  jwtSecret: () => required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // Comma-separated list of front-end origins allowed to call the API.
  // Render passes the website's bare service name, so https:// and .onrender.com are added when missing.
  clientOrigins: (process.env.CLIENT_URL || 'http://localhost:4173')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean)
    .map((s) => (/^https?:\/\//.test(s) ? s : `https://${s.includes('.') ? s : `${s}.onrender.com`}`)),
  // Any OpenAI-compatible chat API. Defaults to Groq's free tier running open-weight models.
  llm: {
    baseUrl: (process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, ''),
    apiKey: process.env.GROQ_API_KEY || process.env.LLM_API_KEY || '',
    // Reading the wish and sorting products use the small model; the buy decision uses the large one.
    fastModel: process.env.LLM_FAST_MODEL || 'openai/gpt-oss-20b',
    smartModel: process.env.LLM_SMART_MODEL || 'openai/gpt-oss-120b',
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS) || 60000,
  },
  // Product search and live prices across many stores.
  channel3: {
    baseUrl: (process.env.CHANNEL3_BASE_URL || 'https://api.trychannel3.com').replace(/\/$/, ''),
    apiKey: process.env.CHANNEL3_API_KEY || '',
    timeoutMs: Number(process.env.CHANNEL3_TIMEOUT_MS) || 20000,
  },
  // PayPal REST API. Sandbox by default: test money only.
  paypal: {
    baseUrl: (process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com').replace(/\/$/, ''),
    clientId: process.env.PAYPAL_CLIENT_ID || '',
    secret: process.env.PAYPAL_CLIENT_SECRET || '',
    currency: 'USD',
  },
  // How often the agent re-checks prices while the server is awake (minutes).
  watchEveryMinutes: Number(process.env.WATCH_EVERY_MINUTES) || 30,
  // "Simulate a price drop" button, so a demo doesn't have to wait days for a real sale.
  demoTools: process.env.DEMO_TOOLS !== 'false',
};
