import app from './app.js';

const portText = process.env.PORT ?? '3000';
const port = Number(portText);
if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}
const host = process.env.HOST ?? '127.0.0.1';
const server = app.listen(port, host, () => {
  console.log(`Invoice API listening on http://${host}:${port}`);
});
server.on('error', (error) => {
  console.error(`Server failed to start: ${error.code ?? 'UNKNOWN'}`);
  process.exitCode = 1;
});

function shutdown() {
  server.close((error) => { process.exitCode = error ? 1 : 0; });
  // Do not wait indefinitely for an active connection on shutdown.
  setTimeout(() => process.exit(1), 10000).unref();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
