import { prisma } from './prisma.js';
import { syncCompanyStatusWithOpportunityPipeline } from './companyStatus.js';
import {
  PROJECT_CLIENT_TYPES,
  normalizeProjectClientType,
  normalizeProjectName
} from './opportunityProject.js';

// Estratégias de distribuição
export const DISTRIBUTION_STRATEGIES = {
  ROUND_ROBIN: 'ROUND_ROBIN',
  LOAD_BALANCE: 'LOAD_BALANCE',
  REGION_BASED: 'REGION_BASED',
  SCORE_BASED: 'SCORE_BASED'
};

const normalizeExcludedSellerIds = (excludeSellerIds = []) => {
  if (!Array.isArray(excludeSellerIds)) return [];
  return [...new Set(excludeSellerIds.map((id) => String(id || '').trim()).filter(Boolean))];
};

// User.region e uma relacao (Region), nao um campo escalar. Passar a regiao como
// string em `where.region` faz o Prisma lancar e a busca inteira e descartada.
const buildRegionFilter = (region) => {
  const value = String(region || '').trim();
  if (!value) return undefined;
  return {
    OR: [
      { code: { equals: value, mode: 'insensitive' } },
      { state: { equals: value, mode: 'insensitive' } },
      { name: { equals: value, mode: 'insensitive' } }
    ]
  };
};

// UFs -> macrorregioes, para casar Company.state com Region.code
const STATE_TO_REGION = {
  SP: 'SUDESTE', RJ: 'SUDESTE', MG: 'SUDESTE', ES: 'SUDESTE',
  RS: 'SUL', SC: 'SUL', PR: 'SUL',
  GO: 'CENTRO_OESTE', MT: 'CENTRO_OESTE', MS: 'CENTRO_OESTE', DF: 'CENTRO_OESTE',
  BA: 'NORDESTE', PE: 'NORDESTE', CE: 'NORDESTE', MA: 'NORDESTE', PI: 'NORDESTE',
  RN: 'NORDESTE', PB: 'NORDESTE', SE: 'NORDESTE', AL: 'NORDESTE',
  AM: 'NORTE', PA: 'NORTE', AC: 'NORTE', RO: 'NORTE', RR: 'NORTE', AP: 'NORTE', TO: 'NORTE'
};

const resolveRegionFromState = (state) => {
  const uf = String(state || '').trim().toUpperCase();
  return STATE_TO_REGION[uf] || null;
};

// Region.code guarda tanto UF (SP) quanto macrorregiao (SUL). Testa a UF antes da
// macrorregiao para respeitar o cadastro de regioes existente.
const resolveRegionCandidates = (state) => {
  const uf = String(state || '').trim().toUpperCase();
  const macro = STATE_TO_REGION[uf];
  return [uf, macro].filter(Boolean);
};

// Retorna o vendedor com menos oportunidades ativas do pool informado
const pickLeastLoaded = (sellers) =>
  sellers.reduce((min, seller) =>
    seller.activeOpportunities < min.activeOpportunities ? seller : min
  );

// Busca o pool de vendedores de uma regiao e, se nao houver nenhum, tenta os
// candidatos restantes e por fim o pool geral. Devolve [] (sem lancar) para a
// estrategia poder degradar sem quebrar a conversao.
const resolveSellerPool = async (region, options) => {
  const candidates = (Array.isArray(region) ? region : [region])
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const sellers = await getAvailableSellers(candidate, options);
    if (sellers.length > 0) return sellers;
  }

  // Sem candidatos (region nulo) ou sem seller em nenhum deles: pool geral
  return getAvailableSellers(null, options);
};

// Funcao para obter vendedores disponiveis
export async function getAvailableSellers(region = null, options = {}) {
  try {
    const excludedSellerIds = normalizeExcludedSellerIds(options.excludeSellerIds);
    const where = {
      role: 'SELLER'
    };

    const regionFilter = buildRegionFilter(region);
    if (regionFilter) {
      where.region = regionFilter;
    }

    if (excludedSellerIds.length > 0) {
      where.id = {
        notIn: excludedSellerIds
      };
    }

    const sellers = await prisma.user.findMany({
      where,
      include: {
        opportunities: {
          where: {
            stage: {
              notIn: ['WON', 'LOST']
            }
          }
        },
        _count: {
          select: {
            opportunities: {
              where: {
                stage: {
                  notIn: ['WON', 'LOST']
                }
              }
            }
          }
        }
      }
    });

    return sellers.map(seller => ({
      ...seller,
      activeOpportunities: seller._count.opportunities,
      totalValue: seller.opportunities.reduce((sum, opp) => sum + opp.value, 0)
    }));
  } catch (error) {
    console.error('Erro ao buscar vendedores:', error);
    return [];
  }
}

