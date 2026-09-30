import { prisma } from './prisma.js';

// Algoritmo de Lead Scoring
export async function calculateLeadScore(companyId) {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        opportunities: {
          include: {
            activities: true
          }
        },
        activities: true,
        contacts: true
      }
    });

    if (!company) return 0;

    let score = 0;

    // 1. Pontuação por tamanho da empresa (0-25 pontos)
    const sizeScores = {
      MICRO: 5,
      SMALL: 10,
      MEDIUM: 15,
      LARGE: 20,
      ENTERPRISE: 25
    };
    score += sizeScores[company.size] || 0;

    // 2. Pontuação por segmento (0-20 pontos)
    const highValueSegments = [
      'TECNOLOGIA', 'FINANCEIRO', 'SAUDE', 'EDUCACAO', 
      'TELECOMUNICACOES', 'ENERGIA', 'MANUFATURA'
    ];
    if (company.segment && highValueSegments.includes(company.segment.toUpperCase())) {
      score += 20;
    } else if (company.segment) {
      score += 10;
    }

    // 3. Pontuação por completude dos dados (0-15 pontos)
    let completenessScore = 0;
    if (company.document) completenessScore += 3;
    if (company.website) completenessScore += 3;
    if (company.address) completenessScore += 2;
    if (company.city && company.state) completenessScore += 2;
    if (company.contacts.length > 0) completenessScore += 5;
    score += completenessScore;

    // 4. Pontuação por engajamento - atividades (0-20 pontos)
    const recentActivities = company.activities.filter(activity => {
      const activityDate = new Date(activity.createdAt);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return activityDate >= thirtyDaysAgo;
    });

    const activityScore = Math.min(recentActivities.length * 2, 20);
    score += activityScore;

    // 5. Pontuação por oportunidades (0-20 pontos)
    const activeOpportunities = company.opportunities.filter(opp => 
      !['WON', 'LOST'].includes(opp.stage)
    );
    
    if (activeOpportunities.length > 0) {
      score += 10;
      
      // Bonus por estágio avançado
      const advancedStages = ['PROPOSAL', 'NEGOTIATION'];
      const advancedOpps = activeOpportunities.filter(opp => 
        advancedStages.includes(opp.stage)
      );
      score += Math.min(advancedOpps.length * 5, 10);
    }

    // 6. Pontuação por valor das oportunidades (0-15 pontos)
    const totalOpportunityValue = activeOpportunities.reduce((sum, opp) => sum + opp.value, 0);
    if (totalOpportunityValue > 100000) score += 15;
    else if (totalOpportunityValue > 50000) score += 10;
    else if (totalOpportunityValue > 10000) score += 5;

    // 7. Pontuação por recência de interação (0-10 pontos)
    const allActivities = [
      ...company.activities,
      ...company.opportunities.flatMap(opp => opp.activities)
    ];
    
    if (allActivities.length > 0) {
      const lastActivity = allActivities.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      )[0];
      
      const daysSinceLastActivity = Math.floor(
        (new Date() - new Date(lastActivity.createdAt)) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceLastActivity <= 7) score += 10;
      else if (daysSinceLastActivity <= 15) score += 7;
      else if (daysSinceLastActivity <= 30) score += 5;
      else if (daysSinceLastActivity <= 60) score += 2;
    }

    // 8. Bonus por múltiplos contatos (0-5 pontos)
    if (company.contacts.length > 1) {
      score += Math.min(company.contacts.length - 1, 5);
    }

    // Garantir que o score não exceda 100
    score = Math.min(score, 100);

    return Math.round(score);
  } catch (error) {
    console.error('Erro ao calcular lead score:', error);
    return 0;
  }
}

// Função para atualizar o score de uma empresa
export async function updateCompanyLeadScore(companyId) {
  try {
    const score = await calculateLeadScore(companyId);
    
    await prisma.company.update({
      where: { id: companyId },
      data: { leadScore: score }
    });

    return score;
  } catch (error) {
    console.error('Erro ao atualizar lead score:', error);
    throw error;
  }
}

// Função para recalcular scores de todas as empresas
export async function recalculateAllLeadScores(clientType = null) {
  try {
    const normalizedClientType = String(clientType || '').trim().toUpperCase();
    const companies = await prisma.company.findMany({
      where: normalizedClientType === 'B2B' || normalizedClientType === 'B2G'
        ? { clientType: normalizedClientType }
        : undefined,
      select: { id: true }
    });

    const results = [];
    
    for (const company of companies) {
      try {
        const score = await updateCompanyLeadScore(company.id);
        results.push({ companyId: company.id, score });
      } catch (error) {
        console.error(`Erro ao atualizar score da empresa ${company.id}:`, error);
        results.push({ companyId: company.id, error: error.message });
      }
    }

    return results;
  } catch (error) {
    console.error('Erro ao recalcular todos os lead scores:', error);
    throw error;
  }
}

// Função para obter empresas por faixa de score
export async function getCompaniesByScoreRange(minScore = 0, maxScore = 100, clientType = null) {
  try {
    const normalizedClientType = String(clientType || '').trim().toUpperCase();
    return await prisma.company.findMany({
      where: {
        leadScore: {
          gte: minScore,
          lte: maxScore
        },
        ...(normalizedClientType === 'B2B' || normalizedClientType === 'B2G'
          ? { clientType: normalizedClientType }
          : {})
      },
      include: {
        contacts: true,
        opportunities: {
          where: {
            stage: {
              notIn: ['WON', 'LOST']
            }
          }
        }
      },
      orderBy: {
        leadScore: 'desc'
      }
    });
  } catch (error) {
    console.error('Erro ao buscar empresas por score:', error);
    throw error;
  }
}

// Classificação de leads por score
export function getLeadClassification(score) {
  if (score >= 80) return { label: 'Hot Lead', color: '#ef4444', priority: 'URGENT' };
  if (score >= 60) return { label: 'Warm Lead', color: '#f59e0b', priority: 'HIGH' };
  if (score >= 40) return { label: 'Cold Lead', color: '#3b82f6', priority: 'MEDIUM' };
  return { label: 'Low Priority', color: '#6b7280', priority: 'LOW' };
}
