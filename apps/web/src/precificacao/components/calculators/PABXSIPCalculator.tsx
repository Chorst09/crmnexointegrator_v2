
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from "sonner"; // Added toast import
// PostgreSQL via Prisma - APIs REST
import CommissionTablesUnified from './CommissionTablesUnified';
// import { CommissionData } from '@/lib/types'; // Removido - usando hook useCommissions
import { DRETable } from './DRETable';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Phone, PhoneForwarded, Edit, Plus, Download, Trash2, ArrowLeft, Save } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ClientManagerForm } from './ClientManagerForm';
import { ProposalApprovalRequestButton } from '@/components/proposals/ProposalApprovalRequestButton';
import { ProposalStatusBadge } from '@/components/proposals/ProposalStatusBadge';
import { ProposalApprovalInfo } from '@/components/proposals/ProposalApprovalInfo';
import { ConvertToB2BOpportunityButton } from '@/components/proposals/ConvertToB2BOpportunityButton';

// Interfaces locais
interface ClientData {
    name: string;
    contact?: string;
    projectName?: string;
    email?: string;
    phone?: string;
}

interface AccountManagerData {
    name: string;
    email?: string;
    phone?: string;
    distributorId?: string;
}
import { ClientManagerInfo } from './ClientManagerInfo';
import { useAuth } from '@/hooks/use-auth';
import { useCommissions, getChannelIndicatorCommissionRate, getChannelInfluencerCommissionRate, getChannelSellerCommissionRate, getSellerCommissionRate, getDirectorCommissionRate } from '@/hooks/use-commissions';
import { useProposalsWithPermissions } from '@/hooks/use-proposals-with-permissions';
import { useDeepLinkedProposal } from '@/hooks/use-deep-linked-proposal';
import { getPermissionsForRole, normalizeUserRole } from '@/lib/permissions';
import { generateNextProposalId } from '@/lib/proposal-id-generator';
import { setupProposalSyncListeners, setupProposalAutoRefresh } from '@/lib/proposal-sync';
import { getCRMAuthHeaders } from '@/config/api';

// Interfaces
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
}

interface ProposalItem {
    id: string;
    description: string;
    setup: number;
    monthly: number;
    details?: {
        applySalespersonDiscount?: boolean;
        appliedDirectorDiscountPercentage?: number;
        [key: string]: any;
    };
}

interface Proposal {
    id: string;
    baseId: string;
    base_id?: string;
    version: number;
    client: ClientData | string;
    accountManager: AccountManagerData | string;
    items: ProposalItem[];
    products?: any[]; // Para compatibilidade com dados antigos
    clientData?: ClientData; // Para compatibilidade com dados antigos
    totalSetup: number;
    totalMonthly: number;
    rawTotalSetup?: number;
    rawTotalMonthly?: number;
    baseTotalMonthly?: number;
    createdAt: string | any;
    createdBy?: string;
    userId: string;
    value?: number;
    contractPeriod?: string;
    applySalespersonDiscount?: boolean;
    appliedDirectorDiscountPercentage?: number;
    discountInfo?: {
        applySalespersonDiscount: boolean;
        appliedDirectorDiscountPercentage: number;
        salespersonDiscountFactor: number;
        directorDiscountFactor: number;
        hasDiscounts: boolean;
    };
    metadata?: {
        accountManagerEmail?: string;
        accountManagerPhone?: string;
        [key: string]: any;
    };
    status?: string;
    changes?: string;
}

interface PABXSIPCalculatorProps {
    onBackToDashboard?: () => void;
    initialProposalId?: string | null;
}

