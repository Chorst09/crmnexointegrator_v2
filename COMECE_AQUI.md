# 🎯 COMECE AQUI - Deploy do CRM

## Situação Atual

Você está conectado no servidor via SSH, mas os arquivos do CRM estão no seu Mac.

---

## ✅ Solução em 2 Passos

### 1️⃣ No seu Mac (abra um NOVO terminal)

```bash
cd ~/Documents/crmcomercialkvm
# ou onde quer que esteja o projeto

./enviar-para-servidor.sh
```

### 2️⃣ No Servidor (terminal SSH que você já tem)

Aguarde o passo 1 terminar, depois:

```bash
cd /var/www/crm-comercial
tar -xzf crm-deploy.tar.gz
rm crm-deploy.tar.gz
```

Depois leia: **[PASSO_A_PASSO_SIMPLES.md](PASSO_A_PASSO_SIMPLES.md)** para continuar.

---

## 🤔 Não sabe onde está o projeto no Mac?

No seu Mac, execute:

```bash
# Procurar o projeto
find ~ -name "crmcomercialkvm" -type d 2>/dev/null

# Ou se souber que está em Documents
ls ~/Documents/
```

---

## 📋 Checklist Rápido

- [ ] Abri novo terminal no Mac
- [ ] Encontrei o diretório do projeto
- [ ] Executei `./enviar-para-servidor.sh`
- [ ] Voltei para o terminal SSH
- [ ] Descompactei os arquivos
- [ ] Segui o PASSO_A_PASSO_SIMPLES.md

---

## 🆘 Precisa de Ajuda?

**Problema**: "Não encontro o projeto no Mac"
- Procure por: `apps/api` e `apps/web`
- Ou procure por: `server.cjs`

**Problema**: "Script não executa"
- Execute: `chmod +x enviar-para-servidor.sh`
- Depois: `./enviar-para-servidor.sh`

**Problema**: "Não tenho acesso SSH do Mac"
- Use SCP manualmente (veja DEPLOY_SERVER_8081.md)

---

## 📚 Documentação Completa

- **PASSO_A_PASSO_SIMPLES.md** - Guia detalhado
- **DEPLOY_SERVER_8081.md** - Guia completo
- **GARANTIAS_SEGURANCA.md** - Por que é seguro

---

**Comece pelo passo 1 acima! 👆**
