const express = require('express');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');
const path = require('path');
const fs = require('fs');
const { prisma } = require('../lib/prisma.cjs');
const { authenticateToken } = require('../lib/auth.cjs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/projects');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'];
    const extname = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(extname)) {
      return cb(null, true);
    }
    cb(new Error('Tipo de arquivo não permitido'));
  }
});

const aiUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedExtensions = ['.pdf', '.txt', '.md', '.csv', '.json'];
    const extname = path.extname(file.originalname || '').toLowerCase();
    if (allowedExtensions.includes(extname)) {
      return cb(null, true);
    }
    cb(new Error('Tipo de arquivo não permitido para análise. Envie PDF, TXT, MD, CSV ou JSON.'));
  }
});

function handleAiUpload(req, res, next) {
  aiUpload.single('file')(req, res, (error) => {
    if (!error) return next();
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'O arquivo para análise deve ter no máximo 25 MB.'
      : error.message || 'Erro ao anexar arquivo para análise.';
    return res.status(400).json({ error: message });
  });
}

const router = express.Router();

function generateProjectNumber() {
  const year = new Date().getFullYear();
  const rand = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `PRJ-${year}-${rand}`;
}

const PROJECT_STATUSES = ['PLANEJADO', 'EM_ANDAMENTO', 'PAUSADO', 'CONCLUIDO', 'CANCELADO'];
const PROJECT_PHASES = ['SETUP', 'KICKOFF_INTERNO', 'KICKOFF_EXTERNO', 'EXECUCAO', 'MONITORAMENTO', 'ENCERRAMENTO'];
const PROJECT_TYPES = ['B2B', 'B2G'];
const ATTACHMENT_CATEGORIES = ['CONTRACT', 'DELIVERABLE', 'MINUTES', 'CHANGE_REQUEST', 'ACCEPTANCE', 'OTHER'];
const PROJECT_PHASE_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'];

const DEFAULT_PROJECT_PHASES = [
  {
    name: 'Iniciação',
    order: 1,
    description: 'Grupo de Processos PMBOK: Iniciação\nEntregável: Termo de Abertura do Projeto e identificação inicial de stakeholders.'
  },
  {
    name: 'Planejamento',
    order: 2,
    description: 'Grupo de Processos PMBOK: Planejamento\nEntregável: Plano de gerenciamento do projeto, EAP/WBS, cronograma, RACI, riscos e comunicação.'
  },
  {
    name: 'Execução',
    order: 3,
    description: 'Grupo de Processos PMBOK: Execução\nEntregável: Produtos e pacotes de trabalho executados conforme escopo aprovado.'
  },
  {
    name: 'Monitoramento e Controle',
    order: 4,
    description: 'Grupo de Processos PMBOK: Monitoramento e Controle\nEntregável: Acompanhamento de desempenho, controle integrado de mudanças, qualidade, riscos e aceite parcial.'
  },
  {
    name: 'Encerramento',
    order: 5,
    description: 'Grupo de Processos PMBOK: Encerramento\nEntregável: Aceite final, documentação de encerramento, lições aprendidas e transição operacional.'
  }
];

function normalizeProjectStatus(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'PLANEJAMENTO') return 'PLANEJADO';
  if (raw === 'EM EXECUCAO' || raw === 'EM EXECUÇÃO' || raw === 'EM PROGRESSO') return 'EM_ANDAMENTO';
  if (raw === 'EM RISCO') return 'PAUSADO';
  if (raw === 'CONCLUÍDO') return 'CONCLUIDO';
  return PROJECT_STATUSES.includes(raw) ? raw : 'PLANEJADO';
}

function normalizeProjectPhase(value) {
  const raw = String(value || '').trim().toUpperCase();
  return PROJECT_PHASES.includes(raw) ? raw : 'SETUP';
}

function normalizeProjectPhaseStatus(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (['PENDENTE', 'TODO', 'PLANEJADO', 'PLANEJAMENTO', 'EM ESPERA'].includes(raw)) return 'PENDING';
  if (['EM_ANDAMENTO', 'EM EXECUCAO', 'EM EXECUÇÃO', 'EM PROGRESSO', 'ATUALIZACAO_NECESSARIA', 'ATUALIZAÇÃO NECESSÁRIA', 'EM RISCO'].includes(raw)) return 'IN_PROGRESS';
  if (['DONE', 'CONCLUIDO', 'CONCLUÍDO'].includes(raw)) return 'COMPLETED';
  if (['CANCELADO', 'CANCELED', 'CANCELLED'].includes(raw)) return 'SKIPPED';
  return PROJECT_PHASE_STATUSES.includes(raw) ? raw : 'PENDING';
}

function normalizeProjectType(value) {
  const raw = String(value || '').trim().toUpperCase();
  return PROJECT_TYPES.includes(raw) ? raw : null;
}

function normalizeProjectMetadata(metadata, fallback = {}) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return fallback;
  return Object.entries(metadata).reduce((acc, [key, value]) => {
    if (value === undefined) return acc;
    if (typeof value === 'string') {
      acc[key] = value.trim();
      return acc;
    }
    acc[key] = value;
    return acc;
  }, { ...fallback });
}

function isForeignKeyError(error) {
  return error?.code === 'P2003';
}

function normalizeAttachmentCategory(value) {
  const raw = String(value || '').trim().toUpperCase();
  return ATTACHMENT_CATEGORIES.includes(raw) ? raw : 'OTHER';
}

function resolveAttachmentPath(filename) {
  return path.join(__dirname, '../uploads/projects', path.basename(String(filename || '')));
}

function parseGeminiJson(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Gemini não retornou conteúdo para análise');

  try {
    return JSON.parse(raw);
  } catch (error) {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw error;
  }
}

function formatGeminiError(status, message) {
  const text = sanitizeText(message);
  const normalized = text.toLowerCase();

  if (status === 429 && normalized.includes('prepayment credits are depleted')) {
    return 'Créditos do Gemini API esgotados neste projeto Google. Adicione créditos ou configure uma GEMINI_API_KEY de outro projeto com billing ativo.';
  }

  if (status === 429) {
    return 'Limite de uso do Gemini atingido. Aguarde a liberação da cota ou ajuste o billing/cotas no Google AI Studio.';
  }

  return text || `Erro ${status} ao consultar Gemini`;
}

