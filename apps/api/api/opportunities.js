import { prisma } from "../lib/prisma.js";
import { updateCompanyLeadScore } from '../lib/leadScoring.js';
import { syncCompanyStatusWithOpportunityPipeline } from '../lib/companyStatus.js';
import { validateCustomerOwnership } from '../lib/customerOwnershipValidator.js';
import {
  normalizeProjectClientType,
  normalizeProjectName
} from '../lib/opportunityProject.js';

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

const extractAgencyName = (body = {}) => {
  if (Object.prototype.hasOwnProperty.call(body, 'orgaoEntidade')) {
    return typeof body.orgaoEntidade === 'string' ? body.orgaoEntidade.trim() : '';
  }
  const candidates = [body.companyName, body.agency, body.company?.name];
  try {
    const description = typeof body.description === 'string'
      ? JSON.parse(body.description)
      : body.description;
    candidates.push(description?.orgaoEntidade, description?.agency, description?.orgao);
  } catch {
    // descrição pode não ser JSON válido
  }
  const found = candidates.find((value) => typeof value === 'string' && value.trim());
  return found ? found.trim() : '';
};

const hasB2GSignal = (value) => /\bB2G\b|\bGOVERNO\b|\bGOV\b|\bLICIT|\bEDITA(?:L|IS)\b|TERMO DE REFER[ÊE]NCIA/i.test(String(value || ''));

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

const normalizeOpportunity = (item) => {
  if (!item || typeof item !== 'object') return item;
  const rawComp = item.company || item.COMPANY || null;
  const company = rawComp ? {
    ...rawComp,
    id: rawComp.id ?? rawComp.ID,
    name: rawComp.name ?? rawComp.NAME ?? 'Empresa B2B',
    document: rawComp.document ?? rawComp.DOCUMENT ?? '',
    segment: rawComp.segment ?? rawComp.SEGMENT ?? '',
    clientType: normalizeClientType(rawComp.clientType ?? rawComp.CLIENTTYPE) || 'B2B',
    contacts: rawComp.contacts ?? rawComp.CONTACTS ?? []
  } : null;

  const rawOwner = item.owner || item.OWNER || null;
  const owner = rawOwner ? {
    ...rawOwner,
    id: rawOwner.id ?? rawOwner.ID,
    name: rawOwner.name ?? rawOwner.NAME ?? 'Responsável',
    email: rawOwner.email ?? rawOwner.EMAIL ?? ''
  } : null;

  return {
    ...item,
    id: item.id ?? item.ID,
    title: item.title ?? item.TITLE ?? 'Oportunidade',
    description: item.description ?? item.DESCRIPTION ?? '',
    value: Number(item.value ?? item.VALUE ?? 0),
    probability: Number(item.probability ?? item.PROBABILITY ?? 50),
    stage: item.stage ?? item.STAGE ?? 'LEAD',
    source: item.source ?? item.SOURCE ?? 'MANUAL',
    leadEntryDate: item.leadEntryDate ?? item.LEADENTRYDATE ?? item.createdAt ?? item.CREATEDAT ?? null,
    expectedCloseDate: item.expectedCloseDate ?? item.EXPECTEDCLOSEDATE ?? null,
    actualCloseDate: item.actualCloseDate ?? item.ACTUALCLOSEDATE ?? null,
    customerTurnDate: item.customerTurnDate ?? item.CUSTOMERTURNDATE ?? (item.stage === 'WON' ? (item.actualCloseDate ?? item.ACTUALCLOSEDATE ?? null) : null),
    exitDate: item.exitDate ?? item.EXITDATE ?? (item.stage === 'LOST' ? (item.actualCloseDate ?? item.ACTUALCLOSEDATE ?? null) : null),
    lossReason: item.lossReason ?? item.LOSSREASON ?? null,
    companyId: item.companyId ?? item.COMPANYID ?? company?.id ?? null,
    ownerId: item.ownerId ?? item.OWNERID ?? owner?.id ?? null,
    createdAt: item.createdAt ?? item.CREATEDAT ?? null,
    updatedAt: item.updatedAt ?? item.UPDATEDAT ?? null,
    notes: item.notes ?? item.NOTES ?? null,
    projectType: item.projectType ?? item.PROJECTTYPE ?? 'SINGLE',
    projectMonths: item.projectMonths ?? item.PROJECTMONTHS ?? 12,
    number: item.number ?? item.NUMBER ?? '',
    b2gStage: item.b2gStage ?? item.B2GSTAGE ?? null,
    projectName: item.projectName ?? item.PROJECTNAME ?? item.title ?? item.TITLE ?? '',
    tenantCompanyId: item.tenantCompanyId ?? item.TENANTCOMPANYID ?? null,
    projectClientType: item.projectClientType ?? item.PROJECTCLIENTTYPE ?? null,
    negotiationType: item.negotiationType ?? item.NEGOTIATIONTYPE ?? null,
    projectClassification: item.projectClassification ?? item.PROJECTCLASSIFICATION ?? null,
    projectTower: item.projectTower ?? item.PROJECTTOWER ?? null,
    projectDetail: item.projectDetail ?? item.PROJECTDETAIL ?? null,
    manufacturer: item.manufacturer ?? item.MANUFACTURER ?? null,
    licenseCount: item.licenseCount ?? item.LICENSECOUNT ?? null,
    contractMonths: item.contractMonths ?? item.CONTRACTMONTHS ?? null,
    monthlyValue: item.monthlyValue ?? item.MONTHLYVALUE ?? null,
    installationFee: item.installationFee ?? item.INSTALLATIONFEE ?? null,
    leadSourceDetail: item.leadSourceDetail ?? item.LEADSOURCEDETAIL ?? null,
    importSource: item.importSource ?? item.IMPORTSOURCE ?? null,
    importSourceRow: item.importSourceRow ?? item.IMPORTSOURCEROW ?? null,
    company,
    owner,
    products: item.products ?? item.PRODUCTS ?? [],
    proposals: item.proposals ?? item.PROPOSALS ?? [],
    activities: item.activities ?? item.ACTIVITIES ?? [],
    commission: item.commission ?? item.COMMISSION ?? null
  };
};

