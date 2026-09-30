import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Sidebar from './layout/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Empresas from './pages/Empresas';
import Oportunidades from './pages/Oportunidades';
import Comissoes from './pages/Comissoes';
import Atividades from './pages/Atividades';
import Produtos from './pages/Produtos';
import Propostas from './pages/Propostas';
import TemplatesPropostas from './pages/TemplatesPropostas';
import Contratos from './pages/Contratos';
import PosVenda from './pages/PosVenda';
import Automacoes from './pages/Automacoes';
import LeadManagement from './pages/LeadManagement';
import Relatorios from './pages/Relatorios';
import Integracoes from './pages/Integracoes';
import FuncionalidadesAvancadas from './pages/FuncionalidadesAvancadas';
import MetasPerformance from './pages/MetasPerformance';
import Kickoff from './pages/Kickoff';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Rota de login */}
        <Route 
          path="/login" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
          } 
        />
        
        {/* Rotas protegidas */}
        <Route 
          path="/*" 
          element={
            <ProtectedRoute>
              <div className="flex h-screen bg-gray-100">
                <Sidebar />
                <main className="flex-1 overflow-y-auto p-6">
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/empresas" element={<Empresas />} />
                    <Route path="/oportunidades" element={<Oportunidades />} />
                    <Route path="/atividades" element={<Atividades />} />
                    <Route path="/produtos" element={<Produtos />} />
                    <Route path="/propostas" element={<Propostas />} />
                    <Route path="/templates-propostas" element={<TemplatesPropostas />} />
                    <Route path="/contratos" element={<Contratos />} />
                    <Route path="/pos-venda" element={<PosVenda />} />
                    <Route path="/automacoes" element={<Automacoes />} />
                    <Route path="/leads" element={<LeadManagement />} />
                    <Route path="/comissoes" element={<Comissoes />} />
                    <Route path="/metas-performance" element={<MetasPerformance />} />
                    <Route path="/relatorios" element={<Relatorios />} />
                    <Route path="/integracoes" element={<Integracoes />} />
                    <Route path="/funcionalidades-avancadas" element={<FuncionalidadesAvancadas />} />
                    <Route path="/kickoff" element={<Kickoff />} />
                  </Routes>
                </main>
              </div>
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}