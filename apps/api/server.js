const express = require('express');
const cors = require('cors');
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
const productsRoutes = require('./api/products');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Timeout global para requests - evita que requisições lentas
// ao banco consumam conexões do pool e causem 502 no nginx.
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '25000', 10);
const AI_ANALYSIS_REQUEST_TIMEOUT = parseInt(process.env.AI_ANALYSIS_REQUEST_TIMEOUT || '150000', 10);
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  const requestTimeout = req.path.startsWith('/api/ai-analysis/')
    ? AI_ANALYSIS_REQUEST_TIMEOUT
    : REQUEST_TIMEOUT;
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
app.get('/health', async (req, res) => {
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
});

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
app.use('/api/proposal-templates', require('./api/proposal-templates'));
app.use('/api/products', productsRoutes);
app.use('/api/settings', require('./api/settings'));

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
app.use('/api/clients', handleLegacyAPI('./api/clients.js'));
app.use('/api/companies', handleLegacyAPI('./api/companies.js'));
app.use('/api/opportunities', handleLegacyAPI('./api/opportunities.js'));
app.use('/api/activities', handleLegacyAPI('./api/activities.js'));
app.use('/api/activities-simple', authenticateToken, require('./api/activities-simple.cjs'));
try {
  const followupsRouter = require('./api/opportunity-followups.cjs');
  app.use('/api/opportunity-followups', followupsRouter);  // SEM authenticateToken - rota cuida de sua própria autenticação
  console.log('✅ /api/opportunity-followups carregado com sucesso');
} catch (err) {
  console.error('❌ Erro ao carregar /api/opportunity-followups:', err.message);
}
// app.use('/api/products', handleLegacyAPI('./api/products.js')); // Agora usando CommonJS
// app.use('/api/proposals', handleLegacyAPI('./api/proposals.js')); // Agora usando CommonJS
app.use('/api/commissions', handleLegacyAPI('./api/commissions.js'));
app.use('/api/gestao/analise-financeira', handleLegacyAPI('./api/financial-analysis.js'));
app.use('/api/users', authenticateToken, handleLegacyAPI('./api/users.js'));
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

// Novas APIs - Licensing
app.use('/api/licensing', require('./api/licensing.cjs'));

// B2G - Busca de Licitações e Editais
app.use('/api/b2g-search', require('./api/b2g-search'));
app.use('/api/bll-proxy', require('./api/bll-proxy'));

// Novas rotas CommonJS - migradas do apps/api
app.use('/api/b2g', authenticateToken, require('./api/b2g.cjs'));
app.use('/api/pre-vendas', authenticateToken, require('./api/pre-vendas.cjs'));
app.use('/api/pre-sales-pocs', authenticateToken, require('./api/pre-sales-pocs.cjs'));
app.use('/api/prevendas-cadastros', authenticateToken, handleLegacyAPI('./api/prevendas-cadastros.js'));
app.use('/api/analyses', authenticateToken, require('./api/saved-analyses.cjs'));
app.use('/api/ai-analysis', authenticateToken, require('./api/ai-analysis.cjs'));

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' });
  }
  
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Arquivo muito grande' });
  }
  
  res.status(500).json({ error: 'Erro interno do servidor' });
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
});

module.exports = app;
