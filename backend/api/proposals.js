const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../lib/auth');
const { getTenantCompanyId, mergeRelationWhere } = require('../lib/tenantScope.cjs');

const router = express.Router();
const prisma = new PrismaClient();

const scopeProposalWhere = (req, where = {}) => {
  const tenantCompanyId = getTenantCompanyId(req.user);
  let scoped = { ...where };

  if (tenantCompanyId) {
    scoped = mergeRelationWhere(scoped, 'opportunity', { tenantCompanyId });
  } else if (req.user.role === 'SELLER') {
    scoped = mergeRelationWhere(scoped, 'opportunity', { ownerId: req.user.userId });
  }

  return scoped;
};

const canAccessOpportunity = (req, opportunity = {}) => {
  const tenantCompanyId = getTenantCompanyId(req.user);
  if (tenantCompanyId) {
    return String(opportunity.tenantCompanyId || '') === tenantCompanyId;
  }
  return req.user.role !== 'SELLER' || opportunity.ownerId === req.user.userId;
};

router.get('/types', authenticateToken, async (req, res) => {
  res.json({
    types: [
      { id: 'GENERAL', name: 'Geral', description: 'Proposta comercial geral' },
      { id: 'FIBER', name: 'Internet Fibra', description: 'Servicos de conectividade por fibra' },
      { id: 'RADIO', name: 'Internet Radio', description: 'Servicos de conectividade via radio' },
      { id: 'DOUBLE', name: 'Double Fibra + Radio', description: 'Oferta combinada com fibra e radio' },
      { id: 'VM', name: 'Maquinas Virtuais', description: 'Infraestrutura e maquinas virtuais' },
      { id: 'REDE_MAN_MPLS_FIBRA', name: 'Rede MAN/MPLS Fibra', description: 'Rede corporativa por fibra' },
      { id: 'REDE_MAN_MPLS_RADIO', name: 'Rede MAN/MPLS Radio', description: 'Rede corporativa via radio' },
      { id: 'SD_WAN', name: 'SD-WAN', description: 'Projeto SD-WAN' },
      { id: 'EVENTOS_TI', name: 'Eventos TI', description: 'Conectividade e infraestrutura para eventos' }
    ]
  });
});

router.get('/:id/logs/summary', authenticateToken, async (req, res) => {
  res.json({ count: 0, lastAction: null });
});

router.get('/:id/logs', authenticateToken, async (req, res) => {
  res.json({ logs: [] });
});

