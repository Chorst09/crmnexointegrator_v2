import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Filter, X, ExternalLink, Loader2, Heart,
  MapPin, Calendar, Lock, Plus, Bell, Settings, RefreshCcw, CheckCircle, Trash2,
  BookmarkPlus, ThumbsUp, ThumbsDown, Tag, Building2, ClipboardList
} from 'lucide-react';
import { buildApiUrl, getAuthHeaders } from '../config/api';

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTADOS_BR = [
  { sigla: 'AC', nome: 'Acre' }, { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' }, { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' }, { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' }, { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' }, { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' }, { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' }, { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' }, { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' }, { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' }, { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' }, { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' }, { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' }, { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' }
];

const FONTES_CONFIG = [
  { id: 'pncp', nome: 'PNCP Oficial', descricao: 'Portal Nacional de Contratações Públicas', metodo: 'API REST', sync: 'Tempo Real', icon: '🏛️' },
  { id: 'comprasnet', nome: 'ComprasNet', descricao: 'Licitações do Compras.gov.br (SIASG / Lei 8.666)', metodo: 'API REST', sync: 'Tempo Real', icon: '🇧🇷', defaultActive: false },
  { id: 'transparencia-curitiba', nome: 'Transparência Curitiba', descricao: 'Licitações e contratações do Portal da Transparência de Curitiba', metodo: 'Portal público', sync: 'Sob demanda', icon: '🏙️' },
  { id: 'transparencia-federal', nome: 'Portal Transparência Federal', descricao: 'Licitações do Poder Executivo Federal via API oficial da CGU', metodo: 'API com token', sync: 'Sob demanda', icon: '🔎', defaultActive: false },
  { id: 'dispensas', nome: 'Compras.gov.br Dispensas', descricao: 'Dispensas e inexigibilidades (Lei 8.666 e 14.133)', metodo: 'API REST', sync: 'Tempo Real', icon: '📄', defaultActive: false },
  { id: 'contratacoes14133', nome: 'Contratações Lei 14.133', descricao: 'Contratações PNCP via Compras.gov.br', metodo: 'API REST', sync: 'Tempo Real', icon: '⚖️', defaultActive: false },
  { id: 'arp', nome: 'Atas de Registro de Preço', descricao: 'Atas ARP vigentes do Compras.gov.br', metodo: 'API REST', sync: 'Tempo Real', icon: '📋', defaultActive: false },
  { id: 'pregoes', nome: 'Pregões (SIASG)', descricao: 'Pregões legados do Compras.gov.br', metodo: 'API REST', sync: 'Tempo Real', icon: '📢', defaultActive: false },
  { id: 'dou', nome: 'Imprensa Nacional (DOU)', descricao: 'Avisos, editais e contratações publicados no Diário Oficial da União', metodo: 'Consulta oficial', sync: 'Tempo Real', icon: '📰' },
  { id: 'curitiba-ecompras', nome: 'e-Compras Curitiba', descricao: 'Portal de Compras Eletrônicas do Município de Curitiba', metodo: 'Portal público', sync: 'Sob demanda', icon: '🏙️', defaultActive: false }
];

const FONTES_STORAGE_KEY = 'b2g_fontes_integradas_v1';
const LICITACOES_GERENCIADAS_KEY = 'b2g_licitacoes_gerenciadas_v1';
const FONTES_PADRAO_ATIVAS = FONTES_CONFIG.filter(fonte => fonte.defaultActive !== false).map(fonte => fonte.id);

const FONTES_PAGAS = [
  { portal: 'bll', nome: 'BLL Compras', descricao: 'Bolsa de Licitações e Leilões', metodo: 'Portal autenticado', sync: 'Sob demanda', icon: '⚖️' }
];

const PORTAIS_INTEGRADOS_SUPORTADOS = new Set(FONTES_PAGAS.map(fonte => fonte.portal));

const novaFonteForm = () => ({
  portal: 'bll',
  nome: 'BLL Compras',
  usuario: '',
  senha: '',
  ativa: true
});

const readFontesIntegradas = () => {
  try {
    const fontes = JSON.parse(localStorage.getItem(FONTES_STORAGE_KEY) || '[]');
    return Array.isArray(fontes)
      ? fontes.filter(fonte => PORTAIS_INTEGRADOS_SUPORTADOS.has(fonte.portal))
      : [];
  } catch {
    return [];
  }
};

const ORDENS = [
  { value: 'data_desc', label: 'Mais recentes primeiro' },
  { value: 'data_asc', label: 'Mais antigos primeiro' },
  { value: 'valor_desc', label: 'Maior valor primeiro' },
  { value: 'valor_asc', label: 'Menor valor primeiro' },
  { value: 'abertura_asc', label: 'Abertura mais próxima' }
];

const CATEGORIAS_PRODUTO_TI = [
  { id: 'microcomputadores', label: 'Computadores e Desktops', keywords: ['microcomputador', 'microcomputadores', 'computador', 'computadores', 'desktop', 'pc', 'computador de mesa', 'all in one', 'all-in-one', 'cpu', 'gabinete'] },
  { id: 'workstations', label: 'Workstations', keywords: ['workstation', 'estação de trabalho', 'estacao de trabalho'] },
  { id: 'monitores', label: 'Monitores', keywords: ['monitor', 'display'] },
  { id: 'teclados', label: 'Teclados', keywords: ['teclado'] },
  { id: 'mouses', label: 'Mouses', keywords: ['mouse'] },
  { id: 'telas_interativas', label: 'Telas Interativas', keywords: ['tela interativa', 'lousa digital', 'painel interativo', 'quadro interativo', 'display interativo'] },
  { id: 'webcams', label: 'Webcams', keywords: ['webcam', 'web cam'] },
  { id: 'notebooks', label: 'Notebooks', keywords: ['notebook', 'laptop', 'portátil', 'portatil'] },
  { id: 'tablets', label: 'Tablets', keywords: ['tablet'] },
  { id: 'servidores', label: 'Servidores', keywords: ['servidor', 'server'] },
  { id: 'switches', label: 'Switches', keywords: ['switch'] },
  { id: 'access_points', label: 'Access Points', keywords: ['access point', 'ponto de acesso', 'accesspoint', 'ap wifi'] },
  { id: 'roteadores', label: 'Roteadores', keywords: ['roteador', 'router'] },
  { id: 'impressoras', label: 'Impressoras', keywords: ['impressora', 'printer', 'scanner', 'multifuncional', 'plotter'] },
  { id: 'ups_nobreak', label: 'UPS/Nobreaks', keywords: ['nobreak', 'no-break', 'fonte ininterrupta'] },
  { id: 'armazenamento', label: 'Armazenamento', keywords: ['storage', 'ssd', 'hd', 'nas', 'san', 'backup', 'disco rígido', 'disco rigido', 'disco sólido', 'disco solido'] },
  { id: 'firewall', label: 'Firewalls', keywords: ['firewall', 'firewall utm', 'utm'] },
  { id: 'software', label: 'Software/Licenças', keywords: ['software', 'licença de uso', 'licenca de uso', 'saas', 'sistema de informação', 'sistema de informacao'] },
  { id: 'cameras', label: 'Câmeras/CFTV', keywords: ['cftv', 'videomonitoramento', 'câmera de segurança', 'camera de seguranca'] },
  { id: 'infra_rede', label: 'Infra de Rede', keywords: ['rack', 'patch panel', 'cabeamento estruturado', 'fibra óptica', 'fibra optica', 'cabo de rede', 'cabeamento de rede'] },
  { id: 'equipamento_informatica', label: 'Equip. de Informática', keywords: ['informática', 'informatica', 'suprimento de informática', 'equipamento de ti'] },
];

// Match por palavra inteira para termos simples (evita "monitor" casar com "monitoramento")
const kwMatch = (texto, kw) => {
  if (/^[a-z0-9áéíóúâêôãõçü]+$/i.test(kw)) {
    try { return new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(texto); } catch { return texto.includes(kw); }
  }
  return texto.includes(kw);
};

const STATUS_ENCERRADO_PATTERN = /(encerrad|cancelad|revogad|suspens|anulad|fracassad|desert|homologad|adjudicad)/i;

const parseDateTime = (value, endOfDay = false) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (brMatch) {
    const iso = `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}T${brMatch[4] || (endOfDay ? '23' : '00')}:${brMatch[5] || (endOfDay ? '59' : '00')}:${brMatch[6] || (endOfDay ? '59' : '00')}`;
    const date = new Date(iso);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text) && text.length === 10) {
    const [year, month, day] = text.split('-').map(Number);
    const date = new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date : null;
};

const isEditalVigente = (item) => {
  if (!item) return false;

  // 1. Se tem status explicitamente encerrado, rejeitar
  const status = String(item?.status || '').trim().toLowerCase();
  if (STATUS_ENCERRADO_PATTERN.test(status)) return false;

  // 2. Se tem data de encerramento, ela decide
  const encerramento = parseDateTime(item?.dataEncerramento || item?.dataPrazo || item?.prazo, true);
  if (encerramento) return encerramento.getTime() >= Date.now();

  // 3. Se tem data de abertura futura, é vigente
  const abertura = parseDateTime(item?.dataAbertura || item?.dataAberturaProposta, false);
  if (abertura && abertura.getTime() >= Date.now()) return true;

  // 4. Se tem data de publicação muito antiga (mais de 1 ano), rejeitar
  const publicacao = parseDateTime(item?.dataPublicacao, false);
  if (publicacao) {
    const UM_ANO = 365 * 24 * 60 * 60 * 1000;
    if (publicacao.getTime() < Date.now() - UM_ANO) return false;
  }

  // 5. Se chegou aqui, considerar vigente (padrão permissivo)
  return true;
};

// ─── PNCP API (chamada direta do browser — sem CORS issues pois é API pública) ─

const PNCP_BASE = 'https://pncp.gov.br/api/consulta/v1';

const hoje = () => {
  const d = new Date();
  return d.toISOString().slice(0, 10).replaceAll('-', '');
};
const diasAtras = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10).replaceAll('-', '');
};
// Data máxima com dados reais no PNCP (ajuste conforme necessário)
const dataFimPadrao = () => hoje();
const dataInicioPadrao = () => diasAtras(30);
const toISODate = (s) => {
  if (!s) return null;
  const str = String(s).replaceAll('-', '').slice(0, 8);
  if (str.length < 8) return s;
  return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
};

const matchObjeto = (texto, objeto) => {
  if (!objeto || objeto.trim().length < 2) return true;
  const hay = String(texto || '').toLowerCase();
  return objeto.toLowerCase().split(/\s+/).filter(t => t.length > 2).some(t => hay.includes(t));
};

