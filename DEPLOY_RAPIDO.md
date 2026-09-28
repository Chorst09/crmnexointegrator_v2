# 🚀 Deploy Rápido do CRM - Porta 8081

## ✅ Garantia: Finanças Zen NÃO será afetado!

O CRM será instalado em diretório separado (`/var/www/crm-comercial`) e porta diferente (8081).

---

## 📋 Opção 1: Deploy Automatizado (Recomendado)

### Passo 1: Verificar Segurança (Opcional mas recomendado)
```bash
./verify-server-safety.sh usuario@72.60.195.200
```

### Passo 2: Enviar Arquivos
```bash
./deploy-to-server.sh usuario@72.60.195.200
```

### Passo 3: Configurar no Servidor
```bash
ssh usuario@72.60.195.200
cd /var/www/crm-comercial
./server-setup.sh
```

### Passo 4: Configurar Firewall
```bash
sudo ufw allow 8081/tcp
```

### Passo 5: Acessar
```
http://72.60.195.200:8081
```

**Pronto! 🎉**

---

## 📋 Opção 2: Deploy Manual

Siga o guia detalhado em: **[DEPLOY_SERVER_8081.md](DEPLOY_SERVER_8081.md)**

---

## 🔐 Credenciais Padrão

Após o deploy, faça login com:

- **Admin**: `admin@crm.com` / `admin123`
- **Diretor**: `diretor@crm.com` / `diretor123`
- **Vendedor**: `vendedor@crm.com` / `vendedor123`

⚠️ **Altere as senhas após o primeiro acesso!**

---

## 🛡️ Garantias de Segurança

| Item | Finanças Zen | CRM Comercial |
|------|--------------|---------------|
| **Porta** | 80 | 8081 |
| **Diretório** | `/var/www/financaszen` | `/var/www/crm-comercial` |
| **Processo PM2** | `financaszen` | `crm-api` |
| **Banco de Dados** | `financaszen_db` | `crm_comercial` |

**Conclusão**: São aplicações completamente independentes! ✅

Leia mais em: **[GARANTIAS_SEGURANCA.md](GARANTIAS_SEGURANCA.md)**

---

## 🔍 Verificar se está Funcionando

```bash
# Verificar Finanças Zen (deve continuar funcionando)
curl http://72.60.195.200

# Verificar CRM (novo)
curl http://72.60.195.200:8081/api/health

# Ver processos
ssh usuario@72.60.195.200 "pm2 list"
```

---

## 📚 Documentação Completa

- **[DEPLOY_RAPIDO.md](DEPLOY_RAPIDO.md)** ← Você está aqui
- **[DEPLOY_SERVER_8081.md](DEPLOY_SERVER_8081.md)** - Guia detalhado passo a passo
- **[GARANTIAS_SEGURANCA.md](GARANTIAS_SEGURANCA.md)** - Por que é seguro
- **Scripts**:
  - `verify-server-safety.sh` - Verificar antes do deploy
  - `deploy-to-server.sh` - Enviar arquivos
  - `server-setup.sh` - Configurar no servidor

---

## 🆘 Problemas?

### CRM não responde na porta 8081
```bash
ssh usuario@72.60.195.200
pm2 logs crm-api
```

### Verificar firewall
```bash
sudo ufw status
sudo ufw allow 8081/tcp
```

### Reiniciar CRM
```bash
pm2 restart crm-api
```

### Parar CRM (Finanças Zen continua funcionando)
```bash
pm2 stop crm-api
```

---

## ✅ Checklist Final

- [ ] Executei `verify-server-safety.sh` (opcional)
- [ ] Executei `deploy-to-server.sh`
- [ ] Executei `server-setup.sh` no servidor
- [ ] Configurei o firewall (`ufw allow 8081/tcp`)
- [ ] Testei o acesso: http://72.60.195.200:8081
- [ ] Verifiquei que Finanças Zen continua funcionando
- [ ] Alterei as senhas padrão

---

**Dúvidas?** Consulte a documentação completa ou execute os scripts de verificação.
