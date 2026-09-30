import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';

const SETTINGS_KEY = 'pre_sales_registry_v1';
const VALID_OPPORTUNITY_TERMS = new Set(['12', '24', '36', '48', '60']);

const toString = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
};

const toNumberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toDateOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const toOpportunityTermOrNull = (value, preserve = null) => {
  if (value === '' && preserve) return preserve;
  if (value === '' || value === null || value === undefined) return null;
  const normalized = toString(value);
  return VALID_OPPORTUNITY_TERMS.has(normalized) ? normalized : null;
};

const toStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry || '').trim()).filter(Boolean);
};

const toSellerArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => ({
      nome: toString(entry?.nome),
      email: toString(entry?.email),
      telefone: toString(entry?.telefone),
      marca: toString(entry?.marca || entry?.area || entry?.produto || entry?.tipo)
    }))
    .filter((entry) => entry.nome || entry.email || entry.telefone || entry.marca);
};

const ensureStoreShape = (raw) => {
  const base = {
    version: 1,
    distribuidores: [],
    fornecedores: [],
    oportunidades: [],
    updatedAt: null,
    updatedBy: null
  };
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    distribuidores: Array.isArray(raw.distribuidores) ? raw.distribuidores : [],
    fornecedores: Array.isArray(raw.fornecedores) ? raw.fornecedores : [],
    oportunidades: Array.isArray(raw.oportunidades) ? raw.oportunidades : []
  };
};

const normalizeBasePartner = (input = {}, preserve = {}) => {
  const now = new Date().toISOString();
  return {
    id: toString(input.id || preserve.id) || crypto.randomUUID(),
    nome: toString(input.nome, preserve.nome || ''),
    logoUrl: toString(input.logoUrl || input.logo, preserve.logoUrl || preserve.logo || ''),
    razaoSocial: toString(input.razaoSocial, preserve.razaoSocial || ''),
    cnpj: toString(input.cnpj, preserve.cnpj || ''),
    contato: toString(input.contato, preserve.contato || ''),
    email: toString(input.email, preserve.email || ''),
    telefone: toString(input.telefone, preserve.telefone || ''),
    cidade: toString(input.cidade, preserve.cidade || ''),
    estado: toString(input.estado, preserve.estado || ''),
    site: toString(input.site, preserve.site || ''),
    categorias: toStringArray(input.categorias ?? preserve.categorias),
    marcas: toStringArray(input.marcas ?? preserve.marcas),
    accountManager: toString(input.accountManager, preserve.accountManager || ''),
    portalUrl: toString(input.portalUrl, preserve.portalUrl || ''),
    portalLogin: toString(input.portalLogin, preserve.portalLogin || ''),
    portalSenha: toString(input.portalSenha, preserve.portalSenha || ''),
    ecommerceUrl: toString(input.ecommerceUrl, preserve.ecommerceUrl || ''),
    ecommerceLogin: toString(input.ecommerceLogin, preserve.ecommerceLogin || ''),
    ecommerceSenha: toString(input.ecommerceSenha, preserve.ecommerceSenha || ''),
    produtosPrincipais: toStringArray(input.produtosPrincipais ?? preserve.produtosPrincipais),
    vendedoresResponsaveis: toSellerArray(input.vendedoresResponsaveis ?? preserve.vendedoresResponsaveis),
    portalPartnerUrl: toString(input.portalPartnerUrl, preserve.portalPartnerUrl || ''),
    portalPartnerLogin: toString(input.portalPartnerLogin, preserve.portalPartnerLogin || ''),
    portalPartnerSenha: toString(input.portalPartnerSenha, preserve.portalPartnerSenha || ''),
    treinamentoUrl: toString(input.treinamentoUrl, preserve.treinamentoUrl || ''),
    treinamentoLogin: toString(input.treinamentoLogin, preserve.treinamentoLogin || ''),
    treinamentoSenha: toString(input.treinamentoSenha, preserve.treinamentoSenha || ''),
    contatoPrincipal: toString(input.contatoPrincipal, preserve.contatoPrincipal || ''),
    emailContatoPrincipal: toString(input.emailContatoPrincipal, preserve.emailContatoPrincipal || ''),
    telefoneContatoPrincipal: toString(input.telefoneContatoPrincipal, preserve.telefoneContatoPrincipal || ''),
    contatoCotacoes: toString(input.contatoCotacoes, preserve.contatoCotacoes || ''),
    emailContatoCotacoes: toString(input.emailContatoCotacoes, preserve.emailContatoCotacoes || ''),
    telefoneContatoCotacoes: toString(input.telefoneContatoCotacoes, preserve.telefoneContatoCotacoes || ''),
    produtosServicos: toStringArray(input.produtosServicos ?? preserve.produtosServicos),
    templateRoUrl: toString(input.templateRoUrl, preserve.templateRoUrl || ''),
    procedimentoRo: toString(input.procedimentoRo, preserve.procedimentoRo || ''),
    status: toString(input.status, preserve.status || 'ATIVO').toUpperCase() || 'ATIVO',
    observacoes: toString(input.observacoes, preserve.observacoes || ''),
    createdAt: toDateOrNull(input.createdAt || preserve.createdAt) || now,
    updatedAt: now
  };
};

