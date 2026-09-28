import { useState } from 'react';
import {
  Search,
  Star,
  Trash2,
  ExternalLink,
  Download,
  Loader2,
  Plus,
  X,
  FileText,
  MapPin,
  Calendar,
  DollarSign,
  Building2
} from 'lucide-react';

// ─── Dados de Exemplo (Mock) ──────────────────────────────────────────────────

const MOCK_EDITAIS = [
  {
    id: '001',
    numero: 'Pregão 001/2026',
    titulo: 'Aquisição de Software de Gestão',
    descricao: 'Contratação de solução de software para gestão administrativa e financeira',
    orgao: 'Prefeitura Municipal de São Paulo',
    cidade: 'São Paulo',
    estado: 'SP',
    modalidade: 'Pregão Eletrônico',
    valor: 450000,
    dataInclusao: '2026-01-10',
    dataPrazo: '2026-05-20',
    vigente: true,
    temEdital: true,
    pdfUrl: '#',
    portalUrl: '#'
  },
  {
    id: '002',
    numero: 'Pregão 002/2026',
    titulo: 'Licenciamento de Software Corporativo',
    descricao: 'Aquisição de licenças de software para uso corporativo em toda a rede municipal',
    orgao: 'Câmara Municipal do Rio de Janeiro',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    modalidade: 'Pregão Eletrônico',
    valor: 850000,
    dataInclusao: '2026-01-15',
    dataPrazo: '2026-05-25',
    vigente: true,
    temEdital: true,
    pdfUrl: '#',
    portalUrl: '#'
  },
  {
    id: '003',
    numero: 'Concorrência 003/2026',
    titulo: 'Infraestrutura de TI e Datacenter',
    descricao: 'Contratação de empresa para implantação de infraestrutura de TI e datacenter',
    orgao: 'Governo do Distrito Federal',
    cidade: 'Brasília',
    estado: 'DF',
    modalidade: 'Concorrência',
    valor: 1200000,
    dataInclusao: '2026-01-20',
    dataPrazo: '2026-06-10',
    vigente: true,
    temEdital: true,
    pdfUrl: '#',
    portalUrl: '#'
  },
  {
    id: '004',
    numero: 'Dispensa 004/2026',
    titulo: 'Manutenção de Equipamentos de Informática',
    descricao: 'Serviços de manutenção preventiva e corretiva de equipamentos de informática',
    orgao: 'Secretaria de Educação de Campinas',
    cidade: 'Campinas',
    estado: 'SP',
    modalidade: 'Dispensa',
    valor: 120000,
    dataInclusao: '2026-02-01',
    dataPrazo: '2026-04-30',
    vigente: true,
    temEdital: false,
    pdfUrl: null,
    portalUrl: '#'
  },
  {
    id: '005',
    numero: 'Pregão 005/2026',
    titulo: 'Serviços de TI e Suporte Técnico',
    descricao: 'Contratação de empresa especializada em serviços de TI e suporte técnico',
    orgao: 'Prefeitura de Belo Horizonte',
    cidade: 'Belo Horizonte',
    estado: 'MG',
    modalidade: 'Pregão Eletrônico',
    valor: 980000,
    dataInclusao: '2026-02-05',
    dataPrazo: '2026-05-15',
    vigente: true,
    temEdital: true,
    pdfUrl: '#',
    portalUrl: '#'
  },
  {
    id: '006',
    numero: 'Pregão 006/2026',
    titulo: 'Equipamentos de Rede e Conectividade',
    descricao: 'Aquisição de switches, roteadores e equipamentos de rede para a rede municipal',
    orgao: 'Prefeitura Municipal de Curitiba',
    cidade: 'Curitiba',
    estado: 'PR',
    modalidade: 'Pregão Eletrônico',
    valor: 680000,
    dataInclusao: '2026-02-10',
    dataPrazo: '2026-05-30',
    vigente: true,
    temEdital: true,
    pdfUrl: '#',
    portalUrl: '#'
  },
  {
    id: '007',
    numero: 'Dispensa 007/2026',
    titulo: 'Serviços de Consultoria em TI',
    descricao: 'Contratação de consultoria especializada em transformação digital e governança de TI',
    orgao: 'Câmara Municipal de Curitiba',
    cidade: 'Curitiba',
    estado: 'PR',
    modalidade: 'Dispensa',
    valor: 250000,
    dataInclusao: '2026-02-15',
    dataPrazo: '2026-04-15',
    vigente: false,
    temEdital: true,
    pdfUrl: '#',
    portalUrl: '#'
  },
  {
    id: '008',
    numero: 'Concorrência 008/2026',
    titulo: 'Implantação de Datacenter Regional',
    descricao: 'Construção e implantação de datacenter para atender órgãos estaduais da região Norte',
    orgao: 'Governo do Estado do Pará',
    cidade: 'Belém',
    estado: 'PA',
    modalidade: 'Concorrência',
    valor: 2500000,
    dataInclusao: '2026-03-01',
    dataPrazo: '2026-07-01',
    vigente: true,
    temEdital: true,
    pdfUrl: '#',
    portalUrl: '#'
  },
  {
    id: '009',
    numero: 'Pregão 009/2026',
    titulo: 'Licenças Microsoft 365 e Azure',
    descricao: 'Aquisição de licenças Microsoft 365 e serviços de nuvem Azure para órgãos municipais',
    orgao: 'Prefeitura de João Pessoa',
    cidade: 'João Pessoa',
    estado: 'PB',
    modalidade: 'Pregão Eletrônico',
    valor: 420000,
    dataInclusao: '2026-03-05',
    dataPrazo: '2026-06-05',
    vigente: true,
    temEdital: true,
    pdfUrl: '#',
    portalUrl: '#'
  },
  {
    id: '010',
    numero: 'Tomada de Preços 010/2026',
    titulo: 'Desenvolvimento de Sistema Web',
    descricao: 'Desenvolvimento de sistema web para gestão de serviços públicos municipais',
    orgao: 'Prefeitura do Recife',
    cidade: 'Recife',
    estado: 'PE',
    modalidade: 'Tomada de Preços',
    valor: 890000,
    dataInclusao: '2026-03-10',
    dataPrazo: '2026-06-20',
    vigente: true,
    temEdital: true,
    pdfUrl: '#',
    portalUrl: '#'
  },
  {
    id: '011',
    numero: 'Pregão 011/2026',
    titulo: 'Aquisição de Computadores e Periféricos',
    descricao: 'Aquisição de computadores desktop, notebooks e periféricos para secretarias municipais',
    orgao: 'Prefeitura de Campo Grande',
    cidade: 'Campo Grande',
    estado: 'MS',
    modalidade: 'Pregão Eletrônico',
    valor: 1100000,
    dataInclusao: '2026-03-15',
    dataPrazo: '2026-06-15',
    vigente: true,
    temEdital: true,
    pdfUrl: '#',
    portalUrl: '#'
  }
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatarMoeda(valor) {
  if (valor == null || isNaN(valor)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function formatarData(data) {
  if (!data) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR').format(new Date(data + 'T00:00:00'));
  } catch {
    return data;
  }
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function PortalBuscaEditais() {
  // Filtros
  const [objeto, setObjeto] = useState('');
  const [numEdital, setNumEdital] = useState('');
  const [estado, setEstado] = useState('');
  const [cidade, setCidade] = useState('');
  const [modalidade, setModalidade] = useState('');
  const [vigentes, setVigentes] = useState(false);
  const [comEdital, setComEdital] = useState(false);
  const [somenteFavoritas, setSomenteFavoritas] = useState(false);

  // Estado da UI
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeTab, setActiveTab] = useState('resultados');

  // Perfil de atuação
  const [keywords, setKeywords] = useState(() => {
    try { return JSON.parse(localStorage.getItem('editais_keywords') || '[]'); } catch { return []; }
  });
  const [newKeyword, setNewKeyword] = useState('');
  const [perfilAtuacao, setPerfilAtuacao] = useState(false);

  // Favoritos
  const [favoritos, setFavoritos] = useState(() => {
    try { return JSON.parse(localStorage.getItem('editais_favoritos') || '[]'); } catch { return []; }
  });

  // ── Busca ──────────────────────────────────────────────────────────────────

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setSearched(true);
    setActiveTab('resultados');

    setTimeout(() => {
      let data = [...MOCK_EDITAIS];

      if (objeto) {
        const t = objeto.toLowerCase();
        data = data.filter(r =>
          r.titulo.toLowerCase().includes(t) || r.descricao.toLowerCase().includes(t)
        );
      }

      if (numEdital) {
        data = data.filter(r => r.numero.toLowerCase().includes(numEdital.toLowerCase()));
      }

      if (estado) {
        data = data.filter(r => r.estado === estado);
      }

      if (cidade) {
        data = data.filter(r => r.cidade.toLowerCase().includes(cidade.toLowerCase()));
      }

      if (modalidade) {
        data = data.filter(r => r.modalidade === modalidade);
      }

      if (vigentes) {
        data = data.filter(r => r.vigente);
      }

      if (comEdital) {
        data = data.filter(r => r.temEdital);
      }

      if (somenteFavoritas) {
        data = data.filter(r => favoritos.includes(r.id));
      }

      if (perfilAtuacao && keywords.length > 0) {
        const terms = keywords.map(k => k.toLowerCase());
        data = data.filter(r => {
          const text = (r.titulo + ' ' + r.descricao).toLowerCase();
          return terms.some(t => text.includes(t));
        });
      }

      setResults(data);
      setLoading(false);
    }, 600);
  };

  const limparFiltros = () => {
    setObjeto('');
    setNumEdital('');
    setEstado('');
    setCidade('');
    setModalidade('');
    setVigentes(false);
    setComEdital(false);
    setSomenteFavoritas(false);
    setResults([]);
    setSearched(false);
  };

  // ── Favoritos ──────────────────────────────────────────────────────────────

  const toggleFavorito = (id) => {
    const lista = favoritos.includes(id)
      ? favoritos.filter(f => f !== id)
      : [...favoritos, id];
    setFavoritos(lista);
    localStorage.setItem('editais_favoritos', JSON.stringify(lista));
  };

  // ── Keywords ───────────────────────────────────────────────────────────────

  const addKeyword = () => {
    const term = newKeyword.trim();
    if (!term || keywords.includes(term)) return;
    const lista = [...keywords, term];
    setKeywords(lista);
    localStorage.setItem('editais_keywords', JSON.stringify(lista));
    setNewKeyword('');
  };

  const removeKeyword = (term) => {
    const lista = keywords.filter(k => k !== term);
    setKeywords(lista);
    localStorage.setItem('editais_keywords', JSON.stringify(lista));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const favoritosData = MOCK_EDITAIS.filter(e => favoritos.includes(e.id));

  return (
    <div
      className="min-h-screen p-4 md:p-6"
      style={{ background: 'var(--crm-background, #0f172a)', color: 'var(--crm-ink, #f1f5f9)' }}
    >
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Portal de Busca de Editais</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--crm-muted, #94a3b8)' }}>
            Busca inteligente de editais públicos — {MOCK_EDITAIS.length} editais disponíveis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
            style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            Sistema Ativo
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Editais disponíveis', value: MOCK_EDITAIS.length },
          { label: 'Resultados', value: searched ? results.length : '—' },
          { label: 'Favoritos', value: favoritos.length },
          { label: 'Palavras-chave', value: keywords.length }
        ].map(kpi => (
          <div
            key={kpi.label}
            className="rounded-xl border p-4"
            style={{ background: 'var(--crm-surface, #1e293b)', borderColor: 'var(--crm-border, #334155)' }}
          >
            <div className="text-2xl font-bold text-white">{kpi.value}</div>
            <div className="mt-1 text-xs" style={{ color: 'var(--crm-muted, #94a3b8)' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Formulário de Busca */}
      {activeTab !== 'perfil' && (
        <div
          className="mb-6 rounded-xl border p-5"
          style={{ background: 'var(--crm-surface, #1e293b)', borderColor: 'var(--crm-border, #334155)' }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Busca Inteligente</h2>
            <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: 'var(--crm-muted, #94a3b8)' }}>
              <input
                type="checkbox"
                checked={perfilAtuacao}
                onChange={e => setPerfilAtuacao(e.target.checked)}
                className="accent-blue-500"
              />
              Usar perfil de atuação
              {keywords.length > 0 && (
                <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">
                  {keywords.length} termos
                </span>
              )}
            </label>
          </div>

          <form onSubmit={handleSearch}>
            <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--crm-muted, #94a3b8)' }}>
                  Objeto Principal
                </label>
                <input
                  type="text"
                  placeholder="Ex: software, equipamentos, consultoria..."
                  value={objeto}
                  onChange={e => setObjeto(e.target.value)}
                  className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
                  style={{ borderColor: 'var(--crm-border, #334155)' }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--crm-muted, #94a3b8)' }}>
                  Nº Edital
                </label>
                <input
                  type="text"
                  placeholder="Ex: 001/2026"
                  value={numEdital}
                  onChange={e => setNumEdital(e.target.value)}
                  className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
                  style={{ borderColor: 'var(--crm-border, #334155)' }}
                />
              </div>
            </div>

            <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--crm-muted, #94a3b8)' }}>
                  Estado
                </label>
                <select
                  value={estado}
                  onChange={e => setEstado(e.target.value)}
                  className="w-full rounded-lg border bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                  style={{ borderColor: 'var(--crm-border, #334155)' }}
                >
                  <option value="">Todos os estados</option>
                  {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--crm-muted, #94a3b8)' }}>
                  Cidade
                </label>
                <input
                  type="text"
                  placeholder="Ex: Curitiba, São Paulo..."
                  value={cidade}
                  onChange={e => setCidade(e.target.value)}
                  className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
                  style={{ borderColor: 'var(--crm-border, #334155)' }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--crm-muted, #94a3b8)' }}>
                  Modalidade
                </label>
                <select
                  value={modalidade}
                  onChange={e => setModalidade(e.target.value)}
                  className="w-full rounded-lg border bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                  style={{ borderColor: 'var(--crm-border, #334155)' }}
                >
                  <option value="">Todas as modalidades</option>
                  {['Pregão Eletrônico','Concorrência','Dispensa','Inexigibilidade','Tomada de Preços','Convite','Leilão'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-4">
              {[
                { id: 'vigentes', label: 'Apenas vigentes', value: vigentes, set: setVigentes },
                { id: 'comEdital', label: 'Com edital disponível', value: comEdital, set: setComEdital },
                { id: 'favoritas', label: 'Somente favoritas', value: somenteFavoritas, set: setSomenteFavoritas }
              ].map(opt => (
                <label key={opt.id} className="flex cursor-pointer items-center gap-2 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={opt.value}
                    onChange={e => opt.set(e.target.checked)}
                    className="accent-blue-500"
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Pesquisar Agora
              </button>
              <button
                type="button"
                onClick={limparFiltros}
                className="rounded-lg border px-4 py-2 text-sm text-white transition hover:bg-white/5"
                style={{ borderColor: 'var(--crm-border, #334155)' }}
              >
                Limpar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-xl border p-1" style={{ background: 'var(--crm-surface, #1e293b)', borderColor: 'var(--crm-border, #334155)' }}>
        {[
          { id: 'resultados', label: `Resultados${searched ? ` (${results.length})` : ''}` },
          { id: 'favoritos', label: `Favoritos (${favoritos.length})` },
          { id: 'perfil', label: `Perfil de Busca (${keywords.length})` }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 rounded-lg py-2 text-sm font-medium transition"
            style={{
              background: activeTab === tab.id ? 'var(--crm-border, #334155)' : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'var(--crm-muted, #94a3b8)'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Resultados */}
      {activeTab === 'resultados' && (
        <div>
          {!searched && !loading && (
            <div className="rounded-xl border p-10 text-center" style={{ borderColor: 'var(--crm-border, #334155)' }}>
              <Search className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm" style={{ color: 'var(--crm-muted, #94a3b8)' }}>
                Use os filtros acima e clique em "Pesquisar Agora" para buscar editais.
              </p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            </div>
          )}

          {searched && !loading && results.length === 0 && (
            <div className="rounded-xl border p-10 text-center" style={{ borderColor: 'var(--crm-border, #334155)' }}>
              <FileText className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p className="mb-2 font-medium text-white">Nenhum edital encontrado</p>
              <p className="text-sm" style={{ color: 'var(--crm-muted, #94a3b8)' }}>
                Tente ajustar os filtros ou limpar a busca.
              </p>
              <button
                onClick={limparFiltros}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                Limpar e buscar novamente
              </button>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              {results.map(edital => (
                <EditalCard
                  key={edital.id}
                  edital={edital}
                  isFavorito={favoritos.includes(edital.id)}
                  onFavoritar={() => toggleFavorito(edital.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Favoritos */}
      {activeTab === 'favoritos' && (
        <div>
          {favoritosData.length === 0 ? (
            <div className="rounded-xl border p-10 text-center" style={{ borderColor: 'var(--crm-border, #334155)' }}>
              <Star className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm" style={{ color: 'var(--crm-muted, #94a3b8)' }}>
                Nenhum edital favoritado ainda. Clique na estrela nos resultados para favoritar.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {favoritosData.map(edital => (
                <EditalCard
                  key={edital.id}
                  edital={edital}
                  isFavorito={true}
                  onFavoritar={() => toggleFavorito(edital.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Perfil de Busca */}
      {activeTab === 'perfil' && (
        <div
          className="rounded-xl border p-5"
          style={{ background: 'var(--crm-surface, #1e293b)', borderColor: 'var(--crm-border, #334155)' }}
        >
          <h2 className="mb-1 text-base font-semibold text-white">Perfil de Atuação</h2>
          <p className="mb-4 text-sm" style={{ color: 'var(--crm-muted, #94a3b8)' }}>
            Configure palavras-chave para filtrar automaticamente os editais relevantes para o seu negócio.
          </p>

          <div className="mb-4 flex gap-2">
            <input
              type="text"
              placeholder="Ex: software, TI, consultoria..."
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addKeyword()}
              className="flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
              style={{ borderColor: 'var(--crm-border, #334155)' }}
            />
            <button
              onClick={addKeyword}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              <Plus className="h-4 w-4" /> Adicionar
            </button>
          </div>

          {keywords.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--crm-muted, #94a3b8)' }}>
              Nenhuma palavra-chave configurada.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {keywords.map(term => (
                <span
                  key={term}
                  className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm text-white"
                  style={{ borderColor: 'var(--crm-border, #334155)', background: 'rgba(59,130,246,0.1)' }}
                >
                  {term}
                  <button onClick={() => removeKeyword(term)} className="text-slate-400 hover:text-red-400">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {keywords.length > 0 && (
            <div className="mt-4 rounded-lg border p-3" style={{ borderColor: 'var(--crm-border, #334155)', background: 'rgba(59,130,246,0.05)' }}>
              <p className="text-xs" style={{ color: 'var(--crm-muted, #94a3b8)' }}>
                Para usar o perfil na busca, ative o toggle "Usar perfil de atuação" no formulário de busca.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Card de Edital ───────────────────────────────────────────────────────────

function EditalCard({ edital, isFavorito, onFavoritar }) {
  return (
    <div
      className="rounded-xl border p-5 transition hover:border-blue-500/40"
      style={{ background: 'var(--crm-surface, #1e293b)', borderColor: 'var(--crm-border, #334155)' }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-blue-400">{edital.numero}</span>
            <span
              className="rounded-full px-2 py-0.5 text-xs"
              style={{
                background: edital.vigente ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: edital.vigente ? '#4ade80' : '#f87171'
              }}
            >
              {edital.vigente ? 'Vigente' : 'Encerrado'}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-xs"
              style={{ background: 'rgba(148,163,184,0.1)', color: 'var(--crm-muted, #94a3b8)' }}
            >
              {edital.modalidade}
            </span>
          </div>
          <h3 className="font-semibold text-white">{edital.titulo}</h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--crm-muted, #94a3b8)' }}>{edital.descricao}</p>
        </div>
        <button
          onClick={onFavoritar}
          className="shrink-0 rounded-lg p-2 transition hover:bg-white/5"
          title={isFavorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
          <Star
            className="h-5 w-5"
            style={{ color: isFavorito ? '#facc15' : 'var(--crm-muted, #94a3b8)', fill: isFavorito ? '#facc15' : 'none' }}
          />
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { icon: Building2, label: edital.orgao },
          { icon: MapPin, label: `${edital.cidade} / ${edital.estado}` },
          { icon: DollarSign, label: formatarMoeda(edital.valor) },
          { icon: Calendar, label: `Prazo: ${formatarData(edital.dataPrazo)}` }
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--crm-muted, #94a3b8)' }}>
            <item.icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {edital.pdfUrl && edital.pdfUrl !== '#' && (
          <a
            href={edital.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-white transition hover:bg-white/5"
            style={{ borderColor: 'var(--crm-border, #334155)' }}
          >
            <Download className="h-3.5 w-3.5" /> Baixar Edital
          </a>
        )}
        {edital.portalUrl && edital.portalUrl !== '#' ? (
          <a
            href={edital.portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-white transition hover:bg-white/5"
            style={{ borderColor: 'var(--crm-border, #334155)' }}
          >
            <ExternalLink className="h-3.5 w-3.5" /> Ver no Portal
          </a>
        ) : (
          <a
            href="https://pncp.gov.br/app/editais"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition hover:bg-white/5"
            style={{ borderColor: 'var(--crm-border, #334155)', color: 'var(--crm-muted, #94a3b8)' }}
            title="Buscar no PNCP"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Buscar no PNCP
          </a>
        )}
        <button
          onClick={onFavoritar}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition hover:bg-white/5"
          style={{
            borderColor: 'var(--crm-border, #334155)',
            color: isFavorito ? '#facc15' : 'var(--crm-muted, #94a3b8)'
          }}
        >
          <Star className="h-3.5 w-3.5" style={{ fill: isFavorito ? '#facc15' : 'none' }} />
          {isFavorito ? 'Favoritado' : 'Favoritar'}
        </button>
      </div>
    </div>
  );
}
