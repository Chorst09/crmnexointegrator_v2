
import React, { useState, useEffect, useMemo, useCallback } from 'react';
// PostgreSQL via Prisma - APIs REST
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import '@/styles/print.css';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from '@/components/ui/checkbox';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CommissionTablesUnified from './CommissionTablesUnified';
import { ProposalApprovalRequestButton } from '@/components/proposals/ProposalApprovalRequestButton';
import { ProposalStatusBadge } from '@/components/proposals/ProposalStatusBadge';
import { ProposalApprovalInfo } from '@/components/proposals/ProposalApprovalInfo';
import { ConvertToB2BOpportunityButton } from '@/components/proposals/ConvertToB2BOpportunityButton';
import { useCommissions, getChannelIndicatorCommissionRate, getChannelInfluencerCommissionRate, getChannelSellerCommissionRate, getSellerCommissionRate, getDirectorCommissionRate } from '@/hooks/use-commissions';
import { generateNextProposalId } from '@/lib/proposal-id-generator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Calculator,
    Phone,
    PhoneForwarded,
    Settings,
    FileText,
    Download,
    Save,
    Search,
    Edit,
    Plus,
    User,
    Trash2,
    Server,
    Brain,
    Cpu,
    MemoryStick,
    HardDrive,
    Network,
    PlusCircle,
    FilePenLine,
    ArrowLeft
} from 'lucide-react';

// Import shared components
import { ClientManagerForm } from '@/components/calculators/ClientManagerForm';

// Local interfaces
interface ClientData {
    name: string;
    contact?: string;
    projectName?: string;
    email?: string;
    phone?: string;
    companyName?: string;
}

interface AccountManagerData {
    name: string;
    email?: string;
    phone?: string;
    distributorId?: string;
}
import { ClientManagerInfo } from '@/components/calculators/ClientManagerInfo';

// Brazilian currency formatter
const formatBrazilianNumber = (value: number): string => {
    return value.toFixed(2).replace('.', ',');
};

// Interfaces
interface PABXTier {
    min: number;
    max: number;
    setup: number;
    monthly: number;
}

interface SIPPlan {
    name: string;
    type: 'PLANO' | 'TARIFADO';
    setup: number;
    monthly: number;
    monthlyWithEquipment?: number; // Opcional para planos que não têm essa opção
    channels: number;
}

interface PABXResult {
    setup: number;
    baseMonthly: number;
    deviceRentalCost: number;
    aiAgentCost: number;
    totalMonthly: number;
}

interface SIPResult {
    setup: number;
    monthly: number;
    additionalChannelsCost: number;
}

// Interface para um produto adicionado à proposta
type ProductType = 'VM' | 'PABX' | 'SIP';

interface Product {
    id: string;
    type: ProductType;
    description: string;
    setup: number;
    monthly: number;
    details: any;
}

interface Proposal {
    id: string; // ID do documento no Firestore
    baseId: string;
    base_id?: string;
    version: number;
    userId: string; // ID do usuário que criou a proposta
    createdBy?: string; // Para compatibilidade com API
    client: ClientData | string; // Pode ser objeto ou string
    accountManager: AccountManagerData;
    products: Product[];
    totalSetup: number;
    totalMonthly: number;
    contractPeriod: number; // Período do contrato em meses
    createdAt: string | any; // Pode ser string ou objeto Firestore
    status: string;
    // Campos opcionais para compatibilidade
    clientData?: ClientData;
    items?: Product[];
    applySalespersonDiscount?: boolean;
    appliedDirectorDiscountPercentage?: number;
    baseTotalMonthly?: number;
    expiryDate?: string;
    changes?: string;
    metadata?: {
        accountManagerEmail?: string;
        accountManagerPhone?: string;
        fullAccountManagerData?: AccountManagerData;
    };
}

import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';
import { useDeepLinkedProposal } from '@/hooks/use-deep-linked-proposal';
import { getPermissionsForRole, normalizeUserRole } from '@/lib/permissions';
import { toast } from 'sonner';
import { getCRMAuthHeaders } from '@/config/api';


interface MaquinasVirtuaisCalculatorProps {
    onBackToDashboard?: () => void;
    initialProposalId?: string | null;
}

