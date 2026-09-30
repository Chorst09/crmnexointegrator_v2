import React, { useState, useEffect } from 'react';
import { X, Check, Trash2, Calculator, AlertCircle, Sparkles } from 'lucide-react';
import { MatrizItemAnalise } from './types';

interface EditarItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MatrizItemAnalise | null;
  onSave: (itemAtualizado: MatrizItemAnalise) => void;
  onDelete?: (itemNumero: number) => void;
  isNovo?: boolean;
}

const UNIDADES_COMUNS = ['UN', 'MÊS', 'LINK', 'TB', 'GB', 'HORAS', 'POSTO', 'SERV', 'LOTE', 'PACOTE', 'KG'];

export const EditarItemModal: React.FC<EditarItemModalProps> = ({
  isOpen,
  onClose,
  item,
  onSave,
  onDelete,
  isNovo = false
}) => {
  const [itemNumero, setItemNumero] = useState<number>(1);
  const [codigoCatalogo, setCodigoCatalogo] = useState<string>('');
  const [especificacao, setEspecificacao] = useState<string>('');
  const [unidade, setUnidade] = useState<string>('UN');
  const [quantitativo, setQuantitativo] = useState<number>(1);
  const [valorUnitario, setValorUnitario] = useState<number>(0);
  const [valorTotal, setValorTotal] = useState<number>(0);
  const [modoCalculo, setModoCalculo] = useState<'unitario_determina_total' | 'total_determina_unitario'>('unitario_determina_total');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setItemNumero(item.item_numero || 1);
      setCodigoCatalogo(item.codigo_catalogo || '');
      setEspecificacao(item.especificacao_sucinta || '');
      setUnidade(item.unidade || 'UN');
      setQuantitativo(item.quantitativo || 1);
      setValorUnitario(item.valor_estimado_unitario || 0);
      setValorTotal(item.valor_estimado_total || (item.valor_estimado_unitario || 0) * (item.quantitativo || 1));
      setErro(null);
    }
  }, [item, isOpen]);

  if (!isOpen) return null;

  const handleQtdChange = (novaQtd: number) => {
    const q = Math.max(1, novaQtd);
    setQuantitativo(q);
    if (modoCalculo === 'unitario_determina_total') {
      setValorTotal(Number((q * valorUnitario).toFixed(2)));
    } else {
      if (q > 0) setValorUnitario(Number((valorTotal / q).toFixed(2)));
    }
  };

  const handleUnitarioChange = (novoUnitario: number) => {
    const val = Math.max(0, novoUnitario);
    setValorUnitario(val);
    setModoCalculo('unitario_determina_total');
    setValorTotal(Number((quantitativo * val).toFixed(2)));
  };

  const handleTotalChange = (novoTotal: number) => {
    const val = Math.max(0, novoTotal);
    setValorTotal(val);
    setModoCalculo('total_determina_unitario');
    if (quantitativo > 0) {
      setValorUnitario(Number((val / quantitativo).toFixed(2)));
    }
  };

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!especificacao.trim()) {
      setErro('A especificação sucinta do item é obrigatória.');
      return;
    }
    if (quantitativo <= 0) {
      setErro('O quantitativo deve ser maior que zero.');
      return;
    }

    const itemSalvo: MatrizItemAnalise = {
      item_numero: itemNumero,
      codigo_catalogo: codigoCatalogo.trim() || undefined,
      especificacao_sucinta: especificacao.trim(),
      unidade: unidade.trim() || 'UN',
      quantitativo: quantitativo,
      valor_estimado_unitario: valorUnitario,
      valor_estimado_total: valorTotal
    };

    onSave(itemSalvo);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-[#011419] w-full max-w-2xl rounded-2xl shadow-2xl border border-[#07323e] overflow-hidden flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="bg-slate-900 dark:bg-slate-950 px-6 py-4 flex items-center justify-between text-white border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-600 text-white">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide">
                {isNovo ? 'Adicionar Item à Matriz do TR' : `Editar Item ${itemNumero} da Matriz do TR`}
              </h2>
              <p className="text-xs text-slate-400">
                Ajuste especificações, quantitativos e valores antes de salvar a Ficha Técnica
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSalvar} className="p-6 overflow-y-auto space-y-4 flex-1">
          {erro && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Item Número */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 uppercase tracking-wider mb-1.5">
                Nº do Item
              </label>
              <input
                type="number"
                min="1"
                value={itemNumero}
                onChange={(e) => setItemNumero(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Código / CATMAT / CATSER */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-200 uppercase tracking-wider mb-1.5">
                Código de Catálogo (CATMAT / CATSER / ID)
              </label>
              <input
                type="text"
                value={codigoCatalogo}
                onChange={(e) => setCodigoCatalogo(e.target.value)}
                placeholder="Ex: CATSER-21123, CATMAT-452109..."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm font-mono text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Especificação Sucinta */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 uppercase tracking-wider mb-1.5">
              Especificação Sucinta / Descrição do Objeto
            </label>
            <textarea
              rows={3}
              value={especificacao}
              onChange={(e) => {
                setEspecificacao(e.target.value);
                if (erro) setErro(null);
              }}
              placeholder="Descreva o serviço, produto ou fornecimento conforme o Termo de Referência..."
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 resize-y leading-relaxed"
              required
            />
          </div>

          {/* Unidade & Quantitativo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-200 uppercase tracking-wider mb-1.5">
                Unidade de Medida
              </label>
              <input
                type="text"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value.toUpperCase())}
                placeholder="UN, MÊS, LINK..."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm font-semibold uppercase text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                required
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {UNIDADES_COMUNS.slice(0, 6).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnidade(u)}
                    className={`px-1.5 py-0.5 text-[10px] rounded font-medium transition-colors cursor-pointer ${
                      unidade === u 
                        ? 'bg-blue-600 text-white font-bold' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 uppercase tracking-wider mb-1.5">
                Quantitativo
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={quantitativo}
                onChange={(e) => handleQtdChange(parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 uppercase tracking-wider mb-1.5">
                Valor Unitário Estimado (R$)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={valorUnitario}
                onChange={(e) => handleUnitarioChange(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Valor Total & Banner de Cálculo */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 uppercase tracking-wider mb-1.5">
              Valor Total Estimado do Item (R$)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.01"
                value={valorTotal}
                onChange={(e) => handleTotalChange(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-950/40 rounded-xl text-sm font-bold text-blue-900 dark:text-blue-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Banner Resumo do Cálculo em Tempo Real */}
          <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between text-xs text-blue-900 dark:text-blue-200">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span>
                Cálculo: <strong>{quantitativo} {unidade}</strong> × <strong>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorUnitario)}
                </strong>
              </span>
            </div>
            <span className="font-bold text-sm text-blue-950 dark:text-blue-100">
              = {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal)}
            </span>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-[#07323e] flex items-center justify-between">
            {!isNovo && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Tem certeza que deseja excluir o item ${itemNumero}?`)) {
                    onDelete(itemNumero);
                    onClose();
                  }
                }}
                className="px-3 py-2 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir Item</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Salvar Item</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
