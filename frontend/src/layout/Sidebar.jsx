
import { Link, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';

export default function Sidebar() {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState({
    vendas: true,
    gestao: true,
    automacao: true,
    configuracao: false
  });
  const scrollPositions = useRef({});
  const sidebarRef = useRef(null);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  useEffect(() => {
    const currentPath = location.pathname;
    if (sidebarRef.current) {
      scrollPositions.current[currentPath] = sidebarRef.current.scrollTop;
    }
  }, [location.pathname]);

  useEffect(() => {
    const currentPath = location.pathname;
    if (sidebarRef.current && scrollPositions.current[currentPath] !== undefined) {
      requestAnimationFrame(() => {
        sidebarRef.current.scrollTop = scrollPositions.current[currentPath];
      });
    }
  }, [location.pathname]);

  const menuSections = [
    {
      id: 'principal',
      title: 'Principal',
      icon: '🏠',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: '📊', description: 'Visão geral do negócio' }
      ]
    },
    {
      id: 'vendas',
      title: 'Vendas & CRM',
      icon: '💼',
      items: [
        { path: '/empresas', label: 'Empresas', icon: '🏢', description: 'Clientes e prospects' },
        { path: '/oportunidades', label: 'Pipeline', icon: '🎯', description: 'Funil de vendas' },
        { path: '/atividades', label: 'Atividades', icon: '📅', description: 'Tarefas e compromissos' },
        { path: '/leads', label: 'Lead Management', icon: '🔄', description: 'Gestão de leads' },
        { path: '/propostas', label: 'Propostas', icon: '📋', description: 'Cotações e propostas' },
        { path: '/templates-propostas', label: 'Templates', icon: '🎨', description: 'Templates de proposta' },
        { path: '/contratos', label: 'Contratos', icon: '📄', description: 'Contratos fechados' }
      ]
    },
    {
      id: 'gestao',
      title: 'Gestão',
      icon: '📈',
      items: [
        { path: '/produtos', label: 'Produtos', icon: '📦', description: 'Catálogo de produtos' },
        { path: '/comissoes', label: 'Comissões', icon: '💰', description: 'Comissionamento' },
        { path: '/metas-performance', label: 'Metas & Performance', icon: '🎯', description: 'Metas e automações avançadas' },
        { path: '/kickoff', label: 'Gestão de Kickoff', icon: '🚀', description: 'Reuniões estratégicas do projeto' },
        { path: '/pos-venda', label: 'Pós-Venda', icon: '🤝', description: 'Suporte e relacionamento' },
        { path: '/relatorios', label: 'Relatórios', icon: '📊', description: 'Análises e métricas' }
      ]
    },
    {
      id: 'automacao',
      title: 'Automação',
      icon: '⚡',
      items: [
        { path: '/automacoes', label: 'Workflows', icon: '🔄', description: 'Automações e regras' },
        { path: '/integracoes', label: 'Integrações', icon: '🔗', description: 'APIs e conectores' }
      ]
    },
    {
      id: 'configuracao',
      title: 'Configurações',
      icon: '⚙️',
      items: [
        { path: '/funcionalidades-avancadas', label: 'Avançado', icon: '🚀', description: 'Funcionalidades avançadas' }
      ]
    }
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <>
      <style>
        {`
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .sidebar-scrollbar::-webkit-scrollbar {
            width: 4px;
          }
          
          .sidebar-scrollbar::-webkit-scrollbar-track {
            background: rgba(255,255,255,0.05);
            border-radius: 2px;
          }
          
          .sidebar-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.2);
            border-radius: 2px;
          }
          
          .sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255,255,255,0.3);
          }
          
          .menu-item-hover {
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          }
          
          .menu-item-hover:hover {
            transform: translateX(4px);
          }
          
          .section-badge {
            display: inline-block;
            padding: 2px 6px;
            background: rgba(59, 130, 246, 0.2);
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 10px;
            font-size: 9px;
            font-weight: 600;
            color: #93c5fd;
            margin-left: 8px;
          }
        `}
      </style>
      
      <aside style={{ 
        width: 280, 
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #334155 100%)', 
        color: '#fff', 
        padding: '0',
        boxShadow: '4px 0 20px rgba(0,0,0,0.15)',
        position: 'sticky',
        top: 0,
        height: '100vh',
        borderRight: '1px solid rgba(255,255,255,0.1)'
      }}>
      {/* Header */}
      <div style={{ 
        padding: '28px 24px', 
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(16, 185, 129, 0.1))',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #3b82f6, #10b981)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
          }}>
            💼
          </div>
          <div>
            <h2 style={{ 
              margin: 0, 
              fontSize: '18px', 
              fontWeight: '700',
              background: 'linear-gradient(135deg, #60a5fa, #34d399)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              CRM Corporativo
            </h2>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <p style={{ 
            margin: 0, 
            fontSize: '11px', 
            color: '#94a3b8',
            fontWeight: '500'
          }}>
            Sistema Completo de Vendas
          </p>
          <span className="section-badge">PRO</span>
        </div>
      </div>

      {/* Navigation */}
      <nav 
        ref={sidebarRef}
        className="sidebar-scrollbar" 
        style={{ 
          padding: '16px 0', 
          height: 'calc(100vh - 220px)', 
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.2) transparent'
        }}>
        {menuSections.map((section) => (
          <div key={section.id} style={{ marginBottom: '8px' }}>
            {/* Section Header */}
            {section.id !== 'principal' && (
              <div 
                onClick={() => toggleSection(section.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 20px 8px 20px',
                  color: '#94a3b8',
                  fontSize: '11px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.color = '#cbd5e1'}
                onMouseLeave={(e) => e.target.style.color = '#94a3b8'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px' }}>{section.icon}</span>
                  <span>{section.title}</span>
                </div>
                <span style={{ 
                  fontSize: '10px',
                  transform: expandedSections[section.id] ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease'
                }}>
                  ▶
                </span>
              </div>
            )}

            {/* Section Items */}
            {(section.id === 'principal' || expandedSections[section.id]) && (
              <ul style={{ 
                listStyle: 'none', 
                padding: 0, 
                margin: 0,
                animation: section.id !== 'principal' ? 'slideDown 0.2s ease' : 'none'
              }}>
                {section.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <li key={item.path} style={{ margin: '1px 0' }}>
                      <Link 
                        to={item.path}
                        className="menu-item-hover"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                          padding: section.id === 'principal' ? '18px 24px' : '12px 24px 12px 36px',
                          margin: section.id === 'principal' ? '0 12px' : '0 12px 0 0',
                          color: isActive ? '#fff' : '#cbd5e1',
                          textDecoration: 'none',
                          fontSize: '14px',
                          fontWeight: isActive ? '600' : '500',
                          backgroundColor: isActive ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                          border: isActive ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                          borderRadius: '12px',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          position: 'relative',
                          backdropFilter: isActive ? 'blur(10px)' : 'none',
                          boxShadow: isActive ? '0 4px 12px rgba(59, 130, 246, 0.2)' : 'none'
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.target.style.backgroundColor = 'rgba(255,255,255,0.08)';
                            e.target.style.color = '#fff';
                            e.target.style.border = '1px solid rgba(255,255,255,0.1)';
                            e.target.style.transform = 'translateX(4px)';
                            e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.target.style.backgroundColor = 'transparent';
                            e.target.style.color = '#cbd5e1';
                            e.target.style.border = '1px solid transparent';
                            e.target.style.transform = 'translateX(0)';
                            e.target.style.boxShadow = 'none';
                          }
                        }}
                        title={item.description}
                      >
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: isActive 
                            ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' 
                            : 'rgba(255,255,255,0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px',
                          transition: 'all 0.2s ease',
                          boxShadow: isActive ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none'
                        }}>
                          {item.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            fontSize: '14px',
                            lineHeight: '1.2'
                          }}>
                            {item.label}
                          </div>
                          {section.id === 'principal' && (
                            <div style={{ 
                              fontSize: '11px', 
                              color: isActive ? '#cbd5e1' : '#64748b',
                              marginTop: '3px',
                              lineHeight: '1.3'
                            }}>
                              {item.description}
                            </div>
                          )}
                        </div>
                        {isActive && (
                          <div style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: '#34d399',
                            boxShadow: '0 0 8px rgba(52, 211, 153, 0.6)'
                          }} />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </nav>

      {/* User Info & Logout */}
      <div style={{ 
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTop: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ padding: '16px 20px' }}>
          {/* User Profile */}
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '12px',
            padding: '8px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#fff'
            }}>
              {(JSON.parse(localStorage.getItem('user') || '{}').name || 'U')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ 
                fontSize: '13px', 
                color: '#fff',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {JSON.parse(localStorage.getItem('user') || '{}').name || 'Usuário'}
              </div>
              <div style={{ 
                fontSize: '11px', 
                color: '#94a3b8',
                textTransform: 'capitalize'
              }}>
                {(JSON.parse(localStorage.getItem('user') || '{}').role || 'user').toLowerCase()}
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '10px 12px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#fca5a5',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
              e.target.style.color = '#fff';
              e.target.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
              e.target.style.color = '#fca5a5';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            <span>🚪</span>
            <span>Sair</span>
          </button>
        </div>
        
        <div style={{ 
          padding: '12px 20px',
          fontSize: '10px', 
          color: '#64748b',
          textAlign: 'center',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(0,0,0,0.2)'
        }}>
          <p style={{ margin: 0, fontWeight: '500' }}>CRM Corporativo v2.0</p>
          <p style={{ margin: '2px 0 0 0', opacity: 0.7 }}>© 2024 - Todos os direitos reservados</p>
        </div>
      </div>
      </aside>
    </>
  );
}
