const express = require('express');
const { prisma } = require('../lib/prisma.cjs');
const { requireRole } = require('../lib/auth.cjs');

const router = express.Router();

const USER_ALLOWED_ROLES = ['ADMIN', 'DIRECTOR', 'MANAGER', 'SELLER', 'PRE_SALES', 'USER'];
const ALLOWED_SCOPE_ROLES = new Set(['master', 'admin', 'user']);

const normalizeHeaderValue = (value) => {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' && value[0].trim().length > 0 ? value[0].trim() : null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getScopeFromHeaders = (headers = {}) => {
  const companyId = normalizeHeaderValue(headers['x-company-id']);
  const userId = normalizeHeaderValue(headers['x-user-id']);
  const roleRaw = (normalizeHeaderValue(headers['x-user-role']) || 'user').toLowerCase();
  const role = ALLOWED_SCOPE_ROLES.has(roleRaw) ? roleRaw : 'user';

  if (!companyId || !userId) return null;
  return { companyId, userId, role };
};

const hasAccess = (record, scope) => {
  if (!record || !scope) return false;
  if (scope.role === 'master') return true;
  if (scope.role === 'admin') return record.companyId === scope.companyId;
  return record.companyId === scope.companyId && record.createdByUserId === scope.userId;
};

const parseSavePayload = (body = {}) => {
  const analysisId = typeof body.analysisId === 'string' ? body.analysisId.trim() : '';
  const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : '';
  const processedAt = typeof body.processedAt === 'string' ? body.processedAt.trim() : '';

  if (!analysisId) {
    return { error: 'analysisId obrigatorio.' };
  }
  if (!fileName) {
    return { error: 'fileName obrigatorio.' };
  }
  if (!processedAt) {
    return { error: 'processedAt obrigatorio.' };
  }

  if (!body.extractedData || typeof body.extractedData !== 'object' || Array.isArray(body.extractedData)) {
    return { error: 'extractedData obrigatorio.' };
  }

  const analysisType = body.extractedData.analysisType;
  if (analysisType && analysisType !== 'edital' && analysisType !== 'tr') {
    return { error: 'extractedData.analysisType deve ser "edital" ou "tr".' };
  }

  return {
    analysisId,
    fileName,
    processedAt,
    extractedData: body.extractedData,
    originalFileDataUri:
      typeof body.originalFileDataUri === 'string' || body.originalFileDataUri === null
        ? body.originalFileDataUri
        : null,
    summaryPdfDataUri:
      typeof body.summaryPdfDataUri === 'string' || body.summaryPdfDataUri === null
        ? body.summaryPdfDataUri
        : null
  };
};

const buildListWhere = (scope) => {
  if (scope.role === 'master') return {};
  if (scope.role === 'admin') return { companyId: scope.companyId };
  return {
    companyId: scope.companyId,
    createdByUserId: scope.userId
  };
};

router.get('/saved', requireRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const scope = getScopeFromHeaders(req.headers || {});
    if (!scope) {
      return res.status(401).json({ message: 'Headers x-company-id e x-user-id sao obrigatorios.' });
    }

    const records = await prisma.savedAnalysis.findMany({
      where: buildListWhere(scope),
      orderBy: [{ createdAt: 'desc' }]
    });

    return res.json(records);
  } catch (error) {
    console.error('Erro ao listar análises salvas:', error);
    const message = error instanceof Error ? error.message : 'Falha ao listar resumos salvos.';
    return res.status(500).json({ message });
  }
});

router.get('/saved/:id', requireRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const scope = getScopeFromHeaders(req.headers || {});
    if (!scope) {
      return res.status(401).json({ message: 'Headers x-company-id e x-user-id sao obrigatorios.' });
    }

    const id = String(req.params?.id || '').trim();
    if (!id) {
      return res.status(400).json({ message: 'Id obrigatorio.' });
    }

    const record = await prisma.savedAnalysis.findUnique({ where: { id } });
    if (!record || !hasAccess(record, scope)) {
      return res.status(404).json({ message: 'Registro nao encontrado.' });
    }

    return res.json(record);
  } catch (error) {
    console.error('Erro ao carregar análise salva:', error);
    const message = error instanceof Error ? error.message : 'Falha ao carregar resumo salvo.';
    return res.status(500).json({ message });
  }
});

router.post('/saved', requireRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const scope = getScopeFromHeaders(req.headers || {});
    if (!scope) {
      return res.status(401).json({ message: 'Headers x-company-id e x-user-id sao obrigatorios.' });
    }

    const parsed = parseSavePayload(req.body || {});
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const existing = await prisma.savedAnalysis.findFirst({
      where: {
        companyId: scope.companyId,
        analysisId: parsed.analysisId
      }
    });

    if (existing) {
      if (!hasAccess(existing, scope)) {
        return res.status(403).json({ message: 'Sem permissao para atualizar este registro.' });
      }

      const updated = await prisma.savedAnalysis.update({
        where: { id: existing.id },
        data: {
          fileName: parsed.fileName,
          processedAt: parsed.processedAt,
          extractedData: parsed.extractedData,
          originalFileDataUri: parsed.originalFileDataUri,
          summaryPdfDataUri: parsed.summaryPdfDataUri
        }
      });

      return res.json(updated);
    }

    const created = await prisma.savedAnalysis.create({
      data: {
        analysisId: parsed.analysisId,
        companyId: scope.companyId,
        createdByUserId: scope.userId,
        fileName: parsed.fileName,
        processedAt: parsed.processedAt,
        extractedData: parsed.extractedData,
        originalFileDataUri: parsed.originalFileDataUri,
        summaryPdfDataUri: parsed.summaryPdfDataUri
      }
    });

    return res.json(created);
  } catch (error) {
    console.error('Erro ao salvar análise:', error);
    const message = error instanceof Error ? error.message : 'Falha ao salvar resumo.';
    return res.status(500).json({ message });
  }
});

router.delete('/saved/:id', requireRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const scope = getScopeFromHeaders(req.headers || {});
    if (!scope) {
      return res.status(401).json({ message: 'Headers x-company-id e x-user-id sao obrigatorios.' });
    }

    const id = String(req.params?.id || '').trim();
    if (!id) {
      return res.status(400).json({ message: 'Id obrigatorio.' });
    }

    const record = await prisma.savedAnalysis.findUnique({ where: { id } });
    if (!record || !hasAccess(record, scope)) {
      return res.status(404).json({ message: 'Registro nao encontrado.' });
    }

    await prisma.savedAnalysis.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    console.error('Erro ao remover análise salva:', error);
    const message = error instanceof Error ? error.message : 'Falha ao remover resumo salvo.';
    return res.status(500).json({ message });
  }
});

module.exports = router;
