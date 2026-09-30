const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

async function startServer() {
  // Load API backend
  try {
    const apiApp = require('./apps/api/server.cjs');
    app.use(apiApp);
    console.log('✅ API backend montado em /api');
  } catch (err) {
    console.error('⚠️ Aviso ao carregar apps/api/server.cjs:', err?.message || err);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const webDistPath = path.resolve(__dirname, 'apps/web/dist');

  if (isProduction && fs.existsSync(webDistPath)) {
    console.log(`📦 Modo produção: servindo arquivos de ${webDistPath}`);
    app.use(express.static(webDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(webDistPath, 'index.html'));
    });
  } else {
    console.log('⚡ Modo desenvolvimento: inicializando Vite middleware...');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: HOST,
        allowedHosts: true
      },
      appType: 'spa',
      root: path.resolve(__dirname, 'apps/web'),
    });

    app.use(vite.middlewares);
  }

  app.listen(PORT, HOST, () => {
    console.log(`🚀 CRM NEXOS rodando em http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('❌ Falha ao iniciar servidor:', err);
  process.exit(1);
});