async function buscarPNCPPublicacao({ objeto, uf, dataInicio, dataFim, tamanhoPagina = 20 }) {
  const dataI = dataInicio ? dataInicio.replaceAll('-', '') : dataInicioPadrao();
  const dataF = dataFim ? dataFim.replaceAll('-', '') : dataFimPadrao();
  const modalidades = [6]; // Pregão eletrônico é a modalidade com maior volume no PNCP.
  const resultados = [];

  // Buscar modalidades em sequência com timeout aumentado e retry
  for (const mod of modalidades) {
    try {
      const url = new URL(`${PNCP_BASE}/contratacoes/publicacao`);
      url.searchParams.set('dataInicial', dataI);
      url.searchParams.set('dataFinal', dataF);
      url.searchParams.set('codigoModalidadeContratacao', mod);
      url.searchParams.set('pagina', 1);
      url.searchParams.set('tamanhoPagina', Math.max(10, Math.min(Number(tamanhoPagina), 50)));
      if (uf) url.searchParams.set('uf', uf);

      let retries = 0;
      let lastError = null;
      
      while (retries >= 0) {
        try {
          const res = await fetch(url.toString(), {
            headers: { 'Accept': 'application/json', 'User-Agent': 'NexosCRM/2.0' },
            signal: AbortSignal.timeout(12000)
          });
          
          if (!res.ok) {
            if (retries > 0) {
              await new Promise(r => setTimeout(r, 1000)); // Aguardar 1s antes de retry
              retries--;
              continue;
            }
            break;
          }
          
          const data = await res.json().catch(() => null);
          const items = Array.isArray(data?.data) ? data.data : [];
          const filtered = items
            .filter(item => matchObjeto(`${item.objetoCompra} ${item.informacaoComplementar}`, objeto))
            .map(item => ({
              id: item.numeroControlePNCP || `pncp-${item.anoCompra}-${item.numeroCompra}-${item.orgaoEntidade?.cnpj}`,
              fonte: 'PNCP',
              fonteLogo: '🏛️',
              titulo: item.objetoCompra || 'Sem descrição',
              orgao: item.orgaoEntidade?.razaoSocial || item.unidadeOrgao?.nomeUnidade || '',
              modalidade: item.modalidadeNome || '',
              uf: item.unidadeOrgao?.ufSigla || uf || '',
              municipio: item.unidadeOrgao?.municipioNome || '',
              valor: item.valorTotalEstimado ? Number(item.valorTotalEstimado) : null,
              dataPublicacao: toISODate(item.dataPublicacaoPncp) || item.dataPublicacaoPncp,
              dataAbertura: toISODate(item.dataAberturaProposta) || item.dataAberturaProposta,
              dataEncerramento: toISODate(item.dataEncerramentoProposta) || item.dataEncerramentoProposta,
              numero: item.numeroCompra || '',
              ano: item.anoCompra || '',
              link: item.linkSistemaOrigem || `https://pncp.gov.br/app/editais/${item.orgaoEntidade?.cnpj}/${item.anoCompra}/${item.sequencialCompra}`,
              status: item.situacaoCompraNome || 'Publicado',
              situacaoCodigo: item.codigoSituacaoCompra
            }));
          
          resultados.push(...filtered);
          break; // Sucesso, sair do loop de retries
        } catch (err) {
          lastError = err;
          if (retries > 0) {
            await new Promise(r => setTimeout(r, 1000));
            retries--;
          } else {
            console.warn(`⚠️ PNCP mod ${mod} falhou após retries:`, err.message);
            break;
          }
        }
      }
    } catch (err) {
      console.warn(`⚠️ PNCP mod ${mod} erro:`, err.message);
    }
  }
  
  return resultados;
}

async function buscarPNCPProposta({ objeto, uf, dataInicio, dataFim, tamanhoPagina = 20 }) {
  try {
    const url = new URL(`${PNCP_BASE}/contratacoes/proposta`);
    url.searchParams.set('dataInicial', dataInicio ? dataInicio.replaceAll('-', '') : dataInicioPadrao());
    url.searchParams.set('dataFinal', dataFim ? dataFim.replaceAll('-', '') : dataFimPadrao());
    url.searchParams.set('pagina', 1);
    url.searchParams.set('tamanhoPagina', Math.max(10, Math.min(Number(tamanhoPagina), 50)));
    if (uf) url.searchParams.set('uf', uf);

    let retries = 0;
    while (retries >= 0) {
      try {
        const res = await fetch(url.toString(), {
          headers: { 'Accept': 'application/json', 'User-Agent': 'NexosCRM/2.0' },
          signal: AbortSignal.timeout(12000)
        });
        
        if (!res.ok) {
          if (retries > 0) {
            await new Promise(r => setTimeout(r, 1000));
            retries--;
            continue;
          }
          return [];
        }
        
        const data = await res.json().catch(() => null);
        const items = Array.isArray(data?.data) ? data.data : [];
        return items
          .filter(item => matchObjeto(`${item.objetoCompra} ${item.informacaoComplementar}`, objeto))
          .map(item => ({
            id: `pncp-prop-${item.numeroControlePNCP || item.anoCompra + item.numeroCompra + item.orgaoEntidade?.cnpj}`,
            fonte: 'PNCP',
            fonteLogo: '🏛️',
            titulo: item.objetoCompra || 'Sem descrição',
            orgao: item.orgaoEntidade?.razaoSocial || item.unidadeOrgao?.nomeUnidade || '',
            modalidade: item.modalidadeNome || '',
            uf: item.unidadeOrgao?.ufSigla || uf || '',
            municipio: item.unidadeOrgao?.municipioNome || '',
            valor: item.valorTotalEstimado ? Number(item.valorTotalEstimado) : null,
            dataPublicacao: toISODate(item.dataPublicacaoPncp) || item.dataPublicacaoPncp,
            dataAbertura: toISODate(item.dataAberturaProposta) || item.dataAberturaProposta,
            dataEncerramento: toISODate(item.dataEncerramentoProposta) || item.dataEncerramentoProposta,
            numero: item.numeroCompra || '',
            ano: item.anoCompra || '',
            link: item.linkSistemaOrigem || `https://pncp.gov.br/app/editais/${item.orgaoEntidade?.cnpj}/${item.anoCompra}/${item.sequencialCompra}`,
            status: 'Em proposta',
            situacaoCodigo: item.codigoSituacaoCompra
          }));
      } catch (err) {
        if (retries > 0) {
          await new Promise(r => setTimeout(r, 1000));
          retries--;
        } else {
          console.warn('⚠️ PNCP Proposta falhou após retries:', err.message);
          return [];
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ PNCP Proposta erro:', err.message);
    return [];
  }
}

async function buscarPNCPProxy({ objeto, uf, dataInicio, dataFim, tamanhoPagina = 20, incluirPropostas = true, apenasVigentes = false }) {
  const url = new URL(buildApiUrl('/b2g-search/search'), window.location.origin);
  url.searchParams.set('fontes', 'pncp');
  url.searchParams.set('objeto', objeto || '');
  url.searchParams.set('uf', uf || '');
  url.searchParams.set('dataInicio', dataInicio || '');
  url.searchParams.set('dataFim', dataFim || '');
  url.searchParams.set('tamanhoPagina', Math.max(10, Math.min(Number(tamanhoPagina), 50)));
  url.searchParams.set('incluirPropostas', incluirPropostas ? 'true' : 'false');
  url.searchParams.set('apenasVigentes', apenasVigentes ? 'true' : 'false');

  const res = await fetch(url.toString(), {
    headers: getAuthHeaders(),
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) {
    const publicacoes = await buscarPNCPPublicacao({ objeto, uf, dataInicio, dataFim, tamanhoPagina });
    const propostas = incluirPropostas ? await buscarPNCPProposta({ objeto, uf, dataInicio, dataFim, tamanhoPagina }) : [];
    return [...publicacoes, ...propostas];
  }

  const payload = await res.json().catch(() => null);
  const data = Array.isArray(payload?.data) ? payload.data : [];
  if (data.length === 0 && Array.isArray(payload?.erros) && payload.erros.length > 0) {
    console.debug('PNCP retornou sem resultados nesta consulta:', payload.erros.slice(0, 2).join('; '));
    throw new Error(payload.erros.slice(0, 2).join('; '));
  }
  return data;
}

// ─── ComprasNet API (dadosabertos.compras.gov.br, via proxy) ─────────────────

const UFS_BR_SET = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]);

const extrairUfEndereco = (endereco) => {
  const match = String(endereco || '').match(/(?:\/|\s*-\s*)\s*([A-Z]{2})\s*$/);
  return match && UFS_BR_SET.has(match[1]) ? match[1] : '';
};

const extrairMunicipioEndereco = (endereco) => {
  const match = String(endereco || '').match(/([^\/-]+?)(?:\/\s*|\s*-\s*)\s*[A-Z]{2}\s*$/);
  if (!match) return '';
  const parts = match[1].trim().split(/\s*-\s*/);
  return parts[parts.length - 1].trim();
};

async function buscarComprasGovProxy(tipo, params) {
  const url = new URL(buildApiUrl('/comprasnet-proxy'), window.location.origin);
  if (tipo) url.searchParams.set('tipo', tipo);
  if (params.objeto) url.searchParams.set('objeto', params.objeto);
  if (params.dataInicio) url.searchParams.set('dataInicio', params.dataInicio);
  if (params.dataFim) url.searchParams.set('dataFim', params.dataFim);
  if (params.uf) url.searchParams.set('uf', params.uf);
  url.searchParams.set('tamanhoPagina', Math.max(10, Math.min(Number(params.tamanhoPagina || 20), 500)));

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(70000)
  });
  if (!res.ok) return [];
  const payload = await res.json().catch(() => null);
  const data = Array.isArray(payload?.data) ? payload.data : [];
  if (data.length === 0 && payload?.erro) {
    throw new Error(payload.erro);
  }
  return data;
}

async function buscarComprasNet({ objeto, uf, dataInicio, dataFim, tamanhoPagina = 20 }) {
  try {
    const items = await buscarComprasGovProxy('licitacao', { objeto, dataInicio, dataFim, tamanhoPagina });

    return items
      .filter(item => matchObjeto(`${item.objetoCompra} ${item.informacaoComplementar}`, objeto))
      .map(item => {
        const itemUf = item.unidadeOrgao?.ufSigla || uf || '';
        if (uf && itemUf !== uf) return null;
        return {
          id: `comprasnet-${item.numeroControlePNCP || item.numeroCompra || Math.random()}`,
          fonte: 'ComprasNet',
          fonteLogo: '🇧🇷',
          titulo: item.objetoCompra || 'Sem descrição',
          orgao: item.orgaoEntidade?.razaoSocial || item.unidadeOrgao?.nomeUnidade || 'ComprasNet',
          modalidade: item.modalidadeNome || '',
          uf: itemUf,
          municipio: item.unidadeOrgao?.municipioNome || '',
          valor: item.valorTotalEstimado ? Number(item.valorTotalEstimado) : null,
          dataPublicacao: item.dataPublicacaoPncp || null,
          dataAbertura: item.dataAberturaProposta || null,
          dataEncerramento: item.dataEncerramentoProposta || null,
          numero: String(item.numeroCompra || ''),
          ano: String(item.anoCompra || ''),
          link: item.linkSistemaOrigem || `https://pncp.gov.br/app/editais/${item.orgaoEntidade?.cnpj}/${item.anoCompra}/${item.sequencialCompra}`,
          status: item.situacaoCompraNome || 'Publicado'
        };
      })
      .filter(Boolean);
  } catch { return []; }
}

