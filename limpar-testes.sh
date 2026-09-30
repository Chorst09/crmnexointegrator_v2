#!/bin/bash

echo "🧹 Limpando TODOS os dados de teste do banco de dados..."
echo ""

PGPASSWORD=crm123 psql -h localhost -U crm -d crm -p 5432 << 'EOF'
-- Deletar todas as licenças
DELETE FROM "CompanyLicense";

-- Deletar todos os usuários (exceto MASTER)
DELETE FROM "User" WHERE role != 'MASTER';

-- Deletar todas as empresas
DELETE FROM "TenantCompany";

-- Deletar todas as assinaturas pendentes
DELETE FROM "PendingSubscription";

-- Mostrar resultado
SELECT 'Banco limpo!' as status;
EOF

echo ""
echo "✅ Banco de dados completamente limpo!"
echo ""
echo "Agora você pode testar com QUALQUER dado."
