import { prisma } from "../lib/prisma.js";
import { updateCompanyLeadScore } from '../lib/leadScoring.js';
import { syncCompanyStatusWithOpportunityPipeline } from '../lib/companyStatus.js';
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

const normalizeClientType = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === 'B2B' || normalized === 'B2G' ? normalized : null;
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

const normalizeRole = (user = {}) => String(user.actualRole || user.role || '').trim().toUpperCase();

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
        commission: true
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
    if (!resolvedOwnerId) {
      return new Response('ownerId é obrigatório', { status: 400 });
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
    
    const opportunity = await prisma.$transaction(async (tx) => {
      const number = body.number || await generateOpportunityNumber(tx, clientType);
      const created = await tx.opportunity.create({
        data: {
          number,
          title: body.title || normalizeProjectName(body.projectName, 'Oportunidade sem titulo'),
          projectName: normalizeProjectName(body.projectName, body.title || 'Projeto sem nome'),
          projectClientType: normalizeProjectClientType(body.projectClientType),
          projectType,
          projectMonths,
          description: body.description,
          value: body.value,
          probability: body.probability || 50,
          stage: body.stage || 'LEAD',
          b2gStage: clientType === 'B2G' ? (body.b2gStage || 'ANALISE') : (body.b2gStage || null),
          source: body.source,
          expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null,
          actualCloseDate: ['WON', 'LOST'].includes(body.stage) ? new Date() : null,
          lossReason,
          stageDecisionDetails,
          notes: body.notes,
          companyId: body.companyId,
          ownerId: resolvedOwnerId,
          tenantCompanyId: req.user?.tenantCompanyId || null,
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
            select: { id: true, name: true, email: true }
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
    if (body.lossReason !== undefined) {
      updateData.lossReason = body.lossReason || null;
    } else if (stageDecisionDetails !== undefined) {
      const resolvedLossReason = resolveStageDecisionLossReason(stageDecisionDetails);
      if (resolvedLossReason !== undefined) updateData.lossReason = resolvedLossReason;
    }
    if (stageDecisionDetails !== undefined) updateData.stageDecisionDetails = stageDecisionDetails;
    if (body.notes !== undefined) updateData.notes = body.notes;
    
    // Se mudou para WON ou LOST, definir data de fechamento
    if (body.stage === 'WON' || body.stage === 'LOST') {
      updateData.actualCloseDate = new Date();
    } else if (body.stage && stageDecisionDetails === null) {
      updateData.actualCloseDate = null;
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
