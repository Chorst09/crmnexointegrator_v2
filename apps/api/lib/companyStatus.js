import { prisma } from './prisma.js';

const CLOSED_STAGES = ['WON', 'LOST'];

// Mantém o status da empresa alinhado com o estado do funil de oportunidades.
export async function syncCompanyStatusWithOpportunityPipeline(
  companyId,
  prismaClient = prisma
) {
  if (!companyId) return null;

  const company = await prismaClient.company.findUnique({
    where: { id: companyId },
    select: { id: true, status: true }
  });

  if (!company) return null;

  const opportunities = await prismaClient.opportunity.findMany({
    where: { companyId },
    select: { stage: true }
  });

  if (opportunities.length === 0) {
    return { companyId: company.id, status: company.status, changed: false };
  }

  const hasWon = opportunities.some((item) => item.stage === 'WON');
  const hasLeadOpen = opportunities.some((item) => item.stage === 'LEAD');
  const hasQualifiedOpen = opportunities.some(
    (item) => !CLOSED_STAGES.includes(item.stage) && item.stage !== 'LEAD'
  );

  let nextStatus = company.status;

  if (hasWon) {
    nextStatus = 'ACTIVE';
  } else if (hasQualifiedOpen) {
    nextStatus = 'PROSPECT';
  } else if (hasLeadOpen) {
    // Lead distribuído, ainda aguardando avaliação do vendedor.
    nextStatus = 'LEAD';
  }

  if (nextStatus === company.status) {
    return { companyId: company.id, status: company.status, changed: false };
  }

  const updated = await prismaClient.company.update({
    where: { id: companyId },
    data: { status: nextStatus },
    select: { id: true, status: true }
  });

  return { companyId: updated.id, status: updated.status, changed: true };
}
