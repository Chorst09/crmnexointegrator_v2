#!/usr/bin/env node

const BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:3002/api';
const LOGIN_EMAIL = process.env.TEST_EMAIL || 'admin@crm.com';
const LOGIN_PASSWORD = process.env.TEST_PASSWORD || 'admin123';

const runId = `T${Date.now()}`;
const results = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const asQuery = (query) => {
  if (!query || Object.keys(query).length === 0) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

const parseResponse = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const record = (moduleName, action, ok, status, details) => {
  results.push({ module: moduleName, action, ok, status, details });
  const icon = ok ? 'PASS' : 'FAIL';
  const suffix = status ? ` [${status}]` : '';
  const msg = typeof details === 'string' ? details : JSON.stringify(details);
  console.log(`${icon}${suffix} ${moduleName} :: ${action} :: ${msg}`);
};

let token = '';
const api = async (method, path, { query, body, formData, auth = true } = {}) => {
  const url = `${BASE_URL}${path}${asQuery(query)}`;
  const headers = {};

  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const options = {
    method,
    headers
  };

  if (formData) {
    options.body = formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const payload = await parseResponse(response);
  return { ok: response.ok, status: response.status, payload };
};

const assertOk = (moduleName, action, response) => {
  if (!response.ok) {
    record(moduleName, action, false, response.status, response.payload);
    return false;
  }
  record(moduleName, action, true, response.status, response.payload?.id || 'ok');
  return true;
};

const getFirst = (arr, label) => {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error(`Nenhum registro disponível para ${label}`);
  }
  return arr[0];
};

const run = async () => {
  console.log(`Iniciando bateria de testes em ${BASE_URL} [${runId}]`);

  const login = await api('POST', '/auth/login', {
    auth: false,
    body: { email: LOGIN_EMAIL, password: LOGIN_PASSWORD }
  });

  if (!login.ok || !login.payload?.token) {
    record('auth', 'login', false, login.status, login.payload);
    return 1;
  }
  token = login.payload.token;
  record('auth', 'login', true, login.status, login.payload.user?.email || 'ok');

  const usersResp = await api('GET', '/users');
  const companiesResp = await api('GET', '/companies');
  const opportunitiesResp = await api('GET', '/opportunities');
  const activitiesResp = await api('GET', '/activities');
  const productsResp = await api('GET', '/products');
  const contractsResp = await api('GET', '/contracts');

  if (!usersResp.ok || !companiesResp.ok || !opportunitiesResp.ok || !productsResp.ok) {
    record('bootstrap', 'load_dependencies', false, 500, {
      users: usersResp.status,
      companies: companiesResp.status,
      opportunities: opportunitiesResp.status,
      products: productsResp.status
    });
    return 1;
  }

  const users = usersResp.payload || [];
  const companies = companiesResp.payload || [];
  const opportunities = opportunitiesResp.payload || [];
  const activities = activitiesResp.ok ? (activitiesResp.payload || []) : [];
  const products = productsResp.payload || [];
  const contracts = contractsResp.ok ? (contractsResp.payload || []) : [];

  const seller = users.find((u) => u.role === 'SELLER') || getFirst(users, 'usuários');
  const productA = getFirst(products, 'produtos');
  const productB = products[1] || productA;
  const opportunity = getFirst(opportunities, 'oportunidades');
  const company = getFirst(companies, 'empresas');
  const contract = contracts[0] || null;

  // Companies (save + delete)
  const newCompany = await api('POST', '/companies', {
    body: {
      name: `Empresa Teste ${runId}`,
      document: `${Date.now()}`.slice(-14),
      segment: 'QA',
      size: 'SMALL',
      status: 'PROSPECT',
      contacts: [{ name: 'Contato QA', email: `qa+${runId}@teste.local`, isPrimary: true }]
    }
  });
  let companyId = null;
  if (assertOk('companies', 'create', newCompany)) {
    companyId = newCompany.payload?.id;
    const updateCompany = await api('PUT', '/companies', {
      body: { id: companyId, name: `Empresa Teste ${runId} Upd`, status: 'ACTIVE' }
    });
    assertOk('companies', 'update', updateCompany);

    const deleteCompany = await api('DELETE', '/companies', { query: { id: companyId } });
    assertOk('companies', 'delete', deleteCompany);
  }

  // Companies (delete with linked opportunity)
  const companyWithOpportunity = await api('POST', '/companies', {
    body: {
      name: `Empresa Link ${runId}`,
      segment: 'QA',
      size: 'SMALL',
      status: 'PROSPECT'
    }
  });

  if (assertOk('companies', 'create(for-linked-delete)', companyWithOpportunity)) {
    const linkedCompanyId = companyWithOpportunity.payload?.id;
    const linkedOpp = await api('POST', '/opportunities', {
      body: {
        title: `Oportunidade Link ${runId}`,
        projectName: `Projeto Link ${runId}`,
        projectClientType: 'BASE_CLIENT',
        value: 1500,
        probability: 30,
        stage: 'LEAD',
        companyId: linkedCompanyId,
        ownerId: seller.id
      }
    });
    assertOk('opportunities', 'create(for-company-linked-delete)', linkedOpp);

    const deleteLinkedCompany = await api('DELETE', '/companies', { query: { id: linkedCompanyId } });
    assertOk('companies', 'delete(with-linked-opportunity)', deleteLinkedCompany);
  }

  // Lead flow (distribute -> seller assumes -> convert to opportunity lifecycle)
  const leadFlowCompany = await api('POST', '/companies', {
    body: {
      name: `Lead Flow ${runId}`,
      segment: 'QA',
      size: 'SMALL',
      status: 'PROSPECT'
    }
  });

  if (assertOk('lead-flow', 'create-company', leadFlowCompany)) {
    const leadFlowCompanyId = leadFlowCompany.payload?.id;

    const setLeadStatus = await api('PUT', '/companies', {
      body: {
        id: leadFlowCompanyId,
        status: 'LEAD'
      }
    });
    assertOk('lead-flow', 'set-company-lead', setLeadStatus);

    const distributeLead = await api('POST', '/leadDistribution', {
      body: {
        action: 'create-opportunity',
        companyId: leadFlowCompanyId,
        strategy: 'LOAD_BALANCE',
        sellerId: seller.id,
        projectName: `Projeto Lead Flow ${runId}`,
        projectClientType: 'NEW_CLIENT'
      }
    });

    let leadFlowOpportunityId = null;
    if (assertOk('lead-flow', 'distribute-and-assign', distributeLead)) {
      leadFlowOpportunityId = distributeLead.payload?.opportunity?.id;

      const companyAfterDistribution = await api('GET', '/companies', {
        query: { id: leadFlowCompanyId }
      });
      const distributionStatusOk =
        companyAfterDistribution.ok && companyAfterDistribution.payload?.status === 'LEAD';
      record(
        'lead-flow',
        'company-status-after-distribution',
        distributionStatusOk,
        companyAfterDistribution.status,
        companyAfterDistribution.payload?.status || companyAfterDistribution.payload
      );

      if (leadFlowOpportunityId) {
        const distributedProjectName =
          distributeLead.payload?.opportunity?.projectName || '';
        const distributedType = distributeLead.payload?.opportunity?.projectClientType || '';
        record(
          'lead-flow',
          'distributed-project-fields',
          distributedProjectName.includes(`Projeto Lead Flow ${runId}`) && distributedType === 'NEW_CLIENT',
          200,
          { projectName: distributedProjectName, projectClientType: distributedType }
        );

        const assumeLead = await api('PUT', '/opportunities', {
          body: {
            id: leadFlowOpportunityId,
            stage: 'QUALIFICATION'
          }
        });
        assertOk('lead-flow', 'seller-assume-lead', assumeLead);

        const companyAfterAssume = await api('GET', '/companies', {
          query: { id: leadFlowCompanyId }
        });
        const assumeStatusOk =
          companyAfterAssume.ok && companyAfterAssume.payload?.status === 'PROSPECT';
        record(
          'lead-flow',
          'company-status-after-assume',
          assumeStatusOk,
          companyAfterAssume.status,
          companyAfterAssume.payload?.status || companyAfterAssume.payload
        );

        const closeWon = await api('PUT', '/opportunities', {
          body: {
            id: leadFlowOpportunityId,
            stage: 'WON'
          }
        });
        assertOk('lead-flow', 'close-won', closeWon);

        const companyAfterWon = await api('GET', '/companies', {
          query: { id: leadFlowCompanyId }
        });
        const wonStatusOk =
          companyAfterWon.ok && companyAfterWon.payload?.status === 'ACTIVE';
        record(
          'lead-flow',
          'company-status-after-won',
          wonStatusOk,
          companyAfterWon.status,
          companyAfterWon.payload?.status || companyAfterWon.payload
        );
      } else {
        record(
          'lead-flow',
          'seller-assume-lead',
          false,
          500,
          'opportunityId não retornado na distribuição'
        );
      }
    }

    const deleteLeadFlowCompany = await api('DELETE', '/companies', {
      query: { id: leadFlowCompanyId }
    });
    assertOk('lead-flow', 'cleanup-delete-company', deleteLeadFlowCompany);
  }

  // Users (save + delete)
  const newUserEmail = `qa.${runId.toLowerCase()}@crm.local`;
  const newUser = await api('POST', '/users', {
    body: {
      name: `QA User ${runId}`,
      email: newUserEmail,
      password: 'Teste@123',
      role: 'SELLER'
    }
  });
  let newUserId = null;
  if (assertOk('users', 'create', newUser)) {
    newUserId = newUser.payload?.id;
    const updateUser = await api('PUT', '/users', {
      body: { id: newUserId, name: `QA User ${runId} Upd`, email: newUserEmail, role: 'SELLER' }
    });
    assertOk('users', 'update', updateUser);

    const deleteUser = await api('DELETE', '/users', { body: { id: newUserId } });
    assertOk('users', 'delete', deleteUser);
  }

  // Products (save + delete)
  const newProduct = await api('POST', '/products', {
    body: {
      name: `Produto ${runId}`,
      category: 'QA',
      price: 199.9
    }
  });
  let newProductId = null;
  if (assertOk('products', 'create', newProduct)) {
    newProductId = newProduct.payload?.id;
    const updateProduct = await api('PUT', `/products/${newProductId}`, {
      body: { name: `Produto ${runId} Upd`, price: 249.9 }
    });
    assertOk('products', 'update', updateProduct);

    const deleteProduct = await api('DELETE', `/products/${newProductId}`);
    assertOk('products', 'delete', deleteProduct);
  }

  // Proposal templates (save + delete)
  const newTemplate = await api('POST', '/proposal-templates', {
    body: {
      name: `Template ${runId}`,
      type: 'COMMERCIAL',
      isDefault: false,
      sections: [{ id: 'proposal', title: 'Proposta', enabled: true, order: 1 }]
    }
  });
  let templateId = null;
  if (assertOk('proposal-templates', 'create', newTemplate)) {
    templateId = newTemplate.payload?.id;
    const updateTemplate = await api('PUT', `/proposal-templates/${templateId}`, {
      body: { name: `Template ${runId} Upd` }
    });
    assertOk('proposal-templates', 'update', updateTemplate);

    const deleteTemplate = await api('DELETE', `/proposal-templates/${templateId}`);
    assertOk('proposal-templates', 'delete', deleteTemplate);
  }

  // Proposals (save + delete)
  const newProposal = await api('POST', '/proposals', {
    body: {
      type: 'COMMERCIAL',
      title: `Proposta ${runId}`,
      opportunityId: opportunity.id,
      items: [
        {
          productId: productA.id,
          quantity: 1,
          unitPrice: Number(productA.price || 100),
          discount: 0
        }
      ]
    }
  });
  let proposalId = null;
  if (assertOk('proposals', 'create', newProposal)) {
    proposalId = newProposal.payload?.id;
    const updateProposal = await api('PUT', `/proposals/${proposalId}`, {
      body: { title: `Proposta ${runId} Upd` }
    });
    assertOk('proposals', 'update', updateProposal);

    const deleteProposal = await api('DELETE', `/proposals/${proposalId}`);
    assertOk('proposals', 'delete', deleteProposal);
  }

  // Integrations (save + delete)
  const newIntegration = await api('POST', '/integrations', {
    body: {
      name: `Integra ${runId}`,
      type: 'WHATSAPP',
      config: { token: 'x' },
      isActive: true
    }
  });
  let integrationId = null;
  if (assertOk('integrations', 'create', newIntegration)) {
    integrationId = newIntegration.payload?.id;
    const updateIntegration = await api('PUT', '/integrations', {
      body: { id: integrationId, name: `Integra ${runId} Upd`, isActive: false, config: { token: 'y' } }
    });
    assertOk('integrations', 'update', updateIntegration);
    const deleteIntegration = await api('DELETE', '/integrations', { query: { id: integrationId } });
    assertOk('integrations', 'delete', deleteIntegration);
  }

  // Regions (save + delete)
  const newRegion = await api('POST', '/regions', {
    body: {
      name: `Regiao ${runId}`,
      code: `QA${String(Date.now()).slice(-6)}`,
      country: 'Brasil',
      isActive: true
    }
  });
  let regionId = null;
  if (assertOk('regions', 'create', newRegion)) {
    regionId = newRegion.payload?.id;
    const updateRegion = await api('PUT', '/regions', {
      body: { id: regionId, name: `Regiao ${runId} Upd`, code: `QB${String(Date.now()).slice(-6)}`, country: 'Brasil', isActive: true }
    });
    assertOk('regions', 'update', updateRegion);
    const deleteRegion = await api('DELETE', '/regions', { query: { id: regionId } });
    assertOk('regions', 'delete', deleteRegion);
  }

  // Competitors (save + delete)
  const newCompetitor = await api('POST', '/competitors', {
    body: {
      name: `Concorrente ${runId}`,
      website: 'https://example.com',
      isActive: true
    }
  });
  let competitorId = null;
  if (assertOk('competitors', 'create', newCompetitor)) {
    competitorId = newCompetitor.payload?.id;
    const updateCompetitor = await api('PUT', '/competitors', {
      body: { id: competitorId, name: `Concorrente ${runId} Upd`, isActive: false }
    });
    assertOk('competitors', 'update', updateCompetitor);
    const deleteCompetitor = await api('DELETE', '/competitors', { query: { id: competitorId } });
    assertOk('competitors', 'delete', deleteCompetitor);
  }

  // Cross-sell (save + delete)
  const newCrossSell = await api('POST', '/cross-sell', {
    body: {
      name: `Cross ${runId}`,
      mainProductId: productA.id,
      suggestedProductId: productB.id,
      probability: 0.7
    }
  });
  let crossSellId = null;
  if (assertOk('cross-sell', 'create', newCrossSell)) {
    crossSellId = newCrossSell.payload?.id;
    const updateCrossSell = await api('PUT', '/cross-sell', {
      body: { id: crossSellId, name: `Cross ${runId} Upd`, discount: 5, isActive: true }
    });
    assertOk('cross-sell', 'update', updateCrossSell);
    const deleteCrossSell = await api('DELETE', '/cross-sell', { query: { id: crossSellId } });
    assertOk('cross-sell', 'delete', deleteCrossSell);
  }

  // Upsell (save + delete)
  const newUpsell = await api('POST', '/upsell', {
    body: {
      name: `Upsell ${runId}`,
      mainProductId: productA.id,
      targetProductId: productB.id,
      minQuantity: 1,
      discount: 3
    }
  });
  let upsellId = null;
  if (assertOk('upsell', 'create', newUpsell)) {
    upsellId = newUpsell.payload?.id;
    const updateUpsell = await api('PUT', '/upsell', {
      body: { id: upsellId, name: `Upsell ${runId} Upd`, minQuantity: 2, discount: 4 }
    });
    assertOk('upsell', 'update', updateUpsell);
    const deleteUpsell = await api('DELETE', '/upsell', { query: { id: upsellId } });
    assertOk('upsell', 'delete', deleteUpsell);
  }

  // Advanced workflows (save + delete)
  const newWorkflow = await api('POST', '/advanced-workflows', {
    body: {
      name: `Workflow ${runId}`,
      type: 'CONDITIONAL',
      category: 'GENERAL',
      trigger: { event: 'MANUAL' },
      conditions: [],
      actions: []
    }
  });
  let workflowId = null;
  if (assertOk('advanced-workflows', 'create', newWorkflow)) {
    workflowId = newWorkflow.payload?.id;
    const updateWorkflow = await api('PUT', '/advanced-workflows', {
      body: { id: workflowId, name: `Workflow ${runId} Upd`, type: 'CONDITIONAL', trigger: { event: 'MANUAL' }, conditions: [], actions: [] }
    });
    assertOk('advanced-workflows', 'update', updateWorkflow);
    const deleteWorkflow = await api('DELETE', '/advanced-workflows', { body: { id: workflowId } });
    assertOk('advanced-workflows', 'delete', deleteWorkflow);
  }

  // Sales targets (save + delete)
  const today = new Date();
  const nextMonth = new Date(today);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const newTarget = await api('POST', '/sales-targets', {
    body: {
      sellerId: seller.id,
      targetValue: 10000,
      targetDeals: 5,
      startDate: today.toISOString(),
      endDate: nextMonth.toISOString(),
      description: `Meta ${runId}`
    }
  });
  let targetId = null;
  if (assertOk('sales-targets', 'create', newTarget)) {
    targetId = newTarget.payload?.id;
    const updateTarget = await api('PUT', '/sales-targets', {
      body: {
        id: targetId,
        targetValue: 12000,
        targetDeals: 6,
        startDate: today.toISOString(),
        endDate: nextMonth.toISOString(),
        description: `Meta ${runId} Upd`,
        bonusPercentage: 5
      }
    });
    assertOk('sales-targets', 'update', updateTarget);
    const deleteTarget = await api('DELETE', '/sales-targets', { body: { id: targetId } });
    assertOk('sales-targets', 'delete', deleteTarget);
  }

  // Price tables (save + delete)
  const newPriceTable = await api('POST', '/price-tables', {
    body: {
      name: `Tabela ${runId}`,
      description: 'Tabela de teste',
      validFrom: today.toISOString(),
      customerSegment: 'QA'
    }
  });
  let priceTableId = null;
  if (assertOk('price-tables', 'create', newPriceTable)) {
    priceTableId = newPriceTable.payload?.id;
    const updatePriceTable = await api('PUT', '/price-tables', {
      body: {
        id: priceTableId,
        name: `Tabela ${runId} Upd`,
        description: 'Tabela de teste atualizada',
        validFrom: today.toISOString()
      }
    });
    assertOk('price-tables', 'update', updatePriceTable);
    const deletePriceTable = await api('DELETE', '/price-tables', { query: { id: priceTableId } });
    assertOk('price-tables', 'delete', deletePriceTable);
  }

  // Company documents (save + delete)
  {
    const form = new FormData();
    form.append('file', new Blob([`documento ${runId}`], { type: 'text/plain' }), `doc-${runId}.txt`);
    const uploadDoc = await api('POST', `/companies/${company.id}/documents`, { formData: form });
    let docId = null;
    if (assertOk('company-documents', 'create(upload)', uploadDoc)) {
      docId = uploadDoc.payload?.id;
      const deleteDoc = await api('DELETE', `/companies/document/${docId}`);
      assertOk('company-documents', 'delete', deleteDoc);
    }
  }

  // Contracts attachments (save + delete)
  if (contract?.id) {
    const form = new FormData();
    form.append('file', new Blob([`anexo ${runId}`], { type: 'text/plain' }), `attach-${runId}.txt`);
    const uploadAttachment = await api('POST', `/contracts/${contract.id}/upload`, { formData: form });
    let attachmentId = null;
    if (assertOk('contracts-attachments', 'create(upload)', uploadAttachment)) {
      attachmentId = uploadAttachment.payload?.id;
      const deleteAttachment = await api('DELETE', `/contracts/attachment/${attachmentId}`);
      assertOk('contracts-attachments', 'delete', deleteAttachment);
    }
  } else {
    record('contracts-attachments', 'create(upload)', false, 0, 'Nenhum contrato disponível para teste');
  }

  // Pre-vendas (save + delete)
  const newPreSales = await api('POST', '/pre-vendas', {
    body: {
      titulo: `Pre-vendas ${runId}`,
      descricao: 'Solicitacao de teste',
      tiposPrecificacao: ['VENDA'],
      prioridade: 'MEDIUM'
    }
  });
  let preSalesId = null;
  if (assertOk('pre-vendas', 'create', newPreSales)) {
    preSalesId = newPreSales.payload?.data?.id || newPreSales.payload?.id;
    const updatePreSales = await api('PUT', `/pre-vendas/${preSalesId}`, {
      body: {
        titulo: `Pre-vendas ${runId} Upd`,
        descricao: 'Solicitacao de teste atualizada',
        prioridade: 'HIGH'
      }
    });
    assertOk('pre-vendas', 'update', updatePreSales);
    const deletePreSales = await api('DELETE', `/pre-vendas/${preSalesId}`);
    assertOk('pre-vendas', 'delete', deletePreSales);
  }

  // Save-only checks for modules without delete endpoint
  if (opportunity?.id) {
    const updateOpportunity = await api('PUT', '/opportunities', {
      body: {
        id: opportunity.id,
        description: `Update smoke ${runId}`,
        projectName: `Projeto Update ${runId}`,
        projectClientType: 'RENEWAL'
      }
    });
    assertOk('opportunities', 'update(save-only)', updateOpportunity);
  }

  if (activities.length > 0) {
    const act = activities[0];
    const updateActivity = await api('PUT', '/activities', {
      body: { id: act.id, subject: `Atividade ${runId}`, status: act.status || 'PENDING' }
    });
    assertOk('activities', 'update(save-only)', updateActivity);
  }

  if (contract?.id) {
    const updateContract = await api('PUT', `/contracts/${contract.id}`, {
      body: { description: `Contrato update ${runId}` }
    });
    assertOk('contracts', 'update(save-only)', updateContract);
  }

  await sleep(200);
  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);

  console.log('\nResumo:');
  console.log(`  Total: ${results.length}`);
  console.log(`  Passou: ${passed.length}`);
  console.log(`  Falhou: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\nFalhas:');
    for (const item of failed) {
      console.log(`  - ${item.module} :: ${item.action} [${item.status}]`);
    }
  }

  return failed.length > 0 ? 1 : 0;
};

run()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error('Erro fatal na execução dos testes:', error);
    process.exitCode = 1;
  });
