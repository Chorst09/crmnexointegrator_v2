import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

interface DREComponentProps {
  monthlyRevenue: number;
  setupRevenue: number;
  contractPeriod: number;
}

export default function DREComponent({ monthlyRevenue, setupRevenue, contractPeriod }: DREComponentProps) {
  // Calculate total revenue for the contract period
  const totalRevenue = monthlyRevenue * contractPeriod + setupRevenue;
  
  // Calculate costs (example values - adjust based on your business logic)
  const directCosts = totalRevenue * 0.3; // 30% of revenue
  const operationalCosts = totalRevenue * 0.2; // 20% of revenue
  const taxes = totalRevenue * 0.1; // 10% of revenue
  
  // Calculate results
  const grossProfit = totalRevenue - directCosts;
  const ebitda = grossProfit - operationalCosts;
  const netProfit = ebitda - taxes;
  const margin = (netProfit / totalRevenue) * 100;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Demonstrativo de Resultados (DRE)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Receita Mensal:</p>
              <p className="font-semibold">{formatCurrency(monthlyRevenue)}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Receita de Ativação:</p>
              <p className="font-semibold">{formatCurrency(setupRevenue)}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Período do Contrato (meses):</p>
              <p className="font-semibold">{contractPeriod}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Receita Total no Período:</p>
              <p className="font-semibold">{formatCurrency(totalRevenue)}</p>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <p className="text-sm font-medium">(-) Custos Diretos:</p>
            <p className="text-right">{formatCurrency(directCosts)}</p>
            
            <p className="text-sm font-medium mt-2">= Lucro Bruto:</p>
            <p className="text-right font-semibold">{formatCurrency(grossProfit)}</p>
            
            <p className="text-sm font-medium mt-2">(-) Despesas Operacionais:</p>
            <p className="text-right">{formatCurrency(operationalCosts)}</p>
            
            <p className="text-sm font-medium mt-2">= EBITDA:</p>
            <p className="text-right font-semibold">{formatCurrency(ebitda)}</p>
            
            <p className="text-sm font-medium mt-2">(-) Impostos:</p>
            <p className="text-right">{formatCurrency(taxes)}</p>
            
            <p className="text-sm font-medium mt-2">= Lucro Líquido:</p>
            <p className="text-right font-semibold">{formatCurrency(netProfit)}</p>
            
            <p className="text-sm font-medium mt-2">Margem Líquida:</p>
            <p className="text-right font-semibold">{margin.toFixed(2)}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
