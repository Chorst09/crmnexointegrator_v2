export interface LicitacaoItem {
  descricao?: string;
  especificacao?: string;
  quantidade?: number;
  unidade?: string;
  valor_referencia?: number;
  valorUnitarioEstimado?: number;
  valorTotal?: number;
}

export interface OrgaoEntidade {
  cnpj: string;
  razaoSocial: string;
  poderId?: string;
  esferaId?: string;
}

export interface UnidadeOrgao {
  ufSigla: string;
  municipioNome: string;
  nomeUnidade?: string;
  codigoUnidade?: string;
}

export interface Licitacao {
  id: string;
  orgao?: string;
  uf?: string;
  cidade?: string;
  modalidade?: string;
  modalidade_nome?: string;
  objeto_resumo?: string;
  objetoCompra?: string;
  data_abertura?: string;
  dataEncerramentoProposta?: string;
  dataHoraAberturaSessaoPublica?: string;
  dataAberturaProposta?: string;
  dataAtualizacao?: string;
  valor_estimado?: number;
  valorTotalEstimado?: number;
  situacao?: string;
  situacaoCompraNome?: string;
  anoCompra?: number;
  sequencialCompra?: number;
  numeroControlePNCP?: string;
  linkSistemaOrigem?: string;
  linkProcessoEletronico?: string;
  link?: string;
  portal_origem?: string;
  orgaoEntidade?: OrgaoEntidade;
  unidadeOrgao?: UnidadeOrgao;
  itens?: LicitacaoItem[];
  gerenciada?: boolean;
  statusGerenciada?: string;
  faseGerenciada?: string;
  notasGerenciada?: string;
  fonte?: string;
}

export interface LicitacaoGerenciada extends Licitacao {
  _managedId: string;
  addedAt: string;
  statusFase: 'Análise' | 'Preparação' | 'Proposta Enviada' | 'Ganha' | 'Perdida';
  notas?: string;
}

export interface Alerta {
  id: string;
  termo: string;
  uf?: string;
  min_valor?: number;
  dataCriacao?: string;
}

export interface MatrizItemAnalise {
  item_numero?: number;
  codigo_catalogo?: string;
  especificacao_sucinta: string;
  unidade?: string;
  quantitativo: number;
  valor_estimado_unitario?: number;
  valor_estimado_total?: number;
}

export interface ExigenciaContabil {
  nome_indice: string;
  regra: string;
}

export interface RequisitosHabilitacao {
  atestados_capacidade_tecnica: string[];
  certidoes_e_registros_especificos: string[];
  exigencias_contabeis: ExigenciaContabil[];
  qualificacao_equipe_chave: string[];
}

export interface PrazosELocais {
  prazo_inicio_entrega: string;
  vigencia_contrato: string;
  regime_execucao?: string;
  locais_prestacao_entrega: string[];
  prazo_recebimento_provisorio_definitivo?: string;
}

export interface RegrasVistoria {
  obrigatoria: boolean;
  permite_declaracao_substitutiva: boolean;
  detalhes_e_prazo?: string;
}

export interface PontosDeAtencaoRisco {
  regras_vistoria: RegrasVistoria;
  exigencia_amostra?: string;
  garantia_contratual?: string;
  indices_liquidacao_risco?: string[];
  penalidades_multas?: string[];
  outros_riscos?: string[];
}

export interface FichaTecnicaEditalTR {
  id?: string;
  id_licitacao: string;
  orgao_comprador: string;
  resumo_executivo: string;
  modalidade_contratacao?: string;
  criterio_julgamento?: string;
  modo_disputa?: string;
  data_abertura?: string;
  data_limite_proposta?: string;
  data_fim_esclarecimento?: string;
  valor_estimado_total?: number;
  portal_compras?: string;
  requisitos_habilitacao: RequisitosHabilitacao;
  prazos_e_locais: PrazosELocais;
  pontos_de_atencao_risco: PontosDeAtencaoRisco;
  matriz_itens: MatrizItemAnalise[];
  tags_classificacao?: string[];
  convertido_oportunidade?: boolean;
  oportunidade_id?: string;
}
