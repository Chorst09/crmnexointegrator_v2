import { useState } from 'react';
import { Calculator, Package, Home, Wrench, TrendingUp, Info, ArrowRight } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';

export default function Calculadoras() {
  const [showModal, setShowModal] = useState(false);
  const [calculadoraAtiva, setCalculadoraAtiva] = useState(null);
  const [currentTab, setCurrentTab] = useState('vendas');
  const [currentVendasTab, setCurrentVendasTab] = useState('custos');

  // Estados para Calculadora de Vendas
  const [vendasData, setVendasData] = useState({
    regimeTributario: 'LUCRO_PRESUMIDO',
    custoUnitario: '',
    quantidade: 1,
    frete: 0,
    outrasDesp: 0,
    margemLucro: 30
  });

  // Estados para Calculadora de Locação
  const [locacaoData, setLocacaoData] = useState({
    // Aba Ativo
    nomeAtivo: '',
    descricaoAtivo: '',
    valorAtivo: '',
    valorResidual: '',
    vidaUtil: 60,
    categoria: 'EQUIPAMENTO',
    fabricante: '',
    modelo: '',
    numeroSerie: '',
    
    // Aba Contrato
    tipoContrato: 'OPERACIONAL',
    periodoContrato: 36,
    carencia: 0,
    reajuste: 'IGPM',
    percentualReajuste: 0,
    garantia: 12,
    clausulaRescisao: true,
    multaRescisao: 30,
    custoInstalacao: 0,
    custoDesinstalacao: 0,
    
    // Aba Custos
    manutencaoMensal: 0,
    seguroMensal: 0,
    custosOperacionais: 0,
    custosLogisticos: 0,
    iss: 5,
    pis: 0.65,
    cofins: 3,
    irpj: 15,
    csll: 9,
    
    // Aba Financeiro
    taxaJurosMensal: 1.5,
    taxaAdministracao: 5,
    margemLucro: 20,
    custoCapital: 12,
    riscoPadrao: 2,
    inflacaoAnual: 4.5
  });

  const [currentLocacaoTab, setCurrentLocacaoTab] = useState('ativo');

  // Estados para Calculadora de Serviços
  const [servicosData, setServicosData] = useState({
    horasEstimadas: '',
    valorHoraTecnico: '',
    quantidadeTecnicos: 1,
    custosMateriais: 0,
    custosDeslocamento: 0,
    margemLucro: 40,
    complexidade: 'MEDIA'
  });

  const [resultadoCalculo, setResultadoCalculo] = useState(null);

  const calculadoras = [
    {
      id: 'vendas',
      title: 'Venda (Sales)',
      description: 'Precificação baseada em custos, impostos e margem de lucro',
      icon: Package,
      color: 'from-blue-500 to-blue-600',
      detalhes: 'Ideal para produtos físicos, licenças de software e soluções tangíveis'
    },
    {
      id: 'locacao',
      title: 'Locação (MaaS/Rental)',
      description: 'Cálculo de mensalidade baseado em depreciação e ROI',
      icon: Home,
      color: 'from-green-500 to-green-600',
      detalhes: 'Perfeito para equipamentos, máquinas e ativos de longo prazo'
    },
    {
      id: 'servicos',
      title: 'Serviços (Service/SaaS)',
      description: 'Precificação por hora/homem e custos de projeto',
      icon: Wrench,
      color: 'from-purple-500 to-purple-600',
      detalhes: 'Consultoria, desenvolvimento, suporte técnico e serviços especializados'
    }
  ];

  const abrirCalculadora = (tipo) => {
    setCalculadoraAtiva(tipo);
    setCurrentTab(tipo);
    setCurrentVendasTab('custos');
    setShowModal(true);
    setResultadoCalculo(null);
  };
  const calcularVendas = () => {
    const custo = parseFloat(vendasData.custoUnitario) || 0;
    const quantidade = parseInt(vendasData.quantidade) || 1;
    const frete = parseFloat(vendasData.frete) || 0;
    const outrasDesp = parseFloat(vendasData.outrasDesp) || 0;
    const margemDesejada = parseFloat(vendasData.margemLucro) || 0;

    const custoTotal = (custo * quantidade) + frete + outrasDesp;
    
    // Cálculo baseado no regime tributário
    let aliquotaImpostos = 0;
    
    switch (vendasData.regimeTributario) {
      case 'LUCRO_PRESUMIDO':
        aliquotaImpostos = 0.1133;
        break;
      case 'LUCRO_REAL':
        aliquotaImpostos = 0.15;
        break;
      case 'SIMPLES_NACIONAL':
        aliquotaImpostos = 0.08;
        break;
      default:
        aliquotaImpostos = 0.1133;
    }

    const impostos = custoTotal * aliquotaImpostos;
    const precoVenda = custoTotal * (1 / (1 - (margemDesejada * 0.01) - aliquotaImpostos));
    const lucroLiquido = precoVenda - custoTotal - impostos;
    const margemReal = (lucroLiquido * 100) / precoVenda;
    const markup = ((precoVenda * 100) / custoTotal) - 100;

    setResultadoCalculo({
      tipo: 'vendas',
      custoTotal,
      impostos,
      precoVenda,
      lucroLiquido,
      margemReal,
      markup,
      composicao: {
        custo: (custoTotal * 100) / precoVenda,
        impostos: (impostos * 100) / precoVenda,
        lucro: margemReal
      }
    });
  };

  const calcularLocacao = () => {
    const valorAtivo = parseFloat(locacaoData.valorAtivo) || 0;
    const valorResidual = parseFloat(locacaoData.valorResidual) || 0;
    const vidaUtil = parseInt(locacaoData.vidaUtil) || 60;
    const periodoContrato = parseInt(locacaoData.periodoContrato) || 36;
    const carencia = parseInt(locacaoData.carencia) || 0;
    const custoInstalacao = parseFloat(locacaoData.custoInstalacao) || 0;
    const custoDesinstalacao = parseFloat(locacaoData.custoDesinstalacao) || 0;
    
    // Custos operacionais mensais
    const manutencaoMensal = parseFloat(locacaoData.manutencaoMensal) || 0;
    const seguroMensal = parseFloat(locacaoData.seguroMensal) || 0;
    const custosOperacionais = parseFloat(locacaoData.custosOperacionais) || 0;
    const custosLogisticos = parseFloat(locacaoData.custosLogisticos) || 0;
    const totalCustosOperacionais = manutencaoMensal + seguroMensal + custosOperacionais + custosLogisticos;
    
    // Parâmetros financeiros
    const taxaJurosMensal = parseFloat(locacaoData.taxaJurosMensal) * 0.01 || 0.015;
    const taxaAdministracao = parseFloat(locacaoData.taxaAdministracao) * 0.01 || 0.05;
    const margemLucro = parseFloat(locacaoData.margemLucro) * 0.01 || 0.20;
    const custoCapital = parseFloat(locacaoData.custoCapital) * 0.01 || 0.12;
    const riscoPadrao = parseFloat(locacaoData.riscoPadrao) * 0.01 || 0.02;
    
    // Impostos
    const iss = parseFloat(locacaoData.iss) * 0.01 || 0.05;
    const pis = parseFloat(locacaoData.pis) * 0.01 || 0.0065;
    const cofins = parseFloat(locacaoData.cofins) * 0.01 || 0.03;
    const irpj = parseFloat(locacaoData.irpj) * 0.01 || 0.15;
    const csll = parseFloat(locacaoData.csll) * 0.01 || 0.09;
    const totalImpostos = iss + pis + cofins + irpj + csll;
    
    // Cálculo de depreciação mensal
    const depreciacao = (valorAtivo - valorResidual) * (1 / vidaUtil);
    
    // Custo de capital mensal sobre o valor do ativo
    const custoCapitalMensal = valorAtivo * (custoCapital * (1/12));
    
    // Custo base mensal (depreciação + custos operacionais + custo de capital)
    const custoBaseMensal = depreciacao + totalCustosOperacionais + custoCapitalMensal;
    
    // Taxa de administração sobre o custo base
    const taxaAdminMensal = custoBaseMensal * taxaAdministracao;
    
    // Custo total antes da margem e impostos
    const custoTotalMensal = custoBaseMensal + taxaAdminMensal;
    
    // Preço de locação com margem e impostos
    const precoLocacao = custoTotalMensal * (1 / (1 - margemLucro - totalImpostos));
    
    // Cálculos de rentabilidade
    const lucroMensal = precoLocacao - custoTotalMensal;
    const impostosMensais = precoLocacao * totalImpostos;
    const lucroLiquidoMensal = lucroMensal - impostosMensais;
    const margemReal = (lucroLiquidoMensal * 100) / precoLocacao;
    
    // Análise financeira
    const receitaAnual = precoLocacao * 12;
    const custoAnual = custoTotalMensal * 12;
    const lucroAnual = lucroLiquidoMensal * 12;
    const roi = (lucroAnual * 100) / valorAtivo;
    const payback = valorAtivo / lucroAnual; // anos
    
    // Valor presente líquido (VPL) considerando o período do contrato
    const taxaDesconto = (custoCapital + riscoPadrao) * (1/12); // taxa mensal
    let vpl = -valorAtivo; // Investimento inicial
    
    // Fluxo de caixa mensal durante o contrato
    for (let i = 1; i <= periodoContrato; i++) {
      if (i > carencia) { // Só recebe após carência
        vpl += lucroLiquidoMensal * Math.pow(1 + taxaDesconto, -i);
      }
    }
    
    // Adicionar valor residual no final do contrato
    vpl += valorResidual * Math.pow(1 + taxaDesconto, -periodoContrato);
    
    // Taxa interna de retorno (TIR) - aproximação
    let tir = 0;
    for (let taxa = 0.01; taxa <= 0.50; taxa += 0.001) {
      let vplTeste = -valorAtivo;
      for (let i = 1; i <= periodoContrato; i++) {
        if (i > carencia) {
          vplTeste += lucroLiquidoMensal * Math.pow(1 + taxa * (1/12), -i);
        }
      }
      vplTeste += valorResidual * Math.pow(1 + taxa * (1/12), -periodoContrato);
      
      if (Math.abs(vplTeste) < 100) { // Aproximação da TIR
        tir = taxa * 100;
        break;
      }
    }
    
    // Análise de sensibilidade
    const breakEvenMensal = custoTotalMensal * (1 / (1 - totalImpostos)); // Preço sem margem
    const margemSeguranca = ((precoLocacao - breakEvenMensal) * 100) / precoLocacao;
    
    // Indicadores de eficiência
    const giroAtivo = receitaAnual / valorAtivo; // Quantas vezes o ativo gira por ano
    const rentabilidadePatrimonio = roi; // ROE aproximado
    
    setResultadoCalculo({
      tipo: 'locacao',
      // Valores principais
      valorAtivo,
      valorResidual,
      precoLocacao,
      lucroMensal,
      lucroLiquidoMensal,
      impostosMensais,
      margemReal,
      
      // Custos detalhados
      depreciacao,
      totalCustosOperacionais,
      custoCapitalMensal,
      taxaAdminMensal,
      custoTotalMensal,
      
      // Análise financeira
      roi,
      tir,
      payback,
      vpl,
      receitaAnual,
      custoAnual,
      lucroAnual,
      
      // Indicadores de risco e eficiência
      breakEvenMensal,
      margemSeguranca,
      giroAtivo,
      rentabilidadePatrimonio,
      
      // Parâmetros do contrato
      periodoContrato,
      carencia,
      custoInstalacao,
      custoDesinstalacao,
      
      // Composição percentual
      composicao: {
        depreciacao: (depreciacao * 100) / precoLocacao,
        custosOperacionais: (totalCustosOperacionais * 100) / precoLocacao,
        custoCapital: (custoCapitalMensal * 100) / precoLocacao,
        taxaAdmin: (taxaAdminMensal * 100) / precoLocacao,
        impostos: (impostosMensais * 100) / precoLocacao,
        lucro: (lucroLiquidoMensal * 100) / precoLocacao
      },
      
      // Detalhamento de impostos
      detalhesImpostos: {
        iss: precoLocacao * iss,
        pis: precoLocacao * pis,
        cofins: precoLocacao * cofins,
        irpj: precoLocacao * irpj,
        csll: precoLocacao * csll,
        total: impostosMensais
      }
    });
  };
  const calcularServicos = () => {
    const horas = parseFloat(servicosData.horasEstimadas) || 0;
    const valorHora = parseFloat(servicosData.valorHoraTecnico) || 0;
    const tecnicos = parseInt(servicosData.quantidadeTecnicos) || 1;
    const materiais = parseFloat(servicosData.custosMateriais) || 0;
    const deslocamento = parseFloat(servicosData.custosDeslocamento) || 0;
    const margemDesejada = parseFloat(servicosData.margemLucro) || 40;

    // Multiplicador de complexidade
    const multiplicadores = {
      'BAIXA': 1.0,
      'MEDIA': 1.2,
      'ALTA': 1.5,
      'CRITICA': 2.0
    };
    
    const multiplicador = multiplicadores[servicosData.complexidade] || 1.2;
    
    // Custos base
    const custoMaoObra = horas * valorHora * tecnicos * multiplicador;
    const custoTotal = custoMaoObra + materiais + deslocamento;
    
    // Preço final
    const precoServico = custoTotal * (1 / (1 - (margemDesejada * 0.01)));
    const lucroLiquido = precoServico - custoTotal;
    const margemReal = (lucroLiquido * 100) / precoServico;
    
    // Valor por hora efetivo
    const valorHoraEfetivo = precoServico / (horas * tecnicos);

    setResultadoCalculo({
      tipo: 'servicos',
      custoMaoObra,
      custoTotal,
      precoServico,
      lucroLiquido,
      margemReal,
      valorHoraEfetivo,
      horasTotais: horas * tecnicos,
      multiplicador,
      composicao: {
        maoObra: (custoMaoObra * 100) / precoServico,
        materiais: (materiais * 100) / precoServico,
        deslocamento: (deslocamento * 100) / precoServico,
        lucro: margemReal
      }
    });
  };

  const executarCalculo = () => {
    switch (calculadoraAtiva) {
      case 'vendas':
        calcularVendas();
        break;
      case 'locacao':
        calcularLocacao();
        break;
      case 'servicos':
        calcularServicos();
        break;
    }
  };

  const resetForm = () => {
    setVendasData({
      regimeTributario: 'LUCRO_PRESUMIDO',
      custoUnitario: '',
      quantidade: 1,
      frete: 0,
      outrasDesp: 0,
      margemLucro: 30
    });
    setLocacaoData({
      // Aba Ativo
      nomeAtivo: '',
      descricaoAtivo: '',
      valorAtivo: '',
      valorResidual: '',
      vidaUtil: 60,
      categoria: 'EQUIPAMENTO',
      fabricante: '',
      modelo: '',
      numeroSerie: '',
      
      // Aba Contrato
      tipoContrato: 'OPERACIONAL',
      periodoContrato: 36,
      carencia: 0,
      reajuste: 'IGPM',
      percentualReajuste: 0,
      garantia: 12,
      clausulaRescisao: true,
      multaRescisao: 30,
      custoInstalacao: 0,
      custoDesinstalacao: 0,
      
      // Aba Custos
      manutencaoMensal: 0,
      seguroMensal: 0,
      custosOperacionais: 0,
      custosLogisticos: 0,
      iss: 5,
      pis: 0.65,
      cofins: 3,
      irpj: 15,
      csll: 9,
      
      // Aba Financeiro
      taxaJurosMensal: 1.5,
      taxaAdministracao: 5,
      margemLucro: 20,
      custoCapital: 12,
      riscoPadrao: 2,
      inflacaoAnual: 4.5
    });
    setServicosData({
      horasEstimadas: '',
      valorHoraTecnico: '',
      quantidadeTecnicos: 1,
      custosMateriais: 0,
      custosDeslocamento: 0,
      margemLucro: 40,
      complexidade: 'MEDIA'
    });
    setResultadoCalculo(null);
    setCurrentLocacaoTab('ativo');
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <PageHeader
        title="Calculadoras de Precificação"
        subtitle="Ferramentas especializadas para diferentes modelos de negócio"
      />

      <div className="p-6 space-y-6">
        {/* Cards das Calculadoras */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {calculadoras.map((calc) => (
            <div
              key={calc.id}
              className="relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-600/30 p-8 hover:from-slate-700/90 hover:to-slate-800/90 hover:border-slate-500/50 transition-all duration-500 cursor-pointer group shadow-2xl hover:shadow-3xl hover:scale-[1.02]"
              onClick={() => abrirCalculadora(calc.id)}
            >
              {/* Gradient overlay for depth */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="relative z-10">
                <div className="flex items-start gap-5 mb-6">
                  <div className={'w-16 h-16 rounded-2xl bg-gradient-to-br ' + calc.color + ' flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-lg'}>
                    <calc.icon className="w-8 h-8 text-white drop-shadow-sm" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-100 transition-colors">{calc.title}</h3>
                    <p className="text-slate-300 text-sm leading-relaxed">{calc.description}</p>
                  </div>
                </div>
                
                <p className="text-slate-200 text-sm mb-6 leading-relaxed bg-slate-700/30 rounded-lg p-4 border border-slate-600/20">{calc.detalhes}</p>
                
                <div className="flex items-center justify-between pt-4 border-t border-slate-600/30">
                  <span className="text-blue-300 text-sm font-semibold tracking-wide">ABRIR CALCULADORA</span>
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                    <ArrowRight className="w-4 h-4 text-blue-300 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Informações Adicionais */}
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-600/30 p-8 shadow-2xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Info className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white">Como Escolher a Calculadora Certa</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-700/40 rounded-xl p-6 border border-slate-600/30 hover:bg-slate-700/60 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-400" />
                </div>
                <h4 className="font-bold text-blue-300 text-lg">Vendas (Sales)</h4>
              </div>
              <ul className="text-slate-200 text-sm space-y-3 leading-relaxed">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                  Produtos físicos
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                  Licenças de software
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                  Equipamentos
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                  Soluções one-time
                </li>
              </ul>
            </div>
            
            <div className="bg-slate-700/40 rounded-xl p-6 border border-slate-600/30 hover:bg-slate-700/60 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Home className="w-5 h-5 text-green-400" />
                </div>
                <h4 className="font-bold text-green-300 text-lg">Locação (MaaS)</h4>
              </div>
              <ul className="text-slate-200 text-sm space-y-3 leading-relaxed">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                  Equipamentos industriais
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                  Máquinas e ferramentas
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                  Veículos corporativos
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                  Ativos de alto valor
                </li>
              </ul>
            </div>
            
            <div className="bg-slate-700/40 rounded-xl p-6 border border-slate-600/30 hover:bg-slate-700/60 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-purple-400" />
                </div>
                <h4 className="font-bold text-purple-300 text-lg">Serviços (SaaS)</h4>
              </div>
              <ul className="text-slate-200 text-sm space-y-3 leading-relaxed">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                  Consultoria especializada
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                  Desenvolvimento de software
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                  Suporte técnico
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                  Projetos customizados
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      {/* Modal das Calculadoras */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title={'Calculadora de ' + (calculadoras.find(c => c.id === calculadoraAtiva)?.title || '')}
        subtitle="Configure os parâmetros para calcular o preço ideal"
        size="large"
      >
        <div className="space-y-6">
          {/* Tabs */}
          <div className="flex space-x-2 bg-slate-800/60 backdrop-blur-sm rounded-xl p-2 border border-slate-600/30">
            {calculadoras.map((calc) => (
              <button
                key={calc.id}
                onClick={() => {
                  setCurrentTab(calc.id);
                  setCalculadoraAtiva(calc.id);
                  setCurrentVendasTab('custos');
                  setResultadoCalculo(null);
                }}
                className={`flex-1 flex items-center justify-center gap-3 py-4 px-6 rounded-lg text-sm font-semibold transition-all duration-300 ${
                  currentTab === calc.id
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25 scale-105'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <calc.icon className="w-5 h-5" />
                <span>{calc.title.split(' ')[0]}</span>
              </button>
            ))}
          </div>
          {/* Formulários das Calculadoras */}
          <div className="space-y-6">
            {/* Formulário de Vendas */}
            {currentTab === 'vendas' && (
            <div className="space-y-6">
              {/* Regime Tributário */}
              <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-500/30 rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Package className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-blue-300 font-bold text-lg">Regime Tributário</h4>
                    <p className="text-blue-200/80 text-sm">Selecione o regime para cálculo correto dos impostos</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-blue-200 mb-3">
                    Regime Tributário *
                  </label>
                  <select
                    value={vendasData.regimeTributario}
                    onChange={(e) => setVendasData(prev => ({ ...prev, regimeTributario: e.target.value }))}
                    className="w-full px-4 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  >
                    <option value="LUCRO_PRESUMIDO">Lucro Presumido (11.33%)</option>
                    <option value="LUCRO_REAL">Lucro Real (15.00%)</option>
                    <option value="SIMPLES_NACIONAL">Simples Nacional (8.00%)</option>
                  </select>
                </div>
              </div>

              {/* Abas de Categorias */}
              <div className="grid grid-cols-4 gap-2 bg-slate-800/60 backdrop-blur-sm rounded-xl p-2 border border-slate-600/30">
                <button
                  type="button"
                  onClick={() => setCurrentVendasTab('custos')}
                  className={`py-4 px-4 rounded-lg text-sm font-bold transition-all duration-300 ${
                    currentVendasTab === 'custos'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25 scale-105'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  💰 Custos
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentVendasTab('impostos')}
                  className={`py-4 px-4 rounded-lg text-sm font-bold transition-all duration-300 ${
                    currentVendasTab === 'impostos'
                      ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/25 scale-105'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  📊 Impostos
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentVendasTab('despesas')}
                  className={`py-4 px-4 rounded-lg text-sm font-bold transition-all duration-300 ${
                    currentVendasTab === 'despesas'
                      ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-500/25 scale-105'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  🚚 Despesas
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentVendasTab('margem')}
                  className={`py-4 px-4 rounded-lg text-sm font-bold transition-all duration-300 ${
                    currentVendasTab === 'margem'
                      ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg shadow-emerald-500/25 scale-105'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  📈 Margem
                </button>
              </div>
              {/* Conteúdo das Abas */}
              <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-600/50 rounded-xl p-6 min-h-[300px] shadow-xl">
                {/* Aba Custos */}
                {currentVendasTab === 'custos' && (
                  <div className="space-y-6">
                    <div className="mb-6">
                      <h4 className="text-xl font-semibold text-white mb-2">Custos do Produto</h4>
                      <p className="text-slate-300 text-sm">Informe os custos de aquisição do produto</p>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-bold text-slate-100 mb-3">
                          💰 Custo Unitário do Produto (CMV) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={vendasData.custoUnitario}
                          onChange={(e) => setVendasData(prev => ({ ...prev, custoUnitario: e.target.value }))}
                          placeholder="500,00"
                          className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-100 mb-3">
                          📦 Quantidade
                        </label>
                        <input
                          type="number"
                          value={vendasData.quantidade}
                          onChange={(e) => setVendasData(prev => ({ ...prev, quantidade: parseInt(e.target.value) || 1 }))}
                          placeholder="1"
                          className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-lg"
                        />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/30 border border-blue-500/40 rounded-2xl p-8 shadow-xl">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                        <h5 className="text-xl font-bold text-blue-100">Resumo de Custos</h5>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center py-3 border-b border-blue-500/20">
                          <span className="text-slate-200 font-medium">Custo Unitário:</span>
                          <span className="text-white font-bold text-lg">R$ {(parseFloat(vendasData.custoUnitario) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-blue-500/20">
                          <span className="text-slate-200 font-medium">Quantidade:</span>
                          <span className="text-white font-bold text-lg">{vendasData.quantidade}</span>
                        </div>
                        <div className="bg-gradient-to-r from-blue-600/20 to-blue-500/20 rounded-xl p-4 mt-6">
                          <div className="flex justify-between items-center">
                            <span className="text-blue-200 font-bold text-lg">💰 Custo Total:</span>
                            <span className="text-blue-100 font-black text-2xl">R$ {((parseFloat(vendasData.custoUnitario) || 0) * vendasData.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {/* Aba Impostos */}
                {currentVendasTab === 'impostos' && (
                  <div className="space-y-6">
                    <div className="mb-6">
                      <h4 className="text-xl font-semibold text-white mb-2">Configuração de Impostos</h4>
                      <p className="text-slate-300 text-sm">Os impostos são calculados automaticamente baseados no regime tributário selecionado</p>
                    </div>
                    <div className="bg-gradient-to-br from-amber-900/40 to-yellow-800/30 border border-amber-500/40 rounded-2xl p-8 shadow-xl">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-3 h-3 bg-amber-400 rounded-full animate-pulse"></div>
                        <h5 className="text-xl font-bold text-amber-100">📊 Regime: {vendasData.regimeTributario.replace('_', ' ')}</h5>
                      </div>
                      <div className="text-center">
                        <div className="text-4xl font-black text-amber-300 mb-2">
                          {vendasData.regimeTributario === 'LUCRO_PRESUMIDO' ? '11.33%' : 
                           vendasData.regimeTributario === 'LUCRO_REAL' ? '15.00%' : '8.00%'}
                        </div>
                        <div className="text-amber-200 text-sm">Total de Impostos</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Aba Despesas */}
                {currentVendasTab === 'despesas' && (
                  <div className="space-y-6">
                    <div className="mb-6">
                      <h4 className="text-xl font-semibold text-white mb-2">Despesas Adicionais</h4>
                      <p className="text-slate-300 text-sm">Informe as despesas adicionais relacionadas ao produto</p>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-bold text-slate-100 mb-3">🚚 Frete de Compra (total)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={vendasData.frete}
                          onChange={(e) => setVendasData(prev => ({ ...prev, frete: parseFloat(e.target.value) || 0 }))}
                          placeholder="23,00"
                          className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium text-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-100 mb-3">📋 Outras Despesas de Compra</label>
                        <input
                          type="number"
                          step="0.01"
                          value={vendasData.outrasDesp}
                          onChange={(e) => setVendasData(prev => ({ ...prev, outrasDesp: parseFloat(e.target.value) || 0 }))}
                          placeholder="0,00"
                          className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium text-lg"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Aba Margem */}
                {currentVendasTab === 'margem' && (
                  <div className="space-y-6">
                    <div className="mb-6">
                      <h4 className="text-xl font-semibold text-white mb-2">Configuração de Margem</h4>
                      <p className="text-slate-300 text-sm">Defina a margem de lucro desejada para o produto</p>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-100 mb-3">📈 Margem de Lucro Desejada (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={vendasData.margemLucro}
                        onChange={(e) => setVendasData(prev => ({ ...prev, margemLucro: parseFloat(e.target.value) || 0 }))}
                        placeholder="30"
                        className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all font-medium text-lg"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Botão Calcular para Vendas */}
              <button
                type="button"
                onClick={calcularVendas}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:scale-[1.02] border border-blue-500/30"
              >
                <Calculator className="w-6 h-6" />
                <span className="text-lg">💰 Calcular Preço de Venda</span>
              </button>
            </div>
          )}
          {/* Formulário de Locação */}
          {currentTab === 'locacao' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 border border-green-500/30 rounded-xl p-6 shadow-lg">
                <h4 className="text-green-300 font-bold text-lg mb-2">🏠 Calculadora de Locação</h4>
                <p className="text-green-200/80 text-sm">Configure todos os parâmetros para cálculo preciso da locação</p>
              </div>

              {/* Abas de Locação */}
              <div className="grid grid-cols-4 gap-2 bg-slate-800/60 backdrop-blur-sm rounded-xl p-2 border border-slate-600/30">
                <button
                  type="button"
                  onClick={() => setCurrentLocacaoTab('ativo')}
                  className={`py-4 px-4 rounded-lg text-sm font-bold transition-all duration-300 ${
                    currentLocacaoTab === 'ativo'
                      ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg shadow-green-500/25 scale-105'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  🏢 Ativo
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentLocacaoTab('contrato')}
                  className={`py-4 px-4 rounded-lg text-sm font-bold transition-all duration-300 ${
                    currentLocacaoTab === 'contrato'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25 scale-105'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  📄 Contrato
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentLocacaoTab('custos')}
                  className={`py-4 px-4 rounded-lg text-sm font-bold transition-all duration-300 ${
                    currentLocacaoTab === 'custos'
                      ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg shadow-purple-500/25 scale-105'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  💰 Custos
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentLocacaoTab('financeiro')}
                  className={`py-4 px-4 rounded-lg text-sm font-bold transition-all duration-300 ${
                    currentLocacaoTab === 'financeiro'
                      ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/25 scale-105'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  📊 Financeiro
                </button>
              </div>

              {/* Conteúdo das Abas de Locação */}
              <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-600/50 rounded-xl p-6 min-h-[400px] shadow-xl">
                {/* Aba Ativo */}
                {currentLocacaoTab === 'ativo' && (
                  <div className="space-y-6">
                    <div className="mb-6">
                      <h4 className="text-xl font-semibold text-white mb-2">🏢 Dados do Ativo</h4>
                      <p className="text-slate-300 text-sm">Informações detalhadas sobre o equipamento/ativo a ser locado</p>
                    </div>

                    {/* Identificação do Ativo */}
                    <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 border border-green-500/30 rounded-xl p-6 shadow-lg">
                      <h5 className="text-green-300 font-bold text-lg mb-4">📋 Identificação do Ativo</h5>
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            🏷️ Nome do Ativo *
                          </label>
                          <input
                            type="text"
                            value={locacaoData.nomeAtivo}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, nomeAtivo: e.target.value }))}
                            placeholder="Ex: Impressora Multifuncional HP"
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            📂 Categoria
                          </label>
                          <select
                            value={locacaoData.categoria}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, categoria: e.target.value }))}
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all font-medium"
                          >
                            <option value="EQUIPAMENTO">Equipamento</option>
                            <option value="VEICULO">Veículo</option>
                            <option value="MAQUINA">Máquina Industrial</option>
                            <option value="TECNOLOGIA">Tecnologia/TI</option>
                            <option value="MOBILIARIO">Mobiliário</option>
                            <option value="OUTROS">Outros</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            🏭 Fabricante
                          </label>
                          <input
                            type="text"
                            value={locacaoData.fabricante}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, fabricante: e.target.value }))}
                            placeholder="Ex: HP, Dell, Caterpillar"
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            🔧 Modelo
                          </label>
                          <input
                            type="text"
                            value={locacaoData.modelo}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, modelo: e.target.value }))}
                            placeholder="Ex: LaserJet Pro M404n"
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            🔢 Número de Série
                          </label>
                          <input
                            type="text"
                            value={locacaoData.numeroSerie}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, numeroSerie: e.target.value }))}
                            placeholder="Ex: ABC123456789"
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            📝 Descrição do Ativo
                          </label>
                          <textarea
                            value={locacaoData.descricaoAtivo}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, descricaoAtivo: e.target.value }))}
                            placeholder="Descrição detalhada do ativo, especificações técnicas, etc."
                            rows={3}
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all font-medium resize-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Valores Financeiros */}
                    <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-500/30 rounded-xl p-6 shadow-lg">
                      <h5 className="text-blue-300 font-bold text-lg mb-4">💰 Valores Financeiros</h5>
                      
                      <div className="grid grid-cols-3 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            💰 Valor de Aquisição *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={locacaoData.valorAtivo}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, valorAtivo: e.target.value }))}
                            placeholder="50000,00"
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-lg"
                          />
                          <p className="text-slate-400 text-xs mt-1">Valor pago na compra do ativo</p>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            📉 Valor Residual
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={locacaoData.valorResidual}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, valorResidual: e.target.value }))}
                            placeholder="5000,00"
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-lg"
                          />
                          <p className="text-slate-400 text-xs mt-1">Valor estimado ao final da vida útil</p>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            ⏰ Vida Útil (meses) *
                          </label>
                          <input
                            type="number"
                            value={locacaoData.vidaUtil}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, vidaUtil: parseInt(e.target.value) || 60 }))}
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-lg"
                          />
                          <p className="text-slate-400 text-xs mt-1">Tempo total de vida útil do ativo</p>
                        </div>
                      </div>
                    </div>

                    {/* Resumo do Ativo */}
                    <div className="bg-gradient-to-br from-emerald-900/40 to-emerald-800/30 border border-emerald-500/40 rounded-2xl p-8 shadow-xl">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
                        <h5 className="text-xl font-bold text-emerald-100">📊 Resumo Financeiro do Ativo</h5>
                      </div>
                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center py-3 border-b border-emerald-500/20">
                            <span className="text-slate-200 font-medium">Valor de Aquisição:</span>
                            <span className="text-white font-bold text-lg">R$ {(parseFloat(locacaoData.valorAtivo) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-emerald-500/20">
                            <span className="text-slate-200 font-medium">Valor Residual:</span>
                            <span className="text-white font-bold text-lg">R$ {(parseFloat(locacaoData.valorResidual) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-emerald-500/20">
                            <span className="text-slate-200 font-medium">Vida Útil:</span>
                            <span className="text-white font-bold text-lg">{locacaoData.vidaUtil} meses ({(locacaoData.vidaUtil / 12).toFixed(1)} anos)</span>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="bg-gradient-to-r from-emerald-600/20 to-emerald-500/20 rounded-xl p-6">
                            <div className="text-center">
                              <div className="text-emerald-200 text-sm font-medium mb-2">📉 Depreciação Mensal</div>
                              <div className="text-3xl font-black text-emerald-100">
                                R$ {(((parseFloat(locacaoData.valorAtivo) || 0) - (parseFloat(locacaoData.valorResidual) || 0)) / locacaoData.vidaUtil).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                          </div>
                          <div className="bg-gradient-to-r from-blue-600/20 to-blue-500/20 rounded-xl p-6">
                            <div className="text-center">
                              <div className="text-blue-200 text-sm font-medium mb-2">💰 Valor Depreciável</div>
                              <div className="text-2xl font-bold text-blue-100">
                                R$ {((parseFloat(locacaoData.valorAtivo) || 0) - (parseFloat(locacaoData.valorResidual) || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Aba Contrato */}
                {currentLocacaoTab === 'contrato' && (
                  <div className="space-y-6">
                    <div className="mb-6">
                      <h4 className="text-xl font-semibold text-white mb-2">📄 Configurações do Contrato</h4>
                      <p className="text-slate-300 text-sm">Parâmetros contratuais e condições de locação</p>
                    </div>

                    {/* Tipo e Duração do Contrato */}
                    <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-500/30 rounded-xl p-6 shadow-lg">
                      <h5 className="text-blue-300 font-bold text-lg mb-4">📋 Tipo e Duração</h5>
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            📄 Tipo de Contrato
                          </label>
                          <select
                            value={locacaoData.tipoContrato}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, tipoContrato: e.target.value }))}
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                          >
                            <option value="OPERACIONAL">Leasing Operacional</option>
                            <option value="FINANCEIRO">Leasing Financeiro</option>
                            <option value="ALUGUEL">Aluguel Simples</option>
                            <option value="COMODATO">Comodato</option>
                          </select>
                          <p className="text-slate-400 text-xs mt-1">Modalidade jurídica do contrato</p>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            📅 Período do Contrato (meses) *
                          </label>
                          <input
                            type="number"
                            value={locacaoData.periodoContrato}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, periodoContrato: parseInt(e.target.value) || 36 }))}
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-lg"
                          />
                          <p className="text-slate-400 text-xs mt-1">Duração total do contrato</p>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            ⏳ Carência (meses)
                          </label>
                          <input
                            type="number"
                            value={locacaoData.carencia}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, carencia: parseInt(e.target.value) || 0 }))}
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-lg"
                          />
                          <p className="text-slate-400 text-xs mt-1">Meses sem pagamento inicial</p>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            🛡️ Garantia (meses)
                          </label>
                          <input
                            type="number"
                            value={locacaoData.garantia}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, garantia: parseInt(e.target.value) || 12 }))}
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-lg"
                          />
                          <p className="text-slate-400 text-xs mt-1">Período de garantia do equipamento</p>
                        </div>
                      </div>
                    </div>

                    {/* Reajustes e Indexadores */}
                    <div className="bg-gradient-to-br from-amber-900/30 to-yellow-800/20 border border-amber-500/30 rounded-xl p-6 shadow-lg">
                      <h5 className="text-amber-300 font-bold text-lg mb-4">📈 Reajustes e Indexadores</h5>
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            📊 Índice de Reajuste
                          </label>
                          <select
                            value={locacaoData.reajuste}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, reajuste: e.target.value }))}
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-medium"
                          >
                            <option value="IGPM">IGP-M</option>
                            <option value="IPCA">IPCA</option>
                            <option value="INPC">INPC</option>
                            <option value="CDI">CDI</option>
                            <option value="FIXO">Percentual Fixo</option>
                            <option value="NENHUM">Sem Reajuste</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            📈 Percentual de Reajuste (% a.a.)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={locacaoData.percentualReajuste}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, percentualReajuste: parseFloat(e.target.value) || 0 }))}
                            placeholder="0,00"
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-medium text-lg"
                          />
                          <p className="text-slate-400 text-xs mt-1">Apenas para percentual fixo</p>
                        </div>
                      </div>
                    </div>

                    {/* Custos de Instalação e Rescisão */}
                    <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 border border-purple-500/30 rounded-xl p-6 shadow-lg">
                      <h5 className="text-purple-300 font-bold text-lg mb-4">🔧 Custos Adicionais</h5>
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            🔧 Custo de Instalação
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={locacaoData.custoInstalacao}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, custoInstalacao: parseFloat(e.target.value) || 0 }))}
                            placeholder="0,00"
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium text-lg"
                          />
                          <p className="text-slate-400 text-xs mt-1">Custo único inicial</p>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            🔧 Custo de Desinstalação
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={locacaoData.custoDesinstalacao}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, custoDesinstalacao: parseFloat(e.target.value) || 0 }))}
                            placeholder="0,00"
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium text-lg"
                          />
                          <p className="text-slate-400 text-xs mt-1">Custo único final</p>
                        </div>
                      </div>
                    </div>

                    {/* Cláusulas de Rescisão */}
                    <div className="bg-gradient-to-br from-red-900/30 to-red-800/20 border border-red-500/30 rounded-xl p-6 shadow-lg">
                      <h5 className="text-red-300 font-bold text-lg mb-4">⚖️ Cláusulas de Rescisão</h5>
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={locacaoData.clausulaRescisao}
                              onChange={(e) => setLocacaoData(prev => ({ ...prev, clausulaRescisao: e.target.checked }))}
                              className="w-5 h-5 text-red-500 bg-slate-800 border-slate-600 rounded focus:ring-red-500 focus:ring-2"
                            />
                            <span className="text-slate-100 font-medium">Permitir Rescisão Antecipada</span>
                          </label>
                          <p className="text-slate-400 text-xs mt-2 ml-8">Cliente pode rescindir antes do prazo</p>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            💰 Multa de Rescisão (% do saldo)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={locacaoData.multaRescisao}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, multaRescisao: parseFloat(e.target.value) || 30 }))}
                            disabled={!locacaoData.clausulaRescisao}
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          <p className="text-slate-400 text-xs mt-1">Percentual sobre saldo devedor</p>
                        </div>
                      </div>
                    </div>

                    {/* Resumo do Contrato */}
                    <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/30 border border-slate-500/40 rounded-2xl p-8 shadow-xl">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                        <h5 className="text-xl font-bold text-blue-100">📄 Resumo do Contrato</h5>
                      </div>
                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">Tipo de Contrato:</span>
                            <span className="text-white font-bold">{locacaoData.tipoContrato.replace('_', ' ')}</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">Período:</span>
                            <span className="text-white font-bold">{locacaoData.periodoContrato} meses ({(locacaoData.periodoContrato / 12).toFixed(1)} anos)</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">Carência:</span>
                            <span className="text-white font-bold">{locacaoData.carencia} meses</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">Garantia:</span>
                            <span className="text-white font-bold">{locacaoData.garantia} meses</span>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">Reajuste:</span>
                            <span className="text-white font-bold">{locacaoData.reajuste}</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">Instalação:</span>
                            <span className="text-white font-bold">R$ {locacaoData.custoInstalacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">Desinstalação:</span>
                            <span className="text-white font-bold">R$ {locacaoData.custoDesinstalacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">Rescisão Antecipada:</span>
                            <span className={`font-bold ${locacaoData.clausulaRescisao ? 'text-green-300' : 'text-red-300'}`}>
                              {locacaoData.clausulaRescisao ? `Permitida (${locacaoData.multaRescisao}%)` : 'Não Permitida'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Aba Custos */}
                {currentLocacaoTab === 'custos' && (
                  <div className="space-y-6">
                    <div className="mb-6">
                      <h4 className="text-xl font-semibold text-white mb-2">💰 Custos Operacionais</h4>
                      <p className="text-slate-300 text-sm">Custos mensais de operação, manutenção e impostos</p>
                    </div>

                    {/* Custos Operacionais */}
                    <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 border border-purple-500/30 rounded-xl p-6 shadow-lg">
                      <h5 className="text-purple-300 font-bold text-lg mb-4">🔧 Custos Operacionais Mensais</h5>
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            🔧 Manutenção Preventiva/Corretiva
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={locacaoData.manutencaoMensal}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, manutencaoMensal: parseFloat(e.target.value) || 0 }))}
                            placeholder="0,00"
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium text-lg"
                          />
                          <p className="text-slate-400 text-xs mt-1">Custo mensal de manutenção</p>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            🛡️ Seguro do Equipamento
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={locacaoData.seguroMensal}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, seguroMensal: parseFloat(e.target.value) || 0 }))}
                            placeholder="0,00"
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium text-lg"
                          />
                          <p className="text-slate-400 text-xs mt-1">Seguro contra danos e roubo</p>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            ⚙️ Custos Operacionais Diversos
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={locacaoData.custosOperacionais}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, custosOperacionais: parseFloat(e.target.value) || 0 }))}
                            placeholder="0,00"
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium text-lg"
                          />
                          <p className="text-slate-400 text-xs mt-1">Energia, consumíveis, etc.</p>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            🚚 Custos Logísticos
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={locacaoData.custosLogisticos}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, custosLogisticos: parseFloat(e.target.value) || 0 }))}
                            placeholder="0,00"
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium text-lg"
                          />
                          <p className="text-slate-400 text-xs mt-1">Transporte, entrega, coleta</p>
                        </div>
                      </div>
                    </div>

                    {/* Impostos Federais */}
                    <div className="bg-gradient-to-br from-red-900/30 to-red-800/20 border border-red-500/30 rounded-xl p-6 shadow-lg">
                      <h5 className="text-red-300 font-bold text-lg mb-4">🏛️ Impostos Federais</h5>
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">PIS (%)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={locacaoData.pis}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, pis: parseFloat(e.target.value) || 0.65 }))}
                            className="w-full px-4 py-3 bg-slate-800/80 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all font-medium"
                          />
                          <p className="text-slate-400 text-xs mt-1">Programa de Integração Social</p>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">COFINS (%)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={locacaoData.cofins}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, cofins: parseFloat(e.target.value) || 3 }))}
                            className="w-full px-4 py-3 bg-slate-800/80 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all font-medium"
                          />
                          <p className="text-slate-400 text-xs mt-1">Contribuição para Financiamento da Seguridade Social</p>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">IRPJ (%)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={locacaoData.irpj}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, irpj: parseFloat(e.target.value) || 15 }))}
                            className="w-full px-4 py-3 bg-slate-800/80 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all font-medium"
                          />
                          <p className="text-slate-400 text-xs mt-1">Imposto de Renda Pessoa Jurídica</p>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">CSLL (%)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={locacaoData.csll}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, csll: parseFloat(e.target.value) || 9 }))}
                            className="w-full px-4 py-3 bg-slate-800/80 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all font-medium"
                          />
                          <p className="text-slate-400 text-xs mt-1">Contribuição Social sobre o Lucro Líquido</p>
                        </div>
                      </div>
                    </div>

                    {/* Impostos Municipais */}
                    <div className="bg-gradient-to-br from-amber-900/30 to-yellow-800/20 border border-amber-500/30 rounded-xl p-6 shadow-lg">
                      <h5 className="text-amber-300 font-bold text-lg mb-4">🏛️ Impostos Municipais</h5>
                      
                      <div className="grid grid-cols-1 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">ISS - Imposto sobre Serviços (%)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={locacaoData.iss}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, iss: parseFloat(e.target.value) || 5 }))}
                            className="w-full px-4 py-3 bg-slate-800/80 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-medium"
                          />
                          <p className="text-slate-400 text-xs mt-1">Varia de 2% a 5% conforme município</p>
                        </div>
                      </div>
                    </div>

                    {/* Resumo de Custos */}
                    <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/30 border border-slate-500/40 rounded-2xl p-8 shadow-xl">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse"></div>
                        <h5 className="text-xl font-bold text-purple-100">💰 Resumo de Custos e Impostos</h5>
                      </div>
                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <h6 className="text-lg font-bold text-slate-200 mb-4">📊 Custos Operacionais Mensais</h6>
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">Manutenção:</span>
                            <span className="text-white font-bold">R$ {locacaoData.manutencaoMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">Seguro:</span>
                            <span className="text-white font-bold">R$ {locacaoData.seguroMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">Operacionais:</span>
                            <span className="text-white font-bold">R$ {locacaoData.custosOperacionais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">Logísticos:</span>
                            <span className="text-white font-bold">R$ {locacaoData.custosLogisticos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="bg-gradient-to-r from-purple-600/20 to-purple-500/20 rounded-xl p-4 mt-6">
                            <div className="flex justify-between items-center">
                              <span className="text-purple-200 font-bold text-lg">💰 Total Custos:</span>
                              <span className="text-purple-100 font-black text-xl">R$ {(locacaoData.manutencaoMensal + locacaoData.seguroMensal + locacaoData.custosOperacionais + locacaoData.custosLogisticos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <h6 className="text-lg font-bold text-slate-200 mb-4">📊 Carga Tributária</h6>
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">PIS:</span>
                            <span className="text-white font-bold">{locacaoData.pis.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">COFINS:</span>
                            <span className="text-white font-bold">{locacaoData.cofins.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">IRPJ:</span>
                            <span className="text-white font-bold">{locacaoData.irpj.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">CSLL:</span>
                            <span className="text-white font-bold">{locacaoData.csll.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">ISS:</span>
                            <span className="text-white font-bold">{locacaoData.iss.toFixed(2)}%</span>
                          </div>
                          <div className="bg-gradient-to-r from-red-600/20 to-red-500/20 rounded-xl p-4 mt-6">
                            <div className="flex justify-between items-center">
                              <span className="text-red-200 font-bold text-lg">📊 Total Impostos:</span>
                              <span className="text-red-100 font-black text-xl">{(locacaoData.pis + locacaoData.cofins + locacaoData.irpj + locacaoData.csll + locacaoData.iss).toFixed(2)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Aba Financeiro */}
                {currentLocacaoTab === 'financeiro' && (
                  <div className="space-y-6">
                    <div className="mb-6">
                      <h4 className="text-xl font-semibold text-white mb-2">📊 Parâmetros Financeiros</h4>
                      <p className="text-slate-300 text-sm">Configurações financeiras para cálculo de rentabilidade e precificação</p>
                    </div>

                    {/* Taxas de Juros e Custo de Capital */}
                    <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/20 border border-emerald-500/30 rounded-xl p-6 shadow-lg">
                      <h5 className="text-emerald-300 font-bold text-lg mb-4">💹 Custo de Capital e Financiamento</h5>
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            📈 Taxa de Juros Mensal (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={locacaoData.taxaJurosMensal}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, taxaJurosMensal: parseFloat(e.target.value) || 1.5 }))}
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium text-lg"
                          />
                          <p className="text-slate-400 text-xs mt-1">Taxa de financiamento do ativo</p>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            💰 Custo de Capital Anual (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={locacaoData.custoCapital}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, custoCapital: parseFloat(e.target.value) || 12 }))}
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium text-lg"
                          />
                          <p className="text-slate-400 text-xs mt-1">WACC - Custo médio ponderado de capital</p>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            ⚠️ Taxa de Risco Padrão (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={locacaoData.riscoPadrao}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, riscoPadrao: parseFloat(e.target.value) || 2 }))}
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium text-lg"
                          />
                          <p className="text-slate-400 text-xs mt-1">Prêmio de risco do negócio</p>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            📊 Inflação Anual Esperada (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={locacaoData.inflacaoAnual}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, inflacaoAnual: parseFloat(e.target.value) || 4.5 }))}
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium text-lg"
                          />
                          <p className="text-slate-400 text-xs mt-1">Meta de inflação para ajustes</p>
                        </div>
                      </div>
                    </div>

                    {/* Taxas Administrativas e Margem */}
                    <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-500/30 rounded-xl p-6 shadow-lg">
                      <h5 className="text-blue-300 font-bold text-lg mb-4">🏦 Taxas Administrativas e Margem</h5>
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            🏦 Taxa de Administração (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={locacaoData.taxaAdministracao}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, taxaAdministracao: parseFloat(e.target.value) || 5 }))}
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-lg"
                          />
                          <p className="text-slate-400 text-xs mt-1">Taxa sobre a mensalidade</p>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-100 mb-3">
                            💰 Margem de Lucro Desejada (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={locacaoData.margemLucro}
                            onChange={(e) => setLocacaoData(prev => ({ ...prev, margemLucro: parseFloat(e.target.value) || 20 }))}
                            className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-lg"
                          />
                          <p className="text-slate-400 text-xs mt-1">Margem líquida desejada</p>
                        </div>
                      </div>
                    </div>

                    {/* Indicadores Financeiros Calculados */}
                    <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/30 border border-slate-500/40 rounded-2xl p-8 shadow-xl">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-3 h-3 bg-amber-400 rounded-full animate-pulse"></div>
                        <h5 className="text-xl font-bold text-amber-100">📊 Indicadores Financeiros</h5>
                      </div>
                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <h6 className="text-lg font-bold text-slate-200 mb-4">💹 Taxas e Custos</h6>
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">Taxa de Juros Mensal:</span>
                            <span className="text-white font-bold">{locacaoData.taxaJurosMensal}%</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">Taxa de Juros Anual:</span>
                            <span className="text-white font-bold">{(Math.pow(1 + locacaoData.taxaJurosMensal * 0.01, 12) * 100 - 100).toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">Custo de Capital:</span>
                            <span className="text-white font-bold">{locacaoData.custoCapital}% a.a.</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">Taxa de Risco:</span>
                            <span className="text-white font-bold">{locacaoData.riscoPadrao}%</span>
                          </div>
                          <div className="bg-gradient-to-r from-emerald-600/20 to-emerald-500/20 rounded-xl p-4 mt-6">
                            <div className="flex justify-between items-center">
                              <span className="text-emerald-200 font-bold text-lg">💰 Taxa Hurdle:</span>
                              <span className="text-emerald-100 font-black text-xl">{(locacaoData.custoCapital + locacaoData.riscoPadrao).toFixed(2)}%</span>
                            </div>
                            <p className="text-emerald-200/80 text-xs mt-1">Taxa mínima de retorno exigida</p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <h6 className="text-lg font-bold text-slate-200 mb-4">📈 Margens e Administração</h6>
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">Taxa de Administração:</span>
                            <span className="text-white font-bold">{locacaoData.taxaAdministracao}%</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">Margem de Lucro:</span>
                            <span className="text-white font-bold">{locacaoData.margemLucro}%</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">Inflação Esperada:</span>
                            <span className="text-white font-bold">{locacaoData.inflacaoAnual}% a.a.</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-slate-500/20">
                            <span className="text-slate-200 font-medium">Taxa Real (descontada inflação):</span>
                            <span className="text-white font-bold">{(locacaoData.custoCapital - locacaoData.inflacaoAnual).toFixed(2)}%</span>
                          </div>
                          <div className="bg-gradient-to-r from-blue-600/20 to-blue-500/20 rounded-xl p-4 mt-6">
                            <div className="flex justify-between items-center">
                              <span className="text-blue-200 font-bold text-lg">📊 Margem Total:</span>
                              <span className="text-blue-100 font-black text-xl">{(locacaoData.margemLucro + locacaoData.taxaAdministracao).toFixed(2)}%</span>
                            </div>
                            <p className="text-blue-200/80 text-xs mt-1">Margem + Taxa administrativa</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Simulação de Cenários */}
                    <div className="bg-gradient-to-br from-indigo-900/30 to-indigo-800/20 border border-indigo-500/30 rounded-xl p-6 shadow-lg">
                      <h5 className="text-indigo-300 font-bold text-lg mb-4">🎯 Simulação de Cenários</h5>
                      
                      <div className="grid grid-cols-3 gap-6">
                        <div className="text-center bg-slate-700/40 rounded-xl p-6 border border-slate-600/30">
                          <div className="text-green-300 text-sm font-medium mb-2">🟢 Cenário Otimista</div>
                          <div className="text-2xl font-bold text-green-200 mb-1">
                            {(locacaoData.margemLucro * 1.2).toFixed(1)}%
                          </div>
                          <div className="text-slate-400 text-xs">Margem +20%</div>
                        </div>
                        
                        <div className="text-center bg-slate-700/40 rounded-xl p-6 border border-slate-600/30">
                          <div className="text-blue-300 text-sm font-medium mb-2">🔵 Cenário Realista</div>
                          <div className="text-2xl font-bold text-blue-200 mb-1">
                            {locacaoData.margemLucro.toFixed(1)}%
                          </div>
                          <div className="text-slate-400 text-xs">Margem Base</div>
                        </div>
                        
                        <div className="text-center bg-slate-700/40 rounded-xl p-6 border border-slate-600/30">
                          <div className="text-red-300 text-sm font-medium mb-2">🔴 Cenário Pessimista</div>
                          <div className="text-2xl font-bold text-red-200 mb-1">
                            {(locacaoData.margemLucro * 0.8).toFixed(1)}%
                          </div>
                          <div className="text-slate-400 text-xs">Margem -20%</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                        <div className="flex justify-between items-center py-3 border-b border-emerald-500/20">
                          <span className="text-slate-200 font-medium">Margem de Lucro:</span>
                          <span className="text-white font-bold text-lg">{locacaoData.margemLucro}%</span>
                        </div>
                        <div className="bg-gradient-to-r from-emerald-600/20 to-emerald-500/20 rounded-xl p-4 mt-6">
                          <div className="flex justify-between items-center">
                            <span className="text-emerald-200 font-bold text-lg">Taxa Anual Equivalente:</span>
                            <span className="text-emerald-100 font-black text-2xl">{((Math.pow(1 + locacaoData.taxaJurosMensal * 0.01, 12) - 1) * 100).toFixed(2)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Formulário de Serviços */}
          {currentTab === 'servicos' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 border border-purple-500/30 rounded-xl p-6 shadow-lg">
                <h4 className="text-purple-300 font-bold text-lg mb-2">🔧 Parâmetros do Projeto</h4>
                <p className="text-purple-200/80 text-sm">Configure horas, recursos e complexidade do serviço</p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-100 mb-3">⏱️ Horas Estimadas *</label>
                  <input
                    type="number"
                    step="0.5"
                    value={servicosData.horasEstimadas}
                    onChange={(e) => setServicosData(prev => ({ ...prev, horasEstimadas: e.target.value }))}
                    placeholder="40"
                    className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium text-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-100 mb-3">💰 Valor Hora Técnico (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={servicosData.valorHoraTecnico}
                    onChange={(e) => setServicosData(prev => ({ ...prev, valorHoraTecnico: e.target.value }))}
                    placeholder="80,00"
                    className="w-full px-5 py-4 bg-slate-800/80 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium text-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Botão Calcular para Locação e Serviços */}
          {(currentTab === 'locacao' || currentTab === 'servicos') && (
            <button
              onClick={executarCalculo}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:scale-[1.02] border border-blue-500/30"
            >
              <Calculator className="w-6 h-6" />
              <span className="text-lg">
                {currentTab === 'locacao' ? '🏠 Calcular Preço de Locação' : '🔧 Calcular Preço do Serviço'}
              </span>
            </button>
          )}
          </div>
          
          {/* Resultados */}
          {resultadoCalculo && (
            <div className="bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-xl rounded-2xl p-10 border border-slate-600/40 shadow-2xl">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <TrendingUp className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h4 className="text-2xl font-bold text-emerald-100">🎯 Resultado da Precificação</h4>
                  <p className="text-slate-300 text-sm">Cálculo realizado com sucesso</p>
                </div>
              </div>

              {/* Resultado Vendas */}
              {resultadoCalculo.tipo === 'vendas' && (
                <div>
                  <div className="text-center mb-8 bg-gradient-to-br from-blue-900/40 to-blue-800/30 rounded-2xl p-8 border border-blue-500/30">
                    <div className="text-slate-300 text-sm font-medium mb-2">💰 Preço de Venda Sugerido</div>
                    <div className="text-5xl font-black text-blue-300 mb-2">
                      R$ {resultadoCalculo.precoVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-blue-200 text-sm font-semibold">📊 Markup: {resultadoCalculo.markup.toFixed(1)}%</div>
                  </div>
                  <div className="grid grid-cols-3 gap-6 mb-6">
                    <div className="text-center bg-slate-700/40 rounded-xl p-6 border border-slate-600/30">
                      <div className="text-2xl font-bold text-white mb-1">
                        R$ {resultadoCalculo.custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-slate-300 text-sm font-medium">💰 Custo Total</div>
                    </div>
                    <div className="text-center bg-slate-700/40 rounded-xl p-6 border border-slate-600/30">
                      <div className="text-2xl font-bold text-red-300 mb-1">
                        R$ {resultadoCalculo.impostos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-slate-300 text-sm font-medium">📊 Impostos</div>
                    </div>
                    <div className="text-center bg-slate-700/40 rounded-xl p-6 border border-slate-600/30">
                      <div className="text-2xl font-bold text-green-300 mb-1">
                        R$ {resultadoCalculo.lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-slate-300 text-sm font-medium">📈 Lucro Líquido</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Resultado Locação */}
              {resultadoCalculo.tipo === 'locacao' && (
                <div>
                  <div className="text-center mb-8 bg-gradient-to-br from-green-900/40 to-green-800/30 rounded-2xl p-8 border border-green-500/30">
                    <div className="text-slate-300 text-sm font-medium mb-2">🏠 Valor Mensal de Locação</div>
                    <div className="text-5xl font-black text-green-300 mb-2">
                      R$ {resultadoCalculo.precoLocacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-green-200 text-sm font-semibold">📊 ROI Anual: {resultadoCalculo.roi.toFixed(1)}% | TIR: {resultadoCalculo.tir.toFixed(1)}%</div>
                  </div>

                  {/* Indicadores Principais */}
                  <div className="grid grid-cols-4 gap-6 mb-8">
                    <div className="text-center bg-slate-700/40 rounded-xl p-6 border border-slate-600/30">
                      <div className="text-2xl font-bold text-green-300 mb-1">
                        R$ {resultadoCalculo.lucroLiquidoMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-slate-300 text-sm font-medium">💰 Lucro Líquido Mensal</div>
                    </div>
                    <div className="text-center bg-slate-700/40 rounded-xl p-6 border border-slate-600/30">
                      <div className="text-2xl font-bold text-blue-300 mb-1">
                        {resultadoCalculo.payback.toFixed(1)} anos
                      </div>
                      <div className="text-slate-300 text-sm font-medium">⏰ Payback</div>
                    </div>
                    <div className="text-center bg-slate-700/40 rounded-xl p-6 border border-slate-600/30">
                      <div className="text-2xl font-bold text-purple-300 mb-1">
                        R$ {resultadoCalculo.vpl.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                      </div>
                      <div className="text-slate-300 text-sm font-medium">📈 VPL</div>
                    </div>
                    <div className="text-center bg-slate-700/40 rounded-xl p-6 border border-slate-600/30">
                      <div className="text-2xl font-bold text-amber-300 mb-1">
                        {resultadoCalculo.margemSeguranca.toFixed(1)}%
                      </div>
                      <div className="text-slate-300 text-sm font-medium">🛡️ Margem de Segurança</div>
                    </div>
                  </div>

                  {/* Análise Detalhada */}
                  <div className="grid grid-cols-2 gap-8 mb-8">
                    {/* Composição de Custos */}
                    <div className="bg-slate-700/40 rounded-xl p-6 border border-slate-600/30">
                      <h6 className="text-lg font-bold text-slate-200 mb-4">📊 Composição de Custos</h6>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-300">Depreciação:</span>
                          <span className="text-white font-bold">{resultadoCalculo.composicao.depreciacao.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-300">Custos Operacionais:</span>
                          <span className="text-white font-bold">{resultadoCalculo.composicao.custosOperacionais.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-300">Custo de Capital:</span>
                          <span className="text-white font-bold">{resultadoCalculo.composicao.custoCapital.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-300">Taxa Administrativa:</span>
                          <span className="text-white font-bold">{resultadoCalculo.composicao.taxaAdmin.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-300">Impostos:</span>
                          <span className="text-white font-bold">{resultadoCalculo.composicao.impostos.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-slate-600/30">
                          <span className="text-green-300 font-bold">Lucro Líquido:</span>
                          <span className="text-green-300 font-bold">{resultadoCalculo.composicao.lucro.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Detalhamento de Impostos */}
                    <div className="bg-slate-700/40 rounded-xl p-6 border border-slate-600/30">
                      <h6 className="text-lg font-bold text-slate-200 mb-4">🏛️ Detalhamento de Impostos</h6>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-300">ISS:</span>
                          <span className="text-white font-bold">R$ {resultadoCalculo.detalhesImpostos.iss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-300">PIS:</span>
                          <span className="text-white font-bold">R$ {resultadoCalculo.detalhesImpostos.pis.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-300">COFINS:</span>
                          <span className="text-white font-bold">R$ {resultadoCalculo.detalhesImpostos.cofins.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-300">IRPJ:</span>
                          <span className="text-white font-bold">R$ {resultadoCalculo.detalhesImpostos.irpj.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-300">CSLL:</span>
                          <span className="text-white font-bold">R$ {resultadoCalculo.detalhesImpostos.csll.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-slate-600/30">
                          <span className="text-red-300 font-bold">Total Impostos:</span>
                          <span className="text-red-300 font-bold">R$ {resultadoCalculo.detalhesImpostos.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Análise de Viabilidade */}
                  <div className="bg-gradient-to-br from-indigo-900/40 to-indigo-800/30 border border-indigo-500/40 rounded-2xl p-8 shadow-xl">
                    <h6 className="text-xl font-bold text-indigo-100 mb-6">🎯 Análise de Viabilidade</h6>
                    <div className="grid grid-cols-3 gap-8">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-indigo-300 mb-2">
                          R$ {resultadoCalculo.receitaAnual.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                        </div>
                        <div className="text-indigo-200 text-sm font-medium">💰 Receita Anual</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-indigo-300 mb-2">
                          {resultadoCalculo.giroAtivo.toFixed(2)}x
                        </div>
                        <div className="text-indigo-200 text-sm font-medium">🔄 Giro do Ativo</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-indigo-300 mb-2">
                          R$ {resultadoCalculo.breakEvenMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-indigo-200 text-sm font-medium">⚖️ Break-Even</div>
                      </div>
                    </div>
                    
                    {/* Indicador de Viabilidade */}
                    <div className="mt-8 p-6 rounded-xl border-2 border-dashed" style={{
                      borderColor: resultadoCalculo.vpl > 0 ? '#10b981' : resultadoCalculo.vpl > -10000 ? '#f59e0b' : '#ef4444',
                      backgroundColor: resultadoCalculo.vpl > 0 ? 'rgba(16, 185, 129, 0.1)' : resultadoCalculo.vpl > -10000 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)'
                    }}>
                      <div className="text-center">
                        <div className="text-2xl font-bold mb-2" style={{
                          color: resultadoCalculo.vpl > 0 ? '#10b981' : resultadoCalculo.vpl > -10000 ? '#f59e0b' : '#ef4444'
                        }}>
                          {resultadoCalculo.vpl > 0 ? '✅ PROJETO VIÁVEL' : resultadoCalculo.vpl > -10000 ? '⚠️ PROJETO MARGINAL' : '❌ PROJETO INVIÁVEL'}
                        </div>
                        <div className="text-slate-300 text-sm">
                          {resultadoCalculo.vpl > 0 
                            ? 'VPL positivo indica que o projeto gerará valor para a empresa'
                            : resultadoCalculo.vpl > -10000 
                            ? 'VPL próximo de zero - revisar parâmetros para melhorar viabilidade'
                            : 'VPL negativo - projeto não é recomendado nas condições atuais'
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Resultado Serviços */}
              {resultadoCalculo.tipo === 'servicos' && (
                <div>
                  <div className="text-center mb-8 bg-gradient-to-br from-purple-900/40 to-purple-800/30 rounded-2xl p-8 border border-purple-500/30">
                    <div className="text-slate-300 text-sm font-medium mb-2">🔧 Preço do Serviço</div>
                    <div className="text-5xl font-black text-purple-300 mb-2">
                      R$ {resultadoCalculo.precoServico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-purple-200 text-sm font-semibold">
                      💰 R$ {resultadoCalculo.valorHoraEfetivo.toFixed(2)}/hora efetiva
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-4 pt-8 border-t border-slate-600/30">
            <button
              onClick={() => {
                setShowModal(false);
                resetForm();
              }}
              className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl transition-all duration-300 border border-slate-600/50 hover:border-slate-500/50"
            >
              Fechar
            </button>
            {resultadoCalculo && (
              <button
                onClick={() => {
                  console.log('Salvar resultado:', resultadoCalculo);
                }}
                className="px-8 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl border border-green-500/30"
              >
                💾 Salvar Resultado
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}