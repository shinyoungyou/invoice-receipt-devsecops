import express from 'express';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const defaultFrontendDist = fileURLToPath(new URL('../frontend/dist/', import.meta.url));

function isApiPath(path) {
  return path === '/api' || path.startsWith('/api/');
}

// Serves the built frontend from the same origin as the API. The browser then
// needs no CORS, and the frontend's same-origin /api request guard keeps working.
// Without a build (local development, tests) the router passes every request on.
export function frontendRoutes(distDir = process.env.FRONTEND_DIST || defaultFrontendDist) {
  const router = express.Router();
  const root = resolve(distDir);
  const indexFile = join(root, 'index.html');
  if (!existsSync(indexFile)) return router;

  router.use(express.static(root, {
    index: false,
    setHeaders(res, filePath) {
      // Vite puts a content hash in every file name under assets/.
      if (filePath.startsWith(join(root, 'assets'))) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));

  // History API routes such as /invoices/:id (including Stripe's return URL)
  // load the app shell. Missing files and API paths still get the JSON 404.
  router.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (isApiPath(req.path) || extname(req.path) !== '') return next();
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(indexFile);
  });
  return router;
}