const inferOpportunityClientType = (opportunity, fallback = 'B2B') => {
  const direct = normalizeClientType(opportunity?.clientType || opportunity?.CLIENTTYPE);
  if (direct) return direct;
  if (String(opportunity?.number || opportunity?.NUMBER || '').toUpperCase().startsWith('B2G-')) return 'B2G';
  if (normalizeClientType(opportunity?.projectClientType || opportunity?.PROJECTCLIENTTYPE) === 'B2G') return 'B2G';
  if (opportunity?.b2gStage || opportunity?.B2GSTAGE) return 'B2G';
  if (hasB2GSignal(opportunity?.source || opportunity?.SOURCE)) return 'B2G';
  if (hasB2GDescriptionShape(opportunity?.description || opportunity?.DESCRIPTION)) return 'B2G';
  return inferCompanyClientType(opportunity?.company || opportunity?.COMPANY, fallback);
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

const normalizeRole = (user = {}) => String(user.actualRole || user.role || '').trim().toUpperCase();

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

const isSchemaDriftError = (error) => {
  return error?.code === 'P2021' || error?.code === 'P2022';
};

const runOptionalCleanup = async (operation) => {
  try {
    await operation();
  } catch (error) {
    if (!isSchemaDriftError(error)) {
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

    const where = {};
    if (stage) where.stage = stage;

    // ── Isolamento multi-tenant ──────────────────────────────────────────────
    const isMasterUser = normalizeRole(req.user) === 'MASTER';
    const tenantId = isMasterUser ? null : (req.user?.tenantCompanyId || null);
    if (tenantId) {
      where.tenantCompanyId = tenantId;
    }
    // ────────────────────────────────────────────────────────────────────────

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
          select: { id: true, name: true, email: true, phone: true, role: true, region: { select: { id: true, name: true } } }
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
        commission: true
      },
      orderBy: [
        { stage: 'asc' },
        { expectedCloseDate: 'asc' }
      ]
    });
    
    const normalizedList = opportunities.map(normalizeOpportunity);

    const filtered = normalizedList
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

    const resolvedOwnerId = (canSeeAllOpportunities(req.user) && body.ownerId) ? body.ownerId : (req.user?.userId || req.user?.id);
    if (!resolvedOwnerId) {
      return new Response('ownerId é obrigatório', { status: 400 });
    }
    const owner = await prisma.user.findUnique({
      where: { id: resolvedOwnerId },
      select: { id: true, name: true, email: true, role: true, accessB2B: true, accessB2G: true, tenantCompanyId: true }
    });
    if (!owner) {
      return Response.json({ error: 'Responsável não encontrado' }, { status: 400 });
    }
    if (!canAccessClientType(owner, clientType)) {
      return Response.json({ error: `Responsável sem acesso ao módulo ${clientType}` }, { status: 400 });
    }

    const actorTenantCompanyId = normalizeRole(req.user) === 'MASTER' ? null : (req.user?.tenantCompanyId || null);
    if (actorTenantCompanyId && owner.tenantCompanyId && owner.tenantCompanyId !== actorTenantCompanyId) {
      return Response.json({ error: 'Responsável não pertence a este tenant' }, { status: 403 });
    }
    const tenantCompanyId = actorTenantCompanyId || owner.tenantCompanyId || req.user?.tenantCompanyId || null;

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
    
    let opportunity;
    try {
      opportunity = await prisma.$transaction(async (tx) => {
      // Garantir que companyId seja um ID válido no banco para não falhar a FK
      let resolvedCompanyId = body.companyId;
      const agencyName = extractAgencyName(body);

      let targetCompany = null;
      if (resolvedCompanyId && !String(resolvedCompanyId).startsWith('virtual-')) {
        targetCompany = await tx.company.findFirst({
          where: {
            id: resolvedCompanyId,
            ...(tenantCompanyId ? { tenantCompanyId } : {})
          }
        });
        if (!targetCompany) {
          const error = new Error('Empresa não pertence a este tenant');
          error.status = 403;
          error.payload = { error: error.message };
          throw error;
        }
      }

      if (!targetCompany && agencyName) {
        targetCompany = await tx.company.findFirst({
          where: {
            name: { equals: agencyName, mode: 'insensitive' },
            ...(tenantCompanyId ? { tenantCompanyId } : {})
          }
        });
      }

      if (!targetCompany && agencyName) {
        targetCompany = await tx.company.create({
          data: {
            name: agencyName,
            clientType: clientType === 'B2G' ? 'B2G' : 'B2B',
            segment: clientType === 'B2G' ? 'B2G GOVERNO' : 'B2B',
            status: 'PROSPECT',
            tenantCompanyId
          }
        });
      }

      if (!targetCompany) {
        targetCompany = await tx.company.findFirst({
          where: tenantCompanyId ? { tenantCompanyId } : {}
        });
        if (!targetCompany) {
          targetCompany = await tx.company.create({
            data: {
              name: clientType === 'B2G' ? 'Órgão Público B2G' : 'Cliente Corporativo B2B',
              clientType: clientType === 'B2G' ? 'B2G' : 'B2B',
              segment: clientType === 'B2G' ? 'B2G GOVERNO' : 'B2B',
              status: 'PROSPECT',
              tenantCompanyId
            }
          });
        }
      }

      resolvedCompanyId = targetCompany.id;
      const ownershipDecision = await validateCustomerOwnership(tx, {
        tenantCompanyId,
        requesterId: resolvedOwnerId,
        requesterName: owner.name || owner.email || '',
        companyId: resolvedCompanyId,
        companyName: targetCompany.name || body.companyName || body.company?.name || '',
        document: targetCompany.document || body.document || body.company?.document || '',
        website: targetCompany.website || body.website || body.company?.website || '',
        clientType
      });
      if (!ownershipDecision.permitido) {
        const error = new Error(ownershipDecision.mensagem);
        error.status = 409;
        error.payload = ownershipDecision;
        throw error;
      }

      const number = body.number || await generateOpportunityNumber(tx, clientType);
      const created = await tx.opportunity.create({
        data: {
          number,
          title: body.title || normalizeProjectName(body.projectName, 'Oportunidade sem titulo'),
          projectName: normalizeProjectName(body.projectName, body.title || 'Projeto sem nome'),
          projectClientType: normalizeProjectClientType(body.projectClientType),
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
          contactName: body.contactName || null,
          contactFullName: body.contactFullName || null,
          contactEmail: body.contactEmail || null,
          contactPhone: body.contactPhone || null,
          companyId: resolvedCompanyId,
          ownerId: resolvedOwnerId,
          tenantCompanyId,
          products: body.products ? {
            create: body.products.map(p => ({
              productId: p.productId,
              quantity: p.quantity || 1,
              unitPrice: p.unitPrice,
              discount: p.discount || 0
            }))
          } : undefined
        },
        include: {
          company: true,
          owner: {
            select: { id: true, name: true, email: true, phone: true, role: true, region: { select: { id: true, name: true } } }
          },
          products: {
            include: {
              product: true
            }
          }
        }
      });

      if (created.stage === 'WON') {
        await syncWonOpportunityCommission(tx, created);
      }

        return created;
      });
    } catch (error) {
      if (error?.status && error?.payload) {
        return Response.json(error.payload, { status: error.status });
      }
      throw error;
    }
    
    // Atualizar lead score da empresa
    try {
      await updateCompanyLeadScore(body.companyId);
      await syncCompanyStatusWithOpportunityPipeline(body.companyId);
    } catch (error) {
      console.error('Erro ao atualizar dados derivados da empresa:', error);
    }
    
    return Response.json(opportunity);
  }

  if (req.method === "PUT") {
    const body = await req.json();
    const opportunityId = resolveOpportunityId(req, body);

    if (!opportunityId) {
      return new Response('id é obrigatório', { status: 400 });
    }

    if (!canSeeAllOpportunities(req.user)) {
      const existing = await prisma.opportunity.findUnique({
        where: { id: opportunityId },
        select: {
          ownerId: true,
          number: true,
          stage: true,
          b2gStage: true,
          source: true,
          description: true,
          projectClientType: true,
          company: { select: { clientType: true, segment: true } }
        }
      });
      if (!existing) return new Response('Not found', { status: 404 });
      if (existing.ownerId !== req.user.userId) {
        return new Response('Forbidden', { status: 403 });
      }
      if (!canAccessClientType(req.user, inferOpportunityClientType(existing))) {
        return new Response('Sem acesso ao módulo desta oportunidade', { status: 403 });
      }
    }
    
    const stageDecisionDetails = normalizeStageDecisionDetails(body.stageDecisionDetails, req.user, {
      clientType: resolveRequestedClientType(body, req.query || {}),
      stage: body.stage,
      b2gStage: body.b2gStage
    });
    const updateData = {};
    if (body.stage) updateData.stage = body.stage;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.projectName !== undefined) {
      updateData.projectName = normalizeProjectName(
        body.projectName,
        body.title || 'Projeto sem nome'
      );
    }
    if (body.projectClientType !== undefined) {
      updateData.projectClientType = normalizeProjectClientType(body.projectClientType);
    }
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
    if (body.b2gStage !== undefined) updateData.b2gStage = body.b2gStage || null;
    if (body.expectedCloseDate) updateData.expectedCloseDate = new Date(body.expectedCloseDate);
    if (body.leadEntryDate !== undefined) {
      const parsedLeadEntryDate = parseDateInput(body.leadEntryDate);
      if (parsedLeadEntryDate) updateData.leadEntryDate = parsedLeadEntryDate;
    }
    if (body.customerTurnDate !== undefined) updateData.customerTurnDate = parseDateInput(body.customerTurnDate);
    if (body.exitDate !== undefined) updateData.exitDate = parseDateInput(body.exitDate);
    if (body.lossReason !== undefined) {
      updateData.lossReason = body.lossReason || null;
    } else if (stageDecisionDetails !== undefined) {
      const resolvedLossReason = resolveStageDecisionLossReason(stageDecisionDetails);
      if (resolvedLossReason !== undefined) updateData.lossReason = resolvedLossReason;
    }
    if (stageDecisionDetails !== undefined) updateData.stageDecisionDetails = stageDecisionDetails;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.contactName !== undefined) updateData.contactName = body.contactName || null;
    if (body.contactFullName !== undefined) updateData.contactFullName = body.contactFullName || null;
    if (body.contactEmail !== undefined) updateData.contactEmail = body.contactEmail || null;
    if (body.contactPhone !== undefined) updateData.contactPhone = body.contactPhone || null;
    
    // Se mudou para WON ou LOST, definir data de fechamento e data de virada/saída.
    if (body.stage === 'WON' || body.stage === 'LOST') {
      const closingDate = parseDateInput(body.actualCloseDate) || new Date();
      updateData.actualCloseDate = closingDate;
      if (body.stage === 'WON' && body.customerTurnDate === undefined) {
        updateData.customerTurnDate = closingDate;
      }
      if (body.stage === 'LOST' && body.exitDate === undefined) {
        updateData.exitDate = closingDate;
      }
    } else if (body.stage && stageDecisionDetails === null) {
      updateData.actualCloseDate = null;
      updateData.customerTurnDate = null;
      updateData.exitDate = null;
    }
    
    if (body.companyId) {
      const linkedDocument = await prisma.companyDocument.findFirst({ where: { opportunityId }, select: { companyId: true } });
      if (linkedDocument && linkedDocument.companyId !== body.companyId) {
        return Response.json({ error: 'Esta oportunidade possui documentos vinculados à empresa atual. Remova os anexos antes de alterar a empresa.' }, { status: 409 });
      }
      const linkedContract = await prisma.contract.findFirst({ where: { opportunityId }, select: { companyId: true } });
      if (linkedContract && linkedContract.companyId !== body.companyId) {
        return Response.json({ error: 'Esta oportunidade possui contratos vinculados à empresa atual. Cadastre outra oportunidade para mudar de empresa.' }, { status: 409 });
      }
    }

    const opportunity = await prisma.$transaction(async (tx) => {
      const agencyName = extractAgencyName(body);
      if (agencyName) {
        const currentOpportunity = await tx.opportunity.findUnique({
          where: { id: opportunityId },
          select: { companyId: true }
        });

        const requestedCompanyId = body.companyId && !String(body.companyId).startsWith('virtual-')
          ? body.companyId
          : currentOpportunity?.companyId;

        let targetCompany = null;
        if (requestedCompanyId) {
          targetCompany = await tx.company.findFirst({
            where: {
              id: requestedCompanyId,
              ...(req.user?.tenantCompanyId ? { tenantCompanyId: req.user.tenantCompanyId } : {})
            }
          });
          if (targetCompany) updateData.companyId = targetCompany.id;
        }

        const normalizeCompanyName = (value) => String(value || '').trim().toLowerCase();

        if (targetCompany && normalizeCompanyName(targetCompany.name) !== normalizeCompanyName(agencyName)) {
          const companyWithName = await tx.company.findFirst({
            where: {
              name: { equals: agencyName, mode: 'insensitive' },
              id: { not: targetCompany.id },
              ...(req.user?.tenantCompanyId ? { tenantCompanyId: req.user.tenantCompanyId } : {})
            }
          });

          if (companyWithName) {
            updateData.companyId = companyWithName.id;
          } else {
            await tx.company.update({
              where: { id: targetCompany.id },
              data: { name: agencyName }
            });
          }
        } else if (!targetCompany) {
          const companyWithName = await tx.company.findFirst({
            where: {
              name: { equals: agencyName, mode: 'insensitive' },
              ...(req.user?.tenantCompanyId ? { tenantCompanyId: req.user.tenantCompanyId } : {})
            }
          });

          if (companyWithName) {
            updateData.companyId = companyWithName.id;
          } else {
            const clientType = resolveRequestedClientType(body, req.query || {});
            const createdCompany = await tx.company.create({
              data: {
                name: agencyName,
                clientType,
                segment: clientType === 'B2G' ? 'B2G GOVERNO' : 'B2B',
                status: 'PROSPECT',
                tenantCompanyId: req.user?.tenantCompanyId || null
              }
            });
            updateData.companyId = createdCompany.id;
          }
        }
      }

      const updated = await tx.opportunity.update({
        where: { id: opportunityId },
        data: updateData,
        include: {
          company: true,
          owner: {
            select: { id: true, name: true, email: true, phone: true, role: true, region: { select: { id: true, name: true } } }
          },
          products: {
            include: {
              product: true
            }
          }
        }
      });

      if (updated.stage === 'WON') {
        await syncWonOpportunityCommission(tx, updated);
      } else if (body.stage && body.stage !== 'WON') {
        await cancelOpenOpportunityCommission(tx, updated.id);
      }

      return updated;
    });
    
    // Atualizar lead score da empresa
    try {
      await updateCompanyLeadScore(opportunity.companyId);
      await syncCompanyStatusWithOpportunityPipeline(opportunity.companyId);
    } catch (error) {
      console.error('Erro ao atualizar dados derivados da empresa:', error);
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
        companyId: true
      }
    });

    if (!existing) {
      return new Response('Oportunidade não encontrada', { status: 404 });
    }

    if (!canSeeAllOpportunities(req.user)) {
      if (existing.ownerId !== req.user.userId) {
        return new Response('Forbidden', { status: 403 });
      }
    }

    if (await prisma.companyDocument.count({ where: { opportunityId } })) {
      return Response.json({ error: 'Esta oportunidade possui documentos vinculados. Remova os anexos antes de excluí-la.' }, { status: 409 });
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
      await syncCompanyStatusWithOpportunityPipeline(existing.companyId);
    } catch (error) {
      console.error('Erro ao atualizar dados derivados da empresa após exclusão:', error);
    }

    return Response.json({ success: true, id: opportunityId });
  }

  return new Response("Method not allowed", { status: 405 });
}
