
'use client';

import React from 'react';
import { Calculator, Loader2, Plus, Trash2, Package, Layers, Info, RefreshCw } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PricingInput, ProductItem } from '@/app/lib/pricing-engine';
import { formatCurrency } from '@/app/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


interface ProductManagerProps {
  params: PricingInput;
  upfrontItems: ProductItem[];
  recurringItems: ProductItem[];
  onParamChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onItemChange: (type: 'upfront' | 'recurring', id: string, field: keyof ProductItem, value: string | number) => void;
  onAddItem: (type: 'upfront' | 'recurring') => void;
  onRemoveItem: (type: 'upfront' | 'recurring', id: string) => void;
  onCalculate: () => void;
  isCalculating: boolean;
  onProjectBillingModeChange?: (mode: 'standard' | 'monthly') => void;
  onApplyMonthlyProration?: () => void;
}

export function ProductManager({ 
  params,
  upfrontItems, 
  recurringItems, 
  onParamChange,
  onItemChange, 
  onAddItem, 
  onRemoveItem,
  onCalculate,
  isCalculating,
  onProjectBillingModeChange,
  onApplyMonthlyProration,
}: ProductManagerProps) {
  const safeDurationMonths = Math.max(1, Number(params.durationMonths) || 1);
  const projectBillingMode = params.projectBillingMode || 'standard';
  const isProratedItem = (item: ProductItem) => String(item.description || '').toLowerCase().includes('rateado de');
  const itemsToProrate = [...upfrontItems, ...recurringItems.filter((item) => !isProratedItem(item))];
  const monthlyProrationTotal = itemsToProrate.reduce((sum, item) => (
    sum + ((Number(item.quantity) || 0) * (Number(item.unitCost) || 0) / safeDurationMonths)
  ), 0);
  
  const renderItemSection = (title: string, description: string, type: 'upfront' | 'recurring', items: ProductItem[], icon: React.ReactNode) => {
    const total = items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-xl text-slate-600">
              {icon}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{title}</h3>
              <p className="text-xs text-slate-400">{description}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Subtotal</p>
              <p className="text-sm font-bold text-slate-700">{formatCurrency(total)}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onAddItem(type)}
              className="rounded-full border-primary/20 text-primary hover:bg-primary/5 px-4"
            >
              <Plus className="w-3 h-3 mr-2" /> Adicionar Item
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 hover:border-primary/30 transition-all group">
              <div className="flex-1 min-w-0">
                <Input 
                  placeholder="Nome do item"
                  value={item.name}
                  onChange={(e) => onItemChange(type, item.id, 'name', e.target.value)}
                  className="h-9 text-sm font-semibold bg-transparent border-transparent hover:border-slate-200 focus:border-primary/30 px-2"
                />
              </div>
              <div className="w-48 min-w-0 hidden sm:block">
                <Input 
                  placeholder="Descrição"
                  value={item.description || ''}
                  onChange={(e) => onItemChange(type, item.id, 'description', e.target.value)}
                  className="h-9 text-xs text-slate-500 bg-transparent border-transparent hover:border-slate-200 focus:border-primary/30 px-2"
                />
              </div>
              <div className="w-[70px] shrink-0">
                <Input 
                  type="number"
                  value={item.quantity}
                  onChange={(e) => onItemChange(type, item.id, 'quantity', e.target.value)}
                  className="h-9 text-center text-sm bg-transparent border-transparent hover:border-slate-200 focus:border-primary/30 px-1"
                />
              </div>
              <div className="w-[110px] shrink-0">
                <Input 
                  type="number"
                  value={item.unitCost}
                  onChange={(e) => onItemChange(type, item.id, 'unitCost', e.target.value)}
                  className="h-9 text-right text-sm bg-transparent border-transparent hover:border-slate-200 focus:border-primary/30 px-2"
                />
              </div>
              <div className="w-[100px] shrink-0 text-right">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total</p>
                <p className="text-sm font-bold text-slate-800">{formatCurrency(item.quantity * item.unitCost)}</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onRemoveItem(type, item.id)}
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 p-0 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}

          {items.length === 0 && (
            <div className="col-span-full text-center py-8 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/20">
              <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-medium">Nenhum item adicionado nesta categoria</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="rounded-[2.5rem] border-slate-200 shadow-sm overflow-hidden bg-white">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle className="text-xl font-bold font-headline flex items-center">
              <Layers className="w-5 h-5 mr-3 text-primary" />
              Composição de Produtos & Serviços
            </CardTitle>
            <CardDescription className="text-sm mt-1">Gerencie detalhadamente os itens de setup e os custos recorrentes do contrato.</CardDescription>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[160px_160px_auto] gap-3 xl:min-w-[520px]">
            <div>
              <Label className="text-[10px] text-slate-400 mb-1 block uppercase tracking-widest">Duração (Meses)</Label>
              <Input
                type="number"
                name="durationMonths"
                value={params.durationMonths}
                onChange={onParamChange}
                className="h-11 text-right bg-white rounded-xl border-slate-200 font-bold"
              />
            </div>
            <div>
              <Label className="text-[10px] text-slate-400 mb-1 block uppercase tracking-widest">Markup Desejado (%)</Label>
              <Input
                type="number"
                name="markupPercentage"
                value={params.markupPercentage}
                onChange={onParamChange}
                className="h-11 text-right bg-white rounded-xl border-slate-200 font-bold text-primary"
              />
            </div>
            <Button
              onClick={onCalculate}
              disabled={isCalculating}
              className="h-11 self-end rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-md"
            >
              {isCalculating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
              {isCalculating ? 'Processando...' : 'Calcular'}
            </Button>
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Regime da Calculadora</p>
            <p className="font-semibold text-slate-800">{params.taxRegimeName || 'Configurações Gerais'}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Impostos</p>
            <p className="font-semibold text-slate-800">{params.taxRatePercentage}%</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Comissão Serviço</p>
            <p className="font-semibold text-slate-800">{params.commissionPercentage}%</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Encargos Comerciais</p>
            <p className="font-semibold text-slate-800">{params.operatingExpensePercentage || 0}%</p>
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Tipo de Projeto</p>
              <div className="mt-2 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => onProjectBillingModeChange?.('standard')}
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition ${projectBillingMode === 'standard' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Venda / Setup
                </button>
                <button
                  type="button"
                  onClick={() => onProjectBillingModeChange?.('monthly')}
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition ${projectBillingMode === 'monthly' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Projeto mensal
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:min-w-[520px]">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Rateio mensal dos produtos</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(monthlyProrationTotal)}</p>
                <p className="mt-1 text-xs text-slate-500">{itemsToProrate.length} item(ns) em {safeDurationMonths} meses</p>
              </div>
              <Button
                type="button"
                onClick={onApplyMonthlyProration}
                disabled={!onApplyMonthlyProration || itemsToProrate.length === 0}
                className="min-h-[72px] rounded-xl bg-cyan-600 text-white font-bold shadow-md hover:bg-cyan-500 disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Aplicar rateio mensal
              </Button>
            </div>
          </div>

          {projectBillingMode === 'monthly' && itemsToProrate.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
              <div className="grid min-w-[760px] grid-cols-[1fr_120px_110px_130px_140px] gap-3 bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <span>Produto</span>
                <span>Origem</span>
                <span className="text-right">Qtde</span>
                <span className="text-right">Custo Unit.</span>
                <span className="text-right">Mensal Unit.</span>
              </div>
              {itemsToProrate.map((item) => (
                <div key={item.id} className="grid min-w-[760px] grid-cols-[1fr_120px_110px_130px_140px] gap-3 border-t border-slate-100 px-4 py-3 text-sm">
                  <span className="truncate font-semibold text-slate-700">{item.name}</span>
                  <span className="text-slate-500">{upfrontItems.some((upfrontItem) => upfrontItem.id === item.id) ? 'Setup' : 'Recorrente'}</span>
                  <span className="text-right text-slate-500">{item.quantity}</span>
                  <span className="text-right text-slate-500">{formatCurrency(item.unitCost)}</span>
                  <span className="text-right font-bold text-cyan-700">{formatCurrency((Number(item.unitCost) || 0) / safeDurationMonths)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="mt-3 inline-flex items-center gap-2 text-xs text-slate-400 cursor-help">
                <Info className="w-3.5 h-3.5" />
                Tributário & Comercial vem do ícone Configurações da Calculadora.
              </p>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Impostos, comissão e encargos comerciais são lidos de Configurações Gerais e Tributárias da Calculadora.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent className="p-8 space-y-12">
        {renderItemSection(
          "Setup & Implantação (CAPEX)", 
          "Investimentos iniciais do projeto (Equipamentos, Treinamento, Onboarding)",
          "upfront", 
          upfrontItems,
          <Package size={18} />
        )}

        <div className="border-t border-slate-100 pt-10">
          {renderItemSection(
            "Custos Operacionais Mensais (OPEX)", 
            "Insumos, licenciamentos e custos que ocorrem todos os meses",
            "recurring", 
            recurringItems,
            <Layers size={18} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