async function buscarComprasGovDispensas({ objeto, uf, dataInicio, dataFim, tamanhoPagina = 20 }) {
  try {
    const items = await buscarComprasGovProxy('dispensas', { objeto, dataInicio, dataFim, tamanhoPagina });

    return items
      .filter(item => matchObjeto(`${item.objetoCompra} ${item.informacaoComplementar}`, objeto))
      .map(item => {
        const itemUf = item.unidadeOrgao?.ufSigla || uf || '';
        if (uf && itemUf !== uf) return null;
        return {
          id: `dispensa-${item.numeroControlePNCP || item.numeroCompra || Math.random()}`,
          fonte: 'Compras.gov.br Dispensas',
          fonteLogo: '📄',
          titulo: item.objetoCompra || 'Sem descrição',
          orgao: item.orgaoEntidade?.razaoSocial || item.unidadeOrgao?.nomeUnidade || 'Compras.gov.br',
          modalidade: item.modalidadeNome || '',
          uf: itemUf,
          municipio: item.unidadeOrgao?.municipioNome || '',
          valor: item.valorTotalEstimado ? Number(item.valorTotalEstimado) : null,
          dataPublicacao: item.dataPublicacaoPncp || null,
          dataAbertura: item.dataAberturaProposta || null,
          dataEncerramento: item.dataEncerramentoProposta || null,
          numero: String(item.numeroCompra || ''),
          ano: String(item.anoCompra || ''),
          link: item.linkSistemaOrigem || `https://pncp.gov.br/app/editais/${item.orgaoEntidade?.cnpj}/${item.anoCompra}/${item.sequencialCompra}`,
          status: item.situacaoCompraNome || 'Publicado'
        };
      })
      .filter(Boolean);
  } catch { return []; }
}

async function buscarContratacoes14133({ objeto, uf, dataInicio, dataFim, tamanhoPagina = 20 }) {
  try {
    const items = await buscarComprasGovProxy('contratacoes14133', { objeto, uf, dataInicio, dataFim, tamanhoPagina });

    return items
      .filter(item => matchObjeto(`${item.objetoCompra} ${item.informacaoComplementar}`, objeto))
      .map(item => {
        const itemUf = item.unidadeOrgao?.ufSigla || uf || '';
        if (uf && itemUf !== uf) return null;
        return {
          id: `cn14133-${item.numeroControlePNCP || item.numeroCompra || Math.random()}`,
          fonte: 'Contratações Lei 14.133',
          fonteLogo: '⚖️',
          titulo: item.objetoCompra || 'Sem descrição',
          orgao: item.orgaoEntidade?.razaoSocial || item.unidadeOrgao?.nomeUnidade || '',
          modalidade: item.modalidadeNome || '',
          uf: itemUf,
          municipio: item.unidadeOrgao?.municipioNome || '',
          valor: item.valorTotalEstimado ? Number(item.valorTotalEstimado) : null,
          dataPublicacao: item.dataPublicacaoPncp || null,
          dataAbertura: item.dataAberturaProposta || null,
          dataEncerramento: item.dataEncerramentoProposta || null,
          numero: String(item.numeroCompra || ''),
          ano: String(item.anoCompra || ''),
          link: item.linkSistemaOrigem || `https://pncp.gov.br/app/editais/${item.orgaoEntidade?.cnpj}/${item.anoCompra}/${item.sequencialCompra}`,
          status: item.situacaoCompraNome || 'Publicado'
        };
      })
      .filter(Boolean);
  } catch { return []; }
}

async function buscarAtasRegistroPreco({ objeto, uf, dataInicio, dataFim, tamanhoPagina = 20 }) {
  try {
    const items = await buscarComprasGovProxy('arp', { objeto, dataInicio, dataFim, tamanhoPagina });

    return items
      .filter(item => matchObjeto(`${item.objetoCompra} ${item.informacaoComplementar} ${item.orgaoEntidade?.razaoSocial}`, objeto))
      .map(item => {
        const itemUf = item.unidadeOrgao?.ufSigla || uf || '';
        if (uf && itemUf !== uf) return null;
        return {
          id: `arp-${item.numeroControlePNCP || item.numeroCompra || Math.random()}`,
          fonte: 'Atas de Registro de Preço',
          fonteLogo: '📋',
          titulo: item.objetoCompra || 'Ata de Registro de Preço',
          orgao: item.orgaoEntidade?.razaoSocial || item.unidadeOrgao?.nomeUnidade || '',
          modalidade: item.modalidadeNome || '',
          uf: itemUf,
          municipio: item.unidadeOrgao?.municipioNome || '',
          valor: item.valorTotalEstimado ? Number(item.valorTotalEstimado) : null,
          dataPublicacao: item.dataPublicacaoPncp || null,
          dataAbertura: item.dataAberturaProposta || null,
          dataEncerramento: item.dataEncerramentoProposta || null,
          numero: String(item.numeroCompra || ''),
          ano: String(item.anoCompra || ''),
          link: item.linkSistemaOrigem || `https://pncp.gov.br/app/editais/${item.orgaoEntidade?.cnpj}/${item.anoCompra}/${item.sequencialCompra}`,
          status: item.situacaoCompraNome || 'Ata vigente'
        };
      })
      .filter(Boolean);
  } catch { return []; }
}

async function buscarPregoes({ objeto, uf, dataInicio, tamanhoPagina = 20 }) {
  try {
    const items = await buscarComprasGovProxy('pregoes', { objeto, dataInicio, tamanhoPagina });

    return items
      .filter(item => matchObjeto(`${item.objetoCompra} ${item.orgaoEntidade?.razaoSocial}`, objeto))
      .map(item => {
        const itemUf = item.unidadeOrgao?.ufSigla || uf || '';
        if (uf && itemUf !== uf) return null;
        return {
          id: `pregao-${item.numeroControlePNCP || item.numeroCompra || Math.random()}`,
          fonte: 'Pregões (SIASG)',
          fonteLogo: '📢',
          titulo: item.objetoCompra || 'Sem descrição',
          orgao: item.orgaoEntidade?.razaoSocial || item.unidadeOrgao?.nomeUnidade || '',
          modalidade: item.modalidadeNome || '',
          uf: itemUf,
          municipio: item.unidadeOrgao?.municipioNome || '',
          valor: item.valorTotalEstimado ? Number(item.valorTotalEstimado) : null,
          dataPublicacao: item.dataPublicacaoPncp || null,
          dataAbertura: item.dataAberturaProposta || null,
          dataEncerramento: item.dataEncerramentoProposta || null,
          numero: String(item.numeroCompra || ''),
          ano: String(item.anoCompra || ''),
          link: item.linkSistemaOrigem || `https://pncp.gov.br/app/editais/${item.orgaoEntidade?.cnpj}/${item.anoCompra}/${item.sequencialCompra}`,
          status: item.situacaoCompraNome || 'Publicado'
        };
      })
      .filter(Boolean);
  } catch { return []; }
}

async function buscarCuritibaECompras({ objeto, uf, cidade, dataInicio, dataFim, tamanhoPagina = 20 }) {
  const url = new URL(buildApiUrl('/b2g-search/curitiba-ecompras'), window.location.origin);
  url.searchParams.set('objeto', objeto || '');
  url.searchParams.set('uf', uf || '');
  url.searchParams.set('cidade', cidade || '');
  url.searchParams.set('dataInicio', dataInicio || '');
  url.searchParams.set('dataFim', dataFim || '');
  url.searchParams.set('tamanhoPagina', Math.max(10, Math.min(Number(tamanhoPagina || 20), 100)));

  const res = await fetch(url.toString(), {
    headers: getAuthHeaders(),
    signal: AbortSignal.timeout(30000)
  });
  const payload = await res.json().catch(() => null);
  
  // ✅ Se tiver dados, retornar mesmo que res.ok seja false (fallback PNCP)
  if (payload?.data && Array.isArray(payload.data) && payload.data.length > 0) {
    return payload.data;
  }
  
  // ❌ Se não tiver dados E resposta não OK, lançar erro
  if (!res.ok) {
    const message = payload?.erros?.[0] || payload?.error || payload?.message || 'Falha ao buscar no e-Compras Curitiba.';
    throw new Error(message);
  }
  
  return Array.isArray(payload?.data) ? payload.data : [];
}

async function buscarFonteB2GSearch(fonte, params) {
  const url = new URL(buildApiUrl('/b2g-search/search'), window.location.origin);
  url.searchParams.set('fontes', fonte);
  url.searchParams.set('objeto', params.objeto || '');
  if (Array.isArray(params.termosProduto) && params.termosProduto.length > 0) {
    url.searchParams.set('termos', params.termosProduto.join(','));
  }
  url.searchParams.set('uf', params.uf || '');
  url.searchParams.set('cidade', params.cidade || '');
  url.searchParams.set('dataInicio', params.dataInicio || '');
  url.searchParams.set('dataFim', params.dataFim || '');
  url.searchParams.set('ordem', params.ordem || 'data_desc');
  url.searchParams.set('apenasVigentes', params.apenasVigentes ? 'true' : 'false');
  url.searchParams.set('tamanhoPagina', Math.max(10, Math.min(Number(params.tamanhoPagina || 50), 100)));

  const res = await fetch(url.toString(), {
    headers: getAuthHeaders(),
    signal: AbortSignal.timeout(30000)
  });
  const payload = await res.json().catch(() => null);
  const data = Array.isArray(payload?.data) ? payload.data : [];

  if (!res.ok && data.length === 0) {
    throw new Error(payload?.error || payload?.message || `Falha ao buscar em ${fonte}`);
  }

  if (data.length === 0 && Array.isArray(payload?.erros) && payload.erros.length > 0) {
    console.debug(`${fonte} retornou sem resultados nesta consulta:`, payload.erros.slice(0, 2).join('; '));
    if (fonte === 'dou') throw new Error(payload.erros.slice(0, 2).join('; '));
  }

  return data;
}

// ─── Helpers de UI ────────────────────────────────────────────────────────────

const formatCurrency = (value) => {
  if (!value && value !== 0) return null;
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDate = (value) => {
  if (!value) return null;
  try {
    const text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text) && text.length === 10) {
      const [year, month, day] = text.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('pt-BR');
    }
    return new Date(text).toLocaleDateString('pt-BR');
  } catch { return value; }
};

const deduplicar = (items) => {
  const seen = new Set();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const getLicitacaoId = (item) => String(item?.id || item?.numeroControlePNCP || item?.numero || item?.link || '');

const readLocalLicitacoesGerenciadas = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(LICITACOES_GERENCIADAS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => getLicitacaoId(item)) : [];
  } catch {
    return [];
  }
};

const saveLocalLicitacoesGerenciadas = (items) => {
  try {
    localStorage.setItem(LICITACOES_GERENCIADAS_KEY, JSON.stringify(items));
  } catch {
    // Cache local é apenas contingência; falhas de storage não impedem a operação principal.
  }
};

const mergeLicitacoesGerenciadas = (...lists) => {
  const map = new Map();
  lists.flat().forEach(item => {
    const id = getLicitacaoId(item);
    if (!id || map.has(id)) return;
    map.set(id, { ...item, id });
  });
  return Array.from(map.values()).sort((a, b) => {
    const aTs = new Date(a.gerenciadaEm || a.createdAt || 0).getTime() || 0;
    const bTs = new Date(b.gerenciadaEm || b.createdAt || 0).getTime() || 0;
    return bTs - aTs;
  });
};

const ordenar = (items, ordem) => [...items].sort((a, b) => {
  switch (ordem) {
    case 'data_desc': return new Date(b.dataPublicacao || 0) - new Date(a.dataPublicacao || 0);
    case 'data_asc': return new Date(a.dataPublicacao || 0) - new Date(b.dataPublicacao || 0);
    case 'valor_desc': return (b.valor || 0) - (a.valor || 0);
    case 'valor_asc': return (a.valor || 0) - (b.valor || 0);
    case 'abertura_asc': return new Date(a.dataAbertura || '9999') - new Date(b.dataAbertura || '9999');
    default: return 0;
  }
});

