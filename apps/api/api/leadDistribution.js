import { 
  distributeLeadToSeller,
  createOpportunityForLead,
  redistributeUnattendedLeads,
  getAvailableSellers,
  DISTRIBUTION_STRATEGIES
} from '../lib/leadDistribution.js';

export default async function handler(req) {
  if (req.method === 'GET') {
    const { action, region } = req.query || {};
    
    try {
      if (action === 'sellers') {
        // Listar vendedores disponíveis
        const sellers = await getAvailableSellers(region);
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
      projectClientType
    } = body;
    
    try {
      if (action === 'distribute') {
        // Distribuir lead específico
        if (!companyId) {
          return new Response('Company ID is required', { status: 400 });
        }
        
        const assignedSeller = await distributeLeadToSeller(
          companyId, 
          strategy || DISTRIBUTION_STRATEGIES.LOAD_BALANCE
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
        
        const result = await createOpportunityForLead(
          companyId,
          strategy || DISTRIBUTION_STRATEGIES.LOAD_BALANCE,
          sellerId || null,
          projectName || null,
          projectClientType || null
        );
        
        return Response.json(result);
      }
      
      if (action === 'redistribute-unattended') {
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
