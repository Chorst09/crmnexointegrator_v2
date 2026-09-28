/**
 * Configuração de Permissões por Função - ADAPTADO PARA O CRM
 * 
 * Define quais funcionalidades cada função de usuário pode acessar
 * Integrado com roles do CRM: MASTER, ADMIN, MANAGER, USER, PRE_SALES
 */

export type CanonicalUserRole = 'master' | 'admin' | 'manager' | 'director' | 'user' | 'pre_sales' | 'seller' | 'pending';

export type UserRole =
  | CanonicalUserRole
  | 'MASTER'
  | 'ADMIN'
  | 'MANAGER'
  | 'DIRECTOR'
  | 'USER'
  | 'PRE_SALES'
  | 'SELLER'
  | 'administrador'
  | 'diretor'
  | 'usuario'
  | 'vendedor'
  | 'gerente'
  | string;

export interface RolePermissions {
  canAccessCalculators: boolean;
  canViewAllProposals: boolean;
  canViewOwnProposals: boolean;
  canCreateProposals: boolean;
  canEditProposals: boolean;
  canDeleteProposals: boolean;
  canAccessAdmin: boolean;
  canManageUsers: boolean;
  canEditCommissions: boolean; // ← IMPORTANTE: Controla acesso a Tabela de Preços, Comissões e DRE
  canAccessGestaoOportunidades: boolean;
  // Simulador specific permissions
  canAccessSimulador: boolean;
  canViewSimuladorPricing: boolean;
  canViewSimuladorCommissions: boolean;
  canViewSimuladorDRE: boolean;
}

const normalizeRoleToken = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function normalizeUserRole(role: string | null | undefined): CanonicalUserRole {
  const normalized = normalizeRoleToken(role || '');
  
  // MASTER - Acesso total
  if (['master'].includes(normalized)) {
    return 'master';
  }
  
  // ADMIN - Administradores
  if (['admin', 'administrador', 'administrator'].includes(normalized)) {
    return 'admin';
  }
  
  // MANAGER - Gerentes com permissões avançadas
  if (['manager', 'gerente'].includes(normalized)) {
    return 'manager';
  }
  
  // DIRECTOR - Diretores
  if (['director', 'diretor'].includes(normalized)) {
    return 'director';
  }
  
  // PRE_SALES - Pré-vendas
  if (['pre_sales', 'prevendas', 'pre-vendas'].includes(normalized)) {
    return 'pre_sales';
  }
  
  // SELLER/USER - Vendedores e usuários padrão
  if (['user', 'usuario', 'seller', 'vendedor'].includes(normalized)) {
    return 'user';
  }
  
  // PENDING - Aguardando aprovação
  if (['pending', 'pendente'].includes(normalized)) {
    return 'pending';
  }
  
  return 'pending';
}

