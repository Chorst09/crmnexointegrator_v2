require('./lib/load-env.cjs');

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('./lib/auth.cjs');

// Catch unhandled promise rejections to prevent the process from crashing.
// This is critical in production to avoid intermittent 502 errors when
// an unexpected async error occurs (e.g. DB connection timeout, extension race).
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔴 UNHANDLED REJECTION (capturado para evitar crash):');
  console.error('   Motivo:', reason instanceof Error ? reason.message : reason);
  console.error('   Stack:', reason instanceof Error ? reason.stack : '');
});

process.on('uncaughtException', (error) => {
  console.error('🔴 UNCAUGHT EXCEPTION (capturado para evitar crash):');
  console.error('   Mensagem:', error.message);
  console.error('   Stack:', error.stack);
});
const { canAccessModule, isMaster, normalizeRole } = require('./lib/permissions.cjs');

// Importar apenas as rotas CommonJS (novas)
const authRoutes = require('./api/auth.cjs');
const contractsRoutes = require('./api/contracts.cjs');
const postSalesRoutes = require('./api/postSales.cjs');
const workflowsRoutes = require('./api/workflows.cjs');
const proposalsRoutes = require('./api/proposals.cjs');
const productsRoutes = require('./api/products.cjs');
const preVendasRoutes = require('./api/pre-vendas.cjs');
const preSalesPocsRoutes = require('./api/pre-sales-pocs.cjs');
const settingsRoutes = require('./api/settings.cjs');
const companiesDocumentsRoutes = require('./api/company-documents.cjs');
const b2gRoutes = require('./api/b2g.cjs');
const aiAnalysisRoutes = require('./api/ai-analysis.cjs');
const savedAnalysesRoutes = require('./api/saved-analyses.cjs');
const integrationApiRoutes = require('./api/integration.cjs');
const licensingRoutes = require('./api/licensing.cjs');
const projetosRoutes = require('./api/projetos.cjs');
const attentionPointsRoutes = require('./api/attention-points.cjs');
const learningsRoutes = require('./api/learnings.cjs');
const { ensureProposalTemplates } = require('./lib/ensure-proposal-templates.cjs');

const app = express();
const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || '0.0.0.0';
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const isDevelopment = process.env.NODE_ENV !== 'production';

const isLocalDevOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin || '');

console.log('🔧 CORS Origins configuradas:', corsOrigins);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (isLocalDevOrigin(origin)) return true;
  
  // Always permit AI Studio preview environments (*.run.app and google.com)
  if (/\.run\.app$/i.test(origin) || /\.google\.com$/i.test(origin) || origin === 'https://aistudio.google.com') {
    return true;
  }

  // Always permit chorstconsult.com.br domains and subdomains (e.g. nexos, nexosv2)
  const cleanOrigin = origin.replace(/^https?:\/\//i, '').split(':')[0].toLowerCase();
  if (cleanOrigin === 'chorstconsult.com.br' || cleanOrigin.endsWith('.chorstconsult.com.br')) {
    return true;
  }

  // Always permit VPS server IP
  if (cleanOrigin === '209.50.241.25') {
    return true;
  }

  // Permit any configured explicit origins
  if (corsOrigins.length > 0 && corsOrigins.includes(origin)) {
    return true;
  }

  // If no explicit production domains were configured, or if in development
  if (corsOrigins.length === 0 || isDevelopment) {
    return true;
  }

  return false;
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    console.warn('⚠️ CORS bloqueado para origin:', origin, 'Origins configuradas:', corsOrigins);
    return callback(null, false);
  },
  credentials: true
};

// Ensure the built-in proposal templates exist.
// Runs once per process (or per serverless cold start) and is safe to fail without taking the API down.
let ensureTemplatesPromise = null;
const ensureTemplatesOnce = async () => {
  if (ensureTemplatesPromise) return ensureTemplatesPromise;

  ensureTemplatesPromise = (async () => {
    try {
      return await ensureProposalTemplates();
    } catch (e) {
      // Don't crash the server if DB isn't ready; routes will surface errors anyway.
      console.warn('⚠️  Falha ao garantir templates de proposta:', e.message);
      return [];
    }
  })();

  return ensureTemplatesPromise;
};

