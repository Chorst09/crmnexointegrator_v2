const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const clone = (value) => structuredClone(value);
const operator = { userId: 'engineer', name: 'Engenharia', role: 'SELLER', actualRole: 'USER', accessPreSales: true, tenantCompanyId: 'double' };
const description = (flow = {}) => `Solicitação original\n\n[CRM_ACTIVITY_FLOW]${JSON.stringify({ sourceArea: 'B2B', targetArea: 'PRE_VENDAS', ...flow })}`;

function setup(base, options = {}) {
  let state = {
    request: options.activityOnly ? null : {
      id: 'request', numero: 'ORC-0004-2026', titulo: 'Wi-Fi', status: 'EM_PRECIFICACAO', prioridade: 'URGENT',
      solicitanteId: options.unlinked ? 'seller' : 'engineer', solicitante: { tenantCompanyId: options.tenant || 'double' },
      updatedAt: new Date('2026-11-04T13:00:00Z'),
      observacoes: options.unlinked ? 'Origem: B2G' : '[FLOW_ACTIVITY_ID:activity]\nOrigem: B2B',
      calculoDetalhes: { cotacoes: [{ id: 'cost-1', custo: 200 }] }, items: []
    },
    approvals: [],
    activity: options.unlinked ? null : {
      id: 'activity', assignedToId: 'seller', tenantCompanyId: options.activityTenant || options.tenant || 'double',
      subject: 'Solicitação de Wi-Fi', description: description({ items: [{ custoUnitario: 999 }], margemMedia: 50 }), status: 'IN_PROGRESS'
    }, notifications: []
  };
  const matches = (row, where) => row && Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    if (key === 'observacoes' && value?.contains) return row.observacoes.includes(value.contains);
    return row[key] instanceof Date ? row[key].getTime() === value.getTime() : row[key] === value;
  });
  const table = (name) => ({
    findUnique: async ({ where }) => matches(state[name], where) ? clone(state[name]) : null,
    findFirst: async ({ where }) => matches(state[name], where) ? clone(state[name]) : null,
    updateMany: async ({ where, data }) => {
      if (options.conflict && name === 'activity') return { count: 0 };
      if (!matches(state[name], where)) return { count: 0 };
      Object.assign(state[name], clone(data));
      return { count: 1 };
    },
    update: async ({ data }) => { Object.assign(state[name], clone(data)); return clone(state[name]); },
    create: async ({ data }) => { state[name] = { id: 'returned-activity', ...clone(data) }; return clone(state[name]); }
  });
  const prisma = {
    preSalesRequest: table('request'), activity: table('activity'),
    preSalesApproval: { create: async ({ data }) => { state.approvals.push(clone(data)); return data; } },
    notification: { create: async ({ data }) => {
      if (options.notificationFailure) throw new Error('notification unavailable');
      state.notifications.push(clone(data)); return data;
    } },
    $transaction: async (callback) => {
      const before = clone(state);
      try { return await callback(prisma); }
      catch (error) { state = before; throw error; }
    }
  };
  const routes = {};
  const router = Object.fromEntries(['use', 'get', 'post', 'put', 'patch', 'delete'].map(method => [method, (route, ...handlers) => { routes[`${method} ${route}`] = handlers.at(-1); }]));
  for (const file of ['pre-vendas.cjs', 'activities-simple.cjs']) {
    const filename = path.resolve(base, 'api', file);
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
      require(name) {
        if (name === 'express') return { Router: () => router };
        if (name.includes('prisma')) return { prisma };
        if (name.includes('auth')) return { authenticateToken() {} };
        return require(path.resolve(path.dirname(filename), name));
      }, module: { exports: {} }, console: { error() {} }
    });
  }
  const invoke = async (route = 'post /:id/encerrar', { status = 'CANCELADA', motivo = 'Cliente desistiu do projeto.', user = operator, rawBody, ...body } = {}) => {
    const result = { status: 200 };
    const res = { status(code) { result.status = code; return this; }, json(data) { result.data = data; return this; } };
    await routes[route]({ params: { id: route.includes('prevendas') ? 'activity' : 'request' }, user, body: rawBody || { status, motivo, ...body } }, res);
    return result;
  };
  return { invoke, state: () => state };
}

