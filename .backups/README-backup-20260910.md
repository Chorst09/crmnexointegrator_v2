# Backup Versão Funcional - 10/09/2026

## Status do Backup
✅ **VERSÃO TESTADA E VALIDADA LOCALMENTE**

## O que foi testado:
- ✅ Dashboard B2B: Funcionando corretamente
- ✅ Dashboard B2G: Funcionando corretamente
- ✅ Filtro "Vigentes": Corrigido e funcionando
- ✅ Data de abertura: Aparecendo corretamente
- ✅ Localização/Cidade: Aparecendo corretamente
- ✅ Busca de licitações: Funcionando

## Git Tag
- Tag: `v-backup-funcional-20260910-084933`
- Commit: `0dda50c`
- Mensagem: "fix: Ajusta filtro Vigentes para padrão permissivo"

## Últimos Commits
```
0dda50c (HEAD -> main, tag: v-backup-funcional-20260910-084933) fix: Ajusta filtro Vigentes para padrão permissivo
69fef6c fix: corrigir filtro VIGENTE e data de abertura no portal de busca B2G
8b0bf91 fix: Lógica rigorosa para filtro Vigentes - versão final
433904c fix: Melhora filtro 'Vigentes' considerando data de abertura
4747a6e fix: Corrige filtro 'Vigentes' para não incluir editais sem data de encerramento
```

## Banco de Dados Local
- Arquivo: `.backups/backup-banco-local-*.dump`
- Formato: PostgreSQL custom format (-F c)
- Para restaurar: `pg_restore -h localhost -p 5434 -U postgres -d nexoscrm_restored backup-banco-local-*.dump`

## Ambiente Local
- Docker: Funcionando na porta 5434
- Backend: http://localhost:3002
- Frontend: http://localhost:5174

## Usuários de Teste
- admin@crm.com / admin123 (ADMIN)
- chorstconsult@gmail.com / Admin@2026 (MASTER)

## Problemas Conhecidos em Produção
- Dashboards no modelo antigo
- Possível problema de deploy ou cache
- Necessário investigar diferença entre local e produção

## Próximos Passos
1. Fazer deploy desta versão em produção
2. Verificar se problema era cache ou deploy incompleto
3. Monitorar funcionamento em produção