function sanitizeText(value, fallback = '') {
  return String(value || fallback).trim();
}

const MAX_AI_SOURCE_CHARS = 160000;

function cleanAiSourceText(value, max = MAX_AI_SOURCE_CHARS) {
  if (typeof value !== 'string') return '';
  const normalized = value
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return normalized.slice(0, max);
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function extractPdfText(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    return cleanAiSourceText(parsed?.text || '');
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function extractAiFileText(file) {
  if (!file?.buffer?.length) return '';
  const extname = path.extname(file.originalname || '').toLowerCase();
  const mimeType = String(file.mimetype || '').toLowerCase();

  if (extname === '.pdf' || mimeType === 'application/pdf') {
    const text = await extractPdfText(file.buffer);
    if (!text) throw createHttpError(400, 'Não foi possível extrair texto do PDF anexado.');
    return text;
  }

  const isTextFile = ['.txt', '.md', '.csv', '.json'].includes(extname)
    || mimeType.startsWith('text/')
    || ['application/json', 'application/csv'].includes(mimeType);

  if (isTextFile) {
    return cleanAiSourceText(file.buffer.toString('utf8'));
  }

  throw createHttpError(415, 'Formato não suportado para análise. Envie PDF, TXT, MD, CSV ou JSON.');
}

async function resolveAiAnalysisSource(req) {
  const pastedText = cleanAiSourceText(req.body?.sourceText || '');
  const fileText = req.file ? await extractAiFileText(req.file) : '';
  return {
    sourceText: cleanAiSourceText([pastedText, fileText].filter(Boolean).join('\n\n')),
    sourceFileName: req.file?.originalname || null
  };
}

function pickValue(source, ...keys) {
  if (!source || typeof source !== 'object') return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined && source[key] !== '') {
      return source[key];
    }
  }
  return undefined;
}

function sanitizeTextArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeText(item)).filter(Boolean);
  }
  const text = sanitizeText(value);
  return text ? [text] : [];
}

function normalizeAiProjectType(value) {
  const raw = sanitizeText(value).toUpperCase();
  if (raw.includes('B2G') || raw.includes('GOVERNO') || raw.includes('PUBLIC')) return 'B2G';
  if (raw.includes('B2B') || raw.includes('PRIV')) return 'B2B';
  return undefined;
}

function normalizeAiPriority(value) {
  const raw = sanitizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (raw.includes('CRITICA') || raw.includes('CRITICAL') || raw.includes('URGENTE')) return 'Urgente';
  if (raw.includes('ALTA') || raw.includes('HIGH')) return 'Alta';
  if (raw.includes('BAIXA') || raw.includes('LOW')) return 'Baixa';
  return raw ? 'Normal' : undefined;
}

function normalizeAiBudget(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value)
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAiDate(value) {
  const text = sanitizeText(value);
  if (!text) return '';
  const br = text.match(/\b([0-3]?\d)[\/\-.]([0-1]?\d)[\/\-.](\d{4})\b/);
  if (br) {
    const day = br[1].padStart(2, '0');
    const month = br[2].padStart(2, '0');
    return `${br[3]}-${month}-${day}`;
  }
  const iso = text.match(/\b(\d{4})[\/\-.]([0-1]?\d)[\/\-.]([0-3]?\d)\b/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  }
  return '';
}

function sanitizeAiPhases(phases) {
  if (!Array.isArray(phases)) return [];
  return phases
    .map((phase, index) => {
      const requirements = sanitizeTextArray(pickValue(phase, 'requirements', 'requisitos', 'requisitos_gestao', 'requisitos_tecnicos'));
      const materials = sanitizeTextArray(pickValue(phase, 'materials', 'materiais', 'materiais_necessarios', 'acessorios_obrigatorios'));
      const deliverable = sanitizeText(pickValue(phase, 'deliverable', 'entregavel', 'produto_entregavel', 'produto/entregavel'));
      const pmbokProcessGroup = sanitizeText(pickValue(phase, 'pmbokProcessGroup', 'grupo_processo_pmbok', 'grupo_pmbok'));
      const descriptionParts = [
        sanitizeText(pickValue(phase, 'description', 'descricao')),
        pmbokProcessGroup ? `Grupo de Processos PMBOK: ${pmbokProcessGroup}` : '',
        deliverable ? `Entregável: ${deliverable}` : '',
        requirements.length ? `Requisitos: ${requirements.join('; ')}` : '',
        materials.length ? `Materiais: ${materials.join('; ')}` : ''
      ].filter(Boolean);
      const order = pickValue(phase, 'order', 'ordem');
      const plannedStartDay = pickValue(phase, 'plannedStartDay', 'prazo_inicio_dia', 'dia_inicio', 'inicio_dia');
      const plannedEndDay = pickValue(phase, 'plannedEndDay', 'prazo_fim_dia', 'dia_fim', 'fim_dia');

      return {
        name: sanitizeText(pickValue(phase, 'name', 'nome'), `Fase ${index + 1}`),
        description: descriptionParts.join('\n'),
        order: Number.isFinite(Number(order)) ? Number(order) : index + 1,
        plannedStartDay: Number.isFinite(Number(plannedStartDay)) ? Number(plannedStartDay) : null,
        plannedEndDay: Number.isFinite(Number(plannedEndDay)) ? Number(plannedEndDay) : null,
        deliverable,
        requirements,
        materials,
        pmbokProcessGroup
      };
    })
    .filter((phase) => phase.name)
    .slice(0, 12);
}

function sanitizeAiProjectAnalysis(value) {
  const phases = sanitizeAiPhases(pickValue(value, 'phases', 'fases'));
  return {
    name: sanitizeText(pickValue(value, 'name', 'nome_projeto')),
    type: normalizeAiProjectType(pickValue(value, 'type', 'tipo')),
    client: sanitizeText(pickValue(value, 'client', 'cliente')),
    sponsor: sanitizeText(pickValue(value, 'sponsor', 'patrocinador')),
    manager: sanitizeText(pickValue(value, 'manager', 'gerente')),
    budget: normalizeAiBudget(pickValue(value, 'budget', 'orcamento')),
    status: normalizeProjectStatus(pickValue(value, 'status')),
    priority: normalizeAiPriority(pickValue(value, 'priority', 'prioridade')),
    startDate: normalizeAiDate(pickValue(value, 'startDate', 'data_inicio')),
    endDate: normalizeAiDate(pickValue(value, 'endDate', 'data_fim')),
    objective: sanitizeText(pickValue(value, 'objective', 'objetivo')),
    scope: sanitizeText(pickValue(value, 'scope', 'escopo')),
    deliverables: sanitizeTextArray(pickValue(value, 'deliverables', 'entregaveis')),
    successCriteria: sanitizeTextArray(pickValue(value, 'successCriteria', 'criterios_sucesso', 'criterios_de_sucesso')),
    risks: sanitizeTextArray(pickValue(value, 'risks', 'riscos')),
    notes: sanitizeText(pickValue(value, 'notes', 'observacoes')),
    methodology: 'PMBOK/PMI',
    phases
  };
}

