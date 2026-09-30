# Deploy: B2G GO → Criar Oportunidade

## Data: 28/05/2026

## Problema
O botão "Criar Oportunidade" não aparecia após salvar um lead com decisão GO no Portal de Busca B2G.

## Causa Raiz
O Nginx estava roteando **todas** as chamadas `/api/*` para o backend Node.js (porta 3001), mas as APIs do Next.js (leads, opportunities, companies, etc.) estão na porta 8080.

## Correções Aplicadas

### 1. Nginx — `/etc/nginx/sites-available/nexoscrm`
Adicionada regra de roteamento para APIs do Next.js **antes** do bloco genérico `/api/`:

```nginx
# APIs do Next.js (antes do bloco generico /api/)
location ~ ^/api/(leads|opportunities|companies|users|auth|licenses|deals|distributors|suppliers|edital-analyses|ai-analysis|b2b|backup|access-policies|opportunity-registrations|pncp-search|pre-sales-queue|pre-sales-quote-documents|pre-sales-requests|public|public-opportunities) {
    proxy_pass http://nexoscrm_frontend;
    ...
}
```

### 2. Next.js — `/var/www/crm-integrator/src/app/opportunities/new/page.tsx`
Adicionada leitura de parâmetros da URL para pré-preencher o formulário de nova oportunidade:

```typescript
const preAgency = searchParams.get("agency") ?? ""
const preProcessNumber = searchParams.get("processNumber") ?? ""
const preObjectSummary = searchParams.get("objectSummary") ?? ""
const preLocation = searchParams.get("location") ?? ""
const preSourcePortal = searchParams.get("sourcePortal") ?? ""
const preOpeningDate = searchParams.get("openingDate") ?? ""
```

## Fluxo Corrigido
1. Usuário busca edital no Portal de Busca
2. Clica "Salvar como Lead" → seleciona **GO**
3. Clica "Salvar Lead" → `/api/leads` vai para o Next.js ✅
4. Lead salvo → botão **"Criar Oportunidade →"** aparece
5. Clica → vai para `/opportunities/new` com dados pré-preenchidos
