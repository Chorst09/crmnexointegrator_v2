import { normalizeFicha } from './ficha-normalizer.mjs';
import { salvarFicha } from './ficha-persistence.mjs';
import { getPncpIdentifiers, getInitialArquivos, getArquivoDownloadEndpoint, getDownloadFilename, normalizeArquivo } from './pncp-documents';
import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Upload, 
  Layers, 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ShieldAlert, 
  Search, 
  Sparkles, 
  Code2, 
  Copy, 
  Check, 
  FileSearch, 
  Boxes, 
  RefreshCw, 
  MapPin, 
  File, 
  X, 
  ArrowRight,
  FileSpreadsheet,
  HelpCircle,
  Download,
  Calendar,
  DollarSign,
  Printer,
  Pencil,
  Trash2,
  Plus,
  Save,
  RotateCcw,
  Edit3,
  FileCheck
} from 'lucide-react';
import { cn } from './utils';
import { Licitacao, FichaTecnicaEditalTR, MatrizItemAnalise } from './types';
import { gerarPdfFichaTecnica, formatarMoeda } from './utils/pdfGenerator';
import { PdfViewerModal } from './PdfViewerModal';
import { EditarItemModal } from './EditarItemModal';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

interface AnaliseEditaisPageProps {
  onNavigateToSearch?: () => void;
  onNavigateToAnalisados?: () => void;
  initialFicha?: FichaTecnicaEditalTR | null;
  onClearInitialFicha?: () => void;
}

interface UploadedFileItem {
  id: string;
  file: globalThis.File;
  name: string;
  size: number;
  base64: string;
  tipoDetectado: 'EDITAL' | 'TERMO_REFERENCIA' | 'ANEXO_GERAL';
  extensao: string;
}

