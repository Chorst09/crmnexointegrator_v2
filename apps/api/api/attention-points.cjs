'use strict';

const express = require('express');
const { prisma } = require('../lib/prisma.cjs');
const { authenticateToken } = require('../lib/auth.cjs');
const router = express.Router();

const VALID_SEVERITIES = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'];
const VALID_STATUSES = ['PENDENTE', 'RESOLVIDO'];

const normalizeSeverity = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  return VALID_SEVERITIES.includes(raw) ? raw : 'MEDIA';
};

// ─── GET /api/opportunity-attention-points/:opportunityId ─────────────────────
// Lista todos os pontos de atenção de uma oportunidade (mais recentes primeiro)
router.get('/:opportunityId', authenticateToken, async (req, res) => {
  const { opportunityId } = req.params;
  const { status } = req.query; // filtro opcional: PENDENTE | RESOLVIDO

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
    if (status && VALID_STATUSES.includes(status.toUpperCase())) {
      where.status = status.toUpperCase();
    }

    const points = await prisma.opportunityAttentionPoint.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, email: true } },
        resolvedBy: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(points);
  } catch (err) {
    console.error('Erro ao listar pontos de atenção:', err);
    return res.status(500).json({ error: 'Erro ao listar pontos de atenção' });
  }
});

// ─── POST /api/opportunity-attention-points ───────────────────────────────────
// Cria um novo ponto de atenção
router.post('/', authenticateToken, async (req, res) => {
  const { opportunityId, description, severity } = req.body;

  if (!opportunityId || !description || !String(description).trim()) {
    return res.status(400).json({ error: 'Os campos opportunityId e description são obrigatórios' });
  }

  try {
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { id: true, tenantCompanyId: true }
    });

    if (!opportunity) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }

    const point = await prisma.opportunityAttentionPoint.create({
      data: {
        id: require('crypto').randomUUID(),
        opportunityId,
        authorId: req.user.id,
        description: String(description).trim(),
        severity: normalizeSeverity(severity),
        status: 'PENDENTE',
        tenantCompanyId: req.user.tenantCompanyId || opportunity.tenantCompanyId || null
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
        resolvedBy: { select: { id: true, name: true } }
      }
    });

    return res.status(201).json(point);
  } catch (err) {
    console.error('Erro ao criar ponto de atenção:', err);
    return res.status(500).json({ error: 'Erro ao criar ponto de atenção' });
  }
});

// ─── PATCH /api/opportunity-attention-points/:id ──────────────────────────────
// Atualiza um ponto de atenção (descrição, severidade ou resolve)
router.patch('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { description, severity, status } = req.body;

  try {
    const point = await prisma.opportunityAttentionPoint.findUnique({
      where: { id },
      select: { id: true, authorId: true, status: true, tenantCompanyId: true }
    });

    if (!point) {
      return res.status(404).json({ error: 'Ponto de atenção não encontrado' });
    }

    const role = String(req.user.actualRole || req.user.role).toUpperCase();
    const isAdminOrMaster = ['ADMIN', 'MASTER'].includes(role);
    const isOwner = point.authorId === req.user.id;

    if (!isOwner && !isAdminOrMaster) {
      return res.status(403).json({ error: 'Você só pode editar seus próprios pontos de atenção' });
    }

    const data = {};
    if (description && String(description).trim()) {
      data.description = String(description).trim();
    }
    if (severity) {
      data.severity = normalizeSeverity(severity);
    }
    if (status && VALID_STATUSES.includes(String(status).toUpperCase())) {
      data.status = String(status).toUpperCase();
      if (data.status === 'RESOLVIDO' && point.status !== 'RESOLVIDO') {
        data.resolvedAt = new Date();
        data.resolvedById = req.user.id;
      } else if (data.status === 'PENDENTE') {
        data.resolvedAt = null;
        data.resolvedById = null;
      }
    }
    data.updatedAt = new Date();

    const updated = await prisma.opportunityAttentionPoint.update({
      where: { id },
      data,
      include: {
        author: { select: { id: true, name: true, email: true } },
        resolvedBy: { select: { id: true, name: true } }
      }
    });

    return res.json(updated);
  } catch (err) {
    console.error('Erro ao atualizar ponto de atenção:', err);
    return res.status(500).json({ error: 'Erro ao atualizar ponto de atenção' });
  }
});

// ─── DELETE /api/opportunity-attention-points/:id ─────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const point = await prisma.opportunityAttentionPoint.findUnique({
      where: { id },
      select: { id: true, authorId: true }
    });

    if (!point) {
      return res.status(404).json({ error: 'Ponto de atenção não encontrado' });
    }

    const role = String(req.user.actualRole || req.user.role).toUpperCase();
    const isAdminOrMaster = ['ADMIN', 'MASTER'].includes(role);
    const isOwner = point.authorId === req.user.id;

    if (!isOwner && !isAdminOrMaster) {
      return res.status(403).json({ error: 'Você só pode remover seus próprios pontos de atenção' });
    }

    await prisma.opportunityAttentionPoint.delete({ where: { id } });
    return res.json({ message: 'Ponto de atenção removido com sucesso' });
  } catch (err) {
    console.error('Erro ao remover ponto de atenção:', err);
    return res.status(500).json({ error: 'Erro ao remover ponto de atenção' });
  }
});

module.exports = router;
