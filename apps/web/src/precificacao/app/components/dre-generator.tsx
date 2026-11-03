
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

const DRELineItem = ({ data, colorClass = "text-[rgb(var(--crm-ink-rgb)_/_1)]", indent = false }: { data: FinancialStatementLine, colorClass?: string, indent?: boolean }) => {
  return (
    <div className={cn(
      "grid grid-cols-12 gap-4 py-3 border-b border-[var(--crm-border)] items-center text-sm transition-colors hover:bg-[rgb(var(--crm-surface-rgb)_/_0.5)] px-2 rounded-lg",
      data.isSubtotal && "bg-[rgb(var(--crm-surface-rgb)_/_0.8)] border-0 my-1 font-bold"
    )}>
      <div className={cn("col-span-6 flex items-center", data.isSubtotal ? "text-[rgb(var(--crm-ink-rgb)_/_1)]" : cn("text-[rgb(var(--crm-muted-rgb)_/_1)]", indent && "pl-6"))}>
        {data.label}
        {data.isSubtotal && data.label.includes('Lucro') && (
           <TooltipProvider>
             <Tooltip>
               <TooltipTrigger asChild>
                 <Info size={12} className="ml-2 text-[rgb(var(--crm-muted-rgb)_/_1)] cursor-help" />
               </TooltipTrigger>
               <TooltipContent>Resultado operacional após deduções de impostos e custos diretos.</TooltipContent>
             </Tooltip>
           </TooltipProvider>
        )}
      </div>
      <div className={cn("col-span-3 text-right tabular-nums", data.isSubtotal ? colorClass : "text-[rgb(var(--crm-muted-rgb)_/_1)]")}>
        {formatCurrency(data.monthlyValue)}
      </div>
      <div className={cn("col-span-3 text-right tabular-nums font-medium", data.isSubtotal ? colorClass : "text-[rgb(var(--crm-muted-rgb)_/_1)] text-[11px]")}>
        {formatPercent(data.percentageOfRevenue)}
      </div>
    </div>
  );
};

export function DREGenerator({ results, durationMonths }: DREGeneratorProps) {
  const isHealthy = results.dre.netIncome.percentageOfRevenue >= 20;
  const isWarning = results.dre.netIncome.percentageOfRevenue < 12;

  return (
    <div className="bg-[rgb(var(--crm-surface-rgb)_/_1)] rounded-3xl shadow-sm border border-[var(--crm-border)] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="p-8 border-b border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.5)]">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] flex items-center font-headline">
            <FileText className="w-5 h-5 mr-3 text-emerald-600" />
            Demonstrativo de Resultados (DRE)
          </h2>
          <div className="flex gap-2">
            <span className={cn(
              "text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest shadow-sm",
              isHealthy ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300" : isWarning ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300" : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
            )}>
              {isHealthy ? 'Alta Performance' : isWarning ? 'Risco de Margem' : 'Viabilidade Média'}
            </span>
          </div>
        </div>
        <p className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] mt-2 leading-relaxed">Visão gerencial mensalizada com análise vertical (A.V.) detalhada.</p>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-12 gap-4 pb-4 border-b-2 border-[var(--crm-border)] text-[10px] uppercase tracking-widest font-bold text-[rgb(var(--crm-muted-rgb)_/_1)] px-2">
          <div className="col-span-6">Descrição da Conta</div>
          <div className="col-span-3 text-right">Mensal (R$)</div>
          <div className="col-span-3 text-right">A.V. (%)</div>
        </div>

        <div className="py-2">
          <DRELineItem data={results.dre.grossRevenue} colorClass="text-[rgb(var(--crm-ink-rgb)_/_1)]" />
          <DRELineItem data={results.dre.taxes} colorClass="text-red-500" indent />
          <DRELineItem data={results.dre.netRevenue} colorClass="text-blue-700 dark:text-blue-300" />
          
          <DRELineItem data={results.dre.cogs} colorClass="text-orange-500" indent />
          <DRELineItem data={results.dre.grossProfit} colorClass="text-emerald-700 dark:text-emerald-300" />
          
          <DRELineItem data={results.dre.commissions} colorClass="text-orange-500" indent />
          <DRELineItem data={results.dre.operatingExpenses} colorClass="text-[rgb(var(--crm-muted-rgb)_/_1)]" indent />

          <DRELineItem 
            data={results.dre.netIncome} 
            colorClass={results.dre.netIncome.monthlyValue >= 0 ? "text-primary" : "text-destructive"} 
          />
        </div>
        
        <div className="mt-8 pt-6 border-t border-[var(--crm-border)] flex justify-end">
           <div className="text-right">
             <p className="text-[10px] text-[rgb(var(--crm-muted-rgb)_/_1)] uppercase font-bold tracking-widest">Lucro Total do Contrato ({durationMonths} meses)</p>
             <p className="text-3xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] font-headline">{formatCurrency(results.dre.netIncome.totalValue)}</p>
           </div>
        </div>
      </div>
      
      <div className={cn(
        "p-6 border-t",
        isWarning ? "bg-red-50 dark:bg-red-950 border-red-100 dark:border-red-800" : "bg-emerald-50 dark:bg-emerald-950 border-emerald-100 dark:border-emerald-800"
      )}>
        <div className="flex items-start">
          <div className={cn("mt-1 mr-4 shrink-0", isWarning ? 'text-red-500' : 'text-emerald-500')}>
            {isWarning ? <AlertCircle size={22} /> : <TrendingUp size={22} />}
          </div>
          <div>
            <h4 className={cn("font-bold text-sm font-headline", isWarning ? "text-red-900 dark:text-red-300" : "text-emerald-900 dark:text-emerald-300")}>
              Diagnóstico Financeiro: {formatPercent(results.dre.netIncome.percentageOfRevenue)} de Margem Líquida
            </h4>
            <p className={cn("text-xs mt-1 leading-relaxed font-medium", isWarning ? "text-red-800 dark:text-red-300" : "text-emerald-800 dark:text-emerald-300")}>
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
