import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings, FileText, AlertTriangle, CheckCircle, Play, Loader2,
  Code, ChevronRight, Layers, Upload, FileCheck, Trash2,
  Search, History, LayoutDashboard, ArrowLeft,
  Save, Zap, Calendar, Building2, Globe, FileSearch, ListChecks, ShieldAlert, Clock, Info
} from 'lucide-react';
import { buildApiUrl, getAuthHeaders } from '../config/api';

const toText = (value) => {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const toTextArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => toText(item)).filter(Boolean);
};

const isUnknownText = (value) =>
  /^(n[aã]o identificado|n[aã]o informado|n\/a|na|nd|-|--)?$/i.test(toText(value));

const toSafeFileName = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'resumo-edital-tr';

const extractDateFromText = (value) => {
  const text = toText(value);
  const match = text.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
  return match?.[1] || '';
};

const extractTimeFromText = (value) => {
  const text = toText(value);
  const match = text.match(/\b(\d{1,2}:\d{2})\b/);
  return match?.[1] || '';
};

const toIsoDate = (value) => {
  const text = toText(value);
  if (!text) return null;

  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}T00:00:00.000Z`;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const resolveSavedAnalysisScope = () => {
  try {
    const rawUser = localStorage.getItem('user');
    const user = rawUser ? JSON.parse(rawUser) : {};
    const userId = String(user?.id || user?.userId || '').trim();
    if (!userId) return null;

    const companyId = String(
      localStorage.getItem('companyId') ||
        localStorage.getItem('selectedCompanyId') ||
        localStorage.getItem('tenantId') ||
        'crm-b2g-default'
    ).trim();

    const roleRaw = String(user?.role || '').toUpperCase();
    const userRole =
      roleRaw === 'ADMIN' || roleRaw === 'DIRECTOR' || roleRaw === 'MANAGER' ? 'admin' : 'user';

    return {
      companyId: companyId || 'crm-b2g-default',
      userId,
      userRole
    };
  } catch (_error) {
    return null;
  }
};

const normalizeItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const row = item && typeof item === 'object' ? item : {};
      const name = toText(row.item || row.name || row.nome);
      const quantity = toText(row.qtd || row.quantity || row.quantidade);
      const specs = toText(row.desc || row.specs || row.especificacoes);
      if (!name && !quantity && !specs) return null;
      return {
        name: name || 'Não identificado',
        quantity: quantity || 'Não identificado',
        specs: specs || 'Não identificado'
      };
    })
    .filter(Boolean);
};

const normalizeRisks = (risks) => {
  if (!Array.isArray(risks)) return [];
  return risks
    .map((risk) => {
      if (typeof risk === 'string') return risk.trim();
      if (!risk || typeof risk !== 'object') return '';
      const title = toText(risk.titulo || risk.title);
      const description = toText(risk.descricao || risk.description);
      const severity = toText(risk.severidade || risk.severity);
      if (!title && !description) return '';
      const severityText = severity ? ` (${severity})` : '';
      return `${title || 'Risco identificado'}${severityText}: ${description || 'Não identificado'}`.trim();
    })
    .filter(Boolean);
};

const normalizeEditalResult = (result) => {
  const data = result && typeof result === 'object' ? result : {};
  const identificacao = data.identificacao && typeof data.identificacao === 'object' ? data.identificacao : {};
  const prazos = Array.isArray(data.prazos) ? data.prazos : [];
  const exigencias = Array.isArray(data.exigencias) ? data.exigencias : [];
  const openingDate = extractDateFromText(identificacao.data_sessao);
  const openingTime = extractTimeFromText(identificacao.data_sessao);

  const deadlines = {
    publicationDate: 'Não identificado',
    impugnationDeadline: 'Não identificado',
    clarificationDeadline: 'Não identificado',
    proposalDeadline: 'Não identificado',
    contractTerm: 'Não identificado'
  };

  prazos.forEach((prazo) => {
    const titulo = toText(prazo?.titulo).toLowerCase();
    const descricao = toText(prazo?.descricao) || toText(prazo?.titulo);
    if (!descricao) return;

    if (titulo.includes('public')) deadlines.publicationDate = descricao;
    else if (titulo.includes('impugn')) deadlines.impugnationDeadline = descricao;
    else if (titulo.includes('esclarec')) deadlines.clarificationDeadline = descricao;
    else if (titulo.includes('proposta') || titulo.includes('sess') || titulo.includes('abertura')) deadlines.proposalDeadline = descricao;
    else if (titulo.includes('contrat') || titulo.includes('vig') || titulo.includes('execu')) deadlines.contractTerm = descricao;
  });

  const requirements = {
    legal: [],
    technical: [],
    economic: [],
    fiscal: []
  };

  exigencias.forEach((item) => {
    const categoria = toText(item?.categoria).toLowerCase();
    const requisito = toText(item?.requisito || item?.desc || item?.item);
    if (!requisito) return;

    if (categoria.includes('jur') || categoria.includes('legal')) requirements.legal.push(requisito);
    else if (categoria.includes('econ') || categoria.includes('finan') || categoria.includes('balan')) requirements.economic.push(requisito);
    else if (categoria.includes('fiscal') || categoria.includes('tribut')) requirements.fiscal.push(requisito);
    else requirements.technical.push(requisito);
  });

  return {
    analysisType: 'edital',
    general: {
      openingDate: openingDate || 'Não identificado',
      openingTime: openingTime || 'Não identificado',
      portal: toText(identificacao.portal) || 'Não identificado',
      agency: toText(identificacao.orgao) || 'Não identificado',
      modality: toText(identificacao.modalidade) || 'Não identificado',
      objectSummary: toText(identificacao.objeto) || 'Não identificado'
    },
    deadlines,
    requirements,
    items: normalizeItems(data.itens_tr),
    risks: normalizeRisks(data.riscos),
    legacy: data
  };
};

const normalizeTrResult = (result) => {
  const data = result && typeof result === 'object' ? result : {};
  const identificacao = data.identificacao && typeof data.identificacao === 'object' ? data.identificacao : {};
  const normalizedItems = normalizeItems(data.itens_tr);
  const risks = normalizeRisks(data.riscos);
  const trSummary =
    toText(data.resumo_especificacoes) ||
    toText(identificacao.objeto) ||
    'Não identificado';
  const termRequirements = normalizedItems
    .map((item) => toText(item.specs) || toText(item.name))
    .filter(Boolean);
  const technicalNotebook = termRequirements.slice(0, 10).map((termRequirement) => ({
    termRequirement,
    meetsRequirement: 'NAO_ATENDE',
    datasheetEvidence: `TR exige ${termRequirement}. Modelo possui Não identificado`,
    rationale: 'Comparação técnica detalhada indisponível neste fluxo sem modelo/datasheet.'
  }));
  while (technicalNotebook.length < 5) {
    technicalNotebook.push({
      termRequirement: `Requisito técnico ${technicalNotebook.length + 1} não identificado`,
      meetsRequirement: 'NAO_ATENDE',
      datasheetEvidence: 'TR exige requisito técnico. Modelo possui Não identificado',
      rationale: 'Documento analisado não trouxe requisito técnico estruturado para este item.'
    });
  }

  return {
    analysisType: 'tr',
    trSummary,
    analyzedModel: {
      modelName: 'Não identificado',
      manufacturer: 'Não identificado',
      providedSpecs: 'Não identificado'
    },
    termRequirements,
    technicalNotebook,
    compliantEquipment: [],
    complianceOverview: {
      totalRequirements: technicalNotebook.length,
      metRequirements: technicalNotebook.filter((row) => row.meetsRequirement === 'ATENDE').length,
      fullCompliance: false
    },
    general: {
      openingDate: 'Não identificado',
      openingTime: 'Não identificado',
      portal: 'Não identificado',
      agency: toText(identificacao.orgao) || 'Não identificado',
      modality: 'Não identificado',
      objectSummary: toText(identificacao.objeto) || trSummary
    },
    deadlines: {
      publicationDate: 'Não identificado',
      impugnationDeadline: 'Não identificado',
      clarificationDeadline: 'Não identificado',
      proposalDeadline: 'Não identificado',
      contractTerm: 'Não identificado'
    },
    requirements: {
      legal: [],
      technical: [],
      economic: [],
      fiscal: []
    },
    items: normalizedItems,
    risks,
    legacy: data
  };
};

const normalizeResultForPersistence = (result, mode) =>
  mode === 'tr' ? normalizeTrResult(result) : normalizeEditalResult(result);

const fileToDataUri = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível preparar o PDF para análise.'));
    reader.readAsDataURL(file);
  });

const backendRiskToRaw = (risk, index) => {
  if (typeof risk === 'string') {
    return {
      titulo: `Risco ${index + 1}`,
      descricao: risk,
      severidade: /cr[ií]tic|alto|alta|grave|impedit/i.test(risk) ? 'alta' : 'media'
    };
  }

  return {
    titulo: toText(risk?.title || risk?.titulo) || `Risco ${index + 1}`,
    descricao: toText(risk?.description || risk?.descricao || risk) || 'Não identificado',
    severidade: toText(risk?.severity || risk?.severidade) || 'media'
  };
};

const compactTrQuantity = (quantity) => {
  const text = toText(quantity);
  if (isUnknownText(text)) return '';
  const unitOnly = text.match(/^(\d+(?:[\.,]\d+)?)\s*(?:un|und|unid\.?|unidade|unidades)$/i);
  return unitOnly ? unitOnly[1] : text;
};

const normalizeComparableText = (value) =>
  toText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const extractTrItemHighlights = (name, specs) => {
  const source = `${name || ''} ${specs || ''}`;
  const nameText = normalizeComparableText(name);
  if (/\b(\d{1,4}\s*portas?|i[3579]|ryzen|ssd|\d+\s*gb|poe|gigabit|10g|wi\s*fi)\b/i.test(name || '')) {
    return [];
  }

  const highlights = [];
  const patterns = [
    /\b\d{1,4}\s*portas?\b/gi,
    /\b(?:core\s*)?i[3579](?:-\d{3,5}[a-z]*)?\b/gi,
    /\bryzen\s*[3579](?:\s+\d{3,5}[a-z]*)?\b/gi,
    /\b\d+\s*gb\s*(?:ram|mem[oó]ria)?\b/gi,
    /\bssd\s*\d+\s*(?:gb|tb)\b/gi,
    /\bpoe\+?\b/gi,
    /\bgigabit\b/gi,
    /\b10g\b/gi,
    /\bgerenci[aá]vel\b/gi,
    /\bwi-?fi\s*\d?\b/gi
  ];

  patterns.forEach((pattern) => {
    Array.from(source.matchAll(pattern)).forEach((match) => {
      const token = toText(match[0]).toLowerCase();
      const key = normalizeComparableText(token);
      const processorShort = key.match(/\bi([3579])\b/)?.[0] || '';
      if (
        !key ||
        nameText.includes(key) ||
        (processorShort && nameText.includes(processorShort)) ||
        highlights.some((item) => normalizeComparableText(item) === key)
      ) return;
      highlights.push(token);
    });
  });

  return highlights.slice(0, 1);
};

const isTrCatalogNoise = (name, specs) => {
  const text = normalizeComparableText(`${name || ''} ${specs || ''}`);
  const hasProductSignal = /\b(switch|desktop|notebook|computador|servidor|storage|roteador|firewall|access\s+point|appliance|software|licenca|sistema|plataforma|impressora|scanner|monitor|tablet|camera|equipamento|servico)\b/.test(text);
  const hasQuantity = /\b\d+(?:[\.,]\d+)?\b/.test(text);
  const hasTocNoise = /[.]{5,}/.test(`${name || ''} ${specs || ''}`) ||
    /\b(preambulo|sumario|indice|disponibilidade financeira|parametros para a licitacao|elementos instrutores|retirada e alteracoes do edital|publicidade dos atos|habilitacao|julgamento|sancoes|penalidades|valor maximo para a contratacao)\b/.test(text);

  return hasTocNoise && !(hasProductSignal && hasQuantity);
};

const formatTrItemDisplayName = ({ name, quantity, specs }) => {
  const baseName = toText(name).replace(/\s+/g, ' ');
  const quantityText = compactTrQuantity(quantity);
  const highlights = extractTrItemHighlights(baseName, specs);
  const alreadyHasQuantity = quantityText && normalizeComparableText(baseName).startsWith(normalizeComparableText(quantityText));
  const label = [alreadyHasQuantity ? '' : quantityText, baseName, ...highlights]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return label || baseName || 'Item técnico não identificado';
};

const stripTrItemNameFromSpecs = (name, specs) => {
  const baseName = toText(name);
  const text = toText(specs) || 'Especificação não identificada';
  if (!baseName) return text;
  const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`^${escaped}\\s*[:\\-–]?\\s*`, 'i'), '').trim() || text;
};

const buildTrSpecsDisplaySummary = (items, fallbackSummary) => {
  if (!items.length) {
    const fallback = toText(fallbackSummary);
    if (fallback && !isTrCatalogNoise(fallback, '')) return fallback;
    return 'Nenhum produto, serviço ou item técnico foi identificado com segurança no TR.';
  }

  return [
    'Resumo técnico dos produtos e especificações identificados no TR:',
    ...items.map((item, index) => `${index + 1}. ${item.item}: ${stripTrItemNameFromSpecs(item.rawName, item.desc)}`)
  ].join('\n');
};

const backendResultToRawResult = (mode, data) => {
  const result = data && typeof data === 'object' ? data : {};

  if (mode === 'tr') {
    const productItems = (Array.isArray(result.items) ? result.items : [])
      .map((item, index) => {
        const name = toText(item?.name || item?.item) || `Item técnico ${index + 1}`;
        const quantity = toText(item?.quantity || item?.qtd || item?.quantidade) || 'Não identificado';
        const specs = toText(item?.specs || item?.description || item?.desc) || 'Especificação não identificada';

        return {
          item: formatTrItemDisplayName({ name, quantity, specs }),
          rawName: name,
          desc: specs,
          qtd: quantity
        };
      })
      .filter((item) => item.item && !isUnknownText(item.item) && !isTrCatalogNoise(item.item, item.desc));
    const productSummary = buildTrSpecsDisplaySummary(productItems, result.trSummary);
    const total = Number(result?.complianceOverview?.totalRequirements) || 0;
    const met = Number(result?.complianceOverview?.metRequirements) || 0;
    const score = total > 0 ? Math.round((met / total) * 10) : 7;

    return {
      _tipo: 'tr',
      identificacao: {
        orgao: 'Não identificado',
        objeto: productItems.length ? productItems.map((item) => item.item).join(', ') : 'Itens técnicos não identificados'
      },
      resumo_especificacoes: productSummary,
      itens_tr: productItems,
      riscos: [],
      pontuacao_viabilidade: score
    };
  }

  const general = result.general || {};
  const deadlines = result.deadlines || {};
  const requirements = result.requirements || {};
  const requirementRows = [
    ['Jurídica', requirements.legal],
    ['Técnica', requirements.technical],
    ['Econômico-financeira', requirements.economic],
    ['Fiscal', requirements.fiscal]
  ].flatMap(([categoria, rows]) =>
    (Array.isArray(rows) ? rows : []).map((requisito) => ({ categoria, requisito }))
  );

  return {
    _tipo: 'edital',
    identificacao: {
      data_sessao: [general.openingDate, general.openingTime].filter((value) => !isUnknownText(value)).join(' ') || 'Não identificado',
      orgao: toText(general.agency) || 'Não identificado',
      modalidade: toText(general.modality) || 'Não identificado',
      portal: toText(general.portal) || 'Não identificado',
      objeto: toText(general.objectSummary) || 'Resumo não disponível.'
    },
    prazos: [
      { titulo: 'Publicação', descricao: deadlines.publicationDate },
      { titulo: 'Impugnação', descricao: deadlines.impugnationDeadline },
      { titulo: 'Esclarecimentos', descricao: deadlines.clarificationDeadline },
      { titulo: 'Proposta', descricao: deadlines.proposalDeadline },
      { titulo: 'Vigência/Contrato', descricao: deadlines.contractTerm }
    ].filter((row) => !isUnknownText(row.descricao)),
    exigencias: requirementRows,
    documentacao: [],
    itens_tr: (Array.isArray(result.items) ? result.items : []).map((item) => ({
      item: toText(item?.name) || 'Item não identificado',
      desc: toText(item?.specs) || 'Não identificado',
      qtd: toText(item?.quantity) || 'Não identificado'
    })),
    riscos: (Array.isArray(result.risks) ? result.risks : []).map(backendRiskToRaw),
    pontuacao_viabilidade: 7
  };
};

const B2GAnaliseEditaisTR = () => {
  const navigate = useNavigate();
  const [view, setView] = useState('dashboard');
  const [modoAnalise, setModoAnalise] = useState('edital');
  const [editalText, setEditalText] = useState('');
  const [fileDataUri, setFileDataUri] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [result, setResult] = useState(null);
  const [normalizedResult, setNormalizedResult] = useState(null);
  const [activeTab, setActiveTab] = useState('geral');
  const [savingToResumos, setSavingToResumos] = useState(false);
  const [convertingToOpportunity, setConvertingToOpportunity] = useState(false);
  const [createdNoticeId, setCreatedNoticeId] = useState('');
  const [actionFeedback, setActionFeedback] = useState({ type: '', message: '' });

  const editalFileRef = useRef(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      }
    };
    document.head.appendChild(script);
  }, []);

  const addLog = (msg, type = 'info') => {
    setLogs((prev) => [...prev, { msg, type, time: new Date().toLocaleTimeString() }]);
  };

  const extractTextFromPDF = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += `${textContent.items.map((item) => item.str).join(' ')}\n`;
    }
    return fullText;
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setNormalizedResult(null);
    setFileDataUri('');
    setCreatedNoticeId('');
    setActionFeedback({ type: '', message: '' });
    addLog(`Lendo arquivo: ${file.name}...`);
    try {
      const [text, dataUri] = await Promise.all([
        extractTextFromPDF(file),
        fileToDataUri(file)
      ]);
      setEditalText(text);
      setFileDataUri(dataUri);
      addLog('Texto extraído com sucesso.', 'success');
    } catch (_error) {
      addLog('Erro ao ler PDF.', 'error');
    }
  };

  const runAnalysis = async () => {
    const hasDocument = modoAnalise === 'tr' ? Boolean(fileDataUri) : Boolean(editalText);
    if (!hasDocument) {
      addLog('Por favor, selecione um documento.', 'error');
      return;
    }

    setLoading(true);
    addLog(`Iniciando análise profunda de ${modoAnalise.toUpperCase()}...`);
    addLog(modoAnalise === 'tr'
      ? 'Enviando PDF para extração técnica no backend...'
      : 'Executando o mecanismo original de análise de editais...');

    try {
      const endpoint = modoAnalise === 'tr' ? '/ai-analysis/tr' : '/ai-analysis/edital-legacy';
      const payload = modoAnalise === 'tr'
        ? {
            fileDataUri,
            analyzedModelName: fileName.replace(/\.pdf$/i, '') || 'Documento TR',
            analyzedModelManufacturer: '',
            analyzedModelSpecs: 'Especificações do modelo não informadas pelo usuário.'
          }
        : { documentText: editalText.slice(0, 60000) };

      const response = await fetch(buildApiUrl(endpoint), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || 'Falha na análise de edital/TR.');
      }

      const rawResult = modoAnalise === 'tr'
        ? backendResultToRawResult('tr', data)
        : { ...data, _tipo: 'edital' };
      const normalized = normalizeResultForPersistence(rawResult, modoAnalise);
      setResult(rawResult);
      setNormalizedResult(normalized);
      setCreatedNoticeId('');
      setActionFeedback({ type: '', message: '' });
      setView('detail');
      setActiveTab(modoAnalise === 'tr' ? 'resumo especificações' : 'geral');
      addLog(modoAnalise === 'tr'
        ? 'Sucesso! Extração técnica do TR concluída.'
        : 'Sucesso! Análise detalhada do edital concluída pelo mecanismo original.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha total na análise.';
      addLog(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const scoreFromResult = (mode, normalizedData, rawResult) => {
    const rawScore = Number(rawResult?.pontuacao_viabilidade);
    if (Number.isFinite(rawScore)) {
      if (rawScore >= 0 && rawScore <= 10) return Math.max(0, Math.min(100, Math.round(rawScore * 10)));
      return Math.max(0, Math.min(100, Math.round(rawScore)));
    }
    if (mode === 'tr') {
      const total = Number(normalizedData?.complianceOverview?.totalRequirements) || 0;
      const met = Number(normalizedData?.complianceOverview?.metRequirements) || 0;
      if (total > 0) return Math.max(0, Math.min(100, Math.round((met / total) * 100)));
    }
    return 55;
  };

  const getNoticeSummary = (mode, normalizedData) => {
    if (mode === 'tr') {
      return toText(normalizedData?.trSummary) || toText(normalizedData?.general?.objectSummary) || 'Resumo não identificado.';
    }
    return toText(normalizedData?.general?.objectSummary) || 'Resumo não identificado.';
  };

  const buildNoticePayload = (mode, normalizedData) => {
    const summary = getNoticeSummary(mode, normalizedData);
    const score = scoreFromResult(mode, normalizedData, result);
    const recommendation = score >= 75 ? 'GO' : score >= 55 ? 'GO_COM_RESSALVAS' : 'NO_GO';
    const baseName = toText(fileName).replace(/\.pdf$/i, '') || 'Documento analisado';
    const agency = toText(normalizedData?.general?.agency);
    const portal = toText(normalizedData?.general?.portal);
    const proposalDeadline = toText(normalizedData?.deadlines?.proposalDeadline);
    const openingDate = toText(normalizedData?.general?.openingDate);
    const riskList = toTextArray(normalizedData?.risks);

    return {
      type: mode === 'tr' ? 'TERMO_REFERENCIA' : 'EDITAL',
      title: baseName,
      organization: agency && agency !== 'Não identificado' ? agency : 'Órgão não identificado',
      stateCode: '',
      modality: toText(normalizedData?.general?.modality) || '',
      objectDescription: toText(normalizedData?.general?.objectSummary) || summary,
      openingDate: toIsoDate(openingDate),
      proposalDueDate: toIsoDate(proposalDeadline),
      sourceUrl: portal && portal !== 'Não identificado' ? portal : '',
      summary,
      status: 'ANALISE_CONCLUIDA',
      documentText: toText(editalText).slice(0, 30000),
      aiAnalysis: {
        generatedAt: new Date().toISOString(),
        resumoExecutivo: summary,
        scoreAderencia: score,
        recomendacao: recommendation,
        riscos: riskList,
        pontosChave: [],
        oportunidades: [],
        checklistDocumentacao: [],
        templateExtractedData: normalizedData
      }
    };
  };

  const ensureNoticeForConversion = async (normalizedData) => {
    if (createdNoticeId) {
      return { id: createdNoticeId };
    }

    const payload = buildNoticePayload(modoAnalise, normalizedData);
    const response = await fetch(buildApiUrl('/b2g/editais'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.id) {
      throw new Error(data?.error || data?.message || 'Não foi possível criar o edital base para conversão.');
    }
    setCreatedNoticeId(data.id);
    return data;
  };

  const handleSaveToResumos = async () => {
    if (!result || !normalizedResult || savingToResumos) return;
    const scope = resolveSavedAnalysisScope();
    if (!scope) {
      const message = 'Sessão inválida para salvar resumo.';
      setActionFeedback({ type: 'error', message });
      addLog(message, 'error');
      return;
    }

    setSavingToResumos(true);
    setActionFeedback({ type: '', message: '' });
    try {
      const payload = {
        analysisId: `${modoAnalise}-${Date.now()}-${toSafeFileName(fileName || 'resumo.pdf')}`,
        fileName: fileName || 'resumo.pdf',
        processedAt: new Date().toISOString(),
        extractedData: normalizedResult,
        originalFileDataUri: null,
        summaryPdfDataUri: null
      };
      const response = await fetch(buildApiUrl('/analyses/saved'), {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'x-company-id': scope.companyId,
          'x-user-id': scope.userId,
          'x-user-role': scope.userRole
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || 'Não foi possível salvar em Resumos de Edital.');
      }
      const message = 'Resumo salvo com sucesso em Resumos de Edital.';
      setActionFeedback({ type: 'success', message });
      addLog(message, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar resumo.';
      setActionFeedback({ type: 'error', message });
      addLog(message, 'error');
    } finally {
      setSavingToResumos(false);
    }
  };

  const handleConvertToOpportunity = async () => {
    if (!result || !normalizedResult || convertingToOpportunity) return;
    setConvertingToOpportunity(true);
    setActionFeedback({ type: '', message: '' });
    try {
      const notice = await ensureNoticeForConversion(normalizedResult);
      if (!notice?.id) {
        throw new Error('Não foi possível preparar o resumo para conversão.');
      }
      const response = await fetch(buildApiUrl(`/b2g/editais/${notice.id}/converter-oportunidade`), {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.opportunity?.id) {
        throw new Error(data?.error || 'Não foi possível converter em oportunidade.');
      }
      const message = 'Resumo convertido com sucesso. Redirecionando para Oportunidades B2G...';
      setActionFeedback({ type: 'success', message });
      addLog(message, 'success');
      navigate(`/b2g-oportunidades?clientType=B2G&opportunityId=${encodeURIComponent(data.opportunity.id)}&mode=edit`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao converter resumo em oportunidade.';
      setActionFeedback({ type: 'error', message });
      addLog(message, 'error');
    } finally {
      setConvertingToOpportunity(false);
    }
  };

  const renderTabContent = () => {
    if (!result) return null;

    switch (activeTab) {
      case 'resumo especificações':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <h3 className="text-white font-bold text-lg flex items-center gap-3">
              <Info className="w-5 h-5 text-sky-400" /> Detalhamento Técnico do TR
            </h3>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-6 text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
              {result.resumo_especificacoes || 'Não foi possível consolidar as especificações técnicas detalhadas.'}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-sky-500/10 bg-sky-500/5 p-5">
                <h4 className="text-[10px] font-black text-sky-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <ShieldAlert className="w-3 h-3" /> Conformidade Normativa
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">Verifique se as certificações exigidas no resumo acima estão vigentes para sua empresa.</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/5 p-5">
                <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <ListChecks className="w-3 h-3" /> Próximos Passos
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">Utilize o resumo acima para solicitar cotações precisas com seus fornecedores habituais.</p>
              </div>
            </div>
          </div>
        );
      case 'geral':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <section>
              <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-2">Identificação do Certame</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {result.identificacao?.data_sessao && (
                  <div className="flex items-start gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-5">
                    <div className="rounded-xl bg-slate-800 p-3 text-sky-300 shadow-inner"><Calendar className="w-5 h-5" /></div>
                    <div>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Data da Sessão</span>
                      <p className="text-white font-bold text-base mt-1">{result.identificacao.data_sessao}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-5">
                  <div className="rounded-xl bg-slate-800 p-3 text-sky-300 shadow-inner"><Building2 className="w-5 h-5" /></div>
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Órgão Licitante</span>
                    <p className="text-white font-bold text-base mt-1">{result.identificacao?.orgao || 'Não identificado'}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-8">
                {result.identificacao?.modalidade && (
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block tracking-widest">Modalidade do Processo</label>
                    <div className="inline-block bg-sky-500/10 text-sky-400 border border-sky-500/20 px-4 py-2 rounded-xl text-xs font-bold">
                      {result.identificacao.modalidade}
                    </div>
                  </div>
                )}
                {result.identificacao?.portal && (
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block tracking-widest">Plataforma Eletrônica</label>
                    <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/55 p-4">
                      <Globe className="w-4 h-4 text-sky-500" />
                      <p className="text-sky-400 text-sm font-bold">{result.identificacao.portal}</p>
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block tracking-widest">Objeto Principal Analisado</label>
                  <p className="rounded-2xl border border-slate-800/70 bg-slate-900/45 p-5 text-sm leading-relaxed text-slate-300 shadow-inner italic">
                    "{result.identificacao?.objeto || 'Resumo não disponível.'}"
                  </p>
                </div>
              </div>
            </section>
          </div>
        );
      case 'itens / tr':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-bold text-lg">
                {result?._tipo === 'tr' ? 'Itens Identificados no TR' : 'Catálogo Técnico de Itens'}
              </h3>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-800 px-3 py-1 rounded-full">
                {result.itens_tr?.length || 0} Itens Mapeados
              </span>
            </div>
            {result.itens_tr?.map((item, i) => (
              <div key={i} className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-5 transition-all hover:bg-slate-800/60 group">
                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400 font-black text-xs">
                      {i + 1}
                    </div>
                    <div className="text-sm text-white font-black uppercase tracking-tight">{item.item}</div>
                  </div>
                  {result?._tipo !== 'tr' && (
                    <div className="text-xs font-black text-sky-400 bg-sky-500/10 px-4 py-1.5 rounded-full border border-sky-500/20 shadow-lg shadow-sky-500/5">
                      Qtd: {item.qtd}
                    </div>
                  )}
                </div>
                {result?._tipo !== 'tr' && (
                  <div className="text-xs text-slate-400 leading-relaxed font-medium bg-black/30 p-5 rounded-2xl border border-slate-800/50">
                    {item.desc}
                  </div>
                )}
              </div>
            )) || <p className="text-slate-500 italic p-10 text-center">Nenhum item processado no catálogo.</p>}
          </div>
        );
      case 'prazos':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
            {result.prazos?.map((p, i) => (
              <div key={i} className="flex items-start gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-5">
                <div className="rounded-xl bg-sky-500/10 p-3 text-sky-300"><Clock className="w-5 h-5" /></div>
                <div>
                  <h4 className="text-white font-black text-sm uppercase tracking-tight">{p.titulo}</h4>
                  <p className="text-slate-400 text-xs mt-2 leading-relaxed">{p.descricao}</p>
                </div>
              </div>
            )) || <p className="text-slate-500 italic">Cronograma não detalhado no documento.</p>}
          </div>
        );
      case 'exigencias':
        return (
          <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-500">
            {result.exigencias?.map((e, i) => (
              <div key={i} className="flex items-start gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-5">
                <div className="mt-1 rounded-xl bg-emerald-500/10 p-2 text-emerald-300"><ListChecks className="w-4 h-4" /></div>
                <div>
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{e.categoria}</span>
                  <p className="text-slate-300 text-sm mt-1 font-medium">{e.requisito}</p>
                </div>
              </div>
            )) || <p className="text-slate-500 italic">Exigências de qualificação não encontradas.</p>}
          </div>
        );
      case 'documentação':
        return (
          <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-500">
            <h3 className="text-white font-bold text-lg mb-4">Checklist de Documentação Obrigatória</h3>
            {result.documentacao?.map((doc, i) => (
              <div key={i} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/55 p-5">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${doc.obrigatorio ? 'bg-sky-500/10 text-sky-400 shadow-lg shadow-sky-500/5' : 'bg-slate-800 text-slate-500'}`}>
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{doc.tipo}</span>
                    <p className="text-sm font-bold text-slate-200 mt-1">{doc.doc}</p>
                  </div>
                </div>
                {doc.obrigatorio && (
                  <div className="flex items-center gap-2 bg-red-500/10 text-red-500 border border-red-500/20 px-3 py-1.5 rounded-xl">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="text-[9px] font-black uppercase">Crítico</span>
                  </div>
                )}
              </div>
            )) || <p className="text-slate-500 italic">Nenhum documento listado na análise.</p>}
          </div>
        );
      case 'riscos / ia':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
            <h3 className="text-white font-bold text-lg mb-4">Mapa de Riscos e Fragilidades</h3>
            {result.riscos?.map((r, i) => (
              <div key={i} className="flex items-start gap-5 rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
                <div className={`shrink-0 rounded-xl p-4 ${r.severidade === 'alta' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h4 className="text-white font-black uppercase text-sm tracking-tight">{r.titulo}</h4>
                    <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${r.severidade === 'alta' ? 'bg-red-500 text-white' : 'bg-amber-500 text-black'}`}>
                      {r.severidade}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs mt-3 leading-relaxed italic">"{r.descricao}"</p>
                </div>
              </div>
            )) || <p className="text-slate-500 italic">Nenhum risco técnico mapeado automaticamente.</p>}
          </div>
        );
      default:
        return null;
    }
  };

  const MetricCard = ({ icon: Icon, label, value, tone = 'sky' }) => {
    const tones = {
      sky: 'border-sky-400/15 bg-sky-400/10 text-sky-300',
      emerald: 'border-emerald-400/15 bg-emerald-400/10 text-emerald-300',
      amber: 'border-amber-400/15 bg-amber-400/10 text-amber-300'
    };

    return (
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/55 p-5 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.95)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
            <h4 className="mt-2 text-4xl font-black leading-none text-white">{value}</h4>
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${tones[tone] || tones.sky}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </div>
    );
  };

  const Sidebar = () => (
    <div className="w-64 shrink-0 border-r border-slate-800/80 bg-[#101723] p-6 shadow-2xl z-30">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500 text-[#08111f] shadow-lg shadow-sky-500/20">
          <Layers className="h-6 w-6" />
        </div>
        <div>
          <div className="text-lg font-black tracking-tight text-white">Analisa.ai</div>
          <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-sky-300/70">B2G Intelligence</div>
        </div>
      </div>
      <nav className="space-y-2">
        <button onClick={() => setView('dashboard')} className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all ${view === 'dashboard' ? 'bg-sky-500/10 text-sky-300 border border-sky-400/20 shadow-lg shadow-sky-500/5' : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-300'}`}>
          <LayoutDashboard className="h-5 w-5" /> Dashboard
        </button>
        <button onClick={() => setView('history')} className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all ${view === 'history' ? 'bg-sky-500/10 text-sky-300 border border-sky-400/20 shadow-lg shadow-sky-500/5' : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-300'}`}>
          <History className="h-5 w-5" /> Histórico
        </button>
      </nav>

      <div className="mt-8 rounded-2xl border border-slate-800/80 bg-slate-950/35 p-4">
        <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Precisão</div>
        <p className="text-xs leading-relaxed text-slate-400">Use PDFs com texto selecionável para melhorar a extração técnica e reduzir falhas de leitura.</p>
      </div>
    </div>
  );

  const Dashboard = () => (
    <div className="flex-1 overflow-y-auto bg-[#0d1422] p-6 custom-scrollbar lg:p-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-400/15 bg-sky-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-sky-300">
            <Zap className="h-3.5 w-3.5" /> Auditoria assistida por IA
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white lg:text-4xl">Análise de Licitações com IA</h1>
          <p className="mt-3 max-w-3xl text-sm font-medium leading-relaxed text-slate-400 lg:text-base">Extraia informações do edital completo ou gere um caderno técnico do Termo de Referência com rastreabilidade operacional.</p>
        </div>
        <div className="flex w-fit rounded-xl border border-slate-800 bg-slate-950/45 p-1">
          <button onClick={() => setModoAnalise('edital')} className={`rounded-lg px-4 py-2 text-xs font-black uppercase transition-all ${modoAnalise === 'edital' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-500 hover:text-slate-300'}`}>Edital</button>
          <button onClick={() => setModoAnalise('tr')} className={`rounded-lg px-4 py-2 text-xs font-black uppercase transition-all ${modoAnalise === 'tr' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-500 hover:text-slate-300'}`}>TR</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-2xl shadow-slate-950/25">
            <div className="border-b border-slate-800 bg-slate-950/35 px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Documento base</p>
                  <h2 className="mt-1 text-xl font-black text-white">{modoAnalise === 'edital' ? 'Importar edital' : 'Analisar TR'}</h2>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                  {modoAnalise === 'edital' ? <Upload className="h-6 w-6" /> : <FileSearch className="h-6 w-6" />}
                </div>
              </div>
            </div>

            <div className="p-6">
              <input type="file" ref={editalFileRef} className="hidden" accept=".pdf" onChange={handleFileUpload} />

              <button
                onClick={() => editalFileRef.current.click()}
                className="group flex min-h-[180px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-sky-400/25 bg-[#0b1220] p-8 text-center transition-all hover:border-sky-300/55 hover:bg-sky-400/5"
              >
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300 transition-transform group-hover:scale-105">
                  <Upload className="h-8 w-8" />
                </div>
                <div className="max-w-full break-words text-base font-black text-white">
                  {fileName || 'Selecionar documento PDF'}
                </div>
                <div className="mt-2 max-w-sm text-xs leading-relaxed text-slate-500">
                  PDF até 20MB. O conteúdo será extraído localmente antes da auditoria por IA.
                </div>
              </button>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Modo</div>
                  <div className="mt-2 text-sm font-bold text-slate-200">{modoAnalise === 'edital' ? 'Edital completo' : 'Termo de Referência'}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Status</div>
                  <div className={`mt-2 text-sm font-bold ${fileDataUri ? 'text-emerald-300' : 'text-slate-400'}`}>{fileDataUri ? 'Pronto para auditar' : 'Aguardando PDF'}</div>
                </div>
              </div>

              <button onClick={runAnalysis} disabled={loading || !fileDataUri} className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl bg-sky-500 px-6 py-4 text-sm font-black uppercase text-white shadow-xl shadow-sky-500/20 transition-all hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-current" />}
                <span>{loading ? 'Processando análise...' : 'Executar auditoria IA'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="xl:col-span-7">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <MetricCard icon={CheckCircle} label="Total analisados" value="2" tone="emerald" />
            <MetricCard icon={AlertTriangle} label="Inconformidades" value="0" tone="amber" />
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/55 shadow-2xl shadow-slate-950/20">
            <div className="flex items-center justify-between gap-4 border-b border-slate-800 bg-slate-950/35 px-6 py-4">
              <div className="flex items-center gap-2 text-sky-300">
                <Code className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.18em]">Fluxo multi-API</span>
              </div>
              <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-bold text-slate-400">{logs.length} eventos</span>
            </div>
            <div className="h-[260px] overflow-y-auto p-6 font-mono text-[11px] custom-scrollbar">
              <div className="space-y-3">
                {logs.length === 0 && <span className="text-slate-600 italic">Aguardando entrada de dados...</span>}
                {logs.map((log, i) => (
                  <div key={i} className={`flex gap-3 rounded-xl border border-slate-800/70 bg-slate-950/30 px-3 py-2 ${log.type === 'error' ? 'text-red-300' : log.type === 'success' ? 'text-emerald-300' : 'text-slate-400'}`}>
                    <span className="shrink-0 font-bold text-slate-600">{log.time}</span>
                    <span className="leading-relaxed">{log.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {[
              ['Extração', 'PDF convertido em texto para leitura estruturada.', FileText],
              ['Auditoria', 'IA identifica prazos, riscos, itens e requisitos.', Search],
              ['Conversão', 'Resultado pode virar resumo ou oportunidade B2G.', ChevronRight]
            ].map(([title, text, Icon]) => (
              <div key={title} className="rounded-2xl border border-slate-800 bg-slate-900/45 p-5">
                <Icon className="mb-4 h-5 w-5 text-sky-300" />
                <h3 className="text-sm font-black text-white">{title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const HistoryView = () => (
    <div className="flex-1 overflow-y-auto bg-[#0d1422] p-8 custom-scrollbar">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
        <History className="mb-4 h-8 w-8 text-sky-300" />
        <h2 className="text-2xl font-black text-white">Histórico de análises</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">As análises salvas ficam disponíveis no módulo Resumos de Edital, com escopo por usuário e empresa.</p>
      </div>
    </div>
  );

  const DetailView = () => (
    <div className="flex-1 flex flex-col min-h-[76vh] overflow-hidden bg-[#0d1422]">
      <header className="border-b border-slate-800 bg-slate-900/75 p-6 shadow-2xl z-20 lg:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-5">
            <button onClick={() => setView('dashboard')} className="shrink-0 rounded-xl bg-slate-800 p-3 text-white shadow-xl transition-all hover:bg-slate-700 active:scale-95">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <h1 className="min-w-0 break-words text-2xl font-black tracking-tight text-white">Análise Estratégica: {fileName || 'documento.pdf'}</h1>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-sky-300">
                    {result?._tipo === 'tr' ? 'Termo de Referência' : 'Edital'}
                  </span>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-300">Auditado via IA</span>
                </div>
              </div>
              <p className="mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <Clock className="w-3 h-3" /> Processado em {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSaveToResumos}
              disabled={savingToResumos || !result}
              className="flex items-center gap-3 rounded-xl border border-slate-700 bg-[#1e293b] px-5 py-3 text-xs font-black text-slate-300 shadow-lg transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingToResumos ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              SALVAR EM RESUMOS
            </button>
            <button
              onClick={handleConvertToOpportunity}
              disabled={convertingToOpportunity || !result}
              className="flex items-center gap-3 rounded-xl bg-sky-500 px-6 py-3 text-xs font-black text-white shadow-xl shadow-sky-500/20 transition-all hover:bg-sky-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {convertingToOpportunity ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-white" />}
              CONVERTER EM OPORTUNIDADE
            </button>
          </div>
        </div>
      </header>

      {actionFeedback.message ? (
        <div className={`mx-8 mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
          actionFeedback.type === 'success'
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
            : 'border-red-500/40 bg-red-500/10 text-red-300'
        }`}>
          {actionFeedback.message}
        </div>
      ) : null}

      <div className="flex-1 grid grid-cols-1 overflow-hidden bg-[#0d1422] xl:grid-cols-[minmax(320px,0.8fr)_minmax(520px,1.2fr)]">
        <div className="overflow-y-auto border-r border-slate-800 bg-slate-950/20 p-6 custom-scrollbar lg:p-8">
          <div className="mx-auto w-full max-w-xl rounded-2xl border border-slate-800/80 bg-slate-900/45 p-5 shadow-inner">
            <label className="mb-5 block text-center text-[11px] font-black uppercase tracking-widest text-slate-500">Pré-visualização do Documento</label>
            <div className="aspect-[1/1.28] bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center p-10 text-slate-600 shadow-2xl relative overflow-hidden group">
              <FileText className="w-24 h-24 opacity-5 mb-6 group-hover:scale-110 transition-transform duration-500" />
              <h4 className="font-black text-slate-500 text-xl tracking-tight">Visor PDF Desabilitado</h4>
              <p className="text-[11px] max-w-xs mt-3 opacity-30 text-center leading-relaxed font-medium">Ambiente de segurança: A renderização nativa de arquivos PDF externos está restrita neste módulo.</p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto bg-[#0d1422] p-6 custom-scrollbar lg:p-8">
          <div className="sticky top-0 z-20 mb-8 flex items-center overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/90 p-1.5 shadow-2xl backdrop-blur-md scrollbar-hide">
            {['GERAL', 'RESUMO ESPECIFICAÇÕES', 'PRAZOS', 'EXIGENCIAS', 'DOCUMENTAÇÃO', 'ITENS / TR', 'RISCOS / IA'].map((tab) => {
              if (tab === 'RESUMO ESPECIFICAÇÕES' && result?._tipo !== 'tr') return null;
              if ((tab === 'PRAZOS' || tab === 'DOCUMENTAÇÃO') && result?._tipo === 'tr') return null;

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab.toLowerCase())}
                  className={`whitespace-nowrap rounded-lg px-4 py-2.5 text-[9px] font-black uppercase transition-all ${activeTab === tab.toLowerCase() ? 'bg-sky-500 text-white shadow-xl shadow-sky-500/10' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          <div className="pb-10">{renderTabContent()}</div>

          <div className="relative mt-10 overflow-hidden rounded-2xl border border-sky-500/10 bg-sky-600/5 p-6 shadow-inner">
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="rounded-xl bg-sky-500/20 p-3 text-sky-300">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-black text-white uppercase tracking-tight">Avaliação de Aderência Técnica</h4>
              </div>
              <div className="flex items-end gap-3 mb-6">
                <span className="text-6xl font-black text-sky-400 tracking-tighter leading-none">{result?.pontuacao_viabilidade || 0}</span>
                <span className="text-sky-400/40 font-black text-2xl mb-1">/ 10</span>
              </div>
              <p className="text-xs text-slate-500 italic leading-relaxed font-medium">Este índice é calculado comparando as capacidades padrão do mercado contra as exigências críticas extraídas automaticamente deste documento pela inteligência artificial.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[80vh] bg-[#0f172a] text-slate-200 overflow-hidden select-none font-sans rounded-3xl border border-slate-800">
      {view !== 'detail' && <Sidebar />}
      {view === 'dashboard' && <Dashboard />}
      {view === 'history' && <HistoryView />}
      {view === 'detail' && <DetailView />}
      <style dangerouslySetInnerHTML={{ __html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; border: 2px solid #0f172a; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-in { animation: fade-in 0.5s ease-out forwards; }
      ` }} />
    </div>
  );
};

export default B2GAnaliseEditaisTR;
