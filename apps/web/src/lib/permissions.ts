/**
 * Configuração de Permissões por Função
 * 
 * Define quais funcionalidades cada função de usuário pode acessar
 */

export type CanonicalUserRole = 'admin' | 'director' | 'user' | 'pending';
export type UserRole =
  | CanonicalUserRole
  | 'administrador'
  | 'diretor'
  | 'usuario'
  | 'vendedor'
  | 'seller'
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
  canEditCommissions: boolean;
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

  if (['admin', 'administrador', 'administrator'].includes(normalized)) {
    return 'admin';
  }

  if (['director', 'diretor'].includes(normalized)) {
    return 'director';
  }

  if (['pending', 'pendente'].includes(normalized)) {
    return 'pending';
  }

  // Perfis legados/comerciais entram como usuário padrão
  if (['user', 'usuario', 'seller', 'vendedor', 'gerente'].includes(normalized)) {
    return 'user';
  }

  return 'pending';
}

export const ROLE_PERMISSIONS: Record<CanonicalUserRole, RolePermissions> = {
  admin: {
    canAccessCalculators: true,
    canViewAllProposals: true,
    canViewOwnProposals: true,
    canCreateProposals: true,
    canEditProposals: true,
    canDeleteProposals: true,
    canAccessAdmin: true,
    canManageUsers: true,
    canEditCommissions: true,
    canAccessGestaoOportunidades: true,
    canAccessSimulador: true,
    canViewSimuladorPricing: true,
    canViewSimuladorCommissions: true,
    canViewSimuladorDRE: true,
  },
  director: {
    canAccessCalculators: true,
    canViewAllProposals: true,  // Diretor pode visualizar TODAS as propostas
    canViewOwnProposals: true,
    canCreateProposals: true,
    canEditProposals: true,
    canDeleteProposals: true,
    canAccessAdmin: false,
    canManageUsers: false,
    canEditCommissions: false,
    canAccessGestaoOportunidades: true,
    canAccessSimulador: true,
    canViewSimuladorPricing: true,
    canViewSimuladorCommissions: true,
    canViewSimuladorDRE: true,
  },
  user: {
    canAccessCalculators: true,
    canViewAllProposals: false,
    canViewOwnProposals: true,  // Usuário pode visualizar APENAS suas próprias propostas
    canCreateProposals: true,
    canEditProposals: true,
    canDeleteProposals: true,
    canAccessAdmin: false,
    canManageUsers: false,
    canEditCommissions: false,
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
