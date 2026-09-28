
'use client';

import React from 'react';
import { FileText, TrendingUp, AlertCircle, Info } from 'lucide-react';
import { formatCurrency, formatPercent } from '@/app/lib/formatters';
import { PricingOutput, FinancialStatementLine } from '@/app/lib/pricing-engine';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DREGeneratorProps {
  results: PricingOutput;
  durationMonths: number;
}

const DRELineItem = ({ data, colorClass = "text-slate-700", indent = false }: { data: FinancialStatementLine, colorClass?: string, indent?: boolean }) => {
  return (
    <div className={cn(
      "grid grid-cols-12 gap-4 py-3 border-b border-slate-50 items-center text-sm transition-colors hover:bg-slate-50/50 px-2 rounded-lg",
      data.isSubtotal && "bg-slate-50/80 border-0 my-1 font-bold"
    )}>
      <div className={cn("col-span-6 flex items-center", data.isSubtotal ? "text-slate-800" : cn("text-slate-600", indent && "pl-6"))}>
        {data.label}
        {data.isSubtotal && data.label.includes('Lucro') && (
           <TooltipProvider>
             <Tooltip>
               <TooltipTrigger asChild>
                 <Info size={12} className="ml-2 text-slate-400 cursor-help" />
               </TooltipTrigger>
               <TooltipContent>Resultado operacional após deduções de impostos e custos diretos.</TooltipContent>
             </Tooltip>
           </TooltipProvider>
        )}
      </div>
      <div className={cn("col-span-3 text-right tabular-nums", data.isSubtotal ? colorClass : "text-slate-600")}>
        {formatCurrency(data.monthlyValue)}
      </div>
      <div className={cn("col-span-3 text-right tabular-nums font-medium", data.isSubtotal ? colorClass : "text-slate-400 text-[11px]")}>
        {formatPercent(data.percentageOfRevenue)}
      </div>
    </div>
  );
};

export function DREGenerator({ results, durationMonths }: DREGeneratorProps) {
  const isHealthy = results.dre.netIncome.percentageOfRevenue >= 20;
  const isWarning = results.dre.netIncome.percentageOfRevenue < 12;

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="p-8 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 flex items-center font-headline">
            <FileText className="w-5 h-5 mr-3 text-emerald-600" />
            Demonstrativo de Resultados (DRE)
          </h2>
          <div className="flex gap-2">
            <span className={cn(
              "text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest shadow-sm",
              isHealthy ? "bg-emerald-100 text-emerald-700" : isWarning ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
            )}>
              {isHealthy ? 'Alta Performance' : isWarning ? 'Risco de Margem' : 'Viabilidade Média'}
            </span>
          </div>
        </div>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">Visão gerencial mensalizada com análise vertical (A.V.) detalhada.</p>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-12 gap-4 pb-4 border-b-2 border-slate-900 text-[10px] uppercase tracking-widest font-bold text-slate-400 px-2">
          <div className="col-span-6">Descrição da Conta</div>
          <div className="col-span-3 text-right">Mensal (R$)</div>
          <div className="col-span-3 text-right">A.V. (%)</div>
        </div>

        <div className="py-2">
          <DRELineItem data={results.dre.grossRevenue} colorClass="text-slate-900" />
          <DRELineItem data={results.dre.taxes} colorClass="text-red-500" indent />
          <DRELineItem data={results.dre.netRevenue} colorClass="text-blue-700" />
          
          <DRELineItem data={results.dre.cogs} colorClass="text-orange-500" indent />
          <DRELineItem data={results.dre.grossProfit} colorClass="text-emerald-700" />
          
          <DRELineItem data={results.dre.commissions} colorClass="text-orange-500" indent />
          <DRELineItem data={results.dre.operatingExpenses} colorClass="text-slate-400" indent />

          <DRELineItem 
            data={results.dre.netIncome} 
            colorClass={results.dre.netIncome.monthlyValue >= 0 ? "text-primary" : "text-destructive"} 
          />
        </div>
        
        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
           <div className="text-right">
             <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Lucro Total do Contrato ({durationMonths} meses)</p>
             <p className="text-3xl font-bold text-slate-900 font-headline">{formatCurrency(results.dre.netIncome.totalValue)}</p>
           </div>
        </div>
      </div>
      
      <div className={cn(
        "p-6 border-t",
        isWarning ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'
      )}>
        <div className="flex items-start">
          <div className={cn("mt-1 mr-4 shrink-0", isWarning ? 'text-red-500' : 'text-emerald-500')}>
            {isWarning ? <AlertCircle size={22} /> : <TrendingUp size={22} />}
          </div>
          <div>
            <h4 className={cn("font-bold text-sm font-headline", isWarning ? 'text-red-900' : 'text-emerald-900')}>
              Diagnóstico Financeiro: {formatPercent(results.dre.netIncome.percentageOfRevenue)} de Margem Líquida
            </h4>
            <p className={cn("text-xs mt-1 leading-relaxed font-medium", isWarning ? 'text-red-800' : 'text-emerald-800')}>
              {isWarning 
                ? "Atenção: A margem operacional está abaixo do benchmark sugerido (12%). Considere revisar o markup ou reduzir custos operacionais." 
                : "Excelente: O projeto apresenta uma margem operacional saudável e robusta para a duração do contrato."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
