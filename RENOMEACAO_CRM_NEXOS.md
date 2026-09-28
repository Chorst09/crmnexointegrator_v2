# Renomeação para CRM NEXOS

## Mudanças Realizadas

### Nome e Branding
Todos os locais foram atualizados de "CRM COMERCIAL B2G" para "CRM NEXOS"

### Arquivos Modificados:

1. **apps/web/src/pages/DashboardHome.jsx**
   - Header: "CRM NEXOS"
   - Footer: "© 2026 CRM NEXOS"
   - Hero: Título e descrição atualizados com foco em "conexões"

2. **apps/web/src/pages/Login.jsx**
   - Branding padrão: "CRM NEXOS"
   - Tagline: "Conexões inteligentes para resultados extraordinários"
   - Melhorado tratamento de erro no carregamento de branding

3. **apps/web/src/layout/Sidebar.jsx**
   - Nome padrão: "CRM NEXOS"
   - Subtítulo: "Conexões que impulsionam negócios"
   - Footer: "CRM NEXOS v2"

4. **apps/web/src/layout/Topbar.jsx**
   - Meta padrão: "CRM NEXOS"
   - Subtítulo: "Gestao comercial inteligente"

5. **apps/web/src/pages/Administracao.jsx**
   - Placeholder do campo appName: "CRM NEXOS"

6. **apps/web/src/App.jsx**
   - Adicionadas flags do React Router v7 para remover warnings

## Correções de Erros

### React Router Warnings
Adicionadas flags futuras para compatibilidade:
```javascript
<BrowserRouter future={{ 
  v7_startTransition: true, 
  v7_relativeSplatPath: true 
}}>
```

### Erros 401 (Unauthorized)
Os erros 401 que você está vendo são normais quando:
- Não está logado
- Tenta acessar `/api/settings` sem autenticação

Isso não impede o login de funcionar. O sistema usa valores padrão quando a API falha.

## Como Testar

1. **Limpar cache e reiniciar:**
   ```bash
   # Parar servidor (Ctrl+C)
   rm -rf apps/web/node_modules/.vite
   npm run dev
   ```

2. **No navegador:**
   - Limpar cache: `Cmd+Shift+R` (Mac) ou `Ctrl+Shift+R` (Windows)
   - Ou abrir janela anônima

3. **Verificar mudanças:**
   - Landing page (`/`): Deve mostrar "CRM NEXOS" no header
   - Login (`/login`): Deve mostrar "CRM NEXOS" e nova tagline
   - Após login: Sidebar deve mostrar "CRM NEXOS"

## Sobre os Erros no Console

### Erros que PODEM ser ignorados:
- ❌ 401 Unauthorized em `/api/settings` - Normal quando não logado
- ⚠️ React Router warnings - Corrigidos com as flags

### Erros que NÃO podem ser ignorados:
- ❌ Erros de sintaxe JavaScript
- ❌ Componentes não encontrados
- ❌ Erros de renderização

## Próximos Passos

1. **Atualizar banco de dados:**
   - Se houver um campo `appName` no banco, atualize para "CRM NEXOS"

2. **Atualizar variáveis de ambiente:**
   - Verifique se há `APP_NAME` em `.env` e atualize

3. **Atualizar documentação:**
   - README.md
   - Documentação de API
   - Guias de usuário

4. **Atualizar assets:**
   - Logo (se houver)
   - Favicon
   - Imagens de marketing

## Identidade Visual - CRM NEXOS

### Conceito
"NEXOS" representa conexões, vínculos e relacionamentos - perfeito para um CRM.

### Taglines Sugeridas:
- ✅ "Conexões inteligentes para resultados extraordinários" (Login)
- ✅ "Conexões que impulsionam negócios" (Sidebar)
- ✅ "Gestão Comercial Completa" (Header)

### Cores Sugeridas (já implementadas):
- Azul → Ciano (B2B)
- Roxo → Rosa (B2G)
- Laranja → Vermelho (Gestão)
- Verde → Teal (Pré-Vendas)
