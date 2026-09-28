
import { prisma } from '../lib/prisma.js';
import { getTenantCompanyId, tenantScopedWhere } from '../lib/tenantScope.js';

// Esta API é mantida para compatibilidade, mas redireciona para companies
export default async function handler(req) {
  if (req.method === 'GET') {
    // Retorna companies no formato de clients para compatibilidade
    const companies = await prisma.company.findMany({
      where: tenantScopedWhere(req.user),
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
    const tenantCompanyId = getTenantCompanyId(req.user) || body.tenantCompanyId || null;
    
    // Criar company com contact
    const company = await prisma.company.create({
      data: {
        name: body.name,
        status: body.status || 'LEAD',
        tenantCompanyId,
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
