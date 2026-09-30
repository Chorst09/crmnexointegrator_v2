import { prisma } from '../lib/prisma.js';

export default async function handler(req) {
  if (req.method === 'GET') {
    const { active, opportunityId } = req.query || {};
    
    if (opportunityId) {
      // Buscar concorrentes de uma oportunidade específica
      const comparisons = await prisma.competitorComparison.findMany({
        where: { opportunityId },
        include: {
          competitor: true,
          opportunity: {
            include: {
              company: true
            }
          }
        }
      });
      return Response.json(comparisons);
    }
    
    const where = {};
    if (active !== undefined) where.isActive = active === 'true';

    const competitors = await prisma.competitor.findMany({
      where,
      include: {
        comparisons: {
          include: {
            opportunity: {
              include: {
                company: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        _count: {
          select: {
            comparisons: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    return Response.json(competitors);
  }

  if (req.method === 'POST') {
    const body = await req.json();
    
    const competitor = await prisma.competitor.create({
      data: {
        name: body.name,
        website: body.website,
        strengths: body.strengths,
        weaknesses: body.weaknesses,
        pricing: body.pricing,
        marketShare: body.marketShare,
        notes: body.notes,
        isActive: body.isActive !== undefined ? body.isActive : true
      }
    });
    
    return Response.json(competitor);
  }

  if (req.method === 'PUT') {
    const body = await req.json();
    
    const competitor = await prisma.competitor.update({
      where: { id: body.id },
      data: {
        name: body.name,
        website: body.website,
        strengths: body.strengths,
        weaknesses: body.weaknesses,
        pricing: body.pricing,
        marketShare: body.marketShare,
        notes: body.notes,
        isActive: body.isActive
      }
    });
    
    return Response.json(competitor);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    
    await prisma.competitor.delete({
      where: { id }
    });
    
    return Response.json({ success: true });
  }

  return new Response('Method not allowed', { status: 405 });
}