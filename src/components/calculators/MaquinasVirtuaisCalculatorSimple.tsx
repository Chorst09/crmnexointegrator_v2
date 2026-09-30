"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Server } from 'lucide-react';

interface VMPlan {
    id: string;
    name: string;
    cpu: number;
    ram: number;
    storage: number;
    price: number;
    setupCost: number;
    description: string;
}

const MaquinasVirtuaisCalculatorSimple = () => {
    const [selectedPlan, setSelectedPlan] = useState<VMPlan | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [contractPeriod, setContractPeriod] = useState(12);
    const [hasChanged, setHasChanged] = useState<boolean>(false);

    const initialVmPlans: VMPlan[] = [
        {
            id: 'vm-basic',
            name: 'VM Básica',
            cpu: 1,
            ram: 2,
            storage: 20,
            price: 89.90,
            setupCost: 150.00,
            description: '1 vCPU, 2GB RAM, 20GB SSD'
        },
        {
            id: 'vm-standard',
            name: 'VM Standard',
            cpu: 2,
            ram: 4,
            storage: 40,
            price: 159.90,
            setupCost: 200.00,
            description: '2 vCPU, 4GB RAM, 40GB SSD'
        },
        {
            id: 'vm-premium',
            name: 'VM Premium',
            cpu: 4,
            ram: 8,
            storage: 80,
            price: 289.90,
            setupCost: 300.00,
            description: '4 vCPU, 8GB RAM, 80GB SSD'
        }
    ];

    const [vmPlans, setVmPlans] = useState<VMPlan[]>(initialVmPlans);

    useEffect(() => {
        const savedPlans = localStorage.getItem('vmSimplePlans');
        if (savedPlans) {
            setVmPlans(JSON.parse(savedPlans));
        }
    }, []);

    useEffect(() => {
        if (selectedPlan) {
            const currentPlanInState = vmPlans.find(p => p.id === selectedPlan.id);
            if (currentPlanInState) {
                setSelectedPlan(currentPlanInState);
            }
        }
    }, [vmPlans, selectedPlan?.id, selectedPlan]);

    const monthlyPrice = selectedPlan ? selectedPlan.price * quantity : 0;
    const setupCost = selectedPlan ? selectedPlan.setupCost * quantity : 0;
    const totalFirstMonth = setupCost + monthlyPrice;

    const handlePlanSelect = (planId: string) => {
        const plan = vmPlans.find(p => p.id === planId);
        setSelectedPlan(plan || null);
        setHasChanged(false);
    };

    const handlePriceChange = (field: keyof VMPlan, value: string) => {
        if (!selectedPlan) return;
        const numericValue = parseFloat(value.replace(/[^0-9,.]+/g, "").replace(",", ".")) || 0;
        if (!isNaN(numericValue)) {
            const updatedPlans = vmPlans.map(plan =>
                plan.id === selectedPlan.id
                    ? { ...plan, [field]: numericValue }
                    : plan
            );
            setVmPlans(updatedPlans);
            localStorage.setItem('vmSimplePlans', JSON.stringify(updatedPlans));
            setHasChanged(true);
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <Server className="h-8 w-8 text-blue-600" />
                <h1 className="text-3xl font-bold">Calculadora de Máquinas Virtuais</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Seleção de Plano */}
                <Card>
                    <CardHeader>
                        <CardTitle>Selecionar Plano de VM</CardTitle>
                        <CardDescription>
                            Escolha o plano de máquina virtual adequado
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3">
                            {vmPlans.map((plan) => (
                                <div
                                    key={plan.id}
                                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedPlan?.id === plan.id
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    onClick={() => handlePlanSelect(plan.id)}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-semibold">{plan.name}</h3>
                                            <p className="text-sm text-gray-600">{plan.description}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-lg">
                                                R$ {plan.price.toFixed(2)}/mês
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                Setup: R$ {plan.setupCost.toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Configurações */}
                <Card>
                    <CardHeader>
                        <CardTitle>Configurações</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="contract-period">Período do Contrato</Label>
                            <Select
                                value={contractPeriod.toString()}
                                onValueChange={(value) => setContractPeriod(parseInt(value))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="12">12 meses</SelectItem>
                                    <SelectItem value="24">24 meses</SelectItem>
                                    <SelectItem value="36">36 meses</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="quantity">Quantidade de VMs</Label>
                            <Input
                                id="quantity"
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                            />
                        </div>

                        {selectedPlan && (
                            <div className="space-y-4 pt-4 border-t border-gray-200">
                                <h3 className="text-lg font-semibold">Preços do Plano Selecionado ({selectedPlan.name})</h3>
                                <div>
                                    <Label htmlFor="plan-price">Preço Mensal (R$)</Label>
                                    <Input
                                        id="plan-price"
                                        type="text"
                                        value={selectedPlan.price.toFixed(2).replace('.', ',')}
                                        onChange={(e) => handlePriceChange('price', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="plan-setup-cost">Custo de Setup (R$)</Label>
                                    <Input
                                        id="plan-setup-cost"
                                        type="text"
                                        value={selectedPlan.setupCost.toFixed(2).replace('.', ',')}
                                        onChange={(e) => handlePriceChange('setupCost', e.target.value)}
                                    />
                                </div>
                                {hasChanged && (
                                    <Button
                                        onClick={() => setHasChanged(false)}
                                        className="w-full"
                                    >
                                        Salvar Preços do Plano
                                    </Button>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Resumo dos Cálculos */}
            {selectedPlan && (
                <Card>
                    <CardHeader>
                        <CardTitle>Resumo da Proposta</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-600">Valor de Setup</p>
                                <p className="text-2xl font-bold text-blue-600">
                                    R$ {setupCost.toFixed(2)}
                                </p>
                            </div>
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-600">Mensalidade</p>
                                <p className="text-2xl font-bold text-green-600">
                                    R$ {monthlyPrice.toFixed(2)}
                                </p>
                            </div>
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-600">Total 1º Mês</p>
                                <p className="text-2xl font-bold text-purple-600">
                                    R$ {totalFirstMonth.toFixed(2)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default MaquinasVirtuaisCalculatorSimple;