for (const base of ['apps/api', 'backend']) {
  for (const status of ['CANCELADA', 'REPROVADO']) {
    test(`${base}: ${status} registra motivo e devolve para o vendedor original atomicamente`, async () => {
      const { invoke, state } = setup(base);
      const result = await invoke(undefined, { status, motivo: '  Sem viabilidade técnica.\nNecessário rever o escopo.  ' });
      assert.equal(result.status, 200);
      assert.equal(state().request.status, status);
      const closure = state().request.calculoDetalhes.encerramento;
      assert.equal(closure.motivo, 'Sem viabilidade técnica.\nNecessário rever o escopo.');
      assert.equal(closure.porId, 'engineer');
      assert.ok(Date.parse(closure.em));
      assert.deepEqual(state().request.calculoDetalhes.cotacoes, [{ id: 'cost-1', custo: 200 }]);
      assert.equal(state().request.calculoDetalhes.historicoEncerramentos.length, 1);
      assert.equal(state().approvals[0].status, status === 'CANCELADA' ? 'CANCELLED' : 'REJECTED');
      assert.equal(state().approvals[0].observacoes, closure.motivo);
      const flow = JSON.parse(state().activity.description.split('[CRM_ACTIVITY_FLOW]')[1]);
      assert.equal(flow.targetArea, 'B2B');
      assert.equal(flow.preSalesClosure.status, status);
      assert.equal(flow.items, undefined);
      assert.equal(flow.margemMedia, undefined);
      assert.equal(state().activity.status, 'CANCELLED');
      assert.equal(state().activity.assignedToId, 'seller');
      assert.match(state().activity.description, /Solicitação original/);
      assert.equal(state().notifications.length, 1);
      assert.equal(state().notifications[0].recipientId, 'seller');
      assert.match(state().notifications[0].message, /Sem viabilidade técnica/);
      if (status === 'REPROVADO') assert.equal(state().request.rejeitadoPorId, 'engineer');
    });
  }
  for (const motivo of ['', '   ', null, 123, 'x'.repeat(4001)]) {
    test(`${base}: motivo inválido (${String(motivo).length} caracteres) não altera a demanda`, async () => {
      const { invoke, state } = setup(base);
      assert.equal((await invoke(undefined, { motivo })).status, 400);
      assert.equal(state().request.status, 'EM_PRECIFICACAO');
      assert.equal(state().notifications.length, 0);
    });
  }
  test(`${base}: somente pré-vendas/admin da mesma empresa pode encerrar`, async () => {
    for (const user of [{ ...operator, accessPreSales: false }, { ...operator, tenantCompanyId: 'other' }, { ...operator, tenantCompanyId: null }]) {
      const { invoke, state } = setup(base);
      assert.equal((await invoke(undefined, { user })).status, 403);
      assert.equal(state().request.status, 'EM_PRECIFICACAO');
    }
    assert.equal((await setup(base).invoke(undefined, { user: null })).status, 401);
  });
  test(`${base}: vínculo com atividade de outra empresa é bloqueado`, async () => {
    const { invoke, state } = setup(base, { activityTenant: 'other' });
    assert.equal((await invoke()).status, 403);
    assert.equal(state().request.status, 'EM_PRECIFICACAO');
  });
  test(`${base}: repetição preserva motivo e não duplica retorno`, async () => {
    const { invoke, state } = setup(base);
    await invoke();
    const retry = await invoke(undefined, { motivo: 'Outra justificativa' });
    assert.equal(retry.status, 200);
    assert.equal(retry.data.alreadyClosed, true);
    assert.equal(state().request.calculoDetalhes.encerramento.motivo, 'Cliente desistiu do projeto.');
    assert.equal(state().notifications.length, 1);
    assert.equal((await invoke(undefined, { status: 'REPROVADO' })).status, 409);
  });
  test(`${base}: cria retorno ao solicitante quando orçamento não tem atividade`, async () => {
    const { invoke, state } = setup(base, { unlinked: true });
    assert.equal((await invoke()).status, 200);
    assert.equal(state().activity.assignedToId, 'seller');
    assert.equal(state().activity.tenantCompanyId, 'double');
    assert.match(state().activity.description, /"targetArea":"B2G"/);
    assert.match(state().request.observacoes, /FLOW_ACTIVITY_ID:returned-activity/);
  });
  test(`${base}: trata atividade sem orçamento e atividade vinculada`, async () => {
    for (const activityOnly of [false, true]) {
      const { invoke, state } = setup(base, { activityOnly });
      assert.equal((await invoke('post /:id/encerrar-prevendas', { status: 'REPROVADO' })).status, 200);
      assert.equal(state().request?.status || 'REPROVADO', 'REPROVADO');
      assert.equal(state().notifications[0].recipientId, 'seller');
    }
  });
  test(`${base}: falha de notificação ou conflito desfaz todo o encerramento`, async () => {
    for (const options of [{ notificationFailure: true }, { conflict: true }]) {
      const { invoke, state } = setup(base, options);
      const result = await invoke();
      assert.equal(result.status, options.conflict ? 409 : 500);
      assert.equal(state().request.status, 'EM_PRECIFICACAO');
      assert.equal(state().activity.status, 'IN_PROGRESS');
      assert.equal(state().notifications.length, 0);
      assert.equal(state().approvals.length, 0);
    }
  });
  test(`${base}: APIs legadas também exigem motivo e usam o retorno completo`, async () => {
    for (const route of ['put /:id', 'post /:id/rejeitar']) {
      const { invoke, state } = setup(base);
      assert.equal((await invoke(route, { motivo: '' })).status, 400);
      assert.equal((await invoke(route)).status, 200);
      assert.equal(state().notifications.length, 1);
    }
  });
  test(`${base}: retorno encerrado não pode voltar para pendente, iniciar ou concluir`, async () => {
    const { invoke, state } = setup(base);
    await invoke();
    const before = state().activity.description;
    const commercial = { ...operator, userId: 'seller', accessPreSales: false };
    for (const status of ['PENDING', 'IN_PROGRESS', 'COMPLETED']) {
      assert.equal((await invoke('put /', { user: commercial, rawBody: { id: 'activity', status } })).status, 409);
      assert.equal(state().activity.status, 'CANCELLED');
      assert.equal(state().activity.description, before);
      assert.equal(state().request.status, 'CANCELADA');
    }
  });
  test(`${base}: cancelamento pela API de atividades exige motivo e sincroniza o orçamento`, async () => {
    const { invoke, state } = setup(base);
    assert.equal((await invoke('put /', { rawBody: { id: 'activity', status: 'CANCELLED' } })).status, 400);
    assert.equal((await invoke('put /', { rawBody: { id: 'activity', status: 'CANCELLED', motivo: 'Projeto suspenso' } })).status, 200);
    assert.equal(state().request.status, 'CANCELADA');
    assert.equal(state().notifications.length, 1);
  });
  test(`${base}: cotação encerrada não pode ser reaberta por edição nem enviada/calculada/aprovada`, async () => {
    const { invoke, state } = setup(base);
    await invoke();
    for (const route of ['put /:id', 'post /:id/devolver-comercial', 'post /:id/calcular', 'post /:id/aprovar']) {
      assert.equal((await invoke(route, { status: 'EM_PRECIFICACAO' })).status, 409);
      assert.equal(state().request.status, 'CANCELADA');
    }
  });
}

