# Auditoria técnica — 2026-11-05 (fase 1)

## Escopo verificado
- Estrutura do repositório, README e manifests de dependências (raiz, frontend e backend).
- Configurações Docker (padrão, local, teste e produção).
- Testes de configuração de segurança existentes.
- Trechos de autenticação e isolamento multiempresa.

Esta é uma **auditoria inicial estática**, não uma certificação de segurança nem uma auditoria completa de execução. Não houve acesso ao banco de produção, execução de containers ou testes integrados.

## Correções nesta branch
1. `docker-compose.yml`: exige `DB_PASSWORD` em vez de usar senha fixa no arquivo.
2. `docker-compose.yml`: publica PostgreSQL apenas em `127.0.0.1:5433`, reduzindo exposição de rede.
3. `docker-compose.yml`: healthcheck valida o banco `nexoscrm`.
4. Teste de regressão em `backend/__tests__/security-config.test.js` para senha e bind da porta.

### Uso após a mudança
Configure `DB_PASSWORD` no ambiente ou em arquivo `.env` local **não versionado** antes de executar `docker compose up -d`. Use uma senha forte e exclusiva. A variável de ambiente só configura a senha de inicialização em um volume novo: **não altera automaticamente a senha de um PostgreSQL já inicializado**. Para um volume existente, coordene a alteração com a credencial já configurada no banco; não apague volumes para resolver o problema.

## Pendências identificadas (não alteradas nesta fase)
- `docker-compose.local.yml` e `docker-compose.test-db.yml` ainda têm credenciais fixas de desenvolvimento; avaliar compatibilidade antes de migrá-las.
- Revisar `backend/lib/tenantScope.js`: ausência de tenant retorna filtro vazio; confirmar que rotas sem tenant só são acessíveis por perfis autorizados e testar isolamento.
- Revisar rotas de autenticação, política de sessões, rate limiting, RBAC e recuperação de senha com testes de integração.
- Revisar versões e vulnerabilidades de dependências com auditoria automatizada.
- Conferir exposição de segredos históricos e artefatos de backup no repositório, sem reproduzir valores sensíveis.
- Consolidar fontes de verdade para APIs e migrações (existem múltiplas árvores `backend/`, `apps/api/` e `src/app/api/`).
- Validar build, lint, testes Jest e Docker Compose em CI antes do merge.

## Verificação recomendada
```bash
DB_PASSWORD='senha-forte-local' docker compose config --quiet
cd backend && npm ci && npm test -- --runInBand
```

**Estado:** correções submetidas para revisão; comandos acima ainda não executados neste trabalho.
