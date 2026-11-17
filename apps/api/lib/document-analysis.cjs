const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const exec = promisify(execFile);
const { normalizeFicha } = require('./ficha-normalizer.cjs');
const { extractCatalogTable } = require('./edital-table.cjs');
const UNKNOWN = 'Não identificado';

const clean = text => String(text || '').replace(/\u0000/g, '').replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

const money = s => {
  if (!s) return null;
  const v = s.replace(/R\$|\s/gi, '');
  const n = Number(v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(?:\.\d{3})+$/.test(v) ? v.replace(/\./g, '') : v);
  return Number.isFinite(n) ? n : null;
};

const currency = /R\$\s*([\d.]+(?:,\d{2})?)/gi;

const snippets = (lines, pattern, maximum = 8) => [...new Set(lines.flatMap((line, index) => {
  if (!pattern.test(line)) return [];
  const selected = [line];
  for (const continuation of lines.slice(index + 1, index + 7)) {
    if (/[.;:]$/.test(selected.at(-1)) || /^(?:\d+[.\s]|[IVX]+\s*[-–]|SECRETARIA|PROCESSO|RUA |https?:|www\.)/iu.test(continuation)) break;
    selected.push(continuation);
  }
  return [selected.join(' ')];
}))].slice(0, maximum);

function analyzeText(documents, context = {}) {
  const text = documents.map(d => clean(d.text)).join('\n\n');
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean).filter(line => !/\.{4,}|^Assinatura Qualificada realizada|^Documento assinado nos termos/iu.test(line));
  const evidence = {};

  const capture = (key, pattern, next = 1) => {
    const i = lines.findIndex(line => pattern.test(line));
    if (i < 0) return UNKNOWN;
    const value = lines.slice(i, i + next + 1).join(' ').slice(0, 600);
    evidence[key] = value;
    return value;
  };

  // 1. ÓRGÃO LICITANTE & CNPJ
  const labeledAgency = text.match(/^(?:[óo]rg[aã]o(?:\s+(?:comprador|licitante|demandante|requisitante))?|contratante|entidade|unidade\s+gestora)\s*[:\-]\s*([^\n]{5,180})/imu)?.[1]?.trim();
  const headerAgency = lines.slice(0, 60).find(line => /^(?:prefeitura(?: municipal)?|munic[ií]pio de|governo do estado|estado d[oa]|tribunal|secretaria(?: municipal| estadual| de estado)?|servi[cç]o social|c[aâ]mara municipal|universidade|instituto federal|instituto nacional|funda[cç][aã]o|autarquia|cons[oó]rcio|pol[ií]cia|hospital|comando d[oa]|minist[eé]rio|defensoria)\b/iu.test(line) && line.length < 180);
  const invalidLabel = /^(?:CNPJ|CPF|endere[cç]o|raz[aã]o social|nome|n[aã]o identificado)\b/iu;
  let agency = (labeledAgency && !invalidLabel.test(labeledAgency) ? labeledAgency : null) || headerAgency || context.orgao || UNKNOWN;
  const headerIndex = lines.indexOf(agency);
  if (/^(?:servi[cç]o social aut[oô]nomo|prefeitura municipal|secretaria municipal|secretaria de estado)$/iu.test(agency) && headerIndex >= 0) {
    const continuation = lines[headerIndex + 1] || '';
    if (/^[A-ZÀ-Ý][A-ZÀ-Ý \-]{2,100}$/u.test(continuation)) agency += ' ' + continuation;
  }
  if (agency !== UNKNOWN) evidence.orgao_comprador = agency;

  const cnpjMatch = text.match(/(?:CNPJ(?:\/MF)?(?:\s*sob\s*o?\s*n[º°o.]?)?|inscri[cç][aã]o\s+no\s+CNPJ\s*[:\-]?)\s*[:\-]?\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/iu);
  const agencyCnpj = cnpjMatch ? cnpjMatch[1] : (context.cnpj || null);
  if (agencyCnpj) evidence.orgao_cnpj = agencyCnpj;

  // 2. PORTAL A LICITAR
  let portal = UNKNOWN;
  const urlMatch = text.match(/https?:\/\/(?:[^\s/]*\.)?(?:compras\.gov\.br|pncp\.gov\.br|comprasnet\.gov\.br|bll\.org\.br|bllcompras\.com|portaldecompraspublicas\.com\.br|licitacoes-e\.com\.br|licitardigital\.com\.br|bec\.sp\.gov\.br|e-compras\.curitiba\.pr\.gov\.br|transparencia\.curitiba\.pr\.gov\.br|bbmnetlicitacoes\.com\.br|bnc\.org\.br|licitanet\.com\.br)[^\s<>]*/iu);
  if (urlMatch) {
    portal = urlMatch[0];
  } else if (/compras\.gov\.br|comprasnet\b/iu.test(text)) {
    portal = 'Compras.gov.br (Federal) - www.gov.br/compras';
  } else if (/portal\s+de\s+compras\s+p[uú]blicas/iu.test(text)) {
    portal = 'Portal de Compras Públicas - www.portaldecompraspublicas.com.br';
  } else if (/licita[cç][oõ]es-e|banco\s+do\s+brasil/iu.test(text)) {
    portal = 'Licitações-e (Banco do Brasil) - www.licitacoes-e.com.br';
  } else if (/\bbll\b|bll\s+compras|bolsa\s+de\s+licita[cç][oõ]es/iu.test(text)) {
    portal = 'BLL Compras - www.bll.org.br';
  } else if (/bbmnet/iu.test(text)) {
    portal = 'BBMNET Licitações - www.bbmnetlicitacoes.com.br';
  } else if (/\bbnc\b|bolsa\s+nacional\s+de\s+compras/iu.test(text)) {
    portal = 'BNC (Bolsa Nacional de Compras) - www.bnc.org.br';
  } else if (/bec\/sp|bolsa\s+eletr[oô]nica\s+de\s+compras/iu.test(text)) {
    portal = 'BEC/SP (Bolsa Eletrônica de Compras de SP) - www.bec.sp.gov.br';
  } else if (/e-compras\s+curitiba|transpar[eê]ncia\s+curitiba/iu.test(text)) {
    portal = 'e-Compras Curitiba - www.e-compras.curitiba.pr.gov.br';
  } else if (/licitanet/iu.test(text)) {
    portal = 'Licitanet - www.licitanet.com.br';
  } else if (/licitar\s*digital/iu.test(text)) {
    portal = 'Licitar Digital - www.licitardigital.com.br';
  } else if (/pncp/iu.test(text)) {
    portal = 'Portal Nacional de Contratações Públicas (PNCP)';
  } else if (context.portal || context.link) {
    portal = context.portal || context.link;
  }
  evidence.portal_compras = portal;

  // 3. OBJETO / RESUMO EXECUTIVO
  const objectIndex = lines.findIndex(line => /^(?:[\d.]+[\s.\-–]+)?(?:do\s+)?objeto\b/iu.test(line));
  let object = UNKNOWN;
  if (objectIndex >= 0) {
    const selected = [];
    for (const line of lines.slice(objectIndex, objectIndex + 9)) {
      if (selected.length && (/^\d+\.\d+\.\s*(?:Tabela|O custo|A licita)/iu.test(line) || /^(?:\d+[.\s]+)?(?:valor\s|prazo\s|vig[êe]ncia|habilita[cç][aã]o|julgamento|modalidade)/iu.test(line) || /^\d+\.\s+[A-ZÀ-Ý][A-ZÀ-Ý \d]{5,}$/u.test(line))) break;
      selected.push(line);
    }
    object = selected.join(' ').replace(/^(?:[\d.]+\s*)?(?:do\s+)?objeto\s*[:.\-–]?\s*/iu, '').trim().slice(0, 1600) || UNKNOWN;
    evidence.resumo_executivo = object;
  }

  // 4. VALOR ESTIMADO TOTAL
  const totalPattern = /valor\s+(?:(?:total|global)\s+)?(?:estimado|m[aá]ximo|or[cç]ado)|valor\s+(?:total|global)\s+(?:da\s+contrata[cç][aã]o|estimado)|or[cç]amento\s+(?:estimado|total)|total\s+geral/iu;
  const totals = [];
  for (let i = 0; i < lines.length; i++) {
    if (!totalPattern.test(lines[i])) continue;
    const snippet = /R\$/iu.test(lines[i]) ? lines[i] : lines.slice(i, i + 3).join(' ');
    const matched = [...snippet.matchAll(currency)];
    if (matched.length === 1) totals.push({ value: money(matched[0][1]), text: snippet.slice(0, 600) });
  }
  const values = [...new Set(totals.map(t => t.value).filter(v => v !== null))];
  let total = values.length === 1 ? values[0] : (context.valor_estimado_total ? Number(context.valor_estimado_total) : null);
  if (total !== null && totals.length > 0) evidence.valor_estimado_total = totals.find(t => t.value === total)?.text;

  // 5. DATA DE ABERTURA
  const openingSnippet = capture('data_abertura', /(?:data\s+(?:de|da)\s+abertura|abertura\s+(?:da\s+)?sess[aã]o|sess[aã]o\s+p[úu]blica|in[ií]cio\s+(?:da\s+)?disputa|data\s+(?:do\s+)?preg[aã]o|sess[aã]o\s+de\s+disputa)/iu, 2);
  let openingDate = openingSnippet.match(/\b\d{2}[\/.]\d{2}[\/.]\d{4}\b/)?.[0];
  if (!openingDate) {
    const extensoMatch = openingSnippet.match(/(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/iu);
    if (extensoMatch) {
      const meses = { janeiro: '01', fevereiro: '02', 'março': '03', marco: '03', abril: '04', maio: '05', junho: '06', julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12' };
      const m = meses[extensoMatch[2].toLowerCase()];
      if (m) openingDate = `${extensoMatch[1].padStart(2, '0')}/${m}/${extensoMatch[3]}`;
    }
  }
  const openingTimeMatch = openingSnippet.match(/\b(\d{1,2})[:h](\d{2})\b/iu);
  const openingTime = openingTimeMatch ? `${openingTimeMatch[1].padStart(2, '0')}:${openingTimeMatch[2]}` : null;
  const fullOpeningDate = openingDate ? `${openingDate}${openingTime ? ' às ' + openingTime : ''}` : (context.data_abertura || UNKNOWN);

  // 6. DATA LIMITE PARA ENVIO DE PROPOSTAS
  let proposalLimit = UNKNOWN;
  if (/(?:recebimento|envio|acolhimento)\s+(?:das?\s+)?propostas?.*?(?:at[eé].*?abertura|at[eé]\s+o\s+in[ií]cio\s+da\s+sess[aã]o)/iu.test(text)) {
    proposalLimit = fullOpeningDate !== UNKNOWN ? `Até a abertura da sessão (${fullOpeningDate})` : 'Até a data e horário de abertura da sessão pública';
  } else {
    const propSnippet = capture('data_limite_proposta', /(?:limite|encerramento|prazo\s+final|recebimento|acolhimento|receber)\s+(?:para\s+|de\s+|das\s+)?(?:envio\s+de\s+)?propostas/iu, 2);
    if (propSnippet !== UNKNOWN) {
      const propDate = propSnippet.match(/\b\d{2}[\/.]\d{2}[\/.]\d{4}\b/)?.[0];
      const propTime = propSnippet.match(/\b\d{1,2}[:h]\d{2}\b/iu)?.[0];
      if (propDate) {
        proposalLimit = `${propDate}${propTime ? ' às ' + propTime.replace('h', ':') : ''}`;
      } else {
        proposalLimit = propSnippet.slice(0, 180);
      }
    } else if (context.data_limite_proposta) {
      proposalLimit = context.data_limite_proposta;
    } else if (fullOpeningDate !== UNKNOWN) {
      proposalLimit = `Até a abertura da sessão (${fullOpeningDate})`;
    }
  }

  // 7. ITENS, QUANTIDADES E VALORES DO TERMO DE REFERÊNCIA
  const catalogItems = documents.flatMap(d => extractCatalogTable(d.text));
  const items = catalogItems.length ? catalogItems : [];

  if ((total === null || total === 0) && items.length > 0) {
    const itemsSum = items.reduce((acc, it) => acc + (it.valor_estimado_total || 0), 0);
    if (itemsSum > 0) {
      total = Number(itemsSum.toFixed(2));
      evidence.valor_estimado_total = `Calculado pela soma dos ${items.length} itens do TR: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }
  }

  const sampleLines = snippets(lines, /amostra|prova de conceito|\bpo[cC]\b|homologa[cç][aã]o\s+de\s+marca/iu);
  const visitLines = snippets(lines, /vistoria|visita t[eé]cnica/iu);
  const isDraft = /minuta\s+de\s+termo\s+de\s+refer[êe]ncia/iu.test(text.slice(0, 500));
  const pricesWithheld = /R\$\s*[xX]+/.test(text);
  const tags = [];
  if (/14[.]?133\s*\/\s*2021/.test(text)) tags.push('Lei 14.133/2021');
  const modality = text.match(/preg[aã]o\s+eletr[oô]nico|concorr[eê]ncia\s+eletr[oô]nica|dispensa\s+eletr[oô]nica|preg[aã]o\s+presencial|inexigibilidade/iu)?.[0] || context.modalidade || UNKNOWN;
  const warnings = [];
  if (total === null) warnings.push(pricesWithheld ? 'Preços não informados na minuta (R$xx,xx). O valor estimado não é zero.' : values.length > 1 ? 'Valores totais divergentes nos documentos; confirme o orçamento correto.' : 'Valor estimado total não identificado no texto.');
  if (!items.length) warnings.push('Matriz de itens não identificada com segurança; consulte a tabela no documento original.');

  // Análise de Vistoria
  const vistoriaObrigatoria = visitLines.length ? (visitLines.some(l => /n[aã]o.*obrigat[oó]ria|facultativa|dispensada|opcional/iu.test(l)) ? false : visitLines.some(l => /obrigat[oó]ria/iu.test(l)) ? true : null) : null;
  const vistoriaPermiteSubstitutiva = visitLines.length ? (visitLines.some(l => /declara[cç][aã]o.*(?:substitut|conhecimento|responsabilidade)|substitu[ií]da.*declara[cç][aã]o/iu.test(l)) ? true : null) : null;

  return normalizeFicha({
    id_licitacao: context.id_licitacao || `DOC-${crypto.randomUUID()}`,
    documentType: isDraft ? 'minuta_tr' : 'edital_tr', pricesWithheld,
    processo_administrativo: text.match(/PROCESSO\s*N[°ºo.]?\s*:\s*([\d./-]+)/iu)?.[1] || null,
    orgao_comprador: agency, orgao_cnpj: agencyCnpj, modalidade_contratacao: modality,
    resumo_executivo: object, valor_estimado_total: total,
    criterio_julgamento: capture('criterio_julgamento', /crit[eé]rio\s+de\s+julgamento|julgamento\s*:/iu, 0),
    modo_disputa: capture('modo_disputa', /modo\s+de\s+disputa/iu, 0),
    data_abertura: fullOpeningDate,
    data_limite_proposta: proposalLimit,
    data_fim_esclarecimento: capture('data_fim_esclarecimento', /(?:prazo|data|limite).*esclarecimentos?|esclarecimentos?.*(?:at[eé]|dias|prazo)/iu),
    data_fim_impugnacao: capture('data_fim_impugnacao', /(?:prazo|data|limite).*impugna[cç][aã]o|impugna[cç][aã]o.*(?:at[eé]|dias|prazo)/iu),
    portal_compras: portal,
    requisitos_habilitacao: {
      habilitacao_juridica: snippets(lines, /registro comercial|ato constitutivo|contrato social|estatuto social|decreto de autoriza[cç][aã]o/iu, 6),
      atestados_capacidade_tecnica: snippets(lines, /atestado|capacidade t[eé]cnica|aptid[aã]o t[eé]cnica|comprova[cç][aã]o de experi[êe]ncia|parcelas de maior relev[aâ]ncia/iu, 8),
      certidoes_e_registros_especificos: snippets(lines, /certid[aã]o|certid[oõ]es|regularidade.*(?:fiscal|fgts|trabalhista)|receita federal|pgfn|d[ií]vida ativa|fazenda (?:estadual|municipal)|cndt/iu, 10),
      exigencias_contabeis: snippets(lines, /[ií]ndice.*(?:liquidez|solv[eê]ncia)|patrim[oô]nio l[ií]quido|balan[cç]o patrimonial|fal[êe]ncia|recupera[cç][aã]o judicial/iu, 6).map(s => ({ nome_indice: 'Exigência Contábil / Financeira', regra: s })),
      qualificacao_equipe_chave: snippets(lines, /respons[aá]vel t[eé]cnico|equipe t[eé]cnica|quadro permanente|conselho regional|crea|cra|certifica[cç][aã]o/iu, 6)
    },
    prazos_e_locais: {
      prazo_inicio_entrega: capture('prazo_inicio_entrega', /prazo\s+(?:de\s+|para\s+)?(?:entrega|execu[cç][aã]o|in[ií]cio)/iu),
      locais_prestacao_entrega: snippets(lines, /local\s+(?:de\s+)?(?:entrega|execu[cç][aã]o)|endere[cç]o\s+(?:de\s+)?entrega/iu),
      vigencia_contrato: capture('vigencia_contrato', /vig[êe]ncia\s+(?:do\s+)?contrat|prazo\s+de\s+vig[êe]ncia/iu),
      regime_execucao: capture('regime_execucao', /regime\s+de\s+execu[cç][aã]o/iu),
      prazo_recebimento_provisorio_definitivo: capture('prazo_recebimento', /recebimento\s+(?:provis[oó]rio|definitivo)/iu)
    },
    pontos_de_atencao_risco: {
      clausulas_punitivas_multas: snippets(lines, /multa\s+(?:morat[oó]ria|compensat[oó]ria)?|penalidade|san[cç][aã]o|san[cç][oõ]es|impedimento de licitar|declara[cç][aã]o de inidoneidade/iu, 8),
      exigencia_amostra_poc: sampleLines.length ? sampleLines.join(' ') : 'Não identificada exigência de amostra ou prova de conceito.',
      garantia_contratual: capture('garantia_contratual', /garantia\s+(?:de\s+execu[cç][aã]o|contratual|do\s+contrato|de\s+proposta)/iu, 2),
      regras_vistoria: {
        obrigatoria: vistoriaObrigatoria,
        permite_declaracao_substitutiva: vistoriaPermiteSubstitutiva,
        detalhes_e_prazo: visitLines.join(' ') || 'Vistoria técnica não informada ou não exigida.'
      },
      pontos_de_atencao_gerais: snippets(lines, /sla\b|n[ií]vel de servi[cç]o|tempo de resposta|subcontrata[cç][aã]o|marca de refer[êe]ncia/iu, 6)
    },
    matriz_itens: items,
    tags_classificacao: tags,
    analysisStatus: 'extracted',
    analysisWarnings: warnings,
    extractionEvidence: evidence,
    extractionMethod: 'document-text-v2',
    documentos_origem: {
      edital: documents.find(d => /edital/iu.test(d.name))?.name || documents[0]?.name,
      termo_referencia: documents.find(d => /termo|\btr\b|refer[eê]ncia/iu.test(d.name))?.name || ''
    },
    data_processamento: new Date().toISOString()
  });
}

async function extractDocument(file) {
  const ext = path.extname(file.name || '').toLowerCase();
  const base64 = String(file.base64 || '').replace(/^data:[^,]*;base64,/, '').replace(/\s/g, '');
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error(`Arquivo inválido: ${file.name}`);
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length || buffer.length > 20 * 1024 * 1024) throw new Error(`Arquivo vazio ou maior que 20 MB: ${file.name}`);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'double-edital-'));
  try {
    const source = path.join(directory, 'document' + ext);
    await fs.writeFile(source, buffer, { mode: 0o600 });
    let text;
    if (ext === '.pdf' && buffer.subarray(0, 5).toString() === '%PDF-') {
      try {
        const result = await exec('pdftotext', ['-layout', source, '-'], { timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
        text = result.stdout;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        try { text = (await parser.getText()).text; } finally { await parser.destroy(); }
      }
    } else if (ext === '.docx' && buffer.subarray(0, 2).toString() === 'PK') {
      const code = "import sys,zipfile,xml.etree.ElementTree as E\nwith zipfile.ZipFile(sys.argv[1]) as z:\n info=z.getinfo('word/document.xml')\n if info.file_size>20000000: raise ValueError('DOCX muito grande')\n root=E.fromstring(z.read(info))\n ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}\n print('\\n'.join(''.join(p.itertext()) for p in root.findall('.//w:p',ns)))";
      text = (await exec('python3', ['-c', code, source], { timeout: 30000, maxBuffer: 8 * 1024 * 1024 })).stdout;
    } else if (ext === '.doc' && buffer.subarray(0, 4).toString('hex') === 'd0cf11e0') {
      text = (await exec('antiword', [source], { timeout: 30000, maxBuffer: 8 * 1024 * 1024 })).stdout;
    } else throw new Error(`Formato inválido em ${file.name}. Envie um PDF, DOCX ou DOC real.`);
    if (clean(text).length < 80 || (text.match(/[A-Za-zÀ-ÿ]/g) || []).length < 40) throw new Error(`${file.name}: não foi possível ler texto suficiente. Se o PDF for digitalizado, aplique OCR antes de reenviar.`);
    return { name: path.basename(file.name), text: String(text).replace(/\u0000/g, '').replace(/\r/g, '\n'), buffer, ext, sha256: crypto.createHash('sha256').update(buffer).digest('hex') };
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
}

async function analyzeFiles(files, context = {}, scope = '') {
  if (!Array.isArray(files) || files.length < 1 || files.length > 10) throw new Error('Envie entre 1 e 10 documentos reais, com até 20 MB por arquivo.');
  const documents = [];
  for (const file of files) documents.push(await extractDocument(file));
  const ficha = analyzeText(documents, context);
  const scopeHash = crypto.createHash('sha256').update(String(scope)).digest('hex').slice(0, 24);
  const directory = path.resolve(__dirname, '../../../backend/private/edital-analysis', scopeHash);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  ficha.documentos_arquivados = [];
  for (const doc of documents) {
    const target = path.join(directory, doc.sha256 + doc.ext);
    await fs.writeFile(target, doc.buffer, { mode: 0o600 });
    ficha.documentos_arquivados.push({ name: doc.name, sha256: doc.sha256, characters: doc.text.length, path: target });
  }
  return ficha;
}

module.exports = { analyzeText, analyzeFiles, extractDocument };
