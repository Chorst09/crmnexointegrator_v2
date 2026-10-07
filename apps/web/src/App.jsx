import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import AppShell from './layout/AppShell';
import DashboardGeral from './pages/DashboardGeral';
import DashboardHome from './pages/DashboardHome';
import Dashboard from './pages/Dashboard';
import DashboardModernized from './pages/DashboardModernized';
import Empresas from './pages/Empresas';
import Oportunidades from './pages/Oportunidades';
import AnaliseFinanceira from './pages/AnaliseFinanceira';
import Comissoes from './pages/Comissoes';
import Atividades from './pages/Atividades';
import Simuladores from './pages/Simuladores';
import Produtos from './pages/Produtos';
import Propostas from './pages/Propostas';
import TemplatesPropostas from './pages/TemplatesPropostas';
import Contratos from './pages/Contratos';
import PosVenda from './pages/PosVenda';
import ProjetoDetalhe from './pages/ProjetoDetalhe';
import Automacoes from './pages/Automacoes';
import LeadManagement from './pages/LeadManagement';
import PreVendas from './pages/PreVendas';
import Calculadoras from './pages/Calculadoras';
import RatearProdutos from './pages/RatearProdutos';
import RateiosSalvos from './pages/RateiosSalvos';
import GestaoPocs from './pages/GestaoPocs';
import OrcamentosPrevendas from './pages/OrcamentosPrevendas';
import PrevendasCadastros from './pages/PrevendasCadastros';
import Relatorios from './pages/Relatorios';
import Integracoes from './pages/Integracoes';
import FuncionalidadesAvancadas from './pages/FuncionalidadesAvancadas';
import MetasPerformance from './pages/MetasPerformance';
import Kickoff from './pages/Kickoff';
import VendedoresFixed from './pages/VendedoresFixed';
import Solicitacoes from './pages/Solicitacoes';
import Administracao from './pages/Administracao';
import B2GEditais from './pages/B2GEditais';
import B2GAnaliseEditaisTR from './pages/B2GAnaliseEditaisTR';
import PortalBusca from './pages/PortalBusca';
import BuscarEditais from './pages/BuscarEditais';
import Login from './pages/Login';
import Checkout from './pages/Checkout';
import Setup from './pages/Setup';
import ProtectedRoute from './components/ProtectedRoute';
import RoleGuard from './components/RoleGuard';
import { ROLES, getDefaultRouteForUser } from './utils/permissions';

const Projetos = lazy(() => import('./pages/Projetos'));

function B2GRouteScreen() {
  const location = useLocation();

  return (
    <ErrorBoundary resetKey={location.pathname} scopeLabel="B2G">
      <B2GEditais />
    </ErrorBoundary>
  );
}

function DefaultRedirect() {
  let user = null;
  try {
    const userRaw = localStorage.getItem('user');
    user = userRaw ? JSON.parse(userRaw) : null;
  } catch {
    user = null;
  }

  return <Navigate to={getDefaultRouteForUser(user)} replace />;
}

