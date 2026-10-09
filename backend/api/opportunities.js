import { prisma } from "../lib/prisma.js";
import { updateCompanyLeadScore } from '../lib/leadScoring.js';
import { getTenantCompanyId, isTenantRecordVisible, forbiddenTenantResponse, tenantScopedWhere } from '../lib/tenantScope.js';
import { validateCustomerOwnership } from '../lib/customerOwnershipValidator.js';

const parsePathIdFromUrl = (urlValue) => {
  if (!urlValue) return null;

  const cleanPath = String(urlValue).split('?')[0];
  const segments = cleanPath
    .split('/')
    .filter(Boolean)
    .filter((segment) => !['api', 'opportunities'].includes(segment));
  return segments.length > 0 ? decodeURIComponent(segments[segments.length - 1]) : null;
};

const resolveOpportunityId = (req, body) =>
  body?.id || req.query?.id || parsePathIdFromUrl(req.url);

const parseDateInput = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeClientType = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === 'B2B' || normalized === 'B2G' ? normalized : null;
};

const normalizeRole = (user = {}) => String(user.actualRole || user.role || '').trim().toUpperCase();

const canOwnOpportunityForClientType = (user = {}, clientType = 'B2B') => {
  const type = normalizeClientType(clientType) || 'B2B';
  const role = normalizeRole(user);
  if (role === 'PRE_SALES') return false;
  if (type === 'B2G') return Boolean(user.accessB2G || role === 'USER_B2G');
  return Boolean(user.accessB2B || role === 'SELLER' || role === 'USER_B2B');
};

const hasB2GSignal = (value) => /\bB2G\b|GOVERNO|\bGOV\b|LICIT|EDITAL|TERMO DE REFER[ÊE]NCIA/i.test(String(value || ''));

const hasB2GDescriptionShape = (value) => {
  const text = String(value || '').trim();
  if (!text) return false;
  if (hasB2GSignal(text)) return true;
  if (!text.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(text);
    return Boolean(
      parsed?.noticeId ||
      parsed?.numeroEdital ||
      parsed?.orgaoEntidade ||
      parsed?.faseAtual ||
      parsed?.modalidade
    );
  } catch {
    return false;
  }
};

const inferCompanyClientType = (company, fallback = 'B2B') => {
  const direct = normalizeClientType(company?.clientType);
  if (direct) return direct;
  return hasB2GSignal(company?.segment) ? 'B2G' : fallback;
};

const inferOpportunityClientType = (opportunity, fallback = 'B2B') => {
  const direct = normalizeClientType(opportunity?.clientType);
  if (direct) return direct;
  if (String(opportunity?.number || '').toUpperCase().startsWith('B2G-')) return 'B2G';
  if (normalizeClientType(opportunity?.projectClientType) === 'B2G') return 'B2G';
  if (opportunity?.b2gStage) return 'B2G';
  if (hasB2GSignal(opportunity?.source)) return 'B2G';
  if (hasB2GDescriptionShape(opportunity?.description)) return 'B2G';
  return inferCompanyClientType(opportunity?.company, fallback);
};

const isOpportunityInClientType = (opportunity, targetClientType) => {
  const expected = normalizeClientType(targetClientType);
  if (!expected) return true;
  return inferOpportunityClientType(opportunity) === expected;
};

const resolveRequestedClientType = (body = {}, query = {}) => {
  const explicit = normalizeClientType(body.clientType || query.clientType);
  if (explicit) return explicit;
  if (body.b2gStage || normalizeClientType(body.projectClientType) === 'B2G') return 'B2G';
  if (hasB2GSignal(body.source) || hasB2GDescriptionShape(body.description)) return 'B2G';
  return 'B2B';
};

const canAccessChorstData = (user = {}) => {
  const email = String(user?.email || '').trim().toLowerCase();
  return email === 'carlos.horst@doubletelecom.com.br' || email === 'chorstconsult@gmail.com';
};

const canSeeAllOpportunities = (user = {}) =>
  ['MASTER', 'ADMIN', 'MANAGER', 'DIRECTOR'].includes(normalizeRole(user));

const canAccessClientType = (user = {}, clientType = 'B2B') => {
  const type = normalizeClientType(clientType) || 'B2B';
  if (type === 'B2G') return Boolean(user.accessB2G);
  return Boolean(user.accessB2B);
};

