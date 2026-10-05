/**
 * API de Propostas do Módulo Simuladores
 * Rota: /api/simulator/proposals
 *
 * Armazena propostas geradas pelas calculadoras do Simulador
 * usando tabela própria (SimulatorProposal) no PostgreSQL via Prisma.
 */
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../lib/auth');

const router = express.Router();
const prisma = new PrismaClient();

// ─── Helper: normaliza proposta do formato do Simulador ───────────────────────
const normalizeProposal = (data) => ({
  baseId:     String(data.base_id || data.baseId || ''),
  version:    Number(data.version || 1),
  title:      String(data.title || 'Proposta'),
  client:     typeof data.client === 'string' ? data.client : (data.client?.name || 'N/A'),
  type:       String(data.type || 'standard').toUpperCase(),
  value:      parseFloat(data.value || data.totalMonthly || 0),
  status:     String(data.status || 'Rascunho'),
  forecastTemperature: data.forecastTemperature != null ? Number(data.forecastTemperature) : null,
  metadata:   data.metadata || data,
  createdBy:  String(data.createdBy || data.created_by || ''),
  accountManager: typeof data.accountManager === 'string'
    ? data.accountManager
    : JSON.stringify(data.accountManager || {}),
  distributorId: String(data.distributorId || data.distributor_id || ''),
});

// ─── GET /api/simulator/proposals ─────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { type, all, dashboard } = req.query;
    const userId = req.user?.userId || req.user?.id;

    // Filtro base
    const where = {};
    if (type && type !== 'all') where.type = type.toUpperCase();

    // Usuários comuns só veem as próprias propostas
    const role = String(req.user?.role || '').toUpperCase();
    if (!['MASTER', 'ADMIN', 'MANAGER', 'DIRECTOR'].includes(role)) {
      where.createdBy = req.user?.email || userId;
    }

    const rows = await prisma.simulatorProposal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: all || dashboard ? 1000 : 100,
    });

    const proposals = rows.map(r => ({
      id:                 r.id,
      baseId:             r.baseId,
      base_id:            r.baseId,
      version:            r.version,
      title:              r.title,
      client:             r.client,
      type:               r.type,
      value:              r.value,
      status:             r.status,
      forecastTemperature: r.forecastTemperature,
      metadata:           r.metadata,
      createdBy:          r.createdBy,
      accountManager:     (() => { try { return JSON.parse(r.accountManager || '{}'); } catch { return r.accountManager; } })(),
      distributorId:      r.distributorId,
      createdAt:          r.createdAt,
      updatedAt:          r.updatedAt,
    }));

    return res.json({ success: true, data: { proposals } });
  } catch (err) {
    console.error('❌ simulator-proposals GET:', err);
    return res.status(500).json({ success: false, error: 'Erro ao buscar propostas' });
  }
});

// ─── POST /api/simulator/proposals ────────────────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
  try {
    const normalized = normalizeProposal(req.body);

    if (!normalized.baseId) {
      return res.status(400).json({ success: false, error: 'base_id é obrigatório' });
    }

    // Verificar se já existe (upsert por baseId + version)
    const existing = await prisma.simulatorProposal.findFirst({
      where: { baseId: normalized.baseId, version: normalized.version },
    });

    let saved;
    if (existing) {
      saved = await prisma.simulatorProposal.update({
        where: { id: existing.id },
        data: { ...normalized, updatedAt: new Date() },
      });
    } else {
      saved = await prisma.simulatorProposal.create({ data: normalized });
    }

    return res.status(201).json({ success: true, data: saved });
  } catch (err) {
    console.error('❌ simulator-proposals POST:', err);
    return res.status(500).json({ success: false, error: 'Erro ao salvar proposta' });
  }
});

// ─── PUT /api/simulator/proposals/:id ─────────────────────────────────────────
router.put('/:id', authenticateToken, async (req, res) => {
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
router.delete('/:id', authenticateToken, async (req, res) => {
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