for (const base of ['apps/api', 'backend']) {
  const { registerCommercialReturnNotifications } = require(`../../${base}/lib/pre-sales-closure.cjs`);
  test(`${base}: retornos e contagem são pessoais até para administrador`, async () => {
    const routes = {};
    const queries = [];
    registerCommercialReturnNotifications({ get: (route, fn) => { routes.get = fn; }, post: (route, fn) => { routes.post = fn; } }, {
      notification: {
        findMany: async (args) => { queries.push(args); return [{ id: 'notification', title: 'Cotação cancelada' }]; },
        count: async (args) => { queries.push(args); return 1; },
        updateMany: async (args) => { queries.push(args); return { count: args.where.id === 'mine' ? 1 : 0 }; }
      }
    });
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    const user = { userId: 'seller', role: 'ADMIN' };
    await routes.get({ user }, res);
    assert.equal(res.body.unread, 1);
    assert.equal(queries[0].where.recipientId, 'seller');
    assert.equal(queries[1].where.recipientId, 'seller');
    assert.equal(queries[1].where.readAt, null);
    assert.equal(queries[0].take, 20);
    await routes.post({ user, params: { notificationId: 'foreign' } }, res);
    assert.equal(res.code, 404);
    assert.equal(queries[2].where.recipientId, 'seller');
    await routes.post({ user, params: { notificationId: 'mine' } }, res);
    assert.equal(res.body.success, true);
    assert.equal(queries[3].data.status, 'READ');
    await routes.get({}, res);
    assert.equal(res.code, 401);
  });
}
