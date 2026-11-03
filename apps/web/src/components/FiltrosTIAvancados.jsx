import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, X, Cpu, HardDrive, 
  Settings, Server, Zap, ChevronDown, ChevronRight 
} from 'lucide-react';

/**
 * Componente de Filtros Avançados de TI
 * Integração com o sistema de busca existente do Portal B2G
 */
const FiltrosTIAvancados = ({ 
  categoriasSelecionadas = [], 
  termoLivre = '',
  ativo = false,
  onFiltrosChange,
  carregando = false 
}) => {
  // Estados
  const [categorias, setCategorias] = useState([]);
  const [categoriasExpandidas, setCategoriasExpandidas] = useState({});

  // Mapa de ícones por categoria
  const iconesCategoria = {
    'termos_gerais': Cpu,
    'hardware': HardDrive,
    'software': Settings,
    'servicos': Zap,
    'infraestrutura': Server
  };

  // Carregar categorias disponíveis
  useEffect(() => {
    carregarCategorias();
  }, []);

  const carregarCategorias = async () => {
    try {
      const response = await fetch('/api/filtros-ti/categorias');
      const data = await response.json();
      
      if (data.success) {
        setCategorias(data.data.categorias);
        // Expandir primeira categoria por padrão
        if (data.data.categorias.length > 0) {
          setCategoriasExpandidas({ [data.data.categorias[0].codigo]: true });
        }
      }
    } catch (error) {
      console.error('Erro ao carregar categorias TI:', error);
    }
  };

  // Toggle expansão de categoria
  const toggleCategoria = (codigoCategoria) => {
    setCategoriasExpandidas(prev => ({
      ...prev,
      [codigoCategoria]: !prev[codigoCategoria]
    }));
  };

  // Selecionar/deselecionar categoria
  const toggleSelecaoCategoria = (codigoCategoria) => {
    const novaSelecao = categoriasSelecionadas.includes(codigoCategoria)
      ? categoriasSelecionadas.filter(c => c !== codigoCategoria)
      : [...categoriasSelecionadas, codigoCategoria];
    
    onFiltrosChange({
      categoriasSelecionadas: novaSelecao,
      termoLivre,
      ativo
    });
  };

  // Alterar termo livre
  const handleTermoLivreChange = (valor) => {
    onFiltrosChange({
      categoriasSelecionadas,
      termoLivre: valor,
      ativo
    });
  };

  // Toggle ativo/inativo
  const handleToggleAtivo = () => {
    onFiltrosChange({
      categoriasSelecionadas,
      termoLivre,
      ativo: !ativo
    });
  };

  // Limpar todos os filtros
  const limparFiltros = () => {
    onFiltrosChange({
      categoriasSelecionadas: [],
      termoLivre: '',
      ativo: false
    });
  };

  const totalFiltrosAtivos = categoriasSelecionadas.length + (termoLivre.trim() ? 1 : 0);

  return (
    <div className="bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] rounded-lg border border-[var(--crm-border)] dark:border-[var(--crm-border)] p-4 space-y-4">
      {/* Header com Toggle Principal */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
            Filtros Avançados de TI
          </h3>
          {totalFiltrosAtivos > 0 && (
            <span className="bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-xs font-medium px-2 py-1 rounded-full">
              {totalFiltrosAtivos} filtro{totalFiltrosAtivos !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {/* Toggle Principal - AQUI ESTÁ O TOGGLE! */}
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${ativo ? 'text-green-600' : "text-[rgb(var(--crm-muted-rgb)_/_1)]"}`}>
              {ativo ? 'Ativo' : 'Inativo'}
            </span>
            <button
              onClick={handleToggleAtivo}
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                ${ativo 
                  ? 'bg-green-600' 
                  : "bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)]"
                }
              `}
            >
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                  ${ativo ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          </div>
          
          {totalFiltrosAtivos > 0 && (
            <button
              onClick={limparFiltros}
              className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-red-600 flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Campo de busca livre */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
          Palavra-chave personalizada (opcional)
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[rgb(var(--crm-muted-rgb)_/_1)]" />
          <input
            type="text"
            value={termoLivre}
            onChange={(e) => handleTermoLivreChange(e.target.value)}
            placeholder="Digite sua palavra-chave personalizada..."
            className="w-full pl-10 pr-4 py-2 border border-[var(--crm-border)] dark:border-[var(--crm-border)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]"
          />
        </div>
        {termoLivre && (
          <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">
            Exemplo: sistema busca por "{termoLivre}" e variações relacionadas
          </p>
        )}
      </div>

      {/* Categorias TI */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
          Categorias de Produtos TI
        </h4>
        
        {categorias.length === 0 ? (
          <div className="text-center py-4 text-[rgb(var(--crm-muted-rgb)_/_1)]">
            Carregando categorias...
          </div>
        ) : (
          <div className="space-y-2">
            {categorias.map((categoria) => {
              const IconeCategoria = iconesCategoria[categoria.codigo] || Cpu;
              const expandida = categoriasExpandidas[categoria.codigo];
              const selecionada = categoriasSelecionadas.includes(categoria.codigo);
              
              return (
                <div key={categoria.codigo} className="border border-[var(--crm-border)] dark:border-[var(--crm-border)] rounded-lg">
                  {/* Header da categoria */}
                  <div className="flex items-center justify-between p-3 bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] rounded-t-lg">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selecionada}
                        onChange={() => toggleSelecaoCategoria(categoria.codigo)}
                        className="rounded border-[var(--crm-border)] text-blue-600 focus:ring-blue-500"
                      />
                      <IconeCategoria 
                        className={`w-5 h-5 ${selecionada ? 'text-blue-600' : "text-[rgb(var(--crm-muted-rgb)_/_1)]"}`}
                      />
                      <div>
                        <h5 className={`font-medium ${selecionada ? 'text-blue-900 dark:text-blue-300' : "text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]"}`}>
                          {categoria.nome}
                        </h5>
                        <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">
                          {categoria.palavrasChave?.length || 0} palavras-chave
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleCategoria(categoria.codigo)}
                      className="text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[rgb(var(--crm-muted-rgb)_/_1)] dark:hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
                    >
                      {expandida ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Lista de palavras-chave */}
                  {expandida && categoria.palavrasChave && (
                    <div className="p-3 border-t border-[var(--crm-border)] dark:border-[var(--crm-border)]">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {categoria.palavrasChave.slice(0, 6).map((palavra, index) => (
                          <div key={index} className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] px-2 py-1 rounded">
                            {palavra.palavra}
                          </div>
                        ))}
                        {categoria.palavrasChave.length > 6 && (
                          <div className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] italic">
                            +{categoria.palavrasChave.length - 6} mais...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Status dos filtros */}
      {(categoriasSelecionadas.length > 0 || termoLivre) && (
        <div className="pt-3 border-t border-[var(--crm-border)] dark:border-[var(--crm-border)]">
          <div className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] space-y-1">
            {categoriasSelecionadas.length > 0 && (
              <div>
                <strong>Categorias:</strong> {categoriasSelecionadas.join(', ')}
              </div>
            )}
            {termoLivre && (
              <div>
                <strong>Termo livre:</strong> "{termoLivre}"
              </div>
            )}
            <div className={`font-medium ${ativo ? 'text-green-600' : 'text-orange-600'}`}>
              Status: {ativo ? 'Filtros ativados - busca ativa' : 'Filtros configurados - clique no toggle para ativar'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FiltrosTIAvancados;