export const AnaliseEditaisPage: React.FC<AnaliseEditaisPageProps> = ({ 
  onNavigateToSearch,
  onNavigateToAnalisados,
  initialFicha,
  onClearInitialFicha
}) => {
  const [activeTab, setActiveTab] = useState<'workbench' | 'architecture' | 'code'>('workbench');
  const [inputMode, setInputMode] = useState<'upload' | 'licitacao'>('upload');
  
  // Upload States
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Certames States
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [selectedLicitacaoId, setSelectedLicitacaoId] = useState<string>('');
  
  // Pipeline Processing States
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [processingStatusMessage, setProcessingStatusMessage] = useState<string>('');
  const [reanalysisId, setReanalysisId] = useState<string | null>(null);
  const [fichaTecnica, setFichaTecnica] = useState<FichaTecnicaEditalTR | null>(null);
  const [fonteExtracao, setFonteExtracao] = useState<string>('');
  const [copiedJson, setCopiedJson] = useState(false);

  // Estados de Edição da Matriz de Itens do TR
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [itemEmEdicao, setItemEmEdicao] = useState<MatrizItemAnalise | null>(null);
  const [isNovoItem, setIsNovoItem] = useState(false);
  const [isModoEdicaoTabela, setIsModoEdicaoTabela] = useState(false);
  const [itensRascunho, setItensRascunho] = useState<MatrizItemAnalise[]>([]);
  const [feedbackSalvo, setFeedbackSalvo] = useState<string | null>(null);
  const [salvandoFicha, setSalvandoFicha] = useState(false);

  // PDF Preview & Save States
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [codeTab, setCodeTab] = useState<'pipeline' | 'schemas' | 'downloader' | 'chunker' | 'summarizer' | 'elastic'>('pipeline');

  const steps = [
    { title: "Extração de Texto", desc: "Leitura nativa e parsing de PDF ou Word (.docx/.doc)" },
    { title: "Classificação Heurística", desc: "Diferenciando Edital Principal vs Termo de Referência (TR/PB)" },
    { title: "Segmentador Semântico", desc: "Isolando seções críticas da Lei 14.133/2021 (Habilitação, Objeto, Prazos)" },
    { title: "Extração dos dados", desc: "Extraindo os campos encontrados no texto dos documentos" },
    { title: "Armazenamento da análise", desc: "Salvando a ficha e preservando os documentos originais" }
  ];

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    
    fetch('/api/b2g-licitacoes/buscar', { headers })
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : data.licitacoes || [];
        setLicitacoes(list);
        if (list.length > 0) {
          setSelectedLicitacaoId(list[0].id);
        }
      })
      .catch(err => console.error("Erro ao carregar licitações:", err));
  }, []);

  // Sincroniza ficha externa quando aberta a partir de 'Editais Analisados'
  useEffect(() => {
    if (initialFicha) {
      setReanalysisId(initialFicha.id_licitacao);
      const fichaSegura = ensureFichaCompleta(initialFicha);
      setFichaTecnica(fichaSegura);
      setActiveTab('workbench');
      mostrarFeedback(`Edital ${fichaSegura.id_licitacao} carregado na bancada de análise.`);
      if (onClearInitialFicha) onClearInitialFicha();
    }
  }, [initialFicha]);

  // Helper para ler arquivos para Base64
  const readFileAsBase64 = (file: globalThis.File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const novosArquivos: UploadedFileItem[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const lowerName = file.name.toLowerCase();
      const ext = lowerName.split('.').pop() || '';

      if (!['pdf', 'docx', 'doc'].includes(ext)) {
        alert(`O arquivo "${file.name}" não é suportado. Por favor, envie arquivos PDF ou Word (.docx/.doc).`);
        continue;
      }

      try {
        const base64 = await readFileAsBase64(file);
        let tipoDetectado: 'EDITAL' | 'TERMO_REFERENCIA' | 'ANEXO_GERAL' = 'ANEXO_GERAL';

        if (lowerName.includes('edital') || lowerName.includes('pregao') || lowerName.includes('concorrencia')) {
          tipoDetectado = 'EDITAL';
        } else if (lowerName.includes('termo') || lowerName.includes('tr') || lowerName.includes('referencia') || lowerName.includes('projeto') || lowerName.includes('pb')) {
          tipoDetectado = 'TERMO_REFERENCIA';
        }

        novosArquivos.push({
          id: `${file.name}-${Date.now()}-${i}`,
          file,
          name: file.name,
          size: file.size,
          base64,
          tipoDetectado,
          extensao: ext.toUpperCase()
        });
      } catch (err) {
        console.error(`Erro ao carregar arquivo ${file.name}:`, err);
      }
    }

    setUploadedFiles(prev => [...prev, ...novosArquivos]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      await handleFilesSelected(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleCarregarExemploWord = () => { setInputMode('upload'); fileInputRef.current?.click(); };

  // Disparo do Processamento com o backend /api/analise-tr/processar-arquivo
  const handleProcessar = async () => {
    if (inputMode === 'upload' && uploadedFiles.length === 0) {
      alert("Por favor, selecione ou arraste pelo menos um arquivo PDF ou Word (.docx/.doc).");
      return;
    }

    setIsProcessing(true);
    setCurrentStep(0);
    setProcessingStatusMessage("Iniciando pipeline de inteligência documental...");

    try {
      let payloadFiles: { name: string; base64: string }[] = [];
      let orgaoNome = "";
      let modalidadeNome = "";
      let idLicitacao = reanalysisId || `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      if (inputMode === 'upload') {
        payloadFiles = uploadedFiles.map(u => ({ name: u.name, base64: u.base64 }));

      } else {
        const lic = licitacoes.find(l => l.id === selectedLicitacaoId);
        if (lic) {
          orgaoNome = lic.orgao;
          modalidadeNome = lic.modalidade;
          idLicitacao = lic.numeroControlePNCP || `PNCP-${lic.id}/2026`;
          let arquivos = getInitialArquivos(lic);
          const ids = getPncpIdentifiers(lic);
          if (ids) {
            const anexos = await fetch(`/api/b2g-licitacoes/arquivos/${ids.cnpj}/${ids.ano}/${ids.seq}`, { headers: getAuthHeaders() });
            if (!anexos.ok) throw new Error('Não foi possível obter os documentos do edital. Anexe os arquivos originais.');
            const encontrados = await anexos.json();
            arquivos = [...arquivos, ...(Array.isArray(encontrados) ? encontrados.map(normalizeArquivo).filter(Boolean) : [])];
          }
          arquivos = [...new Map(arquivos.map(a => [a.url, a])).values()];
          for (const arquivo of arquivos.slice(0, 10)) {
            const downloaded = await fetch(getArquivoDownloadEndpoint(lic, arquivo), { headers: getAuthHeaders() });
            if (!downloaded.ok) throw new Error(`Não foi possível baixar ${arquivo.titulo}.`);
            const blob = await downloaded.blob();
            let name = getDownloadFilename(downloaded.headers.get('content-disposition'), arquivo.titulo);
            if (!/\.(pdf|docx?|DOCX?)$/i.test(name)) {
              if (blob.type.includes('pdf')) name += '.pdf';
              else if (blob.type.includes('wordprocessingml')) name += '.docx';
              else if (blob.type.includes('msword')) name += '.doc';
              else continue;
            }
            const file = new globalThis.File([blob], name, { type: blob.type });
            payloadFiles.push({ name, base64: await readFileAsBase64(file) });
          }
          if (!payloadFiles.length) throw new Error('Nenhum PDF ou Word real disponível. Anexe os documentos originais.');
        }
      }

      setCurrentStep(2);

      const response = await fetch('/api/analise-tr/processar-arquivo', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          files: payloadFiles,
          orgao: orgaoNome,
          modalidade: modalidadeNome,
          id_licitacao: idLicitacao
        })
      });

      setCurrentStep(4);

      if (response.ok) {
        const result = await response.json();
        if (!result.ficha || result.ficha.analysisStatus === 'requires_reanalysis') throw new Error('O servidor não retornou uma análise válida.');
        const fichaSegura = ensureFichaCompleta(result.ficha);
        setFichaTecnica(fichaSegura);
        setFonteExtracao(result.fonte || 'Extrator Lei 14.133/2021');
        await persistirFichaServidor(fichaSegura, true);
        mostrarFeedback("Edital analisado com sucesso e salvo em Editais Analisados!");
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Não foi possível analisar os documentos.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível analisar os documentos.';
      setProcessingStatusMessage(message);
      alert(message);
    } finally {
      setIsProcessing(false);
      setCurrentStep(0);
    }
  };

  const ensureFichaCompleta = (rawFicha?: any): FichaTecnicaEditalTR => normalizeFicha(rawFicha || {});

  const handleCopyJson = () => {
    if (!fichaTecnica) return;
    navigator.clipboard.writeText(JSON.stringify(fichaTecnica, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleVisualizarPdf = () => {
    if (!fichaTecnica) return;
    const url = gerarPdfFichaTecnica(fichaTecnica, 'bloburl') as string;
    setPdfBlobUrl(url);
    setPdfModalOpen(true);
  };

  const handleSalvarPdf = () => {
    if (!fichaTecnica) return;
    gerarPdfFichaTecnica(fichaTecnica, 'download');
  };

  // Sincroniza rascunho toda vez que a ficha técnica for alterada
  useEffect(() => {
    if (fichaTecnica?.matriz_itens) {
      setItensRascunho(JSON.parse(JSON.stringify(fichaTecnica.matriz_itens)));
    }
  }, [fichaTecnica]);

  const mostrarFeedback = (msg: string) => {
    setFeedbackSalvo(msg);
    setTimeout(() => setFeedbackSalvo(null), 5500);
  };

  const persistirFichaServidor = async (ficha: FichaTecnicaEditalTR, strict = false) => {
    try {
      setSalvandoFicha(true);
      await salvarFicha(ficha, { headers: getAuthHeaders() });
      // O backup local só representa fichas confirmadas pelo servidor.
      try {
        localStorage.setItem(`ficha_tecnica_${ficha.id_licitacao}`, JSON.stringify(ficha));
        // Atualiza a lista completa de backups
        const backupRaw = localStorage.getItem('fichas_analisadas_backup');
        const backupList: any[] = backupRaw ? JSON.parse(backupRaw) : [];
        const idx = backupList.findIndex((f: any) => f.id_licitacao === ficha.id_licitacao);
        if (idx >= 0) {
          backupList[idx] = ficha;
        } else {
          backupList.unshift(ficha);
        }
        localStorage.setItem('fichas_analisadas_backup', JSON.stringify(backupList));
      } catch (e) {
        console.warn('Falha ao salvar no localStorage:', e);
      }
      
      // Dispara evento para atualização instantânea de abas e badges
      window.dispatchEvent(new CustomEvent('edital-analisado-salvo', { detail: ficha }));
      return true;
    } catch (e) {
      mostrarFeedback(e instanceof Error ? e.message : 'Falha ao salvar no servidor.');
      if (strict) throw e;
      return false;
    } finally {
      setSalvandoFicha(false);
    }
  };

  // Abrir modal de edição para um item específico
  const handleAbrirEditarItem = (it: MatrizItemAnalise) => {
    setItemEmEdicao(it);
    setIsNovoItem(false);
    setEditModalOpen(true);
  };

  // Abrir modal para adicionar um novo item
  const handleAbrirNovoItem = () => {
    const nextNum = (fichaTecnica?.matriz_itens?.length || 0) + 1;
    setItemEmEdicao({
      item_numero: nextNum,
      codigo_catalogo: '',
      especificacao_sucinta: '',
      unidade: 'UN',
      quantitativo: 1,
      valor_estimado_unitario: 0,
      valor_estimado_total: 0
    });
    setIsNovoItem(true);
    setEditModalOpen(true);
  };

  // Salvar item editado ou criado no modal
  const handleSalvarItemModal = async (itemAtualizado: MatrizItemAnalise) => {
    if (!fichaTecnica) return;
    let novosItens = [...fichaTecnica.matriz_itens];
    const indexExistente = novosItens.findIndex(it => it.item_numero === itemAtualizado.item_numero);
    
    if (indexExistente >= 0) {
      novosItens[indexExistente] = itemAtualizado;
    } else {
      novosItens.push(itemAtualizado);
    }

    novosItens.sort((a, b) => (a.item_numero || 0) - (b.item_numero || 0));
    const novoTotal = novosItens.reduce((acc, it) => acc + (it.valor_estimado_total || 0), 0);

    const fichaAtualizada: FichaTecnicaEditalTR = {
      ...fichaTecnica,
      matriz_itens: novosItens,
      valor_estimado_total: novoTotal > 0 ? novoTotal : fichaTecnica.valor_estimado_total
    };

    setFichaTecnica(fichaAtualizada);
    if (!await persistirFichaServidor(fichaAtualizada)) return;
    mostrarFeedback(`Item ${itemAtualizado.item_numero} salvo com sucesso! Valores da matriz recalculados.`);
  };

  // Excluir item da matriz
  const handleExcluirItem = async (itemNumero: number) => {
    if (!fichaTecnica) return;
    const novosItens = fichaTecnica.matriz_itens.filter(it => it.item_numero !== itemNumero);
    const novoTotal = novosItens.reduce((acc, it) => acc + (it.valor_estimado_total || 0), 0);

    const fichaAtualizada: FichaTecnicaEditalTR = {
      ...fichaTecnica,
      matriz_itens: novosItens,
      valor_estimado_total: novoTotal > 0 ? novoTotal : fichaTecnica.valor_estimado_total
    };

    setFichaTecnica(fichaAtualizada);
    if (!await persistirFichaServidor(fichaAtualizada)) return;
    mostrarFeedback(`Item ${itemNumero} excluído com sucesso.`);
  };

  // Modo de Edição em Tabela Inline
  const handleIniciarEdicaoTabela = () => {
    if (!fichaTecnica) return;
    setItensRascunho(JSON.parse(JSON.stringify(fichaTecnica.matriz_itens)));
    setIsModoEdicaoTabela(true);
  };

  const handleCancelarEdicaoTabela = () => {
    if (fichaTecnica) {
      setItensRascunho(JSON.parse(JSON.stringify(fichaTecnica.matriz_itens)));
    }
    setIsModoEdicaoTabela(false);
  };

  const handleAlterarItemRascunho = (index: number, campo: keyof MatrizItemAnalise, valor: any) => {
    setItensRascunho(prev => {
      const clone = [...prev];
      const target = { ...clone[index], [campo]: valor };

      if (campo === 'quantitativo' || campo === 'valor_estimado_unitario') {
        const q = campo === 'quantitativo' ? Number(valor) : (target.quantitativo || 1);
        const u = campo === 'valor_estimado_unitario' ? Number(valor) : (target.valor_estimado_unitario || 0);
        target.valor_estimado_total = Number((q * u).toFixed(2));
      } else if (campo === 'valor_estimado_total') {
        const t = Number(valor);
        const q = target.quantitativo || 1;
        if (q > 0) {
          target.valor_estimado_unitario = Number((t / q).toFixed(2));
        }
      }

      clone[index] = target;
      return clone;
    });
  };

  const handleAdicionarLinhaRascunho = () => {
    setItensRascunho(prev => [
      ...prev,
      {
        item_numero: prev.length + 1,
        codigo_catalogo: `CATSER-${20000 + (prev.length + 1) * 111}`,
        especificacao_sucinta: 'Novo item conforme Termo de Referência',
        unidade: 'UN',
        quantitativo: 1,
        valor_estimado_unitario: 0,
        valor_estimado_total: 0
      }
    ]);
  };

  const handleRemoverLinhaRascunho = (index: number) => {
    setItensRascunho(prev => prev.filter((_, i) => i !== index));
  };

  const handleSalvarEdicaoTabela = async () => {
    if (!fichaTecnica) return;
    const novosItens = [...itensRascunho];
    const novoTotal = novosItens.reduce((acc, it) => acc + (it.valor_estimado_total || 0), 0);

    const fichaAtualizada: FichaTecnicaEditalTR = {
      ...fichaTecnica,
      matriz_itens: novosItens,
      valor_estimado_total: novoTotal > 0 ? novoTotal : fichaTecnica.valor_estimado_total
    };

    setFichaTecnica(fichaAtualizada);
    setIsModoEdicaoTabela(false);
    if (!await persistirFichaServidor(fichaAtualizada)) return;
    mostrarFeedback('Itens e quantitativos atualizados e salvos com sucesso!');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[rgb(var(--crm-surface-2-rgb)_/_1)] overflow-y-auto">
      {/* Header */}
      <div className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border-b border-[var(--crm-border)] px-8 py-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border dark:border-indigo-800 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Módulo de Inteligência Documental
              </span>
              <span className="text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] text-xs">• Lei 14.133/2021</span>
              <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border dark:border-emerald-800 text-[11px] font-medium px-2 py-0.5 rounded-full">
                Suporta PDF & Word (.docx/.doc)
              </span>
            </div>
            <h1 className="text-2xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mt-1">Análise de Editais & Termos de Referência (TR)</h1>
            <p className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] mt-0.5">
              Selecione ou faça upload de documentos em <strong>PDF</strong> ou <strong>Word (.docx/.doc)</strong> para extrair a Ficha Técnica Executiva, Matriz de Itens do TR e Riscos.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onNavigateToAnalisados && (
              <button
                onClick={onNavigateToAnalisados}
                className="px-3.5 py-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors flex items-center gap-2 shadow-2xs"
                title="Acessar o repositório de Editais Analisados"
              >
                <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Editais Analisados
              </button>
            )}
            <button
              onClick={() => setActiveTab('workbench')}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2",
                activeTab === 'workbench'
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_1)]"
              )}
            >
              <FileSearch className="w-4 h-4" /> Workbench & Ficha Técnica
            </button>
            <button
              onClick={() => setActiveTab('architecture')}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2",
                activeTab === 'architecture'
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_1)]"
              )}
            >
              <Layers className="w-4 h-4" /> Arquitetura do Pipeline
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2",
                activeTab === 'code'
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_1)]"
              )}
            >
              <Code2 className="w-4 h-4" /> Código Python 3.11+
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="p-8 space-y-6">
        {activeTab === 'workbench' && (
          <>
            {/* Card de Entrada: Upload de Arquivos ou Seleção de Editais do Sistema */}
            <div className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-6 rounded-xl border border-[var(--crm-border)] shadow-sm">
              <div className="flex items-center justify-between border-b border-[var(--crm-border)] dark:border-[var(--crm-border)] pb-4 mb-5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--crm-muted-rgb)_/_1)]">Fonte dos Documentos:</span>
                  <div className="inline-flex bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] p-1 rounded-lg">
                    <button
                      onClick={() => setInputMode('upload')}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5",
                        inputMode === 'upload' ? "bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-blue-700 dark:text-blue-300 shadow-sm" : "text-[rgb(var(--crm-ink-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] dark:hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
                      )}
                    >
                      <Upload className="w-3.5 h-3.5" /> Enviar PDF ou Word (.docx/.doc)
                    </button>
                    <button
                      onClick={() => setInputMode('licitacao')}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5",
                        inputMode === 'licitacao' ? "bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-blue-700 dark:text-blue-300 shadow-sm" : "text-[rgb(var(--crm-ink-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] dark:hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
                      )}
                    >
                      <Database className="w-3.5 h-3.5" /> Editais Cadastrados / PNCP
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCarregarExemploWord}
                    className="text-xs text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 font-medium transition-colors flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Selecionar documentos reais
                  </button>
                </div>
              </div>

              {/* Modo 1: Upload Direto de Arquivo (PDF ou Word) */}
              {inputMode === 'upload' && (
                <div className="space-y-4">
                  {/* Dropzone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
                      isDragging 
                        ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 ring-4 ring-blue-500/10" 
                        : "border-[var(--crm-border)] dark:border-[var(--crm-border)] hover:border-blue-400 dark:hover:border-blue-500 bg-[rgb(var(--crm-surface-2-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_0.7)]"
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                      onChange={(e) => handleFilesSelected(e.target.files)}
                      className="hidden"
                    />

                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                          Clique para selecionar ou arraste o <span className="text-blue-600 dark:text-blue-400">Edital</span> ou <span className="text-blue-600 dark:text-blue-400">Termo de Referência (TR)</span>
                        </p>
                        <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] mt-1">
                          Formatos aceitos: <strong>PDF (.pdf)</strong> e <strong>Word (.docx, .doc)</strong> até 50MB. Pode enviar os 2 arquivos juntos!
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Lista de Arquivos Selecionados */}
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] uppercase tracking-wider block">
                        Arquivos Prontos para Análise ({uploadedFiles.length}):
                      </span>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {uploadedFiles.map(file => (
                          <div 
                            key={file.id} 
                            className="p-3 bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.9)] border border-[var(--crm-border)] dark:border-[var(--crm-border)] rounded-lg shadow-sm flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3 min-w-0 pr-2">
                              <div className={cn(
                                "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-xs",
                                file.extensao === 'PDF' ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                              )}>
                                {file.extensao}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] truncate" title={file.name}>
                                  {file.name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)]">{formatFileSize(file.size)}</span>
                                  <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">•</span>
                                  <span className={cn(
                                    "text-[10px] font-semibold px-1.5 py-0.2 rounded",
                                    file.tipoDetectado === 'EDITAL' && "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
                                    file.tipoDetectado === 'TERMO_REFERENCIA' && "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300",
                                    file.tipoDetectado === 'ANEXO_GERAL' && "bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]"
                                  )}>
                                    {file.tipoDetectado === 'EDITAL' ? 'Edital Principal' : file.tipoDetectado === 'TERMO_REFERENCIA' ? 'Termo de Referência' : 'Anexo Geral'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => handleRemoveFile(file.id)}
                              className="p-1 text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-red-600 dark:hover:text-red-700 dark:hover:text-red-400 rounded-md hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] transition-colors"
                              title="Remover arquivo"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Modo 2: Seleção de Editais Cadastrados */}
              {inputMode === 'licitacao' && (
                <div>
                  <label className="text-xs font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] uppercase tracking-wider block mb-2">
                    Selecione um Certame do Sistema
                  </label>
                  <select
                    value={selectedLicitacaoId}
                    onChange={(e) => setSelectedLicitacaoId(e.target.value)}
                    className="w-full bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] border border-[var(--crm-border)] dark:border-[var(--crm-border)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {licitacoes.map(lic => (
                      <option key={lic.id} value={lic.id} className="dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                        {lic.orgao} ({lic.uf || 'BR'}) - {lic.objeto_resumo?.slice(0, 80)}...
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Ação Principal: Botão de Processamento */}
              <div className="mt-6 pt-5 border-t border-[var(--crm-border)] dark:border-[var(--crm-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Pipeline com OCR seletivo e Extração estruturada conforme Lei nº 14.133/2021.</span>
                </div>

                <button
                  onClick={handleProcessar}
                  disabled={isProcessing || (inputMode === 'upload' && uploadedFiles.length === 0)}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Analisando Documentos...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Processar com IA (Lei 14.133)
                    </>
                  )}
                </button>
              </div>

              {/* Barra de Progresso Interativa */}
              {isProcessing && (
                <div className="mt-6 pt-6 border-t border-[var(--crm-border)] dark:border-[var(--crm-border)]">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    {steps.map((step, idx) => {
                      const isPast = idx < currentStep;
                      const isCurrent = idx === currentStep;
                      return (
                        <div 
                          key={idx}
                          className={cn(
                            "p-3 rounded-lg border text-xs transition-all",
                            isCurrent && "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-500/20",
                            isPast && "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
                            !isPast && !isCurrent && "bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.5)] border-[var(--crm-border)] dark:border-[var(--crm-border)] text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]"
                          )}
                        >
                          <div className="flex items-center gap-1.5 font-semibold mb-1">
                            {isPast && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />}
                            {isCurrent && <RefreshCw className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 animate-spin flex-shrink-0" />}
                            {!isPast && !isCurrent && <Clock className="w-3.5 h-3.5 text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] flex-shrink-0" />}
                            <span className={isCurrent ? "text-indigo-900 dark:text-indigo-300" : isPast ? "text-emerald-900 dark:text-emerald-300" : "text-[rgb(var(--crm-muted-rgb)_/_1)]"}>
                              {step.title}
                            </span>
                          </div>
                          <p className="text-[11px] leading-snug text-[rgb(var(--crm-ink-rgb)_/_1)]">{step.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Ficha Técnica Executiva Gerada */}
            {fichaTecnica && (
              <div className="space-y-6">
                {/* Banner de Confirmação de Salvamento com Link Direto para Editais Analisados */}
                {feedbackSalvo && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 p-4 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-emerald-950 dark:text-emerald-100">{feedbackSalvo}</p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                          Todos os requisitos, matriz de itens e frentes de risco foram persistidos no repositório.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {onNavigateToAnalisados && (
                        <button
                          onClick={onNavigateToAnalisados}
                          className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-800 text-[rgb(var(--crm-ink-rgb)_/_1)] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                        >
                          <FileCheck className="w-4 h-4" />
                          Ver em Editais Analisados
                        </button>
                      )}
                      <button
                        onClick={() => setFeedbackSalvo(null)}
                        className="p-1 text-emerald-700 hover:text-emerald-950 dark:text-emerald-300 dark:hover:text-emerald-100 rounded-md"
                        title="Fechar aviso"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Cabeçalho da Ficha */}
                <div className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-6 rounded-xl border border-[var(--crm-border)] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:border dark:border-blue-800">
                        {fichaTecnica.modalidade_contratacao}
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] dark:border dark:border-[var(--crm-border)]">
                        Critério: {fichaTecnica.criterio_julgamento}
                      </span>
                      <span className="text-xs font-mono text-[rgb(var(--crm-muted-rgb)_/_1)]">
                        {fichaTecnica.id_licitacao}
                      </span>
                      {fonteExtracao && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
                          {fonteExtracao}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">{fichaTecnica.orgao_comprador}</h2>
                    <div className="flex items-center gap-4 text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] mt-2">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]" />
                        Edital: {fichaTecnica.documentos_origem?.edital || 'edital.pdf'}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]" />
                        TR: {fichaTecnica.documentos_origem?.termo_referencia || 'termo_referencia.docx'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={async () => {
                        if (fichaTecnica) {
                          if (!await persistirFichaServidor(fichaTecnica)) return;
                          mostrarFeedback("Ficha Técnica e Matriz de Itens salvas com sucesso!");
                        }
                      }}
                      disabled={salvandoFicha}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-75"
                      title="Salvar alterações da Ficha Técnica e Matriz de Itens"
                    >
                      <Save className="w-4 h-4" />
                      <span>{salvandoFicha ? 'Salvando...' : 'Salvar Alterações'}</span>
                    </button>

                    <button
                      onClick={handleVisualizarPdf}
                      className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                      title="Visualizar documento formatado em PDF A4 oficial"
                    >
                      <FileSearch className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Visualizar em PDF</span>
                    </button>

                    <button
                      onClick={handleSalvarPdf}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                      title="Baixar arquivo PDF no seu computador"
                    >
                      <Download className="w-4 h-4" />
                      <span>Salvar em PDF</span>
                    </button>

                    <button
                      onClick={handleCopyJson}
                      className="px-3.5 py-2 bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                      title="Copiar JSON compatível com Pydantic v2"
                    >
                      {copiedJson ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-[rgb(var(--crm-muted-rgb)_/_1)]" /> Copiar JSON Estrito
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Painel Destacado: Datas Críticas, Prazos e Metadados Financeiros */}
                <div className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] rounded-xl border border-blue-200/80 dark:border-blue-900/60 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-white">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-blue-50/80 dark:bg-blue-800/80 border border-blue-200/60 dark:border-blue-700/60">
                        <Calendar className="w-4 h-4 text-blue-700 dark:text-blue-300" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold tracking-wide uppercase">
                          Cronograma Crítico & Prazos da Licitação
                        </h3>
                        <p className="text-[11px] text-blue-700 dark:text-blue-200">
                          Conformidade com a Lei Federal nº 14.133/2021 e regras do certame
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-md bg-blue-50/80 dark:bg-blue-800/80 border border-blue-200/50 dark:border-blue-700/50 text-[11px] font-medium text-blue-700 dark:text-blue-200">
                        Portal: {fichaTecnica.portal_compras || 'Não identificado'}
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-indigo-50/80 dark:bg-indigo-800/80 border border-indigo-200/50 dark:border-indigo-700/50 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                        Modo: {fichaTecnica.modo_disputa || 'Não identificado'}
                      </span>
                    </div>
                  </div>

                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-[rgb(var(--crm-surface-rgb)_/_0.5)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_0.5)]">
                    {/* 1. Data de Abertura */}
                    <div className="bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.9)] p-4 rounded-xl border border-[var(--crm-border)] dark:border-[var(--crm-border)] shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold uppercase tracking-wider text-[rgb(var(--crm-muted-rgb)_/_1)]">
                            Abertura da Sessão
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                            Disputa de Lances
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-base font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] leading-snug">
                            {fichaTecnica.data_abertura || 'Consulte o Edital'}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-[var(--crm-border)] dark:border-[var(--crm-border)] flex items-center gap-1.5 text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)]">
                        <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        <span>Início da etapa competitiva</span>
                      </div>
                    </div>

                    {/* 2. Limite para Envio de Propostas */}
                    <div className="bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.9)] p-4 rounded-xl border border-rose-200/80 dark:border-rose-900/60 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                            Limite de Propostas
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
                            Prazo Fatal
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-base font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] leading-snug">
                            {fichaTecnica.data_limite_proposta || 'Não identificado'}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-rose-100/70 dark:border-rose-900/50 flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Envio eletrônico via sistema</span>
                      </div>
                    </div>

                    {/* 3. Limite de Esclarecimentos & Impugnação */}
                    <div className="bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.9)] p-4 rounded-xl border border-[var(--crm-border)] dark:border-[var(--crm-border)] shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold uppercase tracking-wider text-[rgb(var(--crm-muted-rgb)_/_1)]">
                            Impugnação & Dúvidas
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                            Lei 14.133
                          </span>
                        </div>
                        <div className="text-xs text-[rgb(var(--crm-ink-rgb)_/_1)] font-medium mt-1 leading-relaxed">
                          {fichaTecnica.data_fim_esclarecimento || 'Não identificado'}
                        </div>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-[var(--crm-border)] dark:border-[var(--crm-border)] flex items-center gap-1.5 text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)]">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <span>Art. 164 da Lei 14.133/2021</span>
                      </div>
                    </div>

                    {/* 4. Valor Total Estimado */}
                    <div className="bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.9)] p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                            Valor Global Estimado
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                            Referência
                          </span>
                        </div>
                        <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">
                          {formatarMoeda(fichaTecnica.valor_estimado_total)}
                        </div>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-emerald-100/70 dark:border-emerald-900/50 flex items-center gap-1.5 text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)]">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        <span>Critério: {fichaTecnica.criterio_julgamento}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1. Resumo Executivo (até 3 parágrafos) */}
                <div className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-6 rounded-xl border border-[var(--crm-border)] shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 rounded-lg">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] uppercase tracking-wider">
                      Resumo Executivo (Síntese da Contratação)
                    </h3>
                  </div>
                  <div className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm leading-relaxed space-y-3 whitespace-pre-line bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.6)] p-4 rounded-xl border border-[var(--crm-border)] dark:border-[var(--crm-border)]">
                    {fichaTecnica.resumo_executivo}
                  </div>
                </div>

                {/* Grid Duplo: Habilitação e Prazos/Locais */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 2. Requisitos de Habilitação */}
                  <div className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-6 rounded-xl border border-[var(--crm-border)] shadow-sm flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 rounded-lg">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] uppercase tracking-wider">
                        Requisitos de Habilitação (Lei 14.133/2021)
                      </h3>
                    </div>

                    <div className="space-y-4 flex-1">
                      <div>
                        <span className="text-xs font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] uppercase block mb-1.5">
                          Atestados de Capacidade Técnica
                        </span>
                        <ul className="space-y-1.5 text-xs text-[rgb(var(--crm-ink-rgb)_/_1)]">
                          {(fichaTecnica.requisitos_habilitacao?.atestados_capacidade_tecnica || []).map((att, i) => (
                            <li key={i} className="flex items-start gap-2 bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.6)] p-2.5 rounded-lg border border-[var(--crm-border)] dark:border-[var(--crm-border)]">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                              <span>{att}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <span className="text-xs font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] uppercase block mb-1.5">
                          Índices Contábeis e Econômicos Exigidos
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {(fichaTecnica.requisitos_habilitacao?.exigencias_contabeis || []).map((ind, i) => (
                            <div key={i} className="bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.6)] p-2.5 rounded-lg border border-[var(--crm-border)] dark:border-[var(--crm-border)] text-xs">
                              <span className="font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] block">{ind.nome_indice}</span>
                              <span className="text-emerald-700 dark:text-emerald-400 font-mono mt-0.5 block">{ind.regra}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="text-xs font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] uppercase block mb-1.5">
                          Certidões e Registros Específicos
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {(fichaTecnica.requisitos_habilitacao?.certidoes_e_registros_especificos || []).map((cert, i) => (
                            <span key={i} className="text-[11px] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] px-2 py-1 rounded-md border border-[var(--crm-border)] dark:border-[var(--crm-border)]">
                              {cert}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Prazos, Execução e Locais */}
                  <div className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-6 rounded-xl border border-[var(--crm-border)] shadow-sm flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-lg">
                        <Clock className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] uppercase tracking-wider">
                        Prazos de Execução, Vigência e Locais
                      </h3>
                    </div>

                    <div className="space-y-4 flex-1">
                      <div className="bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.6)] p-3 rounded-lg border border-[var(--crm-border)] dark:border-[var(--crm-border)]">
                        <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] block mb-1">Prazo para Início / Entrega</span>
                        <span className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                          {fichaTecnica.prazos_e_locais?.prazo_inicio_entrega || 'Não identificado'}
                        </span>
                      </div>

                      <div className="bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.6)] p-3 rounded-lg border border-[var(--crm-border)] dark:border-[var(--crm-border)]">
                        <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] block mb-1">Vigência Contratual</span>
                        <span className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                          {fichaTecnica.prazos_e_locais?.vigencia_contrato || 'Não identificado'}
                        </span>
                      </div>

                      <div className="bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.6)] p-3 rounded-lg border border-[var(--crm-border)] dark:border-[var(--crm-border)]">
                        <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] block mb-1">Regime de Execução</span>
                        <span className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                          {fichaTecnica.prazos_e_locais?.regime_execucao || 'Não identificado'}
                        </span>
                      </div>

                      <div>
                        <span className="text-xs font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] uppercase block mb-1.5">
                          Locais de Prestação / Entrega
                        </span>
                        <div className="space-y-1 text-xs text-[rgb(var(--crm-ink-rgb)_/_1)]">
                          {(fichaTecnica.prazos_e_locais?.locais_prestacao_entrega || []).map((loc, i) => (
                            <div key={i} className="flex items-center gap-1.5 bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.6)] p-2 rounded border border-[var(--crm-border)] dark:border-[var(--crm-border)]">
                              <MapPin className="w-3.5 h-3.5 text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]" />
                              <span>{loc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Pontos de Atenção e Matriz de Riscos */}
                <div className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-6 rounded-xl border border-[var(--crm-border)] shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 rounded-lg">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] uppercase tracking-wider">
                      Matriz de Risco & Cláusulas Críticas (Auditoria Preventiva)
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {/* Amostras / PoC */}
                    <div className="p-4 rounded-xl border border-[var(--crm-border)] dark:border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.6)]">
                      <span className="text-xs font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] uppercase block mb-1">Exigência de Amostra / PoC</span>
                      <p className="text-xs text-[rgb(var(--crm-ink-rgb)_/_1)] leading-relaxed">
                        {fichaTecnica.pontos_de_atencao_risco?.exigencia_amostra_poc || "Não identificado."}
                      </p>
                    </div>

                    {/* Vistoria */}
                    <div className="p-4 rounded-xl border border-[var(--crm-border)] dark:border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.6)]">
                      <span className="text-xs font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] uppercase block mb-1">Regra de Vistoria Técnica</span>
                      <p className="text-xs text-[rgb(var(--crm-ink-rgb)_/_1)] leading-relaxed">
                        {fichaTecnica.pontos_de_atencao_risco?.regras_vistoria?.detalhes_e_prazo || "Não identificado."}
                      </p>
                    </div>

                    {/* Garantia Contratual */}
                    <div className="p-4 rounded-xl border border-[var(--crm-border)] dark:border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.6)]">
                      <span className="text-xs font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] uppercase block mb-1">Garantia Contratual</span>
                      <p className="text-xs text-[rgb(var(--crm-ink-rgb)_/_1)] leading-relaxed">
                        {fichaTecnica.pontos_de_atencao_risco?.garantia_contratual || "Não identificado."}
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] uppercase block mb-2">Cláusulas Punitivas e Sanções</span>
                    <div className="space-y-1.5">
                      {(fichaTecnica.pontos_de_atencao_risco?.clausulas_punitivas_multas || []).map((pun, i) => (
                        <div key={i} className="text-xs text-rose-900 dark:text-rose-300 bg-rose-50/70 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/60 p-2.5 rounded-lg flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0" />
                          <span>{pun}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 5. Matriz de Itens do TR */}
                <div className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-6 rounded-xl border border-[var(--crm-border)] shadow-sm">
                  {/* Banner de Feedback de Salvamento */}
                  {feedbackSalvo && (
                    <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-xl text-xs font-medium flex items-center justify-between shadow-xs animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        <span>{feedbackSalvo}</span>
                      </div>
                      <button onClick={() => setFeedbackSalvo(null)} className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[var(--crm-border)] dark:border-[var(--crm-border)]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="p-1.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 rounded-lg">
                        <Boxes className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] uppercase tracking-wider">
                          Matriz de Itens e Quantitativos (Extraídos do TR)
                        </h3>
                        <p className="text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)]">
                          Edite os itens, unidades, quantitativos e valores antes de salvar ou exportar em PDF
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 ml-1">
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] font-medium">
                          {isModoEdicaoTabela ? itensRascunho.length : (fichaTecnica.matriz_itens?.length || 0)} itens
                        </span>
                        {isModoEdicaoTabela && (
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-semibold flex items-center gap-1">
                            <Pencil className="w-3 h-3" /> Edição em Tabela Ativa
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {!isModoEdicaoTabela ? (
                        <>
                          <button
                            type="button"
                            onClick={handleIniciarEdicaoTabela}
                            className="px-3 py-1.5 bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                            title="Editar diretamente nas células da tabela"
                          >
                            <Pencil className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span>Editar na Tabela</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleAbrirNovoItem}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                            title="Adicionar um novo item à matriz"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Adicionar Item</span>
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              if (!await persistirFichaServidor(fichaTecnica)) return;
                              mostrarFeedback("Matriz de Itens salva e sincronizada com sucesso!");
                            }}
                            disabled={salvandoFicha}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-75"
                            title="Salvar itens da matriz"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{salvandoFicha ? 'Salvando...' : 'Salvar Itens'}</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={handleAdicionarLinhaRascunho}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                            title="Inserir mais um item na lista"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Nova Linha</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleCancelarEdicaoTabela}
                            className="px-3 py-1.5 bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs"
                            title="Descartar alterações não salvas"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Cancelar</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleSalvarEdicaoTabela}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all"
                            title="Salvar alterações na matriz de itens"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Salvar Alterações</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[var(--crm-border)] text-xs font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] uppercase bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.6)]">
                          <th className="py-2.5 px-3 w-14">Item</th>
                          <th className="py-2.5 px-3 w-32">Código/CATMAT</th>
                          <th className="py-2.5 px-3">Especificação Sucinta</th>
                          <th className="py-2.5 px-3 w-20">Unid.</th>
                          <th className="py-2.5 px-3 text-right w-24">Qtd.</th>
                          <th className="py-2.5 px-3 text-right w-36">Valor Estimado Unit.</th>
                          <th className="py-2.5 px-3 text-right w-36">Valor Total</th>
                          <th className="py-2.5 px-3 text-center w-24">Ações</th>
                        </tr>
                      </thead>

                      {!isModoEdicaoTabela ? (
                        <tbody className="divide-y divide-[var(--crm-border)] dark:divide-[var(--crm-border)] text-xs text-[rgb(var(--crm-ink-rgb)_/_1)]">
                          {(fichaTecnica.matriz_itens || []).map((it, idx) => (
                            <tr key={idx} className="hover:bg-[rgb(var(--crm-surface-rgb)_/_0.8)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_0.5)] transition-colors group">
                              <td className="py-3 px-3 font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">{it.item_numero || idx + 1}</td>
                              <td className="py-3 px-3 font-mono text-[rgb(var(--crm-muted-rgb)_/_1)]">{it.codigo_catalogo || '-'}</td>
                              <td className="py-3 px-3 max-w-md font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] leading-relaxed">
                                {it.especificacao_sucinta}
                              </td>
                              <td className="py-3 px-3 uppercase font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{it.unidade}</td>
                              <td className="py-3 px-3 text-right font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">{it.quantitativo}</td>
                              <td className="py-3 px-3 text-right text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                                {it.valor_estimado_unitario ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(it.valor_estimado_unitario) : '-'}
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-emerald-700 dark:text-emerald-400">
                                {it.valor_estimado_total ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(it.valor_estimado_total) : '-'}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleAbrirEditarItem(it)}
                                    className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950 dark:hover:bg-blue-50/60 dark:hover:bg-blue-950/60 rounded-lg transition-colors"
                                    title="Editar este item"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const num = it.item_numero || idx + 1;
                                      if (confirm(`Tem certeza que deseja remover o item ${num}?`)) {
                                        handleExcluirItem(num);
                                      }
                                    }}
                                    className="p-1.5 text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950 dark:hover:bg-rose-50/60 dark:hover:bg-rose-950/60 rounded-lg transition-colors"
                                    title="Excluir este item"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      ) : (
                        <tbody className="divide-y divide-[var(--crm-border)] dark:divide-[var(--crm-border)] text-xs text-[rgb(var(--crm-ink-rgb)_/_1)] bg-[rgb(var(--crm-surface-rgb)_/_0.4)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)]">
                          {itensRascunho.map((it, idx) => (
                            <tr key={idx} className="hover:bg-blue-50/30 dark:hover:bg-blue-950/30 dark:hover:bg-blue-50/20 dark:hover:bg-blue-950/20 transition-colors">
                              <td className="py-2 px-2 align-top">
                                <input
                                  type="number"
                                  min="1"
                                  value={it.item_numero}
                                  onChange={(e) => handleAlterarItemRascunho(idx, 'item_numero', parseInt(e.target.value) || 1)}
                                  className="w-14 px-2 py-1.5 border border-[var(--crm-border)] dark:border-[var(--crm-border)] rounded-lg text-center font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] focus:ring-2 focus:ring-blue-500 bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)]"
                                />
                              </td>
                              <td className="py-2 px-2 align-top">
                                <input
                                  type="text"
                                  value={it.codigo_catalogo || ''}
                                  onChange={(e) => handleAlterarItemRascunho(idx, 'codigo_catalogo', e.target.value)}
                                  placeholder="CATSER/CATMAT"
                                  className="w-28 px-2 py-1.5 border border-[var(--crm-border)] dark:border-[var(--crm-border)] rounded-lg font-mono text-[11px] text-[rgb(var(--crm-ink-rgb)_/_1)] focus:ring-2 focus:ring-blue-500 bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)]"
                                />
                              </td>
                              <td className="py-2 px-2 align-top">
                                <textarea
                                  rows={2}
                                  value={it.especificacao_sucinta}
                                  onChange={(e) => handleAlterarItemRascunho(idx, 'especificacao_sucinta', e.target.value)}
                                  placeholder="Descrição do item conforme TR..."
                                  className="w-full px-2 py-1.5 border border-[var(--crm-border)] dark:border-[var(--crm-border)] rounded-lg text-xs leading-relaxed text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] focus:ring-2 focus:ring-blue-500 resize-y bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)]"
                                  required
                                />
                              </td>
                              <td className="py-2 px-2 align-top">
                                <input
                                  type="text"
                                  value={it.unidade}
                                  onChange={(e) => handleAlterarItemRascunho(idx, 'unidade', e.target.value.toUpperCase())}
                                  placeholder="UN, MÊS"
                                  className="w-16 px-2 py-1.5 border border-[var(--crm-border)] dark:border-[var(--crm-border)] rounded-lg text-center uppercase font-bold text-xs text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] focus:ring-2 focus:ring-blue-500 bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)]"
                                  required
                                />
                              </td>
                              <td className="py-2 px-2 align-top">
                                <input
                                  type="number"
                                  min="1"
                                  value={it.quantitativo}
                                  onChange={(e) => handleAlterarItemRascunho(idx, 'quantitativo', parseFloat(e.target.value) || 1)}
                                  className="w-20 px-2 py-1.5 border border-[var(--crm-border)] dark:border-[var(--crm-border)] rounded-lg text-right font-bold text-xs text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] focus:ring-2 focus:ring-blue-500 bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)]"
                                  required
                                />
                              </td>
                              <td className="py-2 px-2 align-top">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={it.valor_estimado_unitario ?? 0}
                                  onChange={(e) => handleAlterarItemRascunho(idx, 'valor_estimado_unitario', parseFloat(e.target.value) || 0)}
                                  className="w-32 px-2 py-1.5 border border-[var(--crm-border)] dark:border-[var(--crm-border)] rounded-lg text-right font-semibold text-xs text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] focus:ring-2 focus:ring-blue-500 bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)]"
                                />
                              </td>
                              <td className="py-2 px-2 align-top">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={it.valor_estimado_total ?? 0}
                                  onChange={(e) => handleAlterarItemRascunho(idx, 'valor_estimado_total', parseFloat(e.target.value) || 0)}
                                  className="w-32 px-2 py-1.5 border border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/40 rounded-lg text-right font-bold text-emerald-900 dark:text-emerald-200 text-xs focus:ring-2 focus:ring-emerald-500"
                                />
                              </td>
                              <td className="py-2 px-2 text-center align-top pt-3">
                                <button
                                  type="button"
                                  onClick={() => handleRemoverLinhaRascunho(idx)}
                                  className="p-1.5 text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950 dark:hover:bg-rose-50/60 dark:hover:bg-rose-950/60 rounded-lg transition-colors"
                                  title="Remover linha"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      )}

                      {/* Linha de Totais da Matriz */}
                      <tfoot>
                        <tr className="border-t-2 border-[var(--crm-border)] dark:border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] font-semibold text-xs text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                          <td colSpan={6} className="py-3 px-3 text-right uppercase tracking-wider font-bold">
                            Total Geral da Matriz de Itens:
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-sm text-emerald-700 dark:text-emerald-400">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                              (isModoEdicaoTabela ? itensRascunho : (fichaTecnica.matriz_itens || [])).reduce(
                                (acc, it) => acc + (it.valor_estimado_total || 0), 0
                              )
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isModoEdicaoTabela && (
                              <button
                                type="button"
                                onClick={handleAdicionarLinhaRascunho}
                                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
                              >
                                + Linha
                              </button>
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Barra de Ações Inferior durante Modo de Edição em Tabela */}
                  {isModoEdicaoTabela && (
                    <div className="mt-4 pt-4 border-t border-[var(--crm-border)] dark:border-[var(--crm-border)] flex flex-wrap items-center justify-between gap-3 bg-blue-50/50 dark:bg-blue-950/40 p-4 rounded-xl">
                      <div className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                        Total calculado em tempo real:{' '}
                        <strong className="text-emerald-800 dark:text-emerald-400 text-sm">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                            itensRascunho.reduce((acc, it) => acc + (it.valor_estimado_total || 0), 0)
                          )}
                        </strong>{' '}
                        ({itensRascunho.length} itens)
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleAdicionarLinhaRascunho}
                          className="px-3.5 py-2 bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Adicionar Outro Item</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelarEdicaoTabela}
                          className="px-4 py-2 bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] rounded-lg text-xs font-medium transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSalvarEdicaoTabela}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                        >
                          <Check className="w-4 h-4" />
                          <span>Salvar Alterações na Matriz</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'architecture' && (
          <div className="space-y-6">
            <div className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-6 rounded-xl border border-[var(--crm-border)] shadow-sm">
              <h2 className="text-lg font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mb-2">Visão Arquitetural do Submódulo</h2>
              <p className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] leading-relaxed mb-6">
                O submódulo foi desenhado em 4 camadas desacopladas e resilientes para suportar downloads massivos,
                PDFs e documentos Word (.docx/.doc) com centenas de páginas e extração com custo de token otimizado.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold text-sm mb-3">
                      1
                    </div>
                    <h3 className="font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm mb-1">Download & Classificação</h3>
                    <p className="text-xs text-[rgb(var(--crm-ink-rgb)_/_1)] leading-relaxed">
                      Download assíncrono com <code>httpx</code> e retry exponencial. Classificador heurístico e regex para separar <strong>Edital Principal</strong> de <strong>Termo de Referência</strong> em PDF ou Word.
                    </p>
                  </div>
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 font-mono mt-4 block">downloader_classifier.py</span>
                </div>

                <div className="p-5 rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold text-sm mb-3">
                      2
                    </div>
                    <h3 className="font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm mb-1">Text Chunker Semântico</h3>
                    <p className="text-xs text-[rgb(var(--crm-ink-rgb)_/_1)] leading-relaxed">
                      Streaming de páginas com <code>pdfplumber</code> (com fallback de OCR por página via <code>pytesseract</code>) e parsing de Word com <code>python-docx</code>. Isola seções da Lei 14.133/2021.
                    </p>
                  </div>
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono mt-4 block">chunker_extractor.py</span>
                </div>

                <div className="p-5 rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-400 flex items-center justify-center font-bold text-sm mb-3">
                      3
                    </div>
                    <h3 className="font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm mb-1">Sumarização LLM</h3>
                    <p className="text-xs text-[rgb(var(--crm-ink-rgb)_/_1)] leading-relaxed">
                      Schemas estritos com <code>pydantic</code> v2 e invocação de LLMs via <strong>Extração estruturada</strong> (JSON Schema Mode), garantindo extração determinística sem alucinações.
                    </p>
                  </div>
                  <span className="text-[11px] text-violet-600 dark:text-violet-400 font-mono mt-4 block">summarizer.py</span>
                </div>

                <div className="p-5 rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-sm mb-3">
                      4
                    </div>
                    <h3 className="font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm mb-1">Sync com Elasticsearch</h3>
                    <p className="text-xs text-[rgb(var(--crm-ink-rgb)_/_1)] leading-relaxed">
                      Upsert no índice <code>licitacoes</code>. Indexa o resumo executivo no analyzer em português, matriz de itens no array <code>nested</code> e tags de risco em campos keyword.
                    </p>
                  </div>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-4 block">elastic_sync.py</span>
                </div>
              </div>
            </div>

            {/* Suporte a Documentos Word (.docx e .doc) */}
            <div className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-6 rounded-xl border border-[var(--crm-border)] shadow-sm">
              <h3 className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] uppercase tracking-wider mb-3">
                Suporte Híbrido a Formatos (PDF & Microsoft Word)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[rgb(var(--crm-ink-rgb)_/_1)]">
                <div className="bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] p-4 rounded-xl border border-[var(--crm-border)] dark:border-[var(--crm-border)]">
                  <span className="font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] block mb-1">1. Word .docx e .doc</span>
                  <p className="leading-relaxed">
                    Muitos Termos de Referência e anexos de órgãos municipais são emitidos em Word (.docx). O extrator utiliza <code>python-docx</code> no backend e <code>mammoth</code> no servidor web para extrair parágrafos e tabelas intactas.
                  </p>
                </div>
                <div className="bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] p-4 rounded-xl border border-[var(--crm-border)] dark:border-[var(--crm-border)]">
                  <span className="font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] block mb-1">2. PDFs Digitais (Vetoriais)</span>
                  <p className="leading-relaxed">
                    Processamento direto e veloz com <code>pdfplumber</code> e <code>pdf-parse</code>, recuperando a hierarquia de títulos, artigos, cláusulas contratuais e colunas de tabelas.
                  </p>
                </div>
                <div className="bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] p-4 rounded-xl border border-[var(--crm-border)] dark:border-[var(--crm-border)]">
                  <span className="font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] block mb-1">3. PDFs Digitalizados (OCR)</span>
                  <p className="leading-relaxed">
                    Fallback automático por página via <code>pytesseract</code> quando o texto nativo estiver ausente ou corrompido, garantindo que nenhum edital fique sem processamento.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'code' && (
          <div className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-6 rounded-xl border border-[var(--crm-border)] shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--crm-border)] pb-3">
              <div>
                <h2 className="text-base font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">Módulos Python 3.11+ Prontos para Produção</h2>
                <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">Arquivos localizados no diretório <code className="text-indigo-600 dark:text-indigo-400">/backend/analysis/</code></p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'pipeline', label: 'pipeline.py' },
                  { id: 'schemas', label: 'schemas.py' },
                  { id: 'downloader', label: 'downloader_classifier.py' },
                  { id: 'chunker', label: 'chunker_extractor.py' },
                  { id: 'summarizer', label: 'summarizer.py' },
                  { id: 'elastic', label: 'elastic_sync.py' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setCodeTab(tab.id as any)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                      codeTab === tab.id
                        ? "bg-[rgb(var(--crm-surface-2-rgb)_/_1)] dark:bg-blue-600 text-[var(--crm-ink)] dark:text-white"
                        : "bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_1)]"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Visualizador de Código das Peças */}
            <div className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-[600px] border border-[var(--crm-border)]">
              {codeTab === 'pipeline' && (
                <pre>{`# backend/analysis/pipeline.py
import asyncio
from .downloader_classifier import AsyncDocumentDownloader, DocumentClassifier
from .chunker_extractor import SemanticChunkerExtractor
from .summarizer import LLMDocumentSummarizer
from .elastic_sync import ElasticLicitacoesSync

class AnaliseEditalTRPipeline:
    def __init__(self, openai_api_key=None, elasticsearch_host=None):
        self.downloader = AsyncDocumentDownloader()
        self.classifier = DocumentClassifier()
        self.chunker = SemanticChunkerExtractor()
        self.summarizer = LLMDocumentSummarizer(api_key=openai_api_key)
        self.elastic_sync = ElasticLicitacoesSync(hosts=elasticsearch_host)

    async def processar_certame(self, id_licitacao: str, urls_documentos: list[str]):
        # 1. Download assíncrono dos PDFs ou DOCX
        downloads = await self.downloader.baixar_lote(urls_documentos, id_licitacao)
        arquivos = [p for _, p in downloads if p]

        # 2. Classificação: Edital Principal vs Termo de Referência (TR)
        docs_classificados = [self.classifier.classificar_documento(f) for f in arquivos]
        par = self.classifier.selecionar_par_edital_tr(docs_classificados)

        # 3. Text Chunking focado na Lei 14.133/2021 (suporta PDF e Word .docx)
        secoes_edital = self.chunker.extrair_secoes_criticas(par["edital"].caminho_arquivo, "EDITAL")
        secoes_tr = self.chunker.extrair_secoes_criticas(par["termo_referencia"].caminho_arquivo, "TERMO_REFERENCIA")
        pacote = self.chunker.montar_pacote_contexto_llm(secoes_edital, secoes_tr)

        # 4. Sumarização estruturada com LLM (Extração estruturada)
        ficha_tecnica = await self.summarizer.extrair_ficha_tecnica(id_licitacao, pacote)

        # 5. Atualização e indexação no Elasticsearch
        await self.elastic_sync.indexar_analise(id_licitacao, ficha_tecnica)
        return ficha_tecnica`}</pre>
              )}

              {codeTab === 'schemas' && (
                <pre>{`# backend/analysis/schemas.py
from typing import List, Optional
from pydantic import BaseModel, Field

class MatrizItem(BaseModel):
    item_numero: Optional[int]
    codigo_catalogo: Optional[str]
    especificacao_sucinta: str
    unidade: str = "UN"
    quantitativo: float
    valor_estimado_unitario: Optional[float] = None
    valor_estimado_total: Optional[float] = None

class RequisitosHabilitacao(BaseModel):
    atestados_capacidade_tecnica: List[str]
    certidoes_e_registros_especificos: List[str]
    exigencias_contabeis: List[dict]
    qualificacao_equipe_chave: List[str]

class FichaTecnicaEditalTR(BaseModel):
    id_licitacao: str
    orgao_comprador: str
    resumo_executivo: str = Field(description="Síntese em até 3 parágrafos")
    requisitos_habilitacao: RequisitosHabilitacao
    prazos_e_locais: dict
    pontos_de_atencao_risco: dict
    matriz_itens: List[MatrizItem]
    tags_classificacao: List[str]`}</pre>
              )}

              {codeTab === 'downloader' && (
                <pre>{`# backend/analysis/downloader_classifier.py
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

class DocumentClassifier:
    def classificar_documento(self, caminho_arquivo):
        # Suporta PDF (pdfplumber) e Word (python-docx)
        # Inspeciona nome, metadados internos e texto inicial com regex
        # Distingue: EDITAL_PRINCIPAL, TERMO_REFERENCIA, PROJETO_BASICO
        ...`}</pre>
              )}

              {codeTab === 'chunker' && (
                <pre>{`# backend/analysis/chunker_extractor.py
import pdfplumber
import pytesseract
import docx

class SemanticChunkerExtractor:
    # Segmenta cláusulas segundo a Lei 14.133/2021:
    # Edital: Habilitação Técnica, Índices Contábeis, Critérios de Julgamento, Penalidades
    # TR: Especificações do Objeto, Obrigações e Prazos, Vistoria, Amostras/PoC
    def extrair_secoes_criticas(self, caminho_arquivo, tipo_documento):
        if caminho_arquivo.suffix.lower() in ('.docx', '.doc'):
            return self._extrair_secoes_docx(caminho_arquivo, tipo_documento)
        # Processamento de PDF com fallback OCR por página...`}</pre>
              )}

              {codeTab === 'summarizer' && (
                <pre>{`# backend/analysis/summarizer.py
from openai import AsyncOpenAI
from .schemas import FichaTecnicaEditalTR

class LLMDocumentSummarizer:
    async def extrair_ficha_tecnica(self, id_licitacao, pacote_contexto):
        # Utiliza Extração estruturada nativo do OpenAI/Anthropic/Gemini
        completion = await self.client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_LEI_14133},
                {"role": "user", "content": prompt_contextualizado}
            ],
            response_format=FichaTecnicaEditalTR
        )
        return completion.choices[0].message.parsed`}</pre>
              )}

              {codeTab === 'elastic' && (
                <pre>{`# backend/analysis/elastic_sync.py
from elasticsearch import AsyncElasticsearch

class ElasticLicitacoesSync:
    async def indexar_analise(self, id_licitacao, ficha: FichaTecnicaEditalTR):
        # Upsert no Elasticsearch indexando:
        # - resumo_executivo com pt_analyzer
        # - matriz de itens no array nested 'itens'
        # - tags de risco em campos keyword para filtros facetados
        await self.client.update(
            index="licitacoes",
            id=id_licitacao,
            body={
                "doc": {
                    "resumo_executivo": ficha.resumo_executivo,
                    "itens": [it.model_dump() for it in ficha.matriz_itens],
                    "tags_risco": ficha.tags_classificacao,
                    "ficha_tecnica": ficha.model_dump()
                },
                "doc_as_upsert": True
            }
        )`}</pre>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Visualização em PDF com Barra de Ferramentas e Impressão */}
      <PdfViewerModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        pdfBlobUrl={pdfBlobUrl}
        ficha={fichaTecnica}
        onDownload={handleSalvarPdf}
        documentTitle={`Ficha Técnica - ${fichaTecnica?.orgao_comprador || 'Licitação'}`}
      />

      {/* Modal de Edição Detalhada do Item */}
      <EditarItemModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setItemEmEdicao(null);
        }}
        item={itemEmEdicao}
        onSave={handleSalvarItemModal}
        onDelete={handleExcluirItem}
        isNovo={isNovoItem}
      />
    </div>
  );
};
