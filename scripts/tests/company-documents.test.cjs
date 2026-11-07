const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const dependencies = createRequire(path.resolve('backend/package.json'));
const express = dependencies('express');
const request = dependencies('supertest');

function setup(base, options = {}) {
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'company-documents-'));
  const documents = [];
  const contracts = [];
  const queries = [];
  const companies = [{ id: 'client', tenantCompanyId: 'double' }, { id: 'foreign', tenantCompanyId: 'other' }];
  const opportunities = [
    { id: 'won', companyId: 'client', tenantCompanyId: 'double', number: 'B2B-2026-00382', title: 'Segurança Reali', stage: 'WON' },
    { id: 'another-client', companyId: 'another', tenantCompanyId: 'double' },
    { id: 'foreign-opportunity', companyId: 'client', tenantCompanyId: 'other' },
  ];
  for (const opportunity of opportunities) Object.assign(opportunity, { ownerId: 'seller', owner: { email: 'seller@double' }, company: { clientType: 'B2B' } });
  const matches = (row, where) => row && Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(condition => matches(row, condition));
    if (value && typeof value === 'object') {
      if ('not' in value) return row[key] !== value.not;
      if ('in' in value) return value.in.includes(row[key]);
      return matches(row[key], value);
    }
    return row[key] === value;
  });
  const withOpportunity = data => {
    const { path: storedPath, filename, companyId, ...visible } = data;
    return { ...visible, opportunity: opportunities.find(item => item.id === data.opportunityId) || null };
  };
  const prisma = {
    contract: { create: async ({ data }) => {
      if (options.failContract) throw new Error('contract copy database failure');
      const contract = { id: 'contract-' + contracts.length, ...data };
      contracts.push(contract); return contract;
    } },
    company: { findUnique: async ({ where }) => companies.find(item => item.id === where.id) || null },
    opportunity: {
      findMany: async ({ where }) => { queries.push(where); return opportunities.filter(item => matches(item, where)); },
      findFirst: async ({ where }) => opportunities.find(item => matches(item, where)) || null,
    },
    companyDocument: {
      create: async ({ data, select }) => {
        assert.equal(select.path, undefined);
        if (options.failCreate) throw new Error('database unavailable');
        const document = { id: 'doc-' + documents.length, ...data, createdAt: new Date() };
        documents.push(document);
        return withOpportunity(document);
      },
      findMany: async ({ where }) => documents.map(item => ({ ...item, opportunity: opportunities.find(opportunity => opportunity.id === item.opportunityId) || null })).filter(item => matches(item, where)).map(withOpportunity),
      findUnique: async ({ where }) => documents.find(item => item.id === where.id) || null,
      delete: async ({ where }) => documents.splice(documents.findIndex(item => item.id === where.id), 1)[0],
    }
  };
  prisma.$transaction = async callback => {
    const docCount = documents.length, contractCount = contracts.length;
    try { return await callback(prisma); }
    catch (error) { documents.splice(docCount); contracts.splice(contractCount); throw error; }
  };
  const authenticateToken = (req, res, next) => {
    if (req.headers.authorization !== 'Bearer test-session') return res.status(401).json({ error: 'Não autenticado' });
    req.user = { userId: 'seller', role: 'SELLER', email: 'seller@double', accessB2B: true, accessB2G: true, tenantCompanyId: 'double', ...options.user };
    next();
  };
  const canViewCompany = async (db, user, id) => !options.deny && companies.some(item => item.id === id && item.tenantCompanyId === user.tenantCompanyId);
  const { createCompanyDocumentsRouter } = require(path.resolve(base, 'lib/company-documents-router.cjs'));
  const app = express();
  const prefix = options.opportunityMode ? '/api/opportunities/' : '/api/companies/';
  app.use('/api/companies', createCompanyDocumentsRouter({ prisma, authenticateToken, canViewCompany, uploadDir }));
  app.use('/api/opportunities', createCompanyDocumentsRouter({ prisma, authenticateToken, canViewCompany, uploadDir, opportunityMode: true }));
  return {
    app, documents, contracts, opportunities, queries, uploadDir, prefix,
    cleanup: () => fs.rmSync(uploadDir, { recursive: true, force: true }),
    get: endpoint => request(app).get(prefix + endpoint).set('Authorization', 'Bearer test-session'),
    post: (id = options.opportunityMode ? 'won' : 'client') => request(app).post(`${prefix}${id}/documents`).set('Authorization', 'Bearer test-session'),
  };
}

