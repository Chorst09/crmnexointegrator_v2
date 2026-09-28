import { prisma } from '../lib/prisma.js';

export default async function handler(req) {
  if (req.method === 'GET') {
    const { sellerId, period, regionId } = req.query || {};
    
    const where = {};
    if (sellerId) where.sellerId = sellerId;
    if (regionId) where.seller = { regionId };
    
    // Filtro por período
    if (period && period !== 'all') {
      const now = new Date();
      let startDate, endDate;
      
      switch (period) {
        case 'current_month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'current_quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
          break;
        case 'current_year':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now.getFullYear(), 11, 31);
          break;
      }
      
      if (startDate && endDate) {
        where.startDate = { lte: endDate };
        where.endDate = { gte: startDate };
      }
    }

    const targets = await prisma.salesTarget.findMany({
      where,
      include: {
        seller: {
          select: { 
            id: true, 
            name: true, 
            email: true,
            region: {
              select: { id: true, name: true, code: true }
            }
          }
        }
      },
      orderBy: { startDate: 'desc' }
    });

    // Calcular realizado vs meta
    const targetsWithProgress = await Promise.all(
      targets.map(async (target) => {
        // Buscar vendas realizadas no período
        const sales = await prisma.opportunity.findMany({
          where: {
            ownerId: target.sellerId,
            stage: 'WON',
            actualCloseDate: {
              gte: target.startDate,
              lte: target.endDate
            }
          },
          select: { value: true }
        });

        const realized = sales.reduce((sum, sale) => sum + sale.value, 0);
        const progress = target.targetValue > 0 ? (realized / target.targetValue) * 100 : 0;

        return {
          ...target,
          realized,
          progress: Math.round(progress * 100) / 100,
          remaining: Math.max(0, target.targetValue - realized),
          status: progress >= 100 ? 'ACHIEVED' : progress >= 80 ? 'ON_TRACK' : progress >= 50 ? 'AT_RISK' : 'BEHIND'
        };
      })
    );
    
    return Response.json(targetsWithProgress);
  }

  if (req.method === 'POST') {
    const body = await req.json();
    
    const target = await prisma.salesTarget.create({
      data: {
        sellerId: body.sellerId,
        targetValue: body.targetValue,
        targetDeals: body.targetDeals || 0,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        description: body.description,
        bonusPercentage: body.bonusPercentage || 0
      },
      include: {
        seller: {
          select: { 
            id: true, 
            name: true, 
            email: true,
            region: {
              select: { id: true, name: true, code: true }
            }
          }
        }
      }
    });
    
    return Response.json(target);
  }

  if (req.method === 'PUT') {
    const body = await req.json();
    const { id } = body;
    
    const target = await prisma.salesTarget.update({
      where: { id },
      data: {
        targetValue: body.targetValue,
        targetDeals: body.targetDeals,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        description: body.description,
        bonusPercentage: body.bonusPercentage
      },
      include: {
        seller: {
          select: { 
            id: true, 
            name: true, 
            email: true,
            region: {
              select: { id: true, name: true, code: true }
            }
          }
        }
      }
    });
    
    return Response.json(target);
  }

  if (req.method === 'DELETE') {
    const body = await req.json();
    const { id } = body;
    
    await prisma.salesTarget.delete({
      where: { id }
    });
    
    return Response.json({ message: 'Meta excluída com sucesso' });
  }

  return Response.json({ error: 'Método não permitido' }, { status: 405 });
}