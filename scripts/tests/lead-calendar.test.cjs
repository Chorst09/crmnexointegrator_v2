const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
process.env.CALENDAR_TOKEN_KEY = 'a'.repeat(64);
for (const prefix of ['LEAD_GOOGLE', 'LEAD_MICROSOFT']) {
  process.env[`${prefix}_CLIENT_ID`] = 'test-client';
  process.env[`${prefix}_CLIENT_SECRET`] = 'test-secret';
  process.env[`${prefix}_REDIRECT_URI`] = `https://crm.test/api/lead-calendar/${prefix === 'LEAD_GOOGLE' ? 'google' : 'microsoft'}/callback`;
}
for (const root of ['apps/api', 'backend']) {
  const { createLeadCalendar, seal, unseal, eventPayload } = require(`../../${root}/lib/lead-calendar.cjs`);
  function fixture(provider = 'google') {
    const mappings = [];
    const states = [];
    const connection = { id: 'connection', provider, userId: 'owner', credentials: seal({ access_token: 'test-token', refresh_token: 'test-refresh', expiresAt: Date.now() + 3600000 }) };
    const owner = { id: 'owner', email: 'owner@example.test', tenantCompanyId: 'tenant', role: 'USER', accessB2B: true, accessB2G: true, tenantCompany: { status: 'ACTIVE' } };
    const contracts = [];
    const company = { id: 'company', name: 'Empresa', accountManagerId: 'owner', tenantCompanyId: 'tenant', status: 'LEAD', leadNextAction: 'Ligar', leadNextActionAt: new Date(Date.now() + 10 * 60000), leadReminderMinutes: 15, updatedAt: new Date() };
    const db = {
      $queryRawUnsafe: async () => [{ locked: true }],
      user: { findUnique: async () => owner },
      contract: { findMany: async ({ where }) => {
        assert.equal(where.AND[1].company.tenantCompanyId, owner.tenantCompanyId);
        assert.equal(where.AND[2].OR[0].company.accountManagerId, owner.id);
        return contracts.filter(item => ['ACTIVE', 'RENEWAL_PENDING'].includes(item.status) && item.expirationAlert && item.endDate);
      } },
      company: { findMany: async ({ where }) => {
        assert.equal(where.tenantCompanyId, owner.tenantCompanyId);
        assert.equal(where.accountManagerId, owner.id);
        return company.status === 'LEAD' && company.leadNextAction ? [company] : [];
      } },
      leadCalendarConnection: {
        findMany: async () => [connection],
        findUnique: async () => null,
        update: async ({ data }) => Object.assign(connection, data),
        upsert: async () => connection
      },
      leadCalendarEvent: {
        findMany: async () => mappings.slice(),
        upsert: async ({ create, update }) => {
          if (mappings[0]) return Object.assign(mappings[0], update);
          const mapping = { id: 'mapping', ...create }; mappings.push(mapping); return mapping;
        },
        update: async ({ data }) => Object.assign(mappings[0], data),
        delete: async () => mappings.splice(0, 1)
      },
      leadCalendarOAuthState: {
        deleteMany: async ({ where }) => {
          if (!where.hash) return { count: 0 };
          const index = states.findIndex((state) => state.hash === where.hash);
          if (index < 0) return { count: 0 }; states.splice(index, 1); return { count: 1 };
        },
        create: async ({ data }) => states.push(data),
        findUnique: async ({ where }) => states.find((state) => state.hash === where.hash)
      }
    };
    const prisma = { ...db, $transaction: async (fn) => fn(db) };
    return { api: createLeadCalendar({ prisma, authenticateToken: (_req, _res, next) => next() }), company, owner, connection, mappings, states, db, contracts };
  }
  test(`${root}: token encryption rejects tampering`, () => {
    const encrypted = seal({ token: 'secret' });
    assert.deepEqual(unseal(encrypted), { token: 'secret' });
    const altered = Buffer.from(encrypted, 'base64'); altered[15] ^= 1;
    assert.throws(() => unseal(altered.toString('base64')));
  });
  test(`${root}: creates once, updates same event, cancels removed action`, async (t) => {
    const f = fixture(); const calls = [];
    t.mock.method(global, 'fetch', async (url, options) => {
      calls.push({ url, ...options }); return new Response(JSON.stringify({ id: 'event' }), { status: 200 });
    });
    await f.api.tick(); await f.api.tick();
    assert.equal(calls.length, 1); assert.equal(calls[0].method, 'POST');
    const payload = JSON.parse(calls[0].body);
    assert.deepEqual(payload.reminders.overrides, [{ method: 'email', minutes: 15 }, { method: 'popup', minutes: 15 }]);
    f.company.leadNextAction = 'Enviar proposta'; await f.api.tick();
    assert.equal(calls[1].method, 'PATCH'); assert.ok(calls[1].url.endsWith('/event'));
    f.company.leadNextAction = null; await f.api.tick();
    assert.equal(calls[2].method, 'DELETE'); assert.equal(f.mappings.length, 0);
  });
  test(`${root}: Master calendar keeps tenant and owner restrictions and synchronizes`, async (t) => {
    const f = fixture(); f.owner.role = 'MASTER';
    t.mock.method(global, 'fetch', async () => new Response(JSON.stringify({ id: 'master-event' }), { status: 200 }));
    await f.api.tick();
    assert.equal(f.mappings.length, 1);
    assert.equal(f.connection.lastError, null);
    assert.ok(f.connection.lastSyncedAt instanceof Date);
  });
  test(`${root}: Microsoft sends scheduled email once and handles empty HTTP 202`, async (t) => {
    const f = fixture('microsoft'); const calls = [];
    t.mock.method(global, 'fetch', async (url, options) => {
      calls.push({ url, ...options });
      return url.endsWith('/sendMail') ? new Response(null, { status: 202 }) : new Response(JSON.stringify({ id: 'event' }), { status: 201 });
    });
    await f.api.tick(); await f.api.tick();
    assert.equal(calls.filter((item) => item.url.endsWith('/sendMail')).length, 1);
    assert.equal(JSON.parse(calls[1].body).message.toRecipients[0].emailAddress.address, 'owner@example.test');
    assert.equal(eventPayload('microsoft', f.company).start.timeZone, 'UTC');
  });
  test(`${root}: contract warning is 30 calendar days before expiry, renews and cancels without affecting leads`, async (t) => {
    const f = fixture(); f.company.status = 'ACTIVE';
    const expiry = new Date(Date.now() + 60 * 86400000); expiry.setUTCHours(0, 0, 0, 0);
    f.contracts.push({ id: 'contract', number: 'C-1', title: 'Serviço', company: { name: 'Empresa' }, status: 'ACTIVE', expirationAlert: true, endDate: expiry, updatedAt: new Date() });
    const calls = [];
    t.mock.method(global, 'fetch', async (url, options) => { calls.push({ url, ...options }); return new Response(JSON.stringify({ id: 'contract-event' })); });
    await f.api.tick(); await f.api.tick();
    assert.equal(calls.length, 1);
    const payload = JSON.parse(calls[0].body);
    const expected = new Date(expiry); expected.setUTCDate(expected.getUTCDate() - 30); expected.setUTCHours(12);
    assert.equal(payload.start.dateTime, expected.toISOString());
    assert.ok(payload.summary.includes('Contrato C-1'));
    assert.deepEqual(payload.reminders.overrides, [{ method: 'email', minutes: 0 }, { method: 'popup', minutes: 0 }]);
    assert.equal(f.mappings[0].companyId, 'contract:contract');
    f.contracts[0].endDate = new Date(expiry.getTime() + 31 * 86400000); await f.api.tick();
    assert.equal(calls[1].method, 'PATCH'); assert.ok(calls[1].url.endsWith('/contract-event'));
    f.contracts[0].status = 'CANCELLED'; await f.api.tick();
    assert.equal(calls[2].method, 'DELETE'); assert.equal(f.mappings.length, 0);
  });
  test(`${root}: Microsoft recovers a contract warning within the 30-day window and sends email once`, async (t) => {
    const f = fixture('microsoft'); f.company.status = 'ACTIVE';
    f.contracts.push({ id: 'contract', number: 'C-2', title: 'Conectividade', company: { name: 'Empresa' }, status: 'ACTIVE', expirationAlert: true, endDate: new Date(Date.now() + 10 * 86400000), updatedAt: new Date() });
    const calls = [];
    t.mock.method(global, 'fetch', async (url, options) => { calls.push({ url, ...options }); return url.endsWith('/sendMail') ? new Response(null, { status: 202 }) : new Response(JSON.stringify({ id: 'contract-event' })); });
    await f.api.tick(); await f.api.tick();
    assert.equal(calls.filter(item => item.url.endsWith('/sendMail')).length, 1);
    assert.match(JSON.parse(calls[1].body).message.subject, /Alerta de vencimento/);
    assert.match(JSON.parse(calls[1].body).message.body.content, /Vencimento:/);
    assert.ok(new Date(JSON.parse(calls[0].body).start.dateTime + 'Z') > new Date());
  });

  test(`${root}: suspended tenant does not access calendar`, async (t) => {
    const f = fixture(); f.owner.tenantCompany.status = 'SUSPENDED';
    t.mock.method(global, 'fetch', () => { throw new Error('must not call provider'); });
    await f.api.tick(); assert.equal(f.mappings.length, 0);
  });
  test(`${root}: failed calendar operation remains pending and retries`, async (t) => {
    const f = fixture(); let attempts = 0;
    t.mock.method(global, 'fetch', async () => { attempts++; return new Response('{}', { status: 401 }); });
    await f.api.tick(); await f.api.tick();
    assert.equal(attempts, 2); assert.equal(f.mappings.length, 0); assert.ok(f.connection.lastError);
  });
  test(`${root}: OAuth uses PKCE, browser-bound single-use state and encrypted verifier`, async (t) => {
    const f = fixture();
    const handler = (path) => f.api.router.stack.find((item) => item.route?.path === path).route.stack[0].handle;
    let result, cookie, status = 200;
    const res = { cookie: (name, value, opts) => { cookie = `${name}=${value}`; assert.equal(opts.httpOnly, true); }, clearCookie: () => {},
      json: (data) => { result = data; }, status(code) { status = code; return this; }, send: () => {}, type() { return this; } };
    await handler('/:provider/connect')({ params: { provider: 'google' }, user: { userId: 'owner' } }, res);
    const url = new URL(result.url);
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(url.searchParams.get('code_challenge'), crypto.createHash('sha256').update(unseal(f.states[0].verifier)).digest('base64url'));
    const req = { params: { provider: 'google' }, query: { state: url.searchParams.get('state'), code: 'test-code' }, headers: {} };
    await handler('/:provider/callback')(req, res); assert.equal(status, 400); assert.equal(f.states.length, 1);
    t.mock.method(global, 'fetch', async () => new Response(JSON.stringify({ access_token: 'token', refresh_token: 'refresh', expires_in: 3600 })));
    req.headers.cookie = cookie; status = 200;
    await handler('/:provider/callback')(req, res); assert.equal(status, 200); assert.equal(f.states.length, 0);
    await handler('/:provider/callback')(req, res); assert.equal(status, 400);
  });
}
