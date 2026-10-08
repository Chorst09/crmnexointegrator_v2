import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { buildApiUrl, API_ENDPOINTS } from '../config/api';
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
  Rocket
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
  RENEWAL: "Renovação"
};

const projectTypeLabels = {
  SINGLE: "Projeto pontual",
  MONTHLY: "Projeto mensal"
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
  const [pendingCloseOpportunity, setPendingCloseOpportunity] = useState(null);
  const [followUpText, setFollowUpText] = useState('');
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);
  const [followUpError, setFollowUpError] = useState('');
  const [followUpType, setFollowUpType] = useState('NOTE'); // NOTE, CALL, EMAIL, MEETING, WHATSAPP
  const [followUps, setFollowUps] = useState([]);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);
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
    projectClientType: 'NEW_CLIENT',
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
    const shouldOpen = searchParams.get('newOpportunity') === '1';
    if (!shouldOpen) return;
    const companyId = searchParams.get('companyId') || '';
    const key = `${companyId || 'none'}:${pipelineClientType}`;
    if (lastCompanyReturnKey.current === key) return;

    lastCompanyReturnKey.current = key;
    setSelectedOpportunity(null);
    setFormData(createEmptyFormData({
      projectClientType: companyId ? 'BASE_CLIENT' : '',
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
          projectClientType: opp.projectClientType || 'NEW_CLIENT',
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
          companyId: opp.companyId,
          ownerId: opp.ownerId
        });
        setShowDetailsModal(false);
        setShowModal(true);
      } else {
        setSelectedOpportunity(opp);
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
    if (pipelineClientType === 'B2B' && payloadFormData.projectClientType === 'NEW_CLIENT' && !payloadFormData.companyId) {
      alert('Cadastre a empresa antes de criar uma oportunidade para cliente novo.');
      navigate('/empresas?openForm=1&returnTo=/oportunidades%3FnewOpportunity%3D1');
      return;
    }
    if (pipelineClientType === 'B2B' && ['BASE_CLIENT', 'RENEWAL'].includes(payloadFormData.projectClientType) && !payloadFormData.companyId) {
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
        projectClientType: payloadFormData.projectClientType || null,
        negotiationType: payloadFormData.negotiationType || null,
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
              errMsg = errData.error || errData.message || errText;
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

  const handleEdit = (opportunity) => {
    setSelectedOpportunity(opportunity);
    setFormData({
      title: opportunity.title,
      projectName: opportunity.projectName || opportunity.title || '',
      projectClientType: opportunity.projectClientType || 'NEW_CLIENT',
      negotiationType: opportunity.negotiationType || '',
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
    setFollowUpText('');
    setFollowUpError('');
    setFollowUpType('NOTE');
    setShowDetailsModal(true);
    
    // Carregar follow-ups
    await fetchFollowUps(opportunity.id);
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
    if (!selectedOpportunity?.id || !description) {
      setFollowUpError('Informe o acompanhamento antes de salvar.');
      return;
    }

    setFollowUpSubmitting(true);
    setFollowUpError('');

    try {
      const response = await fetch(buildApiUrl('/opportunity-followups'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          opportunityId: selectedOpportunity.id,
          type: followUpType,
          content: description
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || errorData?.message || 'Erro ao salvar acompanhamento.');
      }

      const createdFollowUp = await response.json();
      setFollowUps([createdFollowUp, ...followUps]);
      setFollowUpText('');
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

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
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
    const term = (searchTerm || '').trim().toLowerCase();
    const title = String(opp.title || opp.TITLE || '').toLowerCase();
    const projectName = String(opp.projectName || opp.PROJECTNAME || '').toLowerCase();
    const companyName = String(opp.company?.name || opp.company?.NAME || '').toLowerCase();
    const ownerName = String(opp.owner?.name || opp.owner?.NAME || '').toLowerCase();
    const matchesSearch = !term || title.includes(term) || projectName.includes(term) || companyName.includes(term) || ownerName.includes(term);
    const stage = opp.stage || opp.STAGE;
    const matchesStage = !stageFilter || stage === stageFilter;
    const oppOwnerId = opp.ownerId || opp.OWNERID || opp.owner?.id || opp.owner?.ID;
    const matchesSeller = !sellerFilter || oppOwnerId === sellerFilter;
    return matchesSearch && matchesStage && matchesSeller;
  }) : [];

  const filteredStats = buildStats(filteredOpportunities);

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnimatedStats
          title="Total de Oportunidades"
          value={filteredStats.total}
          subtitle="Todas as oportunidades"
          icon={Target}
          color="blue"
          trend={{ direction: 'up', value: '+12% este mês' }}
        />
        
        <AnimatedStats
          title="Valor Total"
          value={formatCurrency(filteredStats.totalValue)}
          subtitle="Oportunidades abertas e históricas"
          icon={DollarSign}
          color="green"
          trend={{ direction: 'up', value: '+18% este mês' }}
        />
        
        <AnimatedStats
          title="Taxa de Conversão"
          value={`${filteredStats.conversionRate.toFixed(1)}%`}
          subtitle={`${filteredStats.won} oportunidades ganhas`}
          icon={TrendingUp}
          color="purple"
          trend={{ direction: 'up', value: '+2.3% este mês' }}
        />
        
        <AnimatedStats
          title="Ticket Médio"
          value={formatCurrency(filteredStats.avgValue)}
          subtitle="Valor médio por oportunidade"
          icon={BarChart3}
          color="orange"
          trend={{ direction: 'up', value: '+8.5% este mês' }}
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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--crm-muted)] w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar oportunidades..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="crm-input pl-10"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--crm-muted)]" />
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="crm-input w-auto min-w-[220px]"
            >
              <option value="">Todas as etapas</option>
              {stages.map(stage => (
                <option key={stage} value={stage}>{stageLabels[stage]}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--crm-muted)]" />
            <select
              value={sellerFilter}
              onChange={(e) => setSellerFilter(e.target.value)}
              className="crm-input w-auto min-w-[220px]"
            >
              <option value="">Todos os vendedores</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Kanban de oportunidades */}
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
                          onClick={(e) => { e.stopPropagation(); handleEdit(opp); }}
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
                        {opp.projectClientType && (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--crm-muted)]">
                            <BarChart3 className="w-3 h-3 shrink-0" />
                            <span>{projectClientTypeLabels[opp.projectClientType] || opp.projectClientType}</span>
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
                        ['Detalhe', selectedOpportunity.projectDetail],
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

            {selectedOpportunity.lossReason && (
              <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4">
                <h3 className="text-sm font-semibold text-red-200 mb-2">Motivo da Perda</h3>
                <p className="text-red-100/90">{selectedOpportunity.lossReason}</p>
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

                {followUpError && (
                  <p className="text-sm font-semibold text-red-300">{followUpError}</p>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddOpportunityFollowUp}
                    disabled={followUpSubmitting || !followUpText.trim()}
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
                onClick={() => {
                  handleEdit(selectedOpportunity);
                  setShowDetailsModal(false);
                }}
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
