import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { frontendRoutes } from '../frontend-static.js';

const INDEX = '<!doctype html><title>Invoices</title>';
let workDir;
let servers = [];

async function start(distDir) {
  const app = express();
  app.use(frontendRoutes(distDir));
  app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND' } }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}

let baseUrl;
before(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'frontend-static-'));
  const dist = join(workDir, 'dist');
  mkdirSync(join(dist, 'assets'), { recursive: true });
  writeFileSync(join(dist, 'index.html'), INDEX);
  writeFileSync(join(dist, 'assets', 'app-abc123.js'), 'console.log(1);');
  writeFileSync(join(workDir, 'secret.txt'), 'outside the build');
  baseUrl = await start(dist);
});

after(async () => {
  await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  rmSync(workDir, { recursive: true, force: true });
});

test('the root path serves the app shell without caching it', async () => {
  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.equal(response.headers.get('cache-control'), 'no-cache');
  assert.equal(await response.text(), INDEX);
});

test('a deep link such as the Stripe return URL serves the app shell', async () => {
  const response = await fetch(`${baseUrl}/invoices/INV-123?checkout=success`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), INDEX);
});

test('hashed assets are served with a long immutable cache', async () => {
  const response = await fetch(`${baseUrl}/assets/app-abc123.js`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /javascript/);
  assert.match(response.headers.get('cache-control'), /immutable/);
});

test('API paths are never answered with the app shell', async () => {
  for (const path of ['/api', '/api/unknown-route']) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 404, path);
    assert.equal((await response.json()).error.code, 'NOT_FOUND');
  }
});

test('a missing file returns 404 instead of the app shell', async () => {
  const response = await fetch(`${baseUrl}/assets/missing.js`);
  assert.equal(response.status, 404);
});

test('non-GET requests to page paths are not answered with the app shell', async () => {
  const response = await fetch(`${baseUrl}/invoices`, { method: 'POST' });
  assert.equal(response.status, 404);
});

test('encoded parent paths cannot read files outside the build', async () => {
  const response = await fetch(`${baseUrl}/%2e%2e/secret.txt`);
  assert.notEqual(response.status, 200);
  assert.doesNotMatch(await response.text(), /outside the build/);
});

test('without a build, every request passes through to the API', async () => {
  const apiOnly = await start(join(workDir, 'no-such-dist'));
  const response = await fetch(`${apiOnly}/`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'NOT_FOUND');
});
