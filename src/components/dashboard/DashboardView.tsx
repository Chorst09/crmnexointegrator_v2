"use client";

import React, { useState, useEffect, useMemo } from 'react';
// PostgreSQL via Prisma - APIs REST
import { useAuth } from '@/hooks/use-auth';
import { Proposal, Partner } from '@/lib/types';
import ProposalsView from '@/components/proposals/ProposalsView';
import StatCard from './StatCard';
import { Phone, Server, Wifi, Radio, TrendingUp, PieChart as PieChartIcon, Target, Maximize2, Minimize2, Loader2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  PABX: 'PABX/SIP',
  VM: 'Máquinas Virtuais',
  FIBER: 'Internet Fibra',
  RADIO: 'Internet Rádio',
  DOUBLE: 'Double Fibra/Rádio',
  SD_WAN: 'SD-WAN',
  EVENTOS_TI: 'Eventos TI',
  INTERNET_MAN_FIBRA: 'Rede Man/MPLS Fibra',
  MANRADIO: 'Rede Man/MPLS Radio',
  REDE_MAN_MPLS_FIBRA: 'Rede Man/MPLS Fibra',
  REDE_MAN_MPLS_RADIO: 'Rede Man/MPLS Radio',
  STANDARD: 'Padrão',
};

const FUNNEL_LAYER_STYLE = [
  {
    key: 'lead_generation',
    label: 'Geração de Leads',
    gradient: 'from-rose-500 to-red-600',
    shadow: 'shadow-[0_0_24px_rgba(239,68,68,0.45)]',
  },
  {
    key: 'qualify',
    label: 'Qualificar Leads',
    gradient: 'from-amber-500 to-orange-500',
    shadow: 'shadow-[0_0_24px_rgba(251,146,60,0.4)]',
  },
  {
    key: 'evaluate',
    label: 'Avaliar Desafios / Problemas',
    gradient: 'from-emerald-500 to-green-600',
    shadow: 'shadow-[0_0_24px_rgba(34,197,94,0.4)]',
  },
  {
    key: 'solve',
    label: 'Solucionar Problemas',
    gradient: 'from-cyan-500 to-sky-600',
    shadow: 'shadow-[0_0_24px_rgba(14,165,233,0.4)]',
  },
  {
    key: 'convert',
    label: 'Converter',
    gradient: 'from-blue-500 to-indigo-600',
    shadow: 'shadow-[0_0_24px_rgba(59,130,246,0.45)]',
  },
  {
    key: 'close',
    label: 'Fechar',
    gradient: 'from-violet-500 to-purple-600',
    shadow: 'shadow-[0_0_24px_rgba(139,92,246,0.45)]',
  },
] as const;

const FORECAST_GAUGE_COLORS = ['#d50000', '#ef5b2a', '#d6db00', '#f0b400', '#00a651'] as const;
const FORECAST_GAUGE_RADIUS = 64;
const FORECAST_GAUGE_ARC_PATH = `M 26 82 A ${FORECAST_GAUGE_RADIUS} ${FORECAST_GAUGE_RADIUS} 0 0 1 154 82`;
const FORECAST_GAUGE_ARC_LENGTH = Math.PI * FORECAST_GAUGE_RADIUS;
const FORECAST_GAUGE_SEGMENT_LENGTH = FORECAST_GAUGE_ARC_LENGTH / FORECAST_GAUGE_COLORS.length;
const FORECAST_STEP_LEVELS = [0, 25, 50, 75, 100] as const;

const formatCurrencyCompact = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const adjustHexColor = (hex: string, amount: number) => {
  const normalized = (hex || '').replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return hex;
  const num = parseInt(normalized, 16);
  const clamp = (value: number) => Math.max(0, Math.min(255, value));
  const r = clamp((num >> 16) + Math.round(255 * amount));
  const g = clamp(((num >> 8) & 0xff) + Math.round(255 * amount));
  const b = clamp((num & 0xff) + Math.round(255 * amount));
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
};

const extractProposalSequence = (baseId: string) => {
  const match = String(baseId || '').match(/_(\d+)_v\d+$/i);
  return match?.[1] || '000';
};

const normalizeBusinessType = (proposal: Proposal): string => {
  const normalizedTypeRaw = (proposal.type || '').trim().toUpperCase();
  const normalizedType =
    normalizedTypeRaw === 'INTERNET_MAN_FIBRA'
      ? 'REDE_MAN_MPLS_FIBRA'
      : normalizedTypeRaw === 'MANRADIO'
      ? 'REDE_MAN_MPLS_RADIO'
      : normalizedTypeRaw === 'SD-WAN' || normalizedTypeRaw === 'SD WAN'
      ? 'SD_WAN'
      : normalizedTypeRaw === 'EVENTOS TI'
      ? 'EVENTOS_TI'
      : normalizedTypeRaw;
  if (normalizedType && normalizedType !== 'STANDARD') {
    return normalizedType;
  }

  const baseId = proposal.baseId || '';
  if (baseId.startsWith('Prop_PabxSip_') || baseId.startsWith('Prop_PABX_')) return 'PABX';
  if (baseId.startsWith('Prop_Pabx_Sip_')) return 'PABX';
  if (baseId.startsWith('Prop_MV_')) return 'VM';
  if (baseId.startsWith('Prop_InternetFibra_') || baseId.startsWith('Prop_Inter_Fibra_')) return 'FIBER';
  if (baseId.startsWith('Prop_InternetRadio_') || baseId.startsWith('Prop_Inter_Radio_')) return 'RADIO';
  if (baseId.startsWith('Prop_Double_') || baseId.startsWith('Prop_Inter_Double_')) return 'DOUBLE';
  if (baseId.startsWith('Prop_Rede_SD-WAN_') || baseId.startsWith('Prop_SD-WAN_')) return 'SD_WAN';
  if (baseId.startsWith('Prop_Eventos_TI_')) return 'EVENTOS_TI';
  if (
    baseId.startsWith('Prop_ManFibra_') ||
    baseId.startsWith('Prop_Inter_Man_') ||
    baseId.startsWith('Prop_IM_') ||
    baseId.startsWith('Prop_Rede_Man/Filbra_') ||
    baseId.startsWith('Prop_Rede_Man/Fibra_')
  ) return 'REDE_MAN_MPLS_FIBRA';
  if (
    baseId.startsWith('Prop_ManRadio_') ||
    baseId.startsWith('Prop_InterMan_Radio_') ||
    baseId.startsWith('Prop_Rede_Man/Radio_')
  ) return 'REDE_MAN_MPLS_RADIO';

  return normalizedType || 'STANDARD';
};

const formatBusinessType = (type: string) => BUSINESS_TYPE_LABELS[type] || type || 'N/A';

const getAccountManagerName = (proposal: Proposal) =>
  (() => {
    if (typeof proposal.accountManager === 'string') {
      return proposal.accountManager;
    }

    const directName =
      proposal.accountManager?.name ||
      (proposal.accountManager as any)?.full_name ||
      (proposal.accountManager as any)?.fullName;
    if (directName) return directName;

    const metadata = (proposal as any)?.metadata || {};
    const metadataName =
      metadata?.accountManagerData?.name ||
      metadata?.fullAccountManagerData?.name ||
      metadata?.accountManager?.name ||
      metadata?.accountManager?.full_name ||
      metadata?.accountManager?.fullName ||
      metadata?.accountManagerName ||
      metadata?.account_manager?.name ||
      metadata?.account_manager_name;

    return metadataName || 'Não atribuído';
  })();

