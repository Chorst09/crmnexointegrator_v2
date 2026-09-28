const express = require('express');
const bcrypt = require('bcryptjs');
const { prisma } = require('../lib/prisma.cjs');
const { authenticateToken, requireRole } = require('../lib/auth.cjs');
const {
  normalizeRole,
  resolveUserAccess,
  isMaster,
  canManageLicensing,
  ROLE_PERMISSION_TEMPLATES,
  getPermissionTemplate
} = require('../lib/permissions.cjs');

const router = express.Router();


const DEFAULT_LICENSE_PLANS = [
  {
    code: 'MENSAL',
    name: 'Mensal',
    description: 'Cobranca recorrente mensal',
    billingCycle: 'MONTHLY',
    price: 289,
    seatsIncluded: 1,
    sortOrder: 10,
    features: {
      b2b: true,
      b2g: true,
      preSales: true,
      management: true,
      automation: true,
      integrations: true,
      supportLevel: 'standard'
    }
  },
  {
    code: 'TRIMESTRAL',
    name: 'Trimestral',
    description: 'Cobranca a cada 3 meses',
    billingCycle: 'QUARTERLY',
    price: 780.3,
    seatsIncluded: 3,
    sortOrder: 20,
    features: {
      b2b: true,
      b2g: true,
      preSales: true,
      management: true,
      automation: true,
      integrations: true,
      supportLevel: 'priority'
    }
  },
  {
    code: 'SEMESTRAL',
    name: 'Semestral',
    description: 'Cobranca a cada 6 meses',
    billingCycle: 'SEMIANNUAL',
    price: 1473.9,
    seatsIncluded: 5,
    sortOrder: 30,
    features: {
      b2b: true,
      b2g: true,
      preSales: true,
      management: true,
      automation: true,
      integrations: true,
      supportLevel: 'priority'
    }
  },
  {
    code: 'ANUAL',
    name: 'Anual',
    description: 'Cobranca anual',
    billingCycle: 'ANNUAL',
    price: 2774.4,
    seatsIncluded: 10,
    sortOrder: 40,
    features: {
      b2b: true,
      b2g: true,
      preSales: true,
      management: true,
      automation: true,
      integrations: true,
      supportLevel: 'enterprise'
    }
  }
];

const LICENSE_STATUS = new Set(['PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELED']);
const COMPANY_STATUS = new Set(['PROSPECT', 'ACTIVE', 'SUSPENDED', 'CANCELED']);
const PAYMENT_STATUS = new Set(['PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED']);

const normalizeString = (value, maxLen = 255) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
};

const normalizeFloat = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeInt = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor(parsed));
};

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeCnpj = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 14) return null;
  return digits;
};

const normalizeEmail = (value) => {
  const email = normalizeString(value, 220);
  if (!email) return null;
  return email.toLowerCase();
};

const normalizeModuleAccess = (body = {}, fallback = {}) => {
  const accessB2B = body.accessB2B !== undefined ? Boolean(body.accessB2B) : fallback.accessB2B !== undefined ? Boolean(fallback.accessB2B) : true;
  const accessB2G = body.accessB2G !== undefined ? Boolean(body.accessB2G) : fallback.accessB2G !== undefined ? Boolean(fallback.accessB2G) : false;
  const accessPreSales = body.accessPreSales !== undefined ? Boolean(body.accessPreSales) : fallback.accessPreSales !== undefined ? Boolean(fallback.accessPreSales) : false;
  const accessManagement = body.accessManagement !== undefined ? Boolean(body.accessManagement) : fallback.accessManagement !== undefined ? Boolean(fallback.accessManagement) : false;
  const accessAutomation = body.accessAutomation !== undefined ? Boolean(body.accessAutomation) : fallback.accessAutomation !== undefined ? Boolean(fallback.accessAutomation) : false;
  return {
    accessB2B,
    accessB2G,
    accessPreSales,
    accessManagement,
    accessAutomation
  };
};

const moduleAccessFromPlan = (plan = {}, overrides = {}) => {
  const features = plan.features && typeof plan.features === 'object' ? plan.features : {};
  return normalizeModuleAccess(overrides, {
    accessB2B: Boolean(features.b2b),
    accessB2G: Boolean(features.b2g),
    accessPreSales: Boolean(features.preSales),
    accessManagement: Boolean(features.management),
    accessAutomation: Boolean(features.automation)
  });
};

const constrainAccessToTenant = (access = {}, tenantCompany = {}) => ({
  accessB2B: Boolean(access.accessB2B && tenantCompany.accessB2B),
  accessB2G: Boolean(access.accessB2G && tenantCompany.accessB2G),
  accessPreSales: Boolean(access.accessPreSales && tenantCompany.accessPreSales),
  accessManagement: Boolean(access.accessManagement && tenantCompany.accessManagement),
  accessAutomation: Boolean(access.accessAutomation && tenantCompany.accessAutomation)
});

const ROLE_POLICY_EDITABLE_ROLES = new Set(['USER', 'PRE_SALES', 'ADMIN']);
const ROLE_POLICY_ACCESS_KEYS = ['accessB2B', 'accessB2G', 'accessPreSales', 'accessManagement', 'accessAutomation'];
const ROLE_POLICY_PERMISSION_KEYS = [
  'dashboard',
  'leads',
  'opportunities',
  'publicOpportunities',
  'ownOpportunitiesOnly',
  'manufacturerRegistry',
  'documentation',
  'strategicReports',
  'management',
  'automation'
];

