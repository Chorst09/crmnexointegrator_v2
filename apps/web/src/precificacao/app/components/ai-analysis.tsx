
'use client';

import React, { useState } from 'react';
import { Sparkles, Loader2, FileSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { analyzeProfitability } from '@/ai/flows/profitability-analysis-flow';
import { PricingOutput, PricingInput } from '@/app/lib/pricing-engine';

interface AIAnalysisProps {
  results: PricingOutput;
  params: PricingInput;
}

export function AIAnalysis({ results, params }: AIAnalysisProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRunAnalysis = async () => {
    setLoading(true);
    try {
      const response = await analyzeProfitability({
        durationMonths: params.durationMonths,
        grossRevenue: results.dre.grossRevenue,
        taxes: results.dre.taxes,
        netRevenue: results.dre.netRevenue,
        cogs: results.dre.cogs,
        grossProfit: results.dre.grossProfit,
        commissions: results.dre.commissions,
        netIncome: results.dre.netIncome,
      });
      setAnalysis(response);
    } catch (error) {
      console.error('Failed to run AI analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold flex items-center font-headline">
              <Sparkles className="w-5 h-5 mr-3 text-primary animate-pulse" />
              Arquiteto de Inteligência Financeira
            </CardTitle>
            <CardDescription className="text-sm mt-1">Análise automatizada de rentabilidade e sugestões de otimização estratégica.</CardDescription>
          </div>
          <Button 
            onClick={handleRunAnalysis} 
            disabled={loading}
            className="rounded-full bg-primary hover:bg-primary/90 shadow-lg px-6"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSearch className="w-4 h-4 mr-2" />}
            {loading ? 'Analisando...' : 'Gerar Insights'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-8">
        {!analysis && !loading && (
          <div className="text-center py-10">
            <div className="inline-flex p-4 bg-indigo-50 rounded-full mb-4">
              <Sparkles className="w-8 h-8 text-primary/40" />
            </div>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">Clique no botão acima para permitir que nossa IA analise os detalhes deste contrato e gere recomendações de precificação.</p>
          </div>
        )}
        
        {loading && (
          <div className="space-y-4">
            <div className="h-4 bg-slate-100 rounded-full w-3/4 animate-pulse" />
            <div className="h-4 bg-slate-100 rounded-full w-full animate-pulse" />
            <div className="h-4 bg-slate-100 rounded-full w-5/6 animate-pulse" />
            <div className="h-4 bg-slate-100 rounded-full w-2/3 animate-pulse" />
          </div>
        )}

        {analysis && !loading && (
          <div className="prose prose-slate max-w-none">
            <div className="whitespace-pre-wrap text-slate-700 text-sm leading-relaxed font-medium">
              {analysis}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
