import { prisma } from '../lib/prisma.js';
import { getTenantCompanyId, isTenantRecordVisible, forbiddenTenantResponse, tenantScopedWhere } from '../lib/tenantScope.js';

export default async function handler(req) {
  if (req.method === 'GET') {
    const { userId, status, type } = req.query || {};
    
    const where = {
      ...tenantScopedWhere(req.user)
    };
    if (userId) where.assignedToId = userId;
    if (status) where.status = status;
    if (type) where.type = type;

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
    const body = await req.json();
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
    const activity = await prisma.activity.create({
      data: {
        type: body.type,
        subject: body.subject,
        description: body.description,
        status: body.status || 'PENDING',
        priority: body.priority || 'MEDIUM',
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        companyId: body.companyId,
        opportunityId: body.opportunityId,
        assignedToId,
        tenantCompanyId
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

  if (req.method === 'PUT') {
    const body = await req.json();
    const existing = await prisma.activity.findUnique({
      where: { id: body.id },
      select: { tenantCompanyId: true }
    });
    if (!existing) return new Response('Atividade não encontrada', { status: 404 });
    if (!isTenantRecordVisible(req.user, existing)) return forbiddenTenantResponse();

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