const sanitizeRolePolicyOverrides = (policies = {}, tenantCompany = {}) => {
  if (!policies || typeof policies !== 'object') return {};

  return Object.entries(policies).reduce((acc, [roleValue, draft]) => {
    const role = normalizeRole(roleValue);
    if (!ROLE_POLICY_EDITABLE_ROLES.has(role) || !draft || typeof draft !== 'object') return acc;

    const moduleInput = draft.moduleAccess && typeof draft.moduleAccess === 'object' ? draft.moduleAccess : {};
    const moduleDefaults = resolveUserAccess(role, {});
    const moduleAccess = constrainAccessToTenant(
      ROLE_POLICY_ACCESS_KEYS.reduce((next, key) => {
        next[key] = moduleInput[key] !== undefined ? Boolean(moduleInput[key]) : Boolean(moduleDefaults[key]);
        return next;
      }, {}),
      tenantCompany
    );

    const permissionInput = draft.permissions && typeof draft.permissions === 'object' ? draft.permissions : {};
    const permissions = ROLE_POLICY_PERMISSION_KEYS.reduce((next, key) => {
      next[key] = permissionInput[key] !== undefined
        ? Boolean(permissionInput[key])
        : Boolean(getPermissionTemplate(role)[key]);
      return next;
    }, {});

    acc[role] = { moduleAccess, permissions };
    return acc;
  }, {});
};

const toPublicPlan = (plan) => ({
  id: plan.id,
  code: plan.code,
  name: plan.name,
  description: plan.description,
  billingCycle: plan.billingCycle,
  price: plan.price,
  currency: plan.currency,
  seatsIncluded: plan.seatsIncluded,
  sortOrder: plan.sortOrder,
  features: plan.features,
  isActive: plan.isActive
});

const roleUiLabel = (role) => {
  const labels = {
    MASTER: 'Master',
    ADMIN: 'Admin',
    USER: 'User',
    PRE_SALES: 'Pre-Vendas',
    MANAGER: 'Manager',
    DIRECTOR: 'Director',
    SELLER: 'Seller'
  };

  return labels[role] || role;
};

const addMonths = (baseDate, months) => {
  const date = new Date(baseDate);
  date.setMonth(date.getMonth() + months);
  return date;
};

const calculateEndDate = (startDate, billingCycle) => {
  if (billingCycle === 'MONTHLY') return addMonths(startDate, 1);
  if (billingCycle === 'QUARTERLY') return addMonths(startDate, 3);
  if (billingCycle === 'SEMIANNUAL') return addMonths(startDate, 6);
  if (billingCycle === 'ANNUAL') return addMonths(startDate, 12);
  return addMonths(startDate, 1);
};

const generatePassword = () => {
  return `Adm${Math.random().toString(36).slice(2, 8)}!${Math.floor(100 + Math.random() * 899)}`;
};

const resolveMasterEmails = () => {
  return new Set(
    String(process.env.MASTER_EMAILS || process.env.MASTER_EMAIL || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
};

const isCodeOwnerEmail = (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return resolveMasterEmails().has(normalized);
};

const ensureDefaultPlans = async () => {
  for (const plan of DEFAULT_LICENSE_PLANS) {
    await prisma.licensePlan.upsert({
      where: { code: plan.code },
      create: plan,
      update: {
        name: plan.name,
        description: plan.description,
        billingCycle: plan.billingCycle,
        price: plan.price,
        currency: 'BRL',
        seatsIncluded: plan.seatsIncluded,
        sortOrder: plan.sortOrder,
        features: plan.features,
        isActive: true
      }
    });
  }
};

const ensureTenantAccess = (req, tenantCompanyId) => {
  if (!req.user) return false;
  if (isMaster(req.user)) return true;
  if (normalizeRole(req.user.actualRole || req.user.role) === 'ADMIN') {
    return req.user.tenantCompanyId && req.user.tenantCompanyId === tenantCompanyId;
  }
  return false;
};

const mapCompanyWithLicense = (company) => {
  const activeLicense = (company.licenses || []).find((license) => license.status === 'ACTIVE') || company.licenses?.[0] || null;

  return {
    id: company.id,
    name: company.name,
    legalName: company.legalName,
    cnpj: company.cnpj,
    email: company.email,
    phone: company.phone,
    status: company.status,
    notes: company.notes,
    accessB2B: Boolean(company.accessB2B),
    accessB2G: Boolean(company.accessB2G),
    accessPreSales: Boolean(company.accessPreSales),
    accessManagement: Boolean(company.accessManagement),
    accessAutomation: Boolean(company.accessAutomation),
    rolePolicyOverrides:
      company.rolePolicyOverrides && typeof company.rolePolicyOverrides === 'object'
        ? company.rolePolicyOverrides
        : {},
    usersCount: company.users?.length || 0,
    adminsCount: (company.users || []).filter((user) => normalizeRole(user.role) === 'ADMIN').length,
    users: (company.users || []).map((user) => {
      const role = normalizeRole(user.role);
      const access = constrainAccessToTenant(resolveUserAccess(role, user), company);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
        accessB2B: access.accessB2B,
        accessB2G: access.accessB2G,
        accessPreSales: access.accessPreSales,
        accessManagement: access.accessManagement,
        accessAutomation: access.accessAutomation,
        isCompanyOwner: Boolean(user.isCompanyOwner),
        createdAt: user.createdAt
      };
    }),
    license: activeLicense
      ? {
          id: activeLicense.id,
          status: activeLicense.status,
          seats: activeLicense.seats,
          startDate: activeLicense.startDate,
          endDate: activeLicense.endDate,
          priceAtPurchase: activeLicense.priceAtPurchase,
          notes: activeLicense.notes,
          paymentStatus: activeLicense.paymentStatus,
          plan: activeLicense.plan
            ? {
                id: activeLicense.plan.id,
                code: activeLicense.plan.code,
                name: activeLicense.plan.name,
                billingCycle: activeLicense.plan.billingCycle,
                price: activeLicense.plan.price,
                currency: activeLicense.plan.currency,
                seatsIncluded: activeLicense.plan.seatsIncluded
              }
            : null
        }
      : null
  };
};

// Publico: listagem de planos para checkout inicial
router.get('/public/plans', async (req, res) => {
  try {
    await ensureDefaultPlans();

    const plans = await prisma.licensePlan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }]
    });

    return res.json({ data: plans.map(toPublicPlan) });
  } catch (error) {
    console.error('Erro ao listar planos de licenciamento:', error);
    return res.status(500).json({ error: 'Erro interno ao listar planos' });
  }
});

