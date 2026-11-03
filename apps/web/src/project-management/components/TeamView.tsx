import React, { useEffect, useMemo, useState } from 'react';
import { mockUsers } from '../data';
import {
  Mail, MoreHorizontal, Search, UserPlus, Shield, Activity, Users,
  Send, X, CheckCircle2, Settings, Copy, AtSign, Building2, Trash2, Loader2
} from 'lucide-react';
import { buildApiUrl, getAuthHeaders } from '../../config/api';

type EmailProvider = 'Gmail' | 'Google Workspace' | 'Outlook' | 'Microsoft 365' | 'Zoho Mail' | 'SMTP proprio';
type TeamRole = 'Admin' | 'Gerente' | 'Membro' | 'Convidado';
type ProjectRole = 'PROJECT_MANAGER' | 'TECH_LEAD' | 'DEVELOPER' | 'ANALYST' | 'QA' | 'ARCHITECT' | 'CONSULTANT';

type UserOption = {
  id: string;
  name: string;
  email?: string;
  role?: string;
};

type TeamMember = {
  id: string;
  userId: string;
  role?: ProjectRole | string;
  allocationPercent?: number;
  hourlyCost?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    id?: string;
    name?: string;
    email?: string;
  };
};

type DisplayUser = {
  id: string;
  memberId?: string;
  userId?: string;
  name: string;
  email?: string;
  initials: string;
  color: string;
  role?: string;
  isActive?: boolean;
  lastAccess?: string;
};

interface TeamInvite {
  id: string;
  emails: string[];
  provider: EmailProvider;
  role: TeamRole;
  message: string;
  status: 'Pendente' | 'Enviado';
  createdAt: string;
}

type TeamViewProps = {
  projectId?: string;
  projectName?: string;
  users?: UserOption[];
  onTeamChanged?: () => void;
};

const providerOptions: Array<{
  name: EmailProvider;
  description: string;
  accent: string;
}> = [
  { name: 'Gmail', description: 'Conta Google individual', accent: '#ff7a00' },
  { name: 'Google Workspace', description: 'Domínio corporativo Google', accent: '#22c55e' },
  { name: 'Outlook', description: 'Conta Microsoft pessoal', accent: '#18c8df' },
  { name: 'Microsoft 365', description: 'Tenant corporativo Microsoft', accent: '#3b82f6' },
  { name: 'Zoho Mail', description: 'Conta Zoho corporativa', accent: '#f6b40b' },
  { name: 'SMTP proprio', description: 'Servidor de e-mail configurável', accent: '#a855f7' }
];

const defaultInviteMessage = 'Voce foi convidado para participar da equipe do projeto no Nexos.';
const roleToProjectRole: Record<TeamRole, ProjectRole> = {
  Admin: 'PROJECT_MANAGER',
  Gerente: 'PROJECT_MANAGER',
  Membro: 'DEVELOPER',
  Convidado: 'CONSULTANT'
};
const projectRoleLabels: Record<ProjectRole, string> = {
  PROJECT_MANAGER: 'Gestor',
  TECH_LEAD: 'Tech Lead',
  DEVELOPER: 'Membro',
  ANALYST: 'Analista',
  QA: 'QA',
  ARCHITECT: 'Arquiteto',
  CONSULTANT: 'Convidado'
};

