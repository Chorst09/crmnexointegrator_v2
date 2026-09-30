import { prisma } from '../lib/prisma.js';
import { getTenantCompanyId, tenantScopedWhere } from '../lib/tenantScope.js';

// Simulação de integração WhatsApp Business API
export default async function handler(req) {
  if (req.method === 'POST') {
    const { action, ...data } = await req.json();

    try {
      switch (action) {
        case 'send_message':
          return await sendMessage(data, req.user);
        case 'send_template':
          return await sendTemplate(data, req.user);
        case 'webhook':
          return await handleWebhook(data);
        default:
          return Response.json({ error: 'Invalid action' }, { status: 400 });
      }
    } catch (error) {
      console.error('WhatsApp API Error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}

async function sendMessage({ phone, message, companyId, opportunityId }, user = {}) {
  // Simulação de envio via WhatsApp Business API
  const messageId = `wa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Log da integração
  await prisma.integrationLog.create({
    data: {
      integrationId: await getWhatsAppIntegrationId(),
      action: 'send_message',
      status: 'SUCCESS',
      message: `Mensagem enviada para ${phone}`,
      data: {
        phone,
        message: message.substring(0, 100) + '...',
        messageId,
        companyId,
        opportunityId
      }
    }
  });

  // Criar atividade no CRM
  if (companyId) {
    const company = await prisma.company.findFirst({
      where: { id: companyId, ...tenantScopedWhere(user) },
      select: { id: true }
    });
    if (!company) return Response.json({ error: 'Empresa não pertence a este tenant' }, { status: 403 });

    await prisma.activity.create({
      data: {
        type: 'EMAIL', // Usando EMAIL como proxy para WhatsApp
        subject: `WhatsApp enviado para ${phone}`,
        description: message,
        status: 'COMPLETED',
        priority: 'MEDIUM',
        completedAt: new Date(),
        companyId,
        opportunityId,
        assignedToId: await getDefaultUserId(user),
        tenantCompanyId: getTenantCompanyId(user)
      }
    });
  }

  return Response.json({
    success: true,
    messageId,
    status: 'sent',
    timestamp: new Date().toISOString()
  });
}

async function sendTemplate({ phone, templateName, parameters, companyId }, user = {}) {
  if (companyId) {
    const company = await prisma.company.findFirst({
      where: { id: companyId, ...tenantScopedWhere(user) },
      select: { id: true }
    });
    if (!company) return Response.json({ error: 'Empresa não pertence a este tenant' }, { status: 403 });
  }

  // Simulação de envio de template
  const messageId = `wa_tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await prisma.integrationLog.create({
    data: {
      integrationId: await getWhatsAppIntegrationId(),
      action: 'send_template',
      status: 'SUCCESS',
      message: `Template ${templateName} enviado para ${phone}`,
      data: {
        phone,
        templateName,
        parameters,
        messageId,
        companyId
      }
    }
  });

  return Response.json({
    success: true,
    messageId,
    templateName,
    status: 'sent'
  });
}

async function handleWebhook(data) {
  // Processar webhook do WhatsApp (mensagens recebidas, status de entrega, etc.)
  await prisma.integrationLog.create({
    data: {
      integrationId: await getWhatsAppIntegrationId(),
      action: 'webhook_received',
      status: 'INFO',
      message: 'Webhook processado',
      data
    }
  });

  return Response.json({ success: true });
}

async function getWhatsAppIntegrationId() {
  const integration = await prisma.integration.findFirst({
    where: { type: 'WHATSAPP' }
  });
  return integration?.id || 'default';
}

async function getDefaultUserId(requestUser = {}) {
  const user = await prisma.user.findFirst({
    where: { role: 'ADMIN', ...tenantScopedWhere(requestUser) }
  });
  return user?.id || requestUser?.userId || requestUser?.id || 'default';
}
