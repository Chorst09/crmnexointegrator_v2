import { getDashboardMarket } from '../utils/dashboardMarket.mjs';
import { NEON_DASHBOARD_ROUTES } from '../utils/dashboardPresentation';
import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppShell() {
  const pathname = useLocation().pathname;
  const executive = NEON_DASHBOARD_ROUTES.has(pathname);
  const market = getDashboardMarket(pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('crm-sidebar-collapsed') === 'true'; }
    catch { return false; }
  });

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((previous) => {
      const next = !previous;
      try { localStorage.setItem('crm-sidebar-collapsed', String(next)); } catch { /* Best effort. */ }
      return next;
    });
  };

  return (
    <div data-market={market || 'GENERAL'} className={`relative flex h-screen min-h-screen text-[var(--crm-ink)] ${executive ? 'nex-dashboard-shell' : ''}`}>
      <div className="crm-workspace-backdrop pointer-events-none fixed inset-0 -z-10" />

      <Sidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
      />

      <main className="relative z-10 flex-1 min-w-0 flex flex-col min-h-0" id="main-content">
        <div className={pathname === '/dashboard-geral' ? 'lg:hidden' : ''}>
          <Topbar onMenuClick={() => setSidebarOpen(true)} />
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className={pathname === '/dashboard-geral' ? 'px-2 sm:px-3 lg:px-4 pb-6 pt-2' : 'px-4 sm:px-6 lg:px-8 pb-12 pt-6'}>
            <div className={pathname === '/dashboard-geral' ? 'mx-auto w-full max-w-[1600px]' : 'mx-auto w-full max-w-[1400px]'}>
              <div>
                <Outlet />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
