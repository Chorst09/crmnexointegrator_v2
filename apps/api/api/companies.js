import companyVisibility from '../lib/company-visibility.cjs';
const { companyVisibilityWhere, canViewCompany, ownCompaniesOnly } = companyVisibility;
import { prisma } from '../lib/prisma.js';
import { updateCompanyLeadScore } from '../lib/leadScoring.js';
import { createOpportunityForLead, DISTRIBUTION_STRATEGIES } from '../lib/leadDistribution.js';
import { validateCustomerOwnership } from '../lib/customerOwnershipValidator.js';

const parsePathIdFromUrl = (urlValue) => {
  if (!urlValue) return null;

  const cleanPath = String(urlValue).split('?')[0];
  const segments = cleanPath
    .split('/')
    .filter(Boolean)
    .filter((segment) => !['api', 'companies'].includes(segment));
  return segments.length > 0 ? decodeURIComponent(segments[segments.length - 1]) : null;
};

const resolveCompanyId = (req, body) => {
  return body?.id || req.query?.id || parsePathIdFromUrl(req.url);
};

const parseDateInput = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeContacts = (contacts) => {
  if (!Array.isArray(contacts)) return [];

  const mapped = contacts
    .filter((contact) => contact && typeof contact === 'object')
    .map((contact, index) => ({
      name: String(contact.name || '').trim(),
      email: contact.email || null,
      phone: contact.phone || null,
      position: contact.position || null,
      isPrimary: index === 0 || Boolean(contact.isPrimary)
    }))
    .filter((contact) => contact.name.length > 0);

  if (mapped.length === 0) return [];

  const firstPrimaryIndex = mapped.findIndex((contact) => contact.isPrimary);
  return mapped.map((contact, index) => ({
    ...contact,
    isPrimary: firstPrimaryIndex === -1 ? index === 0 : index === firstPrimaryIndex
  }));
};

const normalizeCompanyStatus = (value, fallback = 'ACTIVE') => {
  const raw = String(value || '').trim().toUpperCase();
  if (['LEAD', 'PROSPECT', 'ACTIVE', 'INACTIVE', 'CHURNED'].includes(raw)) return raw;
  if (['SUSPENDED', 'CANCELED'].includes(raw)) return 'INACTIVE';
  return fallback;
};

