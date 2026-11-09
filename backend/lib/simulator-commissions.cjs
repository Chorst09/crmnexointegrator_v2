/**
 * Tabelas de comissão do simulador salvas em SystemSetting
 * Chave: simulator_commissions_v1
 */
'use strict';

const SETTINGS_KEY = 'simulator_commissions_v1';

const DEFAULTS = {
  channel_seller: {
    id: 'cs_default_001',
    months_12: 0.30,
    months_24: 0.60,
    months_36: 1.00,
    months_48: 1.00,
    months_60: 1.00
  },
  channel_director: {
    id: 'cd_default_001',
    months_12: 0.60,
    months_24: 1.20,
    months_36: 2.00,
    months_48: 2.00,
    months_60: 2.00
  },
  seller: {
    id: 's_default_001',
    months_12: 1.2,
    months_24: 2.4,
    months_36: 3.6,
    months_48: 3.6,
    months_60: 3.6
  },
  channel_influencer: [
    { id: 'ci_range_001', revenue_range: 'Até 500,00',          revenue_min: 0,       revenue_max: 500,      months_12: 1.50, months_24: 2.00, months_36: 2.50, months_48: 2.50, months_60: 2.50 },
    { id: 'ci_range_002', revenue_range: '500,01 a 1.000,00',   revenue_min: 500.01,  revenue_max: 1000,     months_12: 2.51, months_24: 3.25, months_36: 4.00, months_48: 4.00, months_60: 4.00 },
    { id: 'ci_range_003', revenue_range: '1.000,01 a 1.500,00', revenue_min: 1000.01, revenue_max: 1500,     months_12: 4.01, months_24: 4.50, months_36: 5.00, months_48: 5.00, months_60: 5.00 },
    { id: 'ci_range_004', revenue_range: '1.500,01 a 3.000,00', revenue_min: 1500.01, revenue_max: 3000,     months_12: 5.01, months_24: 5.50, months_36: 6.00, months_48: 6.00, months_60: 6.00 },
    { id: 'ci_range_005', revenue_range: '3.000,01 a 5.000,00', revenue_min: 3000.01, revenue_max: 5000,     months_12: 6.01, months_24: 6.50, months_36: 7.00, months_48: 7.00, months_60: 7.00 },
    { id: 'ci_range_006', revenue_range: 'Acima de 5.000,01',   revenue_min: 5000.01, revenue_max: 99999999, months_12: 7.01, months_24: 7.50, months_36: 8.00, months_48: 8.00, months_60: 8.00 }
  ],
  channel_indicator: [
    { id: 'cind_range_001', revenue_range: 'Até 500,00',          revenue_min: 0,       revenue_max: 500,      months_12: 0.50, months_24: 0.67, months_36: 0.83, months_48: 0.83, months_60: 0.83 },
    { id: 'cind_range_002', revenue_range: '500,01 a 1.000,00',   revenue_min: 500.01,  revenue_max: 1000,     months_12: 0.84, months_24: 1.08, months_36: 1.33, months_48: 1.33, months_60: 1.33 },
    { id: 'cind_range_003', revenue_range: '1.000,01 a 1.500,00', revenue_min: 1000.01, revenue_max: 1500,     months_12: 1.34, months_24: 1.50, months_36: 1.67, months_48: 1.67, months_60: 1.67 },
    { id: 'cind_range_004', revenue_range: '1.500,01 a 3.000,00', revenue_min: 1500.01, revenue_max: 3000,     months_12: 1.67, months_24: 1.83, months_36: 2.00, months_48: 2.00, months_60: 2.00 },
    { id: 'cind_range_005', revenue_range: '3.000,01 a 5.000,00', revenue_min: 3000.01, revenue_max: 5000,     months_12: 2.00, months_24: 2.17, months_36: 2.50, months_48: 2.50, months_60: 2.50 },
    { id: 'cind_range_006', revenue_range: 'Acima de 5.000,01',   revenue_min: 5000.01, revenue_max: 99999999, months_12: 2.34, months_24: 2.50, months_36: 3.00, months_48: 3.00, months_60: 3.00 }
  ]
};

async function readCommissions(prisma) {
  const row = await prisma.systemSetting.findUnique({ where: { key: SETTINGS_KEY } });
  try {
    return row?.value ? { ...DEFAULTS, ...JSON.parse(row.value) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

async function writeCommissions(prisma, data) {
  await prisma.systemSetting.upsert({
    where:  { key: SETTINGS_KEY },
    update: { value: JSON.stringify(data) },
    create: { key: SETTINGS_KEY, value: JSON.stringify(data) }
  });
  return data;
}

function createSimulatorCommissionsRouter({ prisma, authenticateToken }) {
  const express = require('express');
  const router  = express.Router();

  // GET /api/simulator/commissions
  router.get('/', authenticateToken, async (req, res) => {
    try {
      const data = await readCommissions(prisma);
      return res.json({ success: true, data });
    } catch (err) {
      console.error('❌ simulator-commissions GET:', err);
      return res.status(500).json({ success: false, error: 'Erro ao buscar comissões' });
    }
  });

  // PUT /api/simulator/commissions
  // body: { table, id, field, value }
  router.put('/', authenticateToken, async (req, res) => {
    try {
      const { table, id, field, value } = req.body || {};
      const VALID_TABLES = ['channel_seller', 'channel_director', 'seller', 'channel_influencer', 'channel_indicator'];
      if (!VALID_TABLES.includes(table)) {
        return res.status(400).json({ success: false, error: 'Tabela inválida' });
      }

      const data = await readCommissions(prisma);

      if (Array.isArray(data[table])) {
        // Tabela de faixas
        const idx = data[table].findIndex(r => r.id === id);
        if (idx === -1) return res.status(404).json({ success: false, error: 'Linha não encontrada' });
        data[table][idx] = { ...data[table][idx], [field]: Number(value) };
      } else {
        // Tabela única
        data[table] = { ...data[table], [field]: Number(value) };
      }

      await writeCommissions(prisma, data);
      return res.json({ success: true, data: data[table] });
    } catch (err) {
      console.error('❌ simulator-commissions PUT:', err);
      return res.status(500).json({ success: false, error: 'Erro ao salvar comissão' });
    }
  });

  return router;
}

module.exports = { createSimulatorCommissionsRouter };
