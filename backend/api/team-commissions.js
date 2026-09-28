import { prisma } from '../lib/prisma.js';
import { getTenantCompanyId } from '../lib/tenantScope.js';

export default async function handler(req) {
  if (req.method === 'GET') {
    const { regionId, period, type } = req.query || {};
    const tenantCompanyId = getTenantCompanyId(req.user);
    
    // Filtro por período
    let dateFilter = {};
    if (period && period !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (period) {
        case 'current_month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'current_quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          break;
        case 'current_year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
      }
      
      if (startDate) {
        dateFilter = { createdAt: { gte: startDate } };
      }
    }

    const commissionWhere = {
      ...dateFilter,
      status: { not: 'CANCELLED' },
      opportunity: {
        stage: 'WON',
        ...(tenantCompanyId ? { tenantCompanyId } : {})
      }
    };

    if (type === 'by_region') {
      // Comissões agrupadas por região
      const regions = await prisma.region.findMany({
        where: regionId ? { id: regionId } : { isActive: true },
        include: {
          users: {
            where: tenantCompanyId ? { tenantCompanyId } : undefined,
            include: {
              commissions: {
                where: commissionWhere,
                include: {
                  opportunity: {
                    include: {
                      company: { select: { name: true } }
                    }
                  }
                }
              }
            }
          }
        }
      });

      const regionCommissions = regions.map(region => {
        const sellers = region.users;
        const totalCommissions = sellers.reduce((total, seller) => {
          return total + seller.commissions.reduce((sum, comm) => sum + comm.amount, 0);
        }, 0);
        
        const paidCommissions = sellers.reduce((total, seller) => {
          return total + seller.commissions
            .filter(comm => comm.status === 'PAID')
            .reduce((sum, comm) => sum + comm.amount, 0);
        }, 0);

        const pendingCommissions = sellers.reduce((total, seller) => {
          return total + seller.commissions
            .filter(comm => comm.status === 'PENDING')
            .reduce((sum, comm) => sum + comm.amount, 0);
        }, 0);

        return {
          region: {
            id: region.id,
            name: region.name,
            code: region.code
          },
          sellersCount: sellers.length,
          totalCommissions,
          paidCommissions,
          pendingCommissions,
          averagePerSeller: sellers.length > 0 ? totalCommissions / sellers.length : 0,
          sellers: sellers.map(seller => ({
            id: seller.id,
            name: seller.name,
            email: seller.email,
            totalCommissions: seller.commissions.reduce((sum, comm) => sum + comm.amount, 0),
            commissionsCount: seller.commissions.length,
            paidAmount: seller.commissions
              .filter(comm => comm.status === 'PAID')
              .reduce((sum, comm) => sum + comm.amount, 0)
          }))
        };
      });

      return Response.json(regionCommissions);
    }

    if (type === 'by_seller') {
      const sellers = await prisma.user.findMany({
        where: {
          role: 'SELLER',
          ...(tenantCompanyId ? { tenantCompanyId } : {}),
          ...(regionId ? { regionId } : {})
        },
        select: {
          id: true,
          name: true,
          email: true,
          region: {
            select: { id: true, name: true, code: true }
          },
          commissions: {
            where: commissionWhere,
            include: {
              opportunity: {
                select: {
                  id: true,
                  title: true,
                  value: true,
                  projectType: true,
                  projectMonths: true,
                  actualCloseDate: true,
                  company: { select: { id: true, name: true } }
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { name: 'asc' }
      });

      return Response.json(sellers.map((seller) => {
        const commissions = seller.commissions || [];
        const totalCommissions = commissions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const paidCommissions = commissions
          .filter((item) => item.status === 'PAID')
          .reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const pendingCommissions = commissions
          .filter((item) => item.status === 'PENDING')
          .reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const approvedCommissions = commissions
          .filter((item) => item.status === 'APPROVED')
          .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        return {
          seller: {
            id: seller.id,
            name: seller.name,
            email: seller.email,
            region: seller.region
          },
          totalCommissions,
          paidCommissions,
          pendingCommissions,
          approvedCommissions,
          commissionsCount: commissions.length,
          opportunitiesWon: commissions.length,
          averageCommission: commissions.length > 0 ? totalCommissions / commissions.length : 0,
          commissions
        };
      }));
    }

    if (type === 'team_bonuses') {
      if (tenantCompanyId) {
        return Response.json([]);
      }
      // Bonificações por equipe baseadas em metas coletivas
      const teamBonuses = await prisma.teamBonus.findMany({
        where: {
          ...dateFilter,
          ...(regionId && { regionId })
        },
        include: {
          region: {
            select: { id: true, name: true, code: true }
          },
          distributions: {
            include: {
              seller: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return Response.json(teamBonuses);
    }

    // Relatório geral de comissões por equipe
    const teamReport = await prisma.commission.groupBy({
      by: ['sellerId'],
      where: {
        ...commissionWhere,
        seller: {
          ...(regionId ? { regionId } : {}),
          ...(tenantCompanyId ? { tenantCompanyId } : {})
        }
      },
      _sum: {
        amount: true
      },
      _count: {
        id: true
      }
    });

    const sellersData = await Promise.all(
      teamReport.map(async (item) => {
        const seller = await prisma.user.findUnique({
          where: { id: item.sellerId },
          select: {
            id: true,
            name: true,
            email: true,
            region: {
              select: { id: true, name: true, code: true }
            }
          }
        });

        return {
          seller,
          totalAmount: item._sum.amount || 0,
          commissionsCount: item._count.id,
          averageCommission: item._count.id > 0 ? (item._sum.amount || 0) / item._count.id : 0
        };
      })
    );

    return Response.json(sellersData);
  }

  if (req.method === 'POST') {
    const body = await req.json();
    if (getTenantCompanyId(req.user)) {
      return Response.json({ error: 'Bonificação de equipe restrita ao administrador global' }, { status: 403 });
    }
    
    if (body.type === 'team_bonus') {
      // Criar bonificação por equipe
      const teamBonus = await prisma.teamBonus.create({
        data: {
          regionId: body.regionId,
          totalAmount: body.totalAmount,
          description: body.description,
          period: body.period,
          criteria: body.criteria,
          distributions: {
            create: body.distributions.map(dist => ({
              sellerId: dist.sellerId,
              amount: dist.amount,
              percentage: dist.percentage
            }))
          }
        },
        include: {
          region: {
            select: { id: true, name: true, code: true }
          },
          distributions: {
            include: {
              seller: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        }
      });

      return Response.json(teamBonus);
    }

    return Response.json({ error: 'Tipo de operação não suportado' }, { status: 400 });
  }

  return Response.json({ error: 'Método não permitido' }, { status: 405 });
}