// Fire-and-forget to recover missing templates even when the API is imported as a serverless handler.
ensureTemplatesOnce();

const enforceRolePolicies = (req, res, next) => {
  // Only enforce for authenticated routes
  if (!req.user) return next();

  // Path here is WITHOUT the /api prefix because this middleware is mounted at /api
  const p = req.path || '/';
  const role = normalizeRole(req.user.actualRole || req.user.role);
  const requestedClientType = String(req.query?.clientType || '').trim().toUpperCase();
  const dashboardType = String(req.query?.type || '').trim().toLowerCase();

  // MASTER tem acesso total ao sistema, mas queries devem filtrar por tenantCompanyId
  if (isMaster(req.user) || role === 'ADMIN') return next();

  if (p.startsWith('/dashboard') && dashboardType === 'general') {
    const hasAnyModuleAccess =
      canAccessModule(req.user, 'B2B') ||
      canAccessModule(req.user, 'B2G') ||
      canAccessModule(req.user, 'PRE_SALES') ||
      canAccessModule(req.user, 'GESTAO') ||
      canAccessModule(req.user, 'AUTOMATION');

    if (!hasAnyModuleAccess && !req.user.permissions?.dashboard) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    return next();
  }

  const isAdminAreaPath = p.startsWith('/administracao') || p.startsWith('/licensing');
  if (isAdminAreaPath) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const isPreSalesPath =
    p.startsWith('/pre-vendas') ||
    p.startsWith('/solicitacoes') ||
    p.startsWith('/pre-sales-pocs') ||
    p.startsWith('/prevendas-cadastros');
  if (isPreSalesPath && !canAccessModule(req.user, 'PRE_SALES')) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const isSharedPipelineB2GPath =
    requestedClientType === 'B2G' &&
    (
      p.startsWith('/companies') ||
      p.startsWith('/clients') ||
      p.startsWith('/opportunities') ||
      p.startsWith('/activities') ||
      p.startsWith('/activities-simple') ||
      p.startsWith('/dashboard') ||
      p.startsWith('/leadScoring') ||
      p.startsWith('/leadDistribution')
    );

  const isB2GPath =
    p.startsWith('/b2g') || p.startsWith('/ai-analysis') || p.startsWith('/analyses') || isSharedPipelineB2GPath;
  if (isB2GPath && !canAccessModule(req.user, 'B2G')) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const isB2BPathPrefixes = [
    '/companies',
    '/clients',
    '/opportunities',
    '/activities',
    '/activities-simple',
    '/products',
    '/proposals',
    '/proposal-templates',
    '/contracts',
    '/dashboard',
    '/commissions',
    '/leadScoring',
    '/leadDistribution'
  ];
  const isB2BPath = isB2BPathPrefixes.some((prefix) => p.startsWith(prefix));
  if (isB2BPath && requestedClientType !== 'B2G' && !canAccessModule(req.user, 'B2B')) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  if (role === 'PRE_SALES') {
    const allowedPreSalesPrefixes = [
      '/pre-vendas',
      '/pre-sales-pocs',
      '/solicitacoes',
      '/activities-simple',
      '/prevendas-cadastros',
      '/settings',
      '/users'
    ];
    const allowed = allowedPreSalesPrefixes.some((prefix) => p.startsWith(prefix));
    if (!allowed) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
  }

  return next();
};

// Middlewares
app.use(cors(corsOptions));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '150mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT || '150mb' }));

