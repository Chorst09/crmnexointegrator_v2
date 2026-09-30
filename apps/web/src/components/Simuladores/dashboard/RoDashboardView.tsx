// src/components/dashboard/RoDashboardView.tsx
"use client";
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Partner, RO } from '@/lib/types';
import { differenceInDays, parseISO } from 'date-fns';

interface RoDashboardViewProps {
  ros: RO[];
  partners: Partner[];
}

const RoDashboardView: React.FC<RoDashboardViewProps> = ({ ros, partners }) => {

  const getDaysToExpire = (expiryDate: string) => {
    const today = new Date();
    const expiry = parseISO(expiryDate); // Use parseISO for 'YYYY-MM-DD'
    return differenceInDays(expiry, today);
  };

  const getStatusBadge = (days: number) => {
    if (days < 0) return <Badge variant="destructive">Expirado</Badge>;
    if (days <= 15) return <Badge className="bg-red-500 hover:bg-red-600">Crítico ({days}d)</Badge>;
    if (days <= 30) return <Badge className="bg-yellow-500 hover:bg-yellow-600">Atenção ({days}d)</Badge>;
    return <Badge className="bg-green-500 hover:bg-green-600">OK ({days}d)</Badge>;
  };

  const sortedRos = [...ros].sort((a, b) => getDaysToExpire(a.expiryDate) - getDaysToExpire(b.expiryDate));

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>RO&apos;s Próximos da Expiração</CardTitle>
        <CardDescription>
          Registros de oportunidade que precisam de atenção.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fabricante</TableHead>
                <TableHead>Nº do RO</TableHead>
                <TableHead>Cliente Final</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRos.slice(0, 5).map(ro => {
                const supplier = partners.find(p => p.id === Number(ro.supplierId));
                const daysToExpire = getDaysToExpire(ro.expiryDate);

                return (
                  <TableRow key={ro.id}>
                    <TableCell className="font-medium">{supplier?.name || 'N/A'}</TableCell>
                    <TableCell>{ro.roNumber}</TableCell>
                    <TableCell>{ro.clientName}</TableCell>
                    <TableCell>{getStatusBadge(daysToExpire)}</TableCell>
                  </TableRow>
                )
              })}
              {sortedRos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhum RO cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default RoDashboardView;
