import { Navigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { moduleFromPath, canAccessModule, roleSatisfiesAllowed, toCanonicalRole } from '../utils/permissions';

const RoleGuard = ({ children, allowedRoles }) => {
  const location = useLocation();
  const userRaw = localStorage.getItem('user');
  let user = null;

  try {
    user = userRaw ? JSON.parse(userRaw) : null;
  } catch (error) {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }

  const email = String(user?.email || '').trim().toLowerCase();
  const isMasterUser = email === 'admin@crm.com' || email === 'chorstconsult@gmail.com' || toCanonicalRole(user?.role, user) === 'MASTER';
  const role = isMasterUser ? 'MASTER' : toCanonicalRole(user?.role || null, user);

  if (isMasterUser) return children;
  if (!allowedRoles || allowedRoles.length === 0) return children;
  if (!role) return <Navigate to="/login" replace />;

  const moduleName = moduleFromPath(location.pathname);
  if (moduleName && !canAccessModule(user, moduleName)) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="crm-panel p-8 text-center max-w-lg motion-safe:animate-fade-up">
          <h1 className="text-2xl font-bold text-[var(--crm-ink)] mb-2">Acesso negado</h1>
          <p className="text-[var(--crm-muted)]">Seu perfil não possui acesso ao módulo solicitado.</p>
        </div>
      </div>
    );
  }

  if (!roleSatisfiesAllowed(role, allowedRoles)) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="crm-panel p-8 text-center max-w-lg motion-safe:animate-fade-up">
          <h1 className="text-2xl font-bold text-[var(--crm-ink)] mb-2">Acesso negado</h1>
          <p className="text-[var(--crm-muted)]">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return children;
};

export default RoleGuard;
