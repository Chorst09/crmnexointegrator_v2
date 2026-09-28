import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcryptjs';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeRole = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'PRE-VENDAS' || raw === 'PREVENDAS') return 'PRE_SALES';
  if (raw === 'USUARIO') return 'USER';
  return raw || 'USER';
};

const isMaster = (reqUser = {}) => normalizeRole(reqUser.actualRole || reqUser.role) === 'MASTER';

const resolveUserAccess = (role, input = {}) => {
  const r = normalizeRole(role);
  if (r === 'MASTER') {
    return { accessB2B: true, accessB2G: true, accessPreSales: true, accessManagement: true, accessAutomation: true };
  }

  const defaults = {
    ADMIN: { accessB2B: true, accessB2G: true, accessPreSales: true, accessManagement: true, accessAutomation: true },
    MANAGER: { accessB2B: true, accessB2G: true, accessPreSales: true, accessManagement: true, accessAutomation: true },
    DIRECTOR: { accessB2B: true, accessB2G: true, accessPreSales: false, accessManagement: true, accessAutomation: false },
    PRE_SALES: { accessB2B: false, accessB2G: false, accessPreSales: true, accessManagement: false, accessAutomation: false },
    USER: { accessB2B: true, accessB2G: false, accessPreSales: false, accessManagement: false, accessAutomation: false }
  }[r] || { accessB2B: true, accessB2G: false, accessPreSales: false, accessManagement: false, accessAutomation: false };

  const accessB2B = input.accessB2B !== undefined ? Boolean(input.accessB2B) : defaults.accessB2B;
  const accessB2G = input.accessB2G !== undefined ? Boolean(input.accessB2G) : defaults.accessB2G;
  const accessPreSales = input.accessPreSales !== undefined ? Boolean(input.accessPreSales) : defaults.accessPreSales;
  const accessManagement = input.accessManagement !== undefined ? Boolean(input.accessManagement) : defaults.accessManagement;
  const accessAutomation = input.accessAutomation !== undefined ? Boolean(input.accessAutomation) : defaults.accessAutomation;

  return {
    accessB2B,
    accessB2G,
    accessPreSales,
    accessManagement,
    accessAutomation
  };
};

const selectTenantAccess = {
  accessB2B: true,
  accessB2G: true,
  accessPreSales: true,
  accessManagement: true,
  accessAutomation: true
};

const constrainAccessToTenant = (access, tenantCompany) => {
  if (!tenantCompany) return access;
  return {
    accessB2B: Boolean(access.accessB2B && tenantCompany.accessB2B),
    accessB2G: Boolean(access.accessB2G && tenantCompany.accessB2G),
    accessPreSales: Boolean(access.accessPreSales && tenantCompany.accessPreSales),
    accessManagement: Boolean(access.accessManagement && tenantCompany.accessManagement),
    accessAutomation: Boolean(access.accessAutomation && tenantCompany.accessAutomation)
  };
};

const resolveStoredUserAccess = (role, user = {}) => {
  const normalizedRole = normalizeRole(role);
  const defaultAccess = resolveUserAccess(normalizedRole, user);
  if (normalizedRole === 'MASTER') return defaultAccess;

  return {
    accessB2B: user.accessB2B !== undefined && user.accessB2B !== null ? Boolean(user.accessB2B) : defaultAccess.accessB2B,
    accessB2G: user.accessB2G !== undefined && user.accessB2G !== null ? Boolean(user.accessB2G) : defaultAccess.accessB2G,
    accessPreSales: user.accessPreSales !== undefined && user.accessPreSales !== null ? Boolean(user.accessPreSales) : defaultAccess.accessPreSales,
    accessManagement: user.accessManagement !== undefined && user.accessManagement !== null ? Boolean(user.accessManagement) : defaultAccess.accessManagement,
    accessAutomation: user.accessAutomation !== undefined && user.accessAutomation !== null ? Boolean(user.accessAutomation) : defaultAccess.accessAutomation
  };
};

