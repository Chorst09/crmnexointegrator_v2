'use client';

import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Shield, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { normalizeUserRole } from '@/lib/permissions';

interface AccessControlProps {
  children: React.ReactNode;
  allowedRoles: string[];
  fallbackMessage?: string;
  onUnauthorized?: () => void;
}

export default function AccessControl({ 
  children, 
  allowedRoles, 
  fallbackMessage,
  onUnauthorized 
}: AccessControlProps) {
  const { user, loading } = useAuth();
  const normalizedAllowedRoles = React.useMemo(
    () => new Set(allowedRoles.map((role) => normalizeUserRole(role))),
    [allowedRoles]
  );

  // Mostrar loading enquanto verifica autenticação
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Verificando permissões...</span>
      </div>
    );
  }

  // Verificar se usuário está logado
  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-2" />
            <CardTitle>Acesso Negado</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              Você precisa estar logado para acessar esta funcionalidade.
            </p>
            <Button onClick={() => window.location.href = '/login'}>
              Fazer Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Verificar se usuário tem permissão
  const hasPermission = normalizedAllowedRoles.has(normalizeUserRole(user.role));

  if (!hasPermission) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 text-red-500 mx-auto mb-2" />
            <CardTitle>Acesso Restrito</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-2">
              {fallbackMessage || 'Você não tem permissão para acessar esta funcionalidade.'}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Seu nível de acesso: <span className="font-semibold capitalize">{user.role}</span>
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Níveis necessários: <span className="font-semibold">{allowedRoles.join(', ')}</span>
            </p>
            <Button 
              variant="outline" 
              onClick={onUnauthorized || (() => window.history.back())}
            >
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Usuário tem permissão, renderizar conteúdo
  return <>{children}</>;
}
