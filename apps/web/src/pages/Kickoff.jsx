import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import {
  Rocket,
  Plus,
  Search,
  Calendar,
  Clock,
  Video,
  MapPin,
  Users,
  ClipboardList,
  CheckCircle2,
  ListChecks,
  FileText,
  History,
  Edit,
  Trash2,
  X,
  Eye,
  LayoutGrid,
  List,
  Phone,
  CircleDot,
  MessageSquare,
  Link as LinkIcon,
  UserPlus,
  Download,
  Mail
} from 'lucide-react';

import PageHeader from '../components/PageHeader';
import AnimatedStats from '../components/AnimatedStats';
import ModernTable from '../components/ModernTable';
import GradientCard from '../components/GradientCard';
import { buildApiUrl, getAuthHeaders } from '../config/api';
import { ROLES, toCanonicalRole } from '../utils/permissions';

const PHASES = [
  { id: 'ENTENDIMENTO_OPORTUNIDADE', label: 'Entendimento da Oportunidade', short: 'Entendimento', icon: '🔍', color: 'blue', order: 1 },
  { id: 'APRESENTACAO_PROPOSTA', label: 'Apresentação de Propostas', short: 'Proposta', icon: '📋', color: 'purple', order: 2 },
  { id: 'FECHAMENTO_PROJETO', label: 'Fechamento de Projeto', short: 'Fechamento', icon: '✍️', color: 'green', order: 3 },
  { id: 'ALINHAMENTO_INTERNO', label: 'Alinhamento Interno', short: 'Alinh. Interno', icon: '🏢', color: 'orange', order: 4 },
  { id: 'ALINHAMENTO_EXTERNO', label: 'Alinhamento Externo (Kickoff)', short: 'Kickoff Externo', icon: '🚀', color: 'indigo', order: 5 }
];

const PHASE_MAP = PHASES.reduce((acc, phase) => { acc[phase.id] = phase; return acc; }, {});

