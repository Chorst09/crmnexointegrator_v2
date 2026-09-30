/**
 * API de Busca Avançada com Filtros TI
 * Integração com o sistema existente de busca de editais
 * Mantém compatibilidade com o sistema atual (b2g-search.js)
 */

const express = require('express');
const router = express.Router();

// Importar Prisma do sistema existente
let prisma;
const initPrisma = async () => {
  if (!prisma) {
    const { prisma: p } = require('../lib/prisma.cjs');
    prisma = p;
  }
  return prisma;
};

// ============================================================================
// ENDPOINT PRINCIPAL: BUSCA COM FILTROS TI
// ============================================================================

/**
 * POST /api/filtros-ti/buscar
 * Busca editais usando sistema avançado de filtros TI
 */
router.post('/buscar', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const db = await initPrisma();
    const {
      categorias = [], // ['hardware', 'software', 'servicos']
      termoLivre = null, // campo aberto digitado pelo usuário
      uf = null,
      dataInicio = null,
      dataFim = null,
      valorMin = null,
      valorMax = null,
      pagina = 1,
      tamanhoPagina = 20,
      usuarioId = null
    } = req.body;

    // Validações
    if (tamanhoPagina > 100) {
      return res.status(400).json({
        success: false,
        error: 'Tamanho da página não pode exceder 100 itens',
        codigo: 'LIMITE_PAGINA_EXCEDIDO'
      });
    }

    const offset = (pagina - 1) * tamanhoPagina;

    // Executar busca usando a função SQL otimizada
    const resultados = await db.$queryRaw`
      SELECT * FROM buscar_editais_com_filtros_ti(
        ${categorias}::text[],
        ${termoLivre},
        ${uf},
        ${dataInicio ? new Date(dataInicio) : null},
        ${dataFim ? new Date(dataFim) : null},
        ${valorMin ? parseFloat(valorMin) : null},
        ${valorMax ? parseFloat(valorMax) : null},
        ${tamanhoPagina},
        ${offset},
        ${usuarioId}
      )
    `;

    // Buscar estatísticas adicionais
    const [estatisticas] = await db.$queryRaw`
      SELECT 
        COUNT(*) as total_sistema,
        COUNT(*) FILTER (WHERE data_encerramento_proposta > CURRENT_TIMESTAMP) as vigentes,
        AVG(valor_total_estimado) as valor_medio,
        MAX(valor_total_estimado) as maior_valor,
        COUNT(DISTINCT (unidade_orgao->>'ufSigla')) as estados_envolvidos
      FROM licitacoes_pncp 
      WHERE status_processamento = 'PROCESSADO'
    `;

    // Buscar categorias disponíveis com contadores
    const categoriasDisponiveis = await db.$queryRaw`
      SELECT 
        c.codigo,
        c.nome,
        c.descricao,
        c.cor_categoria,
        c.icone,
        COUNT(p.id) as quantidade_palavras,
        c.ordem_exibicao
      FROM categorias_filtro_ti c
      LEFT JOIN palavras_chave_ti p ON p.categoria_id = c.id AND p.ativo = true
      WHERE c.ativo = true
      GROUP BY c.id, c.codigo, c.nome, c.descricao, c.cor_categoria, c.icone, c.ordem_exibicao
      ORDER BY c.ordem_exibicao
    `;

    // Formatação da resposta seguindo o padrão do sistema existente
    const response = {
      success: true,
      data: {
        // Resultados principais
        editais: resultados.map(edital => ({
          id: edital.id,
          numeroControlePncp: edital.numero_controle_pncp,
          titulo: edital.objeto_compra,
          objeto: edital.objeto_compra,
          valor: {
            estimado: parseFloat(edital.valor_total_estimado || 0),
            formatado: formatCurrency(edital.valor_total_estimado)
          },
          modalidade: {
            nome: edital.modalidade_nome
          },
          situacao: {
            nome: edital.situacao_compra_nome
          },
          orgao: {
            nome: edital.orgao_nome,
            uf: edital.uf_sigla
          },
          datas: {
            aberturaProposta: edital.data_abertura_proposta,
            encerramentoProposta: edital.data_encerramento_proposta,
            aberturaPropostaFormatada: formatDate(edital.data_abertura_proposta),
            encerramentoPropostaFormatada: formatDate(edital.data_encerramento_proposta)
          },
          relevancia: {
            score: parseFloat(edital.score_relevancia || 0),
            termosEncontrados: edital.termos_encontrados || []
          },
          fonte: edital.fonte_dados || 'PNCP_API',
          vigente: edital.data_encerramento_proposta ? 
            new Date(edital.data_encerramento_proposta) > new Date() : false
        })),

        // Metadados da busca
        meta: {
          paginacao: {
            pagina: pagina,
            tamanhoPagina: tamanhoPagina,
            total: resultados.length,
            temProximaPagina: resultados.length === tamanhoPagina
          },
          filtrosAplicados: {
            categorias: categorias,
            termoLivre: termoLivre,
            uf: uf,
            periodo: {
              dataInicio: dataInicio,
              dataFim: dataFim
            },
            faixaValor: {
              valorMin: valorMin,
              valorMax: valorMax
            }
          },
          performance: {
            tempoExecucaoMs: Date.now() - startTime,
            timestampBusca: new Date().toISOString()
          }
        },

        // Estatísticas do sistema
        estatisticas: {
          totalEditais: parseInt(estatisticas.total_sistema || 0),
          editaisVigentes: parseInt(estatisticas.vigentes || 0),
          valorMedio: parseFloat(estatisticas.valor_medio || 0),
          maiorValor: parseFloat(estatisticas.maior_valor || 0),
          estadosEnvolvidos: parseInt(estatisticas.estados_envolvidos || 0)
        },

        // Categorias disponíveis para filtros
        categoriasDisponiveis: categoriasDisponiveis.map(cat => ({
          codigo: cat.codigo,
          nome: cat.nome,
          descricao: cat.descricao,
          cor: cat.cor_categoria,
          icone: cat.icone,
          quantidadePalavras: parseInt(cat.quantidade_palavras || 0),
          ordem: cat.ordem_exibicao
        }))
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Erro na busca com filtros TI:', error);
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor na busca com filtros TI',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      codigo: 'ERRO_BUSCA_FILTROS_TI',
      performance: {
        tempoExecucaoMs: Date.now() - startTime
      }
    });
  }
});