// Publico: simulacao/confirmacao de pagamento para provisionamento automatico
router.post('/public/checkout/confirm', async (req, res) => {
  try {
    await ensureDefaultPlans();

    const paymentReference = normalizeString(req.body?.paymentReference, 180) || `PAY-${Date.now()}`;
    const paymentStatus = String(req.body?.paymentStatus || 'CONFIRMED').trim().toUpperCase();

    if (paymentStatus !== 'CONFIRMED') {
      return res.status(400).json({ error: 'Pagamento ainda não confirmado' });
    }

    const planCode = normalizeString(req.body?.planCode, 80)?.toUpperCase();
    const planId = normalizeString(req.body?.planId, 120);

    const companyName = normalizeString(req.body?.company?.name, 220);
    const legalName = normalizeString(req.body?.company?.legalName, 220);
    const companyCnpj = normalizeCnpj(req.body?.company?.cnpj);
    const companyEmail = normalizeEmail(req.body?.company?.email);
    const companyPhone = normalizeString(req.body?.company?.phone, 40);

    const adminName = normalizeString(req.body?.adminUser?.name, 180);
    const adminEmail = normalizeEmail(req.body?.adminUser?.email);
    const adminPasswordInput = normalizeString(req.body?.adminUser?.password, 120);

    if (!companyName || !adminName || !adminEmail) {
      return res.status(400).json({ error: 'company.name, adminUser.name e adminUser.email são obrigatórios' });
    }

    let plan = null;
    if (planId) {
      plan = await prisma.licensePlan.findUnique({ where: { id: planId } });
    }
    if (!plan) {
      plan = await prisma.licensePlan.findFirst({ where: { code: planCode || 'MENSAL', isActive: true } });
    }

    if (!plan) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }

    const existingByPayment = await prisma.companyLicense.findFirst({
      where: {
        paymentReference,
        paymentStatus: 'CONFIRMED'
      },
      include: {
        tenantCompany: true,
        plan: true
      }
    });

    if (existingByPayment) {
      const admin = await prisma.user.findFirst({
        where: {
          tenantCompanyId: existingByPayment.tenantCompanyId,
          role: { in: ['ADMIN', 'MASTER'] }
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      });

      return res.json({
        data: {
          idempotent: true,
          company: existingByPayment.tenantCompany,
          plan: existingByPayment.plan,
          license: existingByPayment,
          adminUser: admin
        }
      });
    }

    const passwordToUse = adminPasswordInput || generatePassword();
    const passwordHash = await bcrypt.hash(passwordToUse, 10);

    const startDate = normalizeDate(req.body?.startDate) || new Date();
    const endDate = normalizeDate(req.body?.endDate) || calculateEndDate(startDate, plan.billingCycle);
    const seats = normalizeInt(req.body?.seats) || plan.seatsIncluded || 1;
    const moduleAccess = moduleAccessFromPlan(plan, req.body?.company);
    const reviewNote = `Cadastro via checkout aguardando aprovação do MASTER em ${new Date().toISOString()}`;

    const result = await prisma.$transaction(async (tx) => {
      let tenantCompany = null;

      if (companyCnpj) {
        tenantCompany = await tx.tenantCompany.findUnique({ where: { cnpj: companyCnpj } });
      }

      if (!tenantCompany && companyEmail) {
        tenantCompany = await tx.tenantCompany.findFirst({ where: { email: companyEmail } });
      }

      if (tenantCompany) {
        tenantCompany = await tx.tenantCompany.update({
          where: { id: tenantCompany.id },
          data: {
            name: companyName,
            legalName,
            cnpj: companyCnpj,
            email: companyEmail,
            phone: companyPhone,
            status: 'PROSPECT',
            ...moduleAccess,
            notes: [tenantCompany.notes, reviewNote].filter(Boolean).join('\n')
          }
        });
      } else {
        tenantCompany = await tx.tenantCompany.create({
          data: {
            name: companyName,
            legalName,
            cnpj: companyCnpj,
            email: companyEmail,
            phone: companyPhone,
            status: 'PROSPECT',
            ...moduleAccess,
            notes: reviewNote
          }
        });
      }

      await tx.companyLicense.updateMany({
        where: {
          tenantCompanyId: tenantCompany.id,
          status: 'ACTIVE'
        },
        data: {
          status: 'EXPIRED'
        }
      });

      const license = await tx.companyLicense.create({
        data: {
          tenantCompanyId: tenantCompany.id,
          planId: plan.id,
          status: 'PENDING',
          seats,
          startDate,
          endDate,
          priceAtPurchase: normalizeFloat(req.body?.priceAtPurchase) || plan.price,
          notes: normalizeString(req.body?.notes, 600) || `Assinatura (${plan.name}) via checkout público`,
          paymentReference,
          paymentStatus: 'CONFIRMED',
          paymentConfirmedAt: new Date()
        },
        include: {
          plan: true
        }
      });

      let adminUser = await tx.user.findFirst({
        where: {
          email: {
            equals: adminEmail,
            mode: 'insensitive'
          }
        }
      });

      if (adminUser && adminUser.tenantCompanyId && adminUser.tenantCompanyId !== tenantCompany.id) {
        throw new Error('Já existe usuário com este e-mail em outra empresa.');
      }

      if (adminUser) {
        adminUser = await tx.user.update({
          where: { id: adminUser.id },
          data: {
            name: adminName,
            password: adminPasswordInput ? passwordHash : undefined,
            role: 'ADMIN',
            tenantCompanyId: tenantCompany.id,
            accessB2B: moduleAccess.accessB2B,
            accessB2G: moduleAccess.accessB2G,
            accessPreSales: moduleAccess.accessPreSales,
            accessManagement: moduleAccess.accessManagement,
            accessAutomation: moduleAccess.accessAutomation,
            isCompanyOwner: true
          }
        });
      } else {
        adminUser = await tx.user.create({
          data: {
            name: adminName,
            email: adminEmail,
            password: passwordHash,
            role: 'ADMIN',
            tenantCompanyId: tenantCompany.id,
            accessB2B: moduleAccess.accessB2B,
            accessB2G: moduleAccess.accessB2G,
            accessPreSales: moduleAccess.accessPreSales,
            accessManagement: moduleAccess.accessManagement,
            accessAutomation: moduleAccess.accessAutomation,
            isCompanyOwner: true
          }
        });
      }

      return { tenantCompany, license, adminUser };
    });

    return res.status(201).json({
      data: {
        company: result.tenantCompany,
        license: result.license,
        adminUser: {
          id: result.adminUser.id,
          name: result.adminUser.name,
          email: result.adminUser.email,
          role: result.adminUser.role
        },
        credentials: {
          email: result.adminUser.email,
          password: adminPasswordInput ? null : passwordToUse
        },
        next: {
          loginUrl: '/login',
          status: 'AWAITING_MASTER_APPROVAL'
        }
      }
    });
  } catch (error) {
    console.error('Erro ao confirmar checkout/licenciamento:', error);
    return res.status(500).json({ error: error.message || 'Erro interno ao provisionar licenca' });
  }
});

