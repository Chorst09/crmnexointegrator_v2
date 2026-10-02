const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const rawUrl = String(process.env.DATABASE_URL || '').trim();
const isPlaceholderUrl = !rawUrl || rawUrl.includes('ep-xxx') || rawUrl.includes('placeholder');

let realPrisma = null;
let isDatabaseConnected = !isPlaceholderUrl;

async function ensureB2GTablesExist() {
  if (!isDatabaseConnected || !realPrisma) return;
  try {
    console.log('[Prisma Init] Executando auto-migration para tabelas B2G (se não existirem)...');
    
    await realPrisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "gerenciadas_licitacao" (
        "id" UUID PRIMARY KEY,
        "userId" VARCHAR(255),
        "tenantCompanyId" VARCHAR(255),
        "numero_controle_pncp" VARCHAR(255),
        "numero_compra" VARCHAR(255),
        "orgao" VARCHAR(500),
        "uf" VARCHAR(10),
        "cidade" VARCHAR(255),
        "modalidade" VARCHAR(255),
        "objeto_resumo" TEXT,
        "data_abertura" TIMESTAMP,
        "data_Campanha" TIMESTAMP,
        "data_encerramento" TIMESTAMP,
        "valor_estimado" DECIMAL,
        "situacao" VARCHAR(255),
        "link_sistema_origem" VARCHAR(1000),
        "status_fase" VARCHAR(255) DEFAULT 'Análise',
        "payload_completo" JSONB,
        "notas" TEXT,
        "added_at" TIMESTAMP DEFAULT NOW(),
        "updated_at" TIMESTAMP DEFAULT NOW()
      );
    `);
    
    await realPrisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "alertas_licitacao" (
        "id" UUID PRIMARY KEY,
        "userId" VARCHAR(255),
        "tenantCompanyId" VARCHAR(255),
        "termo" VARCHAR(255),
        "uf" VARCHAR(10),
        "modalidade" VARCHAR(255),
        "data_abertura_inicio" TIMESTAMP,
        "min_valor" DECIMAL,
        "ativo" BOOLEAN DEFAULT TRUE,
        "created_at" TIMESTAMP DEFAULT NOW()
      );
    `);

    await realPrisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "editais_analisados" (
        "id" VARCHAR(255) PRIMARY KEY,
        "userId" VARCHAR(255),
        "tenantCompanyId" VARCHAR(255),
        "numeroControlePNCP" VARCHAR(255),
        "orgao" VARCHAR(500),
        "objeto" TEXT,
        "valor_estimado" DECIMAL,
        "data_abertura" TIMESTAMP,
        "analysisData" JSONB,
        "created_at" TIMESTAMP DEFAULT NOW(),
        "updated_at" TIMESTAMP DEFAULT NOW()
      );
    `);

    // Tenta flexibilizar userId se a tabela já existia como UUID
    try {
      await realPrisma.$executeRawUnsafe(`ALTER TABLE "editais_analisados" ALTER COLUMN "id" TYPE VARCHAR(255);`);
      await realPrisma.$executeRawUnsafe(`ALTER TABLE "editais_analisados" ALTER COLUMN "userId" TYPE VARCHAR(255);`);
    } catch (_) {}

    await realPrisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SimulatorProposal" (
        "id" VARCHAR(255) PRIMARY KEY,
        "baseId" VARCHAR(255),
        "version" INTEGER DEFAULT 1,
        "title" VARCHAR(500),
        "client" VARCHAR(500),
        "type" VARCHAR(255),
        "value" DECIMAL DEFAULT 0,
        "status" VARCHAR(255) DEFAULT 'Rascunho',
        "forecastTemperature" DECIMAL,
        "metadata" JSONB,
        "createdBy" VARCHAR(255),
        "accountManager" TEXT,
        "distributorId" VARCHAR(255),
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[Prisma Init] Tabelas B2G e Simuladores garantidas com sucesso!');
  } catch (err) {
    console.error('[Prisma Init] Falha ao executar auto-migration das tabelas B2G:', err.message);
  }
}

if (!isPlaceholderUrl) {
  try {
    const prismaOptions = {
      log: ['warn', 'error'],
      datasources: {
        db: {
          url: rawUrl
        }
      }
    };
    realPrisma = new PrismaClient(prismaOptions);
    ensureB2GTablesExist();
  } catch (err) {
    console.warn('[AI Studio] Erro ao instanciar PrismaClient real, usando mock em memória:', err.message);
    realPrisma = null;
    isDatabaseConnected = false;
  }
}

// In-Memory Database Store for complete CRM functionality
const defaultHashedPassword = bcrypt.hashSync('admin123', 10);
const masterHashedPassword = bcrypt.hashSync('Admin@2026', 10);

const inMemoryStore = {
  user: [
    {
      id: 'usr-master-1',
      name: 'Master Admin',
      email: 'chorstconsult@gmail.com',
      password: masterHashedPassword,
      role: 'MASTER',
      quota: 999999,
      tenantCompanyId: null,
      accessB2B: true,
      accessB2G: true,
      accessPreSales: true,
      accessManagement: true,
      accessAutomation: true,
      isCompanyOwner: true,
      permissionOverrides: null,
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr-admin-1',
      name: 'Administrador',
      email: 'admin@crm.com',
      password: defaultHashedPassword,
      role: 'MASTER',
      quota: 100000,
      tenantCompanyId: null,
      accessB2B: true,
      accessB2G: true,
      accessPreSales: true,
      accessManagement: true,
      accessAutomation: true,
      isCompanyOwner: true,
      permissionOverrides: null,
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr-seller-1',
      name: 'João Silva',
      email: 'joao@crm.com',
      password: defaultHashedPassword,
      role: 'SELLER',
      quota: 50000,
      tenantCompanyId: null,
      accessB2B: true,
      accessB2G: false,
      accessPreSales: false,
      accessManagement: false,
      accessAutomation: false,
      isCompanyOwner: false,
      permissionOverrides: null,
      createdAt: new Date().toISOString()
    }
  ],
  company: [
    {
      id: 'comp-1',
      name: 'Acme Corporação S/A',
      tradingName: 'Acme Corp',
      cnpj: '12.345.678/0001-90',
      clientType: 'B2B',
      status: 'ACTIVE',
      leadScore: 85,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'comp-2',
      name: 'Tribunal de Justiça Regional',
      tradingName: 'TJ Regional',
      cnpj: '98.765.432/0001-10',
      clientType: 'B2G',
      status: 'ACTIVE',
      leadScore: 92,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  opportunity: [
    {
      id: 'opp-1',
      title: 'Projeto Link Dedicado 1Gbps',
      stage: 'NEGOTIATION',
      clientType: 'B2B',
      value: 125000,
      companyId: 'comp-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'opp-2',
      title: 'Edital de Conectividade Escolas',
      stage: 'QUALIFICATION',
      clientType: 'B2G',
      value: 480000,
      companyId: 'comp-2',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  product: [
    {
      id: 'prod-1',
      name: 'Link Dedicado Fibra',
      category: 'Conectividade',
      price: 2500,
      createdAt: new Date().toISOString()
    },
    {
      id: 'prod-2',
      name: 'SD-WAN Seguro',
      category: 'Redes',
      price: 1800,
      createdAt: new Date().toISOString()
    }
  ],
  setting: [
    {
      id: 'set-1',
      key: 'appName',
      value: 'CRM NEXOS'
    }
  ],
  region: [
    {
      id: 'reg-sp',
      name: 'São Paulo',
      code: 'SP',
      country: 'Brasil',
      state: 'SP',
      city: 'São Paulo',
      isActive: true,
      createdAt: new Date().toISOString()
    },
    {
      id: 'reg-rj',
      name: 'Rio de Janeiro',
      code: 'RJ',
      country: 'Brasil',
      state: 'RJ',
      city: 'Rio de Janeiro',
      isActive: true,
      createdAt: new Date().toISOString()
    }
  ],
  tenantcompany: [],
  companylicense: [],
  licenseplan: [],
  systemSetting: [],
  proposalTemplate: [],
  activity: [],
  project: [],
  editais_analisados: [],
  simulatorproposal: [],
  auditlog: [
    {
      id: 'audit-init-001',
      userId: 'usr-master-1',
      userName: 'Master Admin',
      userEmail: 'chorstconsult@gmail.com',
      userRole: 'MASTER',
      action: 'CONSULTA_CUSTOS_MARGENS',
      resource: 'PRE_SALES_BUDGET',
      resourceId: 'ORC-2026-0088',
      details: {
        distribuidores: ['Ingram Micro', 'ScanSource'],
        margemMedia: '38.5%',
        totalCusto: 52140.00,
        motivo: 'Auditoria de custos pré-vendas e margens homologadas'
      },
      ipAddress: '127.0.0.1',
      userAgent: 'CRM-Nexos-Web/1.0',
      createdAt: new Date(Date.now() - 3600000).toISOString()
    }
  ],
  audit_logs: []
};

// Aliasing audit_logs to point to auditlog store
inMemoryStore.audit_logs = inMemoryStore.auditlog;


function matchWhere(record, where) {
  if (!where || typeof where !== 'object') return true;
  for (const [key, filter] of Object.entries(where)) {
    const val = record[key];
    if (filter === undefined) continue;
    if (filter === null) {
      if (val !== null) return false;
      continue;
    }
    if (typeof filter === 'object' && !Array.isArray(filter)) {
      if (filter.equals !== undefined) {
        if (filter.mode === 'insensitive' && typeof val === 'string' && typeof filter.equals === 'string') {
          if (val.toLowerCase() !== filter.equals.toLowerCase()) return false;
        } else if (val !== filter.equals) {
          return false;
        }
      }
      if (filter.in !== undefined && Array.isArray(filter.in)) {
        if (!filter.in.includes(val)) return false;
      }
      if (filter.not !== undefined && val === filter.not) return false;
    } else {
      if (val !== filter) return false;
    }
  }
  return true;
}

function enrichRecord(normalized, record) {
  if (!record || typeof record !== 'object') return record;
  if (normalized === 'user') {
    return {
      _count: { opportunities: 0, activities: 0, commissions: 0 },
      region: null,
      regionId: null,
      ...record
    };
  }
  if (normalized === 'region') {
    return {
      users: [],
      companies: [],
      _count: { users: 0, companies: 0, priceTables: 0 },
      ...record
    };
  }
  if (normalized === 'opportunity') {
    const compId = record.companyId || record.COMPANYID;
    const oppId = record.id || record.ID;
    const comp = (inMemoryStore['company'] || []).find((c) => (c.id || c.ID) === compId);
    return {
      id: oppId,
      title: record.title || record.TITLE || 'Oportunidade',
      description: record.description || record.DESCRIPTION || '',
      value: Number(record.value ?? record.VALUE ?? 0),
      stage: record.stage || record.STAGE || 'LEAD',
      projectName: record.projectName || record.PROJECTNAME || record.title || record.TITLE || '',
      number: record.number || record.NUMBER || '',
      company: comp || { id: compId || 'comp-1', name: 'Empresa B2B', clientType: record.clientType || record.CLIENTTYPE || 'B2B' },
      products: [],
      proposals: (inMemoryStore['proposal'] || []).filter((p) => (p.opportunityId || p.OPPORTUNITYID) === oppId),
      activities: (inMemoryStore['activity'] || []).filter((a) => (a.opportunityId || a.OPPORTUNITYID) === oppId),
      ...record
    };
  }
  if (normalized === 'project') {
    const comp = (inMemoryStore['company'] || []).find((c) => c.id === record.companyId);
    const opp = (inMemoryStore['opportunity'] || []).find((o) => o.id === record.opportunityId);
    return {
      company: comp || { id: record.companyId, name: 'Empresa B2B', clientType: 'B2B' },
      opportunity: opp || null,
      projectManager: { id: record.projectManagerId || 'usr-master-1', name: 'Gestor de Projetos', email: 'pm@doubletelecom.com.br' },
      creator: { id: record.createdBy || 'usr-master-1', name: 'Comercial' },
      phases: (inMemoryStore['projectphase'] || []).filter((p) => p.projectId === record.id),
      team: (inMemoryStore['projectteam'] || []).filter((t) => t.projectId === record.id),
      tasks: (inMemoryStore['projecttask'] || []).filter((t) => t.projectId === record.id),
      milestones: (inMemoryStore['projectmilestone'] || []).filter((m) => m.projectId === record.id),
      risks: (inMemoryStore['projectrisk'] || []).filter((r) => r.projectId === record.id),
      issues: [],
      billings: [],
      acceptances: [],
      changeRequests: [],
      _count: {
        tasks: (inMemoryStore['projecttask'] || []).filter((t) => t.projectId === record.id).length,
        timelogs: 0,
        attachments: 0
      },
      ...record
    };
  }
  if (normalized === 'kickoffmeeting') {
    const comp = (inMemoryStore['company'] || []).find((c) => c.id === record.companyId);
    const opp = (inMemoryStore['opportunity'] || []).find((o) => o.id === record.opportunityId);
    return {
      company: comp || { id: record.companyId, name: 'Empresa B2B', clientType: 'B2B' },
      opportunity: opp || null,
      owner: { id: record.ownerId || 'usr-master-1', name: 'Equipe Comercial', email: 'comercial@doubletelecom.com.br' },
      participants: (inMemoryStore['kickoffparticipant'] || []).filter((p) => p.meetingId === record.id),
      agendaItems: (inMemoryStore['kickoffagendaitem'] || []).filter((a) => a.meetingId === record.id),
      checklistItems: (inMemoryStore['kickoffchecklistitem'] || []).filter((c) => c.meetingId === record.id),
      actionItems: (inMemoryStore['kickoffactionitem'] || []).filter((ai) => ai.meetingId === record.id),
      history: (inMemoryStore['kickoffmeetinghistory'] || []).filter((h) => h.meetingId === record.id),
      _count: {
        participants: (inMemoryStore['kickoffparticipant'] || []).filter((p) => p.meetingId === record.id).length,
        agendaItems: (inMemoryStore['kickoffagendaitem'] || []).filter((a) => a.meetingId === record.id).length,
        checklistItems: (inMemoryStore['kickoffchecklistitem'] || []).filter((c) => c.meetingId === record.id).length,
        actionItems: (inMemoryStore['kickoffactionitem'] || []).filter((ai) => ai.meetingId === record.id).length
      },
      ...record
    };
  }
  if (normalized === 'activity') {
    const comp = (inMemoryStore['company'] || []).find((c) => c.id === record.companyId);
    const opp = (inMemoryStore['opportunity'] || []).find((o) => o.id === record.opportunityId);
    const user = (inMemoryStore['user'] || []).find((u) => u.id === record.assignedToId);
    const rawPreSalesReq = (inMemoryStore['presalesrequest'] || []).find(
      (r) => (record.opportunityId && r.opportunityId === record.opportunityId) ||
             (r.observacoes && r.observacoes.includes(record.id)) ||
             (record.description && record.description.includes(r.numero)) ||
             (record.description && record.description.includes(r.id))
    );
    const preSalesReq = rawPreSalesReq ? enrichRecord(rawPreSalesReq, 'presalesrequest') : null;

    return {
      subject: record.subject || record.title || 'Solicitação de Orçamento',
      title: record.title || record.subject || 'Solicitação de Orçamento',
      company: comp || (record.companyId ? { id: record.companyId, name: 'TechCorp Telecomunicações & TI S/A', clientType: 'B2B' } : null),
      opportunity: opp || (record.opportunityId ? { id: record.opportunityId, title: 'Projeto Conectividade 100Mbps + Firewall Virtual NGFW' } : null),
      assignedTo: user || { id: record.assignedToId || 'usr-master-1', name: 'Master Admin', email: 'chorstconsult@gmail.com' },
      preSalesRequest: preSalesReq || null,
      ...record
    };
  }
  if (normalized === 'presalesrequest') {
    const comp = (inMemoryStore['company'] || []).find((c) => c.id === record.companyId || c.id === record.leadId);
    const opp = (inMemoryStore['opportunity'] || []).find((o) => o.id === record.opportunityId);
    const items = (inMemoryStore['presalesitem'] || []).filter((i) => i.requestId === record.id);
    return {
      solicitante: { id: record.solicitanteId || 'usr-master-1', name: 'Vendas Corporativas', email: 'vendas@crm.com' },
      lead: comp ? { id: comp.id, name: comp.name } : null,
      opportunity: opp ? { id: opp.id, title: opp.title, value: opp.value, stage: opp.stage } : null,
      items: items.map((i) => ({ ...i, product: { id: 'prod-1', name: i.descricao, price: i.precoSugerido, category: 'Telecom' } })),
      ...record
    };
  }
  if (normalized === 'tenantcompany') {
    const lcs = (inMemoryStore['companylicense'] || []).filter((l) => l.tenantCompanyId === record.id);
    const urs = (inMemoryStore['user'] || []).filter((u) => u.tenantCompanyId === record.id);
    const enrichedLicenses = lcs.map(license => {
      const plan = (inMemoryStore['licenseplan'] || []).find((p) => p.id === license.planId || p.code === license.planCode);
      return { plan: plan || null, ...license };
    });
    return {
      users: urs,
      licenses: enrichedLicenses,
      ...record
    };
  }
  return record;
}

function createModelHandler(modelName) {
  const normalized = modelName.toLowerCase();
  if (!inMemoryStore[normalized]) {
    inMemoryStore[normalized] = [];
  }

  return {
    async findMany(args = {}) {
      let list = [...(inMemoryStore[normalized] || [])];
      if (args.where) {
        list = list.filter((item) => matchWhere(item, args.where));
      }
      if (args.orderBy && typeof args.orderBy === 'object') {
        const [sortKey, sortOrder] = Object.entries(args.orderBy)[0] || [];
        if (sortKey) {
          list.sort((a, b) => {
            const valA = a[sortKey] ?? '';
            const valB = b[sortKey] ?? '';
            const cmp = String(valA).localeCompare(String(valB));
            return sortOrder === 'desc' ? -cmp : cmp;
          });
        }
      }
      if (args.take) {
        list = list.slice(0, args.take);
      }
      return list.map((item) => enrichRecord(normalized, item));
    },
    async findFirst(args = {}) {
      const list = inMemoryStore[normalized] || [];
      let found = null;
      if (args.where) {
        found = list.find((item) => matchWhere(item, args.where)) || null;
      } else {
        found = list[0] || null;
      }
      return enrichRecord(normalized, found);
    },
    async findUnique(args = {}) {
      const list = inMemoryStore[normalized] || [];
      let found = null;
      if (args.where) {
        found = list.find((item) => matchWhere(item, args.where)) || null;
      }
      return enrichRecord(normalized, found);
    },
    async count(args = {}) {
      let list = inMemoryStore[normalized] || [];
      if (args.where) {
        list = list.filter((item) => matchWhere(item, args.where));
      }
      return list.length;
    },
    async aggregate() {
      return { _sum: { value: 0 }, _count: 0, _avg: { value: 0 } };
    },
    async groupBy() {
      return [];
    },
    async create(args = {}) {
      const data = {
        id: `mock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...(args.data || {})
      };
      inMemoryStore[normalized].push(data);
      return data;
    },
    async createMany(args = {}) {
      const items = Array.isArray(args.data) ? args.data : [args.data];
      items.forEach((item) => {
        inMemoryStore[normalized].push({
          id: `mock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          ...item
        });
      });
      return { count: items.length };
    },
    async update(args = {}) {
      const list = inMemoryStore[normalized] || [];
      const index = list.findIndex((item) => matchWhere(item, args.where));
      if (index >= 0) {
        list[index] = { ...list[index], ...(args.data || {}), updatedAt: new Date().toISOString() };
        return list[index];
      }
      return args.data || {};
    },
    async updateMany(args = {}) {
      const list = inMemoryStore[normalized] || [];
      let count = 0;
      list.forEach((item, index) => {
        if (matchWhere(item, args.where)) {
          list[index] = { ...item, ...(args.data || {}) };
          count++;
        }
      });
      return { count };
    },
    async upsert(args = {}) {
      const list = inMemoryStore[normalized] || [];
      const existing = list.find((item) => matchWhere(item, args.where));
      if (existing) {
        Object.assign(existing, args.update || {}, { updatedAt: new Date().toISOString() });
        return existing;
      }
      const newItem = {
        id: `mock-${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...(args.create || {})
      };
      list.push(newItem);
      return newItem;
    },
    async delete(args = {}) {
      const list = inMemoryStore[normalized] || [];
      const index = list.findIndex((item) => matchWhere(item, args.where));
      if (index >= 0) {
        const [removed] = list.splice(index, 1);
        return removed;
      }
      return {};
    },
    async deleteMany(args = {}) {
      const list = inMemoryStore[normalized] || [];
      const remaining = list.filter((item) => !matchWhere(item, args.where));
      const deletedCount = list.length - remaining.length;
      inMemoryStore[normalized] = remaining;
      return { count: deletedCount };
    }
  };
}

const handleMockRawQuery = (query, params = []) => {
  if (!inMemoryStore.gerenciadas_licitacao) inMemoryStore.gerenciadas_licitacao = [];
  if (!inMemoryStore.alertas_licitacao) inMemoryStore.alertas_licitacao = [];
  if (!inMemoryStore.editais_analisados) inMemoryStore.editais_analisados = [];

  const rawQ = String(query);
  const q = rawQ.trim().toUpperCase();

  // SELECT COUNT(*) AS total_gerenciadas FROM gerenciadas_licitacao
  if (q.includes('COUNT(*)') && (q.includes('GERENCIADAS_LICITACAO') || q.includes('"GERENCIADAS_LICITACAO"'))) {
    const list = inMemoryStore.gerenciadas_licitacao;
    const em_analise = list.filter(item => item.status_fase === 'Análise').length;
    const em_preparacao = list.filter(item => item.status_fase === 'Preparação').length;
    const proposta_enviada = list.filter(item => item.status_fase === 'Proposta Enviada').length;
    const ganhas = list.filter(item => item.status_fase === 'Ganha').length;
    const perdidas = list.filter(item => item.status_fase === 'Perdida').length;
    const pipeline_total = list.filter(item => item.status_fase !== 'Perdida').reduce((sum, item) => sum + (parseFloat(item.valor_estimado) || 0), 0);
    const valor_ganho = list.filter(item => item.status_fase === 'Ganha').reduce((sum, item) => sum + (parseFloat(item.valor_estimado) || 0), 0);
    
    return [{
      total_gerenciadas: list.length,
      em_analise,
      em_preparacao,
      proposta_enviada,
      ganhas,
      perdidas,
      pipeline_total,
      valor_ganho
    }];
  }

  // SELECT COUNT(*) FROM alertas_licitacao
  if (q.includes('COUNT(*)') && (q.includes('ALERTAS_LICITACAO') || q.includes('"ALERTAS_LICITACAO"'))) {
    const list = inMemoryStore.alertas_licitacao;
    return [{ total_alertas: list.length }];
  }

  // SELECT UF, COUNT(*) FROM gerenciadas_licitacao
  if (q.includes('UF') && q.includes('GROUP BY UF')) {
    const list = inMemoryStore.gerenciadas_licitacao;
    const counts = {};
    list.forEach(item => {
      if (item.uf) counts[item.uf] = (counts[item.uf] || 0) + 1;
    });
    return Object.keys(counts).map(uf => ({ uf, total: counts[uf] }));
  }

  // INSERT INTO gerenciadas_licitacao
  if (q.includes('INSERT INTO GERENCIADAS_LICITACAO') || q.includes('INSERT INTO "GERENCIADAS_LICITACAO"')) {
    // Correct index mapping:
    // rowId: params[0], userId: params[1], tenantId: params[2], numControle: params[3], numeroCompra: params[4],
    // orgao: params[5], uf: params[6], cidade: params[7], modalidade: params[8], objeto_resumo: params[9],
    // data_abertura: params[10], data_Campanha: null, data_encerramento: params[11], valor_estimado: params[12],
    // situacao: params[13], link_sistema_origem: params[14], status_fase: params[15], payload_completo: params[16]
    const newItem = {
      id: params[0] || `mock-uuid-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: params[1] || null,
      tenantCompanyId: params[2] || null,
      numero_controle_pncp: params[3] || null,
      numero_compra: params[4] || null,
      orgao: params[5] || null,
      uf: params[6] || null,
      cidade: params[7] || null,
      modalidade: params[8] || null,
      objeto_resumo: params[9] || null,
      data_abertura: params[10] || null,
      data_Campanha: null,
      data_encerramento: params[11] || null,
      valor_estimado: params[12] !== undefined ? parseFloat(params[12]) : 0,
      situacao: params[13] || null,
      link_sistema_origem: params[14] || null,
      status_fase: params[15] || 'Análise',
      payload_completo: params[16] || '{}',
      added_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    inMemoryStore.gerenciadas_licitacao.push(newItem);
    return [newItem];
  }

  // INSERT INTO alertas_licitacao
  if (q.includes('INSERT INTO ALERTAS_LICITACAO') || q.includes('INSERT INTO "ALERTAS_LICITACAO"')) {
    // Correct index mapping:
    // alertaId: params[0], userId: params[1], tenantCompanyId: params[2], termo: params[3], uf: params[4], min_valor: params[5]
    const newItem = {
      id: params[0] || `mock-alerta-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: params[1] || null,
      tenantCompanyId: params[2] || null,
      termo: params[3] || null,
      uf: params[4] || null,
      modalidade: null,
      data_abertura_inicio: null,
      min_valor: params[5] !== undefined ? parseFloat(params[5]) : 0,
      ativo: true,
      created_at: new Date().toISOString()
    };
    inMemoryStore.alertas_licitacao.push(newItem);
    return [newItem];
  }

  // SELECT FROM gerenciadas_licitacao
  if (q.includes('SELECT') && (q.includes('FROM GERENCIADAS_LICITACAO') || q.includes('FROM "GERENCIADAS_LICITACAO"'))) {
    const list = inMemoryStore.gerenciadas_licitacao;
    if (q.includes('LIMIT 1') || q.includes('LIMIT $')) {
      // Duplicate check: WHERE "tenantCompanyId" = $1 AND numero_controle_pncp = $2 LIMIT 1
      const tenantId = params[0] || null;
      const numControle = params[1] || null;
      const found = list.filter(item => {
        const itemTenant = item.tenantCompanyId || null;
        const queryTenant = tenantId || null;
        return itemTenant === queryTenant && item.numero_controle_pncp === numControle;
      });
      return found.slice(0, 1);
    }
    const tenantId = params[0];
    const userId = params[1];

    // Return everything if no filters passed (e.g. diagnostics)
    if (params.length === 0) {
      return list;
    }

    return list.filter(item => {
      if (tenantId) return item.tenantCompanyId === tenantId;
      return item.userId === userId;
    }).sort((a,b) => new Date(b.added_at) - new Date(a.added_at));
  }

  // SELECT FROM alertas_licitacao
  if (q.includes('SELECT') && (q.includes('FROM ALERTAS_LICITACAO') || q.includes('FROM "ALERTAS_LICITACAO"'))) {
    const list = inMemoryStore.alertas_licitacao;
    const tenantId = params[0];
    const userId = params[1];

    if (params.length === 0) {
      return list;
    }

    return list.filter(item => {
      if (tenantId) return item.tenantCompanyId === tenantId;
      return item.userId === userId;
    });
  }

  // UPDATE gerenciadas_licitacao
  if (q.includes('UPDATE GERENCIADAS_LICITACAO') || q.includes('UPDATE "GERENCIADAS_LICITACAO"')) {
    let idParam = null;
    let statusParam = null;
    let notasParam = null;

    const hasStatus = q.includes('STATUS_FASE');
    const hasNotas = q.includes('NOTAS');

    if (hasStatus && hasNotas) {
      statusParam = params[0];
      notasParam = params[1];
      idParam = params[2];
    } else if (hasStatus) {
      statusParam = params[0];
      idParam = params[1];
    } else if (hasNotas) {
      notasParam = params[0];
      idParam = params[1];
    }

    if (idParam) {
      const item = inMemoryStore.gerenciadas_licitacao.find(item => item.id === idParam);
      if (item) {
        if (statusParam !== null && statusParam !== undefined) item.status_fase = statusParam;
        if (notasParam !== null && notasParam !== undefined) item.notas = notasParam;
        item.updated_at = new Date().toISOString();
        return [item];
      }
    }
    return [];
  }

  // UPDATE/SET INACTIVE alertas_licitacao
  if (q.includes('UPDATE ALERTAS_LICITACAO') || q.includes('UPDATE "ALERTAS_LICITACAO"')) {
    const idParam = params[0];
    const item = inMemoryStore.alertas_licitacao.find(item => item.id === idParam);
    if (item) {
      item.ativo = false;
      return [item];
    }
    return [];
  }

  // DELETE FROM gerenciadas_licitacao
  if (q.includes('DELETE FROM GERENCIADAS_LICITACAO') || q.includes('DELETE FROM "GERENCIADAS_LICITACAO"')) {
    const idParam = params[0];
    inMemoryStore.gerenciadas_licitacao = (inMemoryStore.gerenciadas_licitacao || []).filter(item => item.id !== idParam);
    return { count: 1 };
  }

  // DELETE FROM alertas_licitacao
  if (q.includes('DELETE FROM ALERTAS_LICITACAO') || q.includes('DELETE FROM "ALERTAS_LICITACAO"')) {
    const idParam = params[0];
    inMemoryStore.alertas_licitacao = (inMemoryStore.alertas_licitacao || []).filter(item => item.id !== idParam);
    return { count: 1 };
  }

  // Backup / Restore information_schema queries emulation
  if (q.includes('FROM INFORMATION_SCHEMA.TABLES')) {
    const storeKeys = Object.keys(inMemoryStore).map(k => k.charAt(0).toUpperCase() + k.slice(1));
    return storeKeys.map(tableName => ({ table_name: tableName }));
  }

  if (q.includes('FROM INFORMATION_SCHEMA.COLUMNS')) {
    return [];
  }

  if (q.includes('FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS')) {
    return [];
  }

  if (q.includes('SET SESSION_REPLICATION_ROLE') || q.includes('SET CONSTRAINTS')) {
    return [];
  }

  if (q.includes('TRUNCATE TABLE')) {
    const rawPart = q.replace(/.*TRUNCATE\s+TABLE\s+/i, '').replace(/RESTART\s+IDENTITY.*$/i, '').trim();
    const tables = rawPart.split(',').map(t => t.trim().replace(/["']/g, '').toLowerCase());
    tables.forEach(tableName => {
      if (tableName && inMemoryStore[tableName]) {
        inMemoryStore[tableName] = [];
      }
    });
    return [];
  }

  if (q.startsWith('DELETE FROM')) {
    const match = q.match(/DELETE FROM\s+["']?([a-zA-Z0-9_]+)["']?/i);
    if (match) {
      const key = match[1].toLowerCase();
      if (inMemoryStore[key]) {
        inMemoryStore[key] = [];
      }
      return { count: 0 };
    }
    return [];
  }

  if (q.startsWith('SELECT COUNT(*)') && q.includes('FROM')) {
    const match = q.match(/FROM\s+["']?([a-zA-Z0-9_]+)["']?/i);
    if (match) {
      const key = match[1].toLowerCase();
      const list = inMemoryStore[key] || [];
      return [{ count: list.length }];
    }
    return [{ count: 0 }];
  }

  if (q.startsWith('SELECT') && q.includes('FROM')) {
    const match = q.match(/FROM\s+["']?([a-zA-Z0-9_]+)["']?/i);
    if (match) {
      const key = match[1].toLowerCase();
      let list = inMemoryStore[key] || [];
      if (q.includes('"numeroControlePNCP" = $1') && params[0]) {
        list = list.filter(item => item.numeroControlePNCP === params[0]);
      } else if (q.includes('id = $1') && params[0]) {
        list = list.filter(item => item.id === params[0]);
      }
      return list;
    }
    return [];
  }

  if (q.startsWith('UPDATE')) {
    const match = q.match(/UPDATE\s+["']?([a-zA-Z0-9_]+)["']?/i);
    if (match) {
      const key = match[1].toLowerCase();
      const list = inMemoryStore[key] || [];
      const idTarget = params[params.length - 1];
      if (idTarget) {
        const idx = list.findIndex(item => item.id === idTarget);
        if (idx >= 0) {
          list[idx] = { ...list[idx], updated_at: new Date().toISOString() };
        }
      }
      return 1;
    }
    return 1;
  }

  if (q.includes('INSERT INTO')) {
    const match = rawQ.match(/INSERT\s+INTO\s+["']?([a-zA-Z0-9_]+)["']?\s*\(([\s\S]+?)\)/i);
    if (match) {
      const key = match[1].toLowerCase();
      const cols = match[2].split(',').map(c => c.trim().replace(/["']/g, ''));
      const row = {};
      cols.forEach((col, idx) => {
        row[col] = params[idx] !== undefined ? params[idx] : null;
      });
      if (!row.id) {
        const crypto = require('crypto');
        row.id = crypto.randomUUID();
      }
      if (!Array.isArray(inMemoryStore[key])) {
        inMemoryStore[key] = [];
      }
      inMemoryStore[key].push(row);
      return [row];
    }
    return [{}];
  }

  return [];
};

const prismaProxy = new Proxy(realPrisma || {}, {
  get(target, prop) {
    if (prop === '$queryRaw' || prop === '$executeRaw' || prop === '$queryRawUnsafe' || prop === '$executeRawUnsafe') {
      return async (...args) => {
        let result;
        if (isDatabaseConnected && realPrisma && typeof realPrisma[prop] === 'function') {
          try {
            result = await realPrisma[prop].apply(realPrisma, args);
          } catch (e) {
            console.warn('[AI Studio] Real DB raw query failed, fallback to mock:', e.message);
            isDatabaseConnected = false;
          }
        }
        if (result === undefined) {
          // Run mock fallback emulator
          const query = args[0] || '';
          const params = args.slice(1);
          const actualParams = Array.isArray(params[0]) ? params[0] : params;
          result = handleMockRawQuery(query, actualParams);
        }
        // $queryRaw and $queryRawUnsafe must always return an Array so destructuring like `const [row] = ...` never throws
        if (prop === '$queryRaw' || prop === '$queryRawUnsafe') {
          if (!Array.isArray(result)) {
            result = result != null ? [result] : [];
          }
        }
        return result;
      };
    }
    if (prop === '$transaction') {
      return async (cb) => {
        if (typeof cb === 'function') {
          return await cb(prismaProxy);
        }
        if (Array.isArray(cb)) {
          return Promise.all(cb);
        }
        return [];
      };
    }
    if (prop === '$disconnect' || prop === '$connect') {
      return async () => {};
    }

    if (typeof prop === 'string') {
      const fallbackHandler = createModelHandler(prop);
      if (isDatabaseConnected && realPrisma && realPrisma[prop]) {
        const realModel = realPrisma[prop];
        return new Proxy(realModel, {
          get(targetModel, method) {
            return async (...args) => {
              try {
                return await targetModel[method](...args);
              } catch (err) {
                console.warn(`[AI Studio] Real DB ${prop}.${method} failed (${err.message}), using in-memory store for this call`);
                if (fallbackHandler[method]) {
                  return await fallbackHandler[method](...args);
                }
                return null;
              }
            };
          }
        });
      }
      return fallbackHandler;
    }

    return target[prop];
  }
});

module.exports = { prisma: prismaProxy };
