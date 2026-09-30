'use strict';

const express = require('express');
const { prisma } = require('../lib/prisma.cjs');
const { authenticateToken } = require('../lib/auth.cjs');
const router = express.Router();

const VALID_CATEGORIES = [
  'NEGOCIACAO', 'CONCORRENCIA', 'EDITAL_JURIDICO',
  'ESCOPO_TECNICO', 'PERDA_DE_DEAL', 'RELACIONAMENTO', 'PRECIFICACAO', 'OUTRO'
];

const normalizeCategory = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  return VALID_CATEGORIES.includes(raw) ? raw : 'OUTRO';
};

// ─── GET /api/opportunity-learnings/:opportunityId ────────────────────────────
// Lista todos os aprendizados de uma oportunidade (mais recentes primeiro)
router.get('/:opportunityId', authenticateToken, async (req, res) => {
  const { opportunityId } = req.params;
  const { category } = req.query; // filtro opcional por categoria

  try {
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { id: true, tenantCompanyId: true }
    });

    if (!opportunity) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }

    // Isolamento de tenant
    const isMaster = String(req.user.actualRole || req.user.role).toUpperCase() === 'MASTER';
    if (!isMaster && req.user.tenantCompanyId && opportunity.tenantCompanyId) {
      if (opportunity.tenantCompanyId !== req.user.tenantCompanyId) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
    }

    const where = { opportunityId };
    if (category && VALID_CATEGORIES.includes(String(category).toUpperCase())) {
      where.category = String(category).toUpperCase();
    }

    const learnings = await prisma.opportunityLearning.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(learnings);
  } catch (err) {
    console.error('Erro ao listar aprendizados:', err);
    return res.status(500).json({ error: 'Erro ao listar aprendizados' });
  }
});

// ─── POST /api/opportunity-learnings ─────────────────────────────────────────
// Cria um novo aprendizado
router.post('/', authenticateToken, async (req, res) => {
  const { opportunityId, description, category } = req.body;

  if (!opportunityId || !description || !String(description).trim()) {
    return res.status(400).json({ error: 'Os campos opportunityId e description são obrigatórios' });
  }

  if (!category) {
    return res.status(400).json({ error: 'O campo category é obrigatório' });
  }

  try {
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { id: true, tenantCompanyId: true }
    });

    if (!opportunity) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }

    const learning = await prisma.opportunityLearning.create({
      data: {
        id: require('crypto').randomUUID(),
        opportunityId,
        authorId: req.user.id,
        category: normalizeCategory(category),
        description: String(description).trim(),
        tenantCompanyId: req.user.tenantCompanyId || opportunity.tenantCompanyId || null
      },
      include: {
        author: { select: { id: true, name: true, email: true } }
      }
    });

    return res.status(201).json(learning);
  } catch (err) {
    console.error('Erro ao criar aprendizado:', err);
    return res.status(500).json({ error: 'Erro ao criar aprendizado' });
  }
});

// ─── PATCH /api/opportunity-learnings/:id ─────────────────────────────────────
// Atualiza descrição ou categoria de um aprendizado
router.patch('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { description, category } = req.body;

  try {
    const learning = await prisma.opportunityLearning.findUnique({
      where: { id },
      select: { id: true, authorId: true }
    });

    if (!learning) {
      return res.status(404).json({ error: 'Aprendizado não encontrado' });
    }

    const role = String(req.user.actualRole || req.user.role).toUpperCase();
    const isAdminOrMaster = ['ADMIN', 'MASTER'].includes(role);
    const isOwner = learning.authorId === req.user.id;

    if (!isOwner && !isAdminOrMaster) {
      return res.status(403).json({ error: 'Você só pode editar seus próprios aprendizados' });
    }

    const data = { updatedAt: new Date() };
    if (description && String(description).trim()) {
      data.description = String(description).trim();
    }
    if (category) {
      data.category = normalizeCategory(category);
    }

    const updated = await prisma.opportunityLearning.update({
      where: { id },
      data,
      include: {
        author: { select: { id: true, name: true, email: true } }
      }
    });

    return res.json(updated);
  } catch (err) {
    console.error('Erro ao atualizar aprendizado:', err);
    return res.status(500).json({ error: 'Erro ao atualizar aprendizado' });
  }
});

// ─── DELETE /api/opportunity-learnings/:id ────────────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const learning = await prisma.opportunityLearning.findUnique({
      where: { id },
      select: { id: true, authorId: true }
    });

    if (!learning) {
      return res.status(404).json({ error: 'Aprendizado não encontrado' });
    }

    const role = String(req.user.actualRole || req.user.role).toUpperCase();
    const isAdminOrMaster = ['ADMIN', 'MASTER'].includes(role);
    const isOwner = learning.authorId === req.user.id;

    if (!isOwner && !isAdminOrMaster) {
      return res.status(403).json({ error: 'Você só pode remover seus próprios aprendizados' });
    }

    await prisma.opportunityLearning.delete({ where: { id } });
    return res.json({ message: 'Aprendizado removido com sucesso' });
  } catch (err) {
    console.error('Erro ao remover aprendizado:', err);
    return res.status(500).json({ error: 'Erro ao remover aprendizado' });
  }
});

module.exports = router;
