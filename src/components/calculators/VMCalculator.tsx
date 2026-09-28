"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Server, Cpu, HardDrive, MemoryStick, Network,
  Calculator, Save, Download, RefreshCw, Search,
  TrendingUp, DollarSign, Clock, Zap, FileText,
  Brain, Plus, Trash2, Edit, Eye, ArrowLeft,
  Building, Settings, PieChart
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface VMConfig {
  id: string;
  name: string;
  vcpu: number;
  ram: number;
  storageType: string;
  storageSize: number;
  networkCard: string;
  os: string;
  backupSize: number;
  additionalIP: boolean;
  additionalSnapshot: boolean;
  vpnSiteToSite: boolean;
  quantity: number;
}

interface NegotiationRound {
  id: string;
  roundNumber: number;
  date: string;
  description: string;
  discount: number;
  vms: VMConfig[];
  originalPrice: number;
  totalPrice: number;
  status: 'active' | 'accepted' | 'rejected';
}

interface Proposal {
  id: string;
  proposalNumber: string;
  name: string;
  clientName: string;
  date: string;
  vms: VMConfig[];
  totalPrice: number;
  negotiationRounds: NegotiationRound[];
  currentRound: number;
}

interface TaxConfig {
  pisCofins: number;
  iss: number;
  csllIr: number;
}

interface PricingConfig {
  vcpuPerCore: number;
  ramPerGB: number;
  storagePerGB: {
    'HDD SAS': number;
    'SSD SATA': number;
    'SSD NVMe': number;
  };
  networkPerGbps: number;
  osLicense: {
    'Linux': number;
    'Windows Server': number;
    'FreeBSD': number;
    'Custom': number;
  };
  backupPerGB: number;
  additionalIP: number;
  additionalSnapshot: number;
  vpnSiteToSite: number;
  taxes: {
    'Lucro Real': TaxConfig;
    'Lucro Presumido': TaxConfig;
    'Lucro Real Reduzido': TaxConfig;
    'Simples Nacional': TaxConfig;
  };
  markup: number;
  netMargin: number;
  commission: number;
  selectedTaxRegime: string;
  storageCosts: {
    'HDD SAS': number;
    'NVMe': number;
    'SSD Performance': number;
  };
  networkCosts: {
    '1 Gbps': number;
    '10 Gbps': number;
  };
  contractDiscounts: {
    '12': number;
    '24': number;
    '36': number;
    '48': number;
    '60': number;
  };
  setupFee: number;
  managementSupport: number;
}

interface VMCalculatorProps {
  onSave: (proposal: Proposal) => void;
  onCancel: () => void;
  proposalToEdit?: Proposal | null;
}