// Timeout global para requests - evita que conexões lentas ao banco
// ou erros inesperados deixem requisições pendentes, consumindo
// conexões do pool do Prisma e causando 502 no nginx.
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '25000', 10);
const AI_ANALYSIS_REQUEST_TIMEOUT = parseInt(process.env.AI_ANALYSIS_REQUEST_TIMEOUT || '150000', 10);
app.use((req, res, next) => {
  // Não aplica timeout ao health check
  if (req.path === '/health') return next();

  const isBackupRoute = req.path.startsWith('/api/admin/backup');
  const isDownloadRoute = req.path.startsWith('/api/b2g-licitacoes/proxy-download') || req.path.includes('/documento-gerado/');
  const requestTimeout = req.path.startsWith('/api/ai-analysis/')
    ? AI_ANALYSIS_REQUEST_TIMEOUT
    : (isBackupRoute ? 600000 : (isDownloadRoute ? 120000 : REQUEST_TIMEOUT));
  res.setTimeout(requestTimeout, () => {
    console.error(`⏰ Request timeout (${requestTimeout}ms): ${req.method} ${req.path}`);
    if (!res.headersSent) {
      res.status(503).json({ error: 'Tempo limite da requisição excedido' });
    }
  });
  next();
});

// Expor apenas assets públicos do sistema. Documentos e anexos passam por rotas autenticadas.
app.use('/uploads/system', express.static(path.join(__dirname, 'uploads/system')));

// Rotas públicas
app.use('/api/auth', authRoutes);
app.use('/api/integration', integrationApiRoutes);
app.use('/api/licensing', licensingRoutes);
app.use('/api/checkout', require('./api/checkout.cjs'));

// Auth + RBAC para todo o restante da API (exceto /auth e /health)
app.use('/api', (req, res, next) => {
  if (
    req.path.startsWith('/auth') ||
    req.path === '/health' ||
    req.path.startsWith('/settings') ||
    req.path.startsWith('/opportunity-followups') ||
    req.path.startsWith('/b2g-licitacoes') ||
    req.path.startsWith('/b2g-search') ||
    req.path.startsWith('/proxy-download') ||
    req.path.startsWith('/pncp-arquivos') ||
    req.path.startsWith('/proposta-comercial-double.pptx') ||
    req.path.startsWith('/analise-tr') ||
    req.path.startsWith('/simulator/proposals')
  ) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authenticateToken(req, res, () => next());
    }
    return next();
  }
  return authenticateToken(req, res, next);
});
app.use('/api', enforceRolePolicies);

// Rotas da API (novas - CommonJS)
app.use('/api/contracts', contractsRoutes);
app.use('/api/post-sales', postSalesRoutes);
app.use('/api/workflows', workflowsRoutes);
app.use('/api/proposals', proposalsRoutes);
const proposalTemplatesRoutes = require('./api/proposal-templates.cjs');
app.use('/api/proposal-templates', (req, res, next) => {
  ensureTemplatesOnce().then(() => next()).catch(() => next());
}, proposalTemplatesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/pre-vendas', preVendasRoutes);
app.use('/api/pre-sales-pocs', preSalesPocsRoutes);
app.use('/api/b2g', b2gRoutes);
app.use('/api/b2g-search', require('./api/b2g-search.cjs'));
app.use('/api/b2g-licitacoes', require('./api/b2g-licitacoes.cjs'));
app.get('/api/proxy-download', (req, res) => {
  const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  res.redirect(307, '/api/b2g-licitacoes/proxy-download' + query);
});
app.get('/api/pncp-arquivos', (req, res) => {
  const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  res.redirect(307, '/api/b2g-licitacoes/pncp-arquivos' + query);
});
app.get(['/api/proposta-comercial-double.pptx', '/proposta-comercial-double.pptx'], (req, res, next) => {
  const primaryPath = path.resolve(__dirname, '../web/public/proposta-comercial-double.pptx');
  const apiPath = path.resolve(__dirname, 'public/proposta-comercial-double.pptx');
  const targetFile = fs.existsSync(primaryPath) ? primaryPath : (fs.existsSync(apiPath) ? apiPath : null);

  if (targetFile) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', 'inline; filename="proposta-comercial-double.pptx"');
    return res.sendFile(targetFile);
  }

  try {
    const { execSync } = require('child_process');
    execSync('node /app/applet/scripts/build-pptx-template.cjs', { stdio: 'ignore' });
    if (fs.existsSync(primaryPath)) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      res.setHeader('Content-Disposition', 'inline; filename="proposta-comercial-double.pptx"');
      return res.sendFile(primaryPath);
    }
  } catch (err) {
    console.error('Erro ao gerar PPTX sob demanda:', err.message);
  }

  next();
});
app.use('/api/analise-tr', require('./api/b2g-licitacoes.cjs'));
app.use('/api/filtros-ti', require('./api/filtros-ti-search.cjs'));
app.use('/api/ai-analysis', aiAnalysisRoutes);
app.use('/api/analyses', savedAnalysesRoutes);
app.use('/api/companies', companiesDocumentsRoutes);
app.use('/api/projetos', projetosRoutes);
app.use('/api/opportunity-attention-points', attentionPointsRoutes);
app.use('/api/opportunity-learnings', learningsRoutes);
app.use('/api/kickoff', require('./api/kickoff.cjs'));
app.use('/api/audit-logs', require('./api/audit-logs.cjs'));
app.use('/api/admin/backup', require('./api/admin-backup.cjs'));
const testFlowB2B = require('./api/test-flow-b2b.cjs');
app.use('/api/test-flow-b2b', testFlowB2B.router);
app.use('/api/test-flow', testFlowB2B.router);

