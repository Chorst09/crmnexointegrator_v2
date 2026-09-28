"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ClientData, AccountManagerData } from '@/lib/types';

interface ClientManagerInfoProps {
    clientData: ClientData;
    accountManagerData: AccountManagerData;
}

export function ClientManagerInfo({ clientData, accountManagerData }: ClientManagerInfoProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4">
                    <h3 className="font-semibold text-white mb-2">Cliente</h3>
                    <p className="text-slate-300 text-sm">{clientData?.name || 'N/A'}</p>
                    <p className="text-slate-400 text-xs">{clientData?.email || 'N/A'}</p>
                    {clientData?.phone && <p className="text-slate-400 text-xs">{clientData.phone}</p>}
                </CardContent>
            </Card>
            <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4">
                    <h3 className="font-semibold text-white mb-2">Gerente de Contas</h3>
                    <p className="text-slate-300 text-sm">{accountManagerData?.name || 'N/A'}</p>
                    <p className="text-slate-400 text-xs">{accountManagerData?.email || 'N/A'}</p>
                    {accountManagerData?.phone && <p className="text-slate-400 text-xs">{accountManagerData.phone}</p>}
                </CardContent>
            </Card>
        </div>
    );
}
