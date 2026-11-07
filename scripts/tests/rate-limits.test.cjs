const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const backendRequire = createRequire(require('node:path').resolve(__dirname, '../../backend/server.js'));
const express = backendRequire('express');
const request = backendRequire('supertest');
const jwt = backendRequire('jsonwebtoken');
const { createRateLimits } = require('../../backend/lib/rate-limits.cjs');

test('CRM quotas isolate users and login while retaining rate-limit protection', async () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'rate-limit-test-secret';
  try {
    const app = express();
    const { apiLimiter, authLimiter } = createRateLimits({ apiMax: 2, authMax: 2 });
    app.use('/api', apiLimiter);
    app.use('/api/auth/login', authLimiter);
    app.post('/api/auth/login', (req, res) => res.sendStatus(req.headers['x-test-success'] ? 200 : 401));
    app.use((req, res) => res.sendStatus(200));
    const call = (path, token) => {
      const req = request(app).get(path);
      return token ? req.auth(token, { type: 'bearer' }) : req;
    };
    for (let i = 0; i < 2; i++) assert.equal((await call('/api/settings')).status, 200);
    const limited = await call('/api/activities');
    assert.equal(limited.status, 429);
    assert.ok(limited.headers['retry-after']);
    assert.equal((await call('/api/health')).status, 200);
    assert.equal((await request(app).options('/api/settings')).status, 200);
    for (let i = 0; i < 3; i++) {
      assert.equal((await request(app).post('/api/auth/login').set('x-test-success', '1')).status, 200);
    }
    for (let i = 0; i < 2; i++) assert.equal((await request(app).post('/api/auth/login')).status, 401);
    assert.equal((await request(app).post('/api/auth/login')).status, 429);
    const token = id => jwt.sign({ userId: id }, process.env.JWT_SECRET);
    for (let i = 0; i < 2; i++) assert.equal((await call('/api/settings', token('alice'))).status, 200);
    assert.equal((await call('/api/activities', token('alice'))).status, 429);
    assert.equal((await call('/api/activities', token('bob'))).status, 200);
    const forged = jwt.sign({ userId: 'mallory' }, 'wrong-secret');
    assert.equal((await call('/api/settings', forged)).status, 429);
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});