function buildProjectPhaseCreates(phases, plannedStartDate) {
  const sanitized = sanitizeAiPhases(phases);
  if (sanitized.length === 0) return DEFAULT_PROJECT_PHASES;

  const start = plannedStartDate ? new Date(plannedStartDate) : null;
  const isValidStart = start && !Number.isNaN(start.getTime());

  return sanitized.map((phase, index) => {
    const data = {
      name: phase.name,
      description: phase.description || null,
      order: phase.order || index + 1
    };

    if (isValidStart && phase.plannedStartDay) {
      data.plannedStartDate = new Date(start.getTime() + (phase.plannedStartDay - 1) * 24 * 60 * 60 * 1000);
    }
    if (isValidStart && phase.plannedEndDay) {
      data.plannedEndDate = new Date(start.getTime() + (phase.plannedEndDay - 1) * 24 * 60 * 60 * 1000);
    }

    return data;
  });
}

// Analisar edital/escopo com Gemini e retornar campos prontos para o cadastro
router.post('/ai-analyze', authenticateToken, handleAiUpload, async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'GEMINI_API_KEY não configurada no backend' });
    }

    const { sourceText, sourceFileName } = await resolveAiAnalysisSource(req);
    if (sourceText.length < 80) {
      return res.status(400).json({ error: 'Anexe um edital/projeto ou informe um texto com conteúdo suficiente para a IA.' });
    }

    const model = process.env.GEMINI_MODEL || 'gemini-3.1-pro-preview';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const prompt = `
Você é um gerente de projetos sênior, certificado PMP pelo PMI. Sua tarefa é analisar o texto fornecido pelo usuário (editais, notas de reunião, RFPs, termos de referência ou projetos) e extrair as informações necessárias para elaborar o Termo de Abertura do Projeto (Project Charter), a Declaração de Escopo de alto nível e as fases iniciais do projeto seguindo PMBOK.

Você deve retornar EXCLUSIVAMENTE um objeto JSON válido, sem formatação markdown, sem comentários e sem texto fora do JSON.

Contexto já informado:
- Nome atual do projeto: ${sanitizeText(req.body?.projectName, 'não informado')}
- Tipo atual: ${sanitizeText(req.body?.projectType, 'não informado')}
- Cliente atual: ${sanitizeText(req.body?.client, 'não informado')}
- Arquivo anexado: ${sanitizeText(sourceFileName, 'não informado')}

Regras PMBOK:
1. Seja rigoroso com a taxonomia do PMI. Diferencie claramente o que é Objetivo (por que estamos fazendo) do que é Escopo (o que será feito) e do que são Entregáveis (produtos tangíveis gerados).
2. Se uma informação financeira ou de cronograma não for explicitamente citada no texto, retorne o valor como null. Não faça estimativas não fundamentadas.
3. Para campos de texto longo, utilize formatação em tópicos com hífens (-) para facilitar a leitura no sistema.
4. Garanta que o JSON seja perfeitamente válido.
5. Preserve requisitos críticos, SLAs, materiais obrigatórios, marcos, premissas, exclusões, restrições logísticas, normativas técnicas e critérios formais de aceite.
6. Gere fases sequenciais do projeto com base no ciclo de vida identificado. Classifique cada fase em um Grupo de Processos PMBOK: Iniciação, Planejamento, Execução, Monitoramento e Controle ou Encerramento.

Formato JSON obrigatório:
{
  "nome_projeto": "string (Título claro e descritivo do projeto. Ex.: Migração de Datacenter e Links Dedicados)",
  "tipo": "string (Classificação do projeto)",
  "cliente": "string (Nome do cliente, órgão ou stakeholder principal. Obrigatório se identificado)",
  "patrocinador": "string ou null (Sponsor do projeto, quem provê os recursos)",
  "gerente": "string ou null (Gerente de Projetos designado)",
  "orcamento": "number ou null (Orçamento aprovado de alto nível. Apenas números e decimais)",
  "status": "Planejado",
  "prioridade": "Baixa, Normal, Alta ou Crítica",
  "data_inicio": "string no formato DD/MM/AAAA ou null",
  "data_fim": "string no formato DD/MM/AAAA ou null",
  "objetivo": "string (Justificativa e Objetivos SMART do projeto. Descreva o Business Case e os impactos estratégicos esperados. Obrigatório)",
  "escopo": "string (Declaração do Escopo preliminar. Liste claramente Inclusões, Exclusões e Premissas de alto nível. Obrigatório)",
  "entregaveis": "string (Estrutura Analítica do Projeto - EAP/WBS de alto nível em tópicos hierárquicos. Obrigatório)",
  "criterios_sucesso": "string (Requisitos de aprovação, métricas de qualidade, KPIs e tolerâncias do cliente)",
  "riscos": "string (Registro inicial de riscos com ameaças de alto nível e mitigações iniciais)",
  "observacoes": "string (Restrições organizacionais, dependências externas ou normativas técnicas)",
  "fases": [
    {
      "nome": "string",
      "descricao": "string",
      "ordem": 1,
      "prazo_inicio_dia": 1,
      "prazo_fim_dia": 50,
      "entregavel": "string",
      "requisitos": ["string"],
      "materiais": ["string"],
      "grupo_processo_pmbok": "Iniciação, Planejamento, Execução, Monitoramento e Controle ou Encerramento"
    }
  ]
}

Conteúdo para análise:
${sourceText}
`.trim();

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      })
    });

    clearTimeout(timeout);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = formatGeminiError(response.status, payload?.error?.message);
      return res.status(response.status).json({ error: message });
    }

    const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
    const parsed = parseGeminiJson(text);
    res.json({ analysis: sanitizeAiProjectAnalysis(parsed), model, sourceFileName });
  } catch (error) {
    console.error('Erro ao analisar projeto com Gemini:', error);
    if (error?.name === 'AbortError') {
      return res.status(504).json({ error: 'Tempo esgotado ao analisar com Gemini' });
    }
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erro ao analisar projeto com Gemini' });
  }
});

