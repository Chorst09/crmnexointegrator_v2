const REJECTED = new Set(['REPROVADO', 'REJEITADA', 'REJECTED']);

export const getActivityDisplayStatus = (activity) => {
  const flow = activity?.flow || {};
  const decision = flow.preSalesClosure?.status || activity?.preSalesRequest?.calculoDetalhes?.encerramento?.status || flow.preSalesStatus;
  if (REJECTED.has(decision)) return 'REJECTED';
  if (decision === 'CANCELADA') return 'CANCELLED';
  // Atividades legadas gravavam ambas as decisões como CANCELLED.
  if (activity?.status === 'CANCELLED') {
    const stage = [...String(activity.description || '').matchAll(/\[FLOW_STAGE:([A-Z_]+)\]/g)].pop()?.[1];
    if (REJECTED.has(stage)) return 'REJECTED';
    return 'CANCELLED';
  }
  if (activity?.status === 'PENDING') return 'PENDING';
  if (flow.activityStage === 'PROPOSTA_ENVIADA') return 'PROPOSAL_SENT';
  return activity?.status || 'PENDING';
};

export const isOverdue = (dueDate, status) => {
  if (!dueDate || ['COMPLETED', 'CANCELLED', 'REJECTED', 'PROPOSAL_SENT'].includes(status)) return false;
  const date = new Date(dueDate).getTime();
  return Number.isFinite(date) && date < Date.now();
};
