"use client";
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientData, AccountManagerData } from "@/lib/types";
import { Pencil, Check, X } from "lucide-react";

interface ClientManagerInfoProps {
    clientData: ClientData;
    accountManagerData: AccountManagerData;
    onClientDataChange?: (data: ClientData) => void;
    onAccountManagerDataChange?: (data: AccountManagerData) => void;
}

export function ClientManagerInfo({
    clientData,
    accountManagerData,
    onClientDataChange,
    onAccountManagerDataChange
}: ClientManagerInfoProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [localClient, setLocalClient] = useState<ClientData>(clientData);
    const [localManager, setLocalManager] = useState<AccountManagerData>(accountManagerData);

    const handleSave = () => {
        if (onClientDataChange) onClientDataChange(localClient);
        if (onAccountManagerDataChange) onAccountManagerDataChange(localManager);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setLocalClient(clientData);
        setLocalManager(accountManagerData);
        setIsEditing(false);
    };

    const canEdit = !!(onClientDataChange || onAccountManagerDataChange);

    if (!isEditing) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-white">Cliente</h3>
                            {canEdit && (
                                <button
                                    onClick={() => { setLocalClient(clientData); setLocalManager(accountManagerData); setIsEditing(true); }}
                                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
                                    title="Editar dados do cliente e gerente"
                                >
                                    <Pencil className="h-3 w-3" />
                                    Editar
                                </button>
                            )}
                        </div>
                        <p className="text-slate-300 text-sm">{clientData?.name || "N/A"}</p>
                        {clientData?.projectName && <p className="text-slate-400 text-xs">Projeto: {clientData.projectName}</p>}
                        {clientData?.contact && <p className="text-slate-400 text-xs">Contato: {clientData.contact}</p>}
                        <p className="text-slate-400 text-xs">{clientData?.email || "N/A"}</p>
                        {clientData?.phone && <p className="text-slate-400 text-xs">{clientData.phone}</p>}
                    </CardContent>
                </Card>
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardContent className="p-4">
                        <h3 className="font-semibold text-white mb-2">Gerente de Contas</h3>
                        <p className="text-slate-300 text-sm">{accountManagerData?.name || "N/A"}</p>
                        <p className="text-slate-400 text-xs">{accountManagerData?.email || "N/A"}</p>
                        {accountManagerData?.phone && <p className="text-slate-400 text-xs">{accountManagerData.phone}</p>}
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="mb-6 border border-blue-500/30 rounded-xl p-4 bg-slate-900/60">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-blue-300">✏️ Editando dados do cliente e gerente</h3>
                <div className="flex gap-2">
                    <button onClick={handleSave} className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition">
                        <Check className="h-3 w-3" /> Salvar
                    </button>
                    <button onClick={handleCancel} className="flex items-center gap-1 text-xs border border-slate-600 text-slate-300 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition">
                        <X className="h-3 w-3" /> Cancelar
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cliente</h4>
                    <div>
                        <Label className="text-xs text-slate-400">Nome do Cliente *</Label>
                        <Input value={localClient.name} onChange={e => setLocalClient({ ...localClient, name: e.target.value })} className="bg-slate-800 border-slate-700 text-white h-8 text-sm mt-1" placeholder="Nome do cliente" />
                    </div>
                    <div>
                        <Label className="text-xs text-slate-400">Nome do Projeto</Label>
                        <Input value={localClient.projectName || ""} onChange={e => setLocalClient({ ...localClient, projectName: e.target.value })} className="bg-slate-800 border-slate-700 text-white h-8 text-sm mt-1" placeholder="Nome do projeto" />
                    </div>
                    <div>
                        <Label className="text-xs text-slate-400">Contato</Label>
                        <Input value={localClient.contact || ""} onChange={e => setLocalClient({ ...localClient, contact: e.target.value })} className="bg-slate-800 border-slate-700 text-white h-8 text-sm mt-1" placeholder="Nome do contato" />
                    </div>
                    <div>
                        <Label className="text-xs text-slate-400">Email *</Label>
                        <Input type="email" value={localClient.email} onChange={e => setLocalClient({ ...localClient, email: e.target.value })} className="bg-slate-800 border-slate-700 text-white h-8 text-sm mt-1" placeholder="email@cliente.com" />
                    </div>
                    <div>
                        <Label className="text-xs text-slate-400">Telefone</Label>
                        <Input value={localClient.phone || ""} onChange={e => setLocalClient({ ...localClient, phone: e.target.value })} className="bg-slate-800 border-slate-700 text-white h-8 text-sm mt-1" placeholder="(11) 99999-9999" />
                    </div>
                </div>
                <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gerente de Contas</h4>
                    <div>
                        <Label className="text-xs text-slate-400">Nome do Gerente *</Label>
                        <Input value={localManager.name} onChange={e => setLocalManager({ ...localManager, name: e.target.value })} className="bg-slate-800 border-slate-700 text-white h-8 text-sm mt-1" placeholder="Nome do gerente" />
                    </div>
                    <div>
                        <Label className="text-xs text-slate-400">Email *</Label>
                        <Input type="email" value={localManager.email} onChange={e => setLocalManager({ ...localManager, email: e.target.value })} className="bg-slate-800 border-slate-700 text-white h-8 text-sm mt-1" placeholder="gerente@empresa.com" />
                    </div>
                    <div>
                        <Label className="text-xs text-slate-400">Telefone</Label>
                        <Input value={localManager.phone || ""} onChange={e => setLocalManager({ ...localManager, phone: e.target.value })} className="bg-slate-800 border-slate-700 text-white h-8 text-sm mt-1" placeholder="(11) 99999-9999" />
                    </div>
                </div>
            </div>
        </div>
    );
}
