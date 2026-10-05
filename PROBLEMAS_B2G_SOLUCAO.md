# Problemas B2G e Soluções

## Data: 05/10/2026
## Status: Investigação e Correção

---

## 🔴 PROBLEMA 1: Produção com 504 Gateway Timeout

### Sintomas
- API em https://nexos.chorstconsult.com.br retorna 504 em TODAS as rotas:
  - `/api/dashboard?type=b2b&period=30d` → 504
  - `/api/users` → 504
  - `/api/b2g-licitacoes/gerenciadas` → 504
  - `/api/b2g-licitacoes/buscar` → 504
  - Até `/api/health` → Timeout

### Causa
Backend de produção está **travado/congelado** ou **sobrecarregado**

### Solução
**Reiniciar o serviço backend em produção:**

```bash
# SSH para o servidor
ssh root@209.50.241.25

# Verificar status
pm2 status

# Reiniciar backend
pm2 restart nexoscrm-api
# ou
pm2 restart all

# Verificar logs
pm2 logs nexoscrm-api --lines 50
```

Se o problema persistir, verificar:
1. Memória disponível: `free -h`
2. Processos travados: `ps aux | grep node`
3. Banco de dados: conexões abertas no PostgreSQL

---

## 🟡 PROBLEMA 2: Local busca editais mas não traz arquivos

### Sintomas
- Busca dos editais funciona (retorna 58 editais)
- Mas ao clicar em um edital, a seção "DOCUMENTOS E ANEXOS OFICIAIS" não carrega arquivos
- Modal abre mas fica em loading infinito

### Causa Identificada
O código está correto no GitHub (commit `2d9138b`), mas o **backend local não está iniciando** devido a erros no Prisma durante a inicialização.

### Detalhes Técnicos

#### Fluxo Correto (como deveria funcionar)
1. Usuário clica em um edital na `SearchPage`
2. Abre o `LicitacaoDetalhesModal`
3. Modal faz `useEffect` que chama:
   ```javascript
   fetch(`/api/b2g-licitacoes/arquivos/${cnpj}/${ano}/${sequencial}`)
   ```
4. Backend (`b2g-licitacoes.cjs`) processa via função `getArquivosForEdital()`:
   - Busca no cache primeiro
   - Consulta API oficial do PNCP: 
     `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos`
   - Se não encontrar, busca metadados da compra e extrai do Portal de Compras Públicas
   - Retorna array de arquivos oficiais

5. Frontend renderiza lista de arquivos com botões de download

#### Problema no Backend Local
Backend trava durante inicialização com erro no Prisma:
```
Invalid `prisma.proposalTemplate.findFirst()` invocation
Unknown argument `type`. Did you mean `name`?
```

### Solução Temporária

**Opção 1: Usar backend já existente (se houver)**
```bash
# Verificar se há backend rodando em outra porta
lsof -i :3001
lsof -i :3002
lsof -i :5001

# Se encontrar, ajustar proxy do Vite para usar essa porta
```

**Opção 2: Corrigir erro do Prisma**
```bash
cd apps/api

# Regenerar client do Prisma
npx prisma generate

# Tentar migrate
npx prisma migrate dev

# Iniciar backend
npm run dev
```

**Opção 3: Usar produção para testes** (depois de reiniciar)
- Testar em https://nexos.chorstconsult.com.br depois de reiniciar o PM2

---

## ✅ CÓDIGO CORRETO JÁ ESTÁ NO GITHUB

### Repositório Correto
**https://github.com/Chorst09/nexoscrm**

### Commit Atual
- Local: `2d9138b` 
- GitHub: `2d9138b` (sincronizado)
- Tag: `v2.5.0-stable-b2g-ok-20261005`
- Mensagem: "fix(b2g): exibir e baixar documentos reais oficiais do PNCP sem injetar PDFs sinteticos"

