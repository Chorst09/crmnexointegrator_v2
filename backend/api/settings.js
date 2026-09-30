const express = require('express');
const router = express.Router();

// GET /api/settings - Retorna configurações do sistema
router.get('/', (req, res) => {
  try {
    res.json({
      appName: 'CRM NEXOS',
      logoUrl: null,
      theme: 'light',
      version: '1.0.0'
    });
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
});

module.exports = router;
