
import { useEffect, useState } from "react";
import axios from "axios";

export default function Comissoes() {
  const [comissoes, setComissoes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [filtros, setFiltros] = useState({
    sellerId: '',
    status: '',
    period: 'current_month'
  });
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    opportunityId: '',
    sellerId: '',
    percentage: 5,
    amount: 0
  });

  const loadComissoes = async () => {
    try {
      const params = new URLSearchParams();
      if (filtros.sellerId) params.append('sellerId', filtros.sellerId);
      if (filtros.status) params.append('status', filtros.status);
      if (filtros.period) params.append('period', filtros.period);
      
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/commissions?${params}`);
      setComissoes(response.data);
    } catch (error) {
      console.error('Erro ao carregar comissões:', error);
    }
  };

  const loadUsuarios = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/users?role=SELLER`);
      setUsuarios(response.data);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  useEffect(() => {
    loadComissoes();
    loadUsuarios();
  }, [filtros]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/commissions`, formData);
      setShowForm(false);
      resetForm();
      loadComissoes();
    } catch (error) {
      console.error('Erro ao criar comissão:', error);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/commissions`, {
        id,
        status,
        paidAt: status === 'PAID' ? new Date().toISOString() : null
      });
      loadComissoes();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      opportunityId: '',
      sellerId: '',
      percentage: 5,
      amount: 0
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      PENDING: '#f59e0b',
      APPROVED: '#3b82f6',
      PAID: '#10b981',
      CANCELLED: '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  const getStatusLabel = (status) => {
    const labels = {
      PENDING: 'Pendente',
      APPROVED: 'Aprovada',
      PAID: 'Paga',
      CANCELLED: 'Cancelada'
    };
    return labels[status] || status;
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  // Calcular totais
  const totals = comissoes.reduce((acc, comissao) => {
    acc.total += comissao.amount;
    if (comissao.status === 'PAID') acc.paid += comissao.amount;
    if (comissao.status === 'APPROVED') acc.approved += comissao.amount;
    if (comissao.status === 'PENDING') acc.pending += comissao.amount;
    return acc;
  }, { total: 0, paid: 0, approved: 0, pending: 0 });

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Gestão de Comissões</h1>
        <button 
          onClick={() => setShowForm(true)}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Nova Comissão
        </button>
      </div>

      {/* Resumo Financeiro */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '15px',
        marginBottom: '30px'
      }}>
        <StatCard title="Total Comissões" value={formatCurrency(totals.total)} color="#3b82f6" />
        <StatCard title="Pagas" value={formatCurrency(totals.paid)} color="#10b981" />
        <StatCard title="Aprovadas" value={formatCurrency(totals.approved)} color="#3b82f6" />
        <StatCard title="Pendentes" value={formatCurrency(totals.pending)} color="#f59e0b" />
      </div>

      {/* Filtros */}
      <div style={{ 
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '20px',
        display: 'flex',
        gap: '15px',
        alignItems: 'center'
      }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
            Vendedor:
          </label>
          <select
            value={filtros.sellerId}
            onChange={(e) => setFiltros({...filtros, sellerId: e.target.value})}
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', minWidth: '150px' }}
          >
            <option value="">Todos</option>
            {usuarios.map(user => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
            Status:
          </label>
          <select
            value={filtros.status}
            onChange={(e) => setFiltros({...filtros, status: e.target.value})}
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          >
            <option value="">Todos</option>
            <option value="PENDING">Pendente</option>
            <option value="APPROVED">Aprovada</option>
            <option value="PAID">Paga</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
            Período:
          </label>
          <select
            value={filtros.period}
            onChange={(e) => setFiltros({...filtros, period: e.target.value})}
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          >
            <option value="current_month">Mês Atual</option>
            <option value="last_month">Mês Passado</option>
            <option value="current_quarter">Trimestre Atual</option>
            <option value="current_year">Ano Atual</option>
            <option value="all">Todos</option>
          </select>
        </div>
      </div>

      {/* Lista de Comissões */}
      <div style={{ display: 'grid', gap: '15px' }}>
        {comissoes.map(comissao => (
          <div key={comissao.id} style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>
                    {comissao.opportunity?.title || 'Oportunidade'}
                  </h3>
                  <span style={{
                    backgroundColor: getStatusColor(comissao.status),
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    {getStatusLabel(comissao.status)}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                  <div>
                    <strong style={{ fontSize: '14px' }}>Vendedor:</strong>
                    <p style={{ margin: '2px 0', fontSize: '14px' }}>{comissao.seller?.name}</p>
                  </div>

                  <div>
                    <strong style={{ fontSize: '14px' }}>Empresa:</strong>
                    <p style={{ margin: '2px 0', fontSize: '14px' }}>
                      {comissao.opportunity?.company?.name}
                    </p>
                  </div>

                  <div>
                    <strong style={{ fontSize: '14px' }}>Valor da Venda:</strong>
                    <p style={{ margin: '2px 0', fontSize: '14px' }}>
                      {formatCurrency(comissao.opportunity?.value)}
                    </p>
                  </div>

                  <div>
                    <strong style={{ fontSize: '14px' }}>Percentual:</strong>
                    <p style={{ margin: '2px 0', fontSize: '14px' }}>{comissao.percentage}%</p>
                  </div>

                  <div>
                    <strong style={{ fontSize: '14px' }}>Valor da Comissão:</strong>
                    <p style={{ margin: '2px 0', fontSize: '16px', fontWeight: 'bold', color: '#10b981' }}>
                      {formatCurrency(comissao.amount)}
                    </p>
                  </div>

                  <div>
                    <strong style={{ fontSize: '14px' }}>Data de Criação:</strong>
                    <p style={{ margin: '2px 0', fontSize: '14px' }}>
                      {new Date(comissao.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>

                  {comissao.paidAt && (
                    <div>
                      <strong style={{ fontSize: '14px' }}>Data de Pagamento:</strong>
                      <p style={{ margin: '2px 0', fontSize: '14px' }}>
                        {new Date(comissao.paidAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                {comissao.status === 'PENDING' && (
                  <>
                    <button 
                      onClick={() => updateStatus(comissao.id, 'APPROVED')}
                      style={{
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Aprovar
                    </button>
                    <button 
                      onClick={() => updateStatus(comissao.id, 'CANCELLED')}
                      style={{
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Cancelar
                    </button>
                  </>
                )}

                {comissao.status === 'APPROVED' && (
                  <button 
                    onClick={() => updateStatus(comissao.id, 'PAID')}
                    style={{
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Marcar como Paga
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Formulário */}
      {showForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '500px'
          }}>
            <h2>Nova Comissão</h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Vendedor *
                </label>
                <select
                  value={formData.sellerId}
                  onChange={(e) => setFormData({...formData, sellerId: e.target.value})}
                  required
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="">Selecione um vendedor</option>
                  {usuarios.map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Percentual (%) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.percentage}
                    onChange={(e) => setFormData({...formData, percentage: parseFloat(e.target.value)})}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Valor (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value)})}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button 
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  style={{
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  style={{
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Criar Comissão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, color }) {
  return (
    <div style={{
      backgroundColor: 'white',
      padding: '15px',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      textAlign: 'center',
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ fontSize: '20px', fontWeight: 'bold', color: color, marginBottom: '5px' }}>
        {value}
      </div>
      <div style={{ fontSize: '14px', color: '#666' }}>
        {title}
      </div>
    </div>
  );
}
