/**
 * ============================================================================
 * Tipos TypeScript para Integração PNCP
 * ============================================================================
 * 
 * Definições de tipos para a API do Portal Nacional de Contratações Públicas
 * Baseado na documentação oficial do PNCP v2.6
 * 
 * Autor: AI Assistant (Arquiteto de Software)
 * Data: 2026-09-03
 */

// ============================================================================
// TIPOS PRINCIPAIS DA API PNCP
// ============================================================================

/**
 * Resposta padrão da API PNCP com paginação
 */
export interface PncpApiResponse<T = any> {
  data: T[];
  totalRegistros: number;
  totalPaginas: number;
  numeroPagina: number;
  paginasRestantes: number;
  empty: boolean;
}

/**
 * Dados do órgão/entidade
 */
export interface OrgaoEntidade {
  cnpj: string;
  razaosocial: string;
  poderId: PoderId;
  esferaId: EsferaId;
}

/**
 * Dados da unidade administrativa
 */
export interface UnidadeOrgao {
  codigoUnidade: string;
  nomeUnidade: string;
  codigoIbge: number;
  municipioNome: string;
  ufSigla: string;
  ufNome: string;
}

/**
 * Amparo legal da contratação
 */
export interface AmparoLegal {
  codigo: number;
  nome: string;
  descricao: string;
}

/**
 * Contratação completa da API PNCP
 */
export interface PncpContratacao {
  // Identificação
  numeroControlePNCP: string;
  numeroCompra: string;
  anoCompra: number;
  processo: string;
  sequencialCompra: number;

  // Tipo e modalidade
  tipoInstrumentoConvocatorioId: TipoInstrumentoConvocatorio;
  tipoInstrumentoConvocatorioNome: string;
  modalidadeId: ModalidadeContratacao;
  modalidadeNome: string;
  modoDisputaId: ModoDisputa;
  modoDisputaNome: string;

  // Status
  situacaoCompraId: SituacaoContratacao;
  situacaoCompraNome: string;

  // Conteúdo
  objetoCompra: string;
  informacaoComplementar?: string;
  srp: boolean; // Sistema de Registro de Preços

  // Valores
  valorTotalEstimado: number;
  valorTotalHomologado: number;

  // Datas (strings ISO da API)
  dataAberturaProposta?: string;
  dataEncerramentoProposta?: string;
  dataPublicacaoPncp: string;
  dataInclusao: string;
  dataAtualizacao: string;

  // Estruturas complexas
  amparoLegal: AmparoLegal;
  orgaoEntidade: OrgaoEntidade;
  unidadeOrgao: UnidadeOrgao;
  orgaoSubRogado?: OrgaoEntidade;
  unidadeSubRogada?: UnidadeOrgao;

  // Informações adicionais
  usuarioNome: string;
  linkSistemaOrigem?: string;
  justificativaPresencial?: string;
}

/**
 * Ata de Registro de Preços
 */
export interface PncpAta {
  numeroControlePNCPAta: string;
  numeroControlePNCPCompra: string;
  numeroAtaRegistroPreco: string;
  anoAta: number;
  dataAssinatura: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  dataCancelamento?: string;
  cancelado: boolean;
  dataPublicacaoPncp: string;
  dataInclusao: string;
  dataAtualizacao: string;
  objetoContratacao: string;
  cnpjOrgao: string;
  nomeOrgao: string;
  codigoUnidadeOrgao: string;
  nomeUnidadeOrgao: string;
  cnpjOrgaoSubrogado?: string;
  nomeOrgaoSubrogado?: string;
  codigoUnidadeOrgaoSubrogado?: string;
  nomeUnidadeOrgaoSubrogado?: string;
  usuario: string;
}

/**
 * Contrato da API PNCP
 */
export interface PncpContrato {
  numeroControlePNCP: string;
  numeroControlePNCPCompra?: string;
  numeroContratoEmpenho: string;
  anoContrato: number;
  sequencialContrato: number;
  processo?: string;
  tipoContrato: {
    id: TipoContrato;
    nome: string;
  };
  categoriaProcesso: {
    id: CategoriaProcesso;
    nome: string;
  };
  receita: boolean;
  objetoContrato: string;
  informacaoComplementar?: string;
  orgaoEntidade: OrgaoEntidade;
  unidadeOrgao: UnidadeOrgao;
  orgaoSubRogado?: OrgaoEntidade;
  unidadeSubRogada?: UnidadeOrgao;
  tipoPessoa: TipoPessoa;
  niFornecedor: string;
  nomeRazaoSocialFornecedor: string;
  tipoPessoaSubContratada?: TipoPessoa;
  niFornecedorSubContratado?: string;
  nomeFornecedorSubContratado?: string;
  valorInicial: number;
  numeroParcelas?: number;
  valorParcela?: number;
  valorGlobal: number;
  valorAcumulado: number;
  dataAssinatura: string;
  dataVigenciaInicio: string;
  dataVigenciaFim: string;
  numeroRetificacao: number;
  usuarioNome: string;
  dataPublicacaoPncp: string;
  dataAtualizacao: string;
  identificadorCipi?: string;
  urlCipi?: string;
}

