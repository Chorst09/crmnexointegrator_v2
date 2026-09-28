import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative flex min-h-screen text-[var(--crm-ink)]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_92%_4%,rgba(31,112,124,0.42)_0%,rgba(31,112,124,0.22)_18%,transparent_42%),radial-gradient(ellipse_at_18%_0%,rgba(56,17,28,0.42)_0%,rgba(28,8,17,0.24)_28%,transparent_48%),linear-gradient(180deg,#06070d_0%,#080a12_44%,#07111b_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,8,17,0.36)_0%,transparent_42%,rgba(18,55,66,0.24)_100%)]" />
      </div>

      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

      <main className="relative z-10 flex-1 min-w-0 overflow-y-auto" id="main-content">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        <div className="px-4 sm:px-6 lg:px-8 pb-12 pt-6">
          <div className="mx-auto w-full max-w-[1400px]">
            <div>
              <Outlet />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
