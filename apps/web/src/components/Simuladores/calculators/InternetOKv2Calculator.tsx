"use client";

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
import { ClientData, AccountManagerData } from '@/lib/types';
import { ClientManagerInfo } from './ClientManagerInfo';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/use-auth';
import { useCommissions, getCommissionRate, getChannelIndicatorCommissionRate, getChannelInfluencerCommissionRate, getChannelSellerCommissionRate, getSellerCommissionRate, getDirectorCommissionRate } from '@/hooks/use-commissions';
import { getPermissionsForRole, normalizeUserRole } from '@/lib/permissions';
import { generateNextProposalId } from '@/lib/proposal-id-generator';
import { getCRMAuthHeaders } from '@/config/api';
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
    type: 'FIBRA';
    description: string;
    setup: number;
    monthly: number;
    details: {
        speed?: number;
        contractTerm?: number;
        includeInstallation?: boolean;
        planDescription?: string;
        doubleFiberRadioCost?: number;
        applySalespersonDiscount?: boolean;
        appliedDirectorDiscountPercentage?: number;
        includeReferralPartner?: boolean;
        [key: string]: any;
    };
}

interface DoubleFiberRadioPlan {
    speed: number;
    price12: number;
    price24: number;
    price36: number;
    price48: number;
    price60: number;
    installationCost: number;
    description: string;
    baseCost: number;
    doubleFiberRadioCost: number;
}

interface Proposal {
    id: string;
    baseId: string;
    version: number;
    client: ClientData;
    accountManager: AccountManagerData;
    products: Product[];
    totalSetup: number;
    totalMonthly: number;
    createdAt: string;
    updatedAt?: string;
    updatedBy?: string;
    title?: string;
    status?: string;
    distributorId?: string;
    date?: string;
    expiryDate?: string;
    value: number;
    type: string;
    changes?: string;
    clientData?: ClientData;
    items?: any[];
    applySalespersonDiscount?: boolean;
    appliedDirectorDiscountPercentage?: number;
    baseTotalMonthly?: number;
    contractPeriod?: string;
    createdBy?: string;
}

