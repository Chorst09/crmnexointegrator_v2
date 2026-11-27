import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  FileCheck2,
  FileText,
  FolderCheck,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { buildApiUrl, getAuthHeaders } from '../../config/api';

interface DocumentoB2G {
  id: string;
  nome: string;
  categoria: string;
  numero_documento?: string;
  orgao_emissor?: string;
  data_emissao?: string;
  data_validade?: string;
  sem_validade?: boolean;
  arquivo_nome?: string;
  arquivo_mime?: string;
  arquivo_tamanho?: number;
  has_file?: boolean;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

const CATEGORIAS = [
  'Habilitação Jurídica',
  'Regularidade Fiscal e Trabalhista',
  'Qualificação Econômico-Financeira',
  'Qualificação Técnica',
  'Declarações e Outros',
];

const SUGESTOES_EDITAIS: Array<{ nome: string; categoria: string; orgao: string; semValidade?: boolean }> = [
  { nome: 'CND Federal / Dívida Ativa (PGFN/RFB)', categoria: 'Regularidade Fiscal e Trabalhista', orgao: 'Receita Federal / PGFN' },
  { nome: 'CRF — Regularidade do FGTS', categoria: 'Regularidade Fiscal e Trabalhista', orgao: 'Caixa Econômica Federal' },
  { nome: 'CNDT — Certidão Negativa de Débitos Trabalhistas', categoria: 'Regularidade Fiscal e Trabalhista', orgao: 'TST' },
  { nome: 'CND Estadual (SEFAZ)', categoria: 'Regularidade Fiscal e Trabalhista', orgao: 'Secretaria da Fazenda Estadual' },
  { nome: 'CND Municipal (ISS / Tributos Mobiliários)', categoria: 'Regularidade Fiscal e Trabalhista', orgao: 'Prefeitura Municipal' },
  { nome: 'Extrato SICAF Atualizado', categoria: 'Regularidade Fiscal e Trabalhista', orgao: 'Compras.gov.br / SICAF' },
  { nome: 'Contrato Social Consolidado e Última Alteração', categoria: 'Habilitação Jurídica', orgao: 'Junta Comercial', semValidade: true },
  { nome: 'Cartão CNPJ + QSA', categoria: 'Habilitação Jurídica', orgao: 'Receita Federal', semValidade: true },
  { nome: 'Balanço Patrimonial e DRE (Últimos 2 Exercícios)', categoria: 'Qualificação Econômico-Financeira', orgao: 'SPED / Junta Comercial' },
  { nome: 'Certidão Negativa de Falência e Recuperação Judicial', categoria: 'Qualificação Econômico-Financeira', orgao: 'Tribunal de Justiça' },
  { nome: 'Atestado(s) de Capacidade Técnica', categoria: 'Qualificação Técnica', orgao: 'Órgão/Cliente Contratante', semValidade: true },
  { nome: 'Declaração Unificada (Lei 14.133/2021)', categoria: 'Declarações e Outros', orgao: 'Representante Legal' },
];

type ValidityStatus = 'valido' | 'vencendo' | 'vencido' | 'indeterminado';

function getValidityInfo(doc: DocumentoB2G): {
  status: ValidityStatus;
  daysLeft: number | null;
  label: string;
  badgeCls: string;
} {
  if (doc.sem_validade || !doc.data_validade) {
    return {
      status: 'indeterminado',
      daysLeft: null,
      label: 'Sem vencimento',
      badgeCls: 'bg-slate-500/20 border-slate-500/40 text-slate-300',
    };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(`${doc.data_validade}T00:00:00`);
  if (Number.isNaN(exp.getTime())) {
    return {
      status: 'indeterminado',
      daysLeft: null,
      label: 'Data inválida',
      badgeCls: 'bg-slate-500/20 border-slate-500/40 text-slate-300',
    };
  }
  const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return {
      status: 'vencido',
      daysLeft: diffDays,
      label: `Vencido há ${Math.abs(diffDays)} dia(s)`,
      badgeCls: 'bg-rose-500/20 border-rose-500/50 text-rose-300',
    };
  }
  if (diffDays <= 30) {
    return {
      status: 'vencendo',
      daysLeft: diffDays,
      label: diffDays === 0 ? 'Vence hoje!' : `Vence em ${diffDays} dia(s)`,
      badgeCls: 'bg-amber-500/20 border-amber-500/50 text-amber-300',
    };
  }
  return {
    status: 'valido',
    daysLeft: diffDays,
    label: `Válido (${diffDays} dias)`,
    badgeCls: 'bg-emerald-500/20 border-emerald-500/45 text-emerald-300',
  };
}

const formatDateBr = (iso?: string) => {
  if (!iso) return '—';
  const parts = iso.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return iso;
};

const readFileAsBase64 = (file: File): Promise<{ name: string; mime: string; size: number; base64: string }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '');
      const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
      resolve({
        name: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        base64,
      });
    };
    reader.onerror = () => reject(new Error(`Falha ao ler o arquivo ${file.name}`));
    reader.readAsDataURL(file);
  });

