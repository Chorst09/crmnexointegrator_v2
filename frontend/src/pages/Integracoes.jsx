import { useEffect, useState } from "react";
import axios from "axios";

export default function Integracoes() {
  const [integracoes, setIntegracoes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showTestModal, setShowTestModal] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'WHATSAPP',
    config: {},
    apiKey: '',
    webhookUrl: '',
    isActive: true
  });

  const loadIntegracoes = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/integrations`);
      setIntegracoes(response.data);
    } catch (error) {
      console.error('Erro ao carregar integrações:', error);
    }
  };

  useEffect(() => {
    loadIntegracoes();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/integrations`, formData);
      setShowForm(false);
      resetForm();
      loadIntegracoes();
    } catch (error) {
      console.error('Erro ao salvar integração:', error);
    }
  };

  const toggleActive = async (id, isActive) => {
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/integrations`, {
        id,
        isActive: !isActive
      });
      loadIntegracoes();
    } catch (error) {
      console.error('Erro ao atualizar integração:', error);
    }
  };

  const testIntegration = async (integration) => {
    try {
      let testResult;
      
      switch (integration.type) {
        case 'WHATSAPP':
          testResult = await axios.post(`${import.meta.env.VITE_API_URL}/whatsapp`, {
            action: 'send_message',
            phone: '+5511999999999',
            message: 'Teste de integração WhatsApp'
          });
          break;
        case 'EMAIL_MARKETING':
          testResult = await axios.get(`${import.meta.env.VITE_API_URL}/email-marketing?type=campaigns`);
          break;
        case 'VOIP':
          testResult = await axios.get(`${import.meta.env.VITE_API_URL}/voip?type=statistics`);
          break;
        default:
          testResult = { data: { success: true, message: 'Teste simulado' } };
      }
      
      alert(`Teste realizado com sucesso!\n${JSON.stringify(testResult.data, null, 2)}`);
    } catch (error) {
      alert(`Erro no teste: ${error.message}`);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'WHATSAPP',
      config: {},
      apiKey: '',
      webhookUrl: '',
      isActive: true
    });
  };

  const getTypeIcon = (type) => {
    const icons = {
      ERP: '🏢',
      WHATSAPP: '📱',
      EMAIL_MARKETING: '📧',
      VOIP: '📞',
      API_EXTERNAL: '🔗',
      WEBHOOK: '⚡'
    };
    return icons[type] || '🔗';
  };

  const getTypeLabel = (type) => {
    const labels = {
      ERP: 'Sistema ERP',
      WHATSAPP: 'WhatsApp Business',
      EMAIL_MARKETING: 'E-mail Marketing',
      VOIP: 'Telefonia VoIP',
      API_EXTERNAL: 'API Externa',
      WEBHOOK: 'Webhook'
    };
    return labels[type] || type;
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Integrações</h1>
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
          Nova Integração
        </button>
      </div>

      {/* Estatísticas */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '15px',
        marginBottom: '30px'
      }}>
        <StatCard title="Total de Integrações" value={integracoes.length} />
        <StatCard title="Ativas" value={integracoes.filter(i => i.isActive).length} />
        <StatCard title="WhatsApp" value={integracoes.filter(i => i.type === 'WHATSAPP').length} />
        <StatCard title="E-mail Marketing" value={integracoes.filter(i => i.type === 'EMAIL_MARKETING').length} />
      </div>

      {/* Lista de Integrações */}
      <div style={{ display: 'grid', gap: '15px' }}>
        {integracoes.map(integracao => (
          <div key={integracao.id} style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '24px' }}>{getTypeIcon(integracao.type)}</span>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>{integracao.name}</h3>
                  <span style={{
                    backgroundColor: integracao.isActive ? '#10b981' : '#6b7280',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    {integracao.isActive ? 'Ativa' : 'Inativa'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                  <div>
                    <strong style={{ fontSize: '14px' }}>Tipo:</strong>
                    <p style={{ margin: '2px 0', fontSize: '14px' }}>{getTypeLabel(integracao.type)}</p>
                  </div>

                  {integracao.apiKey && (
                    <div>
                      <strong style={{ fontSize: '14px' }}>API Key:</strong>
                      <p style={{ margin: '2px 0', fontSize: '14px' }}>
                        {integracao.apiKey.substring(0, 10)}...
                      </p>
                    </div>
                  )}

                  {integracao.webhookUrl && (
                    <div>
                      <strong style={{ fontSize: '14px' }}>Webhook:</strong>
                      <p style={{ margin: '2px 0', fontSize: '14px', wordBreak: 'break-all' }}>
                        {integracao.webhookUrl}
                      </p>
                    </div>
                  )}

                  {integracao.lastSync && (
                    <div>
                      <strong style={{ fontSize: '14px' }}>Última Sincronização:</strong>
                      <p style={{ margin: '2px 0', fontSize: '14px' }}>
                        {new Date(integracao.lastSync).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Logs Recentes */}
                {integracao.syncLogs && integracao.syncLogs.length > 0 && (
                  <div style={{ marginTop: '15px' }}>
                    <strong style={{ fontSize: '14px' }}>Logs Recentes:</strong>
                    <div style={{ marginTop: '5px' }}>
                      {integracao.syncLogs.slice(0, 3).map(log => (
                        <div key={log.id} style={{ 
                          fontSize: '12px', 
                          color: log.status === 'SUCCESS' ? '#10b981' : '#ef4444',
                          marginBottom: '2px'
                        }}>
                          {log.action}: {log.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                <button 
                  onClick={() => testIntegration(integracao)}
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
                  Testar
                </button>
                <button 
                  onClick={() => toggleActive(integracao.id, integracao.isActive)}
                  style={{
                    backgroundColor: integracao.isActive ? '#ef4444' : '#10b981',
                    color: 'white',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  {integracao.isActive ? 'Desativar' : 'Ativar'}
                </button>
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
            maxWidth: '600px'
          }}>
            <h2>Nova Integração</h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Tipo *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  required
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="WHATSAPP">WhatsApp Business</option>
                  <option value="EMAIL_MARKETING">E-mail Marketing</option>
                  <option value="VOIP">Telefonia VoIP</option>
                  <option value="ERP">Sistema ERP</option>
                  <option value="API_EXTERNAL">API Externa</option>
                  <option value="WEBHOOK">Webhook</option>
                </select>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  API Key
                </label>
                <input
                  type="text"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({...formData, apiKey: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Webhook URL
                </label>
                <input
                  type="url"
                  value={formData.webhookUrl}
                  onChange={(e) => setFormData({...formData, webhookUrl: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  />
                  <span>Ativar integração</span>
                </label>
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
                  Criar Integração
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div style={{
      backgroundColor: 'white',
      padding: '15px',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
        {value}
      </div>
      <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
        {title}
      </div>
    </div>
  );
}