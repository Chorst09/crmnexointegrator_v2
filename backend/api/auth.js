const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../lib/prisma.cjs');
const { authenticateToken } = require('../lib/auth');
const { normalizeRole, resolveUserAccess, getPermissionTemplate, isMaster } = require('../lib/permissions.cjs');

const router = express.Router();

const JWT_SECRET = (() => {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret) throw new Error('JWT_SECRET precisa estar configurado');
  return secret;
})();
const JWT_EXPIRES_IN = '7d';

const sanitizeUserPayload = (user = {}) => {
  const role = normalizeRole(user.role);
  const tenantAccess = user.tenantCompany;
  const tenantPolicies =
    tenantAccess?.rolePolicyOverrides && typeof tenantAccess.rolePolicyOverrides === 'object'
      ? tenantAccess.rolePolicyOverrides
      : {};
  const policyRole = role === 'SELLER' ? 'USER' : role;
  const rolePolicy = tenantPolicies[policyRole] && typeof tenantPolicies[policyRole] === 'object' ? tenantPolicies[policyRole] : {};
  const rolePolicyAccess = rolePolicy.moduleAccess && typeof rolePolicy.moduleAccess === 'object' ? rolePolicy.moduleAccess : {};
  const rolePolicyPermissions = rolePolicy.permissions && typeof rolePolicy.permissions === 'object' ? rolePolicy.permissions : {};
  const access = resolveUserAccess(role, { ...user, ...rolePolicyAccess });
  const effectiveAccess = isMaster({ actualRole: role })
    ? access
    : tenantAccess
      ? {
          accessB2B: Boolean(access.accessB2B && tenantAccess.accessB2B),
          accessB2G: Boolean(access.accessB2G && tenantAccess.accessB2G),
          accessPreSales: Boolean(access.accessPreSales && tenantAccess.accessPreSales),
          accessManagement: Boolean(access.accessManagement && tenantAccess.accessManagement),
          accessAutomation: Boolean(access.accessAutomation && tenantAccess.accessAutomation)
        }
      : access;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role,
    regionId: user.regionId || null,
    quota: user.quota ?? null,
    tenantCompanyId: user.tenantCompanyId || null,
    accessB2B: effectiveAccess.accessB2B,
    accessB2G: effectiveAccess.accessB2G,
    accessPreSales: effectiveAccess.accessPreSales,
    accessManagement: effectiveAccess.accessManagement,
    accessAutomation: effectiveAccess.accessAutomation,
    isCompanyOwner: Boolean(user.isCompanyOwner),
    permissions: getPermissionTemplate(role, { ...rolePolicyPermissions, ...(user.permissionOverrides || {}) }),
    createdAt: user.createdAt || null
  };
};

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Buscar usuário com timeout para evitar que conexões lentas
    // ao banco causem timeout do nginx (502)
    const user = await Promise.race([
      prisma.user.findFirst({
        where: { email: { equals: email.toLowerCase().trim(), mode: 'insensitive' } },
        select: {
          id: true,
          name: true,
          email: true,
          password: true,
          role: true,
          regionId: true,
          quota: true,
          tenantCompanyId: true,
          accessB2B: true,
          accessB2G: true,
          accessPreSales: true,
          accessManagement: true,
          accessAutomation: true,
          tenantCompany: {
            select: {
              status: true,
              accessB2B: true,
              accessB2G: true,
              accessPreSales: true,
              accessManagement: true,
              accessAutomation: true,
              rolePolicyOverrides: true
            }
          },
          permissionOverrides: true,
          isCompanyOwner: true,
          createdAt: true
        }
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), 15000)
      )
    ]).catch((err) => {
      if (err.message === 'Query timeout') {
        console.error('⏰ Timeout na consulta de login para:', email);
        return res.status(503).json({ error: 'Serviço temporariamente indisponível. Tente novamente.' });
      }
      throw err;
    });

    // Se já respondeu com timeout, interrompe
    if (res.headersSent) return;

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const actualRole = normalizeRole(user.role);
    if (!isMaster({ actualRole }) && user.tenantCompany && user.tenantCompany.status !== 'ACTIVE') {
      const statusMessages = {
        PROSPECT: 'Empresa aguardando aprovação do usuário MASTER',
        SUSPENDED: 'Empresa suspensa. Entre em contato com o suporte.',
        CANCELED: 'Empresa cancelada. Entre em contato com o suporte.'
      };
      return res.status(403).json({
        error: statusMessages[user.tenantCompany.status] || 'Empresa não está liberada para acesso'
      });
    }

    // Gerar token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Remover senha da resposta
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      user: sanitizeUserPayload(userWithoutPassword),
      token
    });
  } catch (error) {
    console.error('Erro no login:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    // Com JWT, não precisamos fazer nada no servidor
    // O token será invalidado no frontend
    res.json({ message: 'Logout realizado com sucesso' });
  } catch (error) {
    console.error('Erro no logout:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Verificar token
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        regionId: true,
        quota: true,
        tenantCompanyId: true,
        accessB2B: true,
        accessB2G: true,
        accessPreSales: true,
        accessManagement: true,
        accessAutomation: true,
        tenantCompany: {
          select: {
            accessB2B: true,
            accessB2G: true,
            accessPreSales: true,
            accessManagement: true,
            accessAutomation: true,
            rolePolicyOverrides: true
          }
        },
        isCompanyOwner: true,
        permissionOverrides: true,
        createdAt: true
      }
    });

    res.json({ user: sanitizeUserPayload(user) });
  } catch (error) {
    console.error('Erro na verificação do token:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Alterar senha
router.put('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
    }

    // Verificar sessão
    const session = await prisma.userSession.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    // Verificar senha atual
    const isValidPassword = await bcrypt.compare(currentPassword, session.user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Senha atual incorreta' });
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Atualizar senha
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Listar usuários (apenas admin/manager)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    // Verificar permissão
    if (!['MASTER', 'ADMIN', 'MANAGER'].includes(req.user.actualRole || req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        regionId: true,
        quota: true,
        createdAt: true
      },
      orderBy: { name: 'asc' }
    });

    res.json(users);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar usuário (apenas admin)
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, role, region, quota } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    // Verificar permissão
    const session = await prisma.userSession.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    if (session.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email já está em uso' });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'SELLER',
        region,
        quota
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        regionId: true,
        quota: true,
        createdAt: true
      }
    });

    res.status(201).json(user);
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar usuário (apenas admin)
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, regionId, quota } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    // Verificar permissão
    const session = await prisma.userSession.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    if (session.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        role,
        regionId,
        quota
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        regionId: true,
        quota: true,
        createdAt: true
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