const sanitizeUser = (user) => {
  if (!user) return user;
  const role = normalizeRole(user.role);
  const access = resolveStoredUserAccess(role, user);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role,
    region: user.region,
    regionId: user.regionId || user.region?.id || null,
    tenantCompany: user.tenantCompany || null,
    quota: user.quota,
    commissionSalePercentage: user.commissionSalePercentage ?? null,
    commissionProject12: user.commissionProject12 ?? null,
    commissionProject24: user.commissionProject24 ?? null,
    commissionProject36: user.commissionProject36 ?? null,
    commissionProject48: user.commissionProject48 ?? null,
    commissionProject60: user.commissionProject60 ?? null,
    tenantCompanyId: user.tenantCompanyId || null,
    accessB2B: Boolean(access.accessB2B),
    accessB2G: Boolean(access.accessB2G),
    accessPreSales: Boolean(access.accessPreSales),
    accessManagement: Boolean(access.accessManagement),
    accessAutomation: Boolean(access.accessAutomation),
    isCompanyOwner: Boolean(user.isCompanyOwner),
    permissionOverrides: user.permissionOverrides || {},
    createdAt: user.createdAt,
    _count: user._count
  };
};

const canManageUsers = (reqUser) => {
  const role = normalizeRole(reqUser?.actualRole || reqUser?.role);
  return role === 'ADMIN' || role === 'MASTER';
};