// ============================================================================
// ENUMS E CONSTANTES
// ============================================================================

/**
 * Códigos de Poder (poderId)
 */
export enum PoderId {
  LEGISLATIVO = 'L',
  EXECUTIVO = 'E', 
  JUDICIARIO = 'J'
}

/**
 * Códigos de Esfera (esferaId)
 */
export enum EsferaId {
  FEDERAL = 'F',
  ESTADUAL = 'E',
  MUNICIPAL = 'M',
  DISTRITAL = 'D'
}

/**
 * Tipo de Instrumento Convocatório
 */
export enum TipoInstrumentoConvocatorio {
  EDITAL = 1,
  AVISO_CONTRATACAO_DIRETA = 2,
  ATO_AUTORIZA_CONTRATACAO_DIRETA = 3
}

/**
 * Modalidade de Contratação
 */
export enum ModalidadeContratacao {
  LEILAO_ELETRONICO = 1,
  DIALOGO_COMPETITIVO = 2,
  CONCURSO = 3,
  CONCORRENCIA_ELETRONICA = 4,
  CONCORRENCIA_PRESENCIAL = 5,
  PREGAO_ELETRONICO = 6,
  PREGAO_PRESENCIAL = 7,
  DISPENSA_LICITACAO = 8,
  INEXIGIBILIDADE = 9,
  MANIFESTACAO_INTERESSE = 10,
  PRE_QUALIFICACAO = 11,
  CREDENCIAMENTO = 12,
  LEILAO_PRESENCIAL = 13
}

/**
 * Modo de Disputa
 */
export enum ModoDisputa {
  ABERTO = 1,
  FECHADO = 2,
  ABERTO_FECHADO = 3,
  DISPENSA_COM_DISPUTA = 4,
  NAO_SE_APLICA = 5,
  FECHADO_ABERTO = 6
}

/**
 * Situação da Contratação
 */
export enum SituacaoContratacao {
  DIVULGADA_PNCP = 1,
  REVOGADA = 2,
  ANULADA = 3,
  SUSPENSA = 4
}

/**
 * Tipo de Contrato
 */
export enum TipoContrato {
  CONTRATO_TERMO_INICIAL = 1,
  COMODATO = 2,
  ARRENDAMENTO = 3,
  CONCESSAO = 4,
  TERMO_ADESAO = 5,
  CONVENIO = 6,
  EMPENHO = 7,
  OUTROS = 8,
  TERMO_EXECUCAO_DESCENTRALIZADA = 9,
  ACORDO_COOPERACAO_TECNICA = 10,
  TERMO_COMPROMISSO = 11,
  CARTA_CONTRATO = 12
}

/**
 * Categoria do Processo
 */
export enum CategoriaProcesso {
  CESSAO = 1,
  COMPRAS = 2,
  INFORMATICA_TIC = 3,
  INTERNACIONAL = 4,
  LOCACAO_IMOVEIS = 5,
  MAO_DE_OBRA = 6,
  OBRAS = 7,
  SERVICOS = 8,
  SERVICOS_ENGENHARIA = 9,
  SERVICOS_SAUDE = 10,
  ALIENACAO_BENS = 11
}

/**
 * Tipo de Pessoa
 */
export enum TipoPessoa {
  PESSOA_JURIDICA = 'PJ',
  PESSOA_FISICA = 'PF',
  PESSOA_ESTRANGEIRA = 'PE'
}

// ============================================================================
// TIPOS DE DADOS INTERNOS
// ============================================================================

/**
 * Status de processamento interno
 */
export enum StatusProcessamento {
  NOVO = 'NOVO',
  PROCESSADO = 'PROCESSADO',
  ERRO = 'ERRO',
  REPROCESSAR = 'REPROCESSAR'
}

/**
 * Metadata de processamento
 */
export interface MetadataProcessamento {
  dataProcessamento: string;
  versaoWorker: string;
  tentativasProcessamento?: number;
  erros?: string[];
  dadosOriginais?: any;
  versaoApi?: string;
}

/**
 * Estatísticas de processamento
 */
