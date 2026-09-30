"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Edit, Trash2, User, Calendar, DollarSign, FileText, Briefcase, Calculator, ArrowLeft, Printer } from 'lucide-react';
import type { Proposal, Partner } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import ProposalForm from './ProposalForm';
import CommercialProposalView from '../commercial-proposal/CommercialProposalView';
import { ProposalStatusBadge } from './ProposalStatusBadge';
import { useAuth } from '@/hooks/use-auth';
import { getPermissionsForRole, normalizeUserRole } from '@/lib/permissions';
import { isApprovedStatus, isPendingApprovalStatus } from '@/lib/proposals/status-presentation';
import { getCalculatorTabForProposal } from '@/lib/proposals/calculator-tab';

interface ProposalsViewProps {
  proposals: Proposal[];
  partners: Partner[];
  onSave: (proposal: Proposal) => void;
  onDelete: (id: string) => void;
  onBackToTop?: () => void;
}

const ProposalsView: React.FC<ProposalsViewProps> = ({ proposals, partners, onSave, onDelete, onBackToTop }) => {
  const router = useRouter();
  const { user } = useAuth(); // Get the user object
  const rolePermissions = React.useMemo(
    () => getPermissionsForRole(normalizeUserRole(user?.role)),
    [user?.role]
  );
  const canAccessCalculators = rolePermissions.canAccessCalculators;
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccountManager, setSelectedAccountManager] = useState<string>('all');
  const [appliedAccountManager, setAppliedAccountManager] = useState<string>('all');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [showProposalTypeDialog, setShowProposalTypeDialog] = useState(false);
  const [showCommercialProposal, setShowCommercialProposal] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  // Lista de gerentes de contas (fixos + dinâmicos das propostas)
  const accountManagers = React.useMemo(() => {
    // Gerentes fixos
    const fixedManagers = [
      'Willian Conralles',
      'Plinico Ginnasi',
      'Fabio Oliveira'
    ];
    
    const managers = new Set<string>(fixedManagers);
    
    // Adicionar gerentes das propostas existentes
    proposals.forEach(proposal => {
      if (proposal.accountManager) {
        const managerName = typeof proposal.accountManager === 'string' 
          ? proposal.accountManager 
          : proposal.accountManager?.name;
        if (managerName) {
          managers.add(managerName);
        }
      }
    });
    
    return Array.from(managers).sort();
  }, [proposals]);

  // Função para aplicar filtros
  const handleApplyFilters = () => {
    setAppliedAccountManager(selectedAccountManager);
    setAppliedSearchTerm(searchTerm);
  };

  // Função para limpar filtros
  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedAccountManager('all');
    setAppliedSearchTerm('');
    setAppliedAccountManager('all');
  };

  // Debug effect
  React.useEffect(() => {
    console.log('ProposalsView Debug:', {
      totalProposals: proposals.length,
      proposals: proposals.slice(0, 3),
      user: user,
      accountManagers: accountManagers,
      selectedAccountManager: selectedAccountManager,
      appliedAccountManager: appliedAccountManager
    });
    
    // Log de todos os gerentes nas propostas
    console.log('Gerentes nas propostas:', proposals.map(p => ({
      title: p.title,
      accountManager: p.accountManager,
      accountManagerType: typeof p.accountManager,
      accountManagerName: typeof p.accountManager === 'string' ? p.accountManager : p.accountManager?.name
    })));
  }, [proposals, user, accountManagers, selectedAccountManager, appliedAccountManager]);

  const filteredProposals = proposals.filter(proposal => {
    if (!proposal) return false; // Defensively handle null/undefined proposals in the array
    
    // Filtro por gerente de contas (usando o filtro aplicado)
    if (appliedAccountManager !== 'all') {
      const proposalManager = typeof proposal.accountManager === 'string' 
        ? proposal.accountManager 
        : proposal.accountManager?.name || '';
      
      // Debug log
      console.log('Filtro Debug:', {
        appliedManager: appliedAccountManager,
        proposalManager: proposalManager,
        accountManagerType: typeof proposal.accountManager,
        accountManagerRaw: proposal.accountManager,
        match: proposalManager === appliedAccountManager
      });
      
      if (proposalManager !== appliedAccountManager) {
        return false;
      }
    }

    // Filtro por termo de busca (usando o termo aplicado)
    if (appliedSearchTerm) {
      const term = appliedSearchTerm.toLowerCase();

      const titleMatch = typeof proposal.title === 'string' && proposal.title.toLowerCase().includes(term);
      const clientMatch = (typeof proposal.client === 'string' && proposal.client.toLowerCase().includes(term)) ||
                         (typeof proposal.client === 'object' && proposal.client?.name?.toLowerCase().includes(term));
      const accountManagerMatch = (typeof proposal.accountManager === 'string' && proposal.accountManager.toLowerCase().includes(term)) ||
                                 (typeof proposal.accountManager === 'object' && proposal.accountManager?.name?.toLowerCase().includes(term));

      return titleMatch || clientMatch || accountManagerMatch;
    }

    return true;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const handleEdit = (proposal: Proposal) => {
    setEditingProposal(proposal);
    setIsFormOpen(true);
  };



  const handleProposalTypeSelect = (type: 'commercial' | 'technical') => {
    setShowProposalTypeDialog(false);
    if (type === 'commercial') {
      setShowCommercialProposal(true);
    } else {
      setEditingProposal(null);
      setIsFormOpen(true);
    }
  };

  const handleViewCommercialProposal = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setShowCommercialProposal(true);
  };

  const handleSave = (proposal: Proposal) => {
    onSave(proposal);
    setIsFormOpen(false);
    setEditingProposal(null);
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingProposal(null);
  };

  const handleCommercialProposalClose = () => {
    setShowCommercialProposal(false);
  };

  const getDistributorName = (distributorId: number | string) => {
    const distributor = partners.find(p => p.id.toString() === distributorId.toString());
    return distributor?.name || 'N/A';
  };

  const getProductName = (type: string) => {
    const productMap: Record<string, string> = {
      'PABX': 'PABX/SIP',
      'VM': 'Máquinas Virtuais',
      'FIBER': 'Internet Fibra',
      'RADIO': 'Internet Rádio',
      'DOUBLE': 'Double Fibra/Rádio',
      'INTERNET_MAN_FIBRA': 'Rede Man/MPLS Fibra', // legado
      'MANRADIO': 'Rede Man/MPLS Radio', // legado
      'REDE_MAN_MPLS_FIBRA': 'Rede Man/MPLS Fibra',
      'REDE_MAN_MPLS_RADIO': 'Rede Man/MPLS Radio',
      'standard': 'Padrão'
    };
    return productMap[type] || type || 'N/A';
  };

  const handleNavigateToCalculator = (proposal: Proposal) => {
    const tab = getCalculatorTabForProposal({
      type: proposal.type,
      baseId: proposal.baseId,
      base_id: (proposal as any).base_id,
    });

    const params = new URLSearchParams({ tab });
    if (proposal.id) {
      params.set('proposalId', String(proposal.id));
    }

    router.push(`/?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex items-center space-x-4">
          {onBackToTop && (
            <Button 
              onClick={onBackToTop}
              className="flex items-center shrink-0 bg-blue-600 border-2 border-blue-500 text-white hover:bg-blue-700 hover:border-blue-600 font-medium shadow-md"
              aria-label="Voltar para as calculadoras"
            >
              <ArrowLeft className="h-4 w-4 mr-2 text-white" />
              <span className="text-white">Voltar</span>
            </Button>
          )}
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Propostas</h1>
              <p className="text-slate-400">
                Visualize e gerencie as propostas geradas nas calculadoras
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Estatísticas Modernas */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl hover:shadow-blue-500/25 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-slate-700/50 group overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-800 opacity-10 group-hover:opacity-20 transition-opacity duration-300" />
          <div className="relative p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 shadow-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                  {proposals.length}
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1 group-hover:text-cyan-300 transition-colors">
                Total de Propostas
              </h3>
              <p className="text-slate-400 text-sm">Todas as propostas</p>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full" />
        </div>

        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl hover:shadow-green-500/25 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-slate-700/50 group overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-green-600 to-green-800 opacity-10 group-hover:opacity-20 transition-opacity duration-300" />
          <div className="relative p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-600 to-green-800 shadow-lg">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                  {formatCurrency(proposals.reduce((sum, p) => sum + (p.value || 0), 0))}
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1 group-hover:text-cyan-300 transition-colors">
                Valor Total
              </h3>
              <p className="text-slate-400 text-sm">Soma de todas as propostas</p>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full" />
        </div>

        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl hover:shadow-emerald-500/25 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-slate-700/50 group overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 to-emerald-800 opacity-10 group-hover:opacity-20 transition-opacity duration-300" />
          <div className="relative p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 shadow-lg">
                <User className="h-6 w-6 text-white" />
              </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                  {proposals.filter((p) => isApprovedStatus(p.status)).length}
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1 group-hover:text-cyan-300 transition-colors">
                Aprovadas
              </h3>
              <p className="text-slate-400 text-sm">Propostas aprovadas</p>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full" />
        </div>

        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl hover:shadow-yellow-500/25 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-slate-700/50 group overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-600 to-yellow-800 opacity-10 group-hover:opacity-20 transition-opacity duration-300" />
          <div className="relative p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-600 to-yellow-800 shadow-lg">
                <Calendar className="h-6 w-6 text-white" />
              </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                  {proposals.filter((p) => isPendingApprovalStatus(p.status)).length}
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1 group-hover:text-cyan-300 transition-colors">
                Enviadas p/ Aprovação
              </h3>
              <p className="text-slate-400 text-sm">Aguardando aprovação</p>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full" />
        </div>
      </div>

      {/* Filtros de Busca */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Input
          placeholder="Buscar propostas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleApplyFilters()}
          className="max-w-sm bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-cyan-400"
        />
        
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-slate-400" />
          <select
            value={selectedAccountManager}
            onChange={(e) => setSelectedAccountManager(e.target.value)}
            className="bg-slate-800/50 border border-slate-600 text-white rounded-md px-3 py-2 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 min-w-[200px]"
          >
            <option value="all">Todos os Gerentes</option>
            {accountManagers.map((manager) => (
              <option key={manager} value={manager}>
                {manager}
              </option>
            ))}
          </select>
        </div>

        <Button
          onClick={handleApplyFilters}
          className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white border-0"
        >
          Aplicar Filtro
        </Button>

        {(appliedSearchTerm || appliedAccountManager !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-slate-400 hover:text-white hover:bg-slate-700/50"
          >
            Limpar Filtros
          </Button>
        )}
      </div>

      {/* Tabela de Propostas Moderna */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl border border-slate-700/50 overflow-hidden">
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white">Lista de Propostas</h3>
          </div>
        </div>
        <div className="p-6">
          {/* Debug info - moved to useEffect */}
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-slate-800/50">
                  <TableHead className="text-slate-300">Título</TableHead>
                  <TableHead className="text-slate-300">Cliente</TableHead>
                  <TableHead className="text-slate-300">Gerente de Conta</TableHead>
                  <TableHead className="text-slate-300">Produto</TableHead>
                  <TableHead className="text-slate-300">Valor</TableHead>
                  <TableHead className="text-slate-300">Descontos</TableHead>
                  <TableHead className="text-slate-300">Status</TableHead>
                  <TableHead className="text-slate-300">Data de Criação</TableHead>
                  <TableHead className="text-slate-300">Validade</TableHead>
                  <TableHead className="text-right text-slate-300">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProposals.map((proposal) => {
                  // Verificar se há descontos nos produtos
                  const hasDiscounts = proposal.products?.some((p: any) => 
                    p.details?.applySalespersonDiscount || p.details?.appliedDirectorDiscountPercentage > 0
                  );
                  
                  // Coletar informações de descontos
                  const discounts: string[] = [];
                  if (proposal.products) {
                    proposal.products.forEach((p: any) => {
                      if (p.details?.applySalespersonDiscount) {
                        discounts.push('Vendedor: 5%');
                      }
                      if (p.details?.appliedDirectorDiscountPercentage > 0) {
                        discounts.push(`Diretoria: ${p.details.appliedDirectorDiscountPercentage}%`);
                      }
                    });
                  }
                  
                  return (
                    <TableRow key={proposal.id} className="border-slate-700 hover:bg-slate-800/30 transition-colors">
                      <TableCell className="font-medium text-white">{proposal.title}</TableCell>
                      <TableCell className="text-slate-300">{typeof proposal.client === 'string' ? proposal.client : proposal.client?.name || 'N/A'}</TableCell>
                      <TableCell className="text-slate-300">{typeof proposal.accountManager === 'string' ? proposal.accountManager : proposal.accountManager?.name || 'N/A'}</TableCell>
                      <TableCell className="text-slate-300">{getProductName(proposal.type)}</TableCell>
                      <TableCell className="text-slate-300">{formatCurrency(proposal.value || 0)}</TableCell>
                      <TableCell className="text-slate-300">
                        {hasDiscounts ? (
                          <div className="flex flex-col gap-1">
                            {discounts.map((discount, idx) => (
                              <Badge key={idx} className="bg-green-600/20 text-green-300 border-green-500/30 text-xs">
                                {discount}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs">Sem descontos</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ProposalStatusBadge status={proposal.status} />
                      </TableCell>
                      <TableCell className="text-slate-300">{formatDate(proposal.date)}</TableCell>
                      <TableCell className="text-slate-300">{formatDate(proposal.expiryDate)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewCommercialProposal(proposal)}
                            className="flex items-center text-cyan-400 hover:text-cyan-300 hover:bg-slate-700/50"
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            <span>Ver</span>
                          </Button>
                          {canAccessCalculators && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleNavigateToCalculator(proposal)}
                              className="flex items-center text-blue-400 hover:text-blue-300 hover:bg-slate-700/50"
                            >
                              <Calculator className="h-4 w-4 mr-1" />
                              <span>Calcular</span>
                            </Button>
                          )}
                          {(rolePermissions.canEditProposals || rolePermissions.canDeleteProposals) &&
                            (rolePermissions.canViewAllProposals || proposal.createdBy === user?.id) && (
                            <>
                              {rolePermissions.canEditProposals && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(proposal)}
                                  className="text-yellow-400 hover:text-yellow-300 hover:bg-slate-700/50"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {rolePermissions.canDeleteProposals && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onDelete(proposal.id)}
                                  className="text-red-400 hover:text-red-300 hover:bg-slate-700/50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          
          {filteredProposals.length === 0 && (
            <div className="text-center py-12">
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-slate-800/50 rounded-full">
                  <FileText className="h-12 w-12 text-slate-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Nenhuma proposta encontrada</h3>
                  <p className="text-slate-400">
                    {proposals.length === 0 
                      ? "Você ainda não possui propostas salvas. Use as calculadoras para gerar suas propostas!" 
                      : "Nenhuma proposta corresponde aos critérios de busca."}
                  </p>
                </div>
                {proposals.length === 0 && onBackToTop && canAccessCalculators && (
                  <Button onClick={onBackToTop} className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white border-0">
                    <Calculator className="h-4 w-4 mr-2" />
                    Ir para Calculadoras
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Diálogo de Seleção do Tipo de Proposta */}
      <Dialog open={showProposalTypeDialog} onOpenChange={setShowProposalTypeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Escolha o Tipo de Proposta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button 
              onClick={() => handleProposalTypeSelect('commercial')}
              className="w-full h-20 flex flex-col items-center justify-center space-y-2"
              variant="outline"
            >
              <FileText className="h-8 w-8" />
              <span className="font-semibold">Proposta Comercial</span>
              <span className="text-sm text-muted-foreground">Layout personalizado com design profissional</span>
            </Button>
            <Button 
              onClick={() => handleProposalTypeSelect('technical')}
              className="w-full h-20 flex flex-col items-center justify-center space-y-2"
              variant="outline"
            >
              <Briefcase className="h-8 w-8" />
              <span className="font-semibold">Proposta Técnica</span>
              <span className="text-sm text-muted-foreground">Formulário detalhado com especificações técnicas</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo da Proposta Comercial - SEM BOTÕES DENTRO */}
      <Dialog open={showCommercialProposal} onOpenChange={setShowCommercialProposal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Proposta Comercial</DialogTitle>
          </DialogHeader>
          <CommercialProposalView partners={partners} proposal={selectedProposal} />
        </DialogContent>
      </Dialog>
      
      {/* Botões de ação FORA do Dialog - Posicionados absolutamente */}
      {showCommercialProposal && (
        <div 
          style={{
            position: 'fixed',
            top: '80px',
            right: '60px',
            zIndex: 9999,
            display: 'flex',
            gap: '0.5rem'
          }}
          className="no-print"
        >
          <button 
            onClick={() => window.print()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              borderRadius: '0.375rem',
              border: '1px solid #d1d5db',
              backgroundColor: '#ffffff',
              color: '#374151',
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
            }}
          >
            <Printer style={{ width: '16px', height: '16px', color: '#374151' }} />
            <span style={{ color: '#374151' }}>Imprimir</span>
          </button>
          <button 
            onClick={async () => {
              const downloadBtn = document.querySelector('[data-download-pdf]') as HTMLButtonElement;
              if (downloadBtn) downloadBtn.click();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              borderRadius: '0.375rem',
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1d4ed8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#2563eb';
            }}
          >
            <FileText style={{ width: '16px', height: '16px', color: '#ffffff' }} />
            <span style={{ color: '#ffffff' }}>Download PDF</span>
          </button>
        </div>
      )}

      {/* Diálogo da Proposta Técnica */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProposal ? 'Editar Proposta' : 'Nova Proposta Técnica'}
            </DialogTitle>
          </DialogHeader>
          <ProposalForm
            proposal={editingProposal}
            partners={partners}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProposalsView;
