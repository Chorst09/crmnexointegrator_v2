import { useEffect, useState } from "react";
import axios from "axios";

export default function FuncionalidadesAvancadas() {
  const [activeTab, setActiveTab] = useState('price-tables');
  const [data, setData] = useState({
    priceTables: [],
    competitors: [],
    regions: [],
    crossSell: [],
    upSell: [],
    approvals: []
  });

  const tabs = [
    { id: 'price-tables', label: 'Tabelas de Preço', icon: '💰' },
    { id: 'competitors', label: 'Concorrentes', icon: '🏆' },
    { id: 'regions', label: 'Regiões/Carteiras', icon: '🌍' },
    { id: 'cross-sell', label: 'Cross-sell', icon: '🔄' },
    { id: 'upsell', label: 'Upsell', icon: '⬆️' },
    { id: 'approvals', label: 'Aprovações', icon: '✅' }
  ];

  const loadData = async () => {
    try {
      const [priceTablesRes, competitorsRes, regionsRes, crossSellRes, upSellRes, approvalsRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL}/price-tables`),
        axios.get(`${import.meta.env.VITE_API_URL}/competitors`),
        axios.get(`${import.meta.env.VITE_API_URL}/regions`),
        axios.get(`${import.meta.env.VITE_API_URL}/cross-sell`),
        axios.get(`${import.meta.env.VITE_API_URL}/upsell`),
        axios.get(`${import.meta.env.VITE_API_URL}/approvals`)
      ]);

      setData({
        priceTables: priceTablesRes.data,
        competitors: competitorsRes.data,
        regions: regionsRes.data,
        crossSell: crossSellRes.data,
        upSell: upSellRes.data,
        approvals: approvalsRes.data
      });
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'price-tables':
        return <PriceTablesContent data={data.priceTables} onUpdate={loadData} />;
      case 'competitors':
        return <CompetitorsContent data={data.competitors} onUpdate={loadData} />;
      case 'regions':
        return <RegionsContent data={data.regions} onUpdate={loadData} />;
      case 'cross-sell':
        return <CrossSellContent data={data.crossSell} onUpdate={loadData} />;
      case 'upsell':
        return <UpSellContent data={data.upSell} onUpdate={loadData} />;
      case 'approvals':
        return <ApprovalsContent data={data.approvals} onUpdate={loadData} />;
      default:
        return <div>Selecione uma funcionalidade</div>;
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Funcionalidades Avançadas</h1>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '20px',
        borderBottom: '1px solid #e5e7eb',
        paddingBottom: '10px'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 15px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: activeTab === tab.id ? '#3b82f6' : '#f3f4f6',
              color: activeTab === tab.id ? 'white' : '#374151',
              fontSize: '14px'
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px' }}>
        {renderContent()}
      </div>
    </div>
  );
}

function PriceTablesContent({ data, onUpdate }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Tabelas de Preço</h2>
        <button 
          onClick={() => setShowForm(true)}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Nova Tabela
        </button>
      </div>

      <div style={{ display: 'grid', gap: '15px' }}>
        {data.map(table => (
          <div key={table.id} style={{
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            padding: '15px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0' }}>{table.name}</h3>
                <p style={{ margin: '0 0 10px 0', color: '#666' }}>{table.description}</p>
                <div style={{ display: 'flex', gap: '15px', fontSize: '14px' }}>
                  <span>Válida de: {new Date(table.validFrom).toLocaleDateString('pt-BR')}</span>
                  {table.validUntil && (
                    <span>até: {new Date(table.validUntil).toLocaleDateString('pt-BR')}</span>
                  )}
                  {table.isDefault && (
                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>PADRÃO</span>
                  )}
                </div>
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                {table.prices?.length || 0} produtos
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.length === 0 && (
        <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
          Nenhuma tabela de preço cadastrada
        </div>
      )}
    </div>
  );
}

function CompetitorsContent({ data, onUpdate }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Concorrentes</h2>
        <button 
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Novo Concorrente
        </button>
      </div>

      <div style={{ display: 'grid', gap: '15px' }}>
        {data.map(competitor => (
          <div key={competitor.id} style={{
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            padding: '15px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 5px 0' }}>{competitor.name}</h3>
                {competitor.website && (
                  <p style={{ margin: '0 0 10px 0', color: '#3b82f6' }}>
                    <a href={competitor.website} target="_blank" rel="noopener noreferrer">
                      {competitor.website}
                    </a>
                  </p>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '14px' }}>
                  {competitor.strengths && (
                    <div>
                      <strong>Pontos Fortes:</strong>
                      <p style={{ margin: '2px 0', color: '#666' }}>{competitor.strengths}</p>
                    </div>
                  )}
                  {competitor.weaknesses && (
                    <div>
                      <strong>Pontos Fracos:</strong>
                      <p style={{ margin: '2px 0', color: '#666' }}>{competitor.weaknesses}</p>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                {competitor._count?.comparisons || 0} comparações
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.length === 0 && (
        <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
          Nenhum concorrente cadastrado
        </div>
      )}
    </div>
  );
}

function RegionsContent({ data, onUpdate }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Regiões e Carteiras</h2>
        <button 
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Nova Região
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
        {data.map(region => (
          <div key={region.id} style={{
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            padding: '15px'
          }}>
            <h3 style={{ margin: '0 0 5px 0' }}>{region.name}</h3>
            <p style={{ margin: '0 0 10px 0', color: '#666' }}>Código: {region.code}</p>
            <div style={{ fontSize: '14px' }}>
              <p>📍 {region.city}, {region.state} - {region.country}</p>
              <p>👥 {region._count?.users || 0} usuários</p>
              <p>🏢 {region._count?.companies || 0} empresas</p>
            </div>
          </div>
        ))}
      </div>

      {data.length === 0 && (
        <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
          Nenhuma região cadastrada
        </div>
      )}
    </div>
  );
}

function CrossSellContent({ data, onUpdate }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Regras de Cross-sell</h2>
        <button 
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Nova Regra
        </button>
      </div>

      <div style={{ display: 'grid', gap: '15px' }}>
        {data.map(rule => (
          <div key={rule.id} style={{
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            padding: '15px'
          }}>
            <h3 style={{ margin: '0 0 10px 0' }}>{rule.name}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '14px' }}>
              <div>
                <strong>Produto Principal:</strong> {rule.mainProduct?.name}
              </div>
              <div>→</div>
              <div>
                <strong>Sugerir:</strong> {rule.suggestedProduct?.name}
              </div>
              <div>
                <strong>Probabilidade:</strong> {(rule.probability * 100).toFixed(0)}%
              </div>
              {rule.discount > 0 && (
                <div>
                  <strong>Desconto:</strong> {rule.discount}%
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {data.length === 0 && (
        <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
          Nenhuma regra de cross-sell cadastrada
        </div>
      )}
    </div>
  );
}

function UpSellContent({ data, onUpdate }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Regras de Upsell</h2>
        <button 
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Nova Regra
        </button>
      </div>

      <div style={{ display: 'grid', gap: '15px' }}>
        {data.map(rule => (
          <div key={rule.id} style={{
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            padding: '15px'
          }}>
            <h3 style={{ margin: '0 0 10px 0' }}>{rule.name}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '14px' }}>
              <div>
                <strong>Produto Base:</strong> {rule.mainProduct?.name}
              </div>
              <div>⬆️</div>
              <div>
                <strong>Upgrade para:</strong> {rule.targetProduct?.name}
              </div>
              <div>
                <strong>Qtd. Mín:</strong> {rule.minQuantity}
              </div>
              {rule.discount > 0 && (
                <div>
                  <strong>Desconto:</strong> {rule.discount}%
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {data.length === 0 && (
        <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
          Nenhuma regra de upsell cadastrada
        </div>
      )}
    </div>
  );
}

function ApprovalsContent({ data, onUpdate }) {
  const pendingApprovals = data.filter(a => a.status === 'PENDING');
  
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Sistema de Aprovações</h2>
        <div style={{ fontSize: '14px', color: '#666' }}>
          {pendingApprovals.length} pendentes
        </div>
      </div>

      <div style={{ display: 'grid', gap: '15px' }}>
        {data.map(approval => (
          <div key={approval.id} style={{
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            padding: '15px',
            borderLeft: `4px solid ${approval.status === 'PENDING' ? '#f59e0b' : 
              approval.status === 'APPROVED' ? '#10b981' : '#ef4444'}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0' }}>
                  {approval.workflow?.name} - {approval.entityType}
                </h3>
                <p style={{ margin: '0 0 10px 0', color: '#666' }}>
                  Solicitado por: {approval.requester?.name}
                </p>
                <div style={{ fontSize: '14px' }}>
                  <span>Status: </span>
                  <span style={{
                    color: approval.status === 'PENDING' ? '#f59e0b' : 
                      approval.status === 'APPROVED' ? '#10b981' : '#ef4444'
                  }}>
                    {approval.status}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {new Date(approval.createdAt).toLocaleDateString('pt-BR')}
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.length === 0 && (
        <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
          Nenhuma solicitação de aprovação
        </div>
      )}
    </div>
  );
}