// Dashboard / KPIs
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'SELLER') where.projectManagerId = req.user.id;

    const [total, active, delayed, avgMargin] = await Promise.all([
      prisma.project.count({ where: { ...where, status: { not: 'CANCELADO' } } }),
      prisma.project.count({ where: { ...where, status: 'EM_ANDAMENTO' } }),
      prisma.project.count({ where: { ...where, healthScore: { lt: 60 }, status: 'EM_ANDAMENTO' } }),
      prisma.project.aggregate({ where: { ...where, status: 'EM_ANDAMENTO' }, _avg: { margin: true } })
    ]);

    const byPhase = await prisma.project.groupBy({
      by: ['phase'],
      where: { ...where, status: { not: 'CANCELADO' } },
      _count: true
    });

    const byType = await prisma.project.groupBy({
      by: ['type'],
      where: { ...where, status: { not: 'CANCELADO' } },
      _count: true
    });

    res.json({
      total,
      active,
      delayed,
      avgMargin: avgMargin._avg.margin || 0,
      byPhase,
      byType
    });
  } catch (error) {
    console.error('Erro ao buscar dashboard de projetos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Listar projetos
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, type, phase, companyId, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    const where = {};

    if (req.user.role === 'SELLER') where.projectManagerId = req.user.id;
    if (status) where.status = status;
    if (type) where.type = type;
    if (phase) where.phase = phase;
    if (companyId) where.companyId = companyId;

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          company: { select: { id: true, name: true, clientType: true } },
          projectManager: { select: { id: true, name: true, email: true } },
          phases: { orderBy: { order: 'asc' } },
          _count: { select: { tasks: true, milestones: true, team: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.project.count({ where })
    ]);

    res.json({ projects, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('Erro ao listar projetos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar projeto por ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        company: { select: { id: true, name: true, document: true, clientType: true } },
        projectManager: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true } },
        opportunity: { select: { id: true, number: true, title: true, value: true } },
        contract: { select: { id: true, number: true, title: true, value: true, slaResponseTime: true, slaResolutionTime: true, slaAvailability: true } },
        phases: { orderBy: { order: 'asc' } },
        milestones: { orderBy: { plannedDate: 'asc' } },
        team: { include: { user: { select: { id: true, name: true, email: true } } } },
        risks: { orderBy: { identifiedDate: 'desc' } },
        issues: { orderBy: { reportedDate: 'desc' } },
        billings: { orderBy: { createdAt: 'desc' } },
        acceptances: { orderBy: { createdAt: 'desc' } },
        changeRequests: { orderBy: { createdAt: 'desc' } },
        b2gConfig: true,
        b2bConfig: true,
        _count: { select: { tasks: true, timelogs: true, attachments: true } }
      }
    });

    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });
    res.json(project);
  } catch (error) {
    console.error('Erro ao buscar projeto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar projeto manualmente
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      status,
      phase,
      companyId,
      projectManagerId,
      budget,
      plannedStartDate,
      plannedEndDate,
      opportunityId,
      contractId,
      metadata,
      phases
    } = req.body;
    const normalizedType = normalizeProjectType(type);
    const normalizedStatus = normalizeProjectStatus(status);
    const normalizedPhase = normalizeProjectPhase(phase);

    if (!name || !normalizedType || !companyId || !projectManagerId) {
      return res.status(400).json({ error: 'Nome, tipo, empresa e gestor são obrigatórios' });
    }

    const [company, manager] = await Promise.all([
      prisma.company.findUnique({ where: { id: companyId }, select: { id: true, clientType: true } }),
      prisma.user.findUnique({ where: { id: projectManagerId }, select: { id: true } })
    ]);

    if (!company) return res.status(404).json({ error: 'Empresa não encontrada' });
    if (!manager) return res.status(404).json({ error: 'Gestor do projeto não encontrado' });

    const projectNumber = generateProjectNumber();

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          number: projectNumber,
          name: String(name).trim(),
          description,
          type: normalizedType,
          status: normalizedStatus,
          phase: normalizedPhase,
          budget: budget ? parseFloat(budget) : 0,
          plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : null,
          plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
          companyId,
          projectManagerId,
          createdBy: req.user.id,
          opportunityId: opportunityId || null,
          contractId: contractId || null,
          metadata: normalizeProjectMetadata(metadata),
          phases: {
            create: buildProjectPhaseCreates(phases, plannedStartDate)
          }
        },
        include: {
          company: { select: { id: true, name: true, clientType: true } },
          projectManager: { select: { id: true, name: true, email: true } },
          phases: true
        }
      });

      if (normalizedType === 'B2G') {
        await tx.projectB2GConfig.create({ data: { projectId: created.id } });
      } else {
        await tx.projectB2BConfig.create({ data: { projectId: created.id } });
      }

      return created;
    });

    res.status(201).json(project);
  } catch (error) {
    console.error('Erro ao criar projeto:', error);
    if (isForeignKeyError(error)) {
      return res.status(400).json({ error: 'Empresa, gestor, oportunidade ou contrato inválido para o projeto' });
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar projeto a partir de oportunidade ganha
router.post('/from-opportunity/:opportunityId', authenticateToken, async (req, res) => {
  try {
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: req.params.opportunityId },
      include: {
        company: { select: { id: true, name: true, clientType: true } },
        owner: { select: { id: true, name: true, email: true } },
        proposals: { where: { status: 'ACCEPTED' }, take: 1 },
        products: { include: { product: true } }
      }
    });

    if (!opportunity) return res.status(404).json({ error: 'Oportunidade não encontrada' });
    if (opportunity.stage !== 'WON') return res.status(400).json({ error: 'Oportunidade não está no estágio Ganha' });

    const existingProject = await prisma.project.findFirst({ where: { opportunityId: opportunity.id } });
    if (existingProject) return res.status(409).json({ error: 'Já existe um projeto para esta oportunidade' });

    const projectNumber = generateProjectNumber();
    const clientType = opportunity.company?.clientType || 'B2B';
    const projectType = clientType === 'B2G' ? 'B2G' : 'B2B';
    const projectManagerId = opportunity.ownerId || req.user.id;

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          number: projectNumber,
          name: opportunity.projectName || opportunity.title,
          description: opportunity.description || '',
          type: projectType,
          status: 'PLANEJADO',
          phase: 'SETUP',
          budget: opportunity.value || 0,
          companyId: opportunity.companyId,
          projectManagerId,
          createdBy: req.user.id,
          opportunityId: opportunity.id,
          metadata: normalizeProjectMetadata({
            objective: opportunity.title || '',
            scope: opportunity.description || '',
            sourceOpportunityNumber: opportunity.number,
            sourceOpportunityStage: opportunity.stage,
            sourceProposalId: opportunity.proposals?.[0]?.id || null
          }),
          phases: {
            create: DEFAULT_PROJECT_PHASES
          }
        },
        include: {
          company: { select: { id: true, name: true, clientType: true } },
          projectManager: { select: { id: true, name: true, email: true } },
          phases: true
        }
      });

      if (projectType === 'B2G') {
        await tx.projectB2GConfig.create({ data: { projectId: created.id } });
      } else {
        await tx.projectB2BConfig.create({ data: { projectId: created.id } });
      }

      return created;
    });

    res.status(201).json(project);
  } catch (error) {
    console.error('Erro ao criar projeto da oportunidade:', error);
    if (isForeignKeyError(error)) {
      return res.status(400).json({ error: 'Dados inválidos para criar o projeto da oportunidade' });
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar projeto
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, status, phase, budget, healthScore, progressPercent, plannedStartDate, plannedEndDate, actualStartDate, actualEndDate, projectManagerId, metadata } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status) updateData.status = normalizeProjectStatus(status);
    if (phase) updateData.phase = normalizeProjectPhase(phase);
    if (budget !== undefined) updateData.budget = parseFloat(budget);
    if (healthScore !== undefined) updateData.healthScore = parseInt(healthScore);
    if (progressPercent !== undefined) updateData.progressPercent = parseInt(progressPercent);
    if (plannedStartDate !== undefined) updateData.plannedStartDate = plannedStartDate ? new Date(plannedStartDate) : null;
    if (plannedEndDate !== undefined) updateData.plannedEndDate = plannedEndDate ? new Date(plannedEndDate) : null;
    if (actualStartDate !== undefined) updateData.actualStartDate = actualStartDate ? new Date(actualStartDate) : null;
    if (actualEndDate !== undefined) updateData.actualEndDate = actualEndDate ? new Date(actualEndDate) : null;
    if (projectManagerId) updateData.projectManagerId = projectManagerId;
    if (metadata !== undefined) updateData.metadata = normalizeProjectMetadata(metadata);

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        company: { select: { id: true, name: true, clientType: true } },
        projectManager: { select: { id: true, name: true, email: true } }
      }
    });

    res.json(project);
  } catch (error) {
    console.error('Erro ao atualizar projeto:', error);
    if (isForeignKeyError(error)) {
      return res.status(400).json({ error: 'Gestor inválido para este projeto' });
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Deletar projeto
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ message: 'Projeto removido com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar projeto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// === FASES ===
router.post('/:projectId/phases', authenticateToken, async (req, res) => {
  try {
    const { name, description, status, order, plannedStartDate, plannedEndDate, actualStartDate, actualEndDate, progressPercent } = req.body;
    const phaseName = sanitizeText(name);
    if (!phaseName) return res.status(400).json({ error: 'Nome da fase é obrigatório' });

    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      select: { id: true }
    });
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

    const maxOrder = await prisma.projectPhase.aggregate({
      where: { projectId: req.params.projectId },
      _max: { order: true }
    });
    const requestedOrder = Number(order);

    const phase = await prisma.projectPhase.create({
      data: {
        projectId: req.params.projectId,
        name: phaseName,
        description: description !== undefined ? sanitizeText(description) : null,
        order: Number.isFinite(requestedOrder) && requestedOrder > 0 ? requestedOrder : (maxOrder._max.order || 0) + 1,
        status: normalizeProjectPhaseStatus(status),
        plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : null,
        plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
        actualStartDate: actualStartDate ? new Date(actualStartDate) : null,
        actualEndDate: actualEndDate ? new Date(actualEndDate) : null,
        progressPercent: progressPercent !== undefined ? parseInt(progressPercent) : 0
      }
    });

    res.status(201).json(phase);
  } catch (error) {
    console.error('Erro ao criar fase:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/:projectId/phases/:phaseId', authenticateToken, async (req, res) => {
  try {
    const { name, description, status, order, progressPercent, plannedStartDate, plannedEndDate, actualStartDate, actualEndDate } = req.body;
    const updateData = {};
    if (name !== undefined) {
      const phaseName = sanitizeText(name);
      if (!phaseName) return res.status(400).json({ error: 'Nome da fase é obrigatório' });
      updateData.name = phaseName;
    }
    if (description !== undefined) updateData.description = sanitizeText(description);
    if (status) updateData.status = normalizeProjectPhaseStatus(status);
    if (order !== undefined) updateData.order = parseInt(order);
    if (progressPercent !== undefined) updateData.progressPercent = parseInt(progressPercent);
    if (plannedStartDate !== undefined) updateData.plannedStartDate = plannedStartDate ? new Date(plannedStartDate) : null;
    if (plannedEndDate !== undefined) updateData.plannedEndDate = plannedEndDate ? new Date(plannedEndDate) : null;
    if (actualStartDate !== undefined) updateData.actualStartDate = actualStartDate ? new Date(actualStartDate) : null;
    if (actualEndDate !== undefined) updateData.actualEndDate = actualEndDate ? new Date(actualEndDate) : null;

    const existingPhase = await prisma.projectPhase.findFirst({
      where: { id: req.params.phaseId, projectId: req.params.projectId },
      select: { id: true }
    });
    if (!existingPhase) return res.status(404).json({ error: 'Fase não encontrada neste projeto' });

    const phase = await prisma.projectPhase.update({
      where: { id: req.params.phaseId },
      data: updateData
    });
    res.json(phase);
  } catch (error) {
    console.error('Erro ao atualizar fase:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// === TAREFAS ===
router.get('/:projectId/tasks', authenticateToken, async (req, res) => {
  try {
    const { status, phaseId, assignedToId } = req.query;
    const where = { projectId: req.params.projectId };
    if (status) where.status = status;
    if (phaseId) where.phaseId = phaseId;
    if (assignedToId) where.assignedToId = assignedToId;

    const tasks = await prisma.projectTask.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        phase: { select: { id: true, name: true } },
        milestone: { select: { id: true, name: true } },
        _count: { select: { timelogs: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(tasks);
  } catch (error) {
    console.error('Erro ao listar tarefas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/:projectId/tasks', authenticateToken, async (req, res) => {
  try {
    const { title, description, status, priority, dueDate, assignedToId, phaseId, milestoneId, estimatedHours, dependencyId } = req.body;
    if (!title) return res.status(400).json({ error: 'Título é obrigatório' });

    const task = await prisma.projectTask.create({
      data: {
        projectId: req.params.projectId,
        title,
        description,
        status: status || 'TODO',
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        assignedToId: assignedToId || null,
        phaseId: phaseId || null,
        milestoneId: milestoneId || null,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : 0,
        dependencyId: dependencyId || null
      },
      include: {
        assignedTo: { select: { id: true, name: true } }
      }
    });
    res.status(201).json(task);
  } catch (error) {
    console.error('Erro ao criar tarefa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/:projectId/tasks/:taskId', authenticateToken, async (req, res) => {
  try {
    const { title, description, status, priority, dueDate, assignedToId, phaseId, milestoneId, estimatedHours, actualHours, dependencyId } = req.body;
    const updateData = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status) {
      updateData.status = status;
      if (status === 'DONE') updateData.completedAt = new Date();
    }
    if (priority) updateData.priority = priority;
    if (dueDate) updateData.dueDate = new Date(dueDate);
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId || null;
    if (phaseId !== undefined) updateData.phaseId = phaseId || null;
    if (milestoneId !== undefined) updateData.milestoneId = milestoneId || null;
    if (estimatedHours !== undefined) updateData.estimatedHours = parseFloat(estimatedHours);
    if (actualHours !== undefined) updateData.actualHours = parseFloat(actualHours);
    if (dependencyId !== undefined) updateData.dependencyId = dependencyId || null;

    const task = await prisma.projectTask.update({
      where: { id: req.params.taskId },
      data: updateData,
      include: { assignedTo: { select: { id: true, name: true } } }
    });
    res.json(task);
  } catch (error) {
    console.error('Erro ao atualizar tarefa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.delete('/:projectId/tasks/:taskId', authenticateToken, async (req, res) => {
  try {
    await prisma.projectTask.delete({ where: { id: req.params.taskId } });
    res.json({ message: 'Tarefa removida' });
  } catch (error) {
    console.error('Erro ao deletar tarefa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// === TIMESHEET ===
router.get('/:projectId/timelogs', authenticateToken, async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    const where = { projectId: req.params.projectId };
    if (userId) where.userId = userId;
    if (startDate && endDate) {
      where.logDate = { gte: new Date(startDate), lte: new Date(endDate) };
    }

    const timelogs = await prisma.projectTimelog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } }
      },
      orderBy: { logDate: 'desc' }
    });
    res.json(timelogs);
  } catch (error) {
    console.error('Erro ao listar timelogs:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/:projectId/timelogs', authenticateToken, async (req, res) => {
  try {
    const { taskId, userId, logDate, hours, description, billable } = req.body;
    if (!taskId || !logDate || !hours) {
      return res.status(400).json({ error: 'Tarefa, data e horas são obrigatórios' });
    }

    const timelog = await prisma.projectTimelog.create({
      data: {
        projectId: req.params.projectId,
        taskId,
        userId: userId || req.user.id,
        logDate: new Date(logDate),
        hours: parseFloat(hours),
        description,
        billable: billable !== false
      },
      include: {
        user: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } }
      }
    });
    res.status(201).json(timelog);
  } catch (error) {
    console.error('Erro ao criar timelog:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// === EQUIPE ===
router.get('/:projectId/team', authenticateToken, async (req, res) => {
  try {
    const team = await prisma.projectTeam.findMany({
      where: { projectId: req.params.projectId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' }
    });
    res.json(team);
  } catch (error) {
    console.error('Erro ao listar equipe:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/:projectId/team', authenticateToken, async (req, res) => {
  try {
    const { userId, role, allocationPercent, hourlyCost, startDate, endDate } = req.body;
    if (!userId) return res.status(400).json({ error: 'Usuário é obrigatório' });

    const member = await prisma.projectTeam.create({
      data: {
        projectId: req.params.projectId,
        userId,
        role: role || 'DEVELOPER',
        allocationPercent: allocationPercent ? parseFloat(allocationPercent) : 100,
        hourlyCost: hourlyCost ? parseFloat(hourlyCost) : 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null
      },
      include: { user: { select: { id: true, name: true, email: true } } }
    });
    res.status(201).json(member);
  } catch (error) {
    console.error('Erro ao adicionar membro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/:projectId/team/:memberId', authenticateToken, async (req, res) => {
  try {
    const { role, allocationPercent, hourlyCost, isActive } = req.body;
    const updateData = {};
    if (role) updateData.role = role;
    if (allocationPercent !== undefined) updateData.allocationPercent = parseFloat(allocationPercent);
    if (hourlyCost !== undefined) updateData.hourlyCost = parseFloat(hourlyCost);
    if (isActive !== undefined) updateData.isActive = isActive;

    const member = await prisma.projectTeam.update({
      where: { id: req.params.memberId },
      data: updateData,
      include: { user: { select: { id: true, name: true } } }
    });
    res.json(member);
  } catch (error) {
    console.error('Erro ao atualizar membro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.delete('/:projectId/team/:memberId', authenticateToken, async (req, res) => {
  try {
    await prisma.projectTeam.delete({ where: { id: req.params.memberId } });
    res.json({ message: 'Membro removido' });
  } catch (error) {
    console.error('Erro ao remover membro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// === RISCOS ===
router.get('/:projectId/risks', authenticateToken, async (req, res) => {
  try {
    const risks = await prisma.projectRisk.findMany({
      where: { projectId: req.params.projectId },
      include: { owner: { select: { id: true, name: true } } },
      orderBy: { identifiedDate: 'desc' }
    });
    res.json(risks);
  } catch (error) {
    console.error('Erro ao listar riscos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/:projectId/risks', authenticateToken, async (req, res) => {
  try {
    const { title, description, level, impact, mitigationPlan, ownerId } = req.body;
    if (!title) return res.status(400).json({ error: 'Título é obrigatório' });

    const risk = await prisma.projectRisk.create({
      data: {
        projectId: req.params.projectId,
        title,
        description,
        level: level || 'MEDIUM',
        impact,
        mitigationPlan,
        ownerId: ownerId || req.user.id
      },
      include: { owner: { select: { id: true, name: true } } }
    });
    res.status(201).json(risk);
  } catch (error) {
    console.error('Erro ao criar risco:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/:projectId/risks/:riskId', authenticateToken, async (req, res) => {
  try {
    const { title, description, level, status, impact, mitigationPlan, ownerId, resolvedDate } = req.body;
    const updateData = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (level) updateData.level = level;
    if (status) updateData.status = status;
    if (impact !== undefined) updateData.impact = impact;
    if (mitigationPlan !== undefined) updateData.mitigationPlan = mitigationPlan;
    if (ownerId) updateData.ownerId = ownerId;
    if (resolvedDate) updateData.resolvedDate = new Date(resolvedDate);

    const risk = await prisma.projectRisk.update({
      where: { id: req.params.riskId },
      data: updateData
    });
    res.json(risk);
  } catch (error) {
    console.error('Erro ao atualizar risco:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// === PENDÊNCIAS / ISSUES ===
router.get('/:projectId/issues', authenticateToken, async (req, res) => {
  try {
    const issues = await prisma.projectIssue.findMany({
      where: { projectId: req.params.projectId },
      include: {
        reportedBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } }
      },
      orderBy: { reportedDate: 'desc' }
    });
    res.json(issues);
  } catch (error) {
    console.error('Erro ao listar issues:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/:projectId/issues', authenticateToken, async (req, res) => {
  try {
    const { title, description, status, priority, assignedToId, taskId } = req.body;
    if (!title) return res.status(400).json({ error: 'Título é obrigatório' });

    const issue = await prisma.projectIssue.create({
      data: {
        projectId: req.params.projectId,
        title,
        description,
        status: status || 'OPEN',
        priority: priority || 'MEDIUM',
        reportedById: req.user.id,
        assignedToId: assignedToId || null,
        taskId: taskId || null
      },
      include: {
        reportedBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } }
      }
    });
    res.status(201).json(issue);
  } catch (error) {
    console.error('Erro ao criar issue:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/:projectId/issues/:issueId', authenticateToken, async (req, res) => {
  try {
    const { title, description, status, priority, assignedToId, resolvedDate } = req.body;
    const updateData = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status) {
      updateData.status = status;
      if (status === 'RESOLVED' || status === 'CLOSED') updateData.resolvedDate = new Date();
    }
    if (priority) updateData.priority = priority;
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId || null;

    const issue = await prisma.projectIssue.update({
      where: { id: req.params.issueId },
      data: updateData
    });
    res.json(issue);
  } catch (error) {
    console.error('Erro ao atualizar issue:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// === MUDANÇAS (CHANGE REQUESTS) ===
router.get('/:projectId/change-requests', authenticateToken, async (req, res) => {
  try {
    const crs = await prisma.projectChangeRequest.findMany({
      where: { projectId: req.params.projectId },
      include: {
        requestedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(crs);
  } catch (error) {
    console.error('Erro ao listar change requests:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/:projectId/change-requests', authenticateToken, async (req, res) => {
  try {
    const { title, description, type, impactCost, impactDays, justification } = req.body;
    if (!title) return res.status(400).json({ error: 'Título é obrigatório' });

    const cr = await prisma.projectChangeRequest.create({
      data: {
        projectId: req.params.projectId,
        title,
        description,
        type: type || 'SCOPE',
        impactCost: impactCost ? parseFloat(impactCost) : 0,
        impactDays: impactDays ? parseInt(impactDays) : 0,
        requestedById: req.user.id,
        justification: justification || {}
      },
      include: { requestedBy: { select: { id: true, name: true } } }
    });
    res.status(201).json(cr);
  } catch (error) {
    console.error('Erro ao criar change request:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/:projectId/change-requests/:crId', authenticateToken, async (req, res) => {
  try {
    const { status, approvedById } = req.body;
    const updateData = {};
    if (status) {
      updateData.status = status;
      if (status === 'APPROVED' || status === 'REJECTED') updateData.decidedAt = new Date();
    }
    if (approvedById) updateData.approvedById = approvedById;

    const cr = await prisma.projectChangeRequest.update({
      where: { id: req.params.crId },
      data: updateData
    });
    res.json(cr);
  } catch (error) {
    console.error('Erro ao atualizar change request:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// === FATURAMENTO ===
router.get('/:projectId/billings', authenticateToken, async (req, res) => {
  try {
    const billings = await prisma.projectBilling.findMany({
      where: { projectId: req.params.projectId },
      include: { milestone: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(billings);
  } catch (error) {
    console.error('Erro ao listar faturamentos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/:projectId/billings', authenticateToken, async (req, res) => {
  try {
    const { milestoneId, amount, tax, dueDate, invoiceNumber } = req.body;
    if (!amount) return res.status(400).json({ error: 'Valor é obrigatório' });

    const billing = await prisma.projectBilling.create({
      data: {
        projectId: req.params.projectId,
        milestoneId: milestoneId || null,
        amount: parseFloat(amount),
        tax: tax ? parseFloat(tax) : 0,
        totalAmount: parseFloat(amount) + (tax ? parseFloat(tax) : 0),
        dueDate: dueDate ? new Date(dueDate) : null,
        invoiceNumber: invoiceNumber || null
      }
    });
    res.status(201).json(billing);
  } catch (error) {
    console.error('Erro ao criar faturamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/:projectId/billings/:billingId', authenticateToken, async (req, res) => {
  try {
    const { status, invoiceNumber, paidAt } = req.body;
    const updateData = {};
    if (status) updateData.status = status;
    if (invoiceNumber) updateData.invoiceNumber = invoiceNumber;
    if (paidAt) updateData.paidAt = new Date(paidAt);

    const billing = await prisma.projectBilling.update({
      where: { id: req.params.billingId },
      data: updateData
    });
    res.json(billing);
  } catch (error) {
    console.error('Erro ao atualizar faturamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// === ACEITE ===
router.get('/:projectId/acceptances', authenticateToken, async (req, res) => {
  try {
    const acceptances = await prisma.projectAcceptance.findMany({
      where: { projectId: req.params.projectId },
      include: { approvedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(acceptances);
  } catch (error) {
    console.error('Erro ao listar aceites:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/:projectId/acceptances', authenticateToken, async (req, res) => {
  try {
    const { type, documentNumber, checklist, notes } = req.body;

    const acceptance = await prisma.projectAcceptance.create({
      data: {
        projectId: req.params.projectId,
        type: type || 'PROVISIONAL',
        documentNumber,
        checklist: checklist || [],
        notes,
        approvedById: req.user.id
      }
    });
    res.status(201).json(acceptance);
  } catch (error) {
    console.error('Erro ao criar aceite:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/:projectId/acceptances/:acceptanceId', authenticateToken, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const updateData = {};
    if (status) {
      updateData.status = status;
      if (status === 'APPROVED') updateData.approvedAt = new Date();
    }
    if (notes !== undefined) updateData.notes = notes;

    const acceptance = await prisma.projectAcceptance.update({
      where: { id: req.params.acceptanceId },
      data: updateData
    });
    res.json(acceptance);
  } catch (error) {
    console.error('Erro ao atualizar aceite:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// === CONFIGURAÇÃO B2G ===
router.get('/:projectId/b2g-config', authenticateToken, async (req, res) => {
  try {
    const config = await prisma.projectB2GConfig.findUnique({ where: { projectId: req.params.projectId } });
    res.json(config || {});
  } catch (error) {
    console.error('Erro ao buscar config B2G:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/:projectId/b2g-config', authenticateToken, async (req, res) => {
  try {
    const { empenhoNumber, empenhoValue, ordemServicoNumber, editalNumber, orgaoCNPJ, fiscalContrato, gestorContrato, medicoes, aditivos, conformidade } = req.body;
    const updateData = {};
    if (empenhoNumber !== undefined) updateData.empenhoNumber = empenhoNumber;
    if (empenhoValue !== undefined) updateData.empenhoValue = parseFloat(empenhoValue);
    if (ordemServicoNumber !== undefined) updateData.ordemServicoNumber = ordemServicoNumber;
    if (editalNumber !== undefined) updateData.editalNumber = editalNumber;
    if (orgaoCNPJ !== undefined) updateData.orgaoCNPJ = orgaoCNPJ;
    if (fiscalContrato !== undefined) updateData.fiscalContrato = fiscalContrato;
    if (gestorContrato !== undefined) updateData.gestorContrato = gestorContrato;
    if (medicoes !== undefined) updateData.medicoes = medicoes;
    if (aditivos !== undefined) updateData.aditivos = aditivos;
    if (conformidade !== undefined) updateData.conformidade = conformidade;

    const config = await prisma.projectB2GConfig.upsert({
      where: { projectId: req.params.projectId },
      update: updateData,
      create: { projectId: req.params.projectId, ...updateData }
    });
    res.json(config);
  } catch (error) {
    console.error('Erro ao atualizar config B2G:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// === CONFIGURAÇÃO B2B ===
router.get('/:projectId/b2b-config', authenticateToken, async (req, res) => {
  try {
    const config = await prisma.projectB2BConfig.findUnique({ where: { projectId: req.params.projectId } });
    res.json(config || {});
  } catch (error) {
    console.error('Erro ao buscar config B2B:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/:projectId/b2b-config', authenticateToken, async (req, res) => {
  try {
    const { slaConfig, slaHistory, billingSchedule, timesheetConfig, contractMargin, realizedMargin } = req.body;
    const updateData = {};
    if (slaConfig !== undefined) updateData.slaConfig = slaConfig;
    if (slaHistory !== undefined) updateData.slaHistory = slaHistory;
    if (billingSchedule !== undefined) updateData.billingSchedule = billingSchedule;
    if (timesheetConfig !== undefined) updateData.timesheetConfig = timesheetConfig;
    if (contractMargin !== undefined) updateData.contractMargin = parseFloat(contractMargin);
    if (realizedMargin !== undefined) updateData.realizedMargin = parseFloat(realizedMargin);

    const config = await prisma.projectB2BConfig.upsert({
      where: { projectId: req.params.projectId },
      update: updateData,
      create: { projectId: req.params.projectId, ...updateData }
    });
    res.json(config);
  } catch (error) {
    console.error('Erro ao atualizar config B2B:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// === ANEXOS ===
router.get('/:projectId/attachments', authenticateToken, async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      select: { id: true }
    });
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

    const attachments = await prisma.projectAttachment.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(attachments);
  } catch (error) {
    console.error('Erro ao listar anexos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/:projectId/attachments', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    const { category, description } = req.body;

    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      select: { id: true }
    });
    if (!project) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    const attachment = await prisma.projectAttachment.create({
      data: {
        projectId: req.params.projectId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        category: normalizeAttachmentCategory(category),
        description: String(description || '').trim() || null,
        uploadedBy: req.user.id
      }
    });
    res.status(201).json(attachment);
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/:projectId/attachments/:attachmentId/download', authenticateToken, async (req, res) => {
  try {
    const attachment = await prisma.projectAttachment.findFirst({
      where: {
        id: req.params.attachmentId,
        projectId: req.params.projectId
      }
    });
    if (!attachment) return res.status(404).json({ error: 'Arquivo não encontrado' });

    const filePath = resolveAttachmentPath(attachment.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Arquivo físico não encontrado' });

    res.download(filePath, attachment.originalName);
  } catch (error) {
    console.error('Erro ao baixar anexo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.delete('/:projectId/attachments/:attachmentId', authenticateToken, async (req, res) => {
  try {
    const attachment = await prisma.projectAttachment.findFirst({
      where: {
        id: req.params.attachmentId,
        projectId: req.params.projectId
      }
    });
    if (!attachment) return res.status(404).json({ error: 'Arquivo não encontrado' });

    const filePath = resolveAttachmentPath(attachment.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await prisma.projectAttachment.delete({ where: { id: req.params.attachmentId } });
    res.json({ message: 'Arquivo removido' });
  } catch (error) {
    console.error('Erro ao deletar anexo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
