# Correção B2G - Multi-Fontes e PDFs

**Data:** 2026-10-12
**Projeto:** NEXOS CRM - nexos.chorstconsult.com.br
**Servidor:** 209.50.241.25 (porta 3026)

---

## 🎯 Problemas Identificados

1. **Busca apenas no PNCP**: Sistema estava buscando somente na fonte PNCP, ignorando as outras 9 fontes configuradas
2. **PDFs não disponíveis**: Botões de download de PDF dos editais não apareciam nos cards

---

## 🔧 Correções Implementadas

### 1. Frontend - Ativação Automática de Todas as Fontes

**Arquivo:** `apps/web/src/pages/licitacoes_components/PipelineMonitor.tsx`

**Mudança:**
- Adicionado `useEffect` que garante que TODAS as 10 fontes sejam ativadas automaticamente no localStorage
- Se alguma fonte estiver faltando, ela é adicionada automaticamente
- Mensagens de log para debug

**Fontes Garantidas (10 no total):**
1. ✅ `pncp` - PNCP Oficial
2. ✅ `comprasnet` - ComprasNet / Compras.gov.br
3. ✅ `transparencia-curitiba` - Transparência Curitiba
4. ✅ `transparencia-federal` - Portal Transparência PR / Federal
5. ✅ `comprasgov-disputas` - Compras.gov.br Disputas
6. ✅ `contratacoes-14133` - Contratações Lei 14.133
7. ✅ `atas-srp` - Atas de Registro de Preços
8. ✅ `pregoes-siasg` - Pregões SIASG
9. ✅ `dou` - Imprensa Nacional (DOU)
10. ✅ `curitiba-ecompras` - e-Compras Curitiba

**Código Adicionado:**
```typescript
// Garantir que todas as fontes estejam ativas na inicialização (fix automático)
useEffect(() => {
  const ensureAllSourcesActive = () => {
    try {
      const saved = localStorage.getItem(ACTIVE_SOURCES_KEY);
      if (!saved) {
        // Se não existe, cria com todas ativas
        localStorage.setItem(ACTIVE_SOURCES_KEY, JSON.stringify(ALL_SOURCE_IDS));
        setActiveSources(new Set(ALL_SOURCE_IDS));
        console.log('[PipelineMonitor] ✅ Todas as 10 fontes ativadas automaticamente');
      } else {
        const arr = JSON.parse(saved);
        const current = new Set(Array.isArray(arr) ? arr : []);
        // Verifica se alguma fonte está faltando
        const missing = ALL_SOURCE_IDS.filter(id => !current.has(id));
        if (missing.length > 0) {
          const updated = new Set([...Array.from(current), ...missing]);
          localStorage.setItem(ACTIVE_SOURCES_KEY, JSON.stringify(Array.from(updated)));
          setActiveSources(updated);
          console.log(`[PipelineMonitor] ✅ ${missing.length} fontes faltantes foram ativadas: ${missing.join(', ')}`);
        }
      }
    } catch (e) {
      console.warn('[PipelineMonitor] Erro ao garantir fontes ativas:', e);
    }
  };
  ensureAllSourcesActive();
}, []);
```

---

### 2. Frontend - Botões de Download de PDF

**Arquivo:** `apps/web/src/pages/licitacoes_components/SearchPage.tsx`

**Mudança:**
- Adicionados botões de download de PDF nos cards dos editais
- Suporte para múltiplos documentos (mostra até 2, com contador "+N" se houver mais)
- Design consistente com o tema dark/teal

**Código Adicionado:**
```typescript
{/* Botões de Download de PDF */}
{(lic.documentos && lic.documentos.length > 0) || lic.pdfUrl ? (
  <div className="flex items-center gap-1.5">
    {lic.pdfUrl ? (
      <a href={lic.pdfUrl} target="_blank" rel="noopener noreferrer"
         className="flex items-center gap-1 px-2 py-1 rounded-md bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border border-rose-800/70 text-xs font-semibold transition-all cursor-pointer shadow-xs"
         title="Download do PDF do edital">
        <Download className="w-3 h-3" />
        <span>PDF</span>
      </a>
    ) : null}
    {lic.documentos && lic.documentos.slice(0, 2).map((doc, idx) => (
      <a key={idx} href={doc.url} target="_blank" rel="noopener noreferrer"
         className="flex items-center gap-1 px-2 py-1 rounded-md bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border border-rose-800/70 text-xs font-semibold transition-all cursor-pointer shadow-xs"
         title={doc.titulo || 'Download PDF'}>
        <Download className="w-3 h-3" />
        <span className="truncate max-w-[80px]">{doc.titulo?.substring(0, 15) || `Doc ${idx + 1}`}</span>
      </a>
    ))}
    {lic.documentos && lic.documentos.length > 2 && (
      <span className="text-xs text-slate-400 px-1">
        +{lic.documentos.length - 2}
      </span>
    )}
  </div>
) : null}
```

---

### 3. TypeScript - Interfaces Atualizadas

**Arquivo:** `apps/web/src/pages/licitacoes_components/types.ts`

**Mudanças:**
- Adicionada interface `DocumentoPDF` para estruturar documentos
- Adicionados campos `documentos?: DocumentoPDF[]` e `pdfUrl?: string` na interface `Licitacao`

