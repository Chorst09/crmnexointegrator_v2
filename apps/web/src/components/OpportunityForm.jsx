import SellerProfile from './SellerProfile';
import { normalizeNegotiationType, projectClientTypeFromNegotiation } from '../utils/opportunity-negotiation.mjs';
import { useState, useEffect, useMemo, useRef } from 'react';

const TABS = [
  { id: 'identificacao', label: 'Identificação' },
  { id: 'financeiro',    label: 'Financeiro' },
  { id: 'prazos',        label: 'Prazos' },
  { id: 'estrategia',    label: 'Estratégia' },
  { id: 'documentos',    label: 'Documentos' },
  { id: 'risco',         label: 'Risco' },
];

const CHECKLIST_DOCS = [
  { key: 'sicafAtualizado',      label: 'SICAF atualizado' },
  { key: 'certidaoFederal',      label: 'Certidão Federal' },
  { key: 'certidaoEstadual',     label: 'Certidão Estadual' },
  { key: 'certidaoMunicipal',    label: 'Certidão Municipal' },
  { key: 'fgts',                 label: 'FGTS' },
  { key: 'cndt',                 label: 'CNDT' },
  { key: 'balancoPatrimonial',   label: 'Balanço Patrimonial' },
];

const FASE_OPTIONS = [
  { value: 'monitorando',           label: 'Monitorando' },
  { value: 'analise',               label: 'Análise em andamento' },
  { value: 'analise_concluida',     label: 'Análise concluída' },
  { value: 'proposta_preparacao',   label: 'Proposta em preparação' },
  { value: 'proposta_enviada',      label: 'Proposta enviada' },
  { value: 'suspensa',              label: 'Suspensa' },
  { value: 'encerrada',             label: 'Encerrada' },
];

const PROJECT_MONTH_OPTIONS = [12, 24, 36, 48, 60];
const NEGOTIATION_TYPE_OPTIONS = ['Cliente Novo', 'Cliente da Base', 'Renovações', 'Up Selling'];
const LEAD_SOURCE_DETAIL_OPTIONS = ['SDR', 'Gerente de Contas', 'Pré-Vendas'];
const PROJECT_CLASSIFICATION_OPTIONS = ['Produto', 'Serviço'];
const PROJECT_TOWER_OPTIONS = ['Conectividade', 'Datacenter', 'Equipamentos', 'Infraestrutura', 'Suporte', 'Telefonia'];
const OTHER_OPTION_VALUE = '__OTHER__';


const DEFAULT_B2G = {
  numeroEdital: '', uasgId: '', orgaoEntidade: '', esfera: 'Municipal',
  ufCidade: '', modalidade: '', tipo: 'Eletrônico', portal: '',
  portalRegistroOp: '', fabricanteStatus: '', objetoResumido: '',
  objetoDetalhado: '', itemCodigo: '', categoria: 'Geral',
  valorEstimadoMensal: 0, valorEstimadoTotal: 0, valorEstimadoPontual: 0,
  valorMaxAceitavel: 0, margemEstimada: 0, ticketEsperado: 0,
  tipoContrato: 'Outro', prazoContratual: 0, garantia: 0, possuiReajuste: false,
  dataPublicacao: '', dataAbertura: '', prazoImpugnacao: '',
  envioPropostas: '', validadeEstimada: '', faseAtual: 'analise',
  responsavelComercial: '', responsavelTecnico: '', parceiro: '',
  fabricante: '', nivelConcorrencia: 'Médio', probabilidadeGanho: 50,
  decisao: 'GO', principaisConcorrentes: '', descricaoEstrategia: '',
  linkBriefing: '', linkAnexos: '',
  sicafAtualizado: false, certidaoFederal: false, certidaoEstadual: false,
  certidaoMunicipal: false, fgts: false, cndt: false, balancoPatrimonial: false,
  checklistCompleto: false, exigeAmostras: false, visitaTecnicaObrigatoria: false,
  checklistDocumentacao: [],
  tipoJulgamento: 'Menor Preço', grauRisco: 'Médio', exigenciasRestritivas: false,
  penalidades: '', observacoesJuridicas: '', riscos: []
};

