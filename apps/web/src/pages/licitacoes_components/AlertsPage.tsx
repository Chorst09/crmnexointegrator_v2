import React, { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, ShieldAlert } from 'lucide-react';
import { Alerta } from './types';

// Helper para headers com autenticação
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

export function AlertsPage() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [termo, setTermo] = useState('');
  const [uf, setUf] = useState('');
  const [minValor, setMinValor] = useState('');

  useEffect(() => {
    fetchAlertas();
  }, []);

  const fetchAlertas = async () => {
    try {
      const res = await fetch('/api/b2g-licitacoes/alertas', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setAlertas(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
      setAlertas([]);
    }
  };

  const handleCreateAlerta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termo) return;
    
    setLoading(true);
    try {
      await fetch('/api/b2g-licitacoes/alertas', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          termo,
          uf,
          min_valor: parseFloat(minValor) || 0
        })
      });
      setTermo('');
      setUf('');
      setMinValor('');
      await fetchAlertas();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/b2g-licitacoes/alertas/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      await fetchAlertas();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#011116]">
      <header className="px-8 py-6 bg-[#011419] border-b border-[#07323e]">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 dark:bg-amber-950/60 p-2 rounded-lg border border-amber-200/50 dark:border-amber-800/60">
            <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Meus Alertas</h1>
            <p className="text-sm text-slate-400 mt-1">
              Cadastre Percolate Queries para ser notificado em tempo real quando novos editais baterem com seu filtro.
            </p>
          </div>
        </div>
      </header>

      <div className="p-8 flex-1 overflow-y-auto max-w-4xl">
        <div className="bg-[#011419] rounded-xl border border-[#07323e] shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-[#02181f]">
            <h2 className="font-semibold text-white">Criar Novo Alerta</h2>
          </div>
          <form onSubmit={handleCreateAlerta} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="col-span-1 md:col-span-3">
                <label className="block text-sm font-medium text-slate-200 mb-2">Termo de Busca (Objeto ou Itens)</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: notebooks, servidores, merenda..."
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Estado (UF)</label>
                <select
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  value={uf}
                  onChange={(e) => setUf(e.target.value)}
                >
                  <option value="">Qualquer Estado</option>
                  <option value="PR">Paraná (PR)</option>
                  <option value="SP">São Paulo (SP)</option>
                  <option value="DF">Distrito Federal (DF)</option>
                  <option value="SC">Santa Catarina (SC)</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-200 mb-2">Valor Mínimo (R$)</label>
                <input
                  type="number"
                  placeholder="Ex: 50000"
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  value={minValor}
                  onChange={(e) => setMinValor(e.target.value)}
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-medium rounded-lg focus:ring-4 focus:ring-cyan-500/20 transition-all disabled:opacity-70 cursor-pointer shadow-sm shadow-[#00171d]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Salvar Alerta
            </button>
          </form>
        </div>

        <div>
          <h3 className="text-lg font-bold text-white mb-4">Alertas Ativos</h3>
          {alertas.length === 0 ? (
            <div className="text-center py-12 bg-[#011419] rounded-xl border border-[#07323e] border-dashed">
              <ShieldAlert className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 font-medium">Você ainda não tem alertas cadastrados.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {alertas.map((alerta) => (
                <div key={alerta.id} className="bg-[#011419] p-5 rounded-xl border border-[#07323e] shadow-sm flex items-center justify-between group">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-lg">"{alerta.termo}"</h4>
                    <div className="flex gap-4 mt-2 text-sm text-slate-400">
                      <span className="flex items-center before:content-[''] before:w-1.5 before:h-1.5 before:bg-slate-300 dark:before:bg-slate-600 before:rounded-full before:mr-2">
                        {alerta.uf ? `Apenas ${alerta.uf}` : 'Brasil todo'}
                      </span>
                      {alerta.min_valor > 0 && (
                        <span className="flex items-center before:content-[''] before:w-1.5 before:h-1.5 before:bg-slate-300 dark:before:bg-slate-600 before:rounded-full before:mr-2">
                          Acima de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(alerta.min_valor)}
                        </span>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDelete(alerta.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                    title="Remover alerta"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
