"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClientData, AccountManagerData } from '@/lib/types'; // Importar tipos centralizados

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
    const handleContinue = () => {
        if (!clientData.name || !clientData.email || !accountManagerData.name || !accountManagerData.email) {
            alert('Preencha os campos obrigatórios marcados com *');
            return;
        }
        onContinue();
    };

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
                            <Input
                                id="client-name"
                                value={clientData.name}
                                onChange={(e) => onClientDataChange({ ...clientData, name: e.target.value })}
                                className="bg-slate-800 border-slate-700 text-white"
                                placeholder="Nome completo do cliente"
                                required
                            />
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
