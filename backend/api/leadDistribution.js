import { 
  distributeLeadToSeller,
  createOpportunityForLead,
  redistributeUnattendedLeads,
  getAvailableSellers,
  DISTRIBUTION_STRATEGIES
} from '../lib/leadDistribution.js';
import { prisma } from '../lib/prisma.js';
import { getTenantCompanyId } from '../lib/tenantScope.js';

const assertCompanyAccess = async (user, companyId) => {
  const tenantCompanyId = getTenantCompanyId(user);
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, tenantCompanyId: true }
  });
  if (!company) return { error: 'Empresa não encontrada', status: 404 };
  if (tenantCompanyId && String(company.tenantCompanyId || '') !== tenantCompanyId) {
    return { error: 'Acesso negado', status: 403 };
  }
  return { company, tenantCompanyId: company.tenantCompanyId || null };
};

export default async function handler(req) {
  if (req.method === 'GET') {
    const { action, region } = req.query || {};
    
    try {
      if (action === 'sellers') {
        // Listar vendedores disponíveis
        const sellers = await getAvailableSellers(region, getTenantCompanyId(req.user));
        return Response.json(sellers);
      }
      
      if (action === 'strategies') {
        // Listar estratégias disponíveis
        return Response.json({
          strategies: Object.values(DISTRIBUTION_STRATEGIES),
          descriptions: {
            [DISTRIBUTION_STRATEGIES.ROUND_ROBIN]: 'Distribuição sequencial entre vendedores',
            [DISTRIBUTION_STRATEGIES.LOAD_BALANCE]: 'Distribuição baseada na carga de trabalho',
            [DISTRIBUTION_STRATEGIES.REGION_BASED]: 'Distribuição baseada na região geográfica',
            [DISTRIBUTION_STRATEGIES.SCORE_BASED]: 'Distribuição baseada no score do lead'
          }
        });
      }
      
      return new Response('Action not specified', { status: 400 });
    } catch (error) {
      console.error('Erro na API de distribuição:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const {
      action,
      companyId,
      strategy,
      daysThreshold,
      sellerId,
      projectName,
      projectClientType,
      reason
    } = body;
    
    try {
      if (action === 'distribute') {
        // Distribuir lead específico
        if (!companyId) {
          return new Response('Company ID is required', { status: 400 });
        }
        const accessCheck = await assertCompanyAccess(req.user, companyId);
        if (accessCheck.error) {
          return Response.json({ error: accessCheck.error }, { status: accessCheck.status });
        }
        
        const assignedSeller = await distributeLeadToSeller(
          companyId, 
          strategy || DISTRIBUTION_STRATEGIES.LOAD_BALANCE,
          accessCheck.tenantCompanyId
        );
        
        return Response.json({
          companyId,
          assignedSeller,
          strategy: strategy || DISTRIBUTION_STRATEGIES.LOAD_BALANCE,
          message: 'Lead distribuído com sucesso'
        });
      }
      
      if (action === 'create-opportunity') {
        // Criar oportunidade automática para lead
        if (!companyId) {
          return new Response('Company ID is required', { status: 400 });
        }
        const accessCheck = await assertCompanyAccess(req.user, companyId);
        if (accessCheck.error) {
          return Response.json({ error: accessCheck.error }, { status: accessCheck.status });
        }
        
        const result = await createOpportunityForLead(
          companyId,
          strategy || DISTRIBUTION_STRATEGIES.LOAD_BALANCE,
          sellerId || null,
          projectName || null,
          projectClientType || null
        );
        
        return Response.json(result);
      }

      if (action === 'no-go') {
        if (!companyId) {
          return new Response('Company ID is required', { status: 400 });
        }
        const accessCheck = await assertCompanyAccess(req.user, companyId);
        if (accessCheck.error) {
          return Response.json({ error: accessCheck.error }, { status: accessCheck.status });
        }

        const noGoReason = String(reason || '').trim();
        if (!noGoReason) {
          return Response.json({ error: 'Motivo do No Go é obrigatório' }, { status: 400 });
        }

        const updatedCompany = await prisma.$transaction(async (tx) => {
          const company = await tx.company.findUnique({
            where: { id: companyId },
            select: {
              id: true,
              name: true,
              segment: true,
              tenantCompanyId: true
            }
          });

          if (!company) {
            throw new Error('Empresa não encontrada');
          }

          await tx.activity.create({
            data: {
              type: 'TASK',
              subject: `No Go registrado: ${company.name}`,
              description: noGoReason,
              status: 'COMPLETED',
              priority: 'LOW',
              companyId,
              assignedToId: req.user.id,
              tenantCompanyId: company.tenantCompanyId
            }
          });

          const segment = String(company.segment || '').includes('[NO GO]')
            ? company.segment
            : `${company.segment || 'Lead'} [NO GO]`;

          return tx.company.update({
            where: { id: companyId },
            data: {
              status: 'INACTIVE',
              leadScore: 0,
              segment
            }
          });
        });

        return Response.json({
          company: updatedCompany,
          companyStatus: updatedCompany.status,
          message: 'Lead marcado como No Go com sucesso.'
        });
      }
      
      if (action === 'redistribute-unattended') {
        if (getTenantCompanyId(req.user)) {
          return Response.json({ error: 'Redistribuição global restrita ao administrador global' }, { status: 403 });
        }
        // Redistribuir leads não atendidos
        const results = await redistributeUnattendedLeads(daysThreshold || 3);
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        return Response.json({
          message: `Redistribuição concluída: ${successful} sucessos, ${failed} falhas`,
          results,
          summary: { successful, failed, total: results.length }
        });
      }
      
      return new Response('Action not specified', { status: 400 });
    } catch (error) {
      console.error('Erro na API de distribuição:', error);
      return Response.json({ 
        error: error.message 
      }, { status: 500 });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}
