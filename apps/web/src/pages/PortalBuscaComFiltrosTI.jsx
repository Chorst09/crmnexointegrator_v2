import React, { useState, useCallback } from 'react';
import { Search, Filter, Download, Eye } from 'lucide-react';
import FiltrosTIAvancados from '../components/FiltrosTIAvancados';

/**
 * Exemplo de integração dos Filtros TI com o Portal de Busca existente
 * Mantém compatibilidade com o sistema atual
 */
const PortalBuscaComFiltrosTI = () => {
  // Estados existentes do portal (mantidos para compatibilidade)
  const [busca, setBusca] = useState({
    objeto: '',
    uf: '',
    dataInicio: '',
    dataFim: '',
    valorMin: '',
    valorMax: '',
    // Novos campos para filtros TI
    filtrosTI: {
      categoriasSelecionadas: [],
      termosCustomizados: [],
      termoLivre: ''
    }
  });

  const [resultados, setResultados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [totalResultados, setTotalResultados] = useState(0);
  const [mostrarFiltrosTI, setMostrarFiltrosTI] = useState(false);

  // Handler para mudanças nos filtros TI
  const handleFiltrosTIChange = useCallback((novosFiltros) => {
    setBusca(prev => ({
      ...prev,
      filtrosTI: novosFiltros
    }));
  }, []);

  // Função de busca integrada (combina sistema atual + filtros TI)
  const executarBusca = async () => {
    setCarregando(true);
    
    try {
      let endpoint = '/api/b2g-search'; // endpoint atual
      let parametros = {
        objeto: busca.objeto,
        uf: busca.uf,
        dataInicio: busca.dataInicio,
        dataFim: busca.dataFim,
        valorMin: busca.valorMin,
        valorMax: busca.valorMax
      };

      // Se há filtros TI ativos, usar o novo endpoint
      if (busca.filtrosTI.temFiltros) {
        endpoint = '/api/filtros-ti/buscar';
        parametros = {
          ...parametros,
          categorias: busca.filtrosTI.categoriasSelecionadas,
          termoLivre: busca.filtrosTI.termoLivre || busca.objeto,
          termosCustomizados: busca.filtrosTI.termosCustomizados
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(parametros)
      });

      const data = await response.json();

      if (data.success) {
        if (data.data.editais) {
          // Resposta do novo sistema de filtros TI
          setResultados(data.data.editais);
          setTotalResultados(data.data.meta?.paginacao?.total || data.data.editais.length);
        } else {
          // Resposta do sistema atual (manter compatibilidade)
          setResultados(data.resultados || []);
          setTotalResultados(data.total || 0);
        }
      }
    } catch (error) {
      console.error('Erro na busca:', error);
      // Fallback para o sistema atual em caso de erro
      try {
        await executarBuscaTradicional();
      } catch (fallbackError) {
        console.error('Erro no fallback:', fallbackError);
      }
    } finally {
      setCarregando(false);
    }
  };

  // Busca tradicional (fallback)
  const executarBuscaTradicional = async () => {
    const response = await fetch('/api/b2g-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        objeto: busca.objeto,
        uf: busca.uf,
        dataInicio: busca.dataInicio,
        dataFim: busca.dataFim
      })
    });

    const data = await response.json();
    if (data.success) {
      setResultados(data.resultados || []);
      setTotalResultados(data.total || 0);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Portal de Busca B2G
          </h1>
          <button
            onClick={() => setMostrarFiltrosTI(!mostrarFiltrosTI)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              mostrarFiltrosTI || busca.filtrosTI.temFiltros
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros TI Avançados
            {busca.filtrosTI.temFiltros && (
              <span className="bg-white text-blue-600 text-xs px-2 py-1 rounded-full">
                Ativo
              </span>
            )}
          </button>
        </div>

        {/* Busca tradicional (mantida) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <input
            type="text"
            placeholder="Objeto da licitação"
            value={busca.objeto}
            onChange={(e) => setBusca(prev => ({ ...prev, objeto: e.target.value }))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
          />
          
          <select
            value={busca.uf}
            onChange={(e) => setBusca(prev => ({ ...prev, uf: e.target.value }))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
          >
            <option value="">Todos os Estados</option>
            <option value="SP">São Paulo</option>
            <option value="RJ">Rio de Janeiro</option>
            <option value="MG">Minas Gerais</option>
            {/* Adicionar outros estados */}
          </select>

          <input
            type="date"
            value={busca.dataInicio}
            onChange={(e) => setBusca(prev => ({ ...prev, dataInicio: e.target.value }))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
          />

          <button
            onClick={executarBusca}
            disabled={carregando}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {carregando ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Buscando...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Buscar
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filtros TI Avançados (novo) */}
      {mostrarFiltrosTI && (
        <FiltrosTIAvancados
          onFiltrosChange={handleFiltrosTIChange}
          filtrosAtivos={busca.filtrosTI}
          carregando={carregando}
        />
      )}

      {/* Resultados */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        {/* Header dos resultados */}
        <div className="p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Resultados da Busca
              {totalResultados > 0 && (
                <span className="ml-2 text-sm text-gray-500">
                  ({totalResultados} {totalResultados === 1 ? 'resultado' : 'resultados'})
                </span>
              )}
            </h2>
            
            {resultados.length > 0 && (
              <button className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                <Download className="w-4 h-4" />
                Exportar
              </button>
            )}
          </div>
        </div>

        {/* Lista de resultados */}
        <div className="divide-y divide-gray-200 dark:divide-slate-700">
          {resultados.length === 0 && !carregando && (
            <div className="p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                Nenhum resultado encontrado. Tente ajustar os filtros de busca.
              </p>
            </div>
          )}

          {resultados.map((edital, index) => (
            <div key={edital.id || index} className="p-6 hover:bg-gray-50 dark:hover:bg-slate-750">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {edital.titulo || edital.objeto || edital.objeto_compra}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <div>
                      <span className="font-medium">Órgão:</span>
                      <p>{edital.orgao?.nome || edital.orgao_nome || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="font-medium">Modalidade:</span>
                      <p>{edital.modalidade?.nome || edital.modalidade_nome || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="font-medium">Valor:</span>
                      <p>{edital.valor?.formatado || formatCurrency(edital.valor_total_estimado) || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="font-medium">Encerramento:</span>
                      <p>{edital.datas?.encerramentoPropostaFormatada || formatDate(edital.data_encerramento_proposta) || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Score de relevância (apenas para resultados com filtros TI) */}
                  {edital.relevancia?.score && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Relevância:</span>
                        <div className="bg-gray-200 dark:bg-slate-600 rounded-full h-2 w-20">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${Math.min(edital.relevancia.score / 2, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{Math.round(edital.relevancia.score)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button className="p-2 text-gray-400 hover:text-blue-600 rounded-lg">
                    <Eye className="w-4 h-4" />
                  </button>
                  {edital.vigente && (
                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                      Vigente
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Utilitários (podem ser movidos para um arquivo separado)
const formatCurrency = (value) => {
  if (!value || isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(dateString));
};

export default PortalBuscaComFiltrosTI;