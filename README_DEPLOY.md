# 📚 Documentação de Deploy - CRM Comercial

## 🎯 Início Rápido

**Quer fazer o deploy agora?** Comece aqui: **[DEPLOY_RAPIDO.md](DEPLOY_RAPIDO.md)**

---

## 📖 Índice da Documentação

### 🚀 Deploy e Instalação

1. **[DEPLOY_RAPIDO.md](DEPLOY_RAPIDO.md)** ⭐ COMECE AQUI
   - Guia rápido de 5 passos
   - Deploy automatizado
   - Comandos essenciais

2. **[DEPLOY_SERVER_8081.md](DEPLOY_SERVER_8081.md)**
   - Guia completo e detalhado
   - Passo a passo manual
   - Todas as configurações

3. **[GARANTIAS_SEGURANCA.md](GARANTIAS_SEGURANCA.md)** 🛡️
   - Por que é seguro fazer o deploy
   - Finanças Zen não será afetado
   - Verificações de segurança

### 🏗️ Arquitetura e Estrutura

4. **[ARQUITETURA_SERVIDOR.md](ARQUITETURA_SERVIDOR.md)**
   - Visão geral do servidor
   - Estrutura de diretórios
   - Fluxo de requisições
   - Diagramas visuais

### 🛠️ Scripts Automatizados

5. **[verify-server-safety.sh](verify-server-safety.sh)**
   - Verificar segurança antes do deploy
   - Checar status do servidor
   - Confirmar que Finanças Zen está OK

6. **[deploy-to-server.sh](deploy-to-server.sh)**
   - Enviar arquivos para o servidor
   - Fazer backup automático
   - Preparar instalação

7. **[server-setup.sh](server-setup.sh)**
   - Configurar tudo no servidor
   - Instalar dependências
   - Iniciar aplicação

### 📋 Referência

8. **[COMANDOS_UTEIS.md](COMANDOS_UTEIS.md)**
   - Comandos PM2
   - Comandos Prisma
   - Comandos PostgreSQL
   - Troubleshooting
   - Backup e restauração

---

## 🎯 Fluxo de Deploy Recomendado

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  1. Ler GARANTIAS_SEGURANCA.md                               │
│     └─> Entender que é seguro                                │
│                                                               │
│  2. Executar verify-server-safety.sh                         │
│     └─> Verificar status do servidor                         │
│                                                               │
│  3. Executar deploy-to-server.sh                             │
│     └─> Enviar arquivos                                      │
│                                                               │
│  4. Executar server-setup.sh (no servidor)                   │
│     └─> Configurar e iniciar                                 │
│                                                               │
│  5. Consultar COMANDOS_UTEIS.md                              │
│     └─> Gerenciar e monitorar                                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ Deploy em 3 Comandos

```bash
# 1. Enviar arquivos
./deploy-to-server.sh usuario@72.60.195.200

# 2. Configurar no servidor
ssh usuario@72.60.195.200 "cd /var/www/crm-comercial && ./server-setup.sh"

# 3. Configurar firewall
ssh usuario@72.60.195.200 "sudo ufw allow 8081/tcp"
```

**Pronto!** Acesse: http://72.60.195.200:8081

---

## 🛡️ Garantia de Segurança

### ✅ O que NÃO será afetado:

- Finanças Zen (porta 80)
- Banco de dados do Finanças Zen
- Arquivos do Finanças Zen
- Configurações do Finanças Zen

### ✅ O que será criado:

- CRM na porta 8081
- Novo diretório: `/var/www/crm-comercial`
- Novo banco: `crm_comercial`
- Novo processo PM2: `crm-api`

**Leia mais:** [GARANTIAS_SEGURANCA.md](GARANTIAS_SEGURANCA.md)

---

## 📊 Informações do Sistema

| Item | Valor |
|------|-------|
| **Servidor** | 72.60.195.200 |
| **Porta CRM** | 8081 |
| **Porta Finanças Zen** | 80 (não afetada) |
| **Diretório** | /var/www/crm-comercial |
| **Processo PM2** | crm-api |
| **Banco de Dados** | crm_comercial |

---

## 🔐 Credenciais Padrão

Após o deploy, faça login com:

```
Admin:
  Email: admin@crm.com
  Senha: admin123

Diretor:
  Email: diretor@crm.com
  Senha: diretor123

Vendedor:
  Email: vendedor@crm.com
  Senha: vendedor123
```

⚠️ **Altere as senhas após o primeiro acesso!**

---

## 🆘 Precisa de Ajuda?

### Problemas Comuns

1. **Porta 8081 não responde**
   ```bash
   ssh usuario@72.60.195.200 "pm2 logs crm-api"
   ```

2. **Erro de banco de dados**
   ```bash
   ssh usuario@72.60.195.200 "cd /var/www/crm-comercial/apps/api && npx prisma migrate deploy"
   ```

3. **Frontend não carrega**
   ```bash
   ssh usuario@72.60.195.200 "cd /var/www/crm-comercial/apps/web && npm run build"
   ```

**Mais soluções:** [COMANDOS_UTEIS.md](COMANDOS_UTEIS.md) - Seção Troubleshooting

---

## 📚 Documentos Adicionais do Projeto

- [README.md](README.md) - Informações gerais do projeto
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - Estrutura do código
- [IMPLEMENTACOES_CONCLUIDAS.md](IMPLEMENTACOES_CONCLUIDAS.md) - Features implementadas
- [VENDEDORES_SISTEMA.md](VENDEDORES_SISTEMA.md) - Documentação de vendedores

---

## ✅ Checklist de Deploy

- [ ] Li GARANTIAS_SEGURANCA.md
- [ ] Executei verify-server-safety.sh
- [ ] Executei deploy-to-server.sh
- [ ] Executei server-setup.sh no servidor
- [ ] Configurei firewall (ufw allow 8081/tcp)
- [ ] Testei acesso: http://72.60.195.200:8081
- [ ] Verifiquei que Finanças Zen continua funcionando
- [ ] Alterei senhas padrão
- [ ] Salvei as credenciais do banco de dados
- [ ] Configurei backup automático

---

## 🎉 Após o Deploy

1. Acesse: http://72.60.195.200:8081
2. Faça login com as credenciais padrão
3. Altere as senhas
4. Configure os usuários
5. Comece a usar o CRM!

---

## 📞 Suporte

Para dúvidas ou problemas:

1. Consulte [COMANDOS_UTEIS.md](COMANDOS_UTEIS.md)
2. Verifique os logs: `pm2 logs crm-api`
3. Revise [DEPLOY_SERVER_8081.md](DEPLOY_SERVER_8081.md)

---

**Boa sorte com o deploy! 🚀**