const STATUS = {
  AGENDADA: { label: 'Agendada', color: 'bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300' },
  REALIZADA: { label: 'Realizada', color: "bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-300 dark:text-emerald-300" },
  CANCELADA: { label: 'Cancelada', color: 'bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300' },
  REAGENDADA: { label: 'Reagendada', color: 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-800 dark:text-yellow-300' }
};

const PLATFORMS = {
  MEET: { label: 'Google Meet', icon: Video, color: "bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300 dark:text-emerald-300" },
  TEAMS: { label: 'Microsoft Teams', icon: Video, color: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300' },
  ZOOM: { label: 'Zoom', icon: Video, color: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  PRESENCIAL: { label: 'Presencial', icon: MapPin, color: 'bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300' },
  TELEFONE: { label: 'Telefone', icon: Phone, color: "bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.2)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]" },
  OUTRO: { label: 'Outro', icon: CircleDot, color: "bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.2)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]" }
};

const ACTION_STATUS = {
  PENDENTE: { label: 'Pendente', color: 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-800 dark:text-yellow-300' },
  EM_ANDAMENTO: { label: 'Em Andamento', color: 'bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300' },
  CONCLUIDO: { label: 'Concluído', color: "bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-300 dark:text-emerald-300" },
  CANCELADO: { label: 'Cancelado', color: 'bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300' }
};

const PARTICIPANT_STATUS = {
  CONVIDADO: { label: 'Convidado', color: "bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.2)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]" },
  CONFIRMADO: { label: 'Confirmado', color: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  RECUSADO: { label: 'Recusado', color: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300' },
  PRESENTE: { label: 'Presente', color: "bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300 dark:text-emerald-300" }
};

const formatMeetingDate = (value) => {
  if (!value) return '[data da reunião]';
  return new Date(value).toLocaleDateString('pt-BR');
};

const participantNames = (meeting, role) => {
  const list = meeting.participants;
  // Defensivo: participants pode vir como _count (número), objeto Prisma sem array, ou undefined
  if (!Array.isArray(list)) return '[participantes]';
  const names = list
    .filter((participant) => !role || participant.role === role)
    .map((participant) => participant.user?.name || participant.contact?.name)
    .filter(Boolean);
  return names.length ? names.join(', ') : '[participantes]';
};

// Garante que o meeting passado para buildNotes sempre tem participants como array
const safeMeetingForNotes = (meeting) => ({
  ...meeting,
  participants: Array.isArray(meeting?.participants) ? meeting.participants : [],
});

const asList = (value) => (Array.isArray(value) ? value : []);

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const canDeleteKickoffMeetings = (user) => {
  const role = toCanonicalRole(user?.role, user);
  return role === ROLES.ADMIN || role === ROLES.MASTER;
};

const MINUTES_TEMPLATES = {
  INTERNAL: {
    title: 'Ata de Kickoff Interno',
    badge: 'Alinhamento interno',
    description: 'Modelo para organizar escopo, responsabilidades, riscos e plano antes da reunião com o cliente.',
    accent: 'indigo',
    actions: [
      {
        title: 'Validar escopo e premissas com time interno',
        description: 'Revisar limites do projeto, entregáveis contratados, dependências e riscos antes do kickoff externo.',
        priority: 'HIGH'
      },
      {
        title: 'Confirmar responsáveis por frente de trabalho',
        description: 'Definir dono técnico, dono comercial, PM/CS e responsáveis por documentação, cronograma e comunicação.',
        priority: 'MEDIUM'
      },
      {
        title: 'Preparar materiais para kickoff externo',
        description: 'Separar apresentação, cronograma macro, matriz de responsabilidades, próximos passos e perguntas ao cliente.',
        priority: 'HIGH'
      }
    ],
    buildNotes: (meeting) => `ATA DE KICKOFF INTERNO

Projeto/Oportunidade: ${meeting.opportunity?.title || '[nome do projeto]'}
Cliente: ${meeting.company?.name || '[cliente]'}
Data: ${formatMeetingDate(meeting.scheduledDate)}
Horário: ${meeting.startTime || '[início]'}${meeting.endTime ? ` às ${meeting.endTime}` : ''}
Responsável pela reunião: ${meeting.owner?.name || '[responsável]'}
Participantes internos: ${participantNames(meeting, 'INTERNO')}

1. Objetivo da reunião
Alinhar internamente o entendimento da oportunidade, escopo contratado, expectativas do cliente, responsabilidades da equipe e plano de condução do kickoff externo.

2. Contexto comercial e técnico
- Oportunidade: ${meeting.opportunity?.number || '[número]'}
- Valor estimado: R$ ${Number(meeting.opportunity?.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Solução/serviço contratado: [descrever]
- Premissas comerciais: [descrever]
- Restrições ou pontos de atenção: [descrever]

3. Escopo preliminar
- Entregáveis principais: [listar]
- Itens fora de escopo: [listar]
- Dependências do cliente: [listar]
- Dependências internas: [listar]

4. Papéis e responsabilidades
- Comercial: [nome / responsabilidade]
- Pré-vendas / Engenharia: [nome / responsabilidade]
- Operações / Implantação: [nome / responsabilidade]
- Gestão do projeto: [nome / responsabilidade]
- Financeiro / Administrativo: [nome / responsabilidade]

5. Riscos e pontos de atenção
- Risco 1: [impacto / ação preventiva]
- Risco 2: [impacto / ação preventiva]
- Pendências para esclarecimento com o cliente: [listar]

6. Plano para kickoff externo
- Objetivo do kickoff externo: [descrever]
- Pauta proposta ao cliente: [listar]
- Informações que precisam ser solicitadas ao cliente: [listar]
- Próximos passos esperados após a reunião: [listar]

7. Decisões internas
- [decisão 1]
- [decisão 2]

8. Ações definidas
- [ação] | Responsável: [nome] | Prazo: [data]
- [ação] | Responsável: [nome] | Prazo: [data]`
  },
  EXTERNAL: {
    title: 'Ata de Kickoff Externo',
    badge: 'Cliente e projeto',
    description: 'Modelo para registrar alinhamento com cliente, governança, cronograma, entregáveis e próximos passos.',
    accent: 'green',
    actions: [
      {
        title: 'Enviar ata de kickoff para validação do cliente',
        description: 'Compartilhar resumo da reunião, decisões, responsáveis, próximos passos e solicitar aceite ou ajustes.',
        priority: 'HIGH'
      },
      {
        title: 'Publicar cronograma inicial do projeto',
        description: 'Formalizar marcos, janelas de execução, responsáveis, dependências e datas de acompanhamento.',
        priority: 'HIGH'
      },
      {
        title: 'Solicitar acessos e informações ao cliente',
        description: 'Enviar lista de acessos, contatos técnicos, documentos, ambientes e informações necessárias para início.',
        priority: 'MEDIUM'
      }
    ],
    buildNotes: (meeting) => `ATA DE KICKOFF EXTERNO

Projeto/Oportunidade: ${meeting.opportunity?.title || '[nome do projeto]'}
Cliente: ${meeting.company?.name || '[cliente]'}
CNPJ: ${meeting.company?.document || '[CNPJ]'}
Data: ${formatMeetingDate(meeting.scheduledDate)}
Horário: ${meeting.startTime || '[início]'}${meeting.endTime ? ` às ${meeting.endTime}` : ''}
Plataforma/Local: ${PLATFORMS[meeting.platform]?.label || meeting.platform || '[plataforma]'}
Responsável Chorst: ${meeting.owner?.name || '[responsável]'}
Participantes internos: ${participantNames(meeting, 'INTERNO')}
Participantes cliente: ${participantNames(meeting, 'EXTERNO')}

1. Objetivo da reunião
Realizar o alinhamento inicial entre Chorst e cliente, confirmar escopo, responsabilidades, governança, cronograma macro, canais de comunicação e próximos passos para início do projeto.

2. Contexto do projeto
- Necessidade do cliente: [descrever]
- Solução contratada: [descrever]
- Resultado esperado: [descrever]
- Critérios de sucesso: [descrever]

3. Escopo e entregáveis
- Entregável 1: [descrever]
- Entregável 2: [descrever]
- Entregável 3: [descrever]
- Fora de escopo / premissas: [descrever]

4. Governança e comunicação
- Patrocinador do cliente: [nome]
- Ponto focal do cliente: [nome]
- Ponto focal Chorst: [nome]
- Canal oficial de comunicação: [e-mail / Teams / WhatsApp / portal]
- Frequência de acompanhamento: [semanal / quinzenal / sob demanda]

5. Cronograma macro
- Início previsto: [data]
- Marcos principais: [listar]
- Data estimada de entrega/homologação: [data]
- Janelas ou restrições de execução: [descrever]

6. Dependências do cliente
- Acessos necessários: [listar]
- Documentos/informações pendentes: [listar]
- Validações ou aprovações necessárias: [listar]

7. Riscos e pontos de atenção
- [risco/ponto] | Impacto: [baixo/médio/alto] | Mitigação: [ação]
- [risco/ponto] | Impacto: [baixo/médio/alto] | Mitigação: [ação]

8. Decisões tomadas
- [decisão 1]
- [decisão 2]

9. Próximos passos
- [ação] | Responsável: [nome] | Prazo: [data]
- [ação] | Responsável: [nome] | Prazo: [data]

10. Encerramento
Ficou acordado que os próximos acompanhamentos serão conduzidos conforme a governança definida nesta reunião. Esta ata será compartilhada para validação dos participantes.`
  }
};

const MINUTES_STORAGE_VERSION = 1;

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const safeFileName = (value) => String(value || 'ata-kickoff')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase() || 'ata-kickoff';

const parseMinutesDocuments = (rawNotes) => {
  const raw = String(rawNotes || '').trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type === 'kickoff-minutes' && Array.isArray(parsed.documents)) {
      return parsed.documents.map((document) => ({
        id: String(document.id || `ata-${Date.now()}`),
        templateKey: document.templateKey || 'CUSTOM',
        title: document.title || 'Ata de Kickoff',
        content: document.content || '',
        createdAt: document.createdAt || new Date().toISOString(),
        updatedAt: document.updatedAt || document.createdAt || new Date().toISOString()
      }));
    }
  } catch {
    // Texto antigo de ata continua sendo tratado como uma ata editável.
  }

  return [{
    id: 'legacy-minutes',
    templateKey: 'LEGACY',
    title: 'Ata salva anteriormente',
    content: raw,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }];
};

const serializeMinutesDocuments = (documents) => JSON.stringify({
  type: 'kickoff-minutes',
  version: MINUTES_STORAGE_VERSION,
  documents
});

const splitMinutesSections = (content) => {
  const lines = String(content || '').split(/\r?\n/);
  const sections = [];
  let current = { title: 'Resumo', lines: [] };

  lines.forEach((line) => {
    const trimmed = line.trim();
    const match = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (match) {
      if (current.title || current.lines.some(Boolean)) sections.push(current);
      current = { title: `${match[1]}. ${match[2]}`, lines: [] };
      return;
    }
    current.lines.push(line);
  });

  if (current.title || current.lines.some(Boolean)) sections.push(current);
  return sections.filter((section) => section.lines.some((line) => line.trim()) || section.title !== 'Resumo');
};

const renderStructuredMinutesHtml = (content) => {
  const sections = splitMinutesSections(content);
  if (!sections.length) return '<p class="empty">Sem conteudo registrado.</p>';

  return sections.map((section) => {
    const body = section.lines
      .join('\n')
      .trim()
      .split(/\n{2,}/)
      .map((block) => {
        const rows = block.split(/\n/).map((line) => line.trim()).filter(Boolean);
        const isList = rows.length > 0 && rows.every((line) => /^[-•]\s+/.test(line));
        if (isList) {
          return `<ul>${rows.map((line) => `<li>${escapeHtml(line.replace(/^[-•]\s+/, ''))}</li>`).join('')}</ul>`;
        }
        return `<p>${rows.map(escapeHtml).join('<br>')}</p>`;
      })
      .join('');

    return `<section class="minutes-section"><h2>${escapeHtml(section.title)}</h2>${body}</section>`;
  }).join('');
};

const buildMinutesPdfHtml = ({ meeting, document }) => {
  const generatedAt = new Date().toLocaleString('pt-BR');
  const fileName = `${safeFileName(document.title)}.pdf`;
  const template = MINUTES_TEMPLATES[document.templateKey];
  const templateLabel = template?.title || document.templateKey || 'Ata de Kickoff';
  const participants = (Array.isArray(meeting.participants) ? meeting.participants : [])
    .map((participant) => participant.user?.name || participant.contact?.name)
    .filter(Boolean)
    .join(', ');
  const mailSubject = encodeURIComponent(`${document.title} - ${meeting.company?.name || meeting.title || 'Kickoff'}`);
  const mailBody = encodeURIComponent(
    `Olá,\n\nSegue ata de kickoff para validação.\n\nReunião: ${meeting.title || '-'}\nCliente: ${meeting.company?.name || '-'}\nData: ${formatMeetingDate(meeting.scheduledDate)}\n\nAnexe o PDF salvo nesta visualização antes de enviar.\n`
  );

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(fileName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #e5e7eb; color: #111827; font-family: Arial, Helvetica, sans-serif; }
    .toolbar { position: sticky; top: 0; z-index: 10; display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 12px 18px; background: #111827; color: #f8fafc; box-shadow: 0 4px 18px rgba(15,23,42,.18); }
    .toolbar strong { font-size: 14px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    button, .button { border: 0; border-radius: 6px; padding: 9px 12px; font-weight: 800; cursor: pointer; text-decoration: none; font-size: 13px; display: inline-flex; align-items: center; }
    .primary { background: #4f46e5; color: #fff; }
    .secondary { background: #263345; color: #fff; }
    .email { background: #16a34a; color: #fff; }
    .page { width: 210mm; min-height: 297mm; margin: 18px auto; padding: 18mm; background: #fff; box-shadow: 0 20px 45px rgba(15,23,42,.2); }
    .hero { border-bottom: 4px solid #4f46e5; padding-bottom: 18px; margin-bottom: 18px; }
    .eyebrow { color: #4f46e5; font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
    h1 { margin: 6px 0 8px; font-size: 30px; line-height: 1.1; color: #0f172a; }
    h2 { margin: 0 0 8px; font-size: 15px; color: #1e293b; }
    .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 18px; margin-top: 14px; font-size: 12px; }
    .meta div { border-bottom: 1px solid #eef2f7; padding-bottom: 7px; }
    .meta span { display: block; color: #64748b; font-size: 10px; font-weight: 800; text-transform: uppercase; }
    .minutes-section { break-inside: avoid; border: 1px solid #e2e8f0; border-left: 4px solid #4f46e5; border-radius: 8px; padding: 12px 14px; margin: 0 0 12px; background: #fbfdff; }
    .minutes-section p { margin: 0 0 8px; font-size: 12.5px; line-height: 1.65; }
    .minutes-section p:last-child { margin-bottom: 0; }
    ul { margin: 0; padding-left: 18px; }
    li { margin: 4px 0; font-size: 12.5px; line-height: 1.55; }
    .empty { color: #64748b; font-style: italic; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #dbe3ee; display: flex; justify-content: space-between; color: #64748b; font-size: 10px; }
    @page { size: A4; margin: 10mm; }
    @media print {
      body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .toolbar { display: none; }
      .page { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <strong>Visualizacao PDF - ${escapeHtml(document.title)}</strong>
    <div class="actions">
      <a class="button email" href="mailto:?subject=${mailSubject}&body=${mailBody}">Enviar por e-mail</a>
      <button class="secondary" onclick="window.close()">Fechar</button>
      <button class="primary" onclick="window.print()">Imprimir / Salvar PDF</button>
    </div>
  </div>
  <main class="page">
    <section class="hero">
      <div class="eyebrow">Ata de Kickoff</div>
      <h1>${escapeHtml(document.title)}</h1>
      <div class="meta">
        <div><span>Reuniao</span>${escapeHtml(meeting.title || '-')}</div>
        <div><span>Numero</span>${escapeHtml(meeting.number || '-')}</div>
        <div><span>Cliente</span>${escapeHtml(meeting.company?.name || '-')}</div>
        <div><span>Oportunidade</span>${escapeHtml(meeting.opportunity?.title || '-')}</div>
        <div><span>Data</span>${formatMeetingDate(meeting.scheduledDate)}</div>
        <div><span>Horario</span>${escapeHtml(`${meeting.startTime || '-'}${meeting.endTime ? ` as ${meeting.endTime}` : ''}`)}</div>
        <div><span>Responsavel</span>${escapeHtml(meeting.owner?.name || '-')}</div>
        <div><span>Gerado em</span>${escapeHtml(generatedAt)}</div>
      </div>
      <div class="meta">
        <div><span>Participantes</span>${escapeHtml(participants || '-')}</div>
        <div><span>Modelo</span>${escapeHtml(templateLabel)}</div>
        <div><span>Arquivo sugerido</span>${escapeHtml(fileName)}</div>
      </div>
    </section>
    ${renderStructuredMinutesHtml(document.content)}
    <div class="footer">
      <span>Nexos Integrator - Gestao de Kickoff</span>
      <span>${escapeHtml(fileName)}</span>
    </div>
  </main>
</body>
</html>`;
};

const buildMinutesEmailHref = ({ meeting, document }) => {
  const subject = encodeURIComponent(`${document.title} - ${meeting.company?.name || meeting.title || 'Kickoff'}`);
  const body = encodeURIComponent([
    'Olá,',
    '',
    'Segue abaixo a ata de kickoff para validação.',
    '',
    `Reunião: ${meeting.title || '-'}`,
    `Cliente: ${meeting.company?.name || '-'}`,
    `Data: ${formatMeetingDate(meeting.scheduledDate)}`,
    '',
    document.content || '',
    '',
    'Atenciosamente,'
  ].join('\n'));

  return `mailto:?subject=${subject}&body=${body}`;
};

const getMinutesTemplateKeyForMeeting = (meeting) => {
  if (meeting?.phase === 'ALINHAMENTO_INTERNO') return 'INTERNAL';
  if (meeting?.phase === 'ALINHAMENTO_EXTERNO') return 'EXTERNAL';
  return 'EXTERNAL';
};

const Kickoff = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const companyIdFilter = searchParams.get('companyId') || '';
  const meetingIdParam = searchParams.get('meetingId') || '';
  const [meetings, setMeetings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');

  const [viewMode, setViewMode] = useState('pipeline');

  // Atas: lista agrupada por cliente, com filtro
  const [atasClientFilter, setAtasClientFilter] = useState('');

  // Empresas únicas das reuniões com ata preenchida
  const meetingsWithNotes = useMemo(() =>
    meetings.filter(m => m.meetingNotes && m.meetingNotes.trim() !== ''),
    [meetings]
  );

  const uniqueCompaniesForAtas = useMemo(() => {
    const seen = new Set();
    return meetingsWithNotes
      .map(m => m.company)
      .filter(c => c && c.id && !seen.has(c.id) && seen.add(c.id));
  }, [meetingsWithNotes]);

  const filteredMeetingsWithNotes = useMemo(() =>
    atasClientFilter
      ? meetingsWithNotes.filter(m => m.company?.id === atasClientFilter)
      : meetingsWithNotes,
    [meetingsWithNotes, atasClientFilter]
  );

  // Agrupa atas por empresa
  const atasGroupedByCompany = useMemo(() => {
    const groups = {};
    filteredMeetingsWithNotes.forEach(m => {
      const key = m.company?.id || 'sem-empresa';
      if (!groups[key]) groups[key] = { company: m.company, meetings: [] };
      groups[key].meetings.push(m);
    });
    return Object.values(groups);
  }, [filteredMeetingsWithNotes]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [detailMeeting, setDetailMeeting] = useState(null);
  const [detailInitialTab, setDetailInitialTab] = useState('overview');
  const [projectKickoffContext, setProjectKickoffContext] = useState(null);
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }, []);
  const currentRole = toCanonicalRole(currentUser?.role, currentUser);
  const canDeleteMeetings = currentRole === ROLES.ADMIN || currentRole === ROLES.MASTER;

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (phaseFilter) params.set('phase', phaseFilter);
      if (searchTerm) params.set('search', searchTerm);
      if (companyIdFilter) params.set('companyId', companyIdFilter);
      params.set('limit', '100');

      const [meetingsRes, statsRes] = await Promise.all([
        fetch(buildApiUrl(`/kickoff/meetings?${params.toString()}`), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/kickoff/stats'), { headers: getAuthHeaders() })
      ]);

      if (meetingsRes.ok) {
        const data = await meetingsRes.json();
        setMeetings(data.meetings || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, phaseFilter, searchTerm, companyIdFilter]);

  useEffect(() => {
    if (searchParams.get('openCreate') !== '1' || searchParams.get('from') !== 'project') return;

    try {
      const rawContext = localStorage.getItem('pm_kickoff_context');
      const parsedContext = rawContext ? JSON.parse(rawContext) : null;
      setProjectKickoffContext(parsedContext);
      setEditingMeeting(null);
      setShowCreateModal(true);
      if (parsedContext?.kickoffType === 'internal') setPhaseFilter('ALINHAMENTO_INTERNO');
      if (parsedContext?.kickoffType === 'external') setPhaseFilter('ALINHAMENTO_EXTERNO');
    } catch (error) {
      console.error('Erro ao carregar contexto do projeto:', error);
    }
  }, [searchParams]);

  const filteredMeetings = useMemo(() => meetings, [meetings]);

  const getStatusCount = (status) =>
    stats?.byStatus?.find((s) => s.status === status)?._count?.status || 0;

  const getPhaseMeetings = (phaseId) =>
    filteredMeetings.filter((m) => m.phase === phaseId);

  const openDetail = async (meeting, initialTab = 'overview') => {
    try {
      const res = await fetch(buildApiUrl(`/kickoff/meetings/${meeting.id}`), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDetailInitialTab(initialTab);
        setDetailMeeting(data);
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
    }
  };

  const openedFromParamRef = useRef('');

  useEffect(() => {
    if (!meetingIdParam || openedFromParamRef.current === meetingIdParam) return;
    openedFromParamRef.current = meetingIdParam;
    openDetail({ id: meetingIdParam }, 'overview');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingIdParam]);

  const closeDetail = () => {
    setDetailMeeting(null);
    setDetailInitialTab('overview');
    openedFromParamRef.current = '';
    if (meetingIdParam) {
      const next = new URLSearchParams(searchParams);
      next.delete('meetingId');
      setSearchParams(next, { replace: true });
    }
  };

  const openEdit = (meeting) => {
    setEditingMeeting(meeting);
    setShowCreateModal(true);
  };

  const handleDelete = async (meeting) => {
    if (!window.confirm(`Excluir a reunião ${meeting.number}?`)) return;
    try {
      const res = await fetch(buildApiUrl(`/kickoff/meetings/${meeting.id}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        await fetchData();
        return true;
      }
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Erro ao excluir reunião');
    } catch (error) {
      console.error('Erro ao excluir reunião:', error);
      alert('Erro ao excluir reunião');
    }
    return false;
  };

  if (loading && meetings.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Gestão de Kickoff"
        subtitle="Gerencie o ciclo de reuniões estratégicas do projeto — do comercial à entrega"
        icon={Rocket}
        gradient="indigo"
        breadcrumbs={['CRM', 'Gestão', 'Kickoff']}
        actions={[
          {
            label: 'Nova Reunião',
            icon: Plus,
            onClick: () => {
              setEditingMeeting(null);
              setShowCreateModal(true);
            },
            variant: 'primary'
          }
        ]}
      />

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <AnimatedStats
          title="Total de Reuniões"
          value={stats?.total || 0}
          subtitle="Todos os status"
          icon={Rocket}
          color="indigo"
        />
        <AnimatedStats
          title="Agendadas"
          value={getStatusCount('AGENDADA')}
          subtitle="Aguardando realização"
          icon={Calendar}
          color="blue"
        />
        <AnimatedStats
          title="Realizadas"
          value={getStatusCount('REALIZADA')}
          subtitle="Concluídas com sucesso"
          icon={CheckCircle2}
          color="green"
        />
        <AnimatedStats
          title="Reagendadas"
          value={getStatusCount('REAGENDADA')}
          subtitle="Nova data definida"
          icon={Clock}
          color="yellow"
        />
        <AnimatedStats
          title="Canceladas"
          value={getStatusCount('CANCELADA')}
          subtitle="Não realizadas"
          icon={X}
          color="red"
        />
      </div>

      {/* Filtros */}
      <GradientCard gradient="gray" className="p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-end">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por reunião, cliente ou oportunidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-[var(--crm-border)] dark:border-[color:var(--crm-border)] rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[var(--crm-surface)] shadow-sm"
              />
            </div>
          </div>
          <div className="sm:w-56">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 border border-[var(--crm-border)] dark:border-[color:var(--crm-border)] rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[var(--crm-surface)] shadow-sm"
            >
              <option value="">Todos os Status</option>
              <option value="AGENDADA">Agendada</option>
              <option value="REALIZADA">Realizada</option>
              <option value="REAGENDADA">Reagendada</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>
          <div className="sm:w-64">
            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              className="w-full px-4 py-3 border border-[var(--crm-border)] dark:border-[color:var(--crm-border)] rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[var(--crm-surface)] shadow-sm"
            >
              <option value="">Todas as Fases</option>
              {PHASES.map((phase) => (
                <option key={phase.id} value={phase.id}>{phase.label}</option>
              ))}
            </select>
          </div>
          <div className="flex rounded-xl border border-[var(--crm-border)] dark:border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[var(--crm-surface)] shadow-sm overflow-hidden">
            <button
              onClick={() => setViewMode('pipeline')}
              className={`px-4 py-3 flex items-center gap-2 text-sm font-medium transition-colors ${
                viewMode === 'pipeline' ? 'bg-indigo-600 text-white' : "text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_0.05)]"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Pipeline
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-3 flex items-center gap-2 text-sm font-medium transition-colors ${
                viewMode === 'list' ? 'bg-indigo-600 text-white' : "text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_0.05)]"
              }`}
            >
              <List className="w-4 h-4" />
              Lista
            </button>
          </div>
        </div>
      </GradientCard>

      {/* Conteúdo */}
      {viewMode === 'pipeline' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {PHASES.map((phase) => {
            const phaseMeetings = getPhaseMeetings(phase.id);
            const colorMap = {
              blue: 'border-blue-200 bg-blue-50/50 dark:border-blue-500/25 dark:bg-blue-900/20',
              purple: 'border-purple-200 bg-purple-50/50 dark:border-purple-500/25 dark:bg-purple-900/20',
              green: "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/50 dark:border-emerald-500/25 dark:bg-emerald-900/20",
              orange: 'border-orange-200 bg-orange-50/50 dark:border-orange-500/25 dark:bg-orange-900/20',
              indigo: 'border-indigo-200 bg-indigo-50/50 dark:border-indigo-500/25 dark:bg-indigo-900/20'
            };
            return (
              <div key={phase.id} className={`rounded-2xl border ${colorMap[phase.color]} p-4 min-h-[400px]`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{phase.icon}</span>
                    <div>
                      <h3 className="text-sm font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] leading-tight">{phase.label}</h3>
                      <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">{phaseMeetings.length} reuniões</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {phaseMeetings.map((meeting) => (
                    <MeetingCard
                      key={meeting.id}
                      meeting={meeting}
                      onView={() => openDetail(meeting)}
                      onEdit={() => openEdit(meeting)}
                      onDelete={() => handleDelete(meeting)}
                      canDelete={canDeleteMeetings}
                    />
                  ))}
                  {phaseMeetings.length === 0 && (
                    <div className="border-2 border-dashed border-[var(--crm-border)] dark:border-[color:var(--crm-border)] rounded-xl p-6 text-center">
                      <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">Nenhuma reunião nesta fase</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <GradientCard gradient="gray" className="shadow-lg">
          <div className="p-6">
            <ModernTable
              title="Reuniões de Kickoff"
              data={filteredMeetings}
              columns={[
                {
                  key: 'meeting',
                  label: 'Reunião',
                  render: (item) => (
                    <div className="flex items-center">
                      <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-500/15 rounded-lg flex items-center justify-center mr-3 text-base">
                        {PHASE_MAP[item.phase]?.icon || '📅'}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">{item.title}</div>
                        <div className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">{item.number}</div>
                      </div>
                    </div>
                  )
                },
                {
                  key: 'company',
                  label: 'Cliente / Oportunidade',
                  render: (item) => (
                    <div>
                      <div className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">{item.company?.name}</div>
                      <div className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">
                        {item.opportunity?.title}
                        {item.opportunity?.value ? ` • R$ ${Number(item.opportunity.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
                      </div>
                    </div>
                  )
                },
                {
                  key: 'phase',
                  label: 'Fase',
                  render: (item) => (
                    <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.2)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                      {PHASE_MAP[item.phase]?.short || item.phase}
                    </span>
                  )
                },
                {
                  key: 'schedule',
                  label: 'Agendamento',
                  render: (item) => (
                    <div>
                      <div className="flex items-center text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                        <Calendar className="w-4 h-4 text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] mr-2" />
                        {new Date(item.scheduledDate).toLocaleDateString('pt-BR')}
                      </div>
                      {(item.startTime || item.endTime) && (
                        <div className="flex items-center text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] mt-1 ml-6">
                          <Clock className="w-3 h-3 mr-1" />
                          {item.startTime}{item.endTime ? ` – ${item.endTime}` : ''}
                        </div>
                      )}
                    </div>
                  )
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (item) => (
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${STATUS[item.status]?.color || "bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.2)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]"}`}>
                      {STATUS[item.status]?.label || item.status}
                    </span>
                  )
                },
                {
                  key: 'meta',
                  label: 'Detalhes',
                  render: (item) => (
                    <div className="flex items-center gap-3 text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]" />
                        {item._count?.participants || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <ListChecks className="w-3.5 h-3.5 text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]" />
                        {item._count?.checklistItems || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <ClipboardList className="w-3.5 h-3.5 text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]" />
                        {item._count?.actionItems || 0}
                      </span>
                    </div>
                  )
                }
              ]}
              onView={(item) => openDetail(item)}
              onEdit={(item) => openEdit(item)}
              onDelete={canDeleteMeetings ? (item) => handleDelete(item) : undefined}
              emptyState={
                <div>
                  <Rocket className="w-16 h-16 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mb-2">Nenhuma reunião encontrada</h3>
                  <p className="text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">Crie a primeira reunião de kickoff do projeto</p>
                </div>
              }
            />
          </div>
        </GradientCard>
      )}

      {/* ===== ATAS DE REUNIÕES ===== */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--crm-ink)]">Atas de Reuniões</h2>
              <p className="text-xs text-[var(--crm-muted)]">
                {meetingsWithNotes.length} ata{meetingsWithNotes.length !== 1 ? 's' : ''} registrada{meetingsWithNotes.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          {uniqueCompaniesForAtas.length > 0 && (
            <select
              value={atasClientFilter}
              onChange={e => setAtasClientFilter(e.target.value)}
              className="sm:w-72 px-4 py-2.5 text-sm border border-[var(--crm-border)] rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[var(--crm-surface)] text-[var(--crm-ink)] shadow-sm"
            >
              <option value="">Todos os clientes</option>
              {uniqueCompaniesForAtas.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {meetingsWithNotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--crm-border)] p-10 text-center">
            <FileText className="w-10 h-10 text-[var(--crm-muted)] mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium text-[var(--crm-ink)]">Nenhuma ata registrada ainda</p>
            <p className="text-xs text-[var(--crm-muted)] mt-1">As atas aparecem aqui depois de preenchidas nas reuniões realizadas.</p>
          </div>
        ) : atasGroupedByCompany.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--crm-border)] p-8 text-center">
            <p className="text-sm text-[var(--crm-muted)]">Nenhuma ata encontrada para o cliente selecionado.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {atasGroupedByCompany.map(({ company, meetings: companyMeetings }) => (
              <div key={company?.id || 'sem-empresa'} className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] overflow-hidden">
                {/* Header do grupo */}
                <div className="flex items-center gap-3 px-5 py-3 bg-indigo-50/50 dark:bg-indigo-900/20 border-b border-[var(--crm-border)]">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">🏢</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold text-[var(--crm-ink)] truncate">{company?.name || 'Empresa não identificada'}</span>
                    {company?.document && (
                      <span className="ml-2 text-xs text-[var(--crm-muted)]">{company.document}</span>
                    )}
                  </div>
                  <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-500/15 px-2 py-0.5 rounded-full flex-shrink-0">
                    {companyMeetings.length} ata{companyMeetings.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Lista de atas */}
                <div className="divide-y divide-[var(--crm-border)]">
                  {companyMeetings.map(meeting => {
                    const phase = PHASE_MAP[meeting.phase];
                    return (
                      <div
                        key={meeting.id}
                        className="p-5 hover:bg-[rgb(var(--crm-surface-rgb)_/_0.6)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_0.1)] transition-colors cursor-pointer"
                        onClick={() => openDetail(meeting, 'minutes')}
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 mt-0.5">
                            <span className="text-xl">{phase?.icon || '📋'}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-[var(--crm-ink)] truncate">{meeting.title}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS[meeting.status]?.color}`}>
                                {STATUS[meeting.status]?.label}
                              </span>
                              <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-500/15 px-2 py-0.5 rounded-full">
                                {phase?.label || meeting.phase}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--crm-muted)] mb-2">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(meeting.scheduledDate).toLocaleDateString('pt-BR')}
                                {meeting.startTime && ` • ${meeting.startTime}`}
                              </span>
                              {meeting.owner?.name && (
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {meeting.owner.name}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {meeting.number}
                              </span>
                            </div>
                            {/* Preview da ata */}
                            <p className="text-xs text-[var(--crm-muted)] line-clamp-2 bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.3)] rounded-lg px-3 py-2 border border-[var(--crm-border)]">
                              {meeting.meetingNotes}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); openDetail(meeting, 'minutes'); }}
                            className="flex-shrink-0 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium mt-0.5"
                          >
                            Ver ata →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Criação/Edição */}
      {showCreateModal && (
        <KickoffFormModal
          onClose={() => setShowCreateModal(false)}
          onSaved={async () => {
            setShowCreateModal(false);
            await fetchData();
          }}
          meeting={editingMeeting}
          initialContext={!editingMeeting ? projectKickoffContext : null}
          onOpenMinutes={async (meetingToOpen) => {
            setShowCreateModal(false);
            await openDetail(meetingToOpen, 'minutes');
          }}
        />
      )}

      {/* Modal Detalhes */}
      {detailMeeting && (
        <KickoffDetailModal
          meeting={detailMeeting}
          onClose={closeDetail}
          onMeetingChange={setDetailMeeting}
          onRefresh={fetchData}
          onEdit={(meeting) => {
            setDetailMeeting(null);
            openEdit(meeting);
          }}
          onDelete={async (meeting) => {
            const deleted = await handleDelete(meeting);
            if (deleted) closeDetail();
          }}
          canDelete={canDeleteMeetings}
          fullscreen={Boolean(meetingIdParam)}
          initialTab={detailInitialTab}
        />
      )}
    </div>
  );
};

// ===== CARD DO PIPELINE =====
const MeetingCard = ({ meeting, onView, onEdit, onDelete, canDelete = false }) => {
  const phase = PHASE_MAP[meeting.phase];

  return (
    <div
      className="bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[var(--crm-surface)] rounded-xl border border-[var(--crm-border)] dark:border-[color:var(--crm-border)] shadow-sm hover:shadow-md transition-all duration-200 p-4 cursor-pointer group"
      onClick={onView}
    >
      <div className="flex items-start justify-between mb-2">
        <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${STATUS[meeting.status]?.color}`}>
          {STATUS[meeting.status]?.label}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-indigo-600 dark:hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            title="Editar"
          >
            <Edit className="w-4 h-4" />
          </button>
          {canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-red-600 dark:hover:text-red-700 dark:hover:text-red-300 transition-colors"
              title="Excluir"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <h4 className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mb-1 line-clamp-2">{meeting.title}</h4>
      <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] mb-3 line-clamp-1">{meeting.company?.name}</p>

      <div className="space-y-1.5 text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
        <div className="flex items-center">
          <Calendar className="w-3.5 h-3.5 text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] mr-2" />
          {new Date(meeting.scheduledDate).toLocaleDateString('pt-BR')}
          {meeting.startTime && <span className="ml-1 text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">• {meeting.startTime}</span>}
        </div>
        <div className="flex items-center">
          {PLATFORMS[meeting.platform]?.icon ? (() => {
            const Icon = PLATFORMS[meeting.platform].icon;
            return <Icon className="w-3.5 h-3.5 text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] mr-2" />;
          })() : <CircleDot className="w-3.5 h-3.5 text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] mr-2" />}
          {PLATFORMS[meeting.platform]?.label || meeting.platform}
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-[var(--crm-border)] dark:border-[color:var(--crm-border)]">
          <span className="flex items-center gap-1 text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">
            <Users className="w-3.5 h-3.5" /> {meeting._count?.participants || 0}
          </span>
          <span className="flex items-center gap-1 text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">
            <ListChecks className="w-3.5 h-3.5" /> {meeting._count?.actionItems || 0} ações
          </span>
          <span className="text-indigo-500">{phase?.icon}</span>
        </div>
      </div>
    </div>
  );
};

// ===== MODAL CRIAÇÃO/EDIÇÃO =====
const kickoffPhaseFromContext = (context) => {
  if (context?.kickoffType === 'internal') return 'ALINHAMENTO_INTERNO';
  if (context?.kickoffType === 'external') return 'ALINHAMENTO_EXTERNO';
  return null;
};

const kickoffTitleFromContext = (context) => {
  if (!context) return '';
  const label = context.kickoffType === 'internal' ? 'Kickoff interno' : 'Kickoff externo';
  return `${label} - ${context.projectName || context.phaseTitle || 'Projeto'}`;
};

const kickoffDescriptionFromContext = (context) => {
  if (!context) return '';
  return [
    context.phaseDescription,
    context.projectObjective ? `Objetivo do projeto: ${context.projectObjective}` : '',
    context.projectScope ? `Escopo: ${context.projectScope}` : ''
  ].filter(Boolean).join('\n\n');
};

const KickoffFormModal = ({ onClose, onSaved, meeting, initialContext = null, onOpenMinutes }) => {
  const [formData, setFormData] = useState({
    title: meeting?.title || kickoffTitleFromContext(initialContext),
    description: meeting?.description || kickoffDescriptionFromContext(initialContext),
    phase: meeting?.phase || kickoffPhaseFromContext(initialContext) || 'ENTENDIMENTO_OPORTUNIDADE',
    platform: meeting?.platform || 'MEET',
    meetingLink: meeting?.meetingLink || '',
    scheduledDate: meeting?.scheduledDate ? meeting.scheduledDate.slice(0, 10) : '',
    startTime: meeting?.startTime || '09:00',
    endTime: meeting?.endTime || '10:00',
    opportunityId: meeting?.opportunityId || '',
    templateId: meeting?.templateId || ''
  });
  const [participants, setParticipants] = useState(
    Array.isArray(meeting?.participants) ? meeting.participants.map((p) => ({ userId: p.userId, contactId: p.contactId, role: p.role, isRequired: p.isRequired })) : []
  );
  const [agendaItems, setAgendaItems] = useState(
    Array.isArray(meeting?.agendaItems) ? meeting.agendaItems.map((a) => ({ title: a.title, description: a.description, durationMinutes: a.durationMinutes })) : []
  );
  const [checklistItems, setChecklistItems] = useState(
    Array.isArray(meeting?.checklistItems) ? meeting.checklistItems.map((c) => c.title) : []
  );

  const [opportunities, setOpportunities] = useState([]);
  const [users, setUsers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [preview, setPreview] = useState(null);
  const [selectedInternal, setSelectedInternal] = useState(
    Array.isArray(meeting?.participants) ? meeting.participants.filter((p) => p.userId).map((p) => p.userId) : []
  );
  const [selectedExternal, setSelectedExternal] = useState(
    Array.isArray(meeting?.participants) ? meeting.participants.filter((p) => p.contactId).map((p) => p.contactId) : []
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadOptions = async () => {
      const [oppRes, usersRes] = await Promise.all([
        fetch(buildApiUrl('/opportunities'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/users'), { headers: getAuthHeaders() })
      ]);
      if (oppRes.ok) {
        const data = await oppRes.json();
        const loadedOpportunities = Array.isArray(data) ? data : data.opportunities || [];
        setOpportunities(loadedOpportunities);
        if (!meeting && initialContext && !formData.opportunityId) {
          const projectName = (initialContext.projectName || '').toLowerCase();
          const projectClient = (initialContext.projectClient || '').toLowerCase();
          const matched = loadedOpportunities.find((opp) => {
            const title = (opp.title || '').toLowerCase();
            const company = (opp.company?.name || '').toLowerCase();
            return (projectName && title.includes(projectName)) || (projectClient && company.includes(projectClient));
          });
          if (matched) {
            setFormData((prev) => ({ ...prev, opportunityId: matched.id }));
          }
        }
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(Array.isArray(data) ? data : data.users || []);
      }
    };
    loadOptions();
  }, []);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const res = await fetch(buildApiUrl('/kickoff/templates'), { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          setTemplates(data.templates || []);
        }
      } catch (error) {
        console.error('Erro ao carregar templates:', error);
      }
    };
    loadTemplates();
  }, []);

  useEffect(() => {
    const loadPreview = async () => {
      if (!formData.opportunityId) {
        setPreview(null);
        setSelectedExternal([]);
        return;
      }
      try {
        const res = await fetch(buildApiUrl(`/kickoff/opportunities/${formData.opportunityId}/preview`), { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          setPreview(data);
        }
      } catch (error) {
        console.error('Erro ao carregar preview:', error);
      }
    };
    loadPreview();
  }, [formData.opportunityId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTemplateSelect = (templateId) => {
    setFormData((prev) => ({ ...prev, templateId }));
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      if (agendaItems.length === 0) {
        setAgendaItems((Array.isArray(template.agenda) ? template.agenda : []).map((a) => ({
          title: a.title || a,
          description: a.description,
          durationMinutes: a.durationMinutes
        })));
      }
      if (checklistItems.length === 0) {
        setChecklistItems((Array.isArray(template.checklist) ? template.checklist : []).map((c) => c.title || c));
      }
    }
  };

  const toggleInternal = (userId) => {
    setSelectedInternal((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleExternal = (contactId) => {
    setSelectedExternal((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const addAgendaItem = () => {
    setAgendaItems((prev) => [...prev, { title: '', description: '', durationMinutes: 15 }]);
  };

  const updateAgendaItem = (index, field, value) => {
    setAgendaItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const removeAgendaItem = (index) => {
    setAgendaItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addChecklistItem = () => {
    setChecklistItems((prev) => [...prev, '']);
  };

  const updateChecklistItem = (index, value) => {
    setChecklistItems((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const removeChecklistItem = (index) => {
    setChecklistItems((prev) => prev.filter((_, i) => i !== index));
  };

  const buildPayload = () => {
    const internalParticipants = selectedInternal.map((userId) => ({ userId, role: 'INTERNO' }));
    const externalParticipants = selectedExternal.map((contactId) => ({ contactId, role: 'EXTERNO' }));
    return {
      ...formData,
      participants: [...internalParticipants, ...externalParticipants],
      agendaItems: agendaItems.filter((a) => a.title).map((a) => ({
        title: a.title,
        description: a.description,
        durationMinutes: parseInt(a.durationMinutes) || 15
      })),
      checklistItems: checklistItems.filter((c) => c && c.trim()).map((c) => ({ title: c.trim() }))
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.phase || !formData.scheduledDate || !formData.opportunityId) {
      alert('Preencha os campos obrigatórios: Título, Fase, Data e Oportunidade');
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      const url = meeting
        ? buildApiUrl(`/kickoff/meetings/${meeting.id}`)
        : buildApiUrl('/kickoff/meetings');
      const res = await fetch(url, {
        method: meeting ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        await onSaved();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Erro ao salvar reunião');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar reunião');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 border border-[var(--crm-border)] dark:border-[color:var(--crm-border)] rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-3 lg:p-6">
      <div className="bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[var(--crm-surface)] rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-[var(--crm-border)] dark:border-[color:var(--crm-border)] flex-shrink-0">
          <h2 className="text-xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
            {meeting ? `Editar Reunião ${meeting.number}` : 'Nova Reunião de Kickoff'}
          </h2>
          <button onClick={onClose} className="text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[rgb(var(--crm-muted-rgb)_/_1)] dark:hover:text-[rgb(var(--crm-muted-rgb)_/_1)] transition-colors p-2 rounded-lg hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_0.1)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="kickoff-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Identificação */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mb-1">Título *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className={inputClass}
                placeholder="Ex: Kickoff inicial do projeto ERP"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mb-1">Fase *</label>
              <select name="phase" value={formData.phase} onChange={handleChange} className={inputClass} required>
                {PHASES.map((phase) => (
                  <option key={phase.id} value={phase.id}>{phase.icon} {phase.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mb-1">Oportunidade / Projeto *</label>
              <select name="opportunityId" value={formData.opportunityId} onChange={handleChange} className={inputClass} required>
                <option value="">Selecione a oportunidade</option>
                {opportunities.map((opp) => (
                  <option key={opp.id} value={opp.id}>
                    {opp.title}
                    {opp.company?.name ? ` — ${opp.company.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {initialContext && !meeting && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-500/25 dark:bg-orange-500/10">
              <div className="flex items-start gap-3">
                <Rocket className="mt-0.5 h-5 w-5 text-orange-600 dark:text-orange-300" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-orange-900 dark:text-orange-200">
                    Fluxo iniciado pela Gestão de Projetos
                  </p>
                  <div className="mt-2 grid gap-2 text-xs text-orange-800 dark:text-orange-200 md:grid-cols-3">
                    <div>
                      <span className="block font-semibold opacity-70">Projeto</span>
                      <span className="block truncate">{initialContext.projectName || 'Projeto não informado'}</span>
                    </div>
                    <div>
                      <span className="block font-semibold opacity-70">Fase</span>
                      <span className="block truncate">{initialContext.phaseTitle || 'Fase de kickoff'}</span>
                    </div>
                    <div>
                      <span className="block font-semibold opacity-70">Tipo</span>
                      <span className="block">{initialContext.kickoffType === 'internal' ? 'Kickoff interno' : 'Kickoff externo'}</span>
                    </div>
                  </div>
                  {!formData.opportunityId && (
                    <p className="mt-3 text-xs text-orange-700 dark:text-orange-200">
                      Selecione uma oportunidade/projeto para concluir o cadastro da reunião no módulo Kickoff.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Dados herdados do cliente */}
          {preview && (
            <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/25 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                  <Download className="w-4 h-4" /> Dados herdados da oportunidade
                </h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-indigo-400 dark:text-indigo-300 font-medium">Razão Social</p>
                  <p className="text-indigo-900 dark:text-indigo-300 font-semibold">{preview.company?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-indigo-400 dark:text-indigo-300 font-medium">CNPJ</p>
                  <p className="text-indigo-900 dark:text-indigo-300 font-semibold">{preview.company?.document || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-indigo-400 dark:text-indigo-300 font-medium">Valor do Projeto</p>
                  <p className="text-indigo-900 dark:text-indigo-300 font-semibold">
                    R$ {Number(preview.opportunity?.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-indigo-400 dark:text-indigo-300 font-medium">Segmento</p>
                  <p className="text-indigo-900 dark:text-indigo-300 font-semibold">{preview.company?.segment || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Agendamento */}
          <div>
            <h4 className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" /> Agendamento
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mb-1">Data *</label>
                <input type="date" name="scheduledDate" value={formData.scheduledDate} onChange={handleChange} className={inputClass} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mb-1">Hora Início</label>
                <input type="time" name="startTime" value={formData.startTime} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mb-1">Hora Fim</label>
                <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mb-1">Plataforma</label>
                <select name="platform" value={formData.platform} onChange={handleChange} className={inputClass}>
                  {Object.entries(PLATFORMS).map(([value, pf]) => (
                    <option key={value} value={value}>{pf.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {formData.platform !== 'PRESENCIAL' && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mb-1 flex items-center gap-1">
                  <LinkIcon className="w-3.5 h-3.5" /> Link da Reunião
                </label>
                <input
                  type="url"
                  name="meetingLink"
                  value={formData.meetingLink}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="https://meet.google.com/..."
                />
              </div>
            )}
          </div>

          {/* Template de Pauta */}
          <div>
            <h4 className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" /> Template de Pauta
            </h4>
            <select value={formData.templateId} onChange={(e) => handleTemplateSelect(e.target.value)} className={inputClass}>
              <option value="">Padrão da fase</option>
              {PHASES.map((phase) => {
                const phaseTemplates = templates.filter((t) => t.phase === phase.id);
                if (phaseTemplates.length === 0) return null;
                return (
                  <optgroup key={phase.id} label={`${phase.icon} ${phase.label}`}>
                    {phaseTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (padrão)' : ''}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>

          {/* Pauta Dinâmica */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-indigo-500" /> Pauta da Reunião
              </h4>
              <button type="button" onClick={addAgendaItem} className="text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm font-medium">
                + Adicionar item
              </button>
            </div>
            <div className="space-y-2">
              {agendaItems.map((item, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateAgendaItem(index, 'title', e.target.value)}
                    className={`${inputClass} flex-1`}
                    placeholder="Título do item de pauta"
                  />
                  <input
                    type="number"
                    value={item.durationMinutes}
                    onChange={(e) => updateAgendaItem(index, 'durationMinutes', e.target.value)}
                    className={`${inputClass} w-24`}
                    placeholder="min"
                    min="1"
                  />
                  <button
                    type="button"
                    onClick={() => removeAgendaItem(index)}
                    className="text-red-500 hover:text-red-700 dark:hover:text-red-300 dark:hover:text-red-700 dark:hover:text-red-300 p-2"
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {agendaItems.length === 0 && (
                <p className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] text-center py-2 border border-dashed border-[var(--crm-border)] dark:border-[color:var(--crm-border)] rounded-lg">
                  Nenhum item de pauta
                </p>
              )}
            </div>
          </div>

          {/* Checklist */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-indigo-500" /> Checklist de Verificação
              </h4>
              <button type="button" onClick={addChecklistItem} className="text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm font-medium">
                + Adicionar item
              </button>
            </div>
            <div className="space-y-2">
              {checklistItems.map((item, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <CheckCircle2 className="w-4 h-4 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] flex-shrink-0" />
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => updateChecklistItem(index, e.target.value)}
                    className={`${inputClass} flex-1`}
                    placeholder="Ex: Contrato assinado?"
                  />
                  <button
                    type="button"
                    onClick={() => removeChecklistItem(index)}
                    className="text-red-500 hover:text-red-700 dark:hover:text-red-300 dark:hover:text-red-700 dark:hover:text-red-300 p-2"
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {checklistItems.length === 0 && (
                <p className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] text-center py-2 border border-dashed border-[var(--crm-border)] dark:border-[color:var(--crm-border)] rounded-lg">
                  Nenhum item de checklist
                </p>
              )}
            </div>
          </div>

          {/* Participantes */}
          <div>
            <h4 className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" /> Participantes
            </h4>

            <div className="mb-4">
              <p className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mb-2">Time Interno (usuários do CRM)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[var(--crm-surface-2)] rounded-lg p-3">
                {users.map((user) => (
                  <label key={user.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_0.1)] p-1.5 rounded-md transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedInternal.includes(user.id)}
                      onChange={() => toggleInternal(user.id)}
                      className="rounded border-[var(--crm-border)] dark:border-[color:var(--crm-border)] text-indigo-600 dark:text-indigo-300 focus:ring-indigo-500"
                    />
                    <span className="w-6 h-6 bg-indigo-100 dark:bg-indigo-500/15 rounded-full flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                      {user.name?.charAt(0) || '?'}
                    </span>
                    <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">{user.name}</span>
                  </label>
                ))}
                {users.length === 0 && <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] col-span-2">Nenhum usuário disponível</p>}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mb-2">Contatos do Cliente (externos)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[var(--crm-surface-2)] rounded-lg p-3">
                {(preview?.contacts || []).map((contact) => (
                  <label key={contact.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_0.1)] p-1.5 rounded-md transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedExternal.includes(contact.id)}
                      onChange={() => toggleExternal(contact.id)}
                      className="rounded border-[var(--crm-border)] dark:border-[color:var(--crm-border)] text-green-600 dark:text-emerald-300 focus:ring-green-500"
                    />
                    <span className="w-6 h-6 bg-green-100 dark:bg-green-500/15 rounded-full flex items-center justify-center text-[10px] font-bold text-green-700 dark:text-green-300 dark:text-emerald-300">
                      {contact.name?.charAt(0) || '?'}
                    </span>
                    <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                      {contact.name}
                      <span className="block text-[10px] text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">{contact.position || contact.email}</span>
                    </span>
                  </label>
                ))}
                {(!preview || (preview.contacts || []).length === 0) && (
                  <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] col-span-2">
                    {formData.opportunityId ? 'Nenhum contato cadastrado para este cliente' : 'Selecione uma oportunidade para carregar os contatos'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mb-1">Observações / Objetivo</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className={inputClass}
              placeholder="Contexto, objetivos e expectativas da reunião"
            />
          </div>
        </form>

        <div className="flex justify-end gap-3 p-6 border-t border-[var(--crm-border)] dark:border-[color:var(--crm-border)] flex-shrink-0">
          {meeting && (
            <button
              type="button"
              onClick={() => onOpenMinutes?.(meeting)}
              className="mr-auto inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
            >
              <FileText className="h-4 w-4" /> Ata & Modelos
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] rounded-lg hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="kickoff-form"
            disabled={saving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--crm-border)] border-t-transparent"></div>}
            {meeting ? 'Salvar Alterações' : 'Criar Reunião'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ===== MODAL DETALHES =====
const KickoffDetailModal = ({
  meeting,
  onClose,
  onMeetingChange,
  onRefresh,
  onEdit,
  onDelete,
  canDelete = false,
  fullscreen = false,
  initialTab = 'overview'
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [actionForm, setActionForm] = useState({ title: '', description: '', priority: 'MEDIUM', dueDate: '', assigneeId: '' });
  const [users, setUsers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [showActionForm, setShowActionForm] = useState(false);
  const [newParticipant, setNewParticipant] = useState({ userId: '', contactId: '', role: 'INTERNO' });
  const [showParticipantForm, setShowParticipantForm] = useState(false);
  const [newAgenda, setNewAgenda] = useState({ title: '', description: '', durationMinutes: 15 });
  const [showAgendaForm, setShowAgendaForm] = useState(false);
  const [tratativaDraft, setTratativaDraft] = useState('');
  const [editingTratativaId, setEditingTratativaId] = useState(null);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [minutesDocuments, setMinutesDocuments] = useState(() => parseMinutesDocuments(meeting.meetingNotes));
  const [minutesEditor, setMinutesEditor] = useState(null);
  const [savingMinutes, setSavingMinutes] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, meeting.id]);

  useEffect(() => {
    setMinutesDocuments(parseMinutesDocuments(meeting.meetingNotes));
  }, [meeting.id, meeting.meetingNotes]);

  useEffect(() => {
    const loadUsers = async () => {
      const res = await fetch(buildApiUrl('/users'), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : data.users || []);
      }
    };
    loadUsers();

    const loadContacts = async () => {
      if (!meeting.opportunityId) return;
      try {
        const res = await fetch(buildApiUrl(`/kickoff/opportunities/${meeting.opportunityId}/preview`), { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          setContacts(data.contacts || []);
        }
      } catch (error) {
        console.error('Erro ao carregar contatos:', error);
      }
    };
    loadContacts();
  }, [meeting.opportunityId]);

  const refresh = async () => {
    const res = await fetch(buildApiUrl(`/kickoff/meetings/${meeting.id}`), { headers: getAuthHeaders() });
    if (res.ok) {
      const data = await res.json();
      onMeetingChange(data);
      setMinutesDocuments(parseMinutesDocuments(data.meetingNotes));
    }
    onRefresh();
  };

  const changeStatus = async (status) => {
    const res = await fetch(buildApiUrl(`/kickoff/meetings/${meeting.id}/status`), {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      await refresh();
    }
  };

  const persistMinutesDocuments = async (documents) => {
    const res = await fetch(buildApiUrl(`/kickoff/meetings/${meeting.id}/notes`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ meetingNotes: serializeMinutesDocuments(documents) })
    });
    if (res.ok) {
      const updatedMeeting = await res.json();
      onMeetingChange(updatedMeeting);
      setMinutesDocuments(parseMinutesDocuments(updatedMeeting.meetingNotes));
      onRefresh();
      return updatedMeeting;
    }
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Erro ao salvar ata');
  };

  const toggleChecklist = async (item) => {
    const res = await fetch(buildApiUrl(`/kickoff/checklist/${item.id}`), {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ isCompleted: !item.isCompleted })
    });
    if (res.ok) await refresh();
  };

  const addAgendaItem = async (e) => {
    e.preventDefault();
    if (!newAgenda.title.trim()) return;
    const res = await fetch(buildApiUrl(`/kickoff/meetings/${meeting.id}/agenda`), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        title: newAgenda.title.trim(),
        description: newAgenda.description,
        durationMinutes: parseInt(newAgenda.durationMinutes) || 15
      })
    });
    if (res.ok) {
      setNewAgenda({ title: '', description: '', durationMinutes: 15 });
      setShowAgendaForm(false);
      await refresh();
    }
  };

  const deleteAgendaItem = async (item) => {
    if (!window.confirm(`Remover "${item.title}" da pauta?`)) return;
    const res = await fetch(buildApiUrl(`/kickoff/agenda/${item.id}`), {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (res.ok) await refresh();
  };

  const startTratativa = (item) => {
    setEditingTratativaId(item.id);
    setTratativaDraft(item.tratativa || '');
  };

  const saveTratativa = async (item) => {
    const res = await fetch(buildApiUrl(`/kickoff/agenda/${item.id}`), {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ tratativa: tratativaDraft.trim() })
    });
    if (res.ok) {
      setEditingTratativaId(null);
      setTratativaDraft('');
      await refresh();
    }
  };

  const addChecklist = async (e) => {
    e.preventDefault();
    const title = newChecklistTitle.trim();
    if (!title) return;
    const res = await fetch(buildApiUrl(`/kickoff/meetings/${meeting.id}/checklist`), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title })
    });
    if (res.ok) {
      setNewChecklistTitle('');
      await refresh();
    }
  };

  const deleteChecklist = async (item) => {
    if (!window.confirm(`Remover "${item.title}" do checklist?`)) return;
    const res = await fetch(buildApiUrl(`/kickoff/checklist/${item.id}`), {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (res.ok) await refresh();
  };

  const addActionItem = async (e) => {
    e.preventDefault();
    const res = await fetch(buildApiUrl(`/kickoff/meetings/${meeting.id}/action-items`), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(actionForm)
    });
    if (res.ok) {
      setActionForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '', assigneeId: '' });
      setShowActionForm(false);
      await refresh();
    }
  };

  const updateActionItem = async (item, data) => {
    const res = await fetch(buildApiUrl(`/kickoff/action-items/${item.id}`), {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (res.ok) await refresh();
  };

  const deleteActionItem = async (item) => {
    if (!window.confirm('Excluir este plano de ação?')) return;
    const res = await fetch(buildApiUrl(`/kickoff/action-items/${item.id}`), {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (res.ok) await refresh();
  };

  const openMinutesEditorFromTemplate = (templateKey) => {
    const template = MINUTES_TEMPLATES[templateKey];
    if (!template) {
      return;
    }

    setMinutesEditor({
      id: null,
      templateKey,
      title: template.title,
      content: template.buildNotes(safeMeetingForNotes(meeting))
    });
  };

  const editMinutesDocument = (document) => {
    setMinutesEditor({
      id: document.id,
      templateKey: document.templateKey,
      title: document.title,
      content: document.content
    });
  };

  const saveMinutesDocument = async ({ previewAfterSave = false } = {}) => {
    if (!minutesEditor?.title?.trim()) {
      alert('Informe o título da ATA.');
      return;
    }
    if (!minutesEditor?.content?.trim()) {
      alert('Digite o conteúdo da ATA antes de salvar.');
      return;
    }

    const now = new Date().toISOString();
    const document = {
      id: minutesEditor.id || `ata-${Date.now()}`,
      templateKey: minutesEditor.templateKey || 'CUSTOM',
      title: minutesEditor.title.trim(),
      content: minutesEditor.content,
      createdAt: minutesDocuments.find((item) => item.id === minutesEditor.id)?.createdAt || now,
      updatedAt: now
    };
    const nextDocuments = minutesEditor.id
      ? minutesDocuments.map((item) => item.id === minutesEditor.id ? document : item)
      : [document, ...minutesDocuments.filter((item) => item.id !== document.id)];

    setSavingMinutes(true);
    try {
      await persistMinutesDocuments(nextDocuments);
      setMinutesEditor(null);
      if (previewAfterSave) {
        previewMinutesPdf(document);
      }
    } catch (error) {
      console.error('Erro ao salvar ATA:', error);
      alert(error.message || 'Erro ao salvar ATA');
    } finally {
      setSavingMinutes(false);
    }
  };

  const deleteMinutesDocument = async (document) => {
    if (!window.confirm(`Excluir a ATA "${document.title}"?`)) return;
    const nextDocuments = minutesDocuments.filter((item) => item.id !== document.id);
    try {
      await persistMinutesDocuments(nextDocuments);
    } catch (error) {
      console.error('Erro ao excluir ATA:', error);
      alert(error.message || 'Erro ao excluir ATA');
    }
  };

  const previewMinutesPdf = (document) => {
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
      alert('Não foi possível abrir a visualização em PDF. Libere pop-ups e tente novamente.');
      return;
    }
    previewWindow.document.write(buildMinutesPdfHtml({ meeting, document }));
    previewWindow.document.close();
    previewWindow.focus();
  };

  const sendMinutesEmail = (document) => {
    window.location.href = buildMinutesEmailHref({ meeting, document });
  };

  const applyActionTemplate = (action) => {
    setActionForm({
      title: action.title,
      description: action.description,
      priority: action.priority,
      dueDate: '',
      assigneeId: ''
    });
    setShowActionForm(true);
  };

  const addParticipant = async (e) => {
    e.preventDefault();
    const res = await fetch(buildApiUrl(`/kickoff/meetings/${meeting.id}/participants`), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(newParticipant)
    });
    if (res.ok) {
      setNewParticipant({ userId: '', contactId: '', role: 'INTERNO' });
      setShowParticipantForm(false);
      await refresh();
    }
  };

  const updateParticipantStatus = async (participant, status) => {
    const res = await fetch(buildApiUrl(`/kickoff/participants/${participant.id}`), {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });
    if (res.ok) await refresh();
  };

  const removeParticipant = async (participant) => {
    const res = await fetch(buildApiUrl(`/kickoff/participants/${participant.id}`), {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (res.ok) await refresh();
  };

  const inputClass = "w-full px-3 py-2 border border-[var(--crm-border)] dark:border-[color:var(--crm-border)] rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm";
  const phase = PHASE_MAP[meeting.phase];
  const completedChecklist = Array.isArray(meeting.checklistItems) ? meeting.checklistItems.filter((c) => c.isCompleted).length : 0;
  const totalChecklist = Array.isArray(meeting.checklistItems) ? meeting.checklistItems.length : 0;
  const checklistProgress = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;

  const TABS = [
    { id: 'overview', label: 'Visão Geral', icon: Eye },
    { id: 'agenda', label: 'Pauta', icon: ClipboardList },
    { id: 'checklist', label: 'Checklist', icon: ListChecks },
    { id: 'participants', label: 'Participantes', icon: Users },
    { id: 'minutes', label: 'Ata & Ações', icon: MessageSquare },
    { id: 'history', label: 'Histórico', icon: History }
  ];

  return createPortal(
    <div className={
      fullscreen
        ? "fixed inset-0 z-[60] flex flex-col bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[var(--crm-surface)]"
        : 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-3 lg:p-6'
    }>
      <div className={
        fullscreen
          ? 'flex h-full w-full min-h-0 flex-col overflow-hidden'
          : "bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[var(--crm-surface)] rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col"
      }>
        {/* Header */}
        <div className="p-6 border-b border-[var(--crm-border)] dark:border-[color:var(--crm-border)] flex-shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/15 rounded-xl flex items-center justify-center text-2xl">
                {phase?.icon || '📅'}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">{meeting.title}</h2>
                  <span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${STATUS[meeting.status]?.color}`}>
                    {STATUS[meeting.status]?.label}
                  </span>
                </div>
                <p className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] mt-1">
                  {meeting.number} • {meeting.company?.name}
                  {meeting.company?.document ? ` • CNPJ ${meeting.company.document}` : ''}
                </p>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]" />
                    {new Date(meeting.scheduledDate).toLocaleDateString('pt-BR')}
                  </span>
                  {(meeting.startTime || meeting.endTime) && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]" />
                      {meeting.startTime}{meeting.endTime ? ` – ${meeting.endTime}` : ''}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    {PLATFORMS[meeting.platform]?.icon ? (() => {
                      const Icon = PLATFORMS[meeting.platform].icon;
                      return <Icon className="w-3.5 h-3.5 text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]" />;
                    })() : <CircleDot className="w-3.5 h-3.5 text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]" />}
                    {PLATFORMS[meeting.platform]?.label || meeting.platform}
                  </span>
                  {meeting.meetingLink && (
                    <a
                      href={meeting.meetingLink}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-indigo-600 dark:text-indigo-300 hover:underline"
                    >
                      <LinkIcon className="w-3.5 h-3.5" /> Entrar na reunião
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit?.(meeting)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg text-indigo-700 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-500/15 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 transition-colors"
                title="Editar reunião"
              >
                <Edit className="w-4 h-4" />
                Editar
              </button>
              {canDelete && (
                <button
                  onClick={() => onDelete?.(meeting)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-500/15 hover:bg-red-100 dark:hover:bg-red-500/25 transition-colors"
                  title="Excluir reunião"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir
                </button>
              )}
              <button onClick={onClose} className="text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[rgb(var(--crm-muted-rgb)_/_1)] dark:hover:text-[rgb(var(--crm-muted-rgb)_/_1)] transition-colors p-2 rounded-lg hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_0.1)]">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Ações de status */}
          <div className="flex flex-wrap gap-2 mt-4">
            {meeting.status !== 'REALIZADA' && (
              <button
                onClick={() => changeStatus('REALIZADA')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Marcar como Realizada
              </button>
            )}
            {meeting.status !== 'CANCELADA' && meeting.status !== 'REALIZADA' && (
              <button
                onClick={() => changeStatus('CANCELADA')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300 text-xs font-medium rounded-lg hover:bg-red-200 dark:hover:bg-red-500/25 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
            )}
            {meeting.status !== 'REALIZADA' && meeting.status !== 'CANCELADA' && (
              <button
                onClick={() => changeStatus('REAGENDADA')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 text-xs font-medium rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-500/25 transition-colors"
              >
                <Clock className="w-3.5 h-3.5" /> Reagendar
              </button>
            )}
            {meeting.status !== 'AGENDADA' && meeting.status !== 'REALIZADA' && (
              <button
                onClick={() => changeStatus('AGENDADA')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-lg hover:bg-blue-200 dark:hover:bg-blue-500/25 transition-colors"
              >
                <Calendar className="w-3.5 h-3.5" /> Reabrir
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-[var(--crm-border)] dark:border-[color:var(--crm-border)] flex-shrink-0 px-6">
          <nav className="-mb-px flex space-x-2 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-300'
                      : "border-transparent text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] dark:hover:text-[rgb(var(--crm-ink-rgb)_/_1)] hover:border-[var(--crm-border)] dark:hover:border-[var(--crm-border)]"
                  } whitespace-nowrap py-3 px-3 border-b-2 font-medium text-sm flex items-center gap-2 transition-all`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.id === 'checklist' && totalChecklist > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                      {completedChecklist}/{totalChecklist}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Conteúdo */}
        <div className="overflow-y-auto flex-1 p-6">
          {/* Visão Geral */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-xl p-4">
                  <p className="text-xs text-indigo-400 dark:text-indigo-300 font-medium mb-1">Oportunidade</p>
                  <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-300">{meeting.opportunity?.title}</p>
                  <p className="text-xs text-indigo-600 dark:text-indigo-300 mt-1">
                    {meeting.opportunity?.number} • Valor R$ {Number(meeting.opportunity?.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-500/10 rounded-xl p-4">
                  <p className="text-xs text-green-700 dark:text-green-400 dark:text-emerald-300 font-medium mb-1">Cliente</p>
                  <p className="text-sm font-semibold text-green-900 dark:text-green-300 dark:text-emerald-300">{meeting.company?.name}</p>
                  <p className="text-xs text-green-600 dark:text-emerald-300 mt-1">CNPJ: {meeting.company?.document || '—'}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-500/10 rounded-xl p-4">
                  <p className="text-xs text-purple-400 dark:text-purple-300 font-medium mb-1">Responsável</p>
                  <p className="text-sm font-semibold text-purple-900 dark:text-purple-300">{meeting.owner?.name}</p>
                  <p className="text-xs text-purple-600 dark:text-purple-300 mt-1">{meeting.owner?.email}</p>
                </div>
              </div>

              {meeting.description && (
                <div>
                  <h4 className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mb-2">Objetivo</h4>
                  <p className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[var(--crm-surface-2)] rounded-xl p-4">{meeting.description}</p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mb-3">Resumo</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="border border-[var(--crm-border)] dark:border-[color:var(--crm-border)] rounded-xl p-3 text-center">
                    <Users className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">{meeting.participants?.length || 0}</p>
                    <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">Participantes</p>
                  </div>
                  <div className="border border-[var(--crm-border)] dark:border-[color:var(--crm-border)] rounded-xl p-3 text-center">
                    <ClipboardList className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">{meeting.agendaItems?.length || 0}</p>
                    <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">Itens de pauta</p>
                  </div>
                  <div className="border border-[var(--crm-border)] dark:border-[color:var(--crm-border)] rounded-xl p-3 text-center">
                    <ListChecks className="w-5 h-5 text-green-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">{completedChecklist}/{totalChecklist}</p>
                    <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">Checklist</p>
                  </div>
                  <div className="border border-[var(--crm-border)] dark:border-[color:var(--crm-border)] rounded-xl p-3 text-center">
                    <MessageSquare className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                      {asList(meeting.actionItems).filter((a) => a.status !== 'CONCLUIDO' && a.status !== 'CANCELADO').length || 0}
                    </p>
                    <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">Ações abertas</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pauta */}
          {activeTab === 'agenda' && (
            <div className="space-y-3">
              {asList(meeting.agendaItems).map((item, index) => (
                <div key={item.id} className="bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[var(--crm-surface-2)] rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 bg-indigo-100 dark:bg-indigo-500/15 rounded-lg flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300 flex-shrink-0">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">{item.title}</p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="flex items-center gap-1 text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">
                            <Clock className="w-3.5 h-3.5" /> {item.durationMinutes} min
                          </span>
                          <button onClick={() => deleteAgendaItem(item)} className="text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-red-600 dark:hover:text-red-700 dark:hover:text-red-300 transition-colors" title="Remover item">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {item.description && <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] mt-0.5">{item.description}</p>}

                      {editingTratativaId === item.id ? (
                        <div className="mt-3 space-y-2">
                          <textarea
                            value={tratativaDraft}
                            onChange={(e) => setTratativaDraft(e.target.value)}
                            rows={3}
                            className={inputClass}
                            placeholder="Registre a tratativa / discussão deste item..."
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingTratativaId(null)} className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] dark:hover:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                              Cancelar
                            </button>
                            <button onClick={() => saveTratativa(item)} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                              Salvar tratativa
                            </button>
                          </div>
                        </div>
                      ) : item.tratativa ? (
                        <div className="mt-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg p-3">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Tratativa</p>
                            <button onClick={() => startTratativa(item)} className="text-xs text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-300">
                              Editar
                            </button>
                          </div>
                          <p className="text-xs text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] whitespace-pre-wrap">{item.tratativa}</p>
                        </div>
                      ) : (
                        <button onClick={() => startTratativa(item)} className="mt-2 text-xs text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors">
                          <MessageSquare className="w-3.5 h-3.5" /> Adicionar tratativa
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {asList(meeting.agendaItems).length === 0 && (
                <p className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] text-center py-6">Nenhum item de pauta definido</p>
              )}

              {showAgendaForm ? (
                <form onSubmit={addAgendaItem} className="bg-indigo-50 dark:bg-indigo-500/10 rounded-xl p-4 space-y-3">
                  <input
                    type="text"
                    value={newAgenda.title}
                    onChange={(e) => setNewAgenda((prev) => ({ ...prev, title: e.target.value }))}
                    className={inputClass}
                    placeholder="Título do item de pauta *"
                    required
                  />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="number"
                      value={newAgenda.durationMinutes}
                      onChange={(e) => setNewAgenda((prev) => ({ ...prev, durationMinutes: e.target.value }))}
                      className={inputClass}
                      placeholder="Duração (min)"
                      min="1"
                    />
                  </div>
                  <textarea
                    value={newAgenda.description}
                    onChange={(e) => setNewAgenda((prev) => ({ ...prev, description: e.target.value }))}
                    className={inputClass}
                    rows={2}
                    placeholder="Descrição (opcional)"
                  />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowAgendaForm(false)} className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] dark:hover:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                      Cancelar
                    </button>
                    <button type="submit" className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                      Adicionar à pauta
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowAgendaForm(true)}
                  className="mt-1 w-full py-2.5 border-2 border-dashed border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 text-sm font-medium rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950 dark:hover:bg-indigo-500/15 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Adicionar item de pauta
                </button>
              )}
            </div>
          )}

          {/* Checklist */}
          {activeTab === 'checklist' && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] rounded-full h-2.5">
                  <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${checklistProgress}%` }}></div>
                </div>
                <span className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">{checklistProgress}%</span>
              </div>
              <div className="space-y-2">
                {asList(meeting.checklistItems).map((item) => (
                  <div key={item.id} className="flex items-center gap-3 bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[var(--crm-surface-2)] rounded-xl p-3 cursor-pointer hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_0.1)] transition-colors" onClick={() => toggleChecklist(item)}>
                    <button className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                      item.isCompleted ? 'bg-green-600 border-green-600' : "border-[var(--crm-border)] dark:border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[var(--crm-surface)]"
                    }`}>
                      {item.isCompleted && <CheckCircle2 className="w-4 h-4 text-[rgb(var(--crm-ink-rgb)_/_1)]" />}
                    </button>
                    <span className={`text-sm flex-1 ${item.isCompleted ? "text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] line-through" : "text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]"}`}>
                      {item.title}
                    </span>
                    {item.completedBy && (
                      <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] flex-shrink-0">por {item.completedBy.name}</span>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); deleteChecklist(item); }} className="text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-red-600 dark:hover:text-red-700 dark:hover:text-red-300 transition-colors flex-shrink-0" title="Remover item">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {asList(meeting.checklistItems).length === 0 && (
                  <p className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] text-center py-6">Nenhum item de checklist</p>
                )}
              </div>
              <form onSubmit={addChecklist} className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={newChecklistTitle}
                  onChange={(e) => setNewChecklistTitle(e.target.value)}
                  className={`${inputClass} flex-1`}
                  placeholder="Novo item de verificação..."
                />
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1 flex-shrink-0">
                  <Plus className="w-4 h-4" /> Adicionar
                </button>
              </form>
            </div>
          )}

          {/* Participantes */}
          {activeTab === 'participants' && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.isArray(meeting.participants) && meeting.participants.map((participant) => {
                  const isInternal = participant.userId;
                  const name = isInternal ? participant.user?.name : participant.contact?.name;
                  const detail = isInternal ? participant.user?.email : `${participant.contact?.position || 'Contato'} • ${participant.contact?.email || participant.contact?.phone || ''}`;
                  return (
                    <div key={participant.id} className="bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[var(--crm-surface-2)] rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                            isInternal ? 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300' : "bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300 dark:text-emerald-300"
                          }`}>
                            {name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">{name}</p>
                            <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">{detail}</p>
                            <span className={`inline-flex mt-1 px-2 py-0.5 text-[10px] font-semibold rounded-full ${PARTICIPANT_STATUS[participant.status]?.color}`}>
                              {PARTICIPANT_STATUS[participant.status]?.label}
                            </span>
                          </div>
                        </div>
                        <button onClick={() => removeParticipant(participant)} className="text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-red-600 dark:hover:text-red-700 dark:hover:text-red-300 transition-colors" title="Remover">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {['CONVIDADO', 'CONFIRMADO', 'RECUSADO', 'PRESENTE'].map((status) => (
                          <button
                            key={status}
                            onClick={() => updateParticipantStatus(participant, status)}
                            className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                              participant.status === status ? PARTICIPANT_STATUS[status].color : "bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[var(--crm-surface)] text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] border border-[var(--crm-border)] dark:border-[color:var(--crm-border)] hover:border-[var(--crm-border)] dark:hover:border-[var(--crm-border)]"
                            }`}
                          >
                            {PARTICIPANT_STATUS[status].label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {showParticipantForm ? (
                <form onSubmit={addParticipant} className="mt-4 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select
                      value={newParticipant.userId}
                      onChange={(e) => setNewParticipant((prev) => ({ ...prev, userId: e.target.value, contactId: '', role: 'INTERNO' }))}
                      className={inputClass}
                    >
                      <option value="">Usuário interno...</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                    </select>
                    <select
                      value={newParticipant.contactId}
                      onChange={(e) => setNewParticipant((prev) => ({ ...prev, contactId: e.target.value, userId: '', role: 'EXTERNO' }))}
                      className={inputClass}
                    >
                      <option value="">Contato do cliente...</option>
                      {(() => {
                        const existingContactIds = new Set(
                          (Array.isArray(meeting.participants) ? meeting.participants : []).map((p) => p.contactId).filter(Boolean)
                        );
                        return contacts
                          .filter((c) => !existingContactIds.has(c.id))
                          .map((c) => <option key={c.id} value={c.id}>{c.name} — {c.position}</option>);
                      })()}
                    </select>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors">
                      Adicionar
                    </button>
                  </div>
                  <button type="button" onClick={() => setShowParticipantForm(false)} className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] dark:hover:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                    Cancelar
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setShowParticipantForm(true)}
                  className="mt-4 w-full py-2.5 border-2 border-dashed border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 text-sm font-medium rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950 dark:hover:bg-indigo-500/15 transition-colors flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" /> Adicionar participante
                </button>
              )}
            </div>
          )}

          {/* Ata & Ações */}
          {activeTab === 'minutes' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Object.entries(MINUTES_TEMPLATES).map(([key, template]) => (
                  <div
                    key={key}
                    className={`rounded-2xl border p-4 ${
                      template.accent === 'green'
                        ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 dark:border-emerald-500/25 dark:bg-emerald-500/10"
                        : 'border-indigo-200 bg-indigo-50 dark:border-indigo-500/25 dark:bg-indigo-500/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className={`inline-flex px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-full ${
                          template.accent === 'green'
                            ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 dark:bg-emerald-500/15 dark:text-emerald-300"
                            : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                        }`}>
                          {template.badge}
                        </span>
                        <h4 className="mt-3 text-base font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">{template.title}</h4>
                        <p className="mt-1 text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">{template.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openMinutesEditorFromTemplate(key)}
                        className={`flex-shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] transition-colors ${
                          template.accent === 'green' ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        Usar modelo
                      </button>
                    </div>

                    <div className="mt-4">
                      <p className="mb-2 text-xs font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">Ações sugeridas</p>
                      <div className="space-y-2">
                        {template.actions.map((action) => (
                          <button
                            key={action.title}
                            type="button"
                            onClick={() => applyActionTemplate(action)}
                            className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.7)] p-3 text-left transition-colors hover:border-indigo-300 hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:border-[rgb(var(--crm-ink-rgb)_/_0.1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.05)] dark:hover:border-indigo-400/40 dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_0.1)]"
                          >
                            <span className="block text-xs font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">{action.title}</span>
                            <span className="mt-0.5 block text-[11px] leading-relaxed text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">{action.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <h4 className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-500" /> Atas salvas
                  </h4>
                  <button
                    type="button"
                    onClick={() => setMinutesEditor({ id: null, templateKey: 'CUSTOM', title: 'Ata da Reunião', content: '' })}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
                  >
                    <Plus className="w-4 h-4" /> Nova ATA em branco
                  </button>
                </div>

                {minutesDocuments.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {minutesDocuments.map((document) => (
                      <div key={document.id} className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] p-4 dark:border-[color:var(--crm-border)] dark:bg-[var(--crm-surface-2)]">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">{document.title}</p>
                              {document.templateKey && document.templateKey !== 'CUSTOM' && (
                                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                                  {MINUTES_TEMPLATES[document.templateKey]?.badge || document.templateKey}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">
                              Atualizada em {document.updatedAt ? new Date(document.updatedAt).toLocaleString('pt-BR') : 'data não informada'}
                            </p>
                            <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                              {document.content}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 md:flex-shrink-0 md:justify-end">
                            <button
                              type="button"
                              onClick={() => previewMinutesPdf(document)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] px-3 py-1.5 text-xs font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] transition-colors hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:border-[color:var(--crm-border)] dark:bg-[var(--crm-surface)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_0.1)]"
                            >
                              <Eye className="w-3.5 h-3.5" /> Visualizar PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => sendMinutesEmail(document)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-300 transition-colors hover:bg-green-100 dark:hover:bg-green-950 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                            >
                              <Mail className="w-3.5 h-3.5" /> Enviar por e-mail
                            </button>
                            <button
                              type="button"
                              onClick={() => editMinutesDocument(document)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-500/25 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                            >
                              <Edit className="w-3.5 h-3.5" /> Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteMinutesDocument(document)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Excluir
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] px-4 py-8 text-center dark:border-[color:var(--crm-border)] dark:bg-[var(--crm-surface-2)]">
                    <FileText className="mx-auto mb-2 h-7 w-7 text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]" />
                    <p className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">Nenhuma ATA salva</p>
                    <p className="mt-1 text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">
                      Selecione um modelo acima para abrir a ATA em tela maior, digitar e salvar.
                    </p>
                  </div>
                )}
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => minutesDocuments[0] ? previewMinutesPdf(minutesDocuments[0]) : openMinutesEditorFromTemplate(getMinutesTemplateKeyForMeeting(meeting))}
                    className="inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--crm-surface-2-rgb)_/_1)] px-4 py-2 text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] transition-colors hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_1)]"
                  >
                    {minutesDocuments[0] ? <Eye className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    {minutesDocuments[0] ? 'Visualizar última ATA em PDF' : 'Criar ATA com modelo sugerido'}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-indigo-500" /> Tarefas / Ações Pós-Reunião
                  </h4>
                  <button
                    onClick={() => setShowActionForm((prev) => !prev)}
                    className="text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm font-medium"
                  >
                    + Nova ação
                  </button>
                </div>

                {showActionForm && (
                  <form onSubmit={addActionItem} className="bg-indigo-50 dark:bg-indigo-500/10 rounded-xl p-4 space-y-3 mb-4">
                    <input
                      type="text"
                      value={actionForm.title}
                      onChange={(e) => setActionForm((prev) => ({ ...prev, title: e.target.value }))}
                      className={inputClass}
                      placeholder="Título da ação *"
                      required
                    />
                    <textarea
                      value={actionForm.description}
                      onChange={(e) => setActionForm((prev) => ({ ...prev, description: e.target.value }))}
                      className={inputClass}
                      rows={2}
                      placeholder="Descrição"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <select
                        value={actionForm.priority}
                        onChange={(e) => setActionForm((prev) => ({ ...prev, priority: e.target.value }))}
                        className={inputClass}
                      >
                        <option value="LOW">Prioridade Baixa</option>
                        <option value="MEDIUM">Prioridade Média</option>
                        <option value="HIGH">Prioridade Alta</option>
                        <option value="URGENT">Urgente</option>
                      </select>
                      <input
                        type="date"
                        value={actionForm.dueDate}
                        onChange={(e) => setActionForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                        className={inputClass}
                      />
                      <select
                        value={actionForm.assigneeId}
                        onChange={(e) => setActionForm((prev) => ({ ...prev, assigneeId: e.target.value }))}
                        className={inputClass}
                      >
                        <option value="">Responsável...</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>{user.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowActionForm(false)}
                        className="px-3 py-1.5 text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] dark:hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
                      >
                        Cancelar
                      </button>
                      <button type="submit" className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors">
                        Criar Ação (+ Tarefa)
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-2">
                  {asList(meeting.actionItems).map((item) => (
                    <div key={item.id} className="bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[var(--crm-surface-2)] rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${ACTION_STATUS[item.status]?.color}`}>
                              {ACTION_STATUS[item.status]?.label}
                            </span>
                            <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                              item.priority === 'URGENT' ? 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300' :
                              item.priority === 'HIGH' ? 'bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300' :
                              item.priority === 'LOW' ? "bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300 dark:text-emerald-300" : 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-300'
                            }`}>
                              {item.priority}
                            </span>
                            {item.taskId && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300">
                                <CheckCircle2 className="w-3 h-3" /> Tarefa vinculada
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mt-1.5">{item.title}</p>
                          {item.description && <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] mt-0.5">{item.description}</p>}
                          <div className="flex items-center gap-3 mt-2 text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)]">
                            {item.dueDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" /> {new Date(item.dueDate).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                            {item.assignee && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" /> {item.assignee.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          {item.status !== 'CONCLUIDO' && (
                            <button
                              onClick={() => updateActionItem(item, { status: 'CONCLUIDO' })}
                              className="text-[10px] px-2 py-1 bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300 dark:text-emerald-300 rounded-md hover:bg-green-200 dark:hover:bg-green-500/25 transition-colors"
                            >
                              Concluir
                            </button>
                          )}
                          {item.status === 'PENDENTE' && (
                            <button
                              onClick={() => updateActionItem(item, { status: 'EM_ANDAMENTO' })}
                              className="text-[10px] px-2 py-1 bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-500/25 transition-colors"
                            >
                              Iniciar
                            </button>
                          )}
                          <button
                            onClick={() => deleteActionItem(item)}
                            className="text-[10px] px-2 py-1 bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-500/25 transition-colors"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {asList(meeting.actionItems).length === 0 && (
                    <p className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] text-center py-6">Nenhuma ação pós-reunião definida</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Histórico */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {asList(meeting.history).map((event) => (
                <div key={event.id} className="flex gap-3">
                  <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-500/15 rounded-full flex items-center justify-center flex-shrink-0">
                    <History className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                  </div>
                  <div className="flex-1 bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[var(--crm-surface-2)] rounded-xl p-3">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">{event.title}</p>
                      <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] flex-shrink-0">
                        {new Date(event.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    {event.description && <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] mt-1">{event.description}</p>}
                    {event.user && <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] mt-1">por {event.user.name}</p>}
                  </div>
                </div>
              ))}
              {asList(meeting.history).length === 0 && (
                <p className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] text-center py-6">Nenhum evento no histórico</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--crm-border)] dark:border-[color:var(--crm-border)] flex-shrink-0 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] rounded-lg hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] transition-colors">
            Fechar
          </button>
        </div>
      </div>

      {minutesEditor && (
        <div className={
          fullscreen
            ? 'fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm lg:p-6'
            : 'fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm lg:p-6'
        }>
          <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-[rgb(var(--crm-surface-rgb)_/_1)] shadow-2xl dark:bg-[var(--crm-surface)]">
            <div className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-[var(--crm-border)] p-5 dark:border-[color:var(--crm-border)]">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">Editor de ATA</p>
                <h3 className="mt-1 text-xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                  {minutesEditor.id ? 'Editar ATA' : 'Nova ATA'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMinutesEditor(null)}
                className="rounded-lg p-2 text-[rgb(var(--crm-muted-rgb)_/_1)] transition-colors hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_0.1)] dark:hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
                title="Fechar editor"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 overflow-y-auto p-5 xl:grid-cols-[360px_minmax(0,1fr)]">
              <div className="min-w-0 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">Título da ATA</label>
                  <input
                    type="text"
                    value={minutesEditor.title}
                    onChange={(e) => setMinutesEditor((prev) => ({ ...prev, title: e.target.value }))}
                    className={inputClass}
                    placeholder="Ex.: Ata de Kickoff Externo"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">Modelo</label>
                  <select
                    value={minutesEditor.templateKey || 'CUSTOM'}
                    onChange={(e) => {
                      const templateKey = e.target.value;
                      const template = MINUTES_TEMPLATES[templateKey];
                      setMinutesEditor((prev) => ({
                        ...prev,
                        templateKey,
                        title: template && (!prev.title || prev.title === 'Ata da Reunião') ? template.title : prev.title,
                        content: template && !prev.content?.trim() ? template.buildNotes(safeMeetingForNotes(meeting)) : prev.content
                      }));
                    }}
                    className={inputClass}
                  >
                    <option value="CUSTOM">Sem modelo</option>
                    {Object.entries(MINUTES_TEMPLATES).map(([key, template]) => (
                      <option key={key} value={key}>
                        {template.title}{key === getMinutesTemplateKeyForMeeting(meeting) ? ' (sugerido para esta reunião)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] p-4 text-xs leading-relaxed text-[rgb(var(--crm-muted-rgb)_/_1)] dark:border-[color:var(--crm-border)] dark:bg-[var(--crm-surface-2)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                  <p className="font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">Reunião</p>
                  <p className="mt-2">{meeting.opportunity?.title || 'Projeto sem título'}</p>
                  <p>{meeting.company?.name || 'Cliente não informado'}</p>
                  <p>{formatMeetingDate(meeting.scheduledDate)} {meeting.startTime || ''}</p>
                </div>
              </div>

              <div className="flex min-h-[480px] min-w-0 flex-col">
                <label className="mb-1 block text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">Conteúdo da ATA</label>
                <textarea
                  value={minutesEditor.content}
                  onChange={(e) => setMinutesEditor((prev) => ({ ...prev, content: e.target.value }))}
                  className={`${inputClass} flex-1 resize-none font-mono text-sm leading-relaxed`}
                  placeholder="Digite aqui a ata da reunião..."
                />
              </div>
            </div>

            <div className="flex flex-shrink-0 flex-wrap justify-end gap-3 border-t border-[var(--crm-border)] p-5 dark:border-[color:var(--crm-border)]">
              <button
                type="button"
                onClick={() => setMinutesEditor(null)}
                className="rounded-lg bg-[rgb(var(--crm-surface-rgb)_/_1)] px-4 py-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] transition-colors hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_1)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => saveMinutesDocument()}
                disabled={savingMinutes}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingMinutes && <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--crm-border)] border-t-transparent"></div>}
                <FileText className="h-4 w-4" /> Salvar ATA
              </button>
              <button
                type="button"
                onClick={() => saveMinutesDocument({ previewAfterSave: true })}
                disabled={savingMinutes}
                className="inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--crm-surface-2-rgb)_/_1)] px-5 py-2 text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] transition-colors hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] disabled:opacity-50 dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_1)]"
              >
                {savingMinutes && <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--crm-border)] border-t-transparent"></div>}
                <Eye className="h-4 w-4" /> Salvar e visualizar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

// Helper para obter contatos do cliente no modal de participantes (via preview quando necessário)
const previewContactsOf = (meeting) => {
  // Contatos já disponíveis através dos participantes externos + placeholder
  return [];
};

export default Kickoff;
