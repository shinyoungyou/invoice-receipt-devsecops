import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// The backend's Stripe return URLs default to http://localhost:5173, so keep
// this port fixed instead of letting Vite pick another one.
export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Same-origin /api calls in the browser, forwarded to the Express backend.
      '/api': 'http://127.0.0.1:3000'
    }
  }
});