const MaquinasVirtuaisCalculator = ({ onBackToDashboard, initialProposalId }: MaquinasVirtuaisCalculatorProps) => {
    // Initialize auth hook
    const auth = useAuth();
    const currentUser = auth?.user;
    console.log("User role:", currentUser?.role);
    const normalizedRole = normalizeUserRole(currentUser?.role);
    const isAdmin = normalizedRole === 'admin' || normalizedRole === 'master';
    const isDirector = normalizedRole === 'director';

    // Verificar permissões do usuário
    const userPermissions = currentUser?.role ? getPermissionsForRole(currentUser.role as any) : null;
    const canEditCommissions = userPermissions?.canEditCommissions || false;

    // Estados de gerenciamento de propostas
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [currentProposal, setCurrentProposal] = useState<Proposal | null>(null);
    const [viewMode, setViewMode] = useState<'search' | 'client-form' | 'calculator' | 'proposal-summary'>('search');
    const [showClientForm, setShowClientForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [hasChanged, setHasChanged] = useState<boolean>(false);
    const [saving, setSaving] = useState(false);

    const filteredProposals = proposals.filter((p) => {
        const clientName = typeof p.client === 'string' ? p.client : p.client?.name || '';
        return clientName.toLowerCase().includes(searchTerm.toLowerCase());
    })

    // Estados dos dados do cliente e gerente
    const [clientData, setClientData] = useState<ClientData>({
        name: '',
        contact: '',
        projectName: '',
        email: '',
        phone: ''
    });
    const [accountManagerData, setAccountManagerData] = useState<AccountManagerData>({
        name: '',
        email: '',
        phone: ''
    });
    const [addedProducts, setAddedProducts] = useState<Product[]>([]);
    const [selectedStatus, setSelectedStatus] = useState<string>('Aguardando Aprovação do Cliente');
    const [selectedForecastTemperature, setSelectedForecastTemperature] = useState<string>('50');
    const [proposalChanges, setProposalChanges] = useState<string>('');

    // Estados PABX
    const [pabxExtensions, setPabxExtensions] = useState<number>(0);
    const [pabxIncludeDevices, setPabxIncludeDevices] = useState<boolean>(false);
    const [pabxDeviceQuantity, setPabxDeviceQuantity] = useState<number>(0);
    const [pabxIncludeSetup, setPabxIncludeSetup] = useState<boolean>(true);
    const [pabxResult, setPabxResult] = useState<PABXResult | null>(null);

    // Estados Agente IA
    const [includeAIAgent, setIncludeAIAgent] = useState(false);
    const [selectedAIAgentPlan, setSelectedAIAgentPlan] = useState('');

    // Estados para DRE
    const [isEditingTaxes, setIsEditingTaxes] = useState<boolean>(false);
    const [taxRates, setTaxRates] = useState({
        banda: 2.09,
        fundraising: 0,
        rate: 24,
        pis: 15.00,
        cofins: 0.00,
        margem: 0.00,
        csll: 0.00,
        irpj: 0.00,
        custoDesp: 10
    });

    // Estados para descontos
    const [applySalespersonDiscount, setApplySalespersonDiscount] = useState<boolean>(false);
    const [appliedDirectorDiscountPercentage, setAppliedDirectorDiscountPercentage] = useState<number>(0);

    // Estados SIP
    const [selectedSipPlan, setSelectedSipPlan] = useState<string>('');
    const [sipAdditionalChannels, setSipAdditionalChannels] = useState<number>(0);
    const [sipWithEquipment, setSipWithEquipment] = useState<boolean>(false);
    const [sipIncludeSetup, setSipIncludeSetup] = useState<boolean>(true);
    const [sipResult, setSipResult] = useState<SIPResult | null>(null);

    const fetchProposals = React.useCallback(async () => {
        console.log('🔄 fetchProposals called at:', new Date().toISOString());
        console.log('👤 Current user:', currentUser ? { id: currentUser.id, role: currentUser.role } : 'null');

        if (!currentUser || !currentUser.role) {
            console.log('❌ User not found or no role - clearing proposals');
            setProposals([]);
            return;
        }

        try {
            console.log('🔍 Fetching VM proposals from API...');
            // Buscar TODAS as propostas para evitar IDs duplicados
            const response = await fetch('/api/simulator/proposals?type=VM&all=true', {
                method: 'GET',
                headers: getCRMAuthHeaders(),
            });
            console.log('📡 API response status:', response.status);

            if (response.ok) {
                const result = await response.json();
                
                if (result.success && result.data && result.data.proposals) {
                    const proposalsData = result.data.proposals;
                    console.log('✅ Raw proposals loaded:', proposalsData.length);

                    if (proposalsData.length > 0) {
                        console.log('📋 Sample proposal:', {
                            id: proposalsData[0].id,
                            baseId: proposalsData[0].base_id,
                            title: proposalsData[0].title,
                            type: proposalsData[0].type,
                            createdAt: proposalsData[0].created_at
                        });
                    }

                    // Filter for VM proposals (API já filtra por type=VM, mas vamos garantir)
                    const vmProposals = proposalsData.filter((p: any) =>
                        p.type === 'VM' || p.base_id?.startsWith('Prop_MV_')
                    );
                    
                    console.log('🔧 VM proposals after filter:', vmProposals.length);

                    if (vmProposals.length !== proposalsData.length) {
                        console.log('⚠️ Some proposals were filtered out');
                        console.log('📊 Filtered proposals by type:', proposalsData.reduce((acc: any, p: any) => {
                            acc[p.type] = (acc[p.type] || 0) + 1;
                            return acc;
                        }, {}));
                    }

                    setProposals(vmProposals);
                    console.log('✅ Proposals set in state:', vmProposals.length);
                } else {
                    console.error('❌ Formato de resposta inesperado:', result);
                    setProposals([]);
                }
            } else {
                console.error('❌ API error - Status:', response.status);
                const errorText = await response.text();
                console.error('❌ Error response:', errorText);
                setProposals([]);
            }
        } catch (error) {
            console.error("❌ Exception in fetchProposals:", error);
            setProposals([]);
        }
    }, [currentUser]);

    useEffect(() => {
        if (currentUser?.id) {
            fetchProposals();
        }
    }, [currentUser?.id, fetchProposals]);

    // 🔥 CORREÇÃO: useEffect para carregar descontos quando editar proposta
    useEffect(() => {
        if (currentProposal && addedProducts.length > 0) {
            console.log('🔍 MaquinasVirtuais - Carregando descontos da proposta:', currentProposal);
            const firstProduct = addedProducts[0];
            
            if (firstProduct?.details) {
                console.log('📦 Detalhes do produto:', firstProduct.details);
                
                // Carregar desconto do vendedor
                if (firstProduct.details.applySalespersonDiscount !== undefined) {
                    console.log('✅ Carregando applySalespersonDiscount:', firstProduct.details.applySalespersonDiscount);
                    setApplySalespersonDiscount(firstProduct.details.applySalespersonDiscount);
                }
                
                // Carregar desconto do diretor
                if (firstProduct.details.appliedDirectorDiscountPercentage !== undefined) {
                    console.log('✅ Carregando appliedDirectorDiscountPercentage:', firstProduct.details.appliedDirectorDiscountPercentage);
                    setAppliedDirectorDiscountPercentage(firstProduct.details.appliedDirectorDiscountPercentage);
                }
            }
        }
    }, [currentProposal, addedProducts]);

    useEffect(() => {
        if (!currentUser?.id) return;

        const loadSettings = async () => {
            try {
                // Force correct values - ignore localStorage for now to fix the 1412 issue
                // setMarkup will be calculated automatically based on DF, DV, ML
                setCommissionPercentage(3);
                setManagementAndSupportCost(49);
                setVcpuWindowsCost(20);
                setVcpuLinuxCost(20);
                setRamCost(7);
                setHddSasCost(0.2);
                setSsdPerformanceCost(0.35);
                console.log('SSD Performance Cost set to:', 0.35);

                // Force correct value after a small delay to ensure it's applied
                setTimeout(() => {
                    setSsdPerformanceCost(0.35);
                    console.log('SSD Performance Cost forced to:', 0.35);
                }, 100);

                // Additional force after 500ms
                setTimeout(() => {
                    setSsdPerformanceCost(0.35);
                    console.log('SSD Performance Cost final force to:', 0.35);
                }, 500);
                setNvmeCost(45);
                setNetwork1GbpsCost(0);
                setNetwork10GbpsCost(100);
                setWindowsServerCost(25);
                setWindows10ProCost(25);
                setWindows11ProCost(25);
                setUbuntuCost(0);
                setCentosCost(0);
                setDebianCost(0);
                setRockyLinuxCost(0);
                setAdditionalIpCost(38.5);
                setSnapshotCost(25);
                setVpnSiteToSiteCost(50);
                setPisCofins('15,00');
                setIss('0,00');
                setCsllIr('0,00');
                setVmQuantity(1);
                setContractDiscounts({
                    12: 0,
                    24: 5,
                    36: 10,
                    48: 15,
                    60: 20,
                });

                // Clear old localStorage to prevent conflicts
                localStorage.removeItem(`vmPricingSettings_${currentUser.id}`);
                // Force clear all VM related localStorage
                Object.keys(localStorage).forEach(key => {
                    if (key.includes('vmPricingSettings') || key.includes('vmTaxRates')) {
                        localStorage.removeItem(key);
                    }
                });

                // API fallback removed - using forced correct values
            } catch (error) {
                console.error("Erro ao buscar configurações de preço:", error);
            }
        };

        loadSettings();
    }, [currentUser?.id]);

    // Load tax rates from localStorage (only once)
    useEffect(() => {
        try {
            const savedTaxRates = localStorage.getItem('vmTaxRates');
            if (savedTaxRates) {
                const parsedRates = JSON.parse(savedTaxRates);
                if (parsedRates.pis && parsedRates.cofins && parsedRates.csll && parsedRates.irpj) {
                    setTaxRates(prevRates => ({ ...prevRates, ...parsedRates }));
                }
            }
        } catch (error) {
            console.error('Error loading tax rates from localStorage:', error);
        }
    }, []);

    // Estados para regime tributário
    const [selectedTaxRegime, setSelectedTaxRegime] = useState<string>('simples_nacional');
    const [pisCofins, setPisCofins] = useState<string>('15,00');
    const [iss, setIss] = useState<string>('0,00');
    const [csllIr, setCsllIr] = useState<string>('0,00');



    // Cálculo de impostos baseado nas taxas editáveis
    const revenueTaxes = useMemo(() => {
        // Apenas PIS + COFINS sobre receita
        const total = ((taxRates.pis || 15.00) + (taxRates.cofins || 0.00)) / 100;
        console.log('Revenue taxes calculation:', { pis: taxRates.pis || 15.00, cofins: taxRates.cofins || 0.00, total });
        return total;
    }, [taxRates.pis, taxRates.cofins]);

    const profitTaxes = useMemo(() => {
        // CSLL + IRPJ sobre lucro
        const total = (taxRates.csll + taxRates.irpj) / 100;
        console.log('Profit taxes calculation:', { csll: taxRates.csll, irpj: taxRates.irpj, total });
        return total;
    }, [taxRates.csll, taxRates.irpj]);

    // Estado para controle de abas
    const [activeTab, setActiveTab] = useState<string>('calculator');

    // Estados para configuração de VM
    const [vmName, setVmName] = useState<string>('Servidor Principal');
    const [vmCpuCores, setVmCpuCores] = useState<number>(2);
    const [vmRamGb, setVmRamGb] = useState<number>(4);
    const [vmStorageType, setVmStorageType] = useState<string>('HDD SAS');
    const [vmStorageSize, setVmStorageSize] = useState<number>(50);
    const [vmNetworkSpeed, setVmNetworkSpeed] = useState<string>('1 Gbps');
    const [vmOperatingSystem, setVmOperatingSystem] = useState<string>('Ubuntu Server 22.04 LTS');
    const [vmBackupSize, setVmBackupSize] = useState<number>(0);
    const [vmAdditionalIp, setVmAdditionalIp] = useState<boolean>(false);
    const [vmSnapshot, setVmSnapshot] = useState<boolean>(false);
    const [vmVpnSiteToSite, setVmVpnSiteToSite] = useState<boolean>(false);
    const [vmManagementSupport, setVmManagementSupport] = useState<boolean>(false);
    const [includeSetupFee, setIncludeSetupFee] = useState<boolean>(false);
    const [includeReferralPartner, setIncludeReferralPartner] = useState<boolean>(false);
    const [includeInfluencerPartner, setIncludeInfluencerPartner] = useState<boolean>(false);
    const [vmContractPeriod, setVmContractPeriod] = useState<number>(12);
    const [vmQuantity, setVmQuantity] = useState<number>(1);

    // Hook para comissões editáveis
    const { channelIndicator, channelInfluencer, channelSeller, seller, channelDirector } = useCommissions();

    // Estados para configurações de preço
    const [despesasFixas, setDespesasFixas] = useState<number>(15); // DF em %
    const [despesasVariaveis, setDespesasVariaveis] = useState<number>(0); // DV em %
    const [margemLiquidaDesejada, setMargemLiquidaDesejada] = useState<number>(31); // ML desejada em %
    const [markup, setMarkup] = useState<number>(10.42); // Será calculado automaticamente
    const [commissionPercentage, setCommissionPercentage] = useState<number>(3);
    const [setupFee, setSetupFee] = useState<number>(300);
    const [managementAndSupportCost, setManagementAndSupportCost] = useState<number>(49);
    const [contractDiscounts, setContractDiscounts] = useState<{ [key: number]: number }>({
        12: 0,
        24: 5,
        36: 10,
        48: 15,
        60: 20,
    });

    // Descontos
    const [directorDiscountPercentage, setDirectorDiscountPercentage] = useState<number>(0);

    // Cálculo do desconto contratual baseado no período
    const contractDiscount = useMemo(() => {
        return contractDiscounts[vmContractPeriod] || 0;
    }, [vmContractPeriod, contractDiscounts]);

    // Calcular Markup automaticamente baseado em DF, DV e ML
    useEffect(() => {
        // Fórmula: Markup = (DF + DV + ML) / (100 - DF - DV - ML) × 100
        const totalDespesasEMargem = despesasFixas + despesasVariaveis + margemLiquidaDesejada;
        const denominador = 100 - totalDespesasEMargem;

        console.log('Markup Calculation:', {
            despesasFixas,
            despesasVariaveis,
            margemLiquidaDesejada,
            totalDespesasEMargem,
            denominador
        });

        // Teste manual: DF=15, DV=0, ML=31 = 46, denominador = 54, markup = 46/54*100 = 85.18
        const testeManual = (15 + 0 + 31) / (100 - 15 - 0 - 31) * 100;
        console.log('Teste manual markup:', testeManual);

        if (denominador > 0 && totalDespesasEMargem >= 0) {
            const markupCalculado = (totalDespesasEMargem / denominador) * 100;
            console.log('Markup calculado:', markupCalculado);

            // Forçar markup correto temporariamente para debug
            if (markupCalculado < 10) {
                console.log('Markup muito baixo, forçando 85%');
                setMarkup(85);
            } else {
                setMarkup(markupCalculado);
            }
        } else {
            // Se o denominador for <= 0, significa que as despesas + margem >= 100%
            console.log('Denominador inválido, markup = 0');
            setMarkup(0);
        }
    }, [despesasFixas, despesasVariaveis, margemLiquidaDesejada]);

    // Função para calcular valor de venda de um item baseado no custo + markup
    const calculateSalePrice = useCallback((cost: number): number => {
        return cost * (1 + markup / 100);
    }, [markup]);

    // Detectar mudanças nos valores para mostrar botão de nova versão
    useEffect(() => {
        if (currentProposal?.id) {
            setHasChanged(true);
        }
    }, [addedProducts, clientData, accountManagerData, selectedTaxRegime, taxRates, setupFee, vmContractPeriod, vmQuantity, currentProposal?.id]);



    // Estados para custos de recursos VM
    const [vcpuWindowsCost, setVcpuWindowsCost] = useState<number>(20);
    const [vcpuLinuxCost, setVcpuLinuxCost] = useState<number>(20);
    const [ramCost, setRamCost] = useState<number>(7);
    const [hddSasCost, setHddSasCost] = useState<number>(0.2);
    const [ssdPerformanceCost, setSsdPerformanceCost] = useState<number>(0.35);
    const [nvmeCost, setNvmeCost] = useState<number>(45);
    const [network1GbpsCost, setNetwork1GbpsCost] = useState<number>(0);
    const [network10GbpsCost, setNetwork10GbpsCost] = useState<number>(100);
    const [windowsServerCost, setWindowsServerCost] = useState<number>(25);
    const [windows10ProCost, setWindows10ProCost] = useState<number>(25);
    const [windows11ProCost, setWindows11ProCost] = useState<number>(25);
    const [ubuntuCost, setUbuntuCost] = useState<number>(0);
    const [centosCost, setCentosCost] = useState<number>(0);
    const [debianCost, setDebianCost] = useState<number>(0);
    const [rockyLinuxCost, setRockyLinuxCost] = useState<number>(0);
    const [backupCostPerGb, setBackupCostPerGb] = useState<number>(0.35);
    const [additionalIpCost, setAdditionalIpCost] = useState<number>(38.5);
    const [snapshotCost, setSnapshotCost] = useState<number>(25);
    const [vpnSiteToSiteCost, setVpnSiteToSiteCost] = useState<number>(50);

    // Estados para controlar edição de cada card
    const [editingCards, setEditingCards] = useState<{ [key: string]: boolean }>({
        recursosBase: false,
        armazenamento: false,
        placaRede: false,
        sistemaOperacional: false,
        backup: false,
        ipAdicional: false,
        snapshot: false,
        vpnSiteToSite: false,
        prazosContratuais: false,
        taxaSetup: false,
        gestaoSuporte: false
    });

    // Função para alternar edição de um card específico
    const toggleCardEdit = (cardKey: string) => {
        setEditingCards(prev => ({
            ...prev,
            [cardKey]: !prev[cardKey]
        }));
    };

    // Função para salvar um card específico
    const saveCard = async (cardKey: string) => {
        try {
            await handleSaveSettings();
            setEditingCards(prev => ({
                ...prev,
                [cardKey]: false
            }));
        } catch (error) {
            console.error('Erro ao salvar card:', error);
        }
    };

    // Dados para as tabelas de List Price
    const pabxListPriceData = {
        headers: ['Serviço', 'Até 10 ramais', 'De 11 a 20 ramais', 'De 21 a 30 ramais', 'De 31 a 50 ramais', 'De 51 a 100 ramais', 'De 101 a 500 ramais', 'De 501 a 1.000 ramais'],
        rows: [
            { service: 'Setup (cobrança única)', values: ['1.250,00', '2.000,00', '2.500,00', '3.000,00', '3.500,00', 'Valor a combinar', 'Valor a combinar'] },
            { service: 'Valor por ramal (mensal unitário)', values: ['30,00', '29,00', '28,00', '27,00', '26,00', '25,00', '24,50'] },
            { service: 'Valor hospedagem (mensal)', values: ['200,00', '220,00', '250,00', '300,00', '400,00', 'Valor a combinar', 'Valor a combinar'] },
            { service: 'Aluguel Aparelho Grandstream (mensal)', values: ['35,00', '34,00', '33,00', '32,00', '30,00', 'Valor a combinar', 'Valor a combinar'] },
        ],
    };

    const sipListPriceData = {
        headers: {
            top: [
                { title: 'SIP TARIFADO', span: 2 },
                { title: 'SIP TARIFADO', span: 1 },
                { title: 'SIP TARIFADO', span: 1 },
                { title: 'SIP TARIFADO', span: 1 },
                { title: 'SIP TARIFADO', span: 1 },
                { title: 'SIP ILIMITADO', span: 1 },
                { title: 'SIP ILIMITADO', span: 1 },
                { title: 'SIP ILIMITADO', span: 1 },
                { title: 'SIP ILIMITADO', span: 1 },
                { title: 'SIP ILIMITADO', span: 1 }
            ],
            bottom: [
                'Call Center',
                '2 canais',
                '4 Canais',
                '10 Canais',
                '30 Canais',
                '60 Canais',
                '5 Canais',
                '10 Canais',
                '20 Canais',
                '30 Canais',
                '60 Canais'
            ]
        },
        rows: [
            {
                service: 'Canais Adicionais (Assinatura Mensal)',
                values: [
                    'Não Aplicável',
                    'Sem possibilidade',
                    'Sem possibilidade',
                    'Sem possibilidade',
                    'Sem possibilidade',
                    'Sem possibilidade',
                    'Até 5 canais R$ 30 por canal adicional',
                    'Até 5 canais R$ 30 por canal adicional',
                    'Até 5 canais R$ 30 por canal adicional',
                    'Até 5 canais R$ 30 por canal adicional',
                    ''
                ]
            },
            {
                service: 'Canais Adicionais (Franquia Mensal)',
                values: [
                    'Não Aplicável',
                    'Sem possibilidade',
                    '',
                    'Até 10 canais R$25 por canal adicional/mês',
                    'Até 20 canais R$ 25 por canal adicional/mês',
                    'Até 30 canais R$ 25 por canal adicional/mês',
                    '',
                    '',
                    '',
                    '',
                    'Sem possibilidade'
                ]
            },
            {
                service: 'Franquia/Assinatura Mensal (Sem Equipamentos)',
                values: [
                    'R$ 200 (Franquia)',
                    'R$ 150 (Franquia)',
                    'R$ 250 (Franquia)',
                    'R$ 350 (Franquia)',
                    'R$ 550 (Franquia)',
                    'R$ 1.000 (Franquia)',
                    'R$ 350 (Assinatura)',
                    'R$ 450 (Assinatura)',
                    'R$ 650 (Assinatura)',
                    'R$ 850 (Assinatura)',
                    'R$ 1.600 (Assinatura)'
                ]
            },
            {
                service: 'Franquia/Assinatura Mensal (Com Equipamentos)',
                values: [
                    'Não Aplicável',
                    'Sem possibilidade',
                    'R$ 500 (Franquia)',
                    'R$ 650 (Franquia)',
                    'R$ 1.200 (Franquia)',
                    '',
                    'R$ 500 (Assinatura)',
                    'R$ 600 (Assinatura)',
                    'R$ 800 (Assinatura)',
                    'R$ 950 (Assinatura)',
                    'R$ 1.700 (Assinatura)'
                ]
            },
            {
                service: 'Minutos Mensais Inclusos para Brasil Móvel',
                values: [
                    'Não Aplicável',
                    '',
                    'Não aplicável',
                    '',
                    '',
                    '',
                    '15.000 Minutos',
                    '20.000 Minutos',
                    '25.000 Minutos',
                    '30.000 Minutos',
                    '60.000 Minutos'
                ]
            },
            {
                service: 'Números Incluídos (Novos ou Portados)',
                values: [
                    'Consultar',
                    '',
                    'Máximo 3 Números',
                    '',
                    'Máximo 4 Números',
                    '',
                    'Máximo 5 Números',
                    'Máximo 10 Números',
                    'Máximo 15 Números',
                    'Máximo 20 Números',
                    'Máximo 30 Números'
                ]
            },
            {
                service: 'Numeração Adicional (Mensalidade)',
                values: [
                    'Consultar',
                    '',
                    'R$ 10 por Número',
                    '',
                    '',
                    '',
                    '',
                    '',
                    'R$ 10 por Número',
                    '',
                    ''
                ]
            },
            {
                service: 'Tarifa Local Fixo (por minuto)',
                values: [
                    'R$ 0,015 por minuto',
                    '',
                    'R$ 0,02 por minuto',
                    '',
                    '',
                    '',
                    '',
                    '',
                    'Ilimitado',
                    '',
                    ''
                ]
            },
            {
                service: 'Tarifa DDD Fixo (por minuto)',
                values: [
                    'R$ 0,05 por minuto',
                    '',
                    'R$ 0,06 por minuto',
                    '',
                    '',
                    '',
                    '',
                    '',
                    'Ilimitado',
                    '',
                    ''
                ]
            },
            {
                service: 'Tarifa Brasil Móvel (por minuto)',
                values: [
                    'R$ 0,09 por minuto',
                    '',
                    'R$ 0,10 por minuto',
                    '',
                    '',
                    '',
                    '',
                    '',
                    'R$ 10 por minuto',
                    '',
                    ''
                ]
            }
        ],
    };

    const aiAgentPlans: { [key: string]: { name: string; monthlyCost: number; messages: string; minutes: string; premiumVoice: string; credits: string; color: string } } = {
        plan20k: {
            name: '20K',
            monthlyCost: 720.00,
            credits: '20.000 Créditos de Interação',
            messages: '10.000 mensagens* ou',
            minutes: '2.000 minutos** ou',
            premiumVoice: '1.000 voz premium*** ou',
            color: 'bg-blue-900'
        },
        plan40k: {
            name: '40K',
            monthlyCost: 1370.00,
            credits: '40.000 Créditos de Interação',
            messages: '20.000 mensagens* ou',
            minutes: '4.000 minutos** ou',
            premiumVoice: '2.000 voz premium*** ou',
            color: 'bg-blue-800'
        },
        plan60k: {
            name: '60K',
            monthlyCost: 1940.00,
            credits: '60.000 Créditos de Interação',
            messages: '30.000 mensagens* ou',
            minutes: '6.000 minutos** ou',
            premiumVoice: '3.000 voz premium*** ou',
            color: 'bg-blue-600'
        },
        plan100k: {
            name: '100K',
            monthlyCost: 3060.00,
            credits: '100.000 Créditos de Interação',
            messages: '50.000 mensagens* ou',
            minutes: '10.000 minutos** ou',
            premiumVoice: '5.000 voz premium*** ou',
            color: 'bg-cyan-500'
        },
        plan150k: {
            name: '150K',
            monthlyCost: 4320.00,
            credits: '150.000 Créditos de Interação',
            messages: '75.000 mensagens* ou',
            minutes: '15.000 minutos** ou',
            premiumVoice: '7.500 voz premium*** ou',
            color: 'bg-teal-400'
        },
        plan200k: {
            name: '200K',
            monthlyCost: 5400.00,
            credits: '200.000 Créditos de Interação',
            messages: '100.000 mensagens* ou',
            minutes: '20.000 minutos** ou',
            premiumVoice: '10.000 voz premium*** ou',
            color: 'bg-teal-400'
        },
    };

    const pabxTiers: PABXTier[] = [
        { min: 1, max: 10, setup: 1250, monthly: 35 },
        { min: 11, max: 20, setup: 2000, monthly: 33 },
        { min: 21, max: 30, setup: 2500, monthly: 31 },
        { min: 31, max: 50, setup: 3000, monthly: 29 },
        { min: 51, max: 100, setup: 3500, monthly: 27 },
        { min: 101, max: 500, setup: 0, monthly: 25 }, // Valor a combinar
        { min: 501, max: 1000, setup: 0, monthly: 23 } // Valor a combinar
    ];

    const sipPlans: SIPPlan[] = [
        // Planos TARIFADO
        { name: 'SIP TARIFADO Call Center', type: 'TARIFADO', setup: 500, monthly: 200, channels: 0 },
        { name: 'SIP TARIFADO 2 Canais', type: 'TARIFADO', setup: 500, monthly: 150, channels: 2 },
        { name: 'SIP TARIFADO 4 Canais', type: 'TARIFADO', setup: 500, monthly: 250, monthlyWithEquipment: 500, channels: 4 },
        { name: 'SIP TARIFADO 10 Canais', type: 'TARIFADO', setup: 500, monthly: 350, monthlyWithEquipment: 500, channels: 10 },
        { name: 'SIP TARIFADO 30 Canais', type: 'TARIFADO', setup: 500, monthly: 550, monthlyWithEquipment: 650, channels: 30 },
        { name: 'SIP TARIFADO 60 Canais', type: 'TARIFADO', setup: 500, monthly: 1000, monthlyWithEquipment: 1200, channels: 60 },
        // Planos ILIMITADO
        { name: 'SIP ILIMITADO 5 Canais', type: 'PLANO', setup: 500, monthly: 350, monthlyWithEquipment: 500, channels: 5 },
        { name: 'SIP ILIMITADO 10 Canais', type: 'PLANO', setup: 500, monthly: 450, monthlyWithEquipment: 600, channels: 10 },
        { name: 'SIP ILIMITADO 20 Canais', type: 'PLANO', setup: 500, monthly: 650, monthlyWithEquipment: 800, channels: 20 },
        { name: 'SIP ILIMITADO 30 Canais', type: 'PLANO', setup: 500, monthly: 850, monthlyWithEquipment: 950, channels: 30 },
        { name: 'SIP ILIMITADO 60 Canais', type: 'PLANO', setup: 500, monthly: 1600, monthlyWithEquipment: 1700, channels: 60 },
    ];

    const costPerAdditionalChannel = 50;
    const equipmentRentalCost = 35;

    // Lógica de Cálculo
    const calculatePabxPrice = () => {
        if (pabxExtensions <= 0) {
            setPabxResult(null);
            return;
        }

        const tier = pabxTiers.find(t => pabxExtensions >= t.min && pabxExtensions <= t.max);
        if (!tier) {
            setPabxResult(null);
            return;
        }

        const setup = pabxIncludeSetup ? tier.setup : 0;
        const baseMonthly = tier.monthly * pabxExtensions;
        let deviceRentalCost = 0;
        let aiAgentCost = 0;

        if (pabxIncludeDevices) {
            deviceRentalCost = pabxDeviceQuantity * 35; // R$ 35 por dispositivo
        }

        if (includeAIAgent) {
            const plan = Object.values(aiAgentPlans).find(p => p.name === selectedAIAgentPlan);
            if (plan) {
                aiAgentCost = plan.monthlyCost;
            }
        }

        const totalMonthly = baseMonthly + deviceRentalCost + aiAgentCost;
        setPabxResult({ setup, baseMonthly, deviceRentalCost, aiAgentCost, totalMonthly });
    };

    const calculateSipPrice = () => {
        if (!selectedSipPlan) {
            setSipResult(null);
            return;
        }

        const plan = sipPlans.find(p => p.name === selectedSipPlan);
        if (plan) {
            let monthly = (sipWithEquipment && plan.monthlyWithEquipment) ? plan.monthlyWithEquipment : plan.monthly;
            let additionalChannelsCost = 0;

            if (plan.type === 'TARIFADO' && sipAdditionalChannels > 0) {
                additionalChannelsCost = sipAdditionalChannels * 20; // R$ 20 por canal adicional
                monthly += additionalChannelsCost;
            }

            const setup = sipIncludeSetup ? plan.setup : 0;
            setSipResult({ setup, monthly, additionalChannelsCost });
        } else {
            setSipResult(null);
        }
    };

    // Cálculos VM usando valores de venda (com markup já aplicado)
    const calculateVMSalePrice = useMemo(() => {
        let salePrice = 0;

        // Valor de venda de CPU baseado no SO
        if (vmOperatingSystem.includes('Windows')) {
            salePrice += vmCpuCores * calculateSalePrice(vcpuWindowsCost);
        } else {
            salePrice += vmCpuCores * calculateSalePrice(vcpuLinuxCost);
        }

        // Valor de venda de RAM
        salePrice += vmRamGb * calculateSalePrice(ramCost);

        // Valor de venda de Storage
        if (vmStorageType === 'HDD SAS') {
            salePrice += vmStorageSize * calculateSalePrice(hddSasCost);
        } else if (vmStorageType === 'SSD Performance') {
            salePrice += vmStorageSize * calculateSalePrice(ssdPerformanceCost);
        } else if (vmStorageType === 'NVMe') {
            salePrice += vmStorageSize * calculateSalePrice(nvmeCost);
        }

        // Valor de venda de Network
        if (vmNetworkSpeed === '10 Gbps') {
            salePrice += calculateSalePrice(network10GbpsCost);
        }

        // Valor de venda do Sistema Operacional (licenciamento adicional para Windows)
        if (vmOperatingSystem === 'Windows Server 2022 Standard') {
            salePrice += vmCpuCores * calculateSalePrice(windowsServerCost);
        } else if (vmOperatingSystem === 'Windows 10 Pro') {
            salePrice += vmCpuCores * calculateSalePrice(windows10ProCost);
        } else if (vmOperatingSystem === 'Windows 11 Pro') {
            salePrice += vmCpuCores * calculateSalePrice(windows11ProCost);
        }

        // Valores de venda dos serviços adicionais
        if (vmBackupSize > 0) {
            salePrice += vmBackupSize * calculateSalePrice(backupCostPerGb);
        }
        if (vmAdditionalIp) {
            salePrice += calculateSalePrice(additionalIpCost);
        }
        if (vmSnapshot) {
            salePrice += calculateSalePrice(snapshotCost);
        }
        if (vmVpnSiteToSite) {
            salePrice += calculateSalePrice(vpnSiteToSiteCost);
        }

        // Valor de venda de gestão e suporte (apenas se selecionado)
        if (vmManagementSupport) {
            salePrice += calculateSalePrice(managementAndSupportCost);
        }

        console.log('VM Sale Price Breakdown:', {
            cpuSalePrice: vmOperatingSystem.includes('Windows') ? vmCpuCores * calculateSalePrice(vcpuWindowsCost) : vmCpuCores * calculateSalePrice(vcpuLinuxCost),
            ramSalePrice: vmRamGb * calculateSalePrice(ramCost),
            storageSalePrice: vmStorageType === 'HDD SAS' ? vmStorageSize * calculateSalePrice(hddSasCost) : 0,
            windowsLicenseSalePrice: vmOperatingSystem === 'Windows Server 2022 Standard' ? vmCpuCores * calculateSalePrice(windowsServerCost) :
                vmOperatingSystem === 'Windows 10 Pro' ? vmCpuCores * calculateSalePrice(windows10ProCost) :
                    vmOperatingSystem === 'Windows 11 Pro' ? vmCpuCores * calculateSalePrice(windows11ProCost) : 0,
            managementSalePrice: vmManagementSupport ? calculateSalePrice(managementAndSupportCost) : 0,
            totalSalePrice: salePrice
        });

        return salePrice;
    }, [
        vmCpuCores, vmRamGb, vmStorageType, vmStorageSize, vmNetworkSpeed, vmOperatingSystem,
        vmBackupSize, vmAdditionalIp, vmSnapshot, vmVpnSiteToSite, vmManagementSupport,
        vcpuWindowsCost, vcpuLinuxCost, ramCost, hddSasCost, ssdPerformanceCost, nvmeCost,
        network10GbpsCost, windowsServerCost, windows10ProCost, windows11ProCost, backupCostPerGb,
        additionalIpCost, snapshotCost, vpnSiteToSiteCost, managementAndSupportCost, calculateSalePrice
    ]);

    // Função para obter taxa de comissão do Parceiro Indicador usando as tabelas editáveis
    const getReferralPartnerCommissionRate = useCallback((monthlyRevenue: number, contractMonths: number): number => {
        if (!channelIndicator || !includeReferralPartner) return 0;
        return getChannelIndicatorCommissionRate(channelIndicator, monthlyRevenue, contractMonths);
    }, [channelIndicator, includeReferralPartner]);

    // Função para obter taxa de comissão do Parceiro Influenciador usando as tabelas editáveis
    const getInfluencerPartnerCommissionRate = useCallback((monthlyRevenue: number, contractMonths: number): number => {
        if (!channelInfluencer || !includeInfluencerPartner) return 0;
        return getChannelInfluencerCommissionRate(channelInfluencer, monthlyRevenue, contractMonths);
    }, [channelInfluencer, includeInfluencerPartner]);

    // Cálculo simplificado usando valores de venda diretos
    const {
        vmFinalPrice,
        markupValue,
        commissionValue,
        estimatedNetMargin,
        realMarkupPercentage,
        costBreakdown
    } = useMemo(() => {
        // Usar o valor de venda calculado diretamente
        let baseSalePrice = calculateVMSalePrice;

        // Aplicar 20% de acréscimo se há parceiros (Indicador ou Influenciador)
        const temParceiros = includeReferralPartner || includeInfluencerPartner;
        console.log('DEBUG - MaquinasVirtuais:', {
            includeReferralPartner,
            includeInfluencerPartner,
            temParceiros,
            baseSalePriceBefore: baseSalePrice
        });

        if (temParceiros) {
            const originalValue = baseSalePrice;
            baseSalePrice = baseSalePrice * 1.20; // Acréscimo de 20%
            console.log('Acréscimo de 20% aplicado por parceiros - MaquinasVirtuais:', {
                original: originalValue,
                withIncrease: baseSalePrice
            });
        }

        // Aplicar descontos contratuais
        const contractDiscountAmount = baseSalePrice * (contractDiscount / 100);
        const priceAfterContractDiscount = baseSalePrice - contractDiscountAmount;

        // Aplicar desconto do diretor
        const directorDiscountAmount = priceAfterContractDiscount * (appliedDirectorDiscountPercentage / 100);
        const priceAfterDirectorDiscount = priceAfterContractDiscount - directorDiscountAmount;

        // Calcular comissões
        const calculatedCommissionValue = temParceiros
            ? (priceAfterDirectorDiscount * (getChannelSellerCommissionRate(channelSeller, vmContractPeriod) / 100))
            : (priceAfterDirectorDiscount * (getSellerCommissionRate(seller, vmContractPeriod) / 100));

        const calculatedReferralPartnerCommission = (() => {
            if (!includeReferralPartner) {
                return 0;
            }
            const monthlyRevenue = priceAfterDirectorDiscount;
            const commissionRate = getReferralPartnerCommissionRate(monthlyRevenue, vmContractPeriod);
            return monthlyRevenue * (commissionRate / 100);
        })();

	        const calculatedInfluencerPartnerCommission = (() => {
	            if (!includeInfluencerPartner) {
	                return 0;
	            }
	            const monthlyRevenue = priceAfterDirectorDiscount;
	            const commissionRate = getInfluencerPartnerCommissionRate(monthlyRevenue, vmContractPeriod);
	            return monthlyRevenue * (commissionRate / 100);
	        })();

	        // Comissão Diretor (conforme tabela Comissão Diretor e prazo contratual selecionado)
	        const calculatedDirectorCommission = channelDirector
	            ? (priceAfterDirectorDiscount * (getDirectorCommissionRate(channelDirector, vmContractPeriod) / 100))
	            : 0;

	        const finalPrice = priceAfterDirectorDiscount - calculatedReferralPartnerCommission - calculatedInfluencerPartnerCommission;

        console.log('Simplified Price Calculation:', {
            baseSalePrice,
            contractDiscount: contractDiscountAmount,
            directorDiscount: directorDiscountAmount,
            finalPrice,
            vmQuantity
        });

        // Cálculo simplificado de margens
	        const totalCommissions = calculatedCommissionValue + calculatedDirectorCommission + calculatedReferralPartnerCommission + calculatedInfluencerPartnerCommission;

        // Para fins de relatório, calcular custos base aproximados
        const estimatedBaseCost = baseSalePrice / (1 + markup / 100);
        const calculatedMarkupValue = baseSalePrice - estimatedBaseCost;

        const netProfit = finalPrice - estimatedBaseCost - totalCommissions;
        const calculatedNetMargin = finalPrice > 0 ? (netProfit / finalPrice) * 100 : 0;
        const realMarkupPercentage = estimatedBaseCost > 0 ? (calculatedMarkupValue / estimatedBaseCost) * 100 : 0;

        return {
            vmFinalPrice: Math.max(0, finalPrice) || 0,
            markupValue: Math.max(0, calculatedMarkupValue) || 0,
            commissionValue: Math.max(0, calculatedCommissionValue) || 0,
            estimatedNetMargin: calculatedNetMargin || 0,
            realMarkupPercentage: realMarkupPercentage || 0,
	            costBreakdown: {
                baseCost: estimatedBaseCost,
                taxAmount: 0,
                totalCostWithTaxes: estimatedBaseCost,
                markupAmount: calculatedMarkupValue,
                priceBeforeDiscounts: baseSalePrice,
                contractDiscount: {
                    percentage: contractDiscount,
                    amount: contractDiscountAmount
                },
                directorDiscount: {
                    percentage: appliedDirectorDiscountPercentage,
                    amount: directorDiscountAmount
                },
                finalPrice,
                grossRevenue: finalPrice,
                netRevenue: finalPrice,
                directCosts: estimatedBaseCost,
	                totalCommissions,
	                directorCommission: calculatedDirectorCommission,
	                profitAfterCommissions: netProfit,
	                totalCost: estimatedBaseCost + calculatedCommissionValue,
                grossProfit: finalPrice - estimatedBaseCost,
                netMargin: calculatedNetMargin,
                referralPartnerCommission: calculatedReferralPartnerCommission,
                influencerPartnerCommission: calculatedInfluencerPartnerCommission,
                netProfit,
                revenueTaxValue: 0,
                profitTaxValue: 0,
                commissionValue: calculatedCommissionValue,
                cost: estimatedBaseCost,
                setupFee: setupFee
            }
        };
    }, [calculateVMSalePrice, markup, contractDiscount, appliedDirectorDiscountPercentage, includeReferralPartner, includeInfluencerPartner, vmContractPeriod, channelSeller, channelDirector, seller, getInfluencerPartnerCommissionRate, getReferralPartnerCommissionRate, setupFee, vmQuantity]);





    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    // Funções de manipulação
    const handleAddVMProduct = () => {
        // Criar descrição completa incluindo serviços adicionais
        let description = `${vmQuantity}x ${vmName} - ${vmCpuCores} vCPU, ${vmRamGb}GB RAM, ${vmStorageSize}GB ${vmStorageType}, ${vmOperatingSystem}`;

        // Adicionar serviços adicionais na descrição
        const additionalServices = [];
        if (vmBackupSize > 0) additionalServices.push(`Backup ${vmBackupSize}GB`);
        if (vmAdditionalIp) additionalServices.push('IP Adicional');
        if (vmSnapshot) additionalServices.push('Snapshot');
        if (vmVpnSiteToSite) additionalServices.push('VPN Site-to-Site');
        if (vmManagementSupport) additionalServices.push('Gestão e Suporte');
        if (includeSetupFee) additionalServices.push('Taxa de Setup');

        if (additionalServices.length > 0) {
            description += ` - ${additionalServices.join(', ')}`;
        }

        const newProduct: Product = {
            id: Date.now().toString(),
            type: 'VM' as ProductType,
            description: description,
            setup: includeSetupFee ? setupFee * vmQuantity : 0, // Incluir apenas se selecionado
            monthly: vmFinalPrice * vmQuantity, // Multiplicar pela quantidade
            details: {
                quantity: vmQuantity, // Adicionar quantidade nos detalhes
                cpuCores: vmCpuCores,
                ramGb: vmRamGb,
                storageType: vmStorageType,
                storageSize: vmStorageSize,
                networkSpeed: vmNetworkSpeed,
                operatingSystem: vmOperatingSystem,
                backupSize: vmBackupSize,
                additionalIp: vmAdditionalIp,
                snapshot: vmSnapshot,
                vpnSiteToSite: vmVpnSiteToSite,
                managementSupport: vmManagementSupport,
                includeSetupFee: includeSetupFee,
                contractPeriod: vmContractPeriod,
                unitSetup: setupFee, // Valor unitário do setup
                unitMonthly: vmFinalPrice, // Valor unitário mensal
                applySalespersonDiscount,
                appliedDirectorDiscountPercentage,
                includeReferralPartner,
                includeInfluencerPartner
            }
        };
        setAddedProducts([...addedProducts, newProduct]);
    };

    const handleRemoveProduct = (productId: string) => {
        setAddedProducts(addedProducts.filter(p => p.id !== productId));
    };

    const handleTaxRegimeChange = (regime: string) => {
        setSelectedTaxRegime(regime);

        // Definir valores padrão para cada regime
        switch (regime) {
            case 'lucro_real':
                setPisCofins('3,65');
                setIss('5,00');
                setCsllIr('8,88');
                break;
            case 'lucro_presumido':
                setPisCofins('3,65');
                setIss('5,00');
                setCsllIr('4,80');
                break;
            case 'lucro_real_reduzido':
                setPisCofins('1,65');
                setIss('2,00');
                setCsllIr('4,80');
                break;
            case 'simples_nacional':
                setPisCofins('15,00');
                setIss('0,00');
                setCsllIr('0,00');
                break;
            default:
                break;
        }
    };

    const createNewProposal = () => {
        setCurrentProposal(null);
        setClientData({ name: '', contact: '', projectName: '', email: '', phone: '' });
        setAccountManagerData({ name: '', email: '', phone: '' });
        setAddedProducts([]);
        setSelectedStatus('Aguardando Aprovação do Cliente');
        setViewMode('client-form');
    };

    const editProposal = (proposal: Proposal) => {
        setCurrentProposal(proposal);

        // Handle client data - check if it's an object or string
        if (typeof proposal.client === 'object' && proposal.client !== null) {
            setClientData(proposal.client);
        } else if (typeof proposal.client === 'string') {
            setClientData({
                name: proposal.client,
                contact: proposal.clientData?.contact || '',
                projectName: proposal.clientData?.projectName || '',
                email: proposal.clientData?.email || '',
                phone: proposal.clientData?.phone || ''
            });
        } else if (proposal.clientData) {
            setClientData(proposal.clientData);
        }

        // Handle account manager data
        if (proposal.accountManager) {
            if (typeof proposal.accountManager === 'string') {
                // If accountManager is a string, try to get full data from metadata or create basic object
                setAccountManagerData({
                    name: proposal.accountManager,
                    email: proposal.metadata?.accountManagerEmail || '',
                    phone: proposal.metadata?.accountManagerPhone || ''
                });
            } else {
                setAccountManagerData(proposal.accountManager);
            }
        }

        // Handle products - check multiple possible locations and formats
        let products: Product[] = [];
        // Tentar em proposal.products, metadata.products, proposal.items
        if (proposal.products && Array.isArray(proposal.products) && proposal.products.length > 0) {
            products = proposal.products;
        } else if (proposal.metadata?.products && Array.isArray(proposal.metadata.products) && proposal.metadata.products.length > 0) {
            products = proposal.metadata.products;
        } else if (proposal.items && Array.isArray(proposal.items)) {
            // Convert items to products format if needed
            products = proposal.items.map((item: any) => ({
                id: item.id || `item-${Date.now()}`,
                type: 'VM',
                description: item.description || 'Máquina Virtual',
                setup: item.setup || 0,
                monthly: item.monthly || 0,
                details: item.details || {}
            }));
        }

        setAddedProducts(products);
        setSelectedStatus(proposal.status || 'Aguardando Aprovação do Cliente');
        setSelectedForecastTemperature(String((proposal as any).forecastTemperature ?? (proposal as any).metadata?.forecastTemperature ?? 50)); // Load the status
        setProposalChanges(proposal.changes || ''); // Load changes if available

        // Load contract period
        if (proposal.contractPeriod) {
            setVmContractPeriod(proposal.contractPeriod);
        }

        // Load VM specific data from the first product if available
        if (products && products.length > 0) {
            const firstProduct = products[0];
            if (firstProduct.details) {
                // Carregar configurações da VM
                if (firstProduct.details.cpuCores) setVmCpuCores(firstProduct.details.cpuCores);
                if (firstProduct.details.ramGb) setVmRamGb(firstProduct.details.ramGb);
                if (firstProduct.details.storageType) setVmStorageType(firstProduct.details.storageType);
                if (firstProduct.details.storageSize) setVmStorageSize(firstProduct.details.storageSize);
                if (firstProduct.details.networkSpeed) setVmNetworkSpeed(firstProduct.details.networkSpeed);
                if (firstProduct.details.operatingSystem) setVmOperatingSystem(firstProduct.details.operatingSystem);

                // Carregar serviços adicionais
                if (firstProduct.details.backupSize !== undefined) setVmBackupSize(firstProduct.details.backupSize);
                if (firstProduct.details.additionalIp !== undefined) setVmAdditionalIp(firstProduct.details.additionalIp);
                if (firstProduct.details.snapshot !== undefined) setVmSnapshot(firstProduct.details.snapshot);
                if (firstProduct.details.vpnSiteToSite !== undefined) setVmVpnSiteToSite(firstProduct.details.vpnSiteToSite);
                
                // 🔥 CORREÇÃO: Carregar descontos dos produtos (firstProduct.details)
                console.log('🔍 MaquinasVirtuais editProposal - Carregando descontos');
                if (firstProduct.details.applySalespersonDiscount !== undefined) {
                    console.log('✅ applySalespersonDiscount:', firstProduct.details.applySalespersonDiscount);
                    setApplySalespersonDiscount(firstProduct.details.applySalespersonDiscount);
                }
                if (firstProduct.details.appliedDirectorDiscountPercentage !== undefined) {
                    console.log('✅ appliedDirectorDiscountPercentage:', firstProduct.details.appliedDirectorDiscountPercentage);
                    setAppliedDirectorDiscountPercentage(firstProduct.details.appliedDirectorDiscountPercentage);
                }
            }
        }

        // FALLBACK: Load discount settings if available in proposal root
        if (proposal.applySalespersonDiscount !== undefined) {
            setApplySalespersonDiscount(proposal.applySalespersonDiscount);
        }
        if (proposal.appliedDirectorDiscountPercentage !== undefined) {
            setAppliedDirectorDiscountPercentage(proposal.appliedDirectorDiscountPercentage);
        }

        setViewMode('calculator');
    };

    useDeepLinkedProposal(initialProposalId, proposals, editProposal);

    const viewProposal = (proposal: Proposal) => {
        setCurrentProposal(proposal);

        // Handle client data - check if it's an object or string
        if (typeof proposal.client === 'object' && proposal.client !== null) {
            setClientData(proposal.client);
        } else if (typeof proposal.client === 'string') {
            setClientData({
                name: proposal.client,
                contact: proposal.clientData?.contact || '',
                projectName: proposal.clientData?.projectName || '',
                email: proposal.clientData?.email || '',
                phone: proposal.clientData?.phone || ''
            });
        } else if (proposal.clientData) {
            setClientData(proposal.clientData);
        }

        // Handle account manager data
        if (proposal.accountManager) {
            if (typeof proposal.accountManager === 'string') {
                // If accountManager is a string, try to get full data from metadata or create basic object
                setAccountManagerData({
                    name: proposal.accountManager,
                    email: proposal.metadata?.accountManagerEmail || '',
                    phone: proposal.metadata?.accountManagerPhone || ''
                });
            } else {
                setAccountManagerData(proposal.accountManager);
            }
        }

        // Handle products - check multiple possible locations and formats
        let products: Product[] = [];
        // Tentar em proposal.products, metadata.products, proposal.items
        if (proposal.products && Array.isArray(proposal.products) && proposal.products.length > 0) {
            products = proposal.products;
        } else if (proposal.metadata?.products && Array.isArray(proposal.metadata.products) && proposal.metadata.products.length > 0) {
            products = proposal.metadata.products;
        } else if (proposal.items && Array.isArray(proposal.items)) {
            // Convert items to products format if needed
            products = proposal.items.map((item: any) => ({
                id: item.id || `item-${Date.now()}`,
                type: 'VM',
                description: item.description || 'Máquina Virtual',
                setup: item.setup || 0,
                monthly: item.monthly || 0,
                details: item.details || {}
            }));
        }

        setAddedProducts(products);
        setSelectedStatus(proposal.status || 'Aguardando Aprovação do Cliente');
        setSelectedForecastTemperature(String((proposal as any).forecastTemperature ?? (proposal as any).metadata?.forecastTemperature ?? 50));
        setProposalChanges(proposal.changes || '');

        // Load contract period
        if (proposal.contractPeriod) {
            setVmContractPeriod(proposal.contractPeriod);
        }

        // Load VM specific data from the first product if available
        if (products && products.length > 0) {
            const firstProduct = products[0];
            if (firstProduct.details) {
                // Carregar configurações da VM
                if (firstProduct.details.cpuCores) setVmCpuCores(firstProduct.details.cpuCores);
                if (firstProduct.details.ramGb) setVmRamGb(firstProduct.details.ramGb);
                if (firstProduct.details.storageType) setVmStorageType(firstProduct.details.storageType);
                if (firstProduct.details.storageSize) setVmStorageSize(firstProduct.details.storageSize);
                if (firstProduct.details.networkSpeed) setVmNetworkSpeed(firstProduct.details.networkSpeed);
                if (firstProduct.details.operatingSystem) setVmOperatingSystem(firstProduct.details.operatingSystem);

                // Carregar serviços adicionais
                if (firstProduct.details.backupSize !== undefined) setVmBackupSize(firstProduct.details.backupSize);
                if (firstProduct.details.additionalIp !== undefined) setVmAdditionalIp(firstProduct.details.additionalIp);
                if (firstProduct.details.snapshot !== undefined) setVmSnapshot(firstProduct.details.snapshot);
                if (firstProduct.details.vpnSiteToSite !== undefined) setVmVpnSiteToSite(firstProduct.details.vpnSiteToSite);
            }
        }

        setViewMode('proposal-summary');
    };

    const deleteProposal = async (proposalId: string) => {
        if (!currentUser) {
            console.error('Usuário não autenticado');
            return;
        }

        if (window.confirm('Tem certeza que deseja excluir esta proposta?')) {
            try {
                const response = await fetch(`/api/simulator/proposals/${proposalId}`, {
                    method: 'DELETE',
                    headers: getCRMAuthHeaders(),
                });

                if (response.ok) {
                    fetchProposals();
                    if (currentProposal?.id === proposalId) {
                        setCurrentProposal(null);
                    }
                    toast.success('Proposta excluída com sucesso!');
                } else {
                    throw new Error('Erro ao excluir proposta');
                }
            } catch (error) {
                console.error('Erro ao excluir proposta:', error);
                toast.error('Falha ao excluir a proposta.');
            }
        }
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
                
                .proposal-view, .proposal-view * {
                    visibility: visible;
                }
                
                .proposal-view {
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

        // Add proposal-view class to the proposal summary
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

    const handleTaxRateChange = (taxType: keyof typeof taxRates, value: number) => {
        console.log(`Changing ${taxType} to ${value}`);

        // Ensure the value is a valid number and not negative
        const validValue = isNaN(value) || value < 0 ? 0 : value;

        const newTaxRates = { ...taxRates, [taxType]: validValue };
        console.log('New tax rates:', newTaxRates);
        setTaxRates(newTaxRates);

        // Save to localStorage
        localStorage.setItem('vmTaxRates', JSON.stringify(newTaxRates));
    };

    const handleSaveSettings = async () => {
        console.log('handleSaveSettings called');
        console.log('Current setupFee:', setupFee);
        console.log('Current managementAndSupportCost:', managementAndSupportCost);

        if (!currentUser) {
            toast.error('Você precisa estar logado para salvar as configurações.');
            return;
        }

        try {
            const settingsToSave = {
                markup,
                commissionPercentage,
                setupFee,
                managementAndSupportCost,
                vcpuWindowsCost,
                vcpuLinuxCost,
                ramCost,
                hddSasCost,
                ssdPerformanceCost,
                nvmeCost,
                network1GbpsCost,
                network10GbpsCost,
                windowsServerCost,
                windows10ProCost,
                windows11ProCost,
                ubuntuCost,
                centosCost,
                debianCost,
                rockyLinuxCost,
                backupCostPerGb,
                additionalIpCost,
                snapshotCost,
                vpnSiteToSiteCost,
                pisCofins: parseFloat(pisCofins.replace(',', '.')),
                iss: parseFloat(iss.replace(',', '.')),
                csllIr: parseFloat(csllIr.replace(',', '.')),
                contractDiscounts,
                taxRates,
                vmQuantity,
                updatedAt: new Date().toISOString(),
                userId: currentUser.id
            };

            console.log('Saving settings:', settingsToSave);
            console.log('setupFee in settingsToSave:', settingsToSave.setupFee);
            console.log('managementAndSupportCost in settingsToSave:', settingsToSave.managementAndSupportCost);
            console.log('ssdPerformanceCost in settingsToSave:', settingsToSave.ssdPerformanceCost);

            // Save to localStorage as fallback
            localStorage.setItem(`vmPricingSettings_${currentUser.id}`, JSON.stringify(settingsToSave));
            console.log('Saved to localStorage with key:', `vmPricingSettings_${currentUser.id}`);

            // Try to save via API
            const response = await fetch('/api/vm-settings', {
                method: 'POST',
                headers: getCRMAuthHeaders(),
                body: JSON.stringify(settingsToSave),
            });

            if (response.ok) {
                toast.success('Configurações salvas com sucesso!');
                setHasChanged(false);
            } else {
                // If API fails, at least we have localStorage
                console.warn('API save failed, but localStorage backup successful');
                toast.success('Configurações salvas localmente!');
            }
        } catch (error) {
            console.error("Erro ao salvar configurações:", error);
            // Try localStorage as fallback
            try {
                const settingsToSave = {
                    markup,
                    commissionPercentage,
                    setupFee,
                    managementAndSupportCost,
                    vcpuWindowsCost,
                    vcpuLinuxCost,
                    ramCost,
                    hddSasCost,
                    ssdPerformanceCost,
                    nvmeCost,
                    network1GbpsCost,
                    network10GbpsCost,
                    windowsServerCost,
                    windows10ProCost,
                    windows11ProCost,
                    ubuntuCost,
                    centosCost,
                    debianCost,
                    rockyLinuxCost,
                    backupCostPerGb,
                    additionalIpCost,
                    snapshotCost,
                    vpnSiteToSiteCost,
                    pisCofins: parseFloat(pisCofins.replace(',', '.')),
                    iss: parseFloat(iss.replace(',', '.')),
                    csllIr: parseFloat(csllIr.replace(',', '.')),
                    contractDiscounts,
                    taxRates,
                    updatedAt: new Date().toISOString(),
                    userId: currentUser.id
                };
                localStorage.setItem(`vmPricingSettings_${currentUser.id}`, JSON.stringify(settingsToSave));
                toast.success('Configurações salvas localmente!');
            } catch (localError) {
                console.error("Erro ao salvar no localStorage:", localError);
                toast.error('Falha ao salvar as configurações.');
            }
        }
    };

    // Funções para gerenciar propostas já implementadas acima

    // Função para determinar a versão baseada nos descontos aplicados
    const getProposalVersion = (): number => {
        if (appliedDirectorDiscountPercentage > 0) {
            return 3; // V3 para desconto do diretor
        } else if (applySalespersonDiscount) {
            return 2; // V2 para desconto do vendedor
        }
        return 1; // V1 versão base
    };

    // Função para aplicar descontos no total mensal
    const applyDiscounts = (baseTotal: number): number => {
        let discountedTotal = baseTotal;

        // Aplicar desconto do vendedor (5%)
        if (applySalespersonDiscount) {
            discountedTotal = discountedTotal * 0.95;
        }

        // Aplicar desconto do diretor (percentual configurado)
        if (appliedDirectorDiscountPercentage > 0) {
            const directorDiscountFactor = 1 - (appliedDirectorDiscountPercentage / 100);
            discountedTotal = discountedTotal * directorDiscountFactor;
        }

        return discountedTotal;
    };

    // Função para salvar proposta
    const saveProposal = async () => {
        if (!currentUser) {
            alert('Erro: Usuário não autenticado');
            return;
        }

        // Validar dados obrigatórios
        if (!clientData || !clientData.name) {
            alert('Por favor, preencha os dados do cliente antes de salvar.');
            return;
        }

        if (!accountManagerData || !accountManagerData.name) {
            alert('Por favor, preencha os dados do gerente de contas antes de salvar.');
            return;
        }

        if (addedProducts.length === 0) {
            alert('Por favor, adicione pelo menos um produto antes de salvar.');
            return;
        }

        try {
            const baseTotalMonthly = addedProducts.reduce((sum, p) => sum + p.monthly, 0);
            const totalSetup = addedProducts.reduce((sum, p) => sum + p.setup, 0);

            // Aplicar descontos no total mensal
            const finalTotalMonthly = applyDiscounts(baseTotalMonthly);
            const proposalVersion = getProposalVersion();

            // Se tiver uma proposta atual, atualiza (independente de ter descontos ou não)
            if (currentProposal?.id) {
                const proposalToUpdate = {
                    id: currentProposal.id,
                    title: `Proposta Máquinas Virtuais V${proposalVersion} - ${clientData.companyName || clientData.name || 'Cliente'}`,
                    client: clientData.companyName || clientData.name || 'Cliente não informado',
                    accountManager: accountManagerData.name || 'Gerente não informado',
                    value: finalTotalMonthly,
                    type: 'VM',
                    status: currentProposal.status || 'Rascunho',
                    forecastTemperature: Number(selectedForecastTemperature),
                    updatedBy: currentUser.email || currentUser.id,
                    updatedAt: new Date().toISOString(),
                    // Manter dados originais importantes
                    createdBy: currentProposal.createdBy || currentProposal.userId || currentUser.id,
                    createdAt: currentProposal.createdAt,
                    baseId: currentProposal.baseId || currentProposal.base_id,
                    version: proposalVersion,
                    // Atualizar dados editáveis
                    clientData: clientData,
                    products: addedProducts,
                    totalSetup: totalSetup,
                    totalMonthly: finalTotalMonthly,
                    contractPeriod: vmContractPeriod,
                    baseTotalMonthly: baseTotalMonthly,
                    applySalespersonDiscount: applySalespersonDiscount,
                    appliedDirectorDiscountPercentage: appliedDirectorDiscountPercentage,
                    userId: currentUser.id,
                    metadata: {
                        accountManagerEmail: accountManagerData.email,
                        accountManagerPhone: accountManagerData.phone,
                        fullAccountManagerData: accountManagerData
                    }
                };

                const response = await fetch(`/api/simulator/proposals/${currentProposal.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(proposalToUpdate),
                });

                if (!response.ok) {
                    throw new Error('Erro ao atualizar proposta');
                }
                const result = await response.json();
                const updatedProposal = result.data || result;
                toast.success(`Proposta ${updatedProposal.base_id || updatedProposal.id} atualizada com sucesso!`);
                setCurrentProposal(updatedProposal);
            } else {
                // Criar nova proposta
                // Mapear propostas para o formato esperado pelo gerador
                const proposalsWithBaseId = proposals.map((p: any) => ({
                    base_id: p.base_id || p.baseId || ''
                }));
                
                // Gerar ID único para a proposta
                const baseId = generateNextProposalId(proposalsWithBaseId, 'VM', proposalVersion);
                console.log('🆔 ID gerado para nova proposta VM:', baseId);

                // Preparar dados da proposta com descontos salvos no metadata
                const proposalToSave = {
                    base_id: baseId,
                    title: `Proposta Máquinas Virtuais V${proposalVersion} - ${clientData.companyName || clientData.name || 'Cliente'}`,
                    client: clientData.companyName || clientData.name || 'Cliente não informado',
                    accountManager: accountManagerData.name || 'Gerente não informado',
                    value: finalTotalMonthly,
                    type: 'VM',
                    status: 'Rascunho',
                forecastTemperature: Number(selectedForecastTemperature),
                    createdBy: currentUser.email || currentUser.id,
                    createdAt: new Date().toISOString(),
                    version: proposalVersion,
                    // Dados principais da proposta
                    clientData: clientData,
                    products: addedProducts,
                    totalSetup: totalSetup,
                    totalMonthly: finalTotalMonthly,
                    contractPeriod: vmContractPeriod,
                    userId: currentUser.id,
                    // Salvar descontos e informações adicionais no metadata
                    metadata: {
                        baseTotalMonthly: baseTotalMonthly,
                        applySalespersonDiscount: applySalespersonDiscount,
                        appliedDirectorDiscountPercentage: appliedDirectorDiscountPercentage,
                        accountManagerEmail: accountManagerData.email,
                        accountManagerPhone: accountManagerData.phone,
                        fullAccountManagerData: accountManagerData
                    }
                };

                const response = await fetch('/api/simulator/proposals', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(proposalToSave),
                });

                if (!response.ok) {
                    throw new Error('Erro ao salvar proposta');
                }
                const result = await response.json();
                const savedProposal = result.data || result;
                toast.success(`Proposta ${savedProposal.base_id || savedProposal.id} salva com sucesso!`);
                setCurrentProposal(savedProposal);
                setProposals(prev => [savedProposal, ...prev]);
                // Atualizar lista de propostas
                fetchProposals();
            }
        } catch (error) {
            console.error('Erro ao salvar proposta:', error);
            alert('Erro ao salvar proposta. Por favor, tente novamente.');
        }
    };

    /**
     * Função para salvar proposta com duas opções:
     * 1. Atualizar proposta existente (saveAsNewVersion = false)
     * 2. Criar nova versão da proposta (saveAsNewVersion = true)
     * 
     * IMPORTANTE: Os descontos são sempre salvos no metadata da proposta
     */
    const handleSave = async (proposalId?: string, saveAsNewVersion: boolean = false) => {
        if (!currentUser?.id) {
            alert('Usuário não autenticado');
            return;
        }

        // Validar dados obrigatórios
        if (!clientData || !clientData.name) {
            alert('Por favor, preencha os dados do cliente antes de salvar.');
            return;
        }

        if (!accountManagerData || !accountManagerData.name) {
            alert('Por favor, preencha os dados do gerente de contas antes de salvar.');
            return;
        }

        if (addedProducts.length === 0) {
            alert('Por favor, adicione pelo menos um produto antes de salvar.');
            return;
        }

        // Debug: Verificar parâmetros recebidos
        console.log('🔍 handleSave VM chamado com:', {
            proposalId,
            saveAsNewVersion,
            currentProposalId: currentProposal?.id,
            currentProposalBaseId: currentProposal?.baseId || currentProposal?.base_id
        });

        try {
            setSaving(true);

            // Calcular totais com e sem descontos
            const baseTotalMonthly = addedProducts.reduce((sum, p) => sum + p.monthly, 0);
            const calculatedTotalSetup = addedProducts.reduce((sum, p) => sum + p.setup, 0);
            const finalTotalMonthly = applyDiscounts(baseTotalMonthly);

            // IMPORTANTE: Verificar ATUALIZAR primeiro, depois NOVA VERSÃO
            if (saveAsNewVersion === false && currentProposal?.id) {
                // ATUALIZAR PROPOSTA EXISTENTE - Atualiza o mesmo registro no banco
                console.log('🔄 Atualizando proposta VM existente:', currentProposal.id);
                console.log('📋 Dados da proposta atual:', {
                    id: currentProposal.id,
                    baseId: currentProposal.baseId || currentProposal.base_id,
                    version: currentProposal.version
                });
                
                // 🔥 CORREÇÃO: Atualizar produtos com descontos atuais ANTES de salvar
                console.log('🔄 Atualizando produtos com descontos atuais...');
                const updatedProducts = addedProducts.map(product => ({
                    ...product,
                    details: {
                        ...product.details,
                        applySalespersonDiscount: applySalespersonDiscount,
                        appliedDirectorDiscountPercentage: appliedDirectorDiscountPercentage
                    }
                }));
                console.log('✅ Produtos atualizados:', updatedProducts);
                
                const proposalToUpdate = {
                    title: `Proposta VM - ${clientData?.name || 'Cliente'}`,
                    client: clientData?.name || '',
                    value: finalTotalMonthly,
                    status: selectedStatus,
                    forecastTemperature: Number(selectedForecastTemperature),
                    accountManager: accountManagerData?.name || '',
                    totalSetup: calculatedTotalSetup,
                    totalMonthly: finalTotalMonthly,
                    contractPeriod: vmContractPeriod,
                    clientData: clientData,
                    products: updatedProducts, // 🔥 Usar produtos atualizados
                    items: updatedProducts, // 🔥 Usar produtos atualizados
                    applySalespersonDiscount: applySalespersonDiscount, // 🔥 Salvar no root também
                    appliedDirectorDiscountPercentage: appliedDirectorDiscountPercentage, // 🔥 Salvar no root também
                    baseTotalMonthly: baseTotalMonthly, // 🔥 Salvar no root também
                    // Salvar descontos no metadata
                    metadata: {
                        baseTotalMonthly: baseTotalMonthly,
                        applySalespersonDiscount: applySalespersonDiscount,
                        appliedDirectorDiscountPercentage: appliedDirectorDiscountPercentage,
                        changes: proposalChanges,
                        forecastTemperature: Number(selectedForecastTemperature),
                        accountManagerEmail: accountManagerData.email,
                        accountManagerPhone: accountManagerData.phone
                    }
                };

                console.log('📤 Enviando atualização para API:', proposalToUpdate);

                const response = await fetch(`/api/simulator/proposals/${currentProposal.id}`, {
                    method: 'PUT',
                    headers: getCRMAuthHeaders(),
                    body: JSON.stringify(proposalToUpdate),
                });

                if (response.ok) {
                    const result = await response.json();
                    const updatedProposal = result.data || result;
                    console.log('✅ Proposta atualizada:', updatedProposal);
                    alert('Proposta atualizada com sucesso!');
                    setCurrentProposal(updatedProposal);
                    await fetchProposals(); // 🔥 Recarregar propostas
                    setViewMode('search'); // 🔥 Redirecionar para buscar propostas
                    setHasChanged(false);
                } else {
                    throw new Error('Erro ao atualizar proposta');
                }
            } else if (saveAsNewVersion === true && currentProposal) {
                // CRIAR NOVA VERSÃO - Sempre cria um novo registro no banco
                console.log('📝 Criando nova versão da proposta VM:', currentProposal.baseId || currentProposal.base_id);
                
                // 🔥 CORREÇÃO: Atualizar produtos com descontos atuais ANTES de salvar
                console.log('🔄 Atualizando produtos com descontos atuais...');
                const updatedProducts = addedProducts.map(product => ({
                    ...product,
                    details: {
                        ...product.details,
                        applySalespersonDiscount: applySalespersonDiscount,
                        appliedDirectorDiscountPercentage: appliedDirectorDiscountPercentage
                    }
                }));
                console.log('✅ Produtos atualizados:', updatedProducts);
                
                const baseIdToUse = currentProposal.baseId || currentProposal.base_id;
                if (!baseIdToUse) {
                    alert('Proposta atual não possui ID base válido');
                    setSaving(false);
                    return;
                }
                
                const { generateNewVersion } = await import('@/lib/proposal-id-generator');
                const proposalsWithBaseId = proposals.map((p: any) => ({
                    base_id: p.base_id || p.baseId || ''
                }));
                const newBaseId = generateNewVersion(baseIdToUse, proposalsWithBaseId);
                const version = parseInt(newBaseId.match(/_v(\d+)$/)?.[1] || '1');
                
                const proposalData = {
                    base_id: newBaseId,
                    title: `Proposta VM V${version} - ${clientData?.name || 'Cliente'}`,
                    client: clientData?.name || '',
                    type: 'VM',
                    value: finalTotalMonthly,
                    status: selectedStatus,
                    forecastTemperature: Number(selectedForecastTemperature),
                    createdBy: currentUser.id,
                    accountManager: accountManagerData?.name || '',
                    date: new Date().toISOString().split('T')[0],
                    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    totalSetup: calculatedTotalSetup,
                    totalMonthly: finalTotalMonthly,
                    contractPeriod: vmContractPeriod,
                    version: version,
                    clientData: clientData,
                    products: updatedProducts, // 🔥 Usar produtos atualizados
                    items: updatedProducts, // 🔥 Usar produtos atualizados
                    applySalespersonDiscount: applySalespersonDiscount, // 🔥 Salvar no root também
                    appliedDirectorDiscountPercentage: appliedDirectorDiscountPercentage, // 🔥 Salvar no root também
                    baseTotalMonthly: baseTotalMonthly, // 🔥 Salvar no root também
                    // Salvar descontos no metadata
                    metadata: {
                        baseTotalMonthly: baseTotalMonthly,
                        applySalespersonDiscount: applySalespersonDiscount,
                        appliedDirectorDiscountPercentage: appliedDirectorDiscountPercentage,
                        changes: proposalChanges,
                        forecastTemperature: Number(selectedForecastTemperature),
                        accountManagerEmail: accountManagerData.email,
                        accountManagerPhone: accountManagerData.phone
                    }
                };

                console.log('📤 Enviando nova versão para API:', proposalData);

                const response = await fetch('/api/simulator/proposals', {
                    method: 'POST',
                    headers: getCRMAuthHeaders(),
                    body: JSON.stringify(proposalData),
                });

                if (response.ok) {
                    const result = await response.json();
                    const newProposal = result.data || result;
                    console.log('✅ Nova versão criada:', newProposal);
                    alert(`Nova versão criada com sucesso! ID: ${newProposal.base_id || newProposal.baseId}`);
                    setCurrentProposal(newProposal);
                    await fetchProposals(); // 🔥 Recarregar propostas
                    setViewMode('search'); // 🔥 Redirecionar para buscar propostas
                    setHasChanged(false);
                } else {
                    throw new Error('Erro ao criar nova versão');
                }
            } else {
                // Criar nova proposta (primeira vez)
                await saveProposal();
            }
        } catch (error) {
            console.error('Erro ao salvar proposta:', error);
            alert('Erro ao salvar proposta. Tente novamente.');
        } finally {
            setSaving(false);
        }
    };

    // Tela de resumo da proposta (visualização / impressão)
    if (viewMode === 'proposal-summary' && currentProposal) {
        return (
            <div className="p-4 md:p-8">
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
                        {/* Dados do Cliente, Projeto e Gerente */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:gap-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-3">Dados do Cliente</h3>
                                <div className="space-y-2 text-sm">
                                    <p><strong>Nome:</strong> {
                                        typeof currentProposal.client === 'object' && currentProposal.client?.name
                                            ? currentProposal.client.name
                                            : (currentProposal.clientData?.name || currentProposal.metadata?.clientData?.name) ||
                                            (typeof currentProposal.client === 'string' ? currentProposal.client : 'N/A')
                                    }</p>
                                    <p><strong>Email:</strong> {
                                        typeof currentProposal.client === 'object' && currentProposal.client?.email
                                            ? currentProposal.client.email
                                            : (currentProposal.clientData?.email || currentProposal.metadata?.clientData?.email) || 'N/A'
                                    }</p>
                                    <p><strong>Telefone:</strong> {
                                        typeof currentProposal.client === 'object' && currentProposal.client?.phone
                                            ? currentProposal.client.phone
                                            : (currentProposal.clientData?.phone || currentProposal.metadata?.clientData?.phone) || 'N/A'
                                    }</p>
                                    <p><strong>Contato:</strong> {
                                        typeof currentProposal.client === 'object' && currentProposal.client?.contact
                                            ? currentProposal.client.contact
                                            : (currentProposal.clientData?.contact || currentProposal.metadata?.clientData?.contact) || 'N/A'
                                    }</p>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-3">Nome do Projeto</h3>
                                <div className="space-y-2 text-sm">
                                    <p className="font-medium text-base">{
                                        typeof currentProposal.client === 'object' && currentProposal.client?.projectName
                                            ? currentProposal.client.projectName
                                            : (currentProposal.clientData?.projectName || currentProposal.metadata?.clientData?.projectName) || 'Projeto não informado'
                                    }</p>
                                    <p className="text-gray-600 text-xs mt-2">
                                        <strong>ID da Proposta:</strong> {currentProposal.baseId || currentProposal.id}
                                    </p>
                                    <p className="text-gray-600 text-xs">
                                        <strong>Versão:</strong> v{currentProposal.version || 1}
                                    </p>
                                    <p className="text-gray-600 text-xs">
                                        <strong>Período do Contrato:</strong> {currentProposal.contractPeriod ? `${currentProposal.contractPeriod} meses` : 'N/A'}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-3">Gerente de Contas</h3>
                                <div className="space-y-2 text-sm">
                                    <p><strong>Nome:</strong> {currentProposal.accountManager?.name || 'N/A'}</p>
                                    <p><strong>Email:</strong> {currentProposal.accountManager?.email || 'N/A'}</p>
                                    <p><strong>Telefone:</strong> {currentProposal.accountManager?.phone || 'N/A'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Produtos e Serviços */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">Produtos e Serviços</h3>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-gray-900">Descrição</TableHead>
                                        <TableHead className="text-gray-900">Setup</TableHead>
                                        <TableHead className="text-gray-900">Mensal/VM</TableHead>
                                        <TableHead className="text-gray-900">Mensal Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(currentProposal.products ?? []).map((product, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{product.description}</TableCell>
                                            <TableCell>{formatCurrency(product.setup)}</TableCell>
                                            <TableCell>
                                                {product.details?.unitMonthly ? formatCurrency(product.details.unitMonthly) :
                                                    (product.details?.quantity ? formatCurrency(product.monthly / product.details.quantity) : formatCurrency(product.monthly))}
                                            </TableCell>
                                            <TableCell>{formatCurrency(product.monthly)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Histórico de Descontos Aplicados - Logo após produtos */}
                        {((currentProposal.applySalespersonDiscount ?? currentProposal.metadata?.applySalespersonDiscount) || ((currentProposal.appliedDirectorDiscountPercentage ?? currentProposal.metadata?.appliedDirectorDiscountPercentage) || 0) > 0) && (
                            <div className="border-t pt-4 print:pt-2">
                                <div className="p-4 bg-orange-50 border border-orange-300 rounded">
                                    <h4 className="font-semibold text-orange-800 mb-3 flex items-center">
                                        📋 Histórico de Descontos Aplicados
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="mb-2"><strong>Versão:</strong> <span className="text-orange-600 font-semibold">v{currentProposal.version || 1}</span></p>
                                            {(currentProposal.applySalespersonDiscount ?? currentProposal.metadata?.applySalespersonDiscount) && (
                                                <p className="mb-2"><strong>Desconto Vendedor:</strong> <span className="text-orange-600 font-semibold">5%</span></p>
                                            )}
                                            {((currentProposal.appliedDirectorDiscountPercentage ?? currentProposal.metadata?.appliedDirectorDiscountPercentage) || 0) > 0 && (
                                                <p className="mb-2"><strong>Desconto Diretor:</strong> <span className="text-orange-600 font-semibold">{(currentProposal.appliedDirectorDiscountPercentage ?? currentProposal.metadata?.appliedDirectorDiscountPercentage) || 0}%</span></p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p><strong>Data de Criação:</strong></p>
                                            <p className="text-orange-600 font-semibold">
                                                {(() => {
                                                    try {
                                                        const date = currentProposal.createdAt;
                                                        if (!date) return 'N/A';
                                                        if (typeof date === 'string') {
                                                            return new Date(date).toLocaleDateString('pt-BR');
                                                        }
                                                        if (date.toDate && typeof date.toDate === 'function') {
                                                            return date.toDate().toLocaleDateString('pt-BR');
                                                        }
                                                        return new Date(date).toLocaleDateString('pt-BR');
                                                    } catch (e) {
                                                        return 'N/A';
                                                    }
                                                })()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Resumo Financeiro */}
                        <div className="border-t pt-4 print:pt-2">
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">Resumo Financeiro</h3>
                            
                            {/* Descontos Aplicados - Valores detalhados */}
                            {((currentProposal.applySalespersonDiscount ?? currentProposal.metadata?.applySalespersonDiscount) || ((currentProposal.appliedDirectorDiscountPercentage ?? currentProposal.metadata?.appliedDirectorDiscountPercentage) || 0) > 0) && (
                                <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded">
                                    <h4 className="font-semibold text-amber-800 mb-3 flex items-center">
                                        💰 Descontos Aplicados
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span><strong>Valor Original (Mensal):</strong></span>
                                            <span className="font-semibold">{formatCurrency(currentProposal.baseTotalMonthly || currentProposal.metadata?.baseTotalMonthly || currentProposal.totalMonthly || currentProposal.metadata?.totalMonthly || 0)}</span>
                                        </div>
                                        
                                        {(currentProposal.applySalespersonDiscount ?? currentProposal.metadata?.applySalespersonDiscount) && (
                                            <div className="flex justify-between text-orange-700">
                                                <span><strong>Desconto Vendedor (5%):</strong></span>
                                                <span className="font-semibold">-{formatCurrency(((currentProposal.baseTotalMonthly || currentProposal.metadata?.baseTotalMonthly || currentProposal.totalMonthly || currentProposal.metadata?.totalMonthly || 0) * 0.05))}</span>
                                            </div>
                                        )}

                                        {((currentProposal.appliedDirectorDiscountPercentage ?? currentProposal.metadata?.appliedDirectorDiscountPercentage) || 0) > 0 && (
                                            <div className="flex justify-between text-orange-700">
                                                <span><strong>Desconto Diretor ({(currentProposal.appliedDirectorDiscountPercentage ?? currentProposal.metadata?.appliedDirectorDiscountPercentage) || 0}%) - Apenas Mensal:</strong></span>
                                                <span className="font-semibold">-{formatCurrency((((currentProposal.baseTotalMonthly || currentProposal.metadata?.baseTotalMonthly || currentProposal.totalMonthly || currentProposal.metadata?.totalMonthly || 0) * (currentProposal.applySalespersonDiscount ? 0.95 : 1)) * ((currentProposal.appliedDirectorDiscountPercentage || 0) / 100)))}</span>
                                            </div>
                                        )}
                                        
                                        <div className="pt-2 mt-2 border-t border-amber-300">
                                            <div className="flex justify-between font-semibold">
                                                <span>Valor Final (Mensal com desconto):</span>
                                                <span className="text-green-700">{formatCurrency(currentProposal.totalMonthly || 0)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p><strong>Total Setup:</strong> {formatCurrency(currentProposal.totalSetup)}</p>
                                    <p><strong>Total Mensal:</strong> {formatCurrency(currentProposal.totalMonthly)}</p>
                                    <p><strong>Período do Contrato:</strong> {currentProposal.contractPeriod || 12} meses</p>
                                    <p><strong>Total do Contrato:</strong> {formatCurrency((currentProposal.totalMonthly || 0) * (currentProposal.contractPeriod || 12))}</p>
                                </div>
                                <div>
                                    <p><strong>Data da Proposta:</strong> {currentProposal.createdAt ? (
                                        (typeof currentProposal.createdAt === 'object' && 'toDate' in currentProposal.createdAt)
                                            ? new Date(currentProposal.createdAt.toDate()).toLocaleDateString('pt-BR')
                                            : (isNaN(new Date(currentProposal.createdAt).getTime()) ? 'N/A' : new Date(currentProposal.createdAt).toLocaleDateString('pt-BR'))
                                    ) : 'N/A'}</p>
                                    <p><strong>Status:</strong> {currentProposal.status}</p>
                                    <ProposalApprovalInfo proposal={currentProposal} className="text-gray-700 text-xs" />
                                    <p><strong>Data de Validade:</strong> {currentProposal.expiryDate ? new Date(currentProposal.expiryDate).toLocaleDateString('pt-BR') : 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <>
            <div className="p-4 md:p-8 print-hide">
                {viewMode === 'search' ? (
                    <Card className="bg-slate-900/80 border-slate-800 text-white">
                        <CardHeader>
                            <Button
                                variant="outline"
                                onClick={() => setViewMode('calculator')}
                                className="flex items-center mb-4 border-slate-600 text-slate-300 hover:bg-slate-700"
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Voltar
                            </Button>
                            <CardTitle>Buscar Propostas</CardTitle>
                            <CardDescription>Encontre propostas existentes ou crie uma nova.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-between items-center mb-4">
                                <Input
                                    type="text"
                                    placeholder="Buscar por cliente..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="max-w-sm bg-slate-800 border-slate-700 text-white"
                                />
                                <Button onClick={createNewProposal} className="bg-blue-600 hover:bg-blue-700">
                                    <PlusCircle className="mr-2 h-4 w-4" /> Nova Proposta
                                </Button>
                            </div>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-slate-700">
                                            <TableHead className="text-white">ID</TableHead>
                                            <TableHead className="text-white">Cliente</TableHead>
                                            <TableHead className="text-white">Nome do Projeto</TableHead>
                                            <TableHead className="text-white">Data</TableHead>
                                            <TableHead className="text-white">Total Mensal</TableHead>
                                            <TableHead className="text-white">Status</TableHead>
                                            <TableHead className="text-white">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(filteredProposals ?? []).length === 0 ? (
                                            <TableRow key="no-proposals-found">
                                                <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                                                    No proposal found. Click on &quot;New Proposal&quot; to start.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredProposals.map((p: Proposal) => (
                                                <TableRow key={p.id} className="border-slate-800">
                                                    <TableCell>{p.baseId || p.id}</TableCell>
                                                    <TableCell>{typeof p.client === 'string' ? p.client : p.client?.name || 'Sem nome'} (v{p.version})</TableCell>
                                                    <TableCell>{
                                                        typeof p.client === 'object' && p.client?.projectName
                                                            ? p.client.projectName
                                                            : p.clientData?.projectName || 'Projeto não informado'
                                                    }</TableCell>
                                                    <TableCell>{p.createdAt ? (
                                                        (typeof p.createdAt === 'object' && 'toDate' in p.createdAt)
                                                            ? new Date(p.createdAt.toDate()).toLocaleDateString('pt-BR')
                                                            : (isNaN(new Date(p.createdAt).getTime()) ? 'N/A' : new Date(p.createdAt).toLocaleDateString('pt-BR'))
                                                    ) : 'N/A'}</TableCell>
                                                    <TableCell>{formatCurrency(p.totalMonthly)}</TableCell>
                                                    <TableCell>
                                                        <ProposalStatusBadge status={p.status} />
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="border-slate-600 text-slate-300 hover:bg-slate-700"
                                                                onClick={() => viewProposal(p)}
                                                            >
                                                                <FilePenLine className="h-4 w-4 mr-2" /> Visualizar
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="border-blue-600 text-blue-300 hover:bg-blue-700"
                                                                onClick={() => editProposal(p)}
                                                            >
                                                                <Edit className="h-4 w-4 mr-2" /> Editar
                                                            </Button>
                                                            <ConvertToB2BOpportunityButton proposal={p} />
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => deleteProposal(p.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h1 className="text-3xl font-bold text-white">Calculadora de Máquinas Virtuais</h1>
                                    <p className="text-slate-400 mt-2">Configure e calcule os custos para VMs na nuvem</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setViewMode('search')}
                                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                                    >
                                        ← Voltar para Buscar
                                    </Button>
                                    {onBackToDashboard && (
                                        <Button
                                            variant="outline"
                                            onClick={onBackToDashboard}
                                            className="border-slate-600 text-slate-300 hover:bg-slate-700"
                                        >
                                            ← Dashboard
                                        </Button>
                                    )}
                                </div>
                            </div>
                            {viewMode === 'client-form' || showClientForm ? (
                                <ClientManagerForm
                                    clientData={clientData}
                                    accountManagerData={accountManagerData}
                                    onClientDataChange={setClientData}
                                    onAccountManagerDataChange={setAccountManagerData}
                                    onBack={() => {
                                        setShowClientForm(false);
                                        if (viewMode === 'client-form') {
                                            setViewMode('search');
                                        }
                                    }}
                                    onContinue={() => {
                                        setShowClientForm(false);
                                        if (viewMode === 'client-form') {
                                            setViewMode('calculator');
                                        }
                                    }}
                                />
                            ) : (
                                <ClientManagerInfo
                                    clientData={clientData}
                                    accountManagerData={accountManagerData}
                                />
                            )}
                        </div>

                        {viewMode === 'calculator' && (
                            <>
                                <div>
                                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                        <TabsList className={`grid w-full grid-cols-4 bg-slate-800`}>
                                            <TabsTrigger value="calculator">Calculadora VM</TabsTrigger>
                                            {canEditCommissions && (
                                                <TabsTrigger value="list-price">Tabela de Preços VM/Configurações</TabsTrigger>
                                            )}
                                            {canEditCommissions && (
                                            <TabsTrigger value="commissions-table">Tabela Comissões</TabsTrigger>
                                            )}
                                            {canEditCommissions && (
                                                <TabsTrigger value="dre">DRE</TabsTrigger>
                                            )}
                                        </TabsList>
                                        <TabsContent value="calculator">
                                            <div className="mt-6">
                                                {/* Configurar Máquina Virtual - Design Moderno */}
                                                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl">
                                                    {/* Header com gradiente */}
                                                    <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-t-2xl p-6">
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-3">
                                                                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                                                    <Server className="h-6 w-6 text-white" />
                                                                </div>
                                                                <div>
                                                                    <h2 className="text-2xl font-bold text-white">Configurar Máquina Virtual</h2>
                                                                    <p className="text-cyan-100 text-sm">Configure os recursos da sua VM</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <Button className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm">
                                                                    <Brain className="h-4 w-4 mr-2" />
                                                                    Sugestão IA
                                                                </Button>
                                                                <Button onClick={handleAddVMProduct} className="bg-green-500 hover:bg-green-600 text-white border-0">
                                                                    <Plus className="h-4 w-4 mr-2" />
                                                                    Adicionar à Proposta
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Conteúdo principal com grid moderno */}
                                                    <div className="p-6 space-y-6">

                                                        {/* Card: Identificação */}
                                                        <div className="bg-gradient-to-br from-cyan-900/30 to-slate-800/50 rounded-xl p-4 border border-cyan-500/30 shadow-lg hover:shadow-cyan-500/20 transition-all duration-300">
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <div className="p-2 bg-cyan-500/20 rounded-lg">
                                                                    <Edit className="h-4 w-4 text-cyan-400" />
                                                                </div>
                                                                <h3 className="text-white font-semibold">Nome da VM</h3>
                                                            </div>
                                                            <Input
                                                                value={vmName}
                                                                onChange={(e) => setVmName(e.target.value)}
                                                                className="bg-slate-900/70 border-cyan-500/50 text-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                                                                placeholder="Ex: Servidor Principal"
                                                            />
                                                        </div>

                                                        {/* Grid: Recursos Computacionais */}
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div className="bg-gradient-to-br from-blue-900/30 to-slate-800/50 rounded-xl p-4 border border-blue-500/30 shadow-lg hover:shadow-blue-500/20 transition-all duration-300">
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <div className="p-2 bg-blue-500/20 rounded-lg">
                                                                        <Cpu className="h-4 w-4 text-blue-400" />
                                                                    </div>
                                                                    <h3 className="text-white font-semibold">vCPU Cores</h3>
                                                                </div>
                                                                <Input
                                                                    type="number"
                                                                    step="1"
                                                                    value={vmCpuCores}
                                                                    onChange={(e) => setVmCpuCores(parseFloat(e.target.value) || 0)}
                                                                    className="bg-slate-900/70 border-blue-500/50 text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                                                                    min="1"
                                                                    max="64"
                                                                />
                                                            </div>
                                                            <div className="bg-gradient-to-br from-purple-900/30 to-slate-800/50 rounded-xl p-4 border border-purple-500/30 shadow-lg hover:shadow-purple-500/20 transition-all duration-300">
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <div className="p-2 bg-purple-500/20 rounded-lg">
                                                                        <MemoryStick className="h-4 w-4 text-purple-400" />
                                                                    </div>
                                                                    <h3 className="text-white font-semibold">Memória RAM (GB)</h3>
                                                                </div>
                                                                <Input
                                                                    type="number"
                                                                    step="1"
                                                                    value={vmRamGb}
                                                                    onChange={(e) => setVmRamGb(parseFloat(e.target.value) || 0)}
                                                                    className="bg-slate-900/70 border-purple-500/50 text-white focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                                                                    min="1"
                                                                    max="512"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Card: Armazenamento */}
                                                        <div className="bg-gradient-to-br from-green-900/30 to-slate-800/50 rounded-xl p-4 border border-green-500/30 shadow-lg hover:shadow-green-500/20 transition-all duration-300">
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <div className="p-2 bg-green-500/20 rounded-lg">
                                                                    <HardDrive className="h-4 w-4 text-green-400" />
                                                                </div>
                                                                <h3 className="text-white font-semibold">Armazenamento</h3>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <div>
                                                                    <Label className="text-sm text-green-200 mb-2 block font-medium">Tipo de Armazenamento</Label>
                                                                    <Select value={vmStorageType} onValueChange={setVmStorageType}>
                                                                        <SelectTrigger className="bg-slate-900/70 border-green-500/50 text-white focus:border-green-400 focus:ring-2 focus:ring-green-400/20">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="bg-slate-800 text-white border-green-600">
                                                                            <SelectItem value="HDD SAS">HDD SAS</SelectItem>
                                                                            <SelectItem value="SSD Performance">SSD Performance</SelectItem>
                                                                            <SelectItem value="NVMe">NVMe</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <div>
                                                                    <Label className="text-sm text-green-200 mb-2 block font-medium">Tamanho (GB)</Label>
                                                                    <Input
                                                                        type="number"
                                                                        step="1"
                                                                        value={vmStorageSize}
                                                                        onChange={(e) => setVmStorageSize(parseFloat(e.target.value) || 0)}
                                                                        className="bg-slate-900/70 border-green-500/50 text-white focus:border-green-400 focus:ring-2 focus:ring-green-400/20"
                                                                        min="10"
                                                                        max="10000"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Grid: Rede e Sistema */}
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div className="bg-gradient-to-br from-orange-900/30 to-slate-800/50 rounded-xl p-4 border border-orange-500/30 shadow-lg hover:shadow-orange-500/20 transition-all duration-300">
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <div className="p-2 bg-orange-500/20 rounded-lg">
                                                                        <Network className="h-4 w-4 text-orange-400" />
                                                                    </div>
                                                                    <h3 className="text-white font-semibold">Placa de Rede</h3>
                                                                </div>
                                                                <Select value={vmNetworkSpeed} onValueChange={setVmNetworkSpeed}>
                                                                    <SelectTrigger className="bg-slate-900/70 border-orange-500/50 text-white focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="bg-slate-800 text-white border-slate-600">
                                                                        <SelectItem value="1 Gbps">1 Gbps</SelectItem>
                                                                        <SelectItem value="10 Gbps">10 Gbps</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="bg-gradient-to-br from-yellow-900/30 to-slate-800/50 rounded-xl p-4 border border-yellow-500/30 shadow-lg hover:shadow-yellow-500/20 transition-all duration-300">
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <div className="p-2 bg-yellow-500/20 rounded-lg">
                                                                        <Settings className="h-4 w-4 text-yellow-400" />
                                                                    </div>
                                                                    <h3 className="text-white font-semibold">Sistema Operacional</h3>
                                                                </div>
                                                                <Select value={vmOperatingSystem} onValueChange={setVmOperatingSystem}>
                                                                    <SelectTrigger className="bg-slate-900/70 border-yellow-500/50 text-white focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="bg-slate-800 text-white border-yellow-600">
                                                                        <SelectItem value="Ubuntu Server 22.04 LTS">Ubuntu Server 22.04 LTS</SelectItem>
                                                                        <SelectItem value="Windows Server 2022 Standard">Windows Server 2022 Standard</SelectItem>
                                                                        <SelectItem value="Windows 10 Pro">Windows 10 Pro</SelectItem>
                                                                        <SelectItem value="Windows 11 Pro">Windows 11 Pro</SelectItem>
                                                                        <SelectItem value="CentOS Stream 9">CentOS Stream 9</SelectItem>
                                                                        <SelectItem value="Debian 12">Debian 12</SelectItem>
                                                                        <SelectItem value="Rocky Linux 9">Rocky Linux 9</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>

                                                        {/* Card: Serviços Adicionais */}
                                                        <div className="bg-gradient-to-br from-indigo-900/30 to-slate-800/50 rounded-xl p-4 border border-indigo-500/30 shadow-lg hover:shadow-indigo-500/20 transition-all duration-300">
                                                            <div className="flex items-center gap-2 mb-4">
                                                                <div className="p-2 bg-indigo-500/20 rounded-lg">
                                                                    <Plus className="h-4 w-4 text-indigo-400" />
                                                                </div>
                                                                <h3 className="text-white font-semibold">Serviços Adicionais</h3>
                                                            </div>

                                                            {/* Backup */}
                                                            <div className="mb-4">
                                                                <Label className="text-sm text-slate-300 mb-2 block">
                                                                    Backup em Bloco (GB) - Atual: <span className="text-cyan-400 font-semibold">{vmBackupSize} GB</span>
                                                                </Label>
                                                                <Input
                                                                    type="number"
                                                                    step="1"
                                                                    value={vmBackupSize}
                                                                    onChange={(e) => setVmBackupSize(parseFloat(e.target.value) || 0)}
                                                                    className="bg-slate-900/50 border-slate-600 text-white focus:border-cyan-400"
                                                                    placeholder="0"
                                                                    min="0"
                                                                />
                                                            </div>

                                                            {/* Checkboxes em grid */}
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                <div className="flex items-center space-x-3 p-3 bg-slate-900/30 rounded-lg border border-slate-600/50">
                                                                    <Checkbox
                                                                        id="vmAdditionalIp"
                                                                        checked={vmAdditionalIp}
                                                                        onCheckedChange={(checked) => setVmAdditionalIp(Boolean(checked))}
                                                                        className="border-cyan-400 data-[state=checked]:bg-cyan-500"
                                                                    />
                                                                    <Label htmlFor="vmAdditionalIp" className="text-white text-sm">IP Adicional</Label>
                                                                </div>
                                                                <div className="flex items-center space-x-3 p-3 bg-slate-900/30 rounded-lg border border-slate-600/50">
                                                                    <Checkbox
                                                                        id="vmSnapshot"
                                                                        checked={vmSnapshot}
                                                                        onCheckedChange={(checked) => setVmSnapshot(Boolean(checked))}
                                                                        className="border-cyan-400 data-[state=checked]:bg-cyan-500"
                                                                    />
                                                                    <Label htmlFor="vmSnapshot" className="text-white text-sm">Snapshot Adicional</Label>
                                                                </div>
                                                                <div className="flex items-center space-x-3 p-3 bg-slate-900/30 rounded-lg border border-slate-600/50">
                                                                    <Checkbox
                                                                        id="vmVpnSiteToSite"
                                                                        checked={vmVpnSiteToSite}
                                                                        onCheckedChange={(checked) => setVmVpnSiteToSite(Boolean(checked))}
                                                                        className="border-cyan-400 data-[state=checked]:bg-cyan-500"
                                                                    />
                                                                    <Label htmlFor="vmVpnSiteToSite" className="text-white text-sm">VPN Site-to-Site</Label>
                                                                </div>
                                                                <div className="flex items-center space-x-3 p-3 bg-slate-900/30 rounded-lg border border-slate-600/50">
                                                                    <Checkbox
                                                                        id="vmManagementSupport"
                                                                        checked={vmManagementSupport}
                                                                        onCheckedChange={(checked) => setVmManagementSupport(Boolean(checked))}
                                                                        className="border-cyan-400 data-[state=checked]:bg-cyan-500"
                                                                    />
                                                                    <Label htmlFor="vmManagementSupport" className="text-white text-sm">Gestão e Suporte</Label>
                                                                </div>
                                                                <div className="flex items-center space-x-3 p-3 bg-slate-900/30 rounded-lg border border-slate-600/50">
                                                                    <Checkbox
                                                                        id="includeSetupFee"
                                                                        checked={includeSetupFee}
                                                                        onCheckedChange={(checked) => setIncludeSetupFee(Boolean(checked))}
                                                                        className="border-cyan-400 data-[state=checked]:bg-cyan-500"
                                                                    />
                                                                    <Label htmlFor="includeSetupFee" className="text-white text-sm">Incluir Taxa de Setup</Label>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Período Contratual */}
                                                <Card className="bg-slate-900/80 border-slate-800 text-white">
                                                    <CardHeader>
                                                        <CardTitle className="flex items-center gap-2">
                                                            <Settings className="h-5 w-5" />
                                                            <span className="text-cyan-400">Período Contratual</span>
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="space-y-4">
                                                            <div>
                                                                <Label className="text-white mb-3 block">Selecione o período de contrato:</Label>
                                                                <div className="grid grid-cols-5 gap-3">
                                                                    {[12, 24, 36, 48, 60].map((months) => (
                                                                        <Button
                                                                            key={months}
                                                                            variant={vmContractPeriod === months ? "default" : "outline"}
                                                                            className={`${vmContractPeriod === months
                                                                                ? "bg-cyan-600 text-white border-cyan-600"
                                                                                : "bg-slate-800 text-white border-slate-600 hover:bg-slate-700"
                                                                                }`}
                                                                            onClick={() => setVmContractPeriod(months)}
                                                                        >
                                                                            {months} meses
                                                                        </Button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <div className="text-sm text-slate-400">
                                                                Período selecionado: <span className="text-cyan-400 font-semibold">{vmContractPeriod} meses</span>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>

                                                {/* Incluir Parceiro Indicador */}
                                                <Card className="bg-slate-900/80 border-slate-800 text-white">
                                                    <CardHeader>
                                                        <CardTitle className="flex items-center gap-2">
                                                            <User className="h-5 w-5" />
                                                            <span className="text-cyan-400">Parceiro Indicador</span>
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id="includeReferralPartner"
                                                                checked={includeReferralPartner}
                                                                onCheckedChange={(checked) => setIncludeReferralPartner(Boolean(checked))}
                                                                className="border-cyan-400"
                                                            />
                                                            <Label htmlFor="includeReferralPartner" className="text-white">Incluir Parceiro Indicador</Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2 mt-4">
                                                            <Checkbox
                                                                id="includeInfluencerPartner"
                                                                checked={includeInfluencerPartner}
                                                                onCheckedChange={(checked) => setIncludeInfluencerPartner(Boolean(checked))}
                                                                className="border-purple-400"
                                                            />
                                                            <Label htmlFor="includeInfluencerPartner" className="text-white">Incluir Parceiro Influenciador</Label>
                                                        </div>
                                                    </CardContent>
                                                </Card>



                                                {/* Resultado do Cálculo da VM */}
                                                <Card className="bg-slate-900/80 border-slate-800 text-white">
                                                    <CardHeader>
                                                        <CardTitle className="flex items-center">
                                                            <Calculator className="mr-2" />
                                                            Resultado da Configuração
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="space-y-4">
                                                            {/* Campo de Quantidade */}
                                                            <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                                                                <Label htmlFor="vm-quantity" className="text-cyan-400 font-semibold">Quantidade de VMs:</Label>
                                                                <div className="flex items-center space-x-2 mt-2">
                                                                    <Input
                                                                        id="vm-quantity"
                                                                        type="number"
                                                                        value={vmQuantity}
                                                                        onChange={(e) => setVmQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                                                        min="1"
                                                                        max="100"
                                                                        className="bg-slate-900 border-slate-600 text-white w-20"
                                                                    />
                                                                    <span className="text-sm text-slate-400">
                                                                        {vmQuantity === 1 ? 'VM' : 'VMs'} idêntica{vmQuantity === 1 ? '' : 's'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <Label className="text-cyan-400">Resumo da VM:</Label>
                                                                    <div className="text-sm space-y-1 mt-2">
                                                                        <div>Nome: {vmName}</div>
                                                                        <div>vCPU: {vmCpuCores} cores</div>
                                                                        <div>RAM: {vmRamGb} GB</div>
                                                                        <div>Armazenamento: {vmStorageSize} GB {vmStorageType}</div>
                                                                        <div>Rede: {vmNetworkSpeed}</div>
                                                                        <div>OS: {vmOperatingSystem}</div>
                                                                        <div>Contrato: {vmContractPeriod} meses</div>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <Label className="text-cyan-400">Serviços Adicionais:</Label>
                                                                    <div className="text-sm space-y-1 mt-2">
                                                                        {vmBackupSize > 0 && <div>Backup: {vmBackupSize} GB</div>}
                                                                        {vmAdditionalIp && <div>IP Adicional</div>}
                                                                        {vmSnapshot && <div>Snapshot Adicional</div>}
                                                                        {vmVpnSiteToSite && <div>VPN Site-to-Site</div>}
                                                                        {vmManagementSupport && <div>Gestão e Suporte</div>}
                                                                        {includeSetupFee && <div>Taxa de Setup</div>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                    <CardFooter className="flex-col items-start">
                                                        <div className="w-full">
                                                            <Separator className="bg-slate-700 my-4" />
                                                            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-4 border border-slate-600/50">
                                                                <div className="flex items-center gap-2 mb-4">
                                                                    <Calculator className="h-5 w-5 text-green-400" />
                                                                    <h3 className="text-lg font-bold text-white">Resumo de Preços</h3>
                                                                </div>

                                                                {/* Configuração da VM */}
                                                                <div className="bg-slate-900/50 rounded-lg p-3 mb-4">
                                                                    <div className="text-sm text-slate-300 mb-2">Configuração: {vmQuantity}x {vmName}</div>
                                                                    <div className="text-xs text-slate-400">{vmCpuCores} vCPU • {vmRamGb}GB RAM • {vmStorageSize}GB {vmStorageType}</div>
                                                                </div>

                                                                {/* Cálculos */}
                                                                <div className="space-y-3">
                                                                    <div className="flex justify-between text-green-400 font-bold text-xl">
                                                                        <span>Valor Mensal:</span>
                                                                        <span>{formatCurrency(vmFinalPrice * vmQuantity)}</span>
                                                                    </div>

                                                                    <div className="flex justify-between text-blue-400 font-bold text-lg">
                                                                        <span>Total do Contrato ({vmContractPeriod} meses):</span>
                                                                        <span>{formatCurrency((vmFinalPrice * vmQuantity) * vmContractPeriod)}</span>
                                                                    </div>

                                                                    <Separator className="bg-slate-600 my-3" />

                                                                    {includeSetupFee && (
                                                                        <div className="flex justify-between text-yellow-400 font-semibold">
                                                                            <span>Taxa de Setup (única):</span>
                                                                            <span>{formatCurrency(setupFee * vmQuantity)}</span>
                                                                        </div>
                                                                    )}

                                                                    {contractDiscount > 0 && (
                                                                        <div className="flex items-center gap-2 text-sm text-orange-300 mt-3 p-2 bg-orange-900/20 rounded-lg">
                                                                            <span>💰</span>
                                                                            <span>Desconto de {contractDiscount}% aplicado por contrato de {vmContractPeriod} meses</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {(isDirector || isAdmin) && (
                                                                <div className="space-y-2 mt-4">
                                                                    <Label htmlFor="director-discount">Desconto Diretor (%)</Label>
                                                                    <div className="flex items-center space-x-2">
                                                                        <Input
                                                                            id="director-discount"
                                                                            type="number"
                                                                            step="0.01"
                                                                            value={directorDiscountPercentage}
                                                                            onChange={(e) => setDirectorDiscountPercentage(parseFloat(e.target.value) || 0)}
                                                                            placeholder="0-100"
                                                                            min="0"
                                                                            max="100"
                                                                            className="bg-slate-800 border-slate-700 text-white"
                                                                        />
                                                                        <Button
                                                                            onClick={() => setAppliedDirectorDiscountPercentage(directorDiscountPercentage)}
                                                                            className="bg-blue-600 hover:bg-blue-700"
                                                                        >
                                                                            Aplicar
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div className="space-y-2 mt-4">
                                                                <Button
                                                                    className="w-full bg-green-600 hover:bg-green-700"
                                                                    onClick={handleAddVMProduct}
                                                                >
                                                                    Adicionar à Proposta
                                                                </Button>
                                                                {addedProducts.length > 0 && (
                                                                    <Button
                                                                        variant="outline"
                                                                        className="w-full bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                                                                        onClick={() => setActiveTab('proposal')}
                                                                    >
                                                                        Ver Resumo da Proposta ({addedProducts.length} {addedProducts.length === 1 ? 'item' : 'itens'})
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </CardFooter>
                                                </Card>
                                            </div>
                                        </TabsContent>

                                        {canEditCommissions && (
                                        <TabsContent value="commissions-table">
                                            <div className="space-y-6 mt-6">
                                                <Card className="bg-slate-900/80 border-slate-800 text-white">
                                                    <CardHeader>
                                                        <CardTitle className="flex items-center">
                                                            <div className="w-4 h-4 bg-yellow-500 mr-2"></div>
                                                            Tabela de Comissões - VM
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <CommissionTablesUnified />
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        </TabsContent>
                                        )}
                                        {canEditCommissions && (
                                        <TabsContent value="dre">
                                            <div className="space-y-6 mt-6">
                                                {/* Análise Financeira */}
                                                <Card className="bg-slate-900/80 border-slate-800 text-white">
                                                    <CardHeader>
                                                        <CardTitle className="flex items-center">
                                                            <div className="w-4 h-4 bg-green-500 mr-2"></div>
                                                            Análise Financeira
                                                        </CardTitle>
                                                        <CardDescription>Resumo dos cálculos financeiros</CardDescription>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            <div className="space-y-2">
                                                                <div className="flex justify-between">
                                                                    <span>Receita Bruta Mensal:</span>
                                                                    <span className="text-green-400">{formatCurrency(costBreakdown.finalPrice)}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>Receita Total do Contrato ({vmContractPeriod}m):</span>
                                                                    <span className="text-green-400">{formatCurrency(costBreakdown.finalPrice * vmContractPeriod)}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>Taxa de Setup:</span>
                                                                    <span className="text-green-400">{formatCurrency(costBreakdown.setupFee)}</span>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <div className="flex justify-between">
                                                                    <span>Receita Líquida Total:</span>
                                                                    <span className={costBreakdown.netProfit >= 0 ? "text-green-400" : "text-red-400"}>
                                                                        {formatCurrency(costBreakdown.netProfit * vmContractPeriod)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>Receita Líquida Mensal Média:</span>
                                                                    <span className={costBreakdown.netProfit >= 0 ? "text-green-400" : "text-red-400"}>
                                                                        {formatCurrency(costBreakdown.netProfit)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>Margem Líquida:</span>
                                                                    <span className={costBreakdown.netMargin >= 0 ? "text-green-400" : "text-red-400"}>
                                                                        {costBreakdown.netMargin.toFixed(2)}%
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>

                                                {/* DRE - Demonstrativo de Resultado do Exercício */}
                                                <Card className="bg-slate-900/80 border-slate-800 text-white">
                                                    <CardHeader>
                                                        <CardTitle className="flex items-center">
                                                            <div className="w-4 h-4 bg-blue-500 mr-2"></div>
                                                            DRE - Demonstrativo de Resultado do Exercício
                                                        </CardTitle>
                                                        <CardDescription>DRE - Período: {vmContractPeriod} Meses</CardDescription>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="border-slate-700">
                                                                    <TableHead className="text-white">Descrição</TableHead>
                                                                    <TableHead className="text-right text-white">Valor Mensal</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {/* Receita Bruta */}
                                                                <TableRow className="border-slate-800 bg-blue-900/30">
                                                                    <TableCell className="text-white font-semibold">Receita Bruta</TableCell>
                                                                    <TableCell className="text-right text-white">{formatCurrency(costBreakdown.grossRevenue || costBreakdown.finalPrice)}</TableCell>
                                                                </TableRow>

                                                                {/* Receita Líquida */}
                                                                <TableRow className="border-slate-800 bg-green-900/30">
                                                                    <TableCell className="text-white font-semibold">(=) Receita Líquida</TableCell>
                                                                    <TableCell className="text-right text-white">{formatCurrency(costBreakdown.netRevenue || costBreakdown.finalPrice)}</TableCell>
                                                                </TableRow>

                                                                {/* Custos Diretos */}
                                                                <TableRow className="border-slate-800 bg-red-900/30">
                                                                    <TableCell className="text-white font-semibold">(-) Custos Diretos</TableCell>
                                                                    <TableCell className="text-right text-white">{formatCurrency(costBreakdown.directCosts || costBreakdown.cost)}</TableCell>
                                                                </TableRow>
                                                                <TableRow className="border-slate-800">
                                                                    <TableCell className="text-white pl-8">Custo Operacional da VM</TableCell>
                                                                    <TableCell className="text-right text-white">{formatCurrency(costBreakdown.cost)}</TableCell>
                                                                </TableRow>

                                                                {/* Lucro Bruto */}
                                                                <TableRow className="border-slate-800 bg-blue-900/30">
                                                                    <TableCell className="text-white font-semibold">(=) Lucro Bruto</TableCell>
                                                                    <TableCell className="text-right text-white">{formatCurrency(costBreakdown.grossProfit)}</TableCell>
                                                                </TableRow>

                                                                {/* Despesas Comerciais (Comissões) */}
	                                                                <TableRow className="border-slate-800 bg-red-900/30">
	                                                                    <TableCell className="text-white font-semibold">(-) Despesas Comerciais</TableCell>
	                                                                    <TableCell className="text-right text-white">{formatCurrency(costBreakdown.totalCommissions || (costBreakdown.commissionValue + (costBreakdown.directorCommission || 0) + costBreakdown.referralPartnerCommission + (costBreakdown.influencerPartnerCommission || 0)))}</TableCell>
	                                                                </TableRow>
	                                                                <TableRow className="border-slate-800">
	                                                                    <TableCell className="text-white pl-8">
	                                                                        {(includeReferralPartner || includeInfluencerPartner) ? 'Comissão Canal/Vendedor' : 'Comissão Vendedor'}
	                                                                    </TableCell>
	                                                                    <TableCell className="text-right text-white">{formatCurrency(costBreakdown.commissionValue)}</TableCell>
	                                                                </TableRow>
	                                                                <TableRow className="border-slate-800">
	                                                                    <TableCell className="text-white pl-8">Comissão Diretor</TableCell>
	                                                                    <TableCell className="text-right text-white">{formatCurrency(costBreakdown.directorCommission || 0)}</TableCell>
	                                                                </TableRow>
	                                                                {includeReferralPartner && (
	                                                                    <TableRow className="border-slate-800">
	                                                                        <TableCell className="text-white pl-8">Comissão Parceiro Indicador</TableCell>
	                                                                        <TableCell className="text-right text-white">{formatCurrency(costBreakdown.referralPartnerCommission)}</TableCell>
	                                                                    </TableRow>
	                                                                )}
                                                                {includeInfluencerPartner && (
                                                                    <TableRow className="border-slate-800">
                                                                        <TableCell className="text-white pl-8">Comissão Parceiro Influenciador</TableCell>
                                                                        <TableCell className="text-right text-white">{formatCurrency(costBreakdown.influencerPartnerCommission)}</TableCell>
                                                                    </TableRow>
                                                                )}

	                                                                {/* Lucro após Despesas Comerciais */}
	                                                                <TableRow className="border-slate-800 bg-blue-900/30">
	                                                                    <TableCell className="text-white font-semibold">(=) Lucro após Despesas Comerciais</TableCell>
	                                                                    <TableCell className="text-right text-white">{formatCurrency(costBreakdown.profitAfterCommissions || (costBreakdown.grossProfit - (costBreakdown.commissionValue + (costBreakdown.directorCommission || 0) + costBreakdown.referralPartnerCommission + (costBreakdown.influencerPartnerCommission || 0))))}</TableCell>
	                                                                </TableRow>

                                                                {/* Taxa Setup (se aplicável) */}
                                                                {costBreakdown.setupFee > 0 && (
                                                                    <TableRow className="border-slate-800">
                                                                        <TableCell className="text-white">Taxa Setup (única)</TableCell>
                                                                        <TableCell className="text-right text-white">{formatCurrency(costBreakdown.setupFee)}</TableCell>
                                                                    </TableRow>
                                                                )}


                                                                <TableRow className="border-slate-800 bg-green-900/50">
                                                                    <TableCell className="text-white font-bold">LUCRO LÍQUIDO</TableCell>
                                                                    <TableCell className={`text-right font-bold ${costBreakdown.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                        {formatCurrency(costBreakdown.netProfit)}
                                                                    </TableCell>
                                                                </TableRow>
                                                                <TableRow className="border-slate-800">
                                                                    <TableCell className="text-white font-semibold">Balance</TableCell>
                                                                    <TableCell className={`text-right font-semibold ${costBreakdown.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                        {formatCurrency(costBreakdown.netProfit)}
                                                                    </TableCell>
                                                                </TableRow>
                                                                <TableRow className="border-slate-800">
                                                                    <TableCell className="text-white font-semibold">Rentabilidade %</TableCell>
                                                                    <TableCell className={`text-right font-semibold ${(costBreakdown.netProfit / costBreakdown.finalPrice * 100) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                        {formatBrazilianNumber((costBreakdown.netProfit / costBreakdown.finalPrice) * 100)}%
                                                                    </TableCell>
                                                                </TableRow>
                                                                <TableRow className="border-slate-800">
                                                                    <TableCell className="text-white font-semibold">Lucratividade</TableCell>
                                                                    <TableCell className={`text-right font-semibold ${(costBreakdown.netProfit / costBreakdown.finalPrice * 100) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                        {formatBrazilianNumber((costBreakdown.netProfit / costBreakdown.finalPrice) * 100)}%
                                                                    </TableCell>
                                                                </TableRow>
                                                            </TableBody>
                                                        </Table>
                                                    </CardContent>
                                                </Card>

                                                {/* Resultado Final */}
                                                <Card className="border-green-500 bg-gradient-to-r from-slate-900 to-green-900/20">
                                                    <CardHeader className="bg-gradient-to-r from-green-800 to-green-700 py-4">
                                                        <CardTitle className="text-xl font-bold text-white flex items-center">
                                                            <div className="w-3 h-3 bg-green-400 rounded-full mr-3"></div>
                                                            Resultado Final
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="p-6">
                                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                                            {/* RECEITA */}
                                                            <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 p-4 rounded-lg border border-blue-500/30">
                                                                <h3 className="text-sm font-semibold text-blue-300 mb-3 uppercase tracking-wide">RECEITA</h3>
                                                                <div className="space-y-2">
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-gray-300">Mensal:</span>
                                                                        <span className="text-blue-300 font-semibold">{formatCurrency(costBreakdown.finalPrice)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-gray-300">Total Contrato:</span>
                                                                        <span className="text-blue-300 font-semibold">{formatCurrency(costBreakdown.finalPrice * vmContractPeriod)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-gray-300">Setup:</span>
                                                                        <span className="text-blue-300 font-semibold">{formatCurrency(0)}</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* CUSTOS */}
                                                            <div className="bg-gradient-to-br from-red-900/50 to-red-800/30 p-4 rounded-lg border border-red-500/30">
                                                                <h3 className="text-sm font-semibold text-red-300 mb-3 uppercase tracking-wide">CUSTOS</h3>
                                                                <div className="space-y-2">
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-gray-300">VM:</span>
                                                                        <span className="text-red-300 font-semibold">{formatCurrency(costBreakdown.cost)}</span>
                                                                    </div>
	                                                                    <div className="flex justify-between text-sm">
	                                                                        <span className="text-gray-300">Comissão:</span>
	                                                                        <span className="text-red-300 font-semibold">{formatCurrency(costBreakdown.commissionValue)}</span>
	                                                                    </div>
	                                                                    <div className="flex justify-between text-sm">
	                                                                        <span className="text-gray-300">Comissão Diretor:</span>
	                                                                        <span className="text-red-300 font-semibold">{formatCurrency(costBreakdown.directorCommission || 0)}</span>
	                                                                    </div>
	                                                                </div>
	                                                            </div>

                                                            {/* LUCRO */}
                                                            <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 p-4 rounded-lg border border-green-500/30">
                                                                <h3 className="text-sm font-semibold text-green-300 mb-3 uppercase tracking-wide">LUCRO</h3>
                                                                <div className="space-y-2">
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-gray-300">Operacional:</span>
                                                                        <span className={`font-semibold ${costBreakdown.grossProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                                                            {formatCurrency(costBreakdown.grossProfit)}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-gray-300">Líquido:</span>
                                                                        <span className={`font-semibold ${costBreakdown.netProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                                                            {formatCurrency(costBreakdown.netProfit)}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-gray-300">Total Contrato:</span>
                                                                        <span className={`font-semibold ${costBreakdown.netProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                                                            {formatCurrency(costBreakdown.netProfit * vmContractPeriod)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* INDICADORES */}
                                                            <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 p-4 rounded-lg border border-purple-500/30">
                                                                <h3 className="text-sm font-semibold text-purple-300 mb-3 uppercase tracking-wide">INDICADORES</h3>
                                                                <div className="space-y-2">
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-gray-300">Margem:</span>
                                                                        <span className={`font-semibold ${(costBreakdown.netProfit / costBreakdown.finalPrice * 100) >= 0 ? 'text-purple-300' : 'text-red-300'}`}>
                                                                            {formatBrazilianNumber((costBreakdown.netProfit / costBreakdown.finalPrice) * 100)}%
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-gray-300">Payback:</span>
                                                                        <span className="text-purple-300 font-semibold">
                                                                            {costBreakdown.netProfit > 0 ? `${Math.ceil(costBreakdown.finalPrice / costBreakdown.netProfit)}m` : 'N/A'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-gray-300">ROI Total:</span>
                                                                        <span className={`font-semibold ${(costBreakdown.netProfit / costBreakdown.finalPrice * 100) >= 0 ? 'text-purple-300' : 'text-red-300'}`}>
                                                                            {formatBrazilianNumber((costBreakdown.netProfit / costBreakdown.finalPrice) * 100 * vmContractPeriod)}%
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Resumo Executivo */}
                                                        <div className="mt-6 pt-6 border-t border-slate-700">
                                                            <div className="flex items-center mb-4">
                                                                <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                                                                <h3 className="text-lg font-semibold text-white">Resumo Executivo</h3>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                                <div className="text-center">
                                                                    <div className="text-2xl font-bold text-green-400">
                                                                        {formatCurrency(costBreakdown.finalPrice * vmContractPeriod)}
                                                                    </div>
                                                                    <div className="text-sm text-slate-400">Receita Total ({vmContractPeriod}m)</div>
                                                                </div>
                                                                <div className="text-center">
                                                                    <div className={`text-2xl font-bold ${costBreakdown.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                        {formatCurrency(costBreakdown.netProfit * vmContractPeriod)}
                                                                    </div>
                                                                    <div className="text-sm text-slate-400">Lucro Total ({vmContractPeriod}m)</div>
                                                                </div>
                                                                <div className="text-center">
                                                                    <div className={`text-2xl font-bold ${(costBreakdown.netProfit / costBreakdown.finalPrice * 100) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                        {formatBrazilianNumber((costBreakdown.netProfit / costBreakdown.finalPrice) * 100)}%
                                                                    </div>
                                                                    <div className="text-sm text-slate-400">Margem Líquida</div>
                                                                </div>
                                                            </div>
                                                        </div>


                                                    </CardContent>
                                                </Card>
                                            </div>
                                        </TabsContent>
                                        )}
                                        {canEditCommissions && (
                                        <TabsContent value="list-price">
                                            <div className="space-y-6 mt-6">

                                                {/* Tributos */}
                                                <Card className="bg-slate-900/80 border-slate-800 text-white">
                                                    <CardHeader>
                                                        <CardTitle className="flex items-center gap-2">
                                                            <Calculator className="h-5 w-5" />
                                                            Tributos
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="flex gap-4 mb-6">
                                                            <Button
                                                                variant="outline"
                                                                className={selectedTaxRegime === 'lucro_real' ? "bg-blue-600 text-white border-blue-600" : "bg-slate-700 text-white border-slate-600"}
                                                                onClick={() => handleTaxRegimeChange('lucro_real')}
                                                            >
                                                                Lucro Real
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                className={selectedTaxRegime === 'lucro_presumido' ? "bg-blue-600 text-white border-blue-600" : "bg-slate-700 text-white border-slate-600"}
                                                                onClick={() => handleTaxRegimeChange('lucro_presumido')}
                                                            >
                                                                Lucro Presumido
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                className={selectedTaxRegime === 'lucro_real_reduzido' ? "bg-blue-600 text-white border-blue-600" : "bg-slate-700 text-white border-slate-600"}
                                                                onClick={() => handleTaxRegimeChange('lucro_real_reduzido')}
                                                            >
                                                                Lucro Real Reduzido
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                className={selectedTaxRegime === 'simples_nacional' ? "bg-blue-600 text-white border-blue-600" : "bg-slate-700 text-white border-slate-600"}
                                                                onClick={() => handleTaxRegimeChange('simples_nacional')}
                                                            >
                                                                Simples Nacional
                                                            </Button>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-6">
                                                            <div>
                                                                <Label>PIS/COFINS (%)</Label>
                                                                <Input
                                                                    value={pisCofins}
                                                                    onChange={(e) => setPisCofins(e.target.value)}
                                                                    className="bg-slate-800 border-slate-700"
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label>ISS (%)</Label>
                                                                <Input
                                                                    value={iss}
                                                                    onChange={(e) => setIss(e.target.value)}
                                                                    className="bg-slate-800 border-slate-700"
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label>CSLL/IR (%)</Label>
                                                                <Input
                                                                    value={csllIr}
                                                                    onChange={(e) => setCsllIr(e.target.value)}
                                                                    className="bg-slate-800 border-slate-700"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="mt-4 text-center text-cyan-400 text-lg font-semibold">
                                                            Total de Impostos do Regime Selecionado: {(revenueTaxes + profitTaxes).toFixed(2).replace('.', ',')}%
                                                        </div>
                                                        <p className="text-sm text-slate-400 mt-2">
                                                            Edite os impostos de cada regime tributário. Os valores são percentuais e aceitam até 2 casas decimais.
                                                        </p>
                                                    </CardContent>
                                                </Card>

                                                {/* Markup e Margem Líquida */}
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                    <Card className="bg-slate-900/80 border-slate-800 text-white">
                                                        <CardHeader>
                                                            <CardTitle className="text-cyan-400">Markup e Margem Líquida</CardTitle>
                                                        </CardHeader>
                                                        <CardContent>
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                                <div>
                                                                    <Label htmlFor="despesas-fixas">Despesas Fixas - DF (%)</Label>
                                                                    <Input
                                                                        id="despesas-fixas"
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={despesasFixas}
                                                                        onChange={(e) => setDespesasFixas(parseFloat(e.target.value) || 0)}
                                                                        className="bg-slate-800 border-slate-700"
                                                                        placeholder="Ex: 15.00"
                                                                    />
                                                                    <p className="text-xs text-slate-400 mt-1">Aluguel, salários, contas fixas</p>
                                                                </div>
                                                                <div>
                                                                    <Label htmlFor="despesas-variaveis">Despesas Variáveis - DV (%)</Label>
                                                                    <Input
                                                                        id="despesas-variaveis"
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={despesasVariaveis}
                                                                        onChange={(e) => setDespesasVariaveis(parseFloat(e.target.value) || 0)}
                                                                        className="bg-slate-800 border-slate-700"
                                                                        placeholder="Ex: 20.00"
                                                                    />
                                                                    <p className="text-xs text-slate-400 mt-1">Impostos, comissões, taxas</p>
                                                                </div>
                                                                <div>
                                                                    <Label htmlFor="margem-liquida-desejada">Margem Líquida Desejada - ML (%)</Label>
                                                                    <Input
                                                                        id="margem-liquida-desejada"
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={margemLiquidaDesejada}
                                                                        onChange={(e) => setMargemLiquidaDesejada(parseFloat(e.target.value) || 0)}
                                                                        className="bg-slate-800 border-slate-700"
                                                                        placeholder="Ex: 10.00"
                                                                    />
                                                                    <p className="text-xs text-slate-400 mt-1">Lucro desejado sobre vendas</p>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                                <div>
                                                                    <Label htmlFor="markup-calculado">Markup Calculado (%)</Label>
                                                                    <Input
                                                                        id="markup-calculado"
                                                                        type="text"
                                                                        value={(markup / 100).toFixed(2).replace('.', ',') + '%'}
                                                                        readOnly
                                                                        className="bg-slate-800"
                                                                    />
                                                                    <p className="text-xs text-slate-400 mt-1">Calculado automaticamente</p>
                                                                </div>
                                                                <div>
                                                                    <Label htmlFor="estimated-net-margin">Margem Líquida Atual (%)</Label>
                                                                    <Input
                                                                        id="estimated-net-margin"
                                                                        type="text"
                                                                        value={estimatedNetMargin.toFixed(2) + '%'}
                                                                        readOnly
                                                                        className="bg-slate-800 border-slate-700 text-cyan-400 cursor-not-allowed"
                                                                    />
                                                                    <p className="text-xs text-slate-400 mt-1">Margem real calculada</p>
                                                                </div>
                                                            </div>
                                                            <Separator className="my-4 bg-slate-700" />
                                                            <div className="bg-slate-800/50 p-3 rounded-lg mb-4">
                                                                <h4 className="text-sm font-semibold text-cyan-400 mb-2">Fórmula do Markup</h4>
                                                                <p className="text-xs text-slate-300 mb-1">
                                                                    <strong>Markup = (DF + DV + ML) ÷ (100 - DF - DV - ML) × 100</strong>
                                                                </p>
                                                                <p className="text-xs text-slate-400">
                                                                    Onde: DF = Despesas Fixas, DV = Despesas Variáveis, ML = Margem Líquida
                                                                </p>
                                                                <p className="text-xs text-slate-400 mt-1">
                                                                    Exemplo: DF=15%, DV=20%, ML=10% → Markup = 45÷55 × 100 = 81,82%
                                                                </p>
                                                            </div>
                                                            <Separator className="my-4 bg-slate-700" />
                                                            <div className="space-y-2 text-sm">
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div className="text-slate-400">Custo Base:</div>
                                                                    <div className="text-right">{formatCurrency(costBreakdown.baseCost)}</div>

                                                                    <div className="text-green-400">Markup ({markup}%):</div>
                                                                    <div className="text-right text-green-400 font-medium">+{formatCurrency(costBreakdown.markupAmount)}</div>

                                                                    {costBreakdown.contractDiscount.percentage > 0 && (
                                                                        <>
                                                                            <div className="text-orange-400">Desconto Contrato ({costBreakdown.contractDiscount.percentage}%):</div>
                                                                            <div className="text-right text-orange-400">-{formatCurrency(costBreakdown.contractDiscount.amount)}</div>
                                                                        </>
                                                                    )}

                                                                    {costBreakdown.directorDiscount.percentage > 0 && (
                                                                        <>
                                                                            <div className="text-orange-400">Desconto Diretor ({costBreakdown.directorDiscount.percentage}%):</div>
                                                                            <div className="text-right text-orange-400">-{formatCurrency(costBreakdown.directorDiscount.amount)}</div>
                                                                        </>
                                                                    )}

                                                                    <div className="border-t border-slate-700 pt-2 font-semibold">Preço Final:</div>
                                                                    <div className="border-t border-slate-700 pt-2 text-right font-bold">{formatCurrency(costBreakdown.finalPrice)}</div>

                                                                    <div className="text-cyan-400 mt-2">Margem Líquida:</div>
                                                                    <div className="text-right mt-2">
                                                                        <span className={`font-bold ${costBreakdown.netMargin > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                            {costBreakdown.netMargin.toFixed(2)}%
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>

                                                </div>

                                                {/* Recursos Base (Custos) */}
                                                <Card className="bg-slate-900/80 border-slate-800 text-white">
                                                    <CardHeader className="flex flex-row items-center justify-between">
                                                        <CardTitle className="text-cyan-400">Recursos Base (Custos)</CardTitle>
                                                        <div className="flex gap-2">
                                                            {!editingCards.recursosBase ? (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => toggleCardEdit('recursosBase')}
                                                                    className="border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-slate-900"
                                                                >
                                                                    <Edit className="h-4 w-4 mr-1" />
                                                                    Editar
                                                                </Button>
                                                            ) : (
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => toggleCardEdit('recursosBase')}
                                                                        className="border-gray-400 text-gray-400 hover:bg-gray-400 hover:text-slate-900"
                                                                    >
                                                                        Cancelar
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => saveCard('recursosBase')}
                                                                        className="bg-green-600 hover:bg-green-700"
                                                                    >
                                                                        <Save className="h-4 w-4 mr-1" />
                                                                        Salvar
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                            <div>
                                                                <h4 className="text-cyan-400 mb-2">vCPU Windows (por core)</h4>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                    <div>
                                                                        <Label>Custo Mensal</Label>
                                                                        {editingCards.recursosBase ? (
                                                                            <Input
                                                                                value={formatBrazilianNumber(vcpuWindowsCost)}
                                                                                onChange={(e) => { setVcpuWindowsCost(parseFloat(e.target.value.replace(",", ".")) || 0); setHasChanged(true); }}
                                                                                className="bg-slate-800 border-slate-700"
                                                                            />
                                                                        ) : (
                                                                            <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                                R$ {formatBrazilianNumber(vcpuWindowsCost)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <Label className="text-green-400">Valor de Venda</Label>
                                                                        <div className="p-2 bg-green-900/30 border border-green-500/50 rounded text-green-400 font-semibold">
                                                                            R$ {formatBrazilianNumber(calculateSalePrice(vcpuWindowsCost))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <h4 className="text-cyan-400 mb-2">vCPU Linux (por core)</h4>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                    <div>
                                                                        <Label>Custo Mensal</Label>
                                                                        {editingCards.recursosBase ? (
                                                                            <Input
                                                                                value={formatBrazilianNumber(vcpuLinuxCost)}
                                                                                onChange={(e) => { setVcpuLinuxCost(parseFloat(e.target.value.replace(",", ".")) || 0); setHasChanged(true); }}
                                                                                className="bg-slate-800 border-slate-700"
                                                                            />
                                                                        ) : (
                                                                            <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                                R$ {formatBrazilianNumber(vcpuLinuxCost)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <Label className="text-green-400">Valor de Venda</Label>
                                                                        <div className="p-2 bg-green-900/30 border border-green-500/50 rounded text-green-400 font-semibold">
                                                                            R$ {formatBrazilianNumber(calculateSalePrice(vcpuLinuxCost))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="mt-6">
                                                            <h4 className="text-cyan-400 mb-4">RAM (por GB)</h4>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                <div>
                                                                    <Label>Custo Mensal</Label>
                                                                    {editingCards.recursosBase ? (
                                                                        <Input
                                                                            value={formatBrazilianNumber(ramCost)}
                                                                            onChange={(e) => { setRamCost(parseFloat(e.target.value.replace(",", ".")) || 0); setHasChanged(true); }}
                                                                            className="bg-slate-800 border-slate-700"
                                                                        />
                                                                    ) : (
                                                                        <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                            R$ {formatBrazilianNumber(ramCost)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <Label className="text-green-400">Valor de Venda</Label>
                                                                    <div className="p-2 bg-green-900/30 border border-green-500/50 rounded text-green-400 font-semibold">
                                                                        R$ {formatBrazilianNumber(calculateSalePrice(ramCost))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>

                                                {/* Armazenamento (Custos) */}
                                                <Card className="bg-slate-900/80 border-slate-800 text-white">
                                                    <CardHeader className="flex flex-row items-center justify-between">
                                                        <CardTitle className="text-cyan-400">Armazenamento (Custos)</CardTitle>
                                                        <div className="flex gap-2">
                                                            {!editingCards.armazenamento ? (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => toggleCardEdit('armazenamento')}
                                                                    className="border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-slate-900"
                                                                >
                                                                    <Edit className="h-4 w-4 mr-1" />
                                                                    Editar
                                                                </Button>
                                                            ) : (
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => toggleCardEdit('armazenamento')}
                                                                        className="border-gray-400 text-gray-400 hover:bg-gray-400 hover:text-slate-900"
                                                                    >
                                                                        Cancelar
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => saveCard('armazenamento')}
                                                                        className="bg-green-600 hover:bg-green-700"
                                                                    >
                                                                        <Save className="h-4 w-4 mr-1" />
                                                                        Salvar
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                                            <div>
                                                                <h4 className="text-cyan-400 mb-4">HDD SAS</h4>
                                                                <div className="space-y-3">
                                                                    <div>
                                                                        <Label>Custo Mensal</Label>
                                                                        {editingCards.armazenamento ? (
                                                                            <Input
                                                                                value={formatBrazilianNumber(hddSasCost)}
                                                                                onChange={(e) => { setHddSasCost(parseFloat(e.target.value.replace(",", ".")) || 0); setHasChanged(true); }}
                                                                                className="bg-slate-800 border-slate-700"
                                                                            />
                                                                        ) : (
                                                                            <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                                R$ {formatBrazilianNumber(hddSasCost)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <Label className="text-green-400">Valor de Venda</Label>
                                                                        <div className="p-2 bg-green-900/30 border border-green-500/50 rounded text-green-400 font-semibold">
                                                                            R$ {formatBrazilianNumber(calculateSalePrice(hddSasCost))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <h4 className="text-cyan-400 mb-4">SSD Performance</h4>
                                                                <div className="space-y-3">
                                                                    <div>
                                                                        <Label>Custo Mensal</Label>
                                                                        {editingCards.armazenamento ? (
                                                                            <Input
                                                                                value={formatBrazilianNumber(ssdPerformanceCost)}
                                                                                onChange={(e) => { setSsdPerformanceCost(parseFloat(e.target.value.replace(",", ".")) || 0); setHasChanged(true); }}
                                                                                className="bg-slate-800 border-slate-700"
                                                                            />
                                                                        ) : (
                                                                            <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                                R$ {formatBrazilianNumber(ssdPerformanceCost)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <Label className="text-green-400">Valor de Venda</Label>
                                                                        <div className="p-2 bg-green-900/30 border border-green-500/50 rounded text-green-400 font-semibold">
                                                                            R$ {formatBrazilianNumber(calculateSalePrice(ssdPerformanceCost))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <h4 className="text-cyan-400 mb-4">NVMe</h4>
                                                                <div className="space-y-3">
                                                                    <div>
                                                                        <Label>Custo Mensal</Label>
                                                                        {editingCards.armazenamento ? (
                                                                            <Input
                                                                                value={formatBrazilianNumber(nvmeCost)}
                                                                                onChange={(e) => { setNvmeCost(parseFloat(e.target.value.replace(",", ".")) || 0); setHasChanged(true); }}
                                                                                className="bg-slate-800 border-slate-700"
                                                                            />
                                                                        ) : (
                                                                            <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                                R$ {formatBrazilianNumber(nvmeCost)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <Label className="text-green-400">Valor de Venda</Label>
                                                                        <div className="p-2 bg-green-900/30 border border-green-500/50 rounded text-green-400 font-semibold">
                                                                            R$ {formatBrazilianNumber(calculateSalePrice(nvmeCost))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>

                                                {/* Placa de Rede e Sistema Operacional */}
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                    <Card className="bg-slate-900/80 border-slate-800 text-white">
                                                        <CardHeader className="flex flex-row items-center justify-between">
                                                            <CardTitle className="text-cyan-400">Placa de Rede (Custos)</CardTitle>
                                                            <div className="flex gap-2">
                                                                {!editingCards.placaRede ? (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => toggleCardEdit('placaRede')}
                                                                        className="border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-slate-900"
                                                                    >
                                                                        <Edit className="h-4 w-4 mr-1" />
                                                                        Editar
                                                                    </Button>
                                                                ) : (
                                                                    <div className="flex gap-2">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => toggleCardEdit('placaRede')}
                                                                            className="border-gray-400 text-gray-400 hover:bg-gray-400 hover:text-slate-900"
                                                                        >
                                                                            Cancelar
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            onClick={() => saveCard('placaRede')}
                                                                            className="bg-green-600 hover:bg-green-700"
                                                                        >
                                                                            <Save className="h-4 w-4 mr-1" />
                                                                            Salvar
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent className="space-y-4">
                                                            <div>
                                                                <h4 className="text-cyan-400 mb-2">1 Gbps</h4>
                                                                <div className="space-y-3">
                                                                    <div>
                                                                        <Label>Custo Mensal</Label>
                                                                        {editingCards.placaRede ? (
                                                                            <Input
                                                                                value={formatBrazilianNumber(network1GbpsCost)}
                                                                                onChange={(e) => { setNetwork1GbpsCost(parseFloat(e.target.value.replace(",", ".")) || 0); setHasChanged(true); }}
                                                                                className="bg-slate-800 border-slate-700"
                                                                            />
                                                                        ) : (
                                                                            <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                                R$ {formatBrazilianNumber(network1GbpsCost)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <Label className="text-green-400">Valor de Venda</Label>
                                                                        <div className="p-2 bg-green-900/30 border border-green-500/50 rounded text-green-400 font-semibold">
                                                                            R$ {formatBrazilianNumber(calculateSalePrice(network1GbpsCost))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <h4 className="text-cyan-400 mb-2">10 Gbps</h4>
                                                                <div className="space-y-3">
                                                                    <div>
                                                                        <Label>Custo Mensal</Label>
                                                                        {editingCards.placaRede ? (
                                                                            <Input
                                                                                value={formatBrazilianNumber(network10GbpsCost)}
                                                                                onChange={(e) => { setNetwork10GbpsCost(parseFloat(e.target.value.replace(",", ".")) || 0); setHasChanged(true); }}
                                                                                className="bg-slate-800 border-slate-700"
                                                                            />
                                                                        ) : (
                                                                            <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                                R$ {formatBrazilianNumber(network10GbpsCost)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <Label className="text-green-400">Valor de Venda</Label>
                                                                        <div className="p-2 bg-green-900/30 border border-green-500/50 rounded text-green-400 font-semibold">
                                                                            R$ {formatBrazilianNumber(calculateSalePrice(network10GbpsCost))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>

                                                    <Card className="bg-slate-900/80 border-slate-800 text-white">
                                                        <CardHeader className="flex flex-row items-center justify-between">
                                                            <CardTitle className="text-cyan-400">Sistema Operacional e Serviços (Custos)</CardTitle>
                                                            <div className="flex gap-2">
                                                                {!editingCards.sistemaOperacional ? (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => toggleCardEdit('sistemaOperacional')}
                                                                        className="border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-slate-900"
                                                                    >
                                                                        <Edit className="h-4 w-4 mr-1" />
                                                                        Editar
                                                                    </Button>
                                                                ) : (
                                                                    <div className="flex gap-2">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => toggleCardEdit('sistemaOperacional')}
                                                                            className="border-gray-400 text-gray-400 hover:bg-gray-400 hover:text-slate-900"
                                                                        >
                                                                            Cancelar
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            onClick={() => saveCard('sistemaOperacional')}
                                                                            className="bg-green-600 hover:bg-green-700"
                                                                        >
                                                                            <Save className="h-4 w-4 mr-1" />
                                                                            Salvar
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent className="space-y-4">
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <h4 className="text-cyan-400 mb-2">Windows Server 2022 Standard</h4>
                                                                    <div className="space-y-3">
                                                                        <div>
                                                                            <Label>Custo Mensal</Label>
                                                                            {editingCards.sistemaOperacional ? (
                                                                                <Input
                                                                                    value={formatBrazilianNumber(windowsServerCost)}
                                                                                    onChange={(e) => { setWindowsServerCost(parseFloat(e.target.value.replace(",", ".")) || 0); setHasChanged(true); }}
                                                                                    className="bg-slate-800 border-slate-700"
                                                                                />
                                                                            ) : (
                                                                                <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                                    R$ {formatBrazilianNumber(windowsServerCost)}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <Label className="text-green-400">Valor de Venda</Label>
                                                                            <div className="p-2 bg-green-900/30 border border-green-500/50 rounded text-green-400 font-semibold">
                                                                                R$ {formatBrazilianNumber(calculateSalePrice(windowsServerCost))}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-cyan-400 mb-2">Windows 10 Pro</h4>
                                                                    <div className="space-y-3">
                                                                        <div>
                                                                            <Label>Custo Mensal</Label>
                                                                            {editingCards.sistemaOperacional ? (
                                                                                <Input
                                                                                    value={formatBrazilianNumber(windows10ProCost)}
                                                                                    onChange={(e) => { setWindows10ProCost(parseFloat(e.target.value.replace(",", ".")) || 0); setHasChanged(true); }}
                                                                                    className="bg-slate-800 border-slate-700"
                                                                                />
                                                                            ) : (
                                                                                <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                                    R$ {formatBrazilianNumber(windows10ProCost)}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <Label className="text-green-400">Valor de Venda</Label>
                                                                            <div className="p-2 bg-green-900/30 border border-green-500/50 rounded text-green-400 font-semibold">
                                                                                R$ {formatBrazilianNumber(calculateSalePrice(windows10ProCost))}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-cyan-400 mb-2">Windows 11 Pro</h4>
                                                                    <div className="space-y-3">
                                                                        <div>
                                                                            <Label>Custo Mensal</Label>
                                                                            {editingCards.sistemaOperacional ? (
                                                                                <Input
                                                                                    value={formatBrazilianNumber(windows11ProCost)}
                                                                                    onChange={(e) => { setWindows11ProCost(parseFloat(e.target.value.replace(",", ".")) || 0); setHasChanged(true); }}
                                                                                    className="bg-slate-800 border-slate-700"
                                                                                />
                                                                            ) : (
                                                                                <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                                    R$ {formatBrazilianNumber(windows11ProCost)}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <Label className="text-green-400">Valor de Venda</Label>
                                                                            <div className="p-2 bg-green-900/30 border border-green-500/50 rounded text-green-400 font-semibold">
                                                                                R$ {formatBrazilianNumber(calculateSalePrice(windows11ProCost))}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <h4 className="text-cyan-400 mb-2">Ubuntu Server 22.04 LTS</h4>
                                                                    <div className="space-y-3">
                                                                        <div>
                                                                            <Label>Custo Mensal</Label>
                                                                            {editingCards.sistemaOperacional ? (
                                                                                <Input
                                                                                    value={formatBrazilianNumber(ubuntuCost)}
                                                                                    onChange={(e) => { setUbuntuCost(parseFloat(e.target.value.replace(",", ".")) || 0); setHasChanged(true); }}
                                                                                    className="bg-slate-800 border-slate-700"
                                                                                />
                                                                            ) : (
                                                                                <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                                    R$ {formatBrazilianNumber(ubuntuCost)}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <Label className="text-green-400">Valor de Venda</Label>
                                                                            <div className="p-2 bg-green-900/30 border border-green-500/50 rounded text-green-400 font-semibold">
                                                                                R$ {formatBrazilianNumber(calculateSalePrice(ubuntuCost))}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-cyan-400 mb-2">CentOS Stream 9</h4>
                                                                    <div className="space-y-3">
                                                                        <div>
                                                                            <Label>Custo Mensal</Label>
                                                                            {editingCards.sistemaOperacional ? (
                                                                                <Input
                                                                                    value={formatBrazilianNumber(centosCost)}
                                                                                    onChange={(e) => { setCentosCost(parseFloat(e.target.value.replace(",", ".")) || 0); setHasChanged(true); }}
                                                                                    className="bg-slate-800 border-slate-700"
                                                                                />
                                                                            ) : (
                                                                                <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                                    R$ {formatBrazilianNumber(centosCost)}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <Label className="text-green-400">Valor de Venda</Label>
                                                                            <div className="p-2 bg-green-900/30 border border-green-500/50 rounded text-green-400 font-semibold">
                                                                                R$ {formatBrazilianNumber(calculateSalePrice(centosCost))}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <h4 className="text-cyan-400 mb-2">Debian 12</h4>
                                                                    <div>
                                                                        <Label>Custo Mensal</Label>
                                                                        {editingCards.sistemaOperacional ? (
                                                                            <Input
                                                                                value={formatBrazilianNumber(debianCost)}
                                                                                onChange={(e) => { setDebianCost(parseFloat(e.target.value.replace(",", ".")) || 0); setHasChanged(true); }}
                                                                                className="bg-slate-800 border-slate-700"
                                                                            />
                                                                        ) : (
                                                                            <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                                R$ {formatBrazilianNumber(debianCost)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-cyan-400 mb-2">Rocky Linux 9</h4>
                                                                    <div>
                                                                        <Label>Custo Mensal</Label>
                                                                        {editingCards.sistemaOperacional ? (
                                                                            <Input
                                                                                value={formatBrazilianNumber(rockyLinuxCost)}
                                                                                onChange={(e) => { setRockyLinuxCost(parseFloat(e.target.value.replace(",", ".")) || 0); setHasChanged(true); }}
                                                                                className="bg-slate-800 border-slate-700"
                                                                            />
                                                                        ) : (
                                                                            <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                                R$ {formatBrazilianNumber(rockyLinuxCost)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                </div>

                                                {/* Serviços Adicionais */}
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                    <Card className="bg-slate-900/80 border-slate-800 text-white">
                                                        <CardHeader className="flex flex-row items-center justify-between">
                                                            <CardTitle className="text-cyan-400">Backup Local (por GB)</CardTitle>
                                                            <div className="flex gap-2">
                                                                {!editingCards.backup ? (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => toggleCardEdit('backup')}
                                                                        className="border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-slate-900"
                                                                    >
                                                                        <Edit className="h-4 w-4 mr-1" />
                                                                        Editar
                                                                    </Button>
                                                                ) : (
                                                                    <div className="flex gap-2">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => toggleCardEdit('backup')}
                                                                            className="border-gray-400 text-gray-400 hover:bg-gray-400 hover:text-slate-900"
                                                                        >
                                                                            Cancelar
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            onClick={() => saveCard('backup')}
                                                                            className="bg-green-600 hover:bg-green-700"
                                                                        >
                                                                            <Save className="h-4 w-4 mr-1" />
                                                                            Salvar
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                <div>
                                                                    <Label>Custo Mensal</Label>
                                                                    {editingCards.backup ? (
                                                                        <Input
                                                                            value={formatBrazilianNumber(backupCostPerGb)}
                                                                            onChange={(e) => { setBackupCostPerGb(parseFloat(e.target.value.replace(",", ".")) || 0); setHasChanged(true); }}
                                                                            className="bg-slate-800 border-slate-700"
                                                                        />
                                                                    ) : (
                                                                        <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                            R$ {formatBrazilianNumber(backupCostPerGb)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <Label className="text-green-400">Valor de Venda</Label>
                                                                    <div className="p-2 bg-green-900/20 border border-green-500/50 rounded text-green-400">
                                                                        R$ {formatBrazilianNumber(calculateSalePrice(backupCostPerGb))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>

                                                    <Card className="bg-slate-900/80 border-slate-800 text-white">
                                                        <CardHeader className="flex flex-row items-center justify-between">
                                                            <CardTitle className="text-cyan-400">IP Adicional</CardTitle>
                                                            <div className="flex gap-2">
                                                                {!editingCards.ipAdicional ? (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => toggleCardEdit('ipAdicional')}
                                                                        className="border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-slate-900"
                                                                    >
                                                                        <Edit className="h-4 w-4 mr-1" />
                                                                        Editar
                                                                    </Button>
                                                                ) : (
                                                                    <div className="flex gap-2">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => toggleCardEdit('ipAdicional')}
                                                                            className="border-gray-400 text-gray-400 hover:bg-gray-400 hover:text-slate-900"
                                                                        >
                                                                            Cancelar
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            onClick={() => saveCard('ipAdicional')}
                                                                            className="bg-green-600 hover:bg-green-700"
                                                                        >
                                                                            <Save className="h-4 w-4 mr-1" />
                                                                            Salvar
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                <div>
                                                                    <Label>Custo Mensal</Label>
                                                                    {editingCards.ipAdicional ? (
                                                                        <Input
                                                                            value={formatBrazilianNumber(additionalIpCost)}
                                                                            onChange={(e) => { setAdditionalIpCost(parseFloat(e.target.value.replace(",", ".")) || 0); setHasChanged(true); }}
                                                                            className="bg-slate-800 border-slate-700"
                                                                        />
                                                                    ) : (
                                                                        <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                            R$ {formatBrazilianNumber(additionalIpCost)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <Label className="text-green-400">Valor de Venda</Label>
                                                                    <div className="p-2 bg-green-900/20 border border-green-500/50 rounded text-green-400">
                                                                        R$ {formatBrazilianNumber(calculateSalePrice(additionalIpCost))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                </div>

                                                {/* Snapshot e VPN */}
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                    <Card className="bg-slate-900/80 border-slate-800 text-white">
                                                        <CardHeader className="flex flex-row items-center justify-between">
                                                            <CardTitle className="text-cyan-400">Snapshot Adicional</CardTitle>
                                                            <div className="flex gap-2">
                                                                {!editingCards.snapshot ? (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => toggleCardEdit('snapshot')}
                                                                        className="border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-slate-900"
                                                                    >
                                                                        <Edit className="h-4 w-4 mr-1" />
                                                                        Editar
                                                                    </Button>
                                                                ) : (
                                                                    <div className="flex gap-2">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => toggleCardEdit('snapshot')}
                                                                            className="border-gray-400 text-gray-400 hover:bg-gray-400 hover:text-slate-900"
                                                                        >
                                                                            Cancelar
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            onClick={() => saveCard('snapshot')}
                                                                            className="bg-green-600 hover:bg-green-700"
                                                                        >
                                                                            <Save className="h-4 w-4 mr-1" />
                                                                            Salvar
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                <div>
                                                                    <Label>Custo Mensal</Label>
                                                                    {editingCards.snapshot ? (
                                                                        <Input
                                                                            value={formatBrazilianNumber(snapshotCost)}
                                                                            onChange={(e) => { setSnapshotCost(parseFloat(e.target.value.replace(",", ".")) || 0); setHasChanged(true); }}
                                                                            className="bg-slate-800 border-slate-700"
                                                                        />
                                                                    ) : (
                                                                        <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                            R$ {formatBrazilianNumber(snapshotCost)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <Label className="text-green-400">Valor de Venda</Label>
                                                                    <div className="p-2 bg-green-900/20 border border-green-500/50 rounded text-green-400">
                                                                        R$ {formatBrazilianNumber(calculateSalePrice(snapshotCost))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>

                                                    <Card className="bg-slate-900/80 border-slate-800 text-white">
                                                        <CardHeader className="flex flex-row items-center justify-between">
                                                            <CardTitle className="text-cyan-400">VPN Site-to-Site</CardTitle>
                                                            <div className="flex gap-2">
                                                                {!editingCards.vpnSiteToSite ? (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => toggleCardEdit('vpnSiteToSite')}
                                                                        className="border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-slate-900"
                                                                    >
                                                                        <Edit className="h-4 w-4 mr-1" />
                                                                        Editar
                                                                    </Button>
                                                                ) : (
                                                                    <div className="flex gap-2">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => toggleCardEdit('vpnSiteToSite')}
                                                                            className="border-gray-400 text-gray-400 hover:bg-gray-400 hover:text-slate-900"
                                                                        >
                                                                            Cancelar
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            onClick={() => saveCard('vpnSiteToSite')}
                                                                            className="bg-green-600 hover:bg-green-700"
                                                                        >
                                                                            <Save className="h-4 w-4 mr-1" />
                                                                            Salvar
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                <div>
                                                                    <Label>Custo Mensal</Label>
                                                                    {editingCards.vpnSiteToSite ? (
                                                                        <Input
                                                                            value={formatBrazilianNumber(vpnSiteToSiteCost)}
                                                                            onChange={(e) => { setVpnSiteToSiteCost(parseFloat(e.target.value.replace(",", ".")) || 0); setHasChanged(true); }}
                                                                            className="bg-slate-800 border-slate-700"
                                                                        />
                                                                    ) : (
                                                                        <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                            R$ {formatBrazilianNumber(vpnSiteToSiteCost)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <Label className="text-green-400">Valor de Venda</Label>
                                                                    <div className="p-2 bg-green-900/20 border border-green-500/50 rounded text-green-400">
                                                                        R$ {formatBrazilianNumber(calculateSalePrice(vpnSiteToSiteCost))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                </div>

                                                {/* Prazos Contratuais e Descontos */}
                                                <Card className="bg-slate-900/80 border-slate-800 text-white">
                                                    <CardHeader className="flex flex-row items-center justify-between">
                                                        <CardTitle className="text-cyan-400">Prazos Contratuais e Descontos</CardTitle>
                                                        <div className="flex gap-2">
                                                            {!editingCards.prazosContratuais ? (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => toggleCardEdit('prazosContratuais')}
                                                                    className="border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-slate-900"
                                                                >
                                                                    <Edit className="h-4 w-4 mr-1" />
                                                                    Editar
                                                                </Button>
                                                            ) : (
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => toggleCardEdit('prazosContratuais')}
                                                                        className="border-gray-400 text-gray-400 hover:bg-gray-400 hover:text-slate-900"
                                                                    >
                                                                        Cancelar
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => saveCard('prazosContratuais')}
                                                                        className="bg-green-600 hover:bg-green-700"
                                                                    >
                                                                        <Save className="h-4 w-4 mr-1" />
                                                                        Salvar
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                                                            <div>
                                                                <h4 className="text-cyan-400 mb-2">12 Meses</h4>
                                                                <div>
                                                                    <Label>Desconto (%)</Label>
                                                                    {editingCards.prazosContratuais ? (
                                                                        <Input
                                                                            value={contractDiscounts[12]}
                                                                            onChange={(e) => { setContractDiscounts(prev => ({ ...prev, 12: parseFloat(e.target.value.replace(",", ".")) || 0 })); setHasChanged(true); }}
                                                                            className="bg-slate-800 border-slate-700"
                                                                        />
                                                                    ) : (
                                                                        <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                            {contractDiscounts[12]}%
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <h4 className="text-cyan-400 mb-2">24 Meses</h4>
                                                                <div>
                                                                    <Label>Desconto (%)</Label>
                                                                    {editingCards.prazosContratuais ? (
                                                                        <Input
                                                                            value={contractDiscounts[24]}
                                                                            onChange={(e) => { setContractDiscounts(prev => ({ ...prev, 24: parseFloat(e.target.value.replace(",", ".")) || 0 })); setHasChanged(true); }}
                                                                            className="bg-slate-800 border-slate-700"
                                                                        />
                                                                    ) : (
                                                                        <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                            {contractDiscounts[24]}%
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <h4 className="text-cyan-400 mb-2">36 Meses</h4>
                                                                <div>
                                                                    <Label>Desconto (%)</Label>
                                                                    {editingCards.prazosContratuais ? (
                                                                        <Input
                                                                            value={contractDiscounts[36]}
                                                                            onChange={(e) => { setContractDiscounts(prev => ({ ...prev, 36: parseFloat(e.target.value.replace(",", ".")) || 0 })); setHasChanged(true); }}
                                                                            className="bg-slate-800 border-slate-700"
                                                                        />
                                                                    ) : (
                                                                        <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                            {contractDiscounts[36]}%
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <h4 className="text-cyan-400 mb-2">48 Meses</h4>
                                                                <div>
                                                                    <Label>Desconto (%)</Label>
                                                                    {editingCards.prazosContratuais ? (
                                                                        <Input
                                                                            value={contractDiscounts[48]}
                                                                            onChange={(e) => { setContractDiscounts(prev => ({ ...prev, 48: parseFloat(e.target.value.replace(",", ".")) || 0 })); setHasChanged(true); }}
                                                                            className="bg-slate-800 border-slate-700"
                                                                        />
                                                                    ) : (
                                                                        <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                            {contractDiscounts[48]}%
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <h4 className="text-cyan-400 mb-2">60 Meses</h4>
                                                                <div>
                                                                    <Label>Desconto (%)</Label>
                                                                    {editingCards.prazosContratuais ? (
                                                                        <Input
                                                                            value={contractDiscounts[60]}
                                                                            onChange={(e) => { setContractDiscounts(prev => ({ ...prev, 60: parseFloat(e.target.value.replace(",", ".")) || 0 })); setHasChanged(true); }}
                                                                            className="bg-slate-800 border-slate-700"
                                                                        />
                                                                    ) : (
                                                                        <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                            {contractDiscounts[60]}%
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>

                                                {/* Taxa de Setup */}
                                                <Card className="bg-slate-900/80 border-slate-800 text-white">
                                                    <CardHeader className="flex flex-row items-center justify-between">
                                                        <CardTitle className="text-cyan-400">Taxa de Setup</CardTitle>
                                                        <div className="flex gap-2">
                                                            {!editingCards.taxaSetup ? (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => toggleCardEdit('taxaSetup')}
                                                                    className="border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-slate-900"
                                                                >
                                                                    <Edit className="h-4 w-4 mr-1" />
                                                                    Editar
                                                                </Button>
                                                            ) : (
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => toggleCardEdit('taxaSetup')}
                                                                        className="border-gray-400 text-gray-400 hover:bg-gray-400 hover:text-slate-900"
                                                                    >
                                                                        Cancelar
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => saveCard('taxaSetup')}
                                                                        className="bg-green-600 hover:bg-green-700"
                                                                    >
                                                                        <Save className="h-4 w-4 mr-1" />
                                                                        Salvar
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div>
                                                            <h4 className="text-cyan-400 mb-4">Taxa de Setup Geral</h4>
                                                            <div>
                                                                <Label>Valor Base</Label>
                                                                {editingCards.taxaSetup ? (
                                                                    <Input
                                                                        value={formatBrazilianNumber(setupFee)}
                                                                        onChange={(e) => { setSetupFee(parseFloat(e.target.value.replace(",", ".")) || 0); setHasChanged(true); }}
                                                                        className="bg-slate-800 border-slate-700"
                                                                    />
                                                                ) : (
                                                                    <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                        R$ {formatBrazilianNumber(setupFee)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>

                                                {/* Gestão e Suporte */}
                                                <Card className="bg-slate-900/80 border-slate-800 text-white">
                                                    <CardHeader className="flex flex-row items-center justify-between">
                                                        <CardTitle className="text-cyan-400">Gestão e Suporte</CardTitle>
                                                        <div className="flex gap-2">
                                                            {!editingCards.gestaoSuporte ? (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => toggleCardEdit('gestaoSuporte')}
                                                                    className="border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-slate-900"
                                                                >
                                                                    <Edit className="h-4 w-4 mr-1" />
                                                                    Editar
                                                                </Button>
                                                            ) : (
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => toggleCardEdit('gestaoSuporte')}
                                                                        className="border-gray-400 text-gray-400 hover:bg-gray-400 hover:text-slate-900"
                                                                    >
                                                                        Cancelar
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => saveCard('gestaoSuporte')}
                                                                        className="bg-green-600 hover:bg-green-700"
                                                                    >
                                                                        <Save className="h-4 w-4 mr-1" />
                                                                        Salvar
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <div>
                                                            <h4 className="text-cyan-400 mb-4">Serviço Mensal de Gestão e Suporte</h4>
                                                            <div>
                                                                <Label>Valor Mensal</Label>
                                                                {editingCards.gestaoSuporte ? (
                                                                    <Input
                                                                        value={formatBrazilianNumber(managementAndSupportCost)}
                                                                        onChange={(e) => { setManagementAndSupportCost(parseFloat(e.target.value.replace(",", ".")) || 0); setHasChanged(true); }}
                                                                        className="bg-slate-800 border-slate-700"
                                                                    />
                                                                ) : (
                                                                    <div className="p-2 bg-slate-800 border border-slate-700 rounded text-white">
                                                                        R$ {formatBrazilianNumber(managementAndSupportCost)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>


                                            </div>
                                        </TabsContent>
                                        )}

                                        <TabsContent value="proposal">
                                            <div className="space-y-6 mt-6">
                                                <Card className="bg-slate-900/80 border-slate-800 text-white">
                                                    <CardHeader>
                                                        <CardTitle className="flex items-center gap-2">
                                                            <FileText className="h-5 w-5" />
                                                            Resumo da Proposta
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        {addedProducts.length === 0 ? (
                                                            <div className="text-center py-8 text-slate-400">
                                                                <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                                                <p>Nenhuma VM adicionada à proposta ainda.</p>
                                                                <p className="text-sm">Configure uma VM na aba &quot;Calculadora VM&quot; e clique em &quot;Adicionar à Proposta&quot;.</p>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="mb-4">
                                                                    <Label htmlFor="proposal-status" className="mb-2 block">Status da Proposta</Label>
                                                                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                                                        <SelectTrigger id="proposal-status" className="bg-slate-800 border-slate-700 text-white">
                                                                            <SelectValue placeholder="Selecione o status" />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="bg-slate-800 text-white">
                                                                            <SelectItem value="Aguardando Aprovação Diretoria">Aguardando Aprovação Diretoria</SelectItem>
                                                                            <SelectItem value="Aguardando Aprovação do Cliente">Aguardando Aprovação do Cliente</SelectItem>
                                                                            <SelectItem value="Proposta Enviada">Proposta Enviada</SelectItem>
                                                    <SelectItem value="Renovação">Renovação</SelectItem>
                                                    <SelectItem value="Fechado Ganho">Fechado Ganho</SelectItem>
                                                                            <SelectItem value="Perdido">Perdido</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>

                                                                <div className="mb-4">
                                                                    <Label htmlFor="proposal-temperature" className="mb-2 block">Temperatura do Negócio</Label>
                                                                    <Select value={selectedForecastTemperature} onValueChange={setSelectedForecastTemperature}>
                                                                        <SelectTrigger id="proposal-temperature" className="bg-slate-800 border-slate-700 text-white">
                                                                            <SelectValue placeholder="Selecione a temperatura" />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="bg-slate-800 text-white">
                                                                            <SelectItem value="0">0%</SelectItem>
                                                                            <SelectItem value="25">25%</SelectItem>
                                                                            <SelectItem value="50">50%</SelectItem>
                                                                            <SelectItem value="75">75%</SelectItem>
                                                                            <SelectItem value="100">100%</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>

                                                                <div className="mb-4">
                                                                    <Label htmlFor="proposal-changes" className="mb-2 block">Alterações</Label>
                                                                    <textarea
                                                                        id="proposal-changes"
                                                                        value={proposalChanges}
                                                                        onChange={(e) => setProposalChanges(e.target.value)}
                                                                        placeholder="Descreva as alterações feitas nesta versão da proposta..."
                                                                        className="w-full p-3 bg-slate-800 border border-slate-700 text-white rounded-md resize-none"
                                                                        rows={3}
                                                                    />
                                                                </div>
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow className="border-slate-700">
                                                                            <TableHead className="text-white">Descrição</TableHead>
                                                                            <TableHead className="text-white">Setup</TableHead>
                                                                            <TableHead className="text-white">Mensal/VM</TableHead>
                                                                            <TableHead className="text-white">Mensal Total</TableHead>
                                                                            <TableHead className="text-white w-20">Ações</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {addedProducts.map(p => (
                                                                            <TableRow key={p.id} className="border-slate-800">
                                                                                <TableCell className="text-white">{p.description}</TableCell>
                                                                                <TableCell className="text-white">{formatCurrency(p.setup)}</TableCell>
                                                                                <TableCell className="text-white">
                                                                                    {p.details?.unitMonthly ? formatCurrency(p.details.unitMonthly) :
                                                                                        (p.details?.quantity ? formatCurrency(p.monthly / p.details.quantity) : formatCurrency(p.monthly))}
                                                                                </TableCell>
                                                                                <TableCell className="text-white">{formatCurrency(p.monthly)}</TableCell>
                                                                                <TableCell>
                                                                                    <Button
                                                                                        variant="destructive"
                                                                                        size="sm"
                                                                                        onClick={() => handleRemoveProduct(p.id)}
                                                                                    >
                                                                                        <Trash2 className="h-4 w-4" />
                                                                                    </Button>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>

                                                                {/* Controles de Desconto */}
                                                                <div className="space-y-4 p-4 bg-slate-800 rounded-lg mt-4">
                                                                    {(!isDirector && !isAdmin) && (
                                                                        <div className="flex items-center space-x-2">
                                                                            <Checkbox
                                                                                id="salesperson-discount-toggle"
                                                                                checked={applySalespersonDiscount}
                                                                                onCheckedChange={(checked) => setApplySalespersonDiscount(!!checked)}
                                                                            />
                                                                            <Label htmlFor="salesperson-discount-toggle">Aplicar Desconto Vendedor (5%)</Label>
                                                                        </div>
                                                                    )}
                                                                    {(isDirector || isAdmin) && (
                                                                        <div className="space-y-2">
                                                                            <Label htmlFor="director-discount">Desconto Diretor (%)</Label>
                                                                            <div className="flex items-center space-x-2">
                                                                                <Input
                                                                                    id="director-discount"
                                                                                    type="number"
                                                                                    value={directorDiscountPercentage}
                                                                                    onChange={(e) => {
                                                                                        const value = Number(e.target.value);
                                                                                        setDirectorDiscountPercentage(value);
                                                                                        setAppliedDirectorDiscountPercentage(value);
                                                                                    }}
                                                                                    placeholder="0-100"
                                                                                    min="0"
                                                                                    max="100"
                                                                                    className="bg-slate-700 border-slate-600 text-white"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {isAdmin && (
                                                                        <div className="flex items-center space-x-2">
                                                                            <Checkbox
                                                                                id="admin-salesperson-discount-toggle"
                                                                                checked={applySalespersonDiscount}
                                                                                onCheckedChange={(checked) => setApplySalespersonDiscount(!!checked)}
                                                                            />
                                                                            <Label htmlFor="admin-salesperson-discount-toggle">Aplicar Desconto Vendedor (5%)</Label>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="space-y-2 pt-4 border-t border-slate-700">
                                                                    {applySalespersonDiscount && (
                                                                        <div className="flex justify-between text-orange-400">
                                                                            <span>Desconto Vendedor (5%) - Apenas Mensal:</span>
                                                                            <span>-{formatCurrency(addedProducts.reduce((sum, p) => sum + p.monthly, 0) * 0.05)}</span>
                                                                        </div>
                                                                    )}
                                                                    {appliedDirectorDiscountPercentage > 0 && (
                                                                        <div className="flex justify-between text-orange-400">
                                                                            <span>Desconto Diretor ({appliedDirectorDiscountPercentage}%) - Apenas Mensal:</span>
                                                                            <span>-{formatCurrency(addedProducts.reduce((sum, p) => sum + p.monthly, 0) * (applySalespersonDiscount ? 0.95 : 1) * (appliedDirectorDiscountPercentage / 100))}</span>
                                                                        </div>
                                                                    )}
                                                                    <div className="flex justify-between items-center font-bold text-lg">
                                                                        <div>
                                                                            Total Setup: <span className="text-green-400">{formatCurrency(addedProducts.reduce((sum, p) => sum + p.setup, 0))}</span>
                                                                        </div>
                                                                        <div>
                                                                            Total Mensal: <span className="text-green-400">{formatCurrency(addedProducts.reduce((sum, p) => sum + p.monthly, 0) * (applySalespersonDiscount ? 0.95 : 1) * (1 - appliedDirectorDiscountPercentage / 100))}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex gap-4 pt-4">
                                                                    <Button
                                                                        className="bg-green-600 hover:bg-green-700"
                                                                        onClick={() => setActiveTab('calculator')}
                                                                    >
                                                                        <Plus className="h-4 w-4 mr-2" />
                                                                        Adicionar Mais VMs
                                                                    </Button>
                                                                    <Button
                                                                        variant="outline"
                                                                        className="bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                                                                    >
                                                                        <Download className="h-4 w-4 mr-2" />
                                                                        Gerar Proposta
                                                                    </Button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        </TabsContent>
                                    </Tabs>
                                </div>

                                <div className="flex justify-end gap-4 mt-8">
                                    {/* Botão "Salvar como Nova Versão" - Sempre cria uma nova versão da proposta */}
                                    {currentProposal?.id && (
                                        <Button
                                            onClick={() => {
                                                if (currentProposal.id) {
                                                    handleSave(currentProposal.id, true);
                                                }
                                            }}
                                            className="bg-blue-600 hover:bg-blue-700"
                                            disabled={addedProducts.length === 0}
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Salvar como Nova Versão
                                        </Button>
                                    )}
                                    {/* Botão "Atualizar/Salvar Proposta" - Atualiza a proposta existente ou cria nova */}
                                    <ProposalApprovalRequestButton
                                        proposalId={currentProposal?.id}
                                        disabled={!currentProposal?.id || addedProducts.length === 0}
                                        onRequested={() => {
                                            if (currentProposal) {
                                                setCurrentProposal({
                                                    ...currentProposal,
                                                    status: 'Aguardando Aprovação Diretoria',
                                                });
                                            }
                                        }}
                                        onApproved={() => {
                                            if (currentProposal) {
                                                setCurrentProposal({
                                                    ...currentProposal,
                                                    status: 'Aprovada',
                                                });
                                            }
                                        }}
                                    />
                                    <Button 
                                        onClick={() => {
                                            if (currentProposal?.id) {
                                                // Atualizar proposta existente
                                                handleSave(currentProposal.id, false);
                                            } else {
                                                // Criar nova proposta
                                                saveProposal();
                                            }
                                        }} 
                                        className="bg-green-600 hover:bg-green-700" 
                                        disabled={addedProducts.length === 0}
                                    >
                                        <Save className="h-4 w-4 mr-2" />
                                        {currentProposal ? 'Atualizar Proposta' : 'Salvar Proposta'}
                                    </Button>
                                    <Button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700" disabled={addedProducts.length === 0}>
                                        <Download className="h-4 w-4 mr-2" />
                                        Gerar PDF
                                    </Button>
                                    <Button variant="outline" onClick={() => setViewMode('search')}>Cancelar</Button>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div >

            <div id="print-area" className="print-only">
                {currentProposal && (
                    <>
                        <div className="print-header">
                            <h1>Proposta Comercial</h1>
                            <p><strong>Proposta ID:</strong> {currentProposal.id}</p>
                            <p><strong>Cliente:</strong> {clientData.name}</p>
                            <p><strong>Gerente:</strong> {accountManagerData.name}</p>
                            <p><strong>Data:</strong> {new Date(currentProposal.createdAt).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <h2>Itens da Proposta</h2>
                        <table className="print-table">
                            <thead><tr><th>Descrição</th><th>Setup</th><th>Mensal</th></tr></thead>
                            <tbody>
                                {addedProducts.map(p => (
                                    <tr key={p.id}><td>{p.description}</td><td>{formatCurrency(p.setup)}</td><td>{formatCurrency(p.monthly)}</td></tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="print-totals">
                            <h3>Total Geral</h3>
                            <p><strong>Total Instalação:</strong> {formatCurrency(addedProducts.reduce((sum, p) => sum + p.setup, 0))}</p>
                            <p><strong>Total Mensal {(applySalespersonDiscount || appliedDirectorDiscountPercentage > 0) ? '(com desconto)' : ''}:</strong> {formatCurrency(applyDiscounts(addedProducts.reduce((sum, p) => sum + p.monthly, 0)))}</p>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}

export default MaquinasVirtuaisCalculator;
