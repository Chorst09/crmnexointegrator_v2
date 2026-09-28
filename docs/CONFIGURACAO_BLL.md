# 🔐 Configuração de Credenciais BLL

## Visão Geral

O Portal de Busca agora permite que você configure suas próprias credenciais do BLL (Bolsa de Licitações e Leilões) diretamente pela interface, sem precisar editar código ou variáveis de ambiente.

## Como Configurar

### 1. Acesse a Aba "Ingestão"

No Portal de Busca, clique na aba **"Ingestão"** no topo da página.

### 2. Localize a Seção BLL

Role até a seção **"BLL — Bolsa de Licitações e Leilões"** (com ícone laranja).

### 3. Preencha suas Credenciais

- **Email**: Digite seu email de acesso ao BLL
- **Senha**: Digite sua senha do BLL

### 4. Salve as Credenciais

Clique no botão **"Salvar"** para armazenar suas credenciais localmente no navegador.

### 5. Teste a Conexão (Opcional)

Clique no botão **"Testar"** para verificar se suas credenciais estão corretas. O sistema tentará fazer login no BLL e mostrará:
- ✓ **autenticado** - Credenciais válidas
- ✗ **falha na autenticação** - Credenciais inválidas

## Como Funciona

### Armazenamento Local
- As credenciais são salvas no **localStorage** do seu navegador
- Elas **não são enviadas para nenhum servidor externo**
- Ficam disponíveis apenas no seu computador

### Uso nas Buscas
Quando você clica em **"Buscar no PNCP + BLL"**:
1. O sistema busca no PNCP (sem credenciais necessárias)
2. O sistema busca no BLL usando suas credenciais
3. Os resultados são combinados e exibidos juntos
4. Resultados do BLL aparecem com badge laranja **BLL**

### Segurança
- As credenciais são enviadas via **headers HTTP** para o proxy backend
- O proxy backend faz o login no BLL de forma segura
- O token de autenticação é cacheado por 30 minutos

## Prioridade de Credenciais

O sistema usa credenciais na seguinte ordem de prioridade:

1. **Headers HTTP** (credenciais configuradas na interface)
2. **Variáveis de ambiente** (BLL_EMAIL e BLL_PASSWORD)
3. **Credenciais padrão** (fallback)

## Gerenciar Credenciais

### Atualizar Credenciais
1. Vá na aba "Ingestão"
2. Altere os campos de email/senha
3. Clique em "Salvar"

### Remover Credenciais
1. Vá na aba "Ingestão"
2. Clique no botão **"Limpar"**
3. As credenciais serão removidas do localStorage

### Status da Conexão

O sistema mostra o status atual:
- **não configurado** - Nenhuma credencial salva
- **configurado** - Credenciais salvas
- **salvo** - Credenciais acabaram de ser salvas
- **testando...** - Testando conexão
- **✓ autenticado** - Login bem-sucedido
- **✗ falha na autenticação** - Erro no login
- **✗ erro** - Erro de conexão

## Troubleshooting

### Problema: "Falha na autenticação"
**Solução**: Verifique se seu email e senha estão corretos no portal BLL.

### Problema: "Erro ao testar credenciais"
**Solução**: 
- Verifique sua conexão com a internet
- Verifique se o backend está rodando
- Tente novamente em alguns minutos

### Problema: Resultados do BLL não aparecem
**Solução**:
1. Verifique se suas credenciais estão salvas (aba Ingestão)
2. Teste a conexão clicando em "Testar"
3. Abra o console do navegador (F12) e veja os logs
4. Procure por mensagens como "🔍 Resultados BLL: X"

### Problema: Credenciais não são salvas
**Solução**:
- Verifique se o localStorage está habilitado no navegador
- Tente em modo normal (não anônimo/privado)
- Limpe o cache e tente novamente

## Exemplo de Uso

```javascript
// As credenciais são enviadas automaticamente via headers
fetch('/api/bll-proxy?objeto=software&uf=PR', {
  headers: {
    'X-BLL-Email': 'seu-email@exemplo.com',
    'X-BLL-Password': 'sua-senha'
  }
})
```

## Logs de Debug

Abra o console do navegador (F12) para ver logs detalhados:

```
🔍 Resultados PNCP: 15
🔍 Resultados BLL: 8
🔍 Total após deduplicação: 23
```

## Segurança e Privacidade

### O que é armazenado?
- Email e senha do BLL no localStorage do navegador

### O que NÃO é armazenado?
- Nenhum dado é enviado para servidores externos
- Nenhum dado é compartilhado com terceiros
- Nenhum log de credenciais é mantido

### Recomendações
- Use credenciais específicas para integração (não sua conta pessoal)
- Não compartilhe suas credenciais com outras pessoas
- Limpe as credenciais ao usar computadores públicos

## Suporte

Para mais informações sobre o BLL:
- Site oficial: https://bll.org.br
- Documentação da API: Entre em contato com o suporte do BLL

---

**Desenvolvido com ❤️ para facilitar suas buscas de licitações**

Última atualização: 16 de Abril de 2026