const generateOpportunityNumber = async (tx, clientType = 'B2B') => {
  const type = normalizeClientType(clientType) || 'B2B';
  const year = new Date().getFullYear();
  const prefix = `${type}-${year}-`;
  const latest = await tx.opportunity.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true }
  });
  const latestSequence = Number(String(latest?.number || '').slice(prefix.length)) || 0;
  return `${prefix}${String(latestSequence + 1).padStart(5, '0')}`;
};

const generateAvailableOpportunityNumber = async (tx, clientType = 'B2B') => {
  const type = normalizeClientType(clientType) || 'B2B';
  const year = new Date().getFullYear();
  const prefix = `${type}-${year}-`;
  const opportunities = await tx.opportunity.findMany({
    where: { number: { startsWith: prefix } },
    select: { number: true }
  });
  const usedSequences = new Set(
    opportunities
      .map((item) => Number(String(item.number || '').slice(prefix.length)))
      .filter((value) => Number.isInteger(value) && value > 0)
  );

  let sequence = 1;
  while (usedSequences.has(sequence)) sequence += 1;

  return `${prefix}${String(sequence).padStart(5, '0')}`;
};

const isUniqueOpportunityNumberError = (error) => {
  return error?.code === 'P2002' && Array.isArray(error?.meta?.target) && error.meta.target.includes('number');
};

const isSchemaDriftError = (error) => {
  return error?.code === 'P2021' || error?.code === 'P2022';
};

const isMissingOptionalModelError = (error) => {
  return error instanceof TypeError && /Cannot read properties of undefined/.test(error.message || '');
};

const runOptionalCleanup = async (operation) => {
  try {
    await operation();
  } catch (error) {
    if (!isSchemaDriftError(error) && !isMissingOptionalModelError(error)) {
      throw error;
    }
  }
};

const MONTHLY_PROJECT_MONTHS = [12, 24, 36, 48, 60];

const normalizeProjectType = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  return raw === 'MONTHLY' ? 'MONTHLY' : 'SINGLE';
};

const normalizeProjectMonths = (projectType, value) => {
  if (projectType !== 'MONTHLY') return null;
  const parsed = Number(value);
  return MONTHLY_PROJECT_MONTHS.includes(parsed) ? parsed : 12;
};

const normalizeStageDecisionDetails = (value, user = {}, context = {}) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  let details = value;
  if (typeof value === 'string') {
    try {
      details = JSON.parse(value);
    } catch {
      details = { notes: value };
    }
  }

  if (!details || typeof details !== 'object' || Array.isArray(details)) return null;

  const cleaned = Object.entries(details).reduce((acc, [key, item]) => {
    if (item === undefined) return acc;
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed) acc[key] = trimmed;
      return acc;
    }
    if (item !== null) acc[key] = item;
    return acc;
  }, {});

  const clientType = normalizeClientType(cleaned.clientType || context.clientType);
  const decision = String(cleaned.decision || cleaned.type || context.decision || context.b2gStage || context.stage || '')
    .trim()
    .toUpperCase();

  return {
    ...cleaned,
    clientType: clientType || cleaned.clientType || null,
    decision: decision || null,
    b2gStage: cleaned.b2gStage || context.b2gStage || null,
    recordedAt: cleaned.recordedAt || new Date().toISOString(),
    recordedById: cleaned.recordedById || user.userId || user.id || null,
    recordedByName: cleaned.recordedByName || user.name || user.email || null
  };
};

const resolveStageDecisionLossReason = (details) => {
  if (!details || typeof details !== 'object') return undefined;
  const decision = String(details.decision || details.type || '').toUpperCase();
  const isLossDecision = ['LOST', 'PERDIDO', 'NO_GO', 'NO GO'].includes(decision);
  if (!isLossDecision) return undefined;
  return details.lossReason || details.noGoReason || details.reason || details.outcomeReason || null;
};

const resolveCommissionPercentage = (seller, projectType, projectMonths) => {
  if (!seller) return 0;
  if (projectType === 'MONTHLY') {
    return Number(seller[`commissionProject${projectMonths}`] || 0);
  }
  return Number(seller.commissionSalePercentage || 0);
};

