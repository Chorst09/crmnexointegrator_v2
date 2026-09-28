import React, { useState, useEffect } from 'react';
import { Search, Filter, AlertCircle, Calendar, DollarSign, MapPin, Building2, ExternalLink, X, FileText, Download, Briefcase, CheckCircle2, Clock, AlertTriangle, ShieldCheck, ArrowUpDown, RefreshCw, Layers } from 'lucide-react';
import { Licitacao } from './types';
import { cn } from './utils';

// Helper para headers de autenticação
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export function SearchPage({ onNavigateToGerenciadas }: { onNavigateToGerenciadas?: () => void }) {
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [totalDisponivel, setTotalDisponivel] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUf, setSelectedUf] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedFonte, setSelectedFonte] = useState<string>('');
  const [onlyActive, setOnlyActive] = useState(true);
  const [source, setSource] = useState<'pncp' | 'mock'>('mock');
  const [sortBy, setSortBy] = useState<'recente' | 'maior_valor' | 'menor_valor' | 'abertura_proxima'>('recente');
  
  // Regra de Validade Temporal: Não trazer editais com data de abertura inferior à data de busca
  const [ocultarEncerrados, setOcultarEncerrados] = useState(true);
  const [dataBuscaReferencia, setDataBuscaReferencia] = useState('2026-09-23');
  
  const [dataInicial, setDataInicial] = useState('2026-09-16');
  const [dataFinal, setDataFinal] = useState('2026-11-20');
  
  const [activeKeywords, setActiveKeywords] = useState<string[]>([
    'computador', 'notebook', 'desktop', 'servidor', 'storage', 'monitor', 'impressora', 'scanner', 
    'switch', 'roteador', 'firewall', 'access point', 'rack', 'cabeamento', 'fibra óptica', 'hardware', 
    'tablet', 'software', 'licença', 'nuvem', 'cloud', 'aws', 'azure', 'antivírus', 'endpoint', 'erp', 
    'crm', 'banco de dados', 'windows', 'linux', 'vmware', 'outsourcing', 'fábrica de software', 
    'desenvolvimento', 'suporte técnico', 'service desk', 'help desk', 'manutenção', 'consultoria em ti', 
    'segurança da informação', 'backup', 'datacenter', 'infraestrutura de ti', 'redes', 'pentest',
    'ti', 'tecnologia da informação', 'informática', 'tecnologia'
  ]);
  const [newKeyword, setNewKeyword] = useState('');
  
  const [selectedLicitacao, setSelectedLicitacao] = useState<Licitacao | null>(null);
  const [arquivos, setArquivos] = useState<any[]>([]);
  const [loadingArquivos, setLoadingArquivos] = useState(false);

  useEffect(() => {
    if (selectedLicitacao) {
      const cnpj = selectedLicitacao.orgaoEntidade?.cnpj || 
                   (selectedLicitacao.numeroControlePNCP ? selectedLicitacao.numeroControlePNCP.split('-')[0] : null) ||
                   '00000000000100';
      const ano = selectedLicitacao.anoCompra || 
                  (selectedLicitacao.numeroControlePNCP ? selectedLicitacao.numeroControlePNCP.split('/')[1] : null) ||
                  2026;
      const sequencial = selectedLicitacao.sequencialCompra || 
                         (selectedLicitacao.numeroControlePNCP ? parseInt(selectedLicitacao.numeroControlePNCP.split('-')[2] || '1', 10) : null) ||
                         (selectedLicitacao.id ? String(selectedLicitacao.id).replace(/\D/g, '') || 1 : 1);

      setLoadingArquivos(true);
      fetch(`/api/b2g-licitacoes/arquivos/${cnpj}/${ano}/${sequencial}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setArquivos(data);
          } else {
            setArquivos([]);
          }
        })
        .catch(err => {
          console.error('Error fetching files:', err);
          setArquivos([]);
        })
        .finally(() => setLoadingArquivos(false));
    } else {
      setArquivos([]);
    }
  }, [selectedLicitacao]);

  useEffect(() => {
    fetchLicitacoes();
  }, [ocultarEncerrados, dataBuscaReferencia, selectedUf]);

  const fetchLicitacoes = async () => {
    setLoading(true);
    try {
      const start = dataInicial.replace(/-/g, '');
      const end = dataFinal.replace(/-/g, '');
      const ufParam = selectedUf ? `&uf=${selectedUf}` : '';
      const cidadeParam = selectedCity ? `&cidade=${encodeURIComponent(selectedCity)}` : '';
      const termoParam = searchTerm ? `&termo=${encodeURIComponent(searchTerm)}` : '';
      const response = await fetch(`/api/b2g-licitacoes/buscar?dataInicial=${start}&dataFinal=${end}&ocultarEncerrados=${ocultarEncerrados}&dataReferencia=${dataBuscaReferencia}${ufParam}${cidadeParam}${termoParam}`, {
        headers: getAuthHeaders()
      });
      const json = await response.json();
      setSource(json.source);
      setLicitacoes(json.data || []);
      if (json.totalDisponivel) {
        setTotalDisponivel(json.totalDisponivel);
      }
    } catch (error) {
      console.error("Failed to fetch licitações:", error);
    } finally {
      setLoading(false);
    }
  };

  const getOrgaoName = (lic: Licitacao) => lic.orgao || lic.orgaoEntidade?.razaoSocial || 'Órgão não especificado';
  const getUf = (lic: Licitacao) => lic.uf || lic.unidadeOrgao?.ufSigla || 'BR';
  const getCidade = (lic: Licitacao) => lic.cidade || lic.unidadeOrgao?.municipioNome || '';
  const getObjeto = (lic: Licitacao) => lic.objeto_resumo || lic.objetoCompra || 'Sem descrição';
  const getData = (lic: Licitacao) => lic.data_abertura || lic.dataEncerramentoProposta || lic.dataHoraAberturaSessaoPublica || lic.dataAtualizacao || new Date().toISOString();
  const getValor = (lic: Licitacao) => lic.valor_estimado || lic.valorTotalEstimado || 0;
  const getSituacao = (lic: Licitacao) => lic.situacao || lic.situacaoCompraNome || 'Desconhecida';

  // Obter data de abertura real do edital (abertura da sessão, encerramento de propostas ou data de abertura)
  const getAberturaDate = (lic: Licitacao): Date | null => {
    const dtStr = lic.data_abertura || 
                  lic.dataEncerramentoProposta || 
                  lic.dataHoraAberturaSessaoPublica || 
                  lic.dataAberturaProposta;
    if (!dtStr) return null;
    const d = new Date(dtStr);
    return isNaN(d.getTime()) ? null : d;
  };

  // Regra solicitada: Se data_abertura < data_busca, o edital já aconteceu e não é válido
  const isAberturaValida = (lic: Licitacao) => {
    if (!ocultarEncerrados) return true;
    const abertura = getAberturaDate(lic);
    if (!abertura) return true; // se não há data declarada, não descarta precipitadamente

    const [ano, mes, dia] = dataBuscaReferencia.split('-').map(Number);
    const refDate = new Date(ano, mes - 1, dia, 0, 0, 0, 0);

    const hoje = new Date();
    const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    
    // Se a data de busca for hoje, exclui certames cuja abertura já ocorreu até o momento atual
    if (dataBuscaReferencia === hojeStr) {
      return abertura.getTime() >= Date.now();
    }
    // Caso contrário, exclui certames com abertura anterior ao início da data de busca
    return abertura.getTime() >= refDate.getTime();
  };

  const formatAbertura = (lic: Licitacao) => {
    const d = getAberturaDate(lic);
    if (!d) {
      if (lic.dataAtualizacao) {
        return `Atualizado em ${new Date(lic.dataAtualizacao).toLocaleDateString('pt-BR')}`;
      }
      return 'Data a definir';
    }
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getAberturaStatus = (lic: Licitacao) => {
    const d = getAberturaDate(lic);
    if (!d) return { label: 'Data pendente', type: 'neutral' };
    
    const now = Date.now();
    const diffMs = d.getTime() - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMs < 0) {
      return { label: 'Abertura expirada (Já aconteceu)', type: 'expired' };
    } else if (diffDays <= 0) {
      return { label: 'Abre hoje!', type: 'imminent' };
    } else if (diffDays === 1) {
      return { label: 'Abre amanhã', type: 'soon' };
    } else {
      return { label: `Abre em ${diffDays} dias`, type: 'upcoming' };
    }
  };

  const normalizeStr = (str: string) => str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';

  const isAtivo = (lic: Licitacao) => {
    const status = getSituacao(lic).toLowerCase();
    return !status.includes('revogada') && !status.includes('anulada') && !status.includes('encerrada') && !status.includes('suspensa');
  };
  
  const [filterByKeywords, setFilterByKeywords] = useState(false);

  // Total de editais descartados pela regra de abertura anterior à busca
  const totalExcluidosPassados = licitacoes.filter(lic => !isAberturaValida(lic)).length;

  const filteredLicitacoes = licitacoes.filter(lic => {
    const searchNormalized = normalizeStr(searchTerm);
    const cityNormalized = normalizeStr(selectedCity);
    
    const matchesSearch = searchNormalized === '' || 
                          normalizeStr(getObjeto(lic)).includes(searchNormalized) || 
                          normalizeStr(getOrgaoName(lic)).includes(searchNormalized);
    const matchesUf = selectedUf ? getUf(lic) === selectedUf : true;
    const matchesCity = cityNormalized === '' || normalizeStr(getCidade(lic)).includes(cityNormalized);
    const matchesActive = onlyActive ? isAtivo(lic) : true;
    const matchesTemporal = isAberturaValida(lic);

    const matchesFonte = !selectedFonte || (() => {
      const obj = normalizeStr(getObjeto(lic));
      const org = normalizeStr(getOrgaoName(lic));
      const mod = normalizeStr(lic.modalidade || '');
      if (selectedFonte === 'dispensas') return mod.includes('dispensa') || obj.includes('dispensa');
      if (selectedFonte === 'atas') return mod.includes('registro de preco') || obj.includes('ata') || obj.includes('srp');
      if (selectedFonte === 'tribunais') return org.includes('tribunal') || org.includes('tj') || org.includes('trf') || org.includes('trt') || org.includes('tce');
      if (selectedFonte === 'universidades') return org.includes('universidade') || org.includes('uf') || org.includes('ifpr') || org.includes('faculdade');
      if (selectedFonte === 'compraspr') return getUf(lic) === 'PR' || org.includes('parana') || org.includes('curitiba');
      return true;
    })();
    
    const matchesKeywords = !filterByKeywords || activeKeywords.length === 0 || activeKeywords.some(kw => {
        const kwNormalized = normalizeStr(kw);
        const obj = normalizeStr(getObjeto(lic));
        if (obj.includes(kwNormalized)) return true;
        if (lic.itens && Array.isArray(lic.itens) && lic.itens.some(it => normalizeStr(it.descricao).includes(kwNormalized))) {
          return true;
        }
        return false;
    });
    
    return matchesSearch && matchesUf && matchesCity && matchesActive && matchesTemporal && matchesFonte && matchesKeywords;
  });

  const sortedLicitacoes = [...filteredLicitacoes].sort((a, b) => {
    if (sortBy === 'maior_valor') {
      return getValor(b) - getValor(a);
    }
    if (sortBy === 'menor_valor') {
      return getValor(a) - getValor(b);
    }
    if (sortBy === 'abertura_proxima') {
      const da = getAberturaDate(a)?.getTime() || Infinity;
      const db = getAberturaDate(b)?.getTime() || Infinity;
      return da - db;
    }
    // 'recente' padrão: ordena pela data do certame
    const da = getAberturaDate(a)?.getTime() || new Date(getData(a)).getTime() || 0;
    const db = getAberturaDate(b)?.getTime() || new Date(getData(b)).getTime() || 0;
    return db - da;
  });

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newKeyword.trim() && !activeKeywords.includes(newKeyword.trim().toLowerCase())) {
      setActiveKeywords([newKeyword.trim().toLowerCase(), ...activeKeywords]);
      setNewKeyword('');
    }
  };

  const removeKeyword = (kwToRemove: string) => {
    setActiveKeywords(activeKeywords.filter(kw => kw !== kwToRemove));
  };

  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const [addingToManaged, setAddingToManaged] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);

  const handleAddToManaged = async () => {
    if (!selectedLicitacao) return;
    setAddingToManaged(true);
    setAddSuccess(false);
    try {
      const res = await fetch('/api/b2g-licitacoes/gerenciadas', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(selectedLicitacao)
      });
      if (res.ok || res.status === 409) { // 409 == already added
        setAddSuccess(true);
        setTimeout(() => {
          setAddSuccess(false);
          setSelectedLicitacao(null); // Close the modal
          if (onNavigateToGerenciadas) {
            onNavigateToGerenciadas();
          }
        }, 800);
      }
    } catch (err) {
      console.error('Error adding to managed:', err);
    } finally {
      setAddingToManaged(false);
    }
  };

  const handleRealDownload = (url: string, title: string) => {
    try {
      setDownloadingUrl(url);
      
      const safeTitle = title.toLowerCase().endsWith('.pdf') ? title : `${title}.pdf`;
      // Se já for uma URL do backend interno para documento gerado, baixa direto
      let downloadEndpoint = url;
      if (!url.startsWith('/api/b2g-licitacoes/documento-gerado/')) {
        downloadEndpoint = `/api/b2g-licitacoes/proxy-download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(safeTitle)}`;
      }
      
      // Cria link nativo de download para streaming direto do browser
      const a = document.createElement('a');
      a.href = downloadEndpoint;
      a.setAttribute('download', safeTitle);
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
        setDownloadingUrl(null);
      }, 1500);
    } catch (error) {
      console.error('Erro ao iniciar download:', error);
      window.open(url, '_blank');
      setDownloadingUrl(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#011116] transition-colors duration-200">
      <header className="px-8 pt-6 pb-4 bg-[#011419] border-b border-[#07323e]">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Buscar Editais</h1>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Multi-Fontes Integradas
          </span>
        </div>
        <p className="text-sm text-slate-300 mt-2 max-w-5xl leading-relaxed">
          Varredura unificada em tempo real: PNCP Oficial (Pregões, Dispensas, Concorrências), Compras.gov.br (SIASG), Compras Paraná, BEC-SP, Portal de Compras Públicas e DOU.
        </p>
      </header>

      <div className="p-8 flex-1 overflow-y-auto">
        {/* FONTES GOVERNAMENTAIS MONITORADAS */}
        <div className="bg-[#021820]/90 border border-[#083d4c] rounded-2xl p-4 mb-6 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-black uppercase tracking-wider text-white">
              FONTES GOVERNAMENTAIS MONITORADAS
            </span>
            <span className="text-xs text-slate-400">
              (Clique para filtrar ou priorizar)
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'pncp', label: 'PNCP', icon: '🏛️', bg: 'bg-sky-950/80 border-sky-700/70 text-sky-200 hover:border-sky-400' },
              { id: 'comprasgov', label: 'Compras.gov', icon: '🇧🇷', bg: 'bg-emerald-950/80 border-emerald-700/70 text-emerald-200 hover:border-emerald-400' },
              { id: 'dispensas', label: 'Dispensas', icon: '📄', bg: 'bg-purple-950/80 border-purple-700/70 text-purple-200 hover:border-purple-400' },
              { id: 'compraspr', label: 'Compras Paraná', icon: '🏢', bg: 'bg-cyan-950/80 border-cyan-700/70 text-cyan-200 hover:border-cyan-400' },
              { id: 'tribunais', label: 'Tribunais', icon: '⚖️', bg: 'bg-indigo-950/80 border-indigo-700/70 text-indigo-200 hover:border-indigo-400' },
              { id: 'universidades', label: 'Universidades', icon: '🎓', bg: 'bg-teal-950/80 border-teal-700/70 text-teal-200 hover:border-teal-400' },
              { id: 'atas', label: 'Atas SRP', icon: '📋', bg: 'bg-blue-950/80 border-blue-700/70 text-blue-200 hover:border-blue-400' },
              { id: 'dou', label: 'DOU', icon: '📰', bg: 'bg-slate-800/90 border-slate-600 text-slate-200 hover:border-slate-400' }
            ].map(f => {
              const isSelected = selectedFonte === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setSelectedFonte(isSelected ? '' : f.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
                    f.bg,
                    isSelected ? "ring-2 ring-cyan-400 brightness-125" : "opacity-90 hover:opacity-100"
                  )}
                >
                  <span>{f.icon}</span>
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400 dark:text-slate-500" />
              </div>
              <input
                type="text"
                placeholder="Buscar palavra-chave nos resultados..."
                className="block w-full pl-10 pr-3 py-3 border border-[#07323e] rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent bg-[#011419] shadow-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchLicitacoes(); }}
              />
            </div>
            
            <input
              type="text"
              placeholder="Cidade (ex: Curitiba)..."
              className="border border-[#07323e] rounded-lg px-4 py-3 bg-[#011419] text-slate-900 dark:text-slate-100 shadow-sm focus:ring-2 focus:ring-cyan-500 outline-none w-48 placeholder-slate-400 dark:placeholder-slate-500"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
            />

            <select 
              className="border border-[#07323e] rounded-lg px-4 py-3 bg-[#011419] text-slate-700 dark:text-slate-200 shadow-sm focus:ring-2 focus:ring-cyan-500 outline-none w-48"
              value={selectedUf}
              onChange={(e) => setSelectedUf(e.target.value)}
            >
              <option value="">Todos os Estados</option>
              <option value="AC">Acre (AC)</option>
              <option value="AL">Alagoas (AL)</option>
              <option value="AP">Amapá (AP)</option>
              <option value="AM">Amazonas (AM)</option>
              <option value="BA">Bahia (BA)</option>
              <option value="CE">Ceará (CE)</option>
              <option value="DF">Distrito Federal (DF)</option>
              <option value="ES">Espírito Santo (ES)</option>
              <option value="GO">Goiás (GO)</option>
              <option value="MA">Maranhão (MA)</option>
              <option value="MT">Mato Grosso (MT)</option>
              <option value="MS">Mato Grosso do Sul (MS)</option>
              <option value="MG">Minas Gerais (MG)</option>
              <option value="PA">Pará (PA)</option>
              <option value="PB">Paraíba (PB)</option>
              <option value="PR">Paraná (PR)</option>
              <option value="PE">Pernambuco (PE)</option>
              <option value="PI">Piauí (PI)</option>
              <option value="RJ">Rio de Janeiro (RJ)</option>
              <option value="RN">Rio Grande do Norte (RN)</option>
              <option value="RS">Rio Grande do Sul (RS)</option>
              <option value="RO">Rondônia (RO)</option>
              <option value="RR">Roraima (RR)</option>
              <option value="SC">Santa Catarina (SC)</option>
              <option value="SP">São Paulo (SP)</option>
              <option value="SE">Sergipe (SE)</option>
              <option value="TO">Tocantins (TO)</option>
            </select>
          </div>
          
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Publicado de:</span>
              <input
                type="date"
                className="border border-[#07323e] rounded-lg px-3 py-2 bg-[#011419] text-slate-700 dark:text-slate-200 shadow-sm focus:ring-2 focus:ring-cyan-500 outline-none text-sm"
                value={dataInicial}
                onChange={(e) => setDataInicial(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Até:</span>
              <input
                type="date"
                className="border border-[#07323e] rounded-lg px-3 py-2 bg-[#011419] text-slate-700 dark:text-slate-200 shadow-sm focus:ring-2 focus:ring-cyan-500 outline-none text-sm"
                value={dataFinal}
                onChange={(e) => setDataFinal(e.target.value)}
              />
            </div>
            <button
              onClick={fetchLicitacoes}
              disabled={loading}
              className="px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white text-sm font-medium rounded-lg transition-all shadow-sm shadow-[#00171d] disabled:opacity-50 cursor-pointer"
            >
              Buscar na Nuvem
            </button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-2"></div>
            
            <label className="flex items-center cursor-pointer">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only"
                  checked={onlyActive}
                  onChange={(e) => setOnlyActive(e.target.checked)}
                />
                <div className={cn("block w-10 h-6 rounded-full transition-colors", onlyActive ? "bg-cyan-600 dark:bg-cyan-500" : "bg-slate-300 dark:bg-slate-700")}></div>
                <div className={cn("dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform", onlyActive ? "transform translate-x-4" : "")}></div>
              </div>
              <span className="ml-3 text-sm font-medium text-slate-200">Apenas situação ativa</span>
            </label>
          </div>

          {/* Painel da Regra de Validade Temporal (Filtro por Data de Abertura) */}
          <div className="bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={cn(
                "p-1.5 rounded-lg",
                ocultarEncerrados ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400" : "bg-slate-200 dark:bg-slate-800 text-slate-400"
              )}>
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Regra de Validade Temporal:
                  </span>
                  <span className={cn(
                    "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                    ocultarEncerrados ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" : "bg-slate-200 dark:bg-slate-800 text-slate-300"
                  )}>
                    {ocultarEncerrados ? "Ativa (Ocultando Editais Já Acontecidos)" : "Desativada (Mostrando Todos)"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Não traz editais com data de abertura/lances inferior à data da busca ({new Date(`${dataBuscaReferencia}T00:00:00`).toLocaleDateString('pt-BR')}).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end md:self-auto">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 font-medium">Data de Busca:</span>
                <input
                  type="date"
                  value={dataBuscaReferencia}
                  onChange={(e) => setDataBuscaReferencia(e.target.value)}
                  className="border border-[#07323e] bg-[#011419] rounded-md px-2 py-1 text-xs text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-blue-600 outline-none shadow-sm"
                  title="Data de referência da busca para verificar se o certame já aconteceu"
                />
              </div>

              <label className="flex items-center cursor-pointer select-none">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    className="sr-only"
                    checked={ocultarEncerrados}
                    onChange={(e) => setOcultarEncerrados(e.target.checked)}
                  />
                  <div className={cn("block w-9 h-5 rounded-full transition-colors", ocultarEncerrados ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700")}></div>
                  <div className={cn("dot absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform", ocultarEncerrados ? "transform translate-x-4" : "")}></div>
                </div>
                <span className="ml-2 text-xs font-semibold text-slate-200">
                  {ocultarEncerrados ? "Ocultar Encerrados" : "Permitir Passados"}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Tags de TI - Filtro */}
        <div className="bg-[#011419] p-5 rounded-xl border border-[#07323e] shadow-sm mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Filtro Automático de Produtos de TI
            </h3>
            <label className="flex items-center cursor-pointer">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only"
                  checked={filterByKeywords}
                  onChange={(e) => setFilterByKeywords(e.target.checked)}
                />
                <div className={cn("block w-8 h-5 rounded-full transition-colors", filterByKeywords ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700")}></div>
                <div className={cn("dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform", filterByKeywords ? "transform translate-x-3" : "")}></div>
              </div>
              <span className="ml-2 text-xs font-medium text-slate-200">{filterByKeywords ? "Ativo" : "Desativado"}</span>
            </label>
          </div>

          <form onSubmit={handleAddKeyword} className="flex gap-2 mb-4">
            <input 
              type="text" 
              placeholder="Adicionar produto específico..." 
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              className="flex-1 px-3 py-1.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              type="submit" 
              disabled={!newKeyword.trim()}
              className="px-3 py-1.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 cursor-pointer shadow-sm shadow-[#00171d]"
            >
              Adicionar Tag
            </button>
          </form>

          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-lg">
            {activeKeywords.map(kw => (
              <span key={kw} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full border border-blue-200 dark:border-blue-800">
                {kw}
                <button 
                  onClick={() => removeKeyword(kw)}
                  className="p-0.5 hover:bg-blue-200 dark:hover:bg-blue-900/60 rounded-full transition-colors focus:outline-none cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Alerta de Editais Ocultados pela Regra de Validade */}
        {ocultarEncerrados && totalExcluidosPassados > 0 && (
          <div className="mb-4 bg-amber-50/90 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/80 rounded-xl p-3.5 flex items-center justify-between gap-3 text-amber-900 dark:text-amber-200 shadow-sm">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <p className="text-xs">
                <strong>{totalExcluidosPassados} edital(is) com abertura anterior a {new Date(`${dataBuscaReferencia}T00:00:00`).toLocaleDateString('pt-BR')}</strong> foram omitidos desta busca por já terem ocorrido.
              </p>
            </div>
            <button
              onClick={() => setOcultarEncerrados(false)}
              className="text-xs text-amber-800 dark:text-amber-300 font-semibold underline hover:text-amber-950 dark:hover:text-amber-100 whitespace-nowrap cursor-pointer"
            >
              Exibir editais passados
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-pulse flex flex-col items-center gap-4">
              <div className="h-8 w-8 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-cyan-500 animate-spin"></div>
              <p className="text-slate-400 text-sm">Buscando na base de dados...</p>
            </div>
          </div>
        ) : filteredLicitacoes.length === 0 ? (
          <div className="text-center py-20 bg-[#011419] rounded-xl border border-[#07323e] border-dashed">
            <AlertCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">Nenhum edital encontrado</h3>
            <p className="text-slate-400 mt-1">
              {ocultarEncerrados && totalExcluidosPassados > 0
                ? `${totalExcluidosPassados} editais encontrados nesta busca já aconteceram e foram ocultados pela Regra de Validade Temporal.`
                : "Tente ajustar seus termos de busca ou filtros."}
            </p>
            {ocultarEncerrados && totalExcluidosPassados > 0 && (
              <button
                onClick={() => setOcultarEncerrados(false)}
                className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" /> Desativar filtro e ver editais passados
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Barra de Status e Ordenação dos Resultados */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#011419] px-5 py-3.5 rounded-xl border border-[#07323e] shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {sortedLicitacoes.length} {sortedLicitacoes.length === 1 ? 'edital encontrado' : 'editais encontrados'}
                  </span>
                </div>
                {totalDisponivel > 0 && (
                  <span className="text-xs text-slate-400 hidden md:inline border-l border-[#07323e] pl-3">
                    Base com {totalDisponivel} certames catalogados
                  </span>
                )}
                {filterByKeywords && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    Filtro TI Ativo ({activeKeywords.length} tags)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-medium text-slate-400">Ordenar por:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-blue-600 outline-none cursor-pointer"
                >
                  <option value="recente">Mais Recentes</option>
                  <option value="abertura_proxima">Abertura Mais Próxima</option>
                  <option value="maior_valor">Maior Valor Estimado</option>
                  <option value="menor_valor">Menor Valor Estimado</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4">
              {sortedLicitacoes.map((lic, i) => {
                const aberturaStatus = getAberturaStatus(lic);
                return (
                  <div key={lic.numeroControlePNCP || lic.id || `lic-${i}`} className="bg-[#011419] rounded-xl border border-[#07323e] p-6 shadow-sm hover:shadow-md transition-shadow group">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={cn(
                          "text-xs font-semibold px-2.5 py-1 rounded-md uppercase tracking-wider",
                          isAtivo(lic) ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800" : "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-800"
                        )}>
                          {getSituacao(lic)}
                        </span>
                        
                        {/* Status de Abertura / Validade Temporal */}
                        <span className={cn(
                          "text-xs font-semibold px-2.5 py-1 rounded-md tracking-wider flex items-center gap-1",
                          aberturaStatus.type === 'imminent' ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800" :
                          aberturaStatus.type === 'soon' ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800" :
                          aberturaStatus.type === 'upcoming' ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" :
                          aberturaStatus.type === 'expired' ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800" :
                          "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        )}>
                          <Clock className="w-3 h-3" />
                          {aberturaStatus.label}
                        </span>

                        <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800 text-xs font-semibold px-2.5 py-1 rounded-md uppercase tracking-wider">
                          {lic.modalidade || lic.modalidadeNome || 'Licitação'}
                        </span>
                        <span className="flex items-center text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                          <MapPin className="w-3 h-3 mr-1" />
                          {getCidade(lic) ? `${getCidade(lic)} - ${getUf(lic)}` : getUf(lic)}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight">
                        {getObjeto(lic)}
                      </h3>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="text-sm font-medium text-slate-400 mb-1">Valor Estimado</p>
                      <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getValor(lic))}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 text-sm text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-4 mt-2 flex-wrap">
                    <div className="flex items-center">
                      <Building2 className="w-4 h-4 mr-2 text-slate-400 flex-shrink-0" />
                      <span className="truncate max-w-[280px]">{getOrgaoName(lic)}</span>
                    </div>

                    <div className="flex items-center text-slate-200">
                      <Calendar className="w-4 h-4 mr-1.5 text-cyan-600 dark:text-cyan-400 flex-shrink-0" />
                      <span className="text-xs text-slate-400 mr-1">Abertura:</span>
                      <strong className="text-xs text-slate-800 dark:text-slate-100">{formatAbertura(lic)}</strong>
                    </div>
                    
                    <button 
                      onClick={() => setSelectedLicitacao(lic)}
                      className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/70 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/80 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 font-semibold text-xs sm:text-sm transition-all shadow-xs cursor-pointer"
                    >
                      <span>Detalhes e Anexos</span>
                      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Detalhes e Anexos */}
      {selectedLicitacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" onClick={() => setSelectedLicitacao(null)}>
          <div 
            className="bg-[#011419] rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-[#07323e]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-[#011116]/60">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={cn(
                    "text-xs font-semibold px-2.5 py-1 rounded-md uppercase tracking-wider",
                    isAtivo(selectedLicitacao) ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300" : "bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300"
                  )}>
                    {getSituacao(selectedLicitacao)}
                  </span>
                  
                  {/* Status Temporal no Modal */}
                  {(() => {
                    const status = getAberturaStatus(selectedLicitacao);
                    return (
                      <span className={cn(
                        "text-xs font-semibold px-2.5 py-1 rounded-md flex items-center gap-1",
                        status.type === 'expired' ? "bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300" : "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300"
                      )}>
                        <Clock className="w-3 h-3" />
                        {status.label}
                      </span>
                    );
                  })()}

                  <span className="text-sm text-slate-400 font-medium">{selectedLicitacao.numeroControlePNCP || 'Sem código PNCP'}</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-2">Detalhes do Edital</h2>
              </div>
              <button 
                onClick={() => setSelectedLicitacao(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2">Objeto</h3>
                <p className="text-slate-200 leading-relaxed">{getObjeto(selectedLicitacao)}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-3">Informações Gerais</h3>
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs text-slate-400 block mb-1">Órgão</span>
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{getOrgaoName(selectedLicitacao)}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block mb-1">Modalidade</span>
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{selectedLicitacao.modalidade || selectedLicitacao.modalidadeNome || 'Não informada'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block mb-1">Localidade</span>
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center">
                        <MapPin className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        {getCidade(selectedLicitacao) ? `${getCidade(selectedLicitacao)} - ${getUf(selectedLicitacao)}` : getUf(selectedLicitacao)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-3">Valores e Datas</h3>
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs text-slate-400 block mb-1">Valor Estimado</span>
                      <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getValor(selectedLicitacao))}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block mb-1">Data e Hora de Abertura / Sessão Pública</span>
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1.5 text-blue-600 dark:text-blue-400" />
                        {formatAbertura(selectedLicitacao)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block mb-1">Data de Atualização / Divulgação</span>
                      <span className="text-sm font-medium text-slate-200 flex items-center">
                        <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        {new Date(getData(selectedLicitacao)).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    {(selectedLicitacao.linkSistemaOrigem || selectedLicitacao.linkProcessoEletronico) && (
                      <div>
                        <span className="text-xs text-slate-400 block mb-1">Sistema de Origem</span>
                        <a 
                          href={selectedLicitacao.linkSistemaOrigem || selectedLicitacao.linkProcessoEletronico} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                        >
                          Acessar Processo Eletrônico <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center">
                    <FileText className="w-4 h-4 mr-2" /> Documentos e Anexos Oficiais
                  </h3>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Download Acelerado & Verificado
                  </span>
                </div>
                
                {loadingArquivos ? (
                  <div className="flex flex-col justify-center items-center py-8 bg-slate-50 dark:bg-slate-800/40 border border-[#07323e] rounded-xl">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                    <p className="text-xs text-slate-400">Consultando documentos oficiais no PNCP...</p>
                  </div>
                ) : arquivos.length > 0 ? (
                  <div className="border border-[#07323e] rounded-xl overflow-hidden shadow-sm">
                    {arquivos.map((arq, idx) => {
                      const fileUrl = arq.url || arq.uri;
                      const isDownloadingThis = downloadingUrl === fileUrl;
                      return (
                        <div key={idx} className="flex items-center justify-between p-4 bg-[#011419] border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <div className="flex items-center min-w-0 pr-4">
                            <div className="bg-red-50 dark:bg-red-950/50 p-2.5 rounded-lg mr-4 border border-red-100 dark:border-red-900/60 flex-shrink-0">
                              <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate" title={arq.titulo}>{arq.titulo}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-slate-400 font-medium">{arq.tipoDocumentoNome || 'Documento Oficial'}</span>
                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                <span className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded font-mono border border-emerald-200 dark:border-emerald-800">Fonte Oficial PNCP</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {fileUrl && (
                              <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                                title="Abrir link direto do servidor governamental"
                              >
                                <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir
                              </a>
                            )}
                            <button 
                              onClick={() => handleRealDownload(fileUrl, arq.titulo)}
                              disabled={isDownloadingThis}
                              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 rounded-lg transition-all shadow-sm shadow-[#00171d] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              {isDownloadingThis ? (
                                <>
                                  <div className="w-4 h-4 mr-2 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                                  Iniciando...
                                </>
                              ) : (
                                <>
                                  <Download className="w-4 h-4 mr-2" /> Baixar
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="border border-[#07323e] rounded-xl p-6 bg-slate-50 dark:bg-slate-800/40 text-center">
                    <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-white">
                      Nenhum anexo em PDF foi listado diretamente na API pública para esta contratação.
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      Você pode consultar e baixar o edital completo e termos de referência diretamente no portal oficial do PNCP ou no sistema eletrônico do órgão.
                    </p>
                    {(selectedLicitacao.linkSistemaOrigem || selectedLicitacao.linkProcessoEletronico || (selectedLicitacao.orgaoEntidade?.cnpj && selectedLicitacao.anoCompra && selectedLicitacao.sequencialCompra)) && (
                      <a 
                        href={
                          selectedLicitacao.linkSistemaOrigem || 
                          selectedLicitacao.linkProcessoEletronico || 
                          `https://pncp.gov.br/app/editais/${selectedLicitacao.orgaoEntidade?.cnpj}/${selectedLicitacao.anoCompra}/${selectedLicitacao.sequencialCompra}`
                        }
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center mt-4 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 rounded-lg shadow-sm shadow-[#00171d] transition-all cursor-pointer"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" /> Acessar Edital Oficial no PNCP
                      </a>
                    )}
                  </div>
                )}
                
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 px-3 py-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Proteção ativa: Validação de integridade binária e cache instantâneo para evitar arquivos corrompidos.
                  </span>
                  {(selectedLicitacao.linkSistemaOrigem || selectedLicitacao.linkProcessoEletronico || (selectedLicitacao.orgaoEntidade?.cnpj && selectedLicitacao.anoCompra && selectedLicitacao.sequencialCompra)) && (
                    <a
                      href={
                        selectedLicitacao.linkSistemaOrigem || 
                        selectedLicitacao.linkProcessoEletronico || 
                        `https://pncp.gov.br/app/editais/${selectedLicitacao.orgaoEntidade?.cnpj}/${selectedLicitacao.anoCompra}/${selectedLicitacao.sequencialCompra}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-medium ml-2"
                    >
                      Página da Licitação no PNCP <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-[#011419] flex justify-between items-center">
              <div>
                <button
                  onClick={handleAddToManaged}
                  disabled={addingToManaged || addSuccess}
                  className={cn(
                    "px-6 py-2.5 font-medium rounded-lg transition-all shadow-sm flex items-center gap-2 cursor-pointer",
                    addSuccess 
                      ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" 
                      : "bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white shadow-[#00171d]"
                  )}
                >
                  {addingToManaged ? (
                    <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                  ) : addSuccess ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Briefcase className="w-5 h-5" />
                  )}
                  {addSuccess ? 'Adicionada às Gerenciadas' : 'Adicionar às Gerenciadas'}
                </button>
              </div>
              <button 
                onClick={() => setSelectedLicitacao(null)}
                className="px-6 py-2.5 bg-slate-900 dark:bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors shadow-sm cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
