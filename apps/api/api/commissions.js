import { prisma } from '../lib/prisma.js';

export default async function handler(req) {
  if (req.method === 'GET') {
    const { sellerId, status, period } = req.query || {};
    
    const where = {};
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