// Distribuicao Round Robin. Devolve null quando nao ha vendedor elegivel.
export async function distributeRoundRobin(companyId, region = null, options = {}) {
  try {
    const sellers = await resolveSellerPool(region, options);

    if (sellers.length === 0) {
      return null;
    }

    const regionFilter = buildRegionFilter(region);

    // Buscar o último vendedor que recebeu um lead
    const lastAssignment = await prisma.opportunity.findFirst({
      where: {
        owner: {
          role: 'SELLER',
          ...(regionFilter ? { region: regionFilter } : {})
        }
      },
      include: {
        owner: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    let nextSellerIndex = 0;
    
    if (lastAssignment) {
      const lastSellerIndex = sellers.findIndex(s => s.id === lastAssignment.ownerId);
      nextSellerIndex = (lastSellerIndex + 1) % sellers.length;
    }

    return sellers[nextSellerIndex];
  } catch (error) {
    console.error('Erro na distribuição round robin:', error);
    throw error;
  }
}

// Distribuicao por Balanceamento de Carga. Devolve null quando nao ha vendedor elegivel.
export async function distributeLoadBalance(companyId, region = null, options = {}) {
  try {
    const sellers = await resolveSellerPool(region, options);

    if (sellers.length === 0) {
      return null;
    }

    // Encontrar o vendedor com menos oportunidades ativas
    return pickLeastLoaded(sellers);
  } catch (error) {
    console.error('Erro na distribuição por carga:', error);
    throw error;
  }
}

// Distribuição Baseada em Região
export async function distributeRegionBased(companyId, options = {}) {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { state: true }
    });

    if (!company || !company.state) {
      // Se não tem região definida, usar round robin
      return await distributeRoundRobin(companyId, null, options);
    }

    const region = resolveRegionCandidates(company.state);

    if (region.length > 0) {
      // Tentar distribuir para vendedor da região
      const regionalSeller = await distributeLoadBalance(companyId, region, options);
      if (regionalSeller) {
        return regionalSeller;
      }
    }

    // Se não encontrou vendedor na região, usar distribuição geral
    return await distributeLoadBalance(companyId, null, options);
  } catch (error) {
    console.error('Erro na distribuição por região:', error);
    throw error;
  }
}

// Distribuição Baseada em Score
export async function distributeScoreBased(companyId, options = {}) {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { leadScore: true, state: true }
    });

    if (!company) {
      throw new Error('Empresa não encontrada');
    }

    // Prioriza o pool da região do lead, com queda para o pool geral
    const region = resolveRegionCandidates(company.state);
    const sellers = await resolveSellerPool(region, options);

    if (sellers.length === 0) {
      throw new Error('Nenhum vendedor disponível');
    }

    // Para leads de alto score (>= 70), atribuir ao vendedor mais experiente
    if (company.leadScore >= 70) {
      // Vendedor com maior quota ou mais oportunidades fechadas
      const topSeller = sellers.reduce((best, seller) => {
        const sellerQuota = seller.quota || 0;
        const bestQuota = best.quota || 0;
        return sellerQuota > bestQuota ? seller : best;
      });
      
      return topSeller;
    }

    // Para leads de score médio (40-69), usar balanceamento de carga
    if (company.leadScore >= 40) {
      return await distributeLoadBalance(companyId, region, options);
    }

    // Para leads de baixo score (<40), usar round robin
    return await distributeRoundRobin(companyId, region, options);
  } catch (error) {
    console.error('Erro na distribuição por score:', error);
    throw error;
  }
}

// Função principal de distribuição
export async function distributeLeadToSeller(
  companyId,
  strategy = DISTRIBUTION_STRATEGIES.LOAD_BALANCE,
  options = {}
) {
  try {
    let assignedSeller;

    switch (strategy) {
      case DISTRIBUTION_STRATEGIES.ROUND_ROBIN:
        assignedSeller = await distributeRoundRobin(companyId, null, options);
        break;
      
      case DISTRIBUTION_STRATEGIES.LOAD_BALANCE:
        assignedSeller = await distributeLoadBalance(companyId, null, options);
        break;
      
      case DISTRIBUTION_STRATEGIES.REGION_BASED:
        assignedSeller = await distributeRegionBased(companyId, options);
        break;
      
      case DISTRIBUTION_STRATEGIES.SCORE_BASED:
        assignedSeller = await distributeScoreBased(companyId, options);
        break;
      
      default:
        assignedSeller = await distributeLoadBalance(companyId, null, options);
    }

    if (!assignedSeller) {
      throw new Error('Nenhum vendedor disponível');
    }

    return assignedSeller;
  } catch (error) {
    console.error('Erro na distribuição de lead:', error);
    throw error;
  }
}

