const UNKNOWN = 'Não identificado';
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' && value.trim() ? value.trim() : UNKNOWN;
const number = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
function isSyntheticFicha(ficha = {}) {
  ficha ||= {};
  return /O certame destina-se à contratação conforme especificado no documento[\s\S]*O objeto abrange a aquisição e fornecimento de materiais e serviços técnicos sob demanda/i.test(ficha.resumo_executivo || ficha.objeto || '') ||
    (number(ficha.valor_estimado_total) === 150000 && ficha.matriz_itens?.some(item => item.codigo_catalogo === 'CATSER-21123' && /Serviço de fornecimento e instalação conforme Termo de Referência/.test(item.especificacao_sucinta || '')));
}
function normalizeFicha(raw = {}) {
  raw ||= {};
  let nested = raw.analysisData || {};
  if (typeof nested === 'string') { try { nested = JSON.parse(nested); } catch { nested = {}; } }
  const source = { ...raw, ...nested };
  const invalid = isSyntheticFicha(source) || source.analysisStatus === 'requires_reanalysis';
  const f = invalid ? {} : source;
  const req = f.requisitos_habilitacao || {};
  const prazo = f.prazos_e_locais || {};
  const risco = f.pontos_de_atencao_risco || {};
  return {
    ...source,
    id: raw.id || source.id,
    id_licitacao: source.id_licitacao || raw.numeroControlePNCP || '',
    orgao_comprador: text(invalid ? null : (f.orgao_comprador || f.orgao_nome || f.orgao)),
    modalidade_contratacao: text(f.modalidade_contratacao || f.modalidade),
    criterio_julgamento: text(f.criterio_julgamento), modo_disputa: text(f.modo_disputa),
    data_abertura: text(f.data_abertura), data_limite_proposta: text(f.data_limite_proposta),
    data_fim_esclarecimento: text(f.data_fim_esclarecimento), data_fim_impugnacao: text(f.data_fim_impugnacao),
    valor_estimado_total: number(f.valor_estimado_total), portal_compras: text(f.portal_compras),
    resumo_executivo: invalid ? 'Análise anterior inválida: foram usados dados padronizados. Reenvie os documentos originais para reanalisar.' : text(f.resumo_executivo || f.objeto),
    requisitos_habilitacao: {
      atestados_capacidade_tecnica: list(req.atestados_capacidade_tecnica),
      certidoes_e_registros_especificos: list(req.certidoes_e_registros_especificos),
      exigencias_contabeis: list(req.exigencias_contabeis), qualificacao_equipe_chave: list(req.qualificacao_equipe_chave)
    },
    prazos_e_locais: { prazo_inicio_entrega: text(prazo.prazo_inicio_entrega),
      locais_prestacao_entrega: list(prazo.locais_prestacao_entrega), vigencia_contrato: text(prazo.vigencia_contrato),
      regime_execucao: text(prazo.regime_execucao), prazo_recebimento_provisorio_definitivo: text(prazo.prazo_recebimento_provisorio_definitivo) },
    pontos_de_atencao_risco: {
      clausulas_punitivas_multas: list(risco.clausulas_punitivas_multas),
      exigencia_amostra_poc: risco.exigencia_amostra_poc || '', garantia_contratual: text(risco.garantia_contratual),
      regras_vistoria: { obrigatoria: risco.regras_vistoria?.obrigatoria ?? null,
        permite_declaracao_substitutiva: risco.regras_vistoria?.permite_declaracao_substitutiva ?? null,
        detalhes_e_prazo: text(risco.regras_vistoria?.detalhes_e_prazo) },
      pontos_de_atencao_gerais: list(risco.pontos_de_atencao_gerais)
    },
    matriz_itens: list(f.matriz_itens), tags_classificacao: list(f.tags_classificacao),
    documentos_origem: source.documentos_origem || {},
    analysisStatus: invalid ? 'requires_reanalysis' : (source.analysisStatus || 'extracted'),
    analysisWarnings: invalid ? ['Ficha gerada pelo analisador antigo com valores fictícios. É necessário reanalisar os originais.'] : list(source.analysisWarnings),
    convertido_oportunidade: Boolean(raw.convertido_oportunidade || raw.convertidoOportunidade || source.convertido_oportunidade),
    oportunidade_id: raw.oportunidade_id || raw.oportunidadeId || source.oportunidade_id || null
  };
}
const hasSampleRequirement = ficha => {
  const value = ficha?.pontos_de_atencao_risco?.exigencia_amostra_poc || '';
  return Boolean(value) && !/n[aã]o (?:ser[aá] |[eé] |haver[aá] )?(?:exigid|solicitad)|dispensad|n[aã]o identificado/i.test(value);
};
module.exports = { normalizeFicha, isSyntheticFicha, hasSampleRequirement };
