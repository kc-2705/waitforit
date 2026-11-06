import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // During development, API calls go to the Express server.
    proxy: { '/api': 'http://localhost:8080' },
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
