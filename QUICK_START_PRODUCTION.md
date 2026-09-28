# 🚀 Quick Start - Deploy em Produção

## Pré-requisitos
- Acesso SSH ao servidor 209.50.241.25
- Credenciais: root / <SSH_PASSWORD>

## Deploy Automático (Recomendado)

```bash
# 1. Executar script de deployment
./deploy.sh 209.50.241.25 root

# 2. Aguardar conclusão (leva ~5-10 minutos)

# 3. Acessar aplicação
# Abrir no navegador: http://209.50.241.25
```

## Credenciais de Acesso

```
Email: admin@crm.com
Senha: admin123
```

## Verificar Status

```bash
# SSH no servidor
ssh root@209.50.241.25

# Verificar backend
curl http://localhost:3001/health

# Verificar frontend
curl http://localhost/health

# Ver logs
pm2 logs nexoscrm-api
```

## Se Algo Der Errado

```bash
# Conectar ao servidor
ssh root@209.50.241.25

# Ver logs do backend
pm2 logs nexoscrm-api

# Ver logs do Nginx
tail -f /var/log/nginx/error.log

# Reiniciar backend
pm2 restart nexoscrm-api

# Reiniciar Nginx
systemctl restart nginx

# Verificar PostgreSQL
docker ps | grep postgres
```

## URLs Importantes

- **Frontend**: http://209.50.241.25
- **API**: http://209.50.241.25/api
- **Health**: http://209.50.241.25/health

## Próximas Ações

1. ✅ Executar deploy
2. ✅ Testar login
3. ✅ Verificar dashboard
4. ✅ Configurar SSL (opcional)
5. ✅ Configurar backups

---

**Tempo estimado**: 10-15 minutos
**Dificuldade**: Fácil (script automático)