for (const base of ['backend', 'apps/api']) {
  test(`${base}: oportunidade é a origem do arquivo, sem empresa ou oportunidade no corpo`, async () => {
    const fixture = setup(base, { opportunityMode: true });
    try {
      for (const documentType of ['CONTRACT', 'DOCUMENT']) {
        const response = await fixture.post().field('documentType', documentType).attach('file', Buffer.from('arquivo'), `${documentType}.txt`);
        assert.equal(response.status, 201, JSON.stringify(response.body));
        assert.equal(response.body.opportunityId, 'won');
        assert.equal(response.body.documentType, documentType);
        assert.equal(fixture.documents.at(-1).companyId, 'client');
        if (documentType === 'CONTRACT') {
          assert.equal(fixture.contracts.length, 1);
          assert.equal(fixture.contracts[0].status, 'DRAFT');
          assert.equal(fixture.contracts[0].endDate, null);
          assert.equal(fixture.contracts[0].sourceDocumentId, response.body.id);
          assert.equal(fs.readFileSync(fixture.contracts[0].attachments.create.path, 'utf8'), 'arquivo');
        }
      }
      assert.equal((await fixture.get('won/documents')).body.length, 2);
      for (const documentType of ['CONTRACT', 'DOCUMENT']) {
        const response = await request(fixture.app).get(`/api/companies/client/documents?documentType=${documentType}`).set('Authorization', 'Bearer test-session');
        assert.equal(response.status, 200);
        assert.equal(response.body.length, 1);
        assert.equal(response.body[0].documentType, documentType);
        assert.equal(response.body[0].opportunity.number, 'B2B-2026-00382');
      }
      assert.equal(fixture.documents.length, 2, 'consulta da empresa não duplica os arquivos');
    } finally { fixture.cleanup(); }
  });

  test(`${base}: falha na cópia reverte o documento e remove os dois arquivos`, async () => {
    const fixture = setup(base, { opportunityMode: true, failContract: true });
    try {
      const response = await fixture.post().field('documentType', 'CONTRACT').attach('file', Buffer.from('contrato'), 'contrato.txt');
      assert.equal(response.status, 500);
      assert.equal(fixture.documents.length, 0);
      assert.equal(fixture.contracts.length, 0);
      assert.equal(fs.readdirSync(fixture.uploadDir, { withFileTypes: true }).filter(item => item.isFile()).length, 0);
      assert.equal(fs.readdirSync(path.join(fixture.uploadDir, 'contract-copies')).length, 0);
    } finally { fixture.cleanup(); }
  });

  test(`${base}: URL fixa o vínculo e rejeita troca de oportunidade ou tipo ausente`, async () => {
    const fixture = setup(base, { opportunityMode: true });
    try {
      assert.equal((await fixture.post().field('opportunityId', 'another-client').field('documentType', 'CONTRACT').attach('file', Buffer.from('x'), 'arquivo.txt')).status, 400);
      assert.equal((await fixture.post().attach('file', Buffer.from('x'), 'arquivo.txt')).status, 400);
      assert.equal(fixture.documents.length, 0);
      assert.equal(fs.readdirSync(fixture.uploadDir, { withFileTypes: true }).filter(item => item.isFile()).length, 0);
    } finally { fixture.cleanup(); }
  });

  test(`${base}: vendedor não acessa anexos de oportunidade alheia, inclusive pela empresa`, async () => {
    const fixture = setup(base, { opportunityMode: true });
    try {
      fixture.opportunities.push({ ...fixture.opportunities[0], id: 'private', ownerId: 'other-seller' });
      fixture.documents.push({ id: 'private-doc', companyId: 'client', opportunityId: 'private', documentType: 'CONTRACT' });
      assert.equal((await fixture.get('private/documents')).status, 403);
      assert.equal((await fixture.post('private').field('documentType', 'CONTRACT').attach('file', Buffer.from('x'), 'arquivo.txt')).status, 403);
      assert.equal((await fixture.get('document/private-doc/download')).status, 403);
      assert.equal((await request(fixture.app).get('/api/companies/document/private-doc/download').set('Authorization', 'Bearer test-session')).status, 403);
      assert.deepEqual((await request(fixture.app).get('/api/companies/client/documents').set('Authorization', 'Bearer test-session')).body, []);
      assert.equal(fs.readdirSync(fixture.uploadDir, { withFileTypes: true }).filter(item => item.isFile()).length, 0);
    } finally { fixture.cleanup(); }
  });

  test(`${base}: perfis administrativos veem anexos autorizados sem quebrar o tenant`, async () => {
    for (const role of ['ADMIN', 'MASTER']) {
      const fixture = setup(base, { opportunityMode: true, user: { role, userId: 'admin' } });
      try { assert.equal((await fixture.get('won/documents')).status, 200); }
      finally { fixture.cleanup(); }
    }
    for (const user of [{ tenantCompanyId: 'other' }, { accessB2B: false }]) {
      const fixture = setup(base, { opportunityMode: true, user });
      try { assert.equal((await fixture.get('won/documents')).status, 403); }
      finally { fixture.cleanup(); }
    }
  });

  test(`${base}: upload multipart exige oportunidade, sem salvar arquivo órfão`, async () => {
    const fixture = setup(base);
    try {
      const response = await fixture.post().attach('file', Buffer.from('conteudo'), 'contrato.txt');
      assert.equal(response.status, 400);
      assert.match(response.body.error, /oportunidade/);
      assert.equal(fixture.documents.length, 0);
      assert.equal(fs.readdirSync(fixture.uploadDir, { withFileTypes: true }).filter(item => item.isFile()).length, 0);
    } finally { fixture.cleanup(); }
  });

  test(`${base}: contrato vinculado a oportunidade ganha persiste, lista, baixa e exclui`, async () => {
    const fixture = setup(base);
    try {
      const created = await fixture.post().field('opportunityId', 'won').field('documentType', 'CONTRACT').attach('file', Buffer.from('contrato assinado'), 'contrato.txt');
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal(created.body.opportunityId, 'won');
      assert.equal(created.body.documentType, 'CONTRACT');
      assert.equal(created.body.opportunity.stage, 'WON');
      assert.equal(created.body.path, undefined);
      const listed = await fixture.get('client/documents');
      assert.equal(listed.body[0].opportunity.number, 'B2B-2026-00382');
      const downloaded = await fixture.get(`document/${created.body.id}/download`);
      assert.equal(downloaded.status, 200);
      assert.equal(downloaded.text, 'contrato assinado');
      assert.match(downloaded.headers['content-disposition'], /attachment/);
      const deleted = await request(fixture.app).delete(`/api/companies/document/${created.body.id}`).set('Authorization', 'Bearer test-session');
      assert.equal(deleted.status, 200);
      assert.equal(fixture.documents.length, 0);
      assert.equal(fixture.contracts.length, 1);
      assert.equal(fs.readFileSync(fixture.contracts[0].attachments.create.path, 'utf8'), 'contrato assinado', 'excluir o original preserva a cópia independente');
      assert.equal(fs.readdirSync(fixture.uploadDir, { withFileTypes: true }).filter(item => item.isFile()).length, 0);
    } finally { fixture.cleanup(); }
  });

  test(`${base}: bloqueia oportunidade inexistente, de outra empresa ou de outro tenant`, async () => {
    const fixture = setup(base);
    try {
      for (const id of ['missing', 'another-client', 'foreign-opportunity', '   ']) {
        const response = await fixture.post().field('opportunityId', id).attach('file', Buffer.from('x'), 'doc.txt');
        assert.equal(response.status, 400);
        assert.equal(fixture.documents.length, 0);
        assert.equal(fs.readdirSync(fixture.uploadDir, { withFileTypes: true }).filter(item => item.isFile()).length, 0);
      }
    } finally { fixture.cleanup(); }
  });

  test(`${base}: autorização ocorre antes de gravar o upload`, async () => {
    const fixture = setup(base, { deny: true });
    try {
      assert.equal((await fixture.post().field('opportunityId', 'won').attach('file', Buffer.from('x'), 'doc.txt')).status, 403);
      assert.equal((await fixture.get('client/documents')).status, 403);
      assert.equal((await fixture.get('client/document-opportunities')).status, 403);
      assert.equal((await fixture.get('missing/documents')).status, 404);
      assert.equal((await request(fixture.app).get('/api/companies/client/documents')).status, 401);
      fixture.documents.push({ id: 'private', companyId: 'foreign' });
      assert.equal((await fixture.get('document/private/download')).status, 403);
      assert.equal((await request(fixture.app).delete('/api/companies/document/private').set('Authorization', 'Bearer test-session')).status, 403);
      assert.equal(fs.readdirSync(fixture.uploadDir, { withFileTypes: true }).filter(item => item.isFile()).length, 0);
    } finally { fixture.cleanup(); }
  });

  test(`${base}: seletor contém somente oportunidades da empresa e do tenant`, async () => {
    const fixture = setup(base);
    try {
      const response = await fixture.get('client/document-opportunities');
      assert.equal(response.status, 200);
      assert.deepEqual(response.body.map(item => item.id), ['won']);
      assert.equal(fixture.queries[0].companyId, 'client');
      assert.equal(fixture.queries[0].tenantCompanyId, 'double');
      assert.equal(fixture.queries[0].ownerId, 'seller');
    } finally { fixture.cleanup(); }
  });

  test(`${base}: erro de persistência e arquivo inválido não deixam arquivos no disco`, async () => {
    const fixture = setup(base, { failCreate: true });
    try {
      assert.equal((await fixture.post().field('opportunityId', 'won').attach('file', Buffer.from('x'), 'doc.txt')).status, 500);
      assert.equal((await fixture.post().field('opportunityId', 'won').field('documentType', 'INVALID').attach('file', Buffer.from('x'), 'doc.txt')).status, 400);
      assert.equal((await fixture.post().field('opportunityId', 'won').attach('file', Buffer.from('x'), 'script.exe')).status, 400);
      assert.equal((await fixture.post().field('opportunityId', 'won').attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), 'grande.txt')).status, 400);
      assert.equal(fs.readdirSync(fixture.uploadDir, { withFileTypes: true }).filter(item => item.isFile()).length, 0);
    } finally { fixture.cleanup(); }
  });
}
