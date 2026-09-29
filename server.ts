import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Load .env manually if exists in root folder
try {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf-8');
    envFile.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        let value = parts.slice(1).join('=').trim();
        // Remove surrounding quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1);
        }
        if (key && !key.startsWith('#')) {
          process.env[key] = value;
          // Clean up escaped double quotes from shell injection
          process.env[key] = process.env[key].replace(/\\"/g, '"');
        }
      }
    });
  }
} catch (e) {
  console.warn('Aviso ao carregar .env manualmente:', e);
}

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

async function startServer() {
  // Direct route for commercial proposal PPTX template
  app.get(['/proposta-comercial-double.pptx', '/api/proposta-comercial-double.pptx'], (_req, res) => {
    const webPath = path.resolve(__dirname, 'apps/web/public/proposta-comercial-double.pptx');
    const apiPath = path.resolve(__dirname, 'apps/api/public/proposta-comercial-double.pptx');
    const distPath = path.resolve(__dirname, 'apps/web/dist/proposta-comercial-double.pptx');
    const target = fs.existsSync(webPath) ? webPath : (fs.existsSync(distPath) ? distPath : (fs.existsSync(apiPath) ? apiPath : null));
    if (target) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      res.setHeader('Content-Disposition', 'inline; filename="proposta-comercial-double.pptx"');
      return res.sendFile(target);
    }
    res.status(404).json({ error: 'Template PPTX não encontrado' });
  });

  // Load API application from apps/api
  try {
    const apiApp = require('./apps/api/server.cjs');
    app.use(apiApp);
    console.log('✅ API backend montado em /api');
  } catch (err: any) {
    console.error('⚠️  Aviso ao carregar apps/api/server.cjs:', err?.message || err);
  }

  const webDistPath = path.resolve(__dirname, 'apps/web/dist');

  if (fs.existsSync(webDistPath)) {
    console.log(`📦 Servindo arquivos estáticos de produção: ${webDistPath}`);
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
  }).on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️  Porta ${PORT} em uso, tentando porta ${PORT + 1}...`);
      app.listen(PORT + 1, HOST, () => {
        console.log(`🚀 CRM NEXOS rodando em http://${HOST}:${PORT + 1}`);
      });
    } else {
      console.error('❌ Erro ao iniciar servidor:', err);
      process.exit(1);
    }
  });
}

startServer().catch((err) => {
  console.error('❌ Falha ao iniciar servidor:', err);
  process.exit(1);
});