export default function App() {
  useEffect(() => {
    try {
      const userRaw = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      if (userRaw) {
        const u = JSON.parse(userRaw);
        const email = String(u?.email || '').trim().toLowerCase();
        if (email === 'admin@crm.com' || email === 'chorstconsult@gmail.com') {
          if (u.role !== 'MASTER') {
            u.role = 'MASTER';
            localStorage.setItem('user', JSON.stringify(u));
          }
        }
      }
      if (token) {
        fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.user) {
              const freshUser = data.user;
              const email = String(freshUser.email || '').trim().toLowerCase();
              if (email === 'admin@crm.com' || email === 'chorstconsult@gmail.com') {
                freshUser.role = 'MASTER';
              }
              localStorage.setItem('user', JSON.stringify(freshUser));
            }
          })
          .catch(() => {});
      }
    } catch {}
  }, []);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<DashboardHome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/setup" element={<Setup />} />
        
        {/* Simuladores - TELA CHEIA (fora do AppShell) */}
        <Route
          path="/simuladores"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SELLER, ROLES.MASTER]}>
                <Simuladores />
              </RoleGuard>
            </ProtectedRoute>
          }
        />

        <Route
          path="/projetos"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.USER]}>
                <Suspense fallback={<div className="min-h-screen grid place-items-center bg-[#0b1120] text-slate-400">Carregando gestão de projetos...</div>}>
                  <Projetos />
                </Suspense>
              </RoleGuard>
            </ProtectedRoute>
          }
        />

        {/* Buscar Editais - TELA CHEIA (fora do AppShell) */}
        <Route
          path="/b2g-portal-busca"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SELLER, ROLES.USER]}>
                <BuscarEditais />
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/b2g-buscar-editais"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SELLER, ROLES.USER]}>
                <BuscarEditais />
              </RoleGuard>
            </ProtectedRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<Dashboard />} />

          <Route path="dashboard-modernized" element={<DashboardModernized />} />

          <Route
            path="dashboard-geral"
            element={
              <RoleGuard allowedRoles={[ROLES.MASTER, ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SELLER, ROLES.USER, ROLES.PRE_SALES]}>
                <DashboardGeral />
              </RoleGuard>
            }
          />

          <Route
            path="dashboard-b2b"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SELLER, ROLES.USER]}>
                <Dashboard />
              </RoleGuard>
            }
          />

          <Route
            path="empresas"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SELLER, ROLES.USER]}>
                <Empresas />
              </RoleGuard>
            }
          />

          <Route
            path="oportunidades"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SELLER, ROLES.USER]}>
                <Oportunidades />
              </RoleGuard>
            }
          />

          <Route path="b2g-editais" element={<Navigate to="/b2g-dashboard" replace />} />
          <Route
            path="b2g-dashboard"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SELLER, ROLES.USER]}>
                <B2GRouteScreen />
              </RoleGuard>
            }
          />
          <Route
            path="b2g-leads"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SELLER, ROLES.USER]}>
                <B2GRouteScreen />
              </RoleGuard>
            }
          />
          <Route
            path="b2g-orgaos"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SELLER, ROLES.USER]}>
                <Empresas clientType="B2G" />
              </RoleGuard>
            }
          />
          <Route
            path="b2g-oportunidades"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SELLER, ROLES.USER]}>
                <B2GRouteScreen />
              </RoleGuard>
            }
          />
          <Route
            path="b2g-analise"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SELLER, ROLES.USER]}>
                <Navigate to="/b2g-dashboard" replace />
              </RoleGuard>
            }
          />
          <Route
            path="b2g-analise-editais-tr"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SELLER, ROLES.USER]}>
                <Navigate to="/b2g-dashboard" replace />
              </RoleGuard>
            }
          />
          <Route
            path="b2g-resumos"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SELLER, ROLES.USER]}>
                <Navigate to="/b2g-dashboard" replace />
              </RoleGuard>
            }
          />
          <Route
            path="b2g-atas"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SELLER, ROLES.USER]}>
                <B2GRouteScreen />
              </RoleGuard>
            }
          />
          <Route
            path="b2g-atividades"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SELLER, ROLES.USER]}>
                <B2GRouteScreen />
              </RoleGuard>
            }
          />
          <Route
            path="b2g-documentacao"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SELLER, ROLES.USER]}>
                <B2GRouteScreen />
              </RoleGuard>
            }
          />
          <Route
            path="b2g-relatorios"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SELLER, ROLES.USER]}>
                <B2GRouteScreen />
              </RoleGuard>
            }
          />
          <Route
            path="b2g-historico"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SELLER, ROLES.USER]}>
                <B2GRouteScreen />
              </RoleGuard>
            }
          />

          <Route
            path="atividades"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SELLER]}>
                <Atividades />
              </RoleGuard>
            }
          />

          <Route
            path="kickoff"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SELLER, ROLES.USER]}>
                <Kickoff />
              </RoleGuard>
            }
          />

          {/* Gestão de Kickoff acessível diretamente de B2B e B2G para vendedores */}
          <Route
            path="b2b-kickoff"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SELLER, ROLES.USER]}>
                <Kickoff />
              </RoleGuard>
            }
          />
          <Route
            path="b2g-kickoff"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.SELLER, ROLES.USER]}>
                <Kickoff />
              </RoleGuard>
            }
          />

          <Route
            path="projetos/:id"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.USER]}>
                <ProjetoDetalhe />
              </RoleGuard>
            }
          />

          <Route
            path="produtos"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.USER]}>
                <Produtos />
              </RoleGuard>
            }
          />
          <Route
            path="propostas"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.USER]}>
                <Propostas />
              </RoleGuard>
            }
          />
          <Route
            path="templates-propostas"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.USER]}>
                <TemplatesPropostas />
              </RoleGuard>
            }
          />
          <Route
            path="contratos"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.USER]}>
                <Contratos />
              </RoleGuard>
            }
          />
          <Route
            path="pos-venda"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.USER]}>
                <PosVenda />
              </RoleGuard>
            }
          />
          <Route
            path="automacoes"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.USER]}>
                <Automacoes />
              </RoleGuard>
            }
          />
          <Route
            path="leads"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.USER]}>
                <LeadManagement />
              </RoleGuard>
            }
          />

          {/* Menu Pré-Vendas: somente ADMIN/MANAGER (DIRECTOR não acessa) */}
          <Route
            path="pre-vendas"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.MANAGER, ROLES.PRE_SALES, ROLES.USER]}>
                <PreVendas />
              </RoleGuard>
            }
          />
          <Route
            path="solicitacoes"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.MANAGER, ROLES.PRE_SALES, ROLES.USER]}>
                <Solicitacoes />
              </RoleGuard>
            }
          />
          <Route
            path="calculadoras"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.MANAGER, ROLES.PRE_SALES, ROLES.USER]}>
                <Calculadoras />
              </RoleGuard>
            }
          />
          <Route
            path="precificacao"
            element={<Navigate to="/ratear-produtos" replace />}
          />
          <Route
            path="ratear-produtos"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.MANAGER, ROLES.PRE_SALES, ROLES.USER]}>
                <RatearProdutos />
              </RoleGuard>
            }
          />
          <Route path="rateio-produtos" element={<Navigate to="/ratear-produtos" replace />} />
          <Route
            path="rateios-salvos"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.MANAGER, ROLES.PRE_SALES, ROLES.USER]}>
                <RateiosSalvos />
              </RoleGuard>
            }
          />
          <Route
            path="gestao-pocs"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.MANAGER, ROLES.PRE_SALES, ROLES.USER]}>
                <GestaoPocs />
              </RoleGuard>
            }
          />
          <Route
            path="orcamentos"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.MANAGER, ROLES.PRE_SALES, ROLES.USER]}>
                <OrcamentosPrevendas />
              </RoleGuard>
            }
          />
          <Route
            path="prevendas-distribuidores"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.MANAGER, ROLES.PRE_SALES, ROLES.USER]}>
                <PrevendasCadastros forcedTab="distribuidores" />
              </RoleGuard>
            }
          />
          <Route
            path="prevendas-fornecedores"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.MANAGER, ROLES.PRE_SALES, ROLES.USER]}>
                <PrevendasCadastros forcedTab="fornecedores" />
              </RoleGuard>
            }
          />
          <Route
            path="prevendas-registro-oportunidades"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.MANAGER, ROLES.PRE_SALES, ROLES.USER]}>
                <PrevendasCadastros forcedTab="oportunidades" />
              </RoleGuard>
            }
          />
          <Route
            path="prevendas-cadastros"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.MANAGER, ROLES.PRE_SALES, ROLES.USER]}>
                <Navigate to="/prevendas-distribuidores" replace />
              </RoleGuard>
            }
          />

          <Route
            path="analise-financeira"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER]}>
                <AnaliseFinanceira />
              </RoleGuard>
            }
          />

          <Route
            path="comissoes"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER]}>
                <Comissoes />
              </RoleGuard>
            }
          />
          <Route
            path="vendedores"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER]}>
                <VendedoresFixed />
              </RoleGuard>
            }
          />
          <Route
            path="metas-performance"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER]}>
                <MetasPerformance />
              </RoleGuard>
            }
          />
          <Route
            path="relatorios"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER, ROLES.USER]}>
                <Relatorios />
              </RoleGuard>
            }
          />
          <Route
            path="integracoes"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER]}>
                <Integracoes />
              </RoleGuard>
            }
          />
          <Route
            path="funcionalidades-avancadas"
            element={
              <RoleGuard allowedRoles={[ROLES.ADMIN, ROLES.DIRECTOR, ROLES.MANAGER]}>
                <FuncionalidadesAvancadas />
              </RoleGuard>
            }
          />

          <Route
            path="configuracoes"
            element={
              <RoleGuard allowedRoles={[ROLES.MASTER, ROLES.ADMIN]}>
                <Administracao />
              </RoleGuard>
            }
          />
          <Route
            path="administracao"
            element={
              <RoleGuard allowedRoles={[ROLES.MASTER]}>
                <Administracao />
              </RoleGuard>
            }
          />

          <Route path="*" element={<DefaultRedirect />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