// Pré-executa o fluxo de teste B2B para que todos os 10 módulos já fiquem populados
// TEMPORARIAMENTE DESABILITADO: estava travando a inicialização do servidor
// testFlowB2B.executeB2BTestFlow()
//   .then(() => console.log('✅ Fluxo de Teste B2B E2E inicializado com sucesso em todos os módulos!'))
//   .catch((err) => console.warn('⚠️ Aviso ao inicializar fluxo de teste B2B:', err?.message || err));

// Handler para APIs antigas (ES modules) - conversão dinâmica
const handleLegacyAPI = (apiPath) => {
  return async (req, res) => {
    try {
      console.log(`🔄 handleLegacyAPI: ${req.method} ${req.path} -> ${apiPath}`);
      
      const fullPath = path.resolve(__dirname, apiPath);
      const { default: handler } = await import(`file://${fullPath}`);
      
      // Criar objeto request compatível
      const request = {
        method: req.method,
        url: req.url,
        query: req.query,
        json: async () => req.body || {},
        headers: req.headers,
        user: req.user
      };

      console.log(`📦 Request data: ${JSON.stringify({ method: req.method, query: req.query, body: req.body }, null, 2)}`);

      const response = await handler(request);
      
      if (response instanceof Response) {
        const status = response.status || 200;
        const contentType = response.headers?.get?.('content-type') || '';

        if (status === 204) {
          console.log(`✅ Response: ${status} (no content)`);
          return res.sendStatus(204);
        }

        if (contentType.includes('application/json')) {
          const data = await response.json().catch(() => ({}));
          console.log(`✅ Response JSON: ${status}`);
          return res.status(status).json(data);
        }

        const text = await response.text().catch(() => '');
        console.log(`✅ Response TEXT: ${status}`);
        if (!text) {
          return res.sendStatus(status);
        }
        return res.status(status).send(text);
      } else {
        console.log(`✅ Direct response`);
        res.json(response);
      }
    } catch (error) {
      console.error(`🔴 ERRO no handleLegacyAPI (${apiPath}):`);
      console.error('❌ Mensagem:', error.message);
      console.error('📚 Stack:', error.stack);
      console.error('🔢 Código:', error.code);
      console.error('📦 Request que causou erro:', JSON.stringify({
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.body
      }, null, 2));
      
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: error.message,
        code: error.code || 'LEGACY_API_ERROR',
        path: apiPath
      });
    }
  };
};

