# Como Ver as Mudanças na Página Inicial

## O Problema
As mudanças foram implementadas corretamente, mas o navegador pode estar usando cache antigo.

## Solução Rápida

### 1. Limpar Cache do Navegador (Recomendado)

**Chrome/Edge:**
- Pressione `Cmd + Shift + R` (Mac) ou `Ctrl + Shift + R` (Windows/Linux)
- Ou: `Cmd + Option + R` (Mac)

**Firefox:**
- Pressione `Cmd + Shift + R` (Mac) ou `Ctrl + Shift + R` (Windows/Linux)

**Safari:**
- Pressione `Cmd + Option + E` para limpar cache
- Depois `Cmd + R` para recarregar

### 2. Reiniciar o Servidor de Desenvolvimento

No terminal onde está rodando `npm run dev`:

```bash
# Parar o servidor (Ctrl + C)
^C

# Limpar cache do Vite
rm -rf apps/web/node_modules/.vite

# Reiniciar
npm run dev
```

### 3. Verificar a Rota

Certifique-se de estar acessando:
- `http://localhost:5174/` (rota raiz)

E NÃO:
- `http://localhost:5174/dashboard` (antiga rota)

## O Que Você Deve Ver

### Hero Section
- Banner grande com gradiente azul → roxo → rosa
- Mensagem "Bem-vindo, [Seu Nome]!"
- 4 cards com estatísticas no lado direito (desktop)
- Botões "Começar Agora" e "Ver Relatórios"

### Seção de Módulos
Você verá 4 cards grandes, cada um com:

1. **B2B Privado** 🏢
   - Gradiente azul → ciano
   - Ilustração de prédio (emoji grande)
   - 6 funcionalidades listadas
   - 3 estatísticas (127 oportunidades, 8.4% conversão, R$ 23k ticket)
   - Botão "Acessar B2B Privado"

2. **B2G Governo** 🏛️
   - Gradiente roxo → rosa
   - Ilustração de prédio governamental
   - 6 funcionalidades listadas
   - 3 estatísticas (43 editais, 32% sucesso, 12 atas)
   - Botão "Acessar B2G Governo"

3. **Gestão Comercial** 📊
   - Gradiente laranja → vermelho
   - Ilustração de gráfico
   - 6 funcionalidades listadas
   - 3 estatísticas (24 vendedores, 87% meta, 156 produtos)
   - Botão "Acessar Gestão Comercial"

4. **Pré-Vendas** 🧮
   - Gradiente verde → teal
   - Ilustração de calculadora
   - 6 funcionalidades listadas
   - 3 estatísticas (15 solicitações, 2.3h resposta, 94% aprovação)
   - Botão "Acessar Pré-Vendas"

### Seção de Planos
- 3 cards de planos (Starter, Professional, Enterprise)
- Professional destacado com "Mais Popular"
- 3 cards adicionais (Segurança, Performance, Suporte)

### CTA Final
- Banner com gradiente azul → roxo
- Título "Precisa de ajuda para escolher?"
- 2 botões: "Agendar demonstração" e "Falar com especialista"

## Se Ainda Não Aparecer

### Verificar Console do Navegador
1. Abra o DevTools (F12)
2. Vá na aba "Console"
3. Procure por erros em vermelho
4. Tire um print e me envie

### Verificar Network
1. No DevTools, vá na aba "Network"
2. Recarregue a página (F5)
3. Procure por `DashboardHome.jsx` na lista
4. Verifique se está retornando 200 (sucesso)

### Verificar Rota Atual
1. No DevTools, vá na aba "Console"
2. Digite: `window.location.pathname`
3. Deve retornar: `/`

## Comandos de Emergência

Se nada funcionar, execute:

```bash
# Parar servidor
^C

# Limpar tudo
rm -rf apps/web/node_modules/.vite
rm -rf apps/web/dist

# Reinstalar dependências (se necessário)
cd apps/web
npm install

# Voltar para raiz e reiniciar
cd ../..
npm run dev
```

## Arquivos Modificados

Confirme que estes arquivos existem:
- ✅ `apps/web/src/pages/DashboardHome.jsx` (novo)
- ✅ `apps/web/src/pages/Dashboard.jsx` (antigo, renomeado para Dashboard B2B)
- ✅ `apps/web/src/App.jsx` (atualizado)
- ✅ `apps/web/src/layout/Sidebar.jsx` (atualizado)

## Teste Rápido

No console do navegador, digite:

```javascript
localStorage.getItem('user')
```

Isso deve mostrar seus dados de usuário. Se retornar `null`, você precisa fazer login novamente.