const syncWonOpportunityCommission = async (tx, opportunity) => {
  if (!opportunity?.id || opportunity.stage !== 'WON') return null;

  const seller = await tx.user.findUnique({
    where: { id: opportunity.ownerId },
    select: {
      commissionSalePercentage: true,
      commissionProject12: true,
      commissionProject24: true,
      commissionProject36: true,
      commissionProject48: true,
      commissionProject60: true
    }
  });

  const projectType = normalizeProjectType(opportunity.projectType);
  const projectMonths = normalizeProjectMonths(projectType, opportunity.projectMonths);
  const percentage = resolveCommissionPercentage(seller, projectType, projectMonths);
  const calculationBase = Number(opportunity.value || 0);
  const amount = Number(((calculationBase * percentage) / 100).toFixed(2));
  const existingCommission = await tx.commission.findUnique({
    where: { opportunityId: opportunity.id },
    select: { status: true }
  });
  const nextStatus = existingCommission?.status === 'PAID' ? 'PAID' : 'PENDING';

  return tx.commission.upsert({
    where: { opportunityId: opportunity.id },
    create: {
      opportunityId: opportunity.id,
      sellerId: opportunity.ownerId,
      percentage,
      amount,
      calculationBase,
      projectType,
      projectMonths,
      status: nextStatus
    },
    update: {
      sellerId: opportunity.ownerId,
      percentage,
      amount,
      calculationBase,
      projectType,
      projectMonths,
      status: nextStatus
    }
  });
};

const cancelOpenOpportunityCommission = async (tx, opportunityId) => {
  if (!opportunityId) return;
  await tx.commission.updateMany({
    where: {
      opportunityId,
      status: { not: 'PAID' }
    },
    data: { status: 'CANCELLED' }
  });
};

