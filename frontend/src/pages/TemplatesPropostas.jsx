import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Eye, 
  Edit, 
  Copy, 
  Trash2,
  Star,
  StarOff,
  Settings,
  Palette,
  Layout,
  Image,
  Type,
  Download,
  Upload
} from 'lucide-react';

import PageHeader from '../components/PageHeader';
import AnimatedStats from '../components/AnimatedStats';
import ModernTable from '../components/ModernTable';
import GradientCard from '../components/GradientCard';
import { buildApiUrl, getAuthHeaders } from '../config/api';

const TemplatesPropostas = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isDefault: false,
    coverEnabled: true,
    coverTitle: 'PROPOSTA COMERCIAL',
    coverSubtitle: 'Solução personalizada para seu negócio',
    coverLogo: '',
    coverBackground: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    headerEnabled: true,
    headerLogo: '',
    headerText: 'PROPOSTA COMERCIAL',
    headerHeight: 80,
    footerEnabled: true,
    footerText: 'Documento confidencial - Uso restrito',
    footerLogo: '',
    footerHeight: 60,
    indexEnabled: true,
    indexTitle: 'Índice',
    sections: [
      { id: 'company', title: 'Informações da Empresa', enabled: true, order: 1 },
      { id: 'proposal', title: 'Detalhes da Proposta', enabled: true, order: 2 },
      { id: 'items', title: 'Itens da Proposta', enabled: true, order: 3 },
      { id: 'financial', title: 'Resumo Financeiro', enabled: true, order: 4 }
    ],
    primaryColor: '#3B82F6',
    secondaryColor: '#64748B',
    fontFamily: 'Inter',
    fontSize: 12,
    pageMargins: { top: 40, right: 40, bottom: 40, left: 40 },
    pageSize: 'A4',
    pageOrientation: 'portrait'
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch(buildApiUrl('/proposal-templates'), {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name) {
      alert('Nome do template é obrigatório');
      return;
    }

    try {
      const url = editingTemplate 
        ? buildApiUrl(`/proposal-templates/${editingTemplate.id}`)
        : buildApiUrl('/proposal-templates');
      const method = editingTemplate ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        fetchTemplates();
        resetForm();
        alert(editingTemplate ? 'Template atualizado com sucesso!' : 'Template criado com sucesso!');
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao salvar template');
      }
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      alert('Erro ao salvar template');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      isDefault: false,
      coverEnabled: true,
      coverTitle: 'PROPOSTA COMERCIAL',
      coverSubtitle: 'Solução personalizada para seu negócio',
      coverLogo: '',
      coverBackground: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      headerEnabled: true,
      headerLogo: '',
      headerText: 'PROPOSTA COMERCIAL',
      headerHeight: 80,
      footerEnabled: true,
      footerText: 'Documento confidencial - Uso restrito',
      footerLogo: '',
      footerHeight: 60,
      indexEnabled: true,
      indexTitle: 'Índice',
      sections: [
        { id: 'company', title: 'Informações da Empresa', enabled: true, order: 1 },
        { id: 'proposal', title: 'Detalhes da Proposta', enabled: true, order: 2 },
        { id: 'items', title: 'Itens da Proposta', enabled: true, order: 3 },
        { id: 'financial', title: 'Resumo Financeiro', enabled: true, order: 4 }
      ],
      primaryColor: '#3B82F6',
      secondaryColor: '#64748B',
      fontFamily: 'Inter',
      fontSize: 12,
      pageMargins: { top: 40, right: 40, bottom: 40, left: 40 },
      pageSize: 'A4',
      pageOrientation: 'portrait'
    });
    setEditingTemplate(null);
    setShowForm(false);
  };

  const handleDuplicate = async (template) => {
    try {
      const response = await fetch(buildApiUrl(`/proposal-templates/${template.id}/duplicate`), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: `${template.name} (Cópia)` })
      });

      if (response.ok) {
        fetchTemplates();
        alert('Template duplicado com sucesso!');
      } else {
        alert('Erro ao duplicar template');
      }
    } catch (error) {
      console.error('Erro ao duplicar template:', error);
      alert('Erro ao duplicar template');
    }
  };

  const handleSetDefault = async (template) => {
    try {
      const response = await fetch(buildApiUrl(`/proposal-templates/${template.id}/set-default`), {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        fetchTemplates();
        alert('Template definido como padrão!');
      } else {
        alert('Erro ao definir template como padrão');
      }
    } catch (error) {
      console.error('Erro ao definir template como padrão:', error);
      alert('Erro ao definir template como padrão');
    }
  };

  const handleDelete = async (template) => {
    if (!confirm(`Tem certeza que deseja deletar o template "${template.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(buildApiUrl(`/proposal-templates/${template.id}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        fetchTemplates();
        alert('Template deletado com sucesso!');
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao deletar template');
      }
    } catch (error) {
      console.error('Erro ao deletar template:', error);
      alert('Erro ao deletar template');
    }
  };

  const handlePreview = (template) => {
    setPreviewTemplate(template);
    setShowPreview(true);
  };

  const updateSection = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      sections: prev.sections.map((section, i) => 
        i === index ? { ...section, [field]: value } : section
      )
    }));
  };

  const addSection = () => {
    const newSection = {
      id: `section_${Date.now()}`,
      title: 'Nova Seção',
      enabled: true,
      order: formData.sections.length + 1
    };
    setFormData(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }));
  };

  const removeSection = (index) => {
    setFormData(prev => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index)
    }));
  };

  // Calcular estatísticas
  const stats = {
    total: templates.length,
    default: templates.filter(t => t.isDefault).length,
    active: templates.filter(t => t.isActive).length,
    withCover: templates.filter(t => t.coverEnabled).length
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title="Templates de Proposta"
        subtitle="Crie e gerencie templates profissionais para suas propostas comerciais"
        icon={FileText}
        gradient="purple"
        breadcrumbs={['Vendas & CRM', 'Templates']}
        actions={[
          {
            label: 'Novo Template',
            icon: Plus,
            onClick: () => setShowForm(true),
            variant: 'primary'
          }
        ]}
      />

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnimatedStats
          title="Total de Templates"
          value={stats.total}
          subtitle="Templates disponíveis"
          icon={FileText}
          color="purple"
          trend={{ direction: 'up', value: '+2 este mês' }}
        />
        
        <AnimatedStats
          title="Template Padrão"
          value={stats.default}
          subtitle="Definido como padrão"
          icon={Star}
          color="yellow"
        />
        
        <AnimatedStats
          title="Templates Ativos"
          value={stats.active}
          subtitle="Disponíveis para uso"
          icon={Settings}
          color="green"
        />
        
        <AnimatedStats
          title="Com Capa"
          value={stats.withCover}
          subtitle="Templates com capa"
          icon={Image}
          color="blue"
        />
      </div>

      {/* Filtros */}
      <GradientCard gradient="gray" className="p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar templates por nome ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white shadow-sm"
              />
            </div>
          </div>
        </div>
      </GradientCard>

      {/* Modal de Formulário */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingTemplate ? 'Editar Template' : 'Novo Template'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-8">
              {/* Informações Básicas */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-purple-500" />
                  Informações Básicas
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome do Template *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Ex: Template Corporativo"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Descrição
                    </label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Descrição do template"
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isDefault" className="ml-2 block text-sm text-gray-900">
                    Definir como template padrão
                  </label>
                </div>
              </div>

              {/* Configurações de Capa */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Image className="w-5 h-5 mr-2 text-blue-500" />
                  Configurações de Capa
                </h3>
                
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="coverEnabled"
                    checked={formData.coverEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, coverEnabled: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="coverEnabled" className="ml-2 block text-sm text-gray-900">
                    Incluir capa na proposta
                  </label>
                </div>

                {formData.coverEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-6 border-l-2 border-blue-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Título da Capa
                      </label>
                      <input
                        type="text"
                        value={formData.coverTitle}
                        onChange={(e) => setFormData(prev => ({ ...prev, coverTitle: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Subtítulo da Capa
                      </label>
                      <input
                        type="text"
                        value={formData.coverSubtitle}
                        onChange={(e) => setFormData(prev => ({ ...prev, coverSubtitle: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Logo da Capa (URL)
                      </label>
                      <input
                        type="url"
                        value={formData.coverLogo}
                        onChange={(e) => setFormData(prev => ({ ...prev, coverLogo: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="https://exemplo.com/logo.png"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fundo da Capa (CSS)
                      </label>
                      <input
                        type="text"
                        value={formData.coverBackground}
                        onChange={(e) => setFormData(prev => ({ ...prev, coverBackground: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="linear-gradient(...) ou #FFFFFF"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Configurações de Cabeçalho e Rodapé */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Cabeçalho */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Layout className="w-5 h-5 mr-2 text-green-500" />
                    Cabeçalho
                  </h3>
                  
                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      id="headerEnabled"
                      checked={formData.headerEnabled}
                      onChange={(e) => setFormData(prev => ({ ...prev, headerEnabled: e.target.checked }))}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <label htmlFor="headerEnabled" className="ml-2 block text-sm text-gray-900">
                      Incluir cabeçalho
                    </label>
                  </div>

                  {formData.headerEnabled && (
                    <div className="space-y-4 pl-6 border-l-2 border-green-200">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Texto do Cabeçalho
                        </label>
                        <input
                          type="text"
                          value={formData.headerText}
                          onChange={(e) => setFormData(prev => ({ ...prev, headerText: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Logo do Cabeçalho (URL)
                        </label>
                        <input
                          type="url"
                          value={formData.headerLogo}
                          onChange={(e) => setFormData(prev => ({ ...prev, headerLogo: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Altura (px)
                        </label>
                        <input
                          type="number"
                          min="40"
                          max="200"
                          value={formData.headerHeight}
                          onChange={(e) => setFormData(prev => ({ ...prev, headerHeight: parseInt(e.target.value) }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Rodapé */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Layout className="w-5 h-5 mr-2 text-orange-500" />
                    Rodapé
                  </h3>
                  
                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      id="footerEnabled"
                      checked={formData.footerEnabled}
                      onChange={(e) => setFormData(prev => ({ ...prev, footerEnabled: e.target.checked }))}
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <label htmlFor="footerEnabled" className="ml-2 block text-sm text-gray-900">
                      Incluir rodapé
                    </label>
                  </div>

                  {formData.footerEnabled && (
                    <div className="space-y-4 pl-6 border-l-2 border-orange-200">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Texto do Rodapé
                        </label>
                        <input
                          type="text"
                          value={formData.footerText}
                          onChange={(e) => setFormData(prev => ({ ...prev, footerText: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Logo do Rodapé (URL)
                        </label>
                        <input
                          type="url"
                          value={formData.footerLogo}
                          onChange={(e) => setFormData(prev => ({ ...prev, footerLogo: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Altura (px)
                        </label>
                        <input
                          type="number"
                          min="30"
                          max="150"
                          value={formData.footerHeight}
                          onChange={(e) => setFormData(prev => ({ ...prev, footerHeight: parseInt(e.target.value) }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Configurações de Índice */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Type className="w-5 h-5 mr-2 text-indigo-500" />
                  Índice
                </h3>
                
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="indexEnabled"
                    checked={formData.indexEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, indexEnabled: e.target.checked }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="indexEnabled" className="ml-2 block text-sm text-gray-900">
                    Incluir índice na proposta
                  </label>
                </div>

                {formData.indexEnabled && (
                  <div className="pl-6 border-l-2 border-indigo-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Título do Índice
                    </label>
                    <input
                      type="text"
                      value={formData.indexTitle}
                      onChange={(e) => setFormData(prev => ({ ...prev, indexTitle: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>

              {/* Seções */}
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-purple-500" />
                    Seções da Proposta
                  </h3>
                  <button
                    type="button"
                    onClick={addSection}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Seção
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.sections.map((section, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={section.enabled}
                          onChange={(e) => updateSection(index, 'enabled', e.target.checked)}
                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        />
                      </div>
                      
                      <div className="flex-1">
                        <input
                          type="text"
                          value={section.title}
                          onChange={(e) => updateSection(index, 'title', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Título da seção"
                        />
                      </div>
                      
                      <div className="w-20">
                        <input
                          type="number"
                          min="0"
                          value={section.order}
                          onChange={(e) => updateSection(index, 'order', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Ordem"
                        />
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => removeSection(index)}
                        className="text-red-500 hover:text-red-700 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Configurações de Estilo */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Palette className="w-5 h-5 mr-2 text-pink-500" />
                  Configurações de Estilo
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cor Primária
                    </label>
                    <input
                      type="color"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="w-full h-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cor Secundária
                    </label>
                    <input
                      type="color"
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      className="w-full h-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fonte
                    </label>
                    <select
                      value={formData.fontFamily}
                      onChange={(e) => setFormData(prev => ({ ...prev, fontFamily: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    >
                      <option value="Inter">Inter</option>
                      <option value="Arial">Arial</option>
                      <option value="Helvetica">Helvetica</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Georgia">Georgia</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tamanho da Fonte
                    </label>
                    <input
                      type="number"
                      min="8"
                      max="16"
                      value={formData.fontSize}
                      onChange={(e) => setFormData(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancelar
                </button>
                
                <button
                  type="submit"
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  {editingTemplate ? 'Atualizar' : 'Criar'} Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Preview */}
      {showPreview && previewTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">
                Preview: {previewTemplate.name}
              </h2>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6">
              <div className="bg-gray-100 p-8 rounded-lg">
                <div className="bg-white shadow-lg rounded-lg overflow-hidden max-w-2xl mx-auto">
                  {/* Preview da Capa */}
                  {previewTemplate.coverEnabled && (
                    <div 
                      className="p-12 text-center text-white"
                      style={{ background: previewTemplate.coverBackground }}
                    >
                      {previewTemplate.coverLogo && (
                        <img 
                          src={previewTemplate.coverLogo} 
                          alt="Logo" 
                          className="h-16 mx-auto mb-6"
                        />
                      )}
                      <h1 className="text-4xl font-bold mb-4">{previewTemplate.coverTitle}</h1>
                      <p className="text-xl opacity-90">{previewTemplate.coverSubtitle}</p>
                    </div>
                  )}
                  
                  {/* Preview do Cabeçalho */}
                  {previewTemplate.headerEnabled && (
                    <div 
                      className="px-8 py-4 border-b border-gray-200 flex items-center justify-between"
                      style={{ height: `${previewTemplate.headerHeight}px` }}
                    >
                      {previewTemplate.headerLogo && (
                        <img 
                          src={previewTemplate.headerLogo} 
                          alt="Logo Header" 
                          className="h-8"
                        />
                      )}
                      <h2 className="text-lg font-semibold" style={{ color: previewTemplate.primaryColor }}>
                        {previewTemplate.headerText}
                      </h2>
                    </div>
                  )}
                  
                  {/* Preview do Conteúdo */}
                  <div className="p-8">
                    {previewTemplate.indexEnabled && (
                      <div className="mb-8">
                        <h3 className="text-xl font-bold mb-4" style={{ color: previewTemplate.primaryColor }}>
                          {previewTemplate.indexTitle}
                        </h3>
                        <ul className="space-y-2">
                          {previewTemplate.sections
                            .filter(s => s.enabled)
                            .sort((a, b) => a.order - b.order)
                            .map((section, index) => (
                              <li key={index} className="flex justify-between">
                                <span>{section.title}</span>
                                <span>{index + 1}</span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                    
                    <div className="space-y-6">
                      {previewTemplate.sections
                        .filter(s => s.enabled)
                        .sort((a, b) => a.order - b.order)
                        .map((section, index) => (
                          <div key={index}>
                            <h4 className="text-lg font-semibold mb-3" style={{ color: previewTemplate.primaryColor }}>
                              {section.title}
                            </h4>
                            <div className="text-gray-600" style={{ fontSize: `${previewTemplate.fontSize}px` }}>
                              Conteúdo da seção {section.title.toLowerCase()}...
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                  
                  {/* Preview do Rodapé */}
                  {previewTemplate.footerEnabled && (
                    <div 
                      className="px-8 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-sm text-gray-600"
                      style={{ height: `${previewTemplate.footerHeight}px` }}
                    >
                      <span>{previewTemplate.footerText}</span>
                      {previewTemplate.footerLogo && (
                        <img 
                          src={previewTemplate.footerLogo} 
                          alt="Logo Footer" 
                          className="h-6"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabela de Templates */}
      <ModernTable
        title="Lista de Templates"
        data={templates.filter(template => 
          !searchTerm || 
          template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (template.description && template.description.toLowerCase().includes(searchTerm.toLowerCase()))
        )}
        columns={[
          {
            key: 'name',
            label: 'Template',
            render: (template) => (
              <div className="flex items-center">
                <FileText className="w-4 h-4 text-purple-500 mr-2" />
                <div>
                  <div className="font-medium text-gray-900 flex items-center gap-2">
                    {template.name}
                    {template.isDefault && (
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {template.description || 'Sem descrição'}
                  </div>
                </div>
              </div>
            )
          },
          {
            key: 'features',
            label: 'Recursos',
            render: (template) => (
              <div className="flex flex-wrap gap-1">
                {template.coverEnabled && (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                    <Image className="w-3 h-3 mr-1" />
                    Capa
                  </span>
                )}
                {template.headerEnabled && (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                    <Layout className="w-3 h-3 mr-1" />
                    Cabeçalho
                  </span>
                )}
                {template.footerEnabled && (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
                    <Layout className="w-3 h-3 mr-1" />
                    Rodapé
                  </span>
                )}
                {template.indexEnabled && (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                    <Type className="w-3 h-3 mr-1" />
                    Índice
                  </span>
                )}
              </div>
            )
          },
          {
            key: 'sections',
            label: 'Seções',
            render: (template) => (
              <div className="text-sm text-gray-900">
                {template.sections.filter(s => s.enabled).length} seções ativas
              </div>
            )
          },
          {
            key: 'style',
            label: 'Estilo',
            render: (template) => (
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: template.primaryColor }}
                ></div>
                <span className="text-sm text-gray-600">{template.fontFamily}</span>
              </div>
            )
          },
          {
            key: 'status',
            label: 'Status',
            render: (template) => (
              <div className="flex items-center gap-2">
                {template.isActive ? (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                    Ativo
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                    Inativo
                  </span>
                )}
                {template.isDefault && (
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                    Padrão
                  </span>
                )}
              </div>
            )
          }
        ]}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onView={handlePreview}
        onEdit={(template) => {
          setEditingTemplate(template);
          setFormData({
            name: template.name,
            description: template.description || '',
            isDefault: template.isDefault,
            coverEnabled: template.coverEnabled,
            coverTitle: template.coverTitle || '',
            coverSubtitle: template.coverSubtitle || '',
            coverLogo: template.coverLogo || '',
            coverBackground: template.coverBackground || '',
            headerEnabled: template.headerEnabled,
            headerLogo: template.headerLogo || '',
            headerText: template.headerText || '',
            headerHeight: template.headerHeight,
            footerEnabled: template.footerEnabled,
            footerText: template.footerText || '',
            footerLogo: template.footerLogo || '',
            footerHeight: template.footerHeight,
            indexEnabled: template.indexEnabled,
            indexTitle: template.indexTitle || 'Índice',
            sections: template.sections || [],
            primaryColor: template.primaryColor,
            secondaryColor: template.secondaryColor,
            fontFamily: template.fontFamily,
            fontSize: template.fontSize,
            pageMargins: template.pageMargins,
            pageSize: template.pageSize,
            pageOrientation: template.pageOrientation
          });
          setShowForm(true);
        }}
        customActions={[
          {
            label: 'Preview',
            icon: Eye,
            onClick: handlePreview
          },
          {
            label: 'Duplicar',
            icon: Copy,
            onClick: handleDuplicate
          },
          {
            label: 'Definir Padrão',
            icon: Star,
            onClick: handleSetDefault,
            condition: (template) => !template.isDefault
          },
          {
            label: 'Remover Padrão',
            icon: StarOff,
            onClick: handleSetDefault,
            condition: (template) => template.isDefault
          },
          {
            label: 'Deletar',
            icon: Trash2,
            onClick: handleDelete,
            condition: (template) => !template.isDefault,
            className: 'text-red-600 hover:text-red-800'
          }
        ]}
        emptyState={
          <div>
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum template encontrado</h3>
            <p className="text-gray-500">Comece criando seu primeiro template de proposta</p>
          </div>
        }
      />
    </div>
  );
};

export default TemplatesPropostas;