// ============================================================================
// ENDPOINT: LISTAR CATEGORIAS DISPONÍVEIS
// ============================================================================

/**
 * GET /api/filtros-ti/categorias
 * Retorna todas as categorias de filtros TI com suas palavras-chave
 */
router.get('/categorias', async (req, res) => {
  try {
    const db = await initPrisma();
    
    const categorias = await db.$queryRaw`
      SELECT 
        c.*,
        json_agg(
          json_build_object(
            'palavra', p.palavra_principal,
            'sinonimos', p.sinonimos,
            'peso', p.peso_relevancia
          ) ORDER BY p.peso_relevancia DESC
        ) FILTER (WHERE p.id IS NOT NULL) as palavras_chave
      FROM categorias_filtro_ti c
      LEFT JOIN palavras_chave_ti p ON p.categoria_id = c.id AND p.ativo = true
      WHERE c.ativo = true
      GROUP BY c.id
      ORDER BY c.ordem_exibicao
    `;

    res.json({
      success: true,
      data: {
        categorias: categorias.map(cat => ({
          codigo: cat.codigo,
          nome: cat.nome,
          descricao: cat.descricao,
          cor: cat.cor_categoria,
          icone: cat.icone,
          ordem: cat.ordem_exibicao,
          palavrasChave: cat.palavras_chave || [],
          estatisticas: {
            totalPalavras: (cat.palavras_chave || []).length,
            criadaEm: cat.created_at,
            atualizadaEm: cat.updated_at
          }
        }))
      }
    });

  } catch (error) {
    console.error('Erro ao buscar categorias:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar categorias de filtros TI'
    });
  }
});

// ============================================================================
// ENDPOINT: ADICIONAR PALAVRA-CHAVE CUSTOMIZADA
// ============================================================================

/**
 * POST /api/filtros-ti/palavra-customizada
 * Permite usuários adicionarem palavras-chave personalizadas
 */
router.post('/palavra-customizada', async (req, res) => {
  try {
    const {
      palavra,
      sinonimos = [],
      categoriaId = null,
      descricao = null,
      usoPublico = false,
      tags = []
    } = req.body;

    // Validações
    if (!palavra || palavra.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Palavra deve ter pelo menos 2 caracteres',
        codigo: 'PALAVRA_INVALIDA'
      });
    }

    const usuarioId = req.user?.id; // vem do middleware de autenticação

    const novaPalavra = await (await initPrisma()).$queryRaw`
      INSERT INTO palavras_chave_customizadas (
        usuario_id,
        categoria_id,
        palavra_customizada,
        sinonimos_customizados,
        descricao,
        uso_publico,
        tags
      ) VALUES (
        ${usuarioId},
        ${categoriaId},
        ${palavra},
        ${sinonimos},
        ${descricao},
        ${usoPublico},
        ${tags}
      ) RETURNING *
    `;

    // Refresh da view consolidada
    await db.$queryRaw`SELECT refresh_palavras_chave_consolidadas()`;

    res.json({
      success: true,
      data: {
        palavra: {
          id: novaPalavra[0].id,
          palavra: novaPalavra[0].palavra_customizada,
          sinonimos: novaPalavra[0].sinonimos_customizados,
          criadaEm: novaPalavra[0].created_at
        }
      },
      message: 'Palavra-chave customizada adicionada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao adicionar palavra customizada:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao adicionar palavra-chave customizada'
    });
  }
});

// ============================================================================
// UTILITÁRIOS
// ============================================================================

function formatCurrency(value) {
  if (!value || isNaN(value)) return 'Não informado';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

function formatDate(dateString) {
  if (!dateString) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(dateString));
}

module.exports = router;