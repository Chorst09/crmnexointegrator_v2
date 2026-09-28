import { prisma } from '../lib/prisma.js';
import { getTenantCompanyId } from '../lib/tenantScope.js';

const mergeRelationWhere = (where = {}, relationName, relationWhere = {}) => ({
  ...where,
  [relationName]: {
    ...(
      where[relationName] && typeof where[relationName] === 'object' && !Array.isArray(where[relationName])
        ? where[relationName]
        : {}
    ),
    ...relationWhere
  }
});

const withCommissionTenant = (user = {}, where = {}) => {
  const tenantCompanyId = getTenantCompanyId(user);
  return tenantCompanyId ? mergeRelationWhere(where, 'opportunity', { tenantCompanyId }) : where;
};

const canUseTenantOpportunity = async (user = {}, opportunityId) => {
  const tenantCompanyId = getTenantCompanyId(user);
  if (!tenantCompanyId || !opportunityId) return true;
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: { tenantCompanyId: true }
  });
  return String(opportunity?.tenantCompanyId || '') === tenantCompanyId;
};

export default async function handler(req) {
  if (req.method === 'GET') {
    const { sellerId, status, period } = req.query || {};
    
    let where = {};
    if (sellerId) where.sellerId = sellerId;
    if (status) where.status = status;
    
    // Filtro por período
    if (period && period !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (period) {
        case 'current_month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'last_month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          where.createdAt = {
            gte: startDate,
            lt: new Date(now.getFullYear(), now.getMonth(), 1)
          };
          break;
        case 'current_quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          break;
        case 'current_year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
      }
      
      if (period !== 'last_month' && startDate) {
        where.createdAt = { gte: startDate };
      }
    }

    where = withCommissionTenant(req.user, where);

    const commissions = await prisma.commission.findMany({
      where,
      include: {
        seller: {
          select: { id: true, name: true, email: true }
        },
        opportunity: {
          include: {
            company: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return Response.json(commissions);
  }

  if (req.method === 'POST') {
    const body = await req.json();
    
    // Se não foi fornecido opportunityId, criar comissão manual
    const commissionData = {
      sellerId: body.sellerId,
      percentage: body.percentage,
      amount: body.amount,
      status: body.status || 'PENDING'
    };
    
    if (body.opportunityId) {
      if (!(await canUseTenantOpportunity(req.user, body.opportunityId))) {
        return Response.json({ error: 'Oportunidade não pertence a este tenant' }, { status: 403 });
      }
      commissionData.opportunityId = body.opportunityId;
    }
    
    const commission = await prisma.commission.create({
      data: commissionData,
      include: {
        seller: {
          select: { id: true, name: true, email: true }
        },
        opportunity: {
          include: {
            company: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });
    
    return Response.json(commission);
  }

  if (req.method === 'PUT') {
    const body = await req.json();
    const existing = await prisma.commission.findUnique({
      where: { id: body.id },
      include: { opportunity: { select: { tenantCompanyId: true } } }
    });

    if (!existing) {
      return Response.json({ error: 'Comissão não encontrada' }, { status: 404 });
    }

    const tenantCompanyId = getTenantCompanyId(req.user);
    if (tenantCompanyId && String(existing.opportunity?.tenantCompanyId || '') !== tenantCompanyId) {
      return Response.json({ error: 'Acesso negado' }, { status: 403 });
    }
    
    const updateData = {};
    if (body.status) updateData.status = body.status;
    if (body.percentage !== undefined) updateData.percentage = body.percentage;
    if (body.amount !== undefined) updateData.amount = body.amount;
    if (body.paidAt) updateData.paidAt = new Date(body.paidAt);
    
    const commission = await prisma.commission.update({
      where: { id: body.id },
      data: updateData,
      include: {
        seller: {
          select: { id: true, name: true, email: true }
        },
        opportunity: {
          include: {
            company: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });
    
    return Response.json(commission);
  }

  return new Response('Method not allowed', { status: 405 });
}