export default async function handler(req) {
  if (req.method === "GET") {
    const { stage, ownerId, clientType } = req.query || {};
    
    const where = {
      ...tenantScopedWhere(req.user)
    };
    if (stage) where.stage = stage;
    if (canSeeAllOpportunities(req.user)) {
      if (ownerId) where.ownerId = ownerId;
    } else {
      where.ownerId = req.user.userId;
    }

    if (!canAccessChorstData(req.user)) {
      if (where.ownerId === '0135bec0-498b-450b-86f6-c2a714014f3f') {
        return Response.json([]);
      }
      where.ownerId = where.ownerId ? where.ownerId : { not: '0135bec0-498b-450b-86f6-c2a714014f3f' };
      where.owner = { email: { not: 'chorstconsult@gmail.com' } };
    }

    const opportunities = await prisma.opportunity.findMany({
      where,
      include: {
        company: {
          include: {
            contacts: {
              where: { isPrimary: true },
              take: 1
            }
          }
        },
        owner: {
          select: { id: true, name: true, email: true }
        },
        products: {
          include: {
            product: true
          }
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            assignedTo: {
              select: { name: true }
            }
          }
        },
        commission: true,
        project: {
          select: { id: true, number: true, name: true, status: true }
        }
      },
      orderBy: [
        { stage: 'asc' },
        { expectedCloseDate: 'asc' }
      ]
    });
    
    const filtered = opportunities
      .map((item) => ({
        ...item,
        clientType: inferOpportunityClientType(item)
      }))
      .filter((item) => isOpportunityInClientType(item, clientType))
      .filter((item) => canAccessClientType(req.user, item.clientType));

    return Response.json(filtered);
  }

  if (req.method === "POST") {
    const body = await req.json();
    const clientType = resolveRequestedClientType(body, req.query || {});

    if (!canAccessClientType(req.user, clientType)) {
      return new Response('Sem acesso ao módulo desta oportunidade', { status: 403 });
    }

    const resolvedOwnerId = canSeeAllOpportunities(req.user) ? body.ownerId : req.user.userId;
    const tenantCompanyId = getTenantCompanyId(req.user) || body.tenantCompanyId || null;
    if (!body.title) {
      return Response.json({ error: 'Título é obrigatório' }, { status: 400 });
    }
    if (!body.companyId) {
      return Response.json({ error: 'Selecione uma empresa para a oportunidade' }, { status: 400 });
    }
    if (!resolvedOwnerId) {
      return Response.json({ error: 'Selecione um responsável para a oportunidade' }, { status: 400 });
    }

    if (tenantCompanyId && body.companyId) {
      const company = await prisma.company.findUnique({
        where: { id: body.companyId },
        select: { tenantCompanyId: true }
      });
      if (!company || String(company.tenantCompanyId || '') !== tenantCompanyId) {
        return new Response('Empresa não pertence a este tenant', { status: 403 });
      }
    }

    const owner = await prisma.user.findUnique({
      where: { id: resolvedOwnerId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accessB2B: true,
        accessB2G: true,
        tenantCompanyId: true
      }
    });
    if (!owner) {
      return Response.json({ error: 'Responsável não encontrado' }, { status: 400 });
    }
    if (tenantCompanyId && owner.tenantCompanyId && String(owner.tenantCompanyId) !== String(tenantCompanyId)) {
      return Response.json({ error: 'Responsável não pertence a este tenant' }, { status: 403 });
    }
    if (!canOwnOpportunityForClientType(owner, clientType)) {
      return Response.json({ error: `Responsável sem acesso ao módulo ${clientType}` }, { status: 400 });
    }

    const ownershipCompany = await prisma.company.findUnique({
      where: { id: body.companyId },
      select: { id: true, name: true, document: true, website: true }
    });
    const ownershipDecision = await validateCustomerOwnership(prisma, {
      tenantCompanyId,
      requesterId: resolvedOwnerId,
      requesterName: owner.name || owner.email || '',
      companyId: body.companyId,
      companyName: ownershipCompany?.name || body.companyName || body.company?.name || '',
      document: ownershipCompany?.document || body.document || body.company?.document || '',
      website: ownershipCompany?.website || body.website || body.company?.website || '',
      clientType
    });
    if (!ownershipDecision.permitido) {
      return Response.json(ownershipDecision, { status: 409 });
    }

    const projectType = normalizeProjectType(body.projectType);
    const projectMonths = normalizeProjectMonths(projectType, body.projectMonths);
    const stageDecisionDetails = normalizeStageDecisionDetails(body.stageDecisionDetails, req.user, {
      clientType,
      stage: body.stage || 'LEAD',
      b2gStage: clientType === 'B2G' ? (body.b2gStage || 'ANALISE') : (body.b2gStage || null)
    });
    const lossReason = body.lossReason !== undefined
      ? (body.lossReason || null)
      : resolveStageDecisionLossReason(stageDecisionDetails);
    const initialStage = body.stage || 'LEAD';
    const now = new Date();
    const leadEntryDate = parseDateInput(body.leadEntryDate) || now;
    const closingDate = parseDateInput(body.actualCloseDate) || now;
    const customerTurnDate = initialStage === 'WON'
      ? (parseDateInput(body.customerTurnDate) || closingDate)
      : parseDateInput(body.customerTurnDate);
    const exitDate = initialStage === 'LOST'
      ? (parseDateInput(body.exitDate) || closingDate)
      : parseDateInput(body.exitDate);
    
    const createOpportunityWithNumber = async (number) => prisma.$transaction(async (tx) => {
      const created = await tx.opportunity.create({
        data: {
          number,
          title: body.title,
          projectName: body.projectName || body.title,
          projectClientType: body.projectClientType || null,
          negotiationType: body.negotiationType || null,
          projectClassification: body.projectClassification || null,
          projectTower: body.projectTower || null,
          projectDetail: body.projectDetail || null,
          manufacturer: body.manufacturer || null,
          licenseCount: body.licenseCount !== undefined && body.licenseCount !== null && body.licenseCount !== '' ? Number(body.licenseCount) : null,
          contractMonths: body.contractMonths !== undefined && body.contractMonths !== null && body.contractMonths !== '' ? Number(body.contractMonths) : null,
          monthlyValue: body.monthlyValue !== undefined && body.monthlyValue !== null && body.monthlyValue !== '' ? Number(body.monthlyValue) : null,
          installationFee: body.installationFee !== undefined && body.installationFee !== null && body.installationFee !== '' ? Number(body.installationFee) : null,
          leadSourceDetail: body.leadSourceDetail || null,
          importSource: body.importSource || null,
          importSourceRow: body.importSourceRow !== undefined && body.importSourceRow !== null && body.importSourceRow !== '' ? Number(body.importSourceRow) : null,
          projectType,
          projectMonths,
          description: body.description,
          value: body.value,
          probability: body.probability || 50,
          stage: initialStage,
          b2gStage: clientType === 'B2G' ? (body.b2gStage || 'ANALISE') : (body.b2gStage || null),
          source: body.source,
          leadEntryDate,
          expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null,
          actualCloseDate: ['WON', 'LOST'].includes(initialStage) ? closingDate : null,
          customerTurnDate,
          exitDate,
          lossReason,
          stageDecisionDetails,
          notes: body.notes,
          // Campos de contato do cliente
          contactName: body.contactName || null,
          contactFullName: body.contactFullName || null,
          contactEmail: body.contactEmail || null,
          contactPhone: body.contactPhone || null,
          companyId: body.companyId,
          ownerId: resolvedOwnerId,
          tenantCompanyId,
          products: body.products ? {
            create: body.products.map(p => ({
              productId: p.productId,
              quantity: p.quantity || 1,
              unitPrice: p.unitPrice,
              discount: p.discount || 0,
              notes: p.notes || null
            }))
          } : undefined
        },
        include: {
          company: true,
          owner: {
            select: { id: true, name: true, email: true }
          },
          products: {
            include: {
              product: true
            }
          },
          project: {
            select: { id: true, number: true, name: true, status: true }
          }
        }
      });

      if (created.stage === 'WON') {
        await syncWonOpportunityCommission(tx, created);
      }

      return created;
    });

    let opportunity;
    try {
      const number = body.number || await prisma.$transaction((tx) => generateOpportunityNumber(tx, clientType));
      opportunity = await createOpportunityWithNumber(number);
    } catch (error) {
      if (body.number || !isUniqueOpportunityNumberError(error)) throw error;
      const number = await prisma.$transaction((tx) => generateAvailableOpportunityNumber(tx, clientType));
      opportunity = await createOpportunityWithNumber(number);
    }
    
    // Atualizar lead score da empresa
    try {
      await updateCompanyLeadScore(body.companyId);
    } catch (error) {
      console.error('Erro ao atualizar lead score:', error);
    }
    
    return Response.json(opportunity);
  }

  if (req.method === "PUT") {
    const body = await req.json();
    const opportunityId = resolveOpportunityId(req, body);

    if (!opportunityId) {
      return new Response('id é obrigatório', { status: 400 });
    }

    const existing = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: {
        ownerId: true,
        tenantCompanyId: true,
        number: true,
        stage: true,
        leadEntryDate: true,
        actualCloseDate: true,
        customerTurnDate: true,
        exitDate: true,
        b2gStage: true,
        lossReason: true,
        stageDecisionDetails: true,
        source: true,
        description: true,
        companyId: true,
        company: { select: { clientType: true, segment: true } }
      }
    });
    if (!existing) return new Response('Not found', { status: 404 });
    if (!isTenantRecordVisible(req.user, existing)) {
      return forbiddenTenantResponse();
    }
    if (!canSeeAllOpportunities(req.user)) {
      if (existing.ownerId !== req.user.userId) {
        return new Response('Forbidden', { status: 403 });
      }
      if (!canAccessClientType(req.user, inferOpportunityClientType(existing))) {
        return new Response('Sem acesso ao módulo desta oportunidade', { status: 403 });
      }
    }
    
    const nextClientType = inferOpportunityClientType(existing);
    const stageDecisionDetails = normalizeStageDecisionDetails(body.stageDecisionDetails, req.user, {
      clientType: nextClientType,
      stage: body.stage || existing.stage,
      b2gStage: body.b2gStage !== undefined ? (body.b2gStage || null) : existing.b2gStage
    });
    const updateData = {};
    if (body.stage !== undefined) updateData.stage = body.stage;
    if (body.b2gStage !== undefined) updateData.b2gStage = body.b2gStage || null;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.projectName !== undefined) updateData.projectName = body.projectName || body.title || null;
    if (body.projectClientType !== undefined) updateData.projectClientType = body.projectClientType || null;
    if (body.negotiationType !== undefined) updateData.negotiationType = body.negotiationType || null;
    if (body.projectClassification !== undefined) updateData.projectClassification = body.projectClassification || null;
    if (body.projectTower !== undefined) updateData.projectTower = body.projectTower || null;
    if (body.projectDetail !== undefined) updateData.projectDetail = body.projectDetail || null;
    if (body.manufacturer !== undefined) updateData.manufacturer = body.manufacturer || null;
    if (body.licenseCount !== undefined) updateData.licenseCount = body.licenseCount === null || body.licenseCount === '' ? null : Number(body.licenseCount);
    if (body.contractMonths !== undefined) updateData.contractMonths = body.contractMonths === null || body.contractMonths === '' ? null : Number(body.contractMonths);
    if (body.monthlyValue !== undefined) updateData.monthlyValue = body.monthlyValue === null || body.monthlyValue === '' ? null : Number(body.monthlyValue);
    if (body.installationFee !== undefined) updateData.installationFee = body.installationFee === null || body.installationFee === '' ? null : Number(body.installationFee);
    if (body.leadSourceDetail !== undefined) updateData.leadSourceDetail = body.leadSourceDetail || null;
    if (body.importSource !== undefined) updateData.importSource = body.importSource || null;
    if (body.importSourceRow !== undefined) updateData.importSourceRow = body.importSourceRow === null || body.importSourceRow === '' ? null : Number(body.importSourceRow);
    if (body.projectType !== undefined) {
      updateData.projectType = normalizeProjectType(body.projectType);
      updateData.projectMonths = normalizeProjectMonths(updateData.projectType, body.projectMonths);
    } else if (body.projectMonths !== undefined) {
      updateData.projectMonths = normalizeProjectMonths(body.projectType || 'MONTHLY', body.projectMonths);
    }
    if (body.description !== undefined) updateData.description = body.description;
    if (body.value !== undefined) updateData.value = body.value;
    if (body.probability !== undefined) updateData.probability = body.probability;
    if (body.expectedCloseDate !== undefined) {
      updateData.expectedCloseDate = body.expectedCloseDate ? new Date(body.expectedCloseDate) : null;
    }
    if (body.leadEntryDate !== undefined) {
      const parsedLeadEntryDate = parseDateInput(body.leadEntryDate);
      if (parsedLeadEntryDate) updateData.leadEntryDate = parsedLeadEntryDate;
    }
    if (body.customerTurnDate !== undefined) updateData.customerTurnDate = parseDateInput(body.customerTurnDate);
    if (body.exitDate !== undefined) updateData.exitDate = parseDateInput(body.exitDate);
    if (body.source !== undefined) updateData.source = body.source || null;
    if (body.companyId !== undefined && body.companyId) {
      if (getTenantCompanyId(req.user)) {
        const company = await prisma.company.findUnique({
          where: { id: body.companyId },
          select: { tenantCompanyId: true }
        });
        if (!company || String(company.tenantCompanyId || '') !== String(getTenantCompanyId(req.user))) {
          return new Response('Empresa não pertence a este tenant', { status: 403 });
        }
      }
      updateData.companyId = body.companyId;
    }
    if (body.ownerId !== undefined && body.ownerId && canSeeAllOpportunities(req.user)) {
      const owner = await prisma.user.findUnique({
        where: { id: body.ownerId },
        select: {
          id: true,
          role: true,
          accessB2B: true,
          accessB2G: true,
          tenantCompanyId: true
        }
      });
      if (!owner) {
        return Response.json({ error: 'Responsável não encontrado' }, { status: 400 });
      }
      if (getTenantCompanyId(req.user) && owner.tenantCompanyId && String(owner.tenantCompanyId) !== String(getTenantCompanyId(req.user))) {
        return Response.json({ error: 'Responsável não pertence a este tenant' }, { status: 403 });
      }
      if (!canOwnOpportunityForClientType(owner, nextClientType)) {
        return Response.json({ error: `Responsável sem acesso ao módulo ${nextClientType}` }, { status: 400 });
      }
      updateData.ownerId = body.ownerId;
    }
    if (body.lossReason !== undefined) {
      updateData.lossReason = body.lossReason || null;
    } else if (stageDecisionDetails !== undefined) {
      const resolvedLossReason = resolveStageDecisionLossReason(stageDecisionDetails);
      if (resolvedLossReason !== undefined) updateData.lossReason = resolvedLossReason;
    }
    if (stageDecisionDetails !== undefined) updateData.stageDecisionDetails = stageDecisionDetails;
    if (body.notes !== undefined) updateData.notes = body.notes;

    // Campos de contato do cliente (nullable, seguros para registros legados)
    if (body.contactName !== undefined) updateData.contactName = body.contactName || null;
    if (body.contactFullName !== undefined) updateData.contactFullName = body.contactFullName || null;
    if (body.contactEmail !== undefined) updateData.contactEmail = body.contactEmail || null;
    if (body.contactPhone !== undefined) updateData.contactPhone = body.contactPhone || null;
    
    // Se mudou para WON ou LOST, definir data de fechamento e data de virada/saída.
    if (body.stage === 'WON' || body.stage === 'LOST') {
      const closingDate = parseDateInput(body.actualCloseDate) || new Date();
      updateData.actualCloseDate = closingDate;
      if (body.stage === 'WON' && body.customerTurnDate === undefined) {
        updateData.customerTurnDate = existing.customerTurnDate || closingDate;
      }
      if (body.stage === 'LOST' && body.exitDate === undefined) {
        updateData.exitDate = existing.exitDate || closingDate;
      }
    } else if (body.stage && stageDecisionDetails === null) {
      updateData.actualCloseDate = null;
      updateData.customerTurnDate = null;
      updateData.exitDate = null;
    }
    
    const opportunity = await prisma.$transaction(async (tx) => {
      const updated = await tx.opportunity.update({
        where: { id: opportunityId },
        data: updateData,
        include: {
          company: true,
          owner: {
            select: { id: true, name: true, email: true }
          },
          products: {
            include: {
              product: true
            }
          },
          project: {
            select: { id: true, number: true, name: true, status: true }
          }
        }
      });

      if (updated.stage === 'WON') {
        await syncWonOpportunityCommission(tx, updated);
      } else if (body.stage && body.stage !== 'WON') {
        await cancelOpenOpportunityCommission(tx, updated.id);
      }

      // Sincronizar produtos se fornecidos no body
      if (Array.isArray(body.products)) {
        // Remove todos os produtos antigos e recria com os novos
        await tx.opportunityProduct.deleteMany({ where: { opportunityId: updated.id } });
        if (body.products.length > 0) {
          await tx.opportunityProduct.createMany({
            data: body.products.map((p) => ({
              opportunityId: updated.id,
              productId: p.productId,
              quantity: Number(p.quantity) || 1,
              unitPrice: Number(p.unitPrice) || 0,
              discount: Number(p.discount) || 0,
              notes: p.notes || null
            }))
          });
        }
        // Recarregar com produtos atualizados
        return tx.opportunity.findUnique({
          where: { id: updated.id },
          include: {
            company: true,
            owner: { select: { id: true, name: true, email: true } },
            products: { include: { product: true } },
            project: { select: { id: true, number: true, name: true, status: true } }
          }
        });
      }

      return updated;
    });
    
    // Atualizar lead score da empresa
    try {
      await updateCompanyLeadScore(opportunity.companyId);
      if (existing.companyId && existing.companyId !== opportunity.companyId) {
        await updateCompanyLeadScore(existing.companyId);
      }
    } catch (error) {
      console.error('Erro ao atualizar lead score:', error);
    }
    
    return Response.json(opportunity);
  }

  if (req.method === "DELETE") {
    const body = await req.json().catch(() => ({}));
    const opportunityId = resolveOpportunityId(req, body);

    if (!opportunityId) {
      return new Response('id é obrigatório', { status: 400 });
    }

    const existing = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: {
        id: true,
        ownerId: true,
        companyId: true,
        tenantCompanyId: true
      }
    });

    if (!existing) {
      return new Response('Oportunidade não encontrada', { status: 404 });
    }

    if (!isTenantRecordVisible(req.user, existing)) {
      return forbiddenTenantResponse();
    }

    if (!canSeeAllOpportunities(req.user) && existing.ownerId !== req.user.userId) {
      return new Response('Forbidden', { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await runOptionalCleanup(() => tx.preSalesRequest.updateMany({
        where: { opportunityId },
        data: { opportunityId: null }
      }));

      await tx.commission.deleteMany({
        where: { opportunityId }
      });

      await tx.competitorComparison.deleteMany({
        where: { opportunityId }
      });

      const proposals = await tx.proposal.findMany({
        where: { opportunityId },
        select: { id: true }
      });
      const proposalIds = proposals.map((item) => item.id);

      if (proposalIds.length > 0) {
        await tx.proposalItem.deleteMany({
          where: { proposalId: { in: proposalIds } }
        });
      }

      await tx.proposal.deleteMany({
        where: { opportunityId }
      });

      await tx.activity.updateMany({
        where: { opportunityId },
        data: { opportunityId: null }
      });

      await tx.opportunityProduct.deleteMany({
        where: { opportunityId }
      });

      await tx.opportunity.delete({
        where: { id: opportunityId }
      });
    });

    try {
      await updateCompanyLeadScore(existing.companyId);
    } catch (error) {
      console.error('Erro ao atualizar lead score após exclusão:', error);
    }

    return Response.json({ success: true, id: opportunityId });
  }

  return new Response("Method not allowed", { status: 405 });
}
