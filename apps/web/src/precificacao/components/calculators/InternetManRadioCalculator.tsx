
import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CommissionTablesUnified from './CommissionTablesUnified';
import { Separator } from '@/components/ui/separator';
import { ClientManagerForm } from './ClientManagerForm';
import { ProposalApprovalRequestButton } from '@/components/proposals/ProposalApprovalRequestButton';
import { ProposalStatusBadge } from '@/components/proposals/ProposalStatusBadge';
import { ProposalApprovalInfo } from '@/components/proposals/ProposalApprovalInfo';
import { ConvertToB2BOpportunityButton } from '@/components/proposals/ConvertToB2BOpportunityButton';
import { ClientManagerInfo } from './ClientManagerInfo';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/use-auth';
import { useCommissions, getCommissionRate, getChannelIndicatorCommissionRate, getChannelInfluencerCommissionRate, getChannelSellerCommissionRate, getSellerCommissionRate, getDirectorCommissionRate } from '@/hooks/use-commissions';
import { useDeepLinkedProposal } from '@/hooks/use-deep-linked-proposal';
import { Proposal, UserProfile, ClientData, AccountManagerData } from '@/lib/types';
import { getPermissionsForRole, normalizeUserRole } from '@/lib/permissions';
import { generateNextProposalId } from '@/lib/proposal-id-generator'; // Importar a interface Proposal, UserProfile, ClientData e AccountManagerData do arquivo centralizado


import {
    Wifi,
    Calculator,
    FileText,
    Plus,
    Edit,
    Save,
    Download,
    Trash2,
    ArrowLeft
} from 'lucide-react';
import { getCRMAuthHeaders } from '@/config/api';

