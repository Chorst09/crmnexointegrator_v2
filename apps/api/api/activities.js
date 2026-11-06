import { prisma } from '../lib/prisma.js';

export default async function handler(req) {
  console.log('Handler chamado com método:', req.method);
  
  if (req.method === 'GET') {
    const { userId, status, type } = req.query || {};
    
    const where = {};
    const actorRole = String(req.user?.actualRole || req.user?.role || '').trim().toUpperCase();
    if (actorRole !== 'MASTER' && req.user?.tenantCompanyId) where.tenantCompanyId = req.user.tenantCompanyId;
    if (userId) where.assignedToId = userId;
    if (status) where.status = status;
    if (type) where.type = type;
    if (req.user?.role === 'SELLER') where.assignedToId = req.user.userId;

    const activities = await prisma.activity.findMany({
      where,
      include: {
        company: true,
        opportunity: true,
        assignedTo: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' }
      ]
    });
    
    return Response.json(activities);
  }

  if (req.method === 'POST') {
    try {
      console.log('POST request recebido');
      const body = await req.json();
      console.log('Body:', JSON.stringify(body, null, 2));

      const actorRole = String(req.user?.actualRole || req.user?.role || '').trim().toUpperCase();
      const canAssignToOthers = ['MASTER', 'ADMIN'].includes(actorRole) || req.user?.role !== 'SELLER';
      const assignedToId = canAssignToOthers
        ? (body.assignedToId || req.user?.userId || req.user?.id)
        : (req.user?.userId || req.user?.id);
      if (!assignedToId) return Response.json({ error: 'assignedToId é obrigatório' }, { status: 400 });
      const assignedUser = await prisma.user.findUnique({
        where: { id: assignedToId }, select: { id: true, tenantCompanyId: true }
      });
      if (!assignedUser) return Response.json({ error: 'Responsável não encontrado' }, { status: 400 });
      const actorTenantCompanyId = actorRole === 'MASTER' ? null : (req.user?.tenantCompanyId || null);
      if (actorTenantCompanyId && assignedUser.tenantCompanyId && assignedUser.tenantCompanyId !== actorTenantCompanyId) {
        return Response.json({ error: 'Responsável não pertence a este tenant' }, { status: 403 });
      }
      const tenantCompanyId = actorTenantCompanyId || assignedUser.tenantCompanyId || req.user?.tenantCompanyId || null;
      for (const relation of ['company', 'opportunity']) {
        const relationId = body[`${relation}Id`];
        if (!relationId) continue;
        const record = await prisma[relation].findUnique({ where: { id: relationId }, select: { tenantCompanyId: true } });
        if (!record || (tenantCompanyId && record.tenantCompanyId !== tenantCompanyId)) {
          return Response.json({ error: 'Vínculo não pertence a este tenant' }, { status: 403 });
        }
      }
      // Preparar dados básicos
      const activityData = {
        type: body.type || 'TASK',
        subject: body.subject || 'Atividade sem título',
        description: body.description || '',
        status: 'PENDING',
        priority: body.priority || 'MEDIUM',
        assignedToId,
        tenantCompanyId,
        companyId: body.companyId || null,
        opportunityId: body.opportunityId || null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null
      };

      console.log('Activity data:', JSON.stringify(activityData, null, 2));

      const activity = await prisma.activity.create({
        data: activityData
      });

      console.log('Atividade criada com ID:', activity.id);

      return Response.json({ success: true, activity });
    } catch (error) {
      console.error('Erro completo:', error);
      return Response.json({ 
        error: 'Erro interno do servidor', 
        message: error.message,
        stack: error.stack 
      }, { status: 500 });
    }
  }

  if (req.method === 'PUT') {
    const body = await req.json();

    if (!body.id) return Response.json({ error: 'id é obrigatório' }, { status: 400 });
    if (req.user?.role === 'SELLER') {
      const existing = await prisma.activity.findUnique({
        where: { id: body.id },
        select: { assignedToId: true }
      });
      if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });
      if (existing.assignedToId !== req.user.userId) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const activity = await prisma.activity.update({
      where: { id: body.id },
      data: {
        subject: body.subject,
        description: body.description,
        status: body.status,
        priority: body.priority,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        completedAt: body.status === 'COMPLETED' ? new Date() : null
      },
      include: {
        company: true,
        opportunity: true,
        assignedTo: {
          select: { id: true, name: true, email: true }
        }
      }
    });
    return Response.json(activity);
  }

  return new Response('Method not allowed', { status: 405 });
}
