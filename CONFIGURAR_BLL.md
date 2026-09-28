# 🚀 Guia Rápido: Configurar BLL

## ✅ Passo a Passo

### 1️⃣ Abra o Portal de Busca
Acesse a página do Portal de Busca no sistema.

### 2️⃣ Clique na Aba "Ingestão"
No topo da página, você verá as abas:
- Resultados
- Filtros Salvos
- Alertas
- **Ingestão** ← Clique aqui

### 3️⃣ Role até a Seção BLL
Você verá duas seções:
- **PNCP** (azul) - Não precisa configurar
- **BLL** (laranja) - Configure aqui

### 4️⃣ Preencha suas Credenciais

```
┌─────────────────────────────────────────┐
│ Email                                   │
│ ┌─────────────────────────────────────┐ │
│ │ seu-email@exemplo.com               │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Senha                                   │
│ ┌─────────────────────────────────────┐ │
│ │ ••••••••                            │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Salvar] [Testar] [Limpar]             │
└─────────────────────────────────────────┘
```

### 5️⃣ Clique em "Salvar"
Suas credenciais serão salvas no navegador.

### 6️⃣ (Opcional) Clique em "Testar"
Verifica se suas credenciais estão corretas.

### 7️⃣ Faça uma Busca!
Volte para a aba "Resultados" e clique em **"Buscar no PNCP + BLL"**.

## 🎯 Resultado Esperado

Após configurar, você verá:

### Na Aba Ingestão:
```
Status: ✓ autenticado
```

### Nos Resultados:
Cards com badges indicando a fonte:
- Badge azul **PNCP** - Resultados do Portal Nacional
- Badge laranja **BLL** - Resultados da Bolsa de Licitações

### No Console (F12):
```
🔍 Resultados PNCP: 15
🔍 Resultados BLL: 8
🔍 Total após deduplicação: 23
```

## ⚡ Dicas Rápidas

### ✅ Fazer
- Salvar credenciais antes de buscar
- Testar conexão após salvar
- Verificar console para debug

### ❌ Não Fazer
- Compartilhar suas credenciais
- Usar em computadores públicos sem limpar depois
- Esquecer de salvar após preencher

## 🔧 Botões Disponíveis

| Botão | Função |
|-------|--------|
| **Salvar** | Salva credenciais no navegador |
| **Testar** | Verifica se credenciais são válidas |
| **Limpar** | Remove credenciais do navegador |

## 📊 Status Possíveis

| Status | Significado |
|--------|-------------|
| não configurado | Nenhuma credencial salva |
| configurado | Credenciais salvas e prontas |
| salvo | Acabou de salvar |
| testando... | Testando conexão agora |
| ✓ autenticado | Login bem-sucedido |
| ✗ falha na autenticação | Credenciais inválidas |
| ✗ erro | Erro de conexão |

## 🆘 Problemas Comuns

### Não vejo resultados do BLL
1. Verifique se salvou as credenciais
2. Teste a conexão
3. Veja o console (F12)

### "Falha na autenticação"
- Email ou senha incorretos
- Verifique no site do BLL

### Credenciais não salvam
- Use modo normal (não anônimo)
- Limpe cache do navegador

## 📱 Onde Encontrar suas Credenciais BLL

Se você não tem credenciais do BLL:
1. Acesse https://bll.org.br
2. Faça cadastro ou login
3. Use o email e senha cadastrados

## 🎉 Pronto!

Agora você pode buscar licitações em **duas fontes simultaneamente**:
- ✅ PNCP (Portal Nacional)
- ✅ BLL (Bolsa de Licitações)

---

**Tempo estimado**: 2 minutos

**Dificuldade**: Fácil 🟢

**Documentação completa**: `docs/CONFIGURACAO_BLL.md`
