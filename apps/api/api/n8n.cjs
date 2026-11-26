const express = require('express');
const { prisma } = require('../lib/prisma.cjs');

const router = express.Router();

const normalizeBaseUrl = (url) => String(url || '').trim().replace(/\/+$/, '');

async function getN8nConfig() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, name, config, "isActive" FROM "Integration" WHERE type::text = 'API_EXTERNAL' AND config->>'platformId' = 'n8n' LIMIT 1`
  );
  const integration = Array.isArray(rows) ? rows[0] : null;

  const creds = integration?.config?.credentials || {};
  const apiBaseUrl = normalizeBaseUrl(creds.apiBaseUrl || process.env.N8N_API_URL || '');
  const apiKey = String(creds.apiKey || process.env.N8N_API_KEY || '').trim();
  const webhookBaseUrl = normalizeBaseUrl(creds.webhookBaseUrl || (apiBaseUrl ? `${apiBaseUrl}/webhook` : ''));
  const webhookSecret = String(creds.webhookSecret || process.env.N8N_WEBHOOK_SECRET || '').trim();

  return {
    integration,
    configured: Boolean(apiBaseUrl && apiKey),
    apiBaseUrl,
    apiKey,
    webhookBaseUrl,
    webhookSecret,
    status: integration?.config?.status || (apiBaseUrl && apiKey ? 'connected' : 'pending'),
  };
}

async function n8nRequest(config, endpoint, options = {}) {
  if (!config?.apiBaseUrl || !config?.apiKey) {
    const err = new Error('Instância n8n não configurada. Configure URL e API Key em Integrações → n8n.');
    err.statusCode = 400;
    throw err;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${config.apiBaseUrl}/api/v1${endpoint}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': config.apiKey,
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      const err = new Error(data?.message || `n8n retornou HTTP ${response.status}`);
      err.statusCode = response.status;
      err.details = data;
      throw err;
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

const extractWebhookPath = (workflow) => {
  const nodes = Array.isArray(workflow?.nodes) ? workflow.nodes : [];
  const webhookNode = nodes.find((node) => String(node?.type || '').toLowerCase().includes('webhook'));
  const rawPath = webhookNode?.parameters?.path;
  if (!rawPath) return null;
  return String(rawPath).replace(/^\/+/, '');
};

router.get('/status', async (req, res) => {
  try {
    const config = await getN8nConfig();
    if (!config.configured) {
      return res.json({
        configured: false,
        connected: false,
        apiBaseUrl: config.apiBaseUrl || '',
        webhookBaseUrl: config.webhookBaseUrl || '',
        message: 'n8n não configurado',
      });
    }

    try {
      const data = await n8nRequest(config, '/workflows?limit=5');
      const items = Array.isArray(data?.data) ? data.data : [];
      return res.json({
        configured: true,
        connected: true,
        apiBaseUrl: config.apiBaseUrl,
        webhookBaseUrl: config.webhookBaseUrl,
        workflowCount: items.length,
      });
    } catch (connError) {
      return res.json({
        configured: true,
        connected: false,
        apiBaseUrl: config.apiBaseUrl,
        webhookBaseUrl: config.webhookBaseUrl,
        error: connError.message,
      });
    }
  } catch (error) {
    console.error('Erro ao verificar status n8n:', error);
    res.status(500).json({ error: 'Erro interno ao consultar status do n8n' });
  }
});

router.post('/test', async (req, res) => {
  try {
    const saved = await getN8nConfig();
    const apiBaseUrl = normalizeBaseUrl(req.body?.apiBaseUrl || saved.apiBaseUrl);
    const apiKey = String(req.body?.apiKey || saved.apiKey || '').trim();

    if (!apiBaseUrl || !apiKey) {
      return res.status(400).json({ error: 'Informe a URL da instância e a API Key do n8n.' });
    }

    const data = await n8nRequest({ apiBaseUrl, apiKey }, '/workflows?limit=10');
    const workflows = Array.isArray(data?.data) ? data.data : [];

    return res.json({
      connected: true,
      message: `Conectado ao n8n! ${workflows.length} workflow(s) encontrados.`,
      workflowCount: workflows.length,
    });
  } catch (error) {
    res.status(error.statusCode || 502).json({
      connected: false,
      error: `Falha ao conectar no n8n: ${error.message}`,
    });
  }
});

router.get('/workflows', async (req, res) => {
  try {
    const config = await getN8nConfig();
    if (!config.configured) {
      return res.json({ configured: false, workflows: [] });
    }

    const data = await n8nRequest(config, '/workflows?limit=100');
    const rawList = Array.isArray(data?.data) ? data.data : [];
    const workflows = rawList.map((wf) => {
      const webhookPath = extractWebhookPath(wf);
      return {
        id: wf.id,
        name: wf.name,
        active: Boolean(wf.active),
        createdAt: wf.createdAt,
        updatedAt: wf.updatedAt,
        tags: Array.isArray(wf.tags) ? wf.tags.map((t) => t.name || t) : [],
        nodeCount: Array.isArray(wf.nodes) ? wf.nodes.length : 0,
        webhookPath,
        webhookUrl: webhookPath && config.webhookBaseUrl ? `${config.webhookBaseUrl}/${webhookPath}` : null,
        editorUrl: `${config.apiBaseUrl}/workflow/${wf.id}`,
      };
    });

    res.json({
      configured: true,
      apiBaseUrl: config.apiBaseUrl,
      webhookBaseUrl: config.webhookBaseUrl,
      workflows,
    });
  } catch (error) {
    res.status(error.statusCode || 502).json({
      configured: true,
      error: error.message,
      workflows: [],
    });
  }
});

router.post('/workflows/:id/activate', async (req, res) => {
  try {
    const config = await getN8nConfig();
    const data = await n8nRequest(config, `/workflows/${encodeURIComponent(req.params.id)}/activate`, {
      method: 'POST',
    });
    res.json({ ok: true, workflow: data });
  } catch (error) {
    res.status(error.statusCode || 502).json({ error: error.message });
  }
});

router.post('/workflows/:id/deactivate', async (req, res) => {
  try {
    const config = await getN8nConfig();
    const data = await n8nRequest(config, `/workflows/${encodeURIComponent(req.params.id)}/deactivate`, {
      method: 'POST',
    });
    res.json({ ok: true, workflow: data });
  } catch (error) {
    res.status(error.statusCode || 502).json({ error: error.message });
  }
});

router.get('/executions', async (req, res) => {
  try {
    const config = await getN8nConfig();
    if (!config.configured) {
      return res.json({ configured: false, executions: [] });
    }
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const data = await n8nRequest(config, `/executions?limit=${limit}`);
    const list = Array.isArray(data?.data) ? data.data : [];
    const executions = list.map((ex) => ({
      id: ex.id,
      workflowId: ex.workflowId,
      status: ex.status || (ex.finished ? 'success' : 'running'),
      mode: ex.mode || 'webhook',
      startedAt: ex.startedAt,
      stoppedAt: ex.stoppedAt,
    }));
    res.json({ configured: true, executions });
  } catch (error) {
    res.status(error.statusCode || 502).json({ error: error.message, executions: [] });
  }
});

router.post('/trigger', async (req, res) => {
  try {
    const config = await getN8nConfig();
    const { webhookUrl, webhookPath, event, payload } = req.body || {};

    let targetUrl = String(webhookUrl || '').trim();
    if (!targetUrl && webhookPath && config.webhookBaseUrl) {
      targetUrl = `${config.webhookBaseUrl}/${String(webhookPath).replace(/^\/+/, '')}`;
    }

    if (!targetUrl) {
      return res.status(400).json({ error: 'Informe webhookUrl ou webhookPath para disparar no n8n.' });
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-NEXOS-EVENT': String(event || 'MANUAL_TRIGGER'),
      },
      body: JSON.stringify({
        event: event || 'MANUAL_TRIGGER',
        source: 'CRM_NEXOS',
        triggeredBy: req.user?.email || req.user?.id || 'system',
        timestamp: new Date().toISOString(),
        data: payload || {},
      }),
    });

    const text = await response.text();
    let parsed = text;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      // keep raw text
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Webhook n8n retornou HTTP ${response.status}`,
        response: parsed,
      });
    }

    res.json({
      ok: true,
      status: response.status,
      targetUrl,
      response: parsed,
    });
  } catch (error) {
    res.status(502).json({ error: `Erro ao disparar webhook n8n: ${error.message}` });
  }
});

