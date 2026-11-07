const { expirationSchedule, contractScope } = require('./contract-service.cjs');
const crypto = require('node:crypto');
const express = require('express');

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
function encryptionKey() {
  const raw = process.env.CALENDAR_TOKEN_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(raw)) throw new Error('Configure CALENDAR_TOKEN_KEY (64 caracteres hexadecimais).');
  return Buffer.from(raw, 'hex');
}
function seal(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  return Buffer.concat([iv, cipher.update(JSON.stringify(value)), cipher.final(), cipher.getAuthTag()]).toString('base64');
}
function unseal(value) {
  const raw = Buffer.from(value, 'base64');
  const cipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), raw.subarray(0, 12));
  cipher.setAuthTag(raw.subarray(-16));
  return JSON.parse(Buffer.concat([cipher.update(raw.subarray(12, -16)), cipher.final()]).toString());
}
function config(provider) {
  if (!['google', 'microsoft'].includes(provider)) throw new Error('Provedor inválido.');
  const prefix = provider === 'google' ? 'LEAD_GOOGLE' : 'LEAD_MICROSOFT';
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  const redirectUri = process.env[`${prefix}_REDIRECT_URI`];
  if (!clientId || !clientSecret || !redirectUri) throw new Error('Integração ainda não configurada no servidor.');
  encryptionKey();
  const google = provider === 'google';
  return { clientId, clientSecret, redirectUri,
    authorize: google ? 'https://accounts.google.com/o/oauth2/v2/auth' : 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    token: google ? 'https://oauth2.googleapis.com/token' : 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: google ? 'https://www.googleapis.com/auth/calendar.events' : 'offline_access Calendars.ReadWrite Mail.Send'
  };
}
async function request(url, options = {}, allowMissing = false) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
  if (allowMissing && [404, 410].includes(response.status)) return null;
  if (!response.ok) {
    const error = new Error(`Provedor retornou HTTP ${response.status}. Reconecte a agenda se a autorização expirou.`);
    error.status = response.status;
    throw error;
  }
  if ([202, 204].includes(response.status)) return {};
  return response.json();
}
async function tokenRequest(provider, values) {
  const c = config(provider);
  return request(c.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, ...values }) });
}
async function accessToken(db, connection) {
  let tokens = unseal(connection.credentials);
  if (tokens.expiresAt < Date.now() + 60000) {
    const refreshed = await tokenRequest(connection.provider, { grant_type: 'refresh_token', refresh_token: tokens.refresh_token });
    tokens = { ...tokens, ...refreshed, expiresAt: Date.now() + refreshed.expires_in * 1000 };
    await db.leadCalendarConnection.update({ where: { id: connection.id }, data: { credentials: seal(tokens) } });
  }
  return tokens.access_token;
}
function eventPayload(provider, company) {
  const start = new Date(company.leadNextActionAt).toISOString();
  const end = new Date(new Date(start).getTime() + 30 * 60000).toISOString();
  const description = company._calendarDescription || `Lead: ${company.name}\nPróxima ação: ${company.leadNextAction}`;
  if (provider === 'google') return {
    summary: `${company.name}: ${company.leadNextAction}`.slice(0, 200), description,
    start: { dateTime: start }, end: { dateTime: end },
    reminders: { useDefault: false, overrides: [
      { method: 'email', minutes: company.leadReminderMinutes },
      { method: 'popup', minutes: company.leadReminderMinutes }
    ] }
  };
  return { subject: `${company.name}: ${company.leadNextAction}`.slice(0, 200),
    body: { contentType: 'text', content: description },
    start: { dateTime: start.replace('Z', ''), timeZone: 'UTC' },
    end: { dateTime: end.replace('Z', ''), timeZone: 'UTC' },
    isReminderOn: true, reminderMinutesBeforeStart: company.leadReminderMinutes };
}
const baseUrl = (provider) => provider === 'google'
  ? 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
  : 'https://graph.microsoft.com/v1.0/me/events';
const headers = (token) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
const versionOf = (company) => hash(JSON.stringify([company.name, company.leadNextAction, company.leadNextActionAt, company.leadReminderMinutes]));