const getFonteBadgeClass = (fonte) => {
  const map = {
    'PNCP': 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700',
    'ComprasNet': 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700',
    'Compras.gov.br Dispensas': 'bg-orange-100 text-orange-800 border border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700',
    'Contratações Lei 14.133': 'bg-teal-100 text-teal-800 border border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700',
    'Atas de Registro de Preço': 'bg-indigo-100 text-indigo-800 border border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700',
    'Pregões (SIASG)': 'bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700',
    'e-Compras Curitiba': 'bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-700',
    'BLL': 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700',
    'BNC': 'bg-violet-100 text-violet-800 border border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-700',
  };
  return map[fonte] || 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600';
};

const getFonteDisplayName = (fonte) => {
  return String(fonte.nome || fonte.portal || '').replace(' Compras', '').toUpperCase();
};

const toDisplayText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(toDisplayText).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const keys = ['nome', 'name', 'label', 'descricao', 'description', 'sigla', 'acronym', 'uf', 'codigo', 'id'];
    for (const key of keys) {
      const text = toDisplayText(value[key]);
      if (text) return text;
    }
  }
  return '';
};

const normalizePortalItem = (item, fonte) => ({
  id: item.id || `${fonte.portal}-${item.numeroCompra || item.numero || Date.now()}-${Math.random()}`,
  fonte: getFonteDisplayName(fonte),
  fonteLogo: fonte.icon,
  titulo: toDisplayText(item.titulo || item.objetoCompra || item.objeto || item.descricao) || 'Sem descrição',
  orgao: toDisplayText(item.orgao || item.orgaoEntidade?.razaoSocial || item.entidade),
  modalidade: toDisplayText(item.modalidade || item.modalidadeNome || item.tipo),
  uf: toDisplayText(item.uf || item.unidadeOrgao?.ufSigla),
  municipio: toDisplayText(item.municipio || item.cidade || item.unidadeOrgao?.municipioNome),
  valor: (item.valor || item.valorTotalEstimado) ? Number(item.valor || item.valorTotalEstimado) : null,
  dataPublicacao: item.dataPublicacao || item.dataPublicacaoPncp || null,
  dataAbertura: item.dataAbertura || item.dataAberturaProposta || null,
  dataEncerramento: item.dataEncerramento || item.dataEncerramentoProposta || null,
  numero: toDisplayText(item.numero || item.numeroCompra),
  ano: item.ano || '',
  link: toDisplayText(item.link || item.linkSistemaOrigem),
  status: toDisplayText(item.status || item.situacao) || 'Aberto'
});