**Código Adicionado:**
```typescript
export interface DocumentoPDF {
  titulo: string;
  url: string;
  tipo?: string;
  tamanho?: number;
}

export interface Licitacao {
  // ... campos existentes ...
  documentos?: DocumentoPDF[];
  pdfUrl?: string;
}
```

---

## 📦 Deploy Realizado

### Arquivos Deployados:

1. **Frontend Compilado (Build Vite):**
   ```bash
   cd apps/web && npm run build
   scp -r dist/* root@209.50.241.25:/var/www/crmnexointegrator_3026/apps/web/dist/
   ```

2. **Arquivos TypeScript Fonte:**
   ```bash
   scp apps/web/src/pages/licitacoes_components/types.ts root@209.50.241.25:/var/www/crmnexointegrator_3026/apps/web/src/pages/licitacoes_components/
   scp apps/web/src/pages/licitacoes_components/PipelineMonitor.tsx root@209.50.241.25:/var/www/crmnexointegrator_3026/apps/web/src/pages/licitacoes_components/
   scp apps/web/src/pages/licitacoes_components/SearchPage.tsx root@209.50.241.25:/var/www/crmnexointegrator_3026/apps/web/src/pages/licitacoes_components/
   ```

**Status do Deploy:** ✅ Concluído sem erros

---

## ⚠️ Limitações Conhecidas

### Backend NÃO Modificado

O backend (`backend/api/b2g-search.js`) **NÃO foi alterado** neste deploy porque:
1. Tentativas anteriores de modificação causaram instabilidade da API
2. Foi feito rollback para versão estável em `.rollback-b2g-20261012-122856/`
3. Backend atual **não retorna** os campos `documentos[]` ou `pdfUrl`

### Resultado Esperado:

1. ✅ **Multi-fonte funcionando**: O frontend agora envia o parâmetro `fontes=pncp,comprasnet,dou,...` com todas as 10 fontes
2. ✅ **UI preparada para PDFs**: Botões aparecem SE o backend retornar os campos
3. ⚠️ **PDFs ainda não disponíveis**: Backend precisa ser atualizado para buscar e retornar URLs de documentos

---

## 🔄 Próximos Passos (Se necessário)

### Para Habilitar Downloads de PDF:

O backend precisa ser modificado para:

1. **Buscar documentos da API PNCP:**
   ```javascript
   // Exemplo de endpoint PNCP para documentos:
   GET https://pncp.gov.br/api/consulta/v1/contratacoes/{ano}/{sequencial}/arquivos
   ```

2. **Adicionar campos na normalização:**
   ```javascript
   // Em cada normalize function:
   return {
     // ... campos existentes ...
     documentos: item.arquivos?.map(arq => ({
       titulo: arq.titulo,
       url: arq.url,
       tipo: arq.tipoDocumento
     })) || [],
     pdfUrl: item.linkEdital || null
   };
   ```

3. **Testar incrementalmente** uma fonte por vez (começar com PNCP)

4. **Criar backup antes de qualquer mudança:**
   ```bash
   cp backend/api/b2g-search.js .rollback-b2g-$(date +%Y%m%d-%H%M%S)/
   ```

---

## 🧪 Como Testar

1. **Acessar:** https://nexos.chorstconsult.com.br
2. **Login:** chorstconsult@gmail.com / Admin@2026
3. **Navegar:** B2G Dashboard → Buscar Editais
4. **Verificar:**
   - ✅ Indicador mostra "10 fontes ativas" (ou número configurado)
   - ✅ Resultados vêm de múltiplas fontes (verificar badge "PNCP", "DOU", etc.)
   - ⚠️ Botões de PDF aparecerão APENAS quando backend retornar os campos

5. **Console do navegador:**
   ```
   Abrir DevTools (F12) → Console
   Verificar mensagem: "[PipelineMonitor] ✅ Todas as 10 fontes ativadas automaticamente"
   ```

6. **Testar localStorage:**
   ```javascript
   // No console do navegador:
   JSON.parse(localStorage.getItem('pipeline_active_sources_v2'))
   // Deve retornar array com 10 IDs de fontes
   ```

---

## 📊 Status Atual

| Item | Status | Observação |
|------|--------|------------|
| Multi-fonte (frontend) | ✅ Corrigido | Todas as 10 fontes ativadas automaticamente |
| Parâmetro `fontes` enviado | ✅ Funcionando | SearchPage envia array de fontes ativas |
| UI botões PDF | ✅ Implementado | Aparece quando dados disponíveis |
| Backend retorna PDFs | ❌ Pendente | Precisa modificar b2g-search.js |
| API estável | ✅ OK | Health check respondendo |
| Frontend deployado | ✅ Completo | Build + deploy concluído |

---

## 🔐 Credenciais de Acesso

- **SSH:** root@209.50.241.25 (senha: <CONFIGURE_NO_AMBIENTE>)
- **Porta API:** 3026
- **PM2 Process:** crmnexointegrator_3026
- **Banco:** nexoscrm (porta 5433)

---

## 📝 Notas Finais

- **Sem instabilidade:** Deploy focou apenas em frontend para evitar problemas
- **Rollback disponível:** Versão anterior em `.rollback-b2g-20261012-122856/`
- **Logs PM2:** `pm2 logs crmnexointegrator_3026`
- **Restart API:** `pm2 restart crmnexointegrator_3026`

---

**Conclusão:** O problema de busca em múltiplas fontes foi **corrigido**. A infraestrutura para exibir PDFs está **pronta**, mas aguarda atualização do backend para retornar os dados de documentos.
