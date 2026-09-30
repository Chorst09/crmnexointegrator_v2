const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Catch unhandled promise rejections to prevent the process from crashing.
// This is critical in production to avoid intermittent 502 errors.
process.on('unhandledRejection', (reason) => {
  console.error('🔴 UNHANDLED REJECTION (capturado para evitar crash):');
  console.error('   Motivo:', reason instanceof Error ? reason.message : reason);
  console.error('   Stack:', reason instanceof Error ? reason.stack : '');
});

process.on('uncaughtException', (error) => {
  console.error('🔴 UNCAUGHT EXCEPTION (capturado para evitar crash):');
  console.error('   Mensagem:', error.message);
  console.error('   Stack:', error.stack);
});

const { authenticateToken } = require('./lib/auth');

// Importar apenas as rotas CommonJS (novas)
const authRoutes = require('./api/auth');
const contractsRoutes = require('./api/contracts');
const postSalesRoutes = require('./api/postSales');
const workflowsRoutes = require('./api/workflows');
const proposalsRoutes = require('./api/proposals');
const simulatorProposalsRoutes = require('./api/simulator-proposals');
const productsRoutes = require('./api/products');

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);

// Middlewares
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Muitas requisições. Tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/auth/login', authLimiter);

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '150mb' }));
app.use(express.urlencoded({ extended: true }));