// Area autenticada
router.use(authenticateToken);

router.get('/permissions/templates', (req, res) => {
  const templates = Object.entries(ROLE_PERMISSION_TEMPLATES).map(([role, permissions]) => ({
    role,
    roleLabel: roleUiLabel(role),
    moduleDefaults: resolveUserAccess(role),
    permissions
  }));

  return res.json({ data: templates });
});

router.get('/plans', requireRole(['ADMIN']), async (req, res) => {
  try {
    await ensureDefaultPlans();

    const plans = await prisma.licensePlan.findMany({
      orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }]
    });

    return res.json({ data: plans.map(toPublicPlan) });
  } catch (error) {
    console.error('Erro ao listar planos (admin):', error);
    return res.status(500).json({ error: 'Erro ao listar planos' });
  }
});

router.post('/plans', requireRole(['ADMIN']), async (req, res) => {
  try {
    if (!isMaster(req.user)) {
      return res.status(403).json({ error: 'Somente MASTER pode criar novos planos' });
    }

    const code = normalizeString(req.body?.code, 80)?.toUpperCase();
    const name = normalizeString(req.body?.name, 180);
    const billingCycle = String(req.body?.billingCycle || '').trim().toUpperCase();
    const price = normalizeFloat(req.body?.price);

    if (!code || !name || !['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'].includes(billingCycle) || price === null) {
      return res.status(400).json({ error: 'code, name, billingCycle e price são obrigatórios' });
    }

    const plan = await prisma.licensePlan.create({
      data: {
        code,
        name,
        description: normalizeString(req.body?.description, 400),
        billingCycle,
        price,
        currency: normalizeString(req.body?.currency, 8) || 'BRL',
        seatsIncluded: normalizeInt(req.body?.seatsIncluded) || 1,
        sortOrder: normalizeInt(req.body?.sortOrder) || 0,
        features: req.body?.features && typeof req.body.features === 'object' ? req.body.features : {},
        isActive: req.body?.isActive !== undefined ? Boolean(req.body.isActive) : true
      }
    });

    return res.status(201).json({ data: toPublicPlan(plan) });
  } catch (error) {
    console.error('Erro ao criar plano:', error);
    if (String(error.code || '').includes('P2002')) {
      return res.status(409).json({ error: 'Já existe plano com este código' });
    }
    return res.status(500).json({ error: 'Erro ao criar plano' });
  }
});

