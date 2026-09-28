import { useState, useEffect, useMemo } from 'react';

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
const PROJECT_CLIENT_TYPE_OPTIONS = [
  { value: 'NEW_CLIENT', label: 'Cliente Novo' },
  { value: 'BASE_CLIENT', label: 'Cliente da Base' },
  { value: 'RENEWAL', label: 'Renovação' }
];

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
      orgaoEntidade: merged.orgaoEntidade || selectedOpportunity?.company?.name || '',
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

  const handleSubmitB2G = (e) => {
    e.preventDefault();
    const normalizedB2GForm = {
      ...b2gForm,
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
  const projectClientType = String(formData.projectClientType || '');
  const shouldSelectExistingCompany = projectClientType === 'BASE_CLIENT' || projectClientType === 'RENEWAL';
  const shouldCreateCompanyFirst = projectClientType === 'NEW_CLIENT' && !selectedOpportunity;
  const handleProjectClientTypeChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      projectClientType: value,
      companyId: value === 'NEW_CLIENT' ? '' : prev.companyId
    }));
    if (value === 'BASE_CLIENT' || value === 'RENEWAL') {
      onRefreshCompanies?.();
    }
    if (value === 'NEW_CLIENT' && !selectedOpportunity) {
      onCreateCompany?.();
    }
  };

  const inputCls = modalInputClass || 'w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] text-[var(--crm-text)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = modalLabelClass || 'text-xs font-medium text-[var(--crm-muted)] mb-1 block';
  const sectionCls = 'bg-[var(--crm-surface)] border border-[var(--crm-border)] rounded-xl p-5 mb-4';
  const gridCls = 'grid grid-cols-1 sm:grid-cols-2 gap-4';

  // ── Simple B2B form ──────────────────────────────────────────────────────────
  if (!isB2G) {
    return (
      <form onSubmit={onSubmit} className={modalContainerClass}>
        <div className={gridCls}>
          <div className="sm:col-span-2">
            <label className={labelCls}>Título</label>
            <input className={inputCls} value={formData.title || ''} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} required />
          </div>

          <div>
            <label className={labelCls}>Nome no Projeto</label>
            <input className={inputCls} value={formData.projectName || ''} onChange={e => setFormData(p => ({ ...p, projectName: e.target.value }))} />
          </div>

          <div>
            <label className={labelCls}>Tipo de Cliente</label>
            <select className={inputCls} value={formData.projectClientType || ''} onChange={e => handleProjectClientTypeChange(e.target.value)} required>
              <option value="">Selecione...</option>
              {PROJECT_CLIENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {shouldSelectExistingCompany && (
            <div className="sm:col-span-2">
              <label className={labelCls}>Cliente</label>
              <select className={inputCls} value={formData.companyId || ''} onChange={e => setFormData(p => ({ ...p, companyId: e.target.value }))} required>
                <option value="">Selecione um cliente cadastrado...</option>
                {(companies || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                {(companies || []).length === 0 && (
                  <option value="" disabled>Nenhuma empresa cadastrada encontrada</option>
                )}
              </select>
            </div>
          )}

          {shouldCreateCompanyFirst && (
            <div className="sm:col-span-2 rounded-xl border border-amber-400/35 bg-amber-400/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--crm-ink)]">Cadastre a empresa para continuar.</p>
                  <p className="mt-1 text-xs text-[var(--crm-muted)]">Depois do cadastro, a oportunidade volta aberta com a empresa selecionada.</p>
                </div>
                <button type="button" onClick={onCreateCompany} className="crm-btn crm-btn-primary whitespace-nowrap">
                  Nova Empresa
                </button>
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>Modelo de Comissão</label>
            <select
              className={inputCls}
              value={formData.projectType || 'SINGLE'}
              onChange={e => setFormData(p => ({
                ...p,
                projectType: e.target.value,
                projectMonths: e.target.value === 'MONTHLY' ? (p.projectMonths || '12') : ''
              }))}
            >
              <option value="SINGLE">Projeto pontual</option>
              <option value="MONTHLY">Projeto mensal</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Prazo do Projeto Mensal</label>
            <select
              className={inputCls}
              value={formData.projectMonths || '12'}
              disabled={(formData.projectType || 'SINGLE') !== 'MONTHLY'}
              onChange={e => setFormData(p => ({ ...p, projectMonths: e.target.value }))}
            >
              {PROJECT_MONTH_OPTIONS.map((months) => (
                <option key={months} value={String(months)}>{months} meses</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Descrição</label>
            <textarea className={inputCls} rows={3} value={formData.description || ''} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} />
          </div>

          <div>
            <label className={labelCls}>Valor (R$)</label>
            <input type="number" className={inputCls} value={formData.value || ''} onChange={e => setFormData(p => ({ ...p, value: e.target.value }))} />
          </div>

          <div>
            <label className={labelCls}>Probabilidade (%)</label>
            <input type="number" min={0} max={100} className={inputCls} value={formData.probability || ''} onChange={e => setFormData(p => ({ ...p, probability: e.target.value }))} />
          </div>

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
            <label className={labelCls}>Data de Fechamento Esperada</label>
            <input type="date" className={inputCls} value={formData.expectedCloseDate || ''} onChange={e => setFormData(p => ({ ...p, expectedCloseDate: e.target.value }))} />
          </div>

          <div>
            <label className={labelCls}>Responsável</label>
            <select className={inputCls} value={formData.ownerId || ''} onChange={e => setFormData(p => ({ ...p, ownerId: e.target.value }))}>
              <option value="">Selecione...</option>
              {(users || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Email do Responsável</label>
            <input type="email" className={inputCls} value={formData.ownerEmail || ''} onChange={e => setFormData(p => ({ ...p, ownerEmail: e.target.value }))} placeholder="email@empresa.com" />
          </div>

          <div>
            <label className={labelCls}>Telefone do Responsável</label>
            <input type="tel" className={inputCls} value={formData.ownerPhone || ''} onChange={e => setFormData(p => ({ ...p, ownerPhone: e.target.value }))} placeholder="(00) 00000-0000" />
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Acompanhamento</label>
            <textarea className={inputCls} rows={4} value={formData.notes || ''} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} placeholder="Anotações sobre o acompanhamento da oportunidade..." />
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
                <label className={labelCls}>Modelo de Comissão</label>
                <select
                  className={inputCls}
                  value={formData.projectType || 'SINGLE'}
                  onChange={e => setFormData(p => ({
                    ...p,
                    projectType: e.target.value,
                    projectMonths: e.target.value === 'MONTHLY' ? (p.projectMonths || '12') : ''
                  }))}
                >
                  <option value="SINGLE">Projeto pontual</option>
                  <option value="MONTHLY">Projeto mensal</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Prazo do Projeto Mensal</label>
                <select
                  className={inputCls}
                  value={formData.projectMonths || '12'}
                  disabled={(formData.projectType || 'SINGLE') !== 'MONTHLY'}
                  onChange={e => setFormData(p => ({ ...p, projectMonths: e.target.value }))}
                >
                  {PROJECT_MONTH_OPTIONS.map((months) => (
                    <option key={months} value={String(months)}>{months} meses</option>
                  ))}
                </select>
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
                  {(companies || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Responsável</label>
                <select className={inputCls} value={formData.ownerId || ''} onChange={e => setFormData(p => ({ ...p, ownerId: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {(users || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Email do Responsável</label>
                <input type="email" className={inputCls} value={b2gForm.ownerEmail || ''} onChange={e => setB2g('ownerEmail', e.target.value)} placeholder="email@empresa.com" />
              </div>
              <div>
                <label className={labelCls}>Telefone do Responsável</label>
                <input type="tel" className={inputCls} value={b2gForm.ownerPhone || ''} onChange={e => setB2g('ownerPhone', e.target.value)} placeholder="(00) 00000-0000" />
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
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
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