// Rotas das APIs antigas (ES modules)
app.use('/api/clients', handleLegacyAPI('./api/clients.js'));
app.use('/api/companies', handleLegacyAPI('./api/companies.js'));
app.use('/api/opportunities', handleLegacyAPI('./api/opportunities.js'));
app.use('/api/activities', handleLegacyAPI('./api/activities.js'));
// app.use('/api/products', handleLegacyAPI('./api/products.js')); // Agora usando CommonJS
// app.use('/api/proposals', handleLegacyAPI('./api/proposals.js')); // Agora usando CommonJS
app.use('/api/commissions', handleLegacyAPI('./api/commissions.js'));
app.use('/api/simulator/proposals', require('./api/simulator-proposals.cjs'));
app.use('/api/gestao/analise-financeira', require('./api/financial-analysis.cjs'));
app.use('/api/users', handleLegacyAPI('./api/users.js'));
app.use('/api/dashboard', handleLegacyAPI('./api/dashboard.js'));
app.use('/api/leadScoring', handleLegacyAPI('./api/leadScoring.js'));
app.use('/api/leadDistribution', handleLegacyAPI('./api/leadDistribution.js'));

// Novas APIs - Integrações
app.use('/api/integrations', handleLegacyAPI('./api/integrations.js'));
app.use('/api/whatsapp', handleLegacyAPI('./api/whatsapp.js'));
app.use('/api/email-marketing', handleLegacyAPI('./api/email-marketing.js'));
app.use('/api/voip', handleLegacyAPI('./api/voip.js'));

// Novas APIs - Funcionalidades Avançadas
app.use('/api/price-tables', handleLegacyAPI('./api/price-tables.js'));
app.use('/api/competitors', handleLegacyAPI('./api/competitors.js'));
app.use('/api/regions', handleLegacyAPI('./api/regions.js'));
app.use('/api/cross-sell', handleLegacyAPI('./api/cross-sell.js'));
app.use('/api/upsell', handleLegacyAPI('./api/upsell.js'));
app.use('/api/approvals', handleLegacyAPI('./api/approvals.js'));

// Novas APIs - Comissionamento Avançado
app.use('/api/sales-targets', handleLegacyAPI('./api/sales-targets.js'));
app.use('/api/team-commissions', handleLegacyAPI('./api/team-commissions.js'));

// Novas APIs - Workflows Avançados
app.use('/api/advanced-workflows', handleLegacyAPI('./api/advanced-workflows.js'));

// API de Solicitações de Orçamento
app.use('/api/solicitacoes', handleLegacyAPI('./api/solicitacoes.js'));

// API de Cadastros Pré-Vendas (distribuidores, fornecedores, registro de oportunidades)
app.use('/api/prevendas-cadastros', handleLegacyAPI('./api/prevendas-cadastros.js'));

// API de Atividades Simples (CommonJS)
app.use('/api/activities-simple', require('./api/activities-simple.cjs'));

// API de Acompanhamentos de Oportunidades (CommonJS)
console.log('📝 Carregando /api/opportunity-followups...');
try {
  console.log('📂 Tentando require("./api/opportunity-followups.cjs")');
  const followupsRouter = require('./api/opportunity-followups.cjs');
  console.log('✅ Módulo carregado, tipo:', typeof followupsRouter);
  app.use('/api/opportunity-followups', followupsRouter);
  console.log('✅ /api/opportunity-followups registrado com sucesso');
} catch (err) {
  console.error('❌ Erro ao carregar /api/opportunity-followups:');
  console.error('   Mensagem:', err.message);
  console.error('   Stack:', err.stack);
}

// API de Geração de PDF (CommonJS)
app.use('/api/pdf-generator', require('./api/pdf-generator.cjs'));

app.get('/api/health', async (req, res) => {
  let dbOk = false;
  try {
    const { prisma } = require('./lib/prisma.cjs');
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB timeout')), 5000))
    ]);
    dbOk = true;
  } catch (err) {
    console.error('🔴 Health check — banco indisponível:', err.message);
  }

  const statusCode = dbOk ? 200 : 503;
  res.status(statusCode).json({
    status: dbOk ? 'ok' : 'degraded',
    service: 'crm-api',
    database: dbOk ? 'connected' : 'error',
    timestamp: new Date().toISOString()
  });
});