const normalizeOpportunityRegistry = (input = {}, preserve = {}) => {
  const now = new Date().toISOString();
  return {
    id: toString(input.id || preserve.id) || crypto.randomUUID(),
    oportunidadeId: toString(input.oportunidadeId, preserve.oportunidadeId || ''),
    titulo: toString(input.titulo, preserve.titulo || ''),
    cliente: toString(input.cliente, preserve.cliente || ''),
    origem: toString(input.origem, preserve.origem || 'B2B').toUpperCase() || 'B2B',
    modalidade: toString(input.modalidade, preserve.modalidade || 'VENDA').toUpperCase() || 'VENDA',
    valorEstimado: toNumberOrNull(input.valorEstimado ?? preserve.valorEstimado),
    prazo: toOpportunityTermOrNull(input.prazo, preserve.prazo),
    status: toString(input.status, preserve.status || 'ABERTA').toUpperCase() || 'ABERTA',
    prioridade: toString(input.prioridade, preserve.prioridade || 'MEDIUM').toUpperCase() || 'MEDIUM',
    distribuidorIds: toStringArray(input.distribuidorIds ?? preserve.distribuidorIds),
    fornecedorIds: toStringArray(input.fornecedorIds ?? preserve.fornecedorIds),
    numeroOportunidade: toString(input.numeroOportunidade, preserve.numeroOportunidade || ''),
    produto: toString(input.produto, preserve.produto || ''),
    dataAbertura: toDateOrNull(input.dataAbertura || preserve.dataAbertura),
    dataValidade: toDateOrNull(input.dataValidade || preserve.dataValidade),
    observacoes: toString(input.observacoes, preserve.observacoes || ''),
    createdById: toString(input.createdById, preserve.createdById || ''),
    createdByName: toString(input.createdByName, preserve.createdByName || ''),
    createdAt: toDateOrNull(input.createdAt || preserve.createdAt) || now,
    updatedAt: now
  };
};

const readStore = async (tx) => {
  const row = await tx.systemSetting.findUnique({ where: { key: SETTINGS_KEY } });
  let parsed;
  try { parsed = row?.value ? JSON.parse(row.value) : {}; } catch { parsed = {}; }
  return ensureStoreShape(parsed);
};

const persistStore = async (tx, store, user) => {
  store.updatedAt = new Date().toISOString();
  store.updatedBy = user?.name || user?.email || 'sistema';
  await tx.systemSetting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: JSON.stringify(store) },
    update: { value: JSON.stringify(store) }
  });
};

export default async function handler(req) {
  const urlPath = req.originalUrl || req.url || '';
  const pathParts = urlPath.replace('/api/prevendas-cadastros', '').replace(/^\/+/, '').split('/').filter(Boolean);
  const entity = pathParts[0] || null;
  const entityId = pathParts[1] || null;

  const VALID_ENTITIES = ['distribuidores', 'fornecedores', 'oportunidades'];

  try {
    const store = await readStore(prisma);

    if (req.method === 'GET' && !entity) {
      return Response.json(store);
    }

    if (!entity || !VALID_ENTITIES.includes(entity)) {
      return Response.json({ error: 'Entidade inválida' }, { status: 400 });
    }

    const list = store[entity] || [];
    const userId = req.user?.userId || req.user?.id || '';
    const userName = req.user?.name || '';
    const updater = { name: userName, email: userId };

    if (req.method === 'GET' && entityId) {
      const item = list.find((entry) => entry.id === entityId);
      if (!item) return Response.json({ error: 'Registro não encontrado' }, { status: 404 });
      return Response.json(item);
    }

    if (req.method === 'GET') {
      return Response.json(list);
    }

    if (req.method === 'POST') {
      const body = await req.json();
      let created;
      if (entity === 'oportunidades') {
        created = normalizeOpportunityRegistry({ ...body, createdById: userId, createdByName: userName });
      } else {
        created = normalizeBasePartner(body);
      }
      store[entity] = [created, ...list];
      await persistStore(prisma, store, updater);
      return Response.json(created, { status: 201 });
    }

    if (req.method === 'PUT' && entityId) {
      const body = await req.json();
      const index = list.findIndex((entry) => entry.id === entityId);
      if (index === -1) return Response.json({ error: 'Registro não encontrado' }, { status: 404 });
      const existing = list[index];
      const updated = entity === 'oportunidades' ? normalizeOpportunityRegistry(body, existing) : normalizeBasePartner(body, existing);
      list[index] = updated;
      store[entity] = list;
      await persistStore(prisma, store, updater);
      return Response.json(updated);
    }

    if (req.method === 'DELETE' && entityId) {
      const index = list.findIndex((entry) => entry.id === entityId);
      if (index === -1) return Response.json({ error: 'Registro não encontrado' }, { status: 404 });
      list.splice(index, 1);
      store[entity] = list;
      await persistStore(prisma, store, updater);
      return new Response(null, { status: 204 });
    }

    return Response.json({ error: 'Método não suportado' }, { status: 405 });
  } catch (error) {
    console.error('Erro no prevendas-cadastros:', error);
    return Response.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
