import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { buildApiUrl, API_BASE_URL, API_ENDPOINTS } from '../config/api';
import { 
  Plus, 
  Target, 
  DollarSign, 
  TrendingUp, 
  Calendar,
  Building,
  User,
  Percent,
  ArrowRight,
  Check,
  X,
  Edit,
  Search,
  BarChart3,
  Filter,
  Trash2,
  MessageSquare,
  Send,
  Phone,
  Mail,
  Users,
  MessageCircle,
  StickyNote,
  FolderKanban,
  Rocket,
  List,
  LayoutGrid,
  ImagePlus,
  Paperclip
} from 'lucide-react';

import PageHeader from '../components/PageHeader';
import AnimatedStats from '../components/AnimatedStats';
import GradientCard from '../components/GradientCard';
import Modal from '../components/Modal';
import OpportunityForm from '../components/OpportunityForm';
import CloseOpportunityModal from '../components/CloseOpportunityModal';
import OpportunityAttentionPoints from '../components/OpportunityAttentionPoints';
import OpportunityLearnings from '../components/OpportunityLearnings';
import B2BTestFlowModal from '../components/B2BTestFlowModal';
import KickoffSection from '../components/KickoffSection';
import {
  isCompanyInClientType,
  isOpportunityInClientType,
  normalizeClientType
} from '../utils/businessModel';
import { createOrUpdateCommercialProposalFromOpportunity } from '../lib/commercial-proposal-drafts';

const stages = ["LEAD", "QUALIFICATION", "DIAGNOSIS", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];
const MAX_FOLLOW_UP_PRINTS = 5;

const stageLabels = {
  LEAD: "Lead",
  QUALIFICATION: "Qualificação",
  DIAGNOSIS: "Diagnóstico",
  PROPOSAL: "Proposta",
  NEGOTIATION: "Negociação",
  WON: "Ganhou",
  LOST: "Perdeu"
};

const stageColors = {
  LEAD: "#94a3b8",
  QUALIFICATION: "#60a5fa",
  DIAGNOSIS: "#34d399",
  PROPOSAL: "#fbbf24",
  NEGOTIATION: "#f87171",
  WON: "#10b981",
  LOST: "#6b7280"
};

const projectClientTypeLabels = {
  NEW_CLIENT: "Cliente Novo",
  BASE_CLIENT: "Cliente da Base",
  RENEWAL: "Renovações"
};

const projectTypeLabels = {
  SINGLE: "Projeto pontual",
  MONTHLY: "Projeto mensal"
};

const parseFollowUpAttachments = (attachments) => {
  if (!attachments) return [];
  if (Array.isArray(attachments)) return attachments;
  try {
    const parsed = JSON.parse(attachments);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const resolveUploadUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const cleanPath = String(url).startsWith('/') ? String(url) : `/${String(url)}`;

  if (/^https?:\/\//i.test(API_BASE_URL)) {
    return `${API_BASE_URL.replace(/\/api\/?$/i, '')}${cleanPath}`;
  }

  return cleanPath;
};

const toDateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const formatDateBR = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR');
};

