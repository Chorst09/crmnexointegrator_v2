const express = require('express');
const { prisma } = require('../lib/prisma.cjs');
const { authenticateToken } = require('../lib/auth.cjs');
const { getTenantId } = require('../lib/access-control.cjs');

const router = express.Router();

// Listar propostas
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { opportunityId, status, type, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    
    const where = {};
    if (opportunityId) where.opportunityId = opportunityId;
    if (status) where.status = status;
    if (type) where.type = type;

    // Isolamento por tenant — cada empresa vê apenas suas próprias propostas
    const tenantId = getTenantId(req.user);
    if (tenantId) {
      where.opportunity = { tenantCompanyId: tenantId };
    }

    // Filtrar por permissão de papel (SELLER vê apenas as próprias)
    if (req.user.role === 'SELLER') {
      where.opportunity = {
        ...(where.opportunity || {}),
        ownerId: req.user.userId
      };
    }

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
            select: { id: true, name: true, isDefault: true, type: true }
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

router.get('/:id/logs/summary', authenticateToken, async (req, res) => {
  res.json({ count: 0, lastAction: null });
});

router.get('/:id/logs', authenticateToken, async (req, res) => {
  res.json({ logs: [] });
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
          select: { id: true, name: true, isDefault: true, type: true, sections: true }
        }
      }
    });

    if (!proposal) {
      return res.status(404).json({ error: 'Proposta não encontrada' });
    }

    // Verificar permissão
    if (req.user.role === 'SELLER' && proposal.opportunity.ownerId !== req.user.userId) {
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
      type,
      title, 
      description, 
      opportunityId, 
      validUntil, 
      discount, 
      tax, 
      items,
      sectionsData,
      priceTableId,
      templateId 
    } = req.body;

    const proposalType = type || 'COMMERCIAL';
    const itemsList = Array.isArray(items) ? items : [];
    const shouldHaveItems = proposalType === 'COMMERCIAL';

    if (!title || !opportunityId) {
      return res.status(400).json({ 
        error: 'Título e oportunidade são obrigatórios' 
      });
    }

    if (shouldHaveItems && itemsList.length === 0) {
      return res.status(400).json({
        error: 'Itens são obrigatórios para proposta comercial'
      });
    }

    // Verificar se a oportunidade existe e se o usuário tem permissão
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId }
    });

    if (!opportunity) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }

    if (req.user.role === 'SELLER' && opportunity.ownerId !== req.user.userId) {
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

    const safeSectionsData =
      sectionsData && typeof sectionsData === 'object' && !Array.isArray(sectionsData)
        ? sectionsData
        : {};

    // Se nao vier templateId, usar o default do tipo
    let resolvedTemplateId = templateId || null;
    if (!resolvedTemplateId) {
      const defaultTemplate = await prisma.proposalTemplate.findFirst({
        where: { isDefault: true, isActive: true, type: proposalType },
        select: { id: true }
      });
      resolvedTemplateId = defaultTemplate?.id || null;
    }

    const shouldPersistItems = itemsList.length > 0;
    const normalizedDiscount = shouldPersistItems ? (discount || 0) : 0;
    const normalizedTax = shouldPersistItems ? (tax || 0) : 0;

    // Calcular valor total (se houver itens)
    const itemsWithTotal = shouldPersistItems
      ? itemsList.map(item => {
          const itemTotal = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
          return {
            ...item,
            totalPrice: itemTotal
          };
        })
      : [];

    const subtotal = itemsWithTotal.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalValue =
      shouldPersistItems
        ? subtotal * (1 - (normalizedDiscount || 0) / 100) * (1 + (normalizedTax || 0) / 100)
        : 0;

    const proposal = await prisma.proposal.create({
      data: {
        number,
        type: proposalType,
        title,
        description,
        sectionsData: safeSectionsData,
        totalValue,
        discount: normalizedDiscount,
        tax: normalizedTax,
        status: 'DRAFT',
        validUntil: validUntil ? new Date(validUntil) : null,
        opportunityId,
        priceTableId,
        templateId: resolvedTemplateId,
        ...(shouldPersistItems
          ? {
              items: {
                create: itemsWithTotal.map(item => ({
                  productId: item.productId,
                  quantity: item.quantity || 1,
                  unitPrice: item.unitPrice,
                  discount: item.discount || 0,
                  totalPrice: item.totalPrice
                }))
              }
            }
          : {})
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
        },
        template: {
          select: { id: true, name: true, isDefault: true, type: true, sections: true }
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
      type,
      templateId,
      title, 
      description, 
      validUntil, 
      discount, 
      tax, 
      status,
      sectionsData,
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

    // Verificar permissão
    if (req.user.role === 'SELLER' && currentProposal.opportunity.ownerId !== req.user.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const updateData = {};
    let shouldIncrementVersion = false;

    const nextType = type || currentProposal.type || 'COMMERCIAL';

    if (type && type !== currentProposal.type) {
      updateData.type = nextType;
      shouldIncrementVersion = true;
    }

    if (templateId !== undefined && templateId !== currentProposal.templateId) {
      updateData.templateId = templateId || null;
      shouldIncrementVersion = true;
    }

    if (title && title !== currentProposal.title) {
      updateData.title = title;
      shouldIncrementVersion = true;
    }
    
    if (description !== undefined) {
      updateData.description = description;
    }

    if (sectionsData !== undefined) {
      updateData.sectionsData =
        sectionsData && typeof sectionsData === 'object' && !Array.isArray(sectionsData)
          ? sectionsData
          : {};
      shouldIncrementVersion = true;
    }
    
    if (validUntil !== undefined) {
      // Permite limpar a data enviando string vazia/null
      if (validUntil === null || validUntil === '') {
        updateData.validUntil = null;
      } else {
        updateData.validUntil = new Date(validUntil);
      }
    }
    
    if (status) {
      updateData.status = status;
    }

    const nextDiscount = discount !== undefined ? discount : currentProposal.discount;
    const nextTax = tax !== undefined ? tax : currentProposal.tax;

    const replacingItems = Array.isArray(items);

    // Se itens vierem no body (mesmo vazio), tratar como "substituir"
    if (replacingItems) {
      if (nextType === 'COMMERCIAL' && items.length === 0) {
        return res.status(400).json({ error: 'Itens são obrigatórios para proposta comercial' });
      }

      // Deletar itens antigos
      await prisma.proposalItem.deleteMany({
        where: { proposalId: id }
      });

      if (items.length > 0) {
        // Calcular novo valor total
        const itemsWithTotal = items.map(item => {
          const itemTotal = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
          return {
            ...item,
            totalPrice: itemTotal
          };
        });

        const subtotal = itemsWithTotal.reduce((sum, item) => sum + item.totalPrice, 0);
        const totalValue = subtotal * (1 - (nextDiscount || 0) / 100) * (1 + (nextTax || 0) / 100);

        updateData.totalValue = totalValue;
        updateData.discount = nextDiscount || 0;
        updateData.tax = nextTax || 0;
        updateData.items = {
          create: itemsWithTotal.map(item => ({
            productId: item.productId,
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            totalPrice: item.totalPrice
          }))
        };
      } else {
        // Proposta tecnica sem itens
        updateData.totalValue = 0;
        updateData.discount = 0;
        updateData.tax = 0;
      }

      shouldIncrementVersion = true;
    } else if (discount !== undefined || tax !== undefined) {
      // Recalcular totalValue quando desconto/imposto mudar (mesmo sem mudar itens)
      const subtotal = (currentProposal.items || []).reduce((sum, item) => sum + (item.totalPrice || 0), 0);
      const hasItems = subtotal > 0;

      if (!hasItems) {
        updateData.totalValue = 0;
        updateData.discount = 0;
        updateData.tax = 0;
      } else {
        updateData.totalValue = subtotal * (1 - (nextDiscount || 0) / 100) * (1 + (nextTax || 0) / 100);
        updateData.discount = nextDiscount || 0;
        updateData.tax = nextTax || 0;
      }

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
        },
        template: {
          select: { id: true, name: true, isDefault: true, type: true, sections: true }
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

    // Verificar permissão
    if (req.user.role === 'SELLER' && proposal.opportunity.ownerId !== req.user.userId) {
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

    // Verificar permissão
    if (req.user.role === 'SELLER' && proposal.opportunity.ownerId !== req.user.userId) {
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
