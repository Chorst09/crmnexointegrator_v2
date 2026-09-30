# 🚀 Deploy Manual - Funcionalidade "Adicionar à Proposta"

## 📦 Arquivos Atualizados

- `apps/web/src/pages/Calculadoras.jsx` - Componente principal com nova funcionalidade

## 🎯 O que foi implementado

### Nova Funcionalidade: Carrinho de Propostas

Agora é possível adicionar múltiplos itens (vendas, locações e serviços) antes de salvar a proposta final.

**Recursos implementados:**
- ✅ Botão "Adicionar à Proposta" ao lado de "Salvar Proposta"
- ✅ Carrinho visual mostrando todos os itens adicionados
- ✅ Contador de itens por tipo (vendas/locações/serviços)
- ✅ Remover itens individuais do carrinho
- ✅ Limpar todo o carrinho
- ✅ Cálculo automático de totais consolidados
- ✅ Validação para garantir pelo menos um item antes de salvar
- ✅ Limpeza automática do carrinho ao fechar modal

## 📋 Instruções de Deploy Manual

### Opção 1: Via SCP (Recomendado)

```bash
# 1. Enviar arquivo atualizado
scp apps/web/src/pages/Calculadoras.jsx root@72.60.195.200:/var/www/crm-comercial/apps/web/src/pages/

# 2. Conectar ao servidor
ssh root@72.60.195.200

# 3. Fazer build do frontend
cd /var/www/crm-comercial/apps/web
npm run build

# 4. Reiniciar aplicação
pm2 restart crm-api

# 5. Verificar logs
pm2 logs crm-api --lines 50
```

### Opção 2: Via Arquivo Compactado

```bash
# 1. No seu Mac, enviar o arquivo compactado
scp calculadoras-update-*.tar.gz root@72.60.195.200:/tmp/

# 2. Conectar ao servidor
ssh root@72.60.195.200

# 3. Descompactar no diretório correto
cd /var/www/crm-comercial
tar -xzf /tmp/calculadoras-update-*.tar.gz

# 4. Fazer build do frontend
cd /var/www/crm-comercial/apps/web
npm run build

# 5. Reiniciar aplicação
pm2 restart crm-api

# 6. Limpar arquivo temporário
rm /tmp/calculadoras-update-*.tar.gz
```

### Opção 3: Via Git (Se configurado)

```bash
# 1. Conectar ao servidor
ssh root@72.60.195.200

# 2. Ir para o diretório do projeto
cd /var/www/crm-comercial

# 3. Atualizar código
git pull origin main

# 4. Fazer build do frontend
cd apps/web
npm run build

# 5. Reiniciar aplicação
pm2 restart crm-api
```

## ✅ Verificação Pós-Deploy

### 1. Verificar se a aplicação está rodando

```bash
pm2 status
```

Deve mostrar `crm-api` com status `online`.

### 2. Testar a API

```bash
curl http://localhost:8081/api/health
```

Deve retornar status 200.

### 3. Verificar logs

```bash
pm2 logs crm-api --lines 50
```

Não deve haver erros críticos.

### 4. Testar no navegador

1. Acesse: http://72.60.195.200:8081
2. Faça login com: `admin@crm.com` / `admin123`
3. Vá para "Calculadoras"
4. Clique em uma calculadora (Venda, Locação ou Serviço)
5. Preencha os dados e clique em "Continuar"
6. Adicione itens nos "Parâmetros de Cálculo"
7. Clique em "Adicionar à Proposta" (botão verde)
8. Verifique se o carrinho aparece mostrando os itens
9. Adicione mais itens de outros tipos se desejar
10. Clique em "Salvar Proposta" (deve mostrar quantidade de itens)

## 🔍 Troubleshooting

### Erro: "Module not found"

```bash
cd /var/www/crm-comercial/apps/web
npm install
npm run build
pm2 restart crm-api
```

### Erro: "Permission denied"

```bash
sudo chown -R $USER:$USER /var/www/crm-comercial
```

