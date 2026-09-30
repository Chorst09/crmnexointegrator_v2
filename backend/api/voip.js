import { prisma } from '../lib/prisma.js';
import { getTenantCompanyId, tenantScopedWhere } from '../lib/tenantScope.js';

// Simulação de integração com sistemas VoIP
export default async function handler(req) {
  if (req.method === 'POST') {
    const { action, ...data } = await req.json();

    try {
      switch (action) {
        case 'make_call':
          return await makeCall(data, req.user);
        case 'call_webhook':
          return await handleCallWebhook(data, req.user);
        case 'get_recordings':
          return await getRecordings(data);
        default:
          return Response.json({ error: 'Invalid action' }, { status: 400 });
      }
    } catch (error) {
      console.error('VoIP API Error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  if (req.method === 'GET') {
    const { type, userId, date } = req.query || {};
    
    if (type === 'call_history') {
      return await getCallHistory({ userId, date });
    }
    
    if (type === 'statistics') {
      return await getCallStatistics({ userId, date });
    }
    
    return Response.json({ error: 'Invalid type' }, { status: 400 });
  }

  return new Response('Method not allowed', { status: 405 });
}

async function makeCall({ fromNumber, toNumber, companyId, opportunityId, userId }, user = {}) {
  const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Simular início da chamada
  await prisma.integrationLog.create({
    data: {
      integrationId: await getVoipIntegrationId(),
      action: 'make_call',
      status: 'SUCCESS',
      message: `Chamada iniciada de ${fromNumber} para ${toNumber}`,
      data: {
        callId,
        fromNumber,
        toNumber,
        companyId,
        opportunityId,
        userId,
        status: 'initiated'
      }
    }
  });

  // Criar atividade de ligação
  if (companyId) {
    const company = await prisma.company.findFirst({
      where: { id: companyId, ...tenantScopedWhere(user) },
      select: { id: true }
    });
    if (!company) return Response.json({ error: 'Empresa não pertence a este tenant' }, { status: 403 });

    await prisma.activity.create({
      data: {
        type: 'CALL',
        subject: `Ligação para ${toNumber}`,
        description: `Chamada VoIP iniciada para ${toNumber}`,
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        companyId,
        opportunityId,
        assignedToId: userId || user?.userId || user?.id,
        tenantCompanyId: getTenantCompanyId(user)
      }
    });
  }

  return Response.json({
    success: true,
    callId,
    status: 'initiated',
    fromNumber,
    toNumber
  });
}

async function handleCallWebhook(data, user = {}) {
  const { callId, status, duration, recording_url, hangup_cause } = data;
  
  // Atualizar log da integração
  await prisma.integrationLog.create({
    data: {
      integrationId: await getVoipIntegrationId(),
      action: 'call_webhook',
      status: 'INFO',
      message: `Webhook de chamada recebido: ${status}`,
      data: {
        callId,
        status,
        duration,
        recording_url,
        hangup_cause
      }
    }
  });

  // Se a chamada terminou, atualizar a atividade
  if (status === 'completed' || status === 'failed') {
    // Buscar atividade relacionada (simplificado)
    const recentActivity = await prisma.activity.findFirst({
      where: {
        ...tenantScopedWhere(user),
        type: 'CALL',
        status: 'IN_PROGRESS',
        createdAt: {
          gte: new Date(Date.now() - 3600000) // Última hora
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (recentActivity) {
      await prisma.activity.update({
        where: { id: recentActivity.id },
        data: {
          status: status === 'completed' ? 'COMPLETED' : 'CANCELLED',
          description: `${recentActivity.description}\nDuração: ${duration}s\nMotivo: ${hangup_cause || 'Normal'}`,
          completedAt: status === 'completed' ? new Date() : null
        }
      });
    }
  }

  return Response.json({ success: true });
}

async function getRecordings({ callId, userId, date }) {
  // Simular gravações disponíveis
  const recordings = [
    {
      id: 'rec_1',
      callId: callId || 'call_123',
      duration: 180,
      url: 'https://recordings.voip.com/rec_1.mp3',
      createdAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: 'rec_2',
      callId: 'call_456',
      duration: 240,
      url: 'https://recordings.voip.com/rec_2.mp3',
      createdAt: new Date(Date.now() - 172800000).toISOString()
    }
  ];

  await prisma.integrationLog.create({
    data: {
      integrationId: await getVoipIntegrationId(),
      action: 'get_recordings',
      status: 'SUCCESS',
      message: `${recordings.length} gravações encontradas`,
      data: { callId, userId, date, count: recordings.length }
    }
  });

  return Response.json(recordings);
}

async function getCallHistory({ userId, date }) {
  // Simular histórico de chamadas
  const calls = [
    {
      id: 'call_1',
      fromNumber: '+5511999999999',
      toNumber: '+5511888888888',
      duration: 180,
      status: 'completed',
      direction: 'outbound',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      recording: true
    },
    {
      id: 'call_2',
      fromNumber: '+5511777777777',
      toNumber: '+5511999999999',
      duration: 0,
      status: 'no-answer',
      direction: 'inbound',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      recording: false
    },
    {
      id: 'call_3',
      fromNumber: '+5511999999999',
      toNumber: '+5511666666666',
      duration: 320,
      status: 'completed',
      direction: 'outbound',
      createdAt: new Date(Date.now() - 10800000).toISOString(),
      recording: true
    }
  ];

  return Response.json(calls);
}

async function getCallStatistics({ userId, date }) {
  // Simular estatísticas de chamadas
  const stats = {
    totalCalls: 45,
    completedCalls: 32,
    missedCalls: 8,
    failedCalls: 5,
    totalDuration: 14400, // em segundos
    averageDuration: 320,
    answerRate: 71.1, // %
    callsToday: 12,
    callsThisWeek: 45,
    callsThisMonth: 180,
    topNumbers: [
      { number: '+5511888888888', calls: 8, duration: 1440 },
      { number: '+5511777777777', calls: 6, duration: 1080 },
      { number: '+5511666666666', calls: 5, duration: 900 }
    ]
  };

  return Response.json(stats);
}

async function getVoipIntegrationId() {
  const integration = await prisma.integration.findFirst({
    where: { type: 'VOIP' }
  });
  return integration?.id || 'default';
}
