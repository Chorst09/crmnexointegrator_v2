// Encerramento atômico da solicitação, retorno ao comercial e notificação.
const MARKER = '[CRM_ACTIVITY_FLOW]';
const NEGATIVE_STATUSES = ['CANCELADA', 'REPROVADO', 'REJEITADA'];
const CLOSED_STATUSES = [...NEGATIVE_STATUSES, 'FINALIZADA', 'APROVADO'];
const isNegativeStatus = (status) => NEGATIVE_STATUSES.includes(status);
const isClosedRequest = (request) => CLOSED_STATUSES.includes(request?.status);
const parseFlow = (description = '') => {
  const value = String(description || '');
  const index = value.indexOf(MARKER);
  if (index < 0) return { text: value, flow: {} };
  try { return { text: value.slice(0, index).trim(), flow: JSON.parse(value.slice(index + MARKER.length)) }; }
  catch { return { text: value.slice(0, index).trim(), flow: {} }; }
};
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const stageText = (text, stage) => `${String(text || '').replace(/\[FLOW_STAGE:[A-Z_]+\]/g, '').trim()}\n\n[FLOW_STAGE:${stage}]`;
const createPreSalesClosureHandler = ({ prisma, canOperate, tenantId, sourceType = 'REQUEST', forcedStatus }) => async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) fail(401, 'Usuário não autenticado');
    if (!canOperate(req.user)) fail(403, 'Sem permissão para encerrar solicitações de pré-vendas');
    const requestedStatus = forcedStatus || req.body.status;
    if (!isNegativeStatus(requestedStatus)) fail(400, 'Selecione cancelar ou reprovar a cotação');
    const status = requestedStatus === 'REJEITADA' ? 'REPROVADO' : requestedStatus;
    const motivo = typeof (req.body.motivo ?? req.body.observacoes) === 'string'
      ? (req.body.motivo ?? req.body.observacoes).trim() : '';
    if (!motivo) fail(400, 'Informe o motivo do cancelamento ou da reprovação');
    if (motivo.length > 4000) fail(400, 'O motivo deve ter no máximo 4000 caracteres');
    const tenant = tenantId(req.user);
    const role = String(req.user.actualRole || req.user.role || '').toUpperCase();
    if (!tenant && role !== 'MASTER') fail(403, 'Empresa do usuário não identificada');
    const checkTenant = (recordTenant) => {
      if (tenant && recordTenant !== tenant) fail(403, 'Acesso negado a outra empresa');
    };
    const result = await prisma.$transaction(async (tx) => {
      let request = null;
      let activity = null;
      if (sourceType === 'ACTIVITY') {
        activity = await tx.activity.findUnique({ where: { id: req.params.id } });
        if (!activity) fail(404, 'Atividade não encontrada');
        checkTenant(activity.tenantCompanyId);
        const parsed = parseFlow(activity.description);
        if (![parsed.flow.sourceArea, parsed.flow.targetArea].includes('PRE_VENDAS')) fail(400, 'Esta atividade não pertence ao pré-vendas');
        if (parsed.flow.preSalesRequestId) request = await tx.preSalesRequest.findUnique({
          where: { id: parsed.flow.preSalesRequestId },
          include: { solicitante: { select: { tenantCompanyId: true } } }
        });
        if (!request) request = await tx.preSalesRequest.findFirst({
          where: { observacoes: { contains: `[FLOW_ACTIVITY_ID:${activity.id}]` } },
          include: { solicitante: { select: { tenantCompanyId: true } } }
        });
      } else {
        request = await tx.preSalesRequest.findUnique({
          where: { id: req.params.id },
          include: { solicitante: { select: { tenantCompanyId: true } } }
        });
        if (!request) fail(404, 'Solicitação não encontrada');
      }
      if (request) {
        checkTenant(request.solicitante?.tenantCompanyId);
        const linkedId = String(request.observacoes || '').match(/\[FLOW_ACTIVITY_ID:([^\]]+)\]/)?.[1];
        if (linkedId && !activity) {
          activity = await tx.activity.findUnique({ where: { id: linkedId } });
          if (!activity) fail(409, 'Atividade de origem não encontrada. Revise o vínculo antes de encerrar.');
          checkTenant(activity.tenantCompanyId);
        }
      }
      const requestTenant = request?.solicitante?.tenantCompanyId;
      const previousClosure = request?.calculoDetalhes?.encerramento || parseFlow(activity?.description).flow.preSalesClosure;
      if (previousClosure?.status === status) return { solicitacao: request, returnedActivityId: activity?.id || null, encerramento: previousClosure, alreadyClosed: true };
      if ((request && isClosedRequest(request)) || (!request && ['COMPLETED', 'CANCELLED'].includes(activity?.status)) || previousClosure) fail(409, 'Esta solicitação já foi encerrada');
      const parsed = parseFlow(activity?.description);
      const originFromNotes = [...String(request?.observacoes || '').matchAll(/Origem:\s*([^\n\r]+)/gi)].pop()?.[1]?.trim();
      const origin = parsed.flow.sourceArea === 'PRE_VENDAS'
        ? parsed.flow.targetArea : parsed.flow.sourceArea || originFromNotes || 'COMERCIAL';
      const recipientId = activity?.assignedToId || request?.solicitanteId;
      if (!recipientId) fail(409, 'Responsável comercial não identificado');
      const now = new Date();
      const encerramento = { status, motivo, porId: userId, porNome: req.user.name || req.user.email || 'Pré-Vendas', em: now.toISOString(), origem: origin };
      const label = status === 'CANCELADA' ? 'Cotação cancelada' : 'Cotação reprovada';
      const reference = request?.numero || activity?.subject || activity?.id;
      const note = `${label}: ${reference}\nMotivo: ${motivo}\nResponsável: ${encerramento.porNome}\nData: ${encerramento.em}`;
      if (request) {
        const details = request.calculoDetalhes && typeof request.calculoDetalhes === 'object' ? request.calculoDetalhes : {};
        // Compare-and-set impede duplicação de retorno/notificação em cliques concorrentes.
        const changed = await tx.preSalesRequest.updateMany({
          where: { id: request.id, status: request.status, updatedAt: request.updatedAt },
          data: {
            status,
            observacoes: stageText(`${request.observacoes || ''}\n\n${note}`, status === 'CANCELADA' ? 'CANCELADA' : 'REPROVADO'),
            calculoDetalhes: { ...details, encerramento, historicoEncerramentos: [...(Array.isArray(details.historicoEncerramentos) ? details.historicoEncerramentos : []), encerramento] },
            ...(status === 'REPROVADO' ? { dataRejeicao: now, rejeitadoPorId: userId } : {})
          }
        });
        if (changed.count !== 1) fail(409, 'A solicitação foi alterada. Atualize a página e tente novamente.');
        await tx.preSalesApproval.create({ data: {
          preSalesRequestId: request.id, aprovadorId: userId,
          status: status === 'CANCELADA' ? 'CANCELLED' : 'REJECTED', observacoes: motivo
        } });
        request = await tx.preSalesRequest.findUnique({ where: { id: request.id }, include: { solicitante: { select: { id: true, name: true, email: true } }, items: true } });
      }
      // O retorno fica pendente para o comercial tomar ciência e tratar a demanda.
      // Não copia custos, margens ou informações internas da cotação para o comercial.
      const flow = {
        ...parsed.flow,
        sourceArea: 'PRE_VENDAS', targetArea: origin === 'PRE_VENDAS' ? 'COMERCIAL' : origin,
        activityStage: 'RETORNO_PRE_VENDAS', returnedFromPreSales: true,
        preSalesStatus: status, preSalesClosure: encerramento,
        preSalesRequestId: request?.id || null, preSalesNumber: request?.numero || null,
        preSalesReturnedAt: now.toISOString()
      };
      for (const key of ['items', 'custoTotal', 'margemLucro', 'margemMedia', 'observacoesTecnicas', 'valorTotal', 'valorMensal', 'valorSetup', 'valorSugerido']) delete flow[key];
      const originalText = parsed.text.replace(/\s*-\s*Custo(?: Unit)?: R\$ [0-9.,]+ \| Margem: [0-9.,]+%/g, '').replace(/Margem (?:de Contribuição Média|Média de Lucro): [0-9.,]+%?\n?/gi, '');
      const displayNote = note.replaceAll(MARKER, '[CRM ACTIVITY FLOW]');
      const description = `${stageText(`${displayNote}\n\nSolicitação: ${request?.titulo || activity?.subject || ''}${originalText ? `\n\n--- Histórico anterior ---\n${originalText}` : ''}`, status === 'CANCELADA' ? 'CANCELADA' : 'REPROVADO')}\n\n${MARKER}${JSON.stringify(flow)}`;
      if (activity) {
        const changed = await tx.activity.updateMany({
          where: { id: activity.id, status: activity.status, description: activity.description },
          data: { status: 'PENDING', completedAt: null, description }
        });
        if (changed.count !== 1) fail(409, 'A atividade foi alterada. Atualize a página e tente novamente.');
      } else {
        activity = await tx.activity.create({ data: {
          subject: `${label} — ${reference}`, type: 'TASK', status: 'PENDING', priority: request.prioridade,
          assignedToId: recipientId, tenantCompanyId: requestTenant || tenant || null,
          companyId: request.leadId || null, opportunityId: request.opportunityId || null, description
        } });
        // Vínculo explícito permite recuperar o retorno sem associar demandas de outro orçamento.
        request = await tx.preSalesRequest.update({ where: { id: request.id }, data: { observacoes: `${request.observacoes}\n[FLOW_ACTIVITY_ID:${activity.id}]` } });
      }
      await tx.notification.create({ data: {
        type: 'WORKFLOW', channel: 'IN_APP', status: 'SENT', sentAt: now,
        recipientId, title: `${label} — ${reference}`, message: note
      } });
      return { solicitacao: request, returnedActivityId: activity.id, encerramento, alreadyClosed: false };
    });
    return res.json({ success: true, message: result.alreadyClosed ? 'Solicitação já encerrada; retorno preservado' : 'Cotação encerrada e motivo enviado ao comercial', data: result.solicitacao, ...result });
  } catch (error) {
    if (!error.status) console.error('Erro ao encerrar cotação:', error);
    return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Não foi possível encerrar a cotação. Nenhuma alteração foi salva.' });
  }
};

