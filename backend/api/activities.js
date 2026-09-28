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
    const tenantCompanyId = getTenantCompanyId(req.user) || body.tenantCompanyId || null;
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
        assignedToId: body.assignedToId,
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