### Arquivos Chave
1. **Backend**: `apps/api/api/b2g-licitacoes.cjs`
   - Rota `/arquivos/:cnpj/:ano/:seq` (linha 736)
   - Função `getArquivosForEdital()` (linha 619)
   - Cache de arquivos com TTL de 5 minutos

2. **Frontend**: `apps/web/src/pages/licitacoes_components/LicitacaoDetalhesModal.tsx`
   - useEffect busca arquivos ao abrir modal (linha 50-130)
   - Renderiza seção "DOCUMENTOS E ANEXOS OFICIAIS" (linha 388)

3. **Repositório de Editais**: `apps/api/api/editaisRepository.cjs`
   - 55 editais autênticos
   - Soma com 3 mocks = 58 editais totais

---

## 📋 CHECKLIST DE VERIFICAÇÃO

### Produção
- [ ] SSH para servidor 209.50.241.25
- [ ] `pm2 restart nexoscrm-api`
- [ ] Verificar logs: `pm2 logs`
- [ ] Testar health: `curl https://nexos.chorstconsult.com.br/api/health`
- [ ] Testar busca: fazer login e acessar "Buscar Editais"
- [ ] Testar arquivos: clicar em um edital e verificar se carrega documentos

### Local
- [ ] Resolver erro do Prisma (`type` não existe em `proposalTemplate`)
- [ ] Iniciar backend com sucesso na porta 3002
- [ ] Testar endpoint: `curl http://localhost:3002/api/health`
- [ ] Testar arquivos: `curl "http://localhost:3002/api/b2g-licitacoes/arquivos/76417005000186/2026/101"`
- [ ] Abrir frontend em http://localhost:5173
- [ ] Fazer login (admin@crm.com / admin123)
- [ ] Acessar "Buscar Editais"
- [ ] Clicar em um edital e verificar se carrega documentos

---

## 🔧 COMANDOS ÚTEIS

### Reiniciar Ambiente Local Completo
```bash
# Parar tudo
pkill -f "node.*server.cjs"
pkill -f "vite"

# Limpar e reinstalar (se necessário)
cd apps/api
rm -rf node_modules
npm install
npx prisma generate

# Iniciar backend
npm run dev

# Em outro terminal: iniciar frontend
cd apps/web
npm run dev
```

### Verificar Produção
```bash
# SSH
ssh root@209.50.241.25

# Status PM2
pm2 status
pm2 logs nexoscrm-api --lines 100

# Verificar processos
ps aux | grep node

# Verificar memória
free -h
df -h

# Testar API local
curl http://localhost:3002/api/health
curl "http://localhost:3002/api/b2g-licitacoes/buscar?termo=notebook&modalidade=6"
```

---

## 📝 NOTAS ADICIONAIS

### Autenticação na API
A rota `/api/b2g-licitacoes/*` está na **whitelist** de autenticação opcional (linha 271 do `server.cjs`):
- Se houver token Bearer, autentica
- Se não houver token, permite acesso mesmo assim

Isso permite que o endpoint `/arquivos` funcione sem autenticação para facilitar downloads diretos.

### Cache de Arquivos
- TTL: 5 minutos (300000ms)
- Armazena em memória via `Map()`
- Só faz cache se encontrou arquivos reais (`hasRealFiles: true`)

### Fontes de Arquivos (prioridade)
1. **API PNCP Arquivos**: `https://pncp.gov.br/api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq}/arquivos`
2. **Portal de Compras Públicas**: Extrai via regex do HTML se `linkSistemaOrigem` contém "portaldecompraspublicas.com.br"
3. **Fallback**: Array vazio `[]`

---

## ⚠️ AÇÃO IMEDIATA NECESSÁRIA

**PRIORIDADE ALTA**: Reiniciar backend de produção (504 afeta todos os módulos)

```bash
ssh root@209.50.241.25
pm2 restart all
pm2 logs --lines 50
```

**PRIORIDADE MÉDIA**: Corrigir erro Prisma no ambiente local

```bash
cd apps/api
npx prisma generate
npm run dev
```
