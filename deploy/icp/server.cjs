'use strict';
const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
// Legacy modules log request bodies and customer payloads. The ICP entrypoint
// exposes only fixed lifecycle/error events; never forward those arguments.
for (const method of ['log', 'info', 'debug']) console[method] = () => {};
for (const method of ['warn', 'error']) console[method] = () => process.stderr.write(`CRM ${method}; inspect health/status, no payload logged\n`);
for (const key of ['DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGIN']) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}
if (process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must have at least 32 characters');
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use((_req, res, next) => {
  if (process.env.CRM_RELEASE) res.setHeader('X-CRM-Release', process.env.CRM_RELEASE);
  next();
});
const web = path.resolve(__dirname, '../../apps/web/dist');
if (!fs.existsSync(path.join(web, 'index.html'))) throw new Error('Missing frontend build');
// Loading failures stop the process: never serve a frontend with a broken API.
app.use(require('../../apps/api/server.cjs'));
app.use(express.static(web, { index: false }));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || path.extname(req.path)) return next();
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(web, 'index.html'));
});
const server = app.listen(3000, '0.0.0.0', () => process.stdout.write('CRM listening on port 3000\n'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
});
