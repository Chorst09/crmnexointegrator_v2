
import { prisma } from '../lib/prisma.js';

// Esta API é mantida para compatibilidade, mas redireciona para companies
export default async function handler(req) {
  if (req.method === 'GET') {
    const where = {};

    // Isolamento multi-tenant
    const isMasterUser = String(req.user?.actualRole || req.user?.role || '').toUpperCase() === 'MASTER';
    const tenantId = isMasterUser ? null : (req.user?.tenantCompanyId || null);
    if (tenantId) {
      where.tenantCompanyId = tenantId;
    }

    if (req.user?.role === 'SELLER') {
      where.OR = [
        req.user.regionId ? { regionId: req.user.regionId } : undefined,
        { opportunities: { some: { ownerId: req.user.userId } } }
      ].filter(Boolean);
    }

    // Retorna companies no formato de clients para compatibilidade
    const companies = await prisma.company.findMany({
      where,
      include: {
        contacts: {
          where: { isPrimary: true },
          take: 1
        },
        _count: {
          select: {
            opportunities: true
          }
        }
      }
    });
    
    // Mapear para formato de client
    const clients = companies.map(company => ({
      id: company.id,
      name: company.name,
      contact: company.contacts[0]?.name || 'Sem contato',
      status: company.status,
      createdAt: company.createdAt,
      deals: company._count.opportunities
    }));
    
    return Response.json(clients);
  }

  if (req.method === 'POST') {
    const body = await req.json();

    const regionId = req.user?.role === 'SELLER' ? (req.user.regionId || null) : (body.regionId || null);
    
    // Criar company com contact
    const company = await prisma.company.create({
      data: {
        name: body.name,
        status: body.status || 'LEAD',
        regionId,
        contacts: {
          create: {
            name: body.contact || 'Contato Principal',
            isPrimary: true
          }
        }
      },
      include: {
        contacts: true
      }
    });
    
    // Retornar no formato client
    return Response.json({
      id: company.id,
      name: company.name,
      contact: company.contacts[0]?.name || 'Sem contato',
      status: company.status,
      createdAt: company.createdAt
    });
  }

  return new Response('Method not allowed', { status: 405 });
}