### Frontend não atualiza

```bash
# Limpar cache do build
cd /var/www/crm-comercial/apps/web
rm -rf dist
npm run build
pm2 restart crm-api

# No navegador, pressione Ctrl+Shift+R para hard refresh
```

### API não reinicia

```bash
# Ver logs de erro
pm2 logs crm-api --err --lines 100

# Reiniciar com força
pm2 delete crm-api
cd /var/www/crm-comercial
pm2 start ecosystem.config.js
pm2 save
```

## 📊 Funcionalidades do Carrinho

### Estados do Carrinho

```javascript
proposalCart = {
  sales: [],      // Itens de venda
  rentals: [],    // Itens de locação
  services: []    // Itens de serviço
}
```

### Funções Principais

- `addToProposalCart()` - Adiciona itens calculados ao carrinho
- `removeFromProposalCart(type, itemId)` - Remove item específico
- `clearProposalCart()` - Limpa todo o carrinho
- `saveProposalWithCart()` - Salva proposta com todos os itens
- `getTotalCartItems()` - Retorna quantidade total de itens

### Fluxo de Uso

1. Usuário preenche dados da proposta
2. Usuário adiciona itens na calculadora (venda/locação/serviço)
3. Usuário clica em "Adicionar à Proposta"
4. Itens são adicionados ao carrinho com cálculos
5. Usuário pode mudar de aba e adicionar mais itens
6. Carrinho mostra todos os itens acumulados
7. Usuário clica em "Salvar Proposta" quando terminar
8. Proposta é salva com todos os itens do carrinho

## 🎨 Interface Visual

### Carrinho (quando tem itens)

```
🛒 Itens na Proposta (5)                    [Limpar Carrinho]

┌─ Vendas (2) ────────────────────────────────────────────┐
│ Servidor Dell    Qtd: 1 × R$ 8.500,00    R$ 10.200,00 🗑│
│ Switch Cisco     Qtd: 2 × R$ 3.000,00    R$ 7.200,00  🗑│
└──────────────────────────────────────────────────────────┘

┌─ Locações (2) ───────────────────────────────────────────┐
│ Storage EMC      Qtd: 1 × R$ 15.000,00   R$ 1.800,00/mês🗑│
│ Firewall         Qtd: 1 × R$ 8.000,00    R$ 960,00/mês 🗑│
└──────────────────────────────────────────────────────────┘

┌─ Serviços (1) ───────────────────────────────────────────┐
│ Consultoria TI   20h × R$ 150,00/h       R$ 3.000,00   🗑│
└──────────────────────────────────────────────────────────┘
```

### Botões de Ação

```
[Voltar aos Dados]  [Adicionar à Proposta]  [Salvar Proposta (5 itens)]  [Fechar]
```

## 📝 Commit Realizado

```
feat: Implementa funcionalidade 'Adicionar à Proposta' nas calculadoras

Principais mudanças:
- Adiciona carrinho de propostas para acumular múltiplos itens
- Novo botão 'Adicionar à Proposta' ao lado de 'Salvar Proposta'
- Permite adicionar vendas, locações e serviços antes de salvar
- Visualização do carrinho com contador de itens por tipo
- Função para remover itens individuais ou limpar todo o carrinho
- Cálculo automático de totais consolidados para propostas mistas
- Limpeza automática do carrinho ao fechar modal ou iniciar nova proposta
- Validação para garantir pelo menos um item antes de salvar
```

## 🔗 Links Úteis

- **Aplicação**: http://72.60.195.200:8081
- **Login Admin**: admin@crm.com / admin123
- **Documentação**: Ver CREDENCIAIS_ACESSO.md

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs: `pm2 logs crm-api`
2. Verifique o status: `pm2 status`
3. Reinicie a aplicação: `pm2 restart crm-api`
4. Faça hard refresh no navegador: `Ctrl+Shift+R`

---

**Deploy realizado em**: 19/02/2026
**Desenvolvido por**: Kiro AI Assistant