// Timeout global para requests - evita que requisições lentas
// ao banco consumam conexões do pool e causem 502 no nginx.
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '25000', 10);
const AI_ANALYSIS_REQUEST_TIMEOUT = parseInt(process.env.AI_ANALYSIS_REQUEST_TIMEOUT || '150000', 10);
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  const isBackupRoute = req.path.startsWith('/api/admin/backup');
  const requestTimeout = req.path.startsWith('/api/ai-analysis/')
    ? AI_ANALYSIS_REQUEST_TIMEOUT
    : (isBackupRoute ? 600000 : REQUEST_TIMEOUT);
  res.setTimeout(requestTimeout, () => {
    console.error(`⏰ Request timeout (${requestTimeout}ms): ${req.method} ${req.path}`);
    if (!res.headersSent) {
      res.status(503).json({ error: 'Tempo limite da requisição excedido' });
    }
  });
  next();
});

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
const healthHandler = async (req, res) => {
  let dbOk = false;
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB timeout')), 5000))
    ]);
    await prisma.$disconnect();
    dbOk = true;
  } catch (err) {
    console.error('🔴 Health check — banco indisponível:', err.message);
  }

  const statusCode = dbOk ? 200 : 503;
  res.status(statusCode).json({
    status: dbOk ? 'ok' : 'degraded',
    database: dbOk ? 'connected' : 'error',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Rota raiz
app.get('/', (req, res) => {
  res.json({ message: 'NexosCRM API', version: '1.0.0' });
});

app.post('/', (req, res) => {
  res.json({ message: 'NexosCRM API', version: '1.0.0' });
});

// Servir arquivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rotas da API (novas - CommonJS)
app.use('/api/auth', authRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/post-sales', postSalesRoutes);
app.use('/api/workflows', workflowsRoutes);
app.use('/api/proposals', proposalsRoutes);
app.use('/api/simulator/proposals', simulatorProposalsRoutes);
app.use('/api/proposal-templates', require('./api/proposal-templates'));
app.use('/api/products', productsRoutes);
app.use('/api/settings', require('./api/settings'));
app.use('/api/projetos', require('./api/projetos.cjs'));
app.use('/api/audit-logs', require('./api/audit-logs.cjs'));
app.use('/api/checkout', require('./api/checkout.cjs'));
app.use('/api/admin/backup', authenticateToken, require('./api/admin-backup.cjs'));

// Handler para APIs antigas (ES modules) - conversão dinâmica
const handleLegacyAPI = (apiPath) => {
  return async (req, res) => {
    try {
      const fullPath = path.resolve(__dirname, apiPath);
      const { default: handler } = await import(`file://${fullPath}`);
      
      // Criar objeto request compatível
      const request = {
        method: req.method,
        url: req.url,
        originalUrl: req.originalUrl,
        query: req.query,
        headers: req.headers || {},
        json: async () => req.body || {},
        user: req.user
      };

      const response = await handler(request);
      
      if (response instanceof Response) {
        const status = response.status || 200;
        const contentType = response.headers?.get?.('content-type') || '';

        if (status === 204) {
          return res.sendStatus(204);
        }

        if (contentType.includes('application/json')) {
          const data = await response.json().catch(() => ({}));
          return res.status(status).json(data);
        }

        const text = await response.text().catch(() => '');
        if (!text) {
          return res.sendStatus(status);
        }
        return res.status(status).send(text);
      } else {
        res.json(response);
      }
    } catch (error) {
      console.error(`Erro na API ${apiPath}:`, error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  };
};

// Rotas das APIs antigas (ES modules)
app.use('/api/clients', authenticateToken, handleLegacyAPI('./api/clients.js'));
app.use('/api/companies', authenticateToken, handleLegacyAPI('./api/companies.js'));
app.use('/api/opportunities', authenticateToken, handleLegacyAPI('./api/opportunities.js'));
app.use('/api/activities', authenticateToken, handleLegacyAPI('./api/activities.js'));
app.use('/api/activities-simple', authenticateToken, require('./api/activities-simple.cjs'));
// app.use('/api/products', handleLegacyAPI('./api/products.js')); // Agora usando CommonJS
// app.use('/api/proposals', handleLegacyAPI('./api/proposals.js')); // Agora usando CommonJS
app.use('/api/commissions', authenticateToken, handleLegacyAPI('./api/commissions.js'));
app.use('/api/users', authenticateToken, handleLegacyAPI('./api/users.js'));
app.use('/api/dashboard', authenticateToken, handleLegacyAPI('./api/dashboard.js'));
app.use('/api/leadScoring', authenticateToken, handleLegacyAPI('./api/leadScoring.js'));
app.use('/api/leadDistribution', authenticateToken, handleLegacyAPI('./api/leadDistribution.js'));

// Novas APIs - Integrações
app.use('/api/integrations', authenticateToken, handleLegacyAPI('./api/integrations.js'));
app.use('/api/whatsapp', authenticateToken, handleLegacyAPI('./api/whatsapp.js'));
app.use('/api/email-marketing', authenticateToken, handleLegacyAPI('./api/email-marketing.js'));
app.use('/api/voip', authenticateToken, handleLegacyAPI('./api/voip.js'));

// Novas APIs - Funcionalidades Avançadas
app.use('/api/price-tables', authenticateToken, handleLegacyAPI('./api/price-tables.js'));
app.use('/api/competitors', authenticateToken, handleLegacyAPI('./api/competitors.js'));
app.use('/api/regions', authenticateToken, handleLegacyAPI('./api/regions.js'));
app.use('/api/cross-sell', authenticateToken, handleLegacyAPI('./api/cross-sell.js'));
app.use('/api/upsell', authenticateToken, handleLegacyAPI('./api/upsell.js'));
app.use('/api/approvals', authenticateToken, handleLegacyAPI('./api/approvals.js'));

// Novas APIs - Comissionamento Avançado
app.use('/api/sales-targets', authenticateToken, handleLegacyAPI('./api/sales-targets.js'));
app.use('/api/team-commissions', authenticateToken, handleLegacyAPI('./api/team-commissions.js'));

// Novas APIs - Workflows Avançados
app.use('/api/advanced-workflows', authenticateToken, handleLegacyAPI('./api/advanced-workflows.js'));

// Novas APIs - Licensing
app.use('/api/licensing', require('./api/licensing.cjs'));

// B2G - Busca de Licitações e Editais
app.use('/api/b2g-search', require('./api/b2g-search'));
app.use('/api/bll-proxy', require('./api/bll-proxy'));
app.use('/api/comprasnet-proxy', require('./api/comprasnet-proxy'));

// Novas rotas CommonJS - migradas do apps/api
app.use('/api/b2g', authenticateToken, require('./api/b2g.cjs'));
app.use('/api/pre-vendas', authenticateToken, require('./api/pre-vendas.cjs'));
app.use('/api/pre-sales-pocs', authenticateToken, require('./api/pre-sales-pocs.cjs'));
app.use('/api/prevendas-cadastros', authenticateToken, handleLegacyAPI('./api/prevendas-cadastros.js'));
app.use('/api/analyses', authenticateToken, require('./api/saved-analyses.cjs'));
app.use('/api/ai-analysis', authenticateToken, require('./api/ai-analysis.cjs'));

// Gestão Financeira
app.use('/api/gestao/analise-financeira', authenticateToken, require('./api/financial-analysis.js'));

// Gestão de Kickoff
app.use('/api/kickoff', require('./api/kickoff'));

// Google Calendar Integration
app.use('/api/google-calendar', require('./api/google-calendar'));

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' });
  }
  
  if (error.type === 'entity.too.large' || error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Arquivo muito grande. O limite máximo para backup é 150MB.' });
  }
  
  res.status(error.status || 500).json({
    error: error.message || 'Erro interno do servidor',
    message: error.message
  });
});

// Rota 404
app.use('*', (req, res) => {
  console.log(`❌ 404 - ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Rota não encontrada' });
});

app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
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
  console.log(`   🏛️ /api/b2g - B2G Licitações (NEW)`);
  console.log(`   📋 /api/pre-vendas - Pré-Vendas (NEW)`);
  console.log(`   📊 /api/analyses - Análises Salvas (NEW)`);
  console.log(`   🤖 /api/ai-analysis - Análise IA (NEW)`);
  console.log(`   🚀 /api/kickoff - Gestão de Kickoff (NEW)`);
});

module.exports = app;