export default async function handler(req) {
  if (req.method === 'GET') {
    const { role } = req.query || {};

    const requesterRole = normalizeRole(req.user?.actualRole || req.user?.role);

    if (requesterRole === 'USER' || requesterRole === 'SELLER' || requesterRole === 'PRE_SALES') {
      const me = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          regionId: true,
          region: { select: { id: true, name: true, code: true } },
          quota: true,
          commissionSalePercentage: true,
          commissionProject12: true,
          commissionProject24: true,
          commissionProject36: true,
          commissionProject48: true,
          commissionProject60: true,
          tenantCompanyId: true,
          tenantCompany: { select: { id: true, name: true, legalName: true, status: true } },
          accessB2B: true,
          accessB2G: true,
          accessPreSales: true,
          accessManagement: true,
          accessAutomation: true,
          permissionOverrides: true,
          isCompanyOwner: true,
          createdAt: true,
          _count: { select: { opportunities: true, activities: true, commissions: true } }
        }
      });
      return Response.json(me ? [sanitizeUser(me)] : []);
    }

    const where = {};
    if (role) where.role = normalizeRole(role);

    if (!isMaster(req.user) && req.user?.tenantCompanyId) {
      where.tenantCompanyId = req.user.tenantCompanyId;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        regionId: true,
        region: {
          select: { id: true, name: true, code: true }
        },
        quota: true,
        commissionSalePercentage: true,
        commissionProject12: true,
        commissionProject24: true,
        commissionProject36: true,
        commissionProject48: true,
        commissionProject60: true,
        tenantCompanyId: true,
        tenantCompany: { select: { id: true, name: true, legalName: true, status: true } },
        accessB2B: true,
        accessB2G: true,
        accessPreSales: true,
        accessManagement: true,
        accessAutomation: true,
        permissionOverrides: true,
        isCompanyOwner: true,
        createdAt: true,
        _count: {
          select: {
            opportunities: true,
            activities: true,
            commissions: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    return Response.json(users.map(sanitizeUser));
  }

  if (req.method === 'POST') {
    const body = await req.json();

    if (!canManageUsers(req.user)) {
      return new Response('Forbidden', { status: 403 });
    }

    if (!body?.name || !body?.email || !body?.password) {
      return Response.json(
        { error: 'Nome, email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeEmail(body.email);
    const role = normalizeRole(body.role || 'USER');

    if (role === 'MASTER' && !isMaster(req.user)) {
      return Response.json({ error: 'Apenas MASTER pode criar usuário MASTER' }, { status: 403 });
    }

    const existing = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive'
        }
      },
      select: { id: true }
    });

    if (existing) {
      return Response.json({ error: 'Email já está em uso' }, { status: 409 });
    }

    const tenantCompanyId = isMaster(req.user)
      ? (body.tenantCompanyId || null)
      : (req.user?.tenantCompanyId || null);

    if (!isMaster(req.user) && body.tenantCompanyId && body.tenantCompanyId !== req.user?.tenantCompanyId) {
      return Response.json({ error: 'Sem permissão para criar usuário em outra empresa' }, { status: 403 });
    }

    const tenantCompany = tenantCompanyId
      ? await prisma.tenantCompany.findUnique({ where: { id: tenantCompanyId }, select: selectTenantAccess })
      : null;
    if (tenantCompanyId && !tenantCompany) {
      return Response.json({ error: 'Empresa vinculada não encontrada' }, { status: 400 });
    }

    const requestedAccess = resolveUserAccess(role, {
      accessB2B: body.accessB2B,
      accessB2G: body.accessB2G,
      accessPreSales: body.accessPreSales,
      accessManagement: body.accessManagement,
      accessAutomation: body.accessAutomation
    });
    const access = isMaster(req.user) ? requestedAccess : constrainAccessToTenant(requestedAccess, tenantCompany);

    const hashedPassword = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: normalizedEmail,
        password: hashedPassword,
        role,
        regionId: body.regionId || null,
        quota: body.quota,
        commissionSalePercentage: body.commissionSalePercentage ?? null,
        commissionProject12: body.commissionProject12 ?? null,
        commissionProject24: body.commissionProject24 ?? null,
        commissionProject36: body.commissionProject36 ?? null,
        commissionProject48: body.commissionProject48 ?? null,
        commissionProject60: body.commissionProject60 ?? null,
        tenantCompanyId,
        accessB2B: access.accessB2B,
        accessB2G: access.accessB2G,
        accessPreSales: access.accessPreSales,
        accessManagement: access.accessManagement,
        accessAutomation: access.accessAutomation,
        permissionOverrides:
          body.permissionOverrides && typeof body.permissionOverrides === 'object'
            ? body.permissionOverrides
            : {},
        isCompanyOwner: Boolean(body.isCompanyOwner) && role === 'ADMIN'
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        regionId: true,
        region: {
          select: { id: true, name: true, code: true }
        },
        quota: true,
        commissionSalePercentage: true,
        commissionProject12: true,
        commissionProject24: true,
        commissionProject36: true,
        commissionProject48: true,
        commissionProject60: true,
        tenantCompanyId: true,
        tenantCompany: { select: { id: true, name: true, legalName: true, status: true } },
        accessB2B: true,
        accessB2G: true,
        accessPreSales: true,
          accessManagement: true,
          accessAutomation: true,
        permissionOverrides: true,
        isCompanyOwner: true,
        createdAt: true
      }
    });

    return Response.json(sanitizeUser(user), { status: 201 });
  }

  if (req.method === 'PUT') {
    const body = await req.json();

    if (!canManageUsers(req.user)) {
      return new Response('Forbidden', { status: 403 });
    }

    if (!body?.id) {
      return Response.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const current = await prisma.user.findUnique({
      where: { id: body.id },
      select: {
        id: true,
        email: true,
        role: true,
        tenantCompanyId: true,
        isCompanyOwner: true
      }
    });

    if (!current) {
      return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    if (!isMaster(req.user) && current.tenantCompanyId !== req.user?.tenantCompanyId) {
      return Response.json({ error: 'Sem permissão para editar usuário de outra empresa' }, { status: 403 });
    }

    const nextRole = body.role ? normalizeRole(body.role) : normalizeRole(current.role);
    if (nextRole === 'MASTER' && !isMaster(req.user)) {
      return Response.json({ error: 'Apenas MASTER pode atribuir role MASTER' }, { status: 403 });
    }

    if (current.isCompanyOwner && !isMaster(req.user) && nextRole !== 'ADMIN') {
      return Response.json({ error: 'Não é permitido remover role ADMIN do dono da empresa' }, { status: 403 });
    }

    const nextTenantCompanyId =
      isMaster(req.user) && body.tenantCompanyId !== undefined
        ? body.tenantCompanyId
        : current.tenantCompanyId;
    const tenantCompany = nextTenantCompanyId
      ? await prisma.tenantCompany.findUnique({ where: { id: nextTenantCompanyId }, select: selectTenantAccess })
      : null;
    if (nextTenantCompanyId && !tenantCompany) {
      return Response.json({ error: 'Empresa vinculada não encontrada' }, { status: 400 });
    }

    const requestedAccess = resolveUserAccess(nextRole, {
      accessB2B: body.accessB2B,
      accessB2G: body.accessB2G,
      accessPreSales: body.accessPreSales,
      accessManagement: body.accessManagement,
      accessAutomation: body.accessAutomation
    });
    const access = isMaster(req.user) ? requestedAccess : constrainAccessToTenant(requestedAccess, tenantCompany);

    const updateData = {
      name: body.name,
      role: nextRole,
      regionId: body.regionId || null,
      quota: body.quota,
      commissionSalePercentage: body.commissionSalePercentage ?? null,
      commissionProject12: body.commissionProject12 ?? null,
      commissionProject24: body.commissionProject24 ?? null,
      commissionProject36: body.commissionProject36 ?? null,
      commissionProject48: body.commissionProject48 ?? null,
      commissionProject60: body.commissionProject60 ?? null,
      accessB2B: access.accessB2B,
      accessB2G: access.accessB2G,
      accessPreSales: access.accessPreSales,
      accessManagement: access.accessManagement,
      accessAutomation: access.accessAutomation,
      permissionOverrides:
        body.permissionOverrides && typeof body.permissionOverrides === 'object'
          ? body.permissionOverrides
          : undefined,
      isCompanyOwner: body.isCompanyOwner !== undefined ? Boolean(body.isCompanyOwner) : undefined,
      tenantCompanyId:
        isMaster(req.user) && body.tenantCompanyId !== undefined
          ? body.tenantCompanyId
          : undefined
    };

    if (body.password) {
      updateData.password = await bcrypt.hash(body.password, 10);
    }

    if (body.email) {
      const normalizedEmail = normalizeEmail(body.email);
      if (normalizedEmail !== current.email) {
        const emailTaken = await prisma.user.findFirst({
          where: {
            email: { equals: normalizedEmail, mode: 'insensitive' },
            id: { not: body.id }
          },
          select: { id: true }
        });
        if (emailTaken) {
          return Response.json({ error: 'Email já está em uso' }, { status: 409 });
        }
        updateData.email = normalizedEmail;
      }
    }

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    const user = await prisma.user.update({
      where: { id: body.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        regionId: true,
        region: {
          select: { id: true, name: true, code: true }
        },
        quota: true,
        commissionSalePercentage: true,
        commissionProject12: true,
        commissionProject24: true,
        commissionProject36: true,
        commissionProject48: true,
        commissionProject60: true,
        tenantCompanyId: true,
        tenantCompany: { select: { id: true, name: true, legalName: true, status: true } },
        accessB2B: true,
        accessB2G: true,
        accessPreSales: true,
        accessManagement: true,
        accessAutomation: true,
        permissionOverrides: true,
        isCompanyOwner: true,
        createdAt: true
      }
    });

    return Response.json(sanitizeUser(user));
  }

  if (req.method === 'DELETE') {
    const body = await req.json();
    const { id } = body;

    if (!canManageUsers(req.user)) {
      return new Response('Forbidden', { status: 403 });
    }

    if (!id) {
      return Response.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        tenantCompanyId: true,
        isCompanyOwner: true
      }
    });

    if (!user) {
      return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    if (!isMaster(req.user) && user.tenantCompanyId !== req.user?.tenantCompanyId) {
      return Response.json({ error: 'Sem permissão para excluir usuário de outra empresa' }, { status: 403 });
    }

    if (user.isCompanyOwner) {
      return Response.json({ error: 'Não é permitido excluir usuário dono da empresa' }, { status: 403 });
    }

    await prisma.user.delete({
      where: { id }
    });

    return Response.json({ message: 'Usuário excluído com sucesso' });
  }

  return new Response('Method not allowed', { status: 405 });
}