function createLeadCalendar({ prisma, authenticateToken }) {
  const router = express.Router();
  const userId = (req) => req.user.userId || req.user.id;
  let running = false;
  // One PostgreSQL advisory transaction lock coordinates all server processes.
  async function tick() {
    if (running || !process.env.CALENDAR_TOKEN_KEY) return;
    running = true;
    try {
      await prisma.$transaction(async (db) => {
        const [lock] = await db.$queryRawUnsafe('SELECT pg_try_advisory_xact_lock(182735611) AS locked');
        if (!lock?.locked) return;
        const connections = await db.leadCalendarConnection.findMany();
        for (const connection of connections) {
          const owner = await db.user.findUnique({ where: { id: connection.userId }, select: { id: true, email: true, tenantCompanyId: true, role: true, accessB2B: true, accessB2G: true, tenantCompany: { select: { status: true } } } });
          // Respect tenant suspension; never use one tenant's credentials for another tenant's lead.
          if (!owner || (owner.tenantCompany && owner.tenantCompany.status !== 'ACTIVE')) continue;
          const companies = await db.company.findMany({ where: { accountManagerId: owner.id, tenantCompanyId: owner.tenantCompanyId, status: 'LEAD', leadNextActionAt: { not: null }, leadNextAction: { not: null } } });
          const contracts = await db.contract.findMany({
            where: { AND: [
              contractScope(owner),
              { company: { tenantCompanyId: owner.tenantCompanyId } },
              { OR: [{ company: { accountManagerId: owner.id } }, { company: { accountManagerId: null }, opportunity: { ownerId: owner.id } }] },
              { status: { in: ['ACTIVE', 'RENEWAL_PENDING'] }, expirationAlert: true, endDate: { not: null } }
            ] }, include: { company: { select: { name: true } } }
          });
          for (const contract of contracts) {
            const schedule = expirationSchedule(contract);
            if (!schedule) continue;
            const endDate = new Date(contract.endDate).toISOString().slice(0, 10).split('-').reverse().join('/');
            companies.push({
              id: `contract:${contract.id}`, name: `Contrato ${contract.number} — ${contract.company.name}`,
              leadNextAction: `Revisar renovação: ${contract.title} (vencimento ${endDate})`,
              leadNextActionAt: schedule.alertAt, leadReminderMinutes: 0, updatedAt: contract.updatedAt,
              _calendarKind: 'contract', _calendarExpiresAt: schedule.expiresAt,
              _calendarDescription: `Empresa: ${contract.company.name}\nContrato: ${contract.number} — ${contract.title}\nVencimento: ${endDate}\nAviso de renovação com 30 dias de antecedência. Confira as condições e contate o cliente.`
            });
          }
          const mappings = await db.leadCalendarEvent.findMany({ where: { userId: owner.id, provider: connection.provider } });
          let connectionError = null;
          let token;
          const getToken = async () => token || (token = await accessToken(db, connection));
          for (const mapping of mappings) {
            if (companies.some((company) => company.id === mapping.companyId)) continue;
            try {
              await request(`${baseUrl(connection.provider)}/${encodeURIComponent(mapping.eventId)}`, { method: 'DELETE', headers: headers(await getToken()) }, true);
              await db.leadCalendarEvent.delete({ where: { id: mapping.id } });
            } catch { connectionError = 'Cancelamento pendente. Verifique a conexão com a agenda.'; }
          }
          for (const company of companies) {
            let mapping = mappings.find((item) => item.companyId === company.id);
            const version = versionOf(company);
            try {
              // Do not recreate old appointments that were never synchronized.
              if (!mapping && !company._calendarKind && new Date(company.leadNextActionAt) < new Date()) continue;
              if (!mapping || mapping.version !== version) {
                const eventCompany = company._calendarKind === 'contract' && new Date(company.leadNextActionAt) < new Date()
                  ? { ...company, leadNextActionAt: new Date(Date.now() + 120000) } : company;
                const payload = eventPayload(connection.provider, eventCompany);
                const identity = hash(`${company.id}:${owner.id}:${connection.provider}:${new Date(company.updatedAt).toISOString()}`);
                let result;
                if (mapping) {
                  result = await request(`${baseUrl(connection.provider)}/${encodeURIComponent(mapping.eventId)}`, { method: 'PATCH', headers: headers(await getToken()), body: JSON.stringify(payload) }, true);
                  if (!result) throw new Error('Compromisso removido na agenda. Remova a próxima ação e salve novamente para reagendar.');
                } else {
                  if (connection.provider === 'google') payload.id = identity;
                  else payload.transactionId = identity;
                  try {
                    result = await request(baseUrl(connection.provider), { method: 'POST', headers: headers(await getToken()), body: JSON.stringify(payload) });
                  } catch (error) {
                    if (connection.provider !== 'google' || error.status !== 409) throw error;
                    result = await request(`${baseUrl(connection.provider)}/${identity}`, { method: 'PATCH', headers: headers(await getToken()), body: JSON.stringify(eventPayload(connection.provider, eventCompany)) });
                  }
                }
                mapping = await db.leadCalendarEvent.upsert({
                  where: { companyId_userId_provider: { companyId: company.id, userId: owner.id, provider: connection.provider } },
                  create: { companyId: company.id, userId: owner.id, provider: connection.provider, eventId: result.id, version },
                  update: { eventId: result.id, version }
                });
              }
              // Microsoft Graph's reminder is a calendar notification. Send a separate email at the chosen time.
              const due = new Date(company.leadNextActionAt).getTime() - company.leadReminderMinutes * 60000;
              if (connection.provider === 'microsoft' && owner.email && mapping.reminderVersion !== version && Date.now() >= due && Date.now() <= (company._calendarExpiresAt ? company._calendarExpiresAt.getTime() : new Date(company.leadNextActionAt).getTime() + 3600000)) {
                await request('https://graph.microsoft.com/v1.0/me/sendMail', { method: 'POST', headers: headers(await getToken()), body: JSON.stringify({ message: {
                  subject: `${company._calendarKind === 'contract' ? 'Alerta de vencimento' : 'Lembrete de lead'}: ${company.name}`,
                  body: { contentType: 'Text', content: `${company._calendarDescription || company.leadNextAction}\nData do aviso: ${new Date(company.leadNextActionAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Brasília)` },
                  toRecipients: [{ emailAddress: { address: owner.email } }]
                }, saveToSentItems: true }) });
                await db.leadCalendarEvent.update({ where: { id: mapping.id }, data: { reminderVersion: version } });
              }
            } catch { connectionError = 'Sincronização ou lembrete pendente. Confira as permissões e reconecte a agenda se necessário.'; }
          }
          await db.leadCalendarConnection.update({ where: { id: connection.id }, data: {
            lastError: connectionError, ...(connectionError ? {} : { lastSyncedAt: new Date() })
          } });
        }
      }, { maxWait: 1000, timeout: 55000 });
    } catch { console.warn('Agenda LEAD: verifique migrações e configuração; sincronização pendente.'); }
    finally { running = false; }
  }
  router.get('/:provider/callback', async (req, res) => {
    try {
      const provider = req.params.provider;
      config(provider);
      const state = typeof req.query.state === 'string' ? req.query.state : '';
      const cookie = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`lead_calendar_${provider}=`))?.split('=')[1];
      if (!state || hash(state) !== cookie) return res.status(400).send('Autorização inválida. Inicie a conexão novamente no CRM.');
      const record = await prisma.leadCalendarOAuthState.findUnique({ where: { hash: hash(state) } });
      if (!record || record.provider !== provider || record.expiresAt < new Date()) return res.status(400).send('Autorização expirada.');
      const consumed = await prisma.leadCalendarOAuthState.deleteMany({ where: { hash: record.hash } });
      if (!consumed.count || req.query.error || typeof req.query.code !== 'string') return res.status(400).send('Conexão não autorizada.');
      const c = config(provider);
      const tokens = await tokenRequest(provider, { grant_type: 'authorization_code', code: req.query.code, redirect_uri: c.redirectUri, code_verifier: unseal(record.verifier) });
      if (!tokens.access_token || !tokens.refresh_token) throw new Error('É necessário conceder acesso offline à agenda.');
      const existing = await prisma.leadCalendarConnection.findUnique({ where: { userId_provider: { userId: record.userId, provider } } });
      if (existing) return res.status(409).send('Uma agenda já está conectada. Desconecte-a no CRM antes de conectar outra conta.');
      await prisma.leadCalendarConnection.upsert({ where: { userId_provider: { userId: record.userId, provider } },
        create: { userId: record.userId, provider, credentials: seal({ ...tokens, expiresAt: Date.now() + tokens.expires_in * 1000 }) },
        update: { credentials: seal({ ...tokens, expiresAt: Date.now() + tokens.expires_in * 1000 }) } });
      res.clearCookie(`lead_calendar_${provider}`, { path: '/api/lead-calendar', sameSite: 'lax', secure: c.redirectUri.startsWith('https:') });
      res.type('html').send('<!doctype html><meta charset="utf-8"><p>Agenda conectada. Você pode fechar esta janela e voltar ao CRM.</p>');
    } catch { res.status(400).send('Não foi possível conectar. Confira a configuração e tente novamente no CRM.'); }
  });
  router.use(authenticateToken);
  router.get('/status', async (req, res) => {
    try {
      const connections = await prisma.leadCalendarConnection.findMany({ where: { userId: userId(req) }, select: { provider: true, lastError: true, lastSyncedAt: true } });
      const providers = ['google', 'microsoft'].map((provider) => {
        let configured = true; try { config(provider); } catch { configured = false; }
        const connection = connections.find((item) => item.provider === provider);
        return { provider, configured, connected: Boolean(connection), lastError: connection?.lastError, lastSyncedAt: connection?.lastSyncedAt };
      });
      res.json({ providers });
    } catch { res.status(503).json({ error: 'Agenda indisponível. Verifique a migração do banco.' }); }
  });
  router.post('/:provider/connect', async (req, res) => {
    try {
      const provider = req.params.provider;
      const c = config(provider);
      const state = crypto.randomBytes(32).toString('base64url');
      const verifier = crypto.randomBytes(48).toString('base64url');
      await prisma.leadCalendarOAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      await prisma.leadCalendarOAuthState.create({ data: { hash: hash(state), userId: userId(req), provider, verifier: seal(verifier), expiresAt: new Date(Date.now() + 600000) } });
      res.cookie(`lead_calendar_${provider}`, hash(state), { httpOnly: true, sameSite: 'lax', secure: c.redirectUri.startsWith('https:'), path: '/api/lead-calendar', maxAge: 600000 });
      const url = new URL(c.authorize);
      url.search = new URLSearchParams({ client_id: c.clientId, redirect_uri: c.redirectUri, response_type: 'code', scope: c.scope, state,
        code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
        ...(provider === 'google' ? { access_type: 'offline', prompt: 'consent' } : { prompt: 'select_account' }) }).toString();
      res.json({ url: url.toString() });
    } catch (error) { res.status(400).json({ error: error.message }); }
  });
  router.delete('/:provider/disconnect', async (req, res) => {
    try {
      const provider = req.params.provider;
      if (!['google', 'microsoft'].includes(provider)) return res.status(400).json({ error: 'Provedor inválido.' });
      await prisma.$transaction(async (db) => {
        const [lock] = await db.$queryRawUnsafe('SELECT pg_try_advisory_xact_lock(182735611) AS locked');
        if (!lock?.locked) throw new Error('Sincronização em andamento. Tente novamente em um minuto.');
        const connection = await db.leadCalendarConnection.findUnique({ where: { userId_provider: { userId: userId(req), provider } } });
        if (!connection) return;
        if (req.query.force !== 'true') {
          const token = await accessToken(db, connection);
          const mappings = await db.leadCalendarEvent.findMany({ where: { userId: userId(req), provider } });
          for (const mapping of mappings) await request(`${baseUrl(provider)}/${encodeURIComponent(mapping.eventId)}`, { method: 'DELETE', headers: headers(token) }, true);
        }
        await db.leadCalendarEvent.deleteMany({ where: { userId: userId(req), provider } });
        await db.leadCalendarConnection.delete({ where: { id: connection.id } });
      }, { maxWait: 1000, timeout: 55000 });
      res.json({ success: true });
    } catch { res.status(502).json({ error: 'Não foi possível remover os eventos da agenda. Tente novamente.' }); }
  });
  function start() {
    const timer = setInterval(() => void tick(), 60000);
    timer.unref();
    const initial = setTimeout(() => void tick(), 5000);
    initial.unref();
  }
  return { router, start, tick };
}
module.exports = { createLeadCalendar, eventPayload, versionOf, seal, unseal };
