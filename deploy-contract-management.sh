#!/bin/bash
set -e

SERVER_IP="200.142.149.2"
SERVER_USER="root"
SERVER_PASS="${SSH_PASSWORD:?Defina SSH_PASSWORD no ambiente antes de executar}"

echo "=== Deploy de Gestão de Contratos com Segregação de Papéis ==="
echo ""

# 1. Build do frontend
echo "[1/5] Building frontend..."
cd apps/web
npm run build
cd ../..

# 2. Copiar arquivos do backend para o servidor
echo "[2/5] Uploading backend files..."
sshpass -p "$SERVER_PASS" scp backend/lib/permissions.cjs "$SERVER_USER@$SERVER_IP:/var/www/nexoscrm/backend/lib/"
sshpass -p "$SERVER_PASS" scp backend/lib/contracts-router.cjs "$SERVER_USER@$SERVER_IP:/var/www/nexoscrm/backend/lib/"
sshpass -p "$SERVER_PASS" scp backend/prisma/schema.prisma "$SERVER_USER@$SERVER_IP:/var/www/nexoscrm/backend/prisma/"

# 3. Aplicar migração do banco de dados
echo "[3/5] Applying database migration..."
sshpass -p "$SERVER_PASS" ssh "$SERVER_USER@$SERVER_IP" << 'ENDSSH'
export PGPASSWORD="${PGPASSWORD:?Configure a senha PostgreSQL no ambiente remoto}"
psql -h 127.0.0.1 -p 5433 -U nexoscrm -d doublecrm << 'ENDSQL'
-- AddContractSummaryAndAccessContracts
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "summary" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accessContracts" BOOLEAN NOT NULL DEFAULT false;
ENDSQL
ENDSSH

# 4. Deploy do frontend
echo "[4/5] Deploying frontend..."
TIMESTAMP=$(date +%Y%m%d-%H%M%S-%N | cut -b1-20)
RELEASE_NAME="release-$TIMESTAMP"

sshpass -p "$SERVER_PASS" ssh "$SERVER_USER@$SERVER_IP" "mkdir -p /var/www/nexoscrm/frontend/releases/$RELEASE_NAME"

cd apps/web/dist
tar -czf - . | sshpass -p "$SERVER_PASS" ssh "$SERVER_USER@$SERVER_IP" "cd /var/www/nexoscrm/frontend/releases/$RELEASE_NAME && tar -xzf -"
cd ../../..

sshpass -p "$SERVER_PASS" ssh "$SERVER_USER@$SERVER_IP" << ENDSSH2
cd /var/www/nexoscrm/frontend
ln -snf releases/$RELEASE_NAME current
ENDSSH2

# 5. Reiniciar API
echo "[5/5] Restarting API..."
sshpass -p "$SERVER_PASS" ssh "$SERVER_USER@$SERVER_IP" "pm2 restart nexoscrm-api"

echo ""
echo "=== Deploy concluído com sucesso! ==="
echo ""
echo "Alterações aplicadas:"
echo "  ✓ Campo 'summary' adicionado à tabela Contract"
echo "  ✓ Campo 'accessContracts' adicionado à tabela User"
echo "  ✓ Nova role CONTRACTS com acesso exclusivo ao módulo de contratos"
echo "  ✓ Permissões atualizadas para permitir acesso via accessContracts ou accessManagement"
echo "  ✓ Frontend atualizado com campo de resumo nos contratos"
echo "  ✓ Visualização de contratos na aba Empresas com resumo destacado"
echo ""
echo "Próximos passos:"
echo "  1. Criar usuários com role CONTRACTS para o time de contratos"
echo "  2. Configurar accessContracts=true para usuários do time de contratos"
echo "  3. Garantir que gerentes comerciais tenham accessManagement=true"
echo "  4. Time comercial verá contratos apenas no contexto de suas empresas"
echo ""
