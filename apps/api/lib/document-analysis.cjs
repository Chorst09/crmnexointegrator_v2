const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const exec = promisify(execFile);
const { normalizeFicha } = require('./ficha-normalizer.cjs');
const { extractCatalogTable, deduplicateItems } = require('./edital-table.cjs');
const UNKNOWN = 'Não identificado';

let _runtimeGeminiKey = '';
const setRuntimeGeminiKey = (key) => { _runtimeGeminiKey = String(key || '').trim(); };
const getConfiguredGeminiKey = () =>
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GOOGLE_GENAI_API_KEY ||
  _runtimeGeminiKey ||
  '';

const getGeminiCandidateModels = () => {
  const preferred = process.env.GEMINI_MODEL || process.env.GOOGLE_MODEL;
  const defaults = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-latest'];
  return [...new Set([preferred, ...defaults].filter(Boolean))];
};

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
  const isTemplatePlaceholder = s => /\[.*(?:ESTADO|ENTIDADE|ÓRGÃO|XXXX).*\]|XXXX/iu.test(String(s || ''));
  const labeledAgency = text.match(/^(?:[óo]rg[aã]o(?:\s+(?:comprador|licitante|demandante|requisitante))?|contratante|entidade|unidade\s+gestora)\s*[:\-]\s*([^\n]{5,180})/imu)?.[1]?.trim();
  const headerAgency = lines.slice(0, 60).find(line => !isTemplatePlaceholder(line) && /^(?:prefeitura(?: municipal)?|munic[ií]pio de|governo do estado|estado d[oa]|tribunal|secretaria(?: municipal| estadual| de estado)?|servi[cç]o social|c[aâ]mara municipal|universidade|instituto federal|instituto nacional|funda[cç][aã]o|autarquia|cons[oó]rcio|pol[ií]cia|hospital|comando d[oa]|minist[eé]rio|defensoria)\b/iu.test(line) && line.length < 180);
  const invalidLabel = /^(?:CNPJ|CPF|endere[cç]o|raz[aã]o social|nome|n[aã]o identificado)\b/iu;
  let agency = (labeledAgency && !invalidLabel.test(labeledAgency) && !isTemplatePlaceholder(labeledAgency) ? labeledAgency : null) || headerAgency || context.orgao || UNKNOWN;
  const headerIndex = lines.indexOf(agency);
  if (/^(?:servi[cç]o social aut[oô]nomo|prefeitura municipal|secretaria municipal|secretaria de estado)$/iu.test(agency) && headerIndex >= 0) {
    const continuation = lines[headerIndex + 1] || '';
    if (/^[A-ZÀ-Ý][A-ZÀ-Ý \-]{2,100}$/u.test(continuation)) agency += ' ' + continuation;
  }
  if (agency !== UNKNOWN) evidence.orgao_comprador = agency;

  const cnpjMatch = text.match(/(?:CNPJ(?:\/MF)?(?:\s*sob\s*o?\s*n[º°o.]?)?|inscri[cç][aã]o\s+no\s+CNPJ\s*[:\-]?)\s*[:\-]?\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/iu) ||
                     text.match(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/);
  let agencyCnpj = cnpjMatch ? cnpjMatch[1] : null;
  if (!agencyCnpj) {
    const pcaMatch = text.match(/\bID\s+PCA\s+(?:no\s+PNCP)?\s*[:\-]?\s*(\d{14})\b/iu) ||
                     text.match(/\b(\d{14})-0-\d+\/\d{4}\b/iu);
    if (pcaMatch) {
      const c = pcaMatch[1];
      agencyCnpj = c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
  }
  agencyCnpj = agencyCnpj || context.cnpj || null;
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
  const openingSnippet = capture('data_abertura', /(?:data\s+(?:de|da)\s+abertura|abertura\s+(?:da\s+)?sess[aã]o|sess[aã]o\s+p[úu]blica|in[ií]cio\s+(?:da\s+)?disputa|data\s+(?:do\s+)?preg[aã]o|sess[aã]o\s+de\s+disputa)/iu, 3);
  let openingDate = openingSnippet.match(/\b\d{2}[\/.]\d{2}[\/.]\d{4}\b/)?.[0];
  if (!openingDate) {
    const extensoMatch = openingSnippet.match(/(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/iu);
    if (extensoMatch) {
      const meses = { janeiro: '01', fevereiro: '02', 'março': '03', marco: '03', abril: '04', maio: '05', junho: '06', julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12' };
      const m = meses[extensoMatch[2].toLowerCase()];
      if (m) openingDate = `${extensoMatch[1].padStart(2, '0')}/${m}/${extensoMatch[3]}`;
    }
  }
  const openingTimeMatch = openingSnippet.match(/\b(\d{1,2})(?:[:h](\d{2})|h\b)/iu);
  const openingTime = openingTimeMatch ? `${openingTimeMatch[1].padStart(2, '0')}:${(openingTimeMatch[2] || '00').padStart(2, '0')}` : null;
  const fullOpeningDate = openingDate ? `${openingDate}${openingTime ? ' às ' + openingTime : ''}` : (context.data_abertura || UNKNOWN);

  // 6. DATA LIMITE PARA ENVIO DE PROPOSTAS
  let proposalLimit = UNKNOWN;
  const propUntilOpening = /(?:recebimento|envio|acolhimento|encaminhar[aã]o|apresenta[cç][aã]o)\s+(?:das?\s+|de\s+)?propostas?[\s\S]{0,160}?(?:at[eé].*?abertura|at[eé]\s+o\s+in[ií]cio\s+da\s+sess[aã]o)/iu.test(text);
  if (propUntilOpening && fullOpeningDate !== UNKNOWN) {
    proposalLimit = `Até a abertura da sessão (${fullOpeningDate})`;
  } else {
    const propSnippet = capture('data_limite_proposta', /(?:limite|encerramento|prazo\s+final|recebimento|acolhimento|receber)\s+(?:para\s+|de\s+|das\s+)?(?:envio\s+de\s+)?propostas/iu, 2);
    if (propSnippet !== UNKNOWN) {
      const propDate = propSnippet.match(/\b\d{2}[\/.]\d{2}[\/.]\d{4}\b/)?.[0];
      const propTimeMatch = propSnippet.match(/\b(\d{1,2})(?:[:h](\d{2})|h\b)/iu);
      const propTime = propTimeMatch ? `${propTimeMatch[1].padStart(2, '0')}:${(propTimeMatch[2] || '00').padStart(2, '0')}` : null;
      if (propDate) {
        proposalLimit = `${propDate}${propTime ? ' às ' + propTime : ''}`;
      } else if (fullOpeningDate !== UNKNOWN) {
        proposalLimit = `Até a abertura da sessão (${fullOpeningDate})`;
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
  const catalogItems = deduplicateItems(documents.flatMap(d => extractCatalogTable(d.text)));
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

  // Fallback determinístico ConLicitação (caso Gemini não esteja disponível)
  const emailMatches = [...new Set((text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).filter(e => !/exemplo|teste/i.test(e)))];
  const phoneMatches = [...new Set(text.match(/\(\d{2}\)\s*\d{4,5}[-\s]?\d{4}/g) || [])];
  const uasgMatch = text.match(/\bUASG\s*(?:n[º°o.]?)?\s*[:\-]?\s*(\d{5,6})\b/iu)?.[1] || null;
  const pregaoNum = text.match(/preg[aã]o\s+eletr[oô]nico\s*(?:n[º°o.]?)?\s*([\d./-]+)/iu)?.[1] || null;
  const validadeProp = snippets(lines, /validade\s+(?:da|das)\s+proposta/iu, 2)[0] || UNKNOWN;
  const pagamentoTxt = snippets(lines, /pagamento\s+(?:ser[aá]|em\s+at[eé]|ap[oó]s)|prazo\s+de\s+pagamento|nota\s+fiscal.*(?:dias|atesto)/iu, 4).join(' ') || UNKNOWN;
  const reajusteTxt = snippets(lines, /reajuste|repactua[cç][aã]o|ipca|igpm|inpc/iu, 2)[0] || UNKNOWN;
  const subcontratacaoTxt = snippets(lines, /subcontrata[cç][aã]o/iu, 2)[0] || UNKNOWN;
  const anexosDet = snippets(lines, /^anexo\s+[IVX0-9]+/iu, 12);

  return normalizeFicha({
    id_licitacao: context.id_licitacao || `DOC-${crypto.randomUUID()}`,
    documentType: isDraft ? 'minuta_tr' : 'edital_tr', pricesWithheld,
    processo_administrativo: text.match(/PROCESSO\s*N[°ºo.]?\s*:\s*([\d./-]+)/iu)?.[1] || pregaoNum || null,
    orgao_comprador: agency, orgao_cnpj: agencyCnpj, modalidade_contratacao: modality,
    resumo_executivo: object, valor_estimado_total: total,
    criterio_julgamento: capture('criterio_julgamento', /crit[eé]rio\s+de\s+julgamento|julgamento\s*:/iu, 0),
    modo_disputa: capture('modo_disputa', /modo\s+de\s+disputa/iu, 0),
    data_abertura: fullOpeningDate,
    data_limite_proposta: proposalLimit,
    data_fim_esclarecimento: capture('data_fim_esclarecimento', /(?:prazo|data|limite).*esclarecimentos?|esclarecimentos?.*(?:at[eé]|dias|prazo)/iu),
    data_fim_impugnacao: capture('data_fim_impugnacao', /(?:prazo|data|limite).*impugna[cç][aã]o|impugna[cç][aã]o.*(?:at[eé]|dias|prazo)/iu),
    portal_compras: portal,
    conlicitacao: {
      identificacao: {
        numero_licitacao: pregaoNum || context.id_licitacao || UNKNOWN,
        modalidade: modality,
        uasg: uasgMatch || UNKNOWN,
        portal_realizacao: portal,
        contratacao: modality,
        regulamentacao_pregoeiro: tags.join(', ') || UNKNOWN,
        objeto: object
      },
      sessao_publica: {
        data: openingDate || fullOpeningDate,
        horario: openingTime || UNKNOWN,
        modo_disputa: capture('modo_disputa', /modo\s+de\s+disputa/iu, 0),
        intervalo_minimo: snippets(lines, /intervalo\s+m[ií]nimo/iu, 1)[0] || UNKNOWN
      },
      orgao_responsavel: {
        orgao: agency,
        cidade_uf: '',
        cnpj: agencyCnpj,
        endereco: snippets(lines, /rua\s+|avenida\s+|av\.\s+|rodovia\s+|br\s+\d+/iu, 1)[0] || UNKNOWN,
        email: emailMatches.join('\n') || UNKNOWN,
        telefone: phoneMatches.join(', ') || UNKNOWN
      },
      criterios_proposta_julgamento: {
        validade_proposta: validadeProp,
        exigencias_proposta_comercial: UNKNOWN,
        criterios_desempate: snippets(lines, /desempate|art\.\s*60|lc\s*123/iu, 2).join(' ') || UNKNOWN,
        programa_integridade: 'Não mencionado'
      },
      anexos_declaracoes: anexosDet,
      condicoes_pagamento: pagamentoTxt,
      analise_critica: {
        conflito_objeto_minuta: UNKNOWN,
        conflito_prazo_vigencia_arp: UNKNOWN,
        conflito_prazos_entrega: UNKNOWN,
        permite_subcontratacao: subcontratacaoTxt,
        previsao_reajuste_repactuacao: reajusteTxt,
        permite_renovacao_contrato: snippets(lines, /prorrogad|renova[cç][aã]o|art\.\s*107|art\.\s*111/iu, 2)[0] || UNKNOWN,
        estabelece_condicoes_pagamento: pagamentoTxt !== UNKNOWN ? 'Sim' : UNKNOWN
      }
    },
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

const sanitizeExtractedText = (raw) => {
  if (!raw) return '';
  return String(raw)
    .replace(/\u0000/g, '')
    .replace(/\r/g, '\n')
    .replace(/\uFB00/g, 'ff')
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\uFB03/g, 'ffi')
    .replace(/\uFB04/g, 'ffl')
    .normalize('NFC');
};

async function extractDocument(file) {
  const ext = path.extname(file.name || '').toLowerCase();
  const base64 = String(file.base64 || file.contentBase64 || '').replace(/^data:[^,]*;base64,/, '').replace(/\s/g, '');
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
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        try { text = (await parser.getText()).text; } finally { await parser.destroy(); }
      } catch (err) {
        text = null;
      }
      if (!text || text.trim().length < 80) {
        try {
          const result = await exec('pdftotext', ['-layout', source, '-'], { timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
          text = result.stdout;
        } catch (error) {
          if (!text && error.code !== 'ENOENT') throw error;
        }
      }
    } else if (ext === '.docx' && buffer.subarray(0, 2).toString() === 'PK') {
      const code = "import sys,zipfile,xml.etree.ElementTree as E\nwith zipfile.ZipFile(sys.argv[1]) as z:\n info=z.getinfo('word/document.xml')\n if info.file_size>20000000: raise ValueError('DOCX muito grande')\n root=E.fromstring(z.read(info))\n ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}\n print('\\n'.join(''.join(p.itertext()) for p in root.findall('.//w:p',ns)))";
      text = (await exec('python3', ['-c', code, source], { timeout: 30000, maxBuffer: 8 * 1024 * 1024 })).stdout;
    } else if (ext === '.doc' && buffer.subarray(0, 4).toString('hex') === 'd0cf11e0') {
      text = (await exec('antiword', [source], { timeout: 30000, maxBuffer: 8 * 1024 * 1024 })).stdout;
    } else throw new Error(`Formato inválido em ${file.name}. Envie um PDF, DOCX ou DOC real.`);
    text = sanitizeExtractedText(text);
    if (clean(text).length < 80 || (text.match(/[A-Za-zÀ-ÿ]/g) || []).length < 40) throw new Error(`${file.name}: não foi possível ler texto suficiente. Se o PDF for digitalizado, aplique OCR antes de reenviar.`);
    return { name: path.basename(file.name), text, buffer, ext, sha256: crypto.createHash('sha256').update(buffer).digest('hex') };
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
}

async function analyzeWithGemini(documents, context = {}) {
  const apiKey = getConfiguredGeminiKey();
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL || process.env.GOOGLE_MODEL || 'gemini-3.6-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  // Amostra do texto mantendo estrutura completa do edital e TR (até 450.000 caracteres, dentro de 1M tokens)
  const fullText = documents.map(d => clean(d.text)).join('\n\n');
  const textSample = fullText.slice(0, 450000);

  const prompt = `Você é um especialista sênior em Licitações Públicas Brasileiras (Leis 14.133/2021, 8.666/1993 e LC 123/2006) e análise jurídica/comercial de editais (padrão ConLicitação).

Sua tarefa é analisar o texto completo extraído de um Edital de Licitação e/ou Termo de Referência (TR) e extrair rigorosamente TODAS as informações estruturadas abaixo, incluindo a listagem completa de itens/lotes solicitados.

REGRAS DE EXTRAÇÃO:
1. Seja extremamente preciso. Baseie-se APENAS no texto fornecido. Não invente dados.
2. Se uma informação não estiver presente no texto, retorne null ou "Não informado".
3. Na seção "lista_de_itens", extraia todos os itens, lotes, produtos ou serviços solicitados. Se houver divisão por Lotes e Itens, deixe claro.
4. Na seção "analise_critica", verifique ativamente eventuais conflitos entre Edital, Termo de Referência e Minuta de Contrato (ex: divergência de prazo de vigência entre TR e Minuta, divergência de prazo de entrega, subcontratação, reajuste, renovação, pagamento).
5. O resultado final DEVE ser EXCLUSIVAMENTE um objeto JSON válido, sem markdown externo, com as chaves abaixo:

ESTRUTURA DO JSON ESPERADO:
{
  "orgao_licitante": "Nome completo do órgão público contratante",
  "numero_edital": "Número da licitação/pregão e ano (ex: PE/27/2027 ou Pregão Eletrônico nº 259/2026)",
  "modalidade_e_lei": "Modalidade e modo de disputa (ex: Pregão Eletrônico – Aberto e Fechado)",
  "objeto_resumo": "Resumo claro e completo do objeto da licitação",
  "criterio_julgamento": "Critério de julgamento (ex: Menor preço, Menor preço por lote)",
  "valor_estimado_total": "Valor total estimado ou máximo aceitável. Se sigiloso, informar 'Sigiloso'",

  "conlicitacao": {
    "identificacao": {
      "numero_licitacao": "Ex: PE/27/2027 ou 259/2026",
      "modalidade": "Ex: Pregão Eletrônico – Aberto e Fechado",
      "uasg": "Código UASG se houver",
      "portal_realizacao": "Portal e URL de realização (ex: Compras.gov.br - https://www.gov.br/compras/pt-br)",
      "contratacao": "Tipo de contratação (ex: Pregão Eletrônico)",
      "regulamentacao_pregoeiro": "Nome do pregoeiro/autoridade ou regulamentação",
      "objeto": "Texto completo do objeto"
    },
    "sessao_publica": {
      "data": "Data da sessão (DD/MM/AAAA)",
      "horario": "Horário da sessão (HH:MM)",
      "modo_disputa": "Ex: Aberto e Fechado",
      "intervalo_minimo": "Intervalo mínimo entre lances (ex: R$ 0,01 ou %)"
    },
    "orgao_responsavel": {
      "orgao": "Nome do órgão responsável",
      "cidade_uf": "Cidade/UF (ex: Curitiba/PR)",
      "cnpj": "CNPJ do órgão se houver",
      "endereco": "Endereço completo do órgão/setor de licitações",
      "email": "E-mail(s) de contato",
      "telefone": "Telefone(s) de contato"
    },
    "detalhes_licitacao": {
      "valor_estimado": "Valor formatado (ex: R$ 2.091.131,69 ou Sigiloso)",
      "criterio_julgamento": "Ex: Menor preço",
      "prazo_entrega": "Resumo completo do prazo de entrega/instalação/treinamento",
      "preferencia_me_epp": "Ex: Parcial, Exclusiva, Não se aplica",
      "restricoes_regionalidade": "Restrições geográficas ou 'Não informado'",
      "prova_de_conceito": "Exigência de PoC ou 'Não mencionado'",
      "margem_preferencia": "Detalhes sobre margem/tratamento favorecido ME/EPP (LC 123/2006)",
      "visita_tecnica": "Ex: Facultativa, Obrigatória, Não exige",
      "amostra": "Ex: Não Exige, Exige (detalhes)"
    },
    "seguro_garantia": {
      "garantia_proposta": { "exige": false, "titulo": "Não exige Garantia de Proposta", "descricao": "Explicação baseada no edital" },
      "garantia_contrato": { "exige": false, "titulo": "Não exige Garantia de Contrato", "descricao": "Explicação com referência ao item do edital" },
      "garantia_adicional": { "exige": false, "titulo": "Não exige Garantia Adicional", "descricao": "Explicação nos termos dos arts. 59/60 Lei 14.133/2021" },
      "garantia_retomada": { "exige": false, "titulo": "Não exige Garantia de Retomada", "descricao": "Explicação sobre cláusula de retomada" }
    },
    "entrega_execucao": {
      "data_prazo": "Prazo detalhado de entrega, instalação e execução",
      "local_entrega_execucao": "Endereço completo e local de entrega/execução"
    },
    "prazos_importantes": {
      "tipo_fornecimento": "Ex: Fornecimento integral em remessa única, parcelado, continuado",
      "manifestacao_recurso": "Prazo e forma para manifestação de recurso",
      "documentacao_complementar": "Prazo para envio de proposta ajustada e documentos complementares",
      "recursos_contrarrazoes": "Prazo para razões recursais e contrarrazões",
      "documento_original": "Prazo para envio de documento original ou 'Não informado'",
      "esclarecimentos": "Prazo limite e forma para pedidos de esclarecimento",
      "prazo_contratual_arp": "Prazo de execução contratual ou ARP",
      "limite_impugnacao": "Prazo limite para impugnação ao edital",
      "limite_envio_propostas": "Data e hora limite para envio de propostas",
      "vigencia_contrato_ata": "Prazo de vigência do contrato ou ata de registro de preços"
    },
    "criterios_proposta_julgamento": {
      "validade_proposta": "Prazo mínimo de validade da proposta",
      "exigencias_proposta_comercial": "Requisitos obrigatórios da proposta comercial",
      "criterios_desempate": "Critérios legais de desempate (Art. 60 Lei 14.133, LC 123)",
      "programa_integridade": "Exigência de programa de integridade ou 'Não mencionado'"
    },
    "resumo_itens": {
      "total_itens_lotes": "Quantidade total de itens ou lotes",
      "categorias_principais": "Principais categorias/lotes do objeto",
      "descricao_geral": "Síntese geral dos itens/lotes e serviços incluídos",
      "observacoes": "Observações importantes (unidade compradora, fonte, prevalência do edital em caso de divergência)"
    },
    "documentos_habilitacao": ["Lista objetiva de todos os documentos de habilitação jurídica, fiscal, trabalhista e econômico-financeira exigidos"],
    "atestado_capacidade_tecnica": "Exigências de atestado de capacidade técnica ou 'Não informado'",
    "anexos_declaracoes": ["Lista de todos os anexos do edital e declarações obrigatórias"],
    "outras_informacoes_relevantes": ["Regras sobre consórcio, subcontratação, garantia dos bens, lei regente, etc."],
    "condicoes_pagamento": "Texto completo com prazo de pagamento, exigências de atesto/regularidade, retenções e juros por atraso",
    "penalidades_multas": ["Lista detalhada das multas moratórias, compensatórias, sanções e impedimentos previstos"],
    "analise_critica": {
      "conflito_objeto_minuta": "Conflito identificado ou 'Não informado'",
      "conflito_prazo_vigencia_arp": "Divergência entre TR e Minuta ou 'Não informado'",
      "conflito_prazos_entrega": "Conflito de prazos de entrega ou 'Não informado'",
      "permite_subcontratacao": "Ex: Vedada, Permitida (detalhes)",
      "previsao_reajuste_repactuacao": "Índice, data-base e regras de reajuste/repactuação",
      "permite_renovacao_contrato": "Se permite prorrogação/renovação e base legal",
      "estabelece_condicoes_pagamento": "Sim / Não"
    }
  },

  "lista_de_itens": [
    {
      "numero_item_ou_lote": "Número do Lote ou do Item",
      "descricao_produto": "Descrição clara do produto ou serviço exigido",
      "quantidade": "Quantidade total solicitada (apenas números, se possível)",
      "unidade_medida": "Unidade de medida (ex: UN, KG, SC, MESES, LOTE)",
      "valor_unitario_estimado": "Valor unitário estimado ou máximo aceitável",
      "valor_total_item": "Valor total estimado para este item específico"
    }
  ],

  "datas_prazos": {
    "data_limite_esclarecimentos": "Data/hora limite para esclarecimentos/impugnações",
    "data_entrega_propostas": "Data/hora limite para envio das propostas",
    "data_abertura_sessao": "Data/hora da abertura da sessão pública"
  },
  "exigencias_participacao": {
    "exclusividade_me_epp": "Exclusivo para ME/EPP ou cotas? (Sim/Não e detalhes)",
    "exigencias_tecnicas": "Resumo das exigências de qualificação técnica",
    "exigencias_economico_financeiras": "Índices contábeis, balanço, capital mínimo, etc."
  },
  "execucao_e_contrato": {
    "prazo_entrega_ou_execucao": "Prazo para entrega/execução após assinatura",
    "local_entrega": "Local de entrega/prestação",
    "prazo_vigencia_contrato": "Tempo total de duração do contrato",
    "garantia_contratual": "Há exigência de garantia contratual? (Sim/Não e a porcentagem)"
  },
  "alertas_criticos": [
    "Liste até 5 armadilhas ou pontos críticos do edital"
  ]
}

TEXTO DO EDITAL/TR PARA ANÁLISE:
"""
${textSample}
"""`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 16384,
          responseMimeType: 'application/json'
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn('[Gemini TR] Erro na resposta da IA:', response.status, errText.slice(0, 200));
      return null;
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return null;

    return JSON.parse(candidateText.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim());
  } catch (error) {
    console.warn('[Gemini TR] Falha na chamada Gemini:', error.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function analyzeFiles(files, context = {}, scope = '') {
  if (!Array.isArray(files) || files.length < 1 || files.length > 10) throw new Error('Envie entre 1 e 10 documentos reais, com até 20 MB por arquivo.');
  const documents = [];
  for (const file of files) documents.push(await extractDocument(file));
  
  // 1. Extração determinística inicial completa
  let ficha = analyzeText(documents, context);

  // 2. Chamada opcional inteligente com Gemini API (se chave configurada)
  try {
    const aiData = await analyzeWithGemini(documents, context);
    if (aiData && typeof aiData === 'object') {
      const isInformado = (v) => v && typeof v === 'string' && !/^(?:null|n[aã]o\s+informad[oa]|n\/a|-)$/iu.test(v.trim());
      
      if (isInformado(aiData.orgao_licitante)) {
        ficha.orgao_comprador = aiData.orgao_licitante.trim();
      }
      if (isInformado(aiData.numero_edital)) {
        ficha.processo_administrativo = aiData.numero_edital.trim();
      }
      if (isInformado(aiData.modalidade_e_lei)) {
        ficha.modalidade_contratacao = aiData.modalidade_e_lei.trim();
      }
      if (isInformado(aiData.objeto_resumo)) {
        ficha.resumo_executivo = aiData.objeto_resumo.trim();
      }
      if (isInformado(aiData.criterio_julgamento)) {
        ficha.criterio_julgamento = aiData.criterio_julgamento.trim();
      }
      if (aiData.valor_estimado_total) {
        if (/sigiloso/i.test(String(aiData.valor_estimado_total))) {
          ficha.pricesWithheld = true;
        } else {
          const aiTotal = money(String(aiData.valor_estimado_total));
          if (aiTotal !== null && (!ficha.valor_estimado_total || ficha.valor_estimado_total === 0)) {
            ficha.valor_estimado_total = aiTotal;
          }
        }
      }
      // Prazos e datas da IA (prioridade sobre regex ruidoso)
      if (isInformado(aiData.datas_prazos?.data_abertura_sessao)) {
        ficha.data_abertura = aiData.datas_prazos.data_abertura_sessao.trim();
      }
      if (isInformado(aiData.datas_prazos?.data_entrega_propostas)) {
        ficha.data_limite_proposta = aiData.datas_prazos.data_entrega_propostas.trim();
      }
      if (isInformado(aiData.datas_prazos?.data_limite_esclarecimentos)) {
        ficha.data_fim_esclarecimento = aiData.datas_prazos.data_limite_esclarecimentos.trim();
      }
      // Habilitação e exigências
      if (isInformado(aiData.exigencias_participacao?.exigencias_tecnicas)) {
        ficha.requisitos_habilitacao.atestados_capacidade_tecnica = [
          ...new Set([aiData.exigencias_participacao.exigencias_tecnicas.trim(), ...ficha.requisitos_habilitacao.atestados_capacidade_tecnica])
        ].slice(0, 8);
      }
      if (isInformado(aiData.exigencias_participacao?.exigencias_economico_financeiras)) {
        ficha.requisitos_habilitacao.exigencias_contabeis = [
          { nome_indice: 'Índices Contábeis / ME-EPP', regra: aiData.exigencias_participacao.exigencias_economico_financeiras.trim() },
          ...ficha.requisitos_habilitacao.exigencias_contabeis
        ].slice(0, 6);
      }
      // Execução e locais
      if (isInformado(aiData.execucao_e_contrato?.prazo_entrega_ou_execucao)) {
        ficha.prazos_e_locais.prazo_inicio_entrega = aiData.execucao_e_contrato.prazo_entrega_ou_execucao.trim();
      }
      if (isInformado(aiData.execucao_e_contrato?.local_entrega)) {
        ficha.prazos_e_locais.locais_prestacao_entrega = [
          ...new Set([aiData.execucao_e_contrato.local_entrega.trim(), ...ficha.prazos_e_locais.locais_prestacao_entrega])
        ].slice(0, 5);
      }
      if (isInformado(aiData.execucao_e_contrato?.prazo_vigencia_contrato)) {
        ficha.prazos_e_locais.vigencia_contrato = aiData.execucao_e_contrato.prazo_vigencia_contrato.trim();
      }
      if (isInformado(aiData.execucao_e_contrato?.garantia_contratual)) {
        ficha.pontos_de_atencao_risco.garantia_contratual = aiData.execucao_e_contrato.garantia_contratual.trim();
      }
      if (Array.isArray(aiData.alertas_criticos) && aiData.alertas_criticos.length > 0) {
        const novosAlertas = aiData.alertas_criticos.filter(isInformado).map(s => s.trim());
        ficha.pontos_de_atencao_risco.pontos_de_atencao_gerais = [
          ...new Set([...novosAlertas, ...ficha.pontos_de_atencao_risco.pontos_de_atencao_gerais])
        ].slice(0, 10);
      }
      // Processamento e mesclagem de lista_de_itens
      if (Array.isArray(aiData.lista_de_itens) && aiData.lista_de_itens.length > 0) {
        const aiItems = aiData.lista_de_itens.map((it, idx) => {
          const num = Number(String(it.numero_item_ou_lote || '').replace(/\D/g, '')) || (idx + 1);
          const unit = money(String(it.valor_unitario_estimado || ''));
          const tot = money(String(it.valor_total_item || ''));
          const qtd = Number(String(it.quantidade || '').replace(/[^\d.]/g, '')) || 1;
          return {
            item_numero: num,
            codigo_catalogo: `ITEM-${num}`,
            especificacao_sucinta: String(it.descricao_produto || '').trim(),
            unidade: String(it.unidade_medida || 'UN').toUpperCase().trim().slice(0, 10),
            quantitativo: qtd,
            valor_estimado_unitario: unit,
            valor_estimado_total: tot || (unit ? Number((unit * qtd).toFixed(2)) : null)
          };
        }).filter(it => it.especificacao_sucinta.length > 2);

        // Se a extração determinística não encontrou itens ou encontrou muito menos itens que a IA:
        if (!ficha.matriz_itens || ficha.matriz_itens.length < aiItems.length) {
          ficha.matriz_itens = deduplicateItems([...(ficha.matriz_itens || []), ...aiItems]);
        } else {
          // Se determinística já tem itens completos, enriquece especificações com a IA
          const aiMap = new Map(aiItems.map(it => [it.item_numero, it]));
          ficha.matriz_itens = ficha.matriz_itens.map(detItem => {
            const aiMatch = aiMap.get(detItem.item_numero);
            if (!aiMatch) return detItem;
            return {
              ...detItem,
              especificacao_sucinta: (detItem.especificacao_sucinta && detItem.especificacao_sucinta.length > 30) ? detItem.especificacao_sucinta : (aiMatch.especificacao_sucinta || detItem.especificacao_sucinta),
              valor_estimado_unitario: detItem.valor_estimado_unitario || aiMatch.valor_estimado_unitario,
              valor_estimado_total: detItem.valor_estimado_total || aiMatch.valor_estimado_total,
              quantitativo: detItem.quantitativo || aiMatch.quantitativo
            };
          });
        }
      }

      // Preserva e mescla dados completos no padrão ConLicitação
      if (aiData.conlicitacao && typeof aiData.conlicitacao === 'object') {
        ficha.conlicitacao = aiData.conlicitacao;
        const cl = aiData.conlicitacao;
        if (isInformado(cl.identificacao?.portal_realizacao) && ficha.portal_compras === UNKNOWN) {
          ficha.portal_compras = cl.identificacao.portal_realizacao.trim();
        }
        if (isInformado(cl.sessao_publica?.modo_disputa) && ficha.modo_disputa === UNKNOWN) {
          ficha.modo_disputa = cl.sessao_publica.modo_disputa.trim();
        }
        if (isInformado(cl.orgao_responsavel?.cnpj) && !ficha.orgao_cnpj) {
          ficha.orgao_cnpj = cl.orgao_responsavel.cnpj.trim();
        }
        if (isInformado(cl.prazos_importantes?.limite_impugnacao) && ficha.data_fim_impugnacao === UNKNOWN) {
          ficha.data_fim_impugnacao = cl.prazos_importantes.limite_impugnacao.trim();
        }
        if (Array.isArray(cl.penalidades_multas) && cl.penalidades_multas.length > 0) {
          const penalidades = cl.penalidades_multas.filter(isInformado).map(s => s.trim());
          if (penalidades.length > 0) {
            ficha.pontos_de_atencao_risco.clausulas_punitivas_multas = penalidades;
          }
        }
        if (isInformado(cl.detalhes_licitacao?.amostra) && (!ficha.pontos_de_atencao_risco.exigencia_amostra_poc || /não identificada/i.test(ficha.pontos_de_atencao_risco.exigencia_amostra_poc))) {
          ficha.pontos_de_atencao_risco.exigencia_amostra_poc = cl.detalhes_licitacao.amostra.trim();
        }
        if (isInformado(cl.detalhes_licitacao?.visita_tecnica) && (!ficha.pontos_de_atencao_risco.regras_vistoria?.detalhes_e_prazo || /não informada/i.test(ficha.pontos_de_atencao_risco.regras_vistoria.detalhes_e_prazo))) {
          ficha.pontos_de_atencao_risco.regras_vistoria = {
            ...ficha.pontos_de_atencao_risco.regras_vistoria,
            obrigatoria: /obrigat[oó]ria/i.test(cl.detalhes_licitacao.visita_tecnica) ? true : /facultativa|n[aã]o exige/i.test(cl.detalhes_licitacao.visita_tecnica) ? false : null,
            detalhes_e_prazo: cl.detalhes_licitacao.visita_tecnica.trim()
          };
        }
      }

      // Recalcula total se necessário
      if ((!ficha.valor_estimado_total || ficha.valor_estimado_total === 0) && ficha.matriz_itens?.length > 0) {
        const sum = ficha.matriz_itens.reduce((acc, it) => acc + (it.valor_estimado_total || 0), 0);
        if (sum > 0) ficha.valor_estimado_total = Number(sum.toFixed(2));
      }

      ficha = normalizeFicha(ficha);
    }
  } catch (err) {
    console.warn('[analyzeFiles] Prosseguindo com dados extraídos deterministicamente:', err.message);
  }

  const scopeHash = crypto.createHash('sha256').update(String(scope)).digest('hex').slice(0, 24);
  const directory = path.resolve(__dirname, '../uploads/edital-analysis', scopeHash);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  ficha.documentos_arquivados = [];
  for (const doc of documents) {
    const target = path.join(directory, doc.sha256 + doc.ext);
    await fs.writeFile(target, doc.buffer, { mode: 0o600 });
    ficha.documentos_arquivados.push({ name: doc.name, sha256: doc.sha256, characters: doc.text.length, path: target });
  }
  return ficha;
}

/**
 * Análise técnica completa de Termo de Referência (TR) com:
 * 1) Comparação item-a-item contra Datasheet(s) anexado(s) e/ou
 * 2) Busca na internet (Google Search Grounding via Gemini) de modelos reais que atendam 100% do TR.
 */
async function analyzeTechnicalTRWithEquipment({ trFiles = [], datasheetFiles = [], searchWeb = true, customNotes = '' } = {}) {
  if (!Array.isArray(trFiles) || trFiles.length === 0) {
    throw new Error('Anexe ao menos 1 arquivo de Termo de Referência (TR) em PDF ou DOCX.');
  }
  const trDocs = [];
  for (const f of trFiles.slice(0, 5)) trDocs.push(await extractDocument(f));
  const dsDocs = [];
  for (const f of (Array.isArray(datasheetFiles) ? datasheetFiles : []).slice(0, 5)) dsDocs.push(await extractDocument(f));

  const trText = trDocs.map(d => `=== TR: ${d.name} ===\n${clean(d.text)}`).join('\n\n').slice(0, 320000);
  const dsText = dsDocs.map(d => `=== DATASHEET: ${d.name} ===\n${clean(d.text)}`).join('\n\n').slice(0, 140000);
  const hasDatasheet = dsDocs.length > 0;
  const shouldSearchWeb = Boolean(searchWeb || !hasDatasheet);

  const apiKey = getConfiguredGeminiKey();
  if (!apiKey) {
    // Fallback determinístico completo quando nenhuma chave Gemini está configurada
    const det = analyzeText(trDocs, {});
    const trLines = clean(trDocs.map(d => d.text).join('\n')).split('\n').map(l => l.trim()).filter(l => l.length > 25);
    const reqLines = trLines.filter(l => /mínim|exig|deverá|processador|memória|armazenamento|porta|interface|garantia|certifica|anatel|inmetro|potência|lúmens|resoluç|throughput|velocidade/iu.test(l)).slice(0, 18);
    return {
      resumo_tr: {
        titulo_objeto: det.resumo_executivo !== UNKNOWN ? det.resumo_executivo.slice(0, 200) : (trDocs[0]?.name || 'Termo de Referência'),
        orgao: det.orgao_comprador,
        categoria_tecnologica: 'Análise Determinística (sem IA)',
        total_itens: det.matriz_itens?.length || 1,
        resumo_executivo: det.resumo_executivo,
        normas_certificacoes_exigidas: det.tags_classificacao || [],
        garantia_sla_exigidos: det.pontos_de_atencao_risco?.garantia_contratual || 'Consulte o TR'
      },
      aderencia_geral: {
        percentual_atendimento: 0,
        veredicto: 'IA NÃO CONFIGURADA',
        justificativa_veredicto: 'Configure a GEMINI_API_KEY no painel acima (botão Configurar Chave Gemini) para habilitar a busca de modelos na internet e a auditoria técnica TR × Datasheet.'
      },
      modelos_recomendados: [],
      matriz_comparativa: reqLines.map((req, idx) => ({
        item_tr: `Req ${idx + 1}`,
        categoria: 'Especificação Técnica',
        requisito_tr: req.slice(0, 240),
        especificacao_encontrada: hasDatasheet ? 'Requer análise IA (configure GEMINI_API_KEY)' : 'Aguardando busca IA',
        status: 'NAO_INFORMADO',
        evidencia_pagina_ou_fonte: trDocs[0]?.name || 'TR',
        observacao: 'Configure a chave Gemini API para comparação automática.'
      })),
      alertas_desclassificacao: [
        'GEMINI_API_KEY não configurada no servidor. Configure a chave para liberar sugestões de modelos 100% aderentes e busca na internet.'
      ],
      fontes_consultadas: [],
      arquivos_analisados: {
        tr: trDocs.map(d => ({ name: d.name, characters: d.text.length })),
        datasheets: dsDocs.map(d => ({ name: d.name, characters: d.text.length }))
      },
      modo_busca_internet: false,
      ia_nao_configurada: true,
      analisado_em: new Date().toISOString()
    };
  }

  const model = process.env.GEMINI_MODEL || process.env.GOOGLE_MODEL || 'gemini-3.6-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const prompt = `Você é um Engenheiro Sênior de Pré-Vendas, Arquitetura de TI/Telecom/Audiovisual e Especialista Técnico em Licitações Públicas Brasileiras (Lei 14.133/2021).

Sua missão é realizar uma ANÁLISE TÉCNICA COMPLETA do Termo de Referência (TR) abaixo:
${hasDatasheet ? '- Há DATASHEET(S) DE EQUIPAMENTO(S) anexado(s): faça a auditoria técnica rigorosa comparando CADA requisito técnico obrigatório do TR contra as especificações reais do(s) datasheet(s), apontando conformidades, ressalvas ou reprovações.' : '- NÃO há datasheet anexado.'}
${shouldSearchWeb ? '- BUSCA DE MERCADO / INTERNET ATIVA: pesquise e sugira modelos reais de equipamentos atualmente disponíveis no mercado (com fabricante, modelo exato e part number) que ATENDAM 100% de todas as especificações técnicas mínimas exigidas no TR.' : ''}
${customNotes ? `\nOBSERVAÇÕES / PREFERÊNCIAS DO ANALISTA:\n${customNotes}\n` : ''}

REGRAS CRÍTICAS:
1. Não invente especificações. Seja rigoroso com métricas mínimas (throughput, portas, CPU/RAM, IOPS, brilho/lúmens, potência, certificações ANATEL/INMETRO/ISO, garantia on-site, acessórios, cabos, licenças).
2. Na "matriz_comparativa", liste TODOS os requisitos técnicos relevantes do TR (mínimo 12 requisitos se houver).
3. Em "modelos_recomendados", sugira de 2 a 4 modelos reais que atendam 100% do TR (ou avalie o modelo do datasheet + alternativas 100% aderentes caso o datasheet tenha alguma lacuna).
4. O retorno DEVE ser EXCLUSIVAMENTE um JSON válido (sem blocos markdown \`\`\`json) seguindo exatamente esta estrutura:

{
  "resumo_tr": {
    "titulo_objeto": "Título claro do objeto do TR",
    "orgao": "Órgão contratante se identificado",
    "categoria_tecnologica": "Ex: Redes & Segurança / Datacenter / Audiovisual / Notebooks / Telecom",
    "total_itens": 1,
    "resumo_executivo": "Síntese técnica objetiva do escopo, quantidades, instalação e requisitos críticos",
    "normas_certificacoes_exigidas": ["ANATEL", "Garantia on-site", "..."],
    "garantia_sla_exigidos": "Resumo da garantia e SLA exigidos no TR"
  },
  "aderencia_geral": {
    "percentual_atendimento": 100,
    "veredicto": "ATENDE 100% | ATENDE PARCIALMENTE | INCOMPATÍVEL | BUSCA DE MERCADO",
    "justificativa_veredicto": "Explicação técnica objetiva do resultado geral"
  },
  "modelos_recomendados": [
    {
      "item_ou_lote": "Item 1 / Lote 1 (ou Geral)",
      "fabricante": "Ex: Fortinet / Dell / Cisco / Epson / Shure",
      "modelo": "Nome comercial completo do equipamento",
      "part_number": "Part number / SKU exato quando aplicável",
      "aderencia_percentual": 100,
      "atende_100_porcento": true,
      "justificativa_tecnica": "Por que este modelo atende integralmente aos requisitos do TR",
      "acessorios_licencas_necessarios": ["Fonte redundante", "Licença 36 meses", "Transceivers SFP+"],
      "pontos_atencao": ["Confirmar prazo de entrega ou homologação"],
      "fonte_url": "URL oficial do fabricante/datasheet se encontrada"
    }
  ],
  "matriz_comparativa": [
    {
      "item_tr": "Item 1",
      "categoria": "Processamento / Interfaces / Garantia / Normas / Desempenho",
      "requisito_tr": "Descrição objetiva da exigência mínima do TR",
      "especificacao_encontrada": "Valor encontrado no Datasheet ou no modelo recomendado",
      "status": "ATENDE_100 | ATENDE_RESSALVA | NAO_ATENDE | NAO_INFORMADO",
      "evidencia_pagina_ou_fonte": "Seção/página do TR/Datasheet ou fonte web",
      "observacao": "Detalhe técnico ou comprovação necessária"
    }
  ],
  "alertas_desclassificacao": [
    "Lista de exigências armadilha no TR que podem desclassificar a proposta se ignoradas"
  ]
}

TEXTO DO TERMO DE REFERÊNCIA (TR):
"""
${trText}
"""
${hasDatasheet ? `\nTEXTO DO(S) DATASHEET(S) ANEXADO(S):\n"""\n${dsText}\n"""` : ''}`;

  const callGemini = async (withSearchTool) => {
    const models = getGeminiCandidateModels();
    let lastError = { ok: false, status: 503, errText: 'Nenhum modelo disponível' };
    for (const mdl of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(mdl)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);
      try {
        const bodyPayload = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.15,
            maxOutputTokens: 16384,
            ...(withSearchTool ? {} : { responseMimeType: 'application/json' })
          },
          ...(withSearchTool ? { tools: [{ google_search: {} }] } : {})
        };
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
          signal: controller.signal
        });
        if (!response.ok) {
          const errText = await response.text();
          lastError = { ok: false, status: response.status, errText };
          if ([404, 429, 503].includes(response.status)) {
            console.warn(`[TR IA] Modelo ${mdl} retornou ${response.status}; tentando próximo fallback...`);
            continue;
          }
          return lastError;
        }
        const data = await response.json();
        const candidate = data?.candidates?.[0];
        const rawText = candidate?.content?.parts?.map(p => p.text || '').join('') || '';
        const chunks = candidate?.groundingMetadata?.groundingChunks || [];
        const fontes = chunks
          .map(c => c?.web)
          .filter(w => w?.uri)
          .map(w => ({ title: w.title || w.uri, url: w.uri }));
        return { ok: true, rawText, fontes };
      } finally {
        clearTimeout(timer);
      }
    }
    return lastError;
  };

  let res = shouldSearchWeb ? await callGemini(true) : await callGemini(false);
  if (!res.ok && shouldSearchWeb) {
    // Fallback sem tool google_search se a chave/projeto não suportar grounding
    res = await callGemini(false);
  }
  if (!res.ok) {
    throw new Error(`Falha na análise técnica IA (${res.status}): ${String(res.errText || '').slice(0, 180)}`);
  }

  const cleanedJson = res.rawText.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const firstBrace = cleanedJson.indexOf('{');
  const lastBrace = cleanedJson.lastIndexOf('}');
  const jsonSlice = firstBrace >= 0 && lastBrace > firstBrace ? cleanedJson.slice(firstBrace, lastBrace + 1) : cleanedJson;
  const parsed = JSON.parse(jsonSlice);

  return {
    ...parsed,
    fontes_consultadas: res.fontes || [],
    arquivos_analisados: {
      tr: trDocs.map(d => ({ name: d.name, characters: d.text.length })),
      datasheets: dsDocs.map(d => ({ name: d.name, characters: d.text.length }))
    },
    modo_busca_internet: shouldSearchWeb,
    analisado_em: new Date().toISOString()
  };
}

module.exports = { analyzeText, analyzeFiles, extractDocument, analyzeTechnicalTRWithEquipment, setRuntimeGeminiKey, getConfiguredGeminiKey };