const VMCalculator: React.FC<VMCalculatorProps> = ({ onSave, onCancel, proposalToEdit }) => {
  const [currentVM, setCurrentVM] = useState<VMConfig>({
    id: '',
    name: '',
    vcpu: 2,
    ram: 4,
    storageType: 'HDD SAS',
    storageSize: 100,
    networkCard: '1 Gbps',
    os: 'Linux',
    backupSize: 0,
    additionalIP: false,
    additionalSnapshot: false,
    vpnSiteToSite: false,
    quantity: 1
  });

  const [currentProposal, setCurrentProposal] = useState<Proposal>({
    id: '',
    proposalNumber: '',
    name: '',
    clientName: '',
    date: new Date().toISOString(),
    vms: [],
    totalPrice: 0,
    negotiationRounds: [],
    currentRound: 0
  });

  const [proposals, setProposals] = useState<Proposal[]>([
    {
      id: 'vm_1',
      proposalNumber: 'VM-2024-001',
      name: 'Proposta VM Teste',
      clientName: 'EMPRESA XYZ',
      date: '2024-01-17',
      vms: [],
      totalPrice: 500.00,
      negotiationRounds: [],
      currentRound: 0
    },
    {
      id: 'vm_2',
      proposalNumber: 'VM-2024-002',
      name: 'Proposta VM Corporativa',
      clientName: 'TECH SOLUTIONS',
      date: '2024-01-18',
      vms: [],
      totalPrice: 800.00,
      negotiationRounds: [],
      currentRound: 0
    }
  ]);
  const [viewMode, setViewMode] = useState<'search' | 'create' | 'edit' | 'proposal-summary'>('search');
  const [activeTab, setActiveTab] = useState<'config' | 'summary' | 'negotiations' | 'settings'>('config');
  const [searchTerm, setSearchTerm] = useState('');
  const [proposalSearchTerm, setProposalSearchTerm] = useState('');
  const [hasChanged, setHasChanged] = useState<boolean>(false);

  // Configurações de preços
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>({
    vcpuPerCore: 50,
    ramPerGB: 30,
    storagePerGB: {
      'HDD SAS': 0.30,
      'SSD SATA': 0.80,
      'SSD NVMe': 1.20
    },
    networkPerGbps: 20,
    osLicense: {
      'Linux': 0,
      'Windows Server': 200,
      'FreeBSD': 0,
      'Custom': 100
    },
    backupPerGB: 0.10,
    additionalIP: 50,
    additionalSnapshot: 25,
    vpnSiteToSite: 150,
    taxes: {
      'Lucro Real': { pisCofins: 9.25, iss: 5, csllIr: 34 },
      'Lucro Presumido': { pisCofins: 3.65, iss: 5, csllIr: 15 },
      'Lucro Real Reduzido': { pisCofins: 9.25, iss: 2, csllIr: 15.25 },
      'Simples Nacional': { pisCofins: 15, iss: 0, csllIr: 0 }
    },
    markup: 100,
    netMargin: 0,
    commission: 5,
    selectedTaxRegime: 'Simples Nacional',
    storageCosts: {
      'HDD SAS': 0.15,
      'NVMe': 0.60,
      'SSD Performance': 0.40
    },
    networkCosts: {
      '1 Gbps': 10,
      '10 Gbps': 100
    },
    contractDiscounts: {
      '12': 5,
      '24': 10,
      '36': 15,
      '48': 20,
      '60': 25
    },
    setupFee: 500,
    managementSupport: 200
  });

  useEffect(() => {
    const savedPricingConfig = localStorage.getItem('vmPricingConfig');
    if (savedPricingConfig) {
      setPricingConfig(JSON.parse(savedPricingConfig));
    }
  }, []);

  const handlePricingConfigChange = (key: keyof PricingConfig, value: any) => {
    setPricingConfig(prev => ({
      ...prev,
      [key]: value
    }));
    setHasChanged(true);
  };

  const savePricingConfig = () => {
    localStorage.setItem('vmPricingConfig', JSON.stringify(pricingConfig));
    setHasChanged(false);
    alert('Configurações de preços salvas com sucesso!');
  };

  // Função para formatar valores em padrão brasileiro
  const formatCurrency = (value: number): string => {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  };

  // Função para gerar número da proposta automaticamente
  const generateProposalNumber = (): string => {
    const existingProposalsThisYear = proposals.filter(p =>
      new Date(p.date).getFullYear() === new Date().getFullYear()
    );
    const nextNumber = existingProposalsThisYear.length + 1;
    const year = new Date().getFullYear();
    return `${nextNumber.toString().padStart(4, '0')}/${year}`;
  };

  // Função para calcular preço de uma VM
  const calculateVMPrice = useCallback((vm: VMConfig): number => {
    const vcpuCost = vm.vcpu * pricingConfig.vcpuPerCore;
    const ramCost = vm.ram * pricingConfig.ramPerGB;
    const storageCost = vm.storageSize * pricingConfig.storagePerGB[vm.storageType as keyof typeof pricingConfig.storagePerGB];
    const networkCost = pricingConfig.networkPerGbps;
    const osCost = pricingConfig.osLicense[vm.os as keyof typeof pricingConfig.osLicense];
    const backupCost = vm.backupSize * pricingConfig.backupPerGB;
    const additionalIPCost = vm.additionalIP ? pricingConfig.additionalIP : 0;
    const additionalSnapshotCost = vm.additionalSnapshot ? pricingConfig.additionalSnapshot : 0;
    const vpnCost = vm.vpnSiteToSite ? pricingConfig.vpnSiteToSite : 0;

    return vcpuCost + ramCost + storageCost + networkCost + osCost + backupCost + additionalIPCost + additionalSnapshotCost + vpnCost;
  }, [pricingConfig]);

  // Calcular preço total
  const calculateTotalPrice = useMemo(() => {
    return currentProposal.vms.reduce((total, vm) => {
      return total + (calculateVMPrice(vm) * vm.quantity);
    }, 0);
  }, [currentProposal.vms, calculateVMPrice]);

  // Filtrar propostas
  const filteredProposals = proposals.filter(proposal =>
    proposal.name.toLowerCase().includes(proposalSearchTerm.toLowerCase()) ||
    proposal.clientName.toLowerCase().includes(proposalSearchTerm.toLowerCase()) ||
    proposal.proposalNumber.toLowerCase().includes(proposalSearchTerm.toLowerCase())
  );

  // Funções de gerenciamento de propostas
  const createNewProposal = () => {
    setCurrentProposal({
      id: `proposal-${Date.now()}`,
      proposalNumber: generateProposalNumber(),
      name: '',
      clientName: '',
      date: new Date().toISOString(),
      vms: [],
      totalPrice: 0,
      negotiationRounds: [],
      currentRound: 0
    });
    setViewMode('create');
    setActiveTab('config');
  };

  const viewProposal = (proposal: Proposal) => {
    setCurrentProposal(proposal);
    setViewMode('proposal-summary');
  };

  const editProposal = (proposal: Proposal) => {
    setCurrentProposal(proposal);
    setViewMode('edit');
    setActiveTab('config');
  };

  const handlePrint = () => {
    // Add print-specific styles
    const printStyles = `
        @media print {
            @page {
                size: A4;
                margin: 1cm;
            }
            
            body * {
                visibility: hidden;
            }
            
            .print-area, .print-area * {
                visibility: visible;
            }
            
            .print-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                background: white !important;
            }
            
            .no-print {
                display: none !important;
            }
            
            .print\\:block {
                display: block !important;
            }
            
            .print\\:hidden {
                display: none !important;
            }
            
            .print\\:pt-2 {
                padding-top: 0.5rem !important;
            }
            
            .print\\:gap-4 {
                gap: 1rem !important;
            }
            
            .print\\:space-y-4 > * + * {
                margin-top: 1rem !important;
            }
            
            .print\\:text-sm {
                font-size: 0.875rem !important;
            }
            
            table {
                page-break-inside: avoid;
            }
            
            .border, .border-t {
                border-color: #000 !important;
            }
            
            .text-gray-900 {
                color: #000 !important;
            }
            
            .bg-slate-50 {
                background-color: #f8fafc !important;
            }
        }
    `;

    // Create style element
    const styleElement = document.createElement('style');
    styleElement.textContent = printStyles;
    document.head.appendChild(styleElement);

    // Add print-area class to the proposal view
    const proposalElement = document.querySelector('.proposal-view');
    if (proposalElement) {
      proposalElement.classList.add('print-area');
    }

    // Trigger print
    window.print();

    // Clean up
    setTimeout(() => {
      document.head.removeChild(styleElement);
      if (proposalElement) {
        proposalElement.classList.remove('print-area');
      }
    }, 1000);
  };

  const cancelAction = () => {
    setViewMode('search');
    setCurrentProposal({
      id: '',
      proposalNumber: '',
      name: '',
      clientName: '',
      date: new Date().toISOString(),
      vms: [],
      totalPrice: 0,
      negotiationRounds: [],
      currentRound: 0
    });
    setActiveTab('config');
  };

  const deleteProposal = (proposalId: string) => {
    if (confirm('Tem certeza que deseja excluir esta proposta?')) {
      setProposals(prev => prev.filter(p => p.id !== proposalId));
    }
  };

  const saveProposal = () => {
    if (!currentProposal.clientName || !currentProposal.name) {
      alert('Por favor, preencha o nome do cliente e o nome da proposta.');
      return;
    }

    if (currentProposal.vms.length === 0) {
      alert('Por favor, adicione pelo menos uma VM à proposta');
      return;
    }

    const proposal: Proposal = {
      ...currentProposal,
      id: currentProposal.id || `proposal-${Date.now()}`,
      proposalNumber: currentProposal.proposalNumber || generateProposalNumber(),
      totalPrice: calculateTotalPrice
    };

    if (viewMode === 'create') {
      setProposals(prev => [...prev, proposal]);
    } else if (viewMode === 'edit') {
      setProposals(prev => prev.map(p => p.id === proposal.id ? proposal : p));
    }

    // Reset form and go back to search view
    setCurrentProposal({
      id: '',
      proposalNumber: '',
      name: '',
      clientName: '',
      date: new Date().toISOString(),
      vms: [],
      totalPrice: 0,
      negotiationRounds: [],
      currentRound: 0
    });
    setActiveTab('config');
    setViewMode('search');

    alert('Proposta salva com sucesso!');
  };

  const addVMToProposal = () => {
    if (!currentVM.name) {
      alert('Por favor, insira um nome para a VM');
      return;
    }

    const newVM: VMConfig = {
      ...currentVM,
      id: `vm-${Date.now()}`
    };

    setCurrentProposal(prev => ({
      ...prev,
      vms: [...prev.vms, newVM]
    }));

    // Reset current VM
    setCurrentVM({
      id: '',
      name: '',
      vcpu: 2,
      ram: 4,
      storageType: 'HDD SAS',
      storageSize: 100,
      networkCard: '1 Gbps',
      os: 'Linux',
      backupSize: 0,
      additionalIP: false,
      additionalSnapshot: false,
      vpnSiteToSite: false,
      quantity: 1
    });
  };

  const removeVMFromProposal = (vmId: string) => {
    setCurrentProposal(prev => ({
      ...prev,
      vms: prev.vms.filter(vm => vm.id !== vmId)
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 relative" style={{
      backgroundImage: 'url(https://img.freepik.com/premium-photo/corridor-data-center-server-room-server-room-internet-communication-networks-ai-generativex9_28914-4589.jpg?w=1380)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      backgroundRepeat: 'no-repeat'
    }}>
      {/* Overlay para melhorar legibilidade */}
      <div className="absolute inset-0 bg-black/30 pointer-events-none"></div>

      {/* Conteúdo */}
      <div className="relative z-10">
        {/* Search View */}
        {viewMode === 'search' && (
          <div className="container mx-auto p-4 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">Buscar Propostas - VM</h1>
                <p className="text-slate-300 mt-2">Encontre propostas existentes ou crie uma nova.</p>
              </div>
              <Button onClick={createNewProposal} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Nova Proposta
              </Button>
            </div>

            {/* Search Input */}
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por cliente ou ID..."
                    value={proposalSearchTerm}
                    onChange={(e) => setProposalSearchTerm(e.target.value)}
                    className="pl-10 bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Proposals Table */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Propostas</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredProposals.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-600">
                          <th className="text-left py-3 px-4 text-slate-300">ID</th>
                          <th className="text-left py-3 px-4 text-slate-300">Cliente</th>
                          <th className="text-left py-3 px-4 text-slate-300">Data</th>
                          <th className="text-left py-3 px-4 text-slate-300">Total Mensal</th>
                          <th className="text-left py-3 px-4 text-slate-300">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProposals.map((proposal) => (
                          <tr key={proposal.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                            <td className="py-3 px-4 text-white">{proposal.proposalNumber}</td>
                            <td className="py-3 px-4 text-white">{proposal.clientName}</td>
                            <td className="py-3 px-4 text-slate-300">
                              {proposal.date ? (isNaN(new Date(proposal.date).getTime()) ? 'N/A' : new Date(proposal.date).toLocaleDateString('pt-BR')) : 'N/A'}
                            </td>
                            <td className="py-3 px-4 text-green-400 font-semibold">
                              {formatCurrency(proposal.totalPrice)}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => viewProposal(proposal)}
                                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                                >
                                  <Eye className="h-4 w-4 mr-2" /> Visualizar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => editProposal(proposal)}
                                  className="border-blue-600 text-blue-300 hover:bg-blue-700"
                                >
                                  <Edit className="h-4 w-4 mr-2" /> Editar
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => deleteProposal(proposal.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                    <h3 className="text-lg font-semibold text-white mb-2">Nenhuma proposta encontrada</h3>
                    <p className="text-slate-400">Clique em &quot;Nova Proposta&quot; para começar.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Proposal Summary View */}
        {viewMode === 'proposal-summary' && currentProposal && (
          <div className="container mx-auto p-4">
            <Card className="bg-white border-gray-300 text-black print:shadow-none proposal-view">
              <CardHeader className="print:pb-2">
                <div className="flex justify-between items-start mb-4 print:mb-2">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Proposta Comercial</h1>
                    <p className="text-gray-600">Máquinas Virtuais</p>
                  </div>
                  <div className="flex gap-2 no-print">
                    <Button variant="outline" onClick={() => setViewMode('search')}>
                      <ArrowLeft className="h-4 w-4 mr-2" />Voltar
                    </Button>
                    <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
                      <Download className="h-4 w-4 mr-2" />Imprimir PDF
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 print:space-y-4">
                {/* Dados da Proposta */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Dados da Proposta</h3>
                    <div className="space-y-2 text-sm">
                      <p><strong>Número:</strong> {currentProposal.proposalNumber}</p>
                      <p><strong>Nome:</strong> {currentProposal.name}</p>
                      <p><strong>Cliente:</strong> {currentProposal.clientName}</p>
                      <p><strong>Data:</strong> {currentProposal.date ? (isNaN(new Date(currentProposal.date).getTime()) ? 'N/A' : new Date(currentProposal.date).toLocaleDateString('pt-BR')) : 'N/A'}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Resumo Financeiro</h3>
                    <div className="space-y-2 text-sm">
                      <p><strong>Total da Proposta:</strong> {formatCurrency(currentProposal.totalPrice)}</p>
                      <p><strong>Rodada Atual:</strong> {currentProposal.currentRound}</p>
                    </div>
                  </div>
                </div>

                {/* Máquinas Virtuais */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Máquinas Virtuais</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-4 py-2 text-left">Nome</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">vCPU</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">RAM (GB)</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Storage</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">OS</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Qtd</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentProposal.vms.map((vm, index) => (
                          <tr key={index}>
                            <td className="border border-gray-300 px-4 py-2">{vm.name}</td>
                            <td className="border border-gray-300 px-4 py-2">{vm.vcpu}</td>
                            <td className="border border-gray-300 px-4 py-2">{vm.ram}</td>
                            <td className="border border-gray-300 px-4 py-2">{vm.storageSize}GB {vm.storageType}</td>
                            <td className="border border-gray-300 px-4 py-2">{vm.os}</td>
                            <td className="border border-gray-300 px-4 py-2">{vm.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Rodadas de Negociação */}
                {currentProposal.negotiationRounds.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Histórico de Negociações</h3>
                    <div className="space-y-3">
                      {currentProposal.negotiationRounds.map((round, index) => (
                        <div key={index} className="border border-gray-300 p-3 rounded">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold">Rodada {round.roundNumber}</h4>
                            <span className={`px-2 py-1 rounded text-xs ${round.status === 'accepted' ? 'bg-green-100 text-green-800' :
                              round.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                              {round.status === 'accepted' ? 'Aceito' :
                                round.status === 'rejected' ? 'Rejeitado' : 'Ativo'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{round.description}</p>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <p><strong>Data:</strong> {round.date ? (isNaN(new Date(round.date).getTime()) ? 'N/A' : new Date(round.date).toLocaleDateString('pt-BR')) : 'N/A'}</p>
                            <p><strong>Desconto:</strong> {round.discount}%</p>
                            <p><strong>Preço Original:</strong> {formatCurrency(round.originalPrice)}</p>
                            <p><strong>Preço Final:</strong> {formatCurrency(round.totalPrice)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Create/Edit View */}
        {(viewMode === 'create' || viewMode === 'edit') && (
          <div className="container mx-auto p-4 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">
                  {viewMode === 'create' ? 'Nova Proposta' : 'Editar Proposta'}
                </h1>
                <p className="text-slate-300 mt-2">Configure as VMs e detalhes da proposta.</p>
              </div>
              <Button onClick={cancelAction} variant="outline" className="border-slate-600 text-white">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </div>

            <Tabs defaultValue="config" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-800">
                <TabsTrigger value="config">Configuração de VM</TabsTrigger>
                <TabsTrigger value="pricing-settings">Configurações de Preços</TabsTrigger>
              </TabsList>

              <TabsContent value="config">
                {/* Proposal Basic Info */}
                <Card className="bg-slate-800 border-slate-700 mt-6">
                  <CardHeader>
                    <CardTitle className="text-white">Informações da Proposta</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="proposalName" className="text-white">Nome da Proposta</Label>
                        <Input
                          id="proposalName"
                          value={currentProposal.name}
                          onChange={(e) => setCurrentProposal(prev => ({ ...prev, name: e.target.value }))}
                          className="bg-slate-700 border-slate-600 text-white"
                          placeholder="Digite o nome da proposta"
                        />
                      </div>
                      <div>
                        <Label htmlFor="clientName" className="text-white">Nome do Cliente</Label>
                        <Input
                          id="clientName"
                          value={currentProposal.clientName}
                          onChange={(e) => setCurrentProposal(prev => ({ ...prev, clientName: e.target.value }))}
                          className="bg-slate-700 border-slate-600 text-white"
                          placeholder="Digite o nome do cliente"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* VM Configuration */}
                <Card className="bg-slate-800 border-slate-700 mt-6">
                  <CardHeader>
                    <CardTitle className="text-white">Configuração de VM</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="vmName" className="text-white">Nome da VM</Label>
                        <Input
                          id="vmName"
                          value={currentVM.name}
                          onChange={(e) => setCurrentVM(prev => ({ ...prev, name: e.target.value }))}
                          className="bg-slate-700 border-slate-600 text-white"
                          placeholder="Nome da VM"
                        />
                      </div>
                      <div>
                        <Label htmlFor="vcpu" className="text-white">vCPU</Label>
                        <Input
                          id="vcpu"
                          type="number"
                          value={currentVM.vcpu}
                          onChange={(e) => setCurrentVM(prev => ({ ...prev, vcpu: parseInt(e.target.value) || 0 }))}
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                      <div>
                        <Label htmlFor="ram" className="text-white">RAM (GB)</Label>
                        <Input
                          id="ram"
                          type="number"
                          value={currentVM.ram}
                          onChange={(e) => setCurrentVM(prev => ({ ...prev, ram: parseInt(e.target.value) || 0 }))}
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                      <div>
                        <Label htmlFor="storageType" className="text-white">Tipo de Storage</Label>
                        <Select
                          value={currentVM.storageType}
                          onValueChange={(value) => setCurrentVM(prev => ({ ...prev, storageType: value }))}
                        >
                          <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="HDD SAS">HDD SAS</SelectItem>
                            <SelectItem value="SSD SATA">SSD SATA</SelectItem>
                            <SelectItem value="SSD NVMe">SSD NVMe</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="storageSize" className="text-white">Storage (GB)</Label>
                        <Input
                          id="storageSize"
                          type="number"
                          value={currentVM.storageSize}
                          onChange={(e) => setCurrentVM(prev => ({ ...prev, storageSize: parseInt(e.target.value) || 0 }))}
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                      <div>
                        <Label htmlFor="quantity" className="text-white">Quantidade</Label>
                        <Input
                          id="quantity"
                          type="number"
                          value={currentVM.quantity}
                          onChange={(e) => setCurrentVM(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                    </div>
                    <Button onClick={addVMToProposal} className="bg-blue-600 hover:bg-blue-700 mt-4">
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar VM
                    </Button>
                  </CardContent>
                </Card>

                {/* VMs List */}
                {currentProposal.vms.length > 0 && (
                  <Card className="bg-slate-800 border-slate-700 mt-6">
                    <CardHeader>
                      <CardTitle className="text-white">VMs da Proposta</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {currentProposal.vms.map((vm) => (
                          <div key={vm.id} className="border border-slate-600 rounded-lg p-4 bg-slate-700">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="font-medium text-white">{vm.name}</h5>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeVMFromProposal(vm.id)}
                                className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm text-slate-300">
                              <div>
                                <span className="text-slate-400">vCPU:</span> {vm.vcpu}
                              </div>
                              <div>
                                <span className="text-slate-400">RAM:</span> {vm.ram}GB
                              </div>
                              <div>
                                <span className="text-slate-400">Storage:</span> {vm.storageSize}GB {vm.storageType}
                              </div>
                              <div>
                                <span className="text-slate-400">Qtd:</span> {vm.quantity}
                              </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-600">
                              <div className="font-medium text-green-400">
                                {formatCurrency(calculateVMPrice(vm))}/mês por VM
                              </div>
                              <div className="text-sm text-slate-400">
                                Total: {formatCurrency(calculateVMPrice(vm) * vm.quantity)}/mês
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Summary */}
                <Card className="bg-slate-800 border-slate-700 mt-6">
                  <CardHeader>
                    <CardTitle className="text-white">Resumo Financeiro</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-blue-600 p-4 rounded-lg">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-white">
                          {formatCurrency(calculateTotalPrice)}
                        </div>
                        <div className="text-sm text-blue-100">Total Mensal</div>
                      </div>
                    </div>

                    <div className="space-y-2 text-slate-300">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(calculateTotalPrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Desconto (0%):</span>
                        <span>R$ 0,00</span>
                      </div>
                      <Separator className="bg-slate-600" />
                      <div className="flex justify-between font-bold text-white">
                        <span>Total:</span>
                        <span>{formatCurrency(calculateTotalPrice)}</span>
                      </div>
                    </div>

                    <Button onClick={saveProposal} className="w-full bg-green-600 hover:bg-green-700">
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Proposta
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="pricing-settings">
                <Card className="bg-slate-800 border-slate-700 mt-6">
                  <CardHeader>
                    <CardTitle className="text-white">Configurações de Preços</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Custos de Hardware */}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-4">Custos de Hardware</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="vcpuPerCore" className="text-white">vCPU por Core (R$)</Label>
                          <Input
                            id="vcpuPerCore"
                            type="number"
                            value={pricingConfig.vcpuPerCore}
                            onChange={(e) => handlePricingConfigChange('vcpuPerCore', parseFloat(e.target.value) || 0)}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div>
                          <Label htmlFor="ramPerGB" className="text-white">RAM por GB (R$)</Label>
                          <Input
                            id="ramPerGB"
                            type="number"
                            value={pricingConfig.ramPerGB}
                            onChange={(e) => handlePricingConfigChange('ramPerGB', parseFloat(e.target.value) || 0)}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                      </div>
                      <div className="mt-6">
                        <h4 className="text-md font-semibold text-white mb-2">Armazenamento por GB (R$)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label htmlFor="hddSas" className="text-white">HDD SAS</Label>
                            <Input
                              id="hddSas"
                              type="number"
                              value={pricingConfig.storagePerGB['HDD SAS']}
                              onChange={(e) => handlePricingConfigChange('storagePerGB', { ...pricingConfig.storagePerGB, 'HDD SAS': parseFloat(e.target.value) || 0 })}
                              className="bg-slate-700 border-slate-600 text-white"
                            />
                          </div>
                          <div>
                            <Label htmlFor="ssdSata" className="text-white">SSD SATA</Label>
                            <Input
                              id="ssdSata"
                              type="number"
                              value={pricingConfig.storagePerGB['SSD SATA']}
                              onChange={(e) => handlePricingConfigChange('storagePerGB', { ...pricingConfig.storagePerGB, 'SSD SATA': parseFloat(e.target.value) || 0 })}
                              className="bg-slate-700 border-slate-600 text-white"
                            />
                          </div>
                          <div>
                            <Label htmlFor="ssdNvme" className="text-white">SSD NVMe</Label>
                            <Input
                              id="ssdNvme"
                              type="number"
                              value={pricingConfig.storagePerGB['SSD NVMe']}
                              onChange={(e) => handlePricingConfigChange('storagePerGB', { ...pricingConfig.storagePerGB, 'SSD NVme': parseFloat(e.target.value) || 0 })}
                              className="bg-slate-700 border-slate-600 text-white"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="mt-6">
                        <h4 className="text-md font-semibold text-white mb-2">Custos de Rede (R$)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="network1Gbps" className="text-white">1 Gbps</Label>
                            <Input
                              id="network1Gbps"
                              type="number"
                              value={pricingConfig.networkCosts['1 Gbps']}
                              onChange={(e) => handlePricingConfigChange('networkCosts', { ...pricingConfig.networkCosts, '1 Gbps': parseFloat(e.target.value) || 0 })}
                              className="bg-slate-700 border-slate-600 text-white"
                            />
                          </div>
                          <div>
                            <Label htmlFor="network10Gbps" className="text-white">10 Gbps</Label>
                            <Input
                              id="network10Gbps"
                              type="number"
                              value={pricingConfig.networkCosts['10 Gbps']}
                              onChange={(e) => handlePricingConfigChange('networkCosts', { ...pricingConfig.networkCosts, '10 Gbps': parseFloat(e.target.value) || 0 })}
                              className="bg-slate-700 border-slate-600 text-white"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Licenças de SO e Serviços Adicionais */}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-4">Licenças de SO e Serviços Adicionais</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="linuxOs" className="text-white">Linux (R$)</Label>
                          <Input
                            id="linuxOs"
                            type="number"
                            value={pricingConfig.osLicense.Linux}
                            onChange={(e) => handlePricingConfigChange('osLicense', { ...pricingConfig.osLicense, Linux: parseFloat(e.target.value) || 0 })}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div>
                          <Label htmlFor="windowsServerOs" className="text-white">Windows Server (R$)</Label>
                          <Input
                            id="windowsServerOs"
                            type="number"
                            value={pricingConfig.osLicense['Windows Server']}
                            onChange={(e) => handlePricingConfigChange('osLicense', { ...pricingConfig.osLicense, 'Windows Server': parseFloat(e.target.value) || 0 })}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div>
                          <Label htmlFor="freebsdOs" className="text-white">FreeBSD (R$)</Label>
                          <Input
                            id="freebsdOs"
                            type="number"
                            value={pricingConfig.osLicense.FreeBSD}
                            onChange={(e) => handlePricingConfigChange('osLicense', { ...pricingConfig.osLicense, FreeBSD: parseFloat(e.target.value) || 0 })}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div>
                          <Label htmlFor="customOs" className="text-white">Custom OS (R$)</Label>
                          <Input
                            id="customOs"
                            type="number"
                            value={pricingConfig.osLicense.Custom}
                            onChange={(e) => handlePricingConfigChange('osLicense', { ...pricingConfig.osLicense, Custom: parseFloat(e.target.value) || 0 })}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        <div>
                          <Label htmlFor="backupPerGB" className="text-white">Backup por GB (R$)</Label>
                          <Input
                            id="backupPerGB"
                            type="number"
                            value={pricingConfig.backupPerGB}
                            onChange={(e) => handlePricingConfigChange('backupPerGB', parseFloat(e.target.value) || 0)}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div>
                          <Label htmlFor="additionalIP" className="text-white">IP Adicional (R$)</Label>
                          <Input
                            id="additionalIP"
                            type="number"
                            value={pricingConfig.additionalIP}
                            onChange={(e) => handlePricingConfigChange('additionalIP', parseFloat(e.target.value) || 0)}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div>
                          <Label htmlFor="additionalSnapshot" className="text-white">Snapshot Adicional (R$)</Label>
                          <Input
                            id="additionalSnapshot"
                            type="number"
                            value={pricingConfig.additionalSnapshot}
                            onChange={(e) => handlePricingConfigChange('additionalSnapshot', parseFloat(e.target.value) || 0)}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div>
                          <Label htmlFor="vpnSiteToSite" className="text-white">VPN Site-to-Site (R$)</Label>
                          <Input
                            id="vpnSiteToSite"
                            type="number"
                            value={pricingConfig.vpnSiteToSite}
                            onChange={(e) => handlePricingConfigChange('vpnSiteToSite', parseFloat(e.target.value) || 0)}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Descontos e Taxas */}
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-4">Descontos e Taxas</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="markup" className="text-white">Markup (%)</Label>
                          <Input
                            id="markup"
                            type="number"
                            value={pricingConfig.markup}
                            onChange={(e) => handlePricingConfigChange('markup', parseFloat(e.target.value) || 0)}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div>
                          <Label htmlFor="commission" className="text-white">Comissão (%)</Label>
                          <Input
                            id="commission"
                            type="number"
                            value={pricingConfig.commission}
                            onChange={(e) => handlePricingConfigChange('commission', parseFloat(e.target.value) || 0)}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div>
                          <Label htmlFor="setupFee" className="text-white">Taxa de Setup (R$)</Label>
                          <Input
                            id="setupFee"
                            type="number"
                            value={pricingConfig.setupFee}
                            onChange={(e) => handlePricingConfigChange('setupFee', parseFloat(e.target.value) || 0)}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div>
                          <Label htmlFor="managementSupport" className="text-white">Gestão e Suporte (R$)</Label>
                          <Input
                            id="managementSupport"
                            type="number"
                            value={pricingConfig.managementSupport}
                            onChange={(e) => handlePricingConfigChange('managementSupport', parseFloat(e.target.value) || 0)}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                      </div>

                      <div className="mt-6">
                        <h4 className="text-md font-semibold text-white mb-2">Descontos Contratuais (%)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {Object.entries(pricingConfig.contractDiscounts).map(([months, discount]) => (
                            <div key={months}>
                              <Label htmlFor={`discount-${months}`} className="text-white">{months} Meses</Label>
                              <Input
                                id={`discount-${months}`}
                                type="number"
                                value={discount}
                                onChange={(e) => handlePricingConfigChange('contractDiscounts', { ...pricingConfig.contractDiscounts, [months]: parseFloat(e.target.value) || 0 })}
                                className="bg-slate-700 border-slate-600 text-white"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-6">
                        <h4 className="text-md font-semibold text-white mb-2">Regime Tributário</h4>
                        <Select
                          value={pricingConfig.selectedTaxRegime}
                          onValueChange={(value) => handlePricingConfigChange('selectedTaxRegime', value)}
                        >
                          <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Lucro Real">Lucro Real</SelectItem>
                            <SelectItem value="Lucro Presumido">Lucro Presumido</SelectItem>
                            <SelectItem value="Lucro Real Reduzido">Lucro Real Reduzido</SelectItem>
                            <SelectItem value="Simples Nacional">Simples Nacional</SelectItem>
                          </SelectContent>
                        </Select>

                        {pricingConfig.selectedTaxRegime && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <div>
                              <Label htmlFor="pisCofins" className="text-white">PIS/COFINS (%)</Label>
                              <Input
                                id="pisCofins"
                                type="number"
                                value={pricingConfig.taxes[pricingConfig.selectedTaxRegime as keyof typeof pricingConfig.taxes].pisCofins}
                                onChange={(e) => handlePricingConfigChange('taxes', { ...pricingConfig.taxes, [pricingConfig.selectedTaxRegime]: { ...pricingConfig.taxes[pricingConfig.selectedTaxRegime as keyof typeof pricingConfig.taxes], pisCofins: parseFloat(e.target.value) || 0 } })}
                                className="bg-slate-700 border-slate-600 text-white"
                              />
                            </div>
                            <div>
                              <Label htmlFor="iss" className="text-white">ISS (%)</Label>
                              <Input
                                id="iss"
                                type="number"
                                value={pricingConfig.taxes[pricingConfig.selectedTaxRegime as keyof typeof pricingConfig.taxes].iss}
                                onChange={(e) => handlePricingConfigChange('taxes', { ...pricingConfig.taxes, [pricingConfig.selectedTaxRegime]: { ...pricingConfig.taxes[pricingConfig.selectedTaxRegime as keyof typeof pricingConfig.taxes], iss: parseFloat(e.target.value) || 0 } })}
                                className="bg-slate-700 border-slate-600 text-white"
                              />
                            </div>
                            <div>
                              <Label htmlFor="csllIr" className="text-white">CSLL/IR (%)</Label>
                              <Input
                                id="csllIr"
                                type="number"
                                value={pricingConfig.taxes[pricingConfig.selectedTaxRegime as keyof typeof pricingConfig.taxes].csllIr}
                                onChange={(e) => handlePricingConfigChange('taxes', { ...pricingConfig.taxes, [pricingConfig.selectedTaxRegime]: { ...pricingConfig.taxes[pricingConfig.selectedTaxRegime as keyof typeof pricingConfig.taxes], csllIr: parseFloat(e.target.value) || 0 } })}
                                className="bg-slate-700 border-slate-600 text-white"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      onClick={savePricingConfig}
                      className="w-full bg-green-600 hover:bg-green-700 mt-6"
                      disabled={!hasChanged}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Configurações de Preços
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
};

export default VMCalculator;
