import { prisma } from '../lib/prisma.js';

const getPathname = (req) => new URL(req.url || '/', 'http://localhost').pathname;

const serializeCrmConfig = (integration) => ({
  ...(integration.config?.credentials || {}),
  platformId: integration.config?.platformId,
  status: integration.config?.status || 'pending',
  updatedAt: integration.updatedAt
});

const findCrmIntegration = (platformId) => prisma.integration.findFirst({
  where: {
    type: 'API_EXTERNAL',
    config: {
      path: ['platformId'],
      equals: platformId
    }
  }
});

export default async function handler(req) {
  const pathname = getPathname(req);
  const crmConfigMatch = pathname.match(/\/crm-configs\/([^/]+)(?:\/test)?\/?$/);

  if (req.method === 'GET' && /\/crm-configs\/?$/.test(pathname)) {
    const integrations = await prisma.integration.findMany({
      where: { type: 'API_EXTERNAL' },
      orderBy: { name: 'asc' }
    });

    const configs = integrations.reduce((acc, integration) => {
      const platformId = integration.config?.platformId;
      if (platformId) acc[platformId] = serializeCrmConfig(integration);
      return acc;
    }, {});

    return Response.json(configs);
  }

  if (req.method === 'PUT' && crmConfigMatch) {
    const platformId = decodeURIComponent(crmConfigMatch[1]);
    const body = await req.json();
    const credentials = body.config || {};
    const status = body.status || 'pending';
    const existing = await findCrmIntegration(platformId);
    const data = {
      name: `CRM ${platformId.toUpperCase()}`,
      type: 'API_EXTERNAL',
      config: {
        platformId,
        credentials,
        status,
        updatedAt: new Date().toISOString()
      },
      isActive: true
    };

    const integration = existing
      ? await prisma.integration.update({ where: { id: existing.id }, data })
      : await prisma.integration.create({ data });

    return Response.json(serializeCrmConfig(integration));
  }

  if (req.method === 'POST' && /\/crm-configs\/[^/]+\/test\/?$/.test(pathname) && crmConfigMatch) {
    const platformId = decodeURIComponent(crmConfigMatch[1]);
    const body = await req.json();
    const credentials = body.config || {};
    const hasCredential = Object.values(credentials).some((value) => String(value || '').trim());
    const status = hasCredential ? 'connected' : 'error';
    const existing = await findCrmIntegration(platformId);

    const savedConfig = existing
      ? await prisma.integration.update({
          where: { id: existing.id },
          data: {
            config: {
              platformId,
              credentials,
              status,
              testedAt: new Date().toISOString()
            },
            isActive: hasCredential
          }
        })
      : await prisma.integration.create({
          data: {
            name: `CRM ${platformId.toUpperCase()}`,
            type: 'API_EXTERNAL',
            config: {
              platformId,
              credentials,
              status,
              testedAt: new Date().toISOString()
            },
            isActive: hasCredential
          }
        });

    if (!hasCredential) {
      return Response.json({
        error: 'Informe ao menos uma credencial antes de testar.',
        details: { savedConfig: serializeCrmConfig(savedConfig) }
      }, { status: 400 });
    }

    return Response.json({
      message: 'Configuração validada e marcada como conectada.',
      savedConfig: serializeCrmConfig(savedConfig)
    });
  }

  if (req.method === 'GET') {
    const { type, active } = req.query || {};
    
    const where = {};
    if (type) where.type = type;
    if (active !== undefined) where.isActive = active === 'true';

    const integrations = await prisma.integration.findMany({
      where,
      include: {
        syncLogs: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      },
      orderBy: { name: 'asc' }
    });
    
    return Response.json(integrations);
  }

  if (req.method === 'POST') {
    const body = await req.json();
    
    const integration = await prisma.integration.create({
      data: {
        name: body.name,
        type: body.type,
        config: body.config || {},
        isActive: body.isActive !== undefined ? body.isActive : true,
        apiKey: body.apiKey,
        webhookUrl: body.webhookUrl
      }
    });
    
    return Response.json(integration);
  }

  if (req.method === 'PUT') {
    const body = await req.json();
    
    const integration = await prisma.integration.update({
      where: { id: body.id },
      data: {
        name: body.name,
        config: body.config,
        isActive: body.isActive,
        apiKey: body.apiKey,
        webhookUrl: body.webhookUrl,
        lastSync: body.lastSync ? new Date(body.lastSync) : undefined
      }
    });
    
    return Response.json(integration);
  }

  if (req.method === 'DELETE') {
    const body = await req.json().catch(() => ({}));
    const id = req.query?.id || body.id;
    
    await prisma.integration.delete({
      where: { id }
    });
    
    return Response.json({ success: true });
  }

  return new Response('Method not allowed', { status: 405 });
}
