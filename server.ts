import express from 'express';
import path from 'path';
import fs from 'fs';
import net from 'net';
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
        if (key && !key.startsWith('#') && !(key in process.env)) {
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
const HOST = '0.0.0.0';
const DEFAULT_PORT = 3000;
const PORT_EXPLICIT = process.env.PORT !== undefined && process.env.PORT !== '';
const PORT = PORT_EXPLICIT ? parseInt(process.env.PORT as string, 10) : DEFAULT_PORT;

const findAvailablePort = (startPort: number, attempts = 20): Promise<number> =>
  new Promise((resolve, reject) => {
    const attempt = (port: number, remaining: number) => {
      const probe = net.createServer();
      probe.once('error', (err: NodeJS.ErrnoException) => {
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

  const webDistPath = path.resolve(__dirname, 'apps/web/dist');

  // Serve static files first if they exist so assets are never blocked by API middlewares
  if (fs.existsSync(webDistPath)) {
    console.log(`📦 Servindo arquivos estáticos de produção: ${webDistPath}`);
    app.use(express.static(webDistPath));
  }

  // Load API application from apps/api
  try {
    const apiApp = require('./apps/api/server.cjs');
    app.use(apiApp);
    console.log('✅ API backend montado em /api');
  } catch (err: any) {
    console.error('⚠️  Aviso ao carregar apps/api/server.cjs:', err?.message || err);
  }

  if (fs.existsSync(webDistPath)) {
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
    } catch (err: any) {
      console.error(`❌ Nenhuma porta livre a partir de ${PORT}:`, err?.message || err);
      process.exit(1);
    }
  }

  const server = app.listen(activePort, HOST, () => {
    console.log(`🚀 CRM NEXOS rodando em http://localhost:${activePort}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
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