export const PABXSIPCalculator: React.FC<PABXSIPCalculatorProps> = ({ onBackToDashboard, initialProposalId }) => {
    // Estado para controlar a tela atual
    const [currentView, setCurrentView] = useState<'search' | 'client-form' | 'calculator' | 'proposal-summary'>('search');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [hasChanged, setHasChanged] = useState(false);
    const [saving, setSaving] = useState(false);

    // Hook para buscar propostas com permissões
    const { proposals: savedProposals, loading: loadingProposals, error: proposalsError, fetchProposals, setProposals: setSavedProposals } = useProposalsWithPermissions();
    const [currentProposal, setCurrentProposal] = useState<Proposal | null>(null);

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

    // Estados PABX
    const [pabxExtensions, setPabxExtensions] = useState<number>(32);
    const [pabxIncludeSetup, setPabxIncludeSetup] = useState<boolean>(true);
    const [pabxIncludeDevices, setPabxIncludeDevices] = useState<boolean>(true);
    const [pabxDeviceQuantity, setPabxDeviceQuantity] = useState<number>(5);
    const [pabxIncludeAI, setPabxIncludeAI] = useState<boolean>(false);
    const [includeParceiroIndicador, setIncludeParceiroIndicador] = useState<boolean>(false);
    const [includeInfluencerPartner, setIncludeInfluencerPartner] = useState<boolean>(false);
    const [aiAgentPlan, setAiAgentPlan] = useState<string>('basic');
    const [pabxAIPlan, setPabxAIPlan] = useState<string>('20K');
    const [pabxResult, setPabxResult] = useState<PABXResult | null>(null);
    const [pabxModality, setPabxModality] = useState<'Standard' | 'Premium'>('Standard');
    const [pabxPremiumPlan, setPabxPremiumPlan] = useState<'Essencial' | 'Profissional'>('Essencial');
    const [pabxPremiumSubPlan, setPabxPremiumSubPlan] = useState<'Ilimitado' | 'Tarifado'>('Ilimitado');
    const [pabxPremiumEquipment, setPabxPremiumEquipment] = useState<'Com' | 'Sem'>('Sem');
    const [contractDuration, setContractDuration] = useState<number>(24);
    const [pabxPremiumSetupFee, setPabxPremiumSetupFee] = useState<number>(2500); // Taxa de setup Premium

    // Hook para comissões editáveis
    const { channelIndicator, channelInfluencer, channelSeller, seller, channelDirector } = useCommissions();

    // Estados SIP
    const [sipPlan, setSipPlan] = useState<string>('SIP ILIMITADO 10 Canais');
    const [sipIncludeSetup, setSipIncludeSetup] = useState<boolean>(false);
    const [sipAdditionalChannels, setSipAdditionalChannels] = useState<number>(0);
    const [sipWithEquipment, setSipWithEquipment] = useState<boolean>(true);
    const [sipResult, setSipResult] = useState<SIPResult | null>(null);

    // Estados da Proposta
    const [proposalItems, setProposalItems] = useState<ProposalItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<string>('Aguardando Aprovação do Cliente');
    const [selectedForecastTemperature, setSelectedForecastTemperature] = useState<string>('50');
    const [proposalChanges, setProposalChanges] = useState<string>('');

    const { user: currentUser } = useAuth();
    const normalizedRole = normalizeUserRole(currentUser?.role);
    const isAdmin = normalizedRole === 'admin' || normalizedRole === 'master';
    const isDirector = normalizedRole === 'director';

    // Verificar permissões do usuário
    const userPermissions = currentUser?.role ? getPermissionsForRole(currentUser.role as any) : null;
    const canEditCommissions = userPermissions?.canEditCommissions || false;

    // Commission data removido - usando tabelas editáveis do hook useCommissions
    /*
    const [commissionData, setCommissionData] = useState<CommissionData>({
        vendedor: [
            { meses: '12 meses', comissao: '1,2' },
            { meses: '24 meses', comissao: '2,4' },
            { meses: '36 meses', comissao: '3,6' },
            { meses: '48 meses', comissao: '3,6' },
            { meses: '60 meses', comissao: '3,6' },
        ],
        diretor: [
            { meses: '12 meses', comissao: '0' },
            { meses: '24 meses', comissao: '0' },
            { meses: '36 meses', comissao: '0' },
            { meses: '48 meses', comissao: '0' },
            { meses: '60 meses', comissao: '0' },
        ],
        parceiro: [
            { range: 'R$ 0,00 a R$ 500,00', ate24: '1,5', mais24: '2,5' },
            { range: 'R$ 500,01 a R$ 1.000,00', ate24: '2,5', mais24: '4' },
            { range: 'R$ 1.000,01 a R$ 1.500,00', ate24: '4,01', mais24: '5,5' },
            { range: 'R$ 1.500,01 a R$ 3.000,00', ate24: '5,51', mais24: '7' },
            { range: 'R$ 3.000,01 a R$ 5.000,00', ate24: '7,01', mais24: '8,5' },
            { range: 'R$ 5.000,01 a R$ 6.500,00', ate24: '8,51', mais24: '10' },
            { range: 'R$ 6.500,01 a R$ 9.000,00', ate24: '10,01', mais24: '11,5' },
            { range: 'Acima de R$ 9.000,01', ate24: '11,51', mais24: '13' },
        ],
    });
    */

    // Save PABX/SIP settings
    const saveSettings = useCallback(async () => {
        if (!currentUser) {
            toast.error('Você precisa estar logado para salvar as configurações');
            return;
        }

        try {
            setIsSaving(true);

            // TODO: Implementar API para salvar configurações PABX
            const configData = {
                user_id: currentUser.id,
                pabx_extensions: pabxExtensions,
                pabx_modality: pabxModality,
                pabx_premium_plan: pabxPremiumPlan,
                pabx_premium_sub_plan: pabxPremiumSubPlan,
                pabx_premium_equipment: pabxPremiumEquipment,
                contract_duration: contractDuration,
                pabx_include_setup: pabxIncludeSetup,
                pabx_include_devices: pabxIncludeDevices,
                pabx_device_quantity: pabxDeviceQuantity,
                pabx_include_ai: pabxIncludeAI,
                ai_agent_plan: aiAgentPlan,
                pabx_ai_plan: pabxAIPlan,
                include_parceiro_indicador: includeParceiroIndicador,
                sip_plan: sipPlan,
                sip_include_setup: sipIncludeSetup,
            };
            console.log('Salvando configurações PABX via API:', configData);

            // TODO: Fazer chamada para API REST aqui

            toast.success('Configurações salvas com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
            toast.error('Erro ao salvar configurações. Tente novamente.');
        } finally {
            setIsSaving(false);
        }
    }, [
        currentUser, pabxExtensions, pabxModality, pabxPremiumPlan, pabxPremiumSubPlan,
        pabxPremiumEquipment, contractDuration, pabxIncludeSetup, pabxIncludeDevices,
        pabxDeviceQuantity, pabxIncludeAI, aiAgentPlan, pabxAIPlan, includeParceiroIndicador,
        sipPlan, sipIncludeSetup
    ]);

    // Dados de preços do List Price - PABX (editáveis)
    const [pabxPrices, setPabxPrices] = useState({
        setup: {
            '10': 1250,      // Até 10 ramais
            '20': 2000,      // De 11 a 20 ramais  
            '30': 2500,      // De 21 a 30 ramais
            '50': 3000,      // De 31 a 50 ramais
            '100': 3500,     // De 51 a 100 ramais
            '500': 4000,     // De 101 a 500 ramais
            '1000': 4500     // De 501 a 1000 ramais
        },
        monthly: {
            '10': 30.00,     // Valor por ramal mensal até 10
            '20': 29.00,     // Valor por ramal mensal de 11 a 20
            '30': 28.00,     // Valor por ramal mensal de 21 a 30
            '50': 27.50,     // Valor por ramal mensal de 31 a 50
            '100': 26.00,    // Valor por ramal mensal de 51 a 100
            '500': 25.00,    // Valor por ramal mensal de 101 a 500
            '1000': 24.50    // Valor por ramal mensal de 501 a 1000
        },
        hosting: {
            '10': 200.00,    // Valor hospedagem até 10
            '20': 220.00,    // Valor hospedagem de 11 a 20
            '30': 250.00,    // Valor hospedagem de 21 a 30
            '50': 300.00,    // Valor hospedagem de 31 a 50
            '100': 400.00,   // Valor hospedagem de 51 a 100
            '500': 450.00,   // Valor hospedagem de 101 a 500
            '1000': 500.00   // Valor hospedagem de 501 a 1000
        },
        device: {
            '10': 35.00,     // Aluguel aparelho até 10
            '20': 34.00,     // Aluguel aparelho de 11 a 20
            '30': 33.00,     // Aluguel aparelho de 21 a 30
            '50': 32.50,     // Aluguel aparelho de 31 a 50
            '100': 30.00,    // Aluguel aparelho de 51 a 100
            '500': 29.00,    // Aluguel aparelho de 101 a 500
            '1000': 28.00    // Aluguel aparelho de 501 a 1000
        }
    });

    // PABX Premium Prices
    const [pabxPremiumPrices, setPabxPremiumPrices] = useState({
        '24': {
            essencial: {
                ilimitado: [
                    { range: '2 a 9 ramais', comEquipamento: 84, semEquipamento: 75 },
                    { range: '10 a 19 ramais', comEquipamento: 65, semEquipamento: 57 },
                    { range: '20 a 49 ramais', comEquipamento: 62, semEquipamento: 54 },
                    { range: '50 a 99 ramais', comEquipamento: 59, semEquipamento: 52 },
                    { range: '100 a 199 ramais', comEquipamento: 55, semEquipamento: 48 },
                    { range: '+ de 200 ramais', comEquipamento: 52, semEquipamento: 45 }
                ],
                tarifado: [
                    { range: '2 a 9 ramais', comEquipamento: 59, semEquipamento: 44 },
                    { range: '10 a 49 ramais', comEquipamento: 49, semEquipamento: 34 },
                    { range: '50 a 99 ramais', comEquipamento: 38, semEquipamento: 30 },
                    { range: '100 a 199 ramais', comEquipamento: 34, semEquipamento: 27 },
                    { range: '+ de 200 ramais', comEquipamento: 32, semEquipamento: 25 }
                ]
            },
            profissional: {
                ilimitado: [
                    { range: '2 a 9 ramais', comEquipamento: 104, semEquipamento: 95 },
                    { range: '10 a 19 ramais', comEquipamento: 77, semEquipamento: 72 },
                    { range: '20 a 49 ramais', comEquipamento: 73, semEquipamento: 68 },
                    { range: '50 a 99 ramais', comEquipamento: 69, semEquipamento: 66 },
                    { range: '100 a 199 ramais', comEquipamento: 65, semEquipamento: 62 },
                    { range: '+ de 200 ramais', comEquipamento: 62, semEquipamento: 55 }
                ],
                tarifado: [
                    { range: '2 a 9 ramais', comEquipamento: 79, semEquipamento: 64 },
                    { range: '10 a 49 ramais', comEquipamento: 59, semEquipamento: 44 },
                    { range: '50 a 99 ramais', comEquipamento: 51, semEquipamento: 36 },
                    { range: '100 a 199 ramais', comEquipamento: 39, semEquipamento: 32 },
                    { range: '+ de 200 ramais', comEquipamento: 35, semEquipamento: 28 }
                ]
            }
        },
        '36': {
            essencial: {
                ilimitado: [
                    { range: '2 a 9 ramais', comEquipamento: 77, semEquipamento: 71 },
                    { range: '10 a 19 ramais', comEquipamento: 59, semEquipamento: 53 },
                    { range: '20 a 49 ramais', comEquipamento: 55, semEquipamento: 48 },
                    { range: '50 a 99 ramais', comEquipamento: 53, semEquipamento: 44 },
                    { range: '100 a 199 ramais', comEquipamento: 48, semEquipamento: 40 },
                    { range: '+ de 200 ramais', comEquipamento: 45, semEquipamento: 38 }
                ],
                tarifado: [
                    { range: '2 a 9 ramais', comEquipamento: 57, semEquipamento: 42 },
                    { range: '10 a 49 ramais', comEquipamento: 47, semEquipamento: 32 },
                    { range: '50 a 99 ramais', comEquipamento: 36, semEquipamento: 28 },
                    { range: '100 a 199 ramais', comEquipamento: 32, semEquipamento: 25 },
                    { range: '+ de 200 ramais', comEquipamento: 30, semEquipamento: 23 }
                ]
            },
            profissional: {
                ilimitado: [
                    { range: '2 a 9 ramais', comEquipamento: 97, semEquipamento: 91 },
                    { range: '10 a 19 ramais', comEquipamento: 73, semEquipamento: 69 },
                    { range: '20 a 49 ramais', comEquipamento: 69, semEquipamento: 66 },
                    { range: '50 a 99 ramais', comEquipamento: 65, semEquipamento: 63 },
                    { range: '100 a 199 ramais', comEquipamento: 60, semEquipamento: 59 },
                    { range: '+ de 200 ramais', comEquipamento: 57, semEquipamento: 52 }
                ],
                tarifado: [
                    { range: '2 a 9 ramais', comEquipamento: 75, semEquipamento: 60 },
                    { range: '10 a 49 ramais', comEquipamento: 57, semEquipamento: 42 },
                    { range: '50 a 99 ramais', comEquipamento: 49, semEquipamento: 34 },
                    { range: '100 a 199 ramais', comEquipamento: 37, semEquipamento: 30 },
                    { range: '+ de 200 ramais', comEquipamento: 33, semEquipamento: 26 }
                ]
            }
        }
    });

    // SIP Prices
    const [sipPrices, setSipPrices] = useState<{ [key: string]: { setup: number, monthly: number, monthlyWithEquipment: number | null, channels: number } }>({
        'SIP TARIFADO Call Center 2 Canais': { setup: 0, monthly: 200, monthlyWithEquipment: null, channels: 2 },
        'SIP TARIFADO 2 Canais': { setup: 0, monthly: 150, monthlyWithEquipment: null, channels: 2 },
        'SIP TARIFADO 4 Canais': { setup: 0, monthly: 250, monthlyWithEquipment: 500, channels: 4 },
        'SIP TARIFADO 10 Canais': { setup: 0, monthly: 350, monthlyWithEquipment: 650, channels: 10 },
        'SIP TARIFADO 30 Canais': { setup: 0, monthly: 550, monthlyWithEquipment: 1200, channels: 30 },
        'SIP TARIFADO 60 Canais': { setup: 0, monthly: 1000, monthlyWithEquipment: 1200, channels: 60 },
        'SIP ILIMITADO 5 Canais': { setup: 0, monthly: 350, monthlyWithEquipment: 500, channels: 5 },
        'SIP ILIMITADO 10 Canais': { setup: 0, monthly: 450, monthlyWithEquipment: 600, channels: 10 },
        'SIP ILIMITADO 20 Canais': { setup: 0, monthly: 650, monthlyWithEquipment: 800, channels: 20 },
        'SIP ILIMITADO 30 Canais': { setup: 0, monthly: 850, monthlyWithEquipment: 950, channels: 30 },
        'SIP ILIMITADO 60 Canais': { setup: 0, monthly: 1600, monthlyWithEquipment: 1700, channels: 60 }
    });

    // Dados de preços do List Price - SIP Config (editáveis)
    const [sipConfig, setSipConfig] = useState({
        additionalChannels: {
            assinatura: {
                '5': { max: 3, price: 30 },
                '10': { max: 5, price: 20 },
                '20': { max: 3, price: 20 },
                '30': { max: 20, price: 5 },
            },
            franquia: {
                '4': { max: 10, price: 25 },
                '10': { max: 20, price: 25 },
                '30': { max: 30, price: 25 },
            },
        },
        includedMinutes: {
            '5': 15000,
            '10': 20000,
            '20': 25000,
            '30': 30000,
            '60': 60000,
        },
        includedNumbers: {
            callCenter: 'Consultar',
            tarifado: {
                '2': 'Máximo 3 Números',
                '4': 'Máximo 4 Números',
                '10': 'Máximo 5 Números',
                '30': 'Máximo 5 Números',
            },
            ilimitado: {
                '5': 'Máximo 10 Números',
                '10': 'Máximo 15 Números',
                '20': 'Máximo 20 Números',
                '30': 'Máximo 30 Números',
                '60': 'Máximo 30 Números',
            }
        },
        additionalNumberPrice: 10,
        tariffs: {
            localFixo: { callCenter: 0.015, tarifado: 0.02 },
            dddFixo: { callCenter: 0.05, tarifado: 0.06 },
            brasilMovel: { callCenter: 0.09, default: 0.10 },
        },
    });

    // Dados de preços do List Price - Agente IA (editáveis)
    const [aiAgentPrices, setAiAgentPrices] = useState({
        '20K': { price: 720, credits: 20000, messages: 10000, minutes: 2000, premium: 1000 },
        '40K': { price: 1370, credits: 40000, messages: 20000, minutes: 4000, premium: 2000 },
        '60K': { price: 1940, credits: 60000, messages: 30000, minutes: 6000, premium: 3000 },
        '100K': { price: 3060, credits: 100000, messages: 50000, minutes: 10000, premium: 5000 },
        '150K': { price: 4320, credits: 150000, messages: 75000, minutes: 15000, premium: 7500 },
        '200K': { price: 5400, credits: 200000, messages: 100000, minutes: 20000, premium: 10000 }
    });

    // Save PABX prices to Firebase
    const savePABXPrices = useCallback(async () => {
        if (!currentUser) {
            toast.error('Você precisa estar logado para salvar os preços');
            return;
        }

        try {
            console.log('Salvando preços via API:', pabxPrices);

            // Preparar dados para inserção
            const priceUpdates: any[] = [];

            // Setup prices
            Object.entries(pabxPrices.setup).forEach(([range, price]) => {
                priceUpdates.push({
                    price_type: 'standard',
                    category: 'setup',
                    range_key: range,
                    price: price,
                    updated_by: currentUser.id
                });
            });

            // Monthly prices
            Object.entries(pabxPrices.monthly).forEach(([range, price]) => {
                priceUpdates.push({
                    price_type: 'standard',
                    category: 'monthly',
                    range_key: range,
                    price: price,
                    updated_by: currentUser.id
                });
            });

            // Hosting prices
            Object.entries(pabxPrices.hosting).forEach(([range, price]) => {
                priceUpdates.push({
                    price_type: 'standard',
                    category: 'hosting',
                    range_key: range,
                    price: price,
                    updated_by: currentUser.id
                });
            });

            // Device prices
            Object.entries(pabxPrices.device).forEach(([range, price]) => {
                priceUpdates.push({
                    price_type: 'standard',
                    category: 'device',
                    range_key: range,
                    price: price,
                    updated_by: currentUser.id
                });
            });

            // TODO: Implementar API para salvar preços PABX
            console.log('Salvando preços via API:', priceUpdates);

            // TODO: Fazer chamada para API REST aqui

            toast.success('Preços salvos com sucesso!');
            console.log('Preços salvos com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar preços:', error);
            toast.error('Erro ao salvar preços. Tente novamente.');
        }
    }, [currentUser, pabxPrices]);

    // Load PABX prices from API
    const loadPABXPrices = useCallback(async () => {
        try {
            // TODO: Implementar API para carregar preços PABX
            console.log('Carregando preços via API...');

            // TODO: Fazer chamada para API REST aqui
            const data: any[] | null = null; // Temporário

            if (data && (data as any[]).length > 0) {
                console.log('Dados carregados via API:', data);

                // Reorganizar dados no formato esperado
                const loadedPrices = {
                    setup: {},
                    monthly: {},
                    hosting: {},
                    device: {}
                };

                (data as any[]).forEach((item: any) => {
                    if (loadedPrices[item.category as keyof typeof loadedPrices]) {
                        (loadedPrices[item.category as keyof typeof loadedPrices] as any)[item.range_key] = item.price;
                    }
                });

                setPabxPrices(loadedPrices as any);
                console.log('Preços PABX carregados:', loadedPrices);
                toast.success('Preços carregados com sucesso!');
            } else {
                console.log('Usando valores padrão da calculadora');
                toast.info('Usando configuração padrão da calculadora');
            }
        } catch (error) {
            console.error('Erro ao carregar preços:', error);
            toast.error('Erro ao carregar preços do banco de dados');
        }
    }, []);

    // Force update specific values on component mount
    useEffect(() => {
        forceUpdateSpecificValues();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Load prices on component mount
    useEffect(() => {
        loadPABXPrices();
    }, [loadPABXPrices]);

    // Force save updated prices via API on component mount
    useEffect(() => {
        const saveUpdatedPrices = async () => {
            // Wait a bit to ensure component is fully loaded
            setTimeout(async () => {
                await savePABXPrices();
            }, 1000);
        };

        if (currentUser) {
            saveUpdatedPrices();
        }
    }, [currentUser, savePABXPrices]);

    // Estados para edição das tabelas
    const [isEditingPABX, setIsEditingPABX] = useState(false);
    const [isEditingSIP, setIsEditingSIP] = useState(false);

    // Estados para edição da tabela AI
    const [isEditingAI, setIsEditingAI] = useState(false);
    const [isEditingPABXPremium24, setIsEditingPABXPremium24] = useState(false);
    const [editedValues, setEditedValues] = useState<Record<string, number>>({});
    const [isEditingPABXPremium36, setIsEditingPABXPremium36] = useState(false);

    // Função para salvar as alterações da tabela PABX Premium
    const handleSavePABXPrices = async () => {
        // Atualiza o estado com os valores editados
        const updatedPrices = { ...pabxPremiumPrices };

        // Atualiza os valores editados
        Object.entries(editedValues).forEach(([key, value]) => {
            const [duration, plan, subPlan, index, field] = key.split('-');
            const idx = parseInt(index, 10);
            if ((updatedPrices as any)[duration]?.[plan]?.[subPlan]?.[idx]) {
                (updatedPrices as any)[duration][plan][subPlan][idx][field] = value;
            }
        });

        setPabxPremiumPrices(updatedPrices);
        setEditedValues({});
        setIsEditingPABXPremium24(false);

        // Salvar no banco de dados
        await savePABXPrices();
    };

    // Função para forçar atualização dos valores específicos
    const forceUpdateSpecificValues = useCallback(() => {
        setPabxPrices(prev => ({
            ...prev,
            setup: {
                ...prev.setup,
                '500': 4000,  // De 101 a 500
                '1000': 4500  // De 501 a 1000
            },
            hosting: {
                ...prev.hosting,
                '500': 450,   // De 01 a 500
                '1000': 500   // De 501 a 1000
            },
            device: {
                ...prev.device,
                '500': 29,    // De 101 a 500
                '1000': 28    // De 501 a 1000
            }
        }));
    }, []);



    // Função para salvar os preços do PABX Standard
    const handleSavePABXStandardPrices = async () => {
        setIsEditingPABX(false);
        await savePABXPrices();
    };
    // Função para lidar com mudanças nos inputs de edição
    const handleInputChange = (duration: string, plan: string, subPlan: string, index: number, field: string, value: string) => {
        const numValue = parseFloat(value) || 0;
        setEditedValues(prev => ({
            ...prev,
            [`${duration}-${plan}-${subPlan}-${index}-${field}`]: numValue
        }));
    };

    // Estados para Markup e Margem
    const [markup, setMarkup] = useState<number>(30);
    const [estimatedNetMargin, setEstimatedNetMargin] = useState<number>(0);
    const [commissionPercentage, setCommissionPercentage] = useState<number>(3);

    // Descontos
    const [directorDiscountPercentage, setDirectorDiscountPercentage] = useState<number>(0);
    const [appliedDirectorDiscountPercentage, setAppliedDirectorDiscountPercentage] = useState<number>(0); // New state for applied director discount
    const [applySalespersonDiscount, setApplySalespersonDiscount] = useState<boolean>(false); // New state

    // Funções Auxiliares
    const formatCurrency = (value: number | undefined | null) => {
        const numValue = Number(value) || 0;
        return `R$ ${numValue.toFixed(2).replace('.', ',')}`;
    };
    const generateUniqueId = () => `item-${Date.now()}`;

    // Função para obter o payback máximo permitido por prazo contratual
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
        installationFee: number,
        equipmentCost: number,
        monthlyRevenue: number,
        contractTerm: number,
        appliedDirectorDiscountPercentage: number = 0
    ): number => {
        if (monthlyRevenue <= 0) return contractTerm;

        // Apply director discount to monthly revenue
        const discountedMonthlyRevenue = monthlyRevenue * (1 - appliedDirectorDiscountPercentage / 100);

        // Obter comissões da tabela editável
        const months = contractTerm;
        const temParceiros = includeParceiroIndicador || includeInfluencerPartner;

        // Calcular comissão do vendedor baseado na presença de parceiros
        const vendedorCommissionRate = temParceiros
            ? getChannelSellerCommissionRate(channelSeller, months) / 100
            : getSellerCommissionRate(seller, months) / 100;

        // MÊS 0: Investimento Inicial para PABX
        // Receita (Taxa de Instalação): + installationFee
        // Custo (Equipamentos PABX): - equipmentCost
        // Imposto (15% sobre Taxa de Instalação): - (installationFee * 0.15)
        // Custo/Despesa Inicial: - (installationFee * 0.10)
        const taxImpost = installationFee * 0.15;
        const taxCustoDesp = installationFee * 0.10;
        let cumulativeBalance = installationFee - equipmentCost - taxImpost - taxCustoDesp;

        // Calculate month by month until balance becomes positive
        for (let month = 1; month <= contractTerm; month++) {
            let monthlyNetFlow = 0;

            if (month === 1) {
                // MÊS 1: Primeira Mensalidade (COM comissão do vendedor)
                // Para PABX, custos operacionais são menores
                const monthlyTaxImpost = discountedMonthlyRevenue * 0.15; // Imposto 15%
                const monthlyCommission = discountedMonthlyRevenue * vendedorCommissionRate; // Usar comissão da tabela
                const monthlyCustoDesp = discountedMonthlyRevenue * 0.05; // Custo/Despesa menor 5%

                monthlyNetFlow = discountedMonthlyRevenue - monthlyTaxImpost - monthlyCommission - monthlyCustoDesp;
            } else {
                // MÊS 2+: Fluxo Recorrente (SEM comissão do vendedor)
                const monthlyTaxImpost = discountedMonthlyRevenue * 0.15; // Imposto 15%
                const monthlyCustoDesp = discountedMonthlyRevenue * 0.05; // Custo/Despesa 5%

                monthlyNetFlow = discountedMonthlyRevenue - monthlyTaxImpost - monthlyCustoDesp;
            }

            cumulativeBalance += monthlyNetFlow;

            if (cumulativeBalance >= 0) {
                return month;
            }
        }

        // If payback not achieved within contract term
        return contractTerm;
    };

    // Função para determinar a faixa de preço baseada no número de ramais
    const getPriceRange = useCallback((extensions: number): string => {
        if (extensions <= 10) return '10';
        if (extensions <= 20) return '20';
        if (extensions <= 30) return '30';
        if (extensions <= 50) return '50';
        if (extensions <= 100) return '100';
        if (extensions <= 500) return '500';
        return '1000'; // Para valores acima de 500, usar a faixa de 1000
    }, []);

    const getPremiumPriceRange = useCallback((extensions: number, plan: string, subPlan: string): string => {
        if (extensions >= 2 && extensions <= 9) return '2 a 9 ramais';

        // Para planos Ilimitados, usar faixas específicas
        if (subPlan.toLowerCase() === 'ilimitado') {
            if (extensions >= 10 && extensions <= 19) return '10 a 19 ramais';
            if (extensions >= 20 && extensions <= 49) return '20 a 49 ramais';
        } else {
            // Para planos Tarifados, usar faixa combinada 10-49
            if (extensions >= 10 && extensions <= 49) return '10 a 49 ramais';
        }

        if (extensions >= 50 && extensions <= 99) return '50 a 99 ramais';
        if (extensions >= 100 && extensions <= 199) return '100 a 199 ramais';
        if (extensions >= 200) return '+ de 200 ramais';
        return '';
    }, []);

    // Efeito para recalcular automaticamente quando houver mudanças nas dependências do PABX Premium
    useEffect(() => {
        if (pabxModality === 'Premium') {
            calculatePABX();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pabxModality, pabxPremiumPlan, pabxPremiumSubPlan, pabxPremiumEquipment, contractDuration, pabxExtensions, pabxIncludeAI, pabxAIPlan]);

    // Função removida - usando funções do hook useCommissions

    // Get partner indicator commission rate based on monthly revenue and contract duration
    const getPartnerIndicatorRate = (monthlyRevenue: number, contractMonths: number) => {
        if (!channelIndicator || !includeParceiroIndicador) return 0;
        return getChannelIndicatorCommissionRate(channelIndicator, monthlyRevenue, contractMonths) / 100;
    };

    const getPartnerInfluencerRate = (monthlyRevenue: number, contractMonths: number) => {
        if (!channelInfluencer || !includeInfluencerPartner) return 0;
        return getChannelInfluencerCommissionRate(channelInfluencer, monthlyRevenue, contractMonths) / 100;
    };

    // Calculate PABX result
    const calculatePABX = useCallback((): PABXResult => {
        if (pabxModality === 'Standard') {
            const range = getPriceRange(pabxExtensions);

            const setup = pabxIncludeSetup ? pabxPrices.setup[range as keyof typeof pabxPrices.setup] : 0;
            const baseMonthly = (pabxPrices.monthly[range as keyof typeof pabxPrices.monthly] * pabxExtensions) +
                pabxPrices.hosting[range as keyof typeof pabxPrices.hosting];
            const deviceRentalCost = pabxIncludeDevices ?
                (pabxPrices.device[range as keyof typeof pabxPrices.device] * pabxDeviceQuantity) : 0;
            const aiAgentCost = pabxIncludeAI ? (aiAgentPrices as Record<string, any>)[pabxAIPlan]?.price || 0 : 0;

            return {
                setup,
                baseMonthly,
                deviceRentalCost,
                aiAgentCost,
                totalMonthly: baseMonthly + deviceRentalCost + aiAgentCost
            };
        } else { // Premium
            // Buscar o plano baseado no prazo do contrato (24 ou 36 meses)
            const contractPlan = pabxPremiumPrices[contractDuration.toString() as keyof typeof pabxPremiumPrices];
            if (!contractPlan) {
                console.log('Contrato não encontrado:', contractDuration);
                return { setup: 0, baseMonthly: 0, deviceRentalCost: 0, aiAgentCost: 0, totalMonthly: 0 };
            }

            // Buscar o tipo de plano (essencial ou profissional)
            const planType = contractPlan[pabxPremiumPlan.toLowerCase() as keyof typeof contractPlan];
            if (!planType) {
                console.log('Tipo de plano não encontrado:', pabxPremiumPlan);
                return { setup: 0, baseMonthly: 0, deviceRentalCost: 0, aiAgentCost: 0, totalMonthly: 0 };
            }

            // Buscar o subtipo (ilimitado ou tarifado)
            const subPlan = planType[pabxPremiumSubPlan.toLowerCase() as keyof typeof planType];
            if (!subPlan || !Array.isArray(subPlan)) {
                console.log('Subtipo de plano não encontrado:', pabxPremiumSubPlan);
                return { setup: 0, baseMonthly: 0, deviceRentalCost: 0, aiAgentCost: 0, totalMonthly: 0 };
            }

            // Obter a faixa de preço correta baseada no plano e subtipo
            const premiumRange = getPremiumPriceRange(pabxExtensions, pabxPremiumPlan, pabxPremiumSubPlan);
            if (!premiumRange) {
                console.log('Faixa Premium não encontrada para:', pabxExtensions, 'ramais');
                return { setup: 0, baseMonthly: 0, deviceRentalCost: 0, aiAgentCost: 0, totalMonthly: 0 };
            }

            // Encontrar a faixa de preço correta
            const priceData = subPlan.find((p: { range: string }) => p.range === premiumRange);
            if (!priceData) {
                console.log('Dados de preço não encontrados para faixa:', premiumRange);
                console.log('Faixas disponíveis:', subPlan.map((p: any) => p.range));
                return { setup: 0, baseMonthly: 0, deviceRentalCost: 0, aiAgentCost: 0, totalMonthly: 0 };
            }

            // Calcular taxa de setup (se incluída)
            const setup = pabxIncludeSetup ? pabxPremiumSetupFee : 0;

            // Calcular mensalidade baseada em com/sem equipamento
            const pricePerExtension = pabxPremiumEquipment === 'Com'
                ? (priceData as any).comEquipamento
                : (priceData as any).semEquipamento;

            const baseMonthly = pricePerExtension * pabxExtensions;

            // Custo de aparelhos já está incluído no preço Premium
            const deviceRentalCost = 0;

            // Custo do Agente IA (se incluído)
            const aiAgentCost = pabxIncludeAI ? (aiAgentPrices as Record<string, any>)[pabxAIPlan]?.price || 0 : 0;

            console.log('Cálculo Premium:', {
                contractDuration,
                pabxPremiumPlan,
                pabxPremiumSubPlan,
                pabxPremiumEquipment,
                pabxExtensions,
                premiumRange,
                pricePerExtension,
                baseMonthly,
                setup,
                aiAgentCost
            });

            return {
                setup,
                baseMonthly,
                deviceRentalCost,
                aiAgentCost,
                totalMonthly: baseMonthly + deviceRentalCost + aiAgentCost
            };
        }
    }, [
        pabxModality,
        pabxExtensions,
        pabxIncludeSetup,
        pabxPrices,
        pabxIncludeDevices,
        pabxDeviceQuantity,
        pabxIncludeAI,
        pabxAIPlan,
        pabxPremiumPlan,
        pabxPremiumSubPlan,
        pabxPremiumEquipment,
        contractDuration,
        pabxPremiumSetupFee,
        aiAgentPrices,
        pabxPremiumPrices,
        getPriceRange,
        getPremiumPriceRange
    ]);

    // Update PABX result when calculation changes
    useEffect(() => {
        const result = calculatePABX();
        setPabxResult(result);
    }, [calculatePABX]);

    // Calculate SIP result
    const calculateSIP = useCallback((): SIPResult | null => {
        if (!sipPlan) return null;

        const planData = sipPrices[sipPlan as keyof typeof sipPrices];
        if (!planData) {
            return null;
        }

        const setup = sipIncludeSetup ? (planData.setup || 0) : 0;
        let monthly = sipWithEquipment && planData.monthlyWithEquipment ? planData.monthlyWithEquipment : planData.monthly;

        // Handle additional channels - Skip for restricted plans
        const restrictedPlans = ['SIP TARIFADO 30 Canais', 'SIP TARIFADO 60 Canais', 'SIP ILIMITADO 60 Canais'];
        if (sipAdditionalChannels > 0 && !restrictedPlans.includes(sipPlan)) {
            const planChannelsStr = sipPlan.match(/\d+/)?.[0];
            if (planChannelsStr) {
                let additionalCost = 0;

                if (sipPlan.includes('ILIMITADO')) { // Assinatura
                    const assinaturaConfig = sipConfig.additionalChannels.assinatura[planChannelsStr as keyof typeof sipConfig.additionalChannels.assinatura];
                    if (assinaturaConfig && sipAdditionalChannels <= assinaturaConfig.max) {
                        additionalCost = sipAdditionalChannels * assinaturaConfig.price;
                    }
                } else if (sipPlan.includes('TARIFADO')) { // Franquia
                    const franquiaConfig = sipConfig.additionalChannels.franquia[planChannelsStr as keyof typeof sipConfig.additionalChannels.franquia];
                    if (franquiaConfig && sipAdditionalChannels <= franquiaConfig.max) {
                        additionalCost = sipAdditionalChannels * franquiaConfig.price;
                    }
                }
                monthly += additionalCost;
            }
        }

        return { setup, monthly };
    }, [sipPlan, sipIncludeSetup, sipAdditionalChannels, sipWithEquipment, sipPrices, sipConfig]);

    // Update SIP result when calculation changes
    useEffect(() => {
        const result = calculateSIP();
        setSipResult(result);
    }, [calculateSIP]);

    // Reset additional channels when restricted plans are selected
    useEffect(() => {
        if (sipPlan === 'SIP TARIFADO 30 Canais' ||
            sipPlan === 'SIP TARIFADO 60 Canais' ||
            sipPlan === 'SIP ILIMITADO 60 Canais') {
            setSipAdditionalChannels(0);
        }
    }, [sipPlan]);



    // Add PABX to proposal
    const addPABXToProposal = () => {
        if (!pabxResult) return;

        let description = '';
        if (pabxModality === 'Standard') {
            description = `PABX Standard ${pabxExtensions} ramais`;
            if (pabxIncludeDevices) {
                description += ` + ${pabxDeviceQuantity} aparelhos`;
            }
            if (pabxIncludeAI) {
                description += ` + Agente IA ${pabxAIPlan}`;
            }
        } else {
            description = `PABX Premium ${pabxPremiumPlan} ${pabxPremiumSubPlan} ${pabxExtensions} ramais (${contractDuration} meses)`;
            description += ` - ${pabxPremiumEquipment} Equipamento`;
            if (pabxIncludeAI) {
                description += ` + Agente IA ${pabxAIPlan}`;
            }
        }

        const newItem: ProposalItem = {
            id: generateUniqueId(),
            description: description,
            setup: pabxResult.setup,
            monthly: pabxResult.totalMonthly,
            details: {
                applySalespersonDiscount,
                appliedDirectorDiscountPercentage,
                pabxModality,
                pabxExtensions,
                contractDuration
            }
        };

        setProposalItems(prev => [...prev, newItem]);
    };

    // Adicionar SIP à proposta
    const addSIPToProposal = () => {
        if (!sipResult) return;

        const newItem: ProposalItem = {
            id: generateUniqueId(),
            description: sipPlan,
            setup: sipResult.setup,
            monthly: sipResult.monthly,
            details: {
                applySalespersonDiscount,
                appliedDirectorDiscountPercentage,
                sipPlan,
                contractDuration
            }
        };

        setProposalItems(prev => [...prev, newItem]);
    };

    const handleRemoveItem = (id: string) => {
        setProposalItems(prev => prev.filter(item => item.id !== id));
    };

    // Calcular totais da proposta
    console.log("Type of proposalItems before reduce:", typeof proposalItems, "Is array:", Array.isArray(proposalItems));
    const rawTotalSetup = proposalItems.reduce((sum, item) => sum + (parseFloat(item.setup as any) || 0), 0);
    const rawTotalMonthly = proposalItems.reduce((sum, item) => sum + (parseFloat(item.monthly as any) || 0), 0);

    // Aplicar desconto do vendedor (5% fixo)
    const salespersonDiscountFactor = applySalespersonDiscount ? 0.95 : 1; // Conditional application

    // Aplicar desconto do diretor (personalizável)
    const directorDiscountFactor = 1 - (appliedDirectorDiscountPercentage / 100);

    const partnerIndicatorCommission = (getPartnerIndicatorRate(rawTotalMonthly, contractDuration) / 100) * rawTotalMonthly;

    const influencerPartnerCommission = (getPartnerInfluencerRate(rawTotalMonthly, contractDuration) / 100) * rawTotalMonthly;

    // Desconto do vendedor e diretor aplicado apenas sobre o valor mensal, não sobre o setup
    const finalTotalSetup = rawTotalSetup; // Sem desconto no setup
    const finalTotalMonthly = (rawTotalMonthly * salespersonDiscountFactor * directorDiscountFactor) - partnerIndicatorCommission - influencerPartnerCommission;

    const clearForm = () => {
        setClientData({ name: '', contact: '', projectName: '', email: '', phone: '' });
        setAccountManagerData({ name: '', email: '', phone: '' });
        setProposalItems([]);
        setCurrentProposal(null);
        setSelectedStatus('Aguardando Aprovação do Cliente');
        // Resetar outros estados da calculadora se necessário
    };

    const createNewProposal = () => {
        clearForm();
        setCurrentView('client-form');
    };

    const viewProposal = (proposal: Proposal) => {
        console.log('🔍 PABX viewProposal - Proposta recebida:', proposal);
        
        setCurrentProposal(proposal);

        // Handle client data - check if it's an object or string
        if (typeof proposal.client === 'object' && proposal.client !== null) {
            console.log('✅ Cliente é objeto:', proposal.client);
            setClientData(proposal.client);
        } else if (typeof proposal.client === 'string') {
            console.log('⚠️ Cliente é string:', proposal.client);
            setClientData({
                name: proposal.client,
                contact: proposal.clientData?.contact || '',
                projectName: proposal.clientData?.projectName || '',
                email: proposal.clientData?.email || '',
                phone: proposal.clientData?.phone || ''
            });
        } else if (proposal.clientData) {
            console.log('✅ Usando clientData:', proposal.clientData);
            setClientData(proposal.clientData);
        }

        // Handle account manager data
        if (proposal.accountManager) {
            console.log('✅ Account Manager:', proposal.accountManager);
            if (typeof proposal.accountManager === 'string') {
                setAccountManagerData({
                    name: proposal.accountManager,
                    email: proposal.metadata?.accountManagerEmail || '',
                    phone: proposal.metadata?.accountManagerPhone || ''
                });
            } else {
                setAccountManagerData(proposal.accountManager);
            }
        }

        // Handle items/products - check multiple possible locations
        let items: ProposalItem[] = [];
        if (proposal.items && Array.isArray(proposal.items)) {
            console.log('✅ Usando items:', proposal.items);
            items = proposal.items;
        } else if (proposal.products && Array.isArray(proposal.products)) {
            console.log('✅ Convertendo products para items:', proposal.products);
            // Convert products to items format if needed
            items = proposal.products.map((product: any) => ({
                id: product.id || `item-${Date.now()}`,
                description: product.description || 'PABX SIP',
                setup: product.setup || 0,
                monthly: product.monthly || 0,
                quantity: product.quantity || 1,
                details: product.details
            }));
        }

        console.log('📦 Items finais:', items);
        setProposalItems(items);

        // Load status and changes
        setSelectedStatus(proposal.status || 'Aguardando Aprovação do Cliente');
        setSelectedForecastTemperature(String((proposal as any).forecastTemperature ?? (proposal as any).metadata?.forecastTemperature ?? 50));
        setProposalChanges(proposal.changes || '');

        setCurrentView('proposal-summary');
    };

    const editProposal = (proposal: Proposal) => {
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
            if (typeof proposal.accountManager === 'string') {
                setAccountManagerData({
                    name: proposal.accountManager,
                    email: proposal.metadata?.accountManagerEmail || '',
                    phone: proposal.metadata?.accountManagerPhone || ''
                });
            } else {
                setAccountManagerData(proposal.accountManager);
            }
        }

        console.log("Proposal items from Firebase in editProposal:", proposal.items);
        console.log("Proposal products from Firebase in editProposal:", proposal.products);

        // Handle items/products - check multiple possible locations
        let items: ProposalItem[] = [];
        if (proposal.items && Array.isArray(proposal.items)) {
            items = proposal.items;
        } else if (proposal.products && Array.isArray(proposal.products)) {
            // Convert products to items format if needed
            items = proposal.products.map((product: any) => ({
                id: product.id || `item-${Date.now()}`,
                description: product.description || 'PABX SIP',
                setup: product.setup || 0,
                monthly: product.monthly || 0,
                quantity: product.quantity || 1
            }));
        }

        setProposalItems(items);

        // 🔥 CORREÇÃO: Carregar descontos de múltiplas fontes (com prioridade)
        console.log('🔍 PABXSIP editProposal - Carregando descontos');
        console.log('📋 Proposta completa:', proposal);
        
        // Buscar descontos em ordem de prioridade:
        // 1. Root da proposta
        // 2. Metadata
        // 3. DiscountInfo
        // 4. Detalhes dos produtos
        
        let applySalesperson = false;
        let appliedDirector = 0;
        
        // Prioridade 1: Root
        if (proposal.applySalespersonDiscount !== undefined) {
            applySalesperson = proposal.applySalespersonDiscount;
            console.log('✅ Desconto vendedor do ROOT:', applySalesperson);
        }
        if (proposal.appliedDirectorDiscountPercentage !== undefined) {
            appliedDirector = proposal.appliedDirectorDiscountPercentage;
            console.log('✅ Desconto diretor do ROOT:', appliedDirector);
        }
        
        // Prioridade 2: Metadata (se não encontrou no root)
        if (!applySalesperson && proposal.metadata?.applySalespersonDiscount !== undefined) {
            applySalesperson = proposal.metadata.applySalespersonDiscount;
            console.log('✅ Desconto vendedor do METADATA:', applySalesperson);
        }
        if (appliedDirector === 0 && proposal.metadata?.appliedDirectorDiscountPercentage !== undefined) {
            appliedDirector = proposal.metadata.appliedDirectorDiscountPercentage;
            console.log('✅ Desconto diretor do METADATA:', appliedDirector);
        }
        
        // Prioridade 3: DiscountInfo (se não encontrou ainda)
        if (!applySalesperson && proposal.discountInfo?.applySalespersonDiscount !== undefined) {
            applySalesperson = proposal.discountInfo.applySalespersonDiscount;
            console.log('✅ Desconto vendedor do DISCOUNTINFO:', applySalesperson);
        }
        if (appliedDirector === 0 && proposal.discountInfo?.appliedDirectorDiscountPercentage !== undefined) {
            appliedDirector = proposal.discountInfo.appliedDirectorDiscountPercentage;
            console.log('✅ Desconto diretor do DISCOUNTINFO:', appliedDirector);
        }
        
        // Prioridade 4: Detalhes dos produtos (última opção)
        if (!applySalesperson || appliedDirector === 0) {
            if (items && items.length > 0) {
                const firstItem = items[0];
                if (firstItem && (firstItem as any).details) {
                    const details = (firstItem as any).details;
                    console.log('📦 Detalhes do primeiro item:', details);
                    
                    if (!applySalesperson && details.applySalespersonDiscount !== undefined) {
                        applySalesperson = details.applySalespersonDiscount;
                        console.log('✅ Desconto vendedor dos DETALHES:', applySalesperson);
                    }
                    if (appliedDirector === 0 && details.appliedDirectorDiscountPercentage !== undefined) {
                        appliedDirector = details.appliedDirectorDiscountPercentage;
                        console.log('✅ Desconto diretor dos DETALHES:', appliedDirector);
                    }
                }
            }
        }
        
        // Aplicar os descontos encontrados
        console.log('🎯 Descontos finais a aplicar:', { applySalesperson, appliedDirector });
        setApplySalespersonDiscount(applySalesperson);
        setAppliedDirectorDiscountPercentage(appliedDirector);
        setDirectorDiscountPercentage(appliedDirector); // Também atualizar o campo de input

        // Restore contract duration if it exists
        if (proposal.contractPeriod) {
            setContractDuration(Number(proposal.contractPeriod));
        }

        // Load status and changes
        setSelectedStatus(proposal.status || 'Aguardando Aprovação do Cliente');
        setSelectedForecastTemperature(String((proposal as any).forecastTemperature ?? (proposal as any).metadata?.forecastTemperature ?? 50));
        setProposalChanges(proposal.changes || '');

        setCurrentView('calculator');
    };

    // Função para salvar proposta
    const saveProposal = async () => {
        if (proposalItems.length === 0) {
            alert('Adicione pelo menos um item à proposta antes de salvar.');
            return;
        }
        if (!currentUser) {
            alert('Você precisa estar logado para salvar uma proposta.');
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

        // Calculate raw totals
        const rawTotalSetup = proposalItems.reduce((sum, item) => sum + item.setup, 0);
        const rawTotalMonthly = proposalItems.reduce((sum, item) => sum + item.monthly, 0);

        // Apply discounts to get final totals
        const salespersonDiscountFactor = applySalespersonDiscount ? 0.95 : 1;
        const directorDiscountFactor = 1 - (appliedDirectorDiscountPercentage / 100);
        // Desconto do vendedor e diretor aplicado apenas sobre o valor mensal, não sobre o setup
        const finalTotalSetup = rawTotalSetup; // Sem desconto no setup
        const finalTotalMonthly = rawTotalMonthly * salespersonDiscountFactor * directorDiscountFactor;

        // Determine if this should be version 2 (when discounts are applied)
        const hasDiscounts = applySalespersonDiscount || appliedDirectorDiscountPercentage > 0;
        const proposalVersion = hasDiscounts ? 2 : 1;

        try {
            // Se tiver uma proposta atual, atualiza (independente de ter descontos ou não)
            if (currentProposal?.id) {
                const proposalToUpdate = {
                    id: currentProposal.id,
                    title: `Proposta PABX/SIP - ${clientData.name}`,
                    client: clientData.name,
                    accountManager: accountManagerData,
                    type: 'PABX',
                    status: selectedStatus,
                    forecastTemperature: Number(selectedForecastTemperature),
                    value: finalTotalMonthly,
                    totalMonthly: finalTotalMonthly,
                    totalSetup: finalTotalSetup,
                    contractPeriod: contractDuration,
                    version: proposalVersion,
                    updatedBy: currentUser.email || currentUser.id,
                    updatedAt: new Date().toISOString(),
                    // Manter dados originais importantes
                    createdBy: (currentProposal as any).createdBy || currentUser.id,
                    createdAt: (currentProposal as any).createdAt || new Date().toISOString(),
                    baseId: currentProposal.baseId || currentProposal.base_id,
                    // Atualizar dados editáveis
                    clientData: clientData,
                    products: proposalItems,
                    items: proposalItems, // 🔥 Adicionar items também
                    baseTotalMonthly: rawTotalMonthly,
                    applySalespersonDiscount: applySalespersonDiscount,
                    appliedDirectorDiscountPercentage: appliedDirectorDiscountPercentage,
                    userId: currentUser.id,
                    metadata: {
                        rawTotalMonthly: rawTotalMonthly,
                        rawTotalSetup: rawTotalSetup,
                        distributorId: accountManagerData.distributorId || '',
                        discountInfo: {
                            applySalespersonDiscount: applySalespersonDiscount,
                            appliedDirectorDiscountPercentage: appliedDirectorDiscountPercentage,
                            salespersonDiscountFactor: salespersonDiscountFactor,
                            directorDiscountFactor: directorDiscountFactor,
                            hasDiscounts: hasDiscounts
                        },
                        changes: proposalChanges,
                    }
                };

                const response = await fetch(`/api/simulator/proposals/${currentProposal.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${currentUser.token}`,
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
                fetchProposals();
            } else {
                // Criar nova proposta
                // Mapear propostas para o formato esperado pelo gerador
                const proposalsWithBaseId = pabxProposals.map((p: any) => ({
                    base_id: p.base_id || p.baseId || ''
                }));
                
                // Gerar ID único para a proposta
                const baseId = generateNextProposalId(proposalsWithBaseId, 'PABX', proposalVersion);
                console.log('🆔 ID gerado para nova proposta PABX:', baseId);

                const proposalData = {
                    base_id: baseId,
                    title: `Proposta PABX/SIP - ${clientData.name}`,
                    client: clientData.name,
                    accountManager: accountManagerData,
                    type: 'PABX',
                    status: selectedStatus,
                    forecastTemperature: Number(selectedForecastTemperature),
                    value: finalTotalMonthly,
                    totalMonthly: finalTotalMonthly,
                    totalSetup: finalTotalSetup,
                    contractPeriod: contractDuration,
                    version: proposalVersion,
                    clientData: clientData,
                    products: proposalItems,
                    items: proposalItems, // 🔥 Adicionar items também
                    baseTotalMonthly: rawTotalMonthly,
                    applySalespersonDiscount: applySalespersonDiscount,
                    appliedDirectorDiscountPercentage: appliedDirectorDiscountPercentage,
                    metadata: {
                        rawTotalMonthly: rawTotalMonthly,
                        rawTotalSetup: rawTotalSetup,
                        distributorId: accountManagerData.distributorId || '',
                        discountInfo: {
                            applySalespersonDiscount: applySalespersonDiscount,
                            appliedDirectorDiscountPercentage: appliedDirectorDiscountPercentage,
                            salespersonDiscountFactor: salespersonDiscountFactor,
                            directorDiscountFactor: directorDiscountFactor,
                            hasDiscounts: hasDiscounts
                        },
                        changes: proposalChanges,
                    }
                };

                const response = await fetch('/api/simulator/proposals', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${currentUser.token}`,
                    },
                    body: JSON.stringify(proposalData)
                });

                if (!response.ok) {
                    throw new Error('Erro ao salvar proposta');
                }
                const result = await response.json();
                const savedProposal = result.data || result;
                toast.success(`Proposta ${savedProposal.base_id || savedProposal.id} salva com sucesso!`);
                setCurrentProposal(savedProposal);
                fetchProposals();
                clearForm();
                setCurrentView('search');
            }
        } catch (error) {
            console.error('Erro ao salvar proposta:', error);
            alert('Erro ao salvar proposta: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
        }
    };


    const cancelAction = () => {
        clearForm();
        setCurrentView('search');
    };

    // Carregar propostas e preços do localStorage
    useEffect(() => {
        fetchProposals();
    }, []);

    // ✅ CORREÇÃO BUG #2: Sincronização automática de propostas
    useEffect(() => {
        const cleanupListeners = setupProposalSyncListeners(fetchProposals, loadingProposals);
        const cleanupRefresh = setupProposalAutoRefresh(fetchProposals, loadingProposals, 30000);

        return () => {
            cleanupListeners();
            cleanupRefresh();
        };
    }, [fetchProposals, loadingProposals]);

    // Filter proposals for PABX type
    const pabxProposals = React.useMemo(() => {
        return savedProposals.filter((p: any) =>
            p.type === 'PABX' || p.base_id?.startsWith('Prop_PabxSip_')
        );
    }, [savedProposals]);

    // 🔥 CORREÇÃO: useEffect para carregar descontos quando editar proposta
    useEffect(() => {
        if (currentProposal && proposalItems.length > 0) {
            console.log('🔍 PABXSIP - Carregando descontos da proposta:', currentProposal);
            const firstItem = proposalItems[0];
            
            if (firstItem && (firstItem as any).details) {
                const details = (firstItem as any).details;
                console.log('📦 Detalhes do primeiro item:', details);
                
                // Carregar desconto do vendedor
                if (details.applySalespersonDiscount !== undefined) {
                    console.log('✅ Carregando applySalespersonDiscount:', details.applySalespersonDiscount);
                    setApplySalespersonDiscount(details.applySalespersonDiscount);
                }
                
                // Carregar desconto do diretor
                if (details.appliedDirectorDiscountPercentage !== undefined) {
                    console.log('✅ Carregando appliedDirectorDiscountPercentage:', details.appliedDirectorDiscountPercentage);
                    setAppliedDirectorDiscountPercentage(details.appliedDirectorDiscountPercentage);
                }
            }
        }
    }, [currentProposal, proposalItems]);

    // Efeito para calcular a margem líquida estimada a partir do markup
    useEffect(() => {
        if (markup >= 0) {
            const margin = (markup / (100 + markup)) * 100;
            setEstimatedNetMargin(margin);
        }
    }, [markup]);

    // Calcular automaticamente quando os valores mudarem
    useEffect(() => {
        const result = calculatePABX();
        setPabxResult(result);
    }, [pabxModality, pabxExtensions, pabxIncludeSetup, pabxIncludeDevices, pabxDeviceQuantity, pabxIncludeAI, pabxAIPlan, pabxPremiumPlan, pabxPremiumSubPlan, pabxPremiumEquipment, contractDuration, pabxPrices, aiAgentPrices, getPriceRange, calculatePABX]);

    // Detectar mudanças nos valores para mostrar botão de nova versão
    useEffect(() => {
        if (currentProposal?.id) {
            setHasChanged(true);
        }
    }, [pabxModality, pabxExtensions, pabxIncludeSetup, pabxIncludeDevices, pabxDeviceQuantity, pabxIncludeAI, pabxAIPlan, pabxPremiumPlan, pabxPremiumSubPlan, pabxPremiumEquipment, contractDuration, sipPlan, sipIncludeSetup, sipAdditionalChannels, sipWithEquipment, clientData, accountManagerData, applySalespersonDiscount, appliedDirectorDiscountPercentage, currentProposal?.id]);

    // Alias for backward compatibility
    const calculatePABXResult = useCallback(calculatePABX, [pabxModality, pabxExtensions, pabxIncludeSetup, pabxIncludeDevices, pabxDeviceQuantity, pabxIncludeAI, pabxAIPlan, pabxPremiumPlan, pabxPremiumSubPlan, pabxPremiumEquipment, contractDuration, pabxPrices, aiAgentPrices, getPriceRange, calculatePABX]);

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

        // Debug: Verificar parâmetros recebidos
        console.log('🔍 handleSave PABX chamado com:', {
            proposalId,
            saveAsNewVersion,
            currentProposalId: currentProposal?.id,
            currentProposalBaseId: currentProposal?.baseId || currentProposal?.base_id
        });

        try {
            setSaving(true);

            // Calcular totais com e sem descontos
            const rawTotalSetup = proposalItems.reduce((sum, item) => sum + item.setup, 0);
            const rawTotalMonthly = proposalItems.reduce((sum, item) => sum + item.monthly, 0);
            const salespersonDiscountFactor = applySalespersonDiscount ? 0.95 : 1;
            const directorDiscountFactor = 1 - (appliedDirectorDiscountPercentage / 100);
            const finalTotalSetup = rawTotalSetup;
            const finalTotalMonthly = rawTotalMonthly * salespersonDiscountFactor * directorDiscountFactor;
            const hasDiscounts = applySalespersonDiscount || appliedDirectorDiscountPercentage > 0;

            // IMPORTANTE: Verificar ATUALIZAR primeiro, depois NOVA VERSÃO
            if (saveAsNewVersion === false && currentProposal?.id) {
                // ATUALIZAR PROPOSTA EXISTENTE - Atualiza o mesmo registro no banco
                console.log('🔄 Atualizando proposta PABX/SIP existente:', currentProposal.id);
                console.log('📋 Dados da proposta atual:', {
                    id: currentProposal.id,
                    baseId: currentProposal.baseId || currentProposal.base_id,
                    version: currentProposal.version
                });
                
                const proposalToUpdate = {
                    title: `Proposta PABX/SIP - ${clientData.name}`,
                    client: clientData.name,
                    accountManager: accountManagerData,
                    status: selectedStatus,
                    forecastTemperature: Number(selectedForecastTemperature),
                    value: finalTotalMonthly,
                    totalMonthly: finalTotalMonthly,
                    totalSetup: finalTotalSetup,
                    clientData: clientData,
                    products: proposalItems,
                    items: proposalItems, // 🔥 Adicionar items também
                    // 🔥 Salvar descontos no root da proposta
                    applySalespersonDiscount: applySalespersonDiscount,
                    appliedDirectorDiscountPercentage: appliedDirectorDiscountPercentage,
                    baseTotalMonthly: rawTotalMonthly,
                    // Salvar descontos no metadata também
                    metadata: {
                        baseTotalMonthly: rawTotalMonthly,
                        baseTotalSetup: rawTotalSetup,
                        applySalespersonDiscount: applySalespersonDiscount,
                        appliedDirectorDiscountPercentage: appliedDirectorDiscountPercentage,
                        distributorId: accountManagerData.distributorId || ''
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
                    setSavedProposals(prev => prev.map(p => p.id === updatedProposal.id ? updatedProposal : p));
                    setCurrentView('search'); // 🔥 Redirecionar para buscar propostas
                    setHasChanged(false);
                } else {
                    throw new Error('Erro ao atualizar proposta');
                }
            } else if (saveAsNewVersion === true && currentProposal) {
                // CRIAR NOVA VERSÃO - Sempre cria um novo registro no banco
                console.log('📝 Criando nova versão da proposta PABX/SIP:', currentProposal.baseId || currentProposal.base_id);
                
                const baseIdToUse = currentProposal.baseId || currentProposal.base_id;
                if (!baseIdToUse) {
                    alert('Proposta atual não possui ID base válido');
                    setSaving(false);
                    return;
                }
                
                const { generateNewVersion } = await import('@/lib/proposal-id-generator');
                const proposalsWithBaseId = pabxProposals.map((p: any) => ({
                    base_id: p.base_id || p.baseId || ''
                }));
                const newBaseId = generateNewVersion(baseIdToUse, proposalsWithBaseId);
                
                const proposalData = {
                    base_id: newBaseId,
                    title: `Proposta PABX/SIP - ${clientData.name}_v${parseInt(newBaseId.match(/_v(\d+)$/)?.[1] || '1')}`,
                    client: clientData.name,
                    accountManager: accountManagerData,
                    type: 'PABX',
                    status: selectedStatus,
                    forecastTemperature: Number(selectedForecastTemperature),
                    value: finalTotalMonthly,
                    totalMonthly: finalTotalMonthly,
                    totalSetup: finalTotalSetup,
                    contractPeriod: contractDuration,
                    version: parseInt(newBaseId.match(/_v(\d+)$/)?.[1] || '1'),
                    clientData: clientData,
                    products: proposalItems,
                    items: proposalItems, // 🔥 Adicionar items também
                    // 🔥 Salvar descontos no root da proposta
                    applySalespersonDiscount: applySalespersonDiscount,
                    appliedDirectorDiscountPercentage: appliedDirectorDiscountPercentage,
                    baseTotalMonthly: rawTotalMonthly,
                    // Salvar descontos e informações adicionais no metadata também
                    metadata: {
                        baseTotalMonthly: rawTotalMonthly,
                        baseTotalSetup: rawTotalSetup,
                        applySalespersonDiscount: applySalespersonDiscount,
                        appliedDirectorDiscountPercentage: appliedDirectorDiscountPercentage,
                        distributorId: accountManagerData.distributorId || ''
                    },
                    date: new Date().toISOString(),
                    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
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
                    setSavedProposals(prev => [newProposal, ...prev]);
                    setCurrentView('search'); // 🔥 Redirecionar para buscar propostas
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

    const handleDeleteProposal = async (proposalId: string) => {
        if (!currentUser) {
            toast.error('Você precisa estar logado para excluir uma proposta.');
            return;
        }

        if (window.confirm('Tem certeza que deseja excluir esta proposta?')) {
            try {
                const response = await fetch(`/api/simulator/proposals/${proposalId}`, {
                    method: 'DELETE',
                    headers: getCRMAuthHeaders(),
                });

                if (response.ok) {
                    toast.success('Proposta excluída com sucesso!');
                    fetchProposals();
                } else {
                    const errorData = await response.json();
                    console.error('Erro ao excluir proposta:', errorData);
                    toast.error(`Falha ao excluir a proposta: ${errorData.error || 'Erro desconhecido'}`);
                }
            } catch (error) {
                console.error('Erro ao excluir proposta:', error);
                toast.error('Falha ao excluir a proposta.');
            }
        }
    };

    const filteredProposals = pabxProposals.filter(p => {
        const clientName = typeof p.client === 'string' ? p.client : p.client?.name || '';
        const proposalId = p.id || '';
        const searchTermLower = searchTerm.toLowerCase();
        return (
            clientName.toLowerCase().includes(searchTermLower) ||
            proposalId.toLowerCase().includes(searchTermLower)
        );
    });

    useDeepLinkedProposal(initialProposalId, pabxProposals, editProposal, loadingProposals);

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

    // Se estiver na tela de formulário do cliente, mostrar o formulário
    if (currentView === 'client-form') {
        return (
            <ClientManagerForm
                clientData={clientData}
                accountManagerData={accountManagerData}
                onClientDataChange={setClientData}
                onAccountManagerDataChange={setAccountManagerData}
                onBack={cancelAction}
                onContinue={() => setCurrentView('calculator')}
                title="Nova Proposta - PABX/SIP"
                subtitle="Preencha os dados do cliente e gerente de contas para continuar."
            />
        );
    }

    // Se estiver na tela de busca, mostrar a tela de buscar propostas
    if (currentView === 'search') {
        return (
            <div className="container mx-auto p-6 bg-slate-950 text-white min-h-screen">
                <div className="mb-8">
                    <Button
                        variant="outline"
                        onClick={() => setCurrentView('calculator')}
                        className="flex items-center mb-4"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Voltar
                    </Button>
                    <h1 className="text-3xl font-bold text-white mb-2">Buscar Propostas</h1>
                    <p className="text-slate-400">Encontre propostas existentes ou crie uma nova.</p>
                </div>

                <Card className="bg-slate-900/80 border-slate-800 text-white mb-6">
                    <CardContent className="p-6">
                        <div className="flex gap-4 items-center">
                            <div className="flex-1">
                                <Input
                                    type="text"
                                    placeholder="Buscar por cliente ou ID..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-slate-800 border-slate-700 text-white placeholder-slate-400"
                                />
                            </div>
                            <Button
                                onClick={createNewProposal}
                                className="bg-blue-600 hover:bg-blue-700 px-6"
                            >
                                <Plus className="mr-2 h-4 w-4" /> Nova Proposta
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Tabela de propostas */}
                <Card className="bg-slate-900/80 border-slate-800 text-white">
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-slate-700">
                                    <TableHead className="text-slate-300 font-semibold">ID</TableHead>
                                    <TableHead className="text-slate-300 font-semibold">Cliente</TableHead>
                                    <TableHead className="text-slate-300 font-semibold">Nome do Projeto</TableHead>
                                    <TableHead className="text-slate-300 font-semibold">Data</TableHead>
                                    <TableHead className="text-slate-300 font-semibold">Total Mensal</TableHead>
                                    <TableHead className="text-slate-300 font-semibold">Status</TableHead>
                                    <TableHead className="text-slate-300 font-semibold">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredProposals.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                                            Nenhuma proposta encontrada. Clique em &quot;Nova Proposta&quot; para começar.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredProposals.map((proposal) => (
                                        <TableRow key={proposal.id} className="border-slate-800 hover:bg-slate-800/50">
                                            <TableCell className="text-slate-300">{proposal.baseId || proposal.id}</TableCell>
                                            <TableCell className="text-slate-300">{typeof proposal.client === 'string' ? proposal.client : proposal.client?.name || 'Sem nome'} (v{proposal.version})</TableCell>
                                            <TableCell className="text-slate-300">{
                                                typeof proposal.client === 'object' && proposal.client?.projectName
                                                    ? proposal.client.projectName
                                                    : proposal.clientData?.projectName || 'Projeto não informado'
                                            }</TableCell>
                                            <TableCell className="text-slate-300">{proposal.createdAt ? (isNaN(new Date(proposal.createdAt).getTime()) ? 'N/A' : new Date(proposal.createdAt).toLocaleDateString('pt-BR')) : 'N/A'}</TableCell>
                                            <TableCell className="text-slate-300">{formatCurrency(Number(proposal.totalMonthly || proposal.value || 0))}</TableCell>
                                            <TableCell>
                                                <ProposalStatusBadge status={proposal.status} />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                                                        onClick={() => viewProposal(proposal)}
                                                    >
                                                        <Edit className="h-4 w-4 mr-2" /> Visualizar
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="border-blue-600 text-blue-300 hover:bg-blue-700"
                                                        onClick={() => editProposal(proposal)}
                                                    >
                                                        <Edit className="h-4 w-4 mr-2" /> Editar
                                                    </Button>
                                                    <ConvertToB2BOpportunityButton proposal={proposal} />
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleDeleteProposal(proposal.id)}
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
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Se estiver na tela de visualização da proposta, mostrar o resumo
    if (currentView === 'proposal-summary' && currentProposal) {
        return (
            <Card className="bg-white border-gray-300 text-black print:shadow-none proposal-view">
                <CardHeader className="print:pb-2">
                    <div className="flex justify-between items-start mb-4 print:mb-2">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Proposta Comercial</h1>
                            <p className="text-gray-600">PABX/SIP</p>
                        </div>
                        <div className="flex gap-2 no-print">
                            <Button variant="outline" onClick={() => setCurrentView('search')}>
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
                                        : currentProposal.clientData?.name ||
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
                                {(currentProposal.items || currentProposal.products || proposalItems || []).map((item, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{item.description}</TableCell>
                                        <TableCell>{formatCurrency(item.setup)}</TableCell>
                                        <TableCell>{formatCurrency(item.monthly)}</TableCell>
                                    </TableRow>
                                ))}
                                {(!currentProposal.items && !currentProposal.products && (!proposalItems || proposalItems.length === 0)) && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-gray-500">
                                                Nenhum item encontrado
                                            </TableCell>
                                        </TableRow>
                                    )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Histórico de Descontos Aplicados - Logo após produtos */}
                    {(() => {
                        // 🔥 Buscar descontos de múltiplas fontes (root, metadata, discountInfo, products)
                        const applySalesperson = currentProposal.applySalespersonDiscount 
                            || currentProposal.metadata?.applySalespersonDiscount 
                            || currentProposal.discountInfo?.applySalespersonDiscount
                            || (currentProposal.items?.[0] as any)?.details?.applySalespersonDiscount
                            || (currentProposal.products?.[0] as any)?.details?.applySalespersonDiscount
                            || false;
                        
                        const appliedDirector = currentProposal.appliedDirectorDiscountPercentage 
                            || currentProposal.metadata?.appliedDirectorDiscountPercentage 
                            || currentProposal.discountInfo?.appliedDirectorDiscountPercentage
                            || (currentProposal.items?.[0] as any)?.details?.appliedDirectorDiscountPercentage
                            || (currentProposal.products?.[0] as any)?.details?.appliedDirectorDiscountPercentage
                            || 0;
                        
                        console.log('🔍 Descontos encontrados:', { applySalesperson, appliedDirector });
                        
                        return (applySalesperson || appliedDirector > 0) && (
                            <div className="border-t pt-4 print:pt-2">
                                <div className="p-4 bg-orange-50 border border-orange-300 rounded">
                                    <h4 className="font-semibold text-orange-800 mb-3 flex items-center">
                                        📋 Histórico de Descontos Aplicados
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="mb-2"><strong>Versão:</strong> <span className="text-orange-600 font-semibold">v{currentProposal.version || 1}</span></p>
                                            {applySalesperson && (
                                                <p className="mb-2"><strong>Desconto Vendedor:</strong> <span className="text-orange-600 font-semibold">5%</span></p>
                                            )}
                                            {appliedDirector > 0 && (
                                                <p className="mb-2"><strong>Desconto Diretor:</strong> <span className="text-orange-600 font-semibold">{appliedDirector}%</span></p>
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
                        );
                    })()}

                    {/* Resumo Financeiro */}
                    <div className="border-t pt-4 print:pt-2">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Resumo Financeiro</h3>

                        {/* Descontos Aplicados - Valores detalhados */}
                        {(() => {
                            // 🔥 Buscar descontos de múltiplas fontes
                            const applySalesperson = currentProposal.applySalespersonDiscount 
                                || currentProposal.metadata?.applySalespersonDiscount 
                                || currentProposal.discountInfo?.applySalespersonDiscount
                                || (currentProposal.items?.[0] as any)?.details?.applySalespersonDiscount
                                || (currentProposal.products?.[0] as any)?.details?.applySalespersonDiscount
                                || false;
                            
                            const appliedDirector = currentProposal.appliedDirectorDiscountPercentage 
                                || currentProposal.metadata?.appliedDirectorDiscountPercentage 
                                || currentProposal.discountInfo?.appliedDirectorDiscountPercentage
                                || (currentProposal.items?.[0] as any)?.details?.appliedDirectorDiscountPercentage
                                || (currentProposal.products?.[0] as any)?.details?.appliedDirectorDiscountPercentage
                                || 0;
                            
                            const baseTotalMonthly = currentProposal.baseTotalMonthly 
                                || currentProposal.metadata?.baseTotalMonthly 
                                || currentProposal.metadata?.rawTotalMonthly
                                || currentProposal.totalMonthly 
                                || 0;
                            
                            return (applySalesperson || appliedDirector > 0) && (
                                <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded">
                                    <h4 className="font-semibold text-amber-800 mb-3 flex items-center">
                                        💰 Descontos Aplicados
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span><strong>Valor Original (Mensal):</strong></span>
                                            <span className="font-semibold">{formatCurrency(baseTotalMonthly)}</span>
                                        </div>
                                        
                                        {applySalesperson && (
                                            <div className="flex justify-between text-orange-700">
                                                <span><strong>Desconto Vendedor (5%):</strong></span>
                                                <span className="font-semibold">-{formatCurrency(baseTotalMonthly * 0.05)}</span>
                                            </div>
                                        )}

                                        {appliedDirector > 0 && (
                                            <div className="flex justify-between text-orange-700">
                                                <span><strong>Desconto Diretor ({appliedDirector}%) - Apenas Mensal:</strong></span>
                                                <span className="font-semibold">-{formatCurrency((baseTotalMonthly * (applySalesperson ? 0.95 : 1)) * (appliedDirector / 100))}</span>
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
                            );
                        })()}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <p><strong>Total Setup {currentProposal.discountInfo?.hasDiscounts ? '(com desconto)' : ''}:</strong> {formatCurrency(currentProposal.totalSetup || 0)}</p>
                                <p><strong>Total Mensal {currentProposal.discountInfo?.hasDiscounts ? '(com desconto)' : ''}:</strong> {formatCurrency(currentProposal.totalMonthly || 0)}</p>
                            </div>
                            <div>
                                <p><strong>Data da Proposta:</strong> {currentProposal.createdAt ? (
                                    (typeof currentProposal.createdAt === 'object' && currentProposal.createdAt && 'toDate' in currentProposal.createdAt)
                                        ? new Date((currentProposal.createdAt as any).toDate()).toLocaleDateString('pt-BR')
                                        : (isNaN(new Date(currentProposal.createdAt).getTime()) ? 'N/A' : new Date(currentProposal.createdAt).toLocaleDateString('pt-BR'))
                                ) : 'N/A'}</p>
                                <p><strong>ID da Proposta:</strong> {currentProposal.baseId || currentProposal.id}</p>
                                <p><strong>Versão:</strong> {currentProposal.version || 1}</p>
                                <p><strong>Período do Contrato:</strong> {currentProposal.contractPeriod ? `${currentProposal.contractPeriod} meses` : 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Payback Info se disponível */}
                    {currentProposal.totalSetup > 0 && (
                        <div className="border-t pt-4 print:pt-2">
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">Análise de Payback</h3>
                            {(() => {
                                const totalSetup = currentProposal.totalSetup;
                                const totalMonthly = currentProposal.totalMonthly;
                                const contractTerm = contractDuration || 12;

                                // Usar a função calculatePayback padronizada
                                const paybackMonths = calculatePayback(
                                    totalSetup,
                                    0, // No equipment cost for PABX
                                    totalMonthly,
                                    contractTerm,
                                    0 // No director discount applied here
                                );

                                const maxPayback = getMaxPaybackMonths(contractTerm);
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
        );
    }

    // Tela da calculadora
    return (
        <div className="container mx-auto p-4 bg-slate-950 text-white">
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Calculadora PABX/SIP</h1>
                        <p className="text-slate-400 mt-2">Configure e calcule os custos para PABX em Nuvem e SIP Trunk</p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setCurrentView('search')}
                            className="border-slate-600 text-slate-300 hover:bg-slate-700"
                        >
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

                {/* Informações do Cliente e Gerente */}
                <ClientManagerInfo clientData={clientData} accountManagerData={accountManagerData} />
            </div>

            <Tabs defaultValue="calculator" className="w-full">
                <TabsList className={`grid w-full grid-cols-4 bg-slate-800 text-slate-400`}>
                    <TabsTrigger value="calculator">Calculadora</TabsTrigger>
                    {canEditCommissions && (
                        <TabsTrigger value="list-price">Tabela de Preços</TabsTrigger>
                    )}
                    {canEditCommissions && (
                        <TabsTrigger value="commissions-table">Tabela Comissões</TabsTrigger>
                    )}
                    {canEditCommissions && (
                        <TabsTrigger value="dre">DRE</TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="calculator">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                        {/* PABX em Nuvem */}
                        <Card className="bg-slate-900/80 border-slate-800 text-white">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Phone className="h-5 w-5" />
                                    PABX em Nuvem
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label>Modalidade</Label>
                                    <RadioGroup value={pabxModality} onValueChange={(value) => setPabxModality(value as 'Standard' | 'Premium')}>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="Standard" id="pabx-standard" />
                                            <Label htmlFor="pabx-standard">PABX - Standard</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="Premium" id="pabx-premium" />
                                            <Label htmlFor="pabx-premium">PABX - Premium</Label>
                                        </div>
                                    </RadioGroup>
                                </div>

                                <div>
                                    <Label htmlFor="pabx-extensions">Quantidade de Ramais</Label>
                                    <Input
                                        id="pabx-extensions"
                                        type="number"
                                        value={pabxExtensions}
                                        onChange={(e) => setPabxExtensions(parseInt(e.target.value) || 1)}
                                        min="1"
                                        max="1000"
                                        className="bg-slate-800 border-slate-700 text-white"
                                        placeholder="Digite a quantidade de ramais"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">
                                        Faixa de preço: {pabxModality === 'Standard'
                                            ? getPriceRange(pabxExtensions) + ' ramais'
                                            : getPremiumPriceRange(pabxExtensions, pabxPremiumPlan, pabxPremiumSubPlan)
                                        }
                                    </p>
                                </div>

                                {/* Contract Duration - Standard */}
                                {pabxModality === 'Standard' && (
                                    <div className="space-y-2">
                                        <Label>Duração do Contrato</Label>
                                        <RadioGroup
                                            value={contractDuration.toString()}
                                            onValueChange={(value) => setContractDuration(Number(value))}
                                            className="grid grid-cols-2 md:grid-cols-5 gap-2"
                                        >
                                            {[12, 24, 36, 48, 60].map((months) => (
                                                <div key={months} className="flex items-center space-x-2">
                                                    <RadioGroupItem
                                                        value={months.toString()}
                                                        id={`${months}-meses-standard`}
                                                    />
                                                    <Label htmlFor={`${months}-meses-standard`}>{months} Meses</Label>
                                                </div>
                                            ))}
                                        </RadioGroup>
                                    </div>
                                )}

                                {/* Contract Duration - Premium */}
                                {pabxModality === 'Premium' && (
                                    <div className="space-y-2">
                                        <Label>Duração do Contrato</Label>
                                        <RadioGroup
                                            value={contractDuration.toString()}
                                            onValueChange={(value) => setContractDuration(Number(value))}
                                            className="grid grid-cols-2 gap-2"
                                        >
                                            {[24, 36].map((months) => (
                                                <div key={months} className="flex items-center space-x-2">
                                                    <RadioGroupItem
                                                        value={months.toString()}
                                                        id={`${months}-meses-premium`}
                                                    />
                                                    <Label htmlFor={`${months}-meses-premium`}>{months} Meses</Label>
                                                </div>
                                            ))}
                                        </RadioGroup>
                                    </div>
                                )}
                                {pabxModality === 'Premium' && (
                                    <div className="space-y-4">
                                        <div>
                                            <Label>Plano</Label>
                                            <Select value={pabxPremiumPlan} onValueChange={(value) => setPabxPremiumPlan(value as 'Essencial' | 'Profissional')}>
                                                <SelectTrigger className="w-full bg-slate-800 border-slate-700 text-white">
                                                    <SelectValue placeholder="Selecione o plano" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-slate-800 border-slate-700">
                                                    <SelectItem value="Essencial">Plano Essencial</SelectItem>
                                                    <SelectItem value="Profissional">Plano Profissional</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {pabxPremiumPlan === 'Essencial' && (
                                            <div className="space-y-4">
                                                <div>
                                                    <Label>Tipo de Plano Essencial</Label>
                                                    <Select value={pabxPremiumSubPlan} onValueChange={(value) => setPabxPremiumSubPlan(value as 'Ilimitado' | 'Tarifado')}>
                                                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-slate-800 border-slate-700">
                                                            <SelectItem value="Ilimitado">Essencial Ilimitado</SelectItem>
                                                            <SelectItem value="Tarifado">Essencial Tarifado</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <Label>Valores</Label>
                                                    <RadioGroup value={pabxPremiumEquipment} onValueChange={(value) => setPabxPremiumEquipment(value as 'Com' | 'Sem')}>
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="Com" id="essencial-com-equipamento" />
                                                            <Label htmlFor="essencial-com-equipamento">Valores com Equipamento</Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="Sem" id="essencial-sem-equipamento" />
                                                            <Label htmlFor="essencial-sem-equipamento">Valores sem Equipamento</Label>
                                                        </div>
                                                    </RadioGroup>
                                                </div>
                                            </div>
                                        )}
                                        {pabxPremiumPlan === 'Profissional' && (
                                            <div className="space-y-4">
                                                <div>
                                                    <Label>Tipo de Plano Profissional</Label>
                                                    <Select value={pabxPremiumSubPlan} onValueChange={(value) => setPabxPremiumSubPlan(value as 'Ilimitado' | 'Tarifado')}>
                                                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-slate-800 border-slate-700">
                                                            <SelectItem value="Ilimitado">Profissional Ilimitado</SelectItem>
                                                            <SelectItem value="Tarifado">Profissional Tarifado</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <Label>Valores</Label>
                                                    <RadioGroup value={pabxPremiumEquipment} onValueChange={(value) => setPabxPremiumEquipment(value as 'Com' | 'Sem')}>
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="Com" id="profissional-com-equipamento" />
                                                            <Label htmlFor="profissional-com-equipamento">Valores com Equipamento</Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="Sem" id="profissional-sem-equipamento" />
                                                            <Label htmlFor="profissional-sem-equipamento">Valores sem Equipamento</Label>
                                                        </div>
                                                    </RadioGroup>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="pabx-include-setup"
                                        checked={pabxIncludeSetup}
                                        onCheckedChange={(checked) => setPabxIncludeSetup(checked as boolean)}
                                    />
                                    <Label htmlFor="pabx-include-setup">Incluir Taxa de Setup</Label>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="pabx-include-devices"
                                        checked={pabxIncludeDevices}
                                        onCheckedChange={(checked) => setPabxIncludeDevices(checked as boolean)}
                                    />
                                    <Label htmlFor="pabx-include-devices">Incluir Aparelhos (Ramais Físicos)</Label>
                                </div>

                                {pabxIncludeDevices && (
                                    <div>
                                        <Label>Quantidade de Aparelhos</Label>
                                        <Input
                                            id="pabx-device-quantity"
                                            type="number"
                                            value={pabxDeviceQuantity}
                                            onChange={(e) => setPabxDeviceQuantity(parseInt(e.target.value) || 0)}
                                            className="bg-slate-800 border-slate-700 text-white"
                                        />
                                    </div>
                                )}

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="pabx-include-ai"
                                        checked={pabxIncludeAI}
                                        onCheckedChange={(checked) => setPabxIncludeAI(checked as boolean)}
                                    />
                                    <Label htmlFor="pabx-include-ai">Incluir Agente IA</Label>
                                </div>

                                <div className="flex items-center space-x-2 mt-4">
                                    <Checkbox
                                        id="include-parceiro-indicador"
                                        checked={includeParceiroIndicador}
                                        onCheckedChange={(checked) => setIncludeParceiroIndicador(checked as boolean)}
                                    />
                                    <Label htmlFor="include-parceiro-indicador">Incluir Parceiro Indicador</Label>
                                </div>

                                <div className="flex items-center space-x-2 mt-4">
                                    <Checkbox
                                        id="include-influencer-partner"
                                        checked={includeInfluencerPartner}
                                        onCheckedChange={(checked) => setIncludeInfluencerPartner(checked as boolean)}
                                    />
                                    <Label htmlFor="include-influencer-partner">Incluir Parceiro Influenciador</Label>
                                </div>

                                {pabxIncludeAI && (
                                    <div>
                                        <Label>Plano de Agente IA</Label>
                                        <Select value={pabxAIPlan} onValueChange={setPabxAIPlan}>
                                            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-800 border-slate-700">
                                                <SelectItem value="none">Sem Agente IA</SelectItem>
                                                <SelectItem value="20K">20K</SelectItem>
                                                <SelectItem value="40K">40K</SelectItem>
                                                <SelectItem value="60K">60K</SelectItem>
                                                <SelectItem value="100K">100K</SelectItem>
                                                <SelectItem value="150K">150K</SelectItem>
                                                <SelectItem value="200K">200K</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {pabxIncludeAI && (
                                    <div className="text-sm text-slate-400">
                                        <p>Tenha até:</p>
                                        <p>50.000 mensagens* ou</p>
                                        <p>10.000 minutos** ou</p>
                                        <p>5.000 voz premium*** ou</p>
                                        <p className="text-xs mt-1">*Opções acima combinadas</p>
                                    </div>
                                )}

                                {/* Resultado PABX */}
                                {pabxResult && (
                                    <div className="bg-slate-800 p-4 rounded-lg">
                                        <h3 className="font-semibold mb-2">Resultado PABX {pabxModality}:</h3>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between text-slate-300">
                                                <span>Ramais configurados:</span>
                                                <span>{pabxExtensions} ramais</span>
                                            </div>

                                            {pabxModality === 'Standard' ? (
                                                <>
                                                    <div className="flex justify-between text-slate-300">
                                                        <span>Faixa de preço:</span>
                                                        <span>{getPriceRange(pabxExtensions)} ramais</span>
                                                    </div>
                                                    <Separator className="my-2 bg-slate-600" />
                                                    <div className="flex justify-between">
                                                        <span>Taxa de Setup:</span>
                                                        <span>{formatCurrency(pabxResult.setup)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Valor por Ramal:</span>
                                                        <span>{formatCurrency(pabxPrices.monthly[getPriceRange(pabxExtensions) as keyof typeof pabxPrices.monthly])}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Valor Hospedagem:</span>
                                                        <span>{formatCurrency(pabxPrices.hosting[getPriceRange(pabxExtensions) as keyof typeof pabxPrices.hosting])}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Mensalidade Base:</span>
                                                        <span>{formatCurrency(pabxResult.baseMonthly)}</span>
                                                    </div>
                                                    {pabxIncludeDevices && (
                                                        <div className="flex justify-between">
                                                            <span>Aluguel Aparelhos ({pabxDeviceQuantity}x):</span>
                                                            <span>{formatCurrency(pabxResult.deviceRentalCost)}</span>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <div className="flex justify-between text-slate-300">
                                                        <span>Faixa de preço:</span>
                                                        <span>{getPremiumPriceRange(pabxExtensions, pabxPremiumPlan, pabxPremiumSubPlan)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-slate-300">
                                                        <span>Plano:</span>
                                                        <span>{pabxPremiumPlan} {pabxPremiumSubPlan}</span>
                                                    </div>
                                                    <div className="flex justify-between text-slate-300">
                                                        <span>Contrato:</span>
                                                        <span>{contractDuration} meses</span>
                                                    </div>
                                                    <div className="flex justify-between text-slate-300">
                                                        <span>Equipamento:</span>
                                                        <span>{pabxPremiumEquipment} Equipamento</span>
                                                    </div>
                                                    <Separator className="my-2 bg-slate-600" />
                                                    <div className="flex justify-between">
                                                        <span>Taxa de Setup:</span>
                                                        <span>{formatCurrency(pabxResult.setup)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Mensalidade Base:</span>
                                                        <span>{formatCurrency(pabxResult.baseMonthly)}</span>
                                                    </div>
                                                </>
                                            )}

                                            {pabxResult.aiAgentCost > 0 && (
                                                <div className="flex justify-between">
                                                    <span>Agente IA ({pabxAIPlan}):</span>
                                                    <span>{formatCurrency(pabxResult.aiAgentCost)}</span>
                                                </div>
                                            )}
                                            <Separator className="my-2 bg-slate-600" />
                                            <div className="flex justify-between font-semibold text-green-400">
                                                <span>Total Mensal:</span>
                                                <span>{formatCurrency(pabxResult.totalMonthly)}</span>
                                            </div>
                                        </div>
                                        <Button
                                            className="w-full mt-3 bg-green-600 hover:bg-green-700"
                                            onClick={addPABXToProposal}
                                        >
                                            Adicionar à Proposta
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* SIP Trunk */}
                        <Card className="bg-slate-900/80 border-slate-800 text-white">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <PhoneForwarded className="h-5 w-5" />
                                    SIP Trunk
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label>Plano SIP</Label>
                                    <Select value={sipPlan} onValueChange={setSipPlan}>
                                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-700">
                                            <SelectItem value="SIP TARIFADO Call Center 2 Canais">SIP TARIFADO Call Center 2 Canais</SelectItem>
                                            <SelectItem value="SIP TARIFADO 2 Canais">SIP TARIFADO 2 Canais</SelectItem>
                                            <SelectItem value="SIP TARIFADO 4 Canais">SIP TARIFADO 4 Canais</SelectItem>
                                            <SelectItem value="SIP TARIFADO 10 Canais">SIP TARIFADO 10 Canais</SelectItem>
                                            <SelectItem value="SIP TARIFADO 30 Canais">SIP TARIFADO 30 Canais</SelectItem>
                                            <SelectItem value="SIP TARIFADO 60 Canais">SIP TARIFADO 60 Canais</SelectItem>
                                            <SelectItem value="SIP ILIMITADO 5 Canais">SIP ILIMITADO 5 Canais</SelectItem>
                                            <SelectItem value="SIP ILIMITADO 10 Canais">SIP ILIMITADO 10 Canais</SelectItem>
                                            <SelectItem value="SIP ILIMITADO 20 Canais">SIP ILIMITADO 20 Canais</SelectItem>
                                            <SelectItem value="SIP ILIMITADO 30 Canais">SIP ILIMITADO 30 Canais</SelectItem>
                                            <SelectItem value="SIP ILIMITADO 60 Canais">SIP ILIMITADO 60 Canais</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="sip-include-setup"
                                        checked={sipIncludeSetup}
                                        onCheckedChange={(checked) => setSipIncludeSetup(checked as boolean)}
                                    />
                                    <Label htmlFor="sip-include-setup">Incluir Taxa de Setup</Label>
                                </div>

                                <div>
                                    <Label htmlFor="sip-additional-channels">Canais Adicionais</Label>
                                    {(sipPlan === 'SIP TARIFADO 30 Canais' ||
                                        sipPlan === 'SIP TARIFADO 60 Canais' ||
                                        sipPlan === 'SIP ILIMITADO 60 Canais') ? (
                                        <div className="bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-orange-400 font-medium">
                                            Sem Possibilidade
                                        </div>
                                    ) : (
                                        <Input
                                            id="sip-additional-channels"
                                            type="number"
                                            value={sipAdditionalChannels}
                                            onChange={(e) => setSipAdditionalChannels(parseInt(e.target.value) || 0)}
                                            className="bg-slate-800 border-slate-700 text-white"
                                        />
                                    )}
                                </div>

                                <div>
                                    <Label>Franquia/Assinatura Mensal</Label>
                                    <RadioGroup value={sipWithEquipment ? "com" : "sem"} onValueChange={(value) => setSipWithEquipment(value === "com")}>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="sem" id="sem-equipamentos" />
                                            <Label htmlFor="sem-equipamentos">Sem Equipamentos</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="com" id="com-equipamentos" />
                                            <Label htmlFor="com-equipamentos">Com Equipamentos</Label>
                                        </div>
                                    </RadioGroup>
                                </div>

                                {/* Resultado SIP */}
                                {sipResult && (
                                    <div className="bg-slate-800 p-4 rounded-lg">
                                        <h3 className="font-semibold mb-2">Resultado SIP:</h3>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                                <span>Taxa de Setup:</span>
                                                <span>{formatCurrency(sipResult.setup)}</span>
                                            </div>
                                            <Separator className="my-2 bg-slate-600" />
                                            <div className="flex justify-between font-bold text-lg text-green-400">
                                                <span>Total Mensal:</span>
                                                <span>{formatCurrency(sipResult.monthly)}</span>
                                            </div>
                                        </div>
                                        <Button
                                            className="w-full mt-3 bg-green-600 hover:bg-green-700"
                                            onClick={addSIPToProposal}
                                        >
                                            Adicionar à Proposta
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="w-full mt-2 border-slate-600 text-slate-300 hover:bg-slate-700"
                                        >
                                            Ajustes do Sistema
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Resumo da Proposta */}
                    {proposalItems.length > 0 && (
                        <Card className="bg-slate-900/80 border-slate-800 text-white mt-6">
                            <CardHeader>
                                <CardTitle>Resumo da Proposta</CardTitle>
                            </CardHeader>
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
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-slate-700">
                                            <TableHead className="text-white">Descrição</TableHead>
                                            <TableHead className="text-white text-right">Setup</TableHead>
                                            <TableHead className="text-white text-right">Mensal</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {proposalItems.map((item, index) => (
                                            <TableRow key={item.id} className="border-slate-800">
                                                <TableCell>{item.description}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(item.setup)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(item.monthly)}</TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                                                        onClick={() => handleRemoveItem(item.id)}
                                                    >
                                                        Excluir
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {applySalespersonDiscount && (
                                            <TableRow key="salesperson-discount-row" className="border-slate-700 font-semibold text-orange-400">
                                                <TableCell>Desconto Vendedor (5%):</TableCell>
                                                <TableCell className="text-right">-{formatCurrency(rawTotalMonthly * 0.05)}</TableCell>
                                                <TableCell className="text-right">-{formatCurrency(rawTotalMonthly * 0.05)}</TableCell>
                                            </TableRow>
                                        )}
                                        {appliedDirectorDiscountPercentage > 0 && (
                                            <TableRow key="director-discount-row" className="border-slate-700 font-semibold text-orange-400">
                                                <TableCell>Desconto Diretor ({appliedDirectorDiscountPercentage}%) - Apenas Mensal:</TableCell>
                                                <TableCell className="text-right">R$ 0,00</TableCell>
                                                <TableCell className="text-right">-{formatCurrency(rawTotalMonthly * (applySalespersonDiscount ? 0.95 : 1) * (appliedDirectorDiscountPercentage / 100))}</TableCell>
                                            </TableRow>
                                        )}
                                        <TableRow key="total-setup-row" className="border-slate-700 font-semibold">
                                            <TableCell>Total Setup:</TableCell>
                                            <TableCell className="text-right">{formatCurrency(finalTotalSetup)}</TableCell>
                                            <TableCell></TableCell>
                                        </TableRow>
                                        <TableRow key="total-monthly-row" className="border-slate-700 font-semibold">
                                            <TableCell>Total Mensal:</TableCell>
                                            <TableCell></TableCell>
                                            <TableCell className="text-right">{formatCurrency(finalTotalMonthly)}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>

                                {/* Histórico de Descontos Aplicados */}
                                {(applySalespersonDiscount || appliedDirectorDiscountPercentage > 0) && (
                                    <div className="p-4 bg-gradient-to-br from-amber-900/40 to-orange-900/40 border-2 border-orange-500/60 rounded-lg shadow-lg mt-4">
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
                                    )}
                                    
                                    {/* Checkbox Desconto Vendedor */}
                                    {!isDirector && (
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="salesperson-discount-toggle"
                                                checked={applySalespersonDiscount}
                                                onCheckedChange={(checked) => setApplySalespersonDiscount(!!checked)}
                                            />
                                            <Label htmlFor="salesperson-discount-toggle" className="text-slate-300">Aplicar Desconto Vendedor (5%)</Label>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end gap-4 mt-6">
                                    {/* Botão "Salvar como Nova Versão" - Sempre cria uma nova versão da proposta */}
                                    {currentProposal?.id && (
                                        <Button
                                            onClick={() => {
                                                if (currentProposal.id) {
                                                    handleSave(currentProposal.id, true);
                                                }
                                            }}
                                            className="bg-blue-600 hover:bg-blue-700"
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Salvar como Nova Versão
                                        </Button>
                                    )}
                                    {/* Botão "Atualizar/Salvar Proposta" - Atualiza a proposta existente ou cria nova */}
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
                                                handleSave();
                                            }
                                        }} 
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        <Save className="h-4 w-4 mr-2" />
                                        {currentProposal ? 'Atualizar Proposta' : 'Salvar Proposta'}
                                    </Button>
                                    <Button className="bg-blue-600 hover:bg-blue-700">
                                        <Download className="h-4 w-4 mr-2" />
                                        Gerar PDF
                                    </Button>
                                    <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700" onClick={cancelAction}>
                                        Cancelar
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {canEditCommissions && (
                <TabsContent value="commissions-table">
                    <CommissionTablesUnified />
                </TabsContent>
                )}

                {canEditCommissions && (
                <TabsContent value="dre">
                    {(() => {
                        const dreMonthlyRevenue = (pabxResult?.totalMonthly || 0) + (sipResult?.monthly || 0);
                        const months = contractDuration;
                        // Cálculo correto das comissões baseado na seleção dos parceiros
                        const comissaoParceiroIndicador = includeParceiroIndicador
                            ? (dreMonthlyRevenue * (getChannelIndicatorCommissionRate(channelIndicator, dreMonthlyRevenue, months) / 100))
                            : 0;
                        const comissaoParceiroInfluenciador = includeInfluencerPartner
                            ? (dreMonthlyRevenue * (getChannelInfluencerCommissionRate(channelInfluencer, dreMonthlyRevenue, months) / 100))
                            : 0;

                        // Calcular a comissão correta baseado na presença de parceiros
                        const temParceiros = includeParceiroIndicador || includeInfluencerPartner;
                        const comissaoVendedor = temParceiros
                            ? (dreMonthlyRevenue * (getChannelSellerCommissionRate(channelSeller, months) / 100)) // Canal/Vendedor quando há parceiros
                            : (dreMonthlyRevenue * (getSellerCommissionRate(seller, months) / 100)); // Vendedor quando não há parceiros

                        const vendedorRate = temParceiros
                            ? getChannelSellerCommissionRate(channelSeller, months)
                            : getSellerCommissionRate(seller, months);

                        const diretorRate = getDirectorCommissionRate(channelDirector, months);

                        const parceiroIndicadorRate = includeParceiroIndicador
                            ? getChannelIndicatorCommissionRate(channelIndicator, dreMonthlyRevenue, months)
                            : 0;

                        const parceiroInfluenciadorRate = includeInfluencerPartner
                            ? getChannelInfluencerCommissionRate(channelInfluencer, dreMonthlyRevenue, months)
                            : 0;

                        const parceiroRate = parceiroIndicadorRate + parceiroInfluenciadorRate;

                        // CORREÇÃO: Não considerar custos PABX e SIP como custos operacionais (já são valores de venda)
                        // Considerar apenas Custo/Desp (10%) e Impostos (15%)

                        // Cálculo do DRE seguindo o modelo contábil correto
                        const receitaOperacionalBruta = dreMonthlyRevenue;

                        // Deduções da Receita Bruta (Impostos sobre a Receita - 15% conforme solicitado)
                        const impostosSobreReceita = receitaOperacionalBruta * 0.15;

                        // Custo/Despesa (10% da receita bruta)
                        const custosDespesas = receitaOperacionalBruta * 0.10;

                        // Receita Operacional Líquida (após impostos e custos/despesas)
                        const receitaOperacionalLiquida = receitaOperacionalBruta - impostosSobreReceita - custosDespesas;

                        // Despesas Operacionais (Comissões)
                        const despesasComissoes = comissaoVendedor + comissaoParceiroIndicador + comissaoParceiroInfluenciador + (dreMonthlyRevenue * (diretorRate / 100));

                        // Lucro/Prejuízo Operacional
                        const lucroOperacional = receitaOperacionalLiquida - despesasComissoes;

                        // Lucro/Prejuízo Líquido (considerando que não há outras despesas/receitas financeiras)
                        const lucroLiquido = lucroOperacional;

                        // Rentabilidade (Margem Líquida)
                        const rentabilidade = receitaOperacionalBruta > 0 ? (lucroLiquido / receitaOperacionalBruta) * 100 : 0;

                        const dreCalculations = {
                            receitaBruta: receitaOperacionalBruta,
                            receitaLiquida: receitaOperacionalLiquida,
                            custoServico: custosDespesas, // Agora representa apenas Custo/Desp (10%)
                            comissaoVendedor: comissaoVendedor,
                            comissaoDiretor: dreMonthlyRevenue * (diretorRate / 100),
                            comissaoParceiroIndicador: comissaoParceiroIndicador,
                            comissaoParceiroInfluenciador: comissaoParceiroInfluenciador,
                            totalImpostos: impostosSobreReceita,
                            lucroOperacional: lucroOperacional,
                            lucroLiquido: lucroLiquido,
                            rentabilidade: rentabilidade,
                            paybackMeses: 0, // PABX/SIP typically has no setup fee
                            taxaInstalacao: pabxResult?.setup || 0
                        };

                        return (
                            <div className="space-y-6">
                                <DRETable
                                    monthlyRevenue={dreMonthlyRevenue}
                                    totalCosts={custosDespesas} // Agora apenas Custo/Desp (10%)
                                    commissionVendedor={vendedorRate}
                                    commissionDiretor={diretorRate}
                                    commissionParceiro={parceiroRate}
                                    pabxResult={pabxResult}
                                    sipResult={sipResult}
                                    contractDuration={months}
                                    hasPartners={temParceiros}
                                />

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
                                                        <span className="text-gray-300">Custo/Desp (10%):</span>
                                                        <span className="text-red-300 font-semibold">{formatCurrency(dreCalculations.custoServico)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-300">
                                                            {(includeParceiroIndicador || includeInfluencerPartner) ? 'Comissão Canal/Vendedor:' : 'Comissão Vendedor:'}
                                                        </span>
                                                        <span className="text-red-300 font-semibold">{formatCurrency(dreCalculations.comissaoVendedor)}</span>
                                                    </div>
                                                    {includeParceiroIndicador && (
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-gray-300">Comissão Parceiro Indicador:</span>
                                                            <span className="text-red-300 font-semibold">{formatCurrency(dreCalculations.comissaoParceiroIndicador)}</span>
                                                        </div>
                                                    )}
                                                    {includeInfluencerPartner && (
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-gray-300">Comissão Parceiro Influenciador:</span>
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
                                                            {dreCalculations.paybackMeses > 0 ? `${dreCalculations.paybackMeses}m` : 'N/A'}
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
                            </div>
                        );
                    })()}
                </TabsContent>
                )}

                {canEditCommissions && (
                <TabsContent value="list-price">
                    <div className="mt-6 space-y-6">
                        {/* Tabela de Preços Agente IA */}
                        <Card className="bg-slate-900/80 border-slate-800 text-white">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-blue-400">Agente de IA</CardTitle>
                                </div>
                                <Button
                                    variant={isEditingAI ? "secondary" : "outline"}
                                    size="sm"
                                    onClick={() => setIsEditingAI(!isEditingAI)}
                                    className="border-slate-600"
                                >
                                    {isEditingAI ? "Salvar" : "Editar"}
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                                    {Object.entries(aiAgentPrices).map(([plan, data]) => (
                                        <div key={plan} className="bg-gradient-to-b from-blue-900/30 to-cyan-900/30 rounded-lg p-4 border border-slate-700">
                                            <div className="text-center mb-4">
                                                <div className="w-16 h-16 mx-auto bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-lg mb-2">
                                                    {plan}
                                                </div>
                                                <p className="text-xs text-slate-400">{data?.credits?.toLocaleString?.() ?? '0'} Créditos de Interação</p>
                                            </div>

                                            <div className="space-y-2 text-xs text-slate-300 mb-4">
                                                <p><strong>Tenha até:</strong></p>
                                                <p>{(data.messages / 1000).toFixed(0)}.000 mensagens* ou</p>
                                                <p>{(data.minutes / 1000).toFixed(0)}.000 minutos** ou</p>
                                                <p>{(data.premium / 1000).toFixed(0)}.000 voz premium*** ou</p>
                                                <p className="text-slate-500">Opções acima combinadas</p>
                                            </div>

                                            <div className="text-center">
                                                {isEditingAI ? (
                                                    <Input
                                                        type="number"
                                                        value={data.price}
                                                        onChange={(e) => {
                                                            const newPrice = parseFloat(e.target.value) || 0;
                                                            setAiAgentPrices(prev => ({
                                                                ...prev,
                                                                [plan]: { ...(prev as any)[plan], price: newPrice }
                                                            }));
                                                        }}
                                                    />
                                                ) : (
                                                    <p className="text-2xl font-bold">{formatCurrency(data.price)}</p>
                                                )}
                                                <p className="text-xs text-slate-500">por mês</p>
                                            </div>

                                            <div className="text-xs text-slate-400 mt-4 space-y-1">
                                                <p>* 1 crédito por mensagem</p>
                                                <p>** 10 créditos por minuto</p>
                                                <p>*** 20 créditos por minuto (voz premium)</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Tabela de Preços SIP TRUNK */}
                        <Card className="bg-slate-900/80 border-slate-800 text-white">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="text-blue-400">SIP TRUNK | Planos e preços</CardTitle>
                                <Button
                                    variant={isEditingSIP ? "secondary" : "outline"}
                                    size="sm"
                                    onClick={isEditingSIP ? () => {
                                        if (currentProposal?.id) {
                                            handleSave(currentProposal.id, true); // Salvar como nova versão
                                        }
                                    } : () => setIsEditingSIP(true)}
                                    className="border-slate-600"
                                >
                                    {isEditingSIP ? "Salvar" : "Editar"}
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-slate-700">
                                                <TableHead rowSpan={3} className="text-white bg-blue-900 text-center align-middle">SIP TRUNK</TableHead>
                                                <TableHead colSpan={6} className="text-white bg-blue-800 text-center">SIP TARIFADO</TableHead>
                                                <TableHead colSpan={5} className="text-white bg-blue-700 text-center">SIP ILIMITADO</TableHead>
                                            </TableRow>
                                            <TableRow className="border-slate-700">
                                                <TableHead className="text-white bg-blue-800 text-center">Call Center</TableHead>
                                                <TableHead className="text-white bg-blue-800 text-center">2</TableHead>
                                                <TableHead className="text-white bg-blue-800 text-center">4</TableHead>
                                                <TableHead className="text-white bg-blue-800 text-center">10</TableHead>
                                                <TableHead className="text-white bg-blue-800 text-center">30</TableHead>
                                                <TableHead className="text-white bg-blue-800 text-center">60</TableHead>
                                                <TableHead className="text-white bg-blue-700 text-center">5</TableHead>
                                                <TableHead className="text-white bg-blue-700 text-center">10</TableHead>
                                                <TableHead className="text-white bg-blue-700 text-center">20</TableHead>
                                                <TableHead className="text-white bg-blue-700 text-center">30</TableHead>
                                                <TableHead className="text-white bg-blue-700 text-center">60</TableHead>
                                            </TableRow>
                                            <TableRow className="border-slate-700">
                                                <TableHead className="text-white bg-blue-800 text-center text-xs">2 Canais</TableHead>
                                                <TableHead className="text-white bg-blue-800 text-center text-xs">2 Canais</TableHead>
                                                <TableHead className="text-white bg-blue-800 text-center text-xs">4 Canais</TableHead>
                                                <TableHead className="text-white bg-blue-800 text-center text-xs">10 Canais</TableHead>
                                                <TableHead className="text-white bg-blue-800 text-center text-xs">30 Canais</TableHead>
                                                <TableHead className="text-white bg-blue-800 text-center text-xs">60 Canais</TableHead>
                                                <TableHead className="text-white bg-blue-700 text-center text-xs">5 Canais</TableHead>
                                                <TableHead className="text-white bg-blue-700 text-center text-xs">10 Canais</TableHead>
                                                <TableHead className="text-white bg-blue-700 text-center text-xs">20 Canais</TableHead>
                                                <TableHead className="text-white bg-blue-700 text-center text-xs">30 Canais</TableHead>
                                                <TableHead className="text-white bg-blue-700 text-center text-xs">60 Canais</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {/* Canais Adicionais - Assinatura */}
                                            <TableRow className="border-slate-800">
                                                <TableCell className="font-semibold bg-blue-900/30">Canais Adicionais (Assinatura Mensal)</TableCell>
                                                <TableCell className="text-center bg-blue-800/20">Não Aplicável</TableCell>
                                                <TableCell className="text-center" colSpan={5}>Não Aplicável</TableCell>
                                                {Object.entries(sipConfig.additionalChannels.assinatura).map(([plan, data]) => (
                                                    <TableCell key={`assinatura-${plan}`} className="text-center bg-blue-600/20">
                                                        {isEditingSIP ? (
                                                            <div className="space-y-1">
                                                                <Input type="number" step="1" value={data.max} onChange={(e) => setSipConfig(prev => ({ ...prev, additionalChannels: { ...prev.additionalChannels, assinatura: { ...prev.additionalChannels.assinatura, [plan]: { ...(prev.additionalChannels.assinatura as any)[plan], max: parseFloat(e.target.value) || 0 } } } }))} className="bg-slate-800 text-center text-xs" placeholder="Canais" />
                                                                <Input type="number" step="0.01" value={data.price} onChange={(e) => setSipConfig(prev => ({ ...prev, additionalChannels: { ...prev.additionalChannels, assinatura: { ...prev.additionalChannels.assinatura, [plan]: { ...(prev.additionalChannels.assinatura as any)[plan], price: parseFloat(e.target.value) || 0 } } } }))} className="bg-slate-800 text-center text-xs" placeholder="Preço" />
                                                            </div>
                                                        ) : (
                                                            `Até ${data.max} canais<br/>${formatCurrency(data.price)} por canal adicional`
                                                        )}
                                                    </TableCell>
                                                ))}
                                                <TableCell className="text-center bg-blue-600/20">Sem possibilidade</TableCell>
                                            </TableRow>

                                            {/* Canais Adicionais - Franquia */}
                                            <TableRow className="border-slate-800">
                                                <TableCell className="font-semibold bg-blue-900/30">Canais Adicionais (Franquia Mensal)</TableCell>
                                                <TableCell className="text-center bg-blue-800/20">Não Aplicável</TableCell>
                                                {Object.entries(sipConfig.additionalChannels.franquia).map(([plan, data]) => (
                                                    <TableCell key={`franquia-${plan}`} className="text-center">
                                                        {isEditingSIP ? (
                                                            <div className="space-y-1">
                                                                <Input type="number" step="1" value={data.max} onChange={(e) => setSipConfig(prev => ({ ...prev, additionalChannels: { ...prev.additionalChannels, franquia: { ...prev.additionalChannels.franquia, [plan]: { ...(prev.additionalChannels.franquia as any)[plan], max: parseFloat(e.target.value) || 0 } } } }))} className="bg-slate-800 text-center text-xs" placeholder="Canais" />
                                                                <Input type="number" step="0.01" value={data.price} onChange={(e) => setSipConfig(prev => ({ ...prev, additionalChannels: { ...prev.additionalChannels, franquia: { ...prev.additionalChannels.franquia, [plan]: { ...(prev.additionalChannels.franquia as any)[plan], price: parseFloat(e.target.value) || 0 } } } }))} className="bg-slate-800 text-center text-xs" placeholder="Preço" />
                                                            </div>
                                                        ) : (
                                                            `Até ${data.max} canais<br/>${formatCurrency(data.price)} por canal adicional/mês`
                                                        )}
                                                    </TableCell>
                                                ))}
                                                <TableCell className="text-center" colSpan={4}>Sem possibilidade</TableCell>
                                            </TableRow>
                                            <TableRow className="border-slate-800">
                                                <TableCell className="font-semibold bg-blue-900/30">Franquia/Assinatura Mensal (Sem Equipamentos)</TableCell>
                                                {Object.keys(sipPrices).map(planKey => (
                                                    <TableCell key={planKey} className="text-center">
                                                        {isEditingSIP ? (
                                                            <Input
                                                                className="bg-slate-800 text-center"
                                                                value={sipPrices[planKey as keyof typeof sipPrices].monthly}
                                                                onChange={(e) => {
                                                                    const newSipPrices = { ...sipPrices };
                                                                    newSipPrices[planKey as keyof typeof sipPrices].monthly = Number(e.target.value);
                                                                    setSipPrices(newSipPrices);
                                                                }}
                                                            />
                                                        ) : (
                                                            <>{formatCurrency(sipPrices[planKey as keyof typeof sipPrices].monthly)}<br />({planKey.includes('TARIFADO') ? 'Franquia' : 'Assinatura'})</>
                                                        )}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                            <TableRow className="border-slate-800">
                                                <TableCell className="font-semibold bg-blue-900/30">Franquia/Assinatura Mensal (Com Equipamentos)</TableCell>
                                                {Object.keys(sipPrices).map(planKey => {
                                                    const plan = sipPrices[planKey as keyof typeof sipPrices];
                                                    const value = plan.monthlyWithEquipment;

                                                    if (isEditingSIP) {
                                                        return (
                                                            <TableCell key={planKey} className="text-center">
                                                                <Input
                                                                    className="bg-slate-800 text-center"
                                                                    value={value === null ? 'Não Aplicável' : value}
                                                                    disabled={value === null}
                                                                    onChange={(e) => {
                                                                        const newSipPrices = { ...sipPrices };
                                                                        newSipPrices[planKey as keyof typeof sipPrices].monthlyWithEquipment = Number(e.target.value);
                                                                        setSipPrices(newSipPrices);
                                                                    }}
                                                                />
                                                            </TableCell>
                                                        );
                                                    }

                                                    return (
                                                        <TableCell key={planKey} className="text-center">
                                                            {value === null ? 'Não Aplicável' : <>{formatCurrency(value)}<br />({planKey.includes('TARIFADO') ? 'Franquia' : 'Assinatura'})</>}
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                            {/* Minutos Inclusos */}
                                            <TableRow className="border-slate-800">
                                                <TableCell className="font-semibold bg-blue-900/30">Minutos Mensais Inclusos para Brasil Móvel</TableCell>
                                                <TableCell className="text-center bg-blue-800/20">Não Aplicável</TableCell>
                                                <TableCell className="text-center" colSpan={4}>Não aplicável</TableCell>
                                                {Object.entries(sipConfig.includedMinutes).map(([plan, minutes]) => (
                                                    <TableCell key={`minutes-${plan}`} className="text-center">
                                                        {isEditingSIP ? (
                                                            <Input type="number" step="1" value={minutes} onChange={(e) => setSipConfig(prev => ({ ...prev, includedMinutes: { ...prev.includedMinutes, [plan]: parseFloat(e.target.value) || 0 } }))} className="bg-slate-800 text-center" />
                                                        ) : (
                                                            <div dangerouslySetInnerHTML={{ __html: `${minutes?.toLocaleString?.() ?? '0'}<br/>Minutos` }} />
                                                        )}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                            {/* Números Incluídos */}
                                            <TableRow className="border-slate-800">
                                                <TableCell className="font-semibold bg-blue-900/30">Números Incluídos (Novos ou Portados)</TableCell>
                                                <TableCell className="text-center">{isEditingSIP ? <Input value={sipConfig.includedNumbers.callCenter} onChange={(e) => setSipConfig(prev => ({ ...prev, includedNumbers: { ...prev.includedNumbers, callCenter: e.target.value } }))} className="bg-slate-800 text-center" /> : sipConfig.includedNumbers.callCenter}</TableCell>
                                                {Object.entries(sipConfig.includedNumbers.tarifado).map(([plan, text]) => (
                                                    <TableCell key={`tarifado-num-${plan}`} className="text-center">{isEditingSIP ? <Input value={text} onChange={(e) => setSipConfig(prev => ({ ...prev, includedNumbers: { ...prev.includedNumbers, tarifado: { ...prev.includedNumbers.tarifado, [plan]: e.target.value } } }))} className="bg-slate-800 text-center" /> : text}</TableCell>
                                                ))}
                                                <TableCell className="text-center">Sem possibilidade</TableCell>{/* Coluna 60 canais tarifado */}
                                                {Object.entries(sipConfig.includedNumbers.ilimitado).map(([plan, text]) => (
                                                    <TableCell key={`ilimitado-num-${plan}`} className="text-center">{isEditingSIP ? <Input value={text} onChange={(e) => setSipConfig(prev => ({ ...prev, includedNumbers: { ...prev.includedNumbers, ilimitado: { ...prev.includedNumbers.ilimitado, [plan]: e.target.value } } }))} className="bg-slate-800 text-center" /> : text}</TableCell>
                                                ))}
                                            </TableRow>
                                            {/* Numeração Adicional */}
                                            <TableRow className="border-slate-800">
                                                <TableCell className="font-semibold bg-blue-900/30">Numeração Adicional (Mensalidade)</TableCell>
                                                <TableCell className="text-center">Consultar</TableCell>
                                                <TableCell colSpan={10} className="text-center">
                                                    {isEditingSIP ? (
                                                        <Input type="number" step="0.01" value={sipConfig.additionalNumberPrice} onChange={(e) => setSipConfig(prev => ({ ...prev, additionalNumberPrice: parseFloat(e.target.value) || 0 }))} className="bg-slate-800 text-center w-40 mx-auto" />
                                                    ) : (
                                                        `${formatCurrency(sipConfig.additionalNumberPrice)} por Número`
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                            {/* Tarifas */}
                                            <TableRow className="border-slate-800">
                                                <TableCell className="font-semibold bg-blue-900/30">Tarifa Local Fixo (por minuto)</TableCell>
                                                <TableCell className="text-center">{isEditingSIP ? <Input type="number" step="0.01" value={sipConfig.tariffs.localFixo.callCenter} onChange={(e) => setSipConfig(prev => ({ ...prev, tariffs: { ...prev.tariffs, localFixo: { ...prev.tariffs.localFixo, callCenter: parseFloat(e.target.value) || 0 } } }))} className="bg-slate-800 text-center" /> : `${formatCurrency(sipConfig.tariffs.localFixo.callCenter)}<br/>por minuto`}</TableCell>
                                                <TableCell colSpan={5} className="text-center">{isEditingSIP ? <Input type="number" step="0.01" value={sipConfig.tariffs.localFixo.tarifado} onChange={(e) => setSipConfig(prev => ({ ...prev, tariffs: { ...prev.tariffs, localFixo: { ...prev.tariffs.localFixo, tarifado: parseFloat(e.target.value) || 0 } } }))} className="bg-slate-800 text-center" /> : `${formatCurrency(sipConfig.tariffs.localFixo.tarifado)} por minuto`}</TableCell>
                                                <TableCell colSpan={5} className="text-center">Ilimitado</TableCell>
                                            </TableRow>
                                            <TableRow className="border-slate-800">
                                                <TableCell className="font-semibold bg-blue-900/30">Tarifa DDD Fixo (por minuto)</TableCell>
                                                <TableCell className="text-center">{isEditingSIP ? <Input type="number" step="0.01" value={sipConfig.tariffs.dddFixo.callCenter} onChange={(e) => setSipConfig(prev => ({ ...prev, tariffs: { ...prev.tariffs, dddFixo: { ...prev.tariffs.dddFixo, callCenter: parseFloat(e.target.value) || 0 } } }))} className="bg-slate-800 text-center" /> : `${formatCurrency(sipConfig.tariffs.dddFixo.callCenter)}<br/>por minuto`}</TableCell>
                                                <TableCell colSpan={5} className="text-center">{isEditingSIP ? <Input type="number" step="0.01" value={sipConfig.tariffs.dddFixo.tarifado} onChange={(e) => setSipConfig(prev => ({ ...prev, tariffs: { ...prev.tariffs, dddFixo: { ...prev.tariffs.dddFixo, tarifado: parseFloat(e.target.value) || 0 } } }))} className="bg-slate-800 text-center" /> : `${formatCurrency(sipConfig.tariffs.dddFixo.tarifado)} por minuto`}</TableCell>
                                                <TableCell colSpan={5} className="text-center">Ilimitado</TableCell>
                                            </TableRow>
                                            <TableRow className="border-slate-800">
                                                <TableCell className="font-semibold bg-blue-900/30">Tarifa Brasil Móvel (por minuto)</TableCell>
                                                <TableCell className="text-center">{isEditingSIP ? <Input type="number" step="0.01" value={sipConfig.tariffs.brasilMovel.callCenter} onChange={(e) => setSipConfig(prev => ({ ...prev, tariffs: { ...prev.tariffs, brasilMovel: { ...prev.tariffs.brasilMovel, callCenter: parseFloat(e.target.value) || 0 } } }))} className="bg-slate-800 text-center" /> : `${formatCurrency(sipConfig.tariffs.brasilMovel.callCenter)}<br/>por minuto`}</TableCell>
                                                <TableCell colSpan={10} className="text-center">{isEditingSIP ? <Input type="number" step="0.01" value={sipConfig.tariffs.brasilMovel.default} onChange={(e) => setSipConfig(prev => ({ ...prev, tariffs: { ...prev.tariffs, brasilMovel: { ...prev.tariffs.brasilMovel, default: parseFloat(e.target.value) || 0 } } }))} className="bg-slate-800 text-center" /> : `${formatCurrency(sipConfig.tariffs.brasilMovel.default)} por minuto`}</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Tabela de Preços PABX */}
                        <Card className="bg-slate-900/80 border-slate-800 text-white">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="text-green-400">PABX Standard</CardTitle>
                                <Button
                                    variant={isEditingPABX ? "secondary" : "outline"}
                                    size="sm"
                                    onClick={isEditingPABX ? handleSavePABXStandardPrices : () => setIsEditingPABX(true)}
                                    className="border-slate-600"
                                >
                                    {isEditingPABX ? "Salvar" : "Editar"}
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-slate-700">
                                                <TableHead className="text-white bg-green-800">Serviço</TableHead>
                                                <TableHead className="text-white bg-yellow-600 text-center">Até 10 ramais</TableHead>
                                                <TableHead className="text-white bg-yellow-600 text-center">De 11 a 20 ramais</TableHead>
                                                <TableHead className="text-white bg-yellow-600 text-center">De 21 a 30 ramais</TableHead>
                                                <TableHead className="text-white bg-yellow-600 text-center">De 31 a 50 ramais</TableHead>
                                                <TableHead className="text-white bg-yellow-600 text-center">De 51 a 100 ramais</TableHead>
                                                <TableHead className="text-white bg-yellow-600 text-center">De 101 a 500 ramais</TableHead>
                                                <TableHead className="text-white bg-yellow-600 text-center">De 501 a 1.000 ramais</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            <TableRow className="border-slate-800">
                                                <TableCell className="font-semibold bg-green-900/30">Setup (cobrança única)</TableCell>
                                                {isEditingPABX ? (
                                                    <>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.setup['10']} onChange={(e) => setPabxPrices(prev => ({ ...prev, setup: { ...prev.setup, '10': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.setup['20']} onChange={(e) => setPabxPrices(prev => ({ ...prev, setup: { ...prev.setup, '20': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.setup['30']} onChange={(e) => setPabxPrices(prev => ({ ...prev, setup: { ...prev.setup, '30': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.setup['50']} onChange={(e) => setPabxPrices(prev => ({ ...prev, setup: { ...prev.setup, '50': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.setup['100']} onChange={(e) => setPabxPrices(prev => ({ ...prev, setup: { ...prev.setup, '100': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.setup['500']} onChange={(e) => setPabxPrices(prev => ({ ...prev, setup: { ...prev.setup, '500': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.setup['1000']} onChange={(e) => setPabxPrices(prev => ({ ...prev, setup: { ...prev.setup, '1000': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                    </>
                                                ) : (
                                                    <>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.setup['10'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.setup['20'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.setup['30'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.setup['50'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.setup['100'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.setup['500'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.setup['1000'])}</TableCell>
                                                    </>
                                                )}
                                            </TableRow>
                                            <TableRow className="border-slate-800">
                                                <TableCell className="font-semibold bg-green-900/30">Valor por ramal (mensal unitário)</TableCell>
                                                {isEditingPABX ? (
                                                    <>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.monthly['10']} onChange={(e) => setPabxPrices(prev => ({ ...prev, monthly: { ...prev.monthly, '10': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.monthly['20']} onChange={(e) => setPabxPrices(prev => ({ ...prev, monthly: { ...prev.monthly, '20': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.monthly['30']} onChange={(e) => setPabxPrices(prev => ({ ...prev, monthly: { ...prev.monthly, '30': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.monthly['50']} onChange={(e) => setPabxPrices(prev => ({ ...prev, monthly: { ...prev.monthly, '50': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.monthly['100']} onChange={(e) => setPabxPrices(prev => ({ ...prev, monthly: { ...prev.monthly, '100': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.monthly['500']} onChange={(e) => setPabxPrices(prev => ({ ...prev, monthly: { ...prev.monthly, '500': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.monthly['1000']} onChange={(e) => setPabxPrices(prev => ({ ...prev, monthly: { ...prev.monthly, '1000': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                    </>
                                                ) : (
                                                    <>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.monthly['10'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.monthly['20'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.monthly['30'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.monthly['50'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.monthly['100'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.monthly['500'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.monthly['1000'])}</TableCell>
                                                    </>
                                                )}
                                            </TableRow>
                                            <TableRow className="border-slate-800">
                                                <TableCell className="font-semibold bg-green-900/30">Valor hospedagem (mensal)</TableCell>
                                                {isEditingPABX ? (
                                                    <>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.hosting['10']} onChange={(e) => setPabxPrices(prev => ({ ...prev, hosting: { ...prev.hosting, '10': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.hosting['20']} onChange={(e) => setPabxPrices(prev => ({ ...prev, hosting: { ...prev.hosting, '20': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.hosting['30']} onChange={(e) => setPabxPrices(prev => ({ ...prev, hosting: { ...prev.hosting, '30': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.hosting['50']} onChange={(e) => setPabxPrices(prev => ({ ...prev, hosting: { ...prev.hosting, '50': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.hosting['100']} onChange={(e) => setPabxPrices(prev => ({ ...prev, hosting: { ...prev.hosting, '100': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.hosting['500']} onChange={(e) => setPabxPrices(prev => ({ ...prev, hosting: { ...prev.hosting, '500': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.hosting['1000']} onChange={(e) => setPabxPrices(prev => ({ ...prev, hosting: { ...prev.hosting, '1000': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                    </>
                                                ) : (
                                                    <>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.hosting['10'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.hosting['20'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.hosting['30'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.hosting['50'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.hosting['100'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.hosting['500'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.hosting['1000'])}</TableCell>
                                                    </>
                                                )}
                                            </TableRow>
                                            <TableRow className="border-slate-800">
                                                <TableCell className="font-semibold bg-green-900/30">Aluguel Aparelho Grandstream (mensal)</TableCell>
                                                {isEditingPABX ? (
                                                    <>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.device['10']} onChange={(e) => setPabxPrices(prev => ({ ...prev, device: { ...prev.device, '10': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.device['20']} onChange={(e) => setPabxPrices(prev => ({ ...prev, device: { ...prev.device, '20': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.device['30']} onChange={(e) => setPabxPrices(prev => ({ ...prev, device: { ...prev.device, '30': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.device['50']} onChange={(e) => setPabxPrices(prev => ({ ...prev, device: { ...prev.device, '50': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.device['100']} onChange={(e) => setPabxPrices(prev => ({ ...prev, device: { ...prev.device, '100': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.device['500']} onChange={(e) => setPabxPrices(prev => ({ ...prev, device: { ...prev.device, '500': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                        <TableCell><Input className="bg-slate-800 text-center" value={pabxPrices.device['1000']} onChange={(e) => setPabxPrices(prev => ({ ...prev, device: { ...prev.device, '1000': parseFloat(e.target.value) || 0 } }))} /></TableCell>
                                                    </>
                                                ) : (
                                                    <>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.device['10'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.device['20'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.device['30'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.device['50'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.device['100'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.device['500'])}</TableCell>
                                                        <TableCell className="text-center">{formatCurrency(pabxPrices.device['1000'])}</TableCell>
                                                    </>
                                                )}
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Tabela de Preços PABX Premium */}
                        <Card className="bg-slate-900/80 border-slate-800 text-white">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="text-green-400">PABX Premium</CardTitle>
                                <Button
                                    variant={isEditingPABXPremium24 ? "secondary" : "outline"}
                                    size="sm"
                                    onClick={isEditingPABXPremium24 ? handleSavePABXPrices : () => {
                                        setEditedValues({});
                                        setIsEditingPABXPremium24(true);
                                    }}
                                    className="border-slate-600"
                                >
                                    {isEditingPABXPremium24 ? "Salvar" : "Editar"}
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <Table>
                                        {/* ESSENCIAL 24 MESES - ILIMITADO */}
                                        <TableHeader>
                                            <TableRow className="border-slate-700">
                                                <TableHead className="text-white bg-blue-700 text-center" rowSpan={3}>ESSENCIAL - 24 MESES</TableHead>
                                                <TableHead className="text-white bg-blue-600 text-center" colSpan={2}>Ilimitado</TableHead>
                                            </TableRow>
                                            <TableRow className="border-slate-700">
                                                <TableHead className="text-white bg-blue-600 text-center">Valores com Equipamento (Aluguel + Assinatura)</TableHead>
                                                <TableHead className="text-white bg-blue-500 text-center">Valores sem Equipamento (Assinatura)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pabxPremiumPrices['24'].essencial.ilimitado.map((item, index) => (
                                                <TableRow key={`essencial-ilimitado-24-${index}`} className="border-slate-800">
                                                    <TableCell>{item.range}</TableCell>
                                                    <TableCell className="text-center">
                                                        {isEditingPABXPremium24 ? (
                                                            <input
                                                                type="number"
                                                                value={editedValues[`24-essencial-ilimitado-${index}-comEquipamento`] ?? item.comEquipamento}
                                                                onChange={(e) => handleInputChange('24', 'essencial', 'ilimitado', index, 'comEquipamento', e.target.value)}
                                                                className="w-24 p-1 text-center text-black rounded"
                                                            />
                                                        ) : (
                                                            formatCurrency(item.comEquipamento)
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {isEditingPABXPremium24 ? (
                                                            <input
                                                                type="number"
                                                                value={editedValues[`24-essencial-ilimitado-${index}-semEquipamento`] ?? item.semEquipamento}
                                                                onChange={(e) => handleInputChange('24', 'essencial', 'ilimitado', index, 'semEquipamento', e.target.value)}
                                                                className="w-24 p-1 text-center text-black rounded"
                                                            />
                                                        ) : (
                                                            formatCurrency(item.semEquipamento)
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>

                                        {/* ESSENCIAL 24 MESES - TARIFADO */}
                                        <TableHeader>
                                            <TableRow className="border-slate-700">
                                                <TableHead className="text-white bg-blue-700 text-center" rowSpan={3}>ESSENCIAL - 24 MESES</TableHead>
                                                <TableHead className="text-white bg-blue-600 text-center" colSpan={2}>Tarifado</TableHead>
                                            </TableRow>
                                            <TableRow className="border-slate-700">
                                                <TableHead className="text-white bg-blue-600 text-center">Valores com Equipamento (Aluguel + Franquia)</TableHead>
                                                <TableHead className="text-white bg-blue-500 text-center">Valores sem Equipamento (Assinatura + Franquia)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pabxPremiumPrices['24'].essencial.tarifado.map((item, index) => (
                                                <TableRow key={`essencial-tarifado-24-${index}`} className="border-slate-800">
                                                    <TableCell>{item.range}</TableCell>
                                                    <TableCell className="text-center">
                                                        {isEditingPABXPremium24 ? (
                                                            <input
                                                                type="number"
                                                                value={editedValues[`24-essencial-tarifado-${index}-comEquipamento`] ?? item.comEquipamento}
                                                                onChange={(e) => handleInputChange('24', 'essencial', 'tarifado', index, 'comEquipamento', e.target.value)}
                                                                className="w-24 p-1 text-center text-black rounded"
                                                            />
                                                        ) : (
                                                            formatCurrency(item.comEquipamento)
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {isEditingPABXPremium24 ? (
                                                            <input
                                                                type="number"
                                                                value={editedValues[`24-essencial-tarifado-${index}-semEquipamento`] ?? item.semEquipamento}
                                                                onChange={(e) => handleInputChange('24', 'essencial', 'tarifado', index, 'semEquipamento', e.target.value)}
                                                                className="w-24 p-1 text-center text-black rounded"
                                                            />
                                                        ) : (
                                                            formatCurrency(item.semEquipamento)
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>

                                        {/* PROFISSIONAL 24 MESES - ILIMITADO */}
                                        <TableHeader>
                                            <TableRow className="border-slate-700">
                                                <TableHead className="text-white bg-blue-700 text-center" rowSpan={3}>PROFISSIONAL - 24 MESES</TableHead>
                                                <TableHead className="text-white bg-blue-600 text-center" colSpan={2}>Ilimitado</TableHead>
                                            </TableRow>
                                            <TableRow className="border-slate-700">
                                                <TableHead className="text-white bg-blue-600 text-center">Valores com Equipamento (Aluguel + Assinatura)</TableHead>
                                                <TableHead className="text-white bg-blue-500 text-center">Valores sem Equipamento (Assinatura)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pabxPremiumPrices['24'].profissional.ilimitado.map((item, index) => (
                                                <TableRow key={`profissional-ilimitado-24-${index}`} className="border-slate-800">
                                                    <TableCell>{item.range}</TableCell>
                                                    <TableCell className="text-center">
                                                        {isEditingPABXPremium24 ? (
                                                            <input
                                                                type="number"
                                                                value={editedValues[`24-profissional-ilimitado-${index}-comEquipamento`] ?? item.comEquipamento}
                                                                onChange={(e) => handleInputChange('24', 'profissional', 'ilimitado', index, 'comEquipamento', e.target.value)}
                                                                className="w-24 p-1 text-center text-black rounded"
                                                            />
                                                        ) : (
                                                            formatCurrency(item.comEquipamento)
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {isEditingPABXPremium24 ? (
                                                            <input
                                                                type="number"
                                                                value={editedValues[`24-profissional-ilimitado-${index}-semEquipamento`] ?? item.semEquipamento}
                                                                onChange={(e) => handleInputChange('24', 'profissional', 'ilimitado', index, 'semEquipamento', e.target.value)}
                                                                className="w-24 p-1 text-center text-black rounded"
                                                            />
                                                        ) : (
                                                            formatCurrency(item.semEquipamento)
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>

                                        {/* PROFISSIONAL 24 MESES - TARIFADO */}
                                        <TableHeader>
                                            <TableRow className="border-slate-700">
                                                <TableHead className="text-white bg-blue-700 text-center" rowSpan={3}>PROFISSIONAL - 24 MESES</TableHead>
                                                <TableHead className="text-white bg-blue-600 text-center" colSpan={2}>Tarifado</TableHead>
                                            </TableRow>
                                            <TableRow className="border-slate-700">
                                                <TableHead className="text-white bg-blue-600 text-center">Valores com Equipamento (Aluguel + Franquia)</TableHead>
                                                <TableHead className="text-white bg-blue-500 text-center">Valores sem Equipamento (Assinatura + Franquia)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pabxPremiumPrices['24'].profissional.tarifado.map((item, index) => (
                                                <TableRow key={`profissional-tarifado-24-${index}`} className="border-slate-800">
                                                    <TableCell>{item.range}</TableCell>
                                                    <TableCell className="text-center">
                                                        {isEditingPABXPremium24 ? (
                                                            <input
                                                                type="number"
                                                                value={editedValues[`24-profissional-tarifado-${index}-comEquipamento`] ?? item.comEquipamento}
                                                                onChange={(e) => handleInputChange('24', 'profissional', 'tarifado', index, 'comEquipamento', e.target.value)}
                                                                className="w-24 p-1 text-center text-black rounded"
                                                            />
                                                        ) : (
                                                            formatCurrency(item.comEquipamento)
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {isEditingPABXPremium24 ? (
                                                            <input
                                                                type="number"
                                                                value={editedValues[`24-profissional-tarifado-${index}-semEquipamento`] ?? item.semEquipamento}
                                                                onChange={(e) => handleInputChange('24', 'profissional', 'tarifado', index, 'semEquipamento', e.target.value)}
                                                                className="w-24 p-1 text-center text-black rounded"
                                                            />
                                                        ) : (
                                                            formatCurrency(item.semEquipamento)
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>

                                        {/* ESSENCIAL 36 MESES - ILIMITADO */}
                                        <TableHeader>
                                            <TableRow className="border-slate-700">
                                                <TableHead className="text-white bg-blue-700 text-center" rowSpan={3}>ESSENCIAL - 36 MESES</TableHead>
                                                <TableHead className="text-white bg-blue-600 text-center" colSpan={2}>Ilimitado</TableHead>
                                            </TableRow>
                                            <TableRow className="border-slate-700">
                                                <TableHead className="text-white bg-blue-600 text-center">Valores com Equipamento (Aluguel + Assinatura)</TableHead>
                                                <TableHead className="text-white bg-blue-500 text-center">Valores sem Equipamento (Assinatura)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pabxPremiumPrices['36'].essencial.ilimitado.map((item, index) => (
                                                <TableRow key={`essencial-ilimitado-36-${index}`} className="border-slate-800">
                                                    <TableCell>{item.range}</TableCell>
                                                    <TableCell className="text-center">
                                                        {isEditingPABXPremium24 ? (
                                                            <input
                                                                type="number"
                                                                value={editedValues[`36-essencial-ilimitado-${index}-comEquipamento`] ?? item.comEquipamento}
                                                                onChange={(e) => handleInputChange('36', 'essencial', 'ilimitado', index, 'comEquipamento', e.target.value)}
                                                                className="w-24 p-1 text-center text-black rounded"
                                                            />
                                                        ) : (
                                                            formatCurrency(item.comEquipamento)
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {isEditingPABXPremium24 ? (
                                                            <input
                                                                type="number"
                                                                value={editedValues[`36-essencial-ilimitado-${index}-semEquipamento`] ?? item.semEquipamento}
                                                                onChange={(e) => handleInputChange('36', 'essencial', 'ilimitado', index, 'semEquipamento', e.target.value)}
                                                                className="w-24 p-1 text-center text-black rounded"
                                                            />
                                                        ) : (
                                                            formatCurrency(item.semEquipamento)
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>

                                        {/* ESSENCIAL 36 MESES - TARIFADO */}
                                        <TableHeader>
                                            <TableRow className="border-slate-700">
                                                <TableHead className="text-white bg-blue-700 text-center" rowSpan={3}>ESSENCIAL - 36 MESES</TableHead>
                                                <TableHead className="text-white bg-blue-600 text-center" colSpan={2}>Tarifado</TableHead>
                                            </TableRow>
                                            <TableRow className="border-slate-700">
                                                <TableHead className="text-white bg-blue-600 text-center">Valores com Equipamento (Aluguel + Franquia)</TableHead>
                                                <TableHead className="text-white bg-blue-500 text-center">Valores sem Equipamento (Assinatura + Franquia)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pabxPremiumPrices['36'].essencial.tarifado.map((item, index) => (
                                                <TableRow key={`essencial-tarifado-36-${index}`} className="border-slate-800">
                                                    <TableCell>{item.range}</TableCell>
                                                    <TableCell className="text-center">
                                                        {isEditingPABXPremium24 ? (
                                                            <input
                                                                type="number"
                                                                value={editedValues[`36-essencial-tarifado-${index}-comEquipamento`] ?? item.comEquipamento}
                                                                onChange={(e) => handleInputChange('36', 'essencial', 'tarifado', index, 'comEquipamento', e.target.value)}
                                                                className="w-24 p-1 text-center text-black rounded"
                                                            />
                                                        ) : (
                                                            formatCurrency(item.comEquipamento)
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {isEditingPABXPremium24 ? (
                                                            <input
                                                                type="number"
                                                                value={editedValues[`36-essencial-tarifado-${index}-semEquipamento`] ?? item.semEquipamento}
                                                                onChange={(e) => handleInputChange('36', 'essencial', 'tarifado', index, 'semEquipamento', e.target.value)}
                                                                className="w-24 p-1 text-center text-black rounded"
                                                            />
                                                        ) : (
                                                            formatCurrency(item.semEquipamento)
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>

                                        {/* PROFISSIONAL 36 MESES - ILIMITADO */}
                                        <TableHeader>
                                            <TableRow className="border-slate-700">
                                                <TableHead className="text-white bg-blue-700 text-center" rowSpan={3}>PROFISSIONAL - 36 MESES</TableHead>
                                                <TableHead className="text-white bg-blue-600 text-center" colSpan={2}>Ilimitado</TableHead>
                                            </TableRow>
                                            <TableRow className="border-slate-700">
                                                <TableHead className="text-white bg-blue-600 text-center">Valores com Equipamento (Aluguel + Assinatura)</TableHead>
                                                <TableHead className="text-white bg-blue-500 text-center">Valores sem Equipamento (Assinatura)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pabxPremiumPrices['36'].profissional.ilimitado.map((item, index) => (
                                                <TableRow key={`profissional-ilimitado-36-${index}`} className="border-slate-800">
                                                    <TableCell>{item.range}</TableCell>
                                                    <TableCell className="text-center">
                                                        {isEditingPABXPremium24 ? (
                                                            <input
                                                                type="number"
                                                                value={editedValues[`36-profissional-ilimitado-${index}-comEquipamento`] ?? item.comEquipamento}
                                                                onChange={(e) => handleInputChange('36', 'profissional', 'ilimitado', index, 'comEquipamento', e.target.value)}
                                                                className="w-24 p-1 text-center text-black rounded"
                                                            />
                                                        ) : (
                                                            formatCurrency(item.comEquipamento)
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {isEditingPABXPremium24 ? (
                                                            <input
                                                                type="number"
                                                                value={editedValues[`36-profissional-ilimitado-${index}-semEquipamento`] ?? item.semEquipamento}
                                                                onChange={(e) => handleInputChange('36', 'profissional', 'ilimitado', index, 'semEquipamento', e.target.value)}
                                                                className="w-24 p-1 text-center text-black rounded"
                                                            />
                                                        ) : (
                                                            formatCurrency(item.semEquipamento)
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>

                                        {/* PROFISSIONAL 36 MESES - TARIFADO */}
                                        <TableHeader>
                                            <TableRow className="border-slate-700">
                                                <TableHead className="text-white bg-blue-700 text-center" rowSpan={3}>PROFISSIONAL - 36 MESES</TableHead>
                                                <TableHead className="text-white bg-blue-600 text-center" colSpan={2}>Tarifado</TableHead>
                                            </TableRow>
                                            <TableRow className="border-slate-700">
                                                <TableHead className="text-white bg-blue-600 text-center">Valores com Equipamento (Aluguel + Franquia)</TableHead>
                                                <TableHead className="text-white bg-blue-500 text-center">Valores sem Equipamento (Assinatura + Franquia)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pabxPremiumPrices['36'].profissional.tarifado.map((item, index) => (
                                                <TableRow key={`profissional-tarifado-36-${index}`} className="border-slate-800">
                                                    <TableCell>{item.range}</TableCell>
                                                    <TableCell className="text-center">
                                                        {isEditingPABXPremium24 ? (
                                                            <input
                                                                type="number"
                                                                value={editedValues[`36-profissional-tarifado-${index}-comEquipamento`] ?? item.comEquipamento}
                                                                onChange={(e) => handleInputChange('36', 'profissional', 'tarifado', index, 'comEquipamento', e.target.value)}
                                                                className="w-24 p-1 text-center text-black rounded"
                                                            />
                                                        ) : (
                                                            formatCurrency(item.comEquipamento)
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {isEditingPABXPremium24 ? (
                                                            <input
                                                                type="number"
                                                                value={editedValues[`36-profissional-tarifado-${index}-semEquipamento`] ?? item.semEquipamento}
                                                                onChange={(e) => handleInputChange('36', 'profissional', 'tarifado', index, 'semEquipamento', e.target.value)}
                                                                className="w-24 p-1 text-center text-black rounded"
                                                            />
                                                        ) : (
                                                            formatCurrency(item.semEquipamento)
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>

                    </div>
                </TabsContent>
                )}


            </Tabs>
        </div>
    );
};

export default PABXSIPCalculator;