export interface ProcessingStats {
  totalProcessed: number;
  totalInserted: number;
  totalUpdated: number;
  totalErrors: number;
  duplicatesSkipped: number;
  startTime: number;
  endTime?: number;
  apiCalls: number;
}

/**
 * Configuração do worker
 */
export interface WorkerConfig {
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  maxRetryDelay: number;
  rateLimitDelay: number;
  batchSize: number;
  maxConcurrentRequests: number;
}

/**
 * Parâmetros de busca da API
 */
export interface PncpSearchParams {
  dataInicial: string; // YYYYMMDD
  dataFinal: string; // YYYYMMDD
  codigoModalidadeContratacao?: number;
  codigoModoDisputa?: number;
  uf?: string;
  codigoMunicipioIbge?: string;
  cnpj?: string;
  codigoUnidadeAdministrativa?: string;
  idUsuario?: number;
  pagina: number;
  tamanhoPagina?: number;
}

/**
 * Resultado de operação UPSERT
 */
export interface UpsertResult {
  operation: 'INSERT' | 'UPDATE' | 'SKIP';
  numeroControlePncp: string;
  error?: string;
}

/**
 * Log estruturado
 */
export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  data?: any;
}

// ============================================================================
// MAPEAMENTOS E UTILITÁRIOS
// ============================================================================

/**
 * Mapeamento de modalidades para nomes legíveis
 */
export const MODALIDADE_NAMES: Record<ModalidadeContratacao, string> = {
  [ModalidadeContratacao.LEILAO_ELETRONICO]: 'Leilão - Eletrônico',
  [ModalidadeContratacao.DIALOGO_COMPETITIVO]: 'Diálogo Competitivo',
  [ModalidadeContratacao.CONCURSO]: 'Concurso',
  [ModalidadeContratacao.CONCORRENCIA_ELETRONICA]: 'Concorrência - Eletrônica',
  [ModalidadeContratacao.CONCORRENCIA_PRESENCIAL]: 'Concorrência - Presencial',
  [ModalidadeContratacao.PREGAO_ELETRONICO]: 'Pregão - Eletrônico',
  [ModalidadeContratacao.PREGAO_PRESENCIAL]: 'Pregão - Presencial',
  [ModalidadeContratacao.DISPENSA_LICITACAO]: 'Dispensa de Licitação',
  [ModalidadeContratacao.INEXIGIBILIDADE]: 'Inexigibilidade',
  [ModalidadeContratacao.MANIFESTACAO_INTERESSE]: 'Manifestação de Interesse',
  [ModalidadeContratacao.PRE_QUALIFICACAO]: 'Pré-qualificação',
  [ModalidadeContratacao.CREDENCIAMENTO]: 'Credenciamento',
  [ModalidadeContratacao.LEILAO_PRESENCIAL]: 'Leilão - Presencial'
};

/**
 * Modalidades prioritárias para ingestão diária
 */
export const MODALIDADES_PRIORITARIAS: ModalidadeContratacao[] = [
  ModalidadeContratacao.PREGAO_ELETRONICO,
  ModalidadeContratacao.DISPENSA_LICITACAO,
  ModalidadeContratacao.INEXIGIBILIDADE,
  ModalidadeContratacao.CONCORRENCIA_ELETRONICA
];

/**
 * UFs brasileiras
 */
export const UFS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard para verificar se é uma contratação válida
 */
export function isPncpContratacao(obj: any): obj is PncpContratacao {
  return (
    obj &&
    typeof obj.numeroControlePNCP === 'string' &&
    typeof obj.objetoCompra === 'string' &&
    typeof obj.valorTotalEstimado === 'number' &&
    obj.orgaoEntidade &&
    typeof obj.orgaoEntidade.cnpj === 'string'
  );
}

/**
 * Type guard para verificar se é uma resposta válida da API
 */
export function isPncpApiResponse<T>(obj: any): obj is PncpApiResponse<T> {
  return (
    obj &&
    Array.isArray(obj.data) &&
    typeof obj.totalRegistros === 'number' &&
    typeof obj.totalPaginas === 'number' &&
    typeof obj.numeroPagina === 'number'
  );
}

// ============================================================================
// UTILITÁRIOS DE VALIDAÇÃO
// ============================================================================

/**
 * Valida CNPJ
 */
export function isValidCNPJ(cnpj: string): boolean {
  return /^\d{14}$/.test(cnpj.replace(/\D/g, ''));
}

/**
 * Valida formato de data PNCP (YYYYMMDD)
 */
export function isValidPncpDate(date: string): boolean {
  return /^\d{8}$/.test(date);
}

/**
 * Converte data para formato PNCP
 */
export function toPncpDateFormat(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}