#!/usr/bin/env node
"use strict";
/**
 * ============================================================================
 * Worker de Ingestão Diária - API PNCP
 * ============================================================================
 *
 * Desenvolvido por: AI Assistant (Engenheiro de Dados)
 * Data: 2026-09-03
 *
 * Descrição:
 * Script para consumo diário da API oficial do PNCP (Portal Nacional de
 * Contratações Públicas) com ingestão inteligente, tratamento de erros
 * e armazenamento otimizado no banco de dados.
 *
 * Funcionalidades:
 * - Consumo da API PNCP com paginação automática
 * - Filtragem por data (últimas 24 horas)
 * - UPSERT inteligente (evita duplicatas)
 * - Retry automático com backoff exponencial
 * - Rate limiting respeitoso
 * - Logs estruturados
 * - Métricas de performance
 * - Tratamento robusto de erros
 *
 * Uso:
 * - Execução diária via cron: node fetchPncpData.ts
 * - Execução manual: node fetchPncpData.ts --date=2026-09-01
 * - Modo verbose: node fetchPncpData.ts --verbose
 *
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PncpDataFetcher = void 0;
const client_1 = require("../../apps/api/node_modules/@prisma/client");
const axios_1 = require("axios");
const crypto = require("crypto");
const date_fns_1 = require("date-fns");
const perf_hooks_1 = require("perf_hooks");
// ============================================================================
// CONFIGURAÇÃO PRINCIPAL
// ============================================================================
const CONFIG = {
    baseUrl: 'https://pncp.gov.br/api/consulta/v1',
    timeout: 30000, // 30 segundos
    maxRetries: 3,
    retryDelay: 1000, // 1 segundo inicial
    maxRetryDelay: 10000, // 10 segundos máximo
    rateLimitDelay: 1000, // 1 segundo entre requests
    batchSize: 100, // Processar em lotes de 100
    maxConcurrentRequests: 3 // Máximo 3 requests simultâneos
};
// ============================================================================
// CLASSE PRINCIPAL DO WORKER
// ============================================================================
class PncpDataFetcher {
    constructor(verbose = false) {
        this.prisma = new client_1.PrismaClient();
        this.verbose = verbose;
        // Configuração do cliente HTTP
        this.axios = axios_1.default.create({
            baseURL: CONFIG.baseUrl,
            timeout: CONFIG.timeout,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'NexosIntegrator-PNCPWorker/1.0'
            }
        });
        // Inicialização das estatísticas
        this.stats = {
            totalProcessed: 0,
            totalInserted: 0,
            totalUpdated: 0,
            totalErrors: 0,
            startTime: perf_hooks_1.performance.now(),
            apiCalls: 0,
            duplicatesSkipped: 0
        };
        // Interceptors para logging e retry
        this.setupAxiosInterceptors();
    }
    /**
     * Configura interceptors do Axios para logging e controle de rate limit
     */
    setupAxiosInterceptors() {
        // Request interceptor
        this.axios.interceptors.request.use((config) => {
            this.log('DEBUG', `API Request: ${config.method?.toUpperCase()} ${config.url}`, {
                params: config.params
            });
            return config;
        }, (error) => {
            this.log('ERROR', 'Request error', error);
            return Promise.reject(error);
        });
        // Response interceptor
        this.axios.interceptors.response.use((response) => {
            this.stats.apiCalls++;
            this.log('DEBUG', `API Response: ${response.status} - ${response.data?.totalRegistros || 0} registros`);
            return response;
        }, (error) => {
            this.log('ERROR', 'Response error', {
                status: error.response?.status,
                message: error.message
            });
            return Promise.reject(error);
        });
    }
    /**
     * Sistema de logging estruturado
     */
    log(level, message, data) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...(data && { data })
        };
        if (this.verbose || level !== 'DEBUG') {
            console.log(JSON.stringify(entry));
        }
    }
    /**
     * Função principal de execução
     */
    async execute(targetDate) {
        try {
            this.log('INFO', '🚀 Iniciando Worker de Ingestão PNCP');
            // Determina a data alvo
            const date = this.parseTargetDate(targetDate);
            this.log('INFO', `📅 Data alvo: ${(0, date_fns_1.format)(date, 'yyyy-MM-dd')}`, { date });
            // Busca todas as modalidades principais
            const modalidades = [6, 8, 9]; // Pregão Eletrônico, Dispensa, Inexigibilidade
            for (const modalidade of modalidades) {
                await this.fetchContratacoesByModalidade(date, modalidade);
                // Rate limiting entre modalidades
                await this.delay(CONFIG.rateLimitDelay);
            }
            // Relatório final
            await this.generateReport();
        }
        catch (error) {
            this.log('ERROR', '❌ Erro crítico na execução do worker', error);
            throw error;
        }
        finally {
            await this.cleanup();
        }
    }
    /**
     * Busca contratações por modalidade e data
     */
    async fetchContratacoesByModalidade(date, modalidadeId) {
        this.log('INFO', `🔍 Buscando modalidade ${modalidadeId} para ${(0, date_fns_1.format)(date, 'yyyy-MM-dd')}`);
        let pagina = 1;
        let totalPaginas = 1;
        do {
            try {
                const response = await this.fetchPageWithRetry(date, modalidadeId, pagina);
                if (response.data && response.data.data?.length > 0) {
                    await this.processContratacoes(response.data.data);
                    totalPaginas = response.data.totalPaginas;
                    this.log('INFO', `📄 Página ${pagina}/${totalPaginas} processada - ${response.data.data.length} registros`);
                }
                else {
                    this.log('INFO', '📄 Nenhum registro encontrado para esta modalidade/data');
                    break;
                }
                pagina++;
                // Rate limiting entre páginas
                if (pagina <= totalPaginas) {
                    await this.delay(CONFIG.rateLimitDelay);
                }
            }
            catch (error) {
                this.log('ERROR', `❌ Erro ao processar página ${pagina} da modalidade ${modalidadeId}`, error);
                break;
            }
        } while (pagina <= totalPaginas);
    }
    /**
     * Faz a requisição à API com retry automático
     */
    async fetchPageWithRetry(date, modalidadeId, pagina) {
        const dateStr = (0, date_fns_1.format)(date, 'yyyyMMdd');
        const params = {
            dataInicial: dateStr,
            dataFinal: dateStr,
            codigoModalidadeContratacao: modalidadeId,
            pagina: pagina,
            tamanhoPagina: 500
        };
        let lastError;
        for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
            try {
                const response = await this.axios.get('/contratacoes/publicacao', { params });
                return response;
            }
            catch (error) {
                lastError = error;
                this.log('WARN', `⚠️ Tentativa ${attempt}/${CONFIG.maxRetries} falhou`, {
                    error: error.message,
                    status: error.response?.status
                });
                if (attempt < CONFIG.maxRetries) {
                    const delay = Math.min(CONFIG.retryDelay * Math.pow(2, attempt - 1), CONFIG.maxRetryDelay);
                    this.log('INFO', `⏳ Aguardando ${delay}ms antes da próxima tentativa`);
                    await this.delay(delay);
                }
            }
        }
        throw lastError;
    }
    /**
     * Processa um lote de contratações
     */
    async processContratacoes(contratacoes) {
        this.log('INFO', `⚙️ Processando lote de ${contratacoes.length} contratações`);
        // Processa em lotes menores para evitar sobrecarga
        const batches = this.chunkArray(contratacoes, CONFIG.batchSize);
        for (const batch of batches) {
            await Promise.all(batch.map(contratacao => this.processContratacao(contratacao)));
        }
    }
    /**
     * Processa uma única contratação (UPSERT)
     */
    async processContratacao(contratacao) {
        try {
            // Gera hash para detectar alterações
            const hash = this.generateHash(contratacao);
            // Verifica se já existe e se precisa atualizar
            const existing = await this.prisma.licitacaoPncp.findUnique({
                where: { numeroControlePncp: contratacao.numeroControlePNCP },
                select: { id: true, hashVerificacao: true }
            });
            if (existing && existing.hashVerificacao === hash) {
                this.stats.duplicatesSkipped++;
                return;
            }
            // Mapeia os dados para o formato do banco
            const mappedData = this.mapContratacaoData(contratacao, hash);
            // UPSERT no banco
            await this.prisma.licitacaoPncp.upsert({
                where: { numeroControlePncp: contratacao.numeroControlePNCP },
                update: {
                    ...mappedData,
                    statusProcessamento: 'PROCESSADO',
                    updatedAt: new Date()
                },
                create: {
                    ...mappedData,
                    statusProcessamento: 'PROCESSADO'
                }
            });
            if (existing) {
                this.stats.totalUpdated++;
                this.log('DEBUG', `🔄 Atualizada: ${contratacao.numeroControlePNCP}`);
            }
            else {
                this.stats.totalInserted++;
                this.log('DEBUG', `➕ Inserida: ${contratacao.numeroControlePNCP}`);
            }
            this.stats.totalProcessed++;
        }
        catch (error) {
            this.stats.totalErrors++;
            this.log('ERROR', `❌ Erro ao processar contratação ${contratacao.numeroControlePNCP}`, error);
            // Tenta marcar como erro no banco
            try {
                await this.prisma.licitacaoPncp.upsert({
                    where: { numeroControlePncp: contratacao.numeroControlePNCP },
                    update: {
                        statusProcessamento: 'ERRO',
                        metadataProcessamento: {
                            erro: error instanceof Error ? error.message : 'Erro desconhecido',
                            dataErro: new Date().toISOString()
                        }
                    },
                    create: {
                        numeroControlePncp: contratacao.numeroControlePNCP,
                        statusProcessamento: 'ERRO',
                        metadataProcessamento: {
                            erro: error instanceof Error ? error.message : 'Erro desconhecido',
                            dataErro: new Date().toISOString()
                        }
                    }
                });
            }
            catch (dbError) {
                this.log('ERROR', 'Erro ao marcar registro com erro no banco', dbError);
            }
        }
    }
    /**
     * Mapeia dados da API para o formato do banco
     */
    mapContratacaoData(contratacao, hash) {
        return {
            numeroControlePncp: contratacao.numeroControlePNCP,
            numeroCompra: contratacao.numeroCompra,
            anoCompra: contratacao.anoCompra,
            processo: contratacao.processo,
            sequencialCompra: contratacao.sequencialCompra,
            objetoCompra: contratacao.objetoCompra,
            informacaoComplementar: contratacao.informacaoComplementar,
            valorTotalEstimado: contratacao.valorTotalEstimado || 0,
            valorTotalHomologado: contratacao.valorTotalHomologado || 0,
            srp: contratacao.srp || false,
            tipoInstrumentoConvocatorioId: contratacao.tipoInstrumentoConvocatorioId,
            tipoInstrumentoConvocatorioNome: contratacao.tipoInstrumentoConvocatorioNome,
            modalidadeId: contratacao.modalidadeId,
            modalidadeNome: contratacao.modalidadeNome,
            modoDisputaId: contratacao.modoDisputaId,
            modoDisputaNome: contratacao.modoDisputaNome,
            situacaoCompraId: contratacao.situacaoCompraId,
            situacaoCompraNome: contratacao.situacaoCompraNome,
            amparoLegal: contratacao.amparoLegal,
            dataAberturaProposta: contratacao.dataAberturaProposta ? new Date(contratacao.dataAberturaProposta) : null,
            dataEncerramentoProposta: contratacao.dataEncerramentoProposta ? new Date(contratacao.dataEncerramentoProposta) : null,
            dataPublicacaoPncp: contratacao.dataPublicacaoPncp ? new Date(contratacao.dataPublicacaoPncp) : null,
            dataInclusaoPncp: contratacao.dataInclusao ? new Date(contratacao.dataInclusao) : null,
            dataAtualizacaoPncp: contratacao.dataAtualizacao ? new Date(contratacao.dataAtualizacao) : null,
            orgaoEntidade: contratacao.orgaoEntidade,
            unidadeOrgao: contratacao.unidadeOrgao,
            orgaoSubRogado: contratacao.orgaoSubRogado,
            unidadeSubRogada: contratacao.unidadeSubRogada,
            usuarioNome: contratacao.usuarioNome,
            linkSistemaOrigem: contratacao.linkSistemaOrigem,
            justificativaPresencial: contratacao.justificativaPresencial,
            hashVerificacao: hash,
            metadataProcessamento: {
                dataProcessamento: new Date().toISOString(),
                versaoWorker: '1.0.0',
                dadosOriginais: this.verbose ? contratacao : undefined
            }
        };
    }
    /**
     * Gera hash SHA-256 dos dados para detectar alterações
     */
    generateHash(data) {
        const jsonString = JSON.stringify(data, Object.keys(data).sort());
        return crypto.createHash('sha256').update(jsonString).digest('hex');
    }
    /**
     * Divide array em chunks menores
     */
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
    /**
     * Parse da data alvo
     */
    parseTargetDate(targetDate) {
        if (targetDate) {
            const parsed = new Date(targetDate);
            if ((0, date_fns_1.isValid)(parsed)) {
                return parsed;
            }
        }
        // Por padrão, busca o dia anterior (execução diária)
        return (0, date_fns_1.subDays)(new Date(), 1);
    }
    /**
     * Delay para rate limiting
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Gera relatório final da execução
     */
    async generateReport() {
        this.stats.endTime = perf_hooks_1.performance.now();
        const durationMs = this.stats.endTime - this.stats.startTime;
        const durationSeconds = Math.round(durationMs / 1000);
        this.log('INFO', '📊 RELATÓRIO DE EXECUÇÃO', {
            duracao: `${durationSeconds}s`,
            totalProcessado: this.stats.totalProcessed,
            totalInserido: this.stats.totalInserted,
            totalAtualizado: this.stats.totalUpdated,
            totalErros: this.stats.totalErrors,
            duplicatasIgnoradas: this.stats.duplicatesSkipped,
            chamadasApi: this.stats.apiCalls,
            performance: {
                registrosPorSegundo: Math.round(this.stats.totalProcessed / (durationMs / 1000)),
                tempoMedioPorRegistro: Math.round(durationMs / this.stats.totalProcessed)
            }
        });
        // Salva estatísticas no banco (opcional)
        try {
            await this.prisma.systemSetting.upsert({
                where: { key: 'pncp_last_execution' },
                update: {
                    value: JSON.stringify({
                        timestamp: new Date().toISOString(),
                        stats: this.stats
                    })
                },
                create: {
                    key: 'pncp_last_execution',
                    value: JSON.stringify({
                        timestamp: new Date().toISOString(),
                        stats: this.stats
                    })
                }
            });
        }
        catch (error) {
            this.log('WARN', 'Não foi possível salvar estatísticas de execução', error);
        }
    }
    /**
     * Limpeza de recursos
     */
    async cleanup() {
        try {
            await this.prisma.$disconnect();
            this.log('INFO', '✅ Worker finalizado com sucesso');
        }
        catch (error) {
            this.log('ERROR', '❌ Erro na limpeza de recursos', error);
        }
    }
}
exports.PncpDataFetcher = PncpDataFetcher;
// ============================================================================
// EXECUÇÃO PRINCIPAL
// ============================================================================
async function main() {
    // Parse dos argumentos da linha de comando
    const args = process.argv.slice(2);
    const dateArg = args.find(arg => arg.startsWith('--date='))?.split('=')[1];
    const verbose = args.includes('--verbose') || args.includes('-v');
    const help = args.includes('--help') || args.includes('-h');
    if (help) {
        console.log(`
🚀 Worker de Ingestão PNCP - Portal Nacional de Contratações Públicas

Uso:
  node fetchPncpData.ts [opções]

Opções:
  --date=YYYY-MM-DD    Data específica para buscar (padrão: ontem)
  --verbose, -v        Modo verboso com logs detalhados
  --help, -h           Mostra esta ajuda

Exemplos:
  node fetchPncpData.ts                    # Busca do dia anterior
  node fetchPncpData.ts --date=2026-09-01  # Busca de data específica
  node fetchPncpData.ts --verbose          # Modo verboso

Configuração via Cron (execução diária às 6h):
  0 6 * * * cd /opt/nexoscrm && node scripts/workers/fetchPncpData.ts
    `);
        process.exit(0);
    }
    const fetcher = new PncpDataFetcher(verbose);
    try {
        await fetcher.execute(dateArg);
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Falha na execução do worker:', error);
        process.exit(1);
    }
}
// Executa apenas se chamado diretamente
if (require.main === module) {
    main();
}