function parseEmails(value: string) {
  return value
    .split(/[\s,;]+/)
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function getInitials(name?: string, email?: string) {
  const source = String(name || email || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function normalizeUserRole(role?: string) {
  const raw = String(role || '').trim().toUpperCase();
  return projectRoleLabels[raw as ProjectRole] || role || 'Membro';
}

export default function TeamView({ projectId, projectName, users = [], onTeamChanged }: TeamViewProps) {
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmails, setInviteEmails] = useState('');
  const [provider, setProvider] = useState<EmailProvider>('Google Workspace');
  const [role, setRole] = useState<TeamRole>('Membro');
  const [message, setMessage] = useState(defaultInviteMessage);
  const [inviteError, setInviteError] = useState('');
  const [teamError, setTeamError] = useState('');
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState('');
  const [copied, setCopied] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>(() => {
    const saved = localStorage.getItem('pm_team_invites_v1');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('pm_team_invites_v1', JSON.stringify(invites));
  }, [invites]);

  const loadTeam = async () => {
    if (!projectId) {
      setTeamMembers([]);
      setTeamError('');
      return;
    }

    setIsLoadingTeam(true);
    setTeamError('');
    try {
      const response = await fetch(buildApiUrl(`/projetos/${projectId}/team`), {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status} ao carregar equipe`);
      }

      const payload = await response.json();
      setTeamMembers(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error('Erro ao carregar equipe do projeto:', error);
      setTeamError(error instanceof Error ? error.message : 'Erro ao carregar equipe');
    } finally {
      setIsLoadingTeam(false);
    }
  };

  useEffect(() => {
    loadTeam();
  }, [projectId]);

  useEffect(() => {
    const acceptInvite = async () => {
      if (!projectId) return;

      const params = new URLSearchParams(window.location.search);
      const inviteProjectId = params.get('projectId');
      const inviteRole = params.get('role') as TeamRole | null;
      const hasInvite = params.has('invite');

      if (!hasInvite || inviteProjectId !== projectId) return;

      const acceptedKey = `pm_invite_accepted_${projectId}`;
      if (sessionStorage.getItem(acceptedKey) === 'true') return;

      try {
        const meResponse = await fetch(buildApiUrl('/auth/me'), {
          headers: getAuthHeaders()
        });

        if (!meResponse.ok) return;

        const mePayload = await meResponse.json();
        const currentUser = mePayload.user || mePayload;
        if (!currentUser?.id) return;

        const selectedRole = inviteRole && roleToProjectRole[inviteRole] ? roleToProjectRole[inviteRole] : 'DEVELOPER';
        const response = await fetch(buildApiUrl(`/projetos/${projectId}/team`), {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            userId: currentUser.id,
            role: selectedRole,
            allocationPercent: 100,
            hourlyCost: 0
          })
        });

        if (!response.ok && response.status !== 409) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || `Erro ${response.status} ao aceitar convite`);
        }

        sessionStorage.setItem(acceptedKey, 'true');
        await loadTeam();
        onTeamChanged?.();
        params.delete('invite');
        params.delete('role');
        const nextSearch = params.toString();
        window.history.replaceState({}, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`);
      } catch (error) {
        console.error('Erro ao aceitar convite de equipe:', error);
        setTeamError(error instanceof Error ? error.message : 'Nao foi possivel aceitar o convite.');
      }
    };

    acceptInvite();
  }, [projectId, onTeamChanged]);

  const displayedUsers = useMemo(() => {
    if (!projectId) return mockUsers as DisplayUser[];
    return teamMembers.map((member, index) => {
      const name = member.user?.name || 'Usuario sem nome';
      const email = member.user?.email || '';
      const colors = ['bg-[#ff7a00]', 'bg-[#18c8df]', 'bg-[#22c55e]', 'bg-[#f6b40b]', 'bg-[#3b82f6]', "bg-[rgb(var(--crm-surface-rgb)_/_1)]"];
      return {
        id: member.id,
        memberId: member.id,
        userId: member.userId,
        name,
        email,
        initials: getInitials(name, email),
        color: colors[index % colors.length],
        role: normalizeUserRole(member.role),
        isActive: member.isActive !== false,
        lastAccess: member.createdAt ? `Adicionado em ${formatDate(member.createdAt)}` : 'Sem registro'
      };
    });
  }, [projectId, teamMembers]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return displayedUsers;
    return displayedUsers.filter(user =>
      user.name.toLowerCase().includes(term) ||
      user.email?.toLowerCase().includes(term) ||
      user.role?.toLowerCase().includes(term)
    );
  }, [displayedUsers, search]);

  const selectedProvider = providerOptions.find(item => item.name === provider) || providerOptions[0];
  const pendingInvites = invites.filter(invite => invite.status === 'Pendente').length;
  const parsedEmails = parseEmails(inviteEmails);
  const inviteParams = new URLSearchParams({
    invite: provider,
    role
  });
  if (projectId) inviteParams.set('projectId', projectId);
  const inviteLink = `${window.location.origin}/projetos?${inviteParams.toString()}`;

  const resetInvite = () => {
    setInviteEmails('');
    setProvider('Google Workspace');
    setRole('Membro');
    setMessage(defaultInviteMessage);
    setInviteError('');
    setCopied(false);
  };

  const closeInvite = () => {
    setInviteOpen(false);
    resetInvite();
  };

  const sendInvite = async () => {
    const invalidEmails = parsedEmails.filter(email => !isValidEmail(email));

    if (parsedEmails.length === 0) {
      setInviteError('Informe ao menos um e-mail para enviar o convite.');
      return;
    }

    if (invalidEmails.length > 0) {
      setInviteError(`Revise estes e-mails: ${invalidEmails.join(', ')}`);
      return;
    }

    const nextInvite: TeamInvite = {
      id: `invite-${Date.now()}`,
      emails: parsedEmails,
      provider,
      role,
      message,
      status: 'Pendente',
      createdAt: new Date().toISOString()
    };

    try {
      setInviteError('');

      if (projectId) {
        const currentUserIds = new Set(teamMembers.map(member => member.userId));
        const matchingUsers = parsedEmails
          .map(email => users.find(user => String(user.email || '').trim().toLowerCase() === email))
          .filter((user): user is UserOption => Boolean(user))
          .filter(user => !currentUserIds.has(user.id));

        await Promise.all(matchingUsers.map(user => fetch(buildApiUrl(`/projetos/${projectId}/team`), {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            userId: user.id,
            role: roleToProjectRole[role],
            allocationPercent: 100,
            hourlyCost: 0
          })
        }).then(async response => {
          if (!response.ok && response.status !== 409) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || `Erro ${response.status} ao adicionar ${user.email}`);
          }
        })));

        if (matchingUsers.length > 0) {
          nextInvite.status = 'Enviado';
          await loadTeam();
          onTeamChanged?.();
        }
      }

      setInvites(prev => [nextInvite, ...prev]);
      window.location.href = `mailto:${parsedEmails.join(',')}?subject=${encodeURIComponent('Convite para equipe do projeto')}&body=${encodeURIComponent(`${message}\n\nAcesse: ${inviteLink}`)}`;
      closeInvite();
    } catch (error) {
      console.error('Erro ao enviar convite:', error);
      setInviteError(error instanceof Error ? error.message : 'Nao foi possivel adicionar o membro ao projeto.');
    }
  };

  const removeMember = async (memberId: string, memberName: string) => {
    if (!projectId) return;
    if (!window.confirm(`Excluir ${memberName} da equipe deste projeto?`)) return;

    setRemovingMemberId(memberId);
    setTeamError('');
    try {
      const response = await fetch(buildApiUrl(`/projetos/${projectId}/team/${memberId}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Erro ${response.status} ao remover membro`);
      }

      setTeamMembers(prev => prev.filter(member => member.id !== memberId));
      onTeamChanged?.();
    } catch (error) {
      console.error('Erro ao remover membro:', error);
      setTeamError(error instanceof Error ? error.message : 'Nao foi possivel remover o membro.');
    } finally {
      setRemovingMemberId('');
    }
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      setInviteError('Nao foi possivel copiar o link automaticamente.');
    }
  };

  return (
    <div className="h-full bg-[rgb(var(--crm-surface-2-rgb)_/_1)] overflow-y-auto p-8 text-[rgb(var(--crm-ink-rgb)_/_1)] custom-scrollbar">
      <div className="max-w-6xl mx-auto">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] flex items-center gap-3">
              <Users className="w-6 h-6 text-[#ff7a00]" />
              Equipe do Projeto
            </h1>
            {projectName && <p className="mt-1 text-sm text-[rgb(var(--crm-muted-rgb)_/_1)]">Projeto: {projectName}</p>}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[rgb(var(--crm-muted-rgb)_/_1)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Procurar membro..."
                className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] rounded-md pl-9 pr-4 py-1.5 focus:outline-none focus:border-[#ff7a00] w-64"
              />
            </div>
            <button
              onClick={() => setInviteOpen(true)}
              className="flex items-center gap-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] bg-[#ff7a00] hover:bg-[#f6b40b] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] px-4 py-1.5 rounded-md transition-colors font-medium"
            >
              <UserPlus className="w-4 h-4" /> Convidar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-[linear-gradient(140deg,rgba(255,122,0,0.15),rgb(var(--crm-surface-2-rgb)_/_0.98))] border border-[var(--crm-border)] rounded-md p-5">
            <div className="flex justify-between items-start mb-2">
              <div className="text-[rgb(var(--crm-muted-rgb)_/_1)] text-sm font-medium">Membros Totais</div>
              <Users className="w-4 h-4 text-[#ff7a00]" />
            </div>
            <div className="text-2xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)]">{displayedUsers.length}</div>
          </div>
          <div className="bg-[linear-gradient(140deg,rgba(34,197,94,0.14),rgb(var(--crm-surface-2-rgb)_/_0.98))] border border-[var(--crm-border)] rounded-md p-5">
            <div className="flex justify-between items-start mb-2">
              <div className="text-[rgb(var(--crm-muted-rgb)_/_1)] text-sm font-medium">Membros Ativos</div>
              <Activity className="w-4 h-4 text-[#22c55e]" />
            </div>
            <div className="text-2xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)]">{displayedUsers.filter(user => user.isActive !== false).length}</div>
          </div>
          <div className="bg-[linear-gradient(140deg,rgba(246,180,11,0.14),rgb(var(--crm-surface-2-rgb)_/_0.98))] border border-[var(--crm-border)] rounded-md p-5">
            <div className="flex justify-between items-start mb-2">
              <div className="text-[rgb(var(--crm-muted-rgb)_/_1)] text-sm font-medium">Convites Pendentes</div>
              <Mail className="w-4 h-4 text-[#f6b40b]" />
            </div>
            <div className="text-2xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)]">{pendingInvites}</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] rounded-md overflow-hidden shadow-sm">
            {teamError && (
              <div className="border-b border-[#ff7a00]/35 bg-[#ff7a00]/10 px-6 py-3 text-sm font-semibold text-[#ffb15c]">
                {teamError}
              </div>
            )}
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--crm-border)] text-[rgb(var(--crm-muted-rgb)_/_1)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)]">
                <tr>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Membro</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Função</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Status</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Último Acesso</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--crm-border)]">
                {isLoadingTeam && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-[rgb(var(--crm-muted-rgb)_/_1)]">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-[#ff7a00]" />
                      Carregando equipe...
                    </td>
                  </tr>
                )}
                {!isLoadingTeam && filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-[rgb(var(--crm-muted-rgb)_/_1)]">
                      Nenhum membro encontrado.
                    </td>
                  </tr>
                )}
                {!isLoadingTeam && filteredUsers.map((user, idx) => (
                  <tr key={user.id} className="hover:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-inner ${user.color}`}>
                          {user.initials}
                        </div>
                        <div>
                          <p className="font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{user.name}</p>
                          <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3" /> {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] text-[rgb(var(--crm-ink-rgb)_/_1)] px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 w-fit">
                        {user.role === 'Admin' && <Shield className="w-3 h-3 text-[#22c55e]" />}
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${user.isActive !== false ? 'bg-[#22c55e]' : "bg-[rgb(var(--crm-surface-rgb)_/_1)]"}`}></span>
                        <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-xs">{user.isActive !== false ? 'Ativo' : 'Inativo'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[rgb(var(--crm-muted-rgb)_/_1)] text-xs font-medium">
                      {user.lastAccess || (idx === 0 ? 'Agora mesmo' : idx === 1 ? 'Ha 5 min' : 'Ha 2 dias')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => projectId ? removeMember(user.memberId || user.id, user.name) : undefined}
                        disabled={!projectId || removingMemberId === (user.memberId || user.id)}
                        title={projectId ? 'Excluir membro' : 'Disponivel em um projeto selecionado'}
                        className="text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-red-700 dark:hover:text-red-300 p-1.5 rounded hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        {projectId ? <Trash2 className="w-4 h-4" /> : <MoreHorizontal className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-6">
            <div className="rounded-md border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold text-[rgb(var(--crm-ink-rgb)_/_1)]">Integrações de e-mail</h2>
                <Settings className="h-4 w-4 text-[rgb(var(--crm-muted-rgb)_/_1)]" />
              </div>
              <div className="space-y-3">
                {providerOptions.map(item => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      setProvider(item.name);
                      setInviteOpen(true);
                    }}
                    className="w-full rounded-md border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-3 text-left transition-colors hover:border-[#ff7a00] hover:bg-[rgb(var(--crm-surface-2-rgb)_/_1)]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.accent, boxShadow: `0 0 12px ${item.accent}88` }} />
                      <div>
                        <p className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{item.name}</p>
                        <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">{item.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold text-[rgb(var(--crm-ink-rgb)_/_1)]">Convites recentes</h2>
                <Mail className="h-4 w-4 text-[#f6b40b]" />
              </div>
              <div className="space-y-3">
                {invites.slice(0, 5).map(invite => (
                  <div key={invite.id} className="rounded-md border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-[#ff7a00]/10 px-2 py-1 text-[10px] font-bold text-[#ffb15c]">{invite.provider}</span>
                      <span className="text-[10px] text-[rgb(var(--crm-muted-rgb)_/_1)]">{formatDate(invite.createdAt)}</span>
                    </div>
                    <p className="truncate text-xs font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{invite.emails.join(', ')}</p>
                    <p className="mt-1 text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)]">{invite.role} · {invite.status}</p>
                  </div>
                ))}
                {invites.length === 0 && (
                  <div className="rounded-md border border-dashed border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-5 text-center text-sm text-[rgb(var(--crm-muted-rgb)_/_1)]">
                    Nenhum convite enviado.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] shadow-2xl">
            <div className="relative border-b border-[var(--crm-border)] bg-[radial-gradient(circle_at_15%_0%,rgba(255,122,0,0.24),transparent_30%),linear-gradient(120deg,rgb(var(--crm-surface-2-rgb)_/_1),rgb(var(--crm-surface-2-rgb)_/_1))] px-6 py-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#ff7a00] text-[rgb(var(--crm-ink-rgb)_/_1)]">
                      <Send className="h-5 w-5" />
                    </span>
                    <span className="rounded-full border border-[#22c55e]/40 bg-[#22c55e]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#22c55e]">
                      Convite de equipe
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-[rgb(var(--crm-ink-rgb)_/_1)]">Enviar convite</h2>
                  <p className="mt-1 text-sm text-[rgb(var(--crm-muted-rgb)_/_1)]">Selecione o provedor, defina permissões e envie para um ou vários e-mails.</p>
                </div>
                <button onClick={closeInvite} className="rounded-md border border-[var(--crm-border)] p-2 text-[rgb(var(--crm-muted-rgb)_/_1)] hover:border-[#ff7a00] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="grid gap-5 p-6">
              {inviteError && (
                <div className="rounded-md border border-[#ff7a00]/40 bg-[#ff7a00]/10 px-4 py-3 text-sm font-semibold text-[#ffb15c]">
                  {inviteError}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[rgb(var(--crm-muted-rgb)_/_1)]"><AtSign className="h-4 w-4" /> Provedor</span>
                  <select value={provider} onChange={(e) => setProvider(e.target.value as EmailProvider)} className="w-full rounded-md border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] px-3 py-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] outline-none focus:border-[#ff7a00]">
                    {providerOptions.map(item => <option key={item.name}>{item.name}</option>)}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[rgb(var(--crm-muted-rgb)_/_1)]"><Shield className="h-4 w-4" /> Permissão</span>
                  <select value={role} onChange={(e) => setRole(e.target.value as TeamRole)} className="w-full rounded-md border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] px-3 py-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] outline-none focus:border-[#ff7a00]">
                    <option>Admin</option>
                    <option>Gerente</option>
                    <option>Membro</option>
                    <option>Convidado</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[rgb(var(--crm-muted-rgb)_/_1)]"><Mail className="h-4 w-4" /> E-mails</span>
                <textarea
                  value={inviteEmails}
                  onChange={(e) => {
                    setInviteEmails(e.target.value);
                    setInviteError('');
                  }}
                  placeholder="ana@empresa.com; joao@empresa.com"
                  className="min-h-[88px] w-full resize-none rounded-md border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] px-3 py-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] outline-none placeholder:text-[rgb(var(--crm-muted-rgb)_/_1)] focus:border-[#ff7a00]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[rgb(var(--crm-muted-rgb)_/_1)]"><Building2 className="h-4 w-4" /> Mensagem</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[96px] w-full resize-none rounded-md border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] px-3 py-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] outline-none placeholder:text-[rgb(var(--crm-muted-rgb)_/_1)] focus:border-[#ff7a00]"
                />
              </label>

              <div className="rounded-md border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-[rgb(var(--crm-ink-rgb)_/_1)]">{selectedProvider.name}</p>
                    <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">{selectedProvider.description}</p>
                  </div>
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedProvider.accent }} />
                </div>
                <div className="flex items-center gap-2 rounded-md border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] px-3 py-2">
                  <p className="min-w-0 flex-1 truncate text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">{inviteLink}</p>
                  <button onClick={copyInviteLink} className="flex items-center gap-1.5 text-xs font-semibold text-[#ffb15c] hover:text-[#f6b40b]">
                    {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] px-6 py-4">
              <button onClick={closeInvite} className="rounded-md border border-[var(--crm-border)] px-4 py-2 text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                Cancelar
              </button>
              <button onClick={sendInvite} className="flex items-center gap-2 rounded-md bg-[#ff7a00] px-5 py-2 text-sm font-black text-[rgb(var(--crm-ink-rgb)_/_1)] transition-colors hover:bg-[#f6b40b] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                <Send className="h-4 w-4" /> Enviar convite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