router.put('/plans/:id', requireRole(['ADMIN']), async (req, res) => {
  try {
    if (!isMaster(req.user)) {
      return res.status(403).json({ error: 'Somente MASTER pode editar planos' });
    }

    const id = normalizeString(req.params.id, 120);
    if (!id) return res.status(400).json({ error: 'ID do plano inválido' });

    const data = {
      name: req.body?.name !== undefined ? normalizeString(req.body.name, 180) : undefined,
      description: req.body?.description !== undefined ? normalizeString(req.body.description, 400) : undefined,
      billingCycle: req.body?.billingCycle ? String(req.body.billingCycle).trim().toUpperCase() : undefined,
      price: req.body?.price !== undefined ? normalizeFloat(req.body.price) : undefined,
      currency: req.body?.currency !== undefined ? normalizeString(req.body.currency, 8) : undefined,
      seatsIncluded: req.body?.seatsIncluded !== undefined ? normalizeInt(req.body.seatsIncluded) : undefined,
      sortOrder: req.body?.sortOrder !== undefined ? normalizeInt(req.body.sortOrder) : undefined,
      features: req.body?.features !== undefined && typeof req.body.features === 'object' ? req.body.features : undefined,
      isActive: req.body?.isActive !== undefined ? Boolean(req.body.isActive) : undefined
    };

    if (data.billingCycle && !['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'].includes(data.billingCycle)) {
      return res.status(400).json({ error: 'billingCycle inválido' });
    }

    Object.keys(data).forEach((key) => {
      if (data[key] === undefined || data[key] === null) delete data[key];
    });

    const plan = await prisma.licensePlan.update({
      where: { id },
      data
    });

    return res.json({ data: toPublicPlan(plan) });
  } catch (error) {
    console.error('Erro ao atualizar plano:', error);
    return res.status(500).json({ error: 'Erro ao atualizar plano' });
  }
});

