const express = require('express');
const router = express.Router();

// Teste simples sem banco
router.get('/test', async (req, res) => {
  res.json({
    success: true,
    message: 'API Filtros TI funcionando!',
    timestamp: new Date().toISOString()
  });
});

// Teste com banco - usando query raw
router.get('/categorias', async (req, res) => {
  try {
    // Usar a instância global do Prisma se disponível
    if (global.prisma) {
      const result = await global.prisma.$queryRaw`
        SELECT COUNT(*) as total FROM categorias_filtro_ti
      `;
      res.json({
        success: true,
        message: 'Banco conectado',
        data: result
      });
    } else {
      res.json({
        success: false,
        error: 'Prisma não disponível',
        globalKeys: Object.keys(global)
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
});

module.exports = router;