// Helper function to get monthly price based on contract term
const getMonthlyPrice = (plan: DoubleFiberRadioPlan, term: number): number => {
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
    // Returns the maximum allowed payback period for each contract term
    switch (contractTerm) {
        case 12: return 8;
        case 24: return 10;
        case 36: return 11;
        case 48: return 13;
        case 60: return 14;
        default: return 8;
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

// Tabela de Comissão do Parceiro Indicador (Valores - Receita Mensal)
// Usa ate24% até 24 meses e mais24% acima de 24 meses
const PARTNER_INDICATOR_RANGES = [
    { min: 0, max: 500, ate24: 1.5, mais24: 2.5 },
    { min: 500.01, max: 1000, ate24: 2.5, mais24: 4.0 },
    { min: 1000.01, max: 1500, ate24: 4.01, mais24: 5.5 },
    { min: 1500.01, max: 3000, ate24: 5.51, mais24: 7.0 },
    { min: 3000.01, max: 5000, ate24: 7.01, mais24: 8.5 },
    { min: 5000.01, max: 6500, ate24: 8.51, mais24: 10.0 },
    { min: 6500.01, max: 9000, ate24: 10.01, mais24: 11.5 },
    { min: 9000.01, max: Infinity, ate24: 11.51, mais24: 13.0 },
];

// Função movida para dentro do componente para acessar o hook useCommissions

// Function to handle tax rate changes
const handleTaxRateChange = (taxType: string, value: string) => {
    // Remove non-numeric characters and convert to number
    const numericValue = parseFloat(value.replace(/[^0-9,.]+/g, "").replace(",", ".")) || 0;
    return numericValue;
};

interface InternetOKv2CalculatorProps {
    onBackToDashboard?: () => void;
}

const InternetOKv2Calculator: React.FC<InternetOKv2CalculatorProps> = ({ onBackToDashboard }) => {
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
    const [doubleFiberRadioPlans, setDoubleFiberRadioPlans] = useState<DoubleFiberRadioPlan[]>([]);
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

    // Hook para comissões editáveis
    const { channelIndicator, channelInfluencer, channelSeller, seller, channelDirector } = useCommissions();

    // Função para obter taxa de comissão do Parceiro Indicador usando as tabelas editáveis
    // Usa apenas o valor mensal para buscar o percentual na tabela de comissões
    const getPartnerIndicatorRate = useCallback((monthlyRevenue: number, contractMonths: number): number => {
        if (!channelIndicator || !includeReferralPartner) return 0;
        return getChannelIndicatorCommissionRate(channelIndicator, monthlyRevenue, contractMonths) / 100;
    }, [channelIndicator, includeReferralPartner]);

    // Função para obter taxa de comissão do Parceiro Influenciador usando as tabelas editáveis
    // Usa apenas o valor mensal para buscar o percentual na tabela de comissões
    const getPartnerInfluencerRate = useCallback((monthlyRevenue: number, contractMonths: number): number => {
        if (!channelInfluencer || !includeInfluencerPartner) return 0;
        return getChannelInfluencerCommissionRate(channelInfluencer, monthlyRevenue, contractMonths) / 100;
    }, [channelInfluencer, includeInfluencerPartner]);

    // Estados para DRE e tributação
    const [isEditingTaxes, setIsEditingTaxes] = useState<boolean>(false);
    const [commissionPercentage, setCommissionPercentage] = useState<number>(0);
    const [taxRates, setTaxRates] = useState({
        cssl: 0.09,
        inss: 0.20,
        iss: 0.05,
        simplesNacional: 15.00,
        totalTaxes: 0,
        fundraising: 0.02,
        rate: 0.05,
        margem: 0.30,
        banda: 2.09,
        custoDesp: 49.28
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
    const { user } = useAuth();
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
        const plan = doubleFiberRadioPlans.find(p => p.speed === selectedSpeed);
        if (!plan) return null;

        let monthlyPrice = getMonthlyPrice(plan, debouncedContractTerm);

        // Aplicar descontos
        monthlyPrice = applyDiscounts(monthlyPrice);

        // Aplicar 20% de acréscimo se há parceiros (Indicador ou Influenciador)
        const temParceiros = includeReferralPartner || includeInfluencerPartner;
        if (temParceiros) {
            monthlyPrice = monthlyPrice * 1.20; // Acréscimo de 20%
            console.log('Acréscimo de 20% aplicado no result.monthlyPrice - InternetOKv2:', monthlyPrice);
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
            doubleFiberRadioCost: plan.doubleFiberRadioCost,
            paybackValidation: (() => {
                const totalCommissions = calculateTotalCommissions(monthlyPrice, contractTerm);
                return validatePayback({
                    installationFee: includeInstallation ? plan.installationCost : 0,
                    manCost: plan.doubleFiberRadioCost,
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
        doubleFiberRadioPlans,
        debouncedContractTerm,
        includeReferralPartner,
        includeInfluencerPartner,
        applySalespersonDiscount,
        appliedDirectorDiscountPercentage,
        includeInstallation,
        applyDiscounts,
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
                // Filter for Fibra Internet proposals
                if (result.success && result.data && result.data.proposals) {
                    const fibraProposals = result.data.proposals.filter((p: any) =>
                        p.type === 'FIBER' || p.base_id?.startsWith('Prop_Inter_Fibra_')
                    );
                    console.log(`📊 Total de propostas FIBER carregadas: ${fibraProposals.length}`);
                    setProposals(fibraProposals);
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
        const initialDoubleFiberRadioPlans: DoubleFiberRadioPlan[] = [
            { speed: 25, price12: 1080.00, price24: 790.50, price36: 711.00, price48: 711.00, price60: 711.00, installationCost: 998.00, description: "25 Mbps", baseCost: 1580.00, doubleFiberRadioCost: 7080.00 },
            { speed: 30, price12: 1110.12, price24: 868.50, price36: 790.50, price48: 790.50, price60: 790.50, installationCost: 998.00, description: "30 Mbps", baseCost: 1580.00, doubleFiberRadioCost: 7080.00 },
            { speed: 40, price12: 1372.52, price24: 948.00, price36: 868.50, price48: 868.50, price60: 868.50, installationCost: 998.00, description: "40 Mbps", baseCost: 1580.00, doubleFiberRadioCost: 7080.00 },
            { speed: 50, price12: 1655.09, price24: 1027.50, price36: 948.00, price48: 948.00, price60: 948.00, installationCost: 998.00, description: "50 Mbps", baseCost: 1580.00, doubleFiberRadioCost: 7080.00 },
            { speed: 60, price12: 2321.16, price24: 1185.00, price36: 1105.50, price48: 1105.50, price60: 1105.50, installationCost: 998.00, description: "60 Mbps", baseCost: 1580.00, doubleFiberRadioCost: 7080.00 },
            { speed: 80, price12: 2738.97, price24: 1500.00, price36: 1422.00, price48: 1422.00, price60: 1422.00, installationCost: 998.00, description: "80 Mbps", baseCost: 5700.00, doubleFiberRadioCost: 7080.00 },
            { speed: 100, price12: 3025.58, price24: 2367.00, price36: 1974.00, price48: 1974.00, price60: 1974.00, installationCost: 1996.00, description: "100 Mbps", baseCost: 5700.00, doubleFiberRadioCost: 10200.00 },
            { speed: 150, price12: 3814.77, price24: 2682.00, price36: 2290.50, price48: 2290.50, price60: 2290.50, installationCost: 1996.00, description: "150 Mbps", baseCost: 5700.00, doubleFiberRadioCost: 10200.00 },
            { speed: 200, price12: 4823.97, price24: 3079.50, price36: 2605.50, price48: 2605.50, price60: 2605.50, installationCost: 1996.00, description: "200 Mbps", baseCost: 5700.00, doubleFiberRadioCost: 10200.00 },
            { speed: 300, price12: 11283.00, price24: 6474.00, price36: 6000.00, price48: 6000.00, price60: 6000.00, installationCost: 2500.00, description: "300 Mbps", baseCost: 23300.00, doubleFiberRadioCost: 26700.00 },
            { speed: 400, price12: 14203.50, price24: 7816.50, price36: 7104.00, price48: 7104.00, price60: 7104.00, installationCost: 2500.00, description: "400 Mbps", baseCost: 23300.00, doubleFiberRadioCost: 32360.00 },
            { speed: 500, price12: 16761.00, price24: 8683.50, price36: 7879.50, price48: 7879.50, price60: 7879.50, installationCost: 2500.00, description: "500 Mbps", baseCost: 23300.00, doubleFiberRadioCost: 32360.00 },
            { speed: 600, price12: 18750.00, price24: 9472.50, price36: 8685.00, price48: 8685.00, price60: 8685.00, installationCost: 2500.00, description: "600 Mbps", baseCost: 23300.00, doubleFiberRadioCost: 32360.00 },
            { speed: 700, price12: 20700.00, price24: 10350.00, price36: 9450.00, price48: 9450.00, price60: 9450.00, installationCost: 2500.00, description: "700 Mbps", baseCost: 23300.00, doubleFiberRadioCost: 32360.00 },
            { speed: 800, price12: 22500.00, price24: 11250.00, price36: 10200.00, price48: 10200.00, price60: 10200.00, installationCost: 2500.00, description: "800 Mbps", baseCost: 23300.00, doubleFiberRadioCost: 32360.00 },
            { speed: 900, price12: 24300.00, price24: 12150.00, price36: 10950.00, price48: 10950.00, price60: 10950.00, installationCost: 2500.00, description: "900 Mbps", baseCost: 23300.00, doubleFiberRadioCost: 32360.00 },
            { speed: 1000, price12: 26250.00, price24: 13125.00, price36: 11850.00, price48: 11850.00, price60: 11850.00, installationCost: 2500.00, description: "1000 Mbps (1 Gbps)", baseCost: 23300.00, doubleFiberRadioCost: 32360.00 }
        ];
        // Force update with new fiber cost values
        setDoubleFiberRadioPlans(initialDoubleFiberRadioPlans);
        // Save the updated values to localStorage
        localStorage.setItem('doubleFiberRadioLinkPrices', JSON.stringify(initialDoubleFiberRadioPlans));

        fetchProposals();
    }, [fetchProposals]);

    // Detectar mudanças nos valores para mostrar botão de nova versão
    useEffect(() => {
        if (currentProposal?.id) {
            setHasChanged(true);
        }
    }, [selectedSpeed, contractTerm, clientData, accountManagerData, applySalespersonDiscount, appliedDirectorDiscountPercentage, includeReferralPartner, includeInfluencerPartner, currentProposal?.id]);

    // Removed debug useEffect to prevent unnecessary re-renders

    // Funções
    const formatCurrency = (value: number | undefined | null) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    const generateUniqueId = () => {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    };

    const handlePriceChange = (index: number, field: keyof Omit<DoubleFiberRadioPlan, 'description' | 'baseCost' | 'speed'>, value: string) => {
        const newPlans = [...doubleFiberRadioPlans];
        const numericValue = parseFloat(value.replace(/[^0-9,.]+/g, "").replace(",", "."));
        if (!isNaN(numericValue)) {
            (newPlans[index] as any)[field] = numericValue;
            setDoubleFiberRadioPlans(newPlans);
        }
    };

    // DRE calculations - Melhorado conforme solicitação
    // Dados base: Velocidade 600 Mbps, Taxa de instalação = 2500,00, Custo Fibra/Radio = 7000,00
    const velocidade = result?.speed || 600;
    const taxaInstalacao = includeInstallation ? (result?.installationCost || 2500) : 0;
    const custoDoubleFiberRadio = result?.doubleFiberRadioCost || 7000;

    // Helper para acessar dreCalculations de forma segura
    const getDreValue = (calculations: any, period: number | string, field: string) => {
        return calculations?.[period]?.[field] || 0;
    };

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
            console.log('DEBUG - InternetOKv2:', {
                includeReferralPartner,
                includeInfluencerPartner,
                temParceiros,
                monthlyValueBefore: monthlyValue
            });

            if (temParceiros) {
                const originalValue = monthlyValue;
                monthlyValue = monthlyValue * 1.20; // Acréscimo de 20%
                console.log('Acréscimo de 20% aplicado por parceiros - InternetOKv2:', {
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

        // Custo Fibra/Radio vem da calculadora conforme prazo contratual e velocidade
        const custoDoubleFiberRadioCalculadora = custoDoubleFiberRadio;

        const fundraising = 0; // Conforme tabela
        // Last Mile como custo mensal adicional (pass-through): (mensalidade_com_last_mile - mensalidade_base) * meses
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

        const comissaoParceiroIndicador = includeReferralPartner
            ? baseComissionValue * (getPartnerIndicatorRate(monthlyValue, contractTerm))
            : 0;

        const comissaoParceiroInfluenciador = includeInfluencerPartner
            ? baseComissionValue * (getPartnerInfluencerRate(monthlyValue, contractTerm))
            : 0;

        // Calcular a comissão do vendedor baseado na presença de parceiros
        const temParceiros = includeReferralPartner || includeInfluencerPartner;
        const comissaoVendedor = baseComissionValue > 0 ? (temParceiros
            ? (baseComissionValue * (getChannelSellerCommissionRate(channelSeller, contractTerm) / 100)) // Canal/Vendedor quando há parceiros
            : (baseComissionValue * (getSellerCommissionRate(seller, contractTerm) / 100))) // Vendedor quando não há parceiros
            : 0;

        // Comissão Diretor (conforme tabela Comissão Diretor e prazo contratual selecionado)
        const comissaoDiretor = baseComissionValue > 0 && channelDirector
            ? (baseComissionValue * (getDirectorCommissionRate(channelDirector, contractTerm) / 100))
            : 0;

        // Total das comissões
        const totalComissoes = comissaoVendedor + comissaoDiretor + comissaoParceiroIndicador + comissaoParceiroInfluenciador;

        const custoDespesa = receitaTotalPrimeiromes * ((taxRates.custoDesp || 0) / 100);

        // Balance (Lucro Líquido) - Receita total (incluindo instalação) menos todos os custos
        const balance = receitaTotalPrimeiromes - custoBanda - custoDoubleFiberRadioCalculadora - lastMile - simplesNacional - totalComissoes - custoDespesa;

        // Payback Calculation (mes 0 + mes 1..N)
        const paybackMonths = calculatePayback({
            installationFee: receitaInstalacao,
            manCost: custoDoubleFiberRadioCalculadora,
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
        const valorInvestido = custoDoubleFiberRadioCalculadora + lastMile + receitaInstalacao; // Investimento inicial total
        const roi = valorInvestido > 0 ? (balance / valorInvestido) * 100 : 0;

        // 3. ROI Anualizado: ROI ajustado para base anual
        const roiAnualizado = months > 0 ? (roi * 12) / months : 0;

        // 4. Rentabilidade sobre Vendas: mesmo que margem líquida (manter compatibilidade)
        const rentabilidade = margemLiquida;

        // 5. Lucratividade: Lucro por período (mantendo para compatibilidade)
        const receitaPeriodo = monthlyValue * months;
        const lucratividade = receitaPeriodo > 0 ? (balance / receitaPeriodo) * 100 : 0;

        // 6. Markup: (Preço de Venda - Custo) / Custo * 100
        const totalCost = custoBanda + custoDoubleFiberRadioCalculadora + lastMile + simplesNacional + totalComissoes + custoDespesa;
        const markup = totalCost > 0 ? ((receitaTotalPrimeiromes - totalCost) / totalCost) * 100 : 0;

        // Calcular diferença de valores contrato para clientes existentes
        // Usar o valor mensal com descontos aplicados (monthlyValue) menos a mensalidade anterior
        const diferencaMensal = isExistingClient && previousMonthlyFee > 0
            ? (monthlyValue - previousMonthlyFee)
            : 0;
        const diferencaValoresContrato = diferencaMensal * months;

        return {
            receitaMensal: totalRevenue, // Agora é receita total do período
            receitaInstalacao,
            receitaTotalPrimeiromes,
            custoDoubleFiberRadio: custoDoubleFiberRadioCalculadora, // Custo Fibra/Radio da calculadora
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
            paybackMonths, // Adicionando o payback
            diferencaValoresContrato // Novo campo para DRE
        };
    }, [
        result,
        taxaInstalacao,
        custoDoubleFiberRadio,
        taxRates.simplesNacional,
        taxRates.custoDesp,
        taxRates.banda,

        includeReferralPartner,
        includeInfluencerPartner,
        isExistingClient,
        previousMonthlyFee,
        createLastMile,
        lastMilePercentage,
        applySalespersonDiscount,
        appliedDirectorDiscountPercentage,
        contractTerm,
        applyDiscounts,
        channelSeller,
        channelDirector,
        getPartnerIndicatorRate,
        getPartnerInfluencerRate,
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
	            custoServico: dre12.custoDoubleFiberRadio,
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
        localStorage.setItem('doubleFiberRadioLinkPrices', JSON.stringify(doubleFiberRadioPlans));

        // Show success message or update UI as needed
        alert('Preços salvos com sucesso!');
    };

    const handleAddProduct = () => {
        if (!result) return;

        const newProduct: Product = {
            id: `prod-${Date.now()}`,
            type: 'FIBRA',
            description: `Fibra ${result.speed} Mbps`,
            setup: includeInstallation ? result.installationCost : 0,
            monthly: result.monthlyPrice,
            details: {
                speed: result.speed,
                contractTerm,
                includeInstallation,
                planDescription: result.description,
                doubleFiberRadioCost: result.doubleFiberRadioCost,
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
                doubleFiberRadioCost: result?.doubleFiberRadioCost ?? product.details?.doubleFiberRadioCost,
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
                    title: `Proposta Internet Fibra V${proposalVersion} - ${clientData.companyName || clientData.name || 'Cliente'}`,
                    client: clientData.companyName || clientData.name || 'Cliente não informado',
                    value: finalTotalMonthly,
                    type: 'FIBER',
                    status: selectedStatus,
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
                    userId: user.id,
                    changes: proposalChanges,
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
                    alert(`Proposta ${updatedProposal.base_id || updatedProposal.id} atualizada com sucesso!`);
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
                const baseId = generateNextProposalId(proposalsWithBaseId, 'FIBER', proposalVersion);
                console.log('🆔 ID gerado para nova proposta Fibra:', baseId);

                const proposalToSave = {
                    base_id: baseId,
                    title: `Proposta Internet Fibra V${proposalVersion} - ${clientData.companyName || clientData.name || 'Cliente'}`,
                    client: clientData.companyName || clientData.name || 'Cliente não informado',
                    value: finalTotalMonthly,
                    type: 'FIBER',
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
                    userId: user.id,
                    changes: proposalChanges,
                };

                const response = await fetch('/api/simulator/proposals', {
                    method: 'POST',
                    headers: getCRMAuthHeaders(),
                    body: JSON.stringify(proposalToSave),
                });

                if (response.ok) {
                    const result = await response.json();
                    const savedProposal = result.data || result;
                    alert(`Proposta ${savedProposal.base_id || savedProposal.id} salva com sucesso!`);
                    setCurrentProposal(savedProposal);
                    setProposals(prev => [savedProposal, ...prev]);
                } else {
                    throw new Error('Erro ao salvar proposta');
                }
            }

            fetchProposals();
            clearForm();
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
            if (saveAsNewVersion && currentProposal) {
                const baseIdToUse = currentProposal.baseId || (currentProposal as any).base_id;
                if (!baseIdToUse) {
                    alert('Proposta atual não possui ID base válido');
                    return;
                }
                // Importar a função de geração de nova versão
                const { generateNewVersion } = await import('@/lib/proposal-id-generator');
                
                // Mapear propostas para o formato esperado
                const proposalsWithBaseId = proposals.map((p: any) => ({
                    base_id: p.base_id || p.baseId || ''
                }));
                
                // Gerar novo ID com versão incrementada
                const newBaseId = generateNewVersion(baseIdToUse, proposalsWithBaseId);
                
                // Forçar criação de nova proposta com nova versão
                const productsToSave = buildProductsForSave(addedProducts);
                const baseTotalMonthly = productsToSave.reduce((sum, p) => sum + p.monthly, 0);
                const totalSetup = productsToSave.reduce((sum, p) => sum + p.setup, 0);
                const finalTotalMonthly = applyDiscounts(baseTotalMonthly);
                
                const proposalToSave = {
                    base_id: newBaseId,
                    title: `Proposta Internet Fibra - ${clientData.companyName || clientData.name || 'Cliente'}_v${parseInt(newBaseId.match(/_v(\d+)$/)?.[1] || '1')}`,
                    client: clientData.companyName || clientData.name || 'Cliente não informado',
                    value: finalTotalMonthly,
                    type: 'FIBER',
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
                    changes: proposalChanges,
                };

                const response = await fetch('/api/simulator/proposals', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(proposalToSave),
                });

                if (response.ok) {
                    const newProposal = await response.json();
                    alert(`Nova versão criada com sucesso! ID: ${newProposal.data.base_id}`);
                    setCurrentProposal(newProposal.data);
                    setProposals(prev => [newProposal.data, ...prev]);
                } else {
                    throw new Error('Erro ao criar nova versão');
                }
            } else {
                // Usar a função saveProposal existente
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
            setAccountManagerData(proposal.accountManager);
        }

        // Handle products - check multiple possible locations and formats
        let products: any[] = [];
        // Tentar em proposal.products, metadata.products, proposal.items
        if (proposal.products && Array.isArray(proposal.products) && proposal.products.length > 0) {
            products = proposal.products;
        } else if (proposal.metadata?.products && Array.isArray(proposal.metadata.products) && proposal.metadata.products.length > 0) {
            products = proposal.metadata.products;
        } else if (proposal.items && Array.isArray(proposal.items)) {
            // Convert items to products format if needed
            products = proposal.items.map((item: any) => ({
                id: item.id || `item-${Date.now()}`,
                type: 'FIBER',
                description: item.description || 'Internet Fibra',
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

        console.log('Products:', proposal.products);
        console.log('Items:', proposal.items);
        console.log('Full proposal JSON:', JSON.stringify(proposal, null, 2));

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
            setAccountManagerData(proposal.accountManager);
        }

        // Handle products - check multiple possible locations and formats
        let products: any[] = [];
        // Tentar em proposal.products, metadata.products, proposal.items
        if (proposal.products && Array.isArray(proposal.products) && proposal.products.length > 0) {
            products = proposal.products;
        } else if (proposal.metadata?.products && Array.isArray(proposal.metadata.products) && proposal.metadata.products.length > 0) {
            products = proposal.metadata.products;
        } else if (proposal.items && Array.isArray(proposal.items)) {
            // Convert items to products format if needed
            products = proposal.items.map((item: any) => ({
                id: item.id || `item-${Date.now()}`,
                type: 'FIBER',
                description: item.description || 'Internet Fibra',
                setup: item.setup || 0,
                monthly: item.monthly || 0,
                details: item.details || {}
            }));
        }

        console.log('Processed products:', products);
        setAddedProducts(products);

        // Load all calculation parameters from the first product if available
        if (products && products.length > 0) {
            const firstProduct = products[0];
            console.log('First product:', firstProduct);
            console.log('First product details:', firstProduct.details);

            if (firstProduct.details) {
                // Set calculator parameters based on saved product details
                if (firstProduct.details.speed) {
                    console.log('Setting speed:', firstProduct.details.speed);
                    setSelectedSpeed(firstProduct.details.speed);
                }
                const savedContractTerm = Number(
                    firstProduct.details.contractTerm ||
                    proposal.contractPeriod ||
                    (proposal as any).contract_period ||
                    0
                );
                if (savedContractTerm > 0) {
                    setContractTerm(savedContractTerm);
                }
                if (firstProduct.details.includeInstallation !== undefined) setIncludeInstallation(firstProduct.details.includeInstallation);
                if (firstProduct.details.applySalespersonDiscount !== undefined) setApplySalespersonDiscount(firstProduct.details.applySalespersonDiscount);
                if (firstProduct.details.appliedDirectorDiscountPercentage !== undefined) setAppliedDirectorDiscountPercentage(firstProduct.details.appliedDirectorDiscountPercentage);
                if (firstProduct.details.includeReferralPartner !== undefined) setIncludeReferralPartner(firstProduct.details.includeReferralPartner);
            }
        }

        // Load status and changes
        setSelectedStatus(proposal.status || 'Aguardando Aprovação do Cliente');
        setSelectedForecastTemperature(String((proposal as any).forecastTemperature ?? (proposal as any).metadata?.forecastTemperature ?? 50));
        setProposalChanges(proposal.changes || '');

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
                    headers: {
                        'Content-Type': 'application/json',
                    },
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
        p.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.baseId || p.id).toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                title="Nova Proposta - Internet via Fibra"
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
                        <CardTitle>Buscar Propostas - Internet via Fibra</CardTitle>
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
                                <p className="text-gray-600">Internet via Fibra Óptica</p>
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

                        {/* Resumo Financeiro */}
                        <div className="border-t pt-4 print:pt-2">
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">Resumo Financeiro</h3>

                            {/* Show discount breakdown if discounts were applied */}
                            {((currentProposal.applySalespersonDiscount ?? currentProposal.metadata?.applySalespersonDiscount) || ((currentProposal.appliedDirectorDiscountPercentage ?? currentProposal.metadata?.appliedDirectorDiscountPercentage) || 0) > 0) && (
                                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded">
                                    <h4 className="font-semibold text-orange-800 mb-2">Descontos Aplicados</h4>
                                    <div className="text-sm space-y-1">
                                        <p><strong>Valores Originais:</strong></p>
                                        <p className="ml-4">Setup: {formatCurrency(currentProposal.totalSetup || 0)}</p>
                                        <p className="ml-4">Mensal: {formatCurrency(currentProposal.baseTotalMonthly || currentProposal.metadata?.baseTotalMonthly || currentProposal.totalMonthly || currentProposal.metadata?.totalMonthly || 0)}</p>

                                        {(currentProposal.applySalespersonDiscount ?? currentProposal.metadata?.applySalespersonDiscount) && (
                                            <p className="text-orange-600"><strong>Desconto Vendedor (5%):</strong> -R$ {((currentProposal.baseTotalMonthly || currentProposal.metadata?.baseTotalMonthly || currentProposal.totalMonthly || currentProposal.metadata?.totalMonthly || 0) * 0.05).toFixed(2).replace('.', ',')}</p>
                                        )}

                                        {((currentProposal.appliedDirectorDiscountPercentage ?? currentProposal.metadata?.appliedDirectorDiscountPercentage) || 0) > 0 && (
                                            <p className="text-orange-600"><strong>Desconto Diretor ({currentProposal.appliedDirectorDiscountPercentage || 0}%):</strong> -R$ {(((currentProposal.baseTotalMonthly || currentProposal.metadata?.baseTotalMonthly || currentProposal.totalMonthly || currentProposal.metadata?.totalMonthly || 0) * (currentProposal.applySalespersonDiscount ? 0.95 : 1)) * ((currentProposal.appliedDirectorDiscountPercentage || 0) / 100)).toFixed(2).replace('.', ',')}</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p><strong>Total Setup {((currentProposal.applySalespersonDiscount ?? currentProposal.metadata?.applySalespersonDiscount) || ((currentProposal.appliedDirectorDiscountPercentage ?? currentProposal.metadata?.appliedDirectorDiscountPercentage) || 0) > 0) ? '(com desconto)' : ''}:</strong> {formatCurrency(currentProposal.totalSetup)}</p>
                                    <p><strong>Total Mensal {((currentProposal.applySalespersonDiscount ?? currentProposal.metadata?.applySalespersonDiscount) || ((currentProposal.appliedDirectorDiscountPercentage ?? currentProposal.metadata?.appliedDirectorDiscountPercentage) || 0) > 0) ? '(com desconto)' : ''}:</strong> {formatCurrency(currentProposal.totalMonthly)}</p>
                                </div>
                                <div>
                                    <p><strong>Data da Proposta:</strong> {new Date(currentProposal.createdAt).toLocaleDateString('pt-BR')}</p>
                                    <p><strong>ID da Proposta:</strong> {currentProposal.baseId || currentProposal.id}</p>
                                    <p><strong>Versão:</strong> {currentProposal.version}</p>
                                    <p><strong>Período do Contrato:</strong> {(() => {
                                        const products = (currentProposal.items || currentProposal.products || []) as any[];
                                        const firstProduct = products[0];
                                        const proposalContractTerm = Number(
                                            firstProduct?.details?.contractTerm ||
                                            currentProposal.contractPeriod ||
                                            (currentProposal as any).contract_period ||
                                            0
                                        );
                                        return proposalContractTerm > 0 ? `${proposalContractTerm} meses` : 'N/A';
                                    })()}</p>
                                </div>
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
                                        const plan = doubleFiberRadioPlans.find((p) => p.speed === productSpeed);
                                        if (plan) {
                                            const totalCommissions = calculateTotalCommissions(totalMonthly, contractTerm);
                                            paybackMonths = calculatePayback({
                                                installationFee: Number(firstProduct?.setup ?? (details.includeInstallation ? plan.installationCost : 0)),
                                                manCost: Number(details.doubleFiberRadioCost ?? plan.doubleFiberRadioCost ?? 0),
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

                                    const isValid = paybackMonths <= maxPayback;

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
                                                        {doubleFiberRadioPlans.filter(p => getMonthlyPrice(p, contractTerm) > 0).map(plan => (
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
                                            <Label htmlFor="fiber-cost">Custo Fibra/Radio</Label>
                                            <Input type="text" id="fiber-cost" value={result?.doubleFiberRadioCost ? formatCurrency(result.doubleFiberRadioCost) : "R$ 0,00"} readOnly className="bg-slate-800" />
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
                                            <div className="space-y-2">
                                                <Label htmlFor="previousMonthlyFee">Mensalidade Anterior</Label>
                                                <CurrencyInput
                                                    id="previousMonthlyFee"
                                                    value={previousMonthlyFee}
                                                    onChange={setPreviousMonthlyFee}
                                                    placeholder="0,00"
                                                    className="bg-slate-800"
                                                />
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
                                                <Separator className="my-4 bg-slate-700" />

                                                {/* Controles de Desconto */}
                                                <div className="space-y-4 p-4 bg-slate-800 rounded-lg">
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

                                                <Separator className="my-4 bg-slate-700" />
                                                <div className="space-y-2">
                                                    {applySalespersonDiscount && (
                                                        <div className="flex justify-between text-orange-400">
                                                            <span>Desconto Vendedor (5%):</span>
                                                            <span>-{formatCurrency((addedProducts.reduce((sum, p) => sum + p.monthly, 0)) * 0.05)}</span>
                                                        </div>
                                                    )}
                                                    {appliedDirectorDiscountPercentage > 0 && (
                                                        <div className="flex justify-between text-orange-400">
                                                            <span>Desconto Diretor ({appliedDirectorDiscountPercentage}%) - Apenas Mensal:</span>
                                                            <span>-{formatCurrency(addedProducts.reduce((sum, p) => sum + p.monthly, 0) * (applySalespersonDiscount ? 0.95 : 1) * (appliedDirectorDiscountPercentage / 100))}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between">
                                                        <span>Total de Instalação:</span>
                                                        <span className="font-medium">{formatCurrency(addedProducts.reduce((sum, p) => sum + p.setup, 0))}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Total Mensal {(applySalespersonDiscount || appliedDirectorDiscountPercentage > 0) ? '(com desconto)' : ''}:</span>
                                                        <span className="font-medium">{formatCurrency(applyDiscounts(addedProducts.reduce((sum, p) => sum + p.monthly, 0)))}</span>
                                                    </div>

                                                    <div className="flex justify-between text-lg font-bold mt-2 pt-2 border-t border-slate-700">
                                                        <span>Total Anual {(applySalespersonDiscount || appliedDirectorDiscountPercentage > 0) ? '(com desconto)' : ''}:</span>
                                                        <span>{formatCurrency(applyDiscounts(addedProducts.reduce((sum, p) => sum + p.monthly, 0)) * 12)}</span>
                                                    </div>

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
                                                            Salvar como Nova Versão
                                                        </Button>
                                                    )}
                                                    <ProposalApprovalRequestButton
                                                        proposalId={currentProposal?.id}
                                                        disabled={!currentProposal?.id}
                                                        onRequested={() => {
                                                            if (currentProposal) {
                                                                setCurrentProposal({
                                                                    ...currentProposal,
                                                                    status: 'Aguardando Aprovação Diretoria',
                                                                });
                                                            }
                                                        }}
                                                    />
                                                    <Button onClick={saveProposal} className="bg-green-600 hover:bg-green-700">
                                                        <Save className="h-4 w-4 mr-2" />
                                                        {currentProposal ? 'Atualizar Proposta' : 'Salvar Proposta'}
                                                    </Button>
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
                                        <CardDescription>Internet Fibra {velocidade} Mbps - Análise por Período de Contrato</CardDescription>
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
                                                        <TableCell key={period} className="text-right text-white">{formatCurrency((dreCalculations as any)[period]?.receitaMensal || 0)}</TableCell>
                                                    ))}
                                                </TableRow>
                                                <TableRow className="border-slate-800">
                                                    <TableCell className="text-white">Receita - Taxa Instalação</TableCell>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableCell key={period} className="text-right text-white">{formatCurrency((dreCalculations as any)[period]?.receitaInstalacao || 0)}</TableCell>
                                                    ))}
                                                </TableRow>
                                                <TableRow className="border-slate-800 bg-blue-900/30">
                                                    <TableCell className="text-white font-semibold">Total</TableCell>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableCell key={period} className="text-right text-white">{formatCurrency(dreCalculations[period].receitaTotalPrimeiromes)}</TableCell>
                                                    ))}
                                                </TableRow>
                                                <TableRow className="border-slate-800">
                                                    <TableCell className="text-white">Custo de banda</TableCell>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableCell key={period} className="text-right text-white">{formatCurrency(dreCalculations[period].custoBanda)}</TableCell>
                                                    ))}
                                                </TableRow>
                                                <TableRow className="border-slate-800">
                                                    <TableCell className="text-white">Custo Fibra/Radio</TableCell>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableCell key={period} className="text-right text-white">{formatCurrency(dreCalculations[period].custoDoubleFiberRadio)}</TableCell>
                                                    ))}
                                                </TableRow>
                                                <TableRow className="border-slate-800">
                                                    <TableCell className="text-white">Fundraising</TableCell>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableCell key={period} className="text-right text-white">{formatCurrency(dreCalculations[period].fundraising)}</TableCell>
                                                    ))}
                                                </TableRow>
                                                <TableRow className="border-slate-800">
                                                    <TableCell className="text-white">Last Mile</TableCell>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableCell key={period} className="text-right text-white">{formatCurrency(dreCalculations[period].lastMile)}</TableCell>
                                                    ))}
                                                </TableRow>
                                                <TableRow className="border-slate-800">
                                                    <TableCell className="text-white">Simples Nacional</TableCell>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableCell key={period} className="text-right text-white">{formatCurrency(dreCalculations[period].simplesNacional)}</TableCell>
                                                    ))}
                                                </TableRow>

                                                {includeReferralPartner && (
                                                    <TableRow className="border-slate-800">
                                                        <TableCell className="text-white">Comissão Parceiro Indicador</TableCell>
                                                        {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                            <TableCell key={period} className="text-right text-white">{formatCurrency(dreCalculations[period].comissaoParceiroIndicador)}</TableCell>
                                                        ))}
                                                    </TableRow>
                                                )}
                                                {includeInfluencerPartner && (
                                                    <TableRow className="border-slate-800">
                                                        <TableCell className="text-white">Comissão Parceiro Influenciador</TableCell>
                                                        {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                            <TableCell key={period} className="text-right text-white">{formatCurrency(dreCalculations[period].comissaoParceiroInfluenciador)}</TableCell>
                                                        ))}
                                                    </TableRow>
                                                )}
	                                                <TableRow className="border-slate-800">
	                                                    <TableCell className="text-white">
	                                                        {(includeReferralPartner || includeInfluencerPartner) ? 'Comissão Canal/Vendedor' : 'Comissão Vendedor'}
	                                                    </TableCell>
	                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
	                                                        <TableCell key={period} className="text-right text-white">{formatCurrency(dreCalculations[period].comissaoVendedor)}</TableCell>
	                                                    ))}
	                                                </TableRow>
	                                                <TableRow className="border-slate-800">
	                                                    <TableCell className="text-white">Comissão Diretor</TableCell>
	                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
	                                                        <TableCell key={period} className="text-right text-white">{formatCurrency(dreCalculations[period].comissaoDiretor)}</TableCell>
	                                                    ))}
	                                                </TableRow>
	                                                {isExistingClient && previousMonthlyFee > 0 && (
	                                                    <TableRow className="border-slate-800 bg-yellow-900/30">
	                                                        <TableCell className="text-white font-semibold">Diferença de Valores Contrato</TableCell>
	                                                        {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
	                                                            <TableCell key={period} className={`text-right font-semibold ${getDreValue(dreCalculations, period, 'diferencaValoresContrato') >= 0 ? 'text-green-400' : 'text-red-400'}`}>
	                                                                {getDreValue(dreCalculations, period, 'diferencaValoresContrato') >= 0 ? '+' : ''}{formatCurrency(getDreValue(dreCalculations, period, 'diferencaValoresContrato'))}
	                                                            </TableCell>
	                                                        ))}
	                                                    </TableRow>
	                                                )}
                                                <TableRow className="border-slate-800">
                                                    <TableCell className="text-white">Custo / Despesa</TableCell>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableCell key={period} className="text-right text-white">{formatCurrency(dreCalculations[period].custoDespesa)}</TableCell>
                                                    ))}
                                                </TableRow>
                                                <TableRow className="border-slate-800 bg-green-900/50">
                                                    <TableCell className="text-white font-bold">Balance</TableCell>
                                                    {[12, 24, 36, 48, 60].filter(period => period <= contractTerm).map(period => (
                                                        <TableCell key={period} className={`text-right font-bold ${dreCalculations[period].balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {formatCurrency(dreCalculations[period].balance)}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                                <TableRow className="border-slate-800">
                                                    <TableCell className="text-white">Margem Líquida %</TableCell>
                                                    {Array.from({ length: Math.floor(contractTerm / 12) }, (_, i) => {
                                                        const months = (i + 1) * 12;
                                                        return (
                                                            <TableCell key={months} className={`text-right ${dreCalculations[months].margemLiquida >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {`${dreCalculations[months].margemLiquida.toFixed(2)}%`}
                                                            </TableCell>
                                                        );
                                                    })}
                                                </TableRow>
                                                <TableRow className="border-slate-800">
                                                    <TableCell className="text-white">Markup %</TableCell>
                                                    {Array.from({ length: Math.floor(contractTerm / 12) }, (_, i) => {
                                                        const months = (i + 1) * 12;
                                                        return (
                                                            <TableCell key={months} className={`text-right ${dreCalculations[months].markup >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {`${dreCalculations[months].markup.toFixed(2)}%`}
                                                            </TableCell>
                                                        );
                                                    })}
                                                </TableRow>
                                                <TableRow className="border-slate-800">
                                                    <TableCell className="text-white font-semibold">Rentabilidade %</TableCell>
                                                    {Array.from({ length: Math.floor(contractTerm / 12) }, (_, i) => {
                                                        const months = (i + 1) * 12;
                                                        return (
                                                            <TableCell key={months} className={`text-right font-semibold ${dreCalculations[months].rentabilidade >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {dreCalculations[months].rentabilidade.toFixed(2)}%
                                                            </TableCell>
                                                        );
                                                    })}
                                                </TableRow>
                                                <TableRow className="border-slate-800">
                                                    <TableCell className="text-white font-semibold">Lucratividade</TableCell>
                                                    {Array.from({ length: Math.floor(contractTerm / 12) }, (_, i) => {
                                                        const months = (i + 1) * 12;
                                                        return (
                                                            <TableCell key={months} className={`text-right font-semibold ${dreCalculations[months].lucratividade >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {dreCalculations[months].lucratividade.toFixed(2)}%
                                                            </TableCell>
                                                        );
                                                    })}
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
                                                                    receita: dreCalculations[period].receitaMensal,
                                                                    balance: dreCalculations[period].balance,
                                                                    rentabilidade: dreCalculations[period].rentabilidade
                                                                }));

                                                            const csvContent = "data:text/csv;charset=utf-8,"
                                                                + "Período,Receita Mensal,Balance,Rentabilidade\n"
                                                                + dreData.map(row => `${row.periodo},${row.receita},${row.balance},${row.rentabilidade}%`).join("\n");

                                                            const encodedUri = encodeURI(csvContent);
                                                            const link = document.createElement("a");
                                                            link.setAttribute("href", encodedUri);
                                                            link.setAttribute("download", `DRE_Internet_Fibra_${velocidade}Mbps.csv`);

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
                                                                sum + dreCalculations[period].receitaMensal, 0
                                                            ) / 5
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-slate-400">Por mês</div>
                                                </div>

                                                <div className="bg-slate-800/50 p-4 rounded-lg">
	                                                    <h4 className="text-sm font-medium text-slate-300 mb-2">Payback Médio</h4>
	                                                    <div className="text-xl font-bold text-purple-400">
	                                                        {(() => {
	                                                            const avgPayback = [12, 24, 36, 48, 60].reduce((sum, period) =>
	                                                                sum + (dreCalculations[period]?.paybackMonths ?? 0), 0
	                                                            ) / 5;
	                                                            return `${Math.round(avgPayback)} meses`;
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
                                                        const rentabilidade = dreCalculations[period].rentabilidade;
                                                        const maxRent = Math.max(...[12, 24, 36, 48, 60].map(p => dreCalculations[p].rentabilidade));
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
	                                                        const payback = dreCalculations[p]?.paybackMonths ?? 0;
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
                                        <CardTitle className="text-white">Tabela de Preços - Internet Fibra</CardTitle>
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
                                                        <TableHead className="text-right text-white">Custo de Instalação</TableHead>
                                                        <TableHead className="text-right text-white">Custo Fibra/Radio</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {doubleFiberRadioPlans.map((plan, index) => (
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
                                                                <Input type="number" step="0.01" value={plan.doubleFiberRadioCost || ''} onChange={(e) => handlePriceChange(index, 'doubleFiberRadioCost', e.target.value)} placeholder="0.00" className="text-right bg-slate-800 border-slate-700" />
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

export default InternetOKv2Calculator;