router.get('/companies', requireRole(['ADMIN']), async (req, res) => {
  try {
    const where = {};
    if (!isMaster(req.user) && req.user.tenantCompanyId) {
      where.id = req.user.tenantCompanyId;
    }

    const companies = await prisma.tenantCompany.findMany({
      where,
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            accessB2B: true,
            accessB2G: true,
            accessPreSales: true,
            accessManagement: true,
            accessAutomation: true,
            isCompanyOwner: true,
            createdAt: true
          }
        },
        licenses: {
          include: {
            plan: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.json({
      data: companies.map(mapCompanyWithLicense),
      summary: {
        totalCompanies: companies.length,
        activeLicenses: companies.filter((company) => company.licenses.some((license) => license.status === 'ACTIVE')).length
      }
    });
  } catch (error) {
    console.error('Erro ao listar empresas de licenciamento:', error);
    return res.status(500).json({ error: 'Erro ao listar empresas' });
  }
});

router.post('/companies', requireRole(['ADMIN']), async (req, res) => {
  try {
    if (!isMaster(req.user)) {
      return res.status(403).json({ error: 'Somente MASTER pode cadastrar empresas manualmente' });
    }

    const name = normalizeString(req.body?.name, 220);
    if (!name) {
      return res.status(400).json({ error: 'name é obrigatório' });
    }

    const cnpj = normalizeCnpj(req.body?.cnpj);

    const company = await prisma.tenantCompany.create({
      data: {
        name,
        legalName: normalizeString(req.body?.legalName, 220),
        cnpj,
        email: normalizeEmail(req.body?.email),
        phone: normalizeString(req.body?.phone, 40),
        status: COMPANY_STATUS.has(String(req.body?.status || '').trim().toUpperCase())
          ? String(req.body.status).trim().toUpperCase()
          : 'PROSPECT',
        ...normalizeModuleAccess(req.body),
        notes: normalizeString(req.body?.notes, 600)
      }
    });

    return res.status(201).json({ data: company });
  } catch (error) {
    console.error('Erro ao criar empresa de licenciamento:', error);
    if (String(error.code || '').includes('P2002')) {
      return res.status(409).json({ error: 'CNPJ já cadastrado em outra empresa' });
    }
    return res.status(500).json({ error: 'Erro ao criar empresa' });
  }
});

router.put('/companies/:id', requireRole(['ADMIN']), async (req, res) => {
  try {
    if (!isMaster(req.user) && !ensureTenantAccess(req, req.params.id)) {
      return res.status(403).json({ error: 'Sem permissão para editar esta empresa' });
    }

    const companyId = normalizeString(req.params.id, 120);
    if (!companyId) return res.status(400).json({ error: 'ID da empresa inválido' });

    const existing = await prisma.tenantCompany.findUnique({
      where: { id: companyId },
      select: { id: true, accessB2B: true, accessB2G: true, accessPreSales: true, accessManagement: true, accessAutomation: true }
    });
    if (!existing) return res.status(404).json({ error: 'Empresa não encontrada' });

    const statusInput = String(req.body?.status || '').trim().toUpperCase();
    const company = await prisma.tenantCompany.update({
      where: { id: companyId },
      data: {
        name: normalizeString(req.body?.name, 220) || undefined,
        legalName: normalizeString(req.body?.legalName, 220),
        cnpj: normalizeCnpj(req.body?.cnpj),
        email: normalizeEmail(req.body?.email),
        phone: normalizeString(req.body?.phone, 40),
        status: isMaster(req.user) && COMPANY_STATUS.has(statusInput) ? statusInput : undefined,
        ...(isMaster(req.user) ? normalizeModuleAccess(req.body, existing) : {}),
        notes: normalizeString(req.body?.notes, 600)
      },
      include: {
        users: true,
        licenses: {
          include: { plan: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    return res.json({ data: mapCompanyWithLicense(company) });
  } catch (error) {
    console.error('Erro ao editar empresa de licenciamento:', error);
    if (String(error.code || '').includes('P2002')) {
      return res.status(409).json({ error: 'CNPJ já cadastrado em outra empresa' });
    }
    return res.status(500).json({ error: 'Erro ao editar empresa' });
  }
});

router.put('/companies/:id/role-policies', requireRole(['ADMIN']), async (req, res) => {
  try {
    const companyId = normalizeString(req.params.id, 120);
    if (!companyId) return res.status(400).json({ error: 'ID da empresa inválido' });

    if (!ensureTenantAccess(req, companyId)) {
      return res.status(403).json({ error: 'Sem permissão para alterar políticas desta empresa' });
    }

    const tenantCompany = await prisma.tenantCompany.findUnique({ where: { id: companyId } });
    if (!tenantCompany) return res.status(404).json({ error: 'Empresa não encontrada' });

    const rolePolicyOverrides = sanitizeRolePolicyOverrides(
      req.body?.policies || req.body?.rolePolicyOverrides || {},
      tenantCompany
    );

    const company = await prisma.$transaction(async (tx) => {
      await tx.tenantCompany.update({
        where: { id: companyId },
        data: { rolePolicyOverrides }
      });

      for (const [role, policy] of Object.entries(rolePolicyOverrides)) {
        const roleWhere = role === 'USER' ? { in: ['USER', 'SELLER'] } : role;
        await tx.user.updateMany({
          where: {
            tenantCompanyId: companyId,
            role: roleWhere
          },
          data: {
            accessB2B: policy.moduleAccess.accessB2B,
            accessB2G: policy.moduleAccess.accessB2G,
            accessPreSales: policy.moduleAccess.accessPreSales,
            accessManagement: policy.moduleAccess.accessManagement,
            accessAutomation: policy.moduleAccess.accessAutomation,
            permissionOverrides: policy.permissions
          }
        });
      }

      return tx.tenantCompany.findUnique({
        where: { id: companyId },
        include: {
          users: true,
          licenses: {
            include: { plan: true },
            orderBy: { createdAt: 'desc' }
          }
        }
      });
    });

    return res.json({ data: mapCompanyWithLicense(company) });
  } catch (error) {
    console.error('Erro ao salvar políticas por role:', error);
    return res.status(500).json({ error: 'Erro ao salvar políticas por role' });
  }
});

router.put('/companies/:id/license', requireRole(['ADMIN']), async (req, res) => {
  try {
    if (!isMaster(req.user)) {
      return res.status(403).json({ error: 'Somente MASTER pode alterar licenças de empresas' });
    }

    const companyId = normalizeString(req.params.id, 120);
    if (!companyId) {
      return res.status(400).json({ error: 'ID da empresa inválido' });
    }

    if (!ensureTenantAccess(req, companyId)) {
      return res.status(403).json({ error: 'Sem permissão para alterar licença desta empresa' });
    }

    const company = await prisma.tenantCompany.findUnique({ where: { id: companyId } });
    if (!company) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    const planId = normalizeString(req.body?.planId, 120);
    let plan = null;
    if (planId) {
      plan = await prisma.licensePlan.findUnique({ where: { id: planId } });
    } else if (req.body?.planCode) {
      plan = await prisma.licensePlan.findFirst({
        where: { code: String(req.body.planCode).trim().toUpperCase() }
      });
    }

    if (!plan) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }

    const statusInput = String(req.body?.status || 'ACTIVE').trim().toUpperCase();
    const status = LICENSE_STATUS.has(statusInput) ? statusInput : 'ACTIVE';

    const startDate = normalizeDate(req.body?.startDate) || new Date();
    const endDate = normalizeDate(req.body?.endDate) || calculateEndDate(startDate, plan.billingCycle);
    const seats = normalizeInt(req.body?.seats) || plan.seatsIncluded || 1;
    const paymentStatusInput = String(req.body?.paymentStatus || 'CONFIRMED').trim().toUpperCase();
    const paymentStatus = PAYMENT_STATUS.has(paymentStatusInput) ? paymentStatusInput : 'CONFIRMED';

    const license = await prisma.$transaction(async (tx) => {
      await tx.companyLicense.updateMany({
        where: {
          tenantCompanyId: companyId,
          status: 'ACTIVE'
        },
        data: {
          status: status === 'ACTIVE' ? 'EXPIRED' : 'ACTIVE'
        }
      });

      return tx.companyLicense.create({
        data: {
          tenantCompanyId: companyId,
          planId: plan.id,
          status,
          seats,
          startDate,
          endDate,
          priceAtPurchase: normalizeFloat(req.body?.priceAtPurchase) || plan.price,
          notes: normalizeString(req.body?.notes, 600),
          paymentReference: normalizeString(req.body?.paymentReference, 180),
          paymentStatus,
          paymentConfirmedAt: paymentStatus === 'CONFIRMED' ? new Date() : null
        },
        include: {
          plan: true
        }
      });
    });

    await prisma.tenantCompany.update({
      where: { id: companyId },
      data: {
        status: status === 'ACTIVE' ? 'ACTIVE' : company.status
      }
    });

    return res.json({ data: license });
  } catch (error) {
    console.error('Erro ao salvar licença da empresa:', error);
    if (String(error.code || '').includes('P2002')) {
      return res.status(409).json({ error: 'paymentReference já utilizada' });
    }
    return res.status(500).json({ error: 'Erro ao salvar licença da empresa' });
  }
});

router.post('/companies/:id/approve', requireRole(['ADMIN']), async (req, res) => {
  try {
    if (!isMaster(req.user)) {
      return res.status(403).json({ error: 'Somente MASTER pode aprovar empresas' });
    }

    const companyId = normalizeString(req.params.id, 120);
    if (!companyId) {
      return res.status(400).json({ error: 'ID da empresa inválido' });
    }

    const approved = await prisma.$transaction(async (tx) => {
      const company = await tx.tenantCompany.findUnique({
        where: { id: companyId },
        include: {
          users: true,
          licenses: {
            include: { plan: true },
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!company) {
        const notFound = new Error('Empresa não encontrada');
        notFound.statusCode = 404;
        throw notFound;
      }

      const licenseToActivate =
        company.licenses.find((license) => license.status === 'PENDING' && license.paymentStatus === 'CONFIRMED') ||
        company.licenses.find((license) => license.paymentStatus === 'CONFIRMED') ||
        company.licenses[0] ||
        null;

      if (!licenseToActivate) {
        const noLicense = new Error('Cadastre ou confirme uma licença antes de aprovar a empresa');
        noLicense.statusCode = 400;
        throw noLicense;
      }

      await tx.companyLicense.updateMany({
        where: {
          tenantCompanyId: companyId,
          status: 'ACTIVE',
          id: { not: licenseToActivate.id }
        },
        data: { status: 'EXPIRED' }
      });

      await tx.companyLicense.update({
        where: { id: licenseToActivate.id },
        data: {
          status: 'ACTIVE',
          paymentStatus: licenseToActivate.paymentStatus === 'CONFIRMED' ? 'CONFIRMED' : licenseToActivate.paymentStatus,
          paymentConfirmedAt: licenseToActivate.paymentConfirmedAt || new Date()
        }
      });

      await tx.user.updateMany({
        where: {
          tenantCompanyId: companyId,
          role: { in: ['ADMIN', 'MASTER'] }
        },
        data: {
          accessB2B: Boolean(company.accessB2B),
          accessB2G: Boolean(company.accessB2G),
          accessPreSales: Boolean(company.accessPreSales),
          accessManagement: Boolean(company.accessManagement),
          accessAutomation: Boolean(company.accessAutomation)
        }
      });

      await tx.user.updateMany({
        where: {
          tenantCompanyId: companyId,
          role: { notIn: ['ADMIN', 'MASTER'] }
        },
        data: {
          accessB2B: Boolean(company.accessB2B),
          accessB2G: Boolean(company.accessB2G),
          accessPreSales: Boolean(company.accessPreSales),
          accessManagement: false,
          accessAutomation: false
        }
      });

      const approvalNote = `Empresa aprovada por ${req.user.email || req.user.name || 'MASTER'} em ${new Date().toISOString()}`;
      await tx.tenantCompany.update({
        where: { id: companyId },
        data: {
          status: 'ACTIVE',
          notes: [company.notes, approvalNote].filter(Boolean).join('\n')
        }
      });

      return tx.tenantCompany.findUnique({
        where: { id: companyId },
        include: {
          users: true,
          licenses: {
            include: { plan: true },
            orderBy: { createdAt: 'desc' }
          }
        }
      });
    });

    return res.json({ data: mapCompanyWithLicense(approved) });
  } catch (error) {
    console.error('Erro ao aprovar empresa:', error);
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Erro ao aprovar empresa' });
  }
});

router.delete('/companies/:id', requireRole(['ADMIN']), async (req, res) => {
  try {
    if (!isMaster(req.user)) {
      return res.status(403).json({ error: 'Somente MASTER pode excluir empresas' });
    }

    const companyId = normalizeString(req.params.id, 120);
    if (!companyId) {
      return res.status(400).json({ error: 'ID da empresa inválido' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.deleteMany({
        where: {
          tenantCompanyId: companyId,
          role: { not: 'MASTER' }
        }
      });

      await tx.companyLicense.deleteMany({
        where: {
          tenantCompanyId: companyId
        }
      });

      await tx.tenantCompany.delete({
        where: { id: companyId }
      });
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir empresa:', error);
    return res.status(500).json({ error: 'Erro ao excluir empresa' });
  }
});

router.get('/companies/:id/users', requireRole(['ADMIN']), async (req, res) => {
  try {
    const companyId = normalizeString(req.params.id, 120);
    if (!companyId) return res.status(400).json({ error: 'ID da empresa inválido' });

    if (!ensureTenantAccess(req, companyId)) {
      return res.status(403).json({ error: 'Sem permissão para listar usuários desta empresa' });
    }

    const tenantCompany = await prisma.tenantCompany.findUnique({ where: { id: companyId } });
    if (!tenantCompany) return res.status(404).json({ error: 'Empresa não encontrada' });

    const users = await prisma.user.findMany({
      where: {
        tenantCompanyId: companyId
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accessB2B: true,
        accessB2G: true,
        accessPreSales: true,
        accessManagement: true,
        accessAutomation: true,
        isCompanyOwner: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.json({
      data: users.map((user) => {
        const role = normalizeRole(user.role);
        const access = constrainAccessToTenant(resolveUserAccess(role, user), tenantCompany);
        return {
          ...user,
          role,
          accessB2B: access.accessB2B,
          accessB2G: access.accessB2G,
          accessPreSales: access.accessPreSales,
          accessManagement: access.accessManagement,
          accessAutomation: access.accessAutomation
        };
      })
    });
  } catch (error) {
    console.error('Erro ao listar usuários da empresa:', error);
    return res.status(500).json({ error: 'Erro ao listar usuários da empresa' });
  }
});

router.post('/companies/:id/users', requireRole(['ADMIN']), async (req, res) => {
  try {
    const companyId = normalizeString(req.params.id, 120);
    if (!companyId) return res.status(400).json({ error: 'ID da empresa inválido' });

    if (!ensureTenantAccess(req, companyId)) {
      return res.status(403).json({ error: 'Sem permissão para criar usuários nesta empresa' });
    }

    const tenantCompany = await prisma.tenantCompany.findUnique({ where: { id: companyId } });
    if (!tenantCompany) return res.status(404).json({ error: 'Empresa não encontrada' });

    const name = normalizeString(req.body?.name, 180);
    const email = normalizeEmail(req.body?.email);
    const passwordInput = normalizeString(req.body?.password, 120) || generatePassword();
    const role = normalizeRole(req.body?.role || 'USER');

    if (!name || !email) {
      return res.status(400).json({ error: 'name e email são obrigatórios' });
    }

    if (role === 'MASTER') {
      return res.status(403).json({ error: 'Role MASTER não pode ser criada por esta rota' });
    }

    if (role === 'ADMIN' && !isMaster(req.user)) {
      return res.status(403).json({ error: 'Somente MASTER pode criar múltiplos administradores globais' });
    }

    const existing = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive'
        }
      }
    });

    if (existing) {
      return res.status(409).json({ error: 'Já existe usuário com este email' });
    }

    const access = constrainAccessToTenant(resolveUserAccess(role, {
        accessB2B: req.body?.accessB2B,
        accessB2G: req.body?.accessB2G,
        accessPreSales: req.body?.accessPreSales,
        accessManagement: req.body?.accessManagement,
        accessAutomation: req.body?.accessAutomation
    }), tenantCompany);

    const permissionOverrides = req.body?.permissionOverrides && typeof req.body.permissionOverrides === 'object'
      ? req.body.permissionOverrides
      : {};

    const password = await bcrypt.hash(passwordInput, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password,
        role,
        tenantCompanyId: companyId,
        accessB2B: access.accessB2B,
        accessB2G: access.accessB2G,
        accessPreSales: access.accessPreSales,
        accessManagement: access.accessManagement,
        accessAutomation: access.accessAutomation,
        permissionOverrides,
        isCompanyOwner: false
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tenantCompanyId: true,
        accessB2B: true,
        accessB2G: true,
        accessPreSales: true,
        accessManagement: true,
        accessAutomation: true,
        createdAt: true
      }
    });

    return res.status(201).json({
      data: {
        ...user,
        permissions: getPermissionTemplate(role, permissionOverrides),
        generatedPassword: req.body?.password ? null : passwordInput
      }
    });
  } catch (error) {
    console.error('Erro ao criar usuário da empresa:', error);
    return res.status(500).json({ error: 'Erro ao criar usuário da empresa' });
  }
});

router.patch('/users/:id/access', requireRole(['ADMIN']), async (req, res) => {
  try {
    const userId = normalizeString(req.params.id, 120);
    if (!userId) return res.status(400).json({ error: 'ID do usuário inválido' });

    const current = await prisma.user.findUnique({ where: { id: userId } });
    if (!current) return res.status(404).json({ error: 'Usuário não encontrado' });

    if (!ensureTenantAccess(req, current.tenantCompanyId)) {
      return res.status(403).json({ error: 'Sem permissão para alterar este usuário' });
    }

    const role = req.body?.role ? normalizeRole(req.body.role) : normalizeRole(current.role);
    if (role === 'MASTER') {
      return res.status(403).json({ error: 'Role MASTER não pode ser editada por esta rota' });
    }

    const tenantCompany = current.tenantCompanyId
      ? await prisma.tenantCompany.findUnique({ where: { id: current.tenantCompanyId } })
      : null;

    const access = constrainAccessToTenant(resolveUserAccess(role, {
      accessB2B: req.body?.accessB2B,
      accessB2G: req.body?.accessB2G,
      accessPreSales: req.body?.accessPreSales,
      accessManagement: req.body?.accessManagement,
      accessAutomation: req.body?.accessAutomation
    }), tenantCompany || {});

    const permissionOverrides = req.body?.permissionOverrides && typeof req.body.permissionOverrides === 'object'
      ? req.body.permissionOverrides
      : current.permissionOverrides;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        role,
        accessB2B: access.accessB2B,
        accessB2G: access.accessB2G,
        accessPreSales: access.accessPreSales,
        accessManagement: access.accessManagement,
        accessAutomation: access.accessAutomation,
        permissionOverrides
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accessB2B: true,
        accessB2G: true,
        accessPreSales: true,
        accessManagement: true,
        accessAutomation: true,
        permissionOverrides: true,
        tenantCompanyId: true,
        isCompanyOwner: true
      }
    });

    return res.json({
      data: {
        ...updated,
        permissions: getPermissionTemplate(updated.role, updated.permissionOverrides)
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar acesso do usuário:', error);
    return res.status(500).json({ error: 'Erro ao atualizar acesso do usuário' });
  }
});

module.exports = router;
