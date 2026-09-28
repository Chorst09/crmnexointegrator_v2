import { useEffect, useState } from "react";
import axios from "axios";

export default function Relatorios() {
  const [dashboardData, setDashboardData] = useState(null);
  const [period, setPeriod] = useState('6');
  const [reportType, setReportType] = useState('executive');
  const [loading, setLoading] = useState(true);

  const loadReports = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/dashboard?type=${reportType}&period=${period}`
      );
      setDashboardData(response.data);
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [period, reportType]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatPercent = (value) => {
    return `${(value || 0).toFixed(1)}%`;
  };

  const exportReport = () => {
    // Implementar exportação para PDF/Excel
    alert('Funcionalidade de exportação será implementada');
  };

  if (loading) return <div style={{ padding: '20px' }}>Carregando relatórios...</div>;
  if (!dashboardData) return <div style={{ padding: '20px' }}>Erro ao carregar dados</div>;

  const { kpis, charts } = dashboardData;

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Relatórios e Análises</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          >
            <option value="executive">Executivo</option>
            <option value="manager">Gerencial</option>
            <option value="seller">Vendedor</option>
          </select>
          
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          >
            <option value="3">Últimos 3 meses</option>
            <option value="6">Últimos 6 meses</option>
            <option value="12">Último ano</option>
          </select>

          <button 
            onClick={exportReport}
            style={{
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Exportar
          </button>
        </div>
      </div>

      {/* KPIs Principais */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '15px',
        marginBottom: '30px'
      }}>
        <KPICard 
          title="Pipeline Total" 
          value={formatCurrency(kpis.pipelineValue)}
          subtitle={`${kpis.totalOpportunities} oportunidades`}
          color="#3b82f6"
        />
        <KPICard 
          title="Receita Realizada" 
          value={formatCurrency(kpis.wonValue)}
          subtitle={`${kpis.wonOpportunities} vendas`}
          color="#10b981"
        />
        <KPICard 
          title="Taxa de Conversão" 
          value={formatPercent(kpis.conversionRate)}
          subtitle={`${kpis.lostOpportunities} perdas`}
          color="#f59e0b"
        />
        <KPICard 
          title="Ticket Médio" 
          value={formatCurrency(kpis.avgTicket)}
          subtitle="Por venda fechada"
          color="#8b5cf6"
        />
      </div>

      {/* Gráficos e Análises */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
        
        {/* Funil de Conversão */}
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3>Funil de Conversão</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {charts.funnel.map((stage, index) => {
              const maxValue = Math.max(...charts.funnel.map(s => s._count.stage));
              const percentage = (stage._count.stage / maxValue) * 100;
              
              return (
                <div key={stage.stage} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ minWidth: '100px', fontSize: '14px' }}>
                    {getStageLabel(stage.stage)}
                  </div>
                  <div style={{ flex: 1, backgroundColor: '#f3f4f6', borderRadius: '4px', height: '20px' }}>
                    <div 
                      style={{
                        width: `${percentage}%`,
                        height: '100%',
                        backgroundColor: getStageColor(stage.stage),
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                    >
                      {stage._count.stage}
                    </div>
                  </div>
                  <div style={{ minWidth: '80px', fontSize: '12px', textAlign: 'right' }}>
                    {formatCurrency(stage._sum.value || 0)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Performance por Vendedor */}
        {charts.sellerPerformance && (
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h3>Performance por Vendedor</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {charts.sellerPerformance.slice(0, 5).map((seller, index) => {
                const maxRevenue = Math.max(...charts.sellerPerformance.map(s => s.revenue));
                const percentage = (seller.revenue / maxRevenue) * 100;
                
                return (
                  <div key={seller.sellerId} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ minWidth: '120px', fontSize: '14px' }}>
                      {seller.sellerName}
                    </div>
                    <div style={{ flex: 1, backgroundColor: '#f3f4f6', borderRadius: '4px', height: '20px' }}>
                      <div 
                        style={{
                          width: `${percentage}%`,
                          height: '100%',
                          backgroundColor: '#3b82f6',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      >
                        {seller.deals}
                      </div>
                    </div>
                    <div style={{ minWidth: '100px', fontSize: '12px', textAlign: 'right' }}>
                      {formatCurrency(seller.revenue)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Receita Mensal */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '30px'
      }}>
        <h3>Evolução da Receita</h3>
        <div style={{ 
          display: 'flex', 
          gap: '10px',
          alignItems: 'end',
          height: '200px',
          padding: '20px 0'
        }}>
          {charts.monthlyRevenue.map((month, index) => {
            const maxRevenue = Math.max(...charts.monthlyRevenue.map(m => m.revenue));
            const height = Math.max((month.revenue / maxRevenue) * 150, 5);
            
            return (
              <div 
                key={index}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flex: 1
                }}
              >
                <div 
                  style={{
                    width: '100%',
                    maxWidth: '40px',
                    backgroundColor: '#3b82f6',
                    borderRadius: '4px 4px 0 0',
                    height: `${height}px`,
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'end',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    padding: '2px'
                  }}
                >
                  {month.deals}
                </div>
                <small style={{ fontSize: '11px', textAlign: 'center' }}>
                  {new Date(month.month).toLocaleDateString('pt-BR', { month: 'short' })}
                </small>
                <small style={{ fontSize: '10px', color: '#666', textAlign: 'center' }}>
                  {formatCurrency(month.revenue)}
                </small>
              </div>
            );
          })}
        </div>
      </div>

      {/* Análises Adicionais */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        
        {/* Origem de Leads */}
        {charts.leadSources && charts.leadSources.length > 0 && (
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h3>Origem de Leads</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {charts.leadSources.map((source) => {
                const total = charts.leadSources.reduce((sum, s) => sum + s._count.source, 0);
                const percentage = (source._count.source / total) * 100;
                
                return (
                  <div key={source.source} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ minWidth: '80px', fontSize: '14px' }}>
                      {getSourceLabel(source.source)}
                    </div>
                    <div style={{ flex: 1, backgroundColor: '#f3f4f6', borderRadius: '4px', height: '16px' }}>
                      <div 
                        style={{
                          width: `${percentage}%`,
                          height: '100%',
                          backgroundColor: '#10b981',
                          borderRadius: '4px'
                        }}
                      />
                    </div>
                    <div style={{ minWidth: '40px', fontSize: '12px', textAlign: 'right' }}>
                      {source._count.source}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Motivos de Perda */}
        {charts.lossReasons && charts.lossReasons.length > 0 && (
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h3>Principais Motivos de Perda</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {charts.lossReasons.slice(0, 5).map((reason) => {
                const total = charts.lossReasons.reduce((sum, r) => sum + r._count.lossReason, 0);
                const percentage = (reason._count.lossReason / total) * 100;
                
                return (
                  <div key={reason.lossReason} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ minWidth: '120px', fontSize: '14px' }}>
                      {reason.lossReason}
                    </div>
                    <div style={{ flex: 1, backgroundColor: '#f3f4f6', borderRadius: '4px', height: '16px' }}>
                      <div 
                        style={{
                          width: `${percentage}%`,
                          height: '100%',
                          backgroundColor: '#ef4444',
                          borderRadius: '4px'
                        }}
                      />
                    </div>
                    <div style={{ minWidth: '40px', fontSize: '12px', textAlign: 'right' }}>
                      {reason._count.lossReason}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KPICard({ title, value, subtitle, color }) {
  return (
    <div style={{
      backgroundColor: 'white',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      borderLeft: `4px solid ${color}`
    }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
        {title}
      </h3>
      <div style={{ fontSize: '24px', fontWeight: 'bold', color: color, marginBottom: '5px' }}>
        {value}
      </div>
      <div style={{ fontSize: '12px', color: '#888' }}>
        {subtitle}
      </div>
    </div>
  );
}

function getStageLabel(stage) {
  const labels = {
    LEAD: 'Lead',
    QUALIFICATION: 'Qualificação',
    DIAGNOSIS: 'Diagnóstico',
    PROPOSAL: 'Proposta',
    NEGOTIATION: 'Negociação',
    WON: 'Ganhou',
    LOST: 'Perdeu'
  };
  return labels[stage] || stage;
}

function getStageColor(stage) {
  const colors = {
    LEAD: '#94a3b8',
    QUALIFICATION: '#60a5fa',
    DIAGNOSIS: '#34d399',
    PROPOSAL: '#fbbf24',
    NEGOTIATION: '#f87171',
    WON: '#10b981',
    LOST: '#6b7280'
  };
  return colors[stage] || '#6b7280';
}

function getSourceLabel(source) {
  const labels = {
    WEBSITE: 'Site',
    WHATSAPP: 'WhatsApp',
    PHONE: 'Telefone',
    EMAIL: 'E-mail',
    REFERRAL: 'Indicação',
    CAMPAIGN: 'Campanha',
    MANUAL: 'Manual'
  };
  return labels[source] || source;
}