// Estes retornos são sempre pessoais, inclusive para administradores.
const registerCommercialReturnNotifications = (router, prisma) => {
  const ownWhere = (req) => ({
    recipientId: req.user?.userId || req.user?.id,
    type: 'WORKFLOW', channel: 'IN_APP',
    OR: [{ title: { startsWith: 'Cotação cancelada — ' } }, { title: { startsWith: 'Cotação reprovada — ' } }]
  });
  router.get('/retornos-comerciais', async (req, res) => {
    if (!(req.user?.userId || req.user?.id)) return res.status(401).json({ message: 'Usuário não autenticado' });
    try {
      const where = ownWhere(req);
      const [notifications, unread] = await Promise.all([
        prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 20 }),
        prisma.notification.count({ where: { ...where, readAt: null } })
      ]);
      return res.json({ notifications, unread });
    } catch (error) {
      console.error('Erro ao buscar retornos de pré-vendas:', error);
      return res.status(500).json({ message: 'Não foi possível carregar os retornos de pré-vendas' });
    }
  });
  router.post('/retornos-comerciais/:notificationId/ler', async (req, res) => {
    if (!(req.user?.userId || req.user?.id)) return res.status(401).json({ message: 'Usuário não autenticado' });
    try {
      const changed = await prisma.notification.updateMany({
        where: { ...ownWhere(req), id: req.params.notificationId },
        data: { status: 'READ', readAt: new Date() }
      });
      if (!changed.count) return res.status(404).json({ message: 'Retorno não encontrado' });
      return res.json({ success: true });
    } catch (error) {
      console.error('Erro ao ler retorno de pré-vendas:', error);
      return res.status(500).json({ message: 'Não foi possível marcar o retorno como lido' });
    }
  });
};

module.exports = { registerCommercialReturnNotifications, createPreSalesClosureHandler, isNegativeStatus, isClosedRequest, parseClosureFlow: parseFlow };
