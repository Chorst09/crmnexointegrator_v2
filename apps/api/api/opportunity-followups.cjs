'use strict';

const express = require('express');
const { prisma } = require('../lib/prisma.cjs');
const router = express.Router();

// GET /api/opportunity-followups/:opportunityId
router.get('/:opportunityId', async (req, res) => {
  const { opportunityId } = req.params;
  try {
    const followUps = await prisma.opportunityFollowUp.findMany({
      where: { opportunityId },
      include: {
        user: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(followUps);
  } catch (err) {
    console.error('Erro ao listar acompanhamentos:', err);
    return res.status(500).json({ error: 'Erro ao listar acompanhamentos' });
  }
});

// POST /api/opportunity-followups
router.post('/', async (req, res) => {
  const user = req.user;
  const { opportunityId, type, content } = req.body;

  if (!opportunityId || !content) {
    return res.status(400).json({ error: 'Os campos opportunityId e content são obrigatórios' });
  }

  const VALID_TYPES = ['NOTE', 'CALL', 'EMAIL', 'MEETING', 'WHATSAPP'];
  const normalizedType = VALID_TYPES.includes(String(type || '').toUpperCase())
    ? String(type).toUpperCase()
    : 'NOTE';

  try {
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { id: true }
    });
    if (!opportunity) {
      return res.status(404).json({ error: 'Oportunidade não encontrada' });
    }

    const followUp = await prisma.opportunityFollowUp.create({
      data: {
        opportunityId,
        userId: user.id,
        type: normalizedType,
        content: String(content).trim()
      },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });

    return res.status(201).json(followUp);
  } catch (err) {
    console.error('Erro ao criar acompanhamento:', err);
    return res.status(500).json({ error: 'Erro ao criar acompanhamento' });
  }
});

// DELETE /api/opportunity-followups/:id
router.delete('/:id', async (req, res) => {
  const user = req.user;
  const { id } = req.params;

  try {
    const followUp = await prisma.opportunityFollowUp.findUnique({
      where: { id }
    });

    if (!followUp) {
      return res.status(404).json({ error: 'Acompanhamento não encontrado' });
    }

    const role = String(user.role || '').toUpperCase();
    const isAdminOrMaster = ['ADMIN', 'MASTER'].includes(role);
    const isOwner = followUp.userId === user.id;

    if (!isOwner && !isAdminOrMaster) {
      return res.status(403).json({ error: 'Você só pode remover seus próprios acompanhamentos' });
    }

    await prisma.opportunityFollowUp.delete({ where: { id } });
    return res.json({ message: 'Acompanhamento removido com sucesso' });
  } catch (err) {
    console.error('Erro ao remover acompanhamento:', err);
    return res.status(500).json({ error: 'Erro ao remover acompanhamento' });
  }
});

module.exports = router;