export const DocumentacaoPage: React.FC = () => {
  const [items, setItems] = useState<DocumentoB2G[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [catFilter, setCatFilter] = useState<string>('TODAS');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | ValidityStatus>('TODOS');

  // Form / Modal state
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState<string>('');
  const [categoria, setCategoria] = useState<string>(CATEGORIAS[1]);
  const [numeroDoc, setNumeroDoc] = useState<string>('');
  const [orgaoEmissor, setOrgaoEmissor] = useState<string>('');
  const [dataEmissao, setDataEmissao] = useState<string>('');
  const [dataValidade, setDataValidade] = useState<string>('');
  const [semValidade, setSemValidade] = useState<boolean>(false);
  const [observacoes, setObservacoes] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<{ name: string; mime: string; size: number; base64: string } | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const fetchDocs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildApiUrl(`/b2g-licitacoes/documentacao?t=${Date.now()}`), {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro ao carregar documentação');
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar documentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setNome('');
    setCategoria(CATEGORIAS[1]);
    setNumeroDoc('');
    setOrgaoEmissor('');
    setDataEmissao('');
    setDataValidade('');
    setSemValidade(false);
    setObservacoes('');
    setSelectedFile(null);
  };

  const openNewForm = (preset?: { nome: string; categoria: string; orgao: string; semValidade?: boolean }) => {
    resetForm();
    if (preset) {
      setNome(preset.nome);
      setCategoria(preset.categoria);
      setOrgaoEmissor(preset.orgao);
      setSemValidade(Boolean(preset.semValidade));
    }
    setShowForm(true);
    setError(null);
  };

  const openEditForm = (doc: DocumentoB2G) => {
    setEditingId(doc.id);
    setNome(doc.nome || '');
    setCategoria(doc.categoria || CATEGORIAS[1]);
    setNumeroDoc(doc.numero_documento || '');
    setOrgaoEmissor(doc.orgao_emissor || '');
    setDataEmissao(doc.data_emissao || '');
    setDataValidade(doc.data_validade || '');
    setSemValidade(Boolean(doc.sem_validade));
    setObservacoes(doc.observacoes || '');
    setSelectedFile(null);
    setShowForm(true);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setError('Informe o nome do documento.');
      return;
    }
    if (!semValidade && !dataValidade) {
      setError('Informe a data de validade do documento ou marque "Sem vencimento".');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        nome: nome.trim(),
        categoria,
        numero_documento: numeroDoc.trim(),
        orgao_emissor: orgaoEmissor.trim(),
        data_emissao: dataEmissao,
        data_validade: semValidade ? '' : dataValidade,
        sem_validade: semValidade,
        observacoes: observacoes.trim(),
        ...(selectedFile
          ? {
              arquivo_nome: selectedFile.name,
              arquivo_mime: selectedFile.mime,
              arquivo_tamanho: selectedFile.size,
              arquivo_base64: selectedFile.base64,
            }
          : {}),
      };
      const url = editingId
        ? buildApiUrl(`/b2g-licitacoes/documentacao/${encodeURIComponent(editingId)}`)
        : buildApiUrl('/b2g-licitacoes/documentacao');
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || data?.detail || 'Erro ao salvar documento');
      setShowForm(false);
      resetForm();
      showToast(editingId ? 'Documento atualizado com sucesso!' : 'Documento cadastrado com sucesso!');
      await fetchDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar documento.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(buildApiUrl(`/b2g-licitacoes/documentacao/${encodeURIComponent(id)}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Falha ao excluir documento');
      setItems((prev) => prev.filter((it) => it.id !== id));
      showToast('Documento removido.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir.');
    }
  };

  const handleDownloadFile = async (doc: DocumentoB2G) => {
    setDownloadingId(doc.id);
    try {
      const res = await fetch(buildApiUrl(`/b2g-licitacoes/documentacao/${encodeURIComponent(doc.id)}/arquivo`), {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data?.arquivo_base64) throw new Error(data?.error || 'Arquivo indisponível');
      const byteChars = atob(data.arquivo_base64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: data.arquivo_mime || 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.arquivo_nome || `${doc.nome}.pdf`;
      link.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao baixar arquivo.');
    } finally {
      setDownloadingId(null);
    }
  };

  const stats = useMemo(() => {
    let validos = 0;
    let vencendo = 0;
    let vencidos = 0;
    items.forEach((doc) => {
      const st = getValidityInfo(doc).status;
      if (st === 'valido' || st === 'indeterminado') validos += 1;
      else if (st === 'vencendo') vencendo += 1;
      else if (st === 'vencido') vencidos += 1;
    });
    return { total: items.length, validos, vencendo, vencidos };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return items.filter((doc) => {
      if (catFilter !== 'TODAS' && doc.categoria !== catFilter) return false;
      const st = getValidityInfo(doc).status;
      if (statusFilter !== 'TODOS' && st !== statusFilter) return false;
      if (!q) return true;
      return (
        (doc.nome || '').toLowerCase().includes(q) ||
        (doc.orgao_emissor || '').toLowerCase().includes(q) ||
        (doc.numero_documento || '').toLowerCase().includes(q) ||
        (doc.categoria || '').toLowerCase().includes(q)
      );
    });
  }, [items, searchTerm, catFilter, statusFilter]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 text-[rgb(var(--crm-ink-rgb)_/_1)]">
      {/* Cabeçalho */}
      <div className="rounded-2xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/15 px-3 py-0.5 text-[11px] font-bold text-cyan-300 mb-2">
              <FolderCheck className="w-3.5 h-3.5" /> Habilitação B2G • Lei 14.133/2021
            </span>
            <h1 className="text-2xl font-black tracking-tight">Documentação para Editais</h1>
            <p className="text-xs sm:text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] mt-1">
              Centralize certidões, habilitação jurídica, qualificação técnica e controle automaticamente a validade de cada documento.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fetchDocs}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--crm-border)] bg-black/25 hover:border-cyan-400 px-3.5 py-2 text-xs font-bold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
            <button
              type="button"
              onClick={() => openNewForm()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110 px-4 py-2 text-xs font-black text-white shadow-lg"
            >
              <Plus className="w-4 h-4" /> Inserir Documento
            </button>
          </div>
        </div>

        {/* KPIs de Validade */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.65)] p-3.5">
            <span className="text-[10px] font-bold uppercase text-[rgb(var(--crm-muted-rgb)_/_1)]">Total Cadastrado</span>
            <div className="text-2xl font-black text-cyan-300 mt-0.5">{stats.total}</div>
          </div>
          <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3.5">
            <span className="text-[10px] font-bold uppercase text-emerald-300">Em Dia / Válidos</span>
            <div className="text-2xl font-black text-emerald-400 mt-0.5">{stats.validos}</div>
          </div>
          <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3.5">
            <span className="text-[10px] font-bold uppercase text-amber-300">Vencendo (≤ 30 dias)</span>
            <div className="text-2xl font-black text-amber-400 mt-0.5">{stats.vencendo}</div>
          </div>
          <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 p-3.5">
            <span className="text-[10px] font-bold uppercase text-rose-300">Vencidos</span>
            <div className="text-2xl font-black text-rose-400 mt-0.5">{stats.vencidos}</div>
          </div>
        </div>

        {/* Sugestões Rápidas */}
        <div className="mt-4 pt-4 border-t border-[var(--crm-border)]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Cadastro Rápido — Documentos Obrigatórios em Editais:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUGESTOES_EDITAIS.map((sug) => (
              <button
                key={sug.nome}
                type="button"
                onClick={() => openNewForm(sug)}
                className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 transition-colors"
              >
                + {sug.nome}
              </button>
            ))}
          </div>
        </div>

        {/* Filtros */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-[rgb(var(--crm-muted-rgb)_/_1)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, órgão emissor ou número..."
              className="w-full rounded-lg border border-[var(--crm-border)] bg-black/25 pl-9 pr-3 py-2 text-xs outline-none focus:border-cyan-400"
            />
          </div>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="rounded-lg border border-[var(--crm-border)] bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-400"
          >
            <option value="TODAS">Todas as Categorias</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'TODOS', label: 'Todos' },
              { id: 'valido', label: 'Válidos' },
              { id: 'vencendo', label: 'Vencendo' },
              { id: 'vencido', label: 'Vencidos' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                  statusFilter === f.id
                    ? 'bg-cyan-600 text-white border-cyan-500'
                    : 'bg-black/20 border-[var(--crm-border)] text-[rgb(var(--crm-muted-rgb)_/_1)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-xs font-bold text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {notice}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-2.5 text-xs font-bold text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Formulário de Cadastro / Edição */}
      {showForm && (
        <form
          onSubmit={handleSave}
          className="rounded-2xl border border-cyan-500/40 bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-6 shadow-2xl space-y-4"
        >
          <div className="flex items-center justify-between border-b border-[var(--crm-border)] pb-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-cyan-300 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4" />
              {editingId ? 'Editar Documento' : 'Cadastrar Novo Documento para Editais'}
            </h2>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="p-1.5 rounded-lg border border-[var(--crm-border)] text-slate-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold mb-1">Nome do Documento *</label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: CND Federal (PGFN/RFB)"
                className="w-full rounded-lg border border-[var(--crm-border)] bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">Categoria *</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full rounded-lg border border-[var(--crm-border)] bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-400"
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">Número / Código de Controle</label>
              <input
                type="text"
                value={numeroDoc}
                onChange={(e) => setNumeroDoc(e.target.value)}
                placeholder="Ex: 1234.5678.90AB"
                className="w-full rounded-lg border border-[var(--crm-border)] bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">Órgão Emissor</label>
              <input
                type="text"
                value={orgaoEmissor}
                onChange={(e) => setOrgaoEmissor(e.target.value)}
                placeholder="Ex: Receita Federal, Caixa, TST..."
                className="w-full rounded-lg border border-[var(--crm-border)] bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">Data de Emissão</label>
              <input
                type="date"
                value={dataEmissao}
                onChange={(e) => setDataEmissao(e.target.value)}
                className="w-full rounded-lg border border-[var(--crm-border)] bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">Validade do Documento *</label>
              <input
                type="date"
                disabled={semValidade}
                required={!semValidade}
                value={semValidade ? '' : dataValidade}
                onChange={(e) => setDataValidade(e.target.value)}
                className="w-full rounded-lg border border-[var(--crm-border)] bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-400 disabled:opacity-40"
              />
              <label className="mt-1.5 flex items-center gap-2 text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={semValidade}
                  onChange={(e) => setSemValidade(e.target.checked)}
                  className="accent-cyan-500"
                />
                Validade indeterminada / Sem vencimento
              </label>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold mb-1">Anexar Documento (PDF, PNG, JPG, DOCX)</label>
              <label className="flex items-center justify-between rounded-lg border border-dashed border-cyan-500/40 bg-black/20 hover:border-cyan-400 px-3.5 py-2 text-xs cursor-pointer">
                <span className="flex items-center gap-2 truncate">
                  <Upload className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  {selectedFile ? selectedFile.name : 'Clique para selecionar arquivo (opcional)'}
                </span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const encoded = await readFileAsBase64(f);
                    setSelectedFile(encoded);
                  }}
                />
              </label>
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-bold mb-1">Observações</label>
              <input
                type="text"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Autenticação digital no portal da RFB, renovação automática mensal..."
                className="w-full rounded-lg border border-[var(--crm-border)] bg-black/25 px-3 py-2 text-xs outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="rounded-lg border border-[var(--crm-border)] bg-black/25 px-4 py-2 text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 px-5 py-2 text-xs font-black text-white shadow-lg disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? 'Salvando...' : editingId ? 'Atualizar Documento' : 'Salvar Documento'}
            </button>
          </div>
        </form>
      )}

      {/* Lista de Documentos */}
      {loading ? (
        <div className="rounded-2xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-cyan-400" />
          <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">Carregando documentação...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.6)] p-12 text-center space-y-3">
          <ShieldAlert className="w-10 h-10 text-cyan-400/70 mx-auto" />
          <h3 className="text-base font-black">Nenhum documento cadastrado</h3>
          <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] max-w-md mx-auto">
            Clique em <strong>Inserir Documento</strong> ou use os atalhos acima para cadastrar as certidões e documentos de habilitação com controle de validade.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredItems.map((doc) => {
            const valInfo = getValidityInfo(doc);
            return (
              <div
                key={doc.id}
                className="rounded-2xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-5 shadow-lg flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-bold text-cyan-300">
                      {doc.categoria}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black ${valInfo.badgeCls}`}>
                      <Clock className="w-3 h-3" /> {valInfo.label}
                    </span>
                  </div>

                  <h3 className="text-sm sm:text-base font-black leading-snug">{doc.nome}</h3>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)]">
                    <div>
                      <strong>Órgão:</strong> {doc.orgao_emissor || '—'}
                    </div>
                    <div>
                      <strong>Número:</strong> {doc.numero_documento || '—'}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-cyan-400" />
                      <strong>Emissão:</strong> {formatDateBr(doc.data_emissao)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-emerald-400" />
                      <strong>Validade:</strong> {doc.sem_validade ? 'Indeterminada' : formatDateBr(doc.data_validade)}
                    </div>
                  </div>

                  {doc.observacoes && (
                    <p className="text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)] italic">{doc.observacoes}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--crm-border)]">
                  <div className="text-[11px] text-cyan-300 flex items-center gap-1 truncate max-w-[200px]">
                    {doc.has_file ? (
                      <>
                        <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{doc.arquivo_nome || 'Anexo salvo'}</span>
                      </>
                    ) : (
                      <span className="text-[rgb(var(--crm-muted-rgb)_/_1)]">Sem anexo</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {doc.has_file && (
                      <button
                        type="button"
                        disabled={downloadingId === doc.id}
                        onClick={() => handleDownloadFile(doc)}
                        className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/15 hover:bg-cyan-500/25 px-2.5 py-1 text-[11px] font-bold text-cyan-200"
                      >
                        {downloadingId === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                        Baixar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditForm(doc)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--crm-border)] bg-black/25 hover:border-cyan-400 px-2.5 py-1 text-[11px] font-bold"
                    >
                      <Edit3 className="w-3 h-3" /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(doc.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 text-[11px] font-bold text-rose-300"
                      title="Excluir documento"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
