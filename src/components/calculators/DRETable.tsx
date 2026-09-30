import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface PABXResult {
  setup: number;
  baseMonthly: number;
  deviceRentalCost: number;
  aiAgentCost: number;
  totalMonthly: number;
}

interface SIPResult {
  setup: number;
  monthly: number;
}

export interface DRETableProps {
  monthlyRevenue: number;
  totalCosts: number;
  commissionVendedor: number;
  commissionDiretor: number;
  commissionParceiro: number;
  pabxResult: PABXResult | null;
  sipResult: SIPResult | null;
  contractDuration: number;
  hasPartners?: boolean;
}

export const DRETable: React.FC<DRETableProps> = ({
  monthlyRevenue: propMonthlyRevenue,
  totalCosts: propTotalCosts,
  commissionVendedor,
  commissionDiretor,
  commissionParceiro,
  pabxResult,
  sipResult,
  contractDuration,
  hasPartners = false
}) => {
  // Estado para controlar edição de impostos
  const [isEditingTaxes, setIsEditingTaxes] = useState<boolean>(false);

  // Estados para as alíquotas de impostos editáveis
  const [editableTaxRates, setEditableTaxRates] = useState({
    simpleNacional: 15.00,
    custoDesp: 10.00,
  });

  // Função para formatar percentual com 2 casas decimais
  const formatPercentage = (value: number): string => {
    return value.toFixed(2).padStart(5, '0');
  };

  // Função para lidar com mudanças nas alíquotas de impostos
  const handleEditableTaxRateChange = (taxType: keyof typeof editableTaxRates, value: number) => {
    setEditableTaxRates(prev => ({
      ...prev,
      [taxType]: value
    }));
  };
  // Calculate actual monthly revenue from PABX and SIP results
  const calculateMonthlyRevenue = () => {
    let revenue = 0;

    // Add PABX monthly revenue if available
    if (pabxResult) {
      revenue += pabxResult.totalMonthly || 0;
    }

    // Add SIP monthly revenue if available
    if (sipResult) {
      revenue += sipResult.monthly || 0;
    }

    return revenue > 0 ? revenue : propMonthlyRevenue;
  };

  // Calculate total costs (CORREÇÃO: Não calcular custos operacionais automáticos)
  const calculateTotalCosts = () => {
    // CORREÇÃO: Não considerar custos PABX e SIP como custos operacionais
    // Estes valores já são preços de venda, não custos reais
    // Retornar apenas os custos passados como parâmetro (Custo/Desp 10%)
    return propTotalCosts;
  };

  // Calculate values
  const monthlyRevenue = calculateMonthlyRevenue();
  const totalCosts = calculateTotalCosts();
  // Calculate fixed costs based on contract duration (amortized setup costs)
  const calculateFixedCosts = () => {
    if (!pabxResult && !sipResult) return 0;

    let totalSetup = 0;

    if (pabxResult) {
      totalSetup += pabxResult.setup;
    }

    if (sipResult) {
      totalSetup += sipResult.setup || 0;
    }

    // Amortize setup costs over the contract duration (in months)
    return totalSetup / (contractDuration || 24);
  };

  // Tax rates - usando as alíquotas editáveis
  const impostosReceita = {
    simpleNacional: editableTaxRates.simpleNacional,
    custoDesp: editableTaxRates.custoDesp,
    outros: 0
  };

  const impostosLucro = {};

  // Calculate taxes on revenue
  const totalImpostosReceita = Object.values(impostosReceita).reduce((sum, rate) => sum + rate, 0);
  const valorImpostosReceita = (monthlyRevenue * totalImpostosReceita) / 100;

  // Calculate net revenue (after taxes on revenue)
  const receitaLiquida = monthlyRevenue - valorImpostosReceita;
  const receitaLiquidaPercentual = monthlyRevenue > 0 ? (receitaLiquida / monthlyRevenue) * 100 : 0;

  // Calculate commission amounts based on gross revenue (receita bruta)
  const comissaoVendedor = monthlyRevenue * (commissionVendedor / 100);
  const comissaoDiretor = monthlyRevenue * (commissionDiretor / 100);
  const comissaoParceiro = monthlyRevenue * (commissionParceiro / 100);

  // Calculate gross profit (after operational costs)
  const lucroBruto = receitaLiquida - totalCosts;
  const lucroBrutoPercentual = monthlyRevenue > 0 ? (lucroBruto / monthlyRevenue) * 100 : 0;

  // Calculate profit after commissions
  const lucroAposComissoes = lucroBruto - comissaoVendedor - comissaoDiretor - comissaoParceiro;
  const lucroAposComissoesPercentual = monthlyRevenue > 0 ? (lucroAposComissoes / monthlyRevenue) * 100 : 0;

  // Calculate fixed costs (amortized setup costs)
  const despesasFixas = calculateFixedCosts();

  // Calculate profit before taxes on profit
  const lucroAntesImpostos = lucroAposComissoes - despesasFixas;
  const lucroAntesImpostosPercentual = monthlyRevenue > 0 ? (lucroAntesImpostos / monthlyRevenue) * 100 : 0;

  // Calculate taxes on profit (only if there's profit)
  const totalImpostosLucro = Object.values(impostosLucro).reduce((sum: number, rate: any) => sum + (rate as number), 0);
  const valorImpostosLucro = lucroAntesImpostos > 0 ? (lucroAntesImpostos * (totalImpostosLucro as number)) / 100 : 0;

  // Calculate net profit
  const lucroLiquido = lucroAntesImpostos - valorImpostosLucro;
  const lucroLiquidoPercentual = monthlyRevenue > 0 ? (lucroLiquido / monthlyRevenue) * 100 : 0;

  // Debug log
  console.log('DRETable - Lucro Líquido:', lucroLiquido, 'Percentual:', lucroLiquidoPercentual);

  // Format number as Brazilian currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Format number as percentage
  const formatPercent = (value: number) => {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + '%';
  };

  return (
    <div className="space-y-6">
      {/* Main DRE Table */}
      <Card className="border-slate-700">
        <CardHeader className="bg-slate-800 py-3">
          <CardTitle className="text-lg font-medium">Demonstrativo de Resultado do Exercício (DRE)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-700">
                <TableHead className="text-white w-2/3">Descrição</TableHead>
                <TableHead className="text-white text-right">Valor (R$)</TableHead>
                <TableHead className="text-white text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Receita Bruta */}
              <TableRow className="bg-blue-900/20">
                <TableCell className="font-medium">Receita Bruta</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(monthlyRevenue)}
                </TableCell>
                <TableCell className="text-right font-medium">100,00%</TableCell>
              </TableRow>

              {/* Impostos sobre Receita */}
              <TableRow className="bg-red-900/20">
                <TableCell className="font-medium">(-) Impostos sobre Receita</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(valorImpostosReceita)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatPercent(totalImpostosReceita)}
                </TableCell>
              </TableRow>



              {/* Receita Líquida */}
              <TableRow className="bg-green-900/20">
                <TableCell className="font-medium">(=) Receita Líquida</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(receitaLiquida)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatPercent(receitaLiquidaPercentual)}
                </TableCell>
              </TableRow>

              {/* Custos Operacionais */}
              <TableRow className="bg-slate-800/50">
                <TableCell className="font-medium">(-) Custos Operacionais</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(totalCosts)}
                </TableCell>
                <TableCell className="text-right">
                  {monthlyRevenue > 0 ? formatPercent((totalCosts / monthlyRevenue) * 100) : '0,00%'}
                </TableCell>
              </TableRow>

              {/* CORREÇÃO: Detalhamento dos Custos Operacionais removido - 
                  Custos PABX e SIP são valores de venda, não custos operacionais */}

              {/* Lucro Bruto */}
              <TableRow className="bg-green-900/20">
                <TableCell className="font-medium">(=) Lucro Bruto</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(lucroBruto)}</TableCell>
                <TableCell className="text-right font-medium">{formatPercent(lucroBrutoPercentual)}</TableCell>
              </TableRow>

              {/* Comissões */}
              <TableRow className="bg-slate-800/30">
                <TableCell className="font-medium">(-) Comissões</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(comissaoVendedor + comissaoDiretor + comissaoParceiro)}
                </TableCell>
                <TableCell className="text-right">
                  {monthlyRevenue > 0 ? formatPercent(((comissaoVendedor + comissaoDiretor + comissaoParceiro) / monthlyRevenue) * 100) : '0,00%'}
                </TableCell>
              </TableRow>

              {comissaoVendedor > 0 && (
                <TableRow className="bg-slate-800/30">
                  <TableCell className="pl-8">
                    {hasPartners ? 'Comissão Canal/Vendedor' : 'Comissão Vendedor'} ({formatPercent(commissionVendedor)})
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(comissaoVendedor)}
                  </TableCell>
                  <TableCell className="text-right"></TableCell>
                </TableRow>
              )}

              {comissaoDiretor > 0 && (
                <TableRow className="bg-slate-800/30">
                  <TableCell className="pl-8">Comissão Diretor ({formatPercent(commissionDiretor)})</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(comissaoDiretor)}
                  </TableCell>
                  <TableCell className="text-right"></TableCell>
                </TableRow>
              )}

              {comissaoParceiro > 0 && (
                <TableRow className="bg-slate-800/30">
                  <TableCell className="pl-8">Comissão Parceiro ({formatPercent(commissionParceiro)})</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(comissaoParceiro)}
                  </TableCell>
                  <TableCell className="text-right"></TableCell>
                </TableRow>
              )}

              {/* Lucro após Comissões */}
              <TableRow className="bg-blue-900/20">
                <TableCell className="font-medium">(=) Lucro após Comissões</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(lucroAposComissoes)}</TableCell>
                <TableCell className="text-right font-medium">{formatPercent(lucroAposComissoesPercentual)}</TableCell>
              </TableRow>

              {/* Despesas Fixas */}
              <TableRow className="bg-slate-800/50">
                <TableCell className="pl-8">(-) Despesas Fixas (Setup / {contractDuration} meses)</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(despesasFixas)}
                </TableCell>
                <TableCell className="text-right">
                  {monthlyRevenue > 0 ? formatPercent((despesasFixas / monthlyRevenue) * 100) : '0,00%'}
                </TableCell>
              </TableRow>

              {/* Lucro antes dos Impostos sobre Lucro */}
              <TableRow className="bg-blue-900/20">
                <TableCell className="font-medium">(=) Lucro antes dos Impostos</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(lucroAntesImpostos)}</TableCell>
                <TableCell className="text-right font-medium">{formatPercent(lucroAntesImpostosPercentual)}</TableCell>
              </TableRow>

              {/* Impostos sobre Lucro */}
              {valorImpostosLucro > 0 && (
                <>
                  <TableRow className="bg-red-900/20">
                    <TableCell className="font-medium">(-) Impostos sobre Lucro</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(valorImpostosLucro)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPercent(Number(totalImpostosLucro))}
                    </TableCell>
                  </TableRow>


                </>
              )}

              {/* Lucro Líquido */}
              <TableRow className="bg-green-900/30">
                <TableCell className="font-bold text-lg">LUCRO LÍQUIDO</TableCell>
                <TableCell className={`text-right font-bold text-lg ${lucroLiquido >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(lucroLiquido)}
                </TableCell>
                <TableCell className={`text-right font-bold ${lucroLiquido >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPercent(lucroLiquidoPercentual)}
                </TableCell>
              </TableRow>

              {/* Métricas Adicionais */}
              <TableRow className="bg-slate-800/50">
                <TableCell className="font-medium">Balance</TableCell>
                <TableCell className={`text-right font-medium ${lucroLiquido >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(lucroLiquido)}
                </TableCell>
                <TableCell className="text-right"></TableCell>
              </TableRow>

              <TableRow className="bg-slate-800/50">
                <TableCell className="font-medium">Rentabilidade %</TableCell>
                <TableCell className={`text-right font-medium ${lucroLiquidoPercentual >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPercent(lucroLiquidoPercentual)}
                </TableCell>
                <TableCell className="text-right"></TableCell>
              </TableRow>

              <TableRow className="bg-slate-800/50">
                <TableCell className="font-medium">Lucratividade</TableCell>
                <TableCell className={`text-right font-medium ${lucroLiquidoPercentual >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPercent(lucroLiquidoPercentual)}
                </TableCell>
                <TableCell className="text-right"></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>


      {/* Precificação PABX/SIP */}
      <Card className="border-slate-700">
        <CardHeader className="bg-slate-800 py-3">
          <CardTitle className="text-lg font-medium">Precificação PABX/SIP</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-700">
                <TableHead className="text-white w-2/3">Descrição</TableHead>
                <TableHead className="text-white text-right">Valor (R$)</TableHead>
                <TableHead className="text-white text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Custos Operacionais</TableCell>
                <TableCell className="text-right">{formatCurrency(totalCosts)}</TableCell>
                <TableCell className="text-right">
                  {monthlyRevenue > 0 ? formatPercent((totalCosts / monthlyRevenue) * 100) : '0,00%'}
                </TableCell>
              </TableRow>
              <TableRow className="bg-slate-800/50">
                <TableCell className="pl-8">(+) Comissões</TableCell>
                <TableCell className="text-right">{formatCurrency(comissaoVendedor + comissaoDiretor + comissaoParceiro)}</TableCell>
                <TableCell className="text-right">
                  {monthlyRevenue > 0 ? formatPercent(((comissaoVendedor + comissaoDiretor + comissaoParceiro) / monthlyRevenue) * 100) : '0,00%'}
                </TableCell>
              </TableRow>
              <TableRow className="bg-slate-800/30">
                <TableCell className="pl-8">(+) Despesas Fixas</TableCell>
                <TableCell className="text-right">{formatCurrency(despesasFixas)}</TableCell>
                <TableCell className="text-right">
                  {monthlyRevenue > 0 ? formatPercent((despesasFixas / monthlyRevenue) * 100) : '0,00%'}
                </TableCell>
              </TableRow>
              <TableRow className="bg-slate-800/30">
                <TableCell className="pl-8">(+) Impostos</TableCell>
                <TableCell className="text-right">{formatCurrency(valorImpostosReceita + valorImpostosLucro)}</TableCell>
                <TableCell className="text-right">
                  {monthlyRevenue > 0 ? formatPercent(((valorImpostosReceita + valorImpostosLucro) / monthlyRevenue) * 100) : '0,00%'}
                </TableCell>
              </TableRow>
              <TableRow className="bg-slate-800/30">
                <TableCell className="pl-8">(+) Margem de Lucro Desejada</TableCell>
                <TableCell className="text-right">{formatCurrency(lucroLiquido)}</TableCell>
                <TableCell className="text-right">{formatPercent(lucroLiquidoPercentual)}</TableCell>
              </TableRow>
              <TableRow className="bg-green-900/20 font-medium">
                <TableCell>Preço de Venda Sugerido</TableCell>
                <TableCell className="text-right">{formatCurrency(monthlyRevenue)}</TableCell>
                <TableCell className="text-right">100,00%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tabela de Impostos Editável */}
      <Card className="bg-slate-900/80 border-slate-800 text-white">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center">
                <div className="w-4 h-4 bg-yellow-500 mr-2"></div>
                Tabela de Impostos
              </CardTitle>
              <CardDescription>Configure as alíquotas de impostos</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditingTaxes(!isEditingTaxes)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              {isEditingTaxes ? 'Salvar' : 'Editar'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Simple Nacional (%)</label>
              <Input
                type="number"
                step="0.01"
                value={formatPercentage(editableTaxRates.simpleNacional)}
                onChange={(e) => handleEditableTaxRateChange('simpleNacional', parseFloat(e.target.value))}
                disabled={!isEditingTaxes}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Custo/Desp (%)</label>
              <Input
                type="number"
                step="0.01"
                value={formatPercentage(editableTaxRates.custoDesp)}
                onChange={(e) => handleEditableTaxRateChange('custoDesp', parseFloat(e.target.value))}
                disabled={!isEditingTaxes}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>



    </div>
  );
};

export default DRETable;