async function buscarFonteIntegrada(fonte, params) {
  if (!fonte.usuario || !fonte.senha) return [];

  const url = new URL(buildApiUrl('/bll-proxy'), window.location.origin);
  url.searchParams.set('portal', fonte.portal);
  url.searchParams.set('objeto', params.objeto || '');
  url.searchParams.set('uf', params.uf || '');
  url.searchParams.set('cidade', params.cidade || '');
  url.searchParams.set('dataInicio', params.dataInicio || '');
  url.searchParams.set('dataFim', params.dataFim || '');
  url.searchParams.set('dataPrazoInicio', params.dataPrazoInicio || '');
  url.searchParams.set('dataPrazoFim', params.dataPrazoFim || '');
  url.searchParams.set('exactSearch', params.exactSearch ? 'true' : '');
  url.searchParams.set('apenasVigentes', params.apenasVigentes ? 'true' : '');
  url.searchParams.set('comEdital', params.comEdital ? 'true' : '');
  url.searchParams.set('comMonitoramentoChat', params.comMonitoramentoChat ? 'true' : '');
  url.searchParams.set('numeroEdital', params.numeroEdital || '');
  url.searchParams.set('tamanhoPagina', params.tamanhoPagina || 20);
  if (fonte.portal !== 'bll') url.searchParams.set('useScraper', 'true');

  const res = await fetch(url.toString(), {
    headers: {
      [`x-${fonte.portal}-email`]: fonte.usuario || '',
      [`x-${fonte.portal}-password`]: fonte.senha || ''
    },
    signal: AbortSignal.timeout(18000)
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.erro || payload?.message || `Falha ao buscar em ${getFonteDisplayName(fonte)}`);
  }
  const payload = await res.json().catch(() => null);
  const items = Array.isArray(payload?.data) ? payload.data : [];
  return items.map(item => normalizePortalItem(item, fonte));
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ toasts }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-start gap-3 bg-white dark:bg-slate-800 border-l-4 ${t.error ? 'border-red-500' : 'border-blue-500'} shadow-xl p-4 rounded-lg max-w-sm animate-fade-in`}>
          <span className="text-xl mt-0.5">{t.error ? '❌' : '✅'}</span>
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{t.title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Card de Edital ───────────────────────────────────────────────────────────

function CardEdital({
  item,
  favorito,
  leadSalvo,
  gerenciada,
  salvandoLead,
  salvandoGerenciada,
  onToggleFavorito,
  onToggleGerenciada,
  onAbrirSalvarLead
}) {
  const vigente = isEditalVigente(item);

  return (
    <div className={`bg-white dark:bg-slate-800/60 rounded-xl shadow-sm border hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition duration-200 overflow-hidden group ${vigente ? 'border-slate-200 dark:border-slate-700' : 'border-slate-200 dark:border-slate-700 opacity-80'}`}>
      <div className={`border-l-4 ${vigente ? 'border-blue-500' : 'border-slate-400 dark:border-slate-600'} p-5 md:p-6`}>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-3">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`text-xs font-bold px-2 py-1 rounded-md ${getFonteBadgeClass(item.fonte)}`}>
                {item.fonteLogo} {item.fonte}
              </span>
              {vigente ? (
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 px-2 py-1 rounded-md flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Vigente
                </span>
              ) : (
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2 py-1 rounded-md flex items-center gap-1.5">
                  <Lock size={10} /> Encerrado
                </span>
              )}
              {item.modalidade && (
                <span className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 px-2 py-1 rounded-md">
                  {item.modalidade}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition line-clamp-1">
              {item.orgao || 'Órgão não informado'}
            </h3>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            {onToggleGerenciada && (
              <button
                onClick={() => onToggleGerenciada(item)}
                disabled={salvandoGerenciada}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition ${
                  gerenciada
                    ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30'
                    : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30'
                } disabled:cursor-wait disabled:opacity-70`}
                title={gerenciada ? 'Remover de Licitações Gerenciadas' : 'Adicionar em Licitações Gerenciadas'}
              >
                {salvandoGerenciada ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : gerenciada ? (
                  <X size={14} />
                ) : (
                  <Plus size={14} />
                )}
                {salvandoGerenciada 
                  ? 'Salvando...' 
                  : gerenciada 
                    ? 'Deixar de gerenciar' 
                    : 'Adicionar licitação'
                }
              </button>
            )}

            {/* Valor */}
            <div className="text-left md:text-right bg-slate-50 dark:bg-slate-700/40 md:bg-transparent md:dark:bg-transparent p-3 md:p-0 rounded-lg border border-slate-100 dark:border-slate-700 md:border-none">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500 mb-0.5">Valor Estimado</p>
              {item.valor ? (
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(item.valor)}</p>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 italic">Não informado</p>
              )}
            </div>
          </div>
        </div>

        {/* Objeto */}
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 line-clamp-2 leading-relaxed">{item.titulo}</p>

        {/* Metadados */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-600 dark:text-slate-300 mb-5 pb-5 border-b border-slate-100 dark:border-slate-700">
          <div>
            <p className="font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px] mb-1">Localização</p>
            <p className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
              <MapPin size={11} className="text-slate-400 dark:text-slate-500" />
              {[item.municipio, item.uf].filter(Boolean).join(' - ') || '-'}
            </p>
          </div>
          <div>
            <p className="font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px] mb-1">Modalidade</p>
            <p className="font-semibold text-slate-700 dark:text-slate-200">{item.modalidade || '-'}</p>
          </div>
          <div>
            <p className="font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px] mb-1">Publicação</p>
            <p className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
              <Calendar size={11} className="text-slate-400 dark:text-slate-500" />
              {formatDate(item.dataPublicacao) || '-'}
            </p>
          </div>
          <div>
            <p className="font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px] mb-1">Abertura</p>
            <p className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
              <Calendar size={11} className="text-slate-400 dark:text-slate-500" />
              {formatDate(item.dataAbertura) || '-'}
            </p>
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => onToggleFavorito(item)}
              className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg font-semibold border transition ${
                favorito
                  ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30'
                  : 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Heart size={14} fill={favorito ? 'currentColor' : 'none'} />
              {favorito ? 'Salvo' : 'Salvar'}
            </button>
            <button
              onClick={() => onAbrirSalvarLead(item)}
              disabled={leadSalvo || salvandoLead}
              className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg font-semibold border transition ${
                leadSalvo
                  ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 cursor-default'
                  : 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30'
              } disabled:opacity-75`}
            >
              {salvandoLead ? (
                <Loader2 size={14} className="animate-spin" />
              ) : leadSalvo ? (
                <CheckCircle size={14} />
              ) : (
                <BookmarkPlus size={14} />
              )}
              {leadSalvo ? 'Lead salvo' : 'Salvar Lead'}
            </button>
          </div>

          {item.link ? (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 px-5 py-2.5 rounded-lg text-sm font-semibold transition shadow-sm flex items-center justify-center gap-2"
            >
              Ir para o Portal <ExternalLink size={13} className="opacity-70" />
            </a>
          ) : (
            <span className="w-full sm:w-auto bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 cursor-not-allowed">
              Link não disponível
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SalvarLeadModal({
  item,
  decisao,
  observacoes,
  saving,
  onDecisao,
  onObservacoes,
  onClose,
  onSalvar
}) {
  if (!item) return null;

  const decisions = [
    { id: 'ANALISE', label: 'Em Análise', icon: <Tag size={20} /> },
    { id: 'GO', label: 'GO', icon: <ThumbsUp size={20} /> },
    { id: 'NO_GO', label: 'NO GO', icon: <ThumbsDown size={20} /> }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
          <div>
            <h3 className="flex items-center gap-3 text-xl font-bold">
              <BookmarkPlus className="text-blue-300" size={24} />
              Salvar como Lead
            </h3>
            <p className="mt-1 text-sm text-slate-300">Analise este edital e registre sua decisão antes de avançar.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="rounded-xl border border-blue-900/80 bg-slate-800/70 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-lg font-bold text-white">{item.numero || item.id}</p>
                <p className="mt-3 flex items-center gap-2 text-sm text-slate-200">
                  <Building2 size={16} className="text-slate-400" />
                  {item.orgao || 'Órgão não informado'}
                </p>
                <p className="mt-2 flex items-center gap-2 text-sm text-slate-300">
                  <MapPin size={16} className="text-slate-400" />
                  {[item.municipio, item.uf].filter(Boolean).join(' - ') || 'Local não informado'}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-blue-500/60 px-4 py-2 text-xs font-bold uppercase text-blue-200">
                {item.modalidade || item.fonte || 'Edital'}
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">{item.titulo}</p>
            <div className="mt-4 flex flex-col gap-3 border-t border-slate-700 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Calendar size={16} className="text-blue-300" />
                {formatDate(item.dataAbertura || item.dataEncerramento || item.dataPublicacao) || 'Data não informada'}
              </span>
              <span className="text-sm font-semibold text-emerald-300">{item.status || 'Não informado'}</span>
            </div>
          </div>

          <div>
            <label className="mb-3 block text-sm font-bold text-slate-100">Decisão</label>
            <div className="grid gap-3 sm:grid-cols-3">
              {decisions.map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onDecisao(option.id)}
                  className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition ${
                    decisao === option.id
                      ? 'border-blue-400 bg-blue-500/20 text-blue-200 ring-2 ring-blue-400'
                      : 'border-slate-700 bg-slate-950/20 text-slate-300 hover:border-blue-500/70 hover:text-blue-200'
                  }`}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-100">Observações (opcional)</label>
            <textarea
              value={observacoes}
              onChange={(event) => onObservacoes(event.target.value)}
              rows={4}
              placeholder="Justificativa da decisão, pontos de atenção, concorrentes identificados..."
              className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950/30 p-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {decisao === 'GO' && (
            <div className="rounded-xl border border-emerald-700/60 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-300 flex items-start gap-2">
              <span className="text-lg">✅</span>
              <div>
                <p className="font-bold">GO selecionado</p>
                <p className="text-emerald-400 text-xs mt-0.5">Uma oportunidade B2G será criada automaticamente e você será redirecionado para o Kanban de Oportunidades.</p>
              </div>
            </div>
          )}
          {decisao === 'NO_GO' && (
            <div className="rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-3 text-sm text-red-300 flex items-start gap-2">
              <span className="text-lg">❌</span>
              <div>
                <p className="font-bold">NO GO selecionado</p>
                <p className="text-red-400 text-xs mt-0.5">O edital será registrado como descartado. Você pode reverter depois em B2G &gt; Leads.</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-800 px-6 py-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSalvar}
            disabled={saving}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition disabled:opacity-60 ${
              decisao === 'GO'
                ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950'
                : decisao === 'NO_GO'
                ? 'bg-red-500 hover:bg-red-400 text-white'
                : 'bg-blue-400 hover:bg-blue-300 text-slate-950'
            }`}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <BookmarkPlus size={16} />}
            {decisao === 'GO' ? '✅ GO — Criar Oportunidade' : decisao === 'NO_GO' ? '❌ Registrar NO GO' : 'Salvar Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function PortalBusca() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('busca'); // 'busca' | 'gerenciadas' | 'fontes' | 'alertas'

  // Busca
  const [objeto, setObjeto] = useState('');
  const [uf, setUf] = useState('');
  const [cidade, setCidade] = useState('');
  const [apenasVigentes, setApenasVigentes] = useState(false);
  const [buscaExata, setBuscaExata] = useState(false);
  const [comEdital, setComEdital] = useState(false);
  const [comMonitoramentoChat, setComMonitoramentoChat] = useState(false);
  const [numeroEdital, setNumeroEdital] = useState('');
  const [ordem, setOrdem] = useState('data_desc');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [dataPrazoInicio, setDataPrazoInicio] = useState('');
  const [dataPrazoFim, setDataPrazoFim] = useState('');
  const [fontesAtivas, setFontesAtivas] = useState(() => {
    try {
      const integradas = readFontesIntegradas();
      return [...FONTES_PADRAO_ATIVAS, ...integradas.filter(f => f.ativa !== false).map(f => f.id)];
    } catch {
      return FONTES_PADRAO_ATIVAS;
    }
  });
  const [incluirPropostas, setIncluirPropostas] = useState(true);
  const [categoriasProdutoTI, setCategoriasProdutoTI] = useState([]);
  const [produtoCustom, setProdutoCustom] = useState('');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [fontesIntegradas, setFontesIntegradas] = useState(() => {
    try { return readFontesIntegradas(); } catch { return []; }
  });
  const [modalFonteAberto, setModalFonteAberto] = useState(false);
  const [fonteForm, setFonteForm] = useState(novaFonteForm);
  const [testandoFonte, setTestandoFonte] = useState(false);

  // Resultados
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [total, setTotal] = useState(0);
  const [porFonte, setPorFonte] = useState({});
  const [buscaFeita, setBuscaFeita] = useState(false);
  const [leadModalItem, setLeadModalItem] = useState(null);
  const [leadDecisao, setLeadDecisao] = useState('ANALISE');
  const [leadObservacoes, setLeadObservacoes] = useState('');
  const [salvandoLeadId, setSalvandoLeadId] = useState('');
  const [leadsSalvos, setLeadsSalvos] = useState(() => {
    try { return JSON.parse(localStorage.getItem('b2g_busca_leads_salvos_v1') || '[]'); } catch { return []; }
  });

  // Favoritos
  const [favoritos, setFavoritos] = useState(() => {
    try { return JSON.parse(localStorage.getItem('b2g_favoritos_v2') || '[]'); } catch { return []; }
  });
  const [mostrarFavoritos, setMostrarFavoritos] = useState(false);

  // Licitações Gerenciadas
  const [licitacoesGerenciadas, setLicitacoesGerenciadas] = useState(readLocalLicitacoesGerenciadas);
  const [carregandoGerenciadas, setCarregandoGerenciadas] = useState(false);
  const [salvandoGerenciadaIds, setSalvandoGerenciadaIds] = useState([]);

  // Alertas
  const [alertas, setAlertas] = useState(() => {
    try { return JSON.parse(localStorage.getItem('b2g_alertas') || '[]'); } catch { return []; }
  });
  const [alertaForm, setAlertaForm] = useState({ palavras: '', uf: '' });

  // Toasts
  const [toasts, setToasts] = useState([]);

  const fontesDisponiveis = useMemo(
    () => [...FONTES_CONFIG, ...fontesIntegradas.filter(fonte => PORTAIS_INTEGRADOS_SUPORTADOS.has(fonte.portal))],
    [fontesIntegradas]
  );

  const showToast = useCallback((title, text, error = false) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, text, error }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  useEffect(() => {
    localStorage.setItem(FONTES_STORAGE_KEY, JSON.stringify(fontesIntegradas));
    setFontesAtivas(prev => {
      const next = prev.filter(id => fontesDisponiveis.some(fonte => fonte.id === id));
      return next.length === prev.length ? prev : next;
    });
  }, [fontesDisponiveis, fontesIntegradas]);

  useEffect(() => {
    let cancelled = false;

    const carregarLicitacoesGerenciadas = async () => {
      const locais = readLocalLicitacoesGerenciadas();
      setCarregandoGerenciadas(true);
      try {
        const response = await fetch(buildApiUrl('/b2g/licitacoes-gerenciadas'), {
          headers: getAuthHeaders()
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || payload?.message || 'Não foi possível carregar licitações gerenciadas.');
        }

        const payload = await response.json().catch(() => null);
        const servidor = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
        const idsServidor = new Set(servidor.map(getLicitacaoId).filter(Boolean));
        const locaisSemServidor = locais.filter(item => !idsServidor.has(getLicitacaoId(item)));
        const migradas = [];
        let falhasMigracao = 0;

        for (const item of locaisSemServidor) {
          try {
            const id = getLicitacaoId(item);
            const saveResponse = await fetch(buildApiUrl('/b2g/licitacoes-gerenciadas'), {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({ item: { ...item, id } })
            });
            if (saveResponse.ok) {
              const savedPayload = await saveResponse.json().catch(() => null);
              migradas.push(savedPayload?.data || item);
            } else {
              falhasMigracao += 1;
            }
          } catch {
            falhasMigracao += 1;
          }
        }

        if (!cancelled) {
          const next = mergeLicitacoesGerenciadas(servidor, migradas);
          setLicitacoesGerenciadas(next);
          saveLocalLicitacoesGerenciadas(next);
          if (falhasMigracao > 0) {
            showToast('Algumas licitações não sincronizaram', 'Marque novamente os itens que não aparecerem na lista.', true);
          }
        }
      } catch (error) {
        if (!cancelled && locais.length > 0) {
          setLicitacoesGerenciadas(locais);
          showToast('Licitações em modo local', error.message || 'Não foi possível sincronizar com o servidor.', true);
        }
      } finally {
        if (!cancelled) setCarregandoGerenciadas(false);
      }
    };

    carregarLicitacoesGerenciadas();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  // Filtro local por cidade e vigente (client-side após busca)
  const resultadosFiltrados = resultados.filter(item => {
    if (apenasVigentes) {
      if (!isEditalVigente(item)) return false;
    }
    if (cidade.trim()) {
      const mun = String(item.municipio || '').toLowerCase();
      if (!mun.includes(cidade.toLowerCase())) return false;
    }
    if (categoriasProdutoTI.length > 0 || produtoCustom.trim()) {
      const texto = String(item.titulo || item.objetoCompra || item.objeto || item.descricao || '').toLowerCase();
      const matchCategoria = categoriasProdutoTI.some(catId => {
        const cat = CATEGORIAS_PRODUTO_TI.find(c => c.id === catId);
        return cat && cat.keywords.some(kw => kwMatch(texto, kw));
      });
      const termosCustom = produtoCustom.toLowerCase().split(/[,\n]+/).map(t => t.trim()).filter(Boolean);
      const matchCustom = termosCustom.length > 0 && termosCustom.some(t => texto.includes(t));
      if (!matchCategoria && !matchCustom) return false;
    }
    return true;
  });

  const itensExibidos = mostrarFavoritos ? favoritos : resultadosFiltrados;

  const executarFonte = (nomeFonte, promise) =>
    promise.catch(error => {
      throw new Error(`${nomeFonte}: ${error.message || 'falha na consulta'}`);
    });

  const handleBuscar = useCallback(async () => {
    const hasAdvancedFilter = [
      cidade,
      dataInicio,
      dataFim,
      dataPrazoInicio,
      dataPrazoFim,
      numeroEdital
    ].some(value => String(value || '').trim());

    if (!objeto.trim() && !uf && !hasAdvancedFilter && !apenasVigentes && !comEdital && !comMonitoramentoChat && categoriasProdutoTI.length === 0 && !produtoCustom.trim()) {
      setErro('Informe ao menos um termo, número, período ou filtro de localização/status/produto.');
      return;
    }

    setLoading(true);
    setErro('');
    setBuscaFeita(true);
    setMostrarFavoritos(false);

    try {
      const termosCategorias = categoriasProdutoTI
        .map(catId => CATEGORIAS_PRODUTO_TI.find(c => c.id === catId))
        .filter(Boolean)
        .flatMap(cat => cat.keywords);
      const termosCustom = produtoCustom.split(/[,\n]+/).map(t => t.trim()).filter(Boolean);
      const objetoFinal = [objeto.trim(), ...termosCategorias, ...termosCustom].filter(Boolean).join(' ');

      const params = {
        objeto: objetoFinal,
        termosProduto: [...termosCategorias, ...termosCustom],
        uf,
        cidade,
        dataInicio,
        dataFim,
        dataPrazoInicio,
        dataPrazoFim,
        exactSearch: buscaExata,
        apenasVigentes,
        comEdital,
        comMonitoramentoChat,
        numeroEdital,
        tamanhoPagina: 50
      };

      const promises = [];
      if (fontesAtivas.includes('pncp')) {
        promises.push(executarFonte('PNCP', buscarPNCPProxy({ ...params, incluirPropostas })));
      }
      if (fontesAtivas.includes('comprasnet')) {
        promises.push(executarFonte('ComprasNet', buscarComprasNet(params)));
      }
      if (fontesAtivas.includes('transparencia-curitiba')) {
        promises.push(executarFonte('Transparência Curitiba', buscarFonteB2GSearch('transparencia-curitiba', { ...params, ordem })));
      }
      if (fontesAtivas.includes('transparencia-federal')) {
        promises.push(executarFonte('Portal Transparência Federal', buscarFonteB2GSearch('transparencia-federal', { ...params, ordem })));
      }
      if (fontesAtivas.includes('dispensas')) {
        promises.push(executarFonte('Dispensas', buscarComprasGovDispensas(params)));
      }
      if (fontesAtivas.includes('contratacoes14133')) {
        promises.push(executarFonte('Contratações Lei 14.133', buscarContratacoes14133(params)));
      }
      if (fontesAtivas.includes('arp')) {
        promises.push(executarFonte('Atas de Registro de Preço', buscarAtasRegistroPreco(params)));
      }
      if (fontesAtivas.includes('pregoes')) {
        promises.push(executarFonte('Pregões', buscarPregoes(params)));
      }
      if (fontesAtivas.includes('dou')) {
        promises.push(executarFonte('Imprensa Nacional (DOU)', buscarFonteB2GSearch('dou', { ...params, objeto: objeto.trim() })));
      }
      if (fontesAtivas.includes('curitiba-ecompras')) {
        promises.push(executarFonte('e-Compras Curitiba', buscarCuritibaECompras(params)));
      }
      fontesIntegradas
        .filter(fonte => fonte.ativa && PORTAIS_INTEGRADOS_SUPORTADOS.has(fonte.portal) && fontesAtivas.includes(fonte.id))
        .forEach(fonte => promises.push(executarFonte(getFonteDisplayName(fonte), buscarFonteIntegrada(fonte, params))));

      if (promises.length === 0) {
        setErro('Selecione ao menos uma fonte ativa para buscar.');
        setLoading(false);
        return;
      }

      const results = await Promise.allSettled(promises);
      const todos = results
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => r.value);
      const falhas = results
        .filter(r => r.status === 'rejected')
        .map(r => r.reason?.message)
        .filter(Boolean);

      const dedup = deduplicar(todos);
      const ordenados = ordenar(dedup, ordem);

      // Estatísticas por fonte
      const porFonteMap = {};
      for (const item of dedup) {
        porFonteMap[item.fonte] = (porFonteMap[item.fonte] || 0) + 1;
      }

      setResultados(ordenados);
      setTotal(ordenados.length);
      setPorFonte(porFonteMap);

      if (ordenados.length === 0) {
        if (falhas.length > 0) {
          setErro(`Nenhuma fonte retornou resultado. Falhas: ${falhas.slice(0, 3).join('; ')}${falhas.length > 3 ? '...' : ''}`);
        }
        showToast('Sem resultados', 'Tente outros termos ou amplie o período de busca.');
      } else {
        if (falhas.length > 0) {
          showToast('Busca parcial', `${ordenados.length} resultado(s). Algumas fontes não responderam.`);
        }
        showToast('Busca concluída', `${ordenados.length} edital(is) encontrado(s).`);
      }
    } catch (err) {
      setErro(err.message || 'Erro ao buscar licitações');
      setResultados([]);
    } finally {
      setLoading(false);
    }
  }, [
    objeto,
    uf,
    cidade,
    dataInicio,
    dataFim,
    dataPrazoInicio,
    dataPrazoFim,
    buscaExata,
    apenasVigentes,
    comEdital,
    comMonitoramentoChat,
    numeroEdital,
    ordem,
    incluirPropostas,
    fontesAtivas,
    fontesIntegradas,
    showToast,
    categoriasProdutoTI,
    produtoCustom
  ]);

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleBuscar(); };

  const limparFiltros = () => {
    setObjeto(''); setUf(''); setCidade('');
    setApenasVigentes(false); setBuscaExata(false); setComEdital(false); setComMonitoramentoChat(false);
    setNumeroEdital('');
    setDataInicio(''); setDataFim(''); setDataPrazoInicio(''); setDataPrazoFim('');
    setCategoriasProdutoTI([]);
    setProdutoCustom('');
    setOrdem('data_desc'); setFontesAtivas(fontesDisponiveis.filter(f => f.ativa !== false && f.defaultActive !== false).map(f => f.id));
    setResultados([]); setBuscaFeita(false); setErro('');
  };

  const toggleCategoriaProduto = (id) => {
    setCategoriasProdutoTI(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleFonte = (id) => {
    setFontesAtivas(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const toggleFavorito = (item) => {
    setFavoritos(prev => {
      const existe = prev.some(f => f.id === item.id);
      const next = existe ? prev.filter(f => f.id !== item.id) : [...prev, item];
      localStorage.setItem('b2g_favoritos_v2', JSON.stringify(next));
      showToast(existe ? 'Removido dos favoritos' : 'Salvo nos favoritos', item.titulo?.slice(0, 60));
      return next;
    });
  };

  const isFavorito = (item) => favoritos.some(f => f.id === item.id);

  const isLeadSalvo = (item) => leadsSalvos.some(id => String(id) === String(item.id));

  const isLicitacaoGerenciada = (item) => {
    const id = getLicitacaoId(item);
    return Boolean(id) && licitacoesGerenciadas.some(licitacao => getLicitacaoId(licitacao) === id);
  };

  const isSalvandoGerenciada = (item) => {
    const id = getLicitacaoId(item);
    return Boolean(id) && salvandoGerenciadaIds.includes(id);
  };

  const toggleLicitacaoGerenciada = async (item) => {
    const id = getLicitacaoId(item);
    if (!id) {
      showToast('Não foi possível gerenciar', 'Esta licitação não possui identificador válido.', true);
      return;
    }

    const existe = isLicitacaoGerenciada(item);
    setSalvandoGerenciadaIds(prev => prev.includes(id) ? prev : [...prev, id]);

    try {
      if (existe) {
        const response = await fetch(buildApiUrl(`/b2g/licitacoes-gerenciadas/${encodeURIComponent(id)}`), {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || payload?.message || 'Não foi possível remover a licitação.');
        }

        setLicitacoesGerenciadas(prev => {
          const next = prev.filter(licitacao => getLicitacaoId(licitacao) !== id);
          saveLocalLicitacoesGerenciadas(next);
          return next;
        });
      } else {
        const itemParaSalvar = {
          ...item,
          id,
          gerenciadaEm: new Date().toISOString()
        };
        const response = await fetch(buildApiUrl('/b2g/licitacoes-gerenciadas'), {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ item: itemParaSalvar })
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || payload?.message || 'Não foi possível salvar a licitação.');
        }

        const payload = await response.json().catch(() => null);
        const salvo = payload?.data || itemParaSalvar;
        setLicitacoesGerenciadas(prev => {
          const next = mergeLicitacoesGerenciadas([salvo], prev.filter(licitacao => getLicitacaoId(licitacao) !== id));
          saveLocalLicitacoesGerenciadas(next);
          return next;
        });
      }

      showToast(
        existe ? 'Licitação removida' : 'Licitação adicionada',
        existe ? 'Removida de Licitações Gerenciadas.' : 'Salva em Licitações Gerenciadas.'
      );
    } catch (error) {
      showToast('Erro ao salvar licitação', error.message || 'Tente novamente.', true);
    } finally {
      setSalvandoGerenciadaIds(prev => prev.filter(itemId => itemId !== id));
    }
  };

  const abrirSalvarLead = (item) => {
    setLeadModalItem(item);
    setLeadDecisao('ANALISE');
    setLeadObservacoes('');
  };

  const fecharSalvarLead = () => {
    if (salvandoLeadId) return;
    setLeadModalItem(null);
    setLeadObservacoes('');
    setLeadDecisao('ANALISE');
  };

  const salvarLead = async () => {
    if (!leadModalItem || salvandoLeadId) return;

    const item = leadModalItem;
    const leadName = (item.orgao || item.titulo || 'Órgão B2G').slice(0, 180);
    const decisionLabel = {
      ANALISE: 'Em análise',
      GO: 'GO',
      NO_GO: 'NO GO'
    }[leadDecisao] || 'Em análise';
    const notes = [
      `Edital: ${item.numero || item.id || '-'}`,
      `Fonte: ${item.fonte || '-'}`,
      `Modalidade: ${item.modalidade || '-'}`,
      `Objeto: ${item.titulo || '-'}`,
      `Decisão: ${decisionLabel}`,
      item.link ? `Link: ${item.link}` : '',
      leadObservacoes.trim() ? `Observações: ${leadObservacoes.trim()}` : ''
    ].filter(Boolean).join('\n');

    setSalvandoLeadId(item.id);
    try {
      // 1. Buscar ou criar empresa (órgão)
      const companyResponse = await fetch(buildApiUrl('/companies'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: leadName,
          segment: `B2G Governo | ${item.fonte || 'Busca de Editais'} | ${decisionLabel}`,
          website: item.link || '',
          address: notes,
          city: item.municipio || '',
          state: item.uf || '',
          status: leadDecisao === 'GO' ? 'PROSPECT' : 'LEAD',
          leadScore: leadDecisao === 'GO' ? 85 : leadDecisao === 'ANALISE' ? 65 : 35,
          clientType: 'B2G',
          autoDistribute: false
        })
      });
      const companyData = await companyResponse.json().catch(() => ({}));
      if (!companyResponse.ok) {
        throw new Error(companyData?.error || companyData?.message || 'Não foi possível salvar o lead B2G.');
      }

      // 2. Se decisão for GO, criar oportunidade e redirecionar
      if (leadDecisao === 'GO') {
        // Obter usuário logado
        const userRaw = localStorage.getItem('user');
        const user = userRaw ? JSON.parse(userRaw) : null;

        // Montar dados B2G ricos para a oportunidade
        const b2gData = {
          numeroEdital: item.numero || '',
          orgaoEntidade: leadName,
          modalidade: item.modalidade || '',
          objetoResumido: item.titulo || '',
          objetoDetalhado: item.titulo || '',
          portal: item.fonte || 'PNCP',
          linkBriefing: item.link || '',
          ufCidade: [item.municipio, item.uf].filter(Boolean).join('/') || '',
          dataPublicacao: item.dataPublicacao || '',
          dataAbertura: item.dataAbertura || '',
          envioPropostas: item.dataEncerramento || item.dataAbertura || '',
          decisao: 'GO',
          probabilidadeGanho: 75,
          faseAtual: 'analise',
          grauRisco: 'Médio',
          observacoes: leadObservacoes.trim(),
          convertedAt: new Date().toISOString(),
          sourcePortal: item.fonte || 'PNCP',
          numeroControlePNCP: item.numeroControlePNCP || item.id || ''
        };

        const opportunityResponse = await fetch(buildApiUrl('/opportunities'), {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            title: `[B2G] ${item.numero ? item.numero + ' - ' : ''}${(item.titulo || leadName).slice(0, 200)}`,
            description: JSON.stringify(b2gData),
            value: item.valor || 0,
            probability: 75,
            stage: 'DIAGNOSIS',
            source: 'MANUAL',
            expectedCloseDate: item.dataAbertura || item.dataEncerramento || null,
            companyId: companyData.id,
            ownerId: user?.id || null
          })
        });

        const opportunityData = await opportunityResponse.json().catch(() => ({}));

        if (!opportunityResponse.ok) {
          // Mesmo se falhar a oportunidade, o lead foi salvo
          showToast('Lead salvo', 'Lead salvo, mas houve erro ao criar oportunidade. Acesse B2G > Oportunidades.');
        } else {
          setLeadsSalvos(prev => {
            const next = prev.includes(item.id) ? prev : [...prev, item.id];
            localStorage.setItem('b2g_busca_leads_salvos_v1', JSON.stringify(next));
            return next;
          });
          setLeadModalItem(null);
          setLeadObservacoes('');
          showToast('GO! Oportunidade criada', 'Redirecionando para Oportunidades B2G...');
          // Redirecionar para oportunidades B2G
          setTimeout(() => {
            navigate(`/b2g-oportunidades?clientType=B2G&opportunityId=${encodeURIComponent(opportunityData.id)}&mode=edit`);
          }, 1200);
          return;
        }
      }

      // Para ANALISE e NO_GO: apenas salvar como lead
      setLeadsSalvos(prev => {
        const next = prev.includes(item.id) ? prev : [...prev, item.id];
        localStorage.setItem('b2g_busca_leads_salvos_v1', JSON.stringify(next));
        return next;
      });
      setLeadModalItem(null);
      setLeadObservacoes('');
      showToast(
        leadDecisao === 'NO_GO' ? 'NO GO registrado' : 'Lead salvo',
        leadDecisao === 'NO_GO' ? 'Edital marcado como NO GO.' : 'O edital foi salvo em B2G > Leads.'
      );
    } catch (error) {
      showToast('Erro ao salvar lead', error.message || 'Tente novamente.', true);
    } finally {
      setSalvandoLeadId('');
    }
  };

  const persistirFontes = (next) => {
    setFontesIntegradas(next);
    localStorage.setItem(FONTES_STORAGE_KEY, JSON.stringify(next));
  };

  const abrirNovaFonte = () => {
    setFonteForm(novaFonteForm());
    setModalFonteAberto(true);
  };

  const atualizarPortalFonte = (portal) => {
    const template = FONTES_PAGAS.find(f => f.portal === portal) || FONTES_PAGAS[0];
    setFonteForm(prev => ({ ...prev, portal, nome: template.nome }));
  };

  const testarLoginFonte = async (fonte = fonteForm) => {
    if (!fonte.usuario.trim() || !fonte.senha.trim()) {
      showToast('Credenciais obrigatórias', 'Informe usuário e senha da fonte.', true);
      return false;
    }

    setTestandoFonte(true);
    try {
      const url = new URL(buildApiUrl('/bll-proxy'), window.location.origin);
      url.searchParams.set('portal', fonte.portal);
      url.searchParams.set('action', 'login');
      const res = await fetch(url.toString(), {
        headers: {
          [`x-${fonte.portal}-email`]: fonte.usuario,
          [`x-${fonte.portal}-password`]: fonte.senha
        },
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) throw new Error('Falha ao acessar o proxy da fonte');

      const data = await res.json().catch(() => null);
      if (!data?.autenticado) throw new Error(data?.message || 'O proxy não reconheceu as credenciais enviadas');

      showToast('Login configurado', `${fonte.nome} está pronta para busca autenticada.`);
      return true;
    } catch (err) {
      showToast('Login não concluído', err.message || 'Verifique as credenciais e tente novamente.', true);
      return false;
    } finally {
      setTestandoFonte(false);
    }
  };

  const salvarFonte = async () => {
    const template = FONTES_PAGAS.find(f => f.portal === fonteForm.portal) || FONTES_PAGAS[0];
    const nome = fonteForm.nome.trim() || template.nome;
    const loginOk = await testarLoginFonte({ ...fonteForm, nome });
    if (!loginOk) return;

    const existente = fontesIntegradas.find(f => f.portal === fonteForm.portal);
    const fonte = {
      id: existente?.id || `${fonteForm.portal}-${Date.now()}`,
      portal: fonteForm.portal,
      nome,
      descricao: template.descricao,
      metodo: template.metodo,
      sync: template.sync,
      icon: template.icon,
      usuario: fonteForm.usuario.trim(),
      senha: fonteForm.senha,
      ativa: fonteForm.ativa,
      loginStatus: 'connected',
      ultimoLogin: new Date().toISOString()
    };

    const next = existente
      ? fontesIntegradas.map(item => item.portal === fonte.portal ? fonte : item)
      : [...fontesIntegradas, fonte];
    persistirFontes(next);
    setFontesAtivas(prev => fonte.ativa && !prev.includes(fonte.id) ? [...prev, fonte.id] : prev);
    setModalFonteAberto(false);
  };

  const removerFonte = (id) => {
    const next = fontesIntegradas.filter(f => f.id !== id);
    persistirFontes(next);
    setFontesAtivas(prev => prev.filter(fonteId => fonteId !== id));
    showToast('Fonte removida', 'A integração foi removida do portal de busca.');
  };

  const salvarAlerta = () => {
    if (!alertaForm.palavras.trim()) return;
    const novo = { id: Date.now(), ...alertaForm, criadoEm: new Date().toLocaleDateString('pt-BR') };
    const next = [...alertas, novo];
    setAlertas(next);
    localStorage.setItem('b2g_alertas', JSON.stringify(next));
    setAlertaForm({ palavras: '', uf: '' });
    showToast('Alerta criado!', `Você será notificado sobre "${novo.palavras}".`);
  };

  const removerAlerta = (id) => {
    const next = alertas.filter(a => a.id !== id);
    setAlertas(next);
    localStorage.setItem('b2g_alertas', JSON.stringify(next));
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full">
      <Toast toasts={toasts} />
      <SalvarLeadModal
        item={leadModalItem}
        decisao={leadDecisao}
        observacoes={leadObservacoes}
        saving={Boolean(salvandoLeadId)}
        onDecisao={setLeadDecisao}
        onObservacoes={setLeadObservacoes}
        onClose={fecharSalvarLead}
        onSalvar={salvarLead}
      />

      {/* Tabs de navegação */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-[5.65rem] z-10 shadow-sm">
        <div className="flex items-center gap-1 px-4 py-2">
          {[
            { id: 'busca', label: 'Início', icon: <Search size={14} /> },
            { id: 'gerenciadas', label: `Licitações Gerenciadas (${licitacoesGerenciadas.length})`, icon: <ClipboardList size={14} /> },
            { id: 'fontes', label: 'Fontes Integradas', icon: <Settings size={14} /> },
            { id: 'alertas', label: 'Alertas', icon: <Bell size={14} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
          <div className="ml-auto">
            <button
              onClick={() => { setMostrarFavoritos(!mostrarFavoritos); setActiveTab('busca'); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                mostrarFavoritos
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Heart size={14} fill={mostrarFavoritos ? 'currentColor' : 'none'} />
              Favoritos ({favoritos.length})
            </button>
          </div>
        </div>
      </div>

      {/* ── ABA BUSCA ─────────────────────────────────────────────────────── */}
      {activeTab === 'busca' && (
        <div className="flex flex-col flex-1">
          {/* Header de busca */}
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 pb-6 pt-8 shadow-sm">
            <div className="px-4 max-w-5xl mx-auto">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">Buscador Unificado</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Pesquise editais de todas as esferas públicas em um só lugar.</p>
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={objeto}
                    onChange={e => setObjeto(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ex: Aquisição de Notebooks, Obras, Merenda..."
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm text-base transition placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
                <button
                  onClick={handleBuscar}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 text-base"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                  {loading ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
            </div>
          </div>

          {/* Corpo: filtros + resultados */}
          <div className="flex flex-col gap-4 p-4 max-w-7xl mx-auto w-full flex-1">

            {/* Painel de filtros */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_42px_-32px_rgba(15,23,42,0.45)] dark:border-slate-700/80 dark:bg-slate-900/70">
              <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700/80 dark:bg-slate-900/85 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                    <Filter size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Filtros de pesquisa</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Combine status, fonte, região, datas e produtos para refinar os editais.</p>
                  </div>
                </div>
                <button
                  onClick={limparFiltros}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500/60 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                >
                  <X size={14} />
                  Limpar filtros
                </button>
              </div>

              <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
                <div className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700/70 dark:bg-slate-800/45">
                      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Status</p>
                      <div className="flex flex-wrap gap-2">
                        <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${apenasVigentes ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500/60 dark:bg-blue-500/15 dark:text-blue-200' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300'}`}>
                          <input type="checkbox" checked={apenasVigentes} onChange={e => setApenasVigentes(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                          Vigentes
                        </label>
                        <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${incluirPropostas ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500/60 dark:bg-blue-500/15 dark:text-blue-200' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300'}`}>
                          <input type="checkbox" checked={incluirPropostas} onChange={e => setIncluirPropostas(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                          Em Proposta
                        </label>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700/70 dark:bg-slate-800/45">
                      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Portais autenticados</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: 'Busca exata', checked: buscaExata, onChange: setBuscaExata },
                          { label: 'Com edital', checked: comEdital, onChange: setComEdital },
                          { label: 'Chat', checked: comMonitoramentoChat, onChange: setComMonitoramentoChat }
                        ].map(item => (
                          <label key={item.label} className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${item.checked ? 'border-cyan-400 bg-cyan-50 text-cyan-700 dark:border-cyan-500/60 dark:bg-cyan-500/15 dark:text-cyan-200' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300'}`}>
                            <input type="checkbox" checked={item.checked} onChange={e => item.onChange(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-cyan-600" />
                            {item.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Nº edital</label>
                      <input type="text" value={numeroEdital} onChange={e => setNumeroEdital(e.target.value)} placeholder="Nº edital" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500" />
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[0.7fr_1.3fr]">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">UF</label>
                      <select value={uf} onChange={e => setUf(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                        <option value="">Todo Brasil</option>
                        {ESTADOS_BR.map(e => <option key={e.sigla} value={e.sigla}>{e.sigla}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Cidade</label>
                      <input type="text" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Cidade..." className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500" />
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Publicação</label>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-2 dark:border-slate-700 dark:bg-slate-800/45">
                        <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="h-11 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100" />
                        <span className="text-xs font-semibold text-slate-400">até</span>
                        <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-11 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Prazo</label>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-2 dark:border-slate-700 dark:bg-slate-800/45">
                        <input type="date" value={dataPrazoInicio} onChange={e => setDataPrazoInicio(e.target.value)} className="h-11 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100" />
                        <span className="text-xs font-semibold text-slate-400">até</span>
                        <input type="date" value={dataPrazoFim} onChange={e => setDataPrazoFim(e.target.value)} className="h-11 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700/70 dark:bg-slate-800/45">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Fontes</p>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">{fontesAtivas.length} ativas</span>
                        <button
                          onClick={() => {
                            const todosSelecionados = fontesDisponiveis.every(f => fontesAtivas.includes(f.id));
                            if (todosSelecionados) {
                              setFontesAtivas([]);
                            } else {
                              setFontesAtivas(fontesDisponiveis.map(f => f.id));
                            }
                          }}
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 transition-colors px-2 py-0.5 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-md"
                        >
                          {fontesDisponiveis.every(f => fontesAtivas.includes(f.id)) ? 'Limpar' : 'Selecionar todos'}
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {fontesDisponiveis.map(f => (
                        <label key={f.id} className={`flex min-h-[42px] cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${fontesAtivas.includes(f.id) ? 'border-blue-400 bg-blue-50 text-blue-800 dark:border-blue-500/60 dark:bg-blue-500/15 dark:text-blue-100' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300'}`}>
                          <input type="checkbox" checked={fontesAtivas.includes(f.id)} onChange={() => toggleFonte(f.id)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                          <span className="truncate">{f.icon} {f.nome}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700/70 dark:bg-slate-800/45">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Produtos TI</p>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-bold text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200">{categoriasProdutoTI.length} selecionados</span>
                        <button
                          onClick={() => {
                            const todosSelecionados = CATEGORIAS_PRODUTO_TI.every(cat => categoriasProdutoTI.includes(cat.id));
                            if (todosSelecionados) {
                              setCategoriasProdutoTI([]);
                            } else {
                              setCategoriasProdutoTI(CATEGORIAS_PRODUTO_TI.map(cat => cat.id));
                            }
                          }}
                          className="text-[10px] font-bold text-cyan-600 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-200 transition-colors px-2 py-0.5 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 rounded-md"
                        >
                          {CATEGORIAS_PRODUTO_TI.every(cat => categoriasProdutoTI.includes(cat.id)) ? 'Limpar' : 'Selecionar todos'}
                        </button>
                      </div>
                    </div>
                    <div className="max-h-[148px] overflow-y-auto pr-1">
                      <div className="flex flex-wrap gap-2">
                        {CATEGORIAS_PRODUTO_TI.map(cat => (
                          <label key={cat.id} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${categoriasProdutoTI.includes(cat.id) ? 'border-cyan-400 bg-cyan-50 text-cyan-800 dark:border-cyan-500/60 dark:bg-cyan-500/15 dark:text-cyan-100' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300'}`}>
                            <input type="checkbox" checked={categoriasProdutoTI.includes(cat.id)} onChange={() => toggleCategoriaProduto(cat.id)} className="h-3.5 w-3.5 rounded border-slate-300 text-cyan-600" />
                            {cat.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <input
                      type="text"
                      value={produtoCustom}
                      onChange={e => setProdutoCustom(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleBuscar(); }}
                      placeholder="Outro produto (ex: estabilizador)"
                      className="mt-3 h-10 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-blue-700/80 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Resultados */}
            <div className="flex-1 min-w-0">
              {/* Cabeçalho resultados */}
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-medium text-slate-600 dark:text-slate-300">
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-lg">
                    {mostrarFavoritos ? favoritos.length : itensExibidos.length}
                  </span>{' '}
                  {mostrarFavoritos ? 'favorito(s)' : 'resultado(s) encontrado(s)'}
                  {!mostrarFavoritos && Object.keys(porFonte).length > 0 && (
                    <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                      ({Object.entries(porFonte).map(([f, n]) => `${f}: ${n}`).join(', ')})
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  {buscaFeita && !mostrarFavoritos && (
                    <button onClick={handleBuscar} disabled={loading} className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition">
                      <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
                    </button>
                  )}
                  <select value={ordem} onChange={e => setOrdem(e.target.value)} className="border-none bg-transparent text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer outline-none hover:text-blue-600 dark:hover:text-blue-400 transition">
                    {ORDENS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Erro */}
              {erro && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm mb-4">
                  {erro}
                </div>
              )}

              {/* Loading */}
              {loading ? (
                <div className="bg-white dark:bg-slate-800/60 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-16 text-center">
                  <Loader2 size={40} className="animate-spin text-blue-500 mx-auto mb-4" />
                  <p className="font-medium text-slate-700 dark:text-slate-200">Buscando em múltiplas fontes...</p>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{fontesAtivas.map(f => fontesDisponiveis.find(x => x.id === f)?.nome).filter(Boolean).join(', ')}</p>
                </div>
              ) : itensExibidos.length === 0 ? (
                <div className="bg-white dark:bg-slate-800/60 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-16 text-center">
                  <span className="text-5xl block mb-4">{mostrarFavoritos ? '❤️' : buscaFeita ? '🔍' : '🏛️'}</span>
                  <p className="font-medium text-lg text-slate-700 dark:text-slate-200">
                    {mostrarFavoritos ? 'Nenhum favorito salvo' : buscaFeita ? 'Nenhum edital encontrado' : 'Pronto para buscar'}
                  </p>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                    {mostrarFavoritos ? 'Salve editais clicando em "Salvar"' : buscaFeita ? 'Tente mudar os filtros ou usar outras palavras-chave.' : 'Digite um termo e clique em Buscar.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {itensExibidos.map(item => (
                    <CardEdital
                      key={item.id}
                      item={item}
                      favorito={isFavorito(item)}
                      leadSalvo={isLeadSalvo(item)}
                      salvandoLead={salvandoLeadId === item.id}
                      gerenciada={isLicitacaoGerenciada(item)}
                      salvandoGerenciada={isSalvandoGerenciada(item)}
                      onToggleFavorito={toggleFavorito}
                      onToggleGerenciada={toggleLicitacaoGerenciada}
                      onAbrirSalvarLead={abrirSalvarLead}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ABA LICITAÇÕES GERENCIADAS ───────────────────────────────────── */}
      {activeTab === 'gerenciadas' && (
        <div className="flex flex-col flex-1 p-4">
          <div className="max-w-7xl mx-auto w-full">
            <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                  <ClipboardList size={20} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Licitações Gerenciadas</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {carregandoGerenciadas ? 'Sincronizando licitações marcadas...' : 'Acompanhe as licitações marcadas nos resultados do Portal de Busca.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setActiveTab('busca'); setMostrarFavoritos(false); }}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Search size={15} />
                Buscar licitações
              </button>
            </div>

            {licitacoesGerenciadas.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-16 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
                <ClipboardList size={44} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">Nenhuma licitação gerenciada</p>
                <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
                  Use o botão "Adicionar licitação" no cabeçalho de um resultado encontrado.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {licitacoesGerenciadas.length} licitação(ões) em gerenciamento
                  </p>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                    Em acompanhamento
                  </span>
                </div>
                {licitacoesGerenciadas.map(item => (
                  <CardEdital
                    key={getLicitacaoId(item)}
                    item={item}
                    favorito={isFavorito(item)}
                    leadSalvo={isLeadSalvo(item)}
                    gerenciada
                    salvandoLead={salvandoLeadId === item.id}
                    salvandoGerenciada={isSalvandoGerenciada(item)}
                    onToggleFavorito={toggleFavorito}
                    onToggleGerenciada={toggleLicitacaoGerenciada}
                    onAbrirSalvarLead={abrirSalvarLead}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ABA FONTES ────────────────────────────────────────────────────── */}
      {activeTab === 'fontes' && (
        <div className="p-6 max-w-5xl mx-auto w-full">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Fontes de Dados Integradas</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gerencie e monitore o status de extração dos motores de busca.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {fontesDisponiveis.map(fonte => (
              <div key={fonte.id} className="bg-white dark:bg-slate-800/60 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 hover:shadow-md transition">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 rounded-lg text-2xl bg-blue-100 dark:bg-blue-900/30">{fonte.icon}</div>
                  <div className="flex items-center gap-2">
                    <span className={`${fonte.loginStatus === 'connected' || !fonte.portal ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700'} text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 border`}>
                      <span className={`w-2 h-2 rounded-full ${fonte.loginStatus === 'connected' || !fonte.portal ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                      {fonte.loginStatus === 'connected' ? 'Conectada' : !fonte.portal ? 'Operacional' : 'Configurar'}
                    </span>
                    {fonte.portal && (
                      <button onClick={() => removerFonte(fonte.id)} className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition p-1">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">{fonte.nome}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{fonte.descricao}</p>
                <div className="text-sm border-t border-slate-100 dark:border-slate-700 pt-3 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Método:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">{fonte.metodo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Sincronização:</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{fonte.sync}</span>
                  </div>
                  {fonte.usuario && (
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500 dark:text-slate-400">Usuário:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200 truncate">{fonte.usuario}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {/* Card adicionar */}
            <button
              type="button"
              onClick={abrirNovaFonte}
              className="bg-slate-50 dark:bg-slate-800/30 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl flex flex-col items-center justify-center p-6 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer transition min-h-[230px]"
            >
              <Plus size={32} className="mb-2" />
              <span className="font-medium text-sm">Adicionar Nova Fonte</span>
              <span className="text-xs mt-1 text-center">BLL e BNC</span>
            </button>
          </div>
        </div>
      )}

      {modalFonteAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">Adicionar Fonte</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Configure o acesso ao portal pago.</p>
              </div>
              <button onClick={() => setModalFonteAberto(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Portal</label>
                <select
                  value={fonteForm.portal}
                  onChange={e => atualizarPortalFonte(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                >
                  {FONTES_PAGAS.map(fonte => (
                    <option key={fonte.portal} value={fonte.portal}>{fonte.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Nome da fonte</label>
                <input
                  type="text"
                  value={fonteForm.nome}
                  onChange={e => setFonteForm(prev => ({ ...prev, nome: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Usuário</label>
                  <input
                    type="text"
                    value={fonteForm.usuario}
                    onChange={e => setFonteForm(prev => ({ ...prev, usuario: e.target.value }))}
                    placeholder="email ou login"
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Senha</label>
                  <input
                    type="password"
                    value={fonteForm.senha}
                    onChange={e => setFonteForm(prev => ({ ...prev, senha: e.target.value }))}
                    placeholder="senha do portal"
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={fonteForm.ativa} onChange={e => setFonteForm(prev => ({ ...prev, ativa: e.target.checked }))} className="w-4 h-4 text-blue-600 border-slate-300 rounded" />
                <span className="text-sm text-slate-600 dark:text-slate-300">Usar esta fonte nas buscas</span>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => testarLoginFonte()}
                disabled={testandoFonte}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-60"
              >
                {testandoFonte ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                Testar login
              </button>
              <button
                type="button"
                onClick={salvarFonte}
                disabled={testandoFonte}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-60"
              >
                {testandoFonte ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Salvar fonte
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ABA ALERTAS ───────────────────────────────────────────────────── */}
      {activeTab === 'alertas' && (
        <div className="p-6 max-w-3xl mx-auto w-full">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Alertas Inteligentes</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Configure alertas para ser notificado quando um edital do seu interesse for publicado.</p>
          </div>

          {/* Formulário */}
          <div className="bg-white dark:bg-slate-800/60 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
              <Bell size={16} className="text-blue-500" /> Criar Novo Alerta
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Palavras-chave no Objeto</label>
                <input
                  type="text"
                  value={alertaForm.palavras}
                  onChange={e => setAlertaForm(prev => ({ ...prev, palavras: e.target.value }))}
                  placeholder="Ex: Computadores, Obras, Medicamentos"
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Estado</label>
                <select value={alertaForm.uf} onChange={e => setAlertaForm(prev => ({ ...prev, uf: e.target.value }))} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100">
                  <option value="">Qualquer Estado</option>
                  {ESTADOS_BR.map(e => <option key={e.sigla} value={e.sigla}>{e.sigla}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={salvarAlerta} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold shadow-sm transition text-sm">
                Salvar Alerta
              </button>
            </div>
          </div>

          {/* Lista de alertas */}
          {alertas.length > 0 ? (
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-700 dark:text-slate-300 text-sm">Alertas ativos ({alertas.length})</h3>
              {alertas.map(alerta => (
                <div key={alerta.id} className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{alerta.palavras}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{alerta.uf || 'Todo o Brasil'} · Criado em {alerta.criadoEm}</p>
                  </div>
                  <button onClick={() => removerAlerta(alerta.id)} className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition p-1">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500">
              <Bell size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum alerta configurado ainda.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
