import React, { useState, useEffect } from 'react';
import { Briefcase, Search, ExternalLink, Calendar, MapPin, Building2, Clock, Trash2, CheckCircle2 } from 'lucide-react';
import { Licitacao } from './types';
import { cn } from './utils';

interface ManagedLicitacao extends Licitacao {
  _managedId: string;
  addedAt: string;
  statusFase: 'Análise' | 'Preparação' | 'Proposta Enviada' | 'Ganha' | 'Perdida';
}

// Helper para headers com autenticação
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

export function GerenciadasPage() {
  const [gerenciadas, setGerenciadas] = useState<ManagedLicitacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGerenciadas();
  }, []);

  const fetchGerenciadas = async () => {
    try {
      const res = await fetch(`/api/b2g-licitacoes/gerenciadas?t=${Date.now()}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        // Garante que sempre seja um array
        setGerenciadas(Array.isArray(data) ? data : []);
      } else {
        console.error('Erro ao buscar gerenciadas:', res.status);
        setGerenciadas([]);
      }
    } catch (err) {
      console.error('Erro ao buscar gerenciadas:', err);
      setGerenciadas([]);
    } finally {
      setLoading(false);
    }
  };

  const removeGerenciada = async (id: string) => {
    try {
      const res = await fetch(`/api/b2g-licitacoes/gerenciadas/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setGerenciadas(prev => prev.filter(g => g._managedId !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateStatus = async (id: string, novoStatus: string) => {
    try {
      const res = await fetch(`/api/b2g-licitacoes/gerenciadas/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ statusFase: novoStatus })
      });
      if (res.ok) {
        const updated = await res.json();
        setGerenciadas(prev => prev.map(g => g._managedId === id ? updated : g));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fases = ['Análise', 'Preparação', 'Proposta Enviada', 'Ganha', 'Perdida'];

  return (
    <div className="flex flex-col h-full bg-[#011116]">
      <header className="px-8 py-6 bg-[#011419] border-b border-[#07323e]">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-cyan-600 dark:text-cyan-400" /> Licitações Gerenciadas
            </h2>
            <p className="text-slate-400 mt-1">Acompanhe e gerencie as licitações selecionadas para participação do seu time.</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            </div>
          ) : gerenciadas.length === 0 ? (
            <div className="text-center py-20 bg-[#011419] rounded-xl border border-[#07323e] shadow-sm">
              <div className="bg-slate-100 dark:bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Briefcase className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">Nenhuma licitação gerenciada</h3>
              <p className="text-slate-400 max-w-sm mx-auto">
                Você ainda não adicionou nenhuma licitação à sua lista de gerenciamento.
                Vá para a busca e adicione oportunidades promissoras.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {gerenciadas.map((lic) => {
                const orgao = lic.orgao || lic.orgaoEntidade?.razaoSocial || 'Órgão não especificado';
                const modalidade = lic.modalidade || lic.modalidadeNome || 'Modalidade Indefinida';
                const objeto = lic.objeto_resumo || lic.objetoCompra || 'Sem descrição';
                const valor = lic.valor_estimado || lic.valorTotalEstimado || 0;
                
                return (
                  <div key={lic._managedId} className="bg-[#011419] rounded-xl border border-[#07323e] shadow-sm overflow-hidden flex flex-col sm:flex-row">
                    <div className="p-6 flex-1 border-r border-slate-100 dark:border-slate-800/80">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-md border border-blue-100 dark:border-blue-800">
                              {modalidade}
                            </span>
                            {(lic.numeroCompra || lic.numeroControlePNCP) && (
                              <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-md border border-slate-200/50 dark:border-slate-700/60">
                                Nº {lic.numeroCompra || lic.numeroControlePNCP}
                              </span>
                            )}
                          </div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 line-clamp-2 mt-1">
                            {objeto}
                          </h3>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                        <div>
                          <p className="text-xs text-slate-400 font-medium mb-1 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5"/> Órgão</p>
                          <p className="text-sm text-slate-900 dark:text-slate-200 font-medium truncate" title={orgao}>{orgao}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-medium mb-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/> Local</p>
                          <p className="text-sm text-slate-900 dark:text-slate-200 font-medium">{lic.cidade || lic.unidadeOrgao?.municipioNome || '-'}, {lic.uf || lic.unidadeOrgao?.ufSigla || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-medium mb-1 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> Data Final</p>
                          <p className="text-sm text-slate-900 dark:text-slate-200 font-medium">
                            {lic.dataEncerramentoProposta ? new Date(lic.dataEncerramentoProposta).toLocaleDateString('pt-BR') : 'Não definida'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-medium mb-1">Valor Estimado</p>
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="w-full sm:w-64 bg-[#011116]/60 p-6 flex flex-col justify-between border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Fase Atual</p>
                        <select
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                          value={lic.statusFase}
                          onChange={(e) => updateStatus(lic._managedId, e.target.value)}
                        >
                          {fases.map(fase => (
                            <option key={fase} value={fase} className="dark:bg-slate-800 dark:text-white">{fase}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <button 
                          className="w-full px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                          onClick={() => {
                            if (lic.linkSistemaOrigem || lic.linkProcessoEletronico) {
                              window.open(lic.linkSistemaOrigem || lic.linkProcessoEletronico, '_blank');
                            }
                          }}
                          disabled={!lic.linkSistemaOrigem && !lic.linkProcessoEletronico}
                        >
                          <ExternalLink className="w-4 h-4" />
                          Acessar Portal
                        </button>
                        <button 
                          onClick={() => removeGerenciada(lic._managedId)}
                          className="w-full px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
