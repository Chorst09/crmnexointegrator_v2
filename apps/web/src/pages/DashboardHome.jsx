import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  FileText,
  Calculator,
  TrendingUp,
  Users,
  Target,
  Zap,
  ArrowRight,
  CheckCircle2,
  Crown,
  Sparkles,
  Briefcase,
  Landmark,
  BarChart3,
  ClipboardList,
  Handshake,
  FileSignature,
  Brain,
  Workflow,
  Package,
  Trophy,
  Shield,
  Rocket
} from 'lucide-react';
import { getDefaultRouteForUser } from '../utils/permissions';

export default function DashboardHome() {
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const userRaw = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      
      // Se já estiver logado, redireciona para a primeira área permitida.
      if (userRaw && token) {
        const parsed = JSON.parse(userRaw);
        navigate(getDefaultRouteForUser(parsed));
      }
    } catch {
      // Ignora erro de parse ou armazenamento privado
    }
  }, [navigate]);

  const products = [
    {
      id: 'b2b',
      name: 'B2B Privado',
      tagline: 'Vendas Corporativas',
      description: 'Gestão completa do ciclo de vendas para empresas privadas, desde a prospecção até o fechamento e pós-venda',
      longDescription: 'Plataforma completa para gestão de vendas B2B com pipeline visual, automação de processos, gestão de propostas e contratos. Acompanhe cada oportunidade desde o primeiro contato até o fechamento.',
      icon: Building2,
      gradient: 'from-orange-500 via-cyan-400 to-teal-500',
      bgGradient: 'radial-gradient(ellipse at 0% 0%, rgba(125, 54, 18, 0.22) 0%, transparent 46%), radial-gradient(ellipse at 100% 0%, rgba(34, 211, 238, 0.18) 0%, transparent 50%)',
      features: [
        { icon: Target, text: 'Pipeline visual de vendas' },
        { icon: Briefcase, text: 'Gestão de oportunidades' },
        { icon: Building2, text: 'Cadastro de empresas e contatos' },
        { icon: FileSignature, text: 'Propostas comerciais' },
        { icon: Handshake, text: 'Contratos e pós-venda' },
        { icon: TrendingUp, text: 'Análise de performance' }
      ],
      stats: [
        { label: 'Oportunidades', value: '127', trend: '+12%' },
        { label: 'Taxa Conversão', value: '8.4%', trend: '+2.1%' },
        { label: 'Ticket Médio', value: 'R$ 23k', trend: '+5%' }
      ],
      route: '/oportunidades',
      accessKey: 'accessB2B',
      imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop&q=80'
    },
    {
      id: 'b2g',
      name: 'B2G Governo',
      tagline: 'Licitações e Editais',
      description: 'Gestão especializada de licitações, editais e oportunidades com órgãos públicos federais, estaduais e municipais',
      longDescription: 'Sistema completo para monitoramento de editais, análise de viabilidade com IA, gestão documental e acompanhamento de atas de registro de preços. Maximize suas chances de sucesso em licitações.',
      icon: Landmark,
      gradient: 'from-amber-400 via-cyan-400 to-sky-500',
      bgGradient: 'radial-gradient(ellipse at 0% 0%, rgba(245, 158, 11, 0.18) 0%, transparent 45%), radial-gradient(ellipse at 100% 0%, rgba(14, 165, 233, 0.18) 0%, transparent 50%)',
      features: [
        { icon: FileText, text: 'Monitoramento de editais' },
        { icon: Brain, text: 'Análise com IA' },
        { icon: ClipboardList, text: 'Gestão de documentação' },
        { icon: Landmark, text: 'Atas de registro de preços' },
        { icon: Workflow, text: 'Fluxo de atividades' },
        { icon: BarChart3, text: 'Relatórios estratégicos' }
      ],
      stats: [
        { label: 'Editais Ativos', value: '43', trend: '+8' },
        { label: 'Taxa Sucesso', value: '32%', trend: '+7%' },
        { label: 'Atas Vigentes', value: '12', trend: '+3' }
      ],
      route: '/b2g-dashboard',
      accessKey: 'accessB2G',
      imageUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&h=600&fit=crop&q=80'
    },
    {
      id: 'management',
      name: 'Gestão Comercial',
      tagline: 'Controle e Performance',
      description: 'Ferramentas completas para gestão de equipe, produtos, comissões, metas e análise de performance comercial',
      longDescription: 'Centralize a gestão da sua operação comercial com controle de produtos, equipe de vendas, comissões, metas e relatórios avançados. Tome decisões baseadas em dados.',
      icon: BarChart3,
      gradient: 'from-cyan-400 via-teal-400 to-orange-400',
      bgGradient: 'radial-gradient(ellipse at 0% 0%, rgba(20, 184, 166, 0.18) 0%, transparent 46%), radial-gradient(ellipse at 100% 0%, rgba(255, 122, 0, 0.16) 0%, transparent 48%)',
      features: [
        { icon: Package, text: 'Catálogo de produtos' },
        { icon: Users, text: 'Gestão de vendedores' },
        { icon: Trophy, text: 'Metas e performance' },
        { icon: TrendingUp, text: 'Comissões' },
        { icon: BarChart3, text: 'Relatórios avançados' },
        { icon: Workflow, text: 'Automações' }
      ],
      stats: [
        { label: 'Vendedores', value: '24', trend: '+3' },
        { label: 'Meta Mensal', value: '87%', trend: '+12%' },
        { label: 'Produtos', value: '156', trend: '+8' }
      ],
      route: '/vendedores',
      accessKey: 'accessB2B',
      imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop&q=80'
    },
    {
      id: 'presales',
      name: 'Pré-Vendas',
      tagline: 'Suporte Técnico-Comercial',
      description: 'Suporte especializado para análise técnica, dimensionamento de soluções e elaboração de orçamentos complexos',
      longDescription: 'Equipe de pré-vendas com ferramentas especializadas para análise técnica, calculadoras de dimensionamento e gestão de solicitações. Acelere o processo comercial com suporte técnico qualificado.',
      icon: Calculator,
      gradient: 'from-rose-400 via-orange-400 to-cyan-400',
      bgGradient: 'radial-gradient(ellipse at 0% 0%, rgba(190, 24, 93, 0.14) 0%, transparent 45%), radial-gradient(ellipse at 100% 0%, rgba(34, 211, 238, 0.18) 0%, transparent 52%)',
      features: [
        { icon: ClipboardList, text: 'Solicitações de orçamento' },
        { icon: Calculator, text: 'Calculadoras especializadas' },
        { icon: Brain, text: 'Análise técnica' },
        { icon: Target, text: 'Dimensionamento' },
        { icon: Zap, text: 'Respostas rápidas' },
        { icon: Handshake, text: 'Suporte à vendas' }
      ],
      stats: [
        { label: 'Solicitações', value: '15', trend: '+5' },
        { label: 'Tempo Resposta', value: '2.3h', trend: '-0.5h' },
        { label: 'Aprovação', value: '94%', trend: '+3%' }
      ],
      route: '/pre-vendas',
      accessKey: 'accessPreSales',
      imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop&q=80'
    }
  ];

  const plans = [
    {
      id: 'b2b',
      name: 'B2B Privado',
      price: 'R$ 98',
      period: '/mês',
      description: 'Gestão completa de vendas corporativas',
      icon: Building2,
      features: [
        'Pipeline visual de vendas',
        'Gestão de oportunidades',
        'Cadastro de empresas e contatos',
        'Propostas e contratos',
        'Relatórios e análise de performance'
      ],
      highlight: false
    },
    {
      id: 'b2g',
      name: 'B2G Governo',
      price: 'R$ 110,90',
      period: '/mês',
      description: 'Licitações e oportunidades públicas',
      icon: Landmark,
      features: [
        'Monitoramento de editais',
        'Análise com IA',
        'Gestão de documentação',
        'Atas de registro de preços',
        'Relatórios estratégicos'
      ],
      highlight: false
    },
    {
      id: 'presales',
      name: 'Pré-Vendas',
      price: 'R$ 105,90',
      period: '/mês',
      description: 'Suporte técnico-comercial especializado',
      icon: Calculator,
      features: [
        'Solicitações de orçamento',
        'Calculadoras especializadas',
        'Análise técnica',
        'Dimensionamento de soluções',
        'Registro de oportunidades'
      ],
      highlight: false
    },
    {
      id: 'management',
      name: 'Gestão',
      price: 'R$ 129,90',
      period: '/mês',
      description: 'Projetos, kickoff e operação em uma visão única',
      icon: Workflow,
      features: [
        'Gestão de projetos e fases',
        'Kickoff interno e externo',
        'Painéis executivos por projeto',
        'Acompanhamentos e responsáveis',
        'Relatórios operacionais'
      ],
      highlight: false
    },
    {
      id: 'automation',
      name: 'Automações',
      price: 'R$ 149,90',
      period: '/mês',
      description: 'Workflows, gatilhos e integrações para escalar processos',
      icon: Zap,
      features: [
        'Construtor de workflows',
        'Gatilhos por evento e data',
        'Ações automáticas',
        'Integrações com sistemas externos',
        'Monitoramento de execuções'
      ],
      highlight: false
    },
    {
      id: 'completo',
      name: 'Plano Completo',
      price: 'R$ 289,90',
      period: '/mês',
      description: 'Todos os módulos em um único plano',
      icon: Crown,
      features: [
        'B2B + B2G + Pré-Vendas + Gestão + Automações',
        'Usuários ilimitados',
        'Suporte prioritário',
        'Relatórios avançados',
        'Integrações API'
      ],
      highlight: true
    }
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_0%_0%,rgba(125,54,18,0.46)_0%,rgba(66,20,22,0.30)_18%,transparent_42%),radial-gradient(ellipse_at_94%_4%,rgba(31,112,124,0.46)_0%,rgba(15,58,66,0.25)_24%,transparent_48%),radial-gradient(ellipse_at_43%_100%,rgba(13,67,94,0.34)_0%,transparent_44%),linear-gradient(180deg,#07080f_0%,#080a12_52%,#07111b_100%)] text-[var(--crm-ink)]">
      {/* Header/Navbar */}
      <header className="border-b border-[#0b2a35]/70 bg-[#070a12]/78 backdrop-blur-2xl">
        <div className="container mx-auto flex items-center justify-between px-4 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-200/18 bg-[linear-gradient(135deg,#242230_0%,#0b2430_54%,#8a3f17_100%)] text-white font-bold shadow-[0_14px_34px_-24px_rgba(34,211,238,0.75)]">
              CRM
            </div>
            <div>
              <div className="text-lg font-bold text-white">CRM NEXOS</div>
              <div className="text-xs text-slate-400">Gestão Comercial Completa</div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="rounded-xl border border-cyan-200/28 bg-[#07111d]/72 px-6 py-2 font-semibold text-cyan-100 transition-all hover:border-cyan-200/50 hover:bg-[#102033]/84"
            >
              Entrar
            </button>
            <button
              onClick={() => document.getElementById('plans-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="rounded-xl bg-[linear-gradient(105deg,#ff7a00_0%,#35c2d8_58%,#123348_100%)] px-6 py-2 font-semibold text-[#07111b] shadow-[0_16px_36px_-24px_rgba(255,122,0,0.75)] transition-all hover:scale-105 hover:shadow-xl"
            >
              Ver Planos
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto space-y-16 px-4 py-12 lg:px-8 lg:py-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-cyan-200/14 bg-[radial-gradient(ellipse_at_0%_0%,rgba(125,54,18,0.58)_0%,rgba(66,20,22,0.28)_24%,transparent_50%),radial-gradient(ellipse_at_92%_0%,rgba(35,196,218,0.42)_0%,rgba(15,58,66,0.24)_28%,transparent_55%),radial-gradient(ellipse_at_48%_100%,rgba(12,67,94,0.48)_0%,transparent_46%),linear-gradient(135deg,#07080f_0%,#080a12_48%,#071b25_100%)] p-8 text-white shadow-[0_28px_70px_-44px_rgba(34,211,238,0.55)] lg:p-16">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30" />
        <div className="absolute inset-x-16 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(125,238,255,0.42),transparent)]" />
        
        <div className="relative z-10 grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/16 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-cyan-50 backdrop-blur-sm">
              <Rocket className="h-4 w-4" />
              Plataforma Completa de CRM
            </div>
            
            <h1 className="mt-6 text-4xl font-black leading-tight lg:text-6xl">
              Gestão Comercial Completa para B2B e B2G
            </h1>
            
            <p className="mt-4 text-lg text-white/90 lg:text-xl">
              Conecte sua equipe, processos e resultados. Gerencie vendas corporativas, licitações públicas e pré-vendas em uma única plataforma integrada.
            </p>
            
            <div className="mt-8 flex flex-wrap gap-4">
              <button
                onClick={() => document.getElementById('plans-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="rounded-xl bg-white px-8 py-4 font-semibold text-[#07111b] transition-all hover:scale-105 hover:shadow-xl"
              >
                Ver Planos
              </button>
              <button
                className="rounded-xl border border-cyan-100/26 bg-white/[0.06] px-8 py-4 font-semibold backdrop-blur-sm transition-all hover:bg-white/[0.12]"
              >
                Ver Demonstração
              </button>
            </div>
          </div>
          
          <div className="hidden lg:block">
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-[linear-gradient(135deg,rgba(255,122,0,0.18),rgba(34,211,238,0.16))] backdrop-blur-xl" />
              <div className="relative rounded-3xl border border-cyan-200/16 bg-[#07111d]/46 p-8 backdrop-blur-xl">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.10] p-4 backdrop-blur-sm">
                    <div className="text-3xl font-black">127</div>
                    <div className="mt-1 text-sm text-white/80">Oportunidades</div>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.10] p-4 backdrop-blur-sm">
                    <div className="text-3xl font-black">43</div>
                    <div className="mt-1 text-sm text-white/80">Editais</div>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.10] p-4 backdrop-blur-sm">
                    <div className="text-3xl font-black">8.4%</div>
                    <div className="mt-1 text-sm text-white/80">Conversão</div>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.10] p-4 backdrop-blur-sm">
                    <div className="text-3xl font-black">24</div>
                    <div className="mt-1 text-sm text-white/80">Vendedores</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section>
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-black text-[var(--crm-ink)]">Nossos Módulos</h2>
          <p className="mt-2 text-lg text-[var(--crm-muted)]">
            Soluções completas para cada etapa do seu processo comercial
          </p>
        </div>

        <div className="space-y-8">
          {products.map((product, index) => {
            const Icon = product.icon;
            const isEven = index % 2 === 0;

            return (
              <div
                key={product.id}
                className="group relative overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#07111d]/72 text-slate-100 shadow-[0_24px_60px_-44px_rgba(34,211,238,0.42)] backdrop-blur-xl transition-all duration-500 hover:border-cyan-200/22 hover:shadow-2xl"
              >
                {/* Background Gradient */}
                <div
                  className="absolute inset-0 opacity-50"
                  style={{ background: product.bgGradient }}
                />

                <div className={`relative grid gap-8 p-8 lg:grid-cols-2 lg:items-center lg:gap-12 lg:p-12 ${!isEven ? 'lg:grid-flow-dense' : ''}`}>
                  {/* Content */}
                  <div className={!isEven ? 'lg:col-start-2' : ''}>
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-2xl bg-gradient-to-br ${product.gradient} p-4 text-white shadow-xl`}
                      >
                        <Icon className="h-8 w-8" />
                      </div>
                    </div>

                    <h3 className="mt-6 text-3xl font-black text-white">
                      {product.name}
                    </h3>
                    <p className={`text-lg font-semibold bg-gradient-to-r ${product.gradient} bg-clip-text text-transparent`}>
                      {product.tagline}
                    </p>
                    
                    <p className="mt-4 text-base leading-relaxed text-slate-400">
                      {product.longDescription}
                    </p>

                    {/* Features Grid */}
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      {product.features.map((feature, idx) => {
                        const FeatureIcon = feature.icon;
                        return (
                          <div key={idx} className="flex items-center gap-2 text-sm text-slate-200">
                            <div className={`rounded-lg bg-gradient-to-br ${product.gradient} p-1.5 text-white`}>
                              <FeatureIcon className="h-3.5 w-3.5" />
                            </div>
                            {feature.text}
                          </div>
                        );
                      })}
                    </div>

                    {/* Stats */}
                    <div className="mt-6 grid grid-cols-3 gap-4">
                      {product.stats.map((stat, idx) => (
                        <div key={idx} className="rounded-xl border border-cyan-200/10 bg-white/[0.055] p-3 backdrop-blur-sm">
                          <div className="text-xl font-black text-white">{stat.value}</div>
                          <div className="text-xs text-slate-400">{stat.label}</div>
                          <div className="mt-1 text-xs font-semibold text-emerald-300">{stat.trend}</div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => navigate('/login')}
                      className={`
                        mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r ${product.gradient}
                        px-6 py-3 font-semibold text-white shadow-lg transition-all
                        hover:scale-105 hover:shadow-xl
                      `}
                    >
                      Começar com {product.name}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Illustration */}
                  <div className={`${!isEven ? 'lg:col-start-1 lg:row-start-1' : ''}`}>
                    <div className="relative">
                      <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${product.gradient} opacity-20 blur-3xl`} />
                      <div className="relative overflow-hidden rounded-3xl border border-cyan-200/12 bg-[#07111d]/72 backdrop-blur-sm">
                        <img 
                          src={product.imageUrl} 
                          alt={product.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Plans Section */}
      <section id="plans-section" className="rounded-3xl border border-cyan-200/12 bg-[radial-gradient(ellipse_at_0%_0%,rgba(125,54,18,0.20)_0%,transparent_45%),radial-gradient(ellipse_at_100%_0%,rgba(34,211,238,0.18)_0%,transparent_48%),linear-gradient(135deg,rgba(7,17,29,0.84),rgba(6,9,17,0.88))] p-8 shadow-[0_24px_60px_-44px_rgba(34,211,238,0.42)] backdrop-blur-xl lg:p-12">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-black text-white">Planos e Preços</h2>
          <p className="mt-2 text-lg text-slate-400">
            Escolha o plano ideal para o tamanho da sua operação
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const Icon = plan.icon;

            return (
              <div
                key={plan.id}
                className={`
                  relative overflow-hidden rounded-2xl border p-6 transition-all duration-300
                  ${plan.highlight
                    ? 'scale-105 border-cyan-200/24 bg-[#07111d]/86 shadow-2xl'
                    : 'border-cyan-200/10 bg-white/[0.055] backdrop-blur-sm hover:border-cyan-200/20 hover:shadow-lg'
                  }
                `}
              >
                {plan.highlight && (
                  <div className="absolute right-4 top-4 rounded-full bg-[linear-gradient(105deg,#ff7a00,#35c2d8)] px-3 py-1 text-xs font-bold text-[#07111b] shadow-lg">
                    Mais Popular
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className={`rounded-xl p-3 ${plan.highlight ? 'bg-gradient-to-br from-orange-500 via-cyan-400 to-teal-500 text-[#07111b]' : 'bg-white/[0.08] text-cyan-100'}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-black text-white">{plan.name}</h3>
                </div>

                <div className="mt-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white">{plan.price}</span>
                    <span className="text-sm text-slate-400">{plan.period}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{plan.description}</p>
                </div>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-200">
                      <CheckCircle2 className={`mt-0.5 h-5 w-5 flex-shrink-0 ${plan.highlight ? 'text-cyan-300' : 'text-emerald-300'}`} />
                      {feature}
                    </li>
                  ))}
                </ul>

                  <button
                    onClick={() => navigate(`/checkout?plan=${plan.id}`)}
                    className={`
                      mt-8 w-full rounded-xl py-3 font-semibold transition-all
                      ${plan.highlight
                        ? 'bg-[linear-gradient(105deg,#ff7a00,#35c2d8)] text-[#07111b] shadow-lg hover:scale-105 hover:shadow-xl'
                        : 'border border-cyan-200/16 bg-[#07111d]/72 text-cyan-100 hover:border-cyan-200/36 hover:text-white'
                      }
                    `}
                  >
                    Contratar Plano
                  </button>
              </div>
            );
          })}
        </div>

        {/* Additional Info */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-cyan-200/10 bg-white/[0.055] p-4 text-center backdrop-blur-sm">
            <Shield className="mx-auto h-8 w-8 text-cyan-300" />
            <div className="mt-2 font-semibold text-white">Segurança</div>
            <div className="mt-1 text-xs text-slate-400">Dados criptografados</div>
          </div>
          <div className="rounded-xl border border-cyan-200/10 bg-white/[0.055] p-4 text-center backdrop-blur-sm">
            <Zap className="mx-auto h-8 w-8 text-yellow-500" />
            <div className="mt-2 font-semibold text-white">Performance</div>
            <div className="mt-1 text-xs text-slate-400">99.9% uptime</div>
          </div>
          <div className="rounded-xl border border-cyan-200/10 bg-white/[0.055] p-4 text-center backdrop-blur-sm">
            <Users className="mx-auto h-8 w-8 text-emerald-300" />
            <div className="mt-2 font-semibold text-white">Suporte</div>
            <div className="mt-1 text-xs text-slate-400">Equipe dedicada</div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden rounded-3xl border border-cyan-200/14 bg-[radial-gradient(ellipse_at_0%_0%,rgba(125,54,18,0.42)_0%,transparent_48%),radial-gradient(ellipse_at_100%_0%,rgba(34,211,238,0.34)_0%,transparent_52%),linear-gradient(135deg,#07080f,#071b25)] p-8 text-center text-white shadow-[0_28px_70px_-44px_rgba(34,211,238,0.55)] lg:p-12">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30" />
        
        <div className="relative z-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-200/16 bg-white/[0.08] backdrop-blur-sm">
            <Users className="h-8 w-8" />
          </div>
          
          <h3 className="mt-6 text-3xl font-black">
            Precisa de ajuda para escolher?
          </h3>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-white/90">
            Nossa equipe está pronta para ajudar você a encontrar a melhor solução para seu negócio. Agende uma demonstração gratuita e conheça todos os recursos.
          </p>
          
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <button 
              onClick={() => navigate('/login')}
              className="rounded-xl bg-white px-8 py-4 font-semibold text-[#07111b] transition-all hover:scale-105 hover:shadow-xl"
            >
              Agendar demonstração
            </button>
            <button 
              onClick={() => navigate('/login')}
              className="rounded-xl border border-cyan-100/26 bg-white/[0.06] px-8 py-4 font-semibold backdrop-blur-sm transition-all hover:bg-white/[0.12]"
            >
              Falar com especialista
            </button>
          </div>
        </div>
      </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#0b2a35]/70 bg-[#070a12]/78 backdrop-blur-2xl">
        <div className="container mx-auto px-4 py-8 text-center lg:px-8">
          <div className="text-sm text-[var(--crm-muted)]">
            © 2026 CRM NEXOS. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
