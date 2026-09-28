import { prisma } from '../lib/prisma.js';

export default async function handler(req) {
  if (req.method === 'GET') {
    const { productId, active, suggestions } = req.query || {};
    
    if (suggestions === 'true' && productId) {
      // Buscar sugestões de cross-sell para um produto específico
      const crossSellRules = await prisma.crossSellRule.findMany({
        where: {
          mainProductId: productId,
          isActive: true
        },
        include: {
          suggestedProduct: true
        },
        orderBy: { probability: 'desc' }
      });
      
      return Response.json(crossSellRules);
    }
    
    const where = {};
    if (active !== undefined) where.isActive = active === 'true';
    if (productId) where.mainProductId = productId;

    const crossSellRules = await prisma.crossSellRule.findMany({
      where,
      include: {
        mainProduct: true,
        suggestedProduct: true
      },
      orderBy: [
        { probability: 'desc' },
        { name: 'asc' }
      ]
    });
    
    return Response.json(crossSellRules);
  }

  if (req.method === 'POST') {
    const body = await req.json();
    
    const crossSellRule = await prisma.crossSellRule.create({
      data: {
        name: body.name,
        mainProductId: body.mainProductId,
        suggestedProductId: body.suggestedProductId,
        probability: body.probability || 0.5,
        discount: body.discount || 0,
        isActive: body.isActive !== undefined ? body.isActive : true
      },
      include: {
        mainProduct: true,
        suggestedProduct: true
      }
    });
    
    return Response.json(crossSellRule);
  }

  if (req.method === 'PUT') {
    const body = await req.json();
    
    const crossSellRule = await prisma.crossSellRule.update({
      where: { id: body.id },
      data: {
        name: body.name,
        probability: body.probability,
        discount: body.discount,
        isActive: body.isActive
      },
      include: {
        mainProduct: true,
        suggestedProduct: true
      }
    });
    
    return Response.json(crossSellRule);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    
    await prisma.crossSellRule.delete({
      where: { id }
    });
    
    return Response.json({ success: true });
  }

  return new Response('Method not allowed', { status: 405 });
}