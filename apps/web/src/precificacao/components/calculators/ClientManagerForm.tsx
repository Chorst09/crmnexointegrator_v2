
import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClientData, AccountManagerData } from '@/lib/types'; // Importar tipos centralizados
import { buildApiUrl, getCRMAuthHeaders } from '@/config/api';

type Company = {
    id: string;
    name?: string;
    contacts?: Array<{
        name?: string;
        email?: string;
        phone?: string;
        isPrimary?: boolean;
    }>;
};

interface ClientManagerFormProps {
    clientData: ClientData;
    accountManagerData: AccountManagerData;
    onClientDataChange: (data: ClientData) => void;
    onAccountManagerDataChange: (data: AccountManagerData) => void;
    onBack: () => void;
    onContinue: () => void;
    title?: string;
    subtitle?: string;
}

export function ClientManagerForm({
    clientData,
    accountManagerData,
    onClientDataChange,
    onAccountManagerDataChange,
    onBack,
    onContinue,
    title = "Nova Proposta",
    subtitle = "Preencha os dados do cliente e gerente de contas."
}: ClientManagerFormProps) {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loadingCompanies, setLoadingCompanies] = useState(false);
    const [clientPickerOpen, setClientPickerOpen] = useState(false);

    const handleContinue = () => {
        if (!clientData.name || !clientData.email || !accountManagerData.name || !accountManagerData.email) {
            alert('Preencha os campos obrigatórios marcados com *');
            return;
        }
        onContinue();
    };

    const selectCompany = (company: Company) => {
        const primaryContact = Array.isArray(company.contacts)
            ? company.contacts.find(contact => contact.isPrimary) || company.contacts[0]
            : null;

        onClientDataChange({
            ...clientData,
            name: company.name || clientData.name,
            contact: primaryContact?.name || clientData.contact || '',
            email: primaryContact?.email || clientData.email || '',
            phone: primaryContact?.phone || clientData.phone || ''
        });
        setClientPickerOpen(false);
    };

    const openCompanyRegister = () => {
        const params = new URLSearchParams({
            openForm: '1',
            clientType: 'B2B',
            name: clientData.name || '',
            email: clientData.email || '',
            phone: clientData.phone || '',
            contact: clientData.contact || '',
            returnTo: `${window.location.pathname}${window.location.search}`
        });
        window.location.href = `/empresas?${params.toString()}`;
    };

    const loadCompanies = async () => {
        try {
            setLoadingCompanies(true);
            const response = await fetch(buildApiUrl('/companies?clientType=B2B'), {
                headers: getCRMAuthHeaders()
            });
            if (!response.ok) return;
            const data = await response.json();
            setCompanies(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Erro ao carregar empresas B2B:', error);
        } finally {
            setLoadingCompanies(false);
        }
    };

    useEffect(() => {
        loadCompanies();
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const companyId = params.get('companyId');
        if (!companyId || companies.length === 0) return;

        const company = companies.find(item => item.id === companyId);
        if (!company) return;
        selectCompany(company);
        params.delete('companyId');
        const nextSearch = params.toString();
        window.history.replaceState(null, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`);
    }, [companies]);

    const filteredCompanies = useMemo(() => {
        const term = clientData.name.trim().toLowerCase();
        if (!term) return companies.slice(0, 8);
        return companies
            .filter(company => String(company.name || '').toLowerCase().includes(term))
            .slice(0, 8);
    }, [companies, clientData.name]);

    return (
        <div className="container mx-auto p-6 bg-slate-950 text-white min-h-screen">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
                <p className="text-slate-400">{subtitle}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Dados do Cliente */}
                <Card className="bg-slate-900/80 border-slate-800 text-white">
                    <CardHeader>
                        <CardTitle>Dados do Cliente</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="client-name">Nome do Cliente *</Label>
                            <div className="relative">
                                <Input
                                    id="client-name"
                                    value={clientData.name}
                                    onFocus={() => setClientPickerOpen(true)}
                                    onClick={() => setClientPickerOpen(true)}
                                    onChange={(e) => {
                                        onClientDataChange({ ...clientData, name: e.target.value });
                                        setClientPickerOpen(true);
                                    }}
                                    onBlur={() => window.setTimeout(() => setClientPickerOpen(false), 180)}
                                    className="bg-slate-800 border-slate-700 text-white"
                                    placeholder="Pesquisar ou cadastrar cliente"
                                    required
                                />
                                {clientPickerOpen && (
                                    <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-xl">
                                        <div className="max-h-64 overflow-y-auto py-1">
                                            {loadingCompanies ? (
                                                <div className="px-3 py-2 text-sm text-slate-400">Carregando empresas...</div>
                                            ) : filteredCompanies.length > 0 ? (
                                                filteredCompanies.map(company => {
                                                    const primaryContact = Array.isArray(company.contacts)
                                                        ? company.contacts.find(contact => contact.isPrimary) || company.contacts[0]
                                                        : null;
                                                    return (
                                                        <button
                                                            key={company.id}
                                                            type="button"
                                                            onMouseDown={(event) => event.preventDefault()}
                                                            onClick={() => selectCompany(company)}
                                                            className="block w-full px-3 py-2 text-left hover:bg-slate-800"
                                                        >
                                                            <span className="block text-sm font-semibold text-white">{company.name || 'Empresa sem nome'}</span>
                                                            <span className="block text-xs text-slate-400">
                                                                {[primaryContact?.name, primaryContact?.email, primaryContact?.phone].filter(Boolean).join(' - ') || 'Sem contato cadastrado'}
                                                            </span>
                                                        </button>
                                                    );
                                                })
                                            ) : (
                                                <div className="px-3 py-2 text-sm text-slate-400">Nenhuma empresa encontrada.</div>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={openCompanyRegister}
                                            className="flex w-full items-center justify-between border-t border-slate-700 px-3 py-2 text-left text-sm font-semibold text-blue-300 hover:bg-slate-800"
                                        >
                                            Cadastrar novo cliente em B2B - Empresas
                                            <span>+</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="client-contact">Contato do Cliente</Label>
                            <Input
                                id="client-contact"
                                value={clientData.contact}
                                onChange={(e) => onClientDataChange({ ...clientData, contact: e.target.value })}
                                className="bg-slate-800 border-slate-700 text-white"
                                placeholder="Contato do cliente"
                            />
                        </div>
                        <div>
                            <Label htmlFor="project-name">Nome do Projeto</Label>
                            <Input
                                id="project-name"
                                value={clientData.projectName}
                                onChange={(e) => onClientDataChange({ ...clientData, projectName: e.target.value })}
                                className="bg-slate-800 border-slate-700 text-white"
                                placeholder="Nome do projeto"
                            />
                        </div>
                        <div>
                            <Label htmlFor="client-email">Email do Cliente *</Label>
                            <Input
                                id="client-email"
                                type="email"
                                value={clientData.email}
                                onChange={(e) => onClientDataChange({ ...clientData, email: e.target.value })}
                                className="bg-slate-800 border-slate-700 text-white"
                                placeholder="email@cliente.com"
                                required
                            />
                        </div>
                        <div>
                            <Label htmlFor="client-phone">Telefone do Cliente</Label>
                            <Input
                                id="client-phone"
                                value={clientData.phone}
                                onChange={(e) => onClientDataChange({ ...clientData, phone: e.target.value })}
                                className="bg-slate-800 border-slate-700 text-white"
                                placeholder="(11) 99999-9999"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Dados do Gerente de Contas */}
                <Card className="bg-slate-900/80 border-slate-800 text-white">
                    <CardHeader>
                        <CardTitle>Dados do Gerente de Contas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="manager-name">Nome do Gerente *</Label>
                            <Input
                                id="manager-name"
                                value={accountManagerData.name}
                                onChange={(e) => onAccountManagerDataChange({ ...accountManagerData, name: e.target.value })}
                                className="bg-slate-800 border-slate-700 text-white"
                                placeholder="Nome completo do gerente"
                                required
                            />
                        </div>
                        <div>
                            <Label htmlFor="manager-email">Email do Gerente *</Label>
                            <Input
                                id="manager-email"
                                type="email"
                                value={accountManagerData.email}
                                onChange={(e) => onAccountManagerDataChange({ ...accountManagerData, email: e.target.value })}
                                className="bg-slate-800 border-slate-700 text-white"
                                placeholder="gerente@empresa.com"
                                required
                            />
                        </div>
                        <div>
                            <Label htmlFor="manager-phone">Telefone do Gerente</Label>
                            <Input
                                id="manager-phone"
                                value={accountManagerData.phone}
                                onChange={(e) => onAccountManagerDataChange({ ...accountManagerData, phone: e.target.value })}
                                className="bg-slate-800 border-slate-700 text-white"
                                placeholder="(11) 99999-9999"
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-between mt-8">
                <Button 
                    variant="outline" 
                    onClick={onBack}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                    ← Voltar
                </Button>
                <Button 
                    onClick={handleContinue}
                    className="bg-blue-600 hover:bg-blue-700"
                >
                    Continuar para Calculadora →
                </Button>
            </div>
        </div>
    );
}
