const express = require('express');
const path = require('path');
const fs = require('fs');
const net = require('net');

const app = express();
const HOST = '0.0.0.0';
const DEFAULT_PORT = 3000;
const PORT_EXPLICIT = Boolean(process.env.PORT);
const PORT = PORT_EXPLICIT ? parseInt(process.env.PORT, 10) : DEFAULT_PORT;

const findAvailablePort = (startPort, attempts = 20) =>
  new Promise((resolve, reject) => {
    const attempt = (port, remaining) => {
      const probe = net.createServer();
      probe.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && remaining > 0) {
          attempt(port + 1, remaining - 1);
          return;
        }
        reject(err);
      });
      probe.once('listening', () => probe.close(() => resolve(port)));
      probe.listen(port, HOST);
    };
    attempt(startPort, attempts);
  });

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

  let activePort = PORT;
  if (!PORT_EXPLICIT) {
    try {
      activePort = await findAvailablePort(PORT);
      if (activePort !== PORT) {
        console.warn(`⚠️  Porta ${PORT} já está em uso. Iniciando na porta ${activePort} (defina PORT= no .env para fixar).`);
      }
    } catch (err) {
      console.error(`❌ Nenhuma porta livre a partir de ${PORT}:`, err?.message || err);
      process.exit(1);
    }
  }

  const server = app.listen(activePort, HOST, () => {
    console.log(`🚀 CRM NEXOS rodando em http://localhost:${activePort}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ EADDRINUSE: a porta ${activePort} já está em uso.`);
      console.error(`   Verifique o processo: lsof -nP -iTCP:${activePort} -sTCP:LISTEN`);
      console.error(`   Encerre com:         kill $(lsof -ti tcp:${activePort})`);
      console.error(`   Ou defina outra porta: PORT=3001 npm start\n`);
    } else {
      console.error('❌ Erro no servidor HTTP:', err);
    }
    process.exit(1);
  });
}

startServer().catch((err) => {
  console.error('❌ Falha ao iniciar servidor:', err);
  process.exit(1);
});