// Endpoint inbound para fluxos do n8n notificarem o CRM
router.post('/webhook-inbound', async (req, res) => {
  try {
    const config = await getN8nConfig();
    const incomingSecret = String(req.headers['x-nexos-webhook-secret'] || '').trim();

    if (config.webhookSecret && incomingSecret !== config.webhookSecret) {
      return res.status(401).json({ error: 'Webhook secret inválido.' });
    }

    const { action, title, message, userId, type } = req.body || {};

    if (action === 'CREATE_NOTIFICATION' && prisma.notification && title) {
      let targetUserId = userId;
      if (!targetUserId) {
        const masterUser = await prisma.user.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        targetUserId = masterUser?.id;
      }

      if (targetUserId) {
        const created = await prisma.notification.create({
          data: {
            userId: targetUserId,
            title: String(title).slice(0, 140),
            message: String(message || 'Notificação gerada via n8n').slice(0, 1000),
            type: String(type || 'INFO'),
          },
        });
        return res.json({ ok: true, notificationId: created.id });
      }
    }

    res.json({ ok: true, receivedAt: new Date().toISOString(), action: action || 'ACK' });
  } catch (error) {
    console.error('Erro no webhook inbound n8n:', error);
    res.status(500).json({ error: 'Erro interno ao processar retorno do n8n' });
  }
});

module.exports = router;