// Componente isolado para seletor de prazo contratual
const ContractTermSelector = memo(({ value, onChange }: { value: number; onChange: (value: string) => void }) => {
    return (
        <div className="space-y-2">
            <Label htmlFor="contract-term">Prazo Contratual</Label>
            <Select onValueChange={onChange} value={value.toString()}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="12">12 meses</SelectItem>
                    <SelectItem value="24">24 meses</SelectItem>
                    <SelectItem value="36">36 meses</SelectItem>
                    <SelectItem value="48">48 meses</SelectItem>
                    <SelectItem value="60">60 meses</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
});

ContractTermSelector.displayName = 'ContractTermSelector';

// Interfaces
export interface Product {
    id: string;
    type: 'REDE_MAN_MPLS_RADIO';
    description: string;
    setup: number;
    monthly: number;
    details: {
        speed?: number;
        contractTerm?: number;
        includeInstallation?: boolean;
        planDescription?: string;
        fiberCost?: number;
        applySalespersonDiscount?: boolean;
        appliedDirectorDiscountPercentage?: number;
        includeReferralPartner?: boolean;
        [key: string]: any;
    };
}

interface RadioPlan {
    speed: number;
    price12: number;
    price24: number;
    price36: number;
    price48: number;
    price60: number;
    installationCost: number;
    description: string;
    baseCost: number;
    radioCost: number;
}

// Helper function to get monthly price based on contract term
const getMonthlyPrice = (plan: RadioPlan, term: number): number => {
    switch (term) {
        case 12: return plan.price12;
        case 24: return plan.price24;
        case 36: return plan.price36;
        case 48: return plan.price48;
        case 60: return plan.price60;
        default: return 0;
    }
};

const getMaxPaybackMonths = (contractTerm: number): number => {
    // Valores máximos permitidos conforme o print das "Informações de Contrato"
    switch (contractTerm) {
        case 12: return 8;  // Contratos de 12 meses - Payback máximo 8 meses
        case 24: return 10; // Contratos de 24 meses - Payback máximo 10 meses
        case 36: return 11; // Contratos de 36 meses - Payback máximo 11 meses
        case 48: return 13; // Contratos de 48 meses - Payback máximo 13 meses
        case 60: return 14; // Contratos de 60 meses - Payback máximo 14 meses
        default: return Math.floor(contractTerm / 2);
    }
};

const calculatePayback = (
    params: {
        installationFee: number; // Receita no mes 0
        manCost: number; // Investimento inicial (custo do projeto)
        monthlyRevenue: number; // Receita mensal (mes 1..N)
        contractTerm: number; // Quantidade de meses de mensalidade
        speedMbps: number; // Usado para custo de banda (speed * banda)
        simplesNacionalPct: number; // % sobre receita
        custoDespPct: number; // % sobre receita
        bandaCostPerMbps: number; // custo unitario por Mbps (ex: 2.09)
        createLastMile: boolean;
        lastMileMultiplier: number; // multiplicador sobre a mensalidade (ex: 1.75)
        totalCommissions: number; // Comissoes (pagas no mes 1)
    }
): number => {
    const {
        installationFee,
        manCost,
        monthlyRevenue,
        contractTerm,
        speedMbps,
        simplesNacionalPct,
        custoDespPct,
        bandaCostPerMbps,
        createLastMile,
        lastMileMultiplier,
        totalCommissions
    } = params;

    const term = Math.max(0, Math.floor(Number(contractTerm) || 0));
    const receitaMensal = Number(monthlyRevenue) || 0;
    const setup = Number(installationFee) || 0;
    const investimentoInicial = Number(manCost) || 0;

    const simplesRate = (Number(simplesNacionalPct) || 0) / 100;
    const custoDespRate = (Number(custoDespPct) || 0) / 100;

    // Mes 0: receita apenas da taxa de instalacao. Despesas: simples nacional + custo/despesas + investimento inicial.
    let cumulativeBalance = -investimentoInicial;
    const impostosMes0 = setup * simplesRate;
    const custoDespMes0 = setup * custoDespRate;
    cumulativeBalance += setup - impostosMes0 - custoDespMes0;
    if (cumulativeBalance >= 0) return 0;

    if (receitaMensal <= 0) return term;

    // Mes 1..N: receita mensal; despesas: banda OU last mile, simples nacional, comissoes (mes 1), custo/despesas.
    for (let month = 1; month <= term; month++) {
        const impostos = receitaMensal * simplesRate;
        const custoDesp = receitaMensal * custoDespRate;

        const custoBandaOuLastMile = createLastMile
            ? (() => {
                const mult = Number(lastMileMultiplier) || 0;
                if (mult <= 0) return 0;
                const base = receitaMensal / mult; // receita sem last mile
                return Math.max(0, receitaMensal - base); // custo de last mile como adicional (pass-through)
            })()
            : (Number(speedMbps) || 0) * (Number(bandaCostPerMbps) || 0);

        const comissoes = month === 1 ? (Number(totalCommissions) || 0) : 0;

        const netFlow = receitaMensal - custoBandaOuLastMile - impostos - comissoes - custoDesp;
        cumulativeBalance += netFlow;

        if (cumulativeBalance >= 0) return month;
    }

    return term; // Se não conseguir recuperar no prazo
};

const validatePayback = (
    params: Parameters<typeof calculatePayback>[0]
): { isValid: boolean, actualPayback: number, maxPayback: number } => {
    const actualPayback = calculatePayback(params);
    const maxPayback = getMaxPaybackMonths(params.contractTerm);

    return {
        isValid: actualPayback <= maxPayback && actualPayback >= 0,
        actualPayback,
        maxPayback
    };
};

// As tabelas de comissões agora são gerenciadas pelo hook useCommissions

// Function to handle tax rate changes
const handleTaxRateChange = (taxType: string, value: string) => {
    // Remove non-numeric characters and convert to number
    const numericValue = parseFloat(value.replace(/[^0-9,.]+/g, "").replace(",", ".")) || 0;
    return numericValue;
};

interface InternetManRadioCalculatorProps {
    onBackToDashboard?: () => void;
    initialProposalId?: string | null;
}

const InternetManRadioCalculator: React.FC<InternetManRadioCalculatorProps> = ({ onBackToDashboard, initialProposalId }) => {
    // Estados principais
    const [viewMode, setViewMode] = useState<'search' | 'client-form' | 'calculator' | 'proposal-summary'>('search');
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [currentProposal, setCurrentProposal] = useState<Proposal | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [hasChanged, setHasChanged] = useState<boolean>(false);

    // Estados do cliente
    const [clientData, setClientData] = useState<ClientData>({ name: '', contact: '', projectName: '', email: '', phone: '' });
    const [accountManagerData, setAccountManagerData] = useState<AccountManagerData>({ name: '', email: '', phone: '' });

    // Estados do produto
    const [addedProducts, setAddedProducts] = useState<Product[]>([]);
    const [radioPlans, setRadioPlans] = useState<RadioPlan[]>([]);
    const [selectedStatus, setSelectedStatus] = useState<string>('Aguardando Aprovação do Cliente');
    const [selectedForecastTemperature, setSelectedForecastTemperature] = useState<string>('50');
    const [proposalChanges, setProposalChanges] = useState<string>('');

    // Estados da calculadora
    const [selectedSpeed, setSelectedSpeed] = useState<number>(0);
    const [contractTerm, setContractTerm] = useState<number>(12);
    const [includeInstallation, setIncludeInstallation] = useState<boolean>(true);
    const [isExistingClient, setIsExistingClient] = useState(false);
    const [previousMonthlyFee, setPreviousMonthlyFee] = useState(0);
    const [createLastMile, setCreateLastMile] = useState(false);
    const [lastMilePercentage, setLastMilePercentage] = useState(1.75);
    const [projectValue, setProjectValue] = useState<number>(0);
    const [directorDiscountPercentage, setDirectorDiscountPercentage] = useState<number>(0);
    const [appliedDirectorDiscountPercentage, setAppliedDirectorDiscountPercentage] = useState<number>(0);
    const [applySalespersonDiscount, setApplySalespersonDiscount] = useState<boolean>(false);
    const [includeReferralPartner, setIncludeReferralPartner] = useState<boolean>(false);
    const [includeInfluencerPartner, setIncludeInfluencerPartner] = useState<boolean>(false);

    // Detectar mudanças nos valores para mostrar botão de nova versão
    useEffect(() => {
        if (currentProposal?.id) {
            setHasChanged(true);
        }
    }, [selectedSpeed, contractTerm, includeInstallation, applySalespersonDiscount, appliedDirectorDiscountPercentage, includeReferralPartner, createLastMile, lastMilePercentage, clientData, accountManagerData, currentProposal?.id]);

    // Carregar descontos quando currentProposal mudar - FORÇADO
    useEffect(() => {
        console.log('🔄 useEffect EXECUTADO - currentProposal:', currentProposal?.id, 'viewMode:', viewMode);
        
        if (currentProposal) {
            console.log('🔄 Dados da proposta:', {
                applySalespersonDiscount: currentProposal.applySalespersonDiscount,
                appliedDirectorDiscountPercentage: currentProposal.appliedDirectorDiscountPercentage
            });
            
            // FORÇAR aplicação dos descontos
            const salespersonValue = Boolean(currentProposal.applySalespersonDiscount);
            const directorValue = Number(currentProposal.appliedDirectorDiscountPercentage) || 0;
            
            console.log('🔄 FORÇANDO aplicação:', { salespersonValue, directorValue });
            
            setApplySalespersonDiscount(salespersonValue);
            setAppliedDirectorDiscountPercentage(directorValue);
            setDirectorDiscountPercentage(directorValue);
            
            console.log('✅ Descontos aplicados via useEffect');
        }
    }, [currentProposal?.id, currentProposal?.applySalespersonDiscount, currentProposal?.appliedDirectorDiscountPercentage]);

    // Hook para comissões editáveis
    const { channelIndicator, channelInfluencer, channelSeller, seller, channelDirector } = useCommissions();

    // Função para obter taxa de comissão do Parceiro Indicador usando as tabelas editáveis
    // Usa apenas o valor mensal para buscar o percentual na tabela de comissões
    const getPartnerIndicatorRate = (monthlyRevenue: number, contractMonths: number): number => {
        if (!channelIndicator || !includeReferralPartner) return 0;
        return getChannelIndicatorCommissionRate(channelIndicator, monthlyRevenue, contractMonths) / 100;
    };

    // Função para obter taxa de comissão do Parceiro Influenciador usando as tabelas editáveis
    // Usa apenas o valor mensal para buscar o percentual na tabela de comissões
    const getPartnerInfluencerRate = (monthlyRevenue: number, contractMonths: number): number => {
        if (!channelInfluencer || !includeInfluencerPartner) return 0;
        return getChannelInfluencerCommissionRate(channelInfluencer, monthlyRevenue, contractMonths) / 100;
    };

    // Estados para DRE e tributação
    const [isEditingTaxes, setIsEditingTaxes] = useState<boolean>(false);
    const [commissionPercentage, setCommissionPercentage] = useState<number>(0);
    const [taxRates, setTaxRates] = useState({
        simplesNacional: 15.00,
        cssl: 0.00,
        inss: 11,
        iss: 5,
        totalTaxes: 15.00,
        banda: 2.09,
        fundraising: 0.00,
        rate: 0.00,
        margem: 0.00,
        custoDesp: 10.00
    });

    // Estados para regime tributário
    const [selectedTaxRegime, setSelectedTaxRegime] = useState<string>('lucro_real');
    const [taxRegimeValues, setTaxRegimeValues] = useState({
        iss: '5.00'
    });

    // Estados para mark-up e comissões
    const [markup, setMarkup] = useState<number>(100);
    const [markupType, setMarkupType] = useState<'cost' | 'price'>('cost');

    // Estados para custos adicionais
    const [setupFee, setSetupFee] = useState<number>(500);
    const [managementAndSupportCost, setManagementAndSupportCost] = useState<number>(0);

    // Estados para descontos
    const [contractDiscounts, setContractDiscounts] = useState<{ [key: number]: number }>({
        12: 0,
        24: 5,
        36: 10,
        48: 15,
        60: 20,
    });

    // Hooks
    const { user }: { user: UserProfile | null } = useAuth();
    const normalizedRole = normalizeUserRole(user?.role);
    const isAdmin = normalizedRole === 'admin' || normalizedRole === 'master';
    const isDirector = normalizedRole === 'director';

    // Verificar permissões do usuário
    const userPermissions = user?.role ? getPermissionsForRole(user.role as any) : null;
    const canEditCommissions = userPermissions?.canEditCommissions || false;

    // Estado para debounce do contractTerm
    const [debouncedContractTerm, setDebouncedContractTerm] = useState(contractTerm);
    // Key única para forçar re-mount quando necessário
    const [componentKey, setComponentKey] = useState(0);

    // Debounce effect para contractTerm
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedContractTerm(contractTerm);
            // Força re-mount do componente para evitar conflitos DOM
            setComponentKey(prev => prev + 1);
        }, 150); // Aumentado para 150ms
        return () => clearTimeout(timer);
    }, [contractTerm]);

    // Funções otimizadas com useCallback para evitar re-renders
    const handleContractTermChange = useCallback((value: string) => {
        setContractTerm(Number(value));
    }, []);

    // Partner indicator ranges handled by getPartnerIndicatorRate

    // Total de comissoes (pagas no mes 1 no calculo de payback)
    const calculateTotalCommissions = useCallback((monthlyRevenue: number, contractMonths: number): number => {
        const temParceiros = includeReferralPartner || includeInfluencerPartner;

        const baseParaComissao = isExistingClient
            ? (monthlyRevenue - previousMonthlyFee)
            : monthlyRevenue;

        const baseParaComissaoContrato = isExistingClient && previousMonthlyFee > 0
            ? Math.max(0, (monthlyRevenue - previousMonthlyFee) * contractMonths)
            : monthlyRevenue * contractMonths;

        let comissaoVendedor = 0;
        if (baseParaComissaoContrato > 0) {
            if (temParceiros && channelSeller) {
                const percentualVendedor = getChannelSellerCommissionRate(channelSeller, contractMonths) / 100;
                comissaoVendedor = baseParaComissaoContrato * percentualVendedor;
            } else if (!temParceiros && seller) {
                const percentualVendedor = getSellerCommissionRate(seller, contractMonths) / 100;
                comissaoVendedor = baseParaComissaoContrato * percentualVendedor;
            }
        }

        let comissaoParceiroIndicador = 0;
        if (baseParaComissaoContrato > 0 && includeReferralPartner && channelIndicator) {
            const percentualIndicador = getChannelIndicatorCommissionRate(channelIndicator, baseParaComissao, contractMonths) / 100;
            comissaoParceiroIndicador = baseParaComissaoContrato * percentualIndicador;
        }

	        let comissaoParceiroInfluenciador = 0;
	        if (baseParaComissaoContrato > 0 && includeInfluencerPartner && channelInfluencer) {
	            const percentualInfluenciador = getChannelInfluencerCommissionRate(channelInfluencer, baseParaComissao, contractMonths) / 100;
	            comissaoParceiroInfluenciador = baseParaComissaoContrato * percentualInfluenciador;
	        }

	        let comissaoDiretor = 0;
	        if (baseParaComissaoContrato > 0 && channelDirector) {
	            const percentualDiretor = getDirectorCommissionRate(channelDirector, contractMonths) / 100;
	            comissaoDiretor = baseParaComissaoContrato * percentualDiretor;
	        }

	        return comissaoVendedor + comissaoDiretor + comissaoParceiroIndicador + comissaoParceiroInfluenciador;
	    }, [
	        includeReferralPartner,
	        includeInfluencerPartner,
	        isExistingClient,
	        previousMonthlyFee,
	        channelSeller,
	        seller,
	        channelIndicator,
	        channelInfluencer,
	        channelDirector
	    ]);

    // Calculate the selected fiber plan based on the chosen speed (usando debounced value)
    const result = useMemo(() => {
        if (!selectedSpeed) return null;
        const plan = radioPlans.find(p => p.speed === selectedSpeed);
        if (!plan) return null;

        let monthlyPrice = getMonthlyPrice(plan, debouncedContractTerm);

        // Aplicar descontos
        if (applySalespersonDiscount) {
            monthlyPrice = monthlyPrice * 0.95;
        }
        if (appliedDirectorDiscountPercentage > 0) {
            const directorDiscountFactor = 1 - (appliedDirectorDiscountPercentage / 100);
            monthlyPrice = monthlyPrice * directorDiscountFactor;
        }

        // Aplicar 20% de acréscimo se há parceiros (Indicador ou Influenciador)
        const temParceiros = includeReferralPartner || includeInfluencerPartner;
        if (temParceiros) {
            monthlyPrice = monthlyPrice * 1.20; // Acréscimo de 20%
            console.log('Acréscimo de 20% aplicado no result.monthlyPrice:', monthlyPrice);
        }

        // Last Mile: multiplica a mensalidade pelo fator informado (padrao 1.75)
        if (createLastMile) {
            const rawMultiplier = Number(lastMilePercentage);
            const multiplier = Number.isFinite(rawMultiplier) && rawMultiplier > 0 ? rawMultiplier : 1.75;
            monthlyPrice = monthlyPrice * multiplier;
        }

        return {
            ...plan,
            monthlyPrice,
            installationCost: plan.installationCost,
            baseCost: plan.baseCost,
            radioCost: plan.radioCost,
            paybackValidation: (() => {
                const totalCommissions = calculateTotalCommissions(monthlyPrice, contractTerm);
                return validatePayback({
                    installationFee: includeInstallation ? plan.installationCost : 0,
                    manCost: plan.radioCost,
                    monthlyRevenue: monthlyPrice,
                    contractTerm,
                    speedMbps: plan.speed,
                    simplesNacionalPct: taxRates.simplesNacional,
                    custoDespPct: taxRates.custoDesp,
                    bandaCostPerMbps: taxRates.banda,
                    createLastMile,
                    lastMileMultiplier: lastMilePercentage,
                    totalCommissions
                });
            })()
        };
    }, [
        selectedSpeed,
        radioPlans,
        debouncedContractTerm,
        includeReferralPartner,
        includeInfluencerPartner,
        applySalespersonDiscount,
        appliedDirectorDiscountPercentage,
        includeInstallation,
        createLastMile,
        lastMilePercentage,
        calculateTotalCommissions,
        contractTerm,
        taxRates.simplesNacional,
        taxRates.custoDesp,
        taxRates.banda
    ]);

    // Calculate the selected fiber plan based on the chosen speed (usando debounced value)
    const fetchProposals = React.useCallback(async () => {
        if (!user || !user.role) {
            setProposals([]);
            return;
        }

        try {
            // Buscar TODAS as propostas para evitar IDs duplicados
            const response = await fetch('/api/simulator/proposals?all=true', {
                method: 'GET',
                headers: getCRMAuthHeaders(),
            });

            if (response.ok) {
                const result = await response.json();
                // Filter for Rede Man/MPLS Radio proposals
                if (result.success && result.data && result.data.proposals) {
                    const manRadioProposals = result.data.proposals.filter((p: any) =>
                        p.type === 'REDE_MAN_MPLS_RADIO' ||
                        p.type === 'MANRADIO' ||
                        p.base_id?.startsWith('Prop_InterMan_Radio_') ||
                        p.base_id?.startsWith('Prop_ManRadio_') ||
                        p.base_id?.startsWith('Prop_Rede_Man/Radio_')
                    );
                    console.log(`📊 Total de propostas REDE_MAN_MPLS_RADIO carregadas: ${manRadioProposals.length}`);
                    setProposals(manRadioProposals);
                } else {
                    setProposals([]);
                }
            } else {
                console.error('Erro ao buscar propostas:', response.statusText);
                setProposals([]);
            }
        } catch (error) {
            console.error("Erro ao buscar propostas: ", error);
            setProposals([]);
        }
    }, [user]);

    useEffect(() => {
        const initialRadioPlans: RadioPlan[] = [
            { speed: 25, price12: 864.00, price24: 632.40, price36: 568.80, price48: 568.80, price60: 568.80, installationCost: 998.00, description: "25 Mbps", baseCost: 1580.00, radioCost: 3580.00 },
            { speed: 30, price12: 888.10, price24: 694.80, price36: 632.40, price48: 632.40, price60: 632.40, installationCost: 998.00, description: "30 Mbps", baseCost: 1580.00, radioCost: 3580.00 },
            { speed: 40, price12: 1098.01, price24: 758.40, price36: 694.80, price48: 694.80, price60: 694.80, installationCost: 998.00, description: "40 Mbps", baseCost: 1580.00, radioCost: 3580.00 },
            { speed: 50, price12: 1324.07, price24: 822.00, price36: 758.40, price48: 758.40, price60: 758.40, installationCost: 998.00, description: "50 Mbps", baseCost: 1580.00, radioCost: 3580.00 },
            { speed: 60, price12: 1856.93, price24: 948.00, price36: 884.40, price48: 884.40, price60: 884.40, installationCost: 998.00, description: "60 Mbps", baseCost: 1580.00, radioCost: 3580.00 },
            { speed: 80, price12: 2191.18, price24: 1200.00, price36: 1137.60, price48: 1137.60, price60: 1137.60, installationCost: 998.00, description: "80 Mbps", baseCost: 5700.00, radioCost: 6700.00 },
            { speed: 100, price12: 2420.46, price24: 1893.60, price36: 1579.20, price48: 1579.20, price60: 1579.20, installationCost: 1996.00, description: "100 Mbps", baseCost: 5700.00, radioCost: 6700.00 },
            { speed: 150, price12: 3051.82, price24: 2146.80, price36: 1832.40, price48: 1832.40, price60: 1832.40, installationCost: 1996.00, description: "150 Mbps", baseCost: 5700.00, radioCost: 6700.00 },
            { speed: 200, price12: 3859.18, price24: 2463.60, price36: 2084.40, price48: 2084.40, price60: 2084.40, installationCost: 1996.00, description: "200 Mbps", baseCost: 5700.00, radioCost: 6700.00 },
            { speed: 300, price12: 9026.40, price24: 5179.20, price36: 4800.00, price48: 4800.00, price60: 4800.00, installationCost: 2500.00, description: "300 Mbps", baseCost: 23300.00, radioCost: 23200.00 },
            { speed: 400, price12: 11362.80, price24: 6253.20, price36: 5683.20, price48: 5683.20, price60: 5683.20, installationCost: 2500.00, description: "400 Mbps", baseCost: 23300.00, radioCost: 25360.00 },
            { speed: 500, price12: 13408.80, price24: 6946.80, price36: 6303.60, price48: 6303.60, price60: 6303.60, installationCost: 2500.00, description: "500 Mbps", baseCost: 23300.00, radioCost: 25360.00 },
            { speed: 600, price12: 15000.00, price24: 7578.00, price36: 6948.00, price48: 6948.00, price60: 6948.00, installationCost: 2500.00, description: "600 Mbps", baseCost: 23300.00, radioCost: 25360.00 },
            { speed: 700, price12: 16560.00, price24: 8280.00, price36: 7560.00, price48: 7560.00, price60: 7560.00, installationCost: 2500.00, description: "700 Mbps", baseCost: 23300.00, radioCost: 25360.00 },
            { speed: 800, price12: 18000.00, price24: 9000.00, price36: 8160.00, price48: 8160.00, price60: 8160.00, installationCost: 2500.00, description: "800 Mbps", baseCost: 23300.00, radioCost: 25360.00 },
            { speed: 900, price12: 19440.00, price24: 9720.00, price36: 8760.00, price48: 8760.00, price60: 8760.00, installationCost: 2500.00, description: "900 Mbps", baseCost: 23300.00, radioCost: 25360.00 },
            { speed: 1000, price12: 21000.00, price24: 10500.00, price36: 9480.00, price48: 9480.00, price60: 9480.00, installationCost: 2500.00, description: "1000 Mbps (1 Gbps)", baseCost: 23300.00, radioCost: 25360.00 }
        ];
        // Force update with new radio cost values
        setRadioPlans(initialRadioPlans);
        // Save the updated values to localStorage
        localStorage.setItem('radioLinkPrices', JSON.stringify(initialRadioPlans));

        fetchProposals();
    }, [fetchProposals]);

    // Removed debug useEffect to prevent unnecessary re-renders

    // Funções
    const formatCurrency = (value: number | undefined | null) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    const formatPercentage = (value: number | undefined | null) => {
        return `${(value || 0).toFixed(2)}%`;
    };

    const generateUniqueId = () => {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    };

    const handlePriceChange = (index: number, field: keyof Omit<RadioPlan, 'description' | 'baseCost' | 'speed'>, value: string) => {
        const newPlans = [...radioPlans];
        const numericValue = parseFloat(value.replace(/[^0-9,.]+/g, "").replace(",", "."));
        if (!isNaN(numericValue)) {
            (newPlans[index] as any)[field] = numericValue;
            setRadioPlans(newPlans);
        }
    };

    const handleCustoRadioChange = (value: number) => {
        if (selectedSpeed) {
            const updatedPlans = radioPlans.map(plan =>
                plan.speed === selectedSpeed
                    ? { ...plan, radioCost: value }
                    : plan
            );
            setRadioPlans(updatedPlans);
            localStorage.setItem('radioLinkPrices', JSON.stringify(updatedPlans));
        }
    };

    // DRE calculations - Melhorado conforme solicitação
    // Dados base: Velocidade 600 Mbps, Taxa de instalação = 2500,00, Custo Rádio = 7000,00
    const velocidade = result?.speed || 600;
    const taxaInstalacao = includeInstallation ? (result?.installationCost || 2500) : 0;
    const custoRadio = result?.radioCost || 7000;

    // Função para aplicar descontos no total mensal
    const applyDiscounts = useCallback((baseTotal: number): number => {
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
    }, [applySalespersonDiscount, appliedDirectorDiscountPercentage]);

    // Função para calcular DRE por período de contrato
    const calculateDREForPeriod = useCallback((months: number) => {
        // CORREÇÃO: Receita mensal = valor mensal × número de meses do período
        // Ex: Para 12 meses = 12 × R$ 5.211,00 = R$ 62.532,00
        let monthlyValue = 0;
        let baseMonthlyValue = 0;
        let totalRevenue = 0;

        if (result) {
            // Usar sempre o valor mensal do período selecionado atualmente (contractTerm) com descontos aplicados
            monthlyValue = applyDiscounts(getMonthlyPrice(result, contractTerm));

            // Aplicar 20% de acréscimo se há parceiros (Indicador ou Influenciador)
            const temParceiros = includeReferralPartner || includeInfluencerPartner;
            console.log('DEBUG - InternetManRadio:', {
                includeReferralPartner,
                includeInfluencerPartner,
                temParceiros,
                monthlyValueBefore: monthlyValue
            });

            if (temParceiros) {
                const originalValue = monthlyValue;
                monthlyValue = monthlyValue * 1.20; // Acréscimo de 20%
                console.log('Acréscimo de 20% aplicado por parceiros - InternetManRadio:', {
                    original: originalValue,
                    withIncrease: monthlyValue
                });
            }

            baseMonthlyValue = monthlyValue;

            // Last Mile: multiplica a mensalidade pelo fator informado (padrao 1.75)
            if (createLastMile) {
                const rawMultiplier = Number(lastMilePercentage);
                const multiplier = Number.isFinite(rawMultiplier) && rawMultiplier > 0 ? rawMultiplier : 1.75;
                monthlyValue = monthlyValue * multiplier;
            }

            // Calcular receita total do período: valor mensal × meses
            totalRevenue = monthlyValue * months;
        }

        const receitaInstalacao = taxaInstalacao;
        const receitaTotalPrimeiromes = totalRevenue + receitaInstalacao;

        // CORREÇÃO: Custo de banda = velocidade × 2,09 × meses do período
        // Se Last Mile estiver marcado, não considerar custo da banda
        const velocidade = result?.speed || 0; // Velocidade em Mbps
        const custoBandaMensal = createLastMile ? 0 : velocidade * taxRates.banda; // Se Last Mile, custo = 0, senão 600 × 2,09 = 1.254,00
        const custoBanda = custoBandaMensal * months; // 1.254,00 × 12 = 15.048,00 (ou 0 se Last Mile)

        // Custo Rádio vem da calculadora conforme prazo contratual e velocidade
        const custoRadioCalculadora = custoRadio;

        const fundraising = 0; // Conforme tabela
        // Last Mile como custo mensal adicional (pass-through): (mensalidade_com_last_mile - mensalalidade_base) * meses
        const lastMile = createLastMile ? Math.max(0, (monthlyValue - baseMonthlyValue) * months) : 0;

        // CORREÇÃO: Impostos baseados na receita total (incluindo taxa de instalação)
        const simplesNacionalRate = taxRates.simplesNacional / 100;

        // Impostos sobre receita
        const simplesNacional = receitaTotalPrimeiromes * simplesNacionalRate;

        // CORREÇÃO: Cálculo das comissões seguindo o modelo do Internet Rádio
        // Se é cliente existente, comissão apenas sobre a diferença de valor
        const baseComissionValue = isExistingClient && previousMonthlyFee > 0
            ? Math.max(0, (monthlyValue - previousMonthlyFee) * months) // Comissão apenas sobre a diferença
            : totalRevenue; // Comissão apenas sobre valor mensal (sem taxa de instalação)

        // CORREÇÃO: Cálculo das comissões baseado no prazo do contrato
        // Exemplo: 12 meses, valor mensal 421,00, percentual 1,2% = 421,00 x 1,2% = 5,05 x 12 meses = 60,62
        // Para 24 meses: 421,00 x 2,4% = 10,10 x 24 meses = 242,49
        // Para efeito de DRE, repetir o valor do prazo contratual em todas as colunas

        // CORREÇÃO: Lógica correta das comissões
        // Se NÃO há parceiros: usar comissão do VENDEDOR
        // Se HÁ parceiros: usar comissão do CANAL/VENDEDOR + comissões dos parceiros

        const temParceiros = includeReferralPartner || includeInfluencerPartner;

        // CORREÇÃO: Calcular base para comissões
        // Se "Já é cliente da Base?" está marcado, usar diferença de valores
        // Senão, usar valor mensal total
        const baseParaComissao = isExistingClient
            ? (monthlyValue - previousMonthlyFee) // Diferença de valores
            : monthlyValue; // Valor total

        // Base para cálculo de comissões no DRE: usar diferença de valores do contrato total
        // CORREÇÃO: Usar result.monthlyPrice para consistência com o resumo da proposta
        const baseParaComissaoContrato = isExistingClient && previousMonthlyFee > 0 && result
            ? Math.max(0, (result.monthlyPrice - previousMonthlyFee) * months) // Diferença de valores do contrato (mínimo 0)
            : result ? result.monthlyPrice * months : monthlyValue * months; // Valor total do contrato

        console.log(`InternetManRadio - Base para comissão: ${baseParaComissao} (isExistingClient: ${isExistingClient})`);

        // Calcular comissão do vendedor/canal
        let comissaoVendedor = 0;
        if (baseParaComissaoContrato > 0) {
            if (temParceiros && channelSeller) {
                // Com parceiros: usar canal/vendedor
                const percentualVendedor = getChannelSellerCommissionRate(channelSeller, contractTerm) / 100;
                comissaoVendedor = baseParaComissaoContrato * percentualVendedor;
            } else if (!temParceiros && seller) {
                // Sem parceiros: usar vendedor
                const percentualVendedor = getSellerCommissionRate(seller, contractTerm) / 100;
                comissaoVendedor = baseParaComissaoContrato * percentualVendedor;
            }
        }

        // Calcular comissão do parceiro indicador (apenas se marcado)
        let comissaoParceiroIndicador = 0;
        if (baseParaComissaoContrato > 0 && includeReferralPartner && channelIndicator) {
            const percentualIndicador = getChannelIndicatorCommissionRate(channelIndicator, baseParaComissao, contractTerm) / 100;
            comissaoParceiroIndicador = baseParaComissaoContrato * percentualIndicador;
        }

        // Calcular comissão do parceiro influenciador (apenas se marcado)
        let comissaoParceiroInfluenciador = 0;
        if (baseParaComissaoContrato > 0 && includeInfluencerPartner && channelInfluencer) {
            const percentualInfluenciador = getChannelInfluencerCommissionRate(channelInfluencer, baseParaComissao, contractTerm) / 100;
            comissaoParceiroInfluenciador = baseParaComissaoContrato * percentualInfluenciador;
        }

        // Comissão Diretor (conforme tabela Comissão Diretor e prazo contratual selecionado)
        let comissaoDiretor = 0;
        if (baseParaComissaoContrato > 0 && channelDirector) {
            const percentualDiretor = getDirectorCommissionRate(channelDirector, contractTerm) / 100;
            comissaoDiretor = baseParaComissaoContrato * percentualDiretor;
        }

        // Total de comissões
        const totalComissoes = comissaoVendedor + comissaoDiretor + comissaoParceiroIndicador + comissaoParceiroInfluenciador;

        // Custo/Despesa: percentual configurado sobre receita total (incluindo taxa de instalação)
        const custoDespesa = receitaTotalPrimeiromes * ((taxRates.custoDesp || 0) / 100);

        // Balance (Lucro Líquido) conforme planilha
        // Balance = Receita Total - Custo do Projeto - Custo de banda - PIS - Comissões - Custo/Despesa
        const balance = receitaTotalPrimeiromes - custoRadioCalculadora - custoBanda - lastMile - simplesNacional - totalComissoes - custoDespesa;

        // Payback Calculation (mes 0 + mes 1..N)
        const paybackMonths = calculatePayback({
            installationFee: receitaInstalacao,
            manCost: custoRadioCalculadora,
            monthlyRevenue: monthlyValue,
            contractTerm: months,
            speedMbps: velocidade,
            simplesNacionalPct: taxRates.simplesNacional,
            custoDespPct: taxRates.custoDesp,
            bandaCostPerMbps: taxRates.banda,
            createLastMile,
            lastMileMultiplier: lastMilePercentage,
            totalCommissions: totalComissoes
        });

        // Cálculos financeiros corretos:

        // 1. Margem Líquida: (Lucro Líquido / Receita Total) * 100
        const margemLiquida = receitaTotalPrimeiromes > 0 ? (balance / receitaTotalPrimeiromes) * 100 : 0;

        // 2. ROI (Return on Investment): (Lucro Líquido / Investimento Inicial) * 100
        const valorInvestido = custoRadioCalculadora + lastMile + receitaInstalacao; // Investimento inicial total
        const roi = valorInvestido > 0 ? (balance / valorInvestido) * 100 : 0;

        // 3. ROI Anualizado: ROI ajustado para base anual
        const roiAnualizado = months > 0 ? (roi * 12) / months : 0;

        // Cálculos financeiros conforme planilha:

        // Rentabilidade % = (Balance / Custo do Projeto) * 100
        const rentabilidade = custoRadioCalculadora > 0 ? (balance / custoRadioCalculadora) * 100 : 0;

        // Lucratividade % = (Balance / Receita Total) * 100
        const lucratividade = receitaTotalPrimeiromes > 0 ? (balance / receitaTotalPrimeiromes) * 100 : 0;

        // 6. Markup: (Preço de Venda - Custo) / Custo * 100
        const totalCost = custoBanda + custoRadioCalculadora + lastMile + simplesNacional + totalComissoes + custoDespesa;
        const markup = totalCost > 0 ? ((receitaTotalPrimeiromes - totalCost) / totalCost) * 100 : 0;

        // Calcular diferença de valores contrato para clientes existentes
        // CORREÇÃO: Usar result.monthlyPrice para consistência com o resumo da proposta
        const diferencaMensal = isExistingClient && previousMonthlyFee > 0 && result
            ? (result.monthlyPrice - previousMonthlyFee)
            : 0;
        const diferencaValoresContrato = diferencaMensal * months;

        return {
            receitaMensal: totalRevenue, // Agora é receita total do período
            receitaInstalacao,
            receitaTotalPrimeiromes,
            custoRadio: custoRadioCalculadora, // Custo Rádio da calculadora
            custoBanda, // Custo de banda calculado como 2,09% da receita
            fundraising,
            lastMile,
            simplesNacional,
            comissaoVendedor,
            comissaoDiretor,
            comissaoParceiroIndicador,
            comissaoParceiroInfluenciador,
            totalComissoes,
            custoDespesa,
            balance,
            rentabilidade,
            lucratividade,
            margemLiquida,
            markup,
            roi,
            roiAnualizado,
            paybackMonths, // Adicionando o payback
            diferencaValoresContrato // Novo campo para DRE
        };
    }, [
        result,
        taxaInstalacao,
        custoRadio,
        taxRates.simplesNacional,
        taxRates.custoDesp,
        taxRates.banda,

        includeReferralPartner,
        includeInfluencerPartner,
        createLastMile,
        lastMilePercentage,
        isExistingClient,
        previousMonthlyFee,
        applyDiscounts,
        channelIndicator,
        channelInfluencer,
        channelSeller,
        channelDirector,
        contractTerm,
        seller
    ]);

    // Calcular DRE para todos os períodos usando useMemo
    const dreCalculations: any = useMemo(() => {
        const dre12 = calculateDREForPeriod(12);
        const dre24 = calculateDREForPeriod(24);
        const dre36 = calculateDREForPeriod(36);
        const dre48 = calculateDREForPeriod(48);
        const dre60 = calculateDREForPeriod(60);

        return {
            12: dre12,
            24: dre24,
            36: dre36,
            48: dre48,
            60: dre60,
            // CORREÇÃO: Valores corretos para resumo executivo
            receitaBruta: dre12.receitaMensal / 12, // Receita mensal real
            receitaLiquida: (dre12.receitaMensal - dre12.simplesNacional) / 12, // Receita líquida mensal
	            custoServico: dre12.custoRadio,
	            custoBanda: dre12.custoBanda,
	            taxaInstalacao: dre12.receitaInstalacao,
	            comissaoVendedor: dre12.comissaoVendedor,
	            comissaoDiretor: dre12.comissaoDiretor,
	            comissaoParceiroIndicador: dre12.comissaoParceiroIndicador,
	            comissaoParceiroInfluenciador: dre12.comissaoParceiroInfluenciador,
	            totalComissoes: dre12.totalComissoes,
            totalImpostos: dre12.simplesNacional,
            lucroOperacional: dre12.balance,
            lucroLiquido: dre12.balance / 12, // Lucro líquido mensal
            rentabilidade: dre12.rentabilidade,
            lucratividade: dre12.lucratividade,
            paybackMeses: result?.paybackValidation.actualPayback ?? 0,
        };
    }, [calculateDREForPeriod, result?.paybackValidation.actualPayback]);

    const handleSavePrices = () => {
        // Save the prices to local storage
        localStorage.setItem('radioLinkPrices', JSON.stringify(radioPlans));

        // Show success message or update UI as needed
        alert('Preços salvos com sucesso!');
    };

    const handleAddProduct = () => {
        if (!result) return;

        const newProduct: Product = {
            id: `prod-${Date.now()}`,
            type: 'REDE_MAN_MPLS_RADIO',
            description: `Rede Man/MPLS Radio ${result.speed} Mbps`,
            setup: includeInstallation ? result.installationCost : 0,
            monthly: result.monthlyPrice,
            details: {
                speed: result.speed,
                contractTerm,
                includeInstallation,
                planDescription: result.description,
                fiberCost: result.radioCost,
                applySalespersonDiscount,
                appliedDirectorDiscountPercentage,
                includeReferralPartner,
                includeInfluencerPartner,
                createLastMile,
                lastMilePercentage,
                paybackCalculated: result.paybackValidation.actualPayback,
                maxPayback: result.paybackValidation.maxPayback,
                paybackWithinLimit: result.paybackValidation.isValid
            }
        };

        setAddedProducts(prev => [...prev, newProduct]);
    };

    const handleRemoveProduct = (id: string) => {
        setAddedProducts((prev: Product[]) => prev.filter(p => p.id !== id));
    };

    const rawTotalSetup = addedProducts.reduce((sum: number, p: Product) => sum + p.setup, 0);
    const rawTotalMonthly = addedProducts.reduce((sum: number, p: Product) => sum + p.monthly, 0);

    // Apply salesperson discount (5% fixed)
    const salespersonDiscountFactor = applySalespersonDiscount ? 0.95 : 1;

    // Apply director discount (customizable)
    const directorDiscountFactor = 1 - (appliedDirectorDiscountPercentage / 100);



    // Desconto do vendedor e diretor aplicado apenas sobre o valor mensal, não sobre o setup
    const finalTotalSetup = rawTotalSetup; // Sem desconto no setup
    const finalTotalMonthly = rawTotalMonthly * salespersonDiscountFactor * directorDiscountFactor;

    // Função para determinar a versão baseada nos descontos aplicados
    const getProposalVersion = (): number => {
        if (appliedDirectorDiscountPercentage > 0) {
            return 3; // V3 para desconto do diretor
        } else if (applySalespersonDiscount) {
            return 2; // V2 para desconto do vendedor
        }
        return 1; // V1 versão base
    };

    const buildProductsForSave = (products: Product[]): Product[] => {
        return products.map((product) => ({
            ...product,
            details: {
                ...product.details,
                speed: selectedSpeed || product.details?.speed,
                contractTerm,
                includeInstallation,
                fiberCost: result?.radioCost ?? product.details?.fiberCost,
                applySalespersonDiscount,
                appliedDirectorDiscountPercentage,
                includeReferralPartner,
                includeInfluencerPartner,
                createLastMile,
                lastMilePercentage,
                paybackCalculated: result?.paybackValidation.actualPayback ?? product.details?.paybackCalculated,
                maxPayback: result?.paybackValidation.maxPayback ?? product.details?.maxPayback,
                paybackWithinLimit: result?.paybackValidation.isValid ?? product.details?.paybackWithinLimit,
            }
        }));
    };

    const saveProposal = async () => {
        if (!user) {
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
            const productsToSave = buildProductsForSave(addedProducts);
            const baseTotalMonthly = productsToSave.reduce((sum, p) => sum + p.monthly, 0);
            const totalSetup = productsToSave.reduce((sum, p) => sum + p.setup, 0);

            // Aplicar descontos no total mensal
            const finalTotalMonthly = applyDiscounts(baseTotalMonthly);
            const proposalVersion = getProposalVersion();

            // Se tiver uma proposta atual, atualiza (independente de ter descontos ou não)
            if (currentProposal?.id) {
                const proposalToUpdate = {
                    id: currentProposal.id,
                    title: `Proposta Rede Man/MPLS Radio V${proposalVersion} - ${clientData.companyName || clientData.name || 'Cliente'}`,
                    client: clientData.companyName || clientData.name || 'Cliente não informado',
                    value: finalTotalMonthly,
                    type: 'REDE_MAN_MPLS_RADIO',
                    status: currentProposal.status || 'Rascunho',
                    forecastTemperature: Number(selectedForecastTemperature),
                    updatedBy: user.email || user.id,
                    updatedAt: new Date().toISOString(),
                    // Manter dados originais importantes
                    createdBy: currentProposal.createdBy,
                    createdAt: currentProposal.createdAt,
                    baseId: currentProposal.baseId,
                    version: proposalVersion,
                    // Atualizar dados editáveis
                    clientData: clientData,
                    accountManager: accountManagerData,
                    products: productsToSave,
                    totalSetup: totalSetup,
                    totalMonthly: finalTotalMonthly,
                    contractPeriod: contractTerm,
                    baseTotalMonthly: baseTotalMonthly,
                    applySalespersonDiscount: applySalespersonDiscount,
                    appliedDirectorDiscountPercentage: appliedDirectorDiscountPercentage,
                    isExistingClient: isExistingClient,
                    previousMonthlyFee: previousMonthlyFee,
                    userId: user.id
                };

                const response = await fetch(`/api/simulator/proposals/${currentProposal.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(proposalToUpdate),
                });

                if (response.ok) {
                    const result = await response.json();
                    const updatedProposal = result.data || result;
                    alert(`Proposta ${updatedProposal.id} atualizada com sucesso!`);
                    setCurrentProposal(updatedProposal);
                } else {
                    throw new Error('Erro ao atualizar proposta');
                }
            } else {
                // Mapear propostas para o formato esperado pelo gerador
                const proposalsWithBaseId = proposals.map((p: any) => ({
                    base_id: p.base_id || p.baseId || ''
                }));
                
                // Gerar ID único para a proposta
                const baseId = generateNextProposalId(proposalsWithBaseId, 'REDE_MAN_MPLS_RADIO', proposalVersion);
                console.log('🆔 ID gerado para nova proposta MAN Rádio:', baseId);

                console.log('💾 Salvando nova proposta com descontos:', {
                    applySalespersonDiscount,
                    appliedDirectorDiscountPercentage
                });

                const proposalToSave = {
                    base_id: baseId,
                    title: `Proposta Rede Man/MPLS Radio V${proposalVersion} - ${clientData.companyName || clientData.name || 'Cliente'}`,
                    client: clientData.companyName || clientData.name || 'Cliente não informado',
                    value: finalTotalMonthly,
                    type: 'REDE_MAN_MPLS_RADIO',
                    status: selectedStatus,
                    forecastTemperature: Number(selectedForecastTemperature),
                    createdBy: user.email || user.id,
                    createdAt: new Date().toISOString(),
                    version: proposalVersion,
                    // Store additional data as metadata
                    clientData: clientData,
                    accountManager: accountManagerData,
                    products: productsToSave,
                    totalSetup: totalSetup,
                    totalMonthly: finalTotalMonthly,
                    contractPeriod: contractTerm,
                    baseTotalMonthly: baseTotalMonthly,
                    applySalespersonDiscount: applySalespersonDiscount,
                    appliedDirectorDiscountPercentage: appliedDirectorDiscountPercentage,
                    isExistingClient: isExistingClient,
                    previousMonthlyFee: previousMonthlyFee,
                    userId: user.id,
                    changes: proposalChanges,
                };

                console.log('📤 Enviando proposta nova:', JSON.stringify(proposalToSave, null, 2));
                console.log('🔍 Dados de cliente existente:', {
                    isExistingClient: proposalToSave.isExistingClient,
                    previousMonthlyFee: proposalToSave.previousMonthlyFee
                });

                const response = await fetch('/api/simulator/proposals', {
                    method: 'POST',
                    headers: getCRMAuthHeaders(),
                    body: JSON.stringify(proposalToSave),
                });

                if (response.ok) {
                    const result = await response.json();
                    const savedProposal = result.data || result;
                    console.log('✅ Proposta salva:', savedProposal);
                    alert(`Proposta ${savedProposal.id} salva com sucesso!`);
                    setCurrentProposal(savedProposal);
                } else {
                    throw new Error('Erro ao salvar proposta');
                }
            }

            await fetchProposals();
            // Não limpar o formulário imediatamente para permitir edição
            // clearForm();
            setViewMode('search');
        } catch (error) {
            console.error('Erro ao salvar proposta:', error);
            alert('Erro ao salvar proposta. Por favor, tente novamente.');
        }
    };

    // Função para salvar proposta (compatível com botão "Salvar como Nova Versão")
    const handleSave = async (proposalId?: string, saveAsNewVersion: boolean = false) => {
        if (!user?.id) {
            alert('Usuário não autenticado');
            return;
        }

        try {
            const productsToSave = buildProductsForSave(addedProducts);
            const baseTotalMonthly = productsToSave.reduce((sum, p) => sum + p.monthly, 0);
            const totalSetup = productsToSave.reduce((sum, p) => sum + p.setup, 0);
            const finalTotalMonthly = applyDiscounts(baseTotalMonthly);

            // IMPORTANTE: Verificar ATUALIZAR primeiro, depois NOVA VERSÃO
            if (saveAsNewVersion === false && currentProposal?.id) {
                // ATUALIZAR PROPOSTA EXISTENTE
                console.log('🔄 Atualizando proposta Rede Man/MPLS Radio existente:', currentProposal.id);
                
                const proposalToUpdate = {
                    title: `Proposta Rede Man/MPLS Radio - ${clientData.companyName || clientData.name || 'Cliente'}`,
                    client: clientData.companyName || clientData.name || 'Cliente não informado',
                    value: finalTotalMonthly,
                    status: selectedStatus,
                    forecastTemperature: Number(selectedForecastTemperature),
                    clientData: clientData,
                    accountManager: accountManagerData,
                    products: productsToSave,
                    totalSetup: totalSetup,
                    totalMonthly: finalTotalMonthly,
                    contractPeriod: contractTerm,
                    // Salvar descontos no metadata
                    metadata: {
                        baseTotalMonthly: baseTotalMonthly,
                        applySalespersonDiscount: applySalespersonDiscount,
                        appliedDirectorDiscountPercentage: appliedDirectorDiscountPercentage,
                        isExistingClient: isExistingClient,
                        previousMonthlyFee: previousMonthlyFee,
                        changes: proposalChanges,
                    }
                };

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
                    setProposals(prev => prev.map(p => p.id === updatedProposal.id ? updatedProposal : p));
                    
                    // 🔥 Redirecionar para tela de buscar propostas
                    setViewMode('search');
                } else {
                    throw new Error('Erro ao atualizar proposta');
                }
            } else if (saveAsNewVersion === true && currentProposal) {
                // CRIAR NOVA VERSÃO
                console.log('📝 Criando nova versão da proposta Rede Man/MPLS Radio');
                console.log('🔍 Descontos atuais:', {
                    applySalespersonDiscount,
                    appliedDirectorDiscountPercentage
                });
                
                const baseIdToUse = currentProposal.baseId || (currentProposal as any).base_id;
                if (!baseIdToUse) {
                    alert('Proposta atual não possui ID base válido');
                    return;
                }
                
                console.log('📦 Produtos preparados para nova versão:', productsToSave);
                
                const { generateNewVersion } = await import('@/lib/proposal-id-generator');
                const proposalsWithBaseId = proposals.map((p: any) => ({
                    base_id: p.base_id || p.baseId || ''
                }));
                const newBaseId = generateNewVersion(baseIdToUse, proposalsWithBaseId);
                
                const proposalToSave = {
                    base_id: newBaseId,
                    title: `Proposta Rede Man/MPLS Radio - ${clientData.companyName || clientData.name || 'Cliente'}_v${parseInt(newBaseId.match(/_v(\d+)$/)?.[1] || '1')}`,
                    client: clientData.companyName || clientData.name || 'Cliente não informado',
                    value: finalTotalMonthly,
                    type: 'REDE_MAN_MPLS_RADIO',
                    status: selectedStatus,
                    forecastTemperature: Number(selectedForecastTemperature),
                    date: new Date().toISOString(),
                    expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    version: parseInt(newBaseId.match(/_v(\d+)$/)?.[1] || '1'),
                    clientData: clientData,
                    accountManager: accountManagerData,
                    products: productsToSave,
                    totalSetup: totalSetup,
                    totalMonthly: finalTotalMonthly,
                    contractPeriod: contractTerm,
                    baseTotalMonthly: baseTotalMonthly,
                    applySalespersonDiscount: applySalespersonDiscount,
                    appliedDirectorDiscountPercentage: appliedDirectorDiscountPercentage,
                    isExistingClient: isExistingClient,
                    previousMonthlyFee: previousMonthlyFee,
                    changes: proposalChanges,
                };
                
                console.log('📤 Enviando proposta:', JSON.stringify(proposalToSave, null, 2));

                const response = await fetch('/api/simulator/proposals', {
                    method: 'POST',
                    headers: getCRMAuthHeaders(),
                    body: JSON.stringify(proposalToSave),
                });

                if (response.ok) {
                    const newProposal = await response.json();
                    const proposalData = newProposal.data || newProposal;
                    console.log('✅ Nova versão criada:', proposalData);
                    alert(`Nova versão criada com sucesso! ID: ${proposalData.baseId || proposalData.base_id}`);
                    
                    // Atualizar a proposta atual com os dados completos
                    setCurrentProposal(proposalData);
                    
                    // Recarregar todas as propostas para garantir dados atualizados
                    await fetchProposals();
                    
                    // 🔥 Redirecionar para tela de buscar propostas
                    setViewMode('search');
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
        }
    };

    const clearForm = () => {
        setClientData({ name: '', contact: '', projectName: '', email: '', phone: '' });
        setAccountManagerData({ name: '', email: '', phone: '' });
        setAddedProducts([]);
        setSelectedSpeed(0);
        setContractTerm(12);
        setIncludeInstallation(true);
        setProjectValue(0);
        setDirectorDiscountPercentage(0);
        setAppliedDirectorDiscountPercentage(0);
        setApplySalespersonDiscount(false);
        setCurrentProposal(null);
        setSelectedStatus('Aguardando Aprovação do Cliente');

    };

    const createNewProposal = () => {
        setViewMode('client-form');
        clearForm();
    };

    const viewProposal = (proposal: Proposal) => {
        console.log('👁️ VISUALIZANDO PROPOSTA:', proposal);
        console.log('👁️ Descontos na proposta:', {
            applySalespersonDiscount: proposal.applySalespersonDiscount,
            appliedDirectorDiscountPercentage: proposal.appliedDirectorDiscountPercentage,
            baseTotalMonthly: proposal.baseTotalMonthly,
            totalMonthly: proposal.totalMonthly
        });
        console.log('👁️ TODOS OS CAMPOS:', Object.keys(proposal));
        console.log('👁️ METADATA:', (proposal as any).metadata);
        console.log('👁️ isExistingClient:', proposal.isExistingClient);
        console.log('👁️ previousMonthlyFee:', proposal.previousMonthlyFee);
        
        // Verificar se os dados estão no metadata
        const metadata = (proposal as any).metadata;
        if (metadata) {
            console.log('👁️ Dados no metadata:', {
                isExistingClient: metadata.isExistingClient,
                previousMonthlyFee: metadata.previousMonthlyFee
            });
            
            // Se os dados estiverem no metadata, mover para o nível principal
            if (metadata.isExistingClient !== undefined) {
                proposal.isExistingClient = metadata.isExistingClient;
            }
            if (metadata.previousMonthlyFee !== undefined) {
                proposal.previousMonthlyFee = metadata.previousMonthlyFee;
            }
        }
        
        setCurrentProposal(proposal);

        // Handle client data - check if it's an object or string
        if (typeof proposal.client === 'object' && proposal.client !== null) {
            setClientData(proposal.client);
        } else if (typeof proposal.client === 'string') {
            setClientData({
                name: proposal.client,
                contact: '',
                projectName: '',
                email: '',
                phone: ''
            });
        } else if (proposal.clientData) {
            setClientData(proposal.clientData);
        }

        // Handle account manager data
        if (proposal.accountManager) {
            setAccountManagerData(proposal.accountManager as AccountManagerData);
        }

        // Handle products - check multiple possible locations and formats
        let products = [];
        // Tentar em proposal.products, metadata.products, proposal.items
        if (proposal.products && Array.isArray(proposal.products) && proposal.products.length > 0) {
            products = proposal.products;
        } else if (proposal.metadata?.products && Array.isArray(proposal.metadata.products) && proposal.metadata.products.length > 0) {
            products = proposal.metadata.products;
        } else if (proposal.items && Array.isArray(proposal.items)) {
            // Convert items to products format if needed
            products = proposal.items.map((item: any) => ({
                id: item.id || `item-${Date.now()}`,
                type: 'REDE_MAN_MPLS_RADIO',
                description: item.description || 'Rede Man/MPLS Radio',
                setup: item.setup || 0,
                monthly: item.monthly || 0,
                details: item.details || {}
            }));
        }

        setAddedProducts(products);

        // Load status and changes
        setSelectedStatus(proposal.status || 'Aguardando Aprovação do Cliente');
        setSelectedForecastTemperature(String((proposal as any).forecastTemperature ?? (proposal as any).metadata?.forecastTemperature ?? 50));
        setProposalChanges(proposal.changes || '');

        setViewMode('proposal-summary');
    };

    const editProposal = (proposal: Proposal) => {

        console.log('=== EDITANDO PROPOSTA ===');
        console.log('📋 Proposta completa:', proposal);
        console.log('🔍 Descontos na proposta:', {
            applySalespersonDiscount: proposal.applySalespersonDiscount,
            appliedDirectorDiscountPercentage: proposal.appliedDirectorDiscountPercentage,
            tipo_applySalespersonDiscount: typeof proposal.applySalespersonDiscount,
            tipo_appliedDirectorDiscountPercentage: typeof proposal.appliedDirectorDiscountPercentage
        });
        console.log('📦 Products:', proposal.products);
        console.log('📦 Items:', proposal.items);

        setCurrentProposal(proposal);

        // Handle client data - check if it's an object or string
        if (typeof proposal.client === 'object' && proposal.client !== null) {
            setClientData(proposal.client);
        } else if (typeof proposal.client === 'string') {
            setClientData({
                name: proposal.client,
                contact: '',
                projectName: '',
                email: '',
                phone: ''
            });
        } else if (proposal.clientData) {
            setClientData(proposal.clientData);
        }

        // Handle account manager data
        if (proposal.accountManager) {
            setAccountManagerData(proposal.accountManager as AccountManagerData);
        }

        // Handle products - check multiple possible locations and formats
        let products = [];
        // Tentar em proposal.products, metadata.products, proposal.items
        if (proposal.products && Array.isArray(proposal.products) && proposal.products.length > 0) {
            products = proposal.products;
        } else if (proposal.metadata?.products && Array.isArray(proposal.metadata.products) && proposal.metadata.products.length > 0) {
            products = proposal.metadata.products;
        } else if (proposal.items && Array.isArray(proposal.items)) {
            // Convert items to products format if needed
            products = proposal.items.map((item: any) => ({
                id: item.id || `item-${Date.now()}`,
                type: 'REDE_MAN_MPLS_RADIO',
                description: item.description || 'Rede Man/MPLS Radio',
                setup: item.setup || 0,
                monthly: item.monthly || 0,
                details: item.details || {}
            }));
        }

        console.log('Processed products:', products);
        setAddedProducts(products);

        // Carregar parâmetros do primeiro produto
        if (products && products.length > 0) {
            const firstProduct = products[0];
            console.log('📦 Carregando dados do produto:', firstProduct);

            if (firstProduct.details) {
                if (firstProduct.details.speed) {
                    setSelectedSpeed(firstProduct.details.speed);

                    // 🔥 CORREÇÃO: Restaurar custo salvo no plano para que result.radioCost reflita o valor persistido
                    // Nota: Este calculador salva radioCost como fiberCost nos detalhes do produto
                    const savedCost = firstProduct.details.fiberCost ?? firstProduct.details.radioCost;
                    if (savedCost !== undefined) {
                        const restoredPlans = radioPlans.map(plan =>
                            plan.speed === firstProduct.details.speed
                                ? { ...plan, radioCost: savedCost }
                                : plan
                        );
                        setRadioPlans(restoredPlans);
                        localStorage.setItem('radioLinkPrices', JSON.stringify(restoredPlans));
                    }
                }
                const proposalContractTerm = Number(
                    firstProduct.details.contractTerm ||
                    proposal.contractPeriod ||
                    (proposal as any).contract_period ||
                    0
                );
                if (proposalContractTerm > 0) {
                    setContractTerm(proposalContractTerm);
                }
                if (firstProduct.details.includeInstallation !== undefined) setIncludeInstallation(firstProduct.details.includeInstallation);
                if (firstProduct.details.includeReferralPartner !== undefined) setIncludeReferralPartner(firstProduct.details.includeReferralPartner);
                if (firstProduct.details.includeInfluencerPartner !== undefined) setIncludeInfluencerPartner(firstProduct.details.includeInfluencerPartner);
                if (firstProduct.details.createLastMile !== undefined) setCreateLastMile(Boolean(firstProduct.details.createLastMile));
                if (firstProduct.details.lastMilePercentage !== undefined) setLastMilePercentage(Number(firstProduct.details.lastMilePercentage) || 1.75);
            }
        }

        // CARREGAR DESCONTOS - Prioridade: proposta > produto
        let finalSalespersonDiscount = false;
        let finalDirectorDiscount = 0;

        // Tentar carregar do nível da proposta primeiro
        if (proposal.applySalespersonDiscount !== undefined && proposal.applySalespersonDiscount !== null) {
            finalSalespersonDiscount = Boolean(proposal.applySalespersonDiscount);
            console.log('✅ Desconto vendedor carregado da proposta:', finalSalespersonDiscount);
        } else if (products && products.length > 0 && products[0].details?.applySalespersonDiscount !== undefined) {
            finalSalespersonDiscount = Boolean(products[0].details.applySalespersonDiscount);
            console.log('✅ Desconto vendedor carregado do produto:', finalSalespersonDiscount);
        }

        if (proposal.appliedDirectorDiscountPercentage !== undefined && proposal.appliedDirectorDiscountPercentage !== null) {
            finalDirectorDiscount = Number(proposal.appliedDirectorDiscountPercentage) || 0;
            console.log('✅ Desconto diretor carregado da proposta:', finalDirectorDiscount);
        } else if (products && products.length > 0 && products[0].details?.appliedDirectorDiscountPercentage !== undefined) {
            finalDirectorDiscount = Number(products[0].details.appliedDirectorDiscountPercentage) || 0;
            console.log('✅ Desconto diretor carregado do produto:', finalDirectorDiscount);
        }

        // Aplicar os descontos nos estados
        console.log('🎯 Aplicando descontos finais:', { finalSalespersonDiscount, finalDirectorDiscount });
        setApplySalespersonDiscount(finalSalespersonDiscount);
        setAppliedDirectorDiscountPercentage(finalDirectorDiscount);
        setDirectorDiscountPercentage(finalDirectorDiscount);

        // CARREGAR DADOS DE CLIENTE EXISTENTE
        if (proposal.isExistingClient !== undefined) {
            setIsExistingClient(Boolean(proposal.isExistingClient));
            console.log('✅ Cliente existente carregado:', proposal.isExistingClient);
        }
        if (proposal.previousMonthlyFee !== undefined) {
            setPreviousMonthlyFee(Number(proposal.previousMonthlyFee) || 0);
            console.log('✅ Mensalidade anterior carregada:', proposal.previousMonthlyFee);
        }

        setViewMode('calculator');
    };

    const cancelAction = () => {
        setViewMode('search');
        clearForm();
    };

    const handleDeleteProposal = async (id: string) => {
        if (!user) {
            alert('Erro: Usuário não autenticado');
            return;
        }

        if (window.confirm('Tem certeza que deseja excluir esta proposta? Esta ação não pode ser desfeita.')) {
            try {
                const response = await fetch(`/api/simulator/proposals/${id}`, {
                    method: 'DELETE',
                    headers: getCRMAuthHeaders(),
                });

                if (response.ok) {
                    fetchProposals();
                    if (currentProposal?.id === id) {
                        setCurrentProposal(null);
                    }
                } else {
                    throw new Error('Erro ao excluir proposta');
                }
            } catch (error) {
                console.error('Erro ao excluir proposta:', error);
                alert('Erro ao excluir proposta. Por favor, tente novamente.');
            }
        }
    };

    const filteredProposals = proposals.filter(p =>
        (typeof p.client === 'object' ? p.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) : p.client?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.baseId || p.id).toLowerCase().includes(searchTerm.toLowerCase())
    );

    useDeepLinkedProposal(initialProposalId, proposals, editProposal);

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

        // Create style element safely
        const styleElement = document.createElement('style');
        styleElement.textContent = printStyles;
        styleElement.id = 'print-styles-fibra';

        // Remove existing style element if it exists
        const existingStyle = document.getElementById('print-styles-fibra');
        if (existingStyle) {
            existingStyle.remove();
        }

        document.head.appendChild(styleElement);

        // Add print-area class to the proposal view
        const proposalElement = document.querySelector('.proposal-view');
        if (proposalElement) {
            proposalElement.classList.add('print-area');
        }

        // Trigger print
        window.print();

        // Clean up safely
        setTimeout(() => {
            const styleToRemove = document.getElementById('print-styles-fibra');
            if (styleToRemove && styleToRemove.parentNode) {
                styleToRemove.parentNode.removeChild(styleToRemove);
            }
            if (proposalElement) {
                proposalElement.classList.remove('print-area');
            }
        }, 1000);
    };

    if (viewMode === 'client-form') {
        return (
            <ClientManagerForm
                clientData={clientData}
                accountManagerData={accountManagerData}
                onClientDataChange={setClientData}
                onAccountManagerDataChange={setAccountManagerData}
                onBack={cancelAction}
                onContinue={() => setViewMode('calculator')}
                title="Nova Proposta - Rede Man/MPLS Radio"
                subtitle="Preencha os dados do cliente e gerente de contas para continuar."
            />
        );
    }

    return (
        <div className="p-4 md:p-8">
            {viewMode === 'search' ? (
                <Card className="bg-slate-900/80 border-slate-800 text-white">
                    <CardHeader>
                        <Button
                            variant="outline"
                            onClick={onBackToDashboard || (() => setViewMode('calculator'))}
                            className="flex items-center mb-4"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Voltar
                        </Button>
                        <CardTitle>Buscar Propostas - Rede Man/MPLS Radio</CardTitle>
                        <CardDescription>Encontre propostas existentes ou crie uma nova.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-4 mb-4">
                            <Input
                                type="text"
                                placeholder="Buscar por cliente ou ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-slate-800 border-slate-700 text-white"
                            />
                            <Button onClick={createNewProposal} className="bg-blue-600 hover:bg-blue-700">
                                <Plus className="h-4 w-4 mr-2" />Nova Proposta
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
                                    {filteredProposals.map(p => (
                                        <TableRow key={p.id} className="border-slate-800">
                                            <TableCell>{p.baseId || p.id}</TableCell>
                                            <TableCell>{typeof p.client === 'string' ? p.client : p.client?.name || 'Cliente não informado'} (v{p.version})</TableCell>
                                            <TableCell>{
                                                typeof p.client === 'object' && p.client?.projectName
                                                    ? p.client.projectName
                                                    : p.clientData?.projectName || 'Projeto não informado'
                                            }</TableCell>
                                            <TableCell>{
                                                (() => {
                                                    const dateToUse = p.date || p.createdAt;
                                                    if (!dateToUse) return 'N/A';
                                                    try {
                                                        const date = new Date(dateToUse);
                                                        return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('pt-BR');
                                                    } catch {
                                                        return 'N/A';
                                                    }
                                                })()
                                            }</TableCell>
                                            <TableCell>{formatCurrency(p.totalMonthly || p.value || 0)}</TableCell>
                                            <TableCell>
                                                <ProposalStatusBadge status={p.status} />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => viewProposal(p)}>
                                                        <FileText className="h-4 w-4 mr-2" /> Visualizar Proposta
                                                    </Button>
                                                    <Button variant="outline" size="sm" onClick={() => editProposal(p)}>
                                                        <Edit className="h-4 w-4 mr-2" /> Editar Proposta
                                                    </Button>
                                                    <ConvertToB2BOpportunityButton proposal={p} />
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleDeleteProposal(p.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            ) : viewMode === 'proposal-summary' && currentProposal ? (
                <Card className="bg-white border-gray-300 text-black print:shadow-none proposal-view">
                    <CardHeader className="print:pb-2">
                        <div className="flex justify-between items-start mb-4 print:mb-2">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Proposta Comercial</h1>
                                <p className="text-gray-600">Rede Man/MPLS Radio</p>
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
                                        <strong>Período do Contrato:</strong> {(() => {
                                            const products = (currentProposal.items || currentProposal.products || []) as any[];
                                            const firstProduct = products[0];
                                            const proposalContractTerm = Number(
                                                firstProduct?.details?.contractTerm ||
                                                currentProposal.contractPeriod ||
                                                (currentProposal as any).contract_period ||
                                                0
                                            );
                                            return proposalContractTerm > 0 ? `${proposalContractTerm} meses` : 'N/A';
                                        })()}
                                    </p>
                                    <ProposalApprovalInfo proposal={currentProposal} />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-3">Gerente de Contas</h3>
                                <div className="space-y-2 text-sm">
                                    <p><strong>Nome:</strong> {(() => { const am = currentProposal.accountManager; if (!am) return 'N/A'; if (typeof am === 'string') { try { return JSON.parse(am)?.name || am; } catch { return am; } } return am?.name || currentProposal.metadata?.accountManager?.name || 'N/A'; })()}</p>
                                    <p><strong>Email:</strong> {(() => { const am = currentProposal.accountManager; if (typeof am === 'string') { try { return JSON.parse(am)?.email || 'N/A'; } catch { return 'N/A'; } } return am?.email || currentProposal.metadata?.accountManager?.email || 'N/A'; })()}</p>
                                    <p><strong>Telefone:</strong> {(() => { const am = currentProposal.accountManager; if (typeof am === 'string') { try { return JSON.parse(am)?.phone || 'N/A'; } catch { return 'N/A'; } } return am?.phone || currentProposal.metadata?.accountManager?.phone || 'N/A'; })()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Produtos */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">Produtos e Serviços</h3>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-gray-900">Descrição</TableHead>
                                        <TableHead className="text-gray-900">Setup</TableHead>
                                        <TableHead className="text-gray-900">Mensal</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(currentProposal.metadata?.products || currentProposal.products || currentProposal.items || []).map((product, index) => (
                                        <TableRow key={product.id || `product-${index}`}>
                                            <TableCell>{product.description}</TableCell>
                                            <TableCell>{formatCurrency(product.setup)}</TableCell>
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
                                                        // Tentar diferentes formatos
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

                            {/* Descontos Aplicados - Valores detalhados (APENAS SE HOUVER DESCONTOS) */}
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

                            {/* Resumo de Valores - Layout conforme print */}
                            <div className="space-y-3 mb-4 p-4 bg-slate-800 rounded-lg text-white">
                                {/* DEBUG - Remover depois */}
                                {(() => {
                                    console.log('🔍 DEBUG Visualização:', {
                                        isExistingClient: currentProposal.isExistingClient,
                                        previousMonthlyFee: currentProposal.previousMonthlyFee,
                                        totalMonthly: currentProposal.totalMonthly,
                                        metadata: (currentProposal as any).metadata
                                    });
                                    return null;
                                })()}
                                
                                {/* Valor Original do Cliente (se for cliente existente) */}
                                {(currentProposal.isExistingClient || currentProposal.previousMonthlyFee) && currentProposal.previousMonthlyFee && currentProposal.previousMonthlyFee > 0 && (
                                    <>
                                        <div className="flex justify-between items-center py-3 border-b border-slate-600">
                                            <span className="text-base flex items-center">
                                                <span className="mr-2">💰</span>
                                                <strong>Valor Original do Cliente:</strong>
                                            </span>
                                            <span className="font-bold text-2xl">{formatCurrency(currentProposal.previousMonthlyFee || currentProposal?.metadata?.previousMonthlyFee || 0)}</span>
                                        </div>
                                    </>
                                )}
                                
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-base"><strong>Valor Original (Mensal):</strong></span>
                                    <span className="font-bold text-xl">{formatCurrency(currentProposal.baseTotalMonthly || currentProposal.metadata?.baseTotalMonthly || currentProposal.totalMonthly || currentProposal.metadata?.totalMonthly || 0)}</span>
                                </div>
                                
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-base"><strong>Total de Instalação:</strong></span>
                                    <span className="font-bold text-xl">{formatCurrency(currentProposal.totalSetup || 0)}</span>
                                </div>
                                
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-base"><strong>Total Mensal (com desconto):</strong></span>
                                    <span className="font-bold text-xl">{formatCurrency(currentProposal.totalMonthly || 0)}</span>
                                </div>

                                {/* Diferença de Valor (se for cliente existente) */}
                                {(currentProposal.isExistingClient || currentProposal.previousMonthlyFee) && currentProposal.previousMonthlyFee && currentProposal.previousMonthlyFee > 0 && (
                                    <>
                                        <div className={`mt-4 p-4 rounded-lg border-2 ${
                                            (currentProposal.totalMonthly || 0) - currentProposal.previousMonthlyFee >= 0
                                                ? 'bg-red-900/30 border-red-500'
                                                : 'bg-green-900/30 border-green-500'
                                        }`}>
                                            <div className="flex justify-between items-center">
                                                <span className="text-base flex items-center">
                                                    <span className="mr-2">📊</span>
                                                    <strong>Diferença de Valor:</strong>
                                                </span>
                                                <span className={`font-bold text-3xl ${
                                                    (currentProposal.totalMonthly || 0) - currentProposal.previousMonthlyFee >= 0
                                                        ? 'text-red-400'
                                                        : 'text-green-400'
                                                }`}>
                                                    {(currentProposal.totalMonthly || 0) - currentProposal.previousMonthlyFee >= 0 ? '+' : ''}
                                                    {formatCurrency((currentProposal.totalMonthly || 0) - currentProposal.previousMonthlyFee)}
                                                </span>
                                            </div>
                                            <div className="text-center text-sm mt-2 flex items-center justify-center">
                                                <span className="mr-2">
                                                    {(currentProposal.totalMonthly || 0) - currentProposal.previousMonthlyFee >= 0 ? '⬆️' : '⬇️'}
                                                </span>
                                                {(currentProposal.totalMonthly || 0) - currentProposal.previousMonthlyFee >= 0
                                                    ? 'Aumento na mensalidade'
                                                    : 'Economia na mensalidade'
                                                }
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Payback Info se disponível */}
                        {(currentProposal.items || currentProposal.products || []).some(p => p.setup > 0) && (
                            <div className="border-t pt-4 print:pt-2">
                                <h3 className="text-lg font-semibold text-gray-900 mb-3">Análise de Payback</h3>
                                {(() => {
                                    const proposalProducts = (currentProposal.items || currentProposal.products || []) as any[];
                                    const firstProduct = proposalProducts[0];
                                    const details = firstProduct?.details || {};

                                    const totalMonthly = Number(currentProposal.totalMonthly ?? firstProduct?.monthly ?? 0);
                                    const contractTerm = Number(
                                        details.contractTerm ||
                                        currentProposal.contractPeriod ||
                                        (currentProposal as any).contract_period ||
                                        12
                                    );

                                    const savedPayback = Number(details.paybackCalculated ?? details.paybackMonths);
                                    const savedMaxPayback = Number(details.maxPayback);

                                    let paybackMonths = Number.isFinite(savedPayback) ? savedPayback : 0;
                                    let maxPayback = Number.isFinite(savedMaxPayback)
                                        ? savedMaxPayback
                                        : getMaxPaybackMonths(contractTerm);

                                    if (!Number.isFinite(savedPayback)) {
                                        const productSpeed = Number(details.speed || (currentProposal as any).selectedSpeed || 0);
                                        const plan = radioPlans.find((p) => p.speed === productSpeed);
                                        if (plan) {
                                            const totalCommissions = calculateTotalCommissions(totalMonthly, contractTerm);
                                            paybackMonths = calculatePayback({
                                                installationFee: Number(firstProduct?.setup ?? (details.includeInstallation ? plan.installationCost : 0)),
                                                manCost: Number(details.fiberCost ?? details.radioCost ?? plan.radioCost ?? 0),
                                                monthlyRevenue: totalMonthly,
                                                contractTerm,
                                                speedMbps: plan.speed,
                                                simplesNacionalPct: taxRates.simplesNacional,
                                                custoDespPct: taxRates.custoDesp,
                                                bandaCostPerMbps: taxRates.banda,
                                                createLastMile: Boolean(details.createLastMile ?? createLastMile),
                                                lastMileMultiplier: Number(details.lastMilePercentage ?? lastMilePercentage),
                                                totalCommissions
                                            });
                                            maxPayback = getMaxPaybackMonths(contractTerm);
                                        }
                                    }

                                    const isValid = typeof details.paybackWithinLimit === 'boolean'
                                        ? details.paybackWithinLimit
                                        : paybackMonths <= maxPayback;

                                    return (
                                        <div className="text-sm">
                                            <p><strong>Payback:</strong> {paybackMonths} meses</p>
                                            <p><strong>Payback Máximo:</strong> {maxPayback} meses</p>
                                            <p className={isValid ? 'text-green-600' : 'text-red-600'}>
                                                <strong>Status:</strong> {isValid ? '✓ Aprovado' : '⚠ Atenção - Payback excedido'}
                                            </p>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h1 className="text-3xl font-bold text-white">{currentProposal ? 'Editar Proposta' : 'Nova Proposta'}</h1>
                                <p className="text-slate-400 mt-2">Configure e calcule os custos para links de fibra</p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={cancelAction} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                                    ← Voltar para Busca
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
                        <ClientManagerInfo clientData={clientData} accountManagerData={accountManagerData} />
                    </div>

                    <Tabs defaultValue="calculator" className="w-full">
                        <TabsList className={`grid w-full grid-cols-4 bg-slate-800`}>
                            <TabsTrigger value="calculator">Calculadora</TabsTrigger>
                            {canEditCommissions && (
                                <TabsTrigger value="prices">Tabela de Preços</TabsTrigger>
                            )}
                            {canEditCommissions && (
                            <TabsTrigger value="commissions-table">Tabela Comissões</TabsTrigger>
                            )}
                            {canEditCommissions && (
                                <TabsTrigger value="dre">DRE</TabsTrigger>
                            )}
                        </TabsList>
                        <TabsContent value="calculator" key={`calculator-${componentKey}`}>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
                                <Card className="bg-slate-900/80 border-slate-800 text-white">
                                    <CardHeader><CardTitle className="flex items-center"><Calculator className="mr-2" />Calculadora</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <ContractTermSelector
                                                value={contractTerm}
                                                onChange={handleContractTermChange}
                                            />
                                            <div className="space-y-2">
                                                <Label htmlFor="speed">Velocidade</Label>
                                                <Select onValueChange={(v) => setSelectedSpeed(Number(v))} value={selectedSpeed.toString()}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecione uma velocidade..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {radioPlans.filter(p => getMonthlyPrice(p, contractTerm) > 0).map(plan => (
                                                            <SelectItem key={plan.speed} value={plan.speed.toString()}>
                                                                {plan.description}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox id="include-installation" checked={includeInstallation} onCheckedChange={(c) => setIncludeInstallation(c as boolean)} />
                                                <Label htmlFor="include-installation">Incluir taxa de instalação no cálculo</Label>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="fiber-cost">Custo Rádio</Label>
                                            <Input type="number" step="0.01" id="fiber-cost" value={result?.radioCost || ''} onChange={(e) => { handleCustoRadioChange(parseFloat(e.target.value) || 0); setHasChanged(true); }} placeholder="0.00" className="bg-slate-800" />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="isExistingClient"
                                                    checked={isExistingClient}
                                                    onCheckedChange={(checked) => setIsExistingClient(!!checked)}
                                                />
                                                <Label htmlFor="isExistingClient">Já é cliente da Base?</Label>
                                            </div>
                                        </div>
                                        {isExistingClient && (
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="previousMonthlyFee">Mensalidade Anterior</Label>
                                                    <CurrencyInput id="previousMonthlyFee" value={previousMonthlyFee} onChange={setPreviousMonthlyFee} placeholder="0,00" className="bg-slate-800" />
                                                </div>
                                                {previousMonthlyFee > 0 && result && (
                                                    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-sm text-slate-300">Diferença de Valor:</span>
                                                            <span className={`font-semibold ${result.monthlyPrice - previousMonthlyFee >= 0
                                                                ? 'text-green-400'
                                                                : 'text-red-400'
                                                                }`}>
                                                                {result.monthlyPrice - previousMonthlyFee >= 0 ? '+' : ''}
                                                                {formatCurrency(result.monthlyPrice - previousMonthlyFee)}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-slate-400 mt-1">
                                                            {result.monthlyPrice - previousMonthlyFee >= 0
                                                                ? 'Aumento na mensalidade'
                                                                : 'Redução na mensalidade'
                                                            }
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="createLastMile"
                                                    checked={createLastMile}
                                                    onCheckedChange={(checked) => {
                                                        const enabled = !!checked;
                                                        setCreateLastMile(enabled);
                                                        if (enabled && (!Number.isFinite(lastMilePercentage) || lastMilePercentage <= 0)) {
                                                            setLastMilePercentage(1.75);
                                                        }
                                                    }}
                                                />
                                                <Label htmlFor="createLastMile">Criar Last Mile?</Label>
                                            </div>
                                        </div>
                                        {createLastMile && (
                                            <div className="space-y-2">
                                                <Label htmlFor="lastMilePercentage">Fator Last Mile (ex: 1,75)</Label>
                                                <Input
                                                    id="lastMilePercentage"
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    value={lastMilePercentage}
                                                    onChange={(e) => {
                                                        const raw = Number(e.target.value);
                                                        const value = Number.isFinite(raw) ? raw : 0;
                                                        setLastMilePercentage(Math.min(100, Math.max(0, value)));
                                                    }}
                                                    placeholder="1.75"
                                                    className="bg-slate-800 border-slate-700 text-white"
                                                />
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="includeReferralPartner"
                                                    checked={includeReferralPartner}
                                                    onCheckedChange={(checked) => setIncludeReferralPartner(Boolean(checked))}
                                                />
                                                <Label htmlFor="includeReferralPartner">Incluir Parceiro Indicador</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="includeInfluencerPartner"
                                                    checked={includeInfluencerPartner}
                                                    onCheckedChange={(checked) => setIncludeInfluencerPartner(Boolean(checked))}
                                                />
                                                <Label htmlFor="includeInfluencerPartner">Incluir Parceiro Influenciador</Label>
                                            </div>
                                        </div>

                                        {/* Seção de Resultado e Validação de Payback */}
                                        {result && (
                                            <div className="space-y-3 p-4 bg-slate-800 rounded-lg border border-slate-700">
                                                <h4 className="text-lg font-semibold text-white">Resultado do Cálculo</h4>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between">
                                                        <span>Valor Mensal:</span>
                                                        <span className="font-semibold">{formatCurrency(result.monthlyPrice)}</span>
                                                    </div>
                                                    {includeInstallation && (
                                                        <div className="flex justify-between">
                                                            <span>Taxa de Instalação:</span>
                                                            <span className="font-semibold">{formatCurrency(result.installationCost)}</span>
                                                        </div>
                                                    )}
                                                    {includeInstallation && (
                                                        <div className="flex justify-between">
                                                            <span>Payback Calculado:</span>
                                                            <span className="font-semibold">{result.paybackValidation.actualPayback} meses</span>
                                                        </div>
                                                    )}
                                                    {includeInstallation && (
                                                        <div className="flex justify-between">
                                                            <span>Payback Máximo Permitido:</span>
                                                            <span className="font-semibold">{result.paybackValidation.maxPayback} meses</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Diferença de Valor para Clientes Existentes */}
                                                {isExistingClient && previousMonthlyFee > 0 && result && (
                                                    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-sm text-slate-300">Diferença de Valor:</span>
                                                            <span className={`font-semibold ${result.monthlyPrice - previousMonthlyFee >= 0
                                                                ? 'text-green-400'
                                                                : 'text-red-400'
                                                                }`}>
                                                                {result.monthlyPrice - previousMonthlyFee >= 0 ? '+' : ''}
                                                                {formatCurrency(result.monthlyPrice - previousMonthlyFee)}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-slate-400 mt-1">
                                                            {result.monthlyPrice - previousMonthlyFee >= 0
                                                                ? 'Aumento na mensalidade'
                                                                : 'Redução na mensalidade'
                                                            }
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Alerta de Payback */}
                                                {includeInstallation && !result.paybackValidation.isValid && (
                                                    <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg">
                                                        <div className="flex items-center space-x-2">
                                                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                                            <span className="font-semibold text-red-400">⚠️ Payback acima do permitido!</span>
                                                        </div>
                                                        <p className="text-sm text-red-300 mt-1">
                                                            O payback de {result.paybackValidation.actualPayback} meses excede o limite de {result.paybackValidation.maxPayback} meses para contratos de {contractTerm} meses.
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Alerta de Sucesso */}
                                                {includeInstallation && result.paybackValidation.isValid && (
                                                    <div className="p-3 bg-green-900/50 border border-green-700 rounded-lg">
                                                        <div className="flex items-center space-x-2">
                                                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                            <span className="font-semibold text-green-400">✅ Payback dentro do limite!</span>
                                                        </div>
                                                        <p className="text-sm text-green-300 mt-1">
                                                            O payback de {result.paybackValidation.actualPayback} meses está dentro do limite de {result.paybackValidation.maxPayback} meses.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <Button onClick={handleAddProduct} disabled={!result} className="w-full bg-blue-600 hover:bg-blue-700">Adicionar Produto</Button>
                                    </CardContent>
                                </Card>

                                <Card className="bg-slate-900/80 border-slate-800 text-white">
                                    <CardHeader><CardTitle className="flex items-center"><FileText className="mr-2" />Resumo da Proposta</CardTitle></CardHeader>
                                    <CardContent>
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

                                        {addedProducts.length === 0 ? (
                                            <p className="text-slate-400">Nenhum produto adicionado.</p>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="max-h-60 overflow-y-auto pr-2 space-y-4">
                                                    {addedProducts.map((product) => (
                                                        <div key={product.id} className="p-3 bg-slate-800 rounded-lg">
                                                            <div className="flex justify-between items-start">
                                                                <p className="font-semibold flex-1 pr-2">{product.description}</p>
                                                                <Button variant="ghost" size="icon" onClick={() => handleRemoveProduct(product.id)} className="text-red-400 hover:bg-red-900/50 h-7 w-7">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                            <div className="text-sm space-y-1 mt-2">
                                                                <div className="flex justify-between"><span>Instalação:</span><span>{formatCurrency(product.setup)}</span></div>
                                                                <div className="flex justify-between"><span>Mensal:</span><span>{formatCurrency(product.monthly)}</span></div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                
                                                {/* Histórico de Descontos Aplicados */}
                                                {(applySalespersonDiscount || appliedDirectorDiscountPercentage > 0) && (
                                                    <div className="p-4 bg-gradient-to-br from-amber-900/40 to-orange-900/40 border-2 border-orange-500/60 rounded-lg shadow-lg">
                                                        <h4 className="font-semibold text-orange-300 mb-3 flex items-center text-base">
                                                            📋 Histórico de Descontos Aplicados
                                                        </h4>
                                                        <div className="space-y-2 text-sm">
                                                            <div className="flex justify-between">
                                                                <span className="text-slate-200">Versão:</span>
                                                                <span className="text-orange-300 font-bold">v{currentProposal?.version || 1}</span>
                                                            </div>
                                                            
                                                            {applySalespersonDiscount && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-200">Desconto Vendedor:</span>
                                                                    <span className="text-orange-300 font-bold">5%</span>
                                                                </div>
                                                            )}

                                                            {appliedDirectorDiscountPercentage > 0 && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-200">Desconto Diretor:</span>
                                                                    <span className="text-orange-300 font-bold">{appliedDirectorDiscountPercentage}%</span>
                                                                </div>
                                                            )}
                                                            
                                                            <Separator className="my-2 bg-orange-500/30" />
                                                            <div className="flex justify-between">
                                                                <span className="text-slate-200">Data de Criação:</span>
                                                                <span className="text-orange-300 font-semibold">
                                                                    {currentProposal?.createdAt 
                                                                        ? new Date(currentProposal.createdAt).toLocaleDateString('pt-BR')
                                                                        : new Date().toLocaleDateString('pt-BR')
                                                                    }
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                <Separator className="my-4 bg-slate-700" />

                                                {/* Controles de Desconto - Conforme Print */}
                                                <div className="space-y-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                                                    {/* Campo Desconto Diretor - Sempre visível para Director e Admin */}
                                                    {(isDirector || isAdmin) && (
                                                        <div className="space-y-2">
                                                            <Label htmlFor="director-discount" className="text-slate-300">Desconto Diretor (%)</Label>
                                                            <Input
                                                                id="director-discount"
                                                                type="number" step="0.01"
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
                                                    )}
                                                    
                                                    {/* Checkbox Desconto Vendedor */}
                                                    {!isDirector && (
                                                        <div className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id="salesperson-discount-toggle"
                                                                checked={applySalespersonDiscount}
                                                                onCheckedChange={(checked) => setApplySalespersonDiscount(!!checked)}
                                                                className="border-slate-500"
                                                            />
                                                            <Label htmlFor="salesperson-discount-toggle" className="text-slate-300 cursor-pointer">
                                                                Aplicar Desconto Vendedor (5%)
                                                            </Label>
                                                        </div>
                                                    )}
                                                </div>

                                                <Separator className="my-4 bg-slate-700" />
                                                
                                                {/* Resumo de Valores - Conforme Print */}
                                                <div className="space-y-2">
                                                    {/* Valor Original do Cliente (se for cliente existente) */}
                                                    {isExistingClient && previousMonthlyFee > 0 && (
                                                        <>
                                                            <div className="flex justify-between text-slate-300 bg-slate-800/50 p-2 rounded">
                                                                <span className="font-medium">💰 Valor Original do Cliente:</span>
                                                                <span className="font-bold">{formatCurrency(previousMonthlyFee)}</span>
                                                            </div>
                                                            <Separator className="my-2 bg-slate-700" />
                                                        </>
                                                    )}
                                                    
                                                    <div className="flex justify-between text-slate-300">
                                                        <span>Valor Original (Mensal):</span>
                                                        <span className="font-medium">{formatCurrency(addedProducts.reduce((sum, p) => sum + p.monthly, 0))}</span>
                                                    </div>
                                                    
                                                    {applySalespersonDiscount && (
                                                        <div className="flex justify-between text-orange-400">
                                                            <span>Desconto Vendedor (5%):</span>
                                                            <span className="font-medium">-{formatCurrency((addedProducts.reduce((sum, p) => sum + p.monthly, 0)) * 0.05)}</span>
                                                        </div>
                                                    )}
                                                    
                                                    {appliedDirectorDiscountPercentage > 0 && (
                                                        <div className="flex justify-between text-orange-400">
                                                            <span>Desconto Diretor ({appliedDirectorDiscountPercentage}%) - Apenas Mensal:</span>
                                                            <span className="font-medium">-{formatCurrency(addedProducts.reduce((sum, p) => sum + p.monthly, 0) * (applySalespersonDiscount ? 0.95 : 1) * (appliedDirectorDiscountPercentage / 100))}</span>
                                                        </div>
                                                    )}
                                                    
                                                    <Separator className="my-2 bg-slate-700" />
                                                    
                                                    <div className="flex justify-between text-slate-300">
                                                        <span>Total de Instalação:</span>
                                                        <span className="font-medium">{formatCurrency(addedProducts.reduce((sum, p) => sum + p.setup, 0))}</span>
                                                    </div>
                                                    
                                                    <div className="flex justify-between text-white">
                                                        <span className="font-medium">Total Mensal (com desconto):</span>
                                                        <span className="font-bold">{formatCurrency(applyDiscounts(addedProducts.reduce((sum, p) => sum + p.monthly, 0)))}</span>
                                                    </div>

                                                    {/* Diferença de Valor (se for cliente existente) */}
                                                    {isExistingClient && previousMonthlyFee > 0 && (
                                                        <>
                                                            <Separator className="my-2 bg-slate-700" />
                                                            <div className={`flex justify-between p-3 rounded-lg ${
                                                                applyDiscounts(addedProducts.reduce((sum, p) => sum + p.monthly, 0)) - previousMonthlyFee >= 0
                                                                    ? 'bg-red-900/30 border border-red-700/50'
                                                                    : 'bg-green-900/30 border border-green-700/50'
                                                            }`}>
                                                                <span className="font-bold text-white">📊 Diferença de Valor:</span>
                                                                <span className={`font-bold text-lg ${
                                                                    applyDiscounts(addedProducts.reduce((sum, p) => sum + p.monthly, 0)) - previousMonthlyFee >= 0
                                                                        ? 'text-red-400'
                                                                        : 'text-green-400'
                                                                }`}>
                                                                    {applyDiscounts(addedProducts.reduce((sum, p) => sum + p.monthly, 0)) - previousMonthlyFee >= 0 ? '+' : ''}
                                                                    {formatCurrency(applyDiscounts(addedProducts.reduce((sum, p) => sum + p.monthly, 0)) - previousMonthlyFee)}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-slate-400 text-center">
                                                                {applyDiscounts(addedProducts.reduce((sum, p) => sum + p.monthly, 0)) - previousMonthlyFee >= 0
                                                                    ? '⬆️ Aumento na mensalidade'
                                                                    : '⬇️ Economia na mensalidade'
                                                                }
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* Payback Information */}
                                                    {result && includeInstallation && (
                                                        <div className="mt-4 pt-4 border-t border-slate-700">
                                                            <h4 className="text-sm font-semibold text-slate-300 mb-2">Informações de Payback</h4>
                                                            <div className="space-y-2 text-sm">
                                                                <div className="flex justify-between">
                                                                    <span>Payback Calculado:</span>
                                                                    <span className="font-semibold">{result.paybackValidation.actualPayback} meses</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>Payback Máximo:</span>
                                                                    <span className="font-semibold">{result.paybackValidation.maxPayback} meses</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>Status:</span>
                                                                    <span className={`font-semibold ${result.paybackValidation.isValid ? 'text-green-400' : 'text-red-400'}`}>
                                                                        {result.paybackValidation.isValid ? '✅ Dentro do limite' : '⚠️ Acima do limite'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex justify-end space-x-2 mt-4">
                                                    <Button variant="outline" onClick={clearForm} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                                                        Limpar Tudo
                                                    </Button>
                                                    {hasChanged && currentProposal?.id && (
                                                        <Button
                                                            onClick={() => {
                                                                if (currentProposal.id) {
                                                                    handleSave(currentProposal.id, true);
                                                                    setHasChanged(false);
                                                                }
                                                            }}
                                                            className="bg-blue-600 hover:bg-blue-700"
                                                        >
                                                            <Save className="h-4 w-4 mr-2" />
                                                            Salvar como Nova Versão
                                                        </Button>
                                                    )}
                                                    {currentProposal?.id && (
                                                        <ProposalApprovalRequestButton
                                                            proposalId={currentProposal.id}
                                                            onRequested={() => {
                                                                setCurrentProposal({
                                                                    ...currentProposal,
                                                                    status: 'Aguardando Aprovação Diretoria',
                                                                });
                                                            }}
                                                            onApproved={() => {
                                                                setCurrentProposal({
                                                                    ...currentProposal,
                                                                    status: 'Aprovada',
                                                                });
                                                            }}
                                                        />
                                                    )}
                                                    {!currentProposal && (
                                                        <Button onClick={saveProposal} className="bg-green-600 hover:bg-green-700">
                                                            <Save className="h-4 w-4 mr-2" />
                                                            Salvar Proposta
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>
                        {canEditCommissions && (
                        <TabsContent value="dre">
                            <div className="space-y-6 mt-6">

                                {/* DRE - Demonstrativo de Resultado do Exercício */}
                                <Card className="bg-slate-900/80 border-slate-800 text-white">
                                    <CardHeader>
                                        <CardTitle className="flex items-center">
                                            <div className="w-4 h-4 bg-blue-500 mr-2"></div>
                                            DRE - Demonstrativo de Resultado do Exercício
                                        </CardTitle>
                                        <CardDescription>Rede Man/MPLS Radio {velocidade} Mbps - Análise por Período de Contrato</CardDescription>
                                    </CardHeader>
                                    <CardContent className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="border-slate-700">
                                                    <TableHead className="text-white">Descrição</TableHead>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableHead key={period} className="text-right text-white">{period} Meses</TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                <TableRow className="border-slate-800 bg-green-900/30">
                                                    <TableCell className="text-white font-semibold">Receita Total do Período</TableCell>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableCell key={period} className="text-right text-white">{formatCurrency((dreCalculations as any)[period].receitaMensal)}</TableCell>
                                                    ))}
                                                </TableRow>
                                                <TableRow className="border-slate-800">
                                                    <TableCell className="text-white">Receita - Taxa Instalação</TableCell>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableCell key={period} className="text-right text-white">{formatCurrency((dreCalculations as any)[period].receitaInstalacao)}</TableCell>
                                                    ))}
                                                </TableRow>
                                                <TableRow className="border-slate-800 bg-blue-900/30">
                                                    <TableCell className="text-white font-semibold">Total</TableCell>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableCell key={period} className="text-right text-white">{formatCurrency((dreCalculations as any)[period].receitaTotalPrimeiromes)}</TableCell>
                                                    ))}
                                                </TableRow>
                                                <TableRow className="border-slate-800">
                                                    <TableCell className="text-white">Custo de banda</TableCell>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableCell key={period} className="text-right text-white">{formatCurrency((dreCalculations as any)[period].custoBanda)}</TableCell>
                                                    ))}
                                                </TableRow>
                                                <TableRow className="border-slate-800">
                                                    <TableCell className="text-white">Custo Rádio</TableCell>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableCell key={period} className="text-right text-white">{formatCurrency((dreCalculations as any)[period].custoRadio)}</TableCell>
                                                    ))}
                                                </TableRow>
                                                <TableRow className="border-slate-800">
                                                    <TableCell className="text-white">Fundraising</TableCell>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableCell key={period} className="text-right text-white">{formatCurrency((dreCalculations as any)[period].fundraising)}</TableCell>
                                                    ))}
                                                </TableRow>
                                                <TableRow className="border-slate-800">
                                                    <TableCell className="text-white">Last Mile</TableCell>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableCell key={period} className="text-right text-white">{formatCurrency((dreCalculations as any)[period].lastMile)}</TableCell>
                                                    ))}
                                                </TableRow>
                                                <TableRow className="border-slate-800">
                                                    <TableCell className="text-white">Simples Nacional</TableCell>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableCell key={period} className="text-right text-white">{formatCurrency((dreCalculations as any)[period].simplesNacional)}</TableCell>
                                                    ))}
                                                </TableRow>

                                                {isExistingClient && previousMonthlyFee > 0 && (
                                                    <TableRow className="border-slate-800 bg-yellow-900/30">
                                                        <TableCell className="text-white font-semibold">Diferença de Valores Contrato</TableCell>
                                                        {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                            <TableCell key={period} className="text-right text-white font-semibold">
                                                                {(dreCalculations as any)[period].diferencaValoresContrato >= 0 ? '+' : ''}
                                                                {formatCurrency((dreCalculations as any)[period].diferencaValoresContrato)}
                                                            </TableCell>
                                                        ))}
                                                    </TableRow>
                                                )}

                                                {includeReferralPartner && (
                                                    <TableRow className="border-slate-800">
                                                        <TableCell className="text-white">Comissão Parceiro Indicador</TableCell>
                                                        {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                            <TableCell key={period} className="text-right text-white">{formatCurrency((dreCalculations as any)[period].comissaoParceiroIndicador)}</TableCell>
                                                        ))}
                                                    </TableRow>
                                                )}
                                                {includeInfluencerPartner && (
                                                    <TableRow className="border-slate-800">
                                                        <TableCell className="text-white">Comissão Parceiro Influenciador</TableCell>
                                                        {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                            <TableCell key={period} className="text-right text-white">{formatCurrency((dreCalculations as any)[period].comissaoParceiroInfluenciador)}</TableCell>
                                                        ))}
                                                    </TableRow>
                                                )}
	                                                <TableRow className="border-slate-800">
	                                                    <TableCell className="text-white">
	                                                        {(includeReferralPartner || includeInfluencerPartner) ? 'Comissão Canal/Vendedor' : 'Comissão Vendedor'}
	                                                    </TableCell>
	                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
	                                                        <TableCell key={period} className="text-right text-white">{formatCurrency((dreCalculations as any)[period].comissaoVendedor)}</TableCell>
	                                                    ))}
	                                                </TableRow>
	                                                <TableRow className="border-slate-800">
	                                                    <TableCell className="text-white">Comissão Diretor</TableCell>
	                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
	                                                        <TableCell key={period} className="text-right text-white">{formatCurrency((dreCalculations as any)[period].comissaoDiretor)}</TableCell>
	                                                    ))}
	                                                </TableRow>
	                                                <TableRow className="border-slate-800">
	                                                    <TableCell className="text-white">Custo / Despesa</TableCell>
	                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
	                                                        <TableCell key={period} className="text-right text-white">{formatCurrency((dreCalculations as any)[period].custoDespesa)}</TableCell>
	                                                    ))}
	                                                </TableRow>
                                                <TableRow className="border-slate-800">
                                                    <TableCell className="text-white font-semibold">Total de Custos</TableCell>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableCell key={period} className="text-right text-white">{formatCurrency((dreCalculations as any)[period].totalCost)}</TableCell>
                                                    ))}
                                                </TableRow>
                                                <TableRow className="border-slate-800 bg-green-900/50">
                                                    <TableCell className="text-white font-bold">Balance</TableCell>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableCell key={period} className={`text-right font-bold ${(dreCalculations as any)[period].balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {formatCurrency((dreCalculations as any)[period].balance)}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                                <TableRow className="border-slate-800">
                                                    <TableCell className="text-white font-semibold">Margem Líquida %</TableCell>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableCell key={period} className={`text-right font-semibold ${(dreCalculations as any)[period].margemLiquida >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {formatPercentage((dreCalculations as any)[period].margemLiquida)}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                                <TableRow className="border-slate-800">
                                                    <TableCell className="text-white font-semibold">Markup %</TableCell>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableCell key={period} className={`text-right font-semibold ${(dreCalculations as any)[period].markup >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {formatPercentage((dreCalculations as any)[period].markup)}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                                <TableRow className="border-slate-800">
                                                    <TableCell className="text-white font-semibold">Rentabilidade %</TableCell>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableCell key={period} className={`text-right font-semibold ${(dreCalculations as any)[period].rentabilidade >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {(dreCalculations as any)[period].rentabilidade.toFixed(2)}%
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                                <TableRow className="border-slate-800">
                                                    <TableCell className="text-white font-semibold">Lucratividade</TableCell>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableCell key={period} className={`text-right font-semibold ${(dreCalculations as any)[period].lucratividade >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {(dreCalculations as any)[period].lucratividade.toFixed(2)}%
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            </TableBody>
                                        </Table>

                                        {/* Resumo Executivo */}
                                        <div className="mt-6 pt-4 border-t border-slate-700">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg font-semibold">Resumo Executivo</h3>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            // Função para exportar DRE
                                                            const dreData = Object.keys(dreCalculations)
                                                                .filter(key => !isNaN(Number(key)))
                                                                .map(period => ({
                                                                    periodo: `${period} meses`,
                                                                    receita: (dreCalculations as any)[period].receitaMensal,
                                                                    balance: (dreCalculations as any)[period].balance,
                                                                    rentabilidade: (dreCalculations as any)[period].rentabilidade
                                                                }));

                                                            const csvContent = "data:text/csv;charset=utf-8,"
                                                                + "Período,Receita Mensal,Balance,Rentabilidade\n"
                                                                + dreData.map(row => `${row.periodo},${row.receita},${row.balance},${row.rentabilidade}%`).join("\n");

                                                            const encodedUri = encodeURI(csvContent);
                                                            const link = document.createElement("a");
                                                            link.setAttribute("href", encodedUri);
                                                            link.setAttribute("download", `DRE_Internet_Man_Radio_${velocidade}Mbps.csv`);

                                                            // Safely append and remove link
                                                            document.body.appendChild(link);
                                                            link.click();

                                                            // Use setTimeout to ensure click is processed before removal
                                                            setTimeout(() => {
                                                                if (link.parentNode) {
                                                                    link.parentNode.removeChild(link);
                                                                }
                                                            }, 100);
                                                        }}
                                                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                                                    >
                                                        <Download className="h-4 w-4 mr-1" />
                                                        Exportar CSV
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={handlePrint}
                                                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                                                    >
                                                        <FileText className="h-4 w-4 mr-1" />
                                                        Imprimir
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                <div className="bg-slate-800/50 p-4 rounded-lg">
                                                    <h4 className="text-sm font-medium text-slate-300 mb-2">Melhor Período</h4>
                                                    <div className="text-xl font-bold text-green-400">
                                                        {(() => {
                                                            const periods = [12, 24, 36, 48, 60];
                                                            const bestPeriod = periods.reduce((best, current) =>
                                                                dreCalculations[current].rentabilidade > dreCalculations[best].rentabilidade ? current : best
                                                            );
                                                            return `${bestPeriod} meses`;
                                                        })()}
                                                    </div>
                                                    <div className="text-sm text-slate-400">
                                                        {(() => {
                                                            const periods = [12, 24, 36, 48, 60];
                                                            const bestPeriod = periods.reduce((best, current) =>
                                                                dreCalculations[current].rentabilidade > dreCalculations[best].rentabilidade ? current : best
                                                            );
                                                            return `${dreCalculations[bestPeriod].rentabilidade.toFixed(2)}% rentabilidade`;
                                                        })()}
                                                    </div>
                                                </div>

                                                <div className="bg-slate-800/50 p-4 rounded-lg">
                                                    <h4 className="text-sm font-medium text-slate-300 mb-2">Receita Média</h4>
                                                    <div className="text-xl font-bold text-blue-400">
                                                        {formatCurrency(
                                                            [12, 24, 36, 48, 60].reduce((sum, period) =>
                                                                sum + (dreCalculations as any)[period].receitaMensal, 0
                                                            ) / 5
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-slate-400">Por mês</div>
                                                </div>

                                                <div className="bg-slate-800/50 p-4 rounded-lg">
	                                                    <h4 className="text-sm font-medium text-slate-300 mb-2">Payback Calculado</h4>
	                                                    <div className="text-xl font-bold text-purple-400">
	                                                        {(() => {
	                                                            const currentPayback = (dreCalculations as any)[contractTerm]?.paybackMonths ?? 0;
	                                                            return `${currentPayback} meses`;
	                                                        })()}
	                                                    </div>
	                                                    <div className="text-sm text-slate-400">Tempo de retorno</div>
	                                                </div>
                                            </div>

                                            {/* Gráfico de Rentabilidade Simples */}
                                            <div className="bg-slate-800/50 p-4 rounded-lg mb-4">
                                                <h4 className="text-sm font-medium text-slate-300 mb-3">Rentabilidade por Período</h4>
                                                <div className="flex items-end justify-between h-20 gap-2">
                                                    {[12, 24, 36, 48, 60].map(period => {
                                                        const rentabilidade = (dreCalculations as any)[period].rentabilidade;
                                                        const maxRent = Math.max(...[12, 24, 36, 48, 60].map(p => (dreCalculations as any)[p].rentabilidade));
                                                        const height = maxRent > 0 ? (rentabilidade / maxRent) * 100 : 0;

                                                        return (
                                                            <div key={period} className="flex flex-col items-center flex-1">
                                                                <div
                                                                    className={`w-full rounded-t transition-all duration-300 ${rentabilidade >= 0 ? 'bg-green-500' : 'bg-red-500'
                                                                        }`}
                                                                    style={{ height: `${Math.abs(height)}%`, minHeight: '4px' }}
                                                                ></div>
                                                                <div className="text-xs text-slate-400 mt-1">{period}m</div>
                                                                <div className="text-xs font-medium text-white">
                                                                    {rentabilidade.toFixed(1)}%
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Alertas Inteligentes */}
                                            <div className="space-y-3">
                                                {(() => {
                                                    const alerts = [];
                                                    const periods = [12, 24, 36, 48, 60];

                                                    // Verificar rentabilidade negativa
                                                    const negativePeriods = periods.filter(p => dreCalculations[p].rentabilidade < 0);
                                                    if (negativePeriods.length > 0) {
                                                        alerts.push({
                                                            type: 'warning',
                                                            title: 'Rentabilidade Negativa',
                                                            message: `Períodos com prejuízo: ${negativePeriods.join(', ')} meses. Considere revisar custos ou preços.`,
                                                            icon: '⚠️'
                                                        });
                                                    }

                                                    // Verificar melhor período
                                                    const bestPeriod = periods.reduce((best, current) =>
                                                        dreCalculations[current].rentabilidade > dreCalculations[best].rentabilidade ? current : best
                                                    );
                                                    if (dreCalculations[bestPeriod].rentabilidade > 20) {
                                                        alerts.push({
                                                            type: 'success',
                                                            title: 'Excelente Rentabilidade',
                                                            message: `O período de ${bestPeriod} meses oferece ${dreCalculations[bestPeriod].rentabilidade.toFixed(1)}% de rentabilidade. Recomendado!`,
                                                            icon: '🎯'
                                                        });
                                                    }

	                                                    // Verificar payback alto
	                                                    const highPaybackPeriods = periods.filter(p => {
	                                                        const payback = (dreCalculations as any)[p]?.paybackMonths ?? 0;
	                                                        return payback > 12;
	                                                    });
                                                    if (highPaybackPeriods.length > 0) {
                                                        alerts.push({
                                                            type: 'info',
                                                            title: 'Payback Elevado',
                                                            message: `Períodos com payback > 12 meses: ${highPaybackPeriods.join(', ')} meses. Considere reduzir taxa de instalação.`,
                                                            icon: '💡'
                                                        });
                                                    }

                                                    return alerts.map((alert, index) => (
                                                        <div key={index} className={`p-3 rounded-lg border-l-4 ${alert.type === 'success' ? 'bg-green-900/20 border-green-500' :
                                                            alert.type === 'warning' ? 'bg-yellow-900/20 border-yellow-500' :
                                                                'bg-blue-900/20 border-blue-500'
                                                            }`}>
                                                            <div className="flex items-start gap-3">
                                                                <span className="text-lg">{alert.icon}</span>
                                                                <div>
                                                                    <h5 className="font-medium text-white">{alert.title}</h5>
                                                                    <p className="text-sm text-slate-300 mt-1">{alert.message}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Tabela de Impostos Editável */}
                                <Card className="bg-slate-900/80 border-slate-800 text-white">
                                    <CardHeader>
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <CardTitle className="flex items-center">
                                                    <div className="w-4 h-4 bg-yellow-500 mr-2"></div>
                                                    Tabela de Impostos
                                                </CardTitle>
                                                <CardDescription>Configure as alíquotas de impostos</CardDescription>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setIsEditingTaxes(!isEditingTaxes)}
                                                className="border-slate-600 text-slate-300 hover:bg-slate-700"
                                            >
                                                {isEditingTaxes ? 'Salvar' : 'Editar'}
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="pis-rate">Simples Nacional (%)</Label>
                                                <Input
                                                    id="pis-rate"
                                                    type="number"
                                                    step="0.01"
                                                    value={taxRates.simplesNacional.toFixed(2)}
                                                    onChange={(e) => {
                                                        setTaxRates(prev => ({ ...prev, simplesNacional: parseFloat(e.target.value) || 0 }));
                                                    }}
                                                    disabled={!isEditingTaxes}
                                                    className="bg-slate-800 border-slate-700"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="banda-rate">Banda (%)</Label>
                                                <Input
                                                    id="banda-rate"
                                                    type="number"
                                                    step="0.01"
                                                    value={taxRates.banda.toFixed(2)}
                                                    onChange={(e) => {
                                                        setTaxRates(prev => ({ ...prev, banda: parseFloat(e.target.value) || 0 }));
                                                    }}
                                                    disabled={!isEditingTaxes}
                                                    className="bg-slate-800 border-slate-700"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="custo-desp-rate">Custo/Desp (%)</Label>
                                                <Input
                                                    id="custo-desp-rate"
                                                    type="number"
                                                    step="0.01"
                                                    value={taxRates.custoDesp.toFixed(2)}
                                                    onChange={(e) => {
                                                        setTaxRates(prev => ({ ...prev, custoDesp: parseFloat(e.target.value) || 0 }));
                                                    }}
                                                    disabled={!isEditingTaxes}
                                                    className="bg-slate-800 border-slate-700"
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                            </div>


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
                                                    <span className="text-blue-300 font-semibold">{formatCurrency(dreCalculations.receitaBruta)}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-300">Anual:</span>
                                                    <span className="text-blue-300 font-semibold">{formatCurrency(dreCalculations.receitaBruta * 12)}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-300">Setup:</span>
                                                    <span className="text-blue-300 font-semibold">{formatCurrency(dreCalculations.taxaInstalacao)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* CUSTOS */}
                                        <div className="bg-gradient-to-br from-red-900/50 to-red-800/30 p-4 rounded-lg border border-red-500/30">
                                            <h3 className="text-sm font-semibold text-red-300 mb-3 uppercase tracking-wide">CUSTOS</h3>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-300">Banda:</span>
                                                    <span className="text-red-300 font-semibold">{formatCurrency(dreCalculations.custoBanda)}</span>
                                                </div>
	                                                <div className="flex justify-between text-sm">
	                                                    <span className="text-gray-300">Comissão Vendedor:</span>
	                                                    <span className="text-red-300 font-semibold">{formatCurrency(dreCalculations.comissaoVendedor)}</span>
	                                                </div>
	                                                <div className="flex justify-between text-sm">
	                                                    <span className="text-gray-300">Comissão Diretor:</span>
	                                                    <span className="text-red-300 font-semibold">{formatCurrency(dreCalculations.comissaoDiretor)}</span>
	                                                </div>
	                                                {includeReferralPartner && (
	                                                    <div className="flex justify-between text-sm">
	                                                        <span className="text-gray-300">Comissão P. Indicador:</span>
	                                                        <span className="text-red-300 font-semibold">{formatCurrency(dreCalculations.comissaoParceiroIndicador)}</span>
	                                                    </div>
	                                                )}
                                                {includeInfluencerPartner && (
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-300">Comissão P. Influenciador:</span>
                                                        <span className="text-red-300 font-semibold">{formatCurrency(dreCalculations.comissaoParceiroInfluenciador)}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-300">Impostos:</span>
                                                    <span className="text-red-300 font-semibold">{formatCurrency(dreCalculations.totalImpostos)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* LUCRO */}
                                        <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 p-4 rounded-lg border border-green-500/30">
                                            <h3 className="text-sm font-semibold text-green-300 mb-3 uppercase tracking-wide">LUCRO</h3>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-300">Operacional:</span>
                                                    <span className={`font-semibold ${dreCalculations.lucroOperacional >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                                        {formatCurrency(dreCalculations.lucroOperacional)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-300">Líquido:</span>
                                                    <span className={`font-semibold ${dreCalculations.lucroLiquido >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                                        {formatCurrency(dreCalculations.lucroLiquido)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-300">Anual:</span>
                                                    <span className={`font-semibold ${dreCalculations.lucroLiquido >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                                        {formatCurrency(dreCalculations.lucroLiquido * 12)}
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
                                                    <span className={`font-semibold ${dreCalculations.rentabilidade >= 0 ? 'text-purple-300' : 'text-red-300'}`}>
                                                        {dreCalculations.rentabilidade.toFixed(1)}%
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-300">Payback:</span>
                                                    <span className="text-purple-300 font-semibold">
                                                        {dreCalculations.paybackMeses}m
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-300">ROI Anual:</span>
                                                    <span className={`font-semibold ${dreCalculations.rentabilidade >= 0 ? 'text-purple-300' : 'text-red-300'}`}>
                                                        {(dreCalculations.rentabilidade * 12).toFixed(1)}%
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
                                                    {formatCurrency(dreCalculations.receitaBruta * 12)}
                                                </div>
                                                <div className="text-sm text-slate-400">Receita Total (12m)</div>
                                            </div>
                                            <div className="text-center">
                                                <div className={`text-2xl font-bold ${dreCalculations.lucroLiquido >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {formatCurrency(dreCalculations.lucroLiquido * 12)}
                                                </div>
                                                <div className="text-sm text-slate-400">Lucro Total (12m)</div>
                                            </div>
                                            <div className="text-center">
                                                <div className={`text-2xl font-bold ${dreCalculations.rentabilidade >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {dreCalculations.rentabilidade.toFixed(1)}%
                                                </div>
                                                <div className="text-sm text-slate-400">Margem Líquida</div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                        )}
                        {canEditCommissions && (
                            <TabsContent value="prices">
                                <Card className="bg-slate-900/80 border-slate-800 text-white mt-4">
                                    <CardHeader>
                                        <CardTitle className="text-white">Tabela de Preços - Rede Man/MPLS Radio</CardTitle>
                                        <CardDescription>Atualize os preços conforme necessário</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="border-slate-700">
                                                        <TableHead className="text-white">Velocidade</TableHead>
                                                        <TableHead className="text-right text-white">12 meses</TableHead>
                                                        <TableHead className="text-right text-white">24 meses</TableHead>
                                                        <TableHead className="text-right text-white">36 meses</TableHead>
                                                        <TableHead className="text-right text-white">48 meses</TableHead>
                                                        <TableHead className="text-right text-white">60 meses</TableHead>
                                                        <TableHead className="text-right text-white">Taxa de Instalação</TableHead>
                                                        <TableHead className="text-right text-white">Custo Rádio</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {radioPlans.map((plan, index) => (
                                                        <TableRow key={plan.speed} className="border-slate-800">
                                                            <TableCell className="font-medium">{plan.description}</TableCell>
                                                            <TableCell>
                                                                <Input type="number" step="0.01" value={plan.price12 || ''} onChange={(e) => handlePriceChange(index, 'price12', e.target.value)} placeholder="0.00" className="text-right bg-slate-800 border-slate-700" />
                                                            </TableCell>
                                                            <TableCell>
                                                                <Input type="number" step="0.01" value={plan.price24 || ''} onChange={(e) => handlePriceChange(index, 'price24', e.target.value)} placeholder="0.00" className="text-right bg-slate-800 border-slate-700" />
                                                            </TableCell>
                                                            <TableCell>
                                                                <Input type="number" step="0.01" value={plan.price36 || ''} onChange={(e) => handlePriceChange(index, 'price36', e.target.value)} placeholder="0.00" className="text-right bg-slate-800 border-slate-700" />
                                                            </TableCell>
                                                            <TableCell>
                                                                <Input type="number" step="0.01" value={plan.price48 || ''} onChange={(e) => handlePriceChange(index, 'price48', e.target.value)} placeholder="0.00" className="text-right bg-slate-800 border-slate-700" />
                                                            </TableCell>
                                                            <TableCell>
                                                                <Input type="number" step="0.01" value={plan.price60 || ''} onChange={(e) => handlePriceChange(index, 'price60', e.target.value)} placeholder="0.00" className="text-right bg-slate-800 border-slate-700" />
                                                            </TableCell>
                                                            <TableCell>
                                                                <Input type="number" step="0.01" value={plan.installationCost || ''} onChange={(e) => handlePriceChange(index, 'installationCost', e.target.value)} placeholder="0.00" className="text-right bg-slate-800 border-slate-700" />
                                                            </TableCell>
                                                            <TableCell>
                                                                <Input type="number" step="0.01" value={plan.radioCost || ''} onChange={(e) => handlePriceChange(index, 'radioCost', e.target.value)} placeholder="0.00" className="text-right bg-slate-800 border-slate-700" />
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        <div className="flex justify-end mt-4">
                                            <Button onClick={handleSavePrices} className="bg-blue-600 hover:bg-blue-700">
                                                <Save className="h-4 w-4 mr-2" />
                                                Salvar Preços
                                            </Button>
                                        </div>

                                        {/* Informações de Contrato */}
                                        <div className="mt-8">
                                            <h3 className="text-xl font-semibold mb-4 text-white">Informações de Contrato</h3>
                                            <div className="space-y-2 text-white">
                                                <p>Contratos de 12 meses - Payback 08 meses</p>
                                                <p>Contratos de 24 meses - Payback 10 meses</p>
                                                <p>Contratos de 36 meses - Payback 11 meses</p>
                                                <p>Contratos de 48 meses - Payback 13 meses</p>
                                                <p>Contratos de 60 meses - Payback 14 meses</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        )}
                        {canEditCommissions && (
                        <TabsContent value="commissions-table">
                            <CommissionTablesUnified />
                        </TabsContent>
                        )}
                    </Tabs>
                </>
            )}
        </div>
    );
};

export default InternetManRadioCalculator;