export const ROLE_PERMISSIONS: Record<CanonicalUserRole, RolePermissions> = {
  master: {
    canAccessCalculators: true,
    canViewAllProposals: true,
    canViewOwnProposals: true,
    canCreateProposals: true,
    canEditProposals: true,
    canDeleteProposals: true,
    canAccessAdmin: true,
    canManageUsers: true,
    canEditCommissions: true, // ✅ MASTER vê Tabela de Preços, Comissões e DRE
    canAccessGestaoOportunidades: true,
    canAccessSimulador: true,
    canViewSimuladorPricing: true,
    canViewSimuladorCommissions: true,
    canViewSimuladorDRE: true,
  },
  admin: {
    canAccessCalculators: true,
    canViewAllProposals: true,
    canViewOwnProposals: true,
    canCreateProposals: true,
    canEditProposals: true,
    canDeleteProposals: true,
    canAccessAdmin: true,
    canManageUsers: true,
    canEditCommissions: true, // ✅ ADMIN vê Tabela de Preços, Comissões e DRE
    canAccessGestaoOportunidades: true,
    canAccessSimulador: true,
    canViewSimuladorPricing: true,
    canViewSimuladorCommissions: true,
    canViewSimuladorDRE: true,
  },
  manager: {
    canAccessCalculators: true,
    canViewAllProposals: true,
    canViewOwnProposals: true,
    canCreateProposals: true,
    canEditProposals: true,
    canDeleteProposals: true,
    canAccessAdmin: false,
    canManageUsers: false,
    canEditCommissions: true, // ✅ MANAGER vê Tabela de Preços, Comissões e DRE
    canAccessGestaoOportunidades: true,
    canAccessSimulador: true,
    canViewSimuladorPricing: true,
    canViewSimuladorCommissions: true,
    canViewSimuladorDRE: true,
  },
  director: {
    canAccessCalculators: true,
    canViewAllProposals: true,
    canViewOwnProposals: true,
    canCreateProposals: true,
    canEditProposals: true,
    canDeleteProposals: true,
    canAccessAdmin: false,
    canManageUsers: false,
    canEditCommissions: false, // ❌ DIRECTOR não vê tabs avançadas
    canAccessGestaoOportunidades: true,
    canAccessSimulador: true,
    canViewSimuladorPricing: false,
    canViewSimuladorCommissions: false,
    canViewSimuladorDRE: false,
  },
  user: {
    canAccessCalculators: true,
    canViewAllProposals: false,
    canViewOwnProposals: true,
    canCreateProposals: true,
    canEditProposals: true,
    canDeleteProposals: true,
    canAccessAdmin: false,
    canManageUsers: false,
    canEditCommissions: false, // ❌ USER não vê tabs avançadas
    canAccessGestaoOportunidades: true,
    canAccessSimulador: true,
    canViewSimuladorPricing: false,
    canViewSimuladorCommissions: false,
    canViewSimuladorDRE: false,
  },
  pre_sales: {
    canAccessCalculators: true,
    canViewAllProposals: false,
    canViewOwnProposals: true,
    canCreateProposals: true,
    canEditProposals: true,
    canDeleteProposals: false,
    canAccessAdmin: false,
    canManageUsers: false,
    canEditCommissions: false, // ❌ PRE_SALES não vê tabs avançadas
    canAccessGestaoOportunidades: false,
    canAccessSimulador: true,
    canViewSimuladorPricing: false,
    canViewSimuladorCommissions: false,
    canViewSimuladorDRE: false,
  },
  seller: {
    canAccessCalculators: true,
    canViewAllProposals: false,
    canViewOwnProposals: true,
    canCreateProposals: true,
    canEditProposals: true,
    canDeleteProposals: true,
    canAccessAdmin: false,
    canManageUsers: false,
    canEditCommissions: false, // ❌ SELLER não vê tabs avançadas
    canAccessGestaoOportunidades: true,
    canAccessSimulador: true,
    canViewSimuladorPricing: false,
    canViewSimuladorCommissions: false,
    canViewSimuladorDRE: false,
  },
  pending: {
    canAccessCalculators: false,
    canViewAllProposals: false,
    canViewOwnProposals: false,
    canCreateProposals: false,
    canEditProposals: false,
    canDeleteProposals: false,
    canAccessAdmin: false,
    canManageUsers: false,
    canEditCommissions: false,
    canAccessGestaoOportunidades: false,
    canAccessSimulador: false,
    canViewSimuladorPricing: false,
    canViewSimuladorCommissions: false,
    canViewSimuladorDRE: false,
  },
};

/**
 * Obtém as permissões para uma função específica
 */
export function getPermissionsForRole(role: string | null | undefined): RolePermissions {
  const normalizedRole = normalizeUserRole(role);
  return ROLE_PERMISSIONS[normalizedRole];
}

/**
 * Verifica se um usuário pode acessar uma funcionalidade
 */
export function canUserAccess(role: string | null | undefined, permission: keyof RolePermissions): boolean {
  const permissions = getPermissionsForRole(role);
  return permissions[permission] || false;
}
