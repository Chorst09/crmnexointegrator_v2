import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  BarElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";
import { Line, Doughnut, Bar } from "react-chartjs-2";
import {
  Activity,
  BarChart3,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  FolderKanban,
  Gauge,
  Layers3,
  PieChart,
  RefreshCcw,
  Rocket,
  Search,
  SlidersHorizontal,
  Target,
  TrendingDown,
  TrendingUp,
  Users
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import GradientCard from "../components/GradientCard";
import AnimatedStats from "../components/AnimatedStats";
import ModernTable from "../components/ModernTable";
import { buildApiUrl, getAuthHeaders } from "../config/api";

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  BarElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const REPORT_TYPES = [
  { id: "executive", label: "Executivo", icon: Gauge, description: "KPIs, receita, forecast e saúde do funil" },
  { id: "pipeline", label: "Pipeline", icon: Layers3, description: "Etapas, valores, probabilidade e aging" },
  { id: "sellers", label: "Vendedores", icon: Users, description: "Ranking, conversão e carteira por responsável" },
  { id: "clients", label: "Clientes", icon: Building2, description: "Segmentos, tipos, lead score e base ativa" },
  { id: "activities", label: "Atividades", icon: Activity, description: "Pendências, atrasos e produtividade" },
  { id: "contracts", label: "Contratos", icon: FileText, description: "Receita contratada, vencimentos e status" },
  { id: "projects", label: "Projetos", icon: FolderKanban, description: "Status, saúde, fases, orçamento e entregas" },
  { id: "kickoff", label: "Kickoff", icon: Rocket, description: "Reuniões internas, externas, agenda e ações" },
  { id: "losses", label: "Perdas", icon: TrendingDown, description: "Motivos, gargalos e oportunidades perdidas" }
];

const STAGE_ORDER = ["LEAD", "QUALIFICATION", "DIAGNOSIS", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];
const OPEN_STAGES = new Set(["LEAD", "QUALIFICATION", "DIAGNOSIS", "PROPOSAL", "NEGOTIATION"]);
const STAGE_LABELS = {
  LEAD: "Lead",
  QUALIFICATION: "Qualificação",
  DIAGNOSIS: "Diagnóstico",
  PROPOSAL: "Proposta",
  NEGOTIATION: "Negociação",
  WON: "Ganha",
  LOST: "Perdida"
};

const PROJECT_PHASE_ORDER = ["SETUP", "KICKOFF_INTERNO", "KICKOFF_EXTERNO", "EXECUCAO", "MONITORAMENTO", "ENCERRAMENTO"];
const PROJECT_PHASE_LABELS = {
  SETUP: "Setup",
  KICKOFF_INTERNO: "Kickoff interno",
  KICKOFF_EXTERNO: "Kickoff externo",
  EXECUCAO: "Execução",
  MONITORAMENTO: "Monitoramento",
  ENCERRAMENTO: "Encerramento"
};

const PROJECT_STATUS_LABELS = {
  PLANEJADO: "Planejado",
  EM_ANDAMENTO: "Em andamento",
  PAUSADO: "Pausado",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado"
};

const KICKOFF_PHASE_ORDER = [
  "ENTENDIMENTO_OPORTUNIDADE",
  "APRESENTACAO_PROPOSTA",
  "FECHAMENTO_PROJETO",
  "ALINHAMENTO_INTERNO",
  "ALINHAMENTO_EXTERNO"
];
const KICKOFF_PHASE_LABELS = {
  ENTENDIMENTO_OPORTUNIDADE: "Entendimento",
  APRESENTACAO_PROPOSTA: "Apresentação",
  FECHAMENTO_PROJETO: "Fechamento",
  ALINHAMENTO_INTERNO: "Kickoff interno",
  ALINHAMENTO_EXTERNO: "Kickoff externo"
};

const KICKOFF_STATUS_LABELS = {
  AGENDADA: "Agendada",
  REALIZADA: "Realizada",
  CANCELADA: "Cancelada",
  REAGENDADA: "Reagendada"
};

const PERIODS = [
  { value: "30", label: "30 dias", days: 30 },
  { value: "90", label: "90 dias", days: 90 },
  { value: "180", label: "6 meses", days: 180 },
  { value: "365", label: "12 meses", days: 365 },
  { value: "all", label: "Todo histórico", days: null }
];

const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const dateValue = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isInRange = (value, startDate) => {
  if (!startDate) return true;
  const date = dateValue(value);
  return date ? date >= startDate : false;
};

const monthKey = (value) => {
  const date = dateValue(value);
  if (!date) return "Sem data";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const monthLabel = (key) => {
  if (key === "Sem data") return key;
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
};

const downloadCsv = (filename, rows) => {
  const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = rows.map((row) => row.map(escapeCell).join(";")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default function Relatorios() {
  const [rawData, setRawData] = useState({
    dashboard: null,
    opportunities: [],
    companies: [],
    activities: [],
    contracts: [],
    projects: [],
    kickoffMeetings: [],
    users: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    reportType: "executive",
    period: "180",
    clientType: "all",
    stage: "all",
    ownerId: "all",
    source: "all",
    status: "all",
    minValue: "",
    search: ""
  });

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const [activeReport, setActiveReport] = useState("executive");

  const loadReports = async () => {
    setLoading(true);
    setError("");
    try {
      const headers = getAuthHeaders();
      const [
        dashboardRes,
        opportunitiesRes,
        companiesRes,
        activitiesRes,
        contractsRes,
        projectsRes,
        kickoffRes,
        usersRes
      ] = await Promise.all([
        axios.get(buildApiUrl("/dashboard?type=executive&period=12"), { headers }),
        axios.get(buildApiUrl("/opportunities"), { headers }),
        axios.get(buildApiUrl("/companies"), { headers }),
        axios.get(buildApiUrl("/activities"), { headers }),
        axios.get(buildApiUrl("/contracts?limit=500"), { headers }),
        axios.get(buildApiUrl("/projetos?limit=500"), { headers }),
        axios.get(buildApiUrl("/kickoff/meetings?limit=500"), { headers }),
        axios.get(buildApiUrl("/users"), { headers })
      ]);

      setRawData({
        dashboard: dashboardRes.data || null,
        opportunities: Array.isArray(opportunitiesRes.data) ? opportunitiesRes.data : [],
        companies: Array.isArray(companiesRes.data) ? companiesRes.data : [],
        activities: Array.isArray(activitiesRes.data) ? activitiesRes.data : [],
        contracts: Array.isArray(contractsRes.data) ? contractsRes.data : [],
        projects: Array.isArray(projectsRes.data?.projects) ? projectsRes.data.projects : [],
        kickoffMeetings: Array.isArray(kickoffRes.data?.meetings) ? kickoffRes.data.meetings : [],
        users: Array.isArray(usersRes.data) ? usersRes.data : []
      });
    } catch (loadError) {
      console.error("Erro ao carregar relatórios:", loadError);
      setError("Não foi possível carregar todos os dados de gestão. Verifique API, autenticação e permissões.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const formatCurrency = (value) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numberValue(value));

  const formatPercent = (value) => `${numberValue(value).toFixed(1)}%`;

  const formatDate = (value) => {
    const date = dateValue(value);
    return date ? date.toLocaleDateString("pt-BR") : "-";
  };

  const analysis = useMemo(() => {
    const periodConfig = PERIODS.find((item) => item.value === filters.period) || PERIODS[2];
    const startDate = periodConfig.days ? new Date(Date.now() - periodConfig.days * 24 * 60 * 60 * 1000) : null;
    const minValue = filters.minValue === "" ? null : numberValue(filters.minValue);
    const search = filters.search.trim().toLowerCase();

    const opportunities = rawData.opportunities.filter((item) => {
      const companyName = item.company?.name || "";
      const title = item.title || item.projectName || "";
      const source = String(item.source || "SEM_ORIGEM");
      const clientType = item.clientType || item.projectClientType || item.company?.clientType || "B2B";
      const dateBasis = item.actualCloseDate || item.expectedCloseDate || item.updatedAt || item.createdAt;

      if (!isInRange(dateBasis, startDate)) return false;
      if (filters.clientType !== "all" && clientType !== filters.clientType) return false;
      if (filters.stage !== "all" && item.stage !== filters.stage) return false;
      if (filters.ownerId !== "all" && item.ownerId !== filters.ownerId) return false;
      if (filters.source !== "all" && source !== filters.source) return false;
      if (minValue !== null && numberValue(item.value) < minValue) return false;
      if (search && !`${title} ${companyName} ${item.number || ""}`.toLowerCase().includes(search)) return false;
      return true;
    });

    const companies = rawData.companies.filter((item) => {
      if (filters.clientType !== "all" && item.clientType !== filters.clientType) return false;
      if (filters.status !== "all" && item.status !== filters.status) return false;
      if (!isInRange(item.updatedAt || item.createdAt, startDate)) return false;
      if (search && !`${item.name || ""} ${item.document || ""} ${item.segment || ""}`.toLowerCase().includes(search)) return false;
      return true;
    });

    const activities = rawData.activities.filter((item) => {
      if (!isInRange(item.dueDate || item.updatedAt || item.createdAt, startDate)) return false;
      if (filters.ownerId !== "all" && item.assignedToId !== filters.ownerId) return false;
      if (filters.status !== "all" && item.status !== filters.status) return false;
      if (search && !`${item.subject || ""} ${item.company?.name || ""} ${item.opportunity?.title || ""}`.toLowerCase().includes(search)) return false;
      return true;
    });

    const contracts = rawData.contracts.filter((item) => {
      if (!isInRange(item.startDate || item.createdAt, startDate)) return false;
      if (filters.status !== "all" && item.status !== filters.status) return false;
      if (filters.clientType !== "all") {
        const company = rawData.companies.find((candidate) => candidate.id === item.companyId);
        if ((company?.clientType || item.company?.clientType) !== filters.clientType) return false;
      }
      if (search && !`${item.number || ""} ${item.title || ""} ${item.company?.name || ""}`.toLowerCase().includes(search)) return false;
      return true;
    });

    const projects = rawData.projects.filter((item) => {
      const projectType = item.type || item.company?.clientType;
      const dateBasis = item.actualEndDate || item.plannedEndDate || item.updatedAt || item.createdAt;

      if (!isInRange(dateBasis, startDate)) return false;
      if (filters.clientType !== "all" && projectType !== filters.clientType) return false;
      if (filters.stage !== "all" && item.phase !== filters.stage) return false;
      if (filters.ownerId !== "all" && item.projectManagerId !== filters.ownerId) return false;
      if (filters.status !== "all" && item.status !== filters.status) return false;
      if (minValue !== null && numberValue(item.budget) < minValue) return false;
      if (search && !`${item.number || ""} ${item.name || ""} ${item.description || ""} ${item.company?.name || ""}`.toLowerCase().includes(search)) return false;
      return true;
    });

    const kickoffMeetings = rawData.kickoffMeetings.filter((item) => {
      if (!isInRange(item.scheduledDate || item.updatedAt || item.createdAt, startDate)) return false;
      if (filters.clientType !== "all" && (item.company?.clientType || item.opportunity?.projectClientType) !== filters.clientType) return false;
      if (filters.stage !== "all" && item.phase !== filters.stage) return false;
      if (filters.ownerId !== "all" && item.ownerId !== filters.ownerId) return false;
      if (filters.status !== "all" && item.status !== filters.status) return false;
      if (minValue !== null && numberValue(item.opportunity?.value) < minValue) return false;
      if (search && !`${item.number || ""} ${item.title || ""} ${item.company?.name || ""} ${item.opportunity?.title || ""}`.toLowerCase().includes(search)) return false;
      return true;
    });

    const openOpps = opportunities.filter((item) => OPEN_STAGES.has(item.stage));
    const wonOpps = opportunities.filter((item) => item.stage === "WON");
    const lostOpps = opportunities.filter((item) => item.stage === "LOST");
    const weightedPipeline = openOpps.reduce((sum, item) => sum + numberValue(item.value) * (numberValue(item.probability) / 100), 0);
    const pipelineValue = openOpps.reduce((sum, item) => sum + numberValue(item.value), 0);
    const wonValue = wonOpps.reduce((sum, item) => sum + numberValue(item.value), 0);
    const lostValue = lostOpps.reduce((sum, item) => sum + numberValue(item.value), 0);
    const conversionBase = wonOpps.length + lostOpps.length;
    const conversionRate = conversionBase ? (wonOpps.length / conversionBase) * 100 : 0;
    const avgTicket = wonOpps.length ? wonValue / wonOpps.length : 0;

    const overdueActivities = activities.filter((item) => {
      const due = dateValue(item.dueDate);
      return due && due < new Date() && !["COMPLETED", "CANCELLED"].includes(item.status);
    });

    const activeContracts = contracts.filter((item) => item.status === "ACTIVE");
    const expiringContracts = activeContracts.filter((item) => {
      const end = dateValue(item.endDate);
      if (!end) return false;
      const diffDays = (end.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 90;
    });
    const contractValue = activeContracts.reduce((sum, item) => sum + numberValue(item.value), 0);
    const activeProjects = projects.filter((item) => !["CONCLUIDO", "CANCELADO"].includes(item.status));
    const completedProjects = projects.filter((item) => item.status === "CONCLUIDO");
    const delayedProjects = activeProjects.filter((item) => {
      const end = dateValue(item.plannedEndDate);
      return end && end < new Date();
    });
    const projectBudget = projects.reduce((sum, item) => sum + numberValue(item.budget), 0);
    const avgProjectProgress = projects.length
      ? projects.reduce((sum, item) => sum + numberValue(item.progressPercent), 0) / projects.length
      : 0;
    const avgProjectHealth = projects.length
      ? projects.reduce((sum, item) => sum + numberValue(item.healthScore), 0) / projects.length
      : 0;
    const completedKickoffs = kickoffMeetings.filter((item) => item.status === "REALIZADA");
    const scheduledKickoffs = kickoffMeetings.filter((item) => ["AGENDADA", "REAGENDADA"].includes(item.status));
    const overdueKickoffs = scheduledKickoffs.filter((item) => {
      const scheduled = dateValue(item.scheduledDate);
      return scheduled && scheduled < new Date();
    });
    const kickoffCompletionRate = kickoffMeetings.length ? (completedKickoffs.length / kickoffMeetings.length) * 100 : 0;
    const kickoffActionItems = kickoffMeetings.reduce((sum, item) => sum + numberValue(item._count?.actionItems), 0);
    const kickoffParticipants = kickoffMeetings.reduce((sum, item) => sum + numberValue(item._count?.participants), 0);

    const byStage = STAGE_ORDER.map((stage) => {
      const rows = opportunities.filter((item) => item.stage === stage);
      return {
        stage,
        label: STAGE_LABELS[stage] || stage,
        count: rows.length,
        value: rows.reduce((sum, item) => sum + numberValue(item.value), 0)
      };
    });

    const byMonth = [...opportunities.reduce((map, item) => {
      const key = monthKey(item.actualCloseDate || item.expectedCloseDate || item.updatedAt || item.createdAt);
      const current = map.get(key) || { key, won: 0, pipeline: 0, lost: 0, deals: 0 };
      current.deals += 1;
      if (item.stage === "WON") current.won += numberValue(item.value);
      if (item.stage === "LOST") current.lost += numberValue(item.value);
      if (OPEN_STAGES.has(item.stage)) current.pipeline += numberValue(item.value);
      map.set(key, current);
      return map;
    }, new Map()).values()].sort((a, b) => a.key.localeCompare(b.key));

    const bySource = [...opportunities.reduce((map, item) => {
      const key = item.source || "Sem origem";
      const current = map.get(key) || { source: key, count: 0, value: 0 };
      current.count += 1;
      current.value += numberValue(item.value);
      map.set(key, current);
      return map;
    }, new Map()).values()].sort((a, b) => b.count - a.count);

    const byLoss = [...lostOpps.reduce((map, item) => {
      const key = item.lossReason || "Não informado";
      const current = map.get(key) || { reason: key, count: 0, value: 0 };
      current.count += 1;
      current.value += numberValue(item.value);
      map.set(key, current);
      return map;
    }, new Map()).values()].sort((a, b) => b.count - a.count);

    const bySeller = [...opportunities.reduce((map, item) => {
      const key = item.ownerId || "sem-responsavel";
      const current = map.get(key) || {
        id: key,
        name: item.owner?.name || "Não atribuído",
        open: 0,
        won: 0,
        lost: 0,
        pipeline: 0,
        revenue: 0,
        weighted: 0
      };
      if (OPEN_STAGES.has(item.stage)) {
        current.open += 1;
        current.pipeline += numberValue(item.value);
        current.weighted += numberValue(item.value) * (numberValue(item.probability) / 100);
      }
      if (item.stage === "WON") {
        current.won += 1;
        current.revenue += numberValue(item.value);
      }
      if (item.stage === "LOST") current.lost += 1;
      map.set(key, current);
      return map;
    }, new Map()).values()]
      .map((item) => ({
        ...item,
        conversion: item.won + item.lost ? (item.won / (item.won + item.lost)) * 100 : 0
      }))
      .sort((a, b) => b.revenue + b.weighted - (a.revenue + a.weighted));

    const byClientType = ["B2B", "B2G", "B2C"].map((clientType) => {
      const rows = companies.filter((item) => item.clientType === clientType);
      return { clientType, count: rows.length };
    }).filter((item) => item.count > 0);

    const leadScoreBands = [
      { label: "Quentes", min: 80, max: 100 },
      { label: "Mornos", min: 60, max: 79 },
      { label: "Nutrição", min: 40, max: 59 },
      { label: "Baixa prioridade", min: 0, max: 39 }
    ].map((band) => ({
      ...band,
      count: companies.filter((item) => numberValue(item.leadScore) >= band.min && numberValue(item.leadScore) <= band.max).length
    }));

    const byProjectStatus = Object.keys(PROJECT_STATUS_LABELS).map((status) => {
      const rows = projects.filter((item) => item.status === status);
      return { status, label: PROJECT_STATUS_LABELS[status], count: rows.length };
    }).filter((item) => item.count > 0);

    const byProjectPhase = PROJECT_PHASE_ORDER.map((phase) => {
      const rows = projects.filter((item) => item.phase === phase);
      return {
        phase,
        label: PROJECT_PHASE_LABELS[phase] || phase,
        count: rows.length,
        budget: rows.reduce((sum, item) => sum + numberValue(item.budget), 0)
      };
    });

    const byKickoffStatus = Object.keys(KICKOFF_STATUS_LABELS).map((status) => {
      const rows = kickoffMeetings.filter((item) => item.status === status);
      return { status, label: KICKOFF_STATUS_LABELS[status], count: rows.length };
    }).filter((item) => item.count > 0);

    const byKickoffPhase = KICKOFF_PHASE_ORDER.map((phase) => {
      const rows = kickoffMeetings.filter((item) => item.phase === phase);
      return {
        phase,
        label: KICKOFF_PHASE_LABELS[phase] || phase,
        count: rows.length
      };
    });

    const projectsByMonth = [...projects.reduce((map, item) => {
      const key = monthKey(item.actualEndDate || item.plannedEndDate || item.updatedAt || item.createdAt);
      const current = map.get(key) || { key, planned: 0, active: 0, completed: 0 };
      if (item.status === "PLANEJADO") current.planned += 1;
      if (item.status === "EM_ANDAMENTO") current.active += 1;
      if (item.status === "CONCLUIDO") current.completed += 1;
      map.set(key, current);
      return map;
    }, new Map()).values()].sort((a, b) => a.key.localeCompare(b.key));

    const kickoffsByMonth = [...kickoffMeetings.reduce((map, item) => {
      const key = monthKey(item.scheduledDate || item.updatedAt || item.createdAt);
      const current = map.get(key) || { key, scheduled: 0, completed: 0, rescheduled: 0 };
      if (item.status === "REALIZADA") current.completed += 1;
      if (item.status === "REAGENDADA") current.rescheduled += 1;
      if (item.status === "AGENDADA") current.scheduled += 1;
      map.set(key, current);
      return map;
    }, new Map()).values()].sort((a, b) => a.key.localeCompare(b.key));

    return {
      startDate,
      opportunities,
      companies,
      activities,
      contracts,
      projects,
      kickoffMeetings,
      openOpps,
      wonOpps,
      lostOpps,
      overdueActivities,
      activeContracts,
      expiringContracts,
      activeProjects,
      completedProjects,
      delayedProjects,
      completedKickoffs,
      scheduledKickoffs,
      overdueKickoffs,
      kpis: {
        pipelineValue,
        weightedPipeline,
        wonValue,
        lostValue,
        conversionRate,
        avgTicket,
        openCount: openOpps.length,
        wonCount: wonOpps.length,
        lostCount: lostOpps.length,
        companiesCount: companies.length,
        activitiesCount: activities.length,
        overdueActivitiesCount: overdueActivities.length,
        contractsCount: contracts.length,
        activeContractsCount: activeContracts.length,
        expiringContractsCount: expiringContracts.length,
        contractValue,
        projectsCount: projects.length,
        activeProjectsCount: activeProjects.length,
        completedProjectsCount: completedProjects.length,
        delayedProjectsCount: delayedProjects.length,
        projectBudget,
        avgProjectProgress,
        avgProjectHealth,
        kickoffCount: kickoffMeetings.length,
        completedKickoffCount: completedKickoffs.length,
        scheduledKickoffCount: scheduledKickoffs.length,
        overdueKickoffCount: overdueKickoffs.length,
        kickoffCompletionRate,
        kickoffActionItems,
        kickoffParticipants
      },
      byStage,
      byMonth,
      bySource,
      byLoss,
      bySeller,
      byClientType,
      leadScoreBands,
      byProjectStatus,
      byProjectPhase,
      byKickoffStatus,
      byKickoffPhase,
      projectsByMonth,
      kickoffsByMonth
    };
  }, [rawData, filters]);

  const optionSets = useMemo(() => {
    const sources = [...new Set(rawData.opportunities.map((item) => item.source || "SEM_ORIGEM"))].sort();
    const owners = rawData.users
      .filter((user) => ["SELLER", "MANAGER", "ADMIN", "MASTER"].includes(user.role))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    const statuses = [...new Set([
      ...rawData.companies.map((item) => item.status).filter(Boolean),
      ...rawData.activities.map((item) => item.status).filter(Boolean),
      ...rawData.contracts.map((item) => item.status).filter(Boolean),
      ...rawData.projects.map((item) => item.status).filter(Boolean),
      ...rawData.kickoffMeetings.map((item) => item.status).filter(Boolean)
    ])].sort();
    return { sources, owners, statuses };
  }, [rawData]);

  const chartTextColor = "rgba(148, 163, 184, 0.95)";
  const chartGridColor = "rgba(148, 163, 184, 0.16)";
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: { usePointStyle: true, padding: 18, color: chartTextColor, font: { size: 12 } }
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.94)",
        titleColor: "white",
        bodyColor: "white",
        borderColor: "rgba(255, 255, 255, 0.12)",
        borderWidth: 1,
        cornerRadius: 10
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: chartTextColor, font: { size: 11 } } },
      y: { grid: { color: chartGridColor }, ticks: { color: chartTextColor, font: { size: 11 } } }
    }
  };

  const revenueData = {
    labels: analysis.byMonth.map((item) => monthLabel(item.key)),
    datasets: [
      {
        label: "Receita ganha",
        data: analysis.byMonth.map((item) => item.won),
        borderColor: "rgb(16, 185, 129)",
        backgroundColor: "rgba(16, 185, 129, 0.14)",
        borderWidth: 3,
        fill: true,
        tension: 0.35
      },
      {
        label: "Pipeline aberto",
        data: analysis.byMonth.map((item) => item.pipeline),
        borderColor: "rgb(56, 189, 248)",
        backgroundColor: "rgba(24, 200, 223, 0.1)",
        borderWidth: 2,
        fill: true,
        tension: 0.35
      }
    ]
  };

  const stageData = {
    labels: analysis.byStage.map((item) => item.label),
    datasets: [
      {
        label: "Valor",
        data: analysis.byStage.map((item) => item.value),
        backgroundColor: ["#64748b", "#18c8df", "#818cf8", "#f59e0b", "#fb7185", "#10b981", "#94a3b8"],
        borderRadius: 8,
        borderSkipped: false
      }
    ]
  };

  const sourceData = {
    labels: analysis.bySource.slice(0, 8).map((item) => item.source),
    datasets: [
      {
        data: analysis.bySource.slice(0, 8).map((item) => item.count),
        backgroundColor: ["#18c8df", "#10b981", "#f59e0b", "#818cf8", "#fb7185", "#14b8a6", "#f97316", "#a3e635"],
        borderWidth: 0
      }
    ]
  };

  const lossData = {
    labels: analysis.byLoss.slice(0, 8).map((item) => item.reason),
    datasets: [
      {
        label: "Perdas",
        data: analysis.byLoss.slice(0, 8).map((item) => item.count),
        backgroundColor: "rgba(244, 63, 94, 0.75)",
        borderRadius: 8,
        borderSkipped: false
      }
    ]
  };

  const projectPhaseData = {
    labels: analysis.byProjectPhase.map((item) => item.label),
    datasets: [
      {
        label: "Projetos",
        data: analysis.byProjectPhase.map((item) => item.count),
        backgroundColor: ["#f97316", "#f59e0b", "#22c55e", "#18c8df", "#818cf8", "#10b981"],
        borderRadius: 8,
        borderSkipped: false
      }
    ]
  };

  const projectTimelineData = {
    labels: analysis.projectsByMonth.map((item) => monthLabel(item.key)),
    datasets: [
      {
        label: "Em andamento",
        data: analysis.projectsByMonth.map((item) => item.active),
        borderColor: "rgb(24, 200, 223)",
        backgroundColor: "rgba(24, 200, 223, 0.14)",
        borderWidth: 3,
        fill: true,
        tension: 0.35
      },
      {
        label: "Concluídos",
        data: analysis.projectsByMonth.map((item) => item.completed),
        borderColor: "rgb(34, 197, 94)",
        backgroundColor: "rgba(34, 197, 94, 0.12)",
        borderWidth: 2,
        fill: true,
        tension: 0.35
      }
    ]
  };

  const kickoffPhaseData = {
    labels: analysis.byKickoffPhase.map((item) => item.label),
    datasets: [
      {
        label: "Reuniões",
        data: analysis.byKickoffPhase.map((item) => item.count),
        backgroundColor: ["#18c8df", "#818cf8", "#f59e0b", "#22c55e", "#f97316"],
        borderRadius: 8,
        borderSkipped: false
      }
    ]
  };

  const kickoffTimelineData = {
    labels: analysis.kickoffsByMonth.map((item) => monthLabel(item.key)),
    datasets: [
      {
        label: "Agendadas",
        data: analysis.kickoffsByMonth.map((item) => item.scheduled),
        borderColor: "rgb(249, 115, 22)",
        backgroundColor: "rgba(249, 115, 22, 0.14)",
        borderWidth: 3,
        fill: true,
        tension: 0.35
      },
      {
        label: "Realizadas",
        data: analysis.kickoffsByMonth.map((item) => item.completed),
        borderColor: "rgb(34, 197, 94)",
        backgroundColor: "rgba(34, 197, 94, 0.12)",
        borderWidth: 2,
        fill: true,
        tension: 0.35
      }
    ]
  };

  const exportReport = () => {
    if (filters.reportType === "projects") {
      downloadCsv("relatorio-gestao-projetos.csv", [
        ["Número", "Projeto", "Cliente", "Tipo", "Fase", "Status", "Gestor", "Orçamento", "Progresso", "Saúde", "Fim previsto"],
        ...analysis.projects.map((item) => [
          item.number || "",
          item.name || "",
          item.company?.name || "",
          item.type || "",
          PROJECT_PHASE_LABELS[item.phase] || item.phase || "",
          PROJECT_STATUS_LABELS[item.status] || item.status || "",
          item.projectManager?.name || "",
          numberValue(item.budget),
          `${numberValue(item.progressPercent)}%`,
          `${numberValue(item.healthScore)}%`,
          formatDate(item.plannedEndDate)
        ])
      ]);
      return;
    }

    if (filters.reportType === "kickoff") {
      downloadCsv("relatorio-gestao-kickoff.csv", [
        ["Número", "Reunião", "Cliente", "Oportunidade", "Fase", "Status", "Responsável", "Data", "Participantes", "Ações"],
        ...analysis.kickoffMeetings.map((item) => [
          item.number || "",
          item.title || "",
          item.company?.name || "",
          item.opportunity?.title || "",
          KICKOFF_PHASE_LABELS[item.phase] || item.phase || "",
          KICKOFF_STATUS_LABELS[item.status] || item.status || "",
          item.owner?.name || "",
          formatDate(item.scheduledDate),
          numberValue(item._count?.participants),
          numberValue(item._count?.actionItems)
        ])
      ]);
      return;
    }

    downloadCsv(`relatorio-gestao-${filters.reportType}.csv`, [
      ["Número", "Oportunidade", "Cliente", "Tipo", "Etapa", "Responsável", "Origem", "Valor", "Probabilidade", "Previsão", "Atualizado"],
      ...analysis.opportunities.map((item) => [
        item.number || "",
        item.title || item.projectName || "",
        item.company?.name || "",
        item.clientType || item.projectClientType || item.company?.clientType || "",
        STAGE_LABELS[item.stage] || item.stage,
        item.owner?.name || "",
        item.source || "",
        numberValue(item.value),
        `${numberValue(item.probability)}%`,
        formatDate(item.expectedCloseDate),
        formatDate(item.updatedAt)
      ])
    ]);
  };

  const executeReport = () => setActiveReport(filters.reportType);
  const selectedReport = REPORT_TYPES.find((item) => item.id === filters.reportType) || REPORT_TYPES[0];
  const reportHighlights = {
    executive: [
      { title: "Receita ganha", value: formatCurrency(analysis.kpis.wonValue), detail: "Fechamentos no período filtrado", tone: "green" },
      { title: "Forecast ponderado", value: formatCurrency(analysis.kpis.weightedPipeline), detail: "Pipeline ajustado por probabilidade" },
      { title: "Conversão", value: formatPercent(analysis.kpis.conversionRate), detail: "Ganhas sobre ganhas + perdidas", tone: "amber" },
      { title: "Ticket médio", value: formatCurrency(analysis.kpis.avgTicket), detail: "Média dos negócios ganhos" }
    ],
    pipeline: [
      { title: "Pipeline aberto", value: formatCurrency(analysis.kpis.pipelineValue), detail: `${analysis.kpis.openCount} oportunidades abertas` },
      { title: "Maior etapa", value: analysis.byStage.reduce((best, item) => item.value > best.value ? item : best, { label: "-", value: 0 }).label, detail: "Etapa com maior valor em carteira", tone: "amber" },
      { title: "Negociação", value: formatCurrency(analysis.byStage.find((item) => item.stage === "NEGOTIATION")?.value || 0), detail: "Valor em fase final" },
      { title: "Propostas", value: formatCurrency(analysis.byStage.find((item) => item.stage === "PROPOSAL")?.value || 0), detail: "Valor em proposta enviada" }
    ],
    sellers: [
      { title: "Líder em receita", value: analysis.bySeller[0]?.name || "-", detail: analysis.bySeller[0] ? formatCurrency(analysis.bySeller[0].revenue) : "Sem receita no filtro", tone: "green" },
      { title: "Vendedores ativos", value: analysis.bySeller.length, detail: "Com oportunidades no filtro" },
      { title: "Melhor conversão", value: analysis.bySeller.reduce((best, item) => item.conversion > best.conversion ? item : best, { name: "-", conversion: 0 }).name, detail: "Entre responsáveis com perdas/ganhos" },
      { title: "Forecast da equipe", value: formatCurrency(analysis.bySeller.reduce((sum, item) => sum + item.weighted, 0)), detail: "Ponderado por vendedor" }
    ],
    clients: [
      { title: "Clientes no filtro", value: analysis.kpis.companiesCount, detail: "Empresas elegíveis" },
      { title: "Leads quentes", value: analysis.leadScoreBands.find((item) => item.label === "Quentes")?.count || 0, detail: "Lead score entre 80 e 100", tone: "green" },
      { title: "Base B2B", value: analysis.byClientType.find((item) => item.clientType === "B2B")?.count || 0, detail: "Empresas privadas" },
      { title: "Base B2G", value: analysis.byClientType.find((item) => item.clientType === "B2G")?.count || 0, detail: "Governo e setor público" }
    ],
    activities: [
      { title: "Atividades", value: analysis.kpis.activitiesCount, detail: "Dentro dos filtros" },
      { title: "Atrasadas", value: analysis.kpis.overdueActivitiesCount, detail: "Pendências vencidas", tone: analysis.kpis.overdueActivitiesCount > 0 ? "red" : "green" },
      { title: "Taxa de atraso", value: formatPercent(analysis.kpis.activitiesCount ? (analysis.kpis.overdueActivitiesCount / analysis.kpis.activitiesCount) * 100 : 0), detail: "Atrasos sobre atividades" },
      { title: "Responsáveis", value: optionSets.owners.length, detail: "Usuários comerciais disponíveis" }
    ],
    contracts: [
      { title: "Contratos ativos", value: analysis.kpis.activeContractsCount, detail: "Contratos em vigor" },
      { title: "Valor ativo", value: formatCurrency(analysis.kpis.contractValue), detail: "Receita contratada ativa", tone: "green" },
      { title: "Vencem em 90 dias", value: analysis.kpis.expiringContractsCount, detail: "Renovações prioritárias", tone: analysis.kpis.expiringContractsCount > 0 ? "amber" : "green" },
      { title: "Total no filtro", value: analysis.kpis.contractsCount, detail: "Contratos carregados" }
    ],
    projects: [
      { title: "Projetos no filtro", value: analysis.kpis.projectsCount, detail: `${analysis.kpis.activeProjectsCount} ativos` },
      { title: "Saúde média", value: formatPercent(analysis.kpis.avgProjectHealth), detail: "Health score médio", tone: analysis.kpis.avgProjectHealth < 70 ? "amber" : "green" },
      { title: "Progresso médio", value: formatPercent(analysis.kpis.avgProjectProgress), detail: "Avanço consolidado das entregas" },
      { title: "Atrasados", value: analysis.kpis.delayedProjectsCount, detail: "Fim previsto já vencido", tone: analysis.kpis.delayedProjectsCount > 0 ? "red" : "green" }
    ],
    kickoff: [
      { title: "Kickoffs", value: analysis.kpis.kickoffCount, detail: `${analysis.kpis.scheduledKickoffCount} agendados ou reagendados` },
      { title: "Realizados", value: analysis.kpis.completedKickoffCount, detail: "Reuniões concluídas", tone: "green" },
      { title: "Taxa de realização", value: formatPercent(analysis.kpis.kickoffCompletionRate), detail: "Realizadas sobre total" },
      { title: "Ações geradas", value: analysis.kpis.kickoffActionItems, detail: `${analysis.kpis.kickoffParticipants} participantes envolvidos`, tone: "amber" }
    ],
    losses: [
      { title: "Valor perdido", value: formatCurrency(analysis.kpis.lostValue), detail: "Soma das oportunidades perdidas", tone: analysis.kpis.lostValue > 0 ? "red" : "green" },
      { title: "Perdas", value: analysis.kpis.lostCount, detail: "Quantidade de perdas" },
      { title: "Principal motivo", value: analysis.byLoss[0]?.reason || "-", detail: analysis.byLoss[0] ? `${analysis.byLoss[0].count} ocorrências` : "Sem motivo registrado", tone: "amber" },
      { title: "Origem crítica", value: analysis.bySource[0]?.source || "-", detail: "Canal com maior volume no filtro" }
    ]
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] grid place-items-center px-6">
        <div className="crm-panel px-5 py-4 flex items-center gap-3 motion-safe:animate-scale-in">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgb(var(--crm-accent-rgb)_/_0.85)] border-t-transparent" />
          <div className="text-sm font-semibold text-[var(--crm-muted)]">Carregando relatórios...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[50vh] grid place-items-center px-6">
        <div className="crm-panel p-8 text-center max-w-xl motion-safe:animate-fade-up">
          <h3 className="text-xl font-bold text-[var(--crm-ink)]">Não foi possível carregar os dados</h3>
          <p className="mt-2 text-[var(--crm-muted)]">{error}</p>
          <button onClick={loadReports} className="crm-btn crm-btn-primary mt-5">
            <RefreshCcw className="w-4 h-4" />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Relatórios de Gestão"
        subtitle="Análises executivas, operacionais e comerciais com filtros cruzados"
        icon={BarChart3}
        gradient="indigo"
        breadcrumbs={["Gestão", "Relatórios"]}
        actions={[
          { label: "Atualizar", onClick: loadReports, icon: RefreshCcw, variant: "secondary" },
          { label: "Exportar CSV", onClick: exportReport, icon: Download, variant: "primary" }
        ]}
      />

      <GradientCard gradient="gray" className="p-5 md:p-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1.9fr] gap-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="h-10 w-10 rounded-2xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-accent-rgb)_/_0.12)] flex items-center justify-center">
                <SlidersHorizontal className="w-5 h-5 text-[rgb(var(--crm-accent-rgb))]" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-[var(--crm-ink)]">Central de relatórios</h3>
                <p className="text-sm text-[var(--crm-muted)]">Escolha a leitura e aplique filtros em toda a tela.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2">
              {REPORT_TYPES.map((report) => {
                const Icon = report.icon;
                const active = filters.reportType === report.id;
                return (
                  <button
                    key={report.id}
                    onClick={() => { setFilter("reportType", report.id); setActiveReport(report.id); }}
                    className={[
                      "text-left rounded-2xl border p-3 transition-all",
                      active
                        ? "border-[rgb(var(--crm-accent-rgb)_/_0.55)] bg-[rgb(var(--crm-accent-rgb)_/_0.14)]"
                        : "border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.54)] hover:bg-[rgb(var(--crm-accent-rgb)_/_0.08)]"
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2 text-sm font-bold text-[var(--crm-ink)]">
                      <Icon className="w-4 h-4" />
                      {report.label}
                    </div>
                    <p className="mt-1 text-xs text-[var(--crm-muted)]">{report.description}</p>
                  </button>
                );
              })}
            </div>
            <button
              onClick={executeReport}
              className="crm-btn crm-btn-primary w-full mt-3"
            >
              <BarChart3 className="w-4 h-4" />
              Executar Relatório
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 content-start">
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase text-[var(--crm-muted)]">Período</span>
              <select value={filters.period} onChange={(e) => setFilter("period", e.target.value)} className="crm-input w-full">
                {PERIODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase text-[var(--crm-muted)]">Tipo</span>
              <select value={filters.clientType} onChange={(e) => setFilter("clientType", e.target.value)} className="crm-input w-full">
                <option value="all">Todos</option>
                <option value="B2B">B2B</option>
                <option value="B2G">B2G</option>
                <option value="B2C">B2C</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase text-[var(--crm-muted)]">Etapa/Fase</span>
              <select value={filters.stage} onChange={(e) => setFilter("stage", e.target.value)} className="crm-input w-full">
                <option value="all">Todas</option>
                <optgroup label="Comercial">
                  {STAGE_ORDER.map((stage) => <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>)}
                </optgroup>
                <optgroup label="Projetos">
                  {PROJECT_PHASE_ORDER.map((phase) => <option key={phase} value={phase}>{PROJECT_PHASE_LABELS[phase]}</option>)}
                </optgroup>
                <optgroup label="Kickoff">
                  {KICKOFF_PHASE_ORDER.map((phase) => <option key={phase} value={phase}>{KICKOFF_PHASE_LABELS[phase]}</option>)}
                </optgroup>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase text-[var(--crm-muted)]">Responsável</span>
              <select value={filters.ownerId} onChange={(e) => setFilter("ownerId", e.target.value)} className="crm-input w-full">
                <option value="all">Todos</option>
                {optionSets.owners.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase text-[var(--crm-muted)]">Origem</span>
              <select value={filters.source} onChange={(e) => setFilter("source", e.target.value)} className="crm-input w-full">
                <option value="all">Todas</option>
                {optionSets.sources.map((source) => <option key={source} value={source}>{source}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase text-[var(--crm-muted)]">Status</span>
              <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className="crm-input w-full">
                <option value="all">Todos</option>
                {optionSets.statuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase text-[var(--crm-muted)]">Valor mínimo</span>
              <input value={filters.minValue} onChange={(e) => setFilter("minValue", e.target.value)} type="number" min="0" className="crm-input w-full" placeholder="R$" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase text-[var(--crm-muted)]">Busca</span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--crm-muted)]" />
                <input value={filters.search} onChange={(e) => setFilter("search", e.target.value)} className="crm-input w-full pl-10" placeholder="Cliente, projeto..." />
              </div>
            </label>
          </div>
        </div>
      </GradientCard>

      {activeReport === "executive" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <AnimatedStats title="Pipeline Aberto" value={formatCurrency(analysis.kpis.pipelineValue)} subtitle={`${analysis.kpis.openCount} oportunidades abertas`} icon={Briefcase} color="blue" />
            <AnimatedStats title="Forecast Ponderado" value={formatCurrency(analysis.kpis.weightedPipeline)} subtitle="Valor x probabilidade" icon={Target} color="purple" />
            <AnimatedStats title="Receita Ganha" value={formatCurrency(analysis.kpis.wonValue)} subtitle={`${analysis.kpis.wonCount} negócios fechados`} icon={TrendingUp} color="green" />
            <AnimatedStats title="Conversão" value={formatPercent(analysis.kpis.conversionRate)} subtitle={`${analysis.kpis.wonCount} ganhos / ${analysis.kpis.lostCount} perdas`} icon={CheckCircle2} color="orange" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <AnimatedStats title="Ticket Médio" value={formatCurrency(analysis.kpis.avgTicket)} subtitle="Base em ganhos" icon={PieChart} color="green" />
            <AnimatedStats title="Clientes Filtrados" value={analysis.kpis.companiesCount} subtitle="Base de empresas" icon={Building2} color="blue" />
            <AnimatedStats title="Atividades Atrasadas" value={analysis.kpis.overdueActivitiesCount} subtitle={`${analysis.kpis.activitiesCount} atividades no filtro`} icon={Activity} color="red" />
            <AnimatedStats title="Contratos a Vencer" value={analysis.kpis.expiringContractsCount} subtitle={`${formatCurrency(analysis.kpis.contractValue)} ativos`} icon={CalendarDays} color="yellow" />
          </div>
        </>
      )}

      <GradientCard gradient="indigo" className="p-5 md:p-6">
        <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,0.95fr)_minmax(640px,1.35fr)] gap-5 2xl:items-center">
          <div className="min-w-0">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[rgb(var(--crm-accent-rgb)_/_0.35)] bg-[rgb(var(--crm-accent-rgb)_/_0.12)] px-3 py-1 text-xs font-bold uppercase text-[rgb(var(--crm-accent-rgb))]">
              <selectedReport.icon className="w-3.5 h-3.5" />
              <span className="truncate">Relatório {selectedReport.label}</span>
            </div>
            <h3 className="mt-3 text-xl md:text-2xl font-black text-[var(--crm-ink)] leading-tight">{selectedReport.description}</h3>
            <p className="mt-2 text-sm text-[var(--crm-muted)]">
              Os indicadores abaixo mudam conforme o tipo selecionado e usam os filtros aplicados no painel.
            </p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3 min-w-0">
            {(reportHighlights[filters.reportType] || reportHighlights.executive).map((item) => (
              <Insight key={item.title} {...item} />
            ))}
          </div>
        </div>
      </GradientCard>

      {["executive", "pipeline"].includes(activeReport) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <GradientCard gradient="blue" className="p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-[var(--crm-ink)]">Receita e Pipeline</h3>
                <p className="text-sm text-[var(--crm-muted)]">Evolução por mês no período filtrado.</p>
              </div>
              <TrendingUp className="w-6 h-6 text-sky-300" />
            </div>
            <div className="h-80">
              <Line data={revenueData} options={chartOptions} />
            </div>
          </GradientCard>

          <GradientCard gradient="purple" className="p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-[var(--crm-ink)]">Funil por Etapa</h3>
                <p className="text-sm text-[var(--crm-muted)]">Valor consolidado por status comercial.</p>
              </div>
              <Layers3 className="w-6 h-6 text-indigo-300" />
            </div>
            <div className="h-80">
              <Bar data={stageData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { display: false } } }} />
            </div>
          </GradientCard>
        </div>
      )}

      {activeReport === "executive" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <GradientCard gradient="green" className="p-6">
            <div className="mb-5">
              <h3 className="text-xl font-bold text-[var(--crm-ink)]">Origem dos Leads</h3>
              <p className="text-sm text-[var(--crm-muted)]">Canais com maior volume.</p>
            </div>
            <div className="h-72">
              <Doughnut data={sourceData} options={{ ...chartOptions, scales: undefined }} />
            </div>
          </GradientCard>

          <GradientCard gradient="red" className="p-6">
            <div className="mb-5">
              <h3 className="text-xl font-bold text-[var(--crm-ink)]">Motivos de Perda</h3>
              <p className="text-sm text-[var(--crm-muted)]">Causas mais recorrentes.</p>
            </div>
            <div className="h-72">
              <Bar data={lossData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { display: false } } }} />
            </div>
          </GradientCard>

          <GradientCard gradient="orange" className="p-6">
            <div className="mb-5">
              <h3 className="text-xl font-bold text-[var(--crm-ink)]">Insights de Gestão</h3>
              <p className="text-sm text-[var(--crm-muted)]">Pontos de atenção automáticos.</p>
            </div>
            <div className="space-y-3">
              <Insight title="Forecast" value={formatCurrency(analysis.kpis.weightedPipeline)} detail="Projeção baseada na probabilidade de fechamento." />
              <Insight title="Risco operacional" value={`${analysis.kpis.overdueActivitiesCount} atrasos`} detail="Atividades vencidas em aberto exigem acompanhamento." tone={analysis.kpis.overdueActivitiesCount > 0 ? "red" : "green"} />
              <Insight title="Renovações" value={`${analysis.kpis.expiringContractsCount} contratos`} detail="Contratos ativos com vencimento nos próximos 90 dias." tone={analysis.kpis.expiringContractsCount > 0 ? "amber" : "green"} />
              <Insight title="Perdas no período" value={formatCurrency(analysis.kpis.lostValue)} detail="Valor total perdido dentro dos filtros atuais." tone={analysis.kpis.lostValue > 0 ? "red" : "green"} />
            </div>
          </GradientCard>
        </div>
      )}

      {activeReport === "projects" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <AnimatedStats title="Projetos Ativos" value={analysis.kpis.activeProjectsCount} subtitle={`${analysis.kpis.projectsCount} projetos no filtro`} icon={FolderKanban} color="blue" />
            <AnimatedStats title="Orçamento Total" value={formatCurrency(analysis.kpis.projectBudget)} subtitle="Budget consolidado" icon={Briefcase} color="orange" />
            <AnimatedStats title="Saúde Média" value={formatPercent(analysis.kpis.avgProjectHealth)} subtitle="Health score dos projetos" icon={Gauge} color="green" />
            <AnimatedStats title="Atrasados" value={analysis.kpis.delayedProjectsCount} subtitle="Fim previsto vencido" icon={CalendarDays} color="red" />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <GradientCard gradient="blue" className="p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-[var(--crm-ink)]">Projetos ao Longo do Tempo</h3>
                  <p className="text-sm text-[var(--crm-muted)]">Andamento e conclusões por mês.</p>
                </div>
                <TrendingUp className="w-6 h-6 text-sky-300" />
              </div>
              <div className="h-80">
                <Line data={projectTimelineData} options={chartOptions} />
              </div>
            </GradientCard>

            <GradientCard gradient="orange" className="p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-[var(--crm-ink)]">Projetos por Fase</h3>
                  <p className="text-sm text-[var(--crm-muted)]">Distribuição entre setup, kickoff, execução e encerramento.</p>
                </div>
                <Layers3 className="w-6 h-6 text-orange-300" />
              </div>
              <div className="h-80">
                <Bar data={projectPhaseData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { display: false } } }} />
              </div>
            </GradientCard>
          </div>
          <GradientCard gradient="green" className="p-6">
            <h3 className="text-xl font-bold text-[var(--crm-ink)] mb-1">Status dos Projetos</h3>
            <p className="text-sm text-[var(--crm-muted)] mb-5">Leitura rápida da carteira operacional.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
              {analysis.byProjectStatus.map((item) => (
                <Insight key={item.status} title={item.label} value={item.count} detail="projetos" tone={item.status === "CONCLUIDO" ? "green" : item.status === "PAUSADO" ? "amber" : item.status === "CANCELADO" ? "red" : "slate"} />
              ))}
              {analysis.byProjectStatus.length === 0 && <p className="text-sm text-[var(--crm-muted)]">Nenhum projeto encontrado para os filtros atuais.</p>}
            </div>
          </GradientCard>
        </>
      )}

      {activeReport === "kickoff" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <AnimatedStats title="Reuniões de Kickoff" value={analysis.kpis.kickoffCount} subtitle="Internas, externas e comerciais" icon={Rocket} color="orange" />
            <AnimatedStats title="Realizadas" value={analysis.kpis.completedKickoffCount} subtitle={formatPercent(analysis.kpis.kickoffCompletionRate)} icon={CheckCircle2} color="green" />
            <AnimatedStats title="Agendadas" value={analysis.kpis.scheduledKickoffCount} subtitle={`${analysis.kpis.overdueKickoffCount} vencidas`} icon={CalendarDays} color="blue" />
            <AnimatedStats title="Ações" value={analysis.kpis.kickoffActionItems} subtitle="Itens gerados nas atas" icon={Activity} color="purple" />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <GradientCard gradient="orange" className="p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-[var(--crm-ink)]">Kickoffs ao Longo do Tempo</h3>
                  <p className="text-sm text-[var(--crm-muted)]">Agenda e realização por mês.</p>
                </div>
                <TrendingUp className="w-6 h-6 text-orange-300" />
              </div>
              <div className="h-80">
                <Line data={kickoffTimelineData} options={chartOptions} />
              </div>
            </GradientCard>

            <GradientCard gradient="green" className="p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-[var(--crm-ink)]">Kickoff por Fase</h3>
                  <p className="text-sm text-[var(--crm-muted)]">Interno, externo e etapas comerciais conectadas.</p>
                </div>
                <Rocket className="w-6 h-6 text-emerald-300" />
              </div>
              <div className="h-80">
                <Bar data={kickoffPhaseData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { display: false } } }} />
              </div>
            </GradientCard>
          </div>
          <GradientCard gradient="gray" className="p-6">
            <h3 className="text-xl font-bold text-[var(--crm-ink)] mb-1">Status dos Kickoffs</h3>
            <p className="text-sm text-[var(--crm-muted)] mb-5">Controle executivo de agendas, remarcações e reuniões realizadas.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {analysis.byKickoffStatus.map((item) => (
                <Insight key={item.status} title={item.label} value={item.count} detail="reuniões" tone={item.status === "REALIZADA" ? "green" : item.status === "CANCELADA" ? "red" : item.status === "REAGENDADA" ? "amber" : "slate"} />
              ))}
              {analysis.byKickoffStatus.length === 0 && <p className="text-sm text-[var(--crm-muted)]">Nenhuma reunião encontrada para os filtros atuais.</p>}
            </div>
          </GradientCard>
        </>
      )}

      {activeReport === "losses" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <GradientCard gradient="red" className="p-6">
            <div className="mb-5">
              <h3 className="text-xl font-bold text-[var(--crm-ink)]">Motivos de Perda</h3>
              <p className="text-sm text-[var(--crm-muted)]">Causas mais recorrentes.</p>
            </div>
            <div className="h-72">
              <Bar data={lossData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, legend: { display: false } } }} />
            </div>
          </GradientCard>

          <GradientCard gradient="orange" className="p-6">
            <div className="mb-5">
              <h3 className="text-xl font-bold text-[var(--crm-ink)]">Insights de Perdas</h3>
              <p className="text-sm text-[var(--crm-muted)]">Análise automática de perdas.</p>
            </div>
            <div className="space-y-3">
              <Insight title="Valor perdido" value={formatCurrency(analysis.kpis.lostValue)} detail={`${analysis.kpis.lostCount} oportunidades perdidas no filtro.`} tone="red" />
              <Insight title="Principal motivo" value={analysis.byLoss[0]?.reason || "-"} detail={analysis.byLoss[0] ? `${analysis.byLoss[0].count} ocorrências` : "Nenhum motivo registrado."} tone="amber" />
              <Insight title="Impacto no pipeline" value={formatPercent(analysis.kpis.conversionRate)} detail="Taxa de conversão geral do período." />
              <Insight title="Oportunidades perdidas" value={analysis.kpis.lostCount} detail="Total de perdas no filtro aplicado." />
            </div>
          </GradientCard>
        </div>
      )}

      {["pipeline", "clients", "activities", "contracts"].includes(activeReport) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <GradientCard gradient="orange" className="p-6">
            <div className="mb-5">
              <h3 className="text-xl font-bold text-[var(--crm-ink)]">Insights de {selectedReport.label}</h3>
              <p className="text-sm text-[var(--crm-muted)]">Pontos de atenção automáticos.</p>
            </div>
            <div className="space-y-3">
              <Insight title="Forecast" value={formatCurrency(analysis.kpis.weightedPipeline)} detail="Projeção baseada na probabilidade de fechamento." />
              <Insight title="Risco operacional" value={`${analysis.kpis.overdueActivitiesCount} atrasos`} detail="Atividades vencidas em aberto exigem acompanhamento." tone={analysis.kpis.overdueActivitiesCount > 0 ? "red" : "green"} />
              <Insight title="Renovações" value={`${analysis.kpis.expiringContractsCount} contratos`} detail="Contratos ativos com vencimento nos próximos 90 dias." tone={analysis.kpis.expiringContractsCount > 0 ? "amber" : "green"} />
              <Insight title="Perdas no período" value={formatCurrency(analysis.kpis.lostValue)} detail="Valor total perdido dentro dos filtros atuais." tone={analysis.kpis.lostValue > 0 ? "red" : "green"} />
            </div>
          </GradientCard>
          {activeReport === "clients" && (
            <GradientCard gradient="gray" className="p-6">
              <h3 className="text-xl font-bold text-[var(--crm-ink)] mb-1">Clientes e Qualidade da Base</h3>
              <p className="text-sm text-[var(--crm-muted)] mb-5">Distribuição por tipo e temperatura do lead score.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {analysis.byClientType.map((item) => (
                  <Insight key={item.clientType} title={item.clientType} value={item.count} detail="empresas no filtro" />
                ))}
                {analysis.leadScoreBands.map((item) => (
                  <Insight key={item.label} title={item.label} value={item.count} detail={`Lead score ${item.min}-${item.max}`} tone={item.min >= 80 ? "green" : item.min >= 60 ? "amber" : "slate"} />
                ))}
              </div>
            </GradientCard>
          )}
        </div>
      )}

      {["executive", "sellers"].includes(activeReport) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <GradientCard gradient="gray" className="p-6">
            <h3 className="text-xl font-bold text-[var(--crm-ink)] mb-1">Ranking de Vendedores</h3>
            <p className="text-sm text-[var(--crm-muted)] mb-5">Receita, forecast e conversão por responsável.</p>
            <div className="space-y-3">
              {analysis.bySeller.slice(0, 6).map((seller, index) => (
                <div key={seller.id} className="rounded-2xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.62)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="h-9 w-9 rounded-2xl bg-[rgb(var(--crm-accent-rgb)_/_0.14)] text-[rgb(var(--crm-accent-rgb))] flex items-center justify-center font-bold">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="font-bold text-[var(--crm-ink)] truncate">{seller.name}</p>
                        <p className="text-xs text-[var(--crm-muted)]">{seller.won} ganhos · {seller.open} abertos · {formatPercent(seller.conversion)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-300">{formatCurrency(seller.revenue)}</p>
                      <p className="text-xs text-[var(--crm-muted)]">{formatCurrency(seller.weighted)} forecast</p>
                    </div>
                  </div>
                </div>
              ))}
              {analysis.bySeller.length === 0 && <p className="text-sm text-[var(--crm-muted)]">Nenhum vendedor encontrado para os filtros atuais.</p>}
            </div>
          </GradientCard>

          <GradientCard gradient="gray" className="p-6">
            <h3 className="text-xl font-bold text-[var(--crm-ink)] mb-1">Clientes e Qualidade da Base</h3>
            <p className="text-sm text-[var(--crm-muted)] mb-5">Distribuição por tipo e temperatura do lead score.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {analysis.byClientType.map((item) => (
                <Insight key={item.clientType} title={item.clientType} value={item.count} detail="empresas no filtro" />
              ))}
              {analysis.leadScoreBands.map((item) => (
                <Insight key={item.label} title={item.label} value={item.count} detail={`Lead score ${item.min}-${item.max}`} tone={item.min >= 80 ? "green" : item.min >= 60 ? "amber" : "slate"} />
              ))}
            </div>
          </GradientCard>
        </div>
      )}

      {["executive", "pipeline", "sellers"].includes(activeReport) && (
        <ModernTable
          title="Oportunidades do Relatório"
          data={analysis.opportunities.slice(0, 200)}
          columns={[
            {
              key: "opportunity",
              label: "Oportunidade",
              render: (item) => (
                <div>
                  <div className="font-bold text-[var(--crm-ink)]">{item.title || item.projectName || "Sem título"}</div>
                  <div className="text-xs text-[var(--crm-muted)]">{item.number || "-"} · {item.company?.name || "Sem cliente"}</div>
                </div>
              )
            },
            {
              key: "stage",
              label: "Etapa",
              render: (item) => <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-200">{STAGE_LABELS[item.stage] || item.stage}</span>
            },
            {
              key: "owner",
              label: "Responsável",
              render: (item) => <span className="text-sm text-[var(--crm-ink)]">{item.owner?.name || "Não atribuído"}</span>
            },
            {
              key: "value",
              label: "Valor",
              render: (item) => <span className="font-bold text-[var(--crm-ink)]">{formatCurrency(item.value)}</span>
            },
            {
              key: "probability",
              label: "Prob.",
              render: (item) => <span className="text-sm text-[var(--crm-muted)]">{numberValue(item.probability)}%</span>
            },
            {
              key: "expectedCloseDate",
              label: "Previsão",
              render: (item) => <span className="text-sm text-[var(--crm-muted)]">{formatDate(item.expectedCloseDate)}</span>
            }
          ]}
          searchTerm={filters.search}
          onSearchChange={(value) => setFilter("search", value)}
          emptyState={
            <div>
              <Filter className="w-14 h-14 mx-auto mb-3 text-[var(--crm-muted)] opacity-50" />
              <h3 className="text-lg font-bold text-[var(--crm-ink)]">Nenhuma oportunidade encontrada</h3>
              <p className="text-[var(--crm-muted)]">Ajuste os filtros para ampliar a análise.</p>
            </div>
          }
        />
      )}

      {activeReport === "projects" && (
        <ModernTable
          title="Projetos do Relatório"
          data={analysis.projects.slice(0, 200)}
          columns={[
            {
              key: "project",
              label: "Projeto",
              render: (item) => (
                <div>
                  <div className="font-bold text-[var(--crm-ink)]">{item.name || "Sem nome"}</div>
                  <div className="text-xs text-[var(--crm-muted)]">{item.number || "-"} · {item.company?.name || "Sem cliente"}</div>
                </div>
              )
            },
            {
              key: "phase",
              label: "Fase",
              render: (item) => <span className="rounded-full bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-200">{PROJECT_PHASE_LABELS[item.phase] || item.phase}</span>
            },
            {
              key: "status",
              label: "Status",
              render: (item) => <span className="text-sm font-bold text-[var(--crm-ink)]">{PROJECT_STATUS_LABELS[item.status] || item.status}</span>
            },
            {
              key: "manager",
              label: "Gestor",
              render: (item) => <span className="text-sm text-[var(--crm-ink)]">{item.projectManager?.name || "Não atribuído"}</span>
            },
            {
              key: "progress",
              label: "Progresso",
              render: (item) => <span className="text-sm text-[var(--crm-muted)]">{numberValue(item.progressPercent)}%</span>
            },
            {
              key: "health",
              label: "Saúde",
              render: (item) => <span className="font-bold text-emerald-300">{numberValue(item.healthScore)}%</span>
            },
            {
              key: "plannedEndDate",
              label: "Fim previsto",
              render: (item) => <span className="text-sm text-[var(--crm-muted)]">{formatDate(item.plannedEndDate)}</span>
            }
          ]}
          searchTerm={filters.search}
          onSearchChange={(value) => setFilter("search", value)}
          emptyState={
            <div>
              <Filter className="w-14 h-14 mx-auto mb-3 text-[var(--crm-muted)] opacity-50" />
              <h3 className="text-lg font-bold text-[var(--crm-ink)]">Nenhum projeto encontrado</h3>
              <p className="text-[var(--crm-muted)]">Ajuste período, fase, status ou responsável.</p>
            </div>
          }
        />
      )}

      {activeReport === "kickoff" && (
        <ModernTable
          title="Reuniões de Kickoff"
          data={analysis.kickoffMeetings.slice(0, 200)}
          columns={[
            {
              key: "meeting",
              label: "Reunião",
              render: (item) => (
                <div>
                  <div className="font-bold text-[var(--crm-ink)]">{item.title || "Sem título"}</div>
                  <div className="text-xs text-[var(--crm-muted)]">{item.number || "-"} · {item.company?.name || "Sem cliente"}</div>
                </div>
              )
            },
            {
              key: "phase",
              label: "Fase",
              render: (item) => <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-200">{KICKOFF_PHASE_LABELS[item.phase] || item.phase}</span>
            },
            {
              key: "status",
              label: "Status",
              render: (item) => <span className="text-sm font-bold text-[var(--crm-ink)]">{KICKOFF_STATUS_LABELS[item.status] || item.status}</span>
            },
            {
              key: "owner",
              label: "Responsável",
              render: (item) => <span className="text-sm text-[var(--crm-ink)]">{item.owner?.name || "Não atribuído"}</span>
            },
            {
              key: "scheduledDate",
              label: "Data",
              render: (item) => <span className="text-sm text-[var(--crm-muted)]">{formatDate(item.scheduledDate)}</span>
            },
            {
              key: "participants",
              label: "Participantes",
              render: (item) => <span className="text-sm text-[var(--crm-muted)]">{numberValue(item._count?.participants)}</span>
            },
            {
              key: "actions",
              label: "Ações",
              render: (item) => <span className="font-bold text-orange-200">{numberValue(item._count?.actionItems)}</span>
            }
          ]}
          searchTerm={filters.search}
          onSearchChange={(value) => setFilter("search", value)}
          emptyState={
            <div>
              <Filter className="w-14 h-14 mx-auto mb-3 text-[var(--crm-muted)] opacity-50" />
              <h3 className="text-lg font-bold text-[var(--crm-ink)]">Nenhuma reunião de kickoff encontrada</h3>
              <p className="text-[var(--crm-muted)]">Ajuste fase, status, período ou busca.</p>
            </div>
          }
        />
      )}
    </div>
  );
}

const Insight = ({ title, value, detail, tone = "slate" }) => {
  const toneClass = {
    green: "text-emerald-300 bg-emerald-500/10 border-emerald-400/20",
    red: "text-red-300 bg-red-500/10 border-red-400/20",
    amber: "text-amber-200 bg-amber-500/10 border-amber-400/20",
    slate: "text-[var(--crm-ink)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.62)] border-[color:var(--crm-border)]"
  }[tone] || "text-[var(--crm-ink)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.62)] border-[color:var(--crm-border)]";

  return (
    <div className={`min-w-0 rounded-2xl border p-4 ${toneClass}`}>
      <div className="text-xs font-bold uppercase tracking-wide opacity-80 break-words">{title}</div>
      <div className="mt-2 min-w-0 text-[clamp(1.25rem,1.55vw,1.85rem)] font-black leading-tight break-words tabular-nums">
        {value}
      </div>
      <div className="mt-2 text-xs leading-snug opacity-80 break-words">{detail}</div>
    </div>
  );
};
