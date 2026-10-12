import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, AlertCircle, Calendar, DollarSign, MapPin, Building2, ExternalLink, X, FileText, Download, Briefcase, CheckCircle2, Clock, AlertTriangle, ShieldCheck, ArrowUpDown, RefreshCw, Layers, Settings } from 'lucide-react';
import { Licitacao } from './types';
import { cn } from './utils';
import { LicitacaoDetalhesModal } from './LicitacaoDetalhesModal';
import { ACTIVE_SOURCES_KEY, ACTIVE_SOURCES_EVENT, SOURCES_CATALOG } from './PipelineMonitor';

const ALL_SOURCE_IDS = SOURCES_CATALOG.map(s => s.id);

// Helper para headers de autenticação
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

// Lê as fontes ativas do localStorage (gerenciado pelo PipelineMonitor)
const readFontesAtivas = (): Set<string> => {
  try {
    const saved = localStorage.getItem(ACTIVE_SOURCES_KEY);
    if (saved) {
      const arr = JSON.parse(saved);
      return new Set(Array.isArray(arr) ? arr : ALL_SOURCE_IDS);
    }
  } catch (_) {}
  return new Set(ALL_SOURCE_IDS);
};

export function SearchPage({ onNavigateToGerenciadas, onNavigateToPipeline }: { onNavigateToGerenciadas?: () => void; onNavigateToPipeline?: () => void }) {
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [totalDisponivel, setTotalDisponivel] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const searchController = useRef<AbortController | null>(null);
  const getTodayISO = () => new Date().toISOString().split('T')[0];
  const getPastDaysISO = (days: number) => new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUf, setSelectedUf] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  // Fontes ativas — lidas do localStorage gerenciado pelo PipelineMonitor (Configurações)
  const [fontesAtivas, setFontesAtivas] = useState<Set<string>>(readFontesAtivas);
  const [onlyActive, setOnlyActive] = useState(true);
  const [statusFontes, setStatusFontes] = useState<any[]>([]);
  const [searchErrors, setSearchErrors] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'recente' | 'maior_valor' | 'menor_valor' | 'abertura_proxima'>('recente');
  
  // Regra de Validade Temporal: Não trazer editais com prazo expirado
  const [ocultarEncerrados, setOcultarEncerrados] = useState(true);
  const [dataBuscaReferencia, setDataBuscaReferencia] = useState(getTodayISO);
  
  // Janela recente padrão (últimos 7 dias) para garantir certames ativos com propostas abertas
  const [dataInicial, setDataInicial] = useState(() => getPastDaysISO(7));
  const [dataFinal, setDataFinal] = useState(getTodayISO);
  
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
  const [managedIds, setManagedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const getLicId = (lic: Licitacao | null | undefined): string => {
    if (!lic) return '';
    return String(lic.numeroControlePNCP || (lic as any).numero_controle_pncp || lic.id || '').trim();
  };

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(prev => (prev?.text === text ? null : prev));
    }, 4500);
  };

  // Sincroniza fontes ativas quando o localStorage muda (ex: usuário volta de Configurações)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVE_SOURCES_KEY) {
        setFontesAtivas(readFontesAtivas());
      }
    };
    const refreshSources = () => setFontesAtivas(readFontesAtivas());
    window.addEventListener('storage', onStorage);
    window.addEventListener(ACTIVE_SOURCES_EVENT, refreshSources);
    // Re-lê ao montar (caso tenha mudado enquanto estava em outra tela)
    setFontesAtivas(readFontesAtivas());
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(ACTIVE_SOURCES_EVENT, refreshSources);
      searchController.current?.abort();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchManagedIds = async () => {
      try {
        const res = await fetch(`/api/b2g-licitacoes/gerenciadas?t=${Date.now()}`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && active) {
            const ids = new Set<string>();
            data.forEach((item: any) => {
              const k1 = item.numeroControlePNCP;
              const k2 = item.numero_controle_pncp;
              const k3 = item.id;
              const k4 = item._managedId;
              if (k1) ids.add(String(k1).trim());
              if (k2) ids.add(String(k2).trim());
              if (k3) ids.add(String(k3).trim());
              if (k4) ids.add(String(k4).trim());
            });
            setManagedIds(ids);
          }
        }
      } catch (e) {
        console.warn('Erro ao pré-carregar IDs de gerenciadas:', e);
      }
    };
    fetchManagedIds();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    fetchLicitacoes();
    // fontesAtivas é serializado em string para comparação estável no useEffect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocultarEncerrados, dataBuscaReferencia, selectedUf, Array.from(fontesAtivas).sort().join(',')]);

  const fetchLicitacoes = async () => {
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    setLoading(true);
    setSearchErrors([]);
    setStatusFontes([]);
    try {
      // Se nenhuma fonte está ativa, retorna vazio imediatamente sem bater no backend
      if (fontesAtivas.size === 0) {
        setLicitacoes([]);
        setTotalDisponivel(0);
        setStatusFontes([]);
        setLoading(false);
        return;
      }

      const fontesParam = Array.from(fontesAtivas).join(',');
      // Janela de busca: publicados nos últimos 30 dias — garante capturar editais
      // com prazo de propostas ainda vigente (mínimo legal de 8 dias após publicação)
      const dataInicioEfetivo = dataInicial || getPastDaysISO(30);
      const params = new URLSearchParams({
        objeto: searchTerm,
        uf: selectedUf,
        cidade: selectedCity,
        fontes: fontesParam,
        pagina: '1',
        tamanhoPagina: '40',
        ordem: sortBy === 'recente' ? 'data_desc' : sortBy === 'maior_valor' ? 'valor_desc' : sortBy === 'menor_valor' ? 'valor_asc' : 'abertura_asc',
        apenasVigentes: ocultarEncerrados ? 'true' : 'false',
        dataInicio: dataInicioEfetivo,
        dataFim: dataFinal || getTodayISO(),
      });

      const response = await fetch(`/api/b2g-search/search?${params.toString()}`, {
        signal: controller.signal,
        headers: getAuthHeaders()
      });
      const json = await response.json();
      if (controller.signal.aborted) return;

      // Se o backend informou que não há fontes ativas, respeita
      if (json.info) {
        setLicitacoes([]);
        setTotalDisponivel(0);
        return;
      }

      if (!response.ok) throw new Error(json.error || 'Erro ao consultar as fontes.');
      setStatusFontes(json.statusFontes || []);
      setSearchErrors(json.erros || []);
      setLicitacoes(json.data || []);
      setTotalDisponivel(json.total || (json.data?.length ?? 0));
    } catch (error) {
      if (controller.signal.aborted) return;
      setLicitacoes([]);
      setTotalDisponivel(0);
      console.error("Failed to fetch licitações:", error);
      setSearchErrors([error instanceof Error ? error.message : 'Falha na consulta às fontes.']);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const getOrgaoName = (lic: Licitacao) => lic.orgao || (lic as any).orgao || lic.orgaoEntidade?.razaoSocial || 'Órgão não especificado';
  const getUf = (lic: Licitacao) => lic.uf || lic.unidadeOrgao?.ufSigla || 'BR';
  const getCidade = (lic: Licitacao) => lic.cidade || (lic as any).municipio || lic.unidadeOrgao?.municipioNome || '';
  const getObjeto = (lic: Licitacao) => (lic as any).titulo || lic.objeto_resumo || lic.objetoCompra || 'Sem descrição';
  const getData = (lic: Licitacao) => (lic as any).dataPublicacao || lic.dataAtualizacao || lic.data_abertura || (lic as any).dataEncerramento || lic.dataEncerramentoProposta || lic.dataHoraAberturaSessaoPublica || lic.dataAtualizacao || new Date().toISOString();
  const getValor = (lic: Licitacao) => (lic as any).valor || lic.valor_estimado || lic.valorTotalEstimado || 0;
  const getSituacao = (lic: Licitacao) => lic.situacao || (lic as any).status || lic.situacaoCompraNome || 'Desconhecida';

  // Obter prazo limite para envio de propostas ou início da sessão pública
  const getPrazoLimiteDate = (lic: Licitacao): Date | null => {
    const dtStr = lic.dataEncerramentoProposta || 
                  (lic as any).dataEncerramento ||       // formato do /search
                  (lic as any).data_encerramento || 
                  lic.dataHoraAberturaSessaoPublica;
    if (dtStr) {
      const d = new Date(dtStr);
      if (!isNaN(d.getTime())) return d;
    }
    // Fallback se não há data de encerramento explícita: verificar dataHoraAberturaSessaoPublica ou data_abertura
    const dtFall = lic.dataHoraAberturaSessaoPublica || lic.data_abertura || lic.dataAberturaProposta;
    if (dtFall) {
      const d = new Date(dtFall);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  const getInicioPropostaDate = (lic: Licitacao): Date | null => {
    const dtStr = lic.dataAberturaProposta || lic.data_abertura;
    if (!dtStr) return null;
    const d = new Date(dtStr);
    return isNaN(d.getTime()) ? null : d;
  };

  // Regra de Validade Temporal: Somente considerar editais válidos que ainda NÃO expiraram
  const isAberturaValida = (lic: Licitacao) => {
    if (!ocultarEncerrados) return true;

    // 1. Status explicitamente finalizado/cancelado
    const status = String(lic.situacao || lic.situacaoCompraNome || '').toLowerCase();
    if (/(encerrad|cancelad|revogad|suspens|anulad|fracassad|desert|homologad|adjudicad|concluid)/i.test(status)) {
      return false;
    }

    const now = Date.now();
    const [ano, mes, dia] = dataBuscaReferencia.split('-').map(Number);
    const refDate = new Date(ano, mes - 1, dia, 0, 0, 0, 0);
    const targetThreshold = (dataBuscaReferencia === getTodayISO()) ? now : refDate.getTime();

    // 2. Prazo limite de envio de propostas
    const limite = getPrazoLimiteDate(lic);
    if (limite && !isNaN(limite.getTime())) {
      return limite.getTime() >= targetThreshold;
    }

    // 3. Se não tem prazo de encerramento explícito, verifica se o certame tem abertura futura
    const inicio = getInicioPropostaDate(lic);
    if (inicio && !isNaN(inicio.getTime())) {
      return inicio.getTime() >= targetThreshold;
    }

    // 4. Sem nenhuma data verificável — aceita se veio do backend com apenasVigentes=true
    // (fontes como DOU não têm dataEncerramento mas já foram pré-filtradas pelo backend)
    return ocultarEncerrados ? true : false;
  };

  const formatAbertura = (lic: Licitacao) => {
    const d = getPrazoLimiteDate(lic);
    if (!d) {
      const inicio = getInicioPropostaDate(lic);
      if (inicio) {
        return `Início: ${inicio.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
      }
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
    const d = getPrazoLimiteDate(lic);
    if (!d) return { label: 'Prazo a confirmar', type: 'neutral' };
    
    const now = Date.now();
    const diffMs = d.getTime() - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMs < 0) {
      return { label: 'Prazo expirado', type: 'expired' };
    } else if (diffHours <= 12) {
      return { label: 'Encerra hoje!', type: 'imminent' };
    } else if (diffDays === 1) {
      return { label: 'Encerra amanhã', type: 'soon' };
    } else {
      return { label: `Encerra em ${diffDays} dias`, type: 'upcoming' };
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

    const matchesFonte = true; // filtro de fontes agora é feito no backend via fontesAtivas
    
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
      const da = getPrazoLimiteDate(a)?.getTime() || Infinity;
      const db = getPrazoLimiteDate(b)?.getTime() || Infinity;
      return da - db;
    }
    // 'recente' padrão: ordena pela data mais recente do certame
    const da = getPrazoLimiteDate(a)?.getTime() || new Date(getData(a)).getTime() || 0;
    const db = getPrazoLimiteDate(b)?.getTime() || new Date(getData(b)).getTime() || 0;
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

  const [addingToManaged, setAddingToManaged] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);

  const handleAddToManaged = async (targetLic?: Licitacao) => {
    const lic = targetLic || selectedLicitacao;
    if (!lic) return;
    const licId = getLicId(lic);

    if (licId && managedIds.has(licId)) {
      showToast('Esta licitação já está em suas Licitações Gerenciadas.', 'info');
      return;
    }

    setAddingToManaged(true);
    if (licId) setAddingId(licId);
    setAddSuccess(false);

    try {
      const res = await fetch('/api/b2g-licitacoes/gerenciadas', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(lic)
      });
      if (res.ok || res.status === 409) {
        if (licId) {
          setManagedIds(prev => new Set([...prev, licId]));
        }
        setAddSuccess(true);
        showToast(
          res.status === 409 
            ? 'Esta licitação já está em Licitações Gerenciadas.' 
            : '✓ Licitação adicionada às Gerenciadas com sucesso!', 
          'success'
        );
        // Permanece na tela de busca! Não redireciona e não sai da tela.
      } else {
        const err = await res.json().catch(() => null);
        showToast(err?.error || 'Erro ao adicionar licitação às gerenciadas.', 'error');
      }
    } catch (err) {
      console.error('Error adding to managed:', err);
      showToast('Erro de comunicação ao salvar licitação.', 'error');
    } finally {
      setAddingToManaged(false);
      setAddingId(null);
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
          Busca nas fontes ativas de PNCP, Compras.gov.br, SIASG, DOU, atas, contratações diretas e portais de transparência.
        </p>
      </header>

      <div className="p-8 flex-1 overflow-y-auto">
        {/* FONTES ATIVAS — resumo + link para configurações */}
        <div className="bg-[#021820]/90 border border-[#083d4c] rounded-2xl px-4 py-3 mb-6 shadow-lg flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-black uppercase tracking-wider text-white">
                Fontes Ativas:
              </span>
            </div>
            {fontesAtivas.size === 0 ? (
              <span className="text-xs text-amber-400 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Nenhuma fonte selecionada — sem resultados
              </span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {SOURCES_CATALOG.filter(s => fontesAtivas.has(s.id)).map(s => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#011d26] border border-[#07323e] text-slate-300"
                  >
                    <span>{s.icon}</span>
                    <span>{s.shortName}</span>
                  </span>
                ))}
                {fontesAtivas.size < SOURCES_CATALOG.length && (
                  <span className="text-[11px] text-slate-500 self-center ml-1">
                    ({SOURCES_CATALOG.length - fontesAtivas.size} desativadas)
                  </span>
                )}
              </div>
            )}
          </div>
          {/* Botão de atalho para configurações */}
          <button
            onClick={onNavigateToPipeline}
            className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-cyan-300 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Gerenciar fontes em <strong className="text-cyan-400">Configurações</strong></span>
          </button>
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

          {statusFontes.length > 0 && !loading && (
        <div className="rounded-xl border border-[#07323e] bg-[#011419] p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-100">Fontes consultadas ({statusFontes.length})</h3>
          <div className="flex flex-wrap gap-2">
            {statusFontes.map((status) => (
              <span key={status.id} title={status.lastError || 'Consulta concluída'} className={`rounded-lg border px-3 py-1.5 text-xs ${status.status === 'error' ? 'border-rose-800 text-rose-300' : status.status === 'partial' ? 'border-amber-800 text-amber-300' : 'border-emerald-800 text-emerald-300'}`}>
                {status.nome}: {status.totalResults} resultado(s){status.status === 'error' ? ' — falha' : status.status === 'partial' ? ' — parcial' : ''}
              </span>
            ))}
          </div>
        </div>
      )}
      {searchErrors.length > 0 && !loading && (
        <details className="rounded-xl border border-amber-800/60 bg-amber-950/20 p-4 text-sm text-amber-200">
          <summary className="cursor-pointer font-semibold">Algumas fontes não concluíram a consulta ({searchErrors.length})</summary>
          <ul className="mt-2 list-disc pl-5 space-y-1">{searchErrors.map((error, i) => <li key={i}>{error}</li>)}</ul>
        </details>
      )}

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
                const licId = getLicId(lic);
                const isCardManaged = Boolean(licId && managedIds.has(licId));
                const isCardAdding = addingId === licId;
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
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {Array.from(new Set(((lic as any).origens?.length ? (lic as any).origens : [{ nome: (lic as any).fonte || 'Fonte oficial' }]).map((origin: any) => origin.nome))).map((name: any) => (
                          <span key={name} className="rounded-md border border-cyan-800/60 px-2 py-0.5 text-xs text-cyan-300">{name}</span>
                        ))}
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
                      <span className="text-xs text-slate-400 mr-1">Prazo:</span>
                      <strong className="text-xs text-slate-800 dark:text-slate-100">{formatAbertura(lic)}</strong>
                    </div>
                    
                    <div className="ml-auto flex items-center gap-2">
                      {isCardManaged ? (
                        <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 font-semibold text-xs shadow-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Gerenciada</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isCardAdding || addingToManaged}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToManaged(lic);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#022129] hover:bg-[#032f3b] text-cyan-300 border border-cyan-800/70 font-semibold text-xs transition-all cursor-pointer shadow-xs disabled:opacity-50"
                          title="Adicionar a Licitações Gerenciadas sem sair da tela"
                        >
                          {isCardAdding ? (
                            <div className="w-3.5 h-3.5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                          ) : (
                            <Briefcase className="w-3.5 h-3.5 text-cyan-400" />
                          )}
                          <span>Adicionar às Gerenciadas</span>
                        </button>
                      )}

                      <button 
                        onClick={() => {
                          setAddSuccess(false);
                          setSelectedLicitacao(lic);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/70 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/80 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 font-semibold text-xs sm:text-sm transition-all shadow-xs cursor-pointer"
                      >
                        <span>Detalhes e Anexos</span>
                        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                      </button>
                    </div>
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
        <LicitacaoDetalhesModal
          licitacao={selectedLicitacao}
          onClose={() => {
            setSelectedLicitacao(null);
            setAddSuccess(false);
          }}
          onAddToManaged={() => handleAddToManaged(selectedLicitacao)}
          isManaged={Boolean(getLicId(selectedLicitacao) && managedIds.has(getLicId(selectedLicitacao)))}
          addingToManaged={addingToManaged}
          addSuccess={addSuccess}
        />
      )}

      {/* Notificação Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl bg-[#011c23] border border-cyan-500/50 text-white shadow-2xl shadow-cyan-950/80 animate-in fade-in slide-in-from-bottom-3 duration-200">
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          ) : toastMessage.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />
          )}
          <span className="text-sm font-medium text-slate-100">{toastMessage.text}</span>
          <button 
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