const normalizeSearchText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const parseStageDecisionDetails = (details) => {
  if (!details) return null;
  if (typeof details === 'object') return details;
  try {
    const parsed = JSON.parse(details);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const normalizeRoleName = (value) => String(value || '').trim().toUpperCase();

const canOwnOpportunityForClientType = (user, clientType = 'B2B') => {
  if (!user?.id) return false;
  const role = normalizeRoleName(user.role);
  if (role === 'PRE_SALES') return false;
  if (clientType === 'B2G') return user.accessB2G !== false || role === 'USER_B2G';
  return user.accessB2B !== false || role === 'SELLER' || role === 'USER_B2B';
};

const normalizeNegotiationType = (value) => {
  const text = String(value || '').trim();
  const normalized = normalizeSearchText(text);

  if (!normalized) return '';
  if (normalized === 'new_client' || normalized.includes('cliente novo') || normalized.includes('nova venda')) return 'Cliente Novo';
  if (normalized === 'base_client' || normalized.includes('cliente da base')) return 'Cliente da Base';
  if (normalized === 'renewal' || normalized.includes('renov')) return 'Renovações';
  if (normalized.includes('up selling') || normalized.includes('upselling') || normalized.includes('up-sell')) return 'Up Selling';
  return text;
};

const projectClientTypeFromNegotiation = (value) => {
  const normalized = normalizeNegotiationType(value);
  if (normalized === 'Cliente Novo') return 'NEW_CLIENT';
  if (normalized === 'Renovações') return 'RENEWAL';
  if (normalized === 'Cliente da Base' || normalized === 'Up Selling') return 'BASE_CLIENT';
  return '';
};

export default function Oportunidades() {
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [sellerFilter, setSellerFilter] = useState('');
  const [viewMode, setViewMode] = useState('pipeline'); // 'pipeline' | 'historico'
  const [pipelineViewMode, setPipelineViewMode] = useState('kanban'); // 'kanban' | 'list'
  const [pendingCloseOpportunity, setPendingCloseOpportunity] = useState(null);
  const [followUpText, setFollowUpText] = useState('');
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);
  const [followUpError, setFollowUpError] = useState('');
  const [followUpType, setFollowUpType] = useState('NOTE'); // NOTE, CALL, EMAIL, MEETING, WHATSAPP
  const [followUps, setFollowUps] = useState([]);
  const [followUpPrints, setFollowUpPrints] = useState([]);
  const [followUpPrintPreviews, setFollowUpPrintPreviews] = useState([]);
  const followUpPrintPreviewRef = useRef([]);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);
  const [lossReasonDraft, setLossReasonDraft] = useState('');
  const [lossReasonSaving, setLossReasonSaving] = useState(false);
  const [lossReasonError, setLossReasonError] = useState('');
  const [searchParams] = useSearchParams();

  const requestedClientType = normalizeClientType(searchParams.get('clientType'));
  const pipelineClientType = requestedClientType || 'B2B';
  const pipelineLabel = pipelineClientType === 'B2G' ? 'B2G Governo' : 'B2B Privado';
  const pipelineTitle = pipelineClientType === 'B2G' ? 'Oportunidades B2G' : 'Oportunidades';
  const pipelineSubtitle = pipelineClientType === 'B2G'
    ? 'Edição de oportunidades do funil público sem mistura com o pipeline B2B.'
    : 'Gerencie oportunidades e acompanhe o funil de vendas em tempo real';
  const lastOpenedOpportunityId = useRef(null);
  const lastCompanyReturnKey = useRef(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Verificar se usuário é admin/master e extrair userId
  const { currentUserRole, userId } = (() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      return {
        currentUserRole: String(u?.role || '').toUpperCase(),
        userId: u?.id || ''
      };
    } catch { return { currentUserRole: '', userId: '' }; }
  })();
  const isAdmin = currentUserRole === 'ADMIN' || currentUserRole === 'MASTER';
  const scopedClientTypeQuery = `clientType=${encodeURIComponent(pipelineClientType)}`;
  const scopedOpportunitiesUrl = buildApiUrl(`/opportunities?${scopedClientTypeQuery}`);
  const buildScopedOpportunityByIdUrl = (id) =>
    buildApiUrl(`/opportunities/${encodeURIComponent(id)}?${scopedClientTypeQuery}`);
  const scopedCompaniesUrl = pipelineClientType === 'B2B'
    ? buildApiUrl('/companies')
    : buildApiUrl(`/companies?${scopedClientTypeQuery}`);

  const handleDragStart = (e, opportunity) => {
    setDraggedItem(opportunity);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.outerHTML);
    e.dataTransfer.setDragImage(e.target, 0, 0);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e, stage) => {
    e.preventDefault();
    if (draggedItem) {
      setDragOverColumn(stage);
    }
  };

  const handleDragLeave = (e) => {
    // Só remove o highlight se realmente saiu da coluna
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = async (e, targetStage) => {
    e.preventDefault();
    setDragOverColumn(null);
    
    if (draggedItem && draggedItem.stage !== targetStage) {
      if (targetStage === 'WON' || targetStage === 'LOST') {
        setPendingCloseOpportunity({ opportunity: draggedItem, stage: targetStage });
        setDraggedItem(null);
        return;
      }
      
      await moveOpportunity(draggedItem.id, targetStage);
    }
    
    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverColumn(null);
  };
  
  const [formData, setFormData] = useState({
    title: '',
    projectName: '',
    projectClientType: '',
    negotiationType: '',
    projectClassification: '',
    projectTower: '',
    projectDetail: '',
    manufacturer: '',
    licenseCount: '',
    contractMonths: '',
    monthlyValue: '',
    installationFee: '',
    leadSourceDetail: '',
    projectType: 'SINGLE',
    projectMonths: '12',
    description: '',
    value: '',
    probability: 50,
    stage: 'LEAD',
    source: 'MANUAL',
    leadEntryDate: toDateInputValue(new Date()),
    expectedCloseDate: '',
    customerTurnDate: '',
    exitDate: '',
    lossReason: '',
    companyId: '',
    ownerId: '',
    contactName: '',
    contactFullName: '',
    contactEmail: '',
    contactPhone: '',
    products: []
  });

  const [products, setProducts] = useState([]);

  const createEmptyFormData = (overrides = {}) => ({
    title: '',
    projectName: '',
    projectClientType: '',
    negotiationType: '',
    projectClassification: '',
    projectTower: '',
    projectDetail: '',
    manufacturer: '',
    licenseCount: '',
    contractMonths: '',
    monthlyValue: '',
    installationFee: '',
    leadSourceDetail: '',
    projectType: 'SINGLE',
    projectMonths: '12',
    description: '',
    value: '',
    probability: 50,
    stage: 'LEAD',
    source: 'MANUAL',
    leadEntryDate: toDateInputValue(new Date()),
    expectedCloseDate: '',
    customerTurnDate: '',
    exitDate: '',
    lossReason: '',
    companyId: '',
    ownerId: '',
    contactName: '',
    contactFullName: '',
    contactEmail: '',
    contactPhone: '',
    products: [],
    ...overrides
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const getUploadAuthHeaders = () => {
    const headers = getAuthHeaders();
    delete headers['Content-Type'];
    return headers;
  };

  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      const response = await fetch(scopedOpportunitiesUrl, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        const opportunitiesArray = Array.isArray(data) ? data : [];
        const normalized = opportunitiesArray.map((opp) => {
          if (!opp || typeof opp !== 'object') return opp;
          const rawComp = opp.company || opp.COMPANY || null;
          const rawOwner = opp.owner || opp.OWNER || null;
          return {
            ...opp,
            id: opp.id ?? opp.ID ?? '',
            title: opp.title ?? opp.TITLE ?? 'Oportunidade',
            projectName: opp.projectName ?? opp.PROJECTNAME ?? opp.title ?? opp.TITLE ?? '',
            stage: opp.stage ?? opp.STAGE ?? 'LEAD',
            value: Number(opp.value ?? opp.VALUE ?? 0),
            probability: Number(opp.probability ?? opp.PROBABILITY ?? 50),
            leadEntryDate: opp.leadEntryDate ?? opp.LEADENTRYDATE ?? opp.createdAt ?? opp.CREATEDAT ?? null,
            expectedCloseDate: opp.expectedCloseDate ?? opp.EXPECTEDCLOSEDATE ?? null,
            actualCloseDate: opp.actualCloseDate ?? opp.ACTUALCLOSEDATE ?? null,
            customerTurnDate: opp.customerTurnDate ?? opp.CUSTOMERTURNDATE ?? ((opp.stage ?? opp.STAGE) === 'WON' ? (opp.actualCloseDate ?? opp.ACTUALCLOSEDATE ?? null) : null),
            exitDate: opp.exitDate ?? opp.EXITDATE ?? ((opp.stage ?? opp.STAGE) === 'LOST' ? (opp.actualCloseDate ?? opp.ACTUALCLOSEDATE ?? null) : null),
            ownerId: opp.ownerId ?? opp.OWNERID ?? rawOwner?.id ?? rawOwner?.ID ?? '',
            companyId: opp.companyId ?? opp.COMPANYID ?? rawComp?.id ?? rawComp?.ID ?? '',
            number: opp.number ?? opp.NUMBER ?? '',
            company: rawComp ? {
              ...rawComp,
              id: rawComp.id ?? rawComp.ID ?? '',
              name: rawComp.name ?? rawComp.NAME ?? 'Empresa B2B',
              clientType: rawComp.clientType ?? rawComp.CLIENTTYPE ?? 'B2B'
            } : null,
            owner: rawOwner ? {
              ...rawOwner,
              id: rawOwner.id ?? rawOwner.ID ?? '',
              name: rawOwner.name ?? rawOwner.NAME ?? 'Responsável'
            } : null
          };
        });
        const filtered = normalized.filter((item) =>
          isOpportunityInClientType(item, pipelineClientType, item?.company || null)
        );
        setOpportunities(filtered);
      }
    } catch (error) {
      console.error('Erro ao carregar oportunidades:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [companiesRes, usersRes, productsRes] = await Promise.all([
        fetch(scopedCompaniesUrl, { headers: getAuthHeaders() }),
        fetch(API_ENDPOINTS.users, { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/products'), { headers: getAuthHeaders() })
      ]);
      
      if (companiesRes.ok) {
        const companiesData = await companiesRes.json();
        const companiesArray = Array.isArray(companiesData) ? companiesData : [];
        setCompanies(companiesArray.filter((item) => isCompanyInClientType(item, pipelineClientType)));
      }
      
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        const assignableUsers = Array.isArray(usersData)
          ? usersData.filter((user) => canOwnOpportunityForClientType(user, pipelineClientType))
          : [];
        setUsers(assignableUsers);
      }

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(Array.isArray(productsData) ? productsData : []);
      }
    } catch (error) {
      console.error('Erro ao carregar dependências:', error);
    }
  };

  const buildStats = (data) => {
    const opportunities = Array.isArray(data) ? data : [];
    const total = opportunities.length;
    const totalValue = opportunities.reduce((sum, opp) => sum + (opp.value || 0), 0);
    const won = opportunities.filter(opp => opp.stage === 'WON').length;
    const wonValue = opportunities.filter(opp => opp.stage === 'WON').reduce((sum, opp) => sum + (opp.value || 0), 0);
    const conversionRate = total > 0 ? (won / total) * 100 : 0;
    const avgValue = total > 0 ? totalValue / total : 0;

    return {
      total,
      totalValue,
      won,
      wonValue,
      conversionRate,
      avgValue
    };
  };

  useEffect(() => {
    fetchOpportunities();
    fetchDependencies();
  }, [pipelineClientType]);

  useEffect(() => {
    followUpPrintPreviewRef.current = followUpPrintPreviews;
  }, [followUpPrintPreviews]);

  useEffect(() => {
    return () => {
      followUpPrintPreviewRef.current.forEach((item) => {
        if (item?.url) URL.revokeObjectURL(item.url);
      });
    };
  }, []);

  useEffect(() => {
    const shouldOpen = searchParams.get('newOpportunity') === '1';
    if (!shouldOpen) return;
    const companyId = searchParams.get('companyId') || '';
    const key = `${companyId || 'none'}:${pipelineClientType}`;
    if (lastCompanyReturnKey.current === key) return;

    lastCompanyReturnKey.current = key;
    setSelectedOpportunity(null);
    setFormData(createEmptyFormData({
      projectClientType: companyId ? 'NEW_CLIENT' : '',
      negotiationType: companyId ? 'Cliente Novo' : '',
      companyId
    }));
    setShowDetailsModal(false);
    setShowModal(true);
    navigate('/oportunidades', { replace: true });
  }, [navigate, pipelineClientType, searchParams]);

  useEffect(() => {
    const opportunityId = searchParams.get('opportunityId');
    const mode = (searchParams.get('mode') || '').toLowerCase();
    if (!opportunityId) return;
    const requestKey = `${opportunityId}:${mode || 'view'}`;
    if (lastOpenedOpportunityId.current === requestKey) return;

    const openOpportunity = (opp) => {
      if (mode === 'edit') {
        setSelectedOpportunity(opp);
        setFormData({
          title: opp.title,
          projectName: opp.projectName || opp.title || '',
          projectClientType: projectClientTypeFromNegotiation(opp.negotiationType || opp.projectClientType) || opp.projectClientType || '',
          negotiationType: normalizeNegotiationType(opp.negotiationType || opp.projectClientType) || '',
          projectClassification: opp.projectClassification || '',
          projectTower: opp.projectTower || '',
          projectDetail: opp.projectDetail || '',
          manufacturer: opp.manufacturer || '',
          leadSourceDetail: opp.leadSourceDetail || '',
          projectType: opp.projectType || 'SINGLE',
          projectMonths: opp.projectMonths ? String(opp.projectMonths) : '12',
          description: opp.description || '',
          value: opp.value?.toString() || '',
          probability: opp.probability || 50,
          stage: opp.stage,
          source: opp.source || 'MANUAL',
          leadEntryDate: toDateInputValue(opp.leadEntryDate || opp.createdAt),
          expectedCloseDate: toDateInputValue(opp.expectedCloseDate),
          customerTurnDate: toDateInputValue(opp.customerTurnDate || (opp.stage === 'WON' ? opp.actualCloseDate : null)),
          exitDate: toDateInputValue(opp.exitDate || (opp.stage === 'LOST' ? opp.actualCloseDate : null)),
          lossReason: opp.lossReason || '',
          companyId: opp.companyId,
          ownerId: opp.ownerId
        });
        setShowDetailsModal(false);
        setShowModal(true);
      } else {
        setSelectedOpportunity(opp);
        setLossReasonDraft(opp.lossReason || '');
        setLossReasonError('');
        setShowDetailsModal(true);
      }
      lastOpenedOpportunityId.current = requestKey;
    };

    const found = Array.isArray(opportunities)
      ? opportunities.find((opp) => opp.id === opportunityId)
      : null;

    if (found) {
      openOpportunity(found);
      return;
    }

    // Race condition: oportunidade ainda não carregou na lista — busca direto pela API
    if (loading) return; // aguarda o fetch terminar, o useEffect vai re-rodar
    fetch(buildScopedOpportunityByIdUrl(opportunityId), {
      headers: getAuthHeaders()
    })
      .then(r => r.ok ? r.json() : null)
      .then(opp => {
        if (!opp?.id) return;
        setOpportunities(prev => {
          const exists = prev.some(o => o.id === opp.id);
          return exists ? prev : [opp, ...prev];
        });
        openOpportunity(opp);
      })
      .catch(() => {});
  }, [searchParams, opportunities, loading]);

  const moveOpportunity = async (id, stage, closePayload = null) => {
    try {
      const body = { id, stage };
      const isClosingStage = stage === 'WON' || stage === 'LOST';

      if (closePayload?.stageDecisionDetails !== undefined) {
        body.stageDecisionDetails = closePayload.stageDecisionDetails;
      }
      if (closePayload?.lossReason !== undefined) {
        body.lossReason = closePayload.lossReason;
      }
      if (!isClosingStage && closePayload === null) {
        body.stageDecisionDetails = null;
        body.lossReason = null;
      }

      const response = await fetch(buildScopedOpportunityByIdUrl(id), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(body)
      });
      
      if (response.ok) {
        const movedOpportunity = await response.json().catch(() => null);
        fetchOpportunities();
        if (stage === 'PROPOSAL') {
          const fallbackOpportunity = opportunities.find((opportunity) => opportunity.id === id) || { id };
          const proposalEntry = createOrUpdateCommercialProposalFromOpportunity(movedOpportunity || fallbackOpportunity, {
            clientType: pipelineClientType
          });
          const proposalQuery = proposalEntry?.id
            ? `proposalId=${encodeURIComponent(proposalEntry.id)}`
            : `newProposal=1&opportunityId=${encodeURIComponent(id)}`;
          navigate(`/propostas?${proposalQuery}&clientType=${encodeURIComponent(pipelineClientType)}`);
        }
      }
    } catch (error) {
      console.error('Erro ao mover oportunidade:', error);
    }
  };

  const requestMoveOpportunity = (opportunity, stage) => {
    if (!opportunity?.id) return;
    if (stage === 'WON' || stage === 'LOST') {
      setPendingCloseOpportunity({ opportunity, stage });
      return;
    }
    moveOpportunity(opportunity.id, stage);
  };

  const handleConfirmCloseOpportunity = async (payload) => {
    const request = pendingCloseOpportunity;
    setPendingCloseOpportunity(null);
    if (!request?.opportunity?.id || !request.stage) return;
    await moveOpportunity(request.opportunity.id, request.stage, payload);
  };

  const handleSubmit = async (e, overrideFormData = null) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const payloadFormData = overrideFormData || formData;
    console.log('[handleSubmit] chamado, payloadFormData keys:', Object.keys(payloadFormData));
    console.log('[handleSubmit] selectedOpportunity:', selectedOpportunity?.id);

    const selectedCompany = companies.find((item) => item.id === payloadFormData.companyId);
    const normalizedNegotiationType = normalizeNegotiationType(payloadFormData.negotiationType || payloadFormData.projectClientType);
    const normalizedProjectClientType = projectClientTypeFromNegotiation(normalizedNegotiationType) || payloadFormData.projectClientType || '';

    if (pipelineClientType === 'B2B' && normalizedProjectClientType === 'NEW_CLIENT' && !payloadFormData.companyId) {
      alert('Cadastre a empresa antes de criar uma oportunidade para cliente novo.');
      navigate('/empresas?openForm=1&returnTo=/oportunidades%3FnewOpportunity%3D1');
      return;
    }
    if (pipelineClientType === 'B2B' && ['BASE_CLIENT', 'RENEWAL'].includes(normalizedProjectClientType) && !payloadFormData.companyId) {
      alert('Selecione a empresa cadastrada para cliente da base ou renovação.');
      return;
    }
    if (selectedCompany && !isCompanyInClientType(selectedCompany, pipelineClientType)) {
      alert(`Selecione uma empresa ${pipelineClientType} para este pipeline.`);
      return;
    }
    
    try {
      const url = selectedOpportunity
        ? buildScopedOpportunityByIdUrl(selectedOpportunity.id)
        : scopedOpportunitiesUrl;
      
      const method = selectedOpportunity ? 'PUT' : 'POST';
      
      const parsedValue = parseFloat(payloadFormData.value);
      const parsedProbability = parseInt(payloadFormData.probability);
      const resolvedOwnerId = payloadFormData.ownerId || userId || '';

      if (!resolvedOwnerId) {
        alert('Selecione um responsável para criar a oportunidade.');
        return;
      }

      // Construir body explicitamente — nunca usar spread para evitar campos inválidos no Prisma
      const body = {
        id: selectedOpportunity?.id,
        clientType: pipelineClientType,
        title: payloadFormData.title || '',
        projectName: payloadFormData.projectName || payloadFormData.title || '',
        projectClientType: normalizedProjectClientType || null,
        negotiationType: normalizedNegotiationType || null,
        projectClassification: payloadFormData.projectClassification || null,
        projectTower: payloadFormData.projectTower || null,
        projectDetail: payloadFormData.projectDetail || null,
        manufacturer: payloadFormData.manufacturer || null,
        licenseCount: payloadFormData.licenseCount || null,
        contractMonths: payloadFormData.contractMonths || null,
        monthlyValue: payloadFormData.monthlyValue || null,
        installationFee: payloadFormData.installationFee || null,
        leadSourceDetail: payloadFormData.leadSourceDetail || null,
        projectType: payloadFormData.projectType || 'SINGLE',
        projectMonths: payloadFormData.projectType === 'MONTHLY' ? Number(payloadFormData.projectMonths || 12) : null,
        description: typeof payloadFormData.description === 'string'
          ? payloadFormData.description
          : (payloadFormData.description ? JSON.stringify(payloadFormData.description) : null),
        value: Number.isFinite(parsedValue) ? parsedValue : 0,
        probability: Number.isFinite(parsedProbability) ? Math.min(100, Math.max(0, parsedProbability)) : 50,
        stage: payloadFormData.stage || selectedOpportunity?.stage || 'LEAD',
        source: payloadFormData.source || null,
        leadEntryDate: payloadFormData.leadEntryDate || null,
        expectedCloseDate: (() => {
          const v = payloadFormData.expectedCloseDate || '';
          if (!v) return null;
          const d = new Date(v);
          return isNaN(d.getTime()) ? null : v;
        })(),
        customerTurnDate: payloadFormData.customerTurnDate || null,
        exitDate: payloadFormData.exitDate || null,
        companyId: payloadFormData.companyId || '',
        ownerId: resolvedOwnerId,
        b2gStage: selectedOpportunity ? (selectedOpportunity.b2gStage || payloadFormData.b2gStage || null) : (payloadFormData.b2gStage || null),
        lossReason: payloadFormData.lossReason || null,
        notes: payloadFormData.notes || null,
        // Campos de contato do cliente
        contactName: payloadFormData.contactName || null,
        contactFullName: payloadFormData.contactFullName || null,
        contactEmail: payloadFormData.contactEmail || null,
        contactPhone: payloadFormData.contactPhone || null,
        // Produtos (array limpo de _key antes de enviar)
        products: Array.isArray(payloadFormData.products)
          ? payloadFormData.products
              .filter(p => p.productId)
              .map(p => ({
                productId: p.productId,
                quantity: Number(p.quantity) || 1,
                unitPrice: Number(p.unitPrice) || 0,
                discount: Number(p.discount) || 0,
                notes: p.notes || null
              }))
          : []
      };

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(body)
      });

      if (response.ok) {
        fetchOpportunities();
        setShowModal(false);
        resetForm();
        alert(selectedOpportunity ? 'Oportunidade atualizada!' : 'Oportunidade criada!');
      } else {
        let errMsg = 'Erro ao salvar oportunidade';
        try {
          const errText = await response.text();
          if (errText) {
            try {
              const errData = JSON.parse(errText);
              errMsg = errData.mensagem || errData.error || errData.message || errText;
            } catch (_) {
              errMsg = errText;
            }
          }
        } catch (_) {}
        console.error('[handleSubmit] Erro HTTP', response.status, errMsg);
        alert(`Erro ${response.status}: ${errMsg}`);
      }
    } catch (error) {
      console.error('[handleSubmit] Erro de conexão:', error);
      alert('Erro de conexão: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData(createEmptyFormData());
    setSelectedOpportunity(null);
  };

  const openCreateOpportunity = () => {
    setSelectedOpportunity(null);
    setFormData(createEmptyFormData());
    setShowDetailsModal(false);
    setShowModal(true);
  };

  const openNewCompanyFromOpportunity = () => {
    setShowModal(false);
    navigate('/empresas?openForm=1&returnTo=/oportunidades%3FnewOpportunity%3D1');
  };

  const handleEdit = (opportunity, event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!opportunity) return;
    setShowDetailsModal(false);
    setSelectedOpportunity(opportunity);
    setFormData({
      title: opportunity.title,
      projectName: opportunity.projectName || opportunity.title || '',
      projectClientType: projectClientTypeFromNegotiation(opportunity.negotiationType || opportunity.projectClientType) || opportunity.projectClientType || '',
      negotiationType: normalizeNegotiationType(opportunity.negotiationType || opportunity.projectClientType) || '',
      projectClassification: opportunity.projectClassification || '',
      projectTower: opportunity.projectTower || '',
      projectDetail: opportunity.projectDetail || '',
      manufacturer: opportunity.manufacturer || '',
      licenseCount: opportunity.licenseCount ?? '',
      contractMonths: opportunity.contractMonths ?? '',
      monthlyValue: opportunity.monthlyValue ?? '',
      installationFee: opportunity.installationFee ?? '',
      leadSourceDetail: opportunity.leadSourceDetail || '',
      projectType: opportunity.projectType || 'SINGLE',
      projectMonths: opportunity.projectMonths ? String(opportunity.projectMonths) : '12',
      description: opportunity.description || '',
      value: opportunity.value?.toString() || '',
      probability: opportunity.probability || 50,
      stage: opportunity.stage,
      source: opportunity.source || 'MANUAL',
      leadEntryDate: toDateInputValue(opportunity.leadEntryDate || opportunity.createdAt),
      expectedCloseDate: toDateInputValue(opportunity.expectedCloseDate),
      customerTurnDate: toDateInputValue(opportunity.customerTurnDate || (opportunity.stage === 'WON' ? opportunity.actualCloseDate : null)),
      exitDate: toDateInputValue(opportunity.exitDate || (opportunity.stage === 'LOST' ? opportunity.actualCloseDate : null)),
      lossReason: opportunity.lossReason || '',
      companyId: opportunity.companyId,
      ownerId: opportunity.ownerId,
      notes: opportunity.notes || '',
      contactName: opportunity.contactName || '',
      contactFullName: opportunity.contactFullName || '',
      contactEmail: opportunity.contactEmail || '',
      contactPhone: opportunity.contactPhone || '',
      products: (opportunity.products || []).map(p => ({
        _key: p.id || String(Math.random()),
        productId: p.productId || p.product?.id || '',
        quantity: p.quantity || 1,
        unitPrice: p.unitPrice || 0,
        discount: p.discount || 0,
        notes: p.notes || ''
      }))
    });
    setShowModal(true);
  };

  const handleDelete = async (opportunity, e) => {
    if (e) e.stopPropagation();
    if (!isAdmin || !opportunity?.id) return;
    if (!window.confirm(`Excluir a oportunidade "${opportunity.title}"?`)) return;
    try {
      const res = await fetch(buildScopedOpportunityByIdUrl(opportunity.id), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setOpportunities(prev => prev.filter(o => o.id !== opportunity.id));
        if (selectedOpportunity?.id === opportunity.id) setShowDetailsModal(false);
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d?.error || 'Erro ao excluir oportunidade');
      }
    } catch (err) {
      alert('Erro ao excluir oportunidade');
    }
  };

  const handleCreateProjectFromOpportunity = async (opportunity, e) => {
    if (e) e.stopPropagation();
    if (!opportunity?.id) return;

    if (opportunity.project?.id) {
      navigate(`/projetos/${opportunity.project.id}`);
      return;
    }

    try {
      const response = await fetch(buildApiUrl(`/projetos/from-opportunity/${opportunity.id}`), {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || `Erro ${response.status} ao criar projeto`);
      }

      setOpportunities(prev => prev.map(item => (
        item.id === opportunity.id
          ? { ...item, project: { id: payload.id, number: payload.number, name: payload.name, status: payload.status } }
          : item
      )));
      navigate(`/projetos/${payload.id}`);
    } catch (error) {
      console.error('Erro ao criar projeto da oportunidade:', error);
      alert(error.message || 'Erro ao criar projeto da oportunidade');
    }
  };

  const handleViewDetails = async (opportunity) => {
    setSelectedOpportunity(opportunity);
    setLossReasonDraft(opportunity?.lossReason || '');
    setLossReasonError('');
    setFollowUpText('');
    setFollowUpError('');
    setFollowUpType('NOTE');
    setShowDetailsModal(true);
    
    // Carregar follow-ups
    await fetchFollowUps(opportunity.id);
  };

  const handleSaveLossReason = async () => {
    if (!selectedOpportunity?.id) return;

    const nextLossReason = lossReasonDraft.trim();
    const currentDecisionDetails = parseStageDecisionDetails(selectedOpportunity.stageDecisionDetails);
    const nextStageDecisionDetails = currentDecisionDetails
      ? {
          ...currentDecisionDetails,
          ...(currentDecisionDetails.decision === 'LOST' ? { reason: nextLossReason, lossReason: nextLossReason } : {})
        }
      : undefined;

    setLossReasonSaving(true);
    setLossReasonError('');

    try {
      const response = await fetch(buildScopedOpportunityByIdUrl(selectedOpportunity.id), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          lossReason: nextLossReason || null,
          ...(nextStageDecisionDetails !== undefined ? { stageDecisionDetails: nextStageDecisionDetails } : {})
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || errorData?.message || 'Erro ao salvar motivo da perda.');
      }

      const updatedOpportunity = await response.json().catch(() => null);
      const localUpdate = (opportunity) => ({
        ...opportunity,
        ...(updatedOpportunity || {}),
        lossReason: nextLossReason || null,
        ...(nextStageDecisionDetails !== undefined ? { stageDecisionDetails: nextStageDecisionDetails } : {})
      });

      setSelectedOpportunity((prev) => (prev?.id === selectedOpportunity.id ? localUpdate(prev) : prev));
      setOpportunities((prev) => prev.map((opportunity) => (
        opportunity.id === selectedOpportunity.id ? localUpdate(opportunity) : opportunity
      )));
    } catch (error) {
      console.error('Erro ao salvar motivo da perda:', error);
      setLossReasonError(error.message || 'Erro ao salvar motivo da perda.');
    } finally {
      setLossReasonSaving(false);
    }
  };

  const fetchFollowUps = async (opportunityId) => {
    setLoadingFollowUps(true);
    try {
      const response = await fetch(buildApiUrl(`/opportunity-followups/${opportunityId}`), {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setFollowUps(data);
      }
    } catch (error) {
      console.error('Erro ao carregar acompanhamentos:', error);
    } finally {
      setLoadingFollowUps(false);
    }
  };

  const handleAddOpportunityFollowUp = async () => {
    const description = followUpText.trim();
    if (!selectedOpportunity?.id || (!description && followUpPrints.length === 0)) {
      setFollowUpError('Informe o acompanhamento ou anexe ao menos um print.');
      return;
    }

    setFollowUpSubmitting(true);
    setFollowUpError('');

    try {
      const formData = new FormData();
      formData.append('opportunityId', selectedOpportunity.id);
      formData.append('type', followUpType);
      formData.append('content', description);
      followUpPrints.forEach((file) => {
        formData.append('attachments', file);
      });

      const response = await fetch(buildApiUrl('/opportunity-followups'), {
        method: 'POST',
        headers: getUploadAuthHeaders(),
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || errorData?.message || 'Erro ao salvar acompanhamento.');
      }

      const createdFollowUp = await response.json();
      setFollowUps([createdFollowUp, ...followUps]);
      setFollowUpText('');
      followUpPrintPreviews.forEach((item) => URL.revokeObjectURL(item.url));
      setFollowUpPrints([]);
      setFollowUpPrintPreviews([]);
      setFollowUpType('NOTE');
    } catch (error) {
      console.error('Erro ao salvar acompanhamento:', error);
      setFollowUpError(error.message || 'Erro ao salvar acompanhamento.');
    } finally {
      setFollowUpSubmitting(false);
    }
  };

  const handleDeleteFollowUp = async (followUpId) => {
    if (!confirm('Deseja remover este acompanhamento?')) return;

    try {
      const response = await fetch(buildApiUrl(`/opportunity-followups/${followUpId}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setFollowUps(followUps.filter(f => f.id !== followUpId));
      }
    } catch (error) {
      console.error('Erro ao remover acompanhamento:', error);
      alert('Erro ao remover acompanhamento.');
    }
  };

  const handleFollowUpPrintsChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const validFiles = files.filter((file) => file.type.startsWith('image/'));
    const availableSlots = Math.max(0, MAX_FOLLOW_UP_PRINTS - followUpPrints.length);
    const acceptedFiles = validFiles.slice(0, availableSlots);

    setFollowUpPrints((current) => [...current, ...acceptedFiles]);
    setFollowUpPrintPreviews((current) => [
      ...current,
      ...acceptedFiles.map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file)
      }))
    ]);
    if (followUpError) setFollowUpError('');
    event.target.value = '';

    if (validFiles.length !== files.length) {
      setFollowUpError('Alguns arquivos foram ignorados. Envie apenas imagens.');
    } else if (followUpPrints.length + validFiles.length > MAX_FOLLOW_UP_PRINTS) {
      setFollowUpError(`É possível anexar até ${MAX_FOLLOW_UP_PRINTS} prints por acompanhamento.`);
    }
  };

  const removeFollowUpPrint = (index) => {
    setFollowUpPrintPreviews((current) => {
      const target = current[index];
      if (target?.url) URL.revokeObjectURL(target.url);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
    setFollowUpPrints((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatCompactCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value || 0);
  };

  const renderStageDecisionDetails = (details) => {
    const data = parseStageDecisionDetails(details);
    if (!data) return null;

    const rows = [
      { label: 'Decisão', value: data.decision === 'WON' ? 'Ganho' : data.decision === 'NO_GO' ? 'NO GO' : data.decision === 'LOST' ? 'Perdido' : data.decision },
      { label: data.decision === 'WON' ? 'Concorrente superado' : 'Concorrente', value: data.competitorName || data.wonFromCompetitor || data.lostToCompetitor },
      { label: 'Motivo', value: data.reason || data.winReason || data.lossReason || data.noGoReason },
      { label: 'Nosso preço', value: data.ourPrice !== null && data.ourPrice !== undefined ? formatCurrency(data.ourPrice) : '' },
      { label: 'Preço concorrente', value: data.competitorPrice !== null && data.competitorPrice !== undefined ? formatCurrency(data.competitorPrice) : '' },
      { label: 'Diferença', value: data.priceDifference !== null && data.priceDifference !== undefined ? formatCurrency(data.priceDifference) : '' },
      { label: 'Desclassificação', value: data.disqualificationReason },
      { label: 'Recurso', value: data.appealNotes }
    ].filter((row) => row.value);

    return (
      <div className="rounded-xl border border-cyan-400/35 bg-cyan-500/10 p-4">
        <h3 className="text-sm font-semibold text-cyan-100 mb-3">Dados da Decisão</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rows.map((row) => (
            <div key={row.label}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-cyan-200/70">{row.label}</div>
              <div className="mt-0.5 text-sm font-medium text-cyan-50">{row.value}</div>
            </div>
          ))}
        </div>
        {data.notes && (
          <p className="mt-3 border-t border-cyan-300/20 pt-3 text-sm text-cyan-50/85 whitespace-pre-wrap">{data.notes}</p>
        )}
      </div>
    );
  };

  const getStageDecisionSummary = (opportunity) => {
    const data = parseStageDecisionDetails(opportunity?.stageDecisionDetails);
    if (!data) return null;

    const decisionLabel =
      data.decision === 'WON' ? 'Ganho' :
      data.decision === 'NO_GO' ? 'NO GO' :
      data.decision === 'LOST' ? 'Perdido' :
      data.decision || (opportunity?.stage === 'WON' ? 'Ganho' : opportunity?.stage === 'LOST' ? 'Perdido' : 'Decisão');
    const reason = data.reason || data.winReason || data.lossReason || data.noGoReason || opportunity?.lossReason || '';
    const competitor = data.competitorName || data.wonFromCompetitor || data.lostToCompetitor || '';
    const description = data.notes || '';
    const priceDifference = data.priceDifference !== null && data.priceDifference !== undefined
      ? formatCurrency(data.priceDifference)
      : '';

    return {
      decisionLabel,
      reason,
      competitor,
      description,
      priceDifference,
      disqualificationReason: data.disqualificationReason || '',
      appealNotes: data.appealNotes || ''
    };
  };

  const renderStageDecisionSummary = (opportunity, { compact = false } = {}) => {
    const summary = getStageDecisionSummary(opportunity);
    if (!summary) return null;

    const detailLines = [
      summary.reason ? `Motivo: ${summary.reason}` : '',
      !compact && summary.competitor ? `Concorrente: ${summary.competitor}` : '',
      !compact && summary.priceDifference ? `Diferença: ${summary.priceDifference}` : '',
      !compact && summary.disqualificationReason ? `Desclassificação: ${summary.disqualificationReason}` : '',
      !compact && summary.appealNotes ? `Recurso: ${summary.appealNotes}` : ''
    ].filter(Boolean);

    return (
      <div className={[
        'rounded-xl border bg-cyan-500/10 text-cyan-50',
        compact ? 'mb-3 border-cyan-400/25 p-3' : 'border-cyan-400/35 p-4'
      ].join(' ')}>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-cyan-200">
          <MessageSquare className="h-3.5 w-3.5" />
          Decisão: {summary.decisionLabel}
        </div>
        {summary.description && (
          <p className={[
            'mt-2 leading-relaxed text-cyan-50/90 whitespace-pre-wrap',
            compact ? 'line-clamp-3 text-xs' : 'text-sm'
          ].join(' ')}>
            {summary.description}
          </p>
        )}
        {detailLines.length > 0 && (
          <div className={compact ? 'mt-2 space-y-1 text-xs text-cyan-100/80' : 'mt-3 grid gap-2 text-sm text-cyan-100/85 sm:grid-cols-2'}>
            {detailLines.map((line) => (
              <div key={line} className="line-clamp-2">{line}</div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const getNextStage = (currentStage) => {
    const currentIndex = stages.indexOf(currentStage);
    if (currentIndex < stages.length - 3) { // Não avançar para WON ou LOST automaticamente
      return stages[currentIndex + 1];
    }
    return null;
  };

  const getAdvanceLabel = (currentStage) => {
    if (currentStage === 'LEAD') return 'Converter Lead';
    return 'Avançar';
  };

  // Filtrar oportunidades
  const filteredOpportunities = Array.isArray(opportunities) ? opportunities.filter(opp => {
    if (!opp) return false;
    const term = normalizeSearchText(searchTerm);
    const title = normalizeSearchText(opp.title || opp.TITLE);
    const number = normalizeSearchText(opp.number || opp.NUMBER);
    const projectName = normalizeSearchText(opp.projectName || opp.PROJECTNAME);
    const companyName = normalizeSearchText(opp.company?.name || opp.company?.NAME);
    const ownerName = normalizeSearchText(opp.owner?.name || opp.owner?.NAME);
    const matchesSearch = !term || [companyName, projectName, title, number, ownerName].some((value) => value.includes(term));
    const stage = opp.stage || opp.STAGE;
    const matchesStage = !stageFilter || stage === stageFilter;
    const oppOwnerId = opp.ownerId || opp.OWNERID || opp.owner?.id || opp.owner?.ID;
    const matchesSeller = !sellerFilter || oppOwnerId === sellerFilter;
    return matchesSearch && matchesStage && matchesSeller;
  }) : [];

  const filteredStats = buildStats(filteredOpportunities);
  const orderedFilteredOpportunities = [...filteredOpportunities].sort((a, b) => {
    const stageIndexA = stages.indexOf(a.stage || a.STAGE);
    const stageIndexB = stages.indexOf(b.stage || b.STAGE);
    const normalizedStageIndexA = stageIndexA === -1 ? stages.length : stageIndexA;
    const normalizedStageIndexB = stageIndexB === -1 ? stages.length : stageIndexB;

    if (normalizedStageIndexA !== normalizedStageIndexB) {
      return normalizedStageIndexA - normalizedStageIndexB;
    }

    const dateA = new Date(a.leadEntryDate || a.createdAt || 0).getTime() || 0;
    const dateB = new Date(b.leadEntryDate || b.createdAt || 0).getTime() || 0;
    return dateB - dateA;
  });

  // Calcular totais por etapa (sincronizado com filtros)
  const stageTotals = stages.reduce((acc, stage) => {
    const stageItems = filteredOpportunities.filter(i => i.stage === stage);
    acc[stage] = {
      count: stageItems.length,
      value: stageItems.reduce((sum, item) => sum + (item.value || 0), 0)
    };
    return acc;
  }, {});

  const modalContainerClass = 'rounded-2xl border border-[color:var(--crm-border)] bg-[linear-gradient(155deg,rgb(var(--crm-surface-rgb)_/_0.96)_0%,rgb(var(--crm-surface-rgb)_/_0.88)_58%,rgb(var(--crm-accent-rgb)_/_0.12)_100%)] p-5 md:p-6 shadow-[0_25px_70px_rgba(2,8,23,0.35)]';
  const modalLabelClass = 'block text-sm font-semibold text-[var(--crm-ink)] mb-2';
  const modalInputClass = 'crm-input !px-4 !py-3 text-base';
  const modalActionsClass = 'flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-5 border-t border-[color:var(--crm-border)]';
  const modalCancelButtonClass = 'crm-btn crm-btn-secondary min-w-[130px]';
  const modalSubmitButtonClass = 'crm-btn min-w-[190px] text-white border border-cyan-300/45 bg-[linear-gradient(135deg,#2563eb_0%,#0891b2_100%)] hover:brightness-110 shadow-[0_14px_30px_rgba(37,99,235,0.35)]';

  if (loading) {
    return (
      <div className="min-h-[50vh] grid place-items-center px-6">
        <div className="crm-panel px-5 py-4 flex items-center gap-3 motion-safe:animate-scale-in">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgb(var(--crm-accent-rgb)_/_0.85)] border-t-transparent" />
          <div className="text-sm font-semibold text-[var(--crm-muted)]">Carregando pipeline...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title={pipelineTitle}
        subtitle={pipelineSubtitle}
        icon={Target}
        gradient="blue"
        breadcrumbs={['CRM', pipelineLabel, 'Oportunidades']}
        actions={[
          {
            label: 'Testar Fluxo B2B E2E',
            icon: Rocket,
            onClick: () => setIsTestModalOpen(true),
            variant: 'secondary'
          },
          {
            label: 'Nova Oportunidade',
            icon: Plus,
            onClick: openCreateOpportunity,
            variant: 'primary'
          }
        ]}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-5">
        <AnimatedStats
          title="Total de Oportunidades"
          value={filteredStats.total}
          subtitle="Todas as oportunidades"
          icon={Target}
          color="blue"
          trend={{ direction: 'up', value: '+12% este mês' }}
          size="compact"
        />
        
        <AnimatedStats
          title="Valor Total"
          value={formatCompactCurrency(filteredStats.totalValue)}
          valueTitle={formatCurrency(filteredStats.totalValue)}
          subtitle="Pipeline aberto e histórico"
          icon={DollarSign}
          color="green"
          trend={{ direction: 'up', value: '+18% este mês' }}
          size="compact"
        />
        
        <AnimatedStats
          title="Taxa de Conversão"
          value={`${filteredStats.conversionRate.toFixed(1)}%`}
          subtitle={`${filteredStats.won} oportunidades ganhas`}
          icon={TrendingUp}
          color="purple"
          trend={{ direction: 'up', value: '+2.3% este mês' }}
          size="compact"
        />
        
        <AnimatedStats
          title="Ticket Médio"
          value={formatCompactCurrency(filteredStats.avgValue)}
          valueTitle={formatCurrency(filteredStats.avgValue)}
          subtitle="Média por oportunidade"
          icon={BarChart3}
          color="orange"
          trend={{ direction: 'up', value: '+8.5% este mês' }}
          size="compact"
        />
      </div>

      {/* Abas: Oportunidades / Histórico */}
      <div className="flex gap-1 rounded-2xl border border-[color:var(--crm-border)] bg-[var(--crm-surface)] p-1.5 w-fit shadow-sm">
        <button
          onClick={() => setViewMode('pipeline')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
            viewMode === 'pipeline'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-[var(--crm-muted)] hover:text-[var(--crm-ink)] hover:bg-[rgb(var(--crm-accent-rgb)_/_0.08)]'
          }`}
        >
          <Target className="w-4.5 h-4.5" />
          Oportunidades
        </button>
        <button
          onClick={() => setViewMode('historico')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
            viewMode === 'historico'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-[var(--crm-muted)] hover:text-[var(--crm-ink)] hover:bg-[rgb(var(--crm-accent-rgb)_/_0.08)]'
          }`}
        >
          <BarChart3 className="w-4.5 h-4.5" />
          Histórico
        </button>
      </div>

      {viewMode === 'pipeline' ? (
      <>
      {/* Filtros */}
      <div className="rounded-2xl border border-[color:var(--crm-border)] bg-[var(--crm-surface)] p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="min-w-0 flex-1">
            <label className="sr-only" htmlFor="opportunity-search">Buscar oportunidades</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--crm-muted)]" />
              <input
                id="opportunity-search"
                type="search"
                placeholder="Buscar por cliente ou nome do projeto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="crm-input w-full pl-12"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-2">
              <Filter className="h-4 w-4 shrink-0 text-[var(--crm-muted)]" />
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="crm-input w-full min-w-[220px] sm:w-auto"
              >
                <option value="">Todas as etapas</option>
                {stages.map(stage => (
                  <option key={stage} value={stage}>{stageLabels[stage]}</option>
                ))}
              </select>
            </div>

            <div className="flex min-w-0 items-center gap-2">
              <Filter className="h-4 w-4 shrink-0 text-[var(--crm-muted)]" />
              <select
                value={sellerFilter}
                onChange={(e) => setSellerFilter(e.target.value)}
                className="crm-input w-full min-w-[220px] sm:w-auto"
              >
                <option value="">Todos os vendedores</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-fit gap-1 rounded-2xl border border-[color:var(--crm-border)] bg-[var(--crm-surface)] p-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => setPipelineViewMode('list')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
            pipelineViewMode === 'list'
              ? 'bg-[rgb(var(--crm-accent-rgb)_/_0.18)] text-[var(--crm-ink)] shadow-sm'
              : 'text-[var(--crm-muted)] hover:bg-[rgb(var(--crm-accent-rgb)_/_0.08)] hover:text-[var(--crm-ink)]'
          }`}
        >
          <List className="h-4.5 w-4.5" />
          Lista
        </button>
        <button
          type="button"
          onClick={() => setPipelineViewMode('kanban')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
            pipelineViewMode === 'kanban'
              ? 'bg-[linear-gradient(135deg,rgba(234,88,12,0.42),rgba(124,45,18,0.62))] text-white shadow-sm'
              : 'text-[var(--crm-muted)] hover:bg-[rgb(var(--crm-accent-rgb)_/_0.08)] hover:text-[var(--crm-ink)]'
          }`}
        >
          <LayoutGrid className="h-4.5 w-4.5" />
          Kanban
        </button>
      </div>

      {pipelineViewMode === 'kanban' ? (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map(stage => (
          <div
            key={stage}
            className={`min-w-[300px] max-w-[300px] transition-all duration-200 ${dragOverColumn === stage ? 'scale-[1.02]' : ''}`}
            onDragOver={handleDragOver}
            onDragEnter={(e) => handleDragEnter(e, stage)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage)}
          >
            <div className={`rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4 h-full transition-all duration-200 ${
              dragOverColumn === stage
                ? 'ring-2 ring-blue-400/60 shadow-lg'
                : ''
            }`}>
              {/* Header da Coluna */}
              <div className="mb-4 pb-3 border-b-2" style={{ borderColor: stageColors[stage] }}>
                <h3 className="text-base font-bold mb-1.5" style={{ color: stageColors[stage] }}>
                  {stageLabels[stage]}
                  {dragOverColumn === stage && (
                    <span className="ml-2 text-blue-400 animate-pulse text-sm">📥</span>
                  )}
                </h3>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--crm-muted)]">
                    {stageTotals[stage].count} oportunidade{stageTotals[stage].count !== 1 ? 's' : ''}
                  </span>
                  <span className="font-bold text-[var(--crm-ink)]">
                    {formatCurrency(stageTotals[stage].value)}
                  </span>
                </div>
              </div>

              {/* Cards das Oportunidades */}
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-0.5">
                {filteredOpportunities
                  .filter(opp => opp.stage === stage)
                  .length === 0 ? (
                    <div className={`text-center py-8 text-[var(--crm-muted)] transition-all duration-200 ${
                      dragOverColumn === stage
                        ? 'bg-blue-100 border-2 border-dashed border-blue-300 rounded-lg'
                        : ''
                    }`}>
                      <Target className="w-12 h-12 mx-auto mb-2 text-[var(--crm-muted)] opacity-40" />
                      <p className="text-sm">
                        {dragOverColumn === stage
                          ? 'Solte aqui para mover'
                          : 'Nenhuma oportunidade nesta etapa'
                        }
                      </p>
                    </div>
                  ) : (
                    filteredOpportunities
                      .filter(opp => opp.stage === stage)
                      .map(opp => (
                    <div
                      key={opp.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, opp)}
                      onDragEnd={handleDragEnd}
                      className={`group relative rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
                        draggedItem?.id === opp.id ? 'opacity-50 rotate-2 scale-95' : ''
                      } cursor-move`}
                      onClick={() => handleViewDetails(opp)}
                    >
                      {/* Drag handle + título + edit */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-start gap-1.5 flex-1 min-w-0">
                          <span className="text-[var(--crm-muted)] text-xs mt-0.5 shrink-0">⋮⋮</span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[var(--crm-ink)] leading-snug line-clamp-2">
                              {opp.company?.name || 'Cliente não informado'}
                            </p>
                            {opp.number && (
                              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[rgb(var(--crm-accent-rgb))]">
                                {opp.number}
                              </p>
                            )}
                            <p className="text-xs text-[var(--crm-muted)] mt-0.5 line-clamp-1">
                              Projeto: {opp.projectName || opp.title || 'Não informado'}
                            </p>
                            {opp.projectName && opp.title && opp.title !== opp.projectName && (
                              <p className="text-xs text-[var(--crm-muted)] mt-0.5 line-clamp-1">
                                Oportunidade: {opp.title}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          draggable={false}
                          onMouseDown={(e) => e.stopPropagation()}
                          onDragStart={(e) => e.preventDefault()}
                          onClick={(e) => handleEdit(opp, e)}
                          className="opacity-0 group-hover:opacity-100 shrink-0 p-1 rounded-lg text-[var(--crm-muted)] hover:text-[var(--crm-accent)] hover:bg-[var(--crm-bg)] transition-all"
                          title="Editar"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Valor */}
                      <p className="text-base font-extrabold text-emerald-400 mb-3">
                        {formatCurrency(opp.value)}
                      </p>

                      {(stage === 'WON' || stage === 'LOST') && renderStageDecisionSummary(opp, { compact: true })}

                      {/* Infos */}
                      <div className="space-y-1.5 mb-3">
                        {(opp.negotiationType || opp.projectClientType) && (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--crm-muted)]">
                            <BarChart3 className="w-3 h-3 shrink-0" />
                            <span>{opp.negotiationType || projectClientTypeLabels[opp.projectClientType] || opp.projectClientType}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-xs text-[var(--crm-muted)]">
                          <DollarSign className="w-3 h-3 shrink-0" />
                          <span>
                            {projectTypeLabels[opp.projectType] || 'Projeto pontual'}
                            {opp.projectType === 'MONTHLY' && opp.projectMonths ? ` - ${opp.projectMonths} meses` : ''}
                          </span>
                        </div>
                        {opp.owner && (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--crm-muted)]">
                            <User className="w-3 h-3 shrink-0" />
                            <span>{opp.owner.name}</span>
                          </div>
                        )}
                        {opp.probability > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--crm-muted)]">
                            <Percent className="w-3 h-3 shrink-0" />
                            <span>{opp.probability}% de chance</span>
                          </div>
                        )}
                        {opp.expectedCloseDate && (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--crm-muted)]">
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span>Prevista: {formatDateBR(opp.expectedCloseDate)}</span>
                          </div>
                        )}
                        {opp.leadEntryDate && (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--crm-muted)]">
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span>Entrada: {formatDateBR(opp.leadEntryDate)}</span>
                          </div>
                        )}
                        {stage === 'WON' && (opp.customerTurnDate || opp.actualCloseDate) && (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-300">
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span>Virada: {formatDateBR(opp.customerTurnDate || opp.actualCloseDate)}</span>
                          </div>
                        )}
                        {stage === 'LOST' && (opp.exitDate || opp.actualCloseDate) && (
                          <div className="flex items-center gap-1.5 text-xs text-red-300">
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span>Saída: {formatDateBR(opp.exitDate || opp.actualCloseDate)}</span>
                          </div>
                        )}
                      </div>

                      {/* Botões de ação */}
                      {stage !== 'WON' && stage !== 'LOST' && (
                        <div className="flex items-center gap-1.5 pt-3 border-t border-[var(--crm-border)]">
                          {getNextStage(stage) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); requestMoveOpportunity(opp, getNextStage(stage)); }}
                              className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-blue-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
                            >
                              {getAdvanceLabel(stage)} <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); requestMoveOpportunity(opp, 'WON'); }}
                            className="flex items-center justify-center rounded-xl bg-emerald-600 p-1.5 text-white hover:bg-emerald-500 transition-colors"
                            title="Marcar como Ganha"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); requestMoveOpportunity(opp, 'LOST'); }}
                            className="flex items-center justify-center rounded-xl bg-red-600 p-1.5 text-white hover:bg-red-500 transition-colors"
                            title="Marcar como Perdida"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={(e) => handleDelete(opp, e)}
                              className="flex items-center justify-center rounded-xl border border-red-500/30 p-1.5 text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                      {stage === 'WON' && (
                        <div className="flex items-center gap-1.5 pt-3 border-t border-[var(--crm-border)]">
                          <button
                            onClick={(e) => handleCreateProjectFromOpportunity(opp, e)}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
                            title={opp.project?.id ? 'Abrir projeto vinculado' : 'Criar projeto planejado'}
                          >
                            <FolderKanban className="w-3.5 h-3.5" />
                            {opp.project?.id ? 'Abrir Projeto' : 'Criar Projeto'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      ) : (
      <div className="overflow-hidden rounded-2xl border border-[color:var(--crm-border)] bg-[var(--crm-surface)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead>
              <tr className="border-b border-[color:var(--crm-border)] bg-[rgb(var(--crm-accent-rgb)_/_0.06)]">
                <th className="p-4 text-left font-semibold text-[var(--crm-ink)]">Cliente</th>
                <th className="p-4 text-left font-semibold text-[var(--crm-ink)]">Projeto</th>
                <th className="p-4 text-left font-semibold text-[var(--crm-ink)]">Etapa</th>
                <th className="p-4 text-left font-semibold text-[var(--crm-ink)]">Valor</th>
                <th className="p-4 text-left font-semibold text-[var(--crm-ink)]">Tipo</th>
                <th className="p-4 text-left font-semibold text-[var(--crm-ink)]">Prob.</th>
                <th className="p-4 text-left font-semibold text-[var(--crm-ink)]">Prevista</th>
                <th className="p-4 text-left font-semibold text-[var(--crm-ink)]">Responsável</th>
                <th className="p-4 text-right font-semibold text-[var(--crm-ink)]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {orderedFilteredOpportunities.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-[var(--crm-muted)]">
                    <Target className="mx-auto mb-2 h-12 w-12 opacity-40" />
                    <p>Nenhuma oportunidade encontrada.</p>
                  </td>
                </tr>
              ) : (
                orderedFilteredOpportunities.map((opp) => {
                  const stage = opp.stage || opp.STAGE;
                  const nextStage = getNextStage(stage);
                  return (
                    <tr
                      key={opp.id}
                      onClick={() => handleViewDetails(opp)}
                      className="cursor-pointer border-b border-[color:var(--crm-border)] transition-colors hover:bg-[rgb(var(--crm-accent-rgb)_/_0.04)]"
                    >
                      <td className="p-4">
                        <div className="font-semibold text-[var(--crm-ink)]">{opp.company?.name || 'Cliente não informado'}</div>
                        {opp.number && (
                          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[rgb(var(--crm-accent-rgb))]">{opp.number}</div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="max-w-[260px] font-medium text-[var(--crm-ink)]">{opp.projectName || opp.title || 'Não informado'}</div>
                        {opp.projectName && opp.title && opp.title !== opp.projectName && (
                          <div className="mt-1 max-w-[260px] truncate text-xs text-[var(--crm-muted)]">{opp.title}</div>
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                          style={{ backgroundColor: stageColors[stage] || '#64748b' }}
                        >
                          {stageLabels[stage] || stage || 'N/I'}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-emerald-400">{formatCurrency(opp.value)}</td>
                      <td className="p-4 text-[var(--crm-muted)]">
                        <div>{opp.negotiationType || projectClientTypeLabels[opp.projectClientType] || opp.projectClientType || 'N/I'}</div>
                        <div className="mt-1 text-xs">{projectTypeLabels[opp.projectType] || 'Projeto pontual'}</div>
                      </td>
                      <td className="p-4 text-[var(--crm-muted)]">{opp.probability ? `${opp.probability}%` : '—'}</td>
                      <td className="p-4 text-[var(--crm-muted)]">{formatDateBR(opp.expectedCloseDate) || '—'}</td>
                      <td className="p-4 text-[var(--crm-muted)]">{opp.owner?.name || 'N/I'}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(event) => handleEdit(opp, event)}
                            className="rounded-lg p-2 text-[var(--crm-muted)] transition-colors hover:bg-[var(--crm-bg)] hover:text-[var(--crm-accent)]"
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          {stage !== 'WON' && stage !== 'LOST' && nextStage && (
                            <button
                              type="button"
                              onClick={(event) => { event.stopPropagation(); requestMoveOpportunity(opp, nextStage); }}
                              className="rounded-lg p-2 text-blue-300 transition-colors hover:bg-blue-500/10 hover:text-blue-200"
                              title={getAdvanceLabel(stage)}
                            >
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          )}
                          {stage !== 'WON' && stage !== 'LOST' && (
                            <>
                              <button
                                type="button"
                                onClick={(event) => { event.stopPropagation(); requestMoveOpportunity(opp, 'WON'); }}
                                className="rounded-lg p-2 text-emerald-300 transition-colors hover:bg-emerald-500/10 hover:text-emerald-200"
                                title="Marcar como ganha"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(event) => { event.stopPropagation(); requestMoveOpportunity(opp, 'LOST'); }}
                                className="rounded-lg p-2 text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200"
                                title="Marcar como perdida"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {stage === 'WON' && (
                            <button
                              type="button"
                              onClick={(event) => handleCreateProjectFromOpportunity(opp, event)}
                              className="rounded-lg p-2 text-emerald-300 transition-colors hover:bg-emerald-500/10 hover:text-emerald-200"
                              title={opp.project?.id ? 'Abrir projeto vinculado' : 'Criar projeto planejado'}
                            >
                              <FolderKanban className="h-4 w-4" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={(event) => handleDelete(opp, event)}
                              className="rounded-lg p-2 text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
      </>
      ) : (
      /* ── Histórico (Ganhas / Perdidas) ── */
      <div className="rounded-2xl border border-[color:var(--crm-border)] bg-[var(--crm-surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--crm-border)] bg-[rgb(var(--crm-accent-rgb)_/_0.06)]">
                <th className="text-left p-4 font-semibold text-[var(--crm-ink)]">Empresa</th>
                <th className="text-left p-4 font-semibold text-[var(--crm-ink)]">Projeto</th>
                <th className="text-left p-4 font-semibold text-[var(--crm-ink)]">Valor</th>
                <th className="text-left p-4 font-semibold text-[var(--crm-ink)]">Status</th>
                <th className="text-left p-4 font-semibold text-[var(--crm-ink)]">Data Virada/Saída</th>
                <th className="text-left p-4 font-semibold text-[var(--crm-ink)]">Motivo</th>
                <th className="text-left p-4 font-semibold text-[var(--crm-ink)]">Acompanhamentos</th>
                <th className="text-left p-4 font-semibold text-[var(--crm-ink)]">Responsável</th>
              </tr>
            </thead>
            <tbody>
              {filteredOpportunities.filter(o => o.stage === 'WON' || o.stage === 'LOST').length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-[var(--crm-muted)]">
                    <Target className="w-12 h-12 mx-auto mb-2 opacity-40" />
                    <p>Nenhuma oportunidade ganha ou perdida ainda.</p>
                  </td>
                </tr>
              ) : (
                filteredOpportunities
                  .filter(o => o.stage === 'WON' || o.stage === 'LOST')
                  .sort((a, b) => new Date((b.stage === 'WON' ? b.customerTurnDate : b.exitDate) || b.actualCloseDate || b.expectedCloseDate || 0) - new Date((a.stage === 'WON' ? a.customerTurnDate : a.exitDate) || a.actualCloseDate || a.expectedCloseDate || 0))
                  .map(opp => (
                    <tr
                      key={opp.id}
                      onClick={() => handleViewDetails(opp)}
                      className="border-b border-[color:var(--crm-border)] hover:bg-[rgb(var(--crm-accent-rgb)_/_0.04)] cursor-pointer transition-colors"
                    >
                      <td className="p-4 font-medium text-[var(--crm-ink)]">{opp.company?.name || 'N/I'}</td>
                      <td className="p-4 text-[var(--crm-ink)]">{opp.projectName || opp.title}</td>
                      <td className="p-4 font-semibold text-emerald-400">{formatCurrency(opp.value)}</td>
                      <td className="p-4">
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{
                            backgroundColor: opp.stage === 'WON' ? 'rgba(16,185,129,0.2)' : 'rgba(107,114,128,0.2)',
                            color: opp.stage === 'WON' ? '#10b981' : '#6b7280'
                          }}
                        >
                          {opp.stage === 'WON' ? 'Ganha' : 'Perdida'}
                        </span>
                      </td>
                      <td className="p-4 text-[var(--crm-muted)]">
                        {formatDateBR((opp.stage === 'WON' ? opp.customerTurnDate : opp.exitDate) || opp.actualCloseDate || opp.expectedCloseDate) || '—'}
                      </td>
                      <td className="p-4 text-[var(--crm-muted)] min-w-[260px] max-w-[360px]">
                        {renderStageDecisionSummary(opp) || (opp.stage === 'LOST' ? (opp.lossReason || '—') : '—')}
                      </td>
                      <td className="p-4 text-[var(--crm-muted)]">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.72)] px-2.5 py-1 text-xs font-semibold text-[var(--crm-ink)]">
                          <MessageSquare className="h-3.5 w-3.5 text-[rgb(var(--crm-accent-rgb))]" />
                          {(opp.activities || []).length}
                        </span>
                      </td>
                      <td className="p-4 text-[var(--crm-muted)]">{opp.owner?.name || 'N/I'}</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Modal de Formulário */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => { setShowModal(false); resetForm(); }}
          title={selectedOpportunity ? 'Editar Oportunidade' : 'Nova Oportunidade'}
          size="large"
        >
          <OpportunityForm
            formData={formData}
            setFormData={setFormData}
            selectedOpportunity={selectedOpportunity}
            companies={companies}
            users={users}
            products={products}
            stages={stages}
            stageLabels={stageLabels}
            modalInputClass={modalInputClass}
            modalLabelClass={modalLabelClass}
            modalContainerClass={modalContainerClass}
            modalActionsClass={modalActionsClass}
            modalCancelButtonClass={modalCancelButtonClass}
            modalSubmitButtonClass={modalSubmitButtonClass}
            onCancel={() => { setShowModal(false); resetForm(); }}
            onSubmit={handleSubmit}
            onCreateCompany={openNewCompanyFromOpportunity}
            onRefreshCompanies={fetchDependencies}
          />
        </Modal>
      )}

      {/* Modal de Detalhes */}
      {showDetailsModal && selectedOpportunity && (
        <Modal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedOpportunity(null);
            setLossReasonDraft('');
            setLossReasonError('');
            setFollowUpText('');
            setFollowUpError('');
          }}
          title={selectedOpportunity.title}
          size="large"
        >
          <div className="space-y-6">
            <div className="rounded-2xl border border-[color:var(--crm-border)] bg-[linear-gradient(155deg,rgb(var(--crm-surface-rgb)_/_0.95)_0%,rgb(var(--crm-surface-rgb)_/_0.86)_60%,rgb(var(--crm-accent-rgb)_/_0.1)_100%)] p-5 md:p-6 shadow-[0_24px_65px_rgba(2,8,23,0.35)]">
              {selectedOpportunity.number && (
                <div className="mb-4 inline-flex rounded-full border border-[rgb(var(--crm-accent-rgb)_/_0.35)] bg-[rgb(var(--crm-accent-rgb)_/_0.12)] px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[rgb(var(--crm-accent-rgb))]">
                  Nº {selectedOpportunity.number}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="rounded-2xl border border-emerald-300/35 bg-[linear-gradient(140deg,rgba(16,185,129,0.2),rgba(5,46,22,0.5))] p-5">
                  <h3 className="text-xs uppercase tracking-[0.08em] font-semibold text-emerald-100/90">Valor da Oportunidade</h3>
                  <p className="mt-2 text-3xl font-bold text-emerald-200">
                    {formatCurrency(selectedOpportunity.value)}
                  </p>
                </div>

                <div className="rounded-2xl border border-cyan-300/35 bg-[linear-gradient(140deg,rgba(14,116,144,0.28),rgba(30,58,138,0.45))] p-5">
                  <h3 className="text-xs uppercase tracking-[0.08em] font-semibold text-cyan-100/90">Etapa Atual</h3>
                  <div className="mt-3">
                    <span
                      className="inline-flex items-center px-3 py-1.5 text-sm font-semibold rounded-full"
                      style={{
                        backgroundColor: stageColors[selectedOpportunity.stage],
                        color: selectedOpportunity.stage === 'PROPOSAL' ? '#0f172a' : '#f8fafc'
                      }}
                    >
                      {stageLabels[selectedOpportunity.stage]}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="crm-panel-muted rounded-xl p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[rgb(var(--crm-muted-rgb)_/_0.9)] mb-2">Projeto</h3>
                  <span className="text-[var(--crm-ink)] font-medium">{selectedOpportunity.projectName || 'Não informado'}</span>
                </div>

                <div className="crm-panel-muted rounded-xl p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[rgb(var(--crm-muted-rgb)_/_0.9)] mb-2">Tipo de Projeto</h3>
                  <span className="text-[var(--crm-ink)] font-medium">
                    {projectClientTypeLabels[selectedOpportunity.projectClientType] || selectedOpportunity.projectClientType || 'Não informado'}
                  </span>
                </div>

                <div className="crm-panel-muted rounded-xl p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[rgb(var(--crm-muted-rgb)_/_0.9)] mb-2">Modelo Comercial</h3>
                  <span className="text-[var(--crm-ink)] font-medium">
                    {projectTypeLabels[selectedOpportunity.projectType] || 'Projeto pontual'}
                    {selectedOpportunity.projectType === 'MONTHLY' && selectedOpportunity.projectMonths
                      ? ` - ${selectedOpportunity.projectMonths} meses`
                      : ''}
                  </span>
                </div>

                <div className="crm-panel-muted rounded-xl p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[rgb(var(--crm-muted-rgb)_/_0.9)] mb-2">Empresa</h3>
                  <div className="flex items-center">
                    <Building className="w-4 h-4 text-[rgb(var(--crm-accent-rgb))] mr-2" />
                    <span className="text-[var(--crm-ink)] font-medium">{selectedOpportunity.company?.name || 'Não informado'}</span>
                  </div>
                </div>

                <div className="crm-panel-muted rounded-xl p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[rgb(var(--crm-muted-rgb)_/_0.9)] mb-2">Responsável</h3>
                  <div className="flex items-center">
                    <User className="w-4 h-4 text-[rgb(var(--crm-accent-rgb))] mr-2" />
                    <span className="text-[var(--crm-ink)] font-medium">{selectedOpportunity.owner?.name || 'Não informado'}</span>
                  </div>
                </div>

                <div className="crm-panel-muted rounded-xl p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[rgb(var(--crm-muted-rgb)_/_0.9)] mb-2">Probabilidade</h3>
                  <div className="flex items-center">
                    <Percent className="w-4 h-4 text-[rgb(var(--crm-accent-rgb))] mr-2" />
                    <span className="text-[var(--crm-ink)] font-medium">{selectedOpportunity.probability}%</span>
                  </div>
                </div>

                {selectedOpportunity.source && (
                  <div className="crm-panel-muted rounded-xl p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[rgb(var(--crm-muted-rgb)_/_0.9)] mb-2">Origem</h3>
                    <span className="text-[var(--crm-ink)] font-medium">{selectedOpportunity.source}</span>
                  </div>
                )}

                {(selectedOpportunity.negotiationType || selectedOpportunity.leadSourceDetail || selectedOpportunity.projectClassification || selectedOpportunity.projectTower || selectedOpportunity.projectDetail || selectedOpportunity.manufacturer) && (
                  <div className="crm-panel-muted rounded-xl p-4 md:col-span-2">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[rgb(var(--crm-muted-rgb)_/_0.9)] mb-3">Dados Comerciais B2B</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      {[
                        ['Tipo de negociação', selectedOpportunity.negotiationType],
                        ['Entrada/Origem', selectedOpportunity.leadSourceDetail],
                        ['Classificação', selectedOpportunity.projectClassification],
                        ['Torre', selectedOpportunity.projectTower],
                        ['Produto/Serviço', selectedOpportunity.projectDetail],
                        ['Fabricante', selectedOpportunity.manufacturer]
                      ].filter(([, value]) => value).map(([label, value]) => (
                        <div key={label}>
                          <div className="text-xs font-semibold text-[var(--crm-muted)]">{label}</div>
                          <div className="font-medium text-[var(--crm-ink)]">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(selectedOpportunity.contractMonths || selectedOpportunity.monthlyValue || selectedOpportunity.installationFee || selectedOpportunity.licenseCount) && (
                  <div className="crm-panel-muted rounded-xl p-4 md:col-span-2">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[rgb(var(--crm-muted-rgb)_/_0.9)] mb-3">Valores do Contrato</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
                      {selectedOpportunity.contractMonths && <div><div className="text-xs font-semibold text-[var(--crm-muted)]">Meses</div><div className="font-medium text-[var(--crm-ink)]">{selectedOpportunity.contractMonths}</div></div>}
                      {selectedOpportunity.monthlyValue && <div><div className="text-xs font-semibold text-[var(--crm-muted)]">Valor mensal</div><div className="font-medium text-[var(--crm-ink)]">{formatCurrency(selectedOpportunity.monthlyValue)}</div></div>}
                      {selectedOpportunity.installationFee && <div><div className="text-xs font-semibold text-[var(--crm-muted)]">Instalação</div><div className="font-medium text-[var(--crm-ink)]">{formatCurrency(selectedOpportunity.installationFee)}</div></div>}
                      {selectedOpportunity.licenseCount && <div><div className="text-xs font-semibold text-[var(--crm-muted)]">Licenças</div><div className="font-medium text-[var(--crm-ink)]">{selectedOpportunity.licenseCount}</div></div>}
                    </div>
                  </div>
                )}

                {selectedOpportunity.expectedCloseDate && (
                  <div className="crm-panel-muted rounded-xl p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[rgb(var(--crm-muted-rgb)_/_0.9)] mb-2">Data Prevista</h3>
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-[rgb(var(--crm-accent-rgb))] mr-2" />
                      <span className="text-[var(--crm-ink)] font-medium">
                        {new Date(selectedOpportunity.expectedCloseDate).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                )}

                {selectedOpportunity.leadEntryDate && (
                  <div className="crm-panel-muted rounded-xl p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[rgb(var(--crm-muted-rgb)_/_0.9)] mb-2">Data de Entrada do Lead</h3>
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-[rgb(var(--crm-accent-rgb))] mr-2" />
                      <span className="text-[var(--crm-ink)] font-medium">
                        {formatDateBR(selectedOpportunity.leadEntryDate)}
                      </span>
                    </div>
                  </div>
                )}

                {selectedOpportunity.stage === 'WON' && (selectedOpportunity.customerTurnDate || selectedOpportunity.actualCloseDate) && (
                  <div className="crm-panel-muted rounded-xl p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[rgb(var(--crm-muted-rgb)_/_0.9)] mb-2">Data de Virada para Cliente</h3>
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-emerald-300 mr-2" />
                      <span className="text-[var(--crm-ink)] font-medium">
                        {formatDateBR(selectedOpportunity.customerTurnDate || selectedOpportunity.actualCloseDate)}
                      </span>
                    </div>
                  </div>
                )}

                {selectedOpportunity.stage === 'LOST' && (selectedOpportunity.exitDate || selectedOpportunity.actualCloseDate) && (
                  <div className="crm-panel-muted rounded-xl p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[rgb(var(--crm-muted-rgb)_/_0.9)] mb-2">Data de Saída</h3>
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-red-300 mr-2" />
                      <span className="text-[var(--crm-ink)] font-medium">
                        {formatDateBR(selectedOpportunity.exitDate || selectedOpportunity.actualCloseDate)}
                      </span>
                    </div>
                  </div>
                )}

                {selectedOpportunity.actualCloseDate && (
                  <div className="crm-panel-muted rounded-xl p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[rgb(var(--crm-muted-rgb)_/_0.9)] mb-2">Data de Fechamento</h3>
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-[rgb(var(--crm-accent-rgb))] mr-2" />
                      <span className="text-[var(--crm-ink)] font-medium">
                        {new Date(selectedOpportunity.actualCloseDate).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {selectedOpportunity.description && (
              <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.7)] p-5">
                <h3 className="text-lg font-semibold text-[var(--crm-ink)] mb-2">Descrição</h3>
                <p className="text-[var(--crm-muted)] leading-relaxed whitespace-pre-wrap">{selectedOpportunity.description}</p>
              </div>
            )}

            {selectedOpportunity.notes && (
              <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-accent-rgb)_/_0.08)] p-5">
                <h3 className="text-sm font-semibold text-[var(--crm-ink)] mb-2">Acompanhamento</h3>
                <p className="text-[var(--crm-muted)] leading-relaxed whitespace-pre-wrap">{selectedOpportunity.notes}</p>
              </div>
            )}

            {selectedOpportunity.stage === 'LOST' && (
              <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-red-200">Motivo da Perda</h3>
                  <button
                    type="button"
                    onClick={handleSaveLossReason}
                    disabled={lossReasonSaving}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-300/35 bg-red-400/15 px-3 py-1.5 text-xs font-semibold text-red-50 transition hover:bg-red-400/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {lossReasonSaving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
                <textarea
                  className="w-full rounded-lg border border-red-300/35 bg-red-950/25 px-3 py-2 text-sm text-red-50 placeholder:text-red-100/45 focus:outline-none focus:ring-2 focus:ring-red-300/50"
                  rows={3}
                  value={lossReasonDraft}
                  onChange={(event) => setLossReasonDraft(event.target.value)}
                  placeholder="Informe o motivo da perda..."
                />
                {lossReasonError && (
                  <p className="mt-2 text-xs font-medium text-red-100">{lossReasonError}</p>
                )}
              </div>
            )}

            {renderStageDecisionDetails(selectedOpportunity.stageDecisionDetails)}

            {/* ── Contato do Cliente ─────────────────────────────────────── */}
            {(selectedOpportunity.contactName || selectedOpportunity.contactFullName || selectedOpportunity.contactEmail || selectedOpportunity.contactPhone) && (
              <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.65)] p-5">
                <h3 className="text-lg font-semibold text-[var(--crm-ink)] mb-3">Contato do Cliente</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedOpportunity.contactName && (
                    <div className="crm-panel-muted rounded-xl p-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--crm-muted)] mb-1">Contato</div>
                      <div className="text-sm font-medium text-[var(--crm-ink)]">{selectedOpportunity.contactName}</div>
                    </div>
                  )}
                  {selectedOpportunity.contactFullName && (
                    <div className="crm-panel-muted rounded-xl p-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--crm-muted)] mb-1">Nome Completo</div>
                      <div className="text-sm font-medium text-[var(--crm-ink)]">{selectedOpportunity.contactFullName}</div>
                    </div>
                  )}
                  {selectedOpportunity.contactEmail && (
                    <div className="crm-panel-muted rounded-xl p-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--crm-muted)] mb-1">E-mail</div>
                      <a href={`mailto:${selectedOpportunity.contactEmail}`} className="text-sm font-medium text-cyan-400 hover:underline">{selectedOpportunity.contactEmail}</a>
                    </div>
                  )}
                  {selectedOpportunity.contactPhone && (
                    <div className="crm-panel-muted rounded-xl p-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--crm-muted)] mb-1">Telefone</div>
                      <a href={`tel:${selectedOpportunity.contactPhone}`} className="text-sm font-medium text-cyan-400 hover:underline">{selectedOpportunity.contactPhone}</a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Produtos ───────────────────────────────────────────────── */}
            {selectedOpportunity.products && selectedOpportunity.products.length > 0 && (
              <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.65)] p-5">
                <h3 className="text-lg font-semibold text-[var(--crm-ink)] mb-3">Produtos</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[color:var(--crm-border)] text-xs uppercase tracking-wider text-[var(--crm-muted)]">
                        <th className="text-left py-2 pr-4">Produto</th>
                        <th className="text-right py-2 pr-4">Qtd</th>
                        <th className="text-right py-2 pr-4">Preço Unit.</th>
                        <th className="text-right py-2 pr-4">Desc.</th>
                        <th className="text-right py-2">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[color:var(--crm-border)]">
                      {selectedOpportunity.products.map((p) => {
                        const subtotal = Number(p.quantity || 0) * Number(p.unitPrice || 0) * (1 - Number(p.discount || 0) / 100);
                        return (
                          <tr key={p.id} className="text-[var(--crm-ink)]">
                            <td className="py-2.5 pr-4">
                              <div className="font-medium">{p.product?.name || '—'}</div>
                              {p.notes && <div className="text-xs text-[var(--crm-muted)]">{p.notes}</div>}
                            </td>
                            <td className="py-2.5 pr-4 text-right tabular-nums">{p.quantity}</td>
                            <td className="py-2.5 pr-4 text-right tabular-nums">{formatCurrency(p.unitPrice)}</td>
                            <td className="py-2.5 pr-4 text-right tabular-nums">{p.discount > 0 ? `${p.discount}%` : '—'}</td>
                            <td className="py-2.5 text-right tabular-nums font-semibold text-emerald-400">{formatCurrency(subtotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[color:var(--crm-border)]">
                        <td colSpan={4} className="py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-[var(--crm-muted)]">Total</td>
                        <td className="py-2.5 text-right font-bold text-emerald-300">
                          {formatCurrency(selectedOpportunity.products.reduce((sum, p) =>
                            sum + Number(p.quantity || 0) * Number(p.unitPrice || 0) * (1 - Number(p.discount || 0) / 100), 0
                          ))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* ── Reuniões de Kickoff ─────────────────────────────────────── */}
            <KickoffSection 
              opportunityId={selectedOpportunity.id}
              kickoffRoute="/b2b-kickoff"
              onNavigate={() => {
                setShowDetailsModal(false);
                setSelectedOpportunity(null);
              }}
            />

            <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.65)] p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--crm-ink)]">Acompanhamentos</h3>
                  <p className="mt-1 text-sm text-[var(--crm-muted)]">
                    Registre interações, próximos passos e decisões desta oportunidade.
                  </p>
                </div>
                <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl border border-[rgb(var(--crm-accent-rgb)_/_0.25)] bg-[rgb(var(--crm-accent-rgb)_/_0.1)] text-[rgb(var(--crm-accent-rgb))]">
                  <MessageSquare className="h-5 w-5" />
                </div>
              </div>

              <div className="space-y-3">
                {/* Botões de Tipo de Interação */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {[
                    { value: 'NOTE', label: 'Nota', icon: StickyNote },
                    { value: 'CALL', label: 'Ligação', icon: Phone },
                    { value: 'EMAIL', label: 'Email', icon: Mail },
                    { value: 'MEETING', label: 'Reunião', icon: Users },
                    { value: 'WHATSAPP', label: 'WhatsApp', icon: MessageCircle }
                  ].map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFollowUpType(type.value)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        followUpType === type.value
                          ? 'bg-cyan-500 text-white'
                          : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <type.icon className="h-3.5 w-3.5" />
                      {type.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={followUpText}
                  onChange={(event) => {
                    setFollowUpText(event.target.value);
                    if (followUpError) setFollowUpError('');
                  }}
                  placeholder="Ex: contato realizado com o órgão, retorno previsto, pendência documental, decisão do comitê..."
                  className="crm-input min-h-[110px] !px-4 !py-3 text-base"
                  rows={4}
                />

                <div className="rounded-xl border border-dashed border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.45)] p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-sm text-[var(--crm-muted)]">
                      <Paperclip className="h-4 w-4 text-cyan-300" />
                      <span>Prints de conversa do WhatsApp</span>
                    </div>
                    <label className="crm-btn crm-btn-secondary min-h-0 cursor-pointer px-3 py-2 text-xs">
                      <ImagePlus className="h-4 w-4" />
                      Anexar prints
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                        multiple
                        className="hidden"
                        onChange={handleFollowUpPrintsChange}
                      />
                    </label>
                  </div>

                  {followUpPrints.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {followUpPrintPreviews.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="group relative overflow-hidden rounded-xl border border-cyan-300/20 bg-slate-950/35">
                          <img
                            src={file.url}
                            alt={`Print ${index + 1}`}
                            className="h-24 w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeFollowUpPrint(index)}
                            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/85 text-red-200 opacity-90 transition hover:bg-red-500 hover:text-white"
                            title="Remover print"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <div className="truncate px-2 py-1.5 text-[10px] text-slate-300" title={file.name}>
                            {file.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {followUpError && (
                  <p className="text-sm font-semibold text-red-300">{followUpError}</p>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddOpportunityFollowUp}
                    disabled={followUpSubmitting || (!followUpText.trim() && followUpPrints.length === 0)}
                    className="crm-btn min-w-[190px] text-white border border-cyan-300/45 bg-[linear-gradient(135deg,#2563eb_0%,#0891b2_100%)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    {followUpSubmitting ? 'Salvando...' : 'Salvar acompanhamento'}
                  </button>
                </div>
              </div>

              <div className="mt-5 border-t border-[color:var(--crm-border)] pt-5">
                {loadingFollowUps ? (
                  <div className="rounded-xl border border-dashed border-[color:var(--crm-border)] p-5 text-center text-sm text-[var(--crm-muted)]">
                    Carregando acompanhamentos...
                  </div>
                ) : followUps && followUps.length > 0 ? (
                <div className="space-y-3">
                  {followUps.map(followUp => {
                    const attachments = parseFollowUpAttachments(followUp.attachments);
                    const typeIcons = {
                      NOTE: StickyNote,
                      CALL: Phone,
                      EMAIL: Mail,
                      MEETING: Users,
                      WHATSAPP: MessageCircle
                    };
                    const TypeIcon = typeIcons[followUp.type] || StickyNote;
                    const typeLabels = {
                      NOTE: 'Nota',
                      CALL: 'Ligação',
                      EMAIL: 'Email',
                      MEETING: 'Reunião',
                      WHATSAPP: 'WhatsApp'
                    };
                    
                    return (
                      <div key={followUp.id} className="crm-panel-muted rounded-xl p-3 relative group">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
                              <TypeIcon className="h-4 w-4" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-cyan-400">
                                {typeLabels[followUp.type] || followUp.type}
                              </span>
                              <span className="text-xs text-[var(--crm-muted)]">•</span>
                              <span className="text-xs text-[var(--crm-muted)]">
                                {followUp.user?.name}
                              </span>
                              <span className="text-xs text-[var(--crm-muted)]">•</span>
                              <span className="text-xs text-[var(--crm-muted)]">
                                {new Date(followUp.createdAt).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <div className="text-sm text-[var(--crm-ink)] whitespace-pre-wrap">
                              {followUp.content}
                            </div>
                            {attachments.length > 0 && (
                              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                                {attachments.map((attachment, index) => {
                                  const imageUrl = resolveUploadUrl(attachment.url);
                                  return (
                                    <a
                                      key={`${attachment.url || attachment.filename || index}`}
                                      href={imageUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="group/print overflow-hidden rounded-xl border border-cyan-300/20 bg-slate-950/40 transition hover:border-cyan-300/55"
                                      title={attachment.name || `Print ${index + 1}`}
                                    >
                                      <img
                                        src={imageUrl}
                                        alt={attachment.name || `Print de WhatsApp ${index + 1}`}
                                        className="h-28 w-full object-cover transition duration-200 group-hover/print:scale-[1.03]"
                                      />
                                      <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-medium text-slate-300">
                                        <ImagePlus className="h-3 w-3 text-cyan-300" />
                                        <span className="truncate">{attachment.name || `Print ${index + 1}`}</span>
                                      </div>
                                    </a>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          {(isAdmin || followUp.userId === userId) && (
                            <button
                              onClick={() => handleDeleteFollowUp(followUp.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-red-400 hover:text-red-300"
                              title="Remover acompanhamento"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[color:var(--crm-border)] p-5 text-center text-sm text-[var(--crm-muted)]">
                    Nenhum acompanhamento registrado nesta oportunidade.
                  </div>
                )}
              </div>
            </div>

            {/* ─── Pontos de Atenção ─────────────────────────────────────────── */}
            <OpportunityAttentionPoints
              opportunityId={selectedOpportunity.id}
              currentUserId={userId}
              isAdmin={isAdmin}
            />

            {/* ─── Aprendizados ──────────────────────────────────────────────── */}
            <OpportunityLearnings
              opportunityId={selectedOpportunity.id}
              currentUserId={userId}
              isAdmin={isAdmin}
            />

            <div className={modalActionsClass}>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedOpportunity(null);
                }}
                className={modalCancelButtonClass}
              >
                Fechar
              </button>

              <button
                type="button"
                onClick={(event) => handleEdit(selectedOpportunity, event)}
                className={modalSubmitButtonClass}
              >
                <Edit className="w-4 h-4" />
                Editar Oportunidade
              </button>
            </div>
          </div>
        </Modal>
      )}

      <CloseOpportunityModal
        isOpen={Boolean(pendingCloseOpportunity)}
        onClose={() => setPendingCloseOpportunity(null)}
        onConfirm={handleConfirmCloseOpportunity}
        type={pendingCloseOpportunity?.stage || 'WON'}
        clientType={pipelineClientType}
        opportunity={pendingCloseOpportunity?.opportunity || null}
        opportunityTitle={
          pendingCloseOpportunity?.opportunity
            ? `${pendingCloseOpportunity.opportunity.company?.name || 'Cliente'} - ${pendingCloseOpportunity.opportunity.projectName || pendingCloseOpportunity.opportunity.title || 'Oportunidade'}`
            : ''
        }
      />

      <B2BTestFlowModal
        isOpen={isTestModalOpen}
        onClose={() => {
          setIsTestModalOpen(false);
          loadOpportunities();
        }}
      />
    </div>
  );
}
