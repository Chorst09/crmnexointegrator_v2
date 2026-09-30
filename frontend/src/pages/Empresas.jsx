import { useEffect, useState } from "react";
import axios from "axios";

export default function Empresas() {
  const [empresas, setEmpresas] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    document: '',
    segment: '',
    size: 'SMALL',
    website: '',
    address: '',
    city: '',
    state: '',
    status: 'LEAD',
    contacts: [{ name: '', email: '', phone: '', position: '', isPrimary: true }]
  });

  const loadEmpresas = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/companies`);
      setEmpresas(response.data);
    } catch (error) {
      console.error('Erro ao carregar empresas:', error);
    }
  };

  useEffect(() => {
    loadEmpresas();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCompany) {
        await axios.put(`${import.meta.env.VITE_API_URL}/companies`, {
          ...formData,
          id: editingCompany.id
        });
      } else {
        await axios.post(`${import.meta.env.VITE_API_URL}/companies`, formData);
      }
      
      setShowForm(false);
      setEditingCompany(null);
      resetForm();
      loadEmpresas();
    } catch (error) {
      console.error('Erro ao salvar empresa:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      document: '',
      segment: '',
      size: 'SMALL',
      website: '',
      address: '',
      city: '',
      state: '',
      status: 'LEAD',
      contacts: [{ name: '', email: '', phone: '', position: '', isPrimary: true }]
    });
  };

  const editCompany = (company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name || '',
      document: company.document || '',
      segment: company.segment || '',
      size: company.size || 'SMALL',
      website: company.website || '',
      address: company.address || '',
      city: company.city || '',
      state: company.state || '',
      status: company.status || 'LEAD',
      contacts: company.contacts.length > 0 ? company.contacts : 
        [{ name: '', email: '', phone: '', position: '', isPrimary: true }]
    });
    setShowForm(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      LEAD: '#94a3b8',
      PROSPECT: '#60a5fa',
      ACTIVE: '#10b981',
      INACTIVE: '#f59e0b',
      CHURNED: '#ef4444'
    };
    return colors[status] || '#94a3b8';
  };

  const getSizeLabel = (size) => {
    const labels = {
      MICRO: 'Micro',
      SMALL: 'Pequena',
      MEDIUM: 'Média',
      LARGE: 'Grande',
      ENTERPRISE: 'Enterprise'
    };
    return labels[size] || size;
  };

  const getStatusLabel = (status) => {
    const labels = {
      LEAD: 'Lead',
      PROSPECT: 'Prospect',
      ACTIVE: 'Ativo',
      INACTIVE: 'Inativo',
      CHURNED: 'Perdido'
    };
    return labels[status] || status;
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Gestão de Empresas</h1>
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
          Nova Empresa
        </button>
      </div>

      {/* Estatísticas */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '15px',
        marginBottom: '30px'
      }}>
        <StatCard title="Total de Empresas" value={empresas.length} />
        <StatCard title="Leads" value={empresas.filter(e => e.status === 'LEAD').length} />
        <StatCard title="Clientes Ativos" value={empresas.filter(e => e.status === 'ACTIVE').length} />
        <StatCard title="Hot Leads (80+)" value={empresas.filter(e => e.leadScore >= 80).length} color="#ef4444" />
        <StatCard title="Warm Leads (60-79)" value={empresas.filter(e => e.leadScore >= 60 && e.leadScore < 80).length} color="#f59e0b" />
      </div>

      {/* Lista de Empresas */}
      <div style={{ 
        display: 'grid', 
        gap: '15px'
      }}>
        {empresas.map(empresa => (
          <div key={empresa.id} style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>{empresa.name}</h3>
                  <span style={{
                    backgroundColor: getStatusColor(empresa.status),
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    {getStatusLabel(empresa.status)}
                  </span>
                  {empresa.size && (
                    <span style={{
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '12px'
                    }}>
                      {getSizeLabel(empresa.size)}
                    </span>
                  )}
                  {empresa.leadScore !== undefined && (
                    <span style={{
                      backgroundColor: empresa.leadScore >= 80 ? '#ef4444' : 
                                     empresa.leadScore >= 60 ? '#f59e0b' : 
                                     empresa.leadScore >= 40 ? '#3b82f6' : '#6b7280',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      🎯 Score: {empresa.leadScore}
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                  <div>
                    {empresa.document && <p style={{ margin: '5px 0', fontSize: '14px' }}>📄 {empresa.document}</p>}
                    {empresa.segment && <p style={{ margin: '5px 0', fontSize: '14px' }}>🏢 {empresa.segment}</p>}
                    {empresa.website && <p style={{ margin: '5px 0', fontSize: '14px' }}>🌐 {empresa.website}</p>}
                  </div>
                  
                  <div>
                    {empresa.city && empresa.state && (
                      <p style={{ margin: '5px 0', fontSize: '14px' }}>📍 {empresa.city}, {empresa.state}</p>
                    )}
                    <p style={{ margin: '5px 0', fontSize: '14px' }}>
                      📊 {empresa._count.opportunities} oportunidades
                    </p>
                    <p style={{ margin: '5px 0', fontSize: '14px' }}>
                      📅 {new Date(empresa.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>

                  {empresa.contacts.length > 0 && (
                    <div>
                      <strong style={{ fontSize: '14px' }}>Contato Principal:</strong>
                      {empresa.contacts.filter(c => c.isPrimary)[0] && (
                        <div style={{ fontSize: '14px', marginTop: '5px' }}>
                          <p style={{ margin: '2px 0' }}>👤 {empresa.contacts.filter(c => c.isPrimary)[0].name}</p>
                          {empresa.contacts.filter(c => c.isPrimary)[0].email && (
                            <p style={{ margin: '2px 0' }}>✉️ {empresa.contacts.filter(c => c.isPrimary)[0].email}</p>
                          )}
                          {empresa.contacts.filter(c => c.isPrimary)[0].phone && (
                            <p style={{ margin: '2px 0' }}>📞 {empresa.contacts.filter(c => c.isPrimary)[0].phone}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <button 
                onClick={() => editCompany(empresa)}
                style={{
                  backgroundColor: '#f3f4f6',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Editar
              </button>
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
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2>{editingCompany ? 'Editar Empresa' : 'Nova Empresa'}</h2>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Nome da Empresa *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    CNPJ/CPF
                  </label>
                  <input
                    type="text"
                    value={formData.document}
                    onChange={(e) => setFormData({...formData, document: e.target.value})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Segmento
                  </label>
                  <input
                    type="text"
                    value={formData.segment}
                    onChange={(e) => setFormData({...formData, segment: e.target.value})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Porte
                  </label>
                  <select
                    value={formData.size}
                    onChange={(e) => setFormData({...formData, size: e.target.value})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  >
                    <option value="MICRO">Micro</option>
                    <option value="SMALL">Pequena</option>
                    <option value="MEDIUM">Média</option>
                    <option value="LARGE">Grande</option>
                    <option value="ENTERPRISE">Enterprise</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  >
                    <option value="LEAD">Lead</option>
                    <option value="PROSPECT">Prospect</option>
                    <option value="ACTIVE">Ativo</option>
                    <option value="INACTIVE">Inativo</option>
                    <option value="CHURNED">Perdido</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    Website
                  </label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({...formData, website: e.target.value})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h3>Contato Principal</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <input
                    type="text"
                    placeholder="Nome do contato"
                    value={formData.contacts[0]?.name || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      contacts: [{...formData.contacts[0], name: e.target.value}]
                    })}
                    style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={formData.contacts[0]?.email || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      contacts: [{...formData.contacts[0], email: e.target.value}]
                    })}
                    style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                  <input
                    type="tel"
                    placeholder="Telefone"
                    value={formData.contacts[0]?.phone || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      contacts: [{...formData.contacts[0], phone: e.target.value}]
                    })}
                    style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                  <input
                    type="text"
                    placeholder="Cargo"
                    value={formData.contacts[0]?.position || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      contacts: [{...formData.contacts[0], position: e.target.value}]
                    })}
                    style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button 
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingCompany(null);
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
                  {editingCompany ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, color = '#3b82f6' }) {
  return (
    <div style={{
      backgroundColor: 'white',
      padding: '15px',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '24px', fontWeight: 'bold', color }}>
        {value}
      </div>
      <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
        {title}
      </div>
    </div>
  );
}