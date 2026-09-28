import { prisma } from '../lib/prisma.js';

export default async function handler(req) {
  if (req.method === 'GET') {
    const { active, region, segment } = req.query || {};
    
    const where = {};
    if (active !== undefined) where.isDefault = active === 'true';
    if (region) where.region = region;
    if (segment) where.customerSegment = segment;

    const priceTables = await prisma.priceTable.findMany({
      where,
      include: {
        prices: {
          include: {
            product: true
          }
        }
      },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' }
      ]
    });
    
    return Response.json(priceTables);
  }

  if (req.method === 'POST') {
    const body = await req.json();
    
    const priceTable = await prisma.priceTable.create({
      data: {
        name: body.name,
        description: body.description,
        isDefault: body.isDefault || false,
        validFrom: new Date(body.validFrom),
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        region: body.region,
        customerSegment: body.customerSegment,
        prices: body.prices ? {
          create: body.prices.map(price => ({
            productId: price.productId,
            price: price.price,
            minQuantity: price.minQuantity || 1,
            maxQuantity: price.maxQuantity,
            discount: price.discount || 0
          }))
        } : undefined
      },
      include: {
        prices: {
          include: {
            product: true
          }
        }
      }
    });
    
    return Response.json(priceTable);
  }

  if (req.method === 'PUT') {
    const body = await req.json();
    
    const priceTable = await prisma.priceTable.update({
      where: { id: body.id },
      data: {
        name: body.name,
        description: body.description,
        isDefault: body.isDefault,
        validFrom: body.validFrom ? new Date(body.validFrom) : undefined,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        region: body.region,
        customerSegment: body.customerSegment
      },
      include: {
        prices: {
          include: {
            product: true
          }
        }
      }
    });
    
    return Response.json(priceTable);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    
    // Verificar se não é a tabela padrão
    const priceTable = await prisma.priceTable.findUnique({
      where: { id }
    });
    
    if (priceTable?.isDefault) {
      return Response.json({ error: 'Cannot delete default price table' }, { status: 400 });
    }
    
    await prisma.priceTable.delete({
      where: { id }
    });
    
    return Response.json({ success: true });
  }

  return new Response('Method not allowed', { status: 405 });
}