const normalizeStatus = (status: string) =>
  (status || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const getForecastWeightPercent = (status: string): number => {
  const normalizedStatus = normalizeStatus(status);

  if (['rejeitada', 'rejeitado', 'perdido', 'cancelada', 'cancelado'].includes(normalizedStatus)) return 0;
  if (['aprovada', 'aprovado', 'fechado ganho', 'assinado', 'assinada', 'fechado'].includes(normalizedStatus)) return 100;
  if (['renovacao', 'renovado', 'renovada'].includes(normalizedStatus)) return 75;
  if (
    ['em analise', 'analise', 'qualificado', 'qualificada', 'em andamento', 'negociacao', 'proposta enviada', 'enviada'].includes(
      normalizedStatus
    )
  ) return 50;
  if (['rascunho', 'novo', 'nova', 'aberto', 'aberta', 'iniciado', 'iniciada'].includes(normalizedStatus)) return 25;
  return 50;
};

const getForecastTemperatureFromProposal = (proposal: Proposal): number | undefined => {
  const metadata = (proposal as any)?.metadata;
  const raw = (proposal as any)?.forecastTemperature ?? metadata?.forecastTemperature;
  if (raw === null || raw === undefined || raw === '') return undefined;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return undefined;

  const levels = [0, 25, 50, 75, 100];
  if (levels.includes(parsed)) return parsed;
  return levels.reduce((closest, current) => (Math.abs(current - parsed) < Math.abs(closest - parsed) ? current : closest), 0);
};

const snapToForecastStep = (percent: number) =>
  FORECAST_STEP_LEVELS.reduce(
    (closest, current) => (Math.abs(current - percent) < Math.abs(closest - percent) ? current : closest),
    FORECAST_STEP_LEVELS[0]
  );

const classifyFunnelStage = (status: string): 'previstos' | 'fechados' | 'perdidos' => {
  const normalizedStatus = (status || '').trim().toLowerCase();

  if (['aprovada', 'aprovado', 'fechado ganho', 'renovação', 'renovacao', 'renovado'].includes(normalizedStatus)) return 'fechados';
  if (['rejeitada', 'rejeitado', 'perdido'].includes(normalizedStatus)) return 'perdidos';
  return 'previstos';
};

const DashboardView = () => {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboardReady, setDashboardReady] = useState(false);
  const [selectedAccountManager, setSelectedAccountManager] = useState('all');
  const [selectedBusinessType, setSelectedBusinessType] = useState('all');
  const [selectedTemperature, setSelectedTemperature] = useState('all');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const accountManagerOptions = useMemo(() => {
    const uniqueManagers = new Set<string>();
    proposals.forEach((proposal) => {
      const managerNameRaw = getAccountManagerName(proposal);
      const managerName = (managerNameRaw || '').trim();
      if (!managerName) return;
      if (['n/a', 'nao atribuido', 'não atribuído'].includes(managerName.toLowerCase())) return;
      uniqueManagers.add(managerName);
    });
    return Array.from(uniqueManagers).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [proposals]);

  const businessTypeOptions = useMemo(() => {
    const uniqueTypes = new Set<string>();
    proposals.forEach((proposal) => {
      uniqueTypes.add(normalizeBusinessType(proposal));
    });
    return Array.from(uniqueTypes).sort((a, b) => formatBusinessType(a).localeCompare(formatBusinessType(b), 'pt-BR'));
  }, [proposals]);

  const filteredMonthProposals = useMemo(() => {
    // Aplicar filtros em TODAS as versões
    return proposals.filter((proposal) => {
      const managerName = (getAccountManagerName(proposal) || '').trim();
      if (selectedAccountManager !== 'all' && managerName !== selectedAccountManager) {
        return false;
      }

      const businessType = normalizeBusinessType(proposal);
      if (selectedBusinessType !== 'all' && businessType !== selectedBusinessType) {
        return false;
      }

      if (selectedTemperature !== 'all') {
        const explicitTemperature = getForecastTemperatureFromProposal(proposal);
        const proposalTemperature = explicitTemperature !== undefined ? explicitTemperature : getForecastWeightPercent(proposal.status);
        if (String(proposalTemperature) !== selectedTemperature) return false;
      }

      return true;
    });
  }, [proposals, selectedAccountManager, selectedBusinessType, selectedTemperature]);
  
  // Contar propostas por tipo (todas as versões)
  const countProposalsByType = useMemo(() => {
    const counts = {
      pabx: 0,
      maquinasVirtuais: 0,
      fibra: 0,
      doubleFibraRadio: 0,
      man: 0,
      manRadio: 0
    };

    filteredMonthProposals.forEach((proposal) => {
      const baseId = proposal.baseId || proposal.id;

      if (baseId.startsWith('Prop_PabxSip_')) {
        counts.pabx++;
      } else if (baseId.startsWith('Prop_MV_')) {
        counts.maquinasVirtuais++;
      } else if (baseId.startsWith('Prop_InternetFibra_') || baseId.startsWith('Prop_Inter_Fibra_')) {
        counts.fibra++;
      } else if (baseId.startsWith('Prop_Double_') || baseId.startsWith('Prop_Inter_Double_')) {
        counts.doubleFibraRadio++;
      } else if (
        baseId.startsWith('Prop_ManFibra_') ||
        baseId.startsWith('Prop_Inter_Man_') ||
        baseId.startsWith('Prop_IM_') ||
        baseId.startsWith('Prop_Rede_Man/Filbra_') ||
        baseId.startsWith('Prop_Rede_Man/Fibra_')
      ) {
        counts.man++;
      } else if (
        baseId.startsWith('Prop_ManRadio_') ||
        baseId.startsWith('Prop_InterMan_Radio_') ||
        baseId.startsWith('Prop_Rede_Man/Radio_')
      ) {
        counts.manRadio++;
      } else if (baseId.startsWith('Prop_InternetRadio_') || baseId.startsWith('Prop_Inter_Radio_')) {
        counts.fibra++;
      } else {
        const fallbackType = normalizeBusinessType(proposal);
        if (fallbackType === 'PABX') counts.pabx++;
        else if (fallbackType === 'VM') counts.maquinasVirtuais++;
        else if (fallbackType === 'DOUBLE') counts.doubleFibraRadio++;
        else if (fallbackType === 'REDE_MAN_MPLS_FIBRA') counts.man++;
        else if (fallbackType === 'REDE_MAN_MPLS_RADIO') counts.manRadio++;
        else if (fallbackType === 'RADIO' || fallbackType === 'FIBER') counts.fibra++;
      }
    });

    return counts;
  }, [filteredMonthProposals]);

  // Calcular valores totais por tipo de calculadora
  const valuesByType = useMemo(() => {
    const values = {
      pabx: 0,
      maquinasVirtuais: 0,
      fibra: 0,
      doubleFibraRadio: 0,
      man: 0,
      manRadio: 0
    };
    
    filteredMonthProposals.forEach((proposal) => {
      const baseId = proposal.baseId || proposal.id;
      const value = proposal.value || 0;

      if (baseId.startsWith('Prop_PabxSip_')) {
        values.pabx += value;
      } else if (baseId.startsWith('Prop_MV_')) {
        values.maquinasVirtuais += value;
      } else if (baseId.startsWith('Prop_InternetFibra_') || baseId.startsWith('Prop_Inter_Fibra_') || baseId.startsWith('Prop_InternetRadio_') || baseId.startsWith('Prop_Inter_Radio_')) {
        values.fibra += value;
      } else if (baseId.startsWith('Prop_Double_') || baseId.startsWith('Prop_Inter_Double_')) {
        values.doubleFibraRadio += value;
      } else if (
        baseId.startsWith('Prop_ManFibra_') ||
        baseId.startsWith('Prop_Inter_Man_') ||
        baseId.startsWith('Prop_IM_') ||
        baseId.startsWith('Prop_Rede_Man/Filbra_') ||
        baseId.startsWith('Prop_Rede_Man/Fibra_')
      ) {
        values.man += value;
      } else if (
        baseId.startsWith('Prop_ManRadio_') ||
        baseId.startsWith('Prop_InterMan_Radio_') ||
        baseId.startsWith('Prop_Rede_Man/Radio_')
      ) {
        values.manRadio += value;
      } else {
        const fallbackType = normalizeBusinessType(proposal);
        if (fallbackType === 'PABX') values.pabx += value;
        else if (fallbackType === 'VM') values.maquinasVirtuais += value;
        else if (fallbackType === 'DOUBLE') values.doubleFibraRadio += value;
        else if (fallbackType === 'REDE_MAN_MPLS_FIBRA') values.man += value;
        else if (fallbackType === 'REDE_MAN_MPLS_RADIO') values.manRadio += value;
        else if (fallbackType === 'RADIO' || fallbackType === 'FIBER') values.fibra += value;
      }
    });

    return values;
  }, [filteredMonthProposals]);

  const chartData = useMemo(() => {
    return [
      { name: 'PABX/SIP', proposals: countProposalsByType.pabx, amount: valuesByType.pabx, color: '#3b82f6' },
      { name: 'Máq. Virtuais', proposals: countProposalsByType.maquinasVirtuais, amount: valuesByType.maquinasVirtuais, color: '#a855f7' },
      { name: 'Internet Fibra', proposals: countProposalsByType.fibra, amount: valuesByType.fibra, color: '#22c55e' },
      { name: 'Double Fibra/Radio', proposals: countProposalsByType.doubleFibraRadio, amount: valuesByType.doubleFibraRadio, color: '#ef4444' },
      { name: 'Rede Man/MPLS Fibra', proposals: countProposalsByType.man, amount: valuesByType.man, color: '#06b6d4' },
      { name: 'Rede Man/MPLS Radio', proposals: countProposalsByType.manRadio, amount: valuesByType.manRadio, color: '#f97316' },
    ];
  }, [countProposalsByType, valuesByType]);

  const proposalDistributionData = useMemo(
    () => chartData.filter((item) => item.proposals > 0).map((item) => ({ name: item.name, value: item.proposals, color: item.color })),
    [chartData]
  );

  const valueDistributionData = useMemo(
    () => chartData.filter((item) => item.amount > 0).map((item) => ({ name: item.name, value: item.amount, color: item.color })),
    [chartData]
  );

  const totalProposalsMonth = useMemo(
    () => chartData.reduce((total, item) => total + item.proposals, 0),
    [chartData]
  );

  const totalValueMonth = useMemo(
    () => chartData.reduce((total, item) => total + item.amount, 0),
    [chartData]
  );

  const salesFunnelData = useMemo(() => {
    const funnel = {
      previstos: { key: 'previstos' as const, name: 'Negócios Previstos', value: 0, amount: 0 },
      fechados: { key: 'fechados' as const, name: 'Negócios Fechados', value: 0, amount: 0 },
      perdidos: { key: 'perdidos' as const, name: 'Negócios Perdidos', value: 0, amount: 0 },
    };

    filteredMonthProposals.forEach((proposal) => {
      const stage = classifyFunnelStage(proposal.status);
      funnel[stage].value += 1;
      funnel[stage].amount += proposal.value || 0;
    });

    return [funnel.previstos, funnel.fechados, funnel.perdidos];
  }, [filteredMonthProposals]);

  const funnelVisualData = useMemo(() => {
    const previstos = salesFunnelData.find((item) => item.key === 'previstos')?.value || 0;
    const fechados = salesFunnelData.find((item) => item.key === 'fechados')?.value || 0;
    const topo = Math.max(previstos, fechados, 1);

    const s6 = fechados;
    const s5 = Math.max(s6, Math.round(topo * 0.14));
    const s4 = Math.max(s5, Math.round(topo * 0.27));
    const s3 = Math.max(s4, Math.round(topo * 0.4));
    const s2 = Math.max(s3, Math.round(topo * 0.62));
    const s1 = Math.max(s2, topo);

    const values = [s1, s2, s3, s4, s5, s6];
    const widths = [100, 92, 84, 76, 68, 60];

    return FUNNEL_LAYER_STYLE.map((stage, index) => ({
      ...stage,
      value: values[index],
      width: widths[index],
    }));
  }, [salesFunnelData]);

  const funnelSummary = useMemo(() => {
    const previstos = salesFunnelData.find((item) => item.key === 'previstos')?.value || 0;
    const fechados = salesFunnelData.find((item) => item.key === 'fechados')?.value || 0;
    const conversion = previstos > 0 ? (fechados / previstos) * 100 : 0;
    return { previstos, fechados, conversion };
  }, [salesFunnelData]);

  const monthlyFunnelBoard = useMemo(() => {
    const isRenewal = (status: string) => ['renovacao', 'renovado', 'renovada'].includes(normalizeStatus(status));
    const isClosedWon = (status: string) => ['aprovada', 'aprovado', 'fechado ganho', 'assinado', 'assinada', 'fechado'].includes(normalizeStatus(status));
    const isLost = (status: string) => ['rejeitada', 'rejeitado', 'perdido', 'cancelada', 'cancelado'].includes(normalizeStatus(status));

    const sum = (list: Proposal[]) => list.reduce((acc, p) => acc + (p.value || 0), 0);

    const all = filteredMonthProposals;
    const renewals = all.filter((p) => isRenewal(p.status));
    const lost = all.filter((p) => isLost(p.status));
    const closedWon = all.filter((p) => isClosedWon(p.status));
    const newSigned = closedWon.filter((p) => !isRenewal(p.status));
    const uniqueSigned = newSigned.filter((p) => normalizeBusinessType(p) !== 'DOUBLE');
    const renewalSigned = renewals.filter((p) => isClosedWon(p.status) || isRenewal(p.status));

    const weightedForecast = all.reduce(
      (acc, proposal) => {
        const explicitTemperature = getForecastTemperatureFromProposal(proposal);
        const weight = (explicitTemperature !== undefined ? explicitTemperature : getForecastWeightPercent(proposal.status)) / 100;

        acc.value += (proposal.value || 0) * weight;
        acc.qty += weight;
        return acc;
      },
      { value: 0, qty: 0 }
    );

    const forecastValue = Math.max(weightedForecast.value, 0);
    const forecastQtyRaw = Math.max(weightedForecast.qty, 0);
    const forecastQty = Math.round(forecastQtyRaw);
    const forecastPercentRaw = all.length > 0 ? Math.min((forecastQtyRaw / all.length) * 100, 100) : 0;
    const forecastPercent = snapToForecastStep(forecastPercentRaw);

    return {
      top: [
        { title: 'funil de vendas', amount: sum(all), qty: all.length, color: 'from-emerald-500 via-teal-500 to-cyan-600' },
        { title: 'funil de renovação', amount: sum(renewals), qty: renewals.length, color: 'from-blue-500 via-indigo-500 to-purple-600' },
        { title: 'forecast de vendas', amount: forecastValue, qty: forecastQty, color: 'from-violet-500 via-purple-500 to-fuchsia-600' },
      ],
      bottom: [
        { title: 'vendas novas assinadas', amount: sum(newSigned), qty: newSigned.length, color: 'from-green-600 via-emerald-600 to-teal-700' },
        { title: 'vendas únicas assinadas', amount: sum(uniqueSigned), qty: uniqueSigned.length, color: 'from-teal-600 via-cyan-600 to-sky-700' },
        { title: 'renovações de contratos assinados', amount: sum(renewalSigned), qty: renewalSigned.length, color: 'from-amber-500 via-orange-500 to-red-600' },
        { title: 'projetos perdidos', amount: sum(lost), qty: lost.length, color: 'from-rose-600 via-pink-600 to-red-700' },
      ],
      forecastPercent,
    };
  }, [filteredMonthProposals]);

  const salesForecastChartData = useMemo(() => {
    const newSales = monthlyFunnelBoard.bottom[0];
    const renewals = monthlyFunnelBoard.bottom[2];
    const lost = monthlyFunnelBoard.bottom[3];
    const forecast = monthlyFunnelBoard.top[2];

    return [
      { key: 'new-sales', label: 'Novas', fullLabel: 'Vendas novas assinadas', value: newSales?.amount || 0, qty: newSales?.qty || 0, color: '#22c55e' },
      { key: 'renewals', label: 'Renovações', fullLabel: 'Renovações assinadas', value: renewals?.amount || 0, qty: renewals?.qty || 0, color: '#f59e0b' },
      { key: 'lost', label: 'Perdidos', fullLabel: 'Projetos perdidos', value: -(lost?.amount || 0), qty: lost?.qty || 0, color: '#ef4444' },
      { key: 'forecast', label: 'Forecast', fullLabel: 'Forecast final', value: forecast?.amount || 0, qty: forecast?.qty || 0, color: '#8b5cf6' },
    ];
  }, [monthlyFunnelBoard]);

  const forecastGaugePercent = useMemo(
    () => Math.max(0, Math.min(monthlyFunnelBoard.forecastPercent, 100)),
    [monthlyFunnelBoard.forecastPercent]
  );

  const forecastGaugeNeedle = useMemo(() => {
    const theta = Math.PI - (forecastGaugePercent / 100) * Math.PI;
    return {
      x: 90 + 52 * Math.cos(theta),
      y: 82 - 52 * Math.sin(theta),
    };
  }, [forecastGaugePercent]);

  useEffect(() => {
    const animationTimer = setTimeout(() => setDashboardReady(true), 120);

    const fetchProposals = async () => {
      if (!user) return;

      try {
        console.log('Fetching proposals for user:', user.id, user.email);
        
        const response = await fetch('/api/proposals?dashboard=true&all=true', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Error response:', response.status, response.statusText);
          return;
        }

        const proposalsData = await response.json();
        console.log('Fetched proposals from API:', proposalsData);

        // A API retorna { success: true, data: { proposals: [...] } }
        const proposalsArray = proposalsData?.data?.proposals || proposalsData?.proposals || proposalsData || [];
        console.log('Proposals array:', proposalsArray);

        const proposalsList = proposalsArray.map((data: any) => {
          const baseIdRaw = String(data.baseId || data.base_id || '').trim();
          let title = data.title || "Proposta";
          
          // If title is not set, generate from baseId
          if (!data.title && baseIdRaw) {
            const sequence = extractProposalSequence(baseIdRaw);
            if (baseIdRaw.startsWith("Prop_MV_")) title = `Proposta Máquinas Virtuais - ${sequence}`;
            else if (baseIdRaw.startsWith("Prop_PabxSip_")) title = `Proposta PABX/SIP - ${sequence}`;
            else if (
              baseIdRaw.startsWith("Prop_ManFibra_") ||
              baseIdRaw.startsWith("Prop_Inter_Man_") ||
              baseIdRaw.startsWith("Prop_IM_") ||
              baseIdRaw.startsWith("Prop_Rede_Man/Filbra_") ||
              baseIdRaw.startsWith("Prop_Rede_Man/Fibra_")
            ) title = `Proposta Rede Man/MPLS Fibra - ${sequence}`;
            else if (baseIdRaw.startsWith("Prop_Double_")) title = `Proposta Double-Fibra/Radio - ${sequence}`;
            else if (baseIdRaw.startsWith("Prop_InternetFibra_")) title = `Proposta Internet Fibra - ${sequence}`;
            else if (baseIdRaw.startsWith("Prop_InternetRadio_")) title = `Proposta Internet Rádio - ${sequence}`;
            else if (
              baseIdRaw.startsWith("Prop_ManRadio_") ||
              baseIdRaw.startsWith("Prop_InterMan_Radio_") ||
              baseIdRaw.startsWith("Prop_Rede_Man/Radio_")
            ) title = `Proposta Rede Man/MPLS Radio - ${sequence}`;
          }

          const createdAtDate = data.createdAt ? new Date(data.createdAt) : new Date();
          const expiryDate = data.expiryDate ? new Date(data.expiryDate) : new Date(createdAtDate.getTime() + 30 * 24 * 60 * 60 * 1000);

          const accountManagerRaw =
            data.accountManager ??
            (data as any).account_manager ??
            data.metadata?.accountManagerData ??
            data.metadata?.fullAccountManagerData ??
            data.metadata?.accountManager ??
            data.metadata?.accountManagerName ??
            data.metadata?.account_manager;

          return {
            id: data.id,
            baseId: baseIdRaw,
            version: data.version || 1,
            title: title,
            client: data.client || 'N/A',
            type: data.type || 'standard',
            value: parseFloat(data.value) || 0,
            status: data.status || 'Rascunho',
            forecastTemperature: typeof data.forecastTemperature === 'number'
              ? data.forecastTemperature
              : (data.metadata?.forecastTemperature !== undefined ? Number(data.metadata.forecastTemperature) : undefined),
            metadata: data.metadata,
            createdBy: data.createdBy || 'N/A',
            accountManager: accountManagerRaw || 'N/A',
            createdAt: data.createdAt,
            distributorId: data.distributorId || 'N/A',
            date: createdAtDate.toISOString(),
            expiryDate: expiryDate.toISOString(),
          } as Proposal;
        });
        
        console.log('Processed proposals:', proposalsList);
        setProposals(proposalsList);
      } catch (error) {
        console.error("Error fetching proposals:", error);
      }
    };

    const fetchPartners = async () => {
      try {
        // Partners desabilitado - migrar para API quando necessário
        const partnersData: any[] = [];
        const error = null;

        if (error) {
          console.error('Erro ao buscar parceiros:', error);
          return;
        }

        const partnersList = (partnersData || []).map((data: any) => {
          return {
            id: data.id || 0,
            name: data.name || 'Sem nome',
            type: 'Cliente', // Default type as per Partner interface
            contact: data.contact || '',
            phone: data.phone || '',
            status: data.status === 'Ativo' ? 'Ativo' : 'Inativo',
            site: data.site || '',
            products: data.products || '',
            sitePartner: data.site_partner || '',
            siteRO: data.site_ro || '',
            templateRO: data.template_ro || '',
            procedimentoRO: data.procedimento_ro || '',
            login: data.login || '',
            password: data.password || '',
            mainContact: data.main_contact || ''
          } as Partner;
        });
        setPartners(partnersList);
      } catch (error) {
        console.error("Error fetching partners:", error);
      }
    };

    if (user) {
      fetchProposals();
      fetchPartners();
    }
    setLoading(false);

    return () => clearTimeout(animationTimer);
  }, [user]);

  const handleSave = (proposal: Proposal) => {
    // Lógica para salvar (criar ou atualizar) uma proposta
    console.log('Saving proposal:', proposal);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta proposta?')) {
      return;
    }

    try {
      const response = await fetch(`/api/proposals/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao excluir proposta');
      }

      // Atualizar lista de propostas removendo a excluída
      setProposals(prev => prev.filter(p => p.id !== id));
      
      console.log('✅ Proposta excluída com sucesso');
    } catch (error) {
      console.error('❌ Erro ao excluir proposta:', error);
      alert(error instanceof Error ? error.message : 'Erro ao excluir proposta');
    }
  };

  const handleBackToTop = () => {
    // Scroll para o topo do dashboard (seção de gráficos)
    const dashboardTopSection = document.querySelector('[data-section="dashboard-top"]');
    if (dashboardTopSection) {
      dashboardTopSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Fallback to scroll to page top if section not found
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFullscreenToggle = async () => {
    try {
      const mainContainer = document.querySelector('[data-section="dashboard-main"]');
      if (!mainContainer) return;

      if (!isFullscreen) {
        // Enter fullscreen
        if (mainContainer.requestFullscreen) {
          await mainContainer.requestFullscreen();
          setIsFullscreen(true);
        } else if ((mainContainer as any).webkitRequestFullscreen) {
          await (mainContainer as any).webkitRequestFullscreen();
          setIsFullscreen(true);
        }
      } else {
        // Exit fullscreen
        if (document.fullscreenElement) {
          await document.exitFullscreen();
          setIsFullscreen(false);
        } else if ((document as any).webkitFullscreenElement) {
          await (document as any).webkitExitFullscreen();
          setIsFullscreen(false);
        }
      }
    } catch (error) {
      console.error('Erro ao alternar fullscreen:', error);
    }
  };

  const handleSyncProposals = async () => {
    setIsSyncing(true);
    try {
      console.log('🔄 Sincronizando propostas...');
      
      const response = await fetch('/api/proposals?dashboard=true&all=true', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erro ao sincronizar: ${response.statusText}`);
      }

      const proposalsData = await response.json();
      const proposalsArray = proposalsData?.data?.proposals || proposalsData?.proposals || proposalsData || [];
      
      console.log('✅ Propostas sincronizadas:', proposalsArray.length);

      const proposalsList = proposalsArray.map((data: any) => {
        const baseIdRaw = String(data.baseId || data.base_id || '').trim();
        let title = data.title || "Proposta";
        
        if (!data.title && baseIdRaw) {
          const sequence = extractProposalSequence(baseIdRaw);
          if (baseIdRaw.startsWith("Prop_MV_")) title = `Proposta Máquinas Virtuais - ${sequence}`;
          else if (baseIdRaw.startsWith("Prop_PabxSip_")) title = `Proposta PABX/SIP - ${sequence}`;
          else if (
            baseIdRaw.startsWith("Prop_ManFibra_") ||
            baseIdRaw.startsWith("Prop_Inter_Man_") ||
            baseIdRaw.startsWith("Prop_IM_") ||
            baseIdRaw.startsWith("Prop_Rede_Man/Filbra_") ||
            baseIdRaw.startsWith("Prop_Rede_Man/Fibra_")
          ) title = `Proposta Rede Man/MPLS Fibra - ${sequence}`;
          else if (baseIdRaw.startsWith("Prop_Double_")) title = `Proposta Double-Fibra/Radio - ${sequence}`;
          else if (baseIdRaw.startsWith("Prop_InternetFibra_")) title = `Proposta Internet Fibra - ${sequence}`;
          else if (baseIdRaw.startsWith("Prop_InternetRadio_")) title = `Proposta Internet Rádio - ${sequence}`;
          else if (
            baseIdRaw.startsWith("Prop_ManRadio_") ||
            baseIdRaw.startsWith("Prop_InterMan_Radio_") ||
            baseIdRaw.startsWith("Prop_Rede_Man/Radio_")
          ) title = `Proposta Rede Man/MPLS Radio - ${sequence}`;
        }

        const createdAtDate = data.createdAt ? new Date(data.createdAt) : new Date();
        const expiryDate = data.expiryDate ? new Date(data.expiryDate) : new Date(createdAtDate.getTime() + 30 * 24 * 60 * 60 * 1000);

        const accountManagerRaw =
          data.accountManager ??
          (data as any).account_manager ??
          data.metadata?.accountManagerData ??
          data.metadata?.fullAccountManagerData ??
          data.metadata?.accountManager ??
          data.metadata?.accountManagerName ??
          data.metadata?.account_manager;

        return {
          id: data.id,
          baseId: baseIdRaw,
          version: data.version || 1,
          title: title,
          client: data.client || 'N/A',
          type: data.type || 'standard',
          value: parseFloat(data.value) || 0,
          status: data.status || 'Rascunho',
          forecastTemperature: typeof data.forecastTemperature === 'number'
            ? data.forecastTemperature
            : (data.metadata?.forecastTemperature !== undefined ? Number(data.metadata.forecastTemperature) : undefined),
          metadata: data.metadata,
          createdBy: data.createdBy || 'N/A',
          accountManager: accountManagerRaw || 'N/A',
          createdAt: data.createdAt,
          distributorId: data.distributorId || 'N/A',
          date: createdAtDate.toISOString(),
          expiryDate: expiryDate.toISOString(),
        } as Proposal;
      });
      
      setProposals(proposalsList);
      alert(`✅ Sincronização concluída! ${proposalsList.length} propostas carregadas.`);
    } catch (error) {
      console.error('❌ Erro ao sincronizar propostas:', error);
      alert(`❌ Erro ao sincronizar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement || !!(document as any).webkitFullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const safeProposalDistributionData = proposalDistributionData.length
    ? proposalDistributionData
    : [{ name: 'Sem propostas', value: 1, color: '#475569' }];

  const safeValueDistributionData = valueDistributionData.length
    ? valueDistributionData
    : [{ name: 'Sem valores', value: 1, color: '#475569' }];

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 space-y-8" data-section="dashboard-main">
      <style>{`
        [data-section="dashboard-main"]:fullscreen {
          overflow-y: auto;
          overflow-x: hidden;
          padding: 1.5rem;
        }
        [data-section="dashboard-main"]:-webkit-full-screen {
          overflow-y: auto;
          overflow-x: hidden;
          padding: 1.5rem;
        }
      `}</style>
      <div data-section="dashboard-top" className="space-y-8">
        <div className="rounded-xl border border-slate-700/30 bg-gradient-to-r from-slate-900/80 via-slate-800/70 to-slate-900/80 p-4 shadow-[0_18px_42px_-28px_rgba(0,0,0,0.85)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 p-3 shadow-lg">
                <TrendingUp className="h-7 w-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">Painel Analítico</h2>
                <p className="text-slate-300">Visão moderna de volume e receita total</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleFullscreenToggle}
                className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-cyan-300 hover:bg-cyan-500/20 transition-colors duration-200 flex items-center gap-2"
                title={isFullscreen ? 'Sair da apresentação' : 'Entrar em apresentação'}
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="h-5 w-5" />
                    <span>Sair Apresentação</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-5 w-5" />
                    <span>Apresentação</span>
                  </>
                )}
              </button>
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2">
                <p className="text-xs uppercase tracking-wide text-cyan-300">Total de propostas</p>
                <p className="text-xl font-semibold text-white">{totalProposalsMonth}</p>
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
                <p className="text-xs uppercase tracking-wide text-emerald-300">Total em valores</p>
                <p className="text-xl font-semibold text-white">{formatCurrency(totalValueMonth)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700/30 bg-slate-900/70 p-4 shadow-[0_18px_42px_-28px_rgba(0,0,0,0.85)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">Filtros do Dashboard</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSyncProposals}
                disabled={isSyncing}
                className="rounded-lg border border-emerald-600 bg-emerald-600/10 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sincronizar
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedAccountManager('all');
                  setSelectedBusinessType('all');
                  setSelectedTemperature('all');
                }}
                className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                Limpar filtros
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Gerente de Contas</label>
              <select
                value={selectedAccountManager}
                onChange={(e) => setSelectedAccountManager(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
              >
                <option value="all">Todos os gerentes</option>
                {accountManagerOptions.map((manager) => (
                  <option key={manager} value={manager}>
                    {manager}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Tipo de Negócio</label>
              <select
                value={selectedBusinessType}
                onChange={(e) => setSelectedBusinessType(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
              >
                <option value="all">Todos os tipos</option>
                {businessTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {formatBusinessType(type)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Temperatura</label>
              <select
                value={selectedTemperature}
                onChange={(e) => setSelectedTemperature(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
              >
                <option value="all">Todas as temperaturas</option>
                <option value="0">0%</option>
                <option value="25">25%</option>
                <option value="50">50%</option>
                <option value="75">75%</option>
                <option value="100">100%</option>
              </select>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-cyan-500/20 bg-gradient-to-br from-[#2b4360] via-[#16314f] to-[#0c2138] p-4 shadow-[0_18px_42px_-28px_rgba(0,0,0,0.85)] lg:p-5">
          <div className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-cyan-400/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/15 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#051226]/80 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.08),transparent_45%,transparent_65%,rgba(14,116,144,0.18))]" />
          <div className="pointer-events-none absolute inset-0 rounded-3xl shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-30px_60px_rgba(2,6,18,0.65)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.18),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.2),transparent_40%)]" />
          <div className="relative z-10 mb-5 overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-r from-[#2f4662]/85 via-[#214167]/75 to-[#284f77]/85 px-5 py-5 shadow-[0_24px_60px_rgba(3,12,28,0.55)] backdrop-blur-sm">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,0.22),transparent_35%,transparent_65%,rgba(255,255,255,0.08))]" />
            <div className="pointer-events-none absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-20px_40px_rgba(2,6,18,0.55)]" />
            <div className="relative z-10">
            <div className="mb-4 flex flex-col items-start justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">Resumo Geral</p>
                <p className="text-xl font-black tracking-tight text-slate-100 md:text-2xl">Forecast</p>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-cyan-200/20 bg-gradient-to-br from-[#244268] via-[#1c3559] to-[#152a46] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_16px_30px_rgba(3,10,25,0.55)]">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_55%)]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white/20 to-transparent" />
                <div className="relative z-10">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-200/90">Indicador Forecast</p>
                  <svg width="180" height="92" viewBox="0 0 180 92" className="mt-1">
                    <defs>
                      <filter id="forecastGaugeShadow" x="-30%" y="-30%" width="160%" height="160%">
                        <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#0a1222" floodOpacity="0.55" />
                      </filter>
                    </defs>
                    {FORECAST_GAUGE_COLORS.map((color, index) => (
                      <path
                        key={`forecast-gauge-segment-${color}`}
                        d={FORECAST_GAUGE_ARC_PATH}
                        fill="none"
                        stroke={color}
                        strokeWidth="20"
                        strokeLinecap="butt"
                        strokeDasharray={`${FORECAST_GAUGE_SEGMENT_LENGTH} ${FORECAST_GAUGE_ARC_LENGTH}`}
                        strokeDashoffset={-index * FORECAST_GAUGE_SEGMENT_LENGTH}
                        filter="url(#forecastGaugeShadow)"
                      />
                    ))}
                    <path d="M42 82 A48 48 0 0 1 138 82 L138 82 L42 82 Z" fill="#c9c9c9" />
                    <line x1="90" y1="82" x2={forecastGaugeNeedle.x} y2={forecastGaugeNeedle.y} stroke="#0b0b0b" strokeWidth="4" strokeLinecap="round" />
                    <circle cx="90" cy="82" r="5.5" fill="#0b0b0b" />
                    <text x="90" y="66" textAnchor="middle" className="fill-[#111111] text-[22px] font-bold">
                      {forecastGaugePercent.toFixed(1).replace('.', ',')}%
                    </text>
                  </svg>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {monthlyFunnelBoard.top.map((item) => (
                <div key={item.title} className="flex h-full flex-col">
                  <p className="mb-2 min-h-[28px] text-lg font-semibold tracking-wide text-slate-100 capitalize">{item.title}</p>
                  <div className={`relative overflow-hidden rounded-[20px] bg-gradient-to-r ${item.color} px-5 py-3 text-slate-50 shadow-[0_24px_50px_rgba(3,10,25,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_30px_60px_rgba(3,10,25,0.6)]`}>
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.28),transparent_40%,transparent_65%,rgba(0,0,0,0.2))]" />
                    <div className="pointer-events-none absolute -top-6 left-6 h-16 w-32 rounded-full bg-white/35 blur-2xl" />
                    <div className="pointer-events-none absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-18px_30px_rgba(2,6,18,0.45)]" />
                    <div className="relative z-10 flex h-[132px] flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <p className="text-xl font-black leading-none tracking-tight lg:text-2xl">{formatCurrencyCompact(item.amount)}</p>
                        <p className="text-xl font-black leading-none tracking-tight lg:text-2xl">{item.qty}</p>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-sm text-slate-100/95 capitalize md:text-base">
                        <span>Forecast</span>
                        <span>Qtd. projetos</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
              {monthlyFunnelBoard.bottom.map((item) => (
                <div key={item.title} className="flex h-full flex-col">
                  <p className="mb-2 min-h-[54px] text-base font-bold leading-tight tracking-wide text-slate-100 capitalize md:text-[1.04rem]">{item.title}</p>
                  <div className={`relative overflow-hidden rounded-[20px] bg-gradient-to-r ${item.color} px-4 py-3 text-slate-50 shadow-[0_20px_45px_rgba(3,10,25,0.45)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_28px_55px_rgba(3,10,25,0.55)]`}>
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.22),transparent_45%,transparent_70%,rgba(0,0,0,0.2))]" />
                    <div className="pointer-events-none absolute -top-6 left-6 h-14 w-28 rounded-full bg-white/30 blur-2xl" />
                    <div className="pointer-events-none absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-18px_28px_rgba(2,6,18,0.4)]" />
                    <div className="relative z-10 flex h-[124px] flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <p className="text-xl font-black leading-none tracking-tight">{formatCurrencyCompact(item.amount)}</p>
                        <p className="text-xl font-black leading-none tracking-tight">{item.qty}</p>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-sm text-slate-100/95 capitalize">
                        <span>Forecast</span>
                        <span>Qtd. projetos</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            </div>
          </div>

          <div className="relative z-10 mt-2 grid grid-cols-1 gap-4 xl:grid-cols-[430px_minmax(0,1fr)]">
            <div className="rounded-xl border border-slate-200/15 bg-[#163252]/70 p-4 shadow-[0_0_28px_rgba(14,116,144,0.18)] md:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.17em] text-cyan-200/80">Projeção Comercial</p>
                  <h4 className="text-xl font-bold text-white">Previsões de Venda</h4>
                  <p className="mt-1 text-sm text-slate-200/95">Composição do forecast por origem e impacto de perdas.</p>
                </div>
                <div className="rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-right">
                  <p className="text-[11px] uppercase tracking-wider text-cyan-300">Taxa prevista</p>
                  <p className="text-2xl font-bold text-cyan-100">{monthlyFunnelBoard.forecastPercent.toFixed(1)}%</p>
                </div>
              </div>

              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesForecastChartData} margin={{ top: 8, right: 8, left: -4, bottom: 4 }}>
                    <defs>
                      {salesForecastChartData.map((item) => {
                        const highlight = adjustHexColor(item.color, 0.22);
                        const shadow = adjustHexColor(item.color, -0.32);
                        return (
                          <linearGradient key={`forecast-bar-grad-${item.key}`} id={`forecastBarGrad-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={highlight} stopOpacity={0.95} />
                            <stop offset="55%" stopColor={item.color} stopOpacity={0.85} />
                            <stop offset="100%" stopColor={shadow} stopOpacity={0.95} />
                          </linearGradient>
                        );
                      })}
                      <filter id="forecastBarShadow" x="-30%" y="-30%" width="160%" height="160%">
                        <feDropShadow dx="0" dy="12" stdDeviation="9" floodColor="#060d1f" floodOpacity="0.55" />
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2e4c73" vertical={false} />
                    <XAxis dataKey="label" stroke="#93c5fd" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis
                      stroke="#93c5fd"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => formatCurrencyCompact(Math.abs(Number(value)))}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                      contentStyle={{ backgroundColor: '#0f2541', border: '1px solid #2e4c73', borderRadius: '10px' }}
                      labelStyle={{ color: '#e2e8f0' }}
                      formatter={(value: number | string) => [formatCurrency(Math.abs(Number(value))), 'Valor projetado']}
                    />
                    <Bar
                      dataKey="value"
                      radius={[12, 12, 4, 4]}
                      animationDuration={1200}
                      animationEasing="ease-out"
                      filter="url(#forecastBarShadow)"
                      stroke="rgba(255,255,255,0.35)"
                      strokeWidth={1}
                    >
                      {salesForecastChartData.map((item) => (
                        <Cell key={`forecast-cell-${item.key}`} fill={`url(#forecastBarGrad-${item.key})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-violet-200">Forecast final</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(monthlyFunnelBoard.top[2]?.amount || 0)}</p>
                </div>
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-emerald-200">Qtd. prevista</p>
                  <p className="text-lg font-bold text-white">{monthlyFunnelBoard.top[2]?.qty || 0} projetos</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/15 bg-[#133458]/55 p-4 md:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black leading-tight tracking-tight text-white">Funil de Vendas Estratégico</h3>
                  <p className="mt-2 text-sm font-medium tracking-[0.01em] text-slate-200 md:text-base">Jornada completa do lead até o fechamento</p>
                </div>
                <div className="rounded-xl border border-blue-500/20 bg-[#17345f]/70 p-3 text-cyan-300 shadow-[0_0_18px_rgba(37,99,235,0.28)]">
                  <Target className="h-6 w-6 text-[#5eb2ff]" />
                </div>
              </div>

              <div className="mx-auto mt-6 max-w-[560px] space-y-2.5">
                {funnelVisualData.map((item) => (
                  <div key={item.key} className="mx-auto transition-all duration-500" style={{ width: `${item.width}%` }}>
                    <div className={`rounded-xl bg-gradient-to-r ${item.gradient} px-4 py-2.5 ${item.shadow}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white md:text-base">{item.label}</span>
                        <span className="text-xl font-black leading-none tracking-tight text-white">{item.value}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-center">
                <div className="relative flex h-[68px] w-[68px] items-center justify-center rounded-full bg-slate-700/45">
                  <div className="h-[44px] w-[44px] rounded-full border border-slate-400/40" />
                  <div className="absolute h-[26px] w-[26px] rounded-full border border-slate-400/60" />
                  <div className="absolute h-[11px] w-[11px] rounded-full bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.9)]" />
                </div>
              </div>

              <div className="mt-5 border-t border-slate-600/70 pt-4">
                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
                  <div className="rounded-xl border border-blue-500/60 bg-gradient-to-b from-[#1a3564] to-[#172e58] px-4 py-2.5 text-center">
                    <p className="text-2xl font-black leading-none tracking-tight text-slate-100">{funnelSummary.previstos}</p>
                    <p className="text-sm text-blue-200">Leads no Funil</p>
                  </div>
                  <div className="rounded-xl border border-violet-500/60 bg-gradient-to-b from-[#3b2b72] to-[#352660] px-4 py-2.5 text-center">
                    <p className="text-2xl font-black leading-none tracking-tight text-violet-200">{funnelSummary.fechados}</p>
                    <p className="text-sm text-violet-200">Vendas Concluídas</p>
                  </div>
                  <div className="rounded-xl border border-emerald-500/60 bg-gradient-to-b from-[#1f5d4d] to-[#18493d] px-4 py-2.5 text-center">
                    <p className="text-2xl font-black leading-none tracking-tight text-emerald-300">{funnelSummary.conversion.toFixed(1)}%</p>
                    <p className="text-sm text-emerald-200">Taxa de Conversão</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div
            className={`relative overflow-hidden rounded-xl border border-slate-700/30 bg-gradient-to-br from-[#0f1e36] via-[#0b1a31] to-[#111f39] p-4 shadow-[0_18px_42px_-28px_rgba(0,0,0,0.85)] transition-all duration-700 ${
              dashboardReady ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-cyan-400" />
              <h3 className="text-xl font-bold text-white">Propostas por Serviço</h3>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 8 }}>
                <defs>
                  {chartData.map((entry, index) => {
                    const highlight = adjustHexColor(entry.color, 0.22);
                    const shadow = adjustHexColor(entry.color, -0.32);
                    return (
                      <linearGradient key={`service-bar-grad-${entry.name}`} id={`serviceBarGrad-${index}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={highlight} stopOpacity={0.95} />
                        <stop offset="55%" stopColor={entry.color} stopOpacity={0.85} />
                        <stop offset="100%" stopColor={shadow} stopOpacity={0.95} />
                      </linearGradient>
                    );
                  })}
                  <filter id="serviceBarShadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="12" stdDeviation="9" floodColor="#060d1f" floodOpacity="0.55" />
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px' }}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(value: number | string) => [`${value} propostas`, 'Volume']}
                />
                <Bar
                  dataKey="proposals"
                  radius={[12, 12, 4, 4]}
                  animationDuration={1200}
                  animationEasing="ease-out"
                  filter="url(#serviceBarShadow)"
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth={1}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`proposals-cell-${index}`} fill={`url(#serviceBarGrad-${index})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-cyan-500/10 to-transparent" />
          </div>

          <div
            className={`relative overflow-hidden rounded-xl border border-slate-700/30 bg-gradient-to-br from-[#111c33] via-[#0f1a2f] to-[#121f39] p-4 shadow-[0_18px_42px_-28px_rgba(0,0,0,0.85)] transition-all duration-700 delay-100 ${
              dashboardReady ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            <div className="mb-4 flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-purple-400" />
              <h3 className="text-xl font-bold text-white">Distribuição de Propostas</h3>
            </div>
            <div className="relative h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {safeProposalDistributionData.map((entry, index) => {
                      const highlight = adjustHexColor(entry.color, 0.25);
                      const shadow = adjustHexColor(entry.color, -0.35);
                      return (
                        <radialGradient key={`proposal-pie-grad-${index}`} id={`proposalPieGrad-${index}`} cx="30%" cy="30%" r="75%">
                          <stop offset="0%" stopColor={highlight} stopOpacity={0.95} />
                          <stop offset="60%" stopColor={entry.color} stopOpacity={0.9} />
                          <stop offset="100%" stopColor={shadow} stopOpacity={0.95} />
                        </radialGradient>
                      );
                    })}
                    <filter id="proposalPieShadow" x="-30%" y="-30%" width="160%" height="160%">
                      <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#070f25" floodOpacity="0.55" />
                    </filter>
                  </defs>
                  <Pie
                    data={safeProposalDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={96}
                    paddingAngle={3}
                    dataKey="value"
                    animationDuration={1300}
                    animationEasing="ease-out"
                    stroke="rgba(255,255,255,0.5)"
                    strokeWidth={1}
                    filter="url(#proposalPieShadow)"
                  >
                    {safeProposalDistributionData.map((entry, index) => (
                      <Cell key={`proposal-pie-${index}`} fill={`url(#proposalPieGrad-${index})`} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px' }}
                    labelStyle={{ color: '#e2e8f0' }}
                    formatter={(value: number | string) => [`${value} propostas`, 'Volume']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs uppercase tracking-wider text-slate-400">Total</span>
                <span className="text-2xl font-bold text-white">{totalProposalsMonth}</span>
              </div>
            </div>
          </div>

          <div
            className={`relative overflow-hidden rounded-xl border border-slate-700/30 bg-gradient-to-br from-[#101f36] via-[#0c1b30] to-[#121f39] p-4 shadow-[0_18px_42px_-28px_rgba(0,0,0,0.85)] transition-all duration-700 delay-200 ${
              dashboardReady ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              <h3 className="text-xl font-bold text-white">Volume x Receita</h3>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 8 }}>
                <defs>
                  <linearGradient id="volumeBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7dd3fc" stopOpacity={0.95} />
                    <stop offset="55%" stopColor="#38bdf8" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#0b4a6f" stopOpacity={0.95} />
                  </linearGradient>
                  <linearGradient id="volumeLineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.95} />
                    <stop offset="50%" stopColor="#34d399" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#86efac" stopOpacity={0.9} />
                  </linearGradient>
                  <filter id="volumeLineGlow" x="-40%" y="-40%" width="180%" height="180%">
                    <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#22c55e" floodOpacity="0.6" />
                  </filter>
                  <filter id="volumeBarShadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#061428" floodOpacity="0.55" />
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis yAxisId="left" stroke="#94a3b8" tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#94a3b8"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatCurrencyCompact(Number(value))}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px' }}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(value: number | string, name: string | number) =>
                    name === 'Valor'
                      ? [formatCurrency(Number(value)), 'Valor']
                      : [`${value} propostas`, 'Volume']
                  }
                />
                <Bar
                  yAxisId="left"
                  dataKey="proposals"
                  name="Propostas"
                  fill="url(#volumeBarGrad)"
                  radius={[10, 10, 4, 4]}
                  animationDuration={1100}
                  filter="url(#volumeBarShadow)"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth={1}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="amount"
                  name="Valor"
                  stroke="url(#volumeLineGrad)"
                  strokeWidth={3.5}
                  dot={{ r: 4, strokeWidth: 2, stroke: '#052e2b', fill: '#34d399' }}
                  activeDot={{ r: 6, fill: '#6ee7b7' }}
                  animationDuration={1450}
                  filter="url(#volumeLineGlow)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div
            className={`relative overflow-hidden rounded-xl border border-slate-700/30 bg-gradient-to-br from-[#111c33] via-[#0f1a2f] to-[#121f39] p-4 shadow-[0_18px_42px_-28px_rgba(0,0,0,0.85)] transition-all duration-700 delay-300 ${
              dashboardReady ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            <div className="mb-4 flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-emerald-400" />
              <h3 className="text-xl font-bold text-white">Distribuição de Valores</h3>
            </div>
            <div className="relative h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {safeValueDistributionData.map((entry, index) => {
                      const highlight = adjustHexColor(entry.color, 0.25);
                      const shadow = adjustHexColor(entry.color, -0.35);
                      return (
                        <radialGradient key={`value-pie-grad-${index}`} id={`valuePieGrad-${index}`} cx="30%" cy="30%" r="75%">
                          <stop offset="0%" stopColor={highlight} stopOpacity={0.95} />
                          <stop offset="60%" stopColor={entry.color} stopOpacity={0.9} />
                          <stop offset="100%" stopColor={shadow} stopOpacity={0.95} />
                        </radialGradient>
                      );
                    })}
                    <filter id="valuePieShadow" x="-30%" y="-30%" width="160%" height="160%">
                      <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#070f25" floodOpacity="0.55" />
                    </filter>
                  </defs>
                  <Pie
                    data={safeValueDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={96}
                    paddingAngle={3}
                    dataKey="value"
                    animationDuration={1300}
                    animationEasing="ease-out"
                    stroke="rgba(255,255,255,0.5)"
                    strokeWidth={1}
                    filter="url(#valuePieShadow)"
                  >
                    {safeValueDistributionData.map((entry, index) => (
                      <Cell key={`value-pie-${index}`} fill={`url(#valuePieGrad-${index})`} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px' }}
                    labelStyle={{ color: '#e2e8f0' }}
                    formatter={(value: number | string) => [formatCurrency(Number(value)), 'Valor']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs uppercase tracking-wider text-slate-400">Receita</span>
                <span className="text-2xl font-bold text-white">{formatCurrencyCompact(totalValueMonth)}</span>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-3 shadow-lg">
              <Server className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">Visão Geral</h2>
              <p className="text-slate-400">Resumo de propostas por calculadora</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard icon={<Phone className="w-6 h-6 text-blue-500" />} title="Propostas PABX/SIP" value={countProposalsByType.pabx.toString()} subtext="Total" />
          <StatCard icon={<Server className="w-6 h-6 text-purple-500" />} title="Propostas Máquinas Virtuais" value={countProposalsByType.maquinasVirtuais.toString()} subtext="Total" />
          <StatCard icon={<Wifi className="w-6 h-6 text-green-500" />} title="Propostas Internet Fibra" value={countProposalsByType.fibra.toString()} subtext="Total" />
          <StatCard icon={<Radio className="w-6 h-6 text-red-500" />} title="Propostas Double-Fibra/Radio" value={countProposalsByType.doubleFibraRadio.toString()} subtext="Total" />
          <StatCard icon={<Wifi className="w-6 h-6 text-cyan-500" />} title="Propostas Internet Man Fibra" value={countProposalsByType.man.toString()} subtext="Total" />
          <StatCard icon={<Radio className="w-6 h-6 text-orange-500" />} title="Propostas Internet Man Radio" value={countProposalsByType.manRadio.toString()} subtext="Total" />
        </div>
      </div>

      <ProposalsView 
        proposals={proposals} 
        partners={partners}
        onSave={handleSave}
        onDelete={handleDelete}
        onBackToTop={handleBackToTop}
      />
    </div>
  );
};

export default DashboardView;
