import { defineConfig } from '@playwright/test';

// End-to-end tests in a real browser against the real API (MongoDB, Channel3, Groq, PayPal sandbox).
// Uses the installed Google Chrome, so no browser download is needed.
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 860 },
    trace: 'retain-on-failure',
  },
  webServer: [
    { command: 'node server.js', cwd: '..', url: 'http://localhost:8080/api/v1/health', reuseExistingServer: true, timeout: 60_000 },
    { command: 'node scripts/serve.mjs 4173', url: 'http://localhost:4173', reuseExistingServer: true },
  ],
});