// Listar propostas
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { opportunityId, status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    
    let where = {};
    if (opportunityId) where.opportunityId = opportunityId;
    if (status) where.status = status;

    where = scopeProposalWhere(req, where);

    const [proposals, total] = await Promise.all([
      prisma.proposal.findMany({
        where,
        include: {
          opportunity: {
            include: {
              company: {
                select: { id: true, name: true, document: true, logo: true }
              },
              owner: {
                select: { id: true, name: true, email: true }
              }
            }
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, price: true }
              }
            },
            orderBy: { id: 'asc' }
          },
          priceTable: {
            select: { id: true, name: true }
          },
          template: {
            select: { id: true, name: true, isDefault: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.proposal.count({ where })
    ]);
    
    res.json(proposals);
  } catch (error) {
    console.error('Erro ao listar propostas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar proposta por ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        opportunity: {
          include: {
            company: {
              select: { id: true, name: true, document: true, logo: true }
            },
            owner: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, price: true }
            }
          },
          orderBy: { id: 'asc' }
        },
        priceTable: {
          select: { id: true, name: true }
        },
        template: {
          select: { id: true, name: true, isDefault: true }
        }
      }
    });

    if (!proposal) {
      return res.status(404).json({ error: 'Proposta não encontrada' });
    }

    if (!canAccessOpportunity(req, proposal.opportunity)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    res.json(proposal);
  } catch (error) {
    console.error('Erro ao buscar proposta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar proposta
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { 
      title, 
      description, 
      opportunityId, 
      validUntil, 
      discount, 
      tax, 
      items,
      priceTableId,
      templateId 
    } = req.body;

    if (!title || !opportunityId || !items || items.length === 0) {
      return res.status(400).json({ 
        error: 'Título, oportunidade e itens são obrigatórios' 
      });
    }

    // Verificar se a oportunidade existe e se o usuário tem permissão
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId }
    });

    if (!opportunity) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }

    if (!canAccessOpportunity(req, opportunity)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Gerar número da proposta
    const year = new Date().getFullYear();
    const count = await prisma.proposal.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`)
        }
      }
    });
    const number = `PROP${year}${String(count + 1).padStart(4, '0')}`;

    // Calcular valor total
    const itemsWithTotal = items.map(item => {
      const itemTotal = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
      return {
        ...item,
        totalPrice: itemTotal
      };
    });

    const subtotal = itemsWithTotal.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalValue = subtotal * (1 - (discount || 0) / 100) * (1 + (tax || 0) / 100);

    const proposal = await prisma.proposal.create({
      data: {
        number,
        title,
        description,
        totalValue,
        discount: discount || 0,
        tax: tax || 0,
        status: 'DRAFT',
        validUntil: validUntil ? new Date(validUntil) : null,
        opportunityId,
        priceTableId,
        templateId,
        items: {
          create: itemsWithTotal.map(item => ({
            productId: item.productId,
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            totalPrice: item.totalPrice
          }))
        }
      },
      include: {
        opportunity: {
          include: {
            company: {
              select: { id: true, name: true, document: true, logo: true }
            },
            owner: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, price: true }
            }
          }
        },
        priceTable: {
          select: { id: true, name: true }
        }
      }
    });
    
    res.status(201).json(proposal);
  } catch (error) {
    console.error('Erro ao criar proposta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar proposta
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      description, 
      validUntil, 
      discount, 
      tax, 
      status,
      items 
    } = req.body;

    // Buscar proposta atual
    const currentProposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        opportunity: true,
        items: true
      }
    });

    if (!currentProposal) {
      return res.status(404).json({ error: 'Proposta não encontrada' });
    }

    if (!canAccessOpportunity(req, currentProposal.opportunity)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const updateData = {};
    let shouldIncrementVersion = false;

    if (title && title !== currentProposal.title) {
      updateData.title = title;
      shouldIncrementVersion = true;
    }
    
    if (description !== undefined) {
      updateData.description = description;
    }
    
    if (validUntil) {
      updateData.validUntil = new Date(validUntil);
    }
    
    if (discount !== undefined) {
      updateData.discount = discount;
      shouldIncrementVersion = true;
    }
    
    if (tax !== undefined) {
      updateData.tax = tax;
      shouldIncrementVersion = true;
    }
    
    if (status) {
      updateData.status = status;
    }

    // Se houver novos itens, atualizar
    if (items && items.length > 0) {
      // Deletar itens antigos
      await prisma.proposalItem.deleteMany({
        where: { proposalId: id }
      });

      // Calcular novo valor total
      const itemsWithTotal = items.map(item => {
        const itemTotal = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
        return {
          ...item,
          totalPrice: itemTotal
        };
      });

      const subtotal = itemsWithTotal.reduce((sum, item) => sum + item.totalPrice, 0);
      const totalValue = subtotal * (1 - (discount || 0) / 100) * (1 + (tax || 0) / 100);

      updateData.totalValue = totalValue;
      updateData.items = {
        create: itemsWithTotal.map(item => ({
          productId: item.productId,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          totalPrice: item.totalPrice
        }))
      };

      shouldIncrementVersion = true;
    }

    // Incrementar versão se houver mudanças significativas
    if (shouldIncrementVersion) {
      updateData.version = currentProposal.version + 1;
    }

    const proposal = await prisma.proposal.update({
      where: { id },
      data: updateData,
      include: {
        opportunity: {
          include: {
            company: {
              select: { id: true, name: true, document: true, logo: true }
            },
            owner: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, price: true }
            }
          }
        },
        priceTable: {
          select: { id: true, name: true }
        }
      }
    });
    
    res.json(proposal);
  } catch (error) {
    console.error('Erro ao atualizar proposta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Deletar proposta
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar proposta
    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        opportunity: true
      }
    });

    if (!proposal) {
      return res.status(404).json({ error: 'Proposta não encontrada' });
    }

    if (!canAccessOpportunity(req, proposal.opportunity)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Deletar itens primeiro
    await prisma.proposalItem.deleteMany({
      where: { proposalId: id }
    });

    // Deletar proposta
    await prisma.proposal.delete({
      where: { id }
    });

    res.json({ message: 'Proposta deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar proposta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Enviar proposta (mudar status para SENT)
router.post('/:id/send', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        opportunity: true
      }
    });

    if (!proposal) {
      return res.status(404).json({ error: 'Proposta não encontrada' });
    }

    if (!canAccessOpportunity(req, proposal.opportunity)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const updatedProposal = await prisma.proposal.update({
      where: { id },
      data: { status: 'SENT' },
      include: {
        opportunity: {
          include: {
            company: {
              select: { id: true, name: true, document: true, logo: true }
            }
          }
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, price: true }
            }
          }
        }
      }
    });

    res.json(updatedProposal);
  } catch (error) {
    console.error('Erro ao enviar proposta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