const normalizeModuleAccess = (body = {}, fallback = {}) => {
  const accessB2B = body.accessB2B !== undefined ? Boolean(body.accessB2B) : fallback.accessB2B !== undefined ? Boolean(fallback.accessB2B) : true;
  const accessB2G = body.accessB2G !== undefined ? Boolean(body.accessB2G) : fallback.accessB2G !== undefined ? Boolean(fallback.accessB2G) : false;
  const accessPreSales = body.accessPreSales !== undefined ? Boolean(body.accessPreSales) : fallback.accessPreSales !== undefined ? Boolean(fallback.accessPreSales) : false;
  return {
    accessB2B,
    accessB2G,
    accessPreSales,
    accessManagement: accessB2B && accessB2G
  };
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


const resolveAssignment = async (user, body, tenantCompanyId, creating) => {
  const restricted = ownCompaniesOnly(user) && (body.clientType || 'B2B') === 'B2B';
  const selfId = user.userId || user.id;
  if (restricted && body.accountManagerId && body.accountManagerId !== selfId) {
    return { error: 'Você só pode atribuir empresas B2B a si mesmo.' };
  }
  const id = restricted ? selfId : body.accountManagerId;
  if (!restricted && !creating && id === undefined) return { data: {} };
  if (!id) return { data: { accountManagerId: null, accountManagerName: null } };
  const owner = await prisma.user.findFirst({
    where: { id, tenantCompanyId: tenantCompanyId || null },
    select: { id: true, name: true }
  });
  if (!owner) return { error: 'Responsável inválido para esta empresa.' };
  return { data: { accountManagerId: owner.id, accountManagerName: owner.name } };
};

export default async function handler(req) {
  if (req.method === 'GET') {
    const clientType = String(req.query?.clientType || '').toUpperCase();
    const where = clientType === 'B2B' || clientType === 'B2G' ? { clientType } : {};
    const id = resolveCompanyId(req);
    
    // Se tem ID, buscar empresa específica com todos os relacionamentos
    if (id) {
      const company = await prisma.company.findUnique({
        where: { id },
        include: {
          contacts: true,
          opportunities: {
            include: {
              owner: { select: { id: true, name: true, email: true } }
            },
            orderBy: { createdAt: 'desc' }
          },
          contracts: { orderBy: { createdAt: 'desc' } },
          documents: {
            orderBy: { createdAt: 'desc' },
            select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true }
          },
          activities: {
            include: { assignedTo: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'desc' }
          },
          _count: { select: { opportunities: true, activities: true, contracts: true } }
        }
      });

      if (!company) {
        return new Response('Empresa não encontrada', { status: 404 });
      }

      // Verificar isolamento de tenant
      const isMasterUser = String(req.user?.actualRole || req.user?.role || '').toUpperCase() === 'MASTER';
      const tenantId = isMasterUser ? null : (req.user?.tenantCompanyId || null);
      if (tenantId && company.tenantCompanyId && company.tenantCompanyId !== tenantId) {
        return new Response('Acesso negado', { status: 403 });
      }

      if (!await canViewCompany(prisma, req.user, company.id)) return new Response('Acesso negado', { status: 403 });
      return Response.json(company);
    }

    // Listagem de empresas
    if (clientType === 'B2B' || clientType === 'B2G') {
      where.clientType = clientType;
    }

    // Isolamento multi-tenant
    const isMasterUser = String(req.user?.actualRole || req.user?.role || '').toUpperCase() === 'MASTER';
    const tenantId = isMasterUser ? null : (req.user?.tenantCompanyId || null);
    if (tenantId) {
      where.tenantCompanyId = tenantId;
    }



    const companies = await prisma.company.findMany({
      where: { ...where, ...companyVisibilityWhere(req.user) },
      include: {
        contacts: true,
        opportunities: {
          include: {
            owner: true
          }
        },
        _count: {
          select: {
            opportunities: true,
            activities: true,
            contracts: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const normalizedCompanies = companies.map((c) => {
      if (!c || typeof c !== 'object') return c;
      return {
        ...c,
        id: c.id ?? c.ID,
        name: c.name ?? c.NAME ?? 'Empresa Sem Nome',
        document: c.document ?? c.DOCUMENT ?? '',
        segment: c.segment ?? c.SEGMENT ?? '',
        subsegment: c.subsegment ?? c.SUBSEGMENT ?? '',
        clientType: c.clientType ?? c.CLIENTTYPE ?? 'B2B',
        status: c.status ?? c.STATUS ?? 'ACTIVE',
        size: c.size ?? c.SIZE ?? 'MEDIUM',
        website: c.website ?? c.WEBSITE ?? '',
        address: c.address ?? c.ADDRESS ?? '',
        city: c.city ?? c.CITY ?? '',
        state: c.state ?? c.STATE ?? '',
        country: c.country ?? c.COUNTRY ?? 'Brasil',
        regionId: c.regionId ?? c.REGIONID ?? null,
        leadScore: c.leadScore ?? c.LEADSCORE ?? 50,
        churnRisk: c.churnRisk ?? c.CHURNRISK ?? 0,
        leadEntryDate: c.leadEntryDate ?? c.LEADENTRYDATE ?? c.createdAt ?? c.CREATEDAT ?? null,
        accountManagerName: c.accountManagerName ?? c.ACCOUNTMANAGERNAME ?? '',
        createdAt: c.createdAt ?? c.CREATEDAT ?? null,
        updatedAt: c.updatedAt ?? c.UPDATEDAT ?? null,
        contacts: c.contacts ?? c.CONTACTS ?? [],
        opportunities: c.opportunities ?? c.OPPORTUNITIES ?? []
      };
    });

    return Response.json(normalizedCompanies);
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const regionId = req.user?.role === 'SELLER' ? (req.user.regionId || null) : (body.regionId || null);
    const contactsToCreate = normalizeContacts(body.contacts);
    const autoDistribute = body.autoDistribute !== false;

    const isMasterUser = String(req.user?.actualRole || req.user?.role || '').toUpperCase() === 'MASTER';
    const tenantId = isMasterUser ? (body.tenantCompanyId || null) : (req.user?.tenantCompanyId || null);
    const requesterId = req.user?.userId || req.user?.id || null;
    const requesterName = req.user?.name || req.user?.email || '';
    const ownershipDecision = await validateCustomerOwnership(prisma, {
      tenantCompanyId: tenantId,
      requesterId,
      requesterName,
      companyName: body.name,
      document: body.document,
      website: body.website,
      clientType: body.clientType === 'B2G' ? 'B2G' : 'B2B'
    });
    if (!ownershipDecision.permitido) {
      return Response.json(ownershipDecision, { status: 409 });
    }

    const assignment = await resolveAssignment(req.user, body, tenantId, true);
    if (assignment.error) return new Response(assignment.error, { status: 403 });
    const company = await prisma.company.create({
      data: {
        name: body.name,
        document: body.document,
        segment: body.segment,
        subsegment: body.subsegment,
        clientType: body.clientType === 'B2G' ? 'B2G' : body.clientType === 'B2B' ? 'B2B' : undefined,
        ...normalizeModuleAccess(body),
        size: body.size,
        website: body.website,
        address: body.address,
        city: body.city,
        state: body.state,
        status: normalizeCompanyStatus(body.status, 'LEAD'),
        leadScore: Number.isFinite(Number(body.leadScore)) ? Number(body.leadScore) : undefined,
        leadEntryDate: parseDateInput(body.leadEntryDate) || new Date(),
        ...assignment.data,
        regionId,
        tenantCompanyId: tenantId,
        contacts: contactsToCreate.length > 0
          ? { create: contactsToCreate }
          : undefined
      },
      include: {
        contacts: true
      }
    });
    
    // Calcular lead score automaticamente
    try {
      await updateCompanyLeadScore(company.id);
    } catch (error) {
      console.error('Erro ao calcular lead score:', error);
    }
    
    // Se é um lead, criar oportunidade e distribuir automaticamente
    if (company.status === 'LEAD' && autoDistribute) {
      try {
        const distributionResult = await createOpportunityForLead(
          company.id, 
          DISTRIBUTION_STRATEGIES.SCORE_BASED
        );
        
        return Response.json({
          ...company,
          autoDistribution: distributionResult
        });
      } catch (error) {
        console.error('Erro na distribuição automática:', error);
        // Retorna a empresa mesmo se a distribuição falhar
        return Response.json(company);
      }
    }
    
    return Response.json(company);
  }

  if (req.method === 'PUT') {
    const body = await req.json();
    const companyId = resolveCompanyId(req, body);

    if (!companyId) return new Response('id é obrigatório', { status: 400 });
    const contactsToSave = normalizeContacts(body.contacts);
    const isMasterUser = String(req.user?.actualRole || req.user?.role || '').toUpperCase() === 'MASTER';
    const tenantId = isMasterUser ? null : (req.user?.tenantCompanyId || null);

    const existingCompany = await prisma.company.findUnique({
      where: { id: companyId },
      select: { accessB2B: true, accessB2G: true, accessPreSales: true, tenantCompanyId: true }
    });
    if (!existingCompany) return new Response('Empresa não encontrada', { status: 404 });
    if (!await canViewCompany(prisma, req.user, companyId)) return new Response('Acesso negado', { status: 403 });

    if (tenantId && existingCompany.tenantCompanyId && existingCompany.tenantCompanyId !== tenantId) {
      return new Response('Acesso negado', { status: 403 });
    }

    const assignment = await resolveAssignment(req.user, body, existingCompany.tenantCompanyId, false);
    if (assignment.error) return new Response(assignment.error, { status: 403 });
    const company = await prisma.$transaction(async (tx) => {
      const updatedCompany = await tx.company.update({
        where: { id: companyId },
        data: {
          name: body.name,
          document: body.document,
          segment: body.segment,
          subsegment: body.subsegment,
          clientType: body.clientType === 'B2G' ? 'B2G' : body.clientType === 'B2B' ? 'B2B' : undefined,
          ...normalizeModuleAccess(body, existingCompany),
          size: body.size,
          website: body.website,
          address: body.address,
          city: body.city,
          state: body.state,
          status: body.status !== undefined ? normalizeCompanyStatus(body.status) : undefined,
          leadScore: body.leadScore,
          leadEntryDate: body.leadEntryDate !== undefined ? parseDateInput(body.leadEntryDate) || undefined : undefined,
          ...assignment.data,
          tenantCompanyId: isMasterUser && body.tenantCompanyId !== undefined ? body.tenantCompanyId : undefined
        },
        include: {
          contacts: true,
          opportunities: true
        }
      });

      if (Array.isArray(body.contacts)) {
        await tx.contact.deleteMany({
          where: { companyId }
        });

        if (contactsToSave.length > 0) {
          await tx.contact.createMany({
            data: contactsToSave.map((contact) => ({
              ...contact,
              companyId
            }))
          });
        }

        return tx.company.findUnique({
          where: { id: companyId },
          include: {
            contacts: true,
            opportunities: true
          }
        });
      }

      return updatedCompany;
    });
    
    // Recalcular lead score automaticamente
    try {
      await updateCompanyLeadScore(company.id);
    } catch (error) {
      console.error('Erro ao recalcular lead score:', error);
    }
    
    return Response.json(company);
  }

  if (req.method === 'DELETE') {
    const body = await req.json().catch(() => ({}));
    const companyId = resolveCompanyId(req, body);

    if (!companyId) return new Response('id é obrigatório', { status: 400 });

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        regionId: true,
        _count: {
          select: {
            opportunities: true,
            contracts: true
          }
        }
      }
    });

    if (!company) return new Response('Empresa não encontrada', { status: 404 });
    if (!await canViewCompany(prisma, req.user, companyId)) return new Response('Acesso negado', { status: 403 });


    try {
      await prisma.$transaction(async (tx) => {
        const companyOpportunities = await tx.opportunity.findMany({
          where: { companyId },
          select: { id: true }
        });
        const opportunityIds = companyOpportunities.map((item) => item.id);

        if (opportunityIds.length > 0) {
          // Pré-vendas vinculadas à oportunidade
          await runOptionalCleanup(() => tx.preSalesRequest.updateMany({
            where: { opportunityId: { in: opportunityIds } },
            data: { opportunityId: null }
          }));

          // Comissões e comparativos de concorrente vinculados à oportunidade
          await tx.commission.deleteMany({
            where: { opportunityId: { in: opportunityIds } }
          });

          await tx.competitorComparison.deleteMany({
            where: { opportunityId: { in: opportunityIds } }
          });

          // Propostas vinculadas às oportunidades (e seus itens)
          const proposals = await tx.proposal.findMany({
            where: { opportunityId: { in: opportunityIds } },
            select: { id: true }
          });
          const proposalIds = proposals.map((item) => item.id);

          if (proposalIds.length > 0) {
            await tx.proposalItem.deleteMany({
              where: { proposalId: { in: proposalIds } }
            });
          }

          await tx.proposal.deleteMany({
            where: { opportunityId: { in: opportunityIds } }
          });

          // Atividades podem apontar para oportunidade (set null antes de excluir)
          await tx.activity.updateMany({
            where: { opportunityId: { in: opportunityIds } },
            data: { opportunityId: null }
          });

          // Produtos da oportunidade e oportunidade em si
          await tx.opportunityProduct.deleteMany({
            where: { opportunityId: { in: opportunityIds } }
          });

          await tx.opportunity.deleteMany({
            where: { id: { in: opportunityIds } }
          });
        }

        const companyContracts = await tx.contract.findMany({
          where: { companyId },
          select: { id: true }
        });
        const contractIds = companyContracts.map((item) => item.id);

        if (contractIds.length > 0) {
          // Referências opcionais para contrato
          await runOptionalCleanup(() => tx.customerOnboarding.updateMany({
            where: { contractId: { in: contractIds } },
            data: { contractId: null }
          }));

          await runOptionalCleanup(() => tx.nPSSurvey.updateMany({
            where: { contractId: { in: contractIds } },
            data: { contractId: null }
          }));

          await runOptionalCleanup(() => tx.contractAttachment.deleteMany({
            where: { contractId: { in: contractIds } }
          }));

          await tx.contract.deleteMany({
            where: { id: { in: contractIds } }
          });
        }

        // Núcleo do CRM (sempre presente)
        await tx.activity.updateMany({
          where: { companyId },
          data: { companyId: null }
        });

        await tx.contact.deleteMany({
          where: { companyId }
        });

        // Módulos opcionais (podem não existir em alguns bancos locais)
        await runOptionalCleanup(() => tx.supportTicket.updateMany({
          where: { companyId },
          data: { companyId: null }
        }));

        await runOptionalCleanup(() => tx.nPSSurvey.updateMany({
          where: { companyId },
          data: { companyId: null }
        }));

        await runOptionalCleanup(() => tx.preSalesRequest.updateMany({
          where: { leadId: companyId },
          data: { leadId: null }
        }));

        await runOptionalCleanup(() => tx.onboardingStep.deleteMany({
          where: {
            onboarding: {
              companyId
            }
          }
        }));

        await runOptionalCleanup(() => tx.customerOnboarding.deleteMany({
          where: { companyId }
        }));

        await runOptionalCleanup(() => tx.churnAlert.deleteMany({
          where: { companyId }
        }));

        await runOptionalCleanup(() => tx.companyDocument.deleteMany({
          where: { companyId }
        }));

        await tx.company.delete({
          where: { id: companyId }
        });
      });
    } catch (error) {
      if (error?.code === 'P2003') {
        return Response.json(
          {
            error: 'Não foi possível excluir: a empresa possui vínculos ativos em outros módulos.'
          },
          { status: 409 }
        );
      }
      throw error;
    }

    return Response.json({ success: true, message: 'Empresa excluída com sucesso' });
  }

  return new Response('Method not allowed', { status: 405 });
}
