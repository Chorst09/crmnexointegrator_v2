const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../lib/auth');

const router = express.Router();
const prisma = new PrismaClient();

const isMasterUser = (user = {}) => String(user.actualRole || user.role || '').toUpperCase() === 'MASTER';
const getTenantCompanyId = (user = {}) => (isMasterUser(user) ? null : String(user.tenantCompanyId || '').trim() || null);
const tenantWhere = (user = {}) => {
  const tenantCompanyId = getTenantCompanyId(user);
  return tenantCompanyId ? { tenantCompanyId } : {};
};
const canSeeTenantRecord = (user = {}, record = {}) => {
  const tenantCompanyId = getTenantCompanyId(user);
  return !tenantCompanyId || String(record?.tenantCompanyId || '') === tenantCompanyId;
};

// Listar produtos
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { active, category, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;
    
    const where = { ...tenantWhere(req.user) };
    if (active !== undefined) where.active = active === 'true';
    if (category) where.category = category;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          prices: {
            include: {
              priceTable: {
                select: { id: true, name: true }
              }
            }
          },
          _count: {
            select: {
              opportunities: true,
              proposals: true
            }
          }
        },
        orderBy: { name: 'asc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.product.count({ where })
    ]);
    
    res.json(products);
  } catch (error) {
    console.error('Erro ao listar produtos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Listar categorias
router.get('/categories/list', authenticateToken, async (req, res) => {
  try {
    const categories = await prisma.product.findMany({
      where: {
        ...tenantWhere(req.user),
        category: {
          not: null
        }
      },
      select: {
        category: true
      },
      distinct: ['category']
    });

    const categoryList = categories
      .map(p => p.category)
      .filter(Boolean)
      .sort();

    res.json(categoryList);
  } catch (error) {
    console.error('Erro ao listar categorias:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar produto por ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        prices: {
          include: {
            priceTable: {
              select: { id: true, name: true }
            }
          }
        },
        crossSells: {
          include: {
            suggestedProduct: {
              select: { id: true, name: true, price: true }
            }
          }
        },
        upSells: {
          include: {
            targetProduct: {
              select: { id: true, name: true, price: true }
            }
          }
        }
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }
    if (!canSeeTenantRecord(req.user, product)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    res.json(product);
  } catch (error) {
    console.error('Erro ao buscar produto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar produto
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, category, price, margin, active } = req.body;

    if (!name || !price) {
      return res.status(400).json({ 
        error: 'Nome e preço são obrigatórios' 
      });
    }

    // Verificar permissão
    if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        category,
        price: parseFloat(price),
        margin: margin ? parseFloat(margin) : null,
        active: active !== undefined ? active : true,
        tenantCompanyId: getTenantCompanyId(req.user)
      }
    });
    
    res.status(201).json(product);
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar produto
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, price, margin, active } = req.body;

    // Verificar permissão
    if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const existing = await prisma.product.findUnique({
      where: { id },
      select: { tenantCompanyId: true }
    });
    if (!existing) return res.status(404).json({ error: 'Produto não encontrado' });
    if (!canSeeTenantRecord(req.user, existing)) return res.status(403).json({ error: 'Acesso negado' });

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category) updateData.category = category;
    if (price) updateData.price = parseFloat(price);
    if (margin !== undefined) updateData.margin = margin ? parseFloat(margin) : null;
    if (active !== undefined) updateData.active = active;

    const product = await prisma.product.update({
      where: { id },
      data: updateData
    });
    
    res.json(product);
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Deletar produto
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar permissão
    if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Verificar se o produto está sendo usado
    const usage = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            opportunities: true,
            proposals: true
          }
        }
      }
    });

    if (!usage) return res.status(404).json({ error: 'Produto não encontrado' });
    if (!canSeeTenantRecord(req.user, usage)) return res.status(403).json({ error: 'Acesso negado' });

    if (usage && (usage._count.opportunities > 0 || usage._count.proposals > 0)) {
      return res.status(400).json({ 
        error: 'Produto não pode ser deletado pois está sendo usado em oportunidades ou propostas' 
      });
    }

    await prisma.product.delete({
      where: { id }
    });

    res.json({ message: 'Produto deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar produto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
