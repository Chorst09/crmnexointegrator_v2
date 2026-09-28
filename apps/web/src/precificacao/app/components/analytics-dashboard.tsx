
'use client';

import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, Legend
} from 'recharts';
import { PricingOutput, PricingInput } from '@/app/lib/pricing-engine';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatCurrency, formatPercent } from '@/app/lib/formatters';
import { Activity, ArrowUpRight, Clock, Target } from 'lucide-react';

interface AnalyticsDashboardProps {
  results: PricingOutput;
  params: PricingInput;
}

export function AnalyticsDashboard({ results, params }: AnalyticsDashboardProps) {
  const costData = [
    { name: 'Impostos', value: results.dre.taxes.monthlyValue, color: '#94a3b8' },
    { name: 'Amort. Setup', value: results.monthlyAmortization, color: '#6366f1' },
    { name: 'OPEX Base', value: results.totalMonthlyRecurringCost, color: '#818cf8' },
    { name: 'Comissões', value: results.dre.commissions.monthlyValue, color: '#c7d2fe' },
    { name: 'Lucro Líquido', value: results.dre.netIncome.monthlyValue, color: '#10b981' },
  ];

  const benchmarkData = [
    { name: 'Break-even', value: results.metrics.breakEvenMonthlyPrice },
    { name: 'Preço Alvo', value: results.finalMonthlyPrice },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="ROI do Projeto" 
          value={formatPercent(results.metrics.roi)} 
          description="Retorno sobre setup inicial"
          icon={<ArrowUpRight className="w-4 h-4 text-emerald-500" />}
        />
        <MetricCard 
          title="Payback" 
          value={`${results.metrics.paybackMonths.toFixed(1)} meses`} 
          description="Tempo de recuperação"
          icon={<Clock className="w-4 h-4 text-blue-500" />}
        />
        <MetricCard 
          title="Margem EBITDA" 
          value={formatPercent(results.metrics.ebitdaMargin)} 
          description="Eficiência operacional"
          icon={<Activity className="w-4 h-4 text-indigo-500" />}
        />
        <MetricCard 
          title="Break-even" 
          value={formatCurrency(results.metrics.breakEvenMonthlyPrice)} 
          description="Ponto de equilíbrio"
          icon={<Target className="w-4 h-4 text-amber-500" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-[2.5rem] border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Composição do Faturamento</CardTitle>
            <CardDescription>Onde cada real pago pelo cliente é alocado mensalmente.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={costData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {costData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-[2.5rem] border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Benchmark de Viabilidade</CardTitle>
            <CardDescription>Comparação entre Preço Alvo e Ponto de Equilíbrio.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={benchmarkData} layout="vertical" margin={{ left: 20, right: 40, top: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} className="font-medium text-xs" />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={40}>
                  {benchmarkData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#cbd5e1' : '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value, description, icon }: { title: string, value: string, description: string, icon: React.ReactNode }) {
  return (
    <Card className="rounded-3xl border-slate-200 shadow-sm bg-white">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</span>
          <div className="p-2 bg-slate-50 rounded-xl">{icon}</div>
        </div>
        <div className="text-2xl font-bold text-slate-900 font-headline">{value}</div>
        <p className="text-[10px] text-slate-500 mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}
