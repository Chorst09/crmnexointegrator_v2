/**
 * API de Propostas do Módulo Simuladores
 * Rota: /api/simulator/proposals
 *
 * Armazena propostas geradas pelas calculadoras do Simulador.
 */
const express = require('express');
const { prisma } = require('../lib/prisma.cjs');
const { authenticateToken } = require('../lib/auth.cjs');

const router = express.Router();

// Helper: normaliza proposta do formato do Simulador
const normalizeProposal = (data) => ({
  baseId: String(data.base_id || data.baseId || ''),
  version: Number(data.version || 1),
  title: String(data.title || 'Proposta'),
  client: typeof data.client === 'string' ? data.client : (data.client?.name || 'N/A'),
  type: String(data.type || 'standard').toUpperCase(),
  value: parseFloat(data.value || data.totalMonthly || 0),
  status: String(data.status || 'Rascunho'),
  forecastTemperature: data.forecastTemperature != null ? Number(data.forecastTemperature) : null,
  metadata: data.metadata || data,
  createdBy: String(data.createdBy || data.created_by || ''),
  accountManager: typeof data.accountManager === 'string'
    ? data.accountManager
    : JSON.stringify(data.accountManager || {}),
  distributorId: String(data.distributorId || data.distributor_id || ''),
});

// Middleware opcional de autenticação que não bloqueia caso o token esteja em outro formato
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticateToken(req, res, next);
  }
  return next();
};

// ─── GET /api/simulator/proposals ─────────────────────────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { type, all, dashboard } = req.query;
    const userId = req.user?.userId || req.user?.id;

    // Filtro base
    const where = {};
    if (type && type !== 'all') where.type = type.toUpperCase();

    // Se usuário autenticado não-master/admin, filtra por criador caso tenha
    const role = String(req.user?.role || '').toUpperCase();
    if (userId && !['MASTER', 'ADMIN', 'MANAGER', 'DIRECTOR'].includes(role)) {
      where.createdBy = req.user?.email || userId;
    }

    let rows = [];
    try {
      rows = await prisma.simulatorProposal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: all || dashboard ? 1000 : 100,
      });
    } catch (dbErr) {
      console.warn('⚠️ Falha ao buscar simulatorProposal do banco:', dbErr.message);
      rows = [];
    }

    const proposals = (Array.isArray(rows) ? rows : []).map(r => ({
      id: r.id,
      baseId: r.baseId,
      base_id: r.baseId,
      version: r.version,
      title: r.title,
      client: r.client,
      type: r.type,
      value: Number(r.value || 0),
      status: r.status,
      forecastTemperature: r.forecastTemperature,
      metadata: r.metadata,
      createdBy: r.createdBy,
      accountManager: (() => {
        try {
          return typeof r.accountManager === 'string' && r.accountManager.startsWith('{')
            ? JSON.parse(r.accountManager)
            : r.accountManager;
        } catch {
          return r.accountManager;
        }
      })(),
      distributorId: r.distributorId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return res.json({ success: true, proposals, data: { proposals } });
  } catch (err) {
    console.error('❌ simulator-proposals GET:', err);
    return res.status(500).json({ success: false, error: 'Erro ao buscar propostas' });
  }
});

// ─── POST /api/simulator/proposals ────────────────────────────────────────────
router.post('/', optionalAuth, async (req, res) => {
  try {
    const normalized = normalizeProposal(req.body);
    const userId = req.user?.email || req.user?.userId || req.user?.id || 'vendedor';

    if (!normalized.baseId) {
      normalized.baseId = `PROP-${Date.now().toString().slice(-6)}`;
    }
    if (!normalized.createdBy) {
      normalized.createdBy = userId;
    }

    // Verificar se já existe (upsert por baseId + version)
    let existing = null;
    try {
      existing = await prisma.simulatorProposal.findFirst({
        where: { baseId: normalized.baseId, version: normalized.version },
      });
    } catch (e) {}

    let saved;
    const crypto = require('crypto');
    if (existing) {
      saved = await prisma.simulatorProposal.update({
        where: { id: existing.id },
        data: { ...normalized, updatedAt: new Date() },
      });
    } else {
      saved = await prisma.simulatorProposal.create({
        data: {
          id: crypto.randomUUID(),
          ...normalized,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }

    return res.status(201).json({ success: true, data: saved });
  } catch (err) {
    console.error('❌ simulator-proposals POST:', err);
    return res.status(500).json({ success: false, error: 'Erro ao salvar proposta' });
  }
});

// ─── PUT /api/simulator/proposals/:id ─────────────────────────────────────────
router.put('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const normalized = normalizeProposal(req.body);

    const updated = await prisma.simulatorProposal.update({
      where: { id },
      data: { ...normalized, updatedAt: new Date() },
    });

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('❌ simulator-proposals PUT:', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar proposta' });
  }
});

// ─── DELETE /api/simulator/proposals/:id ──────────────────────────────────────
router.delete('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.simulatorProposal.delete({ where: { id } });
    return res.json({ success: true });
  } catch (err) {
    console.error('❌ simulator-proposals DELETE:', err);
    return res.status(500).json({ success: false, error: 'Erro ao excluir proposta' });
  }
});

module.exports = router;
