import { prisma } from '../lib/prisma.js';

export default async function handler(req) {
  if (req.method === 'GET') {
    const { productId, active, suggestions } = req.query || {};
    
    if (suggestions === 'true' && productId) {
      // Buscar sugestões de upsell para um produto específico
      const upSellRules = await prisma.upSellRule.findMany({
        where: {
          mainProductId: productId,
          isActive: true
        },
        include: {
          targetProduct: true
        },
        orderBy: { discount: 'desc' }
      });
      
      return Response.json(upSellRules);
    }
    
    const where = {};
    if (active !== undefined) where.isActive = active === 'true';
    if (productId) where.mainProductId = productId;

    const upSellRules = await prisma.upSellRule.findMany({
      where,
      include: {
        mainProduct: true,
        targetProduct: true
      },
      orderBy: [
        { discount: 'desc' },
        { name: 'asc' }
      ]
    });
    
    return Response.json(upSellRules);
  }

  if (req.method === 'POST') {
    const body = await req.json();
    
    const upSellRule = await prisma.upSellRule.create({
      data: {
        name: body.name,
        mainProductId: body.mainProductId,
        targetProductId: body.targetProductId,
        minQuantity: body.minQuantity || 1,
        discount: body.discount || 0,
        isActive: body.isActive !== undefined ? body.isActive : true
      },
      include: {
        mainProduct: true,
        targetProduct: true
      }
    });
    
    return Response.json(upSellRule);
  }

  if (req.method === 'PUT') {
    const body = await req.json();
    
    const upSellRule = await prisma.upSellRule.update({
      where: { id: body.id },
      data: {
        name: body.name,
        minQuantity: body.minQuantity,
        discount: body.discount,
        isActive: body.isActive
      },
      include: {
        mainProduct: true,
        targetProduct: true
      }
    });
    
    return Response.json(upSellRule);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    
    await prisma.upSellRule.delete({
      where: { id }
    });
    
    return Response.json({ success: true });
  }

  return new Response('Method not allowed', { status: 405 });
}