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
  const v = s.replace(/R\$|\s/g, '');
  const n = Number(v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(?:\.\d{3})+$/.test(v) ? v.replace(/\./g, '') : v);
  return Number.isFinite(n) ? n : null;
};
const currency = /R\$\s*([\d.]+(?:,\d{2})?)/gi;
const snippets = (lines, pattern, maximum = 8) => [...new Set(lines.flatMap((line, index) => {
  if (!pattern.test(line)) return [];
  const selected = [line];
  for (const continuation of lines.slice(index + 1, index + 7)) {
    if (/[.;:]$/.test(selected.at(-1)) || /^(?:\d+[.\s]|[IVX]+\s*[-–]|SECRETARIA|PROCESSO|RUA |https?:|www\.)/i.test(continuation)) break;
    selected.push(continuation);
  }
  return [selected.join(' ')];
}))].slice(0, maximum);

function analyzeText(documents, context = {}) {
  const text = documents.map(d => clean(d.text)).join('\n\n');
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean).filter(line => !/\.{4,}|^Assinatura Qualificada realizada|^Documento assinado nos termos/i.test(line));
  const evidence = {};
  const capture = (key, pattern, next = 1) => {
    const i = lines.findIndex(line => pattern.test(line));
    if (i < 0) return UNKNOWN;
    const value = lines.slice(i, i + next + 1).join(' ').slice(0, 600);
    evidence[key] = value;
    return value;
  };
  const labeledAgency = text.match(/^(?:[óo]rg[aã]o(?:\s+(?:comprador|licitante))?|contratante|entidade|unidade\s+gestora)\s*[:\-]\s*([^\n]{5,180})/im)?.[1]?.trim();
  const headerAgency = lines.slice(0, 50).find(line => /^(?:prefeitura(?: municipal)?|munic[ií]pio de|tribunal|secretaria(?: municipal| estadual)?|servi[cç]o social|c[aâ]mara municipal|universidade|instituto federal|estado d[oa])\b/i.test(line) && line.length < 180);
  const invalidLabel = /^(?:CNPJ|CPF|endere[cç]o|raz[aã]o social|nome|n[aã]o identificado)\b/i;
  let agency = (labeledAgency && !invalidLabel.test(labeledAgency) ? labeledAgency : null) || headerAgency || UNKNOWN;
  const headerIndex = lines.indexOf(agency);
  if (/^(?:servi[cç]o social aut[oô]nomo|prefeitura municipal)$/i.test(agency) && headerIndex >= 0) {
    const continuation = lines[headerIndex + 1] || '';
    if (/^[A-ZÀ-Ý][A-ZÀ-Ý \-]{2,100}$/.test(continuation)) agency += ' ' + continuation;
  }
  if (agency !== UNKNOWN) evidence.orgao_comprador = agency;
  const cnpjMatch = /CNPJ\s*(?:sob\s*)?(?:n[º°o.]?\s*)?[:\-]?\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i.exec(text);
  const agencyToken = agency.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/\s+/).at(-1);
  const cnpjContext = cnpjMatch ? text.slice(Math.max(0, cnpjMatch.index - 600), cnpjMatch.index).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';
  const agencyCnpj = cnpjMatch && agencyToken?.length >= 4 && cnpjContext.includes(agencyToken) ? cnpjMatch[1] : null;
  if (agencyCnpj) evidence.orgao_cnpj = cnpjMatch[0];
  const objectIndex = lines.findIndex(line => /^(?:[\d.]+[\s.\-–]+)?(?:do\s+)?objeto\b/i.test(line));
  let object = UNKNOWN;
  if (objectIndex >= 0) {
    const selected = [];
    for (const line of lines.slice(objectIndex, objectIndex + 9)) {
      if (selected.length && (/^\d+\.\d+\.\s*(?:Tabela|O custo|A licita)/i.test(line) || /^(?:\d+[.\s]+)?(?:valor\s|prazo\s|vig[êe]ncia|habilita[cç][aã]o|julgamento|modalidade)/i.test(line) || /^\d+\.\s+[A-ZÀ-Ý][A-ZÀ-Ý \d]{5,}$/.test(line))) break;
      selected.push(line);
    }
    object = selected.join(' ').replace(/^(?:[\d.]+\s*)?(?:do\s+)?objeto\s*[:.\-–]?\s*/i, '').trim().slice(0, 1600) || UNKNOWN;
    evidence.resumo_executivo = object;
  }
  const totalPattern = /valor\s+(?:(?:total|global)\s+)?(?:estimado|m[aá]ximo|or[cç]ado)|valor\s+(?:total|global)\s+(?:da\s+contrata[cç][aã]o|estimado)|or[cç]amento\s+(?:estimado|total)|total\s+geral/i;
  const totals = [];
  for (let i = 0; i < lines.length; i++) {
    if (!totalPattern.test(lines[i])) continue;
    const snippet = /R\$/.test(lines[i]) ? lines[i] : lines.slice(i, i + 3).join(' ');
    const matched = [...snippet.matchAll(currency)];
    if (matched.length === 1) totals.push({ value: money(matched[0][1]), text: snippet.slice(0, 600) });
  }
  const values = [...new Set(totals.map(t => t.value).filter(v => v !== null))];
  const total = values.length === 1 ? values[0] : null;
  if (total !== null) evidence.valor_estimado_total = totals.find(t => t.value === total).text;
  const openingSnippet = capture('data_abertura', /(?:data\s+(?:de|da)\s+abertura|abertura\s+(?:da\s+)?sess[aã]o|sess[aã]o\s+p[úu]blica|data\s+(?:do\s+)?preg[aã]o)/i, 1);
  const openingDate = openingSnippet.match(/\b\d{2}[\/.]\d{2}[\/.]\d{4}\b/)?.[0];
  const openingTime = openingSnippet.match(/\b\d{1,2}[:h]\d{2}\b/i)?.[0];
  const sampleLines = snippets(lines, /amostra|prova de conceito|\bpo[cC]\b/i);
  const visitLines = snippets(lines, /vistoria|visita t[eé]cnica/i);
  const itemLines = lines.filter(line => /^(?:item\s+\d+\s*[:\-]|\d+\s)/i.test(line));
  const simpleItems = itemLines.flatMap(line => {
    let parts = line.split(/\s*[|;]\s*/);
    if (parts.length === 1) {
      const row = line.match(/^(\d{1,3})\s+(.+?)\s+(UN|UND|UNID|UNIDADE|UNIDADES|M[ÊE]S|MESES|SERVI[CÇ]O|LICEN[CÇ]A|KIT|LOTE|HORA)\s+(\d[\d.,]*)\s+((?:R\$\s*)?[\d.]+,\d{2})\s+((?:R\$\s*)?[\d.]+,\d{2})$/i);
      if (row) parts = row.slice(1);
    }
    // Only convert explicit complete rows: number | description | unit | quantity | unit price | total.
    if (parts.length !== 6 || !/^\d+$/.test(parts[0]) || !/^\d[\d.,]*$/.test(parts[3])) return [];
    const unitPrice = money(parts[4]), itemTotal = money(parts[5]);
    if (unitPrice === null || itemTotal === null) return [];
    return [{ item_numero: Number(parts[0]), especificacao_sucinta: parts[1], unidade: parts[2], quantitativo: money(parts[3]), valor_estimado_unitario: unitPrice, valor_estimado_total: itemTotal }];
  });
  const catalogItems = documents.flatMap(d => extractCatalogTable(d.text));
  const items = catalogItems.length ? catalogItems : simpleItems;
  const isDraft = /minuta\s+de\s+termo\s+de\s+refer[êe]ncia/i.test(text.slice(0, 500));
  const pricesWithheld = /R\$\s*[xX]+/.test(text);
  const tags = [];
  if (/14[.]?133\s*\/\s*2021/.test(text)) tags.push('Lei 14.133/2021');
  const modality = text.match(/preg[aã]o\s+eletr[oô]nico|concorr[eê]ncia\s+eletr[oô]nica|dispensa\s+eletr[oô]nica|preg[aã]o\s+presencial|inexigibilidade/iu)?.[0] || UNKNOWN;
  const warnings = [];
  if (total === null) warnings.push(pricesWithheld ? 'Preços não informados na minuta (R$xx,xx). O valor estimado não é zero.' : values.length > 1 ? 'Valores totais divergentes nos documentos; confirme o orçamento correto.' : 'Valor estimado total não identificado no texto.');
  if (!items.length) warnings.push('Matriz de itens não identificada com segurança; consulte a tabela no documento original.');
  return normalizeFicha({
    id_licitacao: context.id_licitacao || `DOC-${crypto.randomUUID()}`,
    documentType: isDraft ? 'minuta_tr' : 'edital_tr', pricesWithheld,
    processo_administrativo: text.match(/PROCESSO\s*N[°ºo.]?\s*:\s*([\d./-]+)/i)?.[1] || null,
    orgao_comprador: agency, orgao_cnpj: agencyCnpj, modalidade_contratacao: modality,
    resumo_executivo: object, valor_estimado_total: total,
    criterio_julgamento: capture('criterio_julgamento', /crit[eé]rio\s+de\s+julgamento|julgamento\s*:/i, 0),
    modo_disputa: capture('modo_disputa', /modo\s+de\s+disputa/i, 0),
    data_abertura: openingDate ? `${openingDate}${openingTime ? ' às ' + openingTime.replace('h', ':') : ''}` : UNKNOWN,
    data_limite_proposta: capture('data_limite_proposta', /(?:limite|encerramento|prazo\s+final)\s+(?:para\s+|de\s+|das\s+)?(?:envio\s+de\s+)?propostas/i),
    data_fim_esclarecimento: capture('data_fim_esclarecimento', /(?:prazo|data|limite).*esclarecimentos?|esclarecimentos?.*(?:at[eé]|dias|prazo)/i),
    data_fim_impugnacao: capture('data_fim_impugnacao', /(?:prazo|data|limite).*impugna[cç][aã]o|impugna[cç][aã]o.*(?:at[eé]|dias|prazo)/i),
    portal_compras: text.match(/https?:\/\/(?:[^\s/]*\.)?(?:compras\.gov\.br|pncp\.gov\.br|comprasnet\.gov\.br|bll\.org\.br|portaldecompraspublicas\.com\.br|licitacoes-e\.com\.br|licitardigital\.com\.br)[^\s<>]*/i)?.[0] || UNKNOWN,
    requisitos_habilitacao: {
      atestados_capacidade_tecnica: snippets(lines, /atestado|capacidade t[eé]cnica/i),
      certidoes_e_registros_especificos: snippets(lines, /certid[aã]o|certid[oõ]es|regularidade.*(?:fiscal|fgts|trabalhista)/i),
      exigencias_contabeis: snippets(lines, /[ií]ndice.*(?:liquidez|solv[eê]ncia)|patrim[oô]nio l[ií]quido|balan[cç]o patrimonial/i).map(s => ({ nome_indice: 'Exigência extraída do documento', regra: s })),
      qualificacao_equipe_chave: snippets(lines, /respons[aá]vel t[eé]cnico|equipe t[eé]cnica/i)
    },
    prazos_e_locais: { prazo_inicio_entrega: capture('prazo_inicio_entrega', /prazo\s+(?:de\s+|para\s+)?(?:entrega|execu[cç][aã]o|in[ií]cio)/i),
      locais_prestacao_entrega: snippets(lines, /local\s+(?:de\s+)?(?:entrega|execu[cç][aã]o)|endere[cç]o\s+(?:de\s+)?entrega/i),
      vigencia_contrato: capture('vigencia_contrato', /vig[êe]ncia\s+(?:do\s+)?contrat|prazo\s+de\s+vig[êe]ncia/i),
      regime_execucao: capture('regime_execucao', /regime\s+de\s+execu[cç][aã]o/i),
      prazo_recebimento_provisorio_definitivo: capture('prazo_recebimento', /recebimento\s+(?:provis[oó]rio|definitivo)/i) },
    pontos_de_atencao_risco: {
      clausulas_punitivas_multas: snippets(lines, /multa|penalidade|san[cç][aã]o|san[cç][oõ]es/i),
      exigencia_amostra_poc: sampleLines.join(' '),
      garantia_contratual: capture('garantia_contratual', /garantia\s+(?:de\s+execu[cç][aã]o|contratual|do\s+contrato)/i),
      regras_vistoria: { obrigatoria: visitLines.length ? (visitLines.some(l => /n[aã]o.*obrigat[oó]ria|facultativa|dispensada/i.test(l)) ? false : visitLines.some(l => /obrigat[oó]ria/i.test(l)) ? true : null) : null,
        permite_declaracao_substitutiva: visitLines.length ? (visitLines.some(l => /declara[cç][aã]o.*substitut|substitu[ií]da.*declara[cç][aã]o/i.test(l)) ? true : null) : null,
        detalhes_e_prazo: visitLines.join(' ') || UNKNOWN }, pontos_de_atencao_gerais: []
    },
    matriz_itens: items, tags_classificacao: tags, analysisStatus: 'extracted', analysisWarnings: warnings,
    extractionEvidence: evidence, extractionMethod: 'document-text-v2',
    documentos_origem: { edital: documents.find(d => /edital/i.test(d.name))?.name || documents[0]?.name,
      termo_referencia: documents.find(d => /termo|\btr\b|refer[eê]ncia/i.test(d.name))?.name || '' },
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
