import type { NextConfig } from 'next';

// Built as a static site (plain HTML/JS in out/), so it can be hosted free and opens
// instantly even while the API server is still waking up.
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // The repo root has its own package-lock.json (the API); this app lives in client/.
  turbopack: { root: __dirname },
};

export default nextConfig;