// Criar oportunidade automaticamente para novo lead
export async function createOpportunityForLead(
  companyId,
  strategy = DISTRIBUTION_STRATEGIES.LOAD_BALANCE,
  sellerId = null,
  projectName = null,
  projectClientType = null
) {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        contacts: {
          where: { isPrimary: true },
          take: 1
        }
      }
    });

    if (!company) {
      throw new Error('Empresa não encontrada');
    }

    // Verificar se já existe oportunidade ativa para esta empresa
    const existingOpportunity = await prisma.opportunity.findFirst({
      where: {
        companyId,
        stage: {
          notIn: ['WON', 'LOST']
        }
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, regionId: true, quota: true }
        }
      }
    });

    if (existingOpportunity) {
      const syncResult = await syncCompanyStatusWithOpportunityPipeline(companyId);
      const alreadyConverted = existingOpportunity.stage !== 'LEAD';
      return {
        opportunity: existingOpportunity,
        assignedSeller: existingOpportunity.owner,
        companyStatus: syncResult?.status || company.status,
        convertedToOpportunity: alreadyConverted,
        message: alreadyConverted
          ? 'Lead já convertido em oportunidade'
          : 'Lead já distribuído e aguardando avaliação do vendedor'
      };
    }

    // Distribuir para vendedor (manual ou automático)
    let assignedSeller = null;

    if (sellerId) {
      assignedSeller = await prisma.user.findFirst({
        where: {
          id: sellerId,
          role: 'SELLER'
        },
        select: {
          id: true,
          name: true,
          email: true,
          regionId: true,
          quota: true
        }
      });

      if (!assignedSeller) {
        throw new Error('Vendedor selecionado não encontrado ou inválido');
      }
    } else {
      assignedSeller = await distributeLeadToSeller(companyId, strategy);
    }

    // Criar oportunidade
    const resolvedProjectName = normalizeProjectName(
      projectName,
      `Projeto ${company.name}`
    );
    const resolvedProjectClientType = normalizeProjectClientType(projectClientType);

    const opportunity = await prisma.opportunity.create({
      data: {
        title: `Oportunidade - ${resolvedProjectName}`,
        projectName: resolvedProjectName,
        projectClientType: resolvedProjectClientType,
        description: `Lead automático gerado para ${company.name}`,
        value: 0, // Será atualizado pelo vendedor
        probability: 25, // Probabilidade inicial baixa
        stage: 'LEAD',
        source: 'MANUAL', // Pode ser ajustado conforme a origem
        companyId,
        ownerId: assignedSeller.id
      },
      include: {
        company: true,
        owner: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Criar atividade de follow-up automática
    await prisma.activity.create({
      data: {
        type: 'FOLLOW_UP',
        subject: `Contatar novo lead: ${company.name}`,
        description: `Lead distribuído automaticamente. Fazer contato inicial com ${company.name}.`,
        status: 'PENDING',
        priority: company.leadScore >= 70 ? 'HIGH' : company.leadScore >= 40 ? 'MEDIUM' : 'LOW',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
        companyId,
        opportunityId: opportunity.id,
        assignedToId: assignedSeller.id
      }
    });

    const syncResult = await syncCompanyStatusWithOpportunityPipeline(companyId);

    return {
      opportunity,
      assignedSeller,
      companyStatus: syncResult?.status || company.status,
      convertedToOpportunity: false,
      strategyUsed: sellerId ? 'MANUAL' : strategy,
      message: 'Lead distribuído para avaliação do vendedor'
    };
  } catch (error) {
    console.error('Erro ao criar oportunidade para lead:', error);
    throw error;
  }
}

// Redistribuir leads não atendidos
export async function redistributeUnattendedLeads(daysThreshold = 3) {
  try {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

    // Buscar oportunidades em estágio LEAD sem atividades recentes
    const unattendedOpportunities = await prisma.opportunity.findMany({
      where: {
        stage: 'LEAD',
        createdAt: {
          lte: thresholdDate
        },
        activities: {
          none: {
            createdAt: {
              gte: thresholdDate
            }
          }
        }
      },
      include: {
        company: true,
        owner: true
      }
    });

    const redistributionResults = [];

    for (const opportunity of unattendedOpportunities) {
      try {
        // Redistribuir para outro vendedor
        const newSeller = await distributeLeadToSeller(
          opportunity.companyId, 
          DISTRIBUTION_STRATEGIES.LOAD_BALANCE,
          { excludeSellerIds: [opportunity.ownerId] }
        );

        // Atualizar oportunidade
        await prisma.opportunity.update({
          where: { id: opportunity.id },
          data: { ownerId: newSeller.id }
        });

        // Criar atividade de redistribuição
        await prisma.activity.create({
          data: {
            type: 'TASK',
            subject: `Lead redistribuído: ${opportunity.company.name}`,
            description: `Lead redistribuído de ${opportunity.owner.name} para ${newSeller.name} devido à falta de atividade.`,
            status: 'PENDING',
            priority: 'HIGH',
            dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 horas
            companyId: opportunity.companyId,
            opportunityId: opportunity.id,
            assignedToId: newSeller.id
          }
        });

        redistributionResults.push({
          opportunityId: opportunity.id,
          companyName: opportunity.company.name,
          fromSeller: opportunity.owner.name,
          toSeller: newSeller.name,
          success: true
        });
      } catch (error) {
        redistributionResults.push({
          opportunityId: opportunity.id,
          companyName: opportunity.company.name,
          error: error.message,
          success: false
        });
      }
    }

    return redistributionResults;
  } catch (error) {
    console.error('Erro ao redistribuir leads:', error);
    throw error;
  }
}
