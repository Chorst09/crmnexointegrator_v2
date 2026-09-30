import { prisma } from '../lib/prisma.js';

export default async function handler(req) {
  if (req.method === 'GET') {
    const { active, country } = req.query || {};
    
    const where = {};
    if (active !== undefined) where.isActive = active === 'true';
    if (country) where.country = country;

    const regions = await prisma.region.findMany({
      where,
      include: {
        users: {
          select: { id: true, name: true, email: true }
        },
        companies: {
          select: { id: true, name: true, status: true }
        },
        _count: {
          select: {
            users: true,
            companies: true,
            priceTables: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    return Response.json(regions);
  }

  if (req.method === 'POST') {
    const body = await req.json();
    
    const region = await prisma.region.create({
      data: {
        name: body.name,
        code: body.code,
        country: body.country || 'Brasil',
        state: body.state,
        city: body.city,
        isActive: body.isActive !== undefined ? body.isActive : true
      }
    });
    
    return Response.json(region);
  }

  if (req.method === 'PUT') {
    const body = await req.json();
    
    const region = await prisma.region.update({
      where: { id: body.id },
      data: {
        name: body.name,
        code: body.code,
        country: body.country,
        state: body.state,
        city: body.city,
        isActive: body.isActive
      }
    });
    
    return Response.json(region);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    
    // Verificar se há usuários ou empresas vinculadas
    const region = await prisma.region.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            companies: true
          }
        }
      }
    });
    
    if (region && (region._count.users > 0 || region._count.companies > 0)) {
      return Response.json({ 
        error: 'Cannot delete region with associated users or companies' 
      }, { status: 400 });
    }
    
    await prisma.region.delete({
      where: { id }
    });
    
    return Response.json({ success: true });
  }

  return new Response('Method not allowed', { status: 405 });
}