const toNumberOr = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseB2GDescription = (value) => {
  const text = String(value || '').trim();
  if (!text || !text.startsWith('{')) return null;

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const resolveB2GTotalValue = (financialData, fallback = 0) => {
  const mensal = toNumberOr(financialData?.valorEstimadoMensal, 0);
  const prazo = toNumberOr(financialData?.prazoContratual, 0);

  if (mensal > 0 && prazo > 0) {
    return mensal * prazo;
  }

  const total = toNumberOr(financialData?.valorEstimadoTotal, 0);
  if (total > 0) {
    return total;
  }

  const pontual = toNumberOr(financialData?.valorEstimadoPontual, 0);
  if (pontual > 0) {
    return pontual;
  }

  return fallback;
};

export default function OpportunityForm({
  formData,
  setFormData,
  selectedOpportunity,
  companies,
  users,
  products: availableProducts,
  stages,
  stageLabels,
  modalInputClass,
  modalLabelClass,
  modalContainerClass,
  modalActionsClass,
  modalCancelButtonClass,
  modalSubmitButtonClass,
  onCancel,
  onSubmit,
  onCreateCompany,
  onRefreshCompanies,
}) {
  const [activeTab, setActiveTab] = useState('identificacao');
  const [b2gForm, setB2gForm] = useState(() => ({ ...DEFAULT_B2G }));
  const [customSelectFields, setCustomSelectFields] = useState({});

  // Busca de empresa no formulário B2B
  const [companySearch, setCompanySearch] = useState('');
  const companySearchRef = useRef(null);

  // Produtos selecionados (lista dinâmica)
  const [productItems, setProductItems] = useState(() => {
    const existing = selectedOpportunity?.products || formData?.products || [];
    return existing.filter(Boolean).map(p => ({
      _key: p.id || String(Math.random()),
      productId: p.productId || p.product?.id || '',
      quantity: p.quantity || 1,
      unitPrice: p.unitPrice || 0,
      discount: p.discount || 0,
      notes: p.notes || ''
    }));
  });

  // Sincronizar productItems → formData.products
  useEffect(() => {
    setFormData(prev => ({ ...prev, products: productItems }));
  }, [productItems]);

  // Máscara de telefone: (00) 00000-0000
  const applyPhoneMask = (value) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : '';
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const addProductItem = () => {
    setProductItems(prev => [...prev, { _key: String(Date.now()), productId: '', quantity: 1, unitPrice: 0, discount: 0, notes: '' }]);
  };

  const removeProductItem = (key) => {
    setProductItems(prev => prev.filter(p => p._key !== key));
  };

  const updateProductItem = (key, field, value) => {
    setProductItems(prev => prev.map(p => p._key === key ? { ...p, [field]: value } : p));
  };

  const parsedB2GDescription = useMemo(
    () => parseB2GDescription(selectedOpportunity?.description),
    [selectedOpportunity?.description]
  );
  const isB2G = Boolean(selectedOpportunity?.b2gStage || parsedB2GDescription);
  const isAutoCalculatedTotal = b2gForm.valorEstimadoMensal > 0 && b2gForm.prazoContratual > 0;

  useEffect(() => {
    if (!isB2G) return;

    const merged = { ...DEFAULT_B2G, ...(parsedB2GDescription || {}) };
    const fallbackOpportunityValue = toNumberOr(
      selectedOpportunity?.value,
      toNumberOr(formData.value, 0)
    );
    const fallbackProbability = toNumberOr(
      selectedOpportunity?.probability,
      toNumberOr(formData.probability, 50)
    );
    const valorEstimadoMensal = toNumberOr(merged.valorEstimadoMensal, 0);
    const prazoContratual = toNumberOr(merged.prazoContratual, 0);
    const valorEstimadoPontual = toNumberOr(merged.valorEstimadoPontual, 0);
    const valorEstimadoTotal = resolveB2GTotalValue(
      {
        ...merged,
        valorEstimadoTotal: toNumberOr(merged.valorEstimadoTotal, fallbackOpportunityValue)
      },
      fallbackOpportunityValue
    );
    const tipoContrato = (() => {
      if (merged.tipoContrato && merged.tipoContrato !== DEFAULT_B2G.tipoContrato) {
        return merged.tipoContrato;
      }

      if (valorEstimadoMensal > 0 && prazoContratual > 0) {
        return 'Mensal';
      }

      if (valorEstimadoPontual > 0) {
        return 'Pontual';
      }

      return merged.tipoContrato || DEFAULT_B2G.tipoContrato;
    })();

    setB2gForm({
      ...DEFAULT_B2G,
      ...merged,
      numeroEdital: merged.numeroEdital || formData.title || selectedOpportunity?.title || '',
      uasgId: merged.uasgId || '',
      orgaoEntidade: selectedOpportunity?.company?.name || merged.orgaoEntidade || '',
      esfera: merged.esfera || 'Municipal',
      ufCidade: merged.ufCidade || '',
      modalidade: merged.modalidade || '',
      tipo: merged.tipo || 'Eletrônico',
      portal: merged.portal || '',
      portalRegistroOp: merged.portalRegistroOp || '',
      fabricanteStatus: merged.fabricanteStatus || '',
      objetoResumido: merged.objetoResumido || '',
      objetoDetalhado: merged.objetoDetalhado || '',
      itemCodigo: merged.itemCodigo || '',
      categoria: merged.categoria || 'Geral',
      valorEstimadoMensal,
      valorEstimadoTotal,
      valorEstimadoPontual,
      valorMaxAceitavel: toNumberOr(merged.valorMaxAceitavel, 0),
      margemEstimada: toNumberOr(merged.margemEstimada, 0),
      ticketEsperado: toNumberOr(merged.ticketEsperado, 0),
      tipoContrato,
      prazoContratual,
      garantia: toNumberOr(merged.garantia, 0),
      possuiReajuste: Boolean(merged.possuiReajuste),
      dataPublicacao: merged.dataPublicacao || '',
      dataAbertura: merged.dataAbertura || '',
      prazoImpugnacao: merged.prazoImpugnacao || '',
      envioPropostas: merged.envioPropostas || formData.expectedCloseDate || selectedOpportunity?.expectedCloseDate?.split('T')[0] || '',
      validadeEstimada: merged.validadeEstimada || '',
      faseAtual: merged.faseAtual || 'analise',
      responsavelComercial: merged.responsavelComercial || '',
      responsavelTecnico: merged.responsavelTecnico || '',
      parceiro: merged.parceiro || '',
      fabricante: merged.fabricante || '',
      nivelConcorrencia: merged.nivelConcorrencia || 'Médio',
      probabilidadeGanho: toNumberOr(merged.probabilidadeGanho, fallbackProbability),
      decisao: merged.decisao || 'GO',
      principaisConcorrentes: merged.principaisConcorrentes || '',
      descricaoEstrategia: merged.descricaoEstrategia || '',
      ownerEmail: merged.ownerEmail || '',
      ownerPhone: merged.ownerPhone || '',
      linkBriefing: merged.linkBriefing || '',
      linkAnexos: merged.linkAnexos || '',
      sicafAtualizado: Boolean(merged.sicafAtualizado),
      certidaoFederal: Boolean(merged.certidaoFederal),
      certidaoEstadual: Boolean(merged.certidaoEstadual),
      certidaoMunicipal: Boolean(merged.certidaoMunicipal),
      fgts: Boolean(merged.fgts),
      cndt: Boolean(merged.cndt),
      balancoPatrimonial: Boolean(merged.balancoPatrimonial),
      checklistCompleto: Boolean(merged.checklistCompleto),
      exigeAmostras: Boolean(merged.exigeAmostras),
      visitaTecnicaObrigatoria: Boolean(merged.visitaTecnicaObrigatoria),
      checklistDocumentacao: Array.isArray(merged.checklistDocumentacao) ? merged.checklistDocumentacao : [],
      tipoJulgamento: merged.tipoJulgamento || 'Menor Preço',
      grauRisco: merged.grauRisco || 'Médio',
      exigenciasRestritivas: Boolean(merged.exigenciasRestritivas),
      penalidades: merged.penalidades || '',
      observacoesJuridicas: Array.isArray(merged.riscos)
        ? merged.riscos.join('\n')
        : (merged.observacoesJuridicas || ''),
      riscos: Array.isArray(merged.riscos) ? merged.riscos : []
    });
  }, [
    isB2G,
    formData.expectedCloseDate,
    formData.probability,
    formData.title,
    formData.value,
    parsedB2GDescription,
    selectedOpportunity?.company?.name,
    selectedOpportunity?.expectedCloseDate,
    selectedOpportunity?.probability,
    selectedOpportunity?.title,
    selectedOpportunity?.value
  ]);

  const [sessionUserId] = useState(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.id || user.userId || '';
    } catch { return ''; }
  });
  const seller = (users || []).find(user => user.id === formData.ownerId) ||
    (selectedOpportunity?.owner?.id === formData.ownerId ? selectedOpportunity.owner : null);

  useEffect(() => {
    if (!selectedOpportunity && !formData.ownerId && (users || []).some(user => user.id === sessionUserId)) {
      setFormData(previous => ({ ...previous, ownerId: sessionUserId }));
    }
  }, [selectedOpportunity, formData.ownerId, users, sessionUserId, setFormData]);

  useEffect(() => {
    if (!seller) return;
    setFormData(previous => previous.ownerEmail === (seller.email || '') && previous.ownerPhone === (seller.phone || '')
      ? previous : { ...previous, ownerEmail: seller.email || '', ownerPhone: seller.phone || '' });
  }, [seller, setFormData]);

  const handleSubmitB2G = (e) => {
    e.preventDefault();
    const normalizedB2GForm = {
      ...b2gForm,
      ownerEmail: seller ? seller.email || '' : b2gForm.ownerEmail,
      ownerPhone: seller ? seller.phone || '' : b2gForm.ownerPhone,
      valorEstimadoTotal: resolveB2GTotalValue(b2gForm, toNumberOr(formData.value, 0))
    };
    const updatedDescription = JSON.stringify({
      ...(parsedB2GDescription || {}),
      ...normalizedB2GForm,
      updatedAt: new Date().toISOString()
    });
    const calculatedTotal = normalizedB2GForm.valorEstimadoTotal;
    const mergedValue = Number.isFinite(Number(calculatedTotal)) && Number(calculatedTotal) > 0
      ? calculatedTotal
      : (Number.isFinite(Number(formData.value)) ? formData.value : 0);
    const mergedProbability = Number.isFinite(Number(b2gForm.probabilidadeGanho)) && Number(b2gForm.probabilidadeGanho) > 0
      ? b2gForm.probabilidadeGanho
      : (Number.isFinite(Number(formData.probability)) ? formData.probability : 50);
    const mergedFormData = {
      ...formData,
      description: updatedDescription,
      value: mergedValue,
      probability: mergedProbability,
      orgaoEntidade: b2gForm.orgaoEntidade || null, // Adicionar campo do órgão para processamento
      // envioPropostas pode ser texto livre — só usar se for data ISO válida
      expectedCloseDate: (() => {
        const v = b2gForm.envioPropostas || formData.expectedCloseDate || '';
        if (!v) return '';
        const d = new Date(v);
        return isNaN(d.getTime()) ? (formData.expectedCloseDate || '') : v;
      })()
    };
    const syntheticEvent = { ...e, preventDefault: () => {} };
    setB2gForm(normalizedB2GForm);
    setFormData(mergedFormData);
    onSubmit(syntheticEvent, mergedFormData);
  };

  const setB2g = (field, value) => setB2gForm(prev => ({ ...prev, [field]: value }));
  const negotiationType = normalizeNegotiationType(formData.negotiationType || formData.projectClientType || '');
  const projectClientType = projectClientTypeFromNegotiation(negotiationType);
  const shouldSelectExistingCompany = projectClientType === 'BASE_CLIENT' || projectClientType === 'RENEWAL';
  const shouldCreateCompanyFirst = projectClientType === 'NEW_CLIENT' && !selectedOpportunity;
  const handleNegotiationTypeChange = (value) => {
    const normalizedValue = normalizeNegotiationType(value);
    const nextProjectClientType = projectClientTypeFromNegotiation(normalizedValue);
    setFormData((prev) => ({
      ...prev,
      negotiationType: normalizedValue,
      projectClientType: nextProjectClientType || null,
      companyId: nextProjectClientType === 'NEW_CLIENT' ? '' : prev.companyId
    }));
    if (nextProjectClientType === 'BASE_CLIENT' || nextProjectClientType === 'RENEWAL') {
      // Carrega todas as empresas cadastradas para qualquer tipo de cliente
      onRefreshCompanies?.({ onlyWithContracts: false });
    }
    // Removido: não navega mais automaticamente para cadastro de empresa ao selecionar "Cliente Novo"
    // O usuário deve buscar primeiro; só se não encontrar deve cadastrar.
  };

  const renderSelectWithOther = ({ label, value, options, onChange, placeholder = 'Selecione...', required = false }) => {
    const currentValue = String(value || '');
    const usesOther = currentValue && !options.includes(currentValue);
    const isCustomEntry = Boolean(customSelectFields[label]) || usesOther;

    return (
      <div>
        <label className={labelCls}>{label}</label>
        <select
          className={inputCls}
          value={isCustomEntry ? OTHER_OPTION_VALUE : currentValue}
          onChange={e => {
            if (e.target.value === OTHER_OPTION_VALUE) {
              setCustomSelectFields(prev => ({ ...prev, [label]: true }));
              onChange('');
              return;
            }
            setCustomSelectFields(prev => ({ ...prev, [label]: false }));
            onChange(e.target.value);
          }}
          required={required && !isCustomEntry}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
          <option value={OTHER_OPTION_VALUE}>Outro / Digitar</option>
        </select>
        {isCustomEntry ? (
          <input
            className={`${inputCls} mt-2`}
            value={usesOther ? currentValue : ''}
            onChange={e => onChange(e.target.value)}
            placeholder="Digite..."
            required={required}
          />
        ) : null}
      </div>
    );
  };

  const inputCls = modalInputClass || 'w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] text-[var(--crm-text)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = modalLabelClass || 'text-xs font-medium text-[var(--crm-muted)] mb-1 block';
  const sectionCls = 'bg-[var(--crm-surface)] border border-[var(--crm-border)] rounded-xl p-5 mb-4';
  const gridCls = 'grid grid-cols-1 sm:grid-cols-2 gap-4';

  // ── Simple B2B form ──────────────────────────────────────────────────────────
  if (!isB2G) {
    return (
      <form onSubmit={e => {
        const monthly = formData.revenueType === 'MENSAL';
        const months = Number(formData.contractPeriodMonths || 12);
        const installment = Number(formData.monthlyRecurringValue || 0);
        const products = Number(formData.totalProductsValue || 0);
        const setup = Number(formData.setupValue || 0);
        onSubmit(e, { ...formData,
          projectType: monthly ? 'MONTHLY' : 'SINGLE',
          projectMonths: monthly ? months : null,
          contractMonths: monthly ? months : null,
          monthlyValue: monthly ? installment : null,
          installationFee: monthly ? null : setup,
          totalContractValue: monthly ? Math.round(installment * months * 100) / 100 : null,
          value: monthly ? Math.round(installment * months * 100) / 100 : products
        });
      }} className={modalContainerClass}>
        <div className={gridCls}>
          <div className="sm:col-span-2">
            <label className={labelCls}>Título</label>
            <input className={inputCls} value={formData.title || ''} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} required />
          </div>

          <div>
            <label className={labelCls}>Nome no Projeto</label>
            <input className={inputCls} value={formData.projectName || ''} onChange={e => setFormData(p => ({ ...p, projectName: e.target.value }))} />
          </div>

          <div className="sm:col-span-2">
            <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4">
              <h3 className="mb-3 text-sm font-semibold text-[var(--crm-text)]">Dados Comerciais B2B</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {renderSelectWithOther({
                  label: 'Tipo de Negociação',
                  value: negotiationType,
                  options: NEGOTIATION_TYPE_OPTIONS,
                  onChange: handleNegotiationTypeChange,
                  required: true
                })}
                {renderSelectWithOther({
                  label: 'Entrada/Origem',
                  value: formData.leadSourceDetail || '',
                  options: LEAD_SOURCE_DETAIL_OPTIONS,
                  onChange: value => setFormData(p => ({ ...p, leadSourceDetail: value }))
                })}
                {renderSelectWithOther({
                  label: 'Classificação',
                  value: formData.projectClassification || '',
                  options: PROJECT_CLASSIFICATION_OPTIONS,
                  onChange: value => setFormData(p => ({ ...p, projectClassification: value }))
                })}
                {renderSelectWithOther({
                  label: 'Torre',
                  value: formData.projectTower || '',
                  options: PROJECT_TOWER_OPTIONS,
                  onChange: value => setFormData(p => ({ ...p, projectTower: value }))
                })}
                <div>
                  <label className={labelCls}>Produto/Serviço</label>
                  <input className={inputCls} value={formData.projectDetail || ''} onChange={e => setFormData(p => ({ ...p, projectDetail: e.target.value }))} placeholder="Rádio, Double..." />
                </div>
                <div>
                  <label className={labelCls}>Fabricante</label>
                  <input className={inputCls} value={formData.manufacturer || ''} onChange={e => setFormData(p => ({ ...p, manufacturer: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Licenças</label>
                  <input type="number" min={0} className={inputCls} value={formData.licenseCount || ''} onChange={e => setFormData(p => ({ ...p, licenseCount: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>

          {(shouldSelectExistingCompany || shouldCreateCompanyFirst) && (
            <div className="sm:col-span-2">
              <label className={labelCls}>
                {shouldCreateCompanyFirst ? 'Empresa do cliente' : 'Cliente'}
              </label>

              {/* Empresa já selecionada — card de confirmação */}
              {formData.companyId && !companySearch ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-green-400/40 bg-green-400/10 px-3 py-2">
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-[var(--crm-ink)] truncate">
                      {(companies || []).find(c => c.id === formData.companyId)?.name || 'Empresa selecionada'}
                    </span>
                    {(companies || []).find(c => c.id === formData.companyId)?.document && (
                      <span className="ml-2 text-xs text-[var(--crm-muted)]">
                        {(companies || []).find(c => c.id === formData.companyId)?.document}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="text-xs text-[var(--crm-muted)] hover:text-[var(--crm-ink)] underline whitespace-nowrap"
                    onClick={() => {
                      setFormData(p => ({ ...p, companyId: '' }));
                      setCompanySearch('');
                      setTimeout(() => companySearchRef.current?.focus(), 50);
                    }}
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <>
                  {/* Campo de busca */}
                  <input
                    ref={companySearchRef}
                    type="text"
                    className={inputCls}
                    placeholder={
                      shouldCreateCompanyFirst
                        ? 'Buscar empresa pelo nome ou CNPJ...'
                        : `Buscar entre ${(companies || []).length} empresa(s) cadastrada(s)...`
                    }
                    value={companySearch}
                    onChange={e => setCompanySearch(e.target.value)}
                    autoComplete="off"
                  />

                  {/* Resultados filtrados */}
                  {(() => {
                    const term = companySearch.trim().toLowerCase();
                    if (!term) return null;

                    const filtered = (companies || []).filter(c =>
                      (c.name || '').toLowerCase().includes(term) ||
                      (c.document || '').replace(/\D/g, '').includes(term.replace(/\D/g, ''))
                    );

                    if (filtered.length > 0) {
                      return (
                        <ul className="mt-1 rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] divide-y divide-[var(--crm-border)] max-h-48 overflow-y-auto shadow-md">
                          {filtered.slice(0, 8).map(c => (
                            <li key={c.id}>
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-[rgb(var(--crm-accent-rgb)_/_0.08)] transition-colors"
                                onClick={() => {
                                  setFormData(p => ({ ...p, companyId: c.id }));
                                  setCompanySearch('');
                                }}
                              >
                                <span className="font-medium text-[var(--crm-ink)]">{c.name}</span>
                                {c.document && (
                                  <span className="ml-2 text-xs text-[var(--crm-muted)]">{c.document}</span>
                                )}
                              </button>
                            </li>
                          ))}
                          {filtered.length > 8 && (
                            <li className="px-3 py-1.5 text-xs text-[var(--crm-muted)] text-center">
                              {filtered.length - 8} resultado(s) a mais — refine a busca
                            </li>
                          )}
                        </ul>
                      );
                    }

                    // Nenhum resultado
                    return (
                      <div className="mt-1 rounded-lg border border-amber-400/35 bg-amber-400/10 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[var(--crm-ink)]">
                            Nenhuma empresa encontrada para &ldquo;{companySearch}&rdquo;.
                          </p>
                          <p className="text-xs text-[var(--crm-muted)] mt-0.5">
                            {shouldCreateCompanyFirst
                              ? 'Deseja cadastrar como nova empresa?'
                              : 'Verifique se a empresa já possui contrato cadastrado, ou ajuste a busca.'}
                          </p>
                        </div>
                        {shouldCreateCompanyFirst && (
                          <button type="button" onClick={onCreateCompany} className="crm-btn crm-btn-primary whitespace-nowrap text-sm">
                            + Nova Empresa
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}

              {/* Instrução inicial quando sem busca e sem empresa selecionada */}
              {!formData.companyId && !companySearch && (
                <p className="text-xs text-[var(--crm-muted)] mt-1">
                  {shouldCreateCompanyFirst
                    ? 'Digite o nome ou CNPJ para buscar. Se não encontrar, você poderá cadastrar uma nova empresa.'
                    : 'Digite o nome ou CNPJ para filtrar as empresas cadastradas.'}
                </p>
              )}
            </div>
          )}

          <div className="sm:col-span-2">
            <label className={labelCls}>Descrição</label>
            <textarea className={inputCls} rows={3} value={formData.description || ''} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} />
          </div>

          <div>
            <label className={labelCls}>Probabilidade (%)</label>
            <input type="number" min={0} max={100} className={inputCls} value={formData.probability || ''} onChange={e => setFormData(p => ({ ...p, probability: e.target.value }))} />
          </div>

          {/* Seção de Receitas Recorrentes e Pontuais */}
          <div className="sm:col-span-2 border-t border-[var(--crm-border)] pt-4 mt-2">
            <h3 className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] mb-3">Modelo de Receita</h3>
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="b2b-type">Tipo de Receita</label>
            <select required id="b2b-type"
              className={inputCls} 
              value={formData.revenueType || ''} 
              onChange={e => {
                const newType = e.target.value;
                setFormData(p => ({ 
                  ...p, 
                  revenueType: newType,
                  // Limpar campos ao trocar o tipo
                  contractPeriodMonths: newType === 'MENSAL' ? 12 : '',
                  monthlyRecurringValue: '',
                  totalContractValue: '',
                  totalProductsValue: '',
                  setupValue: ''
                }));
              }}
            >
              <option value="">Selecione o tipo de receita...</option>
              <option value="MENSAL">Projeto mensal</option>
              <option value="PONTUAL">Projeto pontual</option>
            </select>
          </div>

          {formData.revenueType === 'MENSAL' && (
            <>
              <div>
                <label className={labelCls} htmlFor="b2b-period">Período do contrato (meses)</label>
                <select id="b2b-period"
                  className={inputCls}
                  value={formData.contractPeriodMonths || 12}
                  onChange={e => {
                    const months = Number(e.target.value);
                    const monthly = Number(formData.monthlyRecurringValue) || 0;
                    setFormData(p => ({ 
                      ...p, 
                      contractPeriodMonths: months,
                      totalContractValue: monthly * months
                    }));
                  }}
                >
                  <option value="12">12 meses</option>
                  <option value="24">24 meses</option>
                  <option value="36">36 meses</option>
                  <option value="48">48 meses</option>
                  <option value="60">60 meses</option>
                </select>
              </div>

              <div>
                <label className={labelCls} htmlFor="b2b-monthly">Valor mensal (R$)</label>
                <input required id="b2b-monthly"
                  type="number" 
                  min={0} 
                  step="0.01" 
                  className={inputCls} 
                  value={formData.monthlyRecurringValue ?? ''}
                  onChange={e => {
                    const monthly = Number(e.target.value) || 0;
                    const months = Number(formData.contractPeriodMonths) || 12;
                    setFormData(p => ({ 
                      ...p, 
                      monthlyRecurringValue: e.target.value,
                      totalContractValue: monthly * months
                    }));
                  }}
                  placeholder="0,00"
                />
              </div>

              <div>
                <label className={labelCls} htmlFor="b2b-total">Valor total do contrato (R$)</label>
                <input id="b2b-total"
                  type="number" 
                  className={`${inputCls} bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)]`}
                  value={formData.totalContractValue || ''} 
                  readOnly
                  placeholder="Valor mensal × período do contrato"
                />
                <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] mt-1">
                  Calculado automaticamente
                </p>
              </div>
            </>
          )}

          {formData.revenueType === 'PONTUAL' && (
            <>
              <div>
                <label className={labelCls} htmlFor="b2b-products">Valor total dos produtos (R$)</label>
                <input required id="b2b-products"
                  type="number" 
                  min={0} 
                  step="0.01" 
                  className={inputCls} 
                  value={formData.totalProductsValue ?? ''}
                  onChange={e => setFormData(p => ({ ...p, totalProductsValue: e.target.value }))}
                  placeholder="0,00"
                />
              </div>

              <div>
                <label className={labelCls} htmlFor="b2b-setup">Valor do setup (R$)</label>
                <input id="b2b-setup"
                  type="number" 
                  min={0} 
                  step="0.01" 
                  className={inputCls} 
                  value={formData.setupValue ?? ''}
                  onChange={e => setFormData(p => ({ ...p, setupValue: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
            </>
          )}

          {formData.revenueType && (
            <div className="sm:col-span-2 border-t border-[var(--crm-border)] pt-2 mt-2">
            </div>
          )}

          <div>
            <label className={labelCls}>Stage</label>
            <select className={inputCls} value={formData.stage || ''} onChange={e => setFormData(p => ({ ...p, stage: e.target.value }))}>
              <option value="">Selecione...</option>
              {(stages || []).map(s => (
                <option key={s} value={s}>{stageLabels?.[s] || s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Fonte</label>
            <input className={inputCls} value={formData.source || ''} onChange={e => setFormData(p => ({ ...p, source: e.target.value }))} />
          </div>

          <div>
            <label className={labelCls}>Data de Entrada do Lead</label>
            <input type="date" className={inputCls} value={formData.leadEntryDate || ''} onChange={e => setFormData(p => ({ ...p, leadEntryDate: e.target.value }))} />
          </div>

          <div>
            <label className={labelCls}>Data de Fechamento Esperada</label>
            <input type="date" className={inputCls} value={formData.expectedCloseDate || ''} onChange={e => setFormData(p => ({ ...p, expectedCloseDate: e.target.value }))} />
          </div>

          {formData.stage === 'WON' && (
            <div>
              <label className={labelCls}>Data de Virada para Cliente</label>
              <input type="date" className={inputCls} value={formData.customerTurnDate || ''} onChange={e => setFormData(p => ({ ...p, customerTurnDate: e.target.value }))} />
            </div>
          )}

          {formData.stage === 'LOST' && (
            <div>
              <label className={labelCls}>Data de Saída</label>
              <input type="date" className={inputCls} value={formData.exitDate || ''} onChange={e => setFormData(p => ({ ...p, exitDate: e.target.value }))} />
            </div>
          )}

          {formData.stage === 'LOST' && (
            <div className="sm:col-span-2">
              <label className={labelCls}>Motivo da Perda</label>
              <textarea
                className={inputCls}
                rows={3}
                value={formData.lossReason || ''}
                onChange={e => setFormData(p => ({ ...p, lossReason: e.target.value }))}
                placeholder="Informe o motivo da perda..."
              />
            </div>
          )}

          <div>
            <label className={labelCls}>Responsável *</label>
            <select
              className={inputCls}
              value={formData.ownerId || ''}
              onChange={e => setFormData(p => ({ ...p, ownerId: e.target.value }))}
              required
            >
              <option value="">Selecione o responsável...</option>
              {(users || []).filter(Boolean).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <SellerProfile seller={seller} />
          </div>

          <div>
            <label className={labelCls}>Email do Responsável</label>
            <input type="email" className={inputCls} value={seller ? seller.email || '' : formData.ownerEmail || ''} readOnly placeholder="email@empresa.com" />
          </div>

          <div>
            <label className={labelCls}>Telefone do Responsável</label>
            <input type="tel" className={inputCls} value={seller ? seller.phone || '' : formData.ownerPhone || ''} readOnly placeholder="(00) 00000-0000" />
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Acompanhamento</label>
            <textarea className={inputCls} rows={4} value={formData.notes || ''} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} placeholder="Anotações sobre o acompanhamento da oportunidade..." />
          </div>

          {/* ── Contato do Cliente ─────────────────────────────────────────── */}
          <div className="sm:col-span-2">
            <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--crm-text)]">Contato do Cliente</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Contato (apelido/cargo)</label>
                  <input
                    className={inputCls}
                    value={formData.contactName || ''}
                    onChange={e => setFormData(p => ({ ...p, contactName: e.target.value }))}
                    placeholder="Ex: Diretor de TI, João"
                  />
                </div>
                <div>
                  <label className={labelCls}>Nome Completo</label>
                  <input
                    className={inputCls}
                    value={formData.contactFullName || ''}
                    onChange={e => setFormData(p => ({ ...p, contactFullName: e.target.value }))}
                    placeholder="Nome completo do contato"
                  />
                </div>
                <div>
                  <label className={labelCls}>E-mail</label>
                  <input
                    type="email"
                    className={inputCls}
                    value={formData.contactEmail || ''}
                    onChange={e => setFormData(p => ({ ...p, contactEmail: e.target.value }))}
                    placeholder="contato@empresa.com"
                  />
                </div>
                <div>
                  <label className={labelCls}>Telefone</label>
                  <input
                    type="tel"
                    className={inputCls}
                    value={formData.contactPhone || ''}
                    onChange={e => setFormData(p => ({ ...p, contactPhone: applyPhoneMask(e.target.value) }))}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Produtos ──────────────────────────────────────────────────── */}
          <div className="sm:col-span-2">
            <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[var(--crm-text)]">Produtos</h3>
                <button
                  type="button"
                  onClick={addProductItem}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                >
                  + Adicionar Produto
                </button>
              </div>

              {productItems.length === 0 ? (
                <p className="text-xs text-[var(--crm-muted)] py-2">Nenhum produto adicionado. Clique em "Adicionar Produto" para incluir.</p>
              ) : (
                <div className="space-y-2">
                  {productItems.map((item) => {
                    const selectedProduct = (availableProducts || []).find(p => p.id === item.productId);
                    return (
                      <div key={item._key} className="grid grid-cols-12 gap-2 items-start rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface-2,var(--crm-surface))] p-3">
                        {/* Produto */}
                        <div className="col-span-12 sm:col-span-4">
                          <label className={labelCls}>Produto *</label>
                          <select
                            className={inputCls}
                            value={item.productId}
                            onChange={e => {
                              const prod = (availableProducts || []).find(p => p.id === e.target.value);
                              updateProductItem(item._key, 'productId', e.target.value);
                              if (prod?.price) updateProductItem(item._key, 'unitPrice', prod.price);
                            }}
                          >
                            <option value="">Selecione...</option>
                            {(availableProducts || []).filter(Boolean).map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                        {/* Qtd */}
                        <div className="col-span-4 sm:col-span-2">
                          <label className={labelCls}>Qtd</label>
                          <input
                            type="number"
                            min={1}
                            className={inputCls}
                            value={item.quantity}
                            onChange={e => updateProductItem(item._key, 'quantity', e.target.value)}
                          />
                        </div>
                        {/* Preço Unit. */}
                        <div className="col-span-4 sm:col-span-2">
                          <label className={labelCls}>Preço Unit.</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className={inputCls}
                            value={item.unitPrice}
                            onChange={e => updateProductItem(item._key, 'unitPrice', e.target.value)}
                          />
                        </div>
                        {/* Desconto % */}
                        <div className="col-span-4 sm:col-span-2">
                          <label className={labelCls}>Desc. (%)</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="0.1"
                            className={inputCls}
                            value={item.discount}
                            onChange={e => updateProductItem(item._key, 'discount', e.target.value)}
                          />
                        </div>
                        {/* Subtotal + remover */}
                        <div className="col-span-12 sm:col-span-2 flex flex-col justify-between">
                          <label className={labelCls}>Subtotal</label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                Number(item.quantity || 0) * Number(item.unitPrice || 0) * (1 - Number(item.discount || 0) / 100)
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeProductItem(item._key)}
                              className="ml-auto rounded p-1 text-rose-700 dark:text-rose-400 hover:bg-rose-500/15 transition-colors"
                              title="Remover produto"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        {/* Observação */}
                        <div className="col-span-12">
                          <label className={labelCls}>Obs. (opcional)</label>
                          <input
                            className={inputCls}
                            value={item.notes}
                            onChange={e => updateProductItem(item._key, 'notes', e.target.value)}
                            placeholder="Especificações, versão, variante..."
                          />
                        </div>
                      </div>
                    );
                  })}

                  {/* Total Geral */}
                  <div className="flex justify-end pt-1 border-t border-[var(--crm-border)]">
                    <span className="text-sm font-bold text-[var(--crm-ink)]">
                      Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        productItems.reduce((sum, item) =>
                          sum + Number(item.quantity || 0) * Number(item.unitPrice || 0) * (1 - Number(item.discount || 0) / 100), 0
                        )
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={modalActionsClass || 'flex justify-end gap-3 mt-6'}>
          <button type="button" onClick={onCancel} className={modalCancelButtonClass}>Cancelar</button>
          <button type="submit" className={modalSubmitButtonClass} disabled={shouldCreateCompanyFirst}>
            {selectedOpportunity ? 'Salvar Alterações' : 'Criar Oportunidade'}
          </button>
        </div>
      </form>
    );
  }

  // ── B2G tabbed form ──────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmitB2G} className={modalContainerClass}>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[var(--crm-border)] mb-5 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-[var(--crm-muted)] hover:text-[var(--crm-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Identificação ── */}
      {activeTab === 'identificacao' && (
        <div className="space-y-4">
          <div className={sectionCls}>
            <div className={gridCls}>
              <div>
                <label className={labelCls}>Número do Edital / Processo</label>
                <input className={inputCls} value={b2gForm.numeroEdital} onChange={e => setB2g('numeroEdital', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>UASG / ID</label>
                <input className={inputCls} value={b2gForm.uasgId} onChange={e => setB2g('uasgId', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Órgão / Entidade</label>
                <input className={inputCls} value={b2gForm.orgaoEntidade} onChange={e => setB2g('orgaoEntidade', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Nome no Projeto</label>
                <input className={inputCls} value={formData.projectName || ''} onChange={e => setFormData(p => ({ ...p, projectName: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Tipo de Cliente</label>
                <select className={inputCls} value={formData.projectClientType || ''} onChange={e => setFormData(p => ({ ...p, projectClientType: e.target.value }))}>
                  <option value="">Selecione...</option>
                  <option value="Cliente Novo">Cliente Novo</option>
                  <option value="Cliente da Base">Cliente da Base</option>
                  <option value="Renovação">Renovação</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Responsável *</label>
                <select
                  className={inputCls}
                  value={formData.ownerId || ''}
                  onChange={e => setFormData(p => ({ ...p, ownerId: e.target.value }))}
                  required
                >
                  <option value="">Selecione o responsável...</option>
                  {(users || []).filter(Boolean).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <SellerProfile seller={seller} />
              </div>
              <div>
                <label className={labelCls}>Esfera</label>
                <select className={inputCls} value={b2gForm.esfera} onChange={e => setB2g('esfera', e.target.value)}>
                  <option>Federal</option>
                  <option>Estadual</option>
                  <option>Municipal</option>
                  <option>Distrital</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>UF / Cidade</label>
                <input className={inputCls} value={b2gForm.ufCidade} onChange={e => setB2g('ufCidade', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Modalidade</label>
                <input className={inputCls} value={b2gForm.modalidade} onChange={e => setB2g('modalidade', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Tipo</label>
                <select className={inputCls} value={b2gForm.tipo} onChange={e => setB2g('tipo', e.target.value)}>
                  <option>Eletrônico</option>
                  <option>Presencial</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Portal</label>
                <input className={inputCls} value={b2gForm.portal} onChange={e => setB2g('portal', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Portal Registro de OP</label>
                <input className={inputCls} value={b2gForm.portalRegistroOp} onChange={e => setB2g('portalRegistroOp', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Fabricante - Status</label>
                <select className={inputCls} value={b2gForm.fabricanteStatus} onChange={e => setB2g('fabricanteStatus', e.target.value)}>
                  <option value="">Selecione...</option>
                  <option>Registrado</option>
                  <option>Em Registro</option>
                  <option>Não Registrado</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Item / Código</label>
                <input className={inputCls} value={b2gForm.itemCodigo} onChange={e => setB2g('itemCodigo', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Categoria</label>
                <input className={inputCls} value={b2gForm.categoria} onChange={e => setB2g('categoria', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Objeto Resumido</label>
                <textarea className={inputCls} rows={2} value={b2gForm.objetoResumido} onChange={e => setB2g('objetoResumido', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Objeto Detalhado</label>
                <textarea className={inputCls} rows={4} value={b2gForm.objetoDetalhado} onChange={e => setB2g('objetoDetalhado', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Empresa</label>
                <select className={inputCls} value={formData.companyId || ''} onChange={e => setFormData(p => ({ ...p, companyId: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {(companies || []).filter(Boolean).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Responsável</label>
                <select className={inputCls} value={formData.ownerId || ''} onChange={e => setFormData(p => ({ ...p, ownerId: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {(users || []).filter(Boolean).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <SellerProfile seller={seller} />
              </div>
              <div>
                <label className={labelCls}>Email do Responsável</label>
                <input type="email" className={inputCls} value={seller ? seller.email || '' : b2gForm.ownerEmail || ''} readOnly placeholder="email@empresa.com" />
              </div>
              <div>
                <label className={labelCls}>Telefone do Responsável</label>
                <input type="tel" className={inputCls} value={seller ? seller.phone || '' : b2gForm.ownerPhone || ''} readOnly placeholder="(00) 00000-0000" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Financeiro ── */}
      {activeTab === 'financeiro' && (
        <div className={sectionCls}>
          <div className={gridCls}>
            <div>
              <label className={labelCls}>Valor Estimado Mensal (R$)</label>
              <input type="number" min={0} className={inputCls} value={b2gForm.valorEstimadoMensal} onChange={e => {
                const mensal = Number(e.target.value);
                setB2gForm(prev => {
                  const next = { ...prev, valorEstimadoMensal: mensal };
                  return {
                    ...next,
                    valorEstimadoTotal: resolveB2GTotalValue(next, toNumberOr(prev.valorEstimadoTotal, 0))
                  };
                });
              }} />
            </div>
            <div>
              <label className={labelCls}>Valor Estimado Total (R$)</label>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={b2gForm.valorEstimadoTotal}
                onChange={e => setB2g('valorEstimadoTotal', Number(e.target.value))}
                readOnly={isAutoCalculatedTotal}
              />
            </div>
            <div>
              <label className={labelCls}>Valor Estimado Pontual (R$)</label>
              <input type="number" min={0} className={inputCls} value={b2gForm.valorEstimadoPontual} onChange={e => setB2g('valorEstimadoPontual', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelCls}>Valor Máx. Aceitável (R$)</label>
              <input type="number" min={0} className={inputCls} value={b2gForm.valorMaxAceitavel} onChange={e => setB2g('valorMaxAceitavel', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelCls}>Margem Estimada (%)</label>
              <input type="number" min={0} max={100} className={inputCls} value={b2gForm.margemEstimada} onChange={e => setB2g('margemEstimada', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelCls}>Ticket Esperado (R$)</label>
              <input type="number" min={0} className={inputCls} value={b2gForm.ticketEsperado} onChange={e => setB2g('ticketEsperado', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelCls}>Tipo de Contrato</label>
              <select className={inputCls} value={b2gForm.tipoContrato} onChange={e => setB2g('tipoContrato', e.target.value)}>
                <option>Mensal</option>
                <option>Anual</option>
                <option>Pontual</option>
                <option>Outro</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Prazo Contratual (meses)</label>
              <input type="number" min={0} className={inputCls} value={b2gForm.prazoContratual} onChange={e => {
                const prazo = Number(e.target.value);
                setB2gForm(prev => {
                  const next = { ...prev, prazoContratual: prazo };
                  return {
                    ...next,
                    valorEstimadoTotal: resolveB2GTotalValue(next, toNumberOr(prev.valorEstimadoTotal, 0))
                  };
                });
              }} />
            </div>
            <div>
              <label className={labelCls}>Garantia (%)</label>
              <input type="number" min={0} max={100} className={inputCls} value={b2gForm.garantia} onChange={e => setB2g('garantia', Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="possuiReajuste"
                checked={b2gForm.possuiReajuste}
                onChange={e => setB2g('possuiReajuste', e.target.checked)}
                className="w-4 h-4 rounded border-[var(--crm-border)] accent-blue-500"
              />
              <label htmlFor="possuiReajuste" className="text-sm text-[var(--crm-text)]">Possui cláusula de reajuste</label>
            </div>
          </div>
        </div>
      )}

      {/* ── Prazos ── */}
      {activeTab === 'prazos' && (
        <div className={sectionCls}>
          <div className={gridCls}>
            <div>
              <label className={labelCls}>Data de Entrada do Lead</label>
              <input type="date" className={inputCls} value={formData.leadEntryDate || ''} onChange={e => setFormData(p => ({ ...p, leadEntryDate: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Publicação</label>
              <input type="date" className={inputCls} value={b2gForm.dataPublicacao} onChange={e => setB2g('dataPublicacao', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Data de Abertura</label>
              <input type="date" className={inputCls} value={b2gForm.dataAbertura} onChange={e => setB2g('dataAbertura', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Prazo de Impugnação</label>
              <input type="date" className={inputCls} value={b2gForm.prazoImpugnacao} onChange={e => setB2g('prazoImpugnacao', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Envio de Proposta</label>
              <input type="date" className={inputCls} value={b2gForm.envioPropostas} onChange={e => setB2g('envioPropostas', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Validade Estimada</label>
              <input type="date" className={inputCls} value={b2gForm.validadeEstimada} onChange={e => setB2g('validadeEstimada', e.target.value)} />
            </div>
            {formData.stage === 'WON' && (
              <div>
                <label className={labelCls}>Data de Virada para Cliente</label>
                <input type="date" className={inputCls} value={formData.customerTurnDate || ''} onChange={e => setFormData(p => ({ ...p, customerTurnDate: e.target.value }))} />
              </div>
            )}
            {formData.stage === 'LOST' && (
              <div>
                <label className={labelCls}>Data de Saída</label>
                <input type="date" className={inputCls} value={formData.exitDate || ''} onChange={e => setFormData(p => ({ ...p, exitDate: e.target.value }))} />
              </div>
            )}
            <div>
              <label className={labelCls}>Fase Atual</label>
              <select className={inputCls} value={b2gForm.faseAtual} onChange={e => setB2g('faseAtual', e.target.value)}>
                {FASE_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── Estratégia ── */}
      {activeTab === 'estrategia' && (
        <div className={sectionCls}>
          <div className={gridCls}>
            <div>
              <label className={labelCls}>Responsável Comercial</label>
              <input className={inputCls} value={b2gForm.responsavelComercial} onChange={e => setB2g('responsavelComercial', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Responsável Técnico</label>
              <input className={inputCls} value={b2gForm.responsavelTecnico} onChange={e => setB2g('responsavelTecnico', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Parceiro</label>
              <input className={inputCls} value={b2gForm.parceiro} onChange={e => setB2g('parceiro', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Fabricante</label>
              <input className={inputCls} value={b2gForm.fabricante} onChange={e => setB2g('fabricante', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Nível de Concorrência</label>
              <select className={inputCls} value={b2gForm.nivelConcorrencia} onChange={e => setB2g('nivelConcorrencia', e.target.value)}>
                <option>Baixo</option>
                <option>Médio</option>
                <option>Alto</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Probabilidade de Ganho (%)</label>
              <input type="number" min={0} max={100} className={inputCls} value={b2gForm.probabilidadeGanho} onChange={e => setB2g('probabilidadeGanho', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelCls}>Decisão</label>
              <select className={inputCls} value={b2gForm.decisao} onChange={e => setB2g('decisao', e.target.value)}>
                <option value="GO">GO</option>
                <option value="GO_COM_RESSALVAS">GO com Ressalvas</option>
                <option value="NO_GO">NO GO</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Principais Concorrentes</label>
              <input className={inputCls} value={b2gForm.principaisConcorrentes} onChange={e => setB2g('principaisConcorrentes', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Descrição da Estratégia</label>
              <textarea className={inputCls} rows={4} value={b2gForm.descricaoEstrategia} onChange={e => setB2g('descricaoEstrategia', e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* ── Documentos ── */}
      {activeTab === 'documentos' && (
        <div className="space-y-4">
          <div className={sectionCls}>
            <div className={gridCls}>
              <div>
                <label className={labelCls}>Link de Briefing / RFP</label>
                <input type="url" className={inputCls} value={b2gForm.linkBriefing} onChange={e => setB2g('linkBriefing', e.target.value)} placeholder="https://" />
              </div>
              <div>
                <label className={labelCls}>Link de Anexos</label>
                <input type="url" className={inputCls} value={b2gForm.linkAnexos} onChange={e => setB2g('linkAnexos', e.target.value)} placeholder="https://" />
              </div>
            </div>
          </div>

          <div className={sectionCls}>
            <p className={labelCls + ' mb-3'}>Certidões / Documentos obrigatórios</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CHECKLIST_DOCS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={b2gForm[key]}
                    onChange={e => setB2g(key, e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--crm-border)] accent-blue-500"
                  />
                  <span className="text-sm text-[var(--crm-text)]">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className={sectionCls}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { key: 'checklistCompleto',         label: 'Checklist completo' },
                { key: 'exigeAmostras',             label: 'Exige amostras' },
                { key: 'visitaTecnicaObrigatoria',  label: 'Visita técnica obrigatória' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={b2gForm[key]}
                    onChange={e => setB2g(key, e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--crm-border)] accent-blue-500"
                  />
                  <span className="text-sm text-[var(--crm-text)]">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {b2gForm.checklistDocumentacao.length > 0 && (
            <div className={sectionCls}>
              <p className={labelCls + ' mb-3'}>Checklist de Documentação</p>
              <ul className="space-y-2">
                {b2gForm.checklistDocumentacao.map((item, idx) => (
                  <li key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--crm-text)]">{typeof item === 'object' ? item.nome || item.name || JSON.stringify(item) : item}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      (typeof item === 'object' ? item.status : '') === 'Concluído'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : (typeof item === 'object' ? item.status : '') === 'Em andamento'
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : "bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-muted-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]"
                    }`}>
                      {typeof item === 'object' ? (item.status || 'Pendente') : 'Pendente'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Risco ── */}
      {activeTab === 'risco' && (
        <div className="space-y-4">
          <div className={sectionCls}>
            <div className={gridCls}>
              <div>
                <label className={labelCls}>Tipo de Julgamento</label>
                <input className={inputCls} value={b2gForm.tipoJulgamento} onChange={e => setB2g('tipoJulgamento', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Grau de Risco</label>
                <select className={inputCls} value={b2gForm.grauRisco} onChange={e => setB2g('grauRisco', e.target.value)}>
                  <option>Baixo</option>
                  <option>Médio</option>
                  <option>Alto</option>
                  <option>Crítico</option>
                </select>
              </div>
              <div className="sm:col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="exigenciasRestritivas"
                  checked={b2gForm.exigenciasRestritivas}
                  onChange={e => setB2g('exigenciasRestritivas', e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--crm-border)] accent-blue-500"
                />
                <label htmlFor="exigenciasRestritivas" className="text-sm text-[var(--crm-text)]">Existe restrição relevante</label>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Penalidades</label>
                <textarea className={inputCls} rows={3} value={b2gForm.penalidades} onChange={e => setB2g('penalidades', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Observações Jurídicas</label>
                <textarea className={inputCls} rows={4} value={b2gForm.observacoesJuridicas} onChange={e => setB2g('observacoesJuridicas', e.target.value)} />
              </div>
            </div>
          </div>

          {b2gForm.riscos.length > 0 && (
            <div className={sectionCls}>
              <p className={labelCls + ' mb-3'}>Riscos identificados pela IA</p>
              <div className="flex flex-wrap gap-2">
                {b2gForm.riscos.map((risco, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  >
                    {risco}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div className={modalActionsClass || 'flex justify-end gap-3 mt-6'}>
        <button type="button" onClick={onCancel} className={modalCancelButtonClass}>
          Cancelar
        </button>
        <button type="submit" className={modalSubmitButtonClass}>
          {selectedOpportunity ? 'Salvar Alterações' : 'Criar Oportunidade'}
        </button>
      </div>
    </form>
  );
}
