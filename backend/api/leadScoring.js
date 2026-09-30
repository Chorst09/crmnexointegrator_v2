import { 
  calculateLeadScore, 
  updateCompanyLeadScore, 
  recalculateAllLeadScores,
  getCompaniesByScoreRange,
  getLeadClassification 
} from '../lib/leadScoring.js';

export default async function handler(req) {
  if (req.method === 'GET') {
    const { action, companyId, minScore, maxScore } = req.query || {};
    
    try {
      if (action === 'calculate' && companyId) {
        // Calcular score de uma empresa específica
        const score = await calculateLeadScore(companyId);
        const classification = getLeadClassification(score);
        
        return Response.json({ 
          companyId, 
          score, 
          classification 
        });
      }
      
      if (action === 'range') {
        // Buscar empresas por faixa de score
        const companies = await getCompaniesByScoreRange(
          parseInt(minScore) || 0,
          parseInt(maxScore) || 100
        );
        
        const companiesWithClassification = companies.map(company => ({
          ...company,
          classification: getLeadClassification(company.leadScore)
        }));
        
        return Response.json(companiesWithClassification);
      }
      
      if (action === 'stats') {
        // Estatísticas de lead scoring
        const hotLeads = await getCompaniesByScoreRange(80, 100);
        const warmLeads = await getCompaniesByScoreRange(60, 79);
        const coldLeads = await getCompaniesByScoreRange(40, 59);
        const lowPriority = await getCompaniesByScoreRange(0, 39);
        
        return Response.json({
          hotLeads: hotLeads.length,
          warmLeads: warmLeads.length,
          coldLeads: coldLeads.length,
          lowPriority: lowPriority.length,
          total: hotLeads.length + warmLeads.length + coldLeads.length + lowPriority.length
        });
      }
      
      return new Response('Action not specified', { status: 400 });
    } catch (error) {
      console.error('Erro na API de lead scoring:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const { action, companyId } = body;
    
    try {
      if (action === 'update' && companyId) {
        // Atualizar score de uma empresa específica
        const score = await updateCompanyLeadScore(companyId);
        const classification = getLeadClassification(score);
        
        return Response.json({ 
          companyId, 
          score, 
          classification,
          message: 'Lead score atualizado com sucesso' 
        });
      }
      
      if (action === 'recalculate-all') {
        // Recalcular todos os scores
        const results = await recalculateAllLeadScores();
        
        const successful = results.filter(r => !r.error).length;
        const failed = results.filter(r => r.error).length;
        
        return Response.json({
          message: `Lead scores recalculados: ${successful} sucessos, ${failed} falhas`,
          results,
          summary: { successful, failed, total: results.length }
        });
      }
      
      return new Response('Action not specified', { status: 400 });
    } catch (error) {
      console.error('Erro na API de lead scoring:', error);
      return new Response('Internal server error', { status: 500 });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}