// Middleware de debug global
app.use((req, res, next) => {
  console.log(`🔵 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
  console.error('🔴 ERRO CAPTURADO PELO MIDDLEWARE:');
  console.error('📍 Rota:', req.method, req.path);
  console.error('📦 Body:', req.body);
  console.error('❌ Erro:', error.message);
  console.error('📚 Stack:', error.stack);
  
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' });
  }
  
  if (error.type === 'entity.too.large' || error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Arquivo muito grande. O limite máximo para backup é 150MB.' });
  }
  
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: error.message,
    code: error.code || 'UNKNOWN_ERROR'
  });
});

// Rota 404 apenas para /api
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Start server if run directly (standalone)
if (require.main === module) {
  (async () => {
    const ensured = await ensureTemplatesOnce();
    const created = ensured.filter((t) => t.created).map((t) => t.name);
    if (created.length) {
      console.log(`📄 Templates de proposta criados: ${created.join(', ')}`);
    }

    try {
      const { prisma } = require('./lib/prisma.cjs');
      await prisma.user.updateMany({
        where: { email: { in: ['admin@crm.com', 'chorstconsult@gmail.com'] } },
        data: { role: 'MASTER' }
      }).catch(() => {});
    } catch {}

    app.listen(PORT, HOST, () => {
      console.log(`🚀 API Server running on http://localhost:${PORT} (bind ${HOST})`);
      console.log(`📊 Available endpoints:`);
      console.log(`   🔐 /api/auth - Autenticação (NEW)`);
      console.log(`   📄 /api/contracts - Contratos (NEW)`);
      console.log(`   🎯 /api/post-sales - Pós-Venda (NEW)`);
      console.log(`   ⚡ /api/workflows - Automações (NEW)`);
      console.log(`   👥 /api/clients - Clientes`);
      console.log(`   🏢 /api/companies - Empresas`);
      console.log(`   💰 /api/opportunities - Oportunidades`);
      console.log(`   📅 /api/activities - Atividades`);
      console.log(`   📦 /api/products - Produtos`);
      console.log(`   📋 /api/proposals - Propostas`);
      console.log(`   📄 /api/proposal-templates - Templates de Proposta (NEW)`);
      console.log(`   💡 /api/pre-vendas - Pré-Vendas (NEW)`);
      console.log(`   💵 /api/commissions - Comissões`);
      console.log(`   👤 /api/users - Usuários`);
      console.log(`   📊 /api/dashboard - Dashboard`);
      console.log(`   🎯 /api/leadScoring - Lead Scoring`);
      console.log(`   🔄 /api/leadDistribution - Distribuição de Leads`);
      console.log(`   🔗 /api/integrations - Integrações (NEW)`);
      console.log(`   📱 /api/whatsapp - WhatsApp Business (NEW)`);
      console.log(`   📧 /api/email-marketing - E-mail Marketing (NEW)`);
      console.log(`   📞 /api/voip - Telefonia VoIP (NEW)`);
      console.log(`   💰 /api/price-tables - Tabelas de Preço (NEW)`);
      console.log(`   🏆 /api/competitors - Concorrentes (NEW)`);
      console.log(`   🌍 /api/regions - Regiões/Carteiras (NEW)`);
      console.log(`   🔄 /api/cross-sell - Cross-sell (NEW)`);
      console.log(`   ⬆️ /api/upsell - Upsell (NEW)`);
      console.log(`   ✅ /api/approvals - Aprovações (NEW)`);
      console.log(`   🎯 /api/sales-targets - Metas de Vendas (NEW)`);
      console.log(`   👥 /api/team-commissions - Comissões por Equipe (NEW)`);
      console.log(`   🔄 /api/advanced-workflows - Workflows Avançados (NEW)`);
      console.log(`   📝 /api/solicitacoes - Solicitações de Orçamento (NEW)`);
      console.log(`   🤖 /api/ai-analysis - Analise de Edital/TR com Data URI (NEW)`);
      console.log(`   💾 /api/analyses/saved - Historico de analises salvas (NEW)`);
      console.log(`   🔐 /api/integration/oauth/token - OAuth2 client_credentials (NEW)`);
      console.log(`   🔗 /api/integration/v1 - API pública para parceiros ERP (NEW)`);
      console.log(`   🛠️ /api/integration/admin - Governança interna de integrações (NEW)`);
    });
  })();
}

module.exports = app;
