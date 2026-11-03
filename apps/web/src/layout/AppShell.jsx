import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppShell() {
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
    <div className="relative flex h-screen min-h-screen text-[var(--crm-ink)]">
      <div className="crm-workspace-backdrop pointer-events-none fixed inset-0 -z-10" />

      <Sidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
      />

      <main className="relative z-10 flex-1 min-w-0 flex flex-col min-h-0" id="main-content">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 lg:px-8 pb-12 pt-6">
            <div className="mx-auto w-full max-w-